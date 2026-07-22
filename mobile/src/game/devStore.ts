/**
 * TEMPORARY dev-only overrides (not persisted, not part of the game state).
 * Lets the admin panel force UI states that normally require a live 2nd device,
 * e.g. the "both keepers here" presence lighting. Remove before shipping.
 */
import { create } from 'zustand';

interface DevState {
  /** force the two-people presence icon to show both keepers live */
  bothHere: boolean;
  setBothHere: (v: boolean) => void;
}

export const useDev = create<DevState>((set) => ({
  bothHere: false,
  setBothHere: (v) => set({ bothHere: v }),
}));
