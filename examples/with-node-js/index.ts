import { getAudioMetadata } from '@missingcore/audio-metadata';

const wantedTags = ['album', 'artist', 'name', 'track', 'year'] as const;

getAudioMetadata('../../test-audio/Silence (ID3v2.3).mp3', wantedTags).then(
  (data) => console.log(data)
);
