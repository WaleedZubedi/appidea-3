import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Share, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fonts } from '@/theme';
import { modeOf } from '@/game/engine';
import { useBixi } from '@/game/store';
import {
  actInvite,
  actRequestLeave,
  actSetBixiName,
  actSetPartnerMute,
  actUndoLeave,
} from '@/game/actions';
import { IS_ONLINE } from '@/lib/config';
import { setPushToken } from '@/lib/api';
import { registerForPush } from '@/lib/push';
import { useAuth } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.55)';
const FAINT = 'rgba(245,239,227,0.35)';
const LINE = 'rgba(245,239,227,0.1)';
const CARD = 'rgba(245,239,227,0.05)';
const ACCENT = '#f0895f';
const BRICK = '#ff8a7a';
const PINE = '#7fc07a';

const DAY = 24 * 60 * 60 * 1000;
const RENAME_COOLDOWN = 30 * DAY;

function Chevron() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path d="M9 6l6 6-6 6" stroke={FAINT} strokeWidth={2.1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={styles.eyebrow}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  label, value, sub, onPress, right, danger, chevron,
}: {
  label: string; value?: string; sub?: string; onPress?: () => void;
  right?: React.ReactNode; danger?: boolean; chevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? { backgroundColor: 'rgba(245,239,227,0.04)' } : null]}
    >
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, danger && { color: BRICK }]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {right ?? (value ? <Text style={styles.rowValue}>{value}</Text> : null)}
        {chevron && onPress ? <Chevron /> : null}
      </View>
    </Pressable>
  );
}

