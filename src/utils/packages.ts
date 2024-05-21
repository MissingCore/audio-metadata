/** Check whether a package is installed. */
export async function checkPackage(packageName: string) {
  try {
    await import(packageName);
    return true;
  } catch {
    return false;
  }
}
