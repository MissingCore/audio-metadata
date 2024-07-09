import { Buffer } from './Buffer';
import { arrayIncludes } from './object';
import { read } from '../libs/fs';
import type {
  MetadataExcerpt,
  MetadataKey,
  MetadataKeys,
} from '../MetadataExtractor.types';

/** Read a file encoded in base64, storing the contents in a buffer. */
export class FileReader {
  fileUri = '';
  dataSize = 0;

  buffer = new Buffer();
  filePosition = 0;
  finished = false;

  wantedTags: MetadataKeys = [];
  tags = {} as Record<MetadataKey, string | undefined>;

  constructor(uri: string, options: MetadataKeys) {
    this.fileUri = uri;
    this.wantedTags = options;
  }

  /** Initialize the buffer with all the data we need from the given spot in a file. */
  async initDataFrom({ size, offset = 0 }: { size: number; offset?: number }) {
    const data = await read(this.fileUri, size, offset);
    this.buffer.setBuffer(Buffer.base64ToBuffer(data));
    this.dataSize = size;
    this.filePosition = offset + size;
    this.finished = false;
  }

  /** Returns an array of bytes from the buffer. */
  read(length: number) {
    const chunk: number[] = this.buffer.readBytes(length);
    if (chunk.length !== length) this.#areWeDone();
    return chunk;
  }

  /** Read buffer until we hit a `null`. */
  readTilNull() {
    let byte: number | null = null;
    const chunk: number[] = [];
    while (byte !== 0) {
      if (this.#areWeDone()) break;
      byte = this.buffer.readUInt8();
      chunk.push(byte);
    }
    return chunk;
  }

  /** Skip bytes in the buffer. */
  skip(length: number) {
    this.buffer.move(length);
    this.#areWeDone();
  }

  /**
   * Apply un-unsynchronisation to the buffer. Returns the new size of the
   * content we've applied un-unsynchronisation to.
   */
  unsynchBuffer(offset: number, length?: number) {
    const size = length || this.buffer.length - offset;
    const data = [...this.buffer.buffer.slice(offset, offset + size)];
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i] === 0xff && data[i + 1] === 0x00) {
        data.splice(i + 1, 1);
      }
    }

    this.buffer.setBuffer(
      new Uint8Array([
        ...this.buffer.buffer.slice(0, offset),
        ...data,
        ...this.buffer.buffer.slice(offset + size),
      ]),
      offset
    );

    return data.length;
  }

  /**
   * Format `tags` into a `MetadataExcerpt` object and keep only the tags
   * we want specified by `wantedTags`.
   */
  formatMetadata() {
    // Ensure tags are atleast defined as `undefined` in the returned object.
    const defaultMetadata = this.wantedTags.map((key) => [
      key,
      undefined,
    ]) as Array<[string, string | number | undefined]>;

    return Object.fromEntries(
      defaultMetadata.concat(
        Object.entries(this.tags)
          .filter(([key]) => arrayIncludes(this.wantedTags, key))
          .map(([key, value]) => {
            let valAsNum: number | undefined;
            if (key === 'track') valAsNum = Number(value?.split('/')[0]);
            else if (key === 'year') valAsNum = Number(value?.slice(0, 4));

            return [key, valAsNum && !isNaN(valAsNum) ? valAsNum : value];
          })
      )
    ) as MetadataExcerpt<typeof this.wantedTags>;
  }

  /**
   * Returns a boolean if we've found all the metadata we wanted. Useful
   * for exiting early.
   */
  shouldFinishEarly() {
    return Object.keys(this.tags).length === this.wantedTags.length;
  }

  /** Checks if we reached the end of the buffer and updates `finished` if we are. */
  #areWeDone() {
    if (!this.buffer.eof) return false;
    this.finished = true;
    return true;
  }
}
