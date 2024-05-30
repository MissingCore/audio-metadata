import type { AudioFileType } from './constants';
import type { MetadataKeys, MetadataResponse } from './MetadataExtractor.types';
import { FLACReader } from './readers/FLACReader';
import { readMP3Metadata } from './readers/ID3Reader';
import { FileError } from './utils/errors';

/**
 * Get the metadata of an audio file if it exists. Throws an error if
 * we don't support the file.
 */
export async function getAudioMetadata<TOptions extends MetadataKeys>(
  uri: string,
  options: TOptions
): Promise<MetadataResponse<TOptions>> {
  const extension = uri.split('.').at(-1);
  let data = {} as Omit<MetadataResponse<TOptions>, 'fileType'>;

  if (extension === 'flac') {
    data = await new FLACReader(uri, options).getMetadata();
  } else if (extension === 'mp3') {
    data = await readMP3Metadata(uri, options);
  } else {
    throw new FileError(`\`.${extension}\` files are currently not supported.`);
  }

  return { fileType: extension as AudioFileType, ...data };
}
