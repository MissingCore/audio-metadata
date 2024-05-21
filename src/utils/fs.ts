import { DependencyError } from './errors';
import { checkPackage } from './packages';

type StatResult =
  | { exists: false; size?: never }
  | { exists: true; size: number };

/**
 * Get metadata information about a file.
 *
 * @param fileUri The `file://` URI to the file.
 */
export async function getFileStat(fileUri: string): Promise<StatResult> {
  if (await checkPackage('expo-file-system')) {
    const { getInfoAsync } = await import('expo-file-system');
    const result = await getInfoAsync(fileUri);
    if (!result.exists) return { exists: false };
    return { exists: true, size: result.size };
  } else if (await checkPackage('@dr.pogodin/react-native-fs')) {
    const { exists, stat } = await import('@dr.pogodin/react-native-fs');
    if (!(await exists(fileUri))) return { exists: false };
    const { size } = await stat(fileUri);
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
  if (await checkPackage('expo-file-system')) {
    const { EncodingType, readAsStringAsync } = await import(
      'expo-file-system'
    );
    return readAsStringAsync(fileUri, {
      encoding: EncodingType.Base64,
      length,
      position,
    });
  } else if (await checkPackage('@dr.pogodin/react-native-fs')) {
    const { read: rnfsRead } = await import('@dr.pogodin/react-native-fs');
    return rnfsRead(fileUri, length, position, 'base64');
  } else {
    throw new DependencyError();
  }
}
