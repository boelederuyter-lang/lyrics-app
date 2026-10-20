import { AnimatePresence, motion } from 'motion/react';
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { LyricLine, LyricWord } from '../lyrics/types';
import { splitsLetters, wordEffects, type EffectPack, type WordEffect } from './effects';
import { textWidthAt100, useFitText, useFontsReady, useViewportSize } from './useFitText';
import type { Cursor } from './useStageClock';

export type StageStyle = 'kinetic' | 'karaoke' | 'poster';

export const STAGE_STYLES: { id: StageStyle; label: string }[] = [
  { id: 'kinetic', label: 'Hard' },
  { id: 'karaoke', label: 'Flow' },
  { id: 'poster', label: 'Stack' },
];

type WordState = 'future' | 'active' | 'past';

const wordState = (i: number, active: number): WordState => (i < active ? 'past' : i === active ? 'active' : 'future');

/** Deterministische "random" per regel/woord, zodat re-renders niet van stijl wisselen. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const letters = (word: string) => word.replace(/[^\p{L}\p{N}]/gu, '').length || 1;

/** Per woord: het effect (of niets als woord-effecten uit staan). */
function useWordEffects(line: LyricLine, enabled: boolean): WordEffect[] {
  return useMemo(
    () => (enabled ? wordEffects(line.words.map((w) => w.text)) : line.words.map(() => ({ fx: null, size: null }))),
    [line, enabled],
  );
}

/**
 * De tekst van een woord, met het woord-effect eromheen en zo nodig in losse letters.
 * --dur/--n laten "Typ" de letters vullen in het tempo waarin het woord gezongen wordt.
 */
function WordText({ word, effect, pack }: { word: LyricWord; effect: WordEffect; pack: EffectPack }) {
  const chars = [...word.text];
  const body = splitsLetters(pack, effect.fx)
    ? chars.map((c, i) => (
        <span key={i} className="ch" style={{ '--i': i } as CSSProperties}>
          {c}
        </span>
      ))
    : word.text;
  const dur = Math.min(1.2, Math.max(0.12, (word.end - word.start) / 1000) * 0.8);
  return (
    <span
      className={`fx ${effect.fx ? `fx-${effect.fx}` : ''}`}
      style={{ '--dur': `${dur.toFixed(2)}s`, '--n': chars.length } as CSSProperties}
    >
      {body}
    </span>
  );
}

/** Snel en strak: woorden "slaan" erin in plaats van te stuiteren. */
const SLAM = [0.2, 0.9, 0.3, 1] as const;

// ---------------------------------------------------------------- Hard

type Viewport = { width: number; height: number };

const isPhone = (v: Viewport) => v.width <= 720;

/** Gewenste grootte: korte regels groot, lange kleiner. useFitText verkleint verder als het niet past. */
function hardMaxPx(text: string, v: Viewport): number {
  if (isPhone(v)) return Math.min(80, Math.max(44.8, 0.15 * v.width));
  const len = Math.max(8, text.length);
  const preferred = Math.min((Math.min(16, 260 / len) / 100) * v.width, (Math.min(22, 420 / len) / 100) * v.height);
  return Math.min(208, Math.max(41.6, preferred));
}

/** Hoe hard een woord inslaat: bij rustige nummers (lage energie) bijna niet. */
const slamFor = (max: number, energy: number) => 1 + (max - 1) * energy;

interface LineProps {
  line: LyricLine;
  index: number;
  word: number;
  energy: number;
  pack: EffectPack;
  wordFx: boolean;
}

/** "Rek" trekt het woord horizontaal uit en heeft dus meer ruimte nodig dan inslaan. */
const slamMax = (pack: EffectPack, max: number) => (pack === 'stretch' ? max + 0.5 : max);

