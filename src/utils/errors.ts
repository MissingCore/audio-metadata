export class DependencyError extends Error {
  constructor() {
    super();
    this.name = 'DependencyError';
    this.message =
      'Neither `expo-file-system` or `@dr.pogodin/react-native-fs` is installed.';
  }
}
export class FileError extends Error {
  constructor(message: string) {
    super();
    this.name = 'FileError';
    this.message = message;
  }
}
