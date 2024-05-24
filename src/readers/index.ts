import { ID3v2Reader } from './ID3v2Reader';

import type { MetadataKeys, ResourceResult } from './types';
import { FileError } from '../utils/errors';

/**
 * Get the metadata of an audio file if it exists. Throws an error if
 * we don't support the file.
 */
export async function getAudioMetadata<TOptions extends MetadataKeys>(
  uri: string,
  options: TOptions
): Promise<ResourceResult<TOptions>> {
  if (uri.endsWith('mp3')) {
    const data = await new ID3v2Reader(uri, options).getMetadata();
    return {
      fileType: 'mp3',
      format: `ID3v2.${data.version}`,
      metadata: data.metadata,
    };
  }

  throw new FileError('File is currently not supported.');
}
