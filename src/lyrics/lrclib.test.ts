import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLyrics, LyricsUnavailableError } from './lrclib';

const track = (id: string) => ({
  id,
  uri: `spotify:track:${id}`,
  name: 'Rein Me In (with Olivia Dean)',
  artists: ['Sam Fender', 'Olivia Dean'],
  album: 'People Watching (Deluxe Edition)',
  albumArt: null,
  durationMs: 339_500,
});

const record = { trackName: 'Rein Me In', artistName: 'Sam Fender', duration: 340, instrumental: false, plainLyrics: 'a', syncedLyrics: '[00:01.00]Hallo daar' };
const busy = () => new Response('{"message":"The server is busy"}', { status: 503 });
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

/** fetchLyrics laten lopen terwijl de wachttijden tussen pogingen meteen voorbij zijn. */
async function run(id: string) {
  const promise = fetchLyrics(track(id), new AbortController().signal);
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  return promise;
}

describe('fetchLyrics', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('probeert opnieuw als LRCLIB even druk is', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(busy()).mockResolvedValueOnce(ok(record));
    vi.stubGlobal('fetch', fetch);
    const lyrics = await run('a');
    expect(lyrics?.kind).toBe('synced');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('meldt drukte als fout en onthoudt dat niet als "geen lyrics"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => busy()));
    await expect(run('b')).rejects.toBeInstanceOf(LyricsUnavailableError);

    // Later is de server weer bereikbaar: dan komen de lyrics gewoon.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ok(record)));
    expect((await run('b'))?.kind).toBe('synced');
  });

  it('zoekt verder als het exacte nummer niet bestaat', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(ok([{ ...record, trackName: 'Iets Anders' }, record]));
    vi.stubGlobal('fetch', fetch);
    expect((await run('c'))?.kind).toBe('synced');
    expect(String(fetch.mock.calls[1][0])).toContain('/search?track_name=Rein+Me+In&');
  });

  it('geeft "geen lyrics" als het nummer echt niet bestaat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => (url.includes('/get') ? new Response('{}', { status: 404 }) : ok([]))));
    expect(await run('d')).toBeNull();
  });
});
