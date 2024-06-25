/*
  Replicated signature of `react-native-fs.ts` with native Node.js modules.
*/
import { isNodeJS } from '../utils/Enviroment';

/** Union of valid file encoding values. */
type EncodingT = 'ascii' | 'base64' | 'utf8';

/** The type of extra options argument of the readFile() function. */
type ReadFileOptionsT = { encoding?: EncodingT };

/** Subset of the result resolved by `stat()`. */
type StatResultT = { path: string; size: number };

type FileSystem = {
  /** Checks if an item exists at a given `path`. */
  exists(path: string): Promise<boolean>;
  /** Reads `length` bytes from the given `position` of a file. */
  read(
    path: string,
    length?: number,
    position?: number,
    encodingOrOptions?: EncodingT | ReadFileOptionsT
  ): Promise<string>;
  /** Stats an item at `path`. */
  stat(path: string): Promise<StatResultT>;
};

let NodeFS: FileSystem | undefined;

try {
  if (!isNodeJS()) throw Error();

  const { Buffer } = require('node:buffer');
  const { openSync, read } = require('node:fs');
  const { access, stat } = require('node:fs/promises');

  NodeFS = {
    // `access` returns `undefined` on success.
    exists: async (path: string) => !(await access(path)),
    read: async (
      path: string,
      length = 0,
      position = 0,
      encodingOrOptions: 'ascii' | 'base64' | 'utf8' = 'base64'
    ) => {
      const fd = openSync(path, 'r');
      const dataBuffer = Buffer.alloc(length);
      return new Promise((resolve, reject) => {
        read(
          fd,
          { buffer: dataBuffer, length, position },
          (err: unknown, _bytesRead: number, buffer: Buffer) => {
            if (err) reject(err);
            resolve(buffer.toString(encodingOrOptions));
          }
        );
      });
    },
    stat: async (path: string) => ({ path, ...(await stat(path)) }),
  };
} catch {}

export default NodeFS;
