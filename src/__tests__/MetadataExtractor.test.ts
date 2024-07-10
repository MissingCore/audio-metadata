import { getAudioMetadata } from '../MetadataExtractor';
import type { MetadataKeys } from '../MetadataExtractor.types';
import { FileError } from '../utils/errors';

/**
 * Wraps `getAudioMetadata` and handles getting the `uri` from a file
 * name (ie: `Silence.mp3`).
 */
async function getMetadata(filename: string, options?: MetadataKeys) {
  // `uri` based from workspace root.
  const uri = `./test-audio/${filename}`;
  const wantedTags =
    options ||
    (['album', 'albumArtist', 'artist', 'name', 'track', 'year'] as const);
  return getAudioMetadata(uri, wantedTags);
}

/** Determines if a string is a base64 image. */
async function isBase64Image(str: string | undefined) {
  if (!str) return false;
  return str.startsWith('data:image/png;base64');
}

/** Expected structure of returned metatdata. */
const results = {
  base: {
    ...{ album: 'Void', albumArtist: 'Nothing', artist: 'Nothing' },
    ...{ name: 'Silence', track: 1, year: 2024 },
  },
  utf8: {
    ...{ album: '空所', albumArtist: '何もない', artist: '何もない' },
    ...{ name: '沈黙', track: 1, year: 2024 },
  },
};

