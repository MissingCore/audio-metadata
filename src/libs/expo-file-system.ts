import type { FileSystem } from './expo-file-system.types';

let ExpoFileSystem: FileSystem | undefined;

try {
  ExpoFileSystem = require('expo-file-system');
} catch {}

export default ExpoFileSystem;
