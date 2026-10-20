import { describe, expect, it } from 'vitest';
import { autoPack, splitsLetters, withEffect, wordEffects } from './effects';

const fx = (line: string) => wordEffects(line.split(' ')).map((e) => e.fx);
const size = (line: string) => wordEffects(line.split(' ')).map((e) => e.size);

describe('autoPack', () => {
  it('kiest per nummer steeds hetzelfde', () => {
    expect(autoPack('abc', 0.9)).toBe(autoPack('abc', 0.9));
  });

  it('past bij de energie van het nummer', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `track${i}`);
    for (const id of ids) {
      expect(['slam', 'glitch', 'stretch']).toContain(autoPack(id, 0.9));
      expect(['rise', 'type', 'wave']).toContain(autoPack(id, 0.2));
    }
    expect(new Set(ids.map((id) => autoPack(id, 0.2))).size).toBeGreaterThan(1);
  });
});

describe('withEffect', () => {
  it('onthoudt per nummer en vergeet bij auto', () => {
    const store = withEffect({}, 'a', 'glitch');
    expect(store).toEqual({ a: 'glitch' });
    expect(withEffect(store, 'a', 'auto')).toEqual({});
  });
});

describe('wordEffects', () => {
  it('herkent sleutelwoorden in het Nederlands en Engels', () => {
    expect(fx("Regen op m'n raam, maar vuur in m'n stem")).toEqual(['rain', null, null, null, null, 'fire', null, null, null]);
    expect(fx('Money on my mind, heart cold')).toEqual(['money', null, null, null, 'love', 'cold']);
    expect(fx('Van de kelder naar boven')).toEqual([null, null, null, null, 'up']);
  });

  it('maakt HOOFDLETTERS en uitroeptekens hard', () => {
    expect(size('we go LOUD now')).toEqual([null, null, 'loud', null]);
    expect(size('Go!')).toEqual(['loud']);
    expect(size('I am')).toEqual([null, null]);
  });

  it('telt een regel die helemaal in hoofdletters staat niet als schreeuwen', () => {
    expect(size('ALL CAPS LINE')).toEqual([null, null, null]);
  });

  it('maakt ad-libs tussen haakjes zacht', () => {
    expect(size("I'm here (yeah, yeah) again")).toEqual([null, null, 'quiet', 'quiet', null]);
  });

  it('splitst letters alleen als het nodig is', () => {
    expect(splitsLetters('wave', null)).toBe(true);
    expect(splitsLetters('slam', 'rain')).toBe(true);
    expect(splitsLetters('slam', 'fire')).toBe(false);
  });
});
