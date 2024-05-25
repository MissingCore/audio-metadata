import type { MetadataExcerpt, MetadataKey, MetadataKeys } from '../types';
import { read } from '../../libs/fs';
import type { Encoding } from '../../utils/Buffer';
import { Buffer } from '../../utils/Buffer';
import { FileError } from '../../utils/errors';
import { FileReader } from '../../utils/FileReader';
import { arrayIncludes } from '../../utils/object';

/*
  Useful documentation:
    - https://id3.org/Developer%20Information
    - https://mutagen-specs.readthedocs.io/en/latest/id3/id3v2.4.0-structure.html

  Inspiration:
    - https://gigamonkeys.com/book/practical-an-id3-parser
    - https://github.com/MehrabSp/expo-music-info-2
*/

/* 
  Frame ids for ID3v2 tags
    - https://www.exiftool.org/TagNames/ID3.html
    - https://mutagen-specs.readthedocs.io/en/latest/id3/id3v2.4.0-frames.html
*/
const FrameTypes = {
  text: [
    // ID3v2.2 Tag Ids
    ...['TAL', 'TP1', 'TT2', 'TRK', 'TYE'],
    // ID3v2.3/4 Tag Ids
    ...['TALB', 'TPE1', 'TIT2', 'TRCK', 'TYER', 'TDRC'],
  ],
  picture: ['PIC', 'APIC'],
} as const;

type TextFrameId = (typeof FrameTypes.text)[number];
type PictureFrameId = (typeof FrameTypes.picture)[number];
type FrameId = TextFrameId | PictureFrameId;

const FrameMetadataMap: Record<FrameId, MetadataKey> = {
  TAL: 'album',
  TP1: 'artist',
  PIC: 'artwork',
  TT2: 'name',
  TRK: 'track',
  TYE: 'year',

  TALB: 'album',
  TPE1: 'artist',
  APIC: 'artwork',
  TIT2: 'name',
  TRCK: 'track',
  TYER: 'year', // ID3v2.3 "Year"
  TDRC: 'year', // ID3v2.4 "Recording Time"
};

/**
 * Reads ID3v2 metadata (supporting unsynchronisation) stored at the
 * beginning of a MP3 file.
 */
export class ID3v2Reader extends FileReader {
  wantedKeys: MetadataKeys = [];
  frames = {} as Record<FrameId, string>;
  version = 0; // The minor version of the spec (`2 | 3 | 4`).

  /* Extra flags */
  unsynch = false;
  xHeader = false;
  // Present in ID3v2.4 — makes it easier searching tag from the end of
  // the file — currently unused.
  footer = false;

  constructor(uri: string, options: MetadataKeys) {
    super(uri);
    this.wantedKeys = options;
  }

  /** Get MP3 metadata. */
  async getMetadata() {
    /* Buffer initialization. */
    const data = Buffer.base64ToBuffer(await read(this.fileUri, 4, 6));
    // Add 10 bytes to buffer size since it's not included.
    //  - We currently ignore the footer.
    const tagSize = 10 + Buffer.bytesToInt([...data], 7);
    await this.initDataFrom({ size: tagSize });

    // Process the file (ID3v2 Tag Header & Frames).
    this.processHeader();
    // Handle if the rest of the tag has unsynchronisation. Since the
    // extended header is separate from the header, it's subjected to
    // unsynchronisation if present.
    if (this.unsynch) this.unsynchBuffer(10);
    this.processExtendedHeader();
    while (!this.finished) this.processFrame();

    // Return the results.
    return {
      format: `ID3v2.${this.version}`,
      metadata: Object.fromEntries(
        Object.entries(this.frames).map(([key, value]) => {
          const metadataKey = FrameMetadataMap[key as FrameId];

          let valAsNum: number | undefined;
          if (metadataKey === 'track') valAsNum = Number(value.split('/')[0]);
          else if (metadataKey === 'year') valAsNum = Number(value.slice(0, 4));

          return [metadataKey, valAsNum && !isNaN(valAsNum) ? valAsNum : value];
        })
      ) as MetadataExcerpt<typeof this.wantedKeys>,
    };
  }

  /** Read information in the header of an ID3v2 tag (first 10 bytes). */
  processHeader() {
    // First 3 bytes should encode the string "ID3".
    if (Buffer.bytesToString(this.read(3)) !== 'ID3')
      throw new FileError('Not an ID3v2 tag.');

    // Next 2 bytes encodes the major version & revision.
    const [version] = this.read(2);
    this.version = Buffer.bytesToInt([version]);
    if (this.version > 4)
      throw new FileError(`ID3v2.${this.version} is not supported.`);

    // Next byte is treated as flags.
    const flags = this.read(1);
    const flagsAsBinary = Buffer.byteToBinary(flags[0]); // Make sure we get 8 bits.
    this.unsynch = flagsAsBinary[0] === '1';
    this.xHeader = flagsAsBinary[1] === '1';
    this.footer = this.version === 4 && flagsAsBinary[3] === '1';

    // Last 4 bytes gives the total size of the tag excluding the header
    // (stored as a 32 bit synchsafe integer).
    this.dataSize = Buffer.bytesToInt(this.read(4), 7);
  }

