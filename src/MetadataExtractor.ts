import type { AudioFileType } from './constants';
import { ID3v2Reader } from './readers/ID3v2Reader';
import { FileError } from './utils/errors';

export type AudioMetadata = {
  album: string;
  artist: string;
  artwork: string;
  name: string;
  track: number;
  year: number;
};

export type MetadataKey = keyof AudioMetadata;
export type MetadataKeys = ReadonlyArray<MetadataKey>;

export type MetadataExcerpt<TKeys extends MetadataKeys> = Partial<
  Pick<AudioMetadata, TKeys[number]>
>;

export type ResourceResult<TKeys extends MetadataKeys> = {
  fileType: AudioFileType;
  format: string;
  metadata: MetadataExcerpt<TKeys>;
};

/**
 * Get the metadata of an audio file if it exists. Throws an error if
 * we don't support the file.
 */
export async function getAudioMetadata<TOptions extends MetadataKeys>(
  uri: string,
  options: TOptions
): Promise<ResourceResult<TOptions>> {
  if (uri.endsWith('mp3')) {
    return {
      fileType: 'mp3',
      format: 'ID3v2.3',
      metadata: await new ID3v2Reader(uri, options).getMetadata(),
    };
  }

  throw new FileError('File is currently not supported.');
}
