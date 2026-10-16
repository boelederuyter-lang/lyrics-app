// Spotify's audio-analysis API (beats/bars) is niet meer beschikbaar voor nieuwe apps.
// Daarom schatten we een beat-grid uit de lyric-timing: zanglijnen beginnen bijna altijd op
// een tel. Klopt het niet? Dan kun je het tempo intikken (tap tempo).

export interface BeatGrid {
  bpm: number;
  /** Tijdstip (ms) van een willekeurige tel. */
  phaseMs: number;
  /** 0..1: hoe goed de onsets op het grid vallen. */
  confidence: number;
  source: 'lyrics' | 'tap' | 'default';
}

export const DEFAULT_GRID: BeatGrid = { bpm: 120, phaseMs: 0, confidence: 0, source: 'default' };

const MIN_BPM = 70;
const MAX_BPM = 180;

export function estimateBeatGrid(onsets: number[]): BeatGrid {
  if (onsets.length < 8) return DEFAULT_GRID;

  let best = { score: -1, bpm: DEFAULT_GRID.bpm, phaseMs: 0, r: 0 };
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 0.1) {
    const period = 60000 / bpm;
    let c = 0;
    let s = 0;
    for (const t of onsets) {
      const angle = (2 * Math.PI * t) / period;
      c += Math.cos(angle);
      s += Math.sin(angle);
    }
    const r = Math.hypot(c, s) / onsets.length;
    // Lichte voorkeur voor "normale" tempo's, zodat we niet op dubbel/half tempo eindigen.
    const prior = Math.exp(-(Math.log2(bpm / 110) ** 2) / (2 * 0.5 ** 2));
    const score = r * (0.6 + 0.4 * prior);
    if (score > best.score) {
      const phase = ((Math.atan2(s, c) / (2 * Math.PI)) * period + period) % period;
      best = { score, bpm, phaseMs: phase, r };
    }
  }
  return {
    bpm: Math.round(best.bpm * 10) / 10,
    phaseMs: best.phaseMs,
    confidence: best.r,
    source: 'lyrics',
  };
}

/** Beat-grid uit getikte tellen (song-posities in ms) via lineaire regressie. */
export function gridFromTaps(taps: number[]): BeatGrid | null {
  if (taps.length < 4) return null;
  const n = taps.length;
  const meanX = (n - 1) / 2;
  const meanY = taps.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  taps.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const period = num / den;
  if (!(period > 60000 / 260 && period < 60000 / 40)) return null;
  const intercept = meanY - period * meanX;
  return {
    bpm: Math.round((60000 / period) * 10) / 10,
    phaseMs: ((intercept % period) + period) % period,
    confidence: 1,
    source: 'tap',
  };
}

export interface BeatPosition {
  index: number;
  /** 0..1 binnen de huidige tel */
  frac: number;
  periodMs: number;
}

export function beatAt(grid: BeatGrid, t: number): BeatPosition {
  const periodMs = 60000 / grid.bpm;
  const x = (t - grid.phaseMs) / periodMs;
  const index = Math.floor(x);
  return { index, frac: x - index, periodMs };
}

/** Pulse die op elke tel naar 1 springt en daarna uitdempt. */
export function beatPulse(frac: number, sharpness = 5): number {
  return Math.exp(-frac * sharpness);
}
