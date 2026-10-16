import { describe, expect, it } from 'vitest';
import { parseLrc } from '../lyrics/parseLrc';
import { defaultDelay, delayFor, delayFromTap, formatDelay, median, pickTarget, TAP_REACTION_MS, withDelay } from './delay';

describe('median', () => {
  it('werkt voor oneven, even en leeg', () => {
    expect(median([300, -100, 50])).toBe(50);
    expect(median([100, 200])).toBe(150);
    expect(median([])).toBe(0);
  });
});

describe('opslag per nummer', () => {
  it('gebruikt je gebruikelijke vertraging voor nieuwe nummers, maar begrensd', () => {
    expect(defaultDelay({})).toBe(0);
    expect(delayFor({ a: 200, b: 300, c: 250 }, 'nieuw')).toBe(250);
    expect(delayFor({ a: 200 }, 'a')).toBe(200);
    expect(defaultDelay({ a: 4000 })).toBe(1000);
  });

  it('zet het laatst gesyncte nummer achteraan en vergeet de oudste', () => {
    let store = {};
    for (let i = 0; i < 305; i++) store = withDelay(store, `t${i}`, i);
    expect(Object.keys(store)).toHaveLength(300);
    expect('t0' in store).toBe(false);
    store = withDelay(store, 't10', 99);
    expect(Object.keys(store).at(-1)).toBe('t10');
  });
});

describe('tik-sync', () => {
  const lines = parseLrc('[00:02.00]een\n[00:04.00]twee\n[00:06.00]drie');

  it('kiest een regel die je nog kunt lezen voordat hij begint', () => {
    expect(pickTarget(lines, 0)).toBe(0);
    expect(pickTarget(lines, 1500)).toBe(1); // regel 0 begint te snel
    expect(pickTarget(lines, 0, 1200, 1)).toBe(2); // na regel 1
    expect(pickTarget(lines, 5500)).toBe(-1);
  });

  it('rekent de vertraging uit (met reactietijd)', () => {
    // Regel begint in de bron op 4,0 s; je tikte op 4,42 s → lyrics 0,3 s later tonen.
    expect(delayFromTap(4000 + 300 + TAP_REACTION_MS, 4000)).toBe(300);
  });

  it('toont de vertraging leesbaar', () => {
    expect(formatDelay(300)).toBe('+0,3 s');
    expect(formatDelay(-1250)).toBe('−1,3 s');
    expect(formatDelay(0)).toBe('+0,0 s');
  });
});
