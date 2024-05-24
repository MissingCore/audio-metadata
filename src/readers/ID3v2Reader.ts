import type { MetadataExcerpt, MetadataKey, MetadataKeys } from './types';
import { FileError } from '../utils/errors';
import { FileReader } from '../utils/FileReader';
import type { Encoding } from '../utils/Buffer';
import { Buffer } from '../utils/Buffer';
import { arrayIncludes } from '../utils/object';

/*
  Logic Based on the Following References:
    - https://gigamonkeys.com/book/practical-an-id3-parser
    - https://mutagen-specs.readthedocs.io/en/latest/id3/id3v2.4.0-structure.html
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

/** Reads ID3v2 metadata stored at the beginning of a MP3 file. */
export class ID3v2Reader extends FileReader {
  wantedKeys: MetadataKeys = [];
  frames = {} as Record<FrameId, string>;
  version = 0; // The minor version of the spec (`2 | 3 | 4`).

  constructor(uri: string, options: MetadataKeys) {
    super(uri);
    this.wantedKeys = options;
  }

  /** Get MP3 metadata. */
  async getMetadata() {
    await this.init();

    // Process the file (ID3v2 Tag Header & Frames).
    await this.processHeader();
    while (!this.finished) await this.processFrame();

    // Return the results.
    return {
      version: this.version,
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
  async processHeader() {
    // First 3 bytes should encode the string "ID3".
    const identifier = await this.read(3);
    if (Buffer.bytesToString(identifier) !== 'ID3')
      throw new FileError('Not an ID3 tag.');

    // Next 2 bytes encodes the major version & revision.
    const [version] = await this.read(2);
    this.version = Buffer.bytesToInt([version]);

    // Next byte is treated as flags.
    await this.skip(1);

    // Last 4 bytes gives the total size of the tag excluding the header
    // (stored as a 32 bit synchsafe integer).
    const size = await this.read(4);
    this.dataSize = Buffer.bytesToInt(size, 7);
  }

  /** Process a frame (tag data is divided into frames). */
  async processFrame() {
    let frameId = '';
    let frameSize = 0;

    // Process frame header.
    if (this.version === 2) {
      // First 3 bytes is the frame id.
      frameId = Buffer.bytesToString(await this.read(3));
      // Next 3 bytes is the frame size.
      frameSize = Buffer.bytesToInt(await this.read(3));
    } else {
      // First 4 bytes is the frame id.
      frameId = Buffer.bytesToString(await this.read(4));
      // We hit the "padding" in the tag data when we get a `null` byte
      // where we expect a frame identifier.
      if (frameId === '') {
        this.finished = true;
        return;
      }

      // Next 4 bytes is the frame size. Note that ID3v2.3 frame size isn't
      // stored as a 32 bit synchsafe integer (unlike ID3v2.4).
      //  - https://hydrogenaud.io/index.php/topic,67145.msg602034.html#msg602034
      frameSize =
        this.version === 3
          ? Buffer.bytesToInt(await this.read(4))
          : Buffer.bytesToInt(await this.read(4), 7);

      // Next 2 bytes are treated as flags.
      await this.skip(2);
    }

    // Process the frame once we identify the frame type & exit early
    // if we got all the data we needed.
    const isWanted = arrayIncludes(
      this.wantedKeys,
      FrameMetadataMap[frameId as FrameId]
    );
    if (isWanted && arrayIncludes(FrameTypes.text, frameId)) {
      await this.processTextFrame(frameId, frameSize);
    } else if (isWanted && arrayIncludes(FrameTypes.picture, frameId)) {
      await this.processPictureFrame(frameSize);
    } else {
      await this.skip(frameSize);
    }

    if (Object.keys(this.frames).length === this.wantedKeys.length) {
      this.finished = true;
    }
  }

  /** Returns a string represented by the contents of a text frame. */
  async processTextFrame(frameId: TextFrameId, frameSize: number) {
    // First byte indicates text encoding.
    const [encoding, ...chunk] = await this.read(frameSize);
    this.frames[frameId] = Buffer.bytesToString(chunk, encoding as Encoding);
  }

  /** Returns the base64 representation of the image. */
  async processPictureFrame(frameSize: number) {
    // First byte indicates text encoding.
    await this.skip(1);
    let pictureDataSize = frameSize - 1;

    let chunk: number[] = [];
    let mimeType: string | undefined;
    if (this.version === 2) {
      // ID3v2.2 has an "Image Format" (`"PNG" | "JPG"`) following the
      // "Text Encoding" byte.
      const imageFormat = Buffer.bytesToString(await this.read(3));
      mimeType = imageFormat === 'PNG' ? 'image/png' : 'image/jpeg';
      pictureDataSize -= 3;
    } else {
      chunk = await this.readTilNull();
      pictureDataSize -= chunk.length;
      mimeType = Buffer.bytesToString(chunk);
    }

    // Next byte indicates picture type
    chunk = await this.read(1);
    pictureDataSize -= 1;
    const pictureType = Buffer.bytesToInt(chunk);
    // We'll ignore the picture if it's not classified as `Other` or `Cover (front)`
    if (pictureType !== 0 && pictureType !== 3) {
      await this.skip(pictureDataSize);
      return;
    }

    // Get description (field is of unknown length & ends with a `null`)
    chunk = await this.readTilNull();
    pictureDataSize -= chunk.length;

    const pictureData = await this.read(pictureDataSize);
    this.frames.APIC = `data:${mimeType};base64,${Buffer.bytesToBase64(pictureData)}`;
  }
}
