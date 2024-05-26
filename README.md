# @missingcore/audio-metadata

An audio file metadata reader built for **React Native** (mobile only) supporting tags used in [`MissingCore/Music`](https://github.com/MissingCore/Music).

> Supports React Native's **"New Architecture"**.

## Supported Files

| Extension | Format              | Additional Information                                                                                   |
| --------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| MP3       | - ID3v1<br/>- ID3v2 | - Unsynchronisation supported<br/>- Tag at end of file supported (ID3v2.4)<br/>- All other flags ignored |

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

## Related

- [jsmediatags](https://github.com/aadsm/jsmediatags)
- [expo-music-info-2](https://github.com/MehrabSp/expo-music-info-2)

## License

[MIT](./LICENSE)
