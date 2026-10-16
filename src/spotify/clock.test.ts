import { describe, expect, it } from 'vitest';
import { createSlew, MAX_SLEW_MS, NO_SLEW, predictPosition, slewOffset } from './clock';

describe('predictPosition', () => {
  const anchor = { positionMs: 10_000, at: 1000, paused: false, durationMs: 60_000 };

  it('loopt door tijdens afspelen en staat stil bij pauze', () => {
    expect(predictPosition(anchor, 1500)).toBe(10_500);
    expect(predictPosition({ ...anchor, paused: true }, 9999)).toBe(10_000);
  });

  it('blijft binnen het nummer', () => {
    expect(predictPosition(anchor, 1_000_000)).toBe(60_000);
    expect(predictPosition({ ...anchor, positionMs: -50 }, 1000)).toBe(0);
  });
});

describe('slew', () => {
  it('is continu op het moment van bijsturen en loopt het verschil volledig in', () => {
    const slew = createSlew(5300, 5000, 100);
    expect(5000 + slewOffset(slew, 100)).toBe(5300);
    expect(slewOffset(slew, 100 + slew.duration)).toBe(0);
    expect(slewOffset(slew, 100 + slew.duration * 10)).toBe(0);
  });

  it('laat de tijd nooit achteruit lopen, ook niet bij het grootste verschil', () => {
    const now = 0;
    const slew = createSlew(MAX_SLEW_MS, 0, now);
    let prev = -Infinity;
    for (let t = 0; t <= slew.duration + 100; t += 16) {
      const shown = t + slewOffset(slew, t); // gemeten positie loopt 1:1 met de tijd
      expect(shown).toBeGreaterThan(prev);
      prev = shown;
    }
  });

  it('neemt grote sprongen (spoelen) direct over', () => {
    expect(createSlew(10_000, 4000, 0)).toBe(NO_SLEW);
    expect(createSlew(4000, 4000, 0)).toBe(NO_SLEW);
  });
});
