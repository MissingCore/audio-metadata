/**
 * Union of valid file encoding values.
 *
 * @see {@link https://github.com/birdofpreyru/react-native-fs?tab=readme-ov-file#encodingt}
 */
type EncodingT = 'ascii' | 'base64' | 'utf8';

/**
 * The type of extra options argument of the readFile() function.
 *
 * @see {@link https://github.com/birdofpreyru/react-native-fs?tab=readme-ov-file#readfileoptionst}
 */
type ReadFileOptionsT = { encoding?: EncodingT };

/**
 * Subset of the result resolved by `stat()`.
 *
 * @see {@link https://github.com/birdofpreyru/react-native-fs?tab=readme-ov-file#statresultt}
 */
type StatResultT = { path: string; size: number };

type FileSystem = {
  /**
   * Checks if an item exists at a given `path`.
   *
   * @see {@link https://github.com/birdofpreyru/react-native-fs?tab=readme-ov-file#exists}
   */
  exists(path: string): Promise<boolean>;
  /**
   * Reads `length` bytes from the given `position` of a file.
   *
   * @see {@link https://github.com/birdofpreyru/react-native-fs?tab=readme-ov-file#read}
   */
  read(
    path: string,
    length?: number,
    position?: number,
    encodingOrOptions?: EncodingT | ReadFileOptionsT
  ): Promise<string>;
  /**
   * Stats an item at `path`.
   *
   * @see {@link https://github.com/birdofpreyru/react-native-fs?tab=readme-ov-file#stat}
   */
  stat(path: string): Promise<StatResultT>;
};

let ReactNativeFS: FileSystem | undefined;

try {
  ReactNativeFS = require('@dr.pogodin/react-native-fs');
} catch {}

export default ReactNativeFS;
