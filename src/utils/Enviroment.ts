/** Detects if the the environment this package is running in is Node.js. */
export function isNodeJS() {
  return typeof process !== 'undefined' && process.release.name === 'node';
}
