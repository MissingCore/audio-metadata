import { Buffer } from './Buffer';
import { FileError } from './errors';
import { getFileStat, read } from '../libs/fs';

type InitBuffer = {
  /** Number of bytes needed to be read in order to determine the size of the buffer. */
  bytes: number;
  /**
   * Returns the size of the buffer we need. Make sure to re-include the bytes
   * used to get this value if we need to apply some other calculations on it.
   */
  getBufferSize: () => number;
};

/** Read a file encoded in base64, storing the contents in a buffer. */
export class FileReader {
  #fileUri = '';
  dataSize = 0;

  buffer = new Buffer();
  filePosition = 0;
  finished = false;

  constructor(uri: string) {
    this.#fileUri = uri;
  }

  /** Initialize contents of this class. */
  async init({ bytes, getBufferSize }: InitBuffer) {
    const fileInfo = await getFileStat(this.#fileUri);
    // File should exist, so below error shouldn't be thrown.
    if (!fileInfo.exists) throw new FileError("File doesn't exist.");
    this.finished = false;

    /* Determine all the bytes we need to read from the file. */
    let data = await read(this.#fileUri, bytes, 0);
    this.buffer.setBuffer(Buffer.base64ToBuffer(data));
    const bufferSize = getBufferSize();
    this.dataSize = bufferSize;
    // Populate buffer with all the data it needs.
    data = await read(this.#fileUri, bufferSize, 0);
    this.buffer.setBuffer(Buffer.base64ToBuffer(data));
    this.filePosition = bufferSize;
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
