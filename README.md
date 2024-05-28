# @missingcore/audio-metadata

An audio file metadata reader built for **React Native** (mobile only) supporting tags used in [`MissingCore/Music`](https://github.com/MissingCore/Music).

> Supports React Native's **"New Architecture"**.

## Supported Files

| Extension | Format              | Additional Information                                                                                   |
| --------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `.flac`   | - FLAC              |                                                                                                          |
| `.mp3`    | - ID3v1<br/>- ID3v2 | - Unsynchronisation supported<br/>- Tag at end of file supported (ID3v2.4)<br/>- All other flags ignored |

## Installation

> [!IMPORTANT]  
> Currently, this library only supports `React Native 0.74.0` or `Expo SDK 51` and newer due to the introduction of native `atob()` & `btoa()` support.
>
> In the future, we may support older versions with a peer dependency of `base-64`.

This library supports using either [`expo-file-system`](https://docs.expo.dev/versions/latest/sdk/filesystem/) or [`@dr.pogodin/react-native-fs`](https://github.com/birdofpreyru/react-native-fs) (a more actively maintained fork of [`react-native-fs`](https://github.com/itinance/react-native-fs)).

> **Note:** Using `@dr.pogodin/react-native-fs` with `expo` requires a **bare** workflow.

Regardless of which file system library you use, they perform relatively the same.

### With `expo-file-system`

```sh
expo install @missingcore/audio-metadata expo-file-system
```

### With `@dr.pogodin/react-native-fs`

```sh
npm i @missingcore/audio-metadata @dr.pogodin/react-native-fs
```

## Usage

```tsx
import { getAudioMetadata } from '@missingcore/audio-metadata';

const uri = 'file:///storage/emulated/0/Music/Silence.mp3';
const wantedTags = ['album', 'artist', 'name', 'track', 'year'] as const;

// Of course with `await`, use this inside an async function or use Promise.then().
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
