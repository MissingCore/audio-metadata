import { DependencyError } from '../utils/errors';

/** Mimics the package check used inside the functions in `fs.ts`. */
async function detectFSPackage() {
  // Use inline `require` instead of external `import` to allow the mocks
  // to be applied & changed.
  const ReactNativeFS = require('../libs/react-native-fs').default;
  const ExpoFileSystem = require('../libs/expo-file-system').default;

  if (ReactNativeFS) {
    return '@dr.pogodin/react-native-fs';
  } else if (ExpoFileSystem) {
    return 'expo-file-system';
  } else {
    throw new DependencyError();
  }
}

describe('Ensure functions in `fs.ts` utilize the correct file system library based on installed packages.', () => {
  beforeEach(() => {
    jest.mock('@dr.pogodin/react-native-fs', () => jest.fn());
    jest.mock('expo-file-system', () => jest.fn());
  });

  afterEach(() => {
    // Ensure we always use a fresh mock before each test (ie: don't use
    // from the cache if we `unmock` a mock inside a test).
    jest.resetModules();
  });

  it('No file system libraries are installed', async () => {
    jest.unmock('@dr.pogodin/react-native-fs');
    jest.unmock('expo-file-system');
    await expect(detectFSPackage()).rejects.toThrow(DependencyError);
  });

  it('Only `@dr.pogodin/react-native-fs` is installed.', async () => {
    jest.unmock('expo-file-system');
    await expect(detectFSPackage()).resolves.toEqual(
      '@dr.pogodin/react-native-fs'
    );
  });

  it('Only `expo-file-system` is installed.', async () => {
    jest.unmock('@dr.pogodin/react-native-fs');
    await expect(detectFSPackage()).resolves.toEqual('expo-file-system');
  });

  it('Both packages are installed.', async () => {
    await expect(detectFSPackage()).resolves.toEqual(
      '@dr.pogodin/react-native-fs'
    );
  });
});
