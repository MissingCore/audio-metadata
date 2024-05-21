export class DependencyError extends Error {
  constructor() {
    super();
    this.name = 'DependencyError';
    this.message =
      'Neither `expo-file-system` or `@dr.pogodin/react-native-fs` is installed.';
  }
}
