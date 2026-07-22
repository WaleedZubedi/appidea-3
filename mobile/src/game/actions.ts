/**
 * Action facade the screens call. Branches ONLINE (server RPCs via sync.ts) vs OFFLINE
 * (local Zustand sim). When IS_ONLINE is false this is a thin pass-through to the store,
 * so the offline demo behaves exactly as before.
 */
import { IS_ONLINE } from '@/lib/config';

import { useBixi } from './store';
import * as sync from './sync';
import type { Mode, RelationshipKind } from './types';

export async function actHatch(mode: Mode, name: string, kind: RelationshipKind) {
  if (IS_ONLINE) {
    await sync.onlineHatch(mode === 'paired', name, kind ?? null);
    return;
  }
  const s = useBixi.getState();
  s.createBixi(mode, name, kind);
  s.hatch();
}

export async function actCare(key: string) {
  if (IS_ONLINE) return sync.onlineCare(key);
  useBixi.getState().doInteraction(key);
}

export async function actDaily() {
  if (IS_ONLINE) return sync.onlineDaily();
  useBixi.getState().doDaily();
}

export async function actRevive() {
  if (IS_ONLINE) return sync.onlineRevive();
  useBixi.getState().revive('self');
}

export async function actInvite(): Promise<string> {
  if (IS_ONLINE) return sync.onlineInvite();
  return useBixi.getState().generateInvite();
}

export async function actClaim(token: string) {
  if (IS_ONLINE) return sync.onlineClaim(token);
  const s = useBixi.getState();
  s.createBixi('paired', 'Bixi', 'couple');
  s.hatch();
  s.acceptCoParent('Maya');
}

export async function actSetBixiName(name: string) {
  if (IS_ONLINE) return sync.onlineSetBixiName(name);
  useBixi.getState().setBixiName(name);
}

export async function actLeave() {
  if (IS_ONLINE) return sync.onlineLeave();
  useBixi.setState((st) => ({
    keepers: st.keepers.filter((k) => k.isSelf),
    bloomedAt: null,
  }));
}

/** "both here now" live moment (online only — the offline demo has its own toggle). */
export async function actBothHere() {
  if (IS_ONLINE) return sync.onlineBothHere();
}

/** 24h cooling-off leave. Returns the ISO time the leave becomes final (online). */
export async function actRequestLeave(): Promise<string | null> {
  if (IS_ONLINE) return sync.onlineRequestLeave();
  await actLeave(); // offline demo: immediate
  return null;
}

export async function actUndoLeave() {
  if (IS_ONLINE) return sync.onlineUndoLeave();
}

export async function actSetPartnerMute(muted: boolean) {
  if (IS_ONLINE) return sync.onlineSetMute(muted);
}

export async function actHydrate() {
  // app-open / post-auth: settle decay ONCE (recompute) then pull. Realtime
  // updates after this use the pure hydrate() so they can't loop.
  if (IS_ONLINE) await sync.settle();
}
