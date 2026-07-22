/**
 * Notes — a warm little back-and-forth between the two keepers. Pair-scoped,
 * realtime. Leave a note or reply to one; the homepage shows an unread hint to
 * whoever's waiting. (Table: public.notes, migration 0020.)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/theme';
import { addNote, fetchNotes, subscribeToNotes, type Note } from '@/lib/api';

const BG = '#1c130b';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const LINE = 'rgba(245,239,227,0.14)';
const ACCENT = '#f0895f';

const NOTE_COOLDOWN_MS = 6 * 60 * 60 * 1000; // one note per keeper every 6 hours

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** countdown label: "5h 23m" far out, "4m 12s" in the last hour. */
function countdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function StickyNotes({
  visible, onClose, pairId, selfId, partnerName = 'your person',
}: {
  visible: boolean; onClose: () => void; pairId: string | null; selfId: string; partnerName?: string;
}) {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const scRef = useRef<ScrollView>(null);

  // fetchNotes returns newest-first; a chat reads oldest-first
  const thread = useMemo(() => [...notes].reverse(), [notes]);

  // 6-hour rate limit: locked until 6h after MY most recent note
  const myLastAt = useMemo(
    () => notes.reduce((mx, n) => (n.author_id === selfId ? Math.max(mx, new Date(n.created_at).getTime()) : mx), 0),
    [notes, selfId]
  );
  const unlockAt = myLastAt ? myLastAt + NOTE_COOLDOWN_MS : 0;
  const locked = now < unlockAt;
  const remaining = Math.max(0, unlockAt - now);

  // tick every second while open so the countdown stays live
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    if (!visible || !pairId) return;
    let alive = true;
    const load = () => { fetchNotes(pairId).then((n) => { if (alive) setNotes(n); }).catch(() => {}); };
    load();
    const ch = subscribeToNotes(pairId, load);
    return () => { alive = false; void ch.unsubscribe(); };
  }, [visible, pairId]);

  const toBottom = () => requestAnimationFrame(() => scRef.current?.scrollToEnd({ animated: true }));

  const send = async () => {
    const body = text.trim();
    if (!body || busy || !pairId || locked) return;
    setBusy(true);
    try {
      await addNote(pairId, body, ACCENT);
      setText('');
      const n = await fetchNotes(pairId);
      setNotes(n);
      toBottom();
    } catch {
      /* ignore while testing */
    }
    setBusy(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.scrim}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12, height: '82%' }]}>
            <View style={styles.grip} />
            <View style={styles.headRow}>
              <View>
                <Text style={styles.title}>Notes</Text>
                <Text style={styles.sub}>between you & {partnerName}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                <Text style={styles.closeTxt}>Done</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={scRef}
              style={styles.thread}
              contentContainerStyle={styles.threadContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scRef.current?.scrollToEnd({ animated: false })}
            >
              {thread.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>💌</Text>
                  <Text style={styles.emptyTxt}>No notes yet.{'\n'}Leave the first one for {partnerName}.</Text>
                </View>
              ) : (
                thread.map((n, i) => {
                  const mine = n.author_id === selfId;
                  const prev = thread[i - 1];
                  const showName = !mine && (!prev || prev.author_id !== n.author_id);
                  return (
                    <View key={n.id} style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                      {showName && <Text style={styles.who}>{partnerName}</Text>}
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        <Text style={[styles.bubbleTxt, mine ? styles.txtMine : styles.txtTheirs]}>{n.body}</Text>
                      </View>
                      <Text style={styles.meta}>{ago(n.created_at)}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.hintRow}>
              {locked ? (
                <Text style={styles.hintLocked}>🔒  One note every 6 hours · next in {countdown(remaining)}</Text>
              ) : (
                <Text style={styles.hint}>💌  One note every 6 hours — make it count.</Text>
              )}
            </View>

            <View style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={setText}
                editable={!locked}
                placeholder={locked ? `Come back in ${countdown(remaining)}…` : `Leave ${partnerName} a note…`}
                placeholderTextColor="rgba(245,239,227,0.4)"
                style={[styles.input, locked && styles.inputLocked]}
                multiline
                maxLength={500}
                onFocus={toBottom}
              />
              <Pressable
                onPress={send}
                disabled={!text.trim() || busy || locked}
                style={({ pressed }) => [styles.sendBtn, (!text.trim() || busy || locked) && styles.sendOff, pressed && { opacity: 0.85 }]}
              >
                {busy ? <ActivityIndicator color="#1a120a" /> : <Text style={styles.sendTxt}>Send</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(6,4,2,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BG, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 18, paddingTop: 10, borderWidth: 1, borderColor: LINE,
  },
  grip: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,239,227,0.25)', marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 21, color: CREAM },
  sub: { fontFamily: fonts.sans, fontSize: 12.5, color: DIM, marginTop: 1 },
  closeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(245,239,227,0.1)', borderWidth: 1, borderColor: LINE },
  closeTxt: { fontFamily: fonts.sansSemibold, fontSize: 13, color: CREAM },

  thread: { flex: 1 },
  threadContent: { paddingVertical: 10, gap: 4 },
  empty: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyTxt: { fontFamily: fonts.sans, fontSize: 14.5, color: DIM, textAlign: 'center', lineHeight: 22 },

  row: { maxWidth: '82%', marginVertical: 3 },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  who: { fontFamily: fonts.sansBold, fontSize: 11, color: ACCENT, marginBottom: 3, marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine: { backgroundColor: ACCENT, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: 'rgba(245,239,227,0.08)', borderWidth: 1, borderColor: LINE, borderBottomLeftRadius: 6 },
  bubbleTxt: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  txtMine: { color: '#241206' },
  txtTheirs: { color: CREAM },
  meta: { fontFamily: fonts.mono, fontSize: 9.5, color: 'rgba(245,239,227,0.4)', marginTop: 3, marginHorizontal: 4 },

  hintRow: { paddingTop: 8, paddingBottom: 2, alignItems: 'center' },
  hint: { fontFamily: fonts.sansSemibold, fontSize: 11.5, color: DIM, letterSpacing: 0.2 },
  hintLocked: { fontFamily: fonts.sansBold, fontSize: 11.5, color: ACCENT, letterSpacing: 0.2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: LINE },
  inputLocked: { opacity: 0.5 },
  input: {
    flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    backgroundColor: 'rgba(245,239,227,0.06)', borderWidth: 1, borderColor: LINE,
    fontFamily: fonts.sans, fontSize: 15, color: CREAM,
  },
  sendBtn: { height: 46, paddingHorizontal: 20, borderRadius: 23, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: 'rgba(245,239,227,0.14)' },
  sendTxt: { fontFamily: fonts.sansBold, fontSize: 15, color: '#1a120a' },
});
