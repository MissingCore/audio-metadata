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

import { getMusicInfoAsync } from '@missingcore/audio-metadata';

import { isFulfilled } from './utils/promise';

const queryClient = new QueryClient();

/** Whether we want to also get the track artwork (will make things a lot slower). */
const withArtwork = false;

async function getTracks() {
  const start = performance.now();

  const { totalCount } = await MediaLibrary.getAssetsAsync({
    mediaType: 'audio',
    first: 0,
  });

  const mp3Files = (
    await MediaLibrary.getAssetsAsync({
      mediaType: 'audio',
      first: totalCount,
    })
  ).assets.filter((a) => a.filename.endsWith('.mp3'));

  const tracksMetadata = await Promise.allSettled(
    mp3Files.map(async ({ id, uri }) => ({
      id,
      ...(await getMusicInfoAsync(uri, true)),
      ...(withArtwork ? await getMusicInfoAsync(uri, false) : {}),
    }))
  );

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
  const insets = useSafeAreaInsets();
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
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
      <View style={[styles.container, { paddingTop: insets.top + 64 }]}>
        <Text style={styles.heading}>Loading tracks...</Text>
      </View>
    );
  } else if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 64 }]}>
        <Text style={styles.heading}>An error was encountered:</Text>
        <Text style={styles.text}>{error.message}</Text>
      </View>
    );
  } else if (!hasPermissions) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 64 }]}>
        <Text style={styles.heading}>
          Read permissions for media content was not granted.
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <View style={[styles.container, { paddingTop: insets.top + 64 }]}>
        <Text style={styles.heading}>
          Information about all the audio files `@missingcore/audio-metadata`
          can identify.
        </Text>
        <Text style={styles.text}>Task completed in {data.duration}s.</Text>

        <FlashList
          estimatedItemSize={166}
          data={data.tracks}
          keyExtractor={({ id }) => id}
          renderItem={({ item }) => (
            <View style={styles.metadataContainer}>
              <View style={styles.image}>
                <Image
                  source={item.cover}
                  contentFit="cover"
                  style={styles.image}
                />
              </View>
              <View>
                <Text numberOfLines={1}>{item.name}</Text>
                <Text numberOfLines={1}>{item.artist}</Text>
                {item.album && <Text numberOfLines={1}>{item.album}</Text>}
                {item.track && <Text>Track {item.track}</Text>}
                {item.year && <Text>({item.year})</Text>}
              </View>
            </View>
          )}
        />
      </View>
    </>
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
});
