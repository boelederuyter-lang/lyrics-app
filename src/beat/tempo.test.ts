import { describe, expect, it } from 'vitest';
import { beatAt, estimateBeatGrid, gridFromTaps } from './tempo';

describe('estimateBeatGrid', () => {
  it('vindt het tempo uit onsets die op tellen vallen', () => {
    const period = 60000 / 124;
    const phase = 230;
    // zanglijnen op willekeurige tellen, met wat menselijke onnauwkeurigheid
    const beats = [0, 4, 8, 10, 16, 20, 23, 28, 32, 36, 40, 44, 46, 52, 56, 60, 64, 68, 72, 76];
    const onsets = beats.map((b, i) => phase + b * period + ((i * 7) % 5) * 4 - 8);
    const grid = estimateBeatGrid(onsets);
    expect(grid.source).toBe('lyrics');
    expect(Math.abs(grid.bpm - 124)).toBeLessThan(1);
    const offBeat = beatAt(grid, phase + 40 * period).frac;
    expect(Math.min(offBeat, 1 - offBeat)).toBeLessThan(0.08);
  });

  it('valt terug op een standaard als er te weinig data is', () => {
    expect(estimateBeatGrid([1000, 2000]).source).toBe('default');
  });
});

describe('gridFromTaps', () => {
  it('berekent bpm en fase uit getikte tellen', () => {
    const grid = gridFromTaps([1000, 1500, 2000, 2500, 3000])!;
    expect(grid.bpm).toBe(120);
    expect(beatAt(grid, 3000).frac).toBeCloseTo(0, 5);
  });

  it('negeert te weinig taps', () => {
    expect(gridFromTaps([1000, 1500])).toBeNull();
  });
});
