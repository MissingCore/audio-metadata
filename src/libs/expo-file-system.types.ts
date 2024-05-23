/**
 *  These values can be used to define how file system data is read / written.
 *
 * @see {@link https://docs.expo.dev/versions/latest/sdk/filesystem/#encodingtype}
 */
enum EncodingType {
  Base64 = 'base64',
  UTF8 = 'utf8',
}

/**
 * Subset of the object returned when file exist or doesn't exist.
 *
 * @see {@link https://docs.expo.dev/versions/latest/sdk/filesystem/#fileinfo}
 */
type FileInfo =
  | { exists: true; uri: string; size: number }
  | { exists: false; uri: string; size?: never };

/**
 * Configurations on how we read a file.
 *
 * @see {@link https://docs.expo.dev/versions/latest/sdk/filesystem/#readingoptions}
 */
type ReadingOptions = {
  encoding?: EncodingType | 'base64' | 'utf8';
  length?: number;
  position?: number;
};

export type FileSystem = {
  /**
   *  These values can be used to define how file system data is read / written.
   *
   * @see {@link https://docs.expo.dev/versions/latest/sdk/filesystem/#encodingtype}
   */
  EncodingType: { Base64: 'base64'; UTF8: 'utf8' };
  /**
   * Get metadata information about a file, directory or external content/asset.
   *
   * @see {@link https://docs.expo.dev/versions/latest/sdk/filesystem/#filesystemgetinfoasyncfileuri-options}
   */
  getInfoAsync(
    fileUri: string,
    options?: { size?: boolean }
  ): Promise<FileInfo>;
  /**
   * Read the entire contents of a file as a string. Binary will be
   * returned in raw format, you will need to append `data:image/png;base64`,
   * to use it as Base64.
   *
   * @see {@link https://docs.expo.dev/versions/latest/sdk/filesystem/#filesystemreadasstringasyncfileuri-options}
   */
  readAsStringAsync(fileUri: string, options?: ReadingOptions): Promise<string>;
};
