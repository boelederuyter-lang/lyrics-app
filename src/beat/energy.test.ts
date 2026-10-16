import { describe, expect, it } from 'vitest';
import { parseLrc } from '../lyrics/parseLrc';
import { MIN_ENERGY, motionEnergy, songEnergy } from './energy';

describe('songEnergy', () => {
  it('geeft een snelle rap veel energie', () => {
    const rap = parseLrc(
      [
        '[00:00.00]Ik schrijf het op tot het blad niet meer praat',
        '[00:02.40]Ze zeggen rustig aan maar ik ken geen rem',
        '[00:04.80]Heel de stad hoort nu eindelijk mijn stem',
        '[00:07.20]Van niks naar iets van de kelder naar boven',
        '[00:09.60]Klaar',
      ].join('\n'),
    );
    expect(songEnergy(rap)).toBeGreaterThan(0.8);
  });

  it('geeft een rustig nummer weinig energie', () => {
    const ballad = parseLrc(
      ['[00:00.00]Blijf nog even', '[00:05.00]Hier bij mij', '[00:10.00]In het donker', '[00:15.00]Stil', '[00:20.00]Eind'].join('\n'),
    );
    expect(songEnergy(ballad)).toBe(MIN_ENERGY);
  });

  it('laat lange instrumentale stukken niet meetellen', () => {
    const lines = parseLrc(['[00:00.00]Een twee drie vier vijf zes', '[01:30.00]Een twee drie vier vijf zes', '[01:32.00]x'].join('\n'));
    expect(songEnergy(lines)).toBeGreaterThan(MIN_ENERGY);
  });
});

describe('motionEnergy', () => {
  it('volgt de keuze in de instellingen', () => {
    expect(motionEnergy('auto', 0.6)).toBe(0.6);
    expect(motionEnergy('calm', 0.9)).toBe(MIN_ENERGY);
    expect(motionEnergy('full', 0.2)).toBe(1);
  });
});
