export class DependencyError extends Error {
  constructor() {
    super();
    this.name = 'DependencyError';
    this.message = 'No file system library detected.';
  }
}
export class FileError extends Error {
  constructor(message: string) {
    super();
    this.name = 'FileError';
    this.message = message;
  }
}
