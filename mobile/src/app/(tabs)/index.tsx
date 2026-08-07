import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { fonts } from '@/theme';
import { HOUR, STAGE_META, deriveMoodState, driftedKeepers, modeOf, stageForStreak } from '@/game/engine';
import { useBixi } from '@/game/store';
import { BixiGuide } from '@/ui/BixiGuide';
import { BixiHero } from '@/ui/BixiHero';
import { NotifPanel, type Alert as NotifAlert } from '@/ui/NotifPanel';
import { GlowNote } from '@/ui/GlowNote';
import { actBothHere, actCare, actClaim, actInvite, actRevive } from '@/game/actions';
import { subscribe } from '@/game/sync';
import { invitePreview, presenceForPair, reactionChannel, type InvitePreview } from '@/lib/api';
import { IS_ONLINE, UNIVERSAL_LINK_HOST } from '@/lib/config';
import { enableNotifications } from '@/lib/push';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/session';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import type { MoodState } from '@/game/types';
import { IC, ShowerIcon, BooksIcon, StretchIcon, ScrollIcon, SunIcon } from '@/ui/actionIcon';

const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const ACCENT = '#f0895f';
const LEAF = '#7fc07a';
const HEART = '#e07a5f';
const FEED = '#e0a94a';
const SHOWER = '#5cc0b4';
const READ = '#c9a2e0';
const STRETCH = '#8fcf9a';
const SCROLL = '#7fa8d0';
const SUN = '#f0c94a';

// What Bixi says on each action, matched to mood — 10 lines each so they feel
// fresh. A shuffle-bag (nextLine) cycles through all of them before any repeat.
const LINES: { happy: Record<string, string[]>; sad: Record<string, string[]> } = {
  happy: {
    feed: ['yum! more of those, please.', 'tastes like sunshine.', 'okay THAT hit the spot.', 'snack time is the best time.', 'nom nom nom 🌱', 'you always know when i’m hungry.', 'little stars! my favorite.', 'fuel for growing big.', 'mmm, thank you!', 'i could eat these all day.'],
    water: ['ahh, refreshing!', 'glug glug — perfect.', 'i can feel myself growing.', 'cool and clean, thank you.', 'my leaves are so happy.', 'just what i needed.', 'hydrated and thriving 🌿', 'a little drink, a big smile.', 'you keep me green.', 'sip sip. lovely.'],
    pet: ['hehe, that tickles!', 'right there, yes.', 'i love head pats.', 'again? okay, again!', 'warm and cozy.', 'you give the best pats.', '*happy wiggle*', 'i feel so safe with you.', 'more scritches please.', 'this is my favorite part.'],
    books: ['read me another one!', 'i love story time.', 'ooh, what happens next?', 'words are like little seeds.', 'cozy up, let’s read.', 'your voice is my favorite.', 'just one more page?', 'adventure! from the couch.', 'i learned a new word today.', 'books make me feel big.'],
    scroll: ['ooh, look at this one!', 'the little screen is fun.', 'just five more minutes 😅', 'did you see that? cute.', 'scrolling together is nice.', 'so many tiny sprouts online.', 'hehe, funny.', 'you and me and the glow.', 'one more, one more.', 'the internet is wild.'],
    shower: ['squeaky clean!', 'bubbles everywhere 🫧', 'ahh, fresh and new.', 'i love feeling clean.', 'warm water, warm heart.', 'spa day, thank you!', 'i sparkle now.', 'so refreshing.', 'clean sprout, happy sprout.', 'that was lovely.'],
    stretch: ['big stretch! feels great.', 'reaching for the sky 🌱', 'ahh, my leaves needed that.', 'limber and loose.', 'i feel taller already.', 'morning stretches, best.', 'bendy little sprout.', 'and… reach!', 'so good for me.', 'i feel wonderful.'],
    sun: ['warm sunshine, yes please.', 'photosynthesis time!', 'i’m basically solar-powered.', 'soaking it all in.', 'the light feels amazing.', 'glowing from the inside.', 'sunbathing is self-care.', 'warm and golden.', 'i love a bright day.', 'recharge complete ☀️'],
    ritual: ['you came back! best part of my day.', 'yay, our little ritual 🌱', 'i waited all day for this.', 'you always show up. i love that.', 'same time, same us.', 'hi hi hi! you’re here!', 'this is what keeps me growing.', 'another day, together.', 'i knew you’d come.', 'my favorite moment, every day.'],
  },
  sad: {
    feed: ['not really hungry… but thanks.', 'maybe just a little.', 'i’ll try to eat.', 'it doesn’t taste like much.', 'okay… for you.', 'i guess i should.', 'thank you for trying.', 'i’m not feeling it today.', 'just a bite.', 'i’ll force it down.'],
    water: ['okay… if you think it helps.', 'i’m so dry lately.', 'maybe this’ll help. maybe.', 'thank you… i think.', 'i keep wilting.', 'a little water. sure.', 'i don’t feel greener.', 'if you say so.', 'i’ll take a sip.', 'everything feels heavy.'],
    pet: ['…that actually feels nice.', 'i needed that, maybe.', 'stay a little longer?', 'thank you for being here.', 'i’m sorry i’m like this.', 'your hand is warm.', 'don’t stop yet.', 'i missed this.', 'it helps. a bit.', 'just… be here with me.'],
    books: ['the words won’t stick today.', 'read slowly, please.', 'i can’t focus… but keep going.', 'the story feels far away.', 'maybe a sad one fits.', 'your voice helps.', 'i keep re-reading the same line.', 'stay on this page a while.', 'i’m listening. barely.', 'just keep reading.'],
    scroll: ['nothing feels interesting.', 'just numb scrolling.', 'none of it lands today.', 'the glow is kind of nice.', 'i’m not really looking.', 'everyone else seems fine.', 'scroll, scroll, sigh.', 'distract me, i guess.', 'it’s all a blur.', 'at least it’s quiet.'],
    shower: ['fine… maybe it’ll help.', 'the water feels far away.', 'i’ll try to feel clean.', 'okay, if i have to.', 'maybe i’ll feel new after.', 'it’s warm, at least.', 'i’m moving slow today.', 'thank you for pushing me.', 'a little better, maybe.', 'just get it over with.'],
    stretch: ['i’m too heavy to move much.', 'everything’s so stiff.', 'i’ll try to reach.', 'my leaves feel like lead.', 'slow and small today.', 'it hurts a little.', 'okay… a tiny stretch.', 'i used to bend so easily.', 'maybe this loosens it.', 'i’m trying, i promise.'],
    sun: ['the light feels so far away.', 'i can’t feel the warmth.', 'maybe the sun will help.', 'everything looks grey.', 'i’ll sit in it. for you.', 'the glow doesn’t reach me.', 'warmth would be nice.', 'i miss feeling bright.', 'just a little light.', 'maybe tomorrow’s brighter.'],
    ritual: ['you… still came. thank you.', 'i’m glad you’re here, even now.', 'i didn’t think you would today.', 'it means a lot. really.', 'you showing up helps. a little.', 'i’m sorry i’m low. thanks for coming.', 'at least we have this.', 'you didn’t forget me.', 'i needed to see you.', 'you’re here. that’s something.'],
  },
};
// dormant: everything but feed/water is off-limits
const DORMANT_LOCKED = [
  'not right now…', 'i can’t… maybe later.', 'please… just let me rest.', 'i don’t have it in me.',
  'not today. i’m sorry.', 'too tired… feed me first?', 'i just want to sleep.', 'later… i promise.',
  'i can’t move right now.', 'please… food and water.',
];
// what he says when BOTH keepers are here at once — shown only when he's happy
const BOTH_HERE_LINES = [
  'you’re both here! best day 🌟', 'my two favorite people, together.', 'everyone’s home — i’m so happy!',
  'both of you at once? the dream.', 'this is my favorite kind of day.', 'together again — i love this.',
  'my whole world, right here.', 'you both showed up. my heart!', 'the three of us. perfect.',
  'i’ve got everyone i love here.',
];
// when a keeper hasn't shown up, EVERY action he does makes him mention missing
// them ({who} → the absent partner's name)
const MISS_LINES = [
  'i miss {who}… when are they back?', 'it’s not the same without {who}.',
  'do you think {who} is okay? i miss them.', 'tell {who} i miss them, okay?',
  'i keep waiting for {who} to come by.', 'i miss {who} being here with us.',
  'wish {who} were here for this too.', 'it’s quiet without {who} around.',
  'i saved a little wave for {who}…', 'come back soon, {who}.',
];
// when he's NOT green, "both here" skips the dance — a warmer, quieter bubble
const BOTH_HERE_SAD_LINES = [
  'you’re both here… that helps.', 'even low, you two lift me.', 'my two people. i needed this.',
  'together — maybe i’ll be okay.', 'you both came. that means a lot.', 'a little brighter with you both here.',
  'it’s easier with the two of you.', 'you’re here together. i feel it.',
];
// shuffle-bag per bucket: hands out every line once before reshuffling → feels fresh, still reuses
const _bags: Record<string, number[]> = {};
function nextLine(bucket: string, arr: string[]): string {
  if (!arr || arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  let bag = _bags[bucket];
  if (!bag || bag.length === 0) {
    bag = arr.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    _bags[bucket] = bag;
  }
  return arr[bag.pop() as number];
}

const STATE_PILL: Record<MoodState, { label: string; color: string }> = {
  thriving: { label: 'Thriving', color: LEAF },
  content: { label: 'Content', color: '#9ccf8f' },
  drifting: { label: 'Drifting', color: FEED },
  wilting: { label: 'Wilting', color: HEART },
  sad: { label: 'Missing you', color: FEED },
  dormant: { label: 'Dormant', color: DIM },
};

function Bell() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke={CREAM} strokeWidth={1.7} fill="none" strokeLinejoin="round" />
      <Path d="M10 19a2 2 0 0 0 4 0" stroke={CREAM} strokeWidth={1.7} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
function NoteIcon({ color = CREAM }: { color?: string }) {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3.5V15.5H6a2 2 0 0 1-2-2Z"
        stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M8 8.5h8M8 11.5h5" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}
/** slowly-pulsing "live" dot — a solid dot with a breathing halo. */
function PulseDot({ color = LEAF, size = 7 }: { color?: string; size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] });
  return (
    <View style={{ width: size * 2.4, height: size * 2.4, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale }], opacity }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}
