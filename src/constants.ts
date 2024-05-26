/** Array of supported audio file extensions. */
export const AudioFileTypes = ['flac', 'mp3'] as const;

/** Supported audio file extensions. */
export type AudioFileType = (typeof AudioFileTypes)[number];

/** Supported file paths. */
export type AudioFilePath = `${string}.${AudioFileType}`;
