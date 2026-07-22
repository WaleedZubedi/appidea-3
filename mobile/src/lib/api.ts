/**
 * Bixi server API — wraps the SECURITY-scoped RPCs + queries (supabase/migrations).
 * Only used in ONLINE mode. Returns plain data; the store maps it into UI state.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';

import { requireSupabase } from './supabase';

export interface ServerBixiState {
  pair_id: string;
  mood: number;
  feed: number;
  water: number;
  vitals_updated_at: string;
  growth_stage: string;
  streak: number;
  best_streak: number;
  total_care_days: number;
  ever_reached_100: boolean;
  dormant: boolean;
  revive_pending: string[];
  has_companion: boolean;
  unlocked_secrets: string[];
  mood_updated_at: string;
  last_streak_day_at: string | null;
  last_both_here_at: string | null;
  updated_at: string;
}

export interface ServerMember {
  pair_id: string;
  profile_id: string;
  role: string;
  bond: number;
  last_daily_at: string | null;
  last_seen_at: string | null;
  last_feed_at: string | null;
  last_water_at: string | null;
  last_pet_at: string | null;
  leave_requested_at: string | null;
  muted: boolean;
}

export interface InvitePreview {
  inviter_name: string;
  bixi_name: string;
  relationship_kind: string | null;
  day: number;
  expires_at: string;
}

export interface PairBundle {
  pairId: string;
  bixiName: string;
  bixiNameChangedAt: string | null;
  relationshipKind: string | null;
  hatchedAt: string | null;
  bloomedAt: string | null;
  state: ServerBixiState;
  members: (ServerMember & { display_name: string | null })[];
}

export async function getMyPairId(): Promise<string | null> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data } = await sb
    .from('pair_members')
    .select('pair_id')
    .eq('profile_id', uid)
    .maybeSingle();
  return data?.pair_id ?? null;
}

export async function getPairBundle(pairId: string): Promise<PairBundle | null> {
  const sb = requireSupabase();
  const [{ data: pair }, { data: state }, { data: members }] = await Promise.all([
    sb.from('pairs').select('*').eq('id', pairId).single(),
    sb.from('bixi_state').select('*').eq('pair_id', pairId).single(),
    sb
      .from('pair_members')
      .select('pair_id, profile_id, role, bond, last_daily_at, last_seen_at, last_feed_at, last_water_at, last_pet_at, leave_requested_at, muted, profiles(display_name)')
      .eq('pair_id', pairId),
  ]);
  if (!pair || !state) return null;
  return {
    pairId,
    bixiName: pair.bixi_name,
    bixiNameChangedAt: pair.bixi_name_changed_at ?? null,
    relationshipKind: pair.relationship_kind,
    hatchedAt: pair.hatched_at,
    bloomedAt: pair.bloomed_at,
    state: state as ServerBixiState,
    members: (members ?? []).map((m: any) => ({
      ...m,
      display_name: m.profiles?.display_name ?? null,
    })),
  };
}

export async function createBixi(
  name: string,
  kind: string | null,
  paired: boolean
): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('create_bixi', {
    p_name: name,
    p_kind: kind,
    p_paired: paired,
  });
  if (error) throw error;
  return data as string;
}

export async function createInvite(
  pairId: string
): Promise<{ token: string; code: string; expires_at: string }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('create_invite', { p_pair: pairId });
  if (error) throw error;
  return data as { token: string; code: string; expires_at: string };
}

export async function claimInvite(token: string): Promise<string> {
  const sb = requireSupabase();
  // join_other handles both the fresh-joiner case AND switching from your own
  // solo Bixi to someone else's (releases the solo one first).
  const { data, error } = await sb.rpc('join_other', { p_token: token });
  if (error) throw error;
  return data as string;
}

/** resolve a code/token to the real inviter + Bixi (no claim). */
export async function invitePreview(token: string): Promise<InvitePreview> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('invite_preview', { p_token: token });
  if (error) throw error;
  return data as InvitePreview;
}

/** server-side decay/dormancy/streak sweep for my pair (safe to call on app open). */
export async function recomputePair(pairId: string): Promise<void> {
  const sb = requireSupabase();
  await sb.rpc('recompute_pair', { p_pair: pairId });
}

/** "both here now" live moment — server enforces once per 20h. */
export async function bothHere(pairId: string): Promise<ServerBixiState> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('both_here', { p_pair: pairId });
  if (error) throw error;
  return data as ServerBixiState;
}

/** 24h cooling-off leave. Returns the ISO time the leave becomes final. */
export async function requestLeave(pairId: string): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('request_leave', { p_pair: pairId });
  if (error) throw error;
  return data as string;
}

export async function undoLeave(pairId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('undo_leave', { p_pair: pairId });
  if (error) throw error;
}

