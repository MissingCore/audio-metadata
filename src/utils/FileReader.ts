import { Buffer } from './Buffer';
import { read } from '../libs/fs';

/** Read a file encoded in base64, storing the contents in a buffer. */
export class FileReader {
  fileUri = '';
  dataSize = 0;

  buffer = new Buffer();
  filePosition = 0;
  finished = false;

  constructor(uri: string) {
    this.fileUri = uri;
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
    const chunk: number[] = [];
    for (let i = 0; i < length; i++) {
      if (this.#areWeDone()) break;
      chunk.push(this.buffer.readUInt8());
    }
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

  /** Checks if we reached the end of the buffer and updates `finished` if we are. */
  #areWeDone() {
    if (!this.buffer.eof) return false;
    this.finished = true;
    return true;
  }
}
