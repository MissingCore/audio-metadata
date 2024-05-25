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
  const identifier = Buffer.bytesToString([
    ...Buffer.base64ToBuffer(await read(uri, 3, 0)),
  ]);

  let data = {} as Omit<MetadataResponse<TOptions>, 'fileType'>;
  if (identifier === 'ID3') {
    data = await new ID3v2Reader(uri, options).getMetadata();
  } else {
    data = await new ID3v1Reader(uri, options).getMetadata();
  }

  return { fileType: 'mp3', ...data };
}
