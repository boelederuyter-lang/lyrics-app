import { AnimatePresence, motion, type Variants } from 'motion/react';
import { Fragment, type CSSProperties } from 'react';
import type { LyricLine } from '../lyrics/types';
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

/** Snel en strak: woorden "slaan" erin in plaats van te stuiteren. */
const SLAM = [0.2, 0.9, 0.3, 1] as const;

// ---------------------------------------------------------------- Hard

const hardWord: Variants = {
  future: { scale: 1, y: 0 },
  active: { scale: [1.3, 1], y: ['-0.06em', '0em'], transition: { duration: 0.16, ease: SLAM } },
  past: { scale: 1, y: 0 },
};

function lineFontSize(text: string): string {
  const len = Math.max(8, text.length);
  return `clamp(2.6rem, min(${Math.min(16, 260 / len).toFixed(2)}vw, ${Math.min(22, 420 / len).toFixed(2)}vh), 13rem)`;
}

function HardLine({ line, index, word }: { line: LyricLine; index: number; word: number }) {
  const align = (['left', 'center', 'left', 'right'] as const)[Math.floor(rand(index + 5) * 4)];
  return (
    <motion.div
      className={`hard-line align-${align} ${line.chorus ? 'is-chorus' : ''}`}
      style={{ fontSize: lineFontSize(line.text) }}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.14, ease: SLAM } }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.1 } }}
    >
      {line.words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <motion.span className={`hw ${wordState(i, word)}`} variants={hardWord} initial={false} animate={wordState(i, word)}>
            {w.text}
          </motion.span>
        </Fragment>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------- Stack

const stackWord: Variants = {
  future: { opacity: 0, scale: 1.6 },
  active: { opacity: 1, scale: [1.6, 1], transition: { duration: 0.14, ease: SLAM } },
  past: { opacity: 1, scale: 1 },
};

function StackLine({ line, index, word }: { line: LyricLine; index: number; word: number }) {
  return (
    <motion.div
      className="stack"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.08 } }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
    >
      {line.words.map((w, i) => {
        const len = letters(w.text);
        const vw = Math.min(26, 150 / len);
        const vh = Math.min(30, 130 / len, 160 / line.words.length);
        const r = rand(index * 13 + i);
        const look = r < 0.55 ? 'solid' : r < 0.8 ? 'outline' : 'invert';
        return (
          <motion.span
            key={i}
            className={`sw ${look} ${wordState(i, word)}`}
            style={{ fontSize: `min(${vw.toFixed(2)}vw, ${vh.toFixed(2)}vh)` }}
            variants={stackWord}
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

// ---------------------------------------------------------------- Flow

function FlowView({ lines, cursor }: { lines: LyricLine[]; cursor: Cursor }) {
  const focus = cursor.line >= 0 ? cursor.line : cursor.next >= 0 ? cursor.next : lines.length - 1;
  const from = Math.max(0, focus - 2);
  const visible = lines.slice(from, focus + 4).map((line, k) => ({ line, i: from + k }));

  return (
    <div className="flow">
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map(({ line, i }) => {
          const isCurrent = i === cursor.line;
          const isPast = cursor.line >= 0 ? i < cursor.line : i < focus;
          return (
            <motion.div
              layout
              key={i}
              className={`f-row ${isCurrent ? 'current' : isPast ? 'past' : 'future'}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: isCurrent ? 1 : isPast ? 0.25 : 0.45, y: 0, scale: isCurrent ? 1 : 0.82 }}
              exit={{ opacity: 0, y: -40, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              {line.words.map((w, wi) => {
                const state = isCurrent ? wordState(wi, cursor.word) : isPast ? 'past' : 'future';
                const fill = state === 'past' ? '100%' : state === 'future' ? '0%' : 'calc(var(--wp) * 100%)';
                return (
                  <span key={wi} className={`fw ${state}`} style={{ '--fill': fill } as CSSProperties}>
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
  return (
    <div className="title-card">
      <h1>
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
}

export function LyricsStage({ lines, cursor, style, title }: StageProps) {
  const current = cursor.line >= 0 ? lines[cursor.line] : null;

  if (style === 'karaoke') {
    return (
      <div className="stage stage-flow">
        <FlowView lines={lines} cursor={cursor} />
      </div>
    );
  }

  return (
    <div className={`stage stage-${style} ${current?.chorus ? 'hype' : ''}`}>
      <div className="beat-bump">
        <AnimatePresence>
          {current ? (
            style === 'kinetic' ? (
              <HardLine key={`l${cursor.line}`} line={current} index={cursor.line} word={cursor.word} />
            ) : (
              <StackLine key={`s${cursor.line}`} line={current} index={cursor.line} word={cursor.word} />
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
