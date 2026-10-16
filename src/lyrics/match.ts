// Welk LRCLIB-resultaat hoort bij het nummer dat op Spotify speelt? LRCLIB wordt door
// vrijwilligers gevuld, dus titels zijn rommelig: "J. Cole - SAFETY", "Rein Me In (Official Video)",
// "Sam Fender/Olivia Dean". We vergelijken daarom op een opgeschoonde titel en artiest, en lengte.

export interface LrclibRecord {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface TrackRef {
  name: string;
  artists: string[];
  durationMs: number;
}

/** Zoveel seconden mag de lengte afwijken (andere uitgave, stilte aan het eind…). */
export const MAX_DURATION_DIFF = 10;

/** Kleine letters, zonder accenten en leestekens: "Beyoncé & JAY-Z" → "beyonce and jay z". */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const EXTRA_IN_BRACKETS =
  /\s*[([][^)\]]*\b(?:feat|ft|with|official|audio|video|lyrics?|visuali[sz]er|remaster(?:ed)?|explicit|clean|radio edit)\b[^)\]]*[)\]]/gi;
const VERSION_SUFFIX = /\s+-\s+[^-]*\b(?:remaster(?:ed)?|version|edit|mix|live|mono|stereo|from)\b.*$/i;

/** "Song (with X)", "Song (Official Audio)", "Song - Remastered 2011" → "Song" */
export function cleanTitle(name: string): string {
  return name.replace(EXTRA_IN_BRACKETS, '').replace(VERSION_SUFFIX, '').trim();
}

const artistMatches = (text: string, artists: string[]) => {
  const t = normalize(text);
  return artists.some((a) => {
    const n = normalize(a);
    return n.length > 0 && (t.includes(n) || n.includes(t));
  });
};

/** Titel om te vergelijken: zonder "01 - ", zonder "Artiest - " ervoor, zonder toevoegingen. */
function titleKey(title: string, artists: string[]): string {
  let t = title.replace(/^\d{1,2}\s*[-.]\s*/, '');
  const prefixed = /^(.+?)\s+-\s+(.+)$/.exec(t);
  if (prefixed && artistMatches(prefixed[1], artists)) t = prefixed[2];
  return normalize(cleanTitle(t));
}

/** Score van een resultaat: lager is beter; null = hoort niet bij dit nummer. */
export function scoreRecord(record: LrclibRecord, track: TrackRef): number | null {
  if (!record.syncedLyrics && !record.plainLyrics && !record.instrumental) return null;
  if (!artistMatches(record.artistName, track.artists)) return null;

  const want = titleKey(track.name, track.artists);
  const got = titleKey(record.trackName, track.artists);
  if (!want || !got) return null;
  const sameTitle = got === want;
  // "rein me in paused" bij "rein me in": mag, maar telt iets minder.
  const similarTitle = !sameTitle && (` ${got} `.includes(` ${want} `) || ` ${want} `.includes(` ${got} `));
  if (!sameTitle && !similarTitle) return null;

  const diff = Math.abs(record.duration - track.durationMs / 1000);
  if (diff > MAX_DURATION_DIFF) return null;

  return diff + (sameTitle ? 0 : 3) + (record.syncedLyrics || record.instrumental ? 0 : 100);
}

/** Beste resultaat: gesynchroniseerd gaat voor, dan de titel, dan de lengte die het best klopt. */
export function pickBest(records: LrclibRecord[], track: TrackRef): LrclibRecord | null {
  let best: LrclibRecord | null = null;
  let bestScore = Infinity;
  for (const r of records) {
    const score = scoreRecord(r, track);
    if (score !== null && score < bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}
