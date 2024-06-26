import ExpoFileSystem from './expo-file-system';
import NodeFS from './node-fs';
import ReactNativeFS from './react-native-fs';

import { DependencyError } from '../utils/errors';

type StatResult =
  | { exists: false; size?: never }
  | { exists: true; size: number };

/**
 * Get metadata information about a file.
 *
 * @param fileUri The `file://` URI to the file.
 */
export async function getFileStat(fileUri: string): Promise<StatResult> {
  if (ReactNativeFS) {
    if (!(await ReactNativeFS.exists(fileUri))) return { exists: false };
    const { size } = await ReactNativeFS.stat(fileUri);
    return { exists: true, size };
  } else if (ExpoFileSystem) {
    const result = await ExpoFileSystem.getInfoAsync(fileUri, { size: true });
    if (!result.exists) return { exists: false };
    return { exists: true, size: result.size };
  } else if (NodeFS) {
    if (!(await NodeFS.exists(fileUri))) return { exists: false };
    const { size } = await NodeFS.stat(fileUri);
    return { exists: true, size };
  } else {
    throw new DependencyError();
  }
}

/**
 * Reads `length` bytes from the given `position` of a file as a Base64
 * string.
 *
 * @param fileUri The `file://` URI to the file.
 * @param length The number of bytes to read.
 * @param position The starting read position in bytes.
 */
export async function read(fileUri: string, length: number, position: number) {
  if (ReactNativeFS) {
    return ReactNativeFS.read(fileUri, length, position, 'base64');
  } else if (ExpoFileSystem) {
    return ExpoFileSystem.readAsStringAsync(fileUri, {
      encoding: ExpoFileSystem.EncodingType.Base64,
      length,
      position,
    });
  } else if (NodeFS) {
    return NodeFS.read(fileUri, length, position, 'base64');
  } else {
    throw new DependencyError();
  }
}