const HEART_PATH =
  'M12 20.3l-1.45-1.32C5.4 14.24 2 11.16 2 7.5 2 4.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.42 22 7.5c0 3.66-3.4 6.74-8.55 11.49L12 20.3z';
/** the streak heart — outline always visible; each half fills (coral) when that
 * keeper has acted this cycle. Full = both acted → the streak ticks. */
function Heart({ size = 18, left, right, idKey }: { size?: number; left: boolean; right: boolean; idKey: string }) {
  const cid = `heartclip-${idKey}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id={cid}><Path d={HEART_PATH} /></ClipPath>
      </Defs>
      <Path d={HEART_PATH} fill="rgba(224,122,95,0.14)" stroke={HEART} strokeWidth={1.4} />
      <G clipPath={`url(#${cid})`}>
        {left && <Rect x={0} y={0} width={12} height={24} fill={HEART} />}
        {right && <Rect x={12} y={0} width={12} height={24} fill={HEART} />}
      </G>
    </Svg>
  );
}


/** streak pill — a heart + the streak number. Tap for the explainer; the heart
 * pulses when ~5h from breaking. Each half fills per parent's action this cycle. */
function StreakBadge({
  streak, atRisk, leftFill, rightFill, onPress,
}: {
  streak: number; atRisk: boolean; leftFill: boolean; rightFill: boolean; onPress: () => void;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!atRisk) { a.stopAnimation(); a.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [atRisk, a]);
  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });
  return (
    <Pressable style={styles.circleBtn} onPress={onPress} hitSlop={6}>
      {atRisk && <Animated.View style={[styles.streakGlow, { opacity }]} pointerEvents="none" />}
      <Heart size={17} left={leftFill} right={rightFill} idKey="badge" />
      <Text style={styles.streakNum}>{streak}</Text>
    </Pressable>
  );
}

