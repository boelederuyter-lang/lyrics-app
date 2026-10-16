import { useEffect, useState } from 'react';
import { beatAt, beatPulse, type BeatGrid } from '../beat/tempo';
import { findLineIndex, findNextLineIndex, findWordIndex } from '../lyrics/parseLrc';
import type { LyricLine } from '../lyrics/types';

export interface Cursor {
  /** Actieve regel of -1 (pauze tussen regels / intro). */
  line: number;
  /** Actief woord binnen de regel of -1. */
  word: number;
  /** Eerstvolgende regel of -1. */
  next: number;
  /** 3, 2, 1 vlak voor de volgende regel na een stilte; anders 0. */
  countdown: number;
}

const EMPTY: Cursor = { line: -1, word: -1, next: -1, countdown: 0 };
const COUNTDOWN_MIN_GAP_MS = 4500;

const same = (a: Cursor, b: Cursor) =>
  a.line === b.line && a.word === b.word && a.next === b.next && a.countdown === b.countdown;

/**
 * Eén animatieloop voor de hele app. Continue waarden (beat-pulse, woord-voortgang) gaan als
 * CSS-variabelen op <html>, zodat React alleen opnieuw rendert als regel of woord wisselt.
 */
export function useStageClock(
  lines: LyricLine[] | null,
  getTime: () => number,
  grid: BeatGrid,
  paused: boolean,
  /** 0,15 (rustig nummer) … 1 (druk): hoe hard alles meebeweegt. */
  energy = 1,
): Cursor {
  const [cursor, setCursor] = useState<Cursor>(EMPTY);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--energy', energy.toFixed(2));
    let raf = 0;

    const tick = () => {
      const t = getTime();
      const beat = beatAt(grid, t);
      root.setProperty('--beat', paused ? '0' : (beatPulse(beat.frac) * energy).toFixed(3));
      root.setProperty('--beat-soft', paused ? '0' : (beatPulse(beat.frac, 2.5) * energy).toFixed(3));

      let next: Cursor = EMPTY;
      let wordProgress = 0;
      if (lines?.length) {
        const line = findLineIndex(lines, t);
        let word = -1;
        if (line >= 0) {
          word = findWordIndex(lines[line], t);
          if (word >= 0) {
            const w = lines[line].words[word];
            wordProgress = Math.min(1, Math.max(0, (t - w.start) / Math.max(1, w.end - w.start)));
          }
        }
        const upcoming = line >= 0 ? (line + 1 < lines.length ? line + 1 : -1) : findNextLineIndex(lines, t);
        let countdown = 0;
        if (line < 0 && upcoming >= 0) {
          const gapStart = upcoming > 0 ? lines[upcoming - 1].end : 0;
          const remaining = lines[upcoming].start - t;
          if (lines[upcoming].start - gapStart >= COUNTDOWN_MIN_GAP_MS && remaining <= 3000) {
            countdown = Math.max(1, Math.ceil(remaining / 1000));
          }
        }
        next = { line, word, next: upcoming, countdown };
      }
      root.setProperty('--wp', wordProgress.toFixed(3));
      setCursor((prev) => (same(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, getTime, grid, paused, energy]);

  return cursor;
}
