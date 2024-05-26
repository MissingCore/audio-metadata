import type { MetadataExcerpt, MetadataKey, MetadataKeys } from './types';
import { Buffer } from '../utils/Buffer';
import { FileError } from '../utils/errors';
import { FileReader } from '../utils/FileReader';
import { arrayIncludes } from '../utils/object';

/*
  Useful documentation:
    - https://xiph.org/flac/format.html
    - https://www.xiph.org/vorbis/doc/v-comment.html
    - https://exiftool.org/TagNames/Vorbis.html
*/

const BlockTypes = {
  text: [
    ...['ALBUM', 'ARTIST', 'TITLE', 'TRACKNUMBER'],
    ...['DATE', 'ORIGINALDATE', 'ORIGINALYEAR'],
  ],
  picture: ['PICTURE'],
} as const;

type TextId = (typeof BlockTypes.text)[number];
type PictureId = (typeof BlockTypes.picture)[number];
type MetaId = TextId | PictureId;

const BlockMetadataMap: Record<MetaId, MetadataKey> = {
  ALBUM: 'album',
  ARTIST: 'artist',
  PICTURE: 'artwork',
  TITLE: 'name',
  TRACKNUMBER: 'track',
  DATE: 'year',
  ORIGINALDATE: 'year',
  ORIGINALYEAR: 'year',
};

/** Reads FLAC metadata. */
export class FLACReader extends FileReader {
  wantedKeys: MetadataKeys = [];
  frames = {} as Record<MetadataKey, string>;

  constructor(uri: string, options: MetadataKeys) {
    super(uri);
    this.wantedKeys = options;
  }

  /** Get FLAC metadata. */
  async getMetadata() {
    await this.initBuffer();

    // Process the file.
    while (!this.finished) await this.processBlock();

    // Return the results.
    return {
      format: `FLAC`,
      metadata: Object.fromEntries(
        Object.entries(this.frames).map(([key, value]) => {
          let valAsNum: number | undefined;
          if (key === 'track') valAsNum = Number(value.split('/')[0]);
          else if (key === 'year') valAsNum = Number(value.slice(0, 4));

          return [key, valAsNum && !isNaN(valAsNum) ? valAsNum : value];
        })
      ) as MetadataExcerpt<typeof this.wantedKeys>,
    };
  }

  /** Initialize buffer through `FilerReader`. */
  async initBuffer() {
    await this.initDataFrom({ size: 4 });

    // First 4 bytes should encode the string "fLaC".
    if (Buffer.bytesToString(this.read(4)) !== 'fLaC')
      throw new FileError('Does not follow proper FLAC format.');
  }

  /** FLAC metadata is stored inside of "Metadata Blocks". */
  async processBlock() {
    await this.initDataFrom({ size: 4, offset: this.filePosition });
    const { isLast, type, size } = this.processBlockHeader();
    await this.initDataFrom({ size, offset: this.filePosition });

    if (type === 4) {
      // This is a "VORBIS_COMMENT" block containing the tags.
      this.processVorbisCommentBlockData();
    } else if (type === 6 && arrayIncludes(this.wantedKeys, 'artwork')) {
      // This is a "PICTURE" block.
      this.processPictureBlockData(size);
    } else {
      this.skip(size);
    }

    // Since we only load the size of the block as we don't know how much
    // space all the Metadata Blocks take up, we need to ensure `this.finished`
    // is `false` when we're not done.
    if (isLast || Object.keys(this.frames).length === this.wantedKeys.length) {
      this.finished = true;
    } else {
      this.finished = false;
    }
  }

  /** A Metadata Block Header is made up of 4 bytes. */
  processBlockHeader() {
    const blockInfoByte = this.read(1)[0];
    return {
      /** If this Metadata Block is the last one before FLAC frames start. */
      isLast: Buffer.readBitsInByte(blockInfoByte, 0, 1) === 1,
      type: Buffer.readBitsInByte(blockInfoByte, 1, 7),
      /** Length/size of metadata that follows Metadata Block Header. */
      size: Buffer.bytesToInt(this.read(3)),
    };
  }

  /** Returns a string represented by the contents of FLAC tag. */
  processVorbisCommentBlockData() {
    /* Vorbis field lengths are in Little Endian & text is encoded in UTF-8. */
    const vendorLength = Buffer.bytesToInt(this.read(4), 8, false);
    // Skip vendor string.
    this.skip(vendorLength);

    // Get the number of comments available.
    const commentListLength = Buffer.bytesToInt(this.read(4), 8, false);
    for (let i = 0; i < commentListLength; i++) {
      const commentLength = Buffer.bytesToInt(this.read(4), 8, false);
      // Read comment encoded in UTF-8.
      const comment = Buffer.bytesToString(this.read(commentLength), 3);
      const [txtKey, value] = comment.split('=');
      const metaKey = BlockMetadataMap[txtKey as TextId];
      // If we want to include this value in the return results.
      const isWanted = arrayIncludes(this.wantedKeys, metaKey ?? '');
      // Make sure we don't overrride an existing value (ie: there can be
      // multiple `ARTIST` values).
      if (isWanted && this.frames[metaKey] === undefined) {
        this.frames[metaKey] = value;
      }
    }
  }

  /** Returns the base64 representation of the image. */
  processPictureBlockData(size: number) {
    const pictureType = Buffer.bytesToInt(this.read(4));
    // We'll ignore the picture if it's not classified as `Other` or `Cover (front)`
    if (pictureType !== 0 && pictureType !== 3) {
      this.skip(size - 4);
      return;
    }

    const mimeLength = Buffer.bytesToInt(this.read(4));
    const mimeType = Buffer.bytesToString(this.read(mimeLength));

    const descriptionLength = Buffer.bytesToInt(this.read(4));
    this.skip(descriptionLength);

    // Skip other image metadata (ie: width, height, color depth, etc.).
    this.skip(16);

    const pictureLength = Buffer.bytesToInt(this.read(4));
    const pictureData = this.read(pictureLength);

    this.frames.artwork = `data:${mimeType};base64,${Buffer.bytesToBase64(pictureData)}`;
  }
}
