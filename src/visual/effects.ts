import { normalize } from '../lyrics/match';

// Elk nummer krijgt zijn eigen "handschrift": een effect-pakket bepaalt hoe het actieve woord
// binnenkomt, en losse woorden ("regen", "fire", "LOUD") krijgen een eigen effect.

export type EffectPack = 'slam' | 'type' | 'rise' | 'glitch' | 'wave' | 'stretch';
export type EffectChoice = 'auto' | EffectPack;

export const EFFECT_PACKS: { id: EffectPack; label: string }[] = [
  { id: 'slam', label: 'Slam' },
  { id: 'type', label: 'Typ' },
  { id: 'rise', label: 'Zweef' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'wave', label: 'Golf' },
  { id: 'stretch', label: 'Rek' },
];

export const packLabel = (id: EffectPack) => EFFECT_PACKS.find((p) => p.id === id)?.label ?? id;

/** Vaste "random" per nummer: hetzelfde nummer krijgt altijd hetzelfde effect. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Drukke nummers slaan en glitchen, rustige zweven en typen. */
export function autoPack(trackId: string, energy: number): EffectPack {
  const pool: EffectPack[] =
    energy >= 0.7 ? ['slam', 'glitch', 'stretch'] : energy >= 0.4 ? ['slam', 'wave', 'stretch', 'glitch'] : ['rise', 'type', 'wave'];
  return pool[hash(trackId) % pool.length];
}

export type EffectStore = Record<string, EffectPack>;

const MAX_ENTRIES = 300;

/** Onthoudt het effect voor een nummer ('auto' = vergeten); de oudste nummers vallen eruit. */
export function withEffect(store: EffectStore, trackId: string, choice: EffectChoice): EffectStore {
  const next = { ...store };
  delete next[trackId];
  if (choice !== 'auto') next[trackId] = choice;
  const keys = Object.keys(next);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete next[key];
  return next;
}

// ---------------------------------------------------------------- woord-effecten

export type WordFx = 'rain' | 'fire' | 'shake' | 'cold' | 'up' | 'down' | 'love' | 'money';
export type WordSize = 'loud' | 'quiet';

export interface WordEffect {
  fx: WordFx | null;
  size: WordSize | null;
}

const KEYWORDS: Record<WordFx | WordSize, string> = {
  rain: 'rain|raining|rainy|regen|regent|tears|tranen|cry|crying|cried|huil|huilen|drip|drippin|dripping',
  fire: 'fire|flame|flames|burn|burning|burns|lit|vuur|vlammen|brand|branden|hot|heet|smoke|rook',
  shake: 'shake|shaking|earthquake|tril|trillen|beef|boom|bang|crash|explode|bom|knal',
  cold: 'cold|ice|icy|freeze|frozen|froze|koud|ijs|ijskoud|winter|snow|sneeuw|chill|frost',
  up: 'up|high|higher|sky|rise|fly|flying|heaven|omhoog|hoog|boven|lucht|vliegen|vlieg|top|moon|maan',
  down: 'down|low|lower|fall|falling|fell|drop|sink|sinking|omlaag|laag|vallen|val|beneden|ground|grond',
  love: 'love|loved|lover|heart|hearts|liefde|lief|hart|schat',
  money: 'money|cash|gold|golden|rich|bands|racks|diamond|diamonds|geld|poen|doekoe|rijk|goud|dollar|dollars|millions|million|mil',
  loud: 'loud|louder|scream|screaming|yell|shout|luid|schreeuw|schreeuwen|roep',
  quiet: 'whisper|quiet|silence|silent|soft|softly|fluister|fluisteren|stil|stilte|zacht|zachtjes|hush|shh',
};

const MATCHERS = (Object.entries(KEYWORDS) as [WordFx | WordSize, string][]).map(
  ([kind, words]) => [kind, new RegExp(`^(?:${words})$`)] as const,
);

const lettersOnly = (text: string) => text.replace(/[^\p{L}]/gu, '');

/**
 * Effect per woord van een regel. Woorden tussen haakjes zijn ad-libs ("(yeah)") en dus zacht;
 * HOOFDLETTERS en uitroeptekens zijn hard (behalve als de hele regel in hoofdletters staat).
 */
export function wordEffects(words: string[]): WordEffect[] {
  const allCaps = lettersOnly(words.join('')) === lettersOnly(words.join('')).toUpperCase();
  let inParens = false;
  return words.map((text) => {
    const opens = text.includes('(');
    const adlib = inParens || opens;
    if (opens) inParens = true;
    if (text.includes(')')) inParens = false;

    let fx: WordFx | null = null;
    let size: WordSize | null = null;
    for (const part of normalize(text).split(' ')) {
      for (const [kind, re] of MATCHERS) {
        if (!re.test(part)) continue;
        if (kind === 'loud' || kind === 'quiet') size ??= kind;
        else fx ??= kind;
      }
    }
    const letters = lettersOnly(text);
    if (!allCaps && letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) size = 'loud';
    if (/!$/.test(text)) size = 'loud';
    if (adlib) size = 'quiet';
    return { fx, size };
  });
}

/** Moet het woord in losse letters? (Voor effecten die per letter bewegen.) */
export const splitsLetters = (pack: EffectPack, fx: WordFx | null) => pack === 'wave' || pack === 'type' || fx === 'rain';