/** small circular mood gauge with the % (one decimal) inside; bumps on `anim`. */
function MoodRing({ pct, color, size = 36, anim }: { pct: number; color: string; size?: number; anim?: Animated.Value }) {
  const STROKE = 3.5;
  const R = (size - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const c = size / 2;
  const scale = anim ? anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) : 1;
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={R} stroke="rgba(245,239,227,0.16)" strokeWidth={STROKE} fill="none" />
        <Circle cx={c} cy={c} r={R} stroke={color} strokeWidth={STROKE} fill="none"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - Math.max(0, Math.min(100, pct)) / 100)} strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`} />
      </Svg>
      <Text style={styles.moodRingTxt}>{pct.toFixed(1)}</Text>
    </Animated.View>
  );
}

/** slick "misses {who}" line under the mood card — plain text, full name. */
function MissBanner({ bixiName, who }: { bixiName: string; who: string }) {
  return (
    <View style={styles.missBanner}>
      <Text style={styles.missHeart}>💔</Text>
      <Text style={styles.missTxt}>
        {bixiName} misses <Text style={styles.missName}>{who}</Text>
      </Text>
    </View>
  );
}

/** homepage hint that drops in when the other keeper left an unread note. */
/** slick invite affordance — accent "+" button with a soft breathing halo. */
function InvitePlus({ onPress }: { onPress: () => void }) {
  // small + slick — a quiet accent chip, no loud pulsing halo
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.inviteBtn}>
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Path d="M12 5v14M5 12h14" stroke={ACCENT} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

function NoteHint({ who, onPress }: { who: string; onPress: () => void }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 11 }).start();
  }, [a]);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });
  return (
    <Animated.View style={{ opacity: a, transform: [{ translateY }] }}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.noteHint, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
        <Text style={styles.noteHintEmoji}>💌</Text>
        <Text style={styles.noteHintTxt} numberOfLines={1}>
          <Text style={styles.noteHintName}>{who}</Text> left you a note
        </Text>
        <Text style={styles.noteHintArrow}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

type PanelKey = 'water' | 'feed' | 'pet' | 'shower' | 'books' | 'stretch' | 'scroll' | 'sun';
type ActionDef = {
  key: PanelKey; label: string; tint: string; side: 'left' | 'right';
  metric: 'feed' | 'water' | 'bond';
  img?: number; Icon?: ComponentType<{ size?: number; color?: string }>;
};
const ACTIONS: ActionDef[] = [
  { key: 'water', label: 'Water', tint: '#63a9d6', side: 'left', metric: 'water', img: IC.water },
  { key: 'feed', label: 'Feed', tint: '#e0a94a', side: 'left', metric: 'feed', img: IC.feed },
  { key: 'books', label: 'Read', tint: READ, side: 'left', metric: 'bond', Icon: BooksIcon },
  { key: 'scroll', label: 'Scroll', tint: SCROLL, side: 'left', metric: 'bond', Icon: ScrollIcon },
  { key: 'pet', label: 'Pet', tint: '#e090b5', side: 'right', metric: 'bond', img: IC.heart },
  { key: 'shower', label: 'Shower', tint: SHOWER, side: 'right', metric: 'bond', Icon: ShowerIcon },
  { key: 'stretch', label: 'Stretch', tint: STRETCH, side: 'right', metric: 'bond', Icon: StretchIcon },
  { key: 'sun', label: 'Sun', tint: SUN, side: 'right', metric: 'bond', Icon: SunIcon },
];
function renderActionIcon(a: ActionDef, size = 24) {
  if (a.img) return <Image source={a.img} style={{ width: 26, height: 26 }} contentFit="contain" />;
  const Icon = a.Icon!;
  return <Icon color={a.tint} size={size} />;
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useBixi();
  const [now, setNow] = useState(Date.now());

  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [partnerHere, setPartnerHere] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  // invite sheet has two modes: share your code, or JOIN someone else's Bixi
  const [joinView, setJoinView] = useState<'share' | 'enter' | 'confirm'>('share');
  const [joinCode, setJoinCode] = useState('');
  const [joinPreview, setJoinPreview] = useState<InvitePreview | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [reaction, setReaction] = useState<{ key: string; at: number } | null>(null);
  const [dialog, setDialog] = useState<{ text: string; at: number } | null>(null);
  const showDialog = (text: string) => setDialog({ text, at: Date.now() });
  // reaction relay: my ritual / care / arrival also play on my partner's phone
  const reactSend = useRef<((key: string) => void) | null>(null);
  const lastArrivalAt = useRef(0);
  // the "both keepers here" celebration — fire once per ~10s across every trigger
  // (my presence, the bloom moment, and my partner's broadcast can all land at once).
  const fireArrival = () => {
    const t = Date.now();
    if (t - lastArrivalAt.current < 10000) return;
    lastArrivalAt.current = t;
    const m = deriveMoodState(useBixi.getState(), Date.now());
    if (m === 'content' || m === 'thriving') {
      setReaction({ key: 'arrival', at: t }); // green → the celebration dance + joy line
      showDialog(nextLine('happy:arrival', BOTH_HERE_LINES));
    } else {
      // not green → NO dance, just a quieter both-here bubble
      showDialog(nextLine('sad:arrival', BOTH_HERE_SAD_LINES));
    }
  };
  const onIncomingCue = (key: string) => {
    if (key === 'arrival') { fireArrival(); return; }
    setReaction({ key, at: Date.now() }); // partner's ritual / care plays here too
  };

  const mode = modeOf(s.keepers);
  const paired = mode === 'paired';
  const self = s.keepers.find((k) => k.isSelf);
  const partner = s.keepers.find((k) => !k.isSelf);
  const moodState = deriveMoodState(s, now);
  const pill = STATE_PILL[moodState];
  const isDormant = moodState === 'dormant';
  const moodPct = Math.max(0, Math.min(100, s.mood));
  const moodPulse = useRef(new Animated.Value(0)).current;
  const bumpMood = () => {
    moodPulse.setValue(0);
    Animated.sequence([
      Animated.spring(moodPulse, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }),
      Animated.timing(moodPulse, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  };
  const selfId = self?.id ?? 'self';

  const stage = STAGE_META[stageForStreak(s.streak, paired)];
  const day = s.createdAt ? Math.floor((now - s.createdAt) / (24 * HOUR)) + 1 : 1;
  const partnerName = partner?.name && partner.name !== 'Your person' ? partner.name : 'your person';
  const partnerLabel = partnerName === 'your person'
    ? 'your person'
    : partnerName.charAt(0).toUpperCase() + partnerName.slice(1);
  // "misses" is decoupled from the mood band: Bixi misses whoever hasn't shown
  // up (drifted >24h), even when the meter has cratered to dormant, and even if
  // BOTH keepers are away. On the drifted keeper's OWN phone it reads "you";
  // on the present keeper's it's the absent partner's name.
  const drifted = paired ? driftedKeepers(s, now) : [];
  const missActive = drifted.length > 0;
  const missWho = missActive && drifted.some((k) => k.isSelf) ? 'you' : partnerLabel;
  const partnerDrifted = drifted.some((k) => !k.isSelf); // the OTHER keeper is away
  // ── streak heart ──────────────────────────────────────────────────────────
  // Each keeper must act SINCE the last tick to fill their HALF of the heart; the
  // streak only ticks up when the heart is FULL (both halves) — the server
  // enforces the same. The heart stays FULL while the streak is safe, empties to
  // transparent ~5h before it would break, then gains a half per parent action.
  const cycleStart = s.lastStreakDayAt ?? 0;
  const selfContrib = self?.lastSeenAt != null && self.lastSeenAt > cycleStart;
  const partnerContrib = partner?.lastSeenAt != null && partner.lastSeenAt > cycleStart;
  const fallbackSeen = s.createdAt ?? now;
  const staleSeen = paired
    ? Math.min(self?.lastSeenAt ?? fallbackSeen, partner?.lastSeenAt ?? fallbackSeen)
    : (self?.lastSeenAt ?? fallbackSeen);
  const hoursToBreak = (staleSeen + 30 * HOUR - now) / HOUR;
  const inDanger = s.streak > 0 && hoursToBreak <= 5; // ~5h from breaking → heart opens up
  const secured = s.streak > 0 && !inDanger; // safe → heart shows full
  const heartLeft = secured || selfContrib;
  const heartRight = secured || (paired ? partnerContrib : selfContrib);
  const tagline = isDormant ? `${s.bixiName} is fading. Feed and water him.` : '';

  // live status alerts pinned to the top of the notifications panel
  const notifAlerts: NotifAlert[] = [];
  if (isDormant) notifAlerts.push({ icon: '🥀', text: `${s.bixiName} is fading. feed & water him`, tint: '#ff8a7a' });
  else if (missActive) notifAlerts.push({ icon: '💔', text: `${s.bixiName} misses ${missWho}` });
  if (inDanger) notifAlerts.push({ icon: '❤️', text: paired ? `Act now, you both need to keep the streak` : `Do any action to keep your streak alive` });
  const hasNotif = inDanger || missActive || isDormant;

  const greeting = (() => {
    const h = new Date(now).getHours();
    return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();
  const rawName = self?.name && self.name !== 'You' && self.name !== 'Your person' ? self.name : '';
  const myName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'friend';

  // per-action 60-min cooldown → minutes remaining (0 = ready). Tracked per
  // device since cooldowns are per-keeper.
  const COOLDOWN_MS = 60 * 60 * 1000;
  const lockFor = (kind: string) => {
    const t = s.actionAt?.[kind];
    return t ? Math.max(0, Math.ceil((t + COOLDOWN_MS - now) / 60000)) : 0;
  };
  const metricValue = (a: ActionDef) =>
    a.metric === 'feed' ? s.feed : a.metric === 'water' ? s.water : (self?.bond ?? 0);
  const openAction = ACTIONS.find((a) => a.key === openPanel) ?? null;
  // keep the action mounted through its close animation (openPanel clears first)
  const [panelAction, setPanelAction] = useState<ActionDef | null>(null);
  useEffect(() => {
    if (openAction) setPanelAction(openAction);
  }, [openAction]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => subscribe(), [s.pairId]);

  // live co-presence: show the names when the other parent is online + award
  // the "both here" bonus.
  useEffect(() => {
    if (!IS_ONLINE || !s.pairId || s.keepers.length < 2) { setPartnerHere(false); return; }
    const uid = useAuth.getState().userId;
    if (!uid) return;
    let asked = false;
    const ch = presenceForPair(s.pairId, uid, (n) => {
      setPartnerHere(n >= 2);
      if (n >= 2 && !asked) { asked = true; void actBothHere().catch(() => {}); }
    });
    return () => { void ch.unsubscribe(); };
  }, [s.pairId, s.keepers.length]);

  // ephemeral relay so a ritual / arrival / care triggered on one phone also
  // plays on the other. Broadcast (no DB), so it never triggers a hydrate.
  useEffect(() => {
    if (!IS_ONLINE || !s.pairId) { reactSend.current = null; return; }
    const { channel, send } = reactionChannel(s.pairId, (cue) => onIncomingCue(cue.key));
    reactSend.current = send;
    return () => { reactSend.current = null; void channel.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pairId]);

  // in-app "your person joined" the moment the pair blooms
  const prevPaired = useRef(paired);
  useEffect(() => {
    if (paired && !prevPaired.current) {
      setInviteOpen(false);
      fireArrival(); reactSend.current?.('arrival'); // both-parents clip the moment it blooms
      Alert.alert(`${s.bixiName} bloomed 🌸`, `Your person joined. You're raising ${s.bixiName} together now.`);
    }
    prevPaired.current = paired;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paired, s.bixiName]);

  // dormant: only feed & water are allowed; everything else is locked.
  const isLocked = (kind: string) => isDormant && kind !== 'feed' && kind !== 'water';
  // low mood = anything below Content (drives sad reactions + sad dialog)
  const bixiSad = moodState !== 'content' && moodState !== 'thriving';

  const tapAction = (kind: PanelKey) => {
    if (isLocked(kind)) {
      tapHaptic();
      showDialog(nextLine('dormant', DORMANT_LOCKED)); // "not right now…"
      return;
    }
    setOpenPanel((p) => (p === kind ? null : kind));
  };

  const care = (kind: PanelKey) => {
    tapHaptic();
    track('care_action', { kind });
    useBixi.getState().noteAction(kind);
    setReaction({ key: kind, at: Date.now() }); // BixiHero plays the (mood-appropriate) clip — LOCAL only
    if (partnerDrifted) {
      // a keeper is away → every action, he mentions missing them
      showDialog(nextLine('miss', MISS_LINES).replace(/\{who\}/g, partnerLabel));
    } else {
      const moodKey = bixiSad ? 'sad' : 'happy';
      const lines = LINES[moodKey][kind];
      if (lines) showDialog(nextLine(`${moodKey}:${kind}`, lines));
    }
    void Promise.resolve(actCare(kind)).then(() => {
      setNow(Date.now());
      // after the very first action, invite them to turn on notifications (once)
      const st = useBixi.getState();
      if (!st.notificationsAsked) {
        st.setNotificationsAsked();
        setTimeout(askNotifications, 1400); // let the reaction clip play first
      }
    }).catch(() => {});
  };

  const askNotifications = () => {
    Alert.alert(
      `Get reminded when ${s.bixiName} needs you`,
      `We’ll only nudge you when ${s.bixiName} needs care or starts to miss you. So you never let him down. Nothing else, ever.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Remind me 🌱', onPress: () => { void enableNotifications(s.bixiName); } },
      ]
    );
  };
  const doRevive = () => {
    tapHaptic();
    void Promise.resolve(actRevive()).then(() => setNow(Date.now())).catch(() => {});
  };

  // your person just showed up → both-parents celebration on BOTH phones
  const prevPartnerHere = useRef(partnerHere);
  useEffect(() => {
    if (partnerHere && !prevPartnerHere.current) { fireArrival(); reactSend.current?.('arrival'); }
    prevPartnerHere.current = partnerHere;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerHere]);

  // pulse the mood ring whenever mood rises — fires for BOTH parents, since a
  // remote action arrives via realtime and bumps s.mood here too.
  const prevMood = useRef(s.mood);
  useEffect(() => {
    if (s.mood > prevMood.current + 0.001) bumpMood();
    prevMood.current = s.mood;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.mood]);
  const openNotes = () => {
    tapHaptic();
    useBixi.getState().markNotesRead();
    setNoteOpen(true);
  };

  const openNotifs = () => {
    tapHaptic();
    useBixi.getState().markNotesRead();
    setNotifOpen(true);
  };

  const openStreak = () => { tapHaptic(); setStreakOpen(true); };

  const resetJoin = () => {
    setJoinView('share');
    setJoinCode('');
    setJoinPreview(null);
    setJoinErr(null);
    setJoinBusy(false);
  };
  const closeInvite = () => { setInviteOpen(false); resetJoin(); };

  // fetch (or reuse) the invite code without blocking the panel from opening
  const ensureInviteCode = async () => {
    const cached = useBixi.getState().inviteCode;
    if (cached) { setInviteCode(cached); return; }
    try {
      const code = await actInvite();
      setInviteCode(code);
      track('invite_created');
    } catch {
      setInviteCode(''); // leaves the button in "retry" state
    }
  };

  const openInvite = () => {
    tapHaptic();
    resetJoin();
    setInviteCode(useBixi.getState().inviteCode ?? ''); // show it instantly if we already have it
    setInviteOpen(true);       // open the panel NOW — no waiting on the network
    void ensureInviteCode();   // create/refresh the code in the background
  };

  // share a real tap-to-join link (the code also works if typed manually)
  const shareInvite = () => {
    const code = inviteCode || useBixi.getState().inviteCode;
    if (!code) { void ensureInviteCode(); return; }
    const link = `https://${UNIVERSAL_LINK_HOST}/join/${code}`;
    Share.share({
      message: `Come raise ${s.bixiName} with me on Bixi 🌱\n\nTap to join: ${link}\n\nor open Bixi → “Join your person” → enter code ${code}`,
      url: link,
    }).catch(() => {});
  };

  const joinErrText = (e: unknown): string => {
    const m = (e as { message?: string })?.message ?? '';
    if (m.includes('cannot_join_own_bixi')) return 'That’s your own code — share it with your person instead.';
    if (m.includes('leave_partner_first')) return 'You’re already co-parenting a Bixi. Leave that one first (You → Leave co-parent).';
    if (m.includes('invite_used')) return 'That code has already been used.';
    if (m.includes('invite_expired')) return 'That code has expired — ask for a fresh one.';
    if (m.includes('invalid_invite')) return 'We couldn’t find that code. Double-check it.';
    if (m.includes('pair_full')) return 'That Bixi already has two keepers.';
    if (m.includes('authenticated')) return 'Please sign in again to join.';
    return 'Something went wrong joining. Try again.';
  };

  const findOtherBixi = async () => {
    if (joinCode.trim().length !== 4 || joinBusy) return;
    setJoinErr(null);
    if (!IS_ONLINE) { setJoinView('confirm'); return; }
    setJoinBusy(true);
    try {
      const p = await invitePreview(joinCode.trim());
      setJoinPreview(p);
      setJoinView('confirm');
    } catch (e) {
      setJoinErr(joinErrText(e));
    } finally {
      setJoinBusy(false);
    }
  };

  const confirmJoinOther = async () => {
    successHaptic();
    setJoinErr(null);
    setJoinBusy(true);
    try {
      await actClaim(joinCode.trim()); // join_other releases your solo Bixi, then joins theirs
      track('invite_joined', { source: 'switch' });
      closeInvite();
    } catch (e) {
      setJoinErr(joinErrText(e));
      setJoinView('enter');
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <BixiHero stage={s.growthStage} mood={moodState} reaction={reaction} />

      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting} 👋</Text>
          <Pressable style={styles.nameRow} onPress={() => router.push('/you')}>
            <Text style={styles.name} numberOfLines={1}>{myName}</Text>
            <View style={styles.nameChev}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d="M7 10l5 5 5-5" stroke={CREAM} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>

          {/* mood status — ring gauge (%), "{name}'s mood" + state, and a ? for help */}
          <View style={styles.moodCard}>
            <MoodRing pct={moodPct} color={pill.color} anim={moodPulse} />
            <View style={styles.moodCardText}>
              <Text style={styles.moodTitle} numberOfLines={1}>{s.bixiName}'s mood</Text>
              <Text
                style={[styles.moodChipState, { color: missActive ? STATE_PILL.sad.color : pill.color }]}
                numberOfLines={1}
              >
                {missActive ? `Missing ${missWho}` : pill.label}
              </Text>
            </View>
            <Pressable style={styles.helpBtn} onPress={() => setGuideOpen(true)} hitSlop={8}>
              <Text style={styles.helpBtnTxt}>?</Text>
            </Pressable>
          </View>

          {missActive && <MissBanner bixiName={s.bixiName} who={missWho} />}
        </View>

        <View style={styles.headerRight}>
          <View style={styles.iconRow}>
            {!paired && <InvitePlus onPress={openInvite} />}
            <StreakBadge
              streak={s.streak} atRisk={inDanger}
              leftFill={heartLeft} rightFill={heartRight} onPress={openStreak}
            />
            <Pressable style={styles.circleBtn} onPress={openNotifs}>
              <Bell />
              {hasNotif && <View style={styles.dot} />}
            </Pressable>
          </View>
          {partnerHere && (
            <View style={styles.presenceRow}>
              <PulseDot color={LEAF} size={7} />
              <Text style={styles.presenceNames} numberOfLines={1}>{myName} & {partnerLabel}</Text>
            </View>
          )}
          {!paired && (
            <Pressable onPress={openInvite} hitSlop={6} style={styles.inviteTagChip}>
              <Text style={styles.inviteTag} numberOfLines={1}>Invite your person</Text>
              <Svg width={12} height={12} viewBox="0 0 24 24">
                <Path d="M5 12h13M12 6l6 6-6 6" stroke={ACCENT} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {/* the sticky note, pinned on the right */}
      {paired && (
        <View style={[styles.notePin, { top: insets.top + 100 }]} pointerEvents="box-none">
          <GlowNote
            pairId={s.pairId} selfId={selfId} partnerName={partnerLabel}
            open={noteOpen} onOpen={() => setNoteOpen(true)} onClose={() => setNoteOpen(false)}
          />
        </View>
      )}

      {/* action rails — split across both sides; tapping any opens ONE centered panel */}
      <View style={[styles.rail, styles.railLeft]} pointerEvents="box-none">
        {ACTIONS.filter((a) => a.side === 'left').map((a) => (
          <ActionButton
            key={a.key} iconNode={renderActionIcon(a)} label={a.label} tint={a.tint}
            value={metricValue(a)} lock={lockFor(a.key)} open={openPanel === a.key} dim={isLocked(a.key)}
            onToggle={() => tapAction(a.key)} side={a.side}
          />
        ))}
      </View>
      <View style={[styles.rail, styles.railRight]} pointerEvents="box-none">
        {ACTIONS.filter((a) => a.side === 'right').map((a) => (
          <ActionButton
            key={a.key} iconNode={renderActionIcon(a)} label={a.label} tint={a.tint}
            value={metricValue(a)} lock={lockFor(a.key)} open={openPanel === a.key} dim={isLocked(a.key)}
            onToggle={() => tapAction(a.key)} side={a.side}
          />
        ))}
      </View>

      <DialogBubble dialog={dialog} onDone={() => setDialog(null)} />

      {/* bottom overlay — mood · tagline · one contextual action · stage footer */}
      <View style={[styles.bottom, { bottom: insets.bottom + 90 }]} pointerEvents="box-none">
        {tagline ? <Text style={styles.moodTagline}>{tagline}</Text> : null}

        {/* solo → invite CTA; paired → nothing here (streak lives in the badge) */}
        {!paired ? (
          <Pressable style={({ pressed }) => [styles.ctaPill, styles.ctaInvite, pressed && { opacity: 0.85 }]} onPress={openInvite}>
            <Text style={styles.invitePillText}>＋  Invite your person</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.footerBtn} onPress={() => router.push('/growth')} hitSlop={8}>
          <Text style={styles.footer}>
            Day {String(day).padStart(3, '0')} · {stage.emoji} {stage.label}
          </Text>
          <Svg width={13} height={13} viewBox="0 0 24 24">
            <Path d="M9 6l6 6-6 6" stroke={DIM} strokeWidth={2.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>

      {panelAction && (
        <ActionPanel
          key={panelAction.key}
          action={panelAction}
          visible={openPanel === panelAction.key}
          value={metricValue(panelAction)}
          lock={lockFor(panelAction.key)}
          onAct={() => { care(panelAction.key); setOpenPanel(null); }}
          onClose={() => setOpenPanel(null)}
          onClosed={() => setPanelAction(null)}
        />
      )}

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={closeInvite}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
          <Pressable style={styles.modalScrim} onPress={closeInvite}>
            <Pressable style={styles.inviteSheet} onPress={() => {}}>
              <View style={styles.sheetHandle} />

              {joinView === 'share' ? (
                <>
                  <Text style={styles.inviteTitle}>Invite your person</Text>
                  <Text style={styles.inviteSub}>Send the link — one tap and they join. The code works too.</Text>
                  <View style={styles.codeBox}>
                    {inviteCode ? (
                      <Text style={styles.codeBig}>{inviteCode}</Text>
                    ) : (
                      <ActivityIndicator color={ACCENT} />
                    )}
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.shareBtn, pressed && { backgroundColor: '#a93f22' }]}
                    onPress={shareInvite}
                  >
                    <Text style={styles.shareTxt}>{inviteCode ? 'Share invite link' : 'Generating…'}</Text>
                  </Pressable>
                  <Text style={styles.inviteFoot}>Valid 7 days · one person, once · they’ll bloom {s.bixiName}</Text>

                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orTxt}>or</Text>
                    <View style={styles.orLine} />
                  </View>
                  <Pressable style={styles.joinOtherBtn} onPress={() => { tapHaptic(); setJoinErr(null); setJoinView('enter'); }}>
                    <Text style={styles.joinOtherTxt}>Join their Bixi instead</Text>
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Path d="M5 12h13M12 6l6 6-6 6" stroke={ACCENT} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                </>
              ) : joinView === 'enter' ? (
                <>
                  <Text style={styles.inviteTitle}>Join their Bixi</Text>
                  <Text style={styles.inviteSub}>Enter your person’s 4-letter code to join their Bixi.</Text>
                  <TextInput
                    value={joinCode}
                    onChangeText={(t) => { setJoinErr(null); setJoinCode(t.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4)); }}
                    placeholder="ABCD"
                    placeholderTextColor="rgba(245,239,227,0.28)"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    keyboardType="ascii-capable"
                    maxLength={4}
                    returnKeyType="go"
                    onSubmitEditing={findOtherBixi}
                    keyboardAppearance="dark"
                    selectionColor={ACCENT}
                    style={styles.joinInput}
                  />
                  {joinErr ? <Text style={styles.joinErr}>{joinErr}</Text> : null}
                  <Pressable
                    disabled={joinCode.trim().length !== 4 || joinBusy}
                    onPress={findOtherBixi}
                    style={({ pressed }) => [styles.shareBtn, (joinCode.trim().length !== 4 || joinBusy) && styles.btnOff, pressed && { opacity: 0.9 }]}
                  >
                    {joinBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.shareTxt}>Find their Bixi</Text>}
                  </Pressable>
                  <Pressable onPress={() => { setJoinView('share'); setJoinErr(null); }} style={styles.joinBack} hitSlop={8}>
                    <Text style={styles.joinBackTxt}>Back</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.inviteTitle}>Leave {s.bixiName} behind?</Text>
                  <Text style={styles.inviteSub}>
                    You’re about to join {joinPreview?.inviter_name ?? 'your person'}’s {joinPreview?.bixi_name ?? 'Bixi'}
                    {joinPreview ? `, cared for since Day ${String(joinPreview.day).padStart(3, '0')}` : ''}.
                  </Text>
                  <View style={styles.warnBox}>
                    <Text style={styles.warnTitle}>⚠  This can’t be undone</Text>
                    <Text style={styles.warnTxt}>
                      Joining means leaving {s.bixiName}. Everything you’ve grown — Day {String(day).padStart(3, '0')}
                      {s.streak > 0 ? ` and your ${s.streak}-day streak` : ''} — will be lost for good.
                    </Text>
                  </View>
                  {joinErr ? <Text style={styles.joinErr}>{joinErr}</Text> : null}
                  <Pressable
                    disabled={joinBusy}
                    onPress={confirmJoinOther}
                    style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.9 }]}
                  >
                    {joinBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.shareTxt}>Leave & join {joinPreview?.inviter_name ?? 'them'}</Text>}
                  </Pressable>
                  <Pressable onPress={() => { setJoinView('enter'); setJoinErr(null); }} style={styles.joinBack} hitSlop={8}>
                    <Text style={styles.joinBackTxt}>Cancel — keep {s.bixiName}</Text>
                  </Pressable>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <BixiGuide visible={guideOpen} onClose={() => setGuideOpen(false)} bixiName={s.bixiName} paired={paired} />

      <Modal visible={streakOpen} transparent animationType="slide" onRequestClose={() => setStreakOpen(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setStreakOpen(false)}>
          <Pressable style={styles.streakSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.streakSheetTitle}>How the streak works</Text>

            {paired && (
              <View style={styles.streakStatus}>
                <Heart size={26} left={heartLeft} right={heartRight} idKey="panel" />
                <Text style={styles.streakStatusTxt}>
                  {secured
                    ? 'streak secured — you’re both safe ❤️'
                    : selfContrib && partnerContrib
                    ? 'you’re both in — the streak just grew ❤️'
                    : selfContrib
                    ? `waiting on ${partnerLabel} to fill their half`
                    : partnerContrib
                    ? `${partnerLabel} is in — your half’s next`
                    : 'act now, you both need to before it breaks'}
                </Text>
              </View>
            )}

            <StreakRule icon="❤️" title="Fill the heart together" body="Each of you fills half the heart with any action — feed, water, pet, read. The streak grows the moment it's full." />
            {paired ? (
              <StreakRule
                icon="🤝"
                title="Both of you count"
                body={`It only ticks up once you and ${partnerLabel} have EACH done something. One of you can’t carry it — it stays at 0 until you both check in.`}
              />
            ) : null}
            <StreakRule icon="⏳" title="Don’t disappear" body="Go 30 hours with no action and the streak resets to 0." />

            <View style={styles.streakStatsRow}>
              <View style={styles.streakStat}><Text style={styles.streakStatNum}>{s.streak}</Text><Text style={styles.streakStatLbl}>current</Text></View>
              <View style={styles.streakStat}><Text style={styles.streakStatNum}>{s.bestStreak}</Text><Text style={styles.streakStatLbl}>best ever</Text></View>
              <View style={styles.streakStat}><Text style={styles.streakStatNum}>{s.totalCareDays}</Text><Text style={styles.streakStatLbl}>care days</Text></View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <NotifPanel
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        pairId={s.pairId}
        selfId={selfId}
        partnerLabel={partnerLabel}
        bixiName={s.bixiName}
        alerts={notifAlerts}
        onOpenNotes={openNotes}
      />
    </View>
  );
}

