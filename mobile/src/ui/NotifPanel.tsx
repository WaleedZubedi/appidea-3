/**
 * A small notifications popover that drops from the header bell. Merges the
 * things that would normally ping your (and your partner's) phone: your
 * person's recent notes, their recent care actions, shared milestones, and
 * live status alerts (Bixi fading / misses you / today's ritual waiting).
 * Pair-scoped + realtime while open.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/theme';
import { IS_ONLINE } from '@/lib/config';
import { fetchJournal, fetchNotes, subscribeToNotes, subscribeToPair } from '@/lib/api';

const CARD_BG = '#241a12';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const FAINT = 'rgba(245,239,227,0.4)';
const LINE = 'rgba(245,239,227,0.12)';
const ACCENT = '#f0895f';

export type Alert = { icon: string; text: string; tint?: string };
type Notif = { id: string; ts: number; icon: string; text: string; tint?: string; note?: boolean };

const CARE: Record<string, { emoji: string; verb: string }> = {
  water: { emoji: '💧', verb: 'watered' },
  feed: { emoji: '🍽️', verb: 'fed' },
  pet: { emoji: '🫶', verb: 'petted' },
  shower: { emoji: '🚿', verb: 'showered' },
  books: { emoji: '📖', verb: 'read to' },
  stretch: { emoji: '🧘', verb: 'stretched with' },
  scroll: { emoji: '📱', verb: 'scrolled with' },
  sun: { emoji: '☀️', verb: 'sunbathed with' },
};
const MILE: Record<string, { glyph: string; title: (d: string | null) => string }> = {
  bloom: { glyph: '🌸', title: () => 'Bloomed — a second keeper joined' },
  growth: { glyph: '🌿', title: (d) => `Grew into a ${d ?? 'new stage'}` },
  revive: { glyph: '↺', title: () => 'Woke from dormancy' },
};

function ago(ms: number): string {
  const d = Date.now() - ms;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotifPanel({
  visible, onClose, pairId, selfId, partnerLabel, bixiName, alerts, onOpenNotes,
}: {
  visible: boolean;
  onClose: () => void;
  pairId: string | null;
  selfId: string;
  partnerLabel: string;
  bixiName: string;
  alerts: Alert[];
  onOpenNotes: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState<Notif[]>([]);
  const maxH = Math.round(Dimensions.get('window').height * 0.6);

  useEffect(() => {
    if (!visible || !pairId || !IS_ONLINE) return;
    let alive = true;
    const load = async () => {
      try {
        const [notes, journal] = await Promise.all([fetchNotes(pairId), fetchJournal(pairId)]);
        if (!alive) return;
        const out: Notif[] = [];
        // partner's recent notes
        for (const n of notes) {
          if (n.author_id === selfId) continue;
          out.push({
            id: `note:${n.id}`, ts: new Date(n.created_at).getTime(), icon: '💌', note: true,
            text: `${partnerLabel}: “${n.body.length > 42 ? n.body.slice(0, 42) + '…' : n.body}”`,
          });
        }
        // partner's recent care actions
        for (const e of journal.events as any[]) {
          if (e.profile_id === selfId) continue;
          const ts = new Date(e.created_at).getTime();
          if (e.is_daily) {
            out.push({ id: `ev:${e.id}`, ts, icon: '✨', text: `${partnerLabel} did the daily ritual` });
          } else {
            const c = CARE[e.kind];
            if (c) out.push({ id: `ev:${e.id}`, ts, icon: c.emoji, text: `${partnerLabel} ${c.verb} ${bixiName}` });
          }
        }
        // shared milestones
        for (const mi of journal.milestones as any[]) {
          const meta = MILE[mi.kind];
          if (meta) out.push({ id: `mi:${mi.id}`, ts: new Date(mi.created_at).getTime(), icon: meta.glyph, text: meta.title(mi.detail ?? null), tint: ACCENT });
        }
        out.sort((a, b) => b.ts - a.ts);
        setFeed(out.slice(0, 12));
      } catch { /* keep last feed */ }
    };
    void load();
    const chP = subscribeToPair(pairId, () => void load());
    const chN = subscribeToNotes(pairId, () => void load());
    return () => { alive = false; void chP.unsubscribe(); void chN.unsubscribe(); };
  }, [visible, pairId, selfId, partnerLabel, bixiName]);

  const empty = alerts.length === 0 && feed.length === 0;
  const top = insets.top + 52;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.panel, { top, maxHeight: maxH }]} onPress={() => {}}>
          <View style={styles.arrow} />
          <View style={styles.head}>
            <Text style={styles.title}>Notifications</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {empty ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔔</Text>
                <Text style={styles.emptyTxt}>You’re all caught up.</Text>
              </View>
            ) : (
              <>
                {alerts.map((a, i) => (
                  <View key={`al:${i}`} style={styles.row}>
                    <Text style={styles.icon}>{a.icon}</Text>
                    <Text style={[styles.rowTxt, a.tint && { color: a.tint }]} numberOfLines={2}>{a.text}</Text>
                  </View>
                ))}
                {feed.map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={n.note ? () => { onClose(); onOpenNotes(); } : undefined}
                    style={({ pressed }) => [styles.row, pressed && n.note ? { backgroundColor: 'rgba(245,239,227,0.05)' } : null]}
                  >
                    <Text style={styles.icon}>{n.icon}</Text>
                    <Text style={[styles.rowTxt, n.tint && { color: n.tint }]} numberOfLines={2}>{n.text}</Text>
                    <Text style={styles.time}>{ago(n.ts)}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  panel: {
    position: 'absolute', right: 14, width: Math.min(320, Dimensions.get('window').width - 28),
    backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: LINE, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  arrow: {
    position: 'absolute', top: -7, right: 22, width: 14, height: 14, backgroundColor: CARD_BG,
    borderLeftWidth: 1, borderTopWidth: 1, borderColor: LINE, transform: [{ rotate: '45deg' }],
  },
  head: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: LINE },
  title: { fontFamily: fonts.serifSemibold, fontSize: 17, color: CREAM },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 11 },
  icon: { fontSize: 16, width: 20, textAlign: 'center' },
  rowTxt: { flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: CREAM, lineHeight: 18 },
  time: { fontFamily: fonts.mono, fontSize: 10.5, color: FAINT },

  empty: { alignItems: 'center', paddingVertical: 34, gap: 8 },
  emptyEmoji: { fontSize: 30 },
  emptyTxt: { fontFamily: fonts.sans, fontSize: 14, color: DIM },
});
