import type { AudioFileType } from '../constants';

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

export type MetadataResponse<TKeys extends MetadataKeys> = {
  fileType: AudioFileType;
  format: string;
  metadata: MetadataExcerpt<TKeys>;
};
