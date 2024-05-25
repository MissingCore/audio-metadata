import type { MetadataExcerpt, MetadataKeys } from '../types';
import { getFileStat, read } from '../../libs/fs';
import { Buffer } from '../../utils/Buffer';
import { FileError } from '../../utils/errors';
import { FileReader } from '../../utils/FileReader';

/*
  Useful documentation:
    - https://id3.org/ID3v1
*/

/** Reads ID3v1 metadata stored at the end of a MP3 file. */
export class ID3v1Reader extends FileReader {
  #_fileUri = '';
  wantedKeys: MetadataKeys = [];

  constructor(uri: string, options: MetadataKeys) {
    super(uri);
    this.#_fileUri = uri;
    this.wantedKeys = options;
  }

  /** Get MP3 metadata. */
  async getMetadata() {
    await this._internalInit();

    // Process the file & return results.
    this.processHeader();
    return this.processData();
  }

  /** Initialize the buffer with custom logic instead of `FileReader.init`. */
  async _internalInit() {
    const fileInfo = await getFileStat(this.#_fileUri);
    // File should exist, so below error shouldn't be thrown.
    if (!fileInfo.exists) throw new FileError("File doesn't exist.");

    /* Get the 128 bytes of data used by ID3v1. */
    const data = await read(this.#_fileUri, 128, fileInfo.size - 128);
    this.buffer.setBuffer(Buffer.base64ToBuffer(data));
    this.dataSize = 128;
    this.filePosition = fileInfo.size;
  }

  /** Ensure the data we're reading is for an ID3v1 tag. */
  processHeader() {
    // First 3 bytes should encode the string "TAG".
    if (Buffer.bytesToString(this.read(3)) !== 'TAG')
      throw new FileError('Not an ID3v1 tag.');
  }

  /** Process an ID3v1 tag. */
  processData() {
    const name = Buffer.bytesToString(this.read(30)) || undefined;
    const artist = Buffer.bytesToString(this.read(30)) || undefined;
    const album = Buffer.bytesToString(this.read(30)) || undefined;
    const year = Number(Buffer.bytesToString(this.read(4))) || undefined;
    const _comment = this.read(30);
    const version = _comment[28] === 0 && _comment[29] !== 0 ? '1.1' : '1';
    const track = version === '1.1' ? _comment[29] : undefined;

    return {
      version,
      metadata: {
        ...(this.wantedKeys.includes('album') ? { album } : {}),
        ...(this.wantedKeys.includes('artist') ? { artist } : {}),
        ...(this.wantedKeys.includes('name') ? { name } : {}),
        ...(this.wantedKeys.includes('track') ? { track } : {}),
        ...(this.wantedKeys.includes('year') ? { year } : {}),
      } as MetadataExcerpt<typeof this.wantedKeys>,
    };
  }
}
