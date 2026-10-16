import { describe, expect, it } from 'vitest';
import { cleanTitle, normalize, pickBest, scoreRecord, type LrclibRecord } from './match';

// Echte (ingekorte) zoekresultaten uit LRCLIB.
const rec = (trackName: string, artistName: string, duration: number, synced = true): LrclibRecord => ({
  trackName,
  artistName,
  duration,
  instrumental: false,
  plainLyrics: 'tekst',
  syncedLyrics: synced ? '[00:01.00]tekst' : null,
});

const reinMeIn = [
  rec('Rein Me In', 'Sam Fender', 366),
  rec('Rein Me In', 'Sam Fender', 413),
  rec('Rein Me In', 'Sam Fender', 339.053333, false),
  rec('Rein Me In (with Olivia Dean)', 'Sam Fender', 286),
  rec('Rein Me In (with Olivia Dean)', 'Sam Fender/Olivia Dean', 661),
  rec('Rein Me In (with Olivia Dean)', 'Sam Fender', 340),
  rec('Rein Me In (with Olivia Dean) (Paused)', 'Sam Fender', 339),
  rec('Sam Fender, Olivia Dean - Rein Me In (Official Video)', 'Sam Fender', 338),
];

describe('titels opschonen', () => {
  it('haalt versie-toevoegingen weg', () => {
    expect(cleanTitle('Rein Me In (with Olivia Dean)')).toBe('Rein Me In');
    expect(cleanTitle('The Villest (Official Audio)')).toBe('The Villest');
    expect(cleanTitle('Song - Remastered 2011')).toBe('Song');
    expect(cleanTitle('Song (feat. Iemand)')).toBe('Song');
    expect(cleanTitle('Gewoon een titel')).toBe('Gewoon een titel');
    expect(normalize('Beyoncé & JAY-Z')).toBe('beyonce and jay z');
  });
});

describe('pickBest', () => {
  it('vindt Rein Me In zoals Spotify hem noemt, met de lengte die het best klopt', () => {
    const track = { name: 'Rein Me In (with Olivia Dean)', artists: ['Sam Fender', 'Olivia Dean'], durationMs: 339_500 };
    const best = pickBest(reinMeIn, track);
    expect(best?.syncedLyrics).toBeTruthy();
    expect(best?.duration).toBe(340);
  });

  it('kiest bij de kortere uitgave ook de kortere tekst', () => {
    const track = { name: 'Rein Me In (with Olivia Dean)', artists: ['Sam Fender'], durationMs: 287_000 };
    expect(pickBest(reinMeIn, track)?.duration).toBe(286);
  });

  it('herkent "Artiest - Titel (Official Audio)"', () => {
    const track = { name: 'The Villest', artists: ['J. Cole'], durationMs: 271_000 };
    expect(pickBest([rec('J. Cole - The Villest (Official Audio)', 'J. Cole', 271)], track)).not.toBeNull();
  });

  it('wijst andere nummers, artiesten en lengtes af', () => {
    const track = { name: 'Broke Out', artists: ['J. Cole'], durationMs: 200_000 };
    expect(scoreRecord(rec('Bring Em Out', 'YoungBoy Never Broke Again', 200), track)).toBeNull();
    expect(scoreRecord(rec('Broke Out', 'Iemand Anders', 200), track)).toBeNull();
    expect(scoreRecord(rec('Broke Out', 'J. Cole', 260), track)).toBeNull();
    expect(pickBest([], track)).toBeNull();
  });

  it('neemt alleen ongesynchroniseerde tekst als er niets beters is', () => {
    const track = { name: 'Rein Me In', artists: ['Sam Fender'], durationMs: 339_000 };
    expect(pickBest([rec('Rein Me In', 'Sam Fender', 339, false)], track)?.syncedLyrics).toBeNull();
  });
});
