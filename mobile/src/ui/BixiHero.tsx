/**
 * Full-screen Bixi on the Home backdrop — mood-driven idle + mood-driven action
 * reactions, tuned for zero-lag, zero-cut playback.
 *
 * Idle: Content/Thriving → happy loop, else → sad loop, dormant → dormant loop.
 * Frame-0 posters + readyToPlay gating = no load flash.
 *
 * Reactions: 9 reaction players are kept preloaded; their SOURCE is swapped
 * between the happy and sad set whenever the mood band flips (an infrequent,
 * non-press moment), so pressing an action always plays an already-decoded clip
 * — no freeze — and a sad Bixi reacts sadly. Each reaction ends on the idle's
 * first frame, and we restart the idle from frame 0 on hand-off, so there's no
 * cut. Feed has two happy variants (random); the rest are one clip each.
 *
 * The rare ritual / both-here clips share ONE player whose source is loaded with
 * `replaceAsync` (off the UI thread) and only revealed once it's ready — so the
 * swap never blocks (that was the ~10s ritual freeze) and never shows a still.
 *
 * `allowsVideoFrameAnalysis={false}` on every VideoView disables iOS's Live-Text
 * / subject-scanner button (the "Apple text scanner" overlay).
 */
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GrowthStage, MoodState } from '@/game/types';

const HAPPY_POSTER = require('../../assets/bixi/idle_poster.jpg');
const SAD_POSTER = require('../../assets/bixi/sad_poster.jpg');
const DORMANT_POSTER = require('../../assets/bixi/dormant_poster.jpg');
const IDLE = require('../../assets/bixi/idle_happy.mp4');
const SAD_IDLE = require('../../assets/bixi/sad_idle.mp4');
const DORMANT_IDLE = require('../../assets/bixi/dormant_idle.mp4');

// happy reaction set (feed has two variants) + padded durations (ms)
const HAPPY: Record<string, { src: number; ms: number }> = {
  water: { src: require('../../assets/bixi/water.mp4'), ms: 10042 + 120 },
  pet: { src: require('../../assets/bixi/pet.mp4'), ms: 6042 + 120 },
  feed: { src: require('../../assets/bixi/feed.mp4'), ms: 6042 + 120 },
  feed2: { src: require('../../assets/bixi/feed2.mp4'), ms: 6042 + 120 },
  read: { src: require('../../assets/bixi/read.mp4'), ms: 6042 + 120 },
  shower: { src: require('../../assets/bixi/shower.mp4'), ms: 10042 + 120 },
  stretch: { src: require('../../assets/bixi/stretch.mp4'), ms: 6042 + 120 },
  scroll: { src: require('../../assets/bixi/scroll.mp4'), ms: 6042 + 120 },
  sun: { src: require('../../assets/bixi/sun.mp4'), ms: 7042 + 120 },
};
// sad reaction set — same clip keys; feed2 reuses the single sad feed clip
const SAD: Record<string, { src: number; ms: number }> = {
  water: { src: require('../../assets/bixi/sad_water.mp4'), ms: 5042 + 120 },
  pet: { src: require('../../assets/bixi/sad_pet.mp4'), ms: 5042 + 120 },
  feed: { src: require('../../assets/bixi/sad_feed.mp4'), ms: 5042 + 120 },
  feed2: { src: require('../../assets/bixi/sad_feed.mp4'), ms: 5042 + 120 },
  read: { src: require('../../assets/bixi/sad_read.mp4'), ms: 6042 + 120 },
  shower: { src: require('../../assets/bixi/sad_shower.mp4'), ms: 8042 + 120 },
  stretch: { src: require('../../assets/bixi/sad_stretch.mp4'), ms: 6042 + 120 },
  scroll: { src: require('../../assets/bixi/sad_scroll.mp4'), ms: 6042 + 120 },
  sun: { src: require('../../assets/bixi/sad_sun.mp4'), ms: 6042 + 120 },
};

