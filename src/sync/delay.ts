import type { LyricLine } from '../lyrics/types';

// "Vertraging" = hoeveel later (positief) of eerder (negatief) de lyrics komen dan de bron zegt.
// Oorzaken: de timing in de lyrics-bron (verschilt per nummer) en je koptelefoon
// (Bluetooth loopt vaak ~0,2 s achter). Daarom per nummer onthouden, met je gebruikelijke
// vertraging als startwaarde voor nummers die je nog niet hebt gesynct.

export type SyncStore = Record<string, number>;

const MAX_ENTRIES = 300;
const MAX_DELAY_MS = 10_000;
/** Voor nieuwe nummers: nooit meer dan dit, één rare uitschieter mag niet alles verpesten. */
const MAX_DEFAULT_MS = 1000;
/** Mensen tikken iets na het moment dat ze iets horen. */
export const TAP_REACTION_MS = 120;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Startwaarde voor een nummer zonder eigen sync: je gebruikelijke vertraging. */
export function defaultDelay(store: SyncStore): number {
  return Math.round(clamp(median(Object.values(store)), -MAX_DEFAULT_MS, MAX_DEFAULT_MS));
}

export function delayFor(store: SyncStore, trackId: string | undefined): number {
  return trackId && trackId in store ? store[trackId] : defaultDelay(store);
}

/** Slaat de vertraging voor een nummer op; de oudste nummers vallen eruit. */
export function withDelay(store: SyncStore, trackId: string, delayMs: number): SyncStore {
  const next = { ...store };
  delete next[trackId]; // opnieuw toevoegen = achteraan = meest recent
  next[trackId] = Math.round(clamp(delayMs, -MAX_DELAY_MS, MAX_DELAY_MS));
  const keys = Object.keys(next);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete next[key];
  return next;
}

/**
 * Eerstvolgende regel (na regel `after`) die minstens `leadMs` na `lyricTime` begint,
 * zodat je hem kunt lezen voordat hij gezongen wordt. -1 als er geen meer is.
 */
export function pickTarget(lines: LyricLine[], lyricTime: number, leadMs = 1200, after = -1): number {
  for (let i = Math.max(0, after + 1); i < lines.length; i++) {
    if (lines[i].start >= lyricTime + leadMs) return i;
  }
  return -1;
}

/** Vertraging volgens één tik: je tikte op Spotify-positie `tapPosition` toen regel `lineStart` begon. */
export function delayFromTap(tapPosition: number, lineStart: number): number {
  return tapPosition - TAP_REACTION_MS - lineStart;
}

export function formatDelay(ms: number): string {
  const s = (Math.abs(ms) / 1000).toFixed(1).replace('.', ',');
  return `${ms < 0 ? '−' : '+'}${s} s`;
}
