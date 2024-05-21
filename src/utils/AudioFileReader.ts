import { BUFFER_SIZE } from '../constants/config';
import { Buffer } from './Buffer';
import { getFileStat, read } from './fs';

/** Read a file encoded in base64, storing the contents in a buffer. */
export class AudioFileReader {
  #fileUri = '';
  dataSize = 0;

  buffer = new Buffer();
  filePosition = 0;
  finished = false;

  constructor(uri: string) {
    this.#fileUri = uri;
  }

  /** Initialize contents of this class. */
  async init() {
    const fileInfo = await getFileStat(this.#fileUri);
    // File should exist, so below error shouldn't be thrown.
    if (!fileInfo.exists) throw new Error("File doesn't exist.");
    this.dataSize = fileInfo.size;
    this.filePosition = 0;
    this.finished = false;
    await this.loadFileToBuffer();
  }

  /** Read a chunk of the base64 representation of the MP3 file. */
  async loadFileToBuffer() {
    const data = await read(this.#fileUri, BUFFER_SIZE, this.filePosition);
    this.buffer.setBuffer(Buffer.base64ToBuffer(data));
    this.filePosition += BUFFER_SIZE;
  }

  /** Returns an array of bytes from the buffer. */
  async read(length: number) {
    const chunk: number[] = [];
    for (let i = 0; i < length; i++) {
      if (this.buffer.eof) {
        if (this.trulyFinished) break;
        await this.loadFileToBuffer();
      }
      chunk.push(this.buffer.readUInt8());
    }
    return chunk;
  }

  /** Read buffer until we hit a `null`. */
  async readTilNull() {
    let byte: number | null = null;
    const chunk: number[] = [];
    while (byte !== 0) {
      if (this.buffer.eof) {
        if (this.trulyFinished) break;
        await this.loadFileToBuffer();
      }
      byte = this.buffer.readUInt8();
      chunk.push(byte);
    }
    return chunk;
  }

  /** Skip bytes in the buffer. */
  async skip(length: number) {
    const remaining = length - this.buffer.move(length);
    if (remaining > 0 && !this.trulyFinished) {
      this.filePosition += remaining;
      await this.loadFileToBuffer();
    }
  }

  /** Boolean whether we finished reading all data in the file. */
  get trulyFinished() {
    if (this.filePosition < this.dataSize) return false;
    this.finished = true;
    return true;
  }
}
