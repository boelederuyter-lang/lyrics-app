import { describe, expect, it } from 'vitest';
import { parseInvite } from './invite';

describe('parseInvite', () => {
  const id = '0123456789abcdef0123456789abcdef';

  it('herkent een losse Client ID', () => {
    expect(parseInvite(`  ${id} `)).toBe(id);
  });

  it('haalt de Client ID uit een uitnodigingslink', () => {
    expect(parseInvite(`https://iemand.github.io/lyrics-app/?client=${id}`)).toBe(id);
    expect(parseInvite(`Kijk dit! https://iemand.github.io/lyrics-app/?demo&client=${id}`)).toBe(id);
  });

  it('negeert andere tekst', () => {
    expect(parseInvite('hallo')).toBeNull();
    expect(parseInvite('https://iemand.github.io/lyrics-app/')).toBeNull();
  });
});