function HardLine({ line, index, word, energy, pack, wordFx }: LineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const viewport = useViewportSize();
  const effects = useWordEffects(line, wordFx);
  // Het actieve woord komt binnen (CSS-animatie); --slam bepaalt hoe groot het mag beginnen.
  useFitText(ref, hardMaxPx(line.text, viewport), '.hw', { slam: slamFor(slamMax(pack, 1.3), energy) });
  const align = (['left', 'center', 'left', 'right'] as const)[Math.floor(rand(index + 5) * 4)];
  return (
    <motion.div
      ref={ref}
      className={`hard-line align-${align} ${line.chorus ? 'is-chorus' : ''}`}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.14, ease: SLAM } }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.1 } }}
    >
      {line.words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className={`hw ${wordState(i, word)} ${effects[i].size ?? ''}`}>
            <WordText word={w} effect={effects[i]} pack={pack} />
          </span>
        </Fragment>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------- Stack

/** Basisgrootte voor Stack; elk woord krijgt daar een deel van (korte woorden groter). */
function stackMaxPx(wordCount: number, v: Viewport): number {
  return Math.min(0.24 * v.width, 0.3 * v.height, (1.6 / Math.max(1, wordCount)) * v.height);
}

/** Harde woorden groter, zachte kleiner. */
const SIZE_SCALE = { loud: 1.18, quiet: 0.78 } as const;

function StackLine({ line, index, word, energy, pack, wordFx }: LineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const viewport = useViewportSize();
  const effects = useWordEffects(line, wordFx);
  useFitText(ref, stackMaxPx(line.words.length, viewport), '.sw', { slam: slamFor(slamMax(pack, 1.6), energy) });
  return (
    <motion.div
      ref={ref}
      className="stack"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.08 } }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
    >
      {line.words.map((w, i) => {
        const { size: loudness } = effects[i];
        const size = Math.min(1, 6 / letters(w.text)) * (loudness ? SIZE_SCALE[loudness] : 1);
        const r = rand(index * 13 + i);
        const look = r < 0.55 ? 'solid' : r < 0.8 ? 'outline' : 'invert';
        return (
          <span key={i} className={`sw ${look} ${wordState(i, word)} ${loudness ?? ''}`} style={{ fontSize: `${size.toFixed(3)}em` }}>
            <WordText word={w} effect={effects[i]} pack={pack} />
          </span>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------- Flow

function FlowView({ lines, cursor }: { lines: LyricLine[]; cursor: Cursor }) {
  const focus = cursor.line >= 0 ? cursor.line : cursor.next >= 0 ? cursor.next : lines.length - 1;
  const listRef = useRef<HTMLDivElement>(null);
  const viewport = useViewportSize();
  const fontsReady = useFontsReady();
  const [fontPx, setFontPx] = useState<number | null>(null);

  // Eén lettergrootte per nummer (niet per regel verspringen): het langste woord moet passen.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let widest = 1;
    for (const l of lines) for (const w of l.words) widest = Math.max(widest, textWidthAt100(w.text.toUpperCase()));
    const maxPx = Math.min(70.4, Math.max(30.4, 0.05 * viewport.width));
    setFontPx(Math.max(14, Math.min(maxPx, ((list.clientWidth * 0.94) / widest) * 100)));
  }, [lines, viewport, fontsReady]);

  // De huidige regel steeds in het midden van het scherm; de lijst schuift mee.
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.children[focus] as HTMLElement | undefined;
    const stage = list?.parentElement;
    if (!list || !row || !stage) return;
    list.style.transform = `translateY(${(stage.clientHeight / 2 - (row.offsetTop + row.offsetHeight / 2)).toFixed(1)}px)`;
  }, [focus, fontPx, viewport]);

  return (
    <div ref={listRef} className="flow" style={fontPx ? { fontSize: fontPx } : undefined}>
      {lines.map((line, i) => {
        const isCurrent = i === cursor.line;
        const isPast = cursor.line >= 0 ? i < cursor.line : i < focus;
        return (
          <div key={i} className={`f-row ${isCurrent ? 'current' : isPast ? 'past' : 'future'}`}>
            {line.words.map((w, wi) => {
              const state = isCurrent ? wordState(wi, cursor.word) : isPast ? 'past' : 'future';
              const fill = state === 'past' ? '100%' : state === 'future' ? '0%' : 'calc(var(--wp) * 100%)';
              return (
                <span key={wi} className={`fw ${state}`} style={{ '--fill': fill } as CSSProperties}>
                  {w.text}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Pauzes

function Interlude({ cursor, lines, title }: { cursor: Cursor; lines: LyricLine[]; title: string }) {
  return (
    <motion.div
      className="interlude"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
    >
      {cursor.next === 0 ? <TitleCard title={title} /> : <Bars />}
      {cursor.countdown > 0 && (
        <div className="countdown">
          {[3, 2, 1].map((n) => (
            <span key={n} className={cursor.countdown <= n ? 'on' : ''} />
          ))}
        </div>
      )}
      {cursor.next >= 0 && cursor.countdown > 0 && <div className="up-next">{lines[cursor.next].text}</div>}
    </motion.div>
  );
}

export function TitleCard({ title, subtitle }: { title: string; subtitle?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const viewport = useViewportSize();
  useFitText(ref, Math.min(144, Math.max(48, 0.12 * viewport.width)), '.reveal');
  return (
    <div className="title-card">
      <h1 ref={ref}>
        {title.split(' ').map((word, i) => (
          <span key={`${title}-${i}`} className="reveal">
            <motion.span
              initial={{ y: '110%' }}
              animate={{ y: '0%' }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.45, ease: SLAM }}
            >
              {word}
            </motion.span>
          </span>
        ))}
      </h1>
      {subtitle && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

export function Bars() {
  return (
    <div className="bars" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} style={{ '--h': (0.3 + 0.7 * rand(i + 4)).toFixed(2) } as CSSProperties} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Stage

interface StageProps {
  lines: LyricLine[];
  cursor: Cursor;
  style: StageStyle;
  title: string;
  energy: number;
  /** Hoe het actieve woord binnenkomt (per nummer gekozen). */
  pack: EffectPack;
  /** Effecten op losse woorden ("regen", "vuur", HOOFDLETTERS…). */
  wordFx: boolean;
}

export function LyricsStage({ lines, cursor, style, title, energy, pack, wordFx }: StageProps) {
  const current = cursor.line >= 0 ? lines[cursor.line] : null;

  if (style === 'karaoke') {
    return (
      <div className="stage stage-flow">
        <FlowView lines={lines} cursor={cursor} />
      </div>
    );
  }

  return (
    <div className={`stage stage-${style} pack-${pack} ${current?.chorus ? 'hype' : ''}`}>
      <div className="beat-bump">
        <AnimatePresence>
          {current ? (
            style === 'kinetic' ? (
              <HardLine key={`l${cursor.line}`} line={current} index={cursor.line} word={cursor.word} energy={energy} pack={pack} wordFx={wordFx} />
            ) : (
              <StackLine
                key={`s${cursor.line}`}
                line={current}
                index={cursor.line}
                word={cursor.word}
                energy={energy}
                pack={pack}
                wordFx={wordFx}
              />
            )
          ) : (
            <Interlude key="interlude" cursor={cursor} lines={lines} title={title} />
          )}
        </AnimatePresence>
      </div>
      {style === 'kinetic' && current && cursor.next >= 0 && (
        <div key={`n${cursor.next}`} className="next-preview">
          {lines[cursor.next].text}
        </div>
      )}
    </div>
  );
}
