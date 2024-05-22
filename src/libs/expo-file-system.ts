let EFS;

try {
  EFS = require('expo-file-system');
} catch (err) {
  // do nothing
  console.log(`[expo-file-system]`, err);
}

export default EFS;
