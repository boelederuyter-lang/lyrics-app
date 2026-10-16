import type { TrackInfo } from '../spotify/api';
import { cleanTitle, pickBest, type LrclibRecord } from './match';
import { parseLrc } from './parseLrc';
import type { Lyrics } from './types';

// LRCLIB: gratis, open database met (gesynchroniseerde) lyrics. https://lrclib.net
// De server is soms overbelast ("503 – busy, retry in a moment"): dan proberen we het opnieuw,
// en onthouden we zo'n mislukking níet als "geen lyrics".
const BASE = 'https://lrclib.net/api';

/** LRCLIB is (even) niet bereikbaar; later opnieuw proberen kan helpen. */
export class LyricsUnavailableError extends Error {}

const RETRY_DELAYS_MS = [700, 1500, 3000];
const MAX_RETRY_AFTER_MS = 8000;

const cache = new Map<string, Lyrics | null>();

/** Lyrics vooraf in de cache zetten (gebruikt door de demo-modus). */
export function primeLyrics(trackId: string, lyrics: Lyrics) {
  cache.set(trackId, lyrics);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** GET met opnieuw proberen bij drukte of netwerkfouten. null = bestaat niet (404). */
async function getJson<T>(path: string, params: Record<string, string>, signal: AbortSignal): Promise<T | null> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; ; attempt++) {
    let wait = RETRY_DELAYS_MS[attempt] ?? 0;
    try {
      const res = await fetch(url, { signal });
      if (res.status === 404) return null;
      if (res.ok) return (await res.json()) as T;
      if (res.status !== 429 && res.status < 500) throw new LyricsUnavailableError(`LRCLIB-fout (${res.status})`);
      const retryAfter = Number(res.headers.get('retry-after')) * 1000;
      if (retryAfter > 0) wait = Math.min(retryAfter, MAX_RETRY_AFTER_MS);
    } catch (err) {
      if (signal.aborted || err instanceof LyricsUnavailableError) throw err;
      // netwerkfout: net als drukte opnieuw proberen
    }
    if (attempt >= RETRY_DELAYS_MS.length) throw new LyricsUnavailableError('De lyrics-server is even druk');
    await sleep(wait, signal);
  }
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

const isFinal = (r: LrclibRecord | null) => !!r && (!!r.syncedLyrics || r.instrumental);

export async function fetchLyrics(track: TrackInfo, signal: AbortSignal): Promise<Lyrics | null> {
  if (cache.has(track.id)) return cache.get(track.id)!;

  const artist = track.artists[0] ?? '';
  const title = cleanTitle(track.name);
  const candidates: LrclibRecord[] = [];
  let failure: unknown = null;

  // Eerst precies dit nummer; anders een paar zoekopdrachten, tot er een goede treffer is.
  const lookups: [string, Record<string, string>][] = [
    ['/get', { track_name: track.name, artist_name: artist, album_name: track.album, duration: String(Math.round(track.durationMs / 1000)) }],
    ['/search', { track_name: title, artist_name: artist }],
    ['/search', { q: `${title} ${artist}` }],
  ];
  let best: LrclibRecord | null = null;
  for (const [path, params] of lookups) {
    try {
      const result = await getJson<LrclibRecord | LrclibRecord[]>(path, params, signal);
      if (Array.isArray(result)) candidates.push(...result);
      else if (isFinal(result)) {
        // /get zoekt zelf al op titel, artiest, album én lengte: dat antwoord vertrouwen we.
        best = result;
        break;
      } else if (result) candidates.push(result);
    } catch (err) {
      if (signal.aborted) throw err;
      // Server onbereikbaar: de volgende zoekopdrachten lukken dan ook niet, dus meteen stoppen.
      failure = err;
      break;
    }
    best = pickBest(candidates, track);
    if (isFinal(best)) break;
  }

  // Server onbereikbaar en niets gevonden: fout melden (niet onthouden), zodat opnieuw proberen kan.
  if (failure && !best) throw failure;
  const lyrics = best ? toLyrics(best, track.durationMs) : null;
  if (!failure || isFinal(best)) cache.set(track.id, lyrics);
  return lyrics;
}
