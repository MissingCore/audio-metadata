import { getAudioMetadata } from '@missingcore/audio-metadata';

const wantedTags = ['album', 'artist', 'name', 'track', 'year'] as const;

getAudioMetadata('../../test-audio/Silence.flac', wantedTags).then((data) =>
  console.log(data)
);

getAudioMetadata('../../test-audio/Silence (ID3v2.3).mp3', wantedTags).then(
  (data) => console.log(data)
);

getAudioMetadata('../../test-audio/Silence.m4a', wantedTags).then((data) =>
  console.log(data)
);

getAudioMetadata('../../test-audio/Silence.mp4', wantedTags).then((data) =>
  console.log(data)
);
