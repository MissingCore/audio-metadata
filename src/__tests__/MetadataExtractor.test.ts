import { getAudioMetadata } from '../MetadataExtractor';
import type { MetadataKeys } from '../MetadataExtractor.types';
import { FileError } from '../utils/errors';

/** Mock `@dr.pogodin/react-native-fs` with Node.js' `fs/promises` library. */
jest.mock('@dr.pogodin/react-native-fs', () => {
  const { Buffer } = require('node:buffer');
  const { openSync, read } = require('fs');
  const { access, stat } = require('fs/promises');

  return {
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
});

/**
 * Wraps `getAudioMetadata` and handles getting the `uri` from a file
 * name (ie: `Silence.mp3`).
 */
async function getMetadata(filename: string, options?: MetadataKeys) {
  // `uri` based from workspace root.
  const uri = `./test-audio/${filename}`;
  const wantedTags =
    options || (['album', 'artist', 'name', 'track', 'year'] as const);
  return getAudioMetadata(uri, wantedTags);
}

const _nums = { track: 1, year: 2024 };
/** Expected structure of returned metatdata. */
const results = {
  base: { album: 'Void', artist: 'Nothing', name: 'Silence', ..._nums },
  utf8: { album: '空所', artist: '何もない', name: '沈黙', ..._nums },
};

describe('`getAudioMetadata()` function.', () => {
  describe('With unsupported files.', () => {
    it('`.m4a`', async () => {
      await expect(getMetadata('Silence.m4a')).rejects.toThrow(
        new FileError('File is currently not supported.')
      );
    });

    it('`.ogg`', async () => {
      await expect(getMetadata('Silence.ogg')).rejects.toThrow(
        new FileError('File is currently not supported.')
      );
    });
  });

  describe('With supported files.', () => {
    describe('`.mp3`', () => {
      it('Supports `ID3v1`.', async () => {
        await expect(getMetadata('Silence (ID3v1).mp3')).resolves.toEqual({
          fileType: 'mp3',
          format: 'ID3v1',
          metadata: { ...results.base, track: undefined },
        });
      });

      it('Supports `ID3v1.1`.', async () => {
        await expect(getMetadata('Silence (ID3v1.1).mp3')).resolves.toEqual({
          fileType: 'mp3',
          format: 'ID3v1.1',
          metadata: results.base,
        });
      });

      it.todo('Supports `ID3v2.2`.');

      it('Supports `ID3v2.3`.', async () => {
        await expect(getMetadata('Silence (ID3v2.3).mp3')).resolves.toEqual({
          fileType: 'mp3',
          format: 'ID3v2.3',
          metadata: results.base,
        });
      });

      describe('Supports `ID3v2.4`', () => {
        it('No special feature.', async () => {
          await expect(getMetadata('Silence (ID3v2.4).mp3')).resolves.toEqual({
            fileType: 'mp3',
            format: 'ID3v2.4',
            metadata: results.base,
          });
        });

        it('Contains UTF-8 text.', async () => {
          await expect(getMetadata('Silence-utf8.mp3')).resolves.toEqual({
            fileType: 'mp3',
            format: 'ID3v2.4',
            metadata: results.utf8,
          });
        });

        it.todo('Located at end of file.');

        it.todo('Located before ID3v1 tag.');

        it.todo('Has unsynchronisation.');
      });
    });

    describe('`.flac`', () => {
      it('Supports `FLAC`.', async () => {
        await expect(getMetadata('Silence.flac')).resolves.toEqual({
          fileType: 'flac',
          format: 'FLAC',
          metadata: results.base,
        });
      });

      it('Supports UTF-8 values.', async () => {
        await expect(getMetadata('Silence-utf8.flac')).resolves.toEqual({
          fileType: 'flac',
          format: 'FLAC',
          metadata: results.utf8,
        });
      });
    });
  });
});
