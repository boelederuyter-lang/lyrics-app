import type { TrackInfo } from '../spotify/api';
import { parseLrc } from './parseLrc';
import type { Lyrics } from './types';

// LRCLIB: gratis, open database met (gesynchroniseerde) lyrics. https://lrclib.net
const BASE = 'https://lrclib.net/api';

interface LrclibRecord {
  trackName: string;
  artistName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

const cache = new Map<string, Lyrics | null>();

/** Lyrics vooraf in de cache zetten (gebruikt door de demo-modus). */
export function primeLyrics(trackId: string, lyrics: Lyrics) {
  cache.set(trackId, lyrics);
}

/** "Song - Remastered 2011" / "Song (feat. X)" → "Song" */
export function cleanTitle(name: string): string {
  return name
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s*[([](?:feat\.?|ft\.?|with|from|remaster|live|radio edit|version)[^)\]]*[)\]]/gi, '')
    .trim();
}

async function getExact(track: TrackInfo, title: string, signal: AbortSignal): Promise<LrclibRecord | null> {
  const params = new URLSearchParams({
    track_name: title,
    artist_name: track.artists[0] ?? '',
    album_name: track.album,
    duration: String(Math.round(track.durationMs / 1000)),
  });
  const res = await fetch(`${BASE}/get?${params}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB-fout (${res.status})`);
  return (await res.json()) as LrclibRecord;
}

async function search(track: TrackInfo, title: string, signal: AbortSignal): Promise<LrclibRecord | null> {
  const params = new URLSearchParams({ track_name: title, artist_name: track.artists[0] ?? '' });
  const res = await fetch(`${BASE}/search?${params}`, { signal });
  if (!res.ok) return null;
  const results = (await res.json()) as LrclibRecord[];
  const durationSec = track.durationMs / 1000;
  const candidates = results
    .filter((r) => Math.abs(r.duration - durationSec) <= 5)
    .sort((a, b) => {
      const synced = Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics);
      return synced || Math.abs(a.duration - durationSec) - Math.abs(b.duration - durationSec);
    });
  return candidates[0] ?? null;
}

function toLyrics(record: LrclibRecord, durationMs: number): Lyrics | null {
  if (record.instrumental) return { kind: 'instrumental' };
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics, durationMs);
    if (lines.length) return { kind: 'synced', lines, wordTimed: lines.some((l) => l.wordTimed) };
  }
  if (record.plainLyrics) {
    return { kind: 'plain', lines: record.plainLyrics.split(/\r?\n/) };
  }
  return null;
}

export async function fetchLyrics(track: TrackInfo, signal: AbortSignal): Promise<Lyrics | null> {
  if (cache.has(track.id)) return cache.get(track.id)!;

  const cleaned = cleanTitle(track.name);
  let record = await getExact(track, track.name, signal);
  // Zonder gesynchroniseerde lyrics nog even verder zoeken; misschien heeft een andere versie ze wel.
  if (!record?.syncedLyrics && !record?.instrumental) {
    if (cleaned !== track.name) record = (await getExact(track, cleaned, signal)) ?? record;
    if (!record?.syncedLyrics) record = (await search(track, cleaned, signal)) ?? record;
  }

  const lyrics = record ? toLyrics(record, track.durationMs) : null;
  cache.set(track.id, lyrics);
  return lyrics;
}
