let RNFS;

try {
  RNFS = require('@dr.pogodin/react-native-fs');
} catch (err) {
  // do nothing
  console.log(`[@dr.pogodin/react-native-fs]`, err);
}

export default RNFS;