  /** Read information in the extended header of an ID3v2.3/4 tag if it exists. */
  processExtendedHeader() {
    if (!this.xHeader) return;
    if (this.version === 2)
      throw new FileError('Compression bit should not be set for ID3v2.2.');

    /*
      We currently don't support the extended header, so we'll skip it.
    */
    if (this.version === 4) {
      // First 4 bytes is the remaining size of the extended header as a 32 bit synchsafe integer.
      this.skip(Buffer.bytesToInt(this.read(4), 7));
    } else {
      // In ID3v2.3, the remaining extended header size is 6 or 10 bytes.
      this.skip(Buffer.bytesToInt(this.read(4)));
    }
  }

  /** Process a frame (tag data is divided into frames). */
  processFrame() {
    // Frame id is 3 (ID3v2.2) / 4 (ID3v2.3/4) bytes long.
    const frameId = Buffer.bytesToString(this.read(this.version === 2 ? 3 : 4));
    // Hit the "padding" when we get a `null` byte instead of a frame identifier.
    if (frameId === '') {
      this.finished = true;
      return;
    }

    // Frame size is 3 (ID3v2.2) / 4 (ID3v2.3/4) bytes long. Note that ID3v2.3
    // frame size isn't stored as a 32 bit synchsafe integer (unlike ID3v2.4).
    //  - https://hydrogenaud.io/index.php/topic,67145.msg602034.html#msg602034
    let frameSize =
      this.version === 2
        ? Buffer.bytesToInt(this.read(3))
        : Buffer.bytesToInt(this.read(4), this.version === 3 ? 8 : 7);

    let frameUnsych = false; // Only matters for ID3v2.4
    if (this.version > 2) {
      // Next 2 bytes are treated as flags.
      const flags = this.read(2);
      if (this.version === 4) {
        frameUnsych = Buffer.byteToBinary(flags[1])[6] === '1';
        if (this.unsynch) {
          if (!frameUnsych) {
            throw new FileError(
              'All frames in tag should have unsynchronisation, however unsynchronisation flag in frame is unset.'
            );
          }
          frameUnsych = false; // Don't un-unsynchronise again.
        }
      }
    }

    // -=- Finished Processing Frame Header -=-

    // Process the frame once we identify the frame type & exit early
    // if we got all the data we needed.
    const isWanted = arrayIncludes(
      this.wantedKeys,
      FrameMetadataMap[frameId as FrameId]
    );
    if (isWanted && arrayIncludes(FrameTypes.text, frameId)) {
      this.processTextFrame(frameId, frameSize, frameUnsych);
    } else if (isWanted && arrayIncludes(FrameTypes.picture, frameId)) {
      this.processPictureFrame(frameSize, frameUnsych);
    } else {
      this.skip(frameSize);
    }

    if (Object.keys(this.frames).length === this.wantedKeys.length) {
      this.finished = true;
    }
  }

  /** Returns a string represented by the contents of a text frame. */
  processTextFrame(frameId: TextFrameId, frameSize: number, unsync?: boolean) {
    // `unsync` is for ID3v2.4 only.
    let data: number[] = unsync
      ? this.read(this.unsynchBuffer(this.buffer.position, frameSize))
      : this.read(frameSize);
    // First byte indicates text encoding.
    const [encoding, ...chunk] = data;
    this.frames[frameId] = Buffer.bytesToString(chunk, encoding as Encoding);
  }

  /** Returns the base64 representation of the image. */
  processPictureFrame(frameSize: number, unsync?: boolean) {
    // `unsync` is for ID3v2.4 only.
    let newFrameSize = unsync
      ? this.unsynchBuffer(this.buffer.position, frameSize)
      : frameSize;

    // First byte indicates text encoding.
    this.skip(1);
    let pictureDataSize = newFrameSize - 1;

    let chunk: number[] = [];
    let mimeType: string | undefined;
    if (this.version === 2) {
      // ID3v2.2 has an "Image Format" (`"PNG" | "JPG"`) instead of "MIME Type".
      const imageFormat = Buffer.bytesToString(this.read(3));
      mimeType = imageFormat === 'PNG' ? 'image/png' : 'image/jpeg';
      pictureDataSize -= 3;
    } else {
      chunk = this.readTilNull();
      mimeType = Buffer.bytesToString(chunk);
      pictureDataSize -= chunk.length;
    }

    // Next byte indicates picture type
    chunk = this.read(1);
    pictureDataSize -= 1;
    const pictureType = Buffer.bytesToInt(chunk);
    // We'll ignore the picture if it's not classified as `Other` or `Cover (front)`
    if (pictureType !== 0 && pictureType !== 3) {
      this.skip(pictureDataSize);
      return;
    }

    // Get description (field is of unknown length & ends with a `null`)
    chunk = this.readTilNull();
    pictureDataSize -= chunk.length;

    const pictureData = this.read(pictureDataSize);
    this.frames.APIC = `data:${mimeType};base64,${Buffer.bytesToBase64(pictureData)}`;
  }
}
