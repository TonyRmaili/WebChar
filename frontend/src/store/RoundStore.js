import { create } from "zustand";

/* The combat round counter shown in the party bar.

   It belongs to the table session, not to any character, so it lives in
   this browser's localStorage (key "party.round") instead of character
   data: it survives a page reload, and Reset puts it back to 1. Any
   component can read it with useRoundStore((s) => s.round). */

const KEY = "party.round";
export const MIN_ROUND = 1;

const read = () => {
  try {
    const n = parseInt(localStorage.getItem(KEY), 10);
    return Number.isFinite(n) && n >= MIN_ROUND ? n : MIN_ROUND;
  } catch {
    return MIN_ROUND;
  }
};

const write = (n) => {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* storage blocked — the counter still works until reload */
  }
};

const useRoundStore = create((set, get) => ({
  round: read(),

  setRound: (n) => {
    const next = Math.max(MIN_ROUND, Math.floor(Number(n) || MIN_ROUND));
    write(next);
    set({ round: next });
  },
  nextRound: () => get().setRound(get().round + 1),
  prevRound: () => get().setRound(get().round - 1),
  resetRound: () => get().setRound(MIN_ROUND),
}));

export default useRoundStore;