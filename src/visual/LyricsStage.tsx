import { AnimatePresence, motion, type TargetAndTransition, type Variants } from 'motion/react';
import type { CSSProperties } from 'react';
import type { LyricLine } from '../lyrics/types';
import type { Cursor } from './useStageClock';

export type StageStyle = 'kinetic' | 'karaoke' | 'poster';

export const STAGE_STYLES: { id: StageStyle; label: string }[] = [
  { id: 'kinetic', label: 'Kinetic' },
  { id: 'karaoke', label: 'Karaoke' },
  { id: 'poster', label: 'Poster' },
];

type WordState = 'future' | 'active' | 'past';

const wordState = (i: number, active: number): WordState => (i < active ? 'past' : i === active ? 'active' : 'future');

/** Deterministische "random" per regel/woord, zodat re-renders niet van stijl wisselen. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const colorVar = (i: number) => `var(--c${((i % 4) + 4) % 4})`;

// ---------------------------------------------------------------- Kinetic

const ENTERS: TargetAndTransition[] = [
  { opacity: 0, y: 140, scale: 0.85 },
  { opacity: 0, scale: 2.6, filter: 'blur(24px)' },
  { opacity: 0, x: -320, rotate: -10, skewX: 12 },
  { opacity: 0, y: -180, rotate: 8 },
  { opacity: 0, x: 320, skewX: -12 },
  { opacity: 0, scale: 0.3, rotate: -20 },
];

const EXITS: TargetAndTransition[] = [
  { opacity: 0, y: -160, scale: 1.1, filter: 'blur(18px)' },
  { opacity: 0, scale: 0.4, filter: 'blur(10px)' },
  { opacity: 0, x: -400, rotate: -6 },
  { opacity: 0, scale: 1.8, filter: 'blur(30px)' },
  { opacity: 0, x: 400, rotate: 6 },
];

const kineticWord: Variants = {
  future: (i: number) => ({
    opacity: 0.12,
    y: '0.4em',
    scale: 0.75,
    rotate: (rand(i) - 0.5) * 14,
    filter: 'blur(6px)',
  }),
  active: {
    opacity: 1,
    y: 0,
    scale: 1.16,
    rotate: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 700, damping: 16 },
  },
  past: { opacity: 1, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)', transition: { duration: 0.25 } },
};

function lineFontSize(text: string, max: number): string {
  const len = Math.max(6, text.length);
  return `clamp(2rem, min(${Math.min(max, 190 / len).toFixed(2)}vw, ${Math.min(max * 1.6, 300 / len).toFixed(2)}vh), 11rem)`;
}

function KineticLine({ line, index, word }: { line: LyricLine; index: number; word: number }) {
  const r = rand(index + 1);
  const enter = line.chorus ? ENTERS[1] : ENTERS[Math.floor(r * ENTERS.length)];
  const exit = EXITS[Math.floor(rand(index + 7) * EXITS.length)];
  const tilt = line.chorus ? 0 : (rand(index + 3) - 0.5) * 7;
  const align = (['center', 'left', 'right', 'center'] as const)[Math.floor(rand(index + 5) * 4)];

  return (
    <motion.div
      className={`kinetic-line ${line.chorus ? 'is-chorus' : ''}`}
      style={{ fontSize: lineFontSize(line.text, 13), textAlign: align, justifyContent: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end' }}
      initial={enter}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: tilt, skewX: 0, filter: 'blur(0px)' }}
      exit={{ ...exit, transition: { duration: 0.45, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: 'spring', stiffness: 210, damping: 19 }}
    >
      {line.words.map((w, i) => (
        <motion.span
          key={i}
          className={`kw ${wordState(i, word)}`}
          style={{ '--wc': colorVar(index + i) } as CSSProperties}
          custom={index * 31 + i}
          variants={kineticWord}
          initial="future"
          animate={wordState(i, word)}
        >
          {w.text}
        </motion.span>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------- Poster

const posterWord: Variants = {
  future: { opacity: 0, scale: 2.8, rotate: 0 },
  active: (i: number) => ({
    opacity: 1,
    scale: 1.08,
    rotate: (rand(i) - 0.5) * 10,
    transition: { type: 'spring', stiffness: 520, damping: 14 },
  }),
  past: (i: number) => ({ opacity: 1, scale: 1, rotate: (rand(i) - 0.5) * 8 }),
};

function PosterLine({ line, index, word }: { line: LyricLine; index: number; word: number }) {
  return (
    <motion.div
      className="poster"
      initial={{ opacity: 0, rotate: (rand(index) - 0.5) * 20, scale: 0.8 }}
      animate={{ opacity: 1, rotate: (rand(index) - 0.5) * 6, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, rotate: (rand(index + 2) - 0.5) * 40, transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
    >
      {line.words.map((w, i) => {
        const len = w.text.replace(/[^\p{L}\p{N}]/gu, '').length || 1;
        const size = Math.min(13, 38 / Math.max(2.4, len) + 1.5);
        const inverted = rand(index * 13 + i) > 0.62;
        return (
          <motion.span
            key={i}
            className={`pw ${inverted ? 'inverted' : ''} ${wordState(i, word)}`}
            style={{ fontSize: `min(${size}vw, ${(size * 1.25).toFixed(2)}vh)`, '--wc': colorVar(index + i) } as CSSProperties}
            custom={index * 17 + i}
            variants={posterWord}
            initial="future"
            animate={wordState(i, word)}
          >
            {w.text}
          </motion.span>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------- Karaoke

function KaraokeView({ lines, cursor }: { lines: LyricLine[]; cursor: Cursor }) {
  const focus = cursor.line >= 0 ? cursor.line : cursor.next >= 0 ? cursor.next : lines.length - 1;
  const from = Math.max(0, focus - 2);
  const visible = lines.slice(from, focus + 4).map((line, k) => ({ line, i: from + k }));

  return (
    <div className="karaoke">
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map(({ line, i }) => {
          const isCurrent = i === cursor.line;
          const isPast = cursor.line >= 0 ? i < cursor.line : i < focus;
          return (
            <motion.div
              layout
              key={i}
              className={`k-row ${isCurrent ? 'current' : isPast ? 'past' : 'future'} ${line.chorus ? 'is-chorus' : ''}`}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: isCurrent ? 1 : isPast ? 0.3 : 0.6, y: 0, scale: isCurrent ? 1 : 0.8 }}
              exit={{ opacity: 0, y: -60, transition: { duration: 0.3 } }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            >
              {line.words.map((w, wi) => {
                const state = isCurrent ? wordState(wi, cursor.word) : isPast ? 'past' : 'future';
                const fill = state === 'past' ? '100%' : state === 'future' ? '0%' : 'calc(var(--wp) * 100%)';
                return (
                  <span key={wi} className={`fw ${state}`} style={{ '--fill': fill, '--wc': colorVar(i + wi) } as CSSProperties}>
                    {w.text}
                  </span>
                );
              })}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- Pauzes

function Interlude({ cursor, lines, title }: { cursor: Cursor; lines: LyricLine[]; title: string }) {
  const isIntro = cursor.next === 0;
  return (
    <motion.div
      className="interlude"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.2, filter: 'blur(12px)', transition: { duration: 0.3 } }}
    >
      {isIntro ? <TitleCard title={title} /> : <Equalizer />}
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
  return (
    <div className="title-card">
      <h1>
        {title.split(' ').map((word, wi, words) => {
          const offset = words.slice(0, wi).join(' ').length + (wi ? 1 : 0);
          return (
            <span key={`${title}-${wi}`} className="title-word">
              {Array.from(word).map((ch, ci) => {
                const i = offset + ci;
                return (
                  <motion.span
                    key={ci}
                    initial={{ opacity: 0, y: 60, rotate: (rand(i) - 0.5) * 40 }}
                    animate={{ opacity: 1, y: 0, rotate: 0 }}
                    transition={{ delay: i * 0.035, type: 'spring', stiffness: 300, damping: 15 }}
                    style={{ color: colorVar(i) }}
                  >
                    {ch}
                  </motion.span>
                );
              })}
            </span>
          );
        })}
      </h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export function Equalizer() {
  return (
    <div className="equalizer" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} style={{ '--i': i, '--h': (0.35 + 0.65 * rand(i + 4)).toFixed(2), '--wc': colorVar(i) } as CSSProperties} />
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
}

export function LyricsStage({ lines, cursor, style, title }: StageProps) {
  const current = cursor.line >= 0 ? lines[cursor.line] : null;
  const hype = current?.chorus ?? false;

  if (style === 'karaoke') {
    return (
      <div className="stage stage-karaoke">
        <KaraokeView lines={lines} cursor={cursor} />
      </div>
    );
  }

  return (
    <div className={`stage stage-${style} ${hype ? 'hype' : ''}`}>
      <div className="beat-bump">
        <AnimatePresence>
          {current ? (
            style === 'kinetic' ? (
              <KineticLine key={`l${cursor.line}`} line={current} index={cursor.line} word={cursor.word} />
            ) : (
              <PosterLine key={`p${cursor.line}`} line={current} index={cursor.line} word={cursor.word} />
            )
          ) : (
            <Interlude key="interlude" cursor={cursor} lines={lines} title={title} />
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {style === 'kinetic' && current && cursor.next >= 0 && (
          <motion.div
            key={`n${cursor.next}`}
            className="next-preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.55, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
          >
            {lines[cursor.next].text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
