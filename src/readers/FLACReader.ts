import type { MetadataKey } from '../MetadataExtractor.types';
import { Buffer } from '../utils/Buffer';
import { FileError } from '../utils/errors';
import { FileReader } from '../utils/FileReader';

/*
  Useful documentation:
    - https://xiph.org/flac/format.html
    - https://www.xiph.org/vorbis/doc/v-comment.html
    - https://exiftool.org/TagNames/Vorbis.html
*/

/** Array of Vorbis Comment field names we'll support. */
const VorbisCommentFieldNames = [
  ...['ALBUM', 'ARTIST', 'TITLE', 'TRACKNUMBER'],
  // We'll support dates that start with the year.
  ...['DATE', 'ORIGINALDATE', 'ORIGINALYEAR'],
] as const;

type FieldName = (typeof VorbisCommentFieldNames)[number];

/** Vorbis Comment Field Name Metadata Map */
const VCFNMetadataMap: Record<FieldName, MetadataKey> = {
  ALBUM: 'album',
  ARTIST: 'artist',
  TITLE: 'name',
  TRACKNUMBER: 'track',
  DATE: 'year',
  ORIGINALDATE: 'year',
  ORIGINALYEAR: 'year',
};

/**
 * Reads FLAC metadata.
 * - Numbers are Big Endian unless otherwise specified.
 */
export class FLACReader extends FileReader {
  /** Get FLAC metadata. */
  async getMetadata() {
    await this.initialize();

    // Process the file.
    while (!this.finished) await this.processBlock();

    // Return the results.
    return {
      format: `FLAC`,
      metadata: this.formatMetadata(),
    };
  }

  /**
   * Initialize buffer through `FileReader`.
   *
   * Throws an error if we don't encounter `fLaC` after reading the first
   * 4 bytes.
   */
  async initialize() {
    await this.initDataFrom({ size: 4 });

    if (Buffer.bytesToString(this.read(4)) !== 'fLaC')
      throw new FileError('Does not follow proper FLAC format.');
  }

  /**
   * FLAC metadata is stored inside of "Metadata Blocks" made up of:
   *  - A 4-byte header.
   *  - Data whose size is specified by its header.
   */
  async processBlock() {
    // Handle the block header.
    await this.initDataFrom({ size: 4, offset: this.filePosition });
    const { isLast, type, length } = this.processBlockHeader();

    // Handle the block data.
    await this.initDataFrom({ size: length, offset: this.filePosition });
    if (type === 4) {
      this.processVorbisCommentBlockData();
    } else if (type === 6 && this.wantedTags.includes('artwork')) {
      this.processPictureBlockData(length);
    } else {
      this.skip(length);
    }

    // We need to make sure `this.finished` is `false` when reading this
    // file as we don't know the amount of space Metadata Blocks take up
    // cumulatively in the file unlike with ID3.
    if (isLast || this.shouldFinishEarly()) this.finished = true;
    else this.finished = false;
  }

  /**
   * A Metadata Block Header is made up of 4 bytes specifying:
   *  - [1 Bit] If this is the last block before the FLAC Frames start.
   *  - [7 Bits] The type of this block (4: VORBIS_COMMENT, 6: PICTURE).
   *  - [3 Bytes] The length of the data following this header.
   */
  processBlockHeader() {
    const [byteOne] = this.read(1);
    return {
      isLast: Buffer.readBitsInByte(byteOne, 0, 1) === 1,
      type: Buffer.readBitsInByte(byteOne, 1, 7),
      length: Buffer.bytesToInt(this.read(3)),
    };
  }

  /**
   * A "VORBIS_COMMENT" Metadata Block Data follows different specifications
   * compared to the rest of the FLAC Metadata Block:
   *  - Numbers are in Little Endian.
   *  - Text is encoded in UTF-8.
   *
   * Otherwise, it follows the following structure:
   *  - [4 Bytes] Vendor Length.
   *  - [n Bytes] Vendor String.
   *  - [4 Bytes] Number of "comments" (ie: metadata tags).
   *  - Looping n Times:
   *    - [4 Bytes] Length of "comment".
   *    - [n Bytes] Contents of "comment" (ie: `key=value`).
   */
  processVorbisCommentBlockData() {
    const vendorLength = Buffer.bytesToInt(this.read(4), 8, false);
    this.skip(vendorLength); // Skip as not needed.

    const commentListLength = Buffer.bytesToInt(this.read(4), 8, false);

    for (let i = 0; i < commentListLength; i++) {
      const commentLength = Buffer.bytesToInt(this.read(4), 8, false);
      const comment = Buffer.bytesToString(this.read(commentLength), 3);
      const [fieldName, value] = comment.split('=');

      const metadataKey = VCFNMetadataMap[fieldName as FieldName] ?? '';
      // If we want to return this metadata tag.
      const isWanted = this.wantedTags.includes(metadataKey);
      // Make sure we don't overrride an existing value (ie: there can be
      // multiple `ARTIST` values).
      if (isWanted && this.tags[metadataKey] === undefined) {
        this.tags[metadataKey] = value;
      }
    }
  }

  /**
   * A "PICTURE" Metadata Block Data has been available since FLAC v1.1.3
   * (27-Nov-2006) and has the following structure:
   *  - [4 Bytes] Picture type following ID3v2 specifications.
   *  - [4 Bytes] Length of MIME type.
   *  - [n Bytes] MIME type.
   *  - [4 Bytes] Length of description string.
   *  - [n Bytes] Description of picture **encoded in `UTF-8`**.
   *  - [16 Bytes] Information we don't care about (ie: picture dimensions,
   *  color depth, etc.)
   *  - [4 Bytes] Length of picture data.
   *  - [n Bytes] Picture data.
   */
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

    this.skip(16); // Skip other image metadata.

    const pictureLength = Buffer.bytesToInt(this.read(4));
    const pictureData = this.read(pictureLength);
    this.tags.artwork = `data:${mimeType};base64,${Buffer.bytesToBase64(pictureData)}`;
  }
}
