import type { MetadataExcerpt, MetadataKeys } from '../types';
import { getFileStat } from '../../libs/fs';
import { Buffer } from '../../utils/Buffer';
import { FileError } from '../../utils/errors';
import { FileReader } from '../../utils/FileReader';

/*
  Useful documentation:
    - https://id3.org/ID3v1
*/

/** Reads ID3v1 metadata stored at the end of a MP3 file. */
export class ID3v1Reader extends FileReader {
  wantedKeys: MetadataKeys = [];

  constructor(uri: string, options: MetadataKeys) {
    super(uri);
    this.wantedKeys = options;
  }

  /** Get MP3 metadata. */
  async getMetadata() {
    /* Buffer initialization. */
    const fileSize = (await getFileStat(this.fileUri)).size!;
    await this.initDataFrom({ size: 128, offset: fileSize - 128 });

    // Process the file & return results.
    this.processHeader();
    return this.processData();
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
      format: `ID3v${version}`,
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
