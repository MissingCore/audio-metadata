import { getFileStat } from '../../libs/fs';
import { Buffer } from '../../utils/Buffer';
import { FileError } from '../../utils/errors';
import { FileReader } from '../../utils/FileReader';

/*
  Useful documentation:
    - https://id3.org/ID3v1
*/

/** Reads ID3v1 metadata located at the end of a MP3 file. */
export class ID3v1Reader extends FileReader {
  version = '1'; // Either `"1" | "1.1"`

  /** Get MP3 metadata. */
  async getMetadata() {
    await this.initialize();

    // Process the file.
    this.processData();

    // Return the results.
    return {
      format: `ID3v${this.version}`,
      metadata: this.formatMetadata(),
    };
  }

  /**
   * Initialize buffer through `FileReader`.
   *
   * Throws an error if we don't encounter `TAG` after reading the first
   * 3 bytes.
   */
  async initialize() {
    const fileSize = (await getFileStat(this.fileUri)).size!;
    await this.initDataFrom({ size: 128, offset: fileSize - 128 });

    if (Buffer.bytesToString(this.read(3)) !== 'TAG')
      throw new FileError('Not an ID3v1 tag.');
  }

  /**
   * An ID3v1 tag is made up of 128 bytes with the following structure:
   *  - [30 Bytes] Title
   *  - [30 Bytes] Artist
   *  - [30 Bytes] Album
   *  - [4 Bytes] Year
   *  - [30 Bytes] Comment
   *    - In ID3v1.1, the "Comment" is 28 bytes, with 2 bytes being for
   *    "Track Number". **The first byte should be `null`.**
   *  - [1 Byte] Genre
   */
  processData() {
    this.tags.name = Buffer.bytesToString(this.read(30)) || undefined;
    this.tags.artist = Buffer.bytesToString(this.read(30)) || undefined;
    this.tags.album = Buffer.bytesToString(this.read(30)) || undefined;
    this.tags.year = Buffer.bytesToString(this.read(4)) || undefined;
    const _comment = this.read(30);
    this.version = _comment[28] === 0 && _comment[29] !== 0 ? '1.1' : '1';
    this.tags.track = this.version === '1.1' ? `${_comment[29]}` : undefined;
  }
}
