# @missingcore/audio-metadata

[![NPM Version][NPM Version]][NPM Version-url]
[![License][License]][License-url]

An audio file metadata reader built primarily for **React Native** (mobile only) supporting tags used in [`MissingCore/Music`](https://github.com/MissingCore/Music).

> [!NOTE]  
> Supports React Native's **"New Architecture"**.
>
> Also works in a plain Node.js environment.

## Supported Files

| Extension     | Format                      | Additional Information                                                                                     |
| ------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.flac`       | - FLAC                      |                                                                                                            |
| `.mp3`        | - ID3v1<br/>- ID3v2         | - Unsynchronisation supported*<br/>- Tag at end of file supported (ID3v2.4)*<br/>- All other flags ignored |
| `.mp4`/`.m4a` | - MP-4 Part 14 (a.k.a. MP4) |                                                                                                            |

> \* Currently untested as I have no `.mp3` files that meets those conditions. Feel free to submit an issue to tell me if it works or doesn't work.

## Installation

### React Native

> [!IMPORTANT]  
> Currently, this library only supports `React Native 0.74.0` or `Expo SDK 51` and newer due to the introduction of native `atob()` & `btoa()` support.
>
> In the future, we may support older versions with a peer dependency of `base-64`.

This library supports using either [`expo-file-system`](https://docs.expo.dev/versions/latest/sdk/filesystem/) or [`@dr.pogodin/react-native-fs`](https://github.com/birdofpreyru/react-native-fs) (a more actively maintained fork of [`react-native-fs`](https://github.com/itinance/react-native-fs)).

> **Note:** Using `@dr.pogodin/react-native-fs` with `expo` requires a **bare** workflow.

Regardless of which file system library you use, they perform relatively the same.

#### With `expo-file-system`

```sh
npx expo install @missingcore/audio-metadata expo-file-system
```

#### With `@dr.pogodin/react-native-fs`

```sh
npm install @missingcore/audio-metadata @dr.pogodin/react-native-fs
```

### Node.js

This library supports Node.js as it supplements the file system operations by using native Node.js modules.

## Usage

```tsx
import { getAudioMetadata } from '@missingcore/audio-metadata';

const uri = 'file:///storage/emulated/0/Music/Silence.mp3';
const wantedTags = ['album', 'artist', 'name', 'track', 'year'] as const;

// Of course with `await`, use this inside an async function or use `Promise.then()`.
const data = await getAudioMetadata(uri, wantedTags);
/*
  Returns:
    {
      fileType: 'mp3',
      format: 'ID3v2.3',
      metadata: {
          album: 'Void';
          artist: 'Nothing;
          name: 'Silence';
          track: 1;
          year: 2024;
      }
    }
*/
```

### Supported Tags

> The full list of supported tags [found here](https://github.com/MissingCore/audio-metadata/blob/main/src/MetadataExtractor.types.ts#L3).

```tsx
type AudioMetadata = {
  album: string;
  artist: string;
  artwork: string; // A base64 image string.
  name: string;
  track: number;
  year: number;
};
```

**❗Note❗** that not all of the requested metadata may be present in the file read. In the returned `metadata` value, all the fields we want are "optional" (ie: its value can be `undefined`).

## Related

- [jsmediatags](https://github.com/aadsm/jsmediatags)
- [expo-music-info-2](https://github.com/MehrabSp/expo-music-info-2)

## License

[MIT](./LICENSE)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[License]: https://img.shields.io/npm/l/@missingcore/audio-metadata.svg?style=for-the-badge&labelColor=000000
[License-url]: https://github.com/MissingCore/audio-metadata/blob/main/LICENSE
[NPM Version]: https://img.shields.io/npm/v/@missingcore/audio-metadata.svg?style=for-the-badge&labelColor=000000
[NPM Version-url]: https://www.npmjs.com/package/@missingcore/audio-metadata
