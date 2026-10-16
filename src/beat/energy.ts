import { syllables } from '../lyrics/parseLrc';
import type { LyricLine } from '../lyrics/types';

// Hoe "druk" is een nummer? Zonder audio-analyse kijken we naar de lyrics: rap heeft 4–5
// lettergrepen per seconde, een rustig nummer 1,5–2. Dat bepaalt hoeveel alles meebeweegt.

const CALM = 1.6; // lettergrepen per seconde: zo rustig mogelijk
const BUSY = 4.2; // en zo druk dat alles volle beweging krijgt
export const MIN_ENERGY = 0.15;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 0,15 (rustig) … 1 (druk), op basis van lettergrepen per seconde per regel. */
export function songEnergy(lines: LyricLine[]): number {
  const rates: number[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    // Tijd tot de volgende regel; regels met een lang instrumentaal stuk erna tellen niet mee.
    const seconds = (lines[i + 1].start - lines[i].start) / 1000;
    if (seconds <= 0.3 || seconds > 8) continue;
    const count = lines[i].words.reduce((sum, w) => sum + syllables(w.text), 0);
    rates.push(count / seconds);
  }
  if (!rates.length) return 0.5;
  const t = (median(rates) - CALM) / (BUSY - CALM);
  return Math.min(1, Math.max(MIN_ENERGY, t));
}

export type MotionMode = 'auto' | 'calm' | 'full';

export const MOTION_MODES: { id: MotionMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'calm', label: 'Rustig' },
  { id: 'full', label: 'Vol' },
];

export function motionEnergy(mode: MotionMode, auto: number): number {
  return mode === 'calm' ? MIN_ENERGY : mode === 'full' ? 1 : auto;
}