export default function You() {
  const router = useRouter();
  const s = useBixi();
  const paired = modeOf(s.keepers) === 'paired';
  const partner = s.keepers.find((k) => !k.isSelf);
  const self = s.keepers.find((k) => k.isSelf);
  const [notif, setNotif] = useState(s.notificationsAsked);
  const [busy, setBusy] = useState(false);

  // rename Bixi — once every 30 days
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(s.bixiName);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameErr, setRenameErr] = useState<string | null>(null);
  const nextRenameAt = s.bixiNameChangedAt ? s.bixiNameChangedAt + RENAME_COOLDOWN : 0;
  const canRename = Date.now() >= nextRenameAt;
  const renameDaysLeft = Math.max(1, Math.ceil((nextRenameAt - Date.now()) / DAY));

  const leavePendingAt = self?.leaveRequestedAt ?? null;
  const leaveHoursLeft = leavePendingAt
    ? Math.max(0, Math.ceil((leavePendingAt + DAY - Date.now()) / (60 * 60 * 1000)))
    : null;

  const openRename = () => {
    if (!canRename) return;
    setNameInput(s.bixiName);
    setRenameErr(null);
    setRenameOpen(true);
  };

  const saveRename = async () => {
    const clean = nameInput.trim().slice(0, 20);
    if (!clean || clean === s.bixiName) { setRenameOpen(false); return; }
    setRenameBusy(true);
    setRenameErr(null);
    try {
      await actSetBixiName(clean);
      setRenameOpen(false);
    } catch (e) {
      const m = (e as { message?: string })?.message ?? '';
      setRenameErr(m.includes('rename_too_soon')
        ? 'Bixi can only be renamed once a month.'
        : 'Couldn’t rename Bixi. Check your connection and try again.');
    } finally {
      setRenameBusy(false);
    }
  };

  const invite = async () => {
    const code = await actInvite();
    Share.share({ message: `Come raise ${s.bixiName} with me on Bixi 🌱 — code ${code}` }).catch(() => {});
  };

  const leave = () => {
    Alert.alert(
      'Leave co-parent?',
      `Bixi stays with ${partner?.name ?? 'your person'} as a solo unit — his history is kept. This starts a 24-hour cooling-off (you can undo until then). Earned stages and the companion are never taken away.`,
      [
        { text: 'Keep together', style: 'cancel' },
        { text: 'Start leaving', style: 'destructive', onPress: () => void actRequestLeave() },
      ]
    );
  };

  const undoLeave = () => void actUndoLeave();
  const toggleMute = (v: boolean) => void actSetPartnerMute(v);

  const deleteAccount = () => {
    Alert.alert(
      'Delete account & data?',
      paired
        ? `This permanently deletes your account. ${s.bixiName} stays with ${partner?.name ?? 'your person'} as a solo unit — their data is never touched. This cannot be undone.`
        : `This permanently deletes your account, ${s.bixiName}, and all history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              if (IS_ONLINE && supabase) {
                const { error } = await supabase.functions.invoke('delete-account');
                if (error) throw error;
                await useAuth.getState().signOut();
              }
              s.reset();
              router.replace('/onboarding/intro');
            } catch {
              Alert.alert('Couldn’t delete', 'Check your connection and try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const toggleNotif = async (v: boolean) => {
    setNotif(v);
    if (!v) return;
    s.setNotificationsAsked();
    if (IS_ONLINE) {
      const token = await registerForPush();
      if (token) await setPushToken(token);
    }
  };

  const resetApp = () => {
    Alert.alert('Reset app?', 'Wipes this Bixi and returns to onboarding (demo only).', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          if (IS_ONLINE) void useAuth.getState().signOut();
          s.reset();
          router.replace('/onboarding/intro');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrowTop}>YOUR FIELD STATION</Text>
        <Text style={styles.display}>You + {paired ? 'them' : s.bixiName}</Text>

        <Section title="Bixi">
          <Row
            label="Bixi’s name"
            value={s.bixiName}
            sub={canRename ? 'Tap to rename · once a month' : `Renameable again in ${renameDaysLeft}d`}
            onPress={canRename ? openRename : undefined}
            chevron={canRename}
          />
        </Section>

        <Section title={paired ? 'Your co-parent' : 'Invite'}>
          {paired ? (
            <>
              <Row label="Co-parent" value={partner?.name ?? 'Your person'} />
              <View style={styles.sep} />
              <Row
                label="Mute partner"
                right={<Switch value={self?.muted ?? false} onValueChange={toggleMute} trackColor={{ true: ACCENT, false: 'rgba(245,239,227,0.15)' }} />}
              />
              <View style={styles.sep} />
              {leavePendingAt ? (
                <Row label={`Leaving in ~${leaveHoursLeft}h — tap to undo`} onPress={undoLeave} chevron />
              ) : (
                <Row label="Leave co-parent" onPress={leave} danger />
              )}
            </>
          ) : (
            <>
              <Row label="＋ Invite your person" value="tap to share" onPress={invite} chevron />
              <View style={styles.sep} />
              <Row label="Join a different Bixi" value="have a code?" onPress={() => router.push('/onboarding/join')} chevron />
            </>
          )}
        </Section>

        <Section title="Notifications">
          <Row
            label="Remind me if Bixi’s lonely"
            right={<Switch value={notif} onValueChange={toggleNotif} trackColor={{ true: PINE, false: 'rgba(245,239,227,0.15)' }} />}
          />
        </Section>

        <Section title="Account">
          <Row
            label="Sign out"
            onPress={async () => {
              await useAuth.getState().signOut();
              s.reset();
              router.replace('/onboarding/intro');
            }}
            chevron
          />
        </Section>

        <Section title="Privacy & data">
          <Row label="Export my data" value="coming soon" />
          <View style={styles.sep} />
          <Row label={busy ? 'Deleting…' : 'Delete account & data'} danger onPress={busy ? undefined : deleteAccount} />
        </Section>

        {!IS_ONLINE && (
          <Section title="Dev · simulate (demo)">
            <Row
              label="Partner is here"
              right={
                <Switch
                  value={partner ? Date.now() - (partner.lastSeenAt ?? 0) < DAY : false}
                  disabled={!paired}
                  onValueChange={(v) => s.setPartnerPresence(v)}
                  trackColor={{ true: PINE, false: 'rgba(245,239,227,0.15)' }}
                />
              }
            />
            <View style={styles.sep} />
            <Row label="Simulate partner returns / revives" onPress={() => s.simulatePartnerReturn()} value="tap" />
            {!paired && <View style={styles.sep} />}
            {!paired && <Row label="Simulate co-parent joins (bloom)" onPress={() => s.acceptCoParent('Maya')} value="tap" />}
            <View style={styles.sep} />
            <Row label="Reset app" danger onPress={resetApp} />
          </Section>
        )}

        <Text style={styles.version}>Bixi v0.1</Text>
      </ScrollView>

      {/* rename Bixi */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalFill}>
          <Pressable style={styles.modalScrim} onPress={() => setRenameOpen(false)}>
            <Pressable style={styles.renameCard} onPress={() => {}}>
              <Text style={styles.renameTitle}>Rename Bixi</Text>
              <Text style={styles.renameSub}>You can only do this once a month, so choose with care. Both of you will see the new name.</Text>
              <TextInput
                value={nameInput}
                onChangeText={(t) => { setRenameErr(null); setNameInput(t.slice(0, 20)); }}
                placeholder="Bixi"
                placeholderTextColor={FAINT}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={saveRename}
                selectionColor={ACCENT}
                style={styles.renameInput}
              />
              {renameErr ? <Text style={styles.renameErr}>{renameErr}</Text> : null}
              <Pressable
                onPress={saveRename}
                disabled={renameBusy || !nameInput.trim()}
                style={({ pressed }) => [styles.renameSave, (renameBusy || !nameInput.trim()) && styles.renameSaveOff, pressed && { opacity: 0.9 }]}
              >
                {renameBusy ? <ActivityIndicator color="#241206" /> : <Text style={styles.renameSaveTxt}>Save name</Text>}
              </Pressable>
              <Pressable onPress={() => setRenameOpen(false)} style={styles.renameCancel} hitSlop={8}>
                <Text style={styles.renameCancelTxt}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  eyebrowTop: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.6, color: ACCENT, marginTop: 8 },
  display: { fontFamily: fonts.serifSemibold, fontSize: 30, color: CREAM, marginTop: 6 },

  eyebrow: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.2, color: DIM, marginBottom: 9, marginLeft: 2 },
  card: { borderRadius: 18, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, minHeight: 56 },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowLabel: { fontFamily: fonts.sansSemibold, fontSize: 15.5, color: CREAM },
  rowSub: { fontFamily: fonts.sans, fontSize: 12.5, color: FAINT, marginTop: 3 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontFamily: fonts.sans, fontSize: 14.5, color: DIM, maxWidth: 170, textAlign: 'right' },
  sep: { height: 1, backgroundColor: LINE, marginLeft: 16 },

  version: { fontFamily: fonts.mono, fontSize: 11, color: FAINT, textAlign: 'center', marginTop: 28, letterSpacing: 0.5 },

  modalFill: { flex: 1 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(6,4,2,0.66)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  renameCard: {
    alignSelf: 'stretch', backgroundColor: '#241a12', borderRadius: 24, padding: 22,
    borderWidth: 1, borderColor: LINE,
  },
  renameTitle: { fontFamily: fonts.serifSemibold, fontSize: 22, color: CREAM },
  renameSub: { fontFamily: fonts.sans, fontSize: 13.5, color: DIM, marginTop: 6, lineHeight: 20 },
  renameInput: {
    marginTop: 18, height: 60, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(245,239,227,0.18)',
    backgroundColor: 'rgba(245,239,227,0.06)', fontFamily: fonts.serifSemibold, fontSize: 22,
    textAlign: 'center', color: CREAM,
  },
  renameErr: { fontFamily: fonts.sans, fontSize: 13.5, color: BRICK, marginTop: 12, textAlign: 'center' },
  renameSave: { height: 54, borderRadius: 27, marginTop: 18, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  renameSaveOff: { backgroundColor: 'rgba(245,239,227,0.14)' },
  renameSaveTxt: { fontFamily: fonts.sansBold, fontSize: 16, color: '#241206' },
  renameCancel: { alignSelf: 'center', paddingVertical: 14 },
  renameCancelTxt: { fontFamily: fonts.sansSemibold, fontSize: 14.5, color: DIM },
});
