import { FLACReader } from './FLACReader';
import { readMP3Metadata } from './ID3Reader';

import type { MetadataKeys, MetadataResponse } from './types';
import { FileError } from '../utils/errors';

/**
 * Get the metadata of an audio file if it exists. Throws an error if
 * we don't support the file.
 */
export async function getAudioMetadata<TOptions extends MetadataKeys>(
  uri: string,
  options: TOptions
): Promise<MetadataResponse<TOptions>> {
  if (uri.endsWith('flac')) {
    return {
      fileType: `flac`,
      ...(await new FLACReader(uri, options).getMetadata()),
    };
  } else if (uri.endsWith('mp3')) {
    return await readMP3Metadata(uri, options);
  }

  throw new FileError('File is currently not supported.');
}
