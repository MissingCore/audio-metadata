import { getFileStat, read } from '../libs/fs';
import type { MetadataKey, MetadataKeys } from '../MetadataExtractor.types';
import type { Encoding } from '../utils/Buffer';
import { Buffer } from '../utils/Buffer';
import { FileError } from '../utils/errors';
import { FileReader } from '../utils/FileReader';
import { arrayIncludes } from '../utils/object';

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
type FrameId = TextFrameId | (typeof FrameTypes.picture)[number];

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
 * beginning of a MP3 file. Supports reading ID3v2.4 tags located at the
 * end of the file (or before an ID3v1 tag).
 */
export class ID3v2Reader extends FileReader {
  version = 0; // The minor version of the spec (`2 | 3 | 4`).

  /* Extra flags */
  unsynch = false;
  xHeader = false;
  footer?: 'eof' | 'pre-v1'; // If tag is at the end of file in ID3v2.4.

  constructor(uri: string, options: MetadataKeys, footer?: 'eof' | 'pre-v1') {
    super(uri, options);
    this.footer = footer;
  }

  /** Get MP3 metadata. */
  async getMetadata() {
    await this.initialize();

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
      metadata: this.formatMetadata(),
    };
  }

  /** Initialize buffer through `FileReader`. */
  async initialize() {
    const fileSize = (await getFileStat(this.fileUri)).size!;
    const data =
      this.footer === 'eof'
        ? Buffer.base64ToBuffer(await read(this.fileUri, 4, fileSize - 4))
        : this.footer === 'pre-v1'
          ? Buffer.base64ToBuffer(await read(this.fileUri, 4, fileSize - 132))
          : Buffer.base64ToBuffer(await read(this.fileUri, 4, 6));
    // Add 10 bytes to buffer size since header isn't included.
    const tagSize = 10 + Buffer.bytesToInt([...data], 7);
    // Subtract an additional 10 bytes for the footer.
    let offset = this.footer ? fileSize - tagSize - 10 : undefined;
    if (this.footer === 'pre-v1') offset! -= 128;
    await this.initDataFrom({ size: tagSize, offset });
  }

  /**
   * ID3v2 starts with a 10 bytes header with the following structure:
   *  - [3 Bytes] `ID3` file identifier.
   *  - [2 Bytes] Major version & revision.
   *  - [1 Byte] Flags field.
   *  - [4 Bytes] Total size of the tag excluding this header & footer
   *  (optional) stored as a 32 bit synchsafe integer.
   */
  processHeader() {
    if (Buffer.bytesToString(this.read(3)) !== 'ID3')
      throw new FileError('Not an ID3v2 tag.');

    this.version = Buffer.bytesToInt([this.read(2)[0]]);
    if (this.version > 4)
      throw new FileError(`ID3v2.${this.version} is not supported.`);

    const flagsAsBinary = Buffer.byteToBinary(this.read(1)[0]);
    this.unsynch = flagsAsBinary[0] === '1';
    this.xHeader = flagsAsBinary[1] === '1';

    this.dataSize = Buffer.bytesToInt(this.read(4), 7);
  }

  /**
   * ID3v2.3/4 has an optional variable-length extended header. We currently
   * don't support this, so we ignore its contents entirely.
   *
   * Throws an error if the `xHeader` flag is set in ID3v2.2 as this represents
   * the "Compression" flag, which isn't implemented.
   */
  processExtendedHeader() {
    if (!this.xHeader) return;
    if (this.version === 2)
      throw new FileError('Compression bit should not be set for ID3v2.2.');

    /* Skip as we don't support it. */
    if (this.version === 4) {
      // First 4 bytes is the remaining size of the extended header as
      // a 32 bit synchsafe integer.
      this.skip(Buffer.bytesToInt(this.read(4), 7));
    } else {
      // In ID3v2.3, the remaining extended header size is 6 or 10 bytes.
      this.skip(Buffer.bytesToInt(this.read(4)));
    }
  }

  /**
   * An ID3v2 frame can be broken down into 2 sections:
   *  - A 6-byte (ID3v2.2) or 10-byte (ID3v2.3/4) header.
   *  - Data whose size is specified by its header.
   */
  processFrame() {
    // Handle the frame header.
    const { id, size, frameUnsych } = this.processFrameHeader();
    // Hit the "padding" when we get a `null` byte instead of a frame identifier.
    if (id === '') {
      this.finished = true;
      return;
    }

    // Handle the frame data.
    const isWanted = this.wantedTags.includes(FrameMetadataMap[id as FrameId]);
    if (isWanted && arrayIncludes(FrameTypes.text, id)) {
      this.processTextFrame(id, size, frameUnsych);
    } else if (isWanted && arrayIncludes(FrameTypes.picture, id)) {
      this.processPictureFrame(size, frameUnsych);
    } else {
      this.skip(size);
    }

    // Exit early once we have all the data needed.
    if (Object.keys(this.tags).length === this.wantedTags.length) {
      this.finished = true;
    }
  }

  /**
   * In ID3v2.2, all Frames start with a 6 bytes header:
   *  - [3 Bytes] Frame identifier
   *  - [3 Bytes] Size
   *
   * In ID3v2.3/4, all Frames start with a 10 bytes header:
   *  - [4 Bytes] Frame identifier
   *  - [4 Bytes] Size
   *    - Explicitly a 32 bit synchsafe integer in ID3v2.4 unlike in ID3v2.3
   *    (https://hydrogenaud.io/index.php/topic,67145.msg602034.html#msg602034).
   *  - [2 Bytes] Flags field
   */
  processFrameHeader() {
    const frameId = Buffer.bytesToString(this.read(this.version === 2 ? 3 : 4));

    const frameSize =
      this.version === 2
        ? Buffer.bytesToInt(this.read(3))
        : Buffer.bytesToInt(this.read(4), this.version === 3 ? 8 : 7);

    // Handle flags not present in ID3v2.2.
    let frameUnsych = false; // Only matters for ID3v2.4
    if (this.version !== 2) {
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

    return { id: frameId, size: frameSize, frameUnsych };
  }

  /**
   * A Text Information Frame has the following structure:
   *  - [1 Byte] Text encoding.
   *  - [n Bytes] Text string.
   */
  processTextFrame(frameId: TextFrameId, frameSize: number, unsync?: boolean) {
    // `unsync` is for ID3v2.4 only.
    let data: number[] = unsync
      ? this.read(this.unsynchBuffer(this.buffer.position, frameSize))
      : this.read(frameSize);

    const [encoding, ...chunk] = data;
    const textData = Buffer.bytesToString(chunk, encoding as Encoding);

    const metadataKey = FrameMetadataMap[frameId as FrameId];
    this.tags[metadataKey] = textData;
  }

  /**
   * In ID3v2.2, An Attached Picture Frame has the following structure:
   *  - [1 Byte] Text encoding.
   *  - Different methods of getting MIME type based on ID3v2 version.
   *    - [3 Bytes] Image Format (`"PNG" | "JPG"`) for ID3v2.2.
   *    - [n Bytes] MIME type - ends when seeing a `null` character for ID3v2.3/4.
   *  - [1 Byte] Picture type.
   *  - [n Bytes] Description - ends when seeing a `null` character.
   *  - [n Bytes] Picture data.
   */
  processPictureFrame(frameSize: number, unsync?: boolean) {
    // `unsync` is for ID3v2.4 only.
    let newFrameSize = unsync
      ? this.unsynchBuffer(this.buffer.position, frameSize)
      : frameSize;

    this.skip(1);
    let pictureDataSize = newFrameSize - 1;

    let mimeType: string | undefined;
    if (this.version === 2) {
      const imageFormat = Buffer.bytesToString(this.read(3));
      mimeType = imageFormat === 'PNG' ? 'image/png' : 'image/jpeg';
      pictureDataSize -= 3;
    } else {
      const chunk = this.readTilNull();
      mimeType = Buffer.bytesToString(chunk);
      pictureDataSize -= chunk.length;
    }

    const pictureType = Buffer.bytesToInt(this.read(1));
    pictureDataSize -= 1;
    // We'll ignore the picture if it's not classified as `Other` or `Cover (front)`
    if (pictureType !== 0 && pictureType !== 3) {
      this.skip(pictureDataSize);
      return;
    }

    // Get description (field is of unknown length & ends with a `null`)
    const description = this.readTilNull();
    pictureDataSize -= description.length;

    const pictureData = this.read(pictureDataSize);
    this.tags.artwork = `data:${mimeType};base64,${Buffer.bytesToBase64(pictureData)}`;
  }
}
