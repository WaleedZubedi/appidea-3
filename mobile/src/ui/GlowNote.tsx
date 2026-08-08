/**
 * GlowNote — a small glowing sticky note on Home. It shows the note your partner
 * left for you (if any, within the last 6h) and taps open a tiny composer to
 * write one back. One note per keeper every 6 hours (server-enforced), capped to
 * a short length, and it disappears 6 hours after it was written.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/theme';
import { useBixi } from '@/game/store';
import { addNote, fetchNotes, subscribeToNotes, type Note } from '@/lib/api';
import { track } from '@/lib/analytics';

const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const LINE = 'rgba(245,239,227,0.14)';
const ACCENT = '#f0895f';

// Note paper colours. `paper` is the sticky background; `from`/`body` are the
// darker inks that read on that paper. The stored note.color is the paper hex.
const NOTE_COLORS = [
  { key: 'green', paper: '#c9e8a3', from: '#4d7a2b', body: '#2f4a1c' },
  { key: 'purple', paper: '#d9c7f0', from: '#6a3fa0', body: '#3d2366' },
  { key: 'pink', paper: '#f5c6d6', from: '#b0416a', body: '#6e2740' },
  { key: 'blue', paper: '#bcdcf2', from: '#35688f', body: '#1f3f5c' },
  { key: 'amber', paper: '#f5d8a8', from: '#a56a1e', body: '#6b4310' },
];
const DEFAULT_NOTE_COLOR = NOTE_COLORS[0];
const paletteFor = (color: string | null) =>
  NOTE_COLORS.find((c) => c.paper.toLowerCase() === (color ?? '').toLowerCase()) ?? DEFAULT_NOTE_COLOR;

const NOTE_TTL_MS = 24 * 60 * 60 * 1000; // a note stays for 24h (or until a newer one replaces it)
const NOTE_COOLDOWN_MS = 2 * 60 * 60 * 1000; // one note per keeper every 2h
const MAX_LEN = 100;

function countdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
function ago(iso: string, now: number): string {
  const m = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function GlowNote({
  pairId, selfId, partnerName = 'your person', open, onOpen, onClose,
}: {
  pairId: string | null; selfId: string; partnerName?: string;
  open: boolean; onOpen: () => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const notesReadAt = useBixi((st) => st.notesReadAt);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [color, setColor] = useState(DEFAULT_NOTE_COLOR.paper);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pairId) { setNotes([]); return; }
    let alive = true;
    const load = () => { fetchNotes(pairId).then((n) => { if (alive) setNotes(n); }).catch(() => {}); };
    load();
    const ch = subscribeToNotes(pairId, load);
    return () => { alive = false; void ch.unsubscribe(); };
  }, [pairId]);

  // live ticking so the TTL / cooldown countdowns stay honest
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // the partner's still-alive note (within the last 6h), unless it's been reported
  const partnerNote = useMemo(
    () => notes.find((n) => n.author_id !== selfId && !reported.has(n.id) && now - new Date(n.created_at).getTime() < NOTE_TTL_MS) ?? null,
    [notes, selfId, now, reported]
  );

  // Report an objectionable note (Apple UGC 1.2): log it, then hide it. Since a
  // note is 1:1 between two paired people, reporting also offers to unpair.
  const reportNote = (note: Note) => {
    Alert.alert(
      'Report this note?',
      'It will be hidden and flagged for review. You can also mute or leave your co-parent in the You tab.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            track('note_reported', { note_id: note.id });
            setReported((s) => new Set(s).add(note.id));
            onClose();
          },
        },
      ]
    );
  };
  const unread = !!partnerNote && new Date(partnerNote.created_at).getTime() > (notesReadAt ?? 0);

  // my last note → 6h send cooldown
  const myLastAt = useMemo(
    () => notes.reduce((mx, n) => (n.author_id === selfId ? Math.max(mx, new Date(n.created_at).getTime()) : mx), 0),
    [notes, selfId]
  );
  const unlockAt = myLastAt ? myLastAt + NOTE_COOLDOWN_MS : 0;
  const locked = now < unlockAt;
  const remaining = Math.max(0, unlockAt - now);

  // a soft, always-on breathing outline — brighter when a note is waiting
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: unread ? [0.4, 0.85] : [0.15, 0.45] });

  const openIt = () => { useBixi.getState().markNotesRead(); onOpen(); };

  const send = async () => {
    const body = text.trim();
    if (!body || busy || !pairId || locked) return;
    setBusy(true); setSendErr(null);
    try {
      await addNote(pairId, body, color);
      track('note_sent', { color });
      setText('');
      const n = await fetchNotes(pairId);
      setNotes(n);
    } catch (e) {
      const m = (e as { message?: string })?.message ?? '';
      setSendErr(m.includes('note_cooldown')
        ? 'One note every 2 hours, hang tight.'
        : 'Couldn’t send that. Check your connection.');
    }
    setBusy(false);
  };

  if (!pairId) return null;

  return (
    <>
      {/* a small tilted sticky note pinned on Home — soft glow invites a note */}
      <Pressable onPress={openIt} style={styles.noteWrap} hitSlop={8}>
        <Animated.View style={[styles.noteGlow, { opacity: glowOpacity }]} pointerEvents="none" />
        <View style={[styles.sticky, partnerNote && { backgroundColor: paletteFor(partnerNote.color).paper }]}>
          {partnerNote ? (
            <>
              <Text style={[styles.stickyFrom, { color: paletteFor(partnerNote.color).from }]} numberOfLines={1}>from {partnerName}</Text>
              <Text style={[styles.stickyBody, { color: paletteFor(partnerNote.color).body }]} numberOfLines={3}>{partnerNote.body}</Text>
            </>
          ) : (
            <Text style={styles.stickyPlaceholder} numberOfLines={2}>leave a note…</Text>
          )}
          <View style={styles.stickyCurl} pointerEvents="none" />
        </View>
      </Pressable>

      {/* the composer */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.scrim} onPress={onClose}>
            <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]} onPress={() => {}}>
              <View style={styles.grip} />
              <Text style={styles.title}>A note for {partnerName}</Text>
              <Text style={styles.seenHint}>Only {partnerName} sees this — it shows up on their home 💛</Text>

              {partnerNote && (
                <View style={[styles.readCard, { backgroundColor: paletteFor(partnerNote.color).paper }]}>
                  <Text style={[styles.readFrom, { color: paletteFor(partnerNote.color).from }]}>{partnerName} · {ago(partnerNote.created_at, now)}</Text>
                  <Text style={[styles.readBody, { color: paletteFor(partnerNote.color).body }]}>{partnerNote.body}</Text>
                  <Pressable onPress={() => reportNote(partnerNote)} hitSlop={8} style={styles.report}>
                    <Text style={[styles.reportTxt, { color: paletteFor(partnerNote.color).from }]}>Report</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.swatchRow}>
                {NOTE_COLORS.map((c) => {
                  const on = c.paper === color;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => setColor(c.paper)}
                      hitSlop={8}
                      style={[styles.swatch, { backgroundColor: c.paper }, on && styles.swatchOn]}
                    >
                      {on && <View style={styles.swatchDot} />}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.inputWrap}>
                <TextInput
                  value={text}
                  onChangeText={(t) => { setSendErr(null); setText(t.slice(0, MAX_LEN)); }}
                  editable={!locked}
                  placeholder={locked ? `Come back in ${countdown(remaining)}…` : `Something sweet, short and sweet…`}
                  placeholderTextColor="rgba(245,239,227,0.38)"
                  style={[styles.input, { borderColor: color }, locked && { opacity: 0.5 }]}
                  multiline
                  maxLength={MAX_LEN}
                />
                <Text style={styles.counter}>{text.length}/{MAX_LEN}</Text>
              </View>

              {sendErr ? (
                <Text style={styles.err}>{sendErr}</Text>
              ) : (
                <Text style={styles.rules}>
                  {locked ? `🔒 One note every 2 hours · next in ${countdown(remaining)}` : '💌 One note every 2 hours · it stays for 24 hours'}
                </Text>
              )}

              <Pressable
                onPress={send}
                disabled={!text.trim() || busy || locked}
                style={({ pressed }) => [styles.sendBtn, (!text.trim() || busy || locked) && styles.sendOff, pressed && { opacity: 0.9 }]}
              >
                {busy ? <ActivityIndicator color="#1a120a" /> : <Text style={styles.sendTxt}>Send it</Text>}
              </Pressable>
              <Pressable onPress={onClose} style={styles.cancel} hitSlop={8}>
                <Text style={styles.cancelTxt}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  noteWrap: { alignSelf: 'flex-end', transform: [{ rotate: '3deg' }] },
  noteGlow: {
    position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: 6, borderWidth: 1.5, borderColor: '#a8ec8e',
    shadowColor: '#7fc07a', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  sticky: {
    minWidth: 92, maxWidth: 150, minHeight: 56,
    paddingHorizontal: 11, paddingTop: 8, paddingBottom: 12, borderRadius: 3,
    backgroundColor: '#c9e8a3',
    shadowColor: '#1c2e0e', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 1, height: 3 },
    elevation: 4,
  },
  stickyFrom: {
    fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 0.6,
    textTransform: 'uppercase', color: '#4d7a2b', marginBottom: 2,
  },
  stickyBody: { fontFamily: fonts.sans, fontSize: 12.5, color: '#2f4a1c', lineHeight: 16.5 },
  stickyPlaceholder: { fontFamily: fonts.sans, fontSize: 12.5, color: '#57813a', fontStyle: 'italic' },
  stickyCurl: {
    position: 'absolute', right: 0, bottom: 0, width: 0, height: 0,
    borderBottomWidth: 14, borderBottomColor: 'rgba(30,55,15,0.16)',
    borderLeftWidth: 14, borderLeftColor: 'transparent',
  },

  fill: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(6,4,2,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1c130b', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 22, paddingTop: 12, borderWidth: 1, borderColor: LINE,
  },
  grip: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,239,227,0.25)', marginBottom: 14 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 21, color: CREAM },
  seenHint: { fontFamily: fonts.sans, fontSize: 12.5, color: DIM, marginTop: 4, lineHeight: 18 },

  readCard: {
    marginTop: 14, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(245,239,227,0.06)', borderWidth: 1, borderColor: LINE,
  },
  readFrom: { fontFamily: fonts.sansBold, fontSize: 11, color: ACCENT, marginBottom: 4 },
  readBody: { fontFamily: fonts.sans, fontSize: 15, color: CREAM, lineHeight: 21 },
  report: { alignSelf: 'flex-end', marginTop: 8, paddingVertical: 2 },
  reportTxt: { fontFamily: fonts.sansSemibold, fontSize: 11.5, color: DIM, textDecorationLine: 'underline' },

  swatchRow: { flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'center' },
  swatch: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchOn: { borderColor: CREAM, transform: [{ scale: 1.12 }] },
  swatchDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(20,12,6,0.55)' },

  inputWrap: { marginTop: 14 },
  input: {
    minHeight: 64, maxHeight: 130, borderRadius: 16, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    backgroundColor: 'rgba(245,239,227,0.06)', borderWidth: 1, borderColor: LINE,
    fontFamily: fonts.sans, fontSize: 15.5, color: CREAM,
  },
  counter: { alignSelf: 'flex-end', fontFamily: fonts.mono, fontSize: 11, color: DIM, marginTop: 5 },
  err: { fontFamily: fonts.sansBold, fontSize: 12, color: '#ff8a7a', marginTop: 8, textAlign: 'center' },
  rules: { fontFamily: fonts.sansSemibold, fontSize: 11.5, color: DIM, marginTop: 8, textAlign: 'center' },

  sendBtn: { height: 52, borderRadius: 26, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  sendOff: { backgroundColor: 'rgba(245,239,227,0.14)' },
  sendTxt: { fontFamily: fonts.sansBold, fontSize: 16, color: '#1a120a' },
  cancel: { alignSelf: 'center', paddingVertical: 12 },
  cancelTxt: { fontFamily: fonts.sansSemibold, fontSize: 14, color: DIM },
});