function ActionButton({
  iconNode, label, tint, value, lock, open, onToggle, dim, side,
}: {
  iconNode: ReactNode; label: string; tint: string; value: number; lock: number;
  open: boolean; onToggle: () => void; dim?: boolean; side: 'left' | 'right';
}) {
  const locked = lock > 0;
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  const RING = 50;
  const STROKE = 3;
  const R = (RING - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const c = RING / 2;

  return (
    <Pressable onPress={onToggle} style={({ pressed }) => [styles.actCol, dim && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <View style={styles.ringWrap}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle cx={c} cy={c} r={R} stroke="rgba(245,239,227,0.14)" strokeWidth={STROKE} fill="none" />
          <Circle
            cx={c} cy={c} r={R}
            stroke={tint} strokeWidth={STROKE} fill="none"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
            strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`}
          />
        </Svg>
        <View style={[styles.actBtn, { borderColor: tint + (open ? 'cc' : '66'), shadowColor: tint }]}>
          {iconNode}
        </View>
        {/* cooldown countdown, pinned to the button's INNER edge (toward center)
            so it's clearly readable — left rail → right of the ring, right rail
            → left of the ring. Only while on cooldown. */}
        {locked && (
          <View style={[styles.cooldownChip, side === 'right' ? { right: RING - 8 } : { left: RING - 8 }]} pointerEvents="none">
            <Svg width={9} height={9} viewBox="0 0 24 24">
              <Circle cx={12} cy={12} r={9} stroke={tint} strokeWidth={2.4} fill="none" />
              <Path d="M12 8v4.5l3 2" stroke={tint} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.cooldownChipTxt}>{lock}m</Text>
          </View>
        )}
        {!locked && (
          <View style={styles.pctBadgeRow} pointerEvents="none">
            <View style={[styles.pctBadge, { borderColor: tint + 'aa' }]}>
              <Text style={[styles.pctBadgeTxt, { color: tint }]}>{pct}%</Text>
            </View>
          </View>
        )}
      </View>
      <Text style={styles.actLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** the one shared action panel — always opens centered, springing out from the
 * side of the chosen action button. */
function ActionPanel({
  action, visible, value, lock, onAct, onClose, onClosed,
}: {
  action: ActionDef; visible: boolean; value: number; lock: number;
  onAct: () => void; onClose: () => void; onClosed: () => void;
}) {
  const locked = lock > 0;
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 9 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onClosed();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const fromX = action.side === 'left' ? -110 : 110; // emerge from the rail it lives on
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });

  return (
    <View style={styles.panelOverlay}>
      <Animated.View style={[styles.panelScrim, { opacity: anim }]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[
        styles.panelCard,
        { borderColor: action.tint + '66', opacity: anim, transform: [{ translateX }, { translateY }, { scale }] },
      ]}>
        <View style={styles.panelHead}>
          <View style={[styles.panelIcon, { borderColor: action.tint + '55', backgroundColor: action.tint + '1e' }]}>
            {renderActionIcon(action, 24)}
          </View>
          <Text style={styles.panelTitle}>{action.label}</Text>
          <Text style={[styles.panelPct, { color: action.tint }]}>{pct}%</Text>
        </View>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: action.tint }]} />
        </View>
        <Text style={styles.panelTimer}>{locked ? `Ready in ${lock}m` : 'Ready now'}</Text>
        <Pressable
          disabled={locked}
          onPress={onAct}
          style={({ pressed }) => [
            styles.panelBtn,
            { backgroundColor: locked ? 'rgba(245,239,227,0.12)' : action.tint },
            pressed && !locked && { opacity: 0.85 },
          ]}
        >
          <Text style={[styles.panelBtnTxt, locked && { color: 'rgba(245,239,227,0.5)' }]}>
            {locked ? 'On cooldown' : `${action.label} now`}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** speech bubble above Bixi — pops in, holds ~3s, fades. */
function DialogBubble({ dialog, onDone }: { dialog: { text: string; at: number } | null; onDone: () => void }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!dialog) return;
    a.setValue(0);
    Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 9 }).start();
    const t = setTimeout(() => {
      Animated.timing(a, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog?.at]);
  if (!dialog) return null;
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] });
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return (
    <Animated.View style={[styles.bubbleWrap, { opacity: a, transform: [{ translateY: ty }, { scale }] }]} pointerEvents="none">
      <View style={styles.bubble}>
        <Text style={styles.bubbleTxt}>{dialog.text}</Text>
      </View>
      <View style={styles.bubbleTail} />
    </Animated.View>
  );
}

/** one rule row inside the "how streaks work" panel. */
function StreakRule({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.streakRule}>
      <Text style={styles.streakRuleIcon}>{icon}</Text>
      <View style={styles.flex1}>
        <Text style={styles.streakRuleTitle}>{title}</Text>
        <Text style={styles.streakRuleBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  twinFlame: { flexDirection: 'row', alignItems: 'center' },
  streakSheet: {
    backgroundColor: '#221a12', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 26, paddingTop: 14, paddingBottom: 40,
    borderWidth: 1, borderColor: 'rgba(245,239,227,0.13)',
  },
  streakSheetTitle: { fontFamily: fonts.serifSemibold, fontSize: 23, color: CREAM, textAlign: 'center' },
  streakStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'center',
    marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
    backgroundColor: 'rgba(240,137,95,0.1)', borderWidth: 1, borderColor: 'rgba(240,137,95,0.3)',
  },
  streakStatusFlames: { flexDirection: 'row', gap: 2 },
  streakStatusTxt: { fontFamily: fonts.sansSemibold, fontSize: 13.5, color: CREAM, flexShrink: 1 },
  streakRule: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 18 },
  streakRuleIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  streakRuleTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: CREAM },
  streakRuleBody: { fontFamily: fonts.sans, fontSize: 13.5, color: DIM, lineHeight: 19, marginTop: 2 },
  streakStatsRow: {
    flexDirection: 'row', marginTop: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(245,239,227,0.12)',
  },
  streakStat: { flex: 1, alignItems: 'center' },
  streakStatNum: { fontFamily: fonts.serifSemibold, fontSize: 22, color: CREAM },
  streakStatLbl: { fontFamily: fonts.sans, fontSize: 11, color: DIM, marginTop: 2 },
  root: { flex: 1, backgroundColor: BG },

  bixiTapZone: { position: 'absolute', top: '20%', bottom: '34%', left: 96, right: 96 },

  bubbleWrap: { position: 'absolute', top: '25%', left: 0, right: 0, alignItems: 'center' },
  bubble: {
    maxWidth: '72%', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 18,
    backgroundColor: 'rgba(245,239,227,0.97)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  bubbleTxt: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: '#2a2016', textAlign: 'center', lineHeight: 20 },
  bubbleTail: {
    width: 14, height: 14, marginTop: -6, borderRadius: 3, transform: [{ rotate: '45deg' }],
    backgroundColor: 'rgba(245,239,227,0.97)',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  headerLeft: { flex: 1, minWidth: 0, marginRight: 12 },
  greeting: { fontFamily: fonts.sans, fontSize: 15, color: CREAM },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  name: { flexShrink: 1, fontFamily: fonts.serifSemibold, fontSize: 24, color: CREAM, letterSpacing: -0.3 },
  nameChev: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(12,8,4,0.4)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.18)',
  },
  headerRight: { alignItems: 'flex-end', marginTop: 6 },
  notePin: { position: 'absolute', right: 12 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  circleBtn: {
    minWidth: 42, height: 42, paddingHorizontal: 6, borderRadius: 21, flexDirection: 'row', gap: 3,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(12,8,4,0.42)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.18)',
  },
  streakNum: { fontFamily: fonts.sansBold, fontSize: 13, color: '#f0895f' },
  streakGlow: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 25,
    borderWidth: 1.5, borderColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
  },
  inviteBtn: {
    width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(240,137,95,0.14)', borderWidth: 1, borderColor: 'rgba(240,137,95,0.55)',
  },
  inviteTagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7,
    paddingLeft: 11, paddingRight: 8, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(240,137,95,0.13)', borderWidth: 1, borderColor: 'rgba(240,137,95,0.34)',
  },
  inviteTag: { fontFamily: fonts.sansSemibold, fontSize: 11, color: ACCENT, letterSpacing: 0.2 },
  dot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#e0673f' },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  presenceNames: {
    fontFamily: fonts.sansSemibold, fontSize: 11, color: LEAF, maxWidth: 180,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  notesBadge: {
    position: 'absolute', top: 7, right: 8, width: 9, height: 9, borderRadius: 5,
    backgroundColor: ACCENT, borderWidth: 1.5, borderColor: BG,
  },
  noteHintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  noteHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '86%',
    paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999,
    backgroundColor: 'rgba(28,19,11,0.97)', borderWidth: 1, borderColor: 'rgba(240,137,95,0.55)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  noteHintEmoji: { fontSize: 15 },
  noteHintTxt: { fontFamily: fonts.sansSemibold, fontSize: 13.5, color: CREAM, flexShrink: 1 },
  noteHintName: { fontFamily: fonts.sansBold, color: ACCENT },
  noteHintArrow: { fontFamily: fonts.sansBold, fontSize: 18, color: 'rgba(245,239,227,0.5)', marginTop: -2 },

  rail: {
    position: 'absolute',
    top: '40%',
    gap: 12,
  },
  railLeft: { left: 4 },
  railRight: { right: 4 },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actCol: { width: 62, alignItems: 'center' },
  ringWrap: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  actBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,14,8,0.5)',
    borderWidth: 1.5,
    shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  actIcon: { width: 26, height: 26 },
  cooldownChip: {
    position: 'absolute', top: 16,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 5, paddingVertical: 2.5, borderRadius: 9,
    backgroundColor: 'rgba(14,9,5,0.97)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.22)',
  },
  cooldownChipTxt: { fontFamily: fonts.mono, fontSize: 9.5, color: 'rgba(245,239,227,0.85)', letterSpacing: 0.2 },
  pctBadgeRow: { position: 'absolute', left: 0, right: 0, bottom: -4, alignItems: 'center' },
  pctBadge: {
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, borderWidth: 1,
    backgroundColor: 'rgba(16,11,6,0.96)',
  },
  pctBadgeTxt: {
    fontFamily: fonts.sansBold, fontSize: 9.5, letterSpacing: 0.2,
  },
  actLabel: {
    fontFamily: fonts.sansSemibold, fontSize: 11, color: CREAM, textAlign: 'center', marginTop: 7,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  actLabelTimer: { color: 'rgba(245,239,227,0.55)' },

  panelOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  panelScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,4,2,0.45)' },
  panelCard: {
    width: 236, padding: 16, borderRadius: 22, gap: 11,
    backgroundColor: 'rgba(24,17,10,0.98)', borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
  },
  panelIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelTitle: { flex: 1, fontFamily: fonts.sansBold, fontSize: 16, color: CREAM },
  panelPct: { fontFamily: fonts.sansBold, fontSize: 15 },
  meterTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(245,239,227,0.14)', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4 },
  panelTimer: { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(245,239,227,0.6)' },
  panelBtn: { height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  panelBtnTxt: { fontFamily: fonts.sansBold, fontSize: 14, color: '#1a120a' },

  moodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    marginTop: 10, paddingLeft: 7, paddingRight: 8, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(12,8,4,0.42)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.16)',
  },
  moodCardText: { flexShrink: 1 },
  moodTitle: { fontFamily: fonts.sansSemibold, fontSize: 11, color: 'rgba(245,239,227,0.85)', letterSpacing: 0.2 },
  moodRingTxt: { fontFamily: fonts.mono, fontSize: 10, color: CREAM },
  moodChipState: { fontFamily: fonts.sansBold, fontSize: 12.5, letterSpacing: 0.2, marginTop: 1 },
  helpBtn: {
    width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 3,
    backgroundColor: 'rgba(245,239,227,0.07)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.25)',
  },
  helpBtnTxt: { fontFamily: fonts.sansBold, fontSize: 9.5, color: 'rgba(245,239,227,0.5)', marginTop: -1 },
  missBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8,
  },
  missHeart: { fontSize: 13 },
  missTxt: {
    fontFamily: fonts.sansSemibold, fontSize: 13, color: 'rgba(245,239,227,0.72)',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  missName: { fontFamily: fonts.sansBold, color: '#ff9d86' },

  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  moodTagline: {
    fontFamily: fonts.sans, fontSize: 13, color: DIM,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  ctaPill: {
    marginTop: 6, paddingHorizontal: 22, minHeight: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  ritual: { alignItems: 'center', marginTop: 2 },
  ritualWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  ritualBtn: {
    width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,14,8,0.85)', borderWidth: 1.5, borderColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  ritualEmoji: { fontSize: 30 },
  ritualLabel: {
    fontFamily: fonts.sansBold, fontSize: 14, color: CREAM, marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  ritualSub: { fontFamily: fonts.sans, fontSize: 11, color: 'rgba(245,239,227,0.6)', marginTop: 2 },
  ctaInvite: {
    borderWidth: 1.5, borderColor: 'rgba(240,137,95,0.5)', backgroundColor: 'rgba(240,137,95,0.14)',
  },
  ctaDone: { marginTop: 6, paddingHorizontal: 18, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127,192,122,0.16)', borderWidth: 1, borderColor: 'rgba(127,192,122,0.4)' },
  ctaDoneTxt: { fontFamily: fonts.sansSemibold, fontSize: 13.5, color: LEAF },
  invitePillText: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: ACCENT },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  footer: {
    fontFamily: fonts.mono, fontSize: 11, color: 'rgba(245,239,227,0.5)', letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },

  modalScrim: { flex: 1, backgroundColor: 'rgba(8,5,3,0.6)', justifyContent: 'flex-end' },
  inviteSheet: {
    backgroundColor: '#221a12', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 26, paddingTop: 14, paddingBottom: 42, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(245,239,227,0.13)',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,239,227,0.25)', marginBottom: 18 },
  inviteTitle: { fontFamily: fonts.serifSemibold, fontSize: 23, color: CREAM },
  inviteSub: { fontFamily: fonts.sans, fontSize: 14, color: DIM, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  codeBox: {
    marginTop: 22, marginBottom: 22, paddingVertical: 18, paddingHorizontal: 30, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(240,137,95,0.5)', backgroundColor: 'rgba(240,137,95,0.1)',
  },
  codeBig: { fontFamily: fonts.mono, fontSize: 48, letterSpacing: 12, color: CREAM, marginLeft: 12 },
  shareBtn: { alignSelf: 'stretch', height: 56, borderRadius: 28, backgroundColor: '#c8502e', alignItems: 'center', justifyContent: 'center' },
  shareTxt: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff' },
  inviteFoot: { fontFamily: fonts.mono, fontSize: 11, color: DIM, marginTop: 16, letterSpacing: 0.4, textAlign: 'center' },
  flex1: { flex: 1 },
  orRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 12, marginTop: 22, marginBottom: 4 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(245,239,227,0.13)' },
  orTxt: { fontFamily: fonts.sansSemibold, fontSize: 12, color: DIM },
  joinOtherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'stretch',
    height: 52, borderRadius: 26, marginTop: 12,
    borderWidth: 1.5, borderColor: 'rgba(240,137,95,0.5)', backgroundColor: 'rgba(240,137,95,0.09)',
  },
  joinOtherTxt: { fontFamily: fonts.sansBold, fontSize: 15.5, color: ACCENT },
  joinInput: {
    alignSelf: 'stretch', marginTop: 22, marginBottom: 6, height: 74, borderRadius: 18, borderWidth: 2,
    borderColor: 'rgba(245,239,227,0.18)', backgroundColor: 'rgba(245,239,227,0.06)',
    fontFamily: fonts.mono, fontSize: 40, letterSpacing: 12, textAlign: 'center', paddingLeft: 12, color: CREAM,
  },
  joinErr: { fontFamily: fonts.sans, fontSize: 13.5, color: '#ff8a7a', marginTop: 6, marginBottom: 6, textAlign: 'center' },
  btnOff: { backgroundColor: 'rgba(245,239,227,0.14)' },
  joinBack: { alignSelf: 'center', paddingVertical: 14 },
  joinBackTxt: { fontFamily: fonts.sansSemibold, fontSize: 14, color: DIM },
  warnBox: {
    alignSelf: 'stretch', marginTop: 20, marginBottom: 4, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,138,122,0.4)', backgroundColor: 'rgba(255,138,122,0.09)',
  },
  warnTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: '#ff8a7a', marginBottom: 6 },
  warnTxt: { fontFamily: fonts.sans, fontSize: 14, color: '#f3d9cf', lineHeight: 20 },
  dangerBtn: {
    alignSelf: 'stretch', height: 56, borderRadius: 28, marginTop: 16, backgroundColor: '#b23b2a',
    alignItems: 'center', justifyContent: 'center',
  },
});