/** immediate safety mute of the partner (independent of the leave timer). */
export async function setPartnerMute(pairId: string, muted: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('set_partner_mute', { p_pair: pairId, p_muted: muted });
  if (error) throw error;
}

export async function applyCare(
  pairId: string,
  kind: string,
  isDaily: boolean,
  clientActionId: string,
  note?: string
): Promise<ServerBixiState> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('apply_care', {
    p_pair: pairId,
    p_kind: kind,
    p_is_daily: isDaily,
    p_client_action_id: clientActionId,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data as ServerBixiState;
}

export async function revive(pairId: string): Promise<ServerBixiState> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('revive', { p_pair: pairId });
  if (error) throw error;
  return data as ServerBixiState;
}

/** dev/admin-only: patch shared pair state on the server (drives realtime → both parents). */
export interface DevPatch {
  feed?: number;
  water?: number;
  bond?: number;
  streak?: number;
  growth?: string;
  dormant?: boolean;
  daily?: 'done' | 'undone';
  clearCooldowns?: boolean;
  advanceMs?: number;
}
export async function devSetState(pairId: string, p: DevPatch): Promise<ServerBixiState> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('dev_set_state', {
    p_pair: pairId,
    p_feed: p.feed ?? null,
    p_water: p.water ?? null,
    p_bond: p.bond ?? null,
    p_streak: p.streak ?? null,
    p_growth: p.growth ?? null,
    p_dormant: p.dormant ?? null,
    p_daily: p.daily ?? null,
    p_clear_cooldowns: p.clearCooldowns ?? null,
    p_advance_ms: p.advanceMs ?? null,
  });
  if (error) throw error;
  return data as ServerBixiState;
}

export async function leavePair(pairId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('leave_pair', { p_pair: pairId });
  if (error) throw error;
}

export async function setPushToken(token: string): Promise<void> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  await sb.from('profiles').update({ push_token: token }).eq('id', auth.user.id);
}

export async function fetchJournal(pairId: string) {
  const sb = requireSupabase();
  const [{ data: events }, { data: miles }] = await Promise.all([
    sb.from('care_events').select('*').eq('pair_id', pairId).order('created_at', { ascending: false }).limit(100),
    sb.from('milestones').select('*').eq('pair_id', pairId).order('created_at', { ascending: false }).limit(50),
  ]);
  return { events: events ?? [], milestones: miles ?? [] };
}

/** live updates for the pair's Bixi state + presence */
/* ── sticky notes (experimental) ── */
export interface Note {
  id: string;
  author_id: string;
  body: string;
  color: string | null;
  created_at: string;
}
export async function fetchNotes(pairId: string): Promise<Note[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('notes')
    .select('id,author_id,body,color,created_at')
    .eq('pair_id', pairId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Note[];
}
/** rename the shared Bixi (server enforces once / 30 days). Throws 'rename_too_soon'. */
export async function setBixiName(pairId: string, name: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('set_bixi_name', { p_pair: pairId, p_name: name });
  if (error) throw error;
}

export async function addNote(pairId: string, body: string, color: string): Promise<void> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('not signed in');
  const { error } = await sb.from('notes').insert({ pair_id: pairId, author_id: auth.user.id, body, color });
  if (error) throw error;
}
export async function deleteNote(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('notes').delete().eq('id', id);
  if (error) throw error;
}
let _noteChannelSeq = 0;
export function subscribeToNotes(pairId: string, onChange: () => void): RealtimeChannel {
  const sb = requireSupabase();
  // unique topic per subscriber — Home and the panel both watch notes, and two
  // channels with the same name collide ("cannot add postgres_changes callback
  // after subscribe()").
  return sb
    .channel(`notes:${pairId}:${++_noteChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `pair_id=eq.${pairId}` }, onChange)
    .subscribe();
}

let _pairChannelSeq = 0;
export function subscribeToPair(pairId: string, onChange: () => void): RealtimeChannel {
  const sb = requireSupabase();
  // unique topic per subscriber (Home sync + Journal both watch the pair) so
  // two channels never collide on the same name.
  return sb
    .channel(`pair:${pairId}:${++_pairChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bixi_state', filter: `pair_id=eq.${pairId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pair_members', filter: `pair_id=eq.${pairId}` }, onChange)
    .subscribe();
}

/** presence channel for the "both here now" moment — reports how many keepers are live. */
export function presenceForPair(
  pairId: string,
  uid: string,
  onCount: (n: number) => void
): RealtimeChannel {
  const sb = requireSupabase();
  const ch = sb.channel(`online:${pairId}`, { config: { presence: { key: uid } } });
  ch.on('presence', { event: 'sync' }, () => {
    onCount(Object.keys(ch.presenceState()).length);
  }).subscribe((status) => {
    if (status === 'SUBSCRIBED') void ch.track({ at: Date.now() });
  });
  return ch;
}
