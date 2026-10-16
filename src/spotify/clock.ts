// Rekenwerk voor de afspeelpositie tussen twee metingen van Spotify in.

export interface Anchor {
  positionMs: number;
  /** performance.now() op het moment dat positionMs gold. */
  at: number;
  paused: boolean;
  durationMs: number;
}

export function predictPosition(a: Anchor, now: number): number {
  const pos = a.paused ? a.positionMs : a.positionMs + (now - a.at);
  return Math.min(Math.max(pos, 0), a.durationMs || Infinity);
}

/**
 * Bijsturen zonder te springen: wijkt een nieuwe meting af van wat we lieten zien, dan lopen we
 * het verschil geleidelijk in. Zo licht een woord of regel nooit twee keer op.
 */
export interface Slew {
  /** Verschil (ms) tussen wat we lieten zien en de nieuwe meting, op moment `start`. */
  amount: number;
  start: number;
  duration: number;
}

export const NO_SLEW: Slew = { amount: 0, start: 0, duration: 1 };

/** Grotere verschillen zijn echte sprongen (spoelen): die nemen we direct over. */
export const MAX_SLEW_MS = 1500;

export function createSlew(shownMs: number, measuredMs: number, now: number): Slew {
  const amount = shownMs - measuredMs;
  if (amount === 0 || Math.abs(amount) > MAX_SLEW_MS) return NO_SLEW;
  // Minstens 2,5× zo lang als het verschil: de tijd loopt dan altijd vooruit (min. 0,6× normaal tempo).
  return { amount, start: now, duration: Math.max(600, Math.abs(amount) * 2.5) };
}

export function slewOffset(slew: Slew, now: number): number {
  if (!slew.amount) return 0;
  const k = Math.min(1, Math.max(0, (now - slew.start) / slew.duration));
  return slew.amount * (1 - k);
}
