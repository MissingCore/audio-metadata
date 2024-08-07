import { FlashList } from '@shopify/flash-list';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import type { AudioFileType } from '@missingcore/audio-metadata';
import { AudioFileTypes, getAudioMetadata } from '@missingcore/audio-metadata';

import { isFulfilled, isRejected } from './utils/promise';

const queryClient = new QueryClient();

/*
  Configurations for example app. Options we can change:
    - Whether artwork is also fetched.
    - Cap on the number of tracks read.
    - Limit what extensions we care about.
*/
const AppConfig = {
  withArtwork: false,
  trackLimit: 50 as number | undefined,
  extensions: ['m4a', 'mp4'] as AudioFileType[],
};

const baseTags = [
  ...['album', 'albumArtist', 'artist', 'name', 'track', 'year'],
] as const;

async function getTracks() {
  const start = performance.now();

  const { totalCount } = await MediaLibrary.getAssetsAsync({
    mediaType: 'audio',
    first: 0,
  });

  const usedExtensions =
    AppConfig.extensions.length > 0 ? AppConfig.extensions : AudioFileTypes;

  let audioFiles = (
    await MediaLibrary.getAssetsAsync({
      // `.mp4` & `.m4a` is classified as audio by Android
      //  - https://developer.android.com/media/platform/supported-formats#audio-formats
      mediaType: 'audio',
      first: totalCount,
    })
  ).assets.filter(
    (a) =>
      usedExtensions.some((ext) => a.filename.endsWith(`.${ext}`)) &&
      // Limit media to those in the `Music` folder on our device.
      a.uri.startsWith('file:///storage/emulated/0/Music/')
  );

  if (AppConfig.trackLimit) {
    audioFiles = audioFiles.slice(0, AppConfig.trackLimit);
  }

  const wantedTags = AppConfig.withArtwork
    ? ([...baseTags, 'artwork'] as const)
    : baseTags;

  const tracksMetadata = await Promise.allSettled(
    audioFiles.map(async ({ id, uri }) => {
      const data = await getAudioMetadata(uri, wantedTags);
      return { format: data.format, id, ...data.metadata };
    })
  );

  const errors = tracksMetadata.filter(isRejected).map(({ reason }) => reason);
  console.log('Errors:', errors);

  return {
    duration: ((performance.now() - start) / 1000).toFixed(4),
    tracks: tracksMetadata.filter(isFulfilled).map(({ value }) => value),
  };
}

export default function RootLayer() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export function App() {
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['audio'],
  });
  const [hasPermissions, setHasPermissions] = useState(false);

  const { isPending, error, data } = useQuery({
    queryKey: ['tracks'],
    queryFn: getTracks,
    enabled: hasPermissions,
  });

  useEffect(() => {
    async function checkPermissions() {
      if (permissionResponse?.status !== 'granted') {
        const { canAskAgain, status } = await requestPermission();
        if (canAskAgain || status === 'denied') return;
      } else {
        setHasPermissions(true);
      }
    }
    checkPermissions();
  }, [permissionResponse?.status, requestPermission]);

  if (isPending) {
    return (
      <Container>
        <Text style={styles.heading}>Loading tracks...</Text>
      </Container>
    );
  } else if (error) {
    return (
      <Container>
        <Text style={styles.heading}>An error was encountered:</Text>
        <Text style={styles.text}>{error.message}</Text>
      </Container>
    );
  } else if (!hasPermissions) {
    return (
      <Container>
        <Text style={styles.heading}>
          Read permissions for media content was not granted.
        </Text>
      </Container>
    );
  }

  const properlyTagged = data.tracks.map(
    ({ name, artist }) => !!name && !!artist
  ).length;

  return (
    <Container>
      <Text style={styles.heading}>
        Information about all the audio files `@missingcore/audio-metadata` can
        identify.
      </Text>
      <Text style={styles.text}>Task completed in {data.duration}s.</Text>
      <Text style={styles.text}>Total Tracks Found: {data.tracks.length}</Text>
      <Text style={styles.text}>
        Properly Tagged Tracks (has `title` & `artist` fields): {properlyTagged}
      </Text>
      <Text style={styles.heading}>Using `react-native-fs`</Text>

      <FlashList
        estimatedItemSize={166}
        data={data.tracks}
        keyExtractor={({ id }) => id}
        renderItem={({ item }) => (
          <View style={styles.metadataContainer}>
            <View style={styles.image}>
              <Image
                source={item.artwork}
                contentFit="cover"
                style={styles.image}
              />
            </View>
            <View style={styles.infoContainer}>
              <Text style={styles.bold}>{item.format}</Text>
              <Text numberOfLines={1}>{item.name}</Text>
              <Text numberOfLines={1}>{item.artist}</Text>
              {item.album && <Text numberOfLines={1}>{item.album}</Text>}
              <Text numberOfLines={1}>{item.albumArtist}</Text>
              {item.track && <Text>Track {item.track}</Text>}
              {item.year && <Text>({item.year})</Text>}
            </View>
          </View>
        )}
      />
    </Container>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 64 }]}>
      <StatusBar style="dark" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  heading: {
    marginHorizontal: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  text: {
    marginHorizontal: 16,
    textAlign: 'center',
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 8,
    margin: 8,
    borderRadius: 16,
    backgroundColor: '#ebebeb',
    elevation: 4,
  },
  image: {
    width: 150,
    height: 150,
    backgroundColor: '#bdbdbd',
    borderRadius: 12,
  },
  infoContainer: {
    flex: 1,
  },
  bold: {
    fontWeight: 'bold',
  },
});