describe('`getAudioMetadata()` function.', () => {
  describe('With unsupported files.', () => {
    it('`.ogg`', async () => {
      await expect(getMetadata('unsupported/ogg.ogg')).rejects.toThrow(
        new FileError('`.ogg` files are currently not supported.')
      );
    });
  });

  describe('With supported files.', () => {
    describe('`.flac`', () => {
      it('Supports `FLAC`.', async () => {
        await expect(getMetadata('FLAC/base.flac')).resolves.toEqual({
          fileType: 'flac',
          format: 'FLAC',
          metadata: results.base,
        });
      });

      it('`artwork` is a base64 PNG string.', async () => {
        const data = await getMetadata('FLAC/base.flac', ['artwork']);
        expect(isBase64Image(data.metadata.artwork)).toBeTruthy();
      });

      it('Supports UTF-8 values.', async () => {
        await expect(getMetadata('FLAC/utf8.flac')).resolves.toEqual({
          fileType: 'flac',
          format: 'FLAC',
          metadata: results.utf8,
        });
      });
    });

    describe('`.mp3`', () => {
      it('Supports `ID3v1`.', async () => {
        await expect(getMetadata('ID3/v1.mp3')).resolves.toEqual({
          fileType: 'mp3',
          format: 'ID3v1',
          metadata: { ...results.base, track: undefined },
        });
      });

      describe('Supports `ID3v1.1`.', () => {
        it('No special feature.', async () => {
          await expect(getMetadata('ID3/v1.1.mp3')).resolves.toEqual({
            fileType: 'mp3',
            format: 'ID3v1.1',
            metadata: results.base,
          });
        });

        it('`artwork` is `undefined`.', async () => {
          const data = await getMetadata('ID3/v1.1.mp3', ['artwork']);
          expect(data.metadata.artwork).toEqual(undefined);
        });
      });

      it.todo('Supports `ID3v2.2`.');

      describe('Supports `ID3v2.3`.', () => {
        it('No special feature.', async () => {
          await expect(getMetadata('ID3/v2.3.mp3')).resolves.toEqual({
            fileType: 'mp3',
            format: 'ID3v2.3',
            metadata: results.base,
          });
        });

        it('Contains UTF-16 text.', async () => {
          await expect(getMetadata('ID3/utf16.mp3')).resolves.toEqual({
            fileType: 'mp3',
            format: 'ID3v2.3',
            metadata: results.utf8,
          });
        });
      });

      describe('Supports `ID3v2.4`', () => {
        it('No special feature.', async () => {
          await expect(getMetadata('ID3/v2.4.mp3')).resolves.toEqual({
            fileType: 'mp3',
            format: 'ID3v2.4',
            metadata: results.base,
          });
        });

        it('`artwork` is a base64 PNG string.', async () => {
          const data = await getMetadata('ID3/v2.4.mp3', ['artwork']);
          expect(isBase64Image(data.metadata.artwork)).toBeTruthy();
        });

        it('Contains UTF-8 text.', async () => {
          await expect(getMetadata('ID3/utf8.mp3')).resolves.toEqual({
            fileType: 'mp3',
            format: 'ID3v2.4',
            metadata: results.utf8,
          });
        });

        it.todo('Located at end of file.');

        it.todo('Located before ID3v1 tag.');

        it.todo('Has unsynchronisation.');
      });

      it('Prefer `ID3v2` over `ID3v1`.', async () => {
        await expect(getMetadata('ID3/dual-tag.mp3')).resolves.toEqual({
          fileType: 'mp3',
          format: 'ID3v2.3',
          metadata: results.base,
        });
      });

      it('Throws error if file is tagless.', async () => {
        await expect(getMetadata('ID3/tagless.mp3')).rejects.toThrow(
          new FileError('Not an ID3v1 tag.')
        );
      });
    });

    describe('AAC Files', () => {
      it('Supports `.m4a`.', async () => {
        await expect(getMetadata('AAC/m4a.m4a')).resolves.toEqual({
          fileType: 'm4a',
          format: 'M4A  (512)',
          metadata: results.base,
        });
      });

      it('Supports `.mp4`.', async () => {
        await expect(getMetadata('AAC/mp4.mp4')).resolves.toEqual({
          fileType: 'mp4',
          format: 'isom (512)',
          metadata: results.base,
        });
      });

      it('`artwork` is a base64 PNG string.', async () => {
        const data = await getMetadata('AAC/mp4.mp4', ['artwork']);
        expect(isBase64Image(data.metadata.artwork)).toBeTruthy();
      });

      it('Contains UTF-8 text.', async () => {
        await expect(getMetadata('AAC/utf8.mp4')).resolves.toEqual({
          fileType: 'mp4',
          format: 'isom (512)',
          metadata: results.utf8,
        });
      });
    });
  });

  describe('Special behaviors.', () => {
    describe('Get a subset of tags.', () => {
      const wantedTags = ['album', 'albumArtist'] as const;
      const metadata = { album: 'Void', albumArtist: 'Nothing' };

      it('With `ID3v1`.', async () => {
        const data = await getMetadata('ID3/v1.mp3', wantedTags);
        expect(data).toEqual({
          fileType: 'mp3',
          format: 'ID3v1',
          metadata: { album: 'Void', albumArtist: undefined },
        });
      });

      it('With `ID3v2.3`.', async () => {
        const data = await getMetadata('ID3/v2.3.mp3', wantedTags);
        const res = { fileType: 'mp3', format: 'ID3v2.3', metadata };
        expect(data).toEqual(res);
      });

      it('With FLAC.', async () => {
        const data = await getMetadata('FLAC/base.flac', wantedTags);
        const res = { fileType: 'flac', format: 'FLAC', metadata };
        expect(data).toEqual(res);
      });

      it('With AAC.', async () => {
        const data = await getMetadata('AAC/mp4.mp4', wantedTags);
        const res = { fileType: 'mp4', format: 'isom (512)', metadata };
        expect(data).toEqual(res);
      });
    });

    describe('`albumArtist` behavior.', () => {
      it('Fallbacks to `artist` if `artist` & `album` are both defined.', async () => {
        const wantedTags = ['album', 'albumArtist', 'artist'] as const;
        await expect(
          getMetadata('albumArtist-fallback.mp3', wantedTags)
        ).resolves.toEqual({
          fileType: 'mp3',
          format: 'ID3v2.3',
          metadata: {
            album: 'Void',
            albumArtist: 'Nothing',
            artist: 'Nothing',
          },
        });
      });

      it("Doesn't fallbacks to `artist` if `artist` is undefined.", async () => {
        const wantedTags = ['album', 'albumArtist'] as const;
        await expect(
          getMetadata('albumArtist-fallback.mp3', wantedTags)
        ).resolves.toEqual({
          fileType: 'mp3',
          format: 'ID3v2.3',
          metadata: { album: 'Void', albumArtist: undefined },
        });
      });

      it("Doesn't fallbacks to `artist` if `album` is undefined.", async () => {
        const wantedTags = ['albumArtist', 'artist'] as const;
        await expect(
          getMetadata('albumArtist-fallback.mp3', wantedTags)
        ).resolves.toEqual({
          fileType: 'mp3',
          format: 'ID3v2.3',
          metadata: { albumArtist: undefined, artist: 'Nothing' },
        });
      });
    });
  });
});
