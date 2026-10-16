import { describe, expect, it } from 'vitest';
import { findLineIndex, findNextLineIndex, findWordIndex, parseLrc, syllables } from './parseLrc';
import { cleanTitle } from './lrclib';

describe('parseLrc', () => {
  it('leest regels, sorteert ze en slaat metadata en lege regels over', () => {
    const lines = parseLrc(`[ar:Iemand]
[00:10.50]Tweede regel
[00:02.00]Eerste regel hier
[00:15.00]
[00:20.00]Derde`);
    expect(lines.map((l) => l.text)).toEqual(['Eerste regel hier', 'Tweede regel', 'Derde']);
    expect(lines[0].start).toBe(2000);
    expect(lines[1].start).toBe(10500);
    // regel stopt bij de lege regel (instrumentaal stuk)
    expect(lines[1].end).toBeLessThanOrEqual(15000);
  });

  it('ondersteunt meerdere tijdstempels op één regel en markeert het refrein', () => {
    const lines = parseLrc(`[00:01.00][00:09.00]Na na na
[00:05.00]Couplet`);
    expect(lines.map((l) => [l.start, l.text])).toEqual([
      [1000, 'Na na na'],
      [5000, 'Couplet'],
      [9000, 'Na na na'],
    ]);
    expect(lines.map((l) => l.chorus)).toEqual([true, false, true]);
  });

  it('past [offset] toe', () => {
    const [line] = parseLrc(`[offset:+500]
[00:02.00]Hoi`);
    expect(line.start).toBe(1500);
  });

  it('leest woord-timing uit enhanced LRC', () => {
    const [line] = parseLrc('[00:01.00]<00:01.00>Hal <00:01.40>lo <00:02.00>wereld <00:03.00>');
    expect(line.wordTimed).toBe(true);
    expect(line.words).toEqual([
      { text: 'Hal', start: 1000, end: 1400 },
      { text: 'lo', start: 1400, end: 2000 },
      { text: 'wereld', start: 2000, end: 3000 },
    ]);
  });

  it('schat woord-timing oplopend binnen de regel', () => {
    const [line] = parseLrc('[00:01.00]een twee drie vier\n[00:05.00]volgende');
    expect(line.wordTimed).toBe(false);
    const starts = line.words.map((w) => w.start);
    expect(starts[0]).toBe(1000);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(line.words[3].end).toBeLessThan(5000);
  });
});

describe('woord-timing schatten', () => {
  it('telt lettergrepen in Nederlands en Engels', () => {
    expect(syllables('straat')).toBe(1);
    expect(syllables('eindelijk')).toBe(3);
    expect(syllables('geloven')).toBe(3);
    expect(syllables("m'n")).toBe(1);
    expect(syllables('beautiful')).toBe(3);
    expect(syllables('2024')).toBe(1);
  });

  it('geeft woorden met meer lettergrepen meer tijd', () => {
    const [line] = parseLrc('[00:00.00]ik eindelijk\n[00:10.00]x');
    const [ik, eindelijk] = line.words;
    expect(eindelijk.end - eindelijk.start).toBeGreaterThan(2 * (ik.end - ik.start));
  });

  it('propt een snelle rapregel binnen de tijd tot de volgende regel', () => {
    const [line] = parseLrc('[00:00.00]van niks naar iets van de kelder naar boven\n[00:02.00]x');
    expect(line.words[line.words.length - 1].end).toBeLessThanOrEqual(2000);
  });
});

describe('cursor', () => {
  const lines = parseLrc('[00:01.00]een twee\n[00:04.00]drie vier');
  it('vindt actieve en volgende regel', () => {
    expect(findLineIndex(lines, 500)).toBe(-1);
    expect(findNextLineIndex(lines, 500)).toBe(0);
    expect(findLineIndex(lines, 1200)).toBe(0);
    expect(findLineIndex(lines, 4100)).toBe(1);
    expect(findWordIndex(lines[0], 999)).toBe(-1);
    expect(findWordIndex(lines[0], lines[0].words[1].start)).toBe(1);
  });
});

describe('cleanTitle', () => {
  it('haalt versie-toevoegingen weg', () => {
    expect(cleanTitle('Song - Remastered 2011')).toBe('Song');
    expect(cleanTitle('Song (feat. Iemand)')).toBe('Song');
    expect(cleanTitle('Gewoon een titel')).toBe('Gewoon een titel');
  });
});
