# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project attempts to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- AAC support with `.mp4` & `.m4a` file extensions.

### Fixed

- Invalid `ID3v2` `artwork` base64 string value.
- Excluding tags not specified in the `ID3v1Reader` (we previously returned all the ID3v1 tags as it was a simple structure, however, it interfered with our tests).

### Changed

- Enabled split apks, proguard, and shrink resources in React Native examples.

## [1.2.0] - 2024-06-26

### ❗ Breaking

- Set minimum Node.js version that this package supports to be 18 (technically shouldn't be breaking as it should be enforced by having the React Native 0.74 dependency).

### Added

- Node.js support based on the mock we used in our tests.
- Additional examples for testing the app in the different configurations we support (Node.js, React Native w/ `expo-file-system`, React Native w/ `@dr.pogodin/react-native-fs`)

### Changed

- Removed space between organization name in `LICENSE`.
- `react` & `react-native` are now optional peer dependencies due to adding support for running this package in Node.js.
- Removed `fastestsmallesttextencoderdecoder` dependency as it was replaced with `fast-text-encoding` due to not working in React Native 0.74.

## [1.1.1] - 2024-06-14

### Changed

- Add email to `LICENSE`.
- Prefix built-in node modules with `node:` (ie: `node:fs`) instead of its unprefixed variant (ie: `fs`).

## [1.1.0] - 2024-06-02

### 📈 Performance fixes

- Reduced the duration of heavy reads (ie: getting the `artwork` metadata) by **up to ~60%** from switching `FileReader.read()` to use `Buffer.readBytes()` instead of `Buffer.readUInt8()` in a for-loop.

## [1.0.0] - 2024-05-30

First "official" release of `@missingcore/audio-metadata`.

> This contains no breaking changes since v0.1.0.

### Added

- Support for reading the following metadata tags from `.flac` (`FLAC`) & `.mp3` (`ID3v1`, `ID3v2`) files: "album", "artist", "artwork", "name", "track", and "year".
- Theoretical support for:
  - Unsynchronisation (ID3v2).
  - Tags located at the end of the file or before the ID3v1 tag (ID3v2.4).
- Support for using either `expo-file-system` or `@dr.pogodin/react-native-fs` for file system interactions (ie: should work with or without using Expo).
- Support for React Native's **"New Architecture"**.

### Changed

- Fixed expo install command & add NPM and License links in "README".

## [0.1.0] - 2024-05-30

The intial "beta" release of `@missingcore/audio-metadata`. This aims to verify that this package can be installed via NPM & the functionality of our package works. A more complete changelog will come with the release of `v1.0.0`.

## [0.0.0] - 2024-05-20

Add section to make `release-it` not complain that this is missing. 2024-05-20 is the creation data of this repository.

[unreleased]: https://github.com/MissingCore/audio-metadata/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/MissingCore/audio-metadata/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/MissingCore/audio-metadata/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/MissingCore/audio-metadata/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/MissingCore/audio-metadata/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/MissingCore/audio-metadata/releases/tag/v0.1.0
