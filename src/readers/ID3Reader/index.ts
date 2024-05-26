import { ID3v1Reader } from './ID3v1Reader';
import { ID3v2Reader } from './ID3v2Reader';
import type { MetadataKeys, MetadataResponse } from '../types';
import { getFileStat, read } from '../../libs/fs';
import { Buffer } from '../../utils/Buffer';
import { FileError } from '../../utils/errors';

/** Get the metadata from an MP3 file. */
export async function readMP3Metadata<TOptions extends MetadataKeys>(
  uri: string,
  options: TOptions
): Promise<MetadataResponse<TOptions>> {
  const fileInfo = await getFileStat(uri);
  // File should exist, so below error shouldn't be thrown.
  if (!fileInfo.exists) throw new FileError("File doesn't exist.");

  // Read the first 3 bytes to determine if this is an ID3v2 tag.
  let data = Buffer.base64ToBuffer(await read(uri, 3, 0));

  let response = {} as Omit<MetadataResponse<TOptions>, 'fileType'>;
  if (Buffer.bytesToString([...data]) === 'ID3') {
    response = await new ID3v2Reader(uri, options).getMetadata();
  } else {
    // See if instead, we have an ID3v2.4 tag at the end of the file or before
    // where an ID3v1 tag appears (https://id3.org/FAQ).
    data = Buffer.base64ToBuffer(await read(uri, 138, fileInfo.size - 138));
    if (Buffer.bytesToString([...data.slice(128, 131)]) === '3DI') {
      response = await new ID3v2Reader(uri, options, 'eof').getMetadata();
    } else if (Buffer.bytesToString([...data.slice(0, 3)]) === '3DI') {
      response = await new ID3v2Reader(uri, options, 'pre-v1').getMetadata();
    } else {
      response = await new ID3v1Reader(uri, options).getMetadata();
    }
  }

  return { fileType: 'mp3', ...response };
}
