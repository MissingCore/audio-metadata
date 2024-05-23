import type { FileSystem } from './react-native-fs.types';

let ReactNativeFS: FileSystem | undefined;

try {
  ReactNativeFS = require('@dr.pogodin/react-native-fs');
} catch {}

export default ReactNativeFS;
