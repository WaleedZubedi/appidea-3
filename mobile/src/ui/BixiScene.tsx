/**
 * Bixi on his specimen plate. Uses the placeholder videos (idle/drift/dormant + one-shot
 * feed/water/tap/revive). These are stand-ins — Saud will hand over real clips (or a Rive
 * file) later; the mapping stays the same. See videos/README.md.
 */
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';
import type { MoodState } from '@/game/types';

const V = {
  idle: require('../../assets/videos/idle.mp4'),
  drift: require('../../assets/videos/drift.mp4'),
  dormant: require('../../assets/videos/dormant.mp4'),
  feed: require('../../assets/videos/feed.mp4'),
  water: require('../../assets/videos/water.mp4'),
  tap: require('../../assets/videos/tap.mp4'),
  revive: require('../../assets/videos/revive.mp4'),
} as const;

type ReactionKey = 'feed' | 'water' | 'tap' | 'revive';

function baseSourceFor(state: MoodState) {
  if (state === 'dormant') return V.dormant;
  if (state === 'wilting' || state === 'drifting' || state === 'sad') return V.drift;
  return V.idle; // content / thriving
}

export function BixiScene({
  state,
  reaction,
}: {
  state: MoodState;
  reaction: { video?: ReactionKey; at: number } | null;
}) {
  const baseSource = useMemo(() => baseSourceFor(state), [state]);

  const base = useVideoPlayer(baseSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const react = useVideoPlayer(V.tap, (p) => {
    p.loop = false;
    p.muted = true;
  });

  const [overlay, setOverlay] = useState(false);
  const lastReactionAt = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // swap the looping base clip when the mood state changes
  useEffect(() => {
    try {
      base.replace(baseSource);
      base.loop = true;
      base.muted = true;
      base.play();
    } catch {}
  }, [baseSource, base]);

  // fire a one-shot reaction overlay
  useEffect(() => {
    if (!reaction || !reaction.video) return;
    if (reaction.at === lastReactionAt.current) return;
    lastReactionAt.current = reaction.at;
    try {
      react.replace(V[reaction.video]);
      react.currentTime = 0;
      react.muted = true;
      react.play();
      setOverlay(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setOverlay(false), 2600);
    } catch {
      setOverlay(false);
    }
  }, [reaction, react]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return (
    <View style={styles.plate}>
      <View style={styles.inner}>
        <VideoView
          player={base}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
        {overlay && (
          <VideoView
            player={react}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    padding: 8,
    borderRadius: radius.lg + 4,
    backgroundColor: colors.ink,
    alignSelf: 'stretch',
    aspectRatio: 1,
  },
  inner: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.tint,
    backgroundColor: '#0d1512',
  },
});