// action key → reaction-clip keys to randomize between. (Read's key is `books`.)
const ACTION_KEYS: Record<string, string[]> = {
  water: ['water'], pet: ['pet'], feed: ['feed', 'feed2'], books: ['read'],
  shower: ['shower'], stretch: ['stretch'], scroll: ['scroll'], sun: ['sun'],
};

// special one-off clips (mood-independent) — the daily-ritual dances (random of 6)
// and the "both keepers here at once" celebration. Rare events, so a single
// shared player swaps its source on the fly.
const RITUAL: { src: number; ms: number }[] = [
  { src: require('../../assets/bixi/ritual1.mp4'), ms: 7042 + 120 },
  { src: require('../../assets/bixi/ritual2.mp4'), ms: 7042 + 120 },
  { src: require('../../assets/bixi/ritual3.mp4'), ms: 5042 + 120 },
  { src: require('../../assets/bixi/ritual4.mp4'), ms: 5042 + 120 },
  { src: require('../../assets/bixi/ritual5.mp4'), ms: 5042 + 120 },
  { src: require('../../assets/bixi/ritual6.mp4'), ms: 5042 + 120 },
];
const BOTH_HERE = { src: require('../../assets/bixi/both_here.mp4'), ms: 7042 + 120 };

export function BixiHero({
  mood,
  reaction,
}: {
  stage: GrowthStage;
  mood: MoodState;
  reaction?: { key: string; at: number } | null;
}) {
  const happy = mood === 'content' || mood === 'thriving';
  const dormant = mood === 'dormant';

  const happyBase = useVideoPlayer(IDLE, (p) => { p.loop = true; p.muted = true; });
  const sadBase = useVideoPlayer(SAD_IDLE, (p) => { p.loop = true; p.muted = true; });
  const dormantBase = useVideoPlayer(DORMANT_IDLE, (p) => { p.loop = true; p.muted = true; });

  // one reaction player per clip key — source swapped by mood (see effect below)
  const water = useVideoPlayer(HAPPY.water.src, (p) => { p.loop = false; p.muted = true; });
  const pet = useVideoPlayer(HAPPY.pet.src, (p) => { p.loop = false; p.muted = true; });
  const feed = useVideoPlayer(HAPPY.feed.src, (p) => { p.loop = false; p.muted = true; });
  const feed2 = useVideoPlayer(HAPPY.feed2.src, (p) => { p.loop = false; p.muted = true; });
  const read = useVideoPlayer(HAPPY.read.src, (p) => { p.loop = false; p.muted = true; });
  const shower = useVideoPlayer(HAPPY.shower.src, (p) => { p.loop = false; p.muted = true; });
  const stretch = useVideoPlayer(HAPPY.stretch.src, (p) => { p.loop = false; p.muted = true; });
  const scroll = useVideoPlayer(HAPPY.scroll.src, (p) => { p.loop = false; p.muted = true; });
  const sun = useVideoPlayer(HAPPY.sun.src, (p) => { p.loop = false; p.muted = true; });
  const rp: Record<string, typeof water> = { water, pet, feed, feed2, read, shower, stretch, scroll, sun };
  // shared player for the rare ritual / both-here clips (source swapped on fire)
  const special = useVideoPlayer(RITUAL[0].src, (p) => { p.loop = false; p.muted = true; });

  const activeBase = happy ? happyBase : dormant ? dormantBase : sadBase;

  // pause the non-active idles and hold the active one at frame 0 (matches the
  // poster) — it isn't started until it's ready (effect below), so on reload the
  // poster→video hand-off is on the same frame: no snap.
  useEffect(() => {
    [happyBase, sadBase, dormantBase].forEach((p) => { if (p !== activeBase) p.pause(); });
    activeBase.currentTime = 0;
  }, [activeBase, happyBase, sadBase, dormantBase]);

  // swap the reaction set to match the mood band (preloads the mood's clips).
  // replaceAsync (NOT replace): a synchronous replace of all 9 reaction players
  // on the main thread was THE freeze — it fired whenever the daily ritual (or
  // any care) bumped the mood across the happy/sad line, locking both phones for
  // seconds. Async loads them off-thread; the idle keeps playing meanwhile.
  const loadedHappy = useRef(true);
  useEffect(() => {
    if (loadedHappy.current === happy) return;
    loadedHappy.current = happy;
    const set = happy ? HAPPY : SAD;
    Object.keys(set).forEach((k) => { void rp[k].replaceAsync(set[k].src).catch(() => {}); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [happy]);

  // reveal the active idle only once it can play (poster covers the load)
  const happyStatus = useEvent(happyBase, 'statusChange', { status: happyBase.status }).status;
  const sadStatus = useEvent(sadBase, 'statusChange', { status: sadBase.status }).status;
  const dormantStatus = useEvent(dormantBase, 'statusChange', { status: dormantBase.status }).status;
  const baseReady = (happy ? happyStatus : dormant ? dormantStatus : sadStatus) === 'readyToPlay';

  // start the active idle the instant it can play — it's revealed at the same
  // moment (opacity below is gated on baseReady), both from frame 0.
  useEffect(() => {
    if (baseReady) { try { activeBase.play(); } catch {} }
  }, [baseReady, activeBase]);

  const [active, setActive] = useState<string | null>(null);
  const lastAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!reaction || reaction.at === lastAt.current) return;
    lastAt.current = reaction.at;
    const at = reaction.at;

    // ── SPECIAL (ritual / arrival): the shared player must load a new clip.
    // Load it OFF the UI thread with replaceAsync (this was the ~10s freeze),
    // keep the idle looping until it's ready, then hand off cleanly. A mood flip
    // or re-render mid-load can't cancel it — only a newer tap (via lastAt).
    if (reaction.key === 'ritual' || reaction.key === 'arrival') {
      const c = reaction.key === 'ritual'
        ? RITUAL[Math.floor(Math.random() * RITUAL.length)]
        : BOTH_HERE;
      (async () => {
        try { await special.replaceAsync(c.src); } catch {}
        if (lastAt.current !== at) return; // superseded by a newer reaction
        try {
          activeBase.pause();
          activeBase.currentTime = 0; // park idle at frame 0 underneath
          special.currentTime = 0;
          special.play();
        } catch {}
        setActive('special');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          try { activeBase.currentTime = 0; activeBase.play(); } catch {}
          setActive(null);
        }, c.ms);
      })();
      return;
    }

    // ── ACTION reaction: the player is ALREADY preloaded → play instantly, no
    // load, no freeze, ends on idle's frame 0 → zero cut. (Original behaviour.)
    const keys = ACTION_KEYS[reaction.key];
    if (!keys) return; // no reaction art for this action → idle keeps looping
    const activeKey = keys[Math.floor(Math.random() * keys.length)];
    const ms = (happy ? HAPPY : SAD)[activeKey].ms;
    const player = rp[activeKey];
    try {
      activeBase.pause();
      activeBase.currentTime = 0; // park idle at frame 0 underneath
      player.currentTime = 0;
      player.play();
      setActive(activeKey);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try { activeBase.currentTime = 0; activeBase.play(); } catch {}
        setActive(null);
      }, ms);
    } catch {
      setActive(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction, happy]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={happy ? HAPPY_POSTER : dormant ? DORMANT_POSTER : SAD_POSTER} style={StyleSheet.absoluteFill} contentFit="cover" />
      <VideoView player={happyBase} style={[StyleSheet.absoluteFill, { opacity: happy && baseReady ? 1 : 0 }]} contentFit="cover" nativeControls={false} allowsVideoFrameAnalysis={false} />
      <VideoView player={sadBase} style={[StyleSheet.absoluteFill, { opacity: !happy && !dormant && baseReady ? 1 : 0 }]} contentFit="cover" nativeControls={false} allowsVideoFrameAnalysis={false} />
      <VideoView player={dormantBase} style={[StyleSheet.absoluteFill, { opacity: dormant && baseReady ? 1 : 0 }]} contentFit="cover" nativeControls={false} allowsVideoFrameAnalysis={false} />
      {active && (
        <VideoView player={active === 'special' ? special : rp[active]} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsVideoFrameAnalysis={false} />
      )}
    </View>
  );
}
