import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { fonts } from '@/theme';
import { HOUR, STAGE_META, deriveMoodState, driftedKeepers, modeOf, nextMilestone, stageForStreak } from '@/game/engine';
import { useBixi } from '@/game/store';
import { BixiGuide } from '@/ui/BixiGuide';
import { NotifPanel, type Alert as NotifAlert } from '@/ui/NotifPanel';
import { StickyNotes } from '@/ui/StickyNotes';
import { actBothHere, actCare, actClaim, actDaily, actInvite, actRevive } from '@/game/actions';
import { subscribe } from '@/game/sync';
import { fetchNotes, invitePreview, presenceForPair, subscribeToNotes, type InvitePreview, type Note } from '@/lib/api';
import { IS_ONLINE } from '@/lib/config';
import { useAuth } from '@/lib/session';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import type { MoodState } from '@/game/types';
import { IC, ShowerIcon, BooksIcon, StretchIcon, ScrollIcon, SunIcon } from '@/ui/actionIcon';

const HERO = require('../../../assets/images/home-hero.png');
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
function Flame({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.4c3.7 3.3 5.7 6 5.7 9.7a5.7 5.7 0 0 1-11.4 0c0-2 1-3.7 2.4-5.2.2 1.5 1.2 2.2 2.1 1.8 1-.4 1-2 .1-3.8-.6-1.2.1-2.6 1.1-2.5Z"
        fill="#f0895f"
      />
      <Path
        d="M12 12.4c1.8 1.6 2.7 3 2.7 4.4a2.7 2.7 0 0 1-5.4 0c0-1.4.9-2.8 2.7-4.4Z"
        fill="#ffcf7a"
      />
    </Svg>
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
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.inviteWrap}>
      <Animated.View style={[styles.inviteHalo, { transform: [{ scale }], opacity }]} />
      <View style={styles.inviteBtn}>
        <Svg width={17} height={17} viewBox="0 0 24 24">
          <Path d="M12 5v14M5 12h14" stroke={BG} strokeWidth={2.8} strokeLinecap="round" />
        </Svg>
      </View>
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
function renderActionIcon(a: ActionDef, size = 28) {
  if (a.img) return <Image source={a.img} style={{ width: 30, height: 30 }} contentFit="contain" />;
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [latestNote, setLatestNote] = useState<Note | null>(null);

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
  const lastDaily = s.usedThisCycle[selfId]?.['__daily__'] ?? null;
  const dailyDone = lastDaily != null && now - lastDaily < 24 * HOUR;
  // streak-at-risk: streak alive, ritual not done yet → hours until the 24h window closes
  const streakHoursLeft =
    s.streak > 0 && !dailyDone && lastDaily != null
      ? Math.max(0, Math.ceil((lastDaily + 24 * HOUR - now) / HOUR))
      : null;

  const stage = STAGE_META[stageForStreak(s.streak, paired)];
  const next = nextMilestone(s.streak);
  const daysToNext = next ? next.streak - s.streak : 0;
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
  const unreadNote =
    !!latestNote && latestNote.author_id !== selfId &&
    new Date(latestNote.created_at).getTime() > (s.notesReadAt ?? 0);

  const tagline = isDormant ? `${s.bixiName} is fading. Feed and water him.` : '';

  // live status alerts pinned to the top of the notifications panel
  const notifAlerts: NotifAlert[] = [];
  if (isDormant) notifAlerts.push({ icon: '🥀', text: `${s.bixiName} is fading — feed & water him`, tint: '#ff8a7a' });
  else if (missActive) notifAlerts.push({ icon: '💔', text: `${s.bixiName} misses ${missWho}` });
  if (!dailyDone) notifAlerts.push({ icon: '✨', text: `Today's ritual is waiting` });
  const hasNotif = !dailyDone || unreadNote || missActive || isDormant;

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
      if (n >= 2 && !asked) { asked = true; void actBothHere(); }
    });
    return () => { void ch.unsubscribe(); };
  }, [s.pairId, s.keepers.length]);

  // watch the shared notes so the homepage knows about an unread one
  useEffect(() => {
    if (!IS_ONLINE || !paired || !s.pairId) { setLatestNote(null); return; }
    const pid = s.pairId;
    let alive = true;
    const load = () => { fetchNotes(pid).then((ns) => { if (alive) setLatestNote(ns[0] ?? null); }).catch(() => {}); };
    load();
    const ch = subscribeToNotes(pid, () => load());
    return () => { alive = false; void ch.unsubscribe(); };
  }, [s.pairId, paired]);

  // in-app "your person joined" the moment the pair blooms
  const prevPaired = useRef(paired);
  useEffect(() => {
    if (paired && !prevPaired.current) {
      setInviteOpen(false);
      Alert.alert(`${s.bixiName} bloomed 🌸`, `Your person joined — you're raising ${s.bixiName} together now.`);
    }
    prevPaired.current = paired;
  }, [paired, s.bixiName]);

  const care = (kind: PanelKey) => {
    tapHaptic();
    useBixi.getState().noteAction(kind);
    void Promise.resolve(actCare(kind)).then(() => setNow(Date.now()));
  };
  const doDaily = () => {
    tapHaptic();
    void Promise.resolve(actDaily()).then(() => setNow(Date.now()));
  };
  const doRevive = () => {
    tapHaptic();
    void Promise.resolve(actRevive()).then(() => setNow(Date.now()));
  };

  // pulse the mood ring whenever mood rises — fires for BOTH parents, since a
  // remote action arrives via realtime and bumps s.mood here too.
  const prevMood = useRef(s.mood);
  useEffect(() => {
    if (s.mood > prevMood.current + 0.001) bumpMood();
    prevMood.current = s.mood;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.mood]);
  // tapping Bixi himself: do today's ritual (dormancy now recovers by feeding)
  const onTapBixi = () => {
    if (!dailyDone) return doDaily();
  };

  const openNotes = () => {
    tapHaptic();
    useBixi.getState().markNotesRead();
    setNotesOpen(true);
  };

  const openNotifs = () => {
    tapHaptic();
    useBixi.getState().markNotesRead();
    setNotifOpen(true);
  };

  const resetJoin = () => {
    setJoinView('share');
    setJoinCode('');
    setJoinPreview(null);
    setJoinErr(null);
    setJoinBusy(false);
  };
  const closeInvite = () => { setInviteOpen(false); resetJoin(); };

  const openInvite = async () => {
    tapHaptic();
    resetJoin();
    try {
      const code = await actInvite();
      setInviteCode(code);
      setInviteOpen(true);
    } catch {
      Alert.alert('Couldn’t create an invite', 'Check your connection and try again.');
    }
  };

  const joinErrText = (e: unknown): string => {
    const m = (e as { message?: string })?.message ?? '';
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
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
      {/* tap Bixi to do today's ritual (or revive when dormant) — kept clear of the side rails */}
      <Pressable style={styles.bixiTapZone} onPress={onTapBixi} />

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
            <View style={styles.circleBtn}>
              <Flame size={15} />
              <Text style={styles.streakNum}>{s.streak}</Text>
            </View>
            <Pressable style={styles.circleBtn} onPress={openNotifs}>
              <Bell />
              {hasNotif && <View style={styles.dot} />}
            </Pressable>
            {paired && (
              <Pressable style={styles.circleBtn} onPress={openNotes}>
                <NoteIcon color={unreadNote ? ACCENT : CREAM} />
                {unreadNote && <View style={styles.notesBadge} />}
              </Pressable>
            )}
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

      {/* action rails — split across both sides; tapping any opens ONE centered panel */}
      <View style={[styles.rail, styles.railLeft]} pointerEvents="box-none">
        {ACTIONS.filter((a) => a.side === 'left').map((a) => (
          <ActionButton
            key={a.key} iconNode={renderActionIcon(a)} label={a.label} tint={a.tint}
            value={metricValue(a)} lock={lockFor(a.key)} open={openPanel === a.key}
            onToggle={() => setOpenPanel((p) => (p === a.key ? null : a.key))}
          />
        ))}
      </View>
      <View style={[styles.rail, styles.railRight]} pointerEvents="box-none">
        {ACTIONS.filter((a) => a.side === 'right').map((a) => (
          <ActionButton
            key={a.key} iconNode={renderActionIcon(a)} label={a.label} tint={a.tint}
            value={metricValue(a)} lock={lockFor(a.key)} open={openPanel === a.key}
            onToggle={() => setOpenPanel((p) => (p === a.key ? null : a.key))}
          />
        ))}
      </View>

      {/* bottom overlay — mood · tagline · one contextual action · stage footer */}
      <View style={[styles.bottom, { bottom: insets.bottom + 90 }]} pointerEvents="box-none">
        {tagline ? <Text style={styles.moodTagline}>{tagline}</Text> : null}

        {/* a single primary action, chosen by state (never more than one) */}
        {!dailyDone ? (
          <RitualButton onPress={doDaily} streakHoursLeft={streakHoursLeft} />
        ) : !paired ? (
          <Pressable style={({ pressed }) => [styles.ctaPill, styles.ctaInvite, pressed && { opacity: 0.85 }]} onPress={openInvite}>
            <Text style={styles.invitePillText}>＋  Invite your person</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.footerBtn} onPress={() => router.push('/growth')} hitSlop={8}>
          <Text style={styles.footer}>
            Day {String(day).padStart(3, '0')} · {stage.emoji} {stage.label}
            {next ? ` · ${daysToNext}d to ${STAGE_META[next.stage].label}` : ''}
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
                  <Text style={styles.inviteSub}>Share this code — they enter it under “Join your person.”</Text>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeBig}>{inviteCode}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.shareBtn, pressed && { backgroundColor: '#a93f22' }]}
                    onPress={() => Share.share({ message: `Come raise ${s.bixiName} with me on Bixi 🌱 — my code is ${inviteCode}` }).catch(() => {})}
                  >
                    <Text style={styles.shareTxt}>Share code</Text>
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

      {unreadNote && !notesOpen && (
        <View style={[styles.noteHintWrap, { top: insets.top + 52 }]} pointerEvents="box-none">
          <NoteHint who={partnerLabel} onPress={openNotes} />
        </View>
      )}

      <StickyNotes
        visible={notesOpen}
        onClose={() => { setNotesOpen(false); useBixi.getState().markNotesRead(); }}
        pairId={s.pairId}
        selfId={selfId}
        partnerName={partnerLabel}
      />

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
  iconNode, label, tint, value, lock, open, onToggle,
}: {
  iconNode: ReactNode; label: string; tint: string; value: number; lock: number;
  open: boolean; onToggle: () => void;
}) {
  const locked = lock > 0;
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  const RING = 60;
  const STROKE = 3.5;
  const R = (RING - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const c = RING / 2;

  return (
    <Pressable onPress={onToggle} style={({ pressed }) => [styles.actCol, pressed && { transform: [{ scale: 0.94 }] }]}>
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
        <View style={styles.pctBadgeRow} pointerEvents="none">
          <View style={[styles.pctBadge, { borderColor: tint + 'aa' }]}>
            <Text style={[styles.pctBadgeTxt, { color: tint }]}>{pct}%</Text>
          </View>
        </View>
      </View>
      <Text style={styles.actLabel} numberOfLines={1}>
        {label}{locked ? <Text style={styles.actLabelTimer}> · {lock}m</Text> : null}
      </Text>
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

/** the daily ritual — an enlarged, centered action-button-style primary CTA. */
function RitualButton({ onPress, streakHoursLeft }: { onPress: () => void; streakHoursLeft: number | null }) {
  const RING = 80;
  const STROKE = 4;
  const R = (RING - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const c = RING / 2;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ritual, pressed && { transform: [{ scale: 0.96 }] }]}>
      <View style={styles.ritualWrap}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle cx={c} cy={c} r={R} stroke="rgba(245,239,227,0.14)" strokeWidth={STROKE} fill="none" />
          <Circle cx={c} cy={c} r={R} stroke={ACCENT} strokeWidth={STROKE} fill="none"
            strokeDasharray={CIRC} strokeDashoffset={0} strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`} />
        </Svg>
        <View style={styles.ritualBtn}>
          <Text style={styles.ritualEmoji}>✨</Text>
        </View>
      </View>
      <Text style={styles.ritualLabel}>Today's ritual</Text>
      {streakHoursLeft != null && <Text style={styles.ritualSub}>streak resets in {streakHoursLeft}h</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  bixiTapZone: { position: 'absolute', top: '20%', bottom: '34%', left: 96, right: 96 },

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
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  circleBtn: {
    minWidth: 42, height: 42, paddingHorizontal: 6, borderRadius: 21, flexDirection: 'row', gap: 3,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(12,8,4,0.42)', borderWidth: 1, borderColor: 'rgba(245,239,227,0.18)',
  },
  streakNum: { fontFamily: fonts.sansBold, fontSize: 13, color: '#f0895f' },
  inviteWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  inviteHalo: {
    position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: ACCENT,
  },
  inviteBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: ACCENT, borderWidth: 1, borderColor: '#ffb488',
    shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: 9, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
    top: '39%',
    gap: 14,
  },
  railLeft: { left: 16 },
  railRight: { right: 16 },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actCol: { width: 78, alignItems: 'center' },
  ringWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  actBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,14,8,0.5)',
    borderWidth: 1.5,
    shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  actIcon: { width: 30, height: 30 },
  pctBadgeRow: { position: 'absolute', left: 0, right: 0, bottom: -5, alignItems: 'center' },
  pctBadge: {
    paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 9, borderWidth: 1,
    backgroundColor: 'rgba(16,11,6,0.96)',
  },
  pctBadgeTxt: {
    fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 0.2,
  },
  actLabel: {
    fontFamily: fonts.sansSemibold, fontSize: 11.5, color: CREAM, textAlign: 'center', marginTop: 10,
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
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 2,
    backgroundColor: 'rgba(240,137,95,0.16)', borderWidth: 1, borderColor: 'rgba(240,137,95,0.42)',
  },
  helpBtnTxt: { fontFamily: fonts.sansBold, fontSize: 12, color: ACCENT, marginTop: -1 },
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
