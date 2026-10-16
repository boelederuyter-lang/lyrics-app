import type { LyricLine, LyricWord } from './types';

const LINE_STAMP = /^\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/;
const WORD_STAMP = /^<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>$/;
const WORD_SPLIT = /(<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>)/;

/** Hoe lang een regel maximaal blijft staan na het laatste woord. */
const LINGER_MS = 2500;
const LAST_LINE_FALLBACK_MS = 8000;

function toMs(min: string, sec: string): number {
  return Math.round((Number(min) * 60 + Number(sec.replace(':', '.'))) * 1000);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Schat woord-timing door de zangduur te verdelen naar woordlengte. */
function estimateWords(text: string, start: number, limit: number): LyricWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const weights = tokens.map((t) => t.length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const available = Math.max(400, limit - start);
  const sung = Math.min(Math.max(total * 70, 500), available * 0.92);

  let cursor = start;
  return tokens.map((token, i) => {
    const dur = (weights[i] / total) * sung;
    const word = { text: token, start: Math.round(cursor), end: Math.round(cursor + dur) };
    cursor += dur;
    return word;
  });
}

/** Enhanced LRC: `<00:12.30> woord <00:12.80> woord`. */
function parseTimedWords(body: string, lineStart: number, offset: number): LyricWord[] | null {
  const parts = body.split(WORD_SPLIT);
  if (parts.length < 3) return null;

  const words: { text: string; start: number }[] = [];
  let current = lineStart;
  let trailing: number | null = null;
  for (const part of parts) {
    const stamp = WORD_STAMP.exec(part);
    if (stamp) {
      current = toMs(stamp[1], stamp[2]) - offset;
      trailing = current;
      continue;
    }
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    trailing = null;
    for (const token of tokens) words.push({ text: token, start: current });
  }
  if (!words.length) return null;

  return words.map((w, i) => {
    const nextStart = words[i + 1]?.start;
    const end = nextStart !== undefined && nextStart > w.start ? nextStart : (trailing ?? w.start + 500);
    return { text: w.text, start: w.start, end: Math.max(end, w.start + 120) };
  });
}

export function parseLrc(source: string, durationMs = Infinity): LyricLine[] {
  let offset = 0;
  const raw: { start: number; body: string }[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const offsetTag = /^\[offset:\s*([+-]?\d+)\s*\]/i.exec(line);
    if (offsetTag) {
      offset = Number(offsetTag[1]);
      continue;
    }
    const stamps: number[] = [];
    let rest = line;
    let m: RegExpExecArray | null;
    while ((m = LINE_STAMP.exec(rest))) {
      stamps.push(toMs(m[1], m[2]));
      rest = rest.slice(m[0].length);
    }
    for (const s of stamps) raw.push({ start: s, body: rest.trim() });
  }
  raw.sort((a, b) => a.start - b.start);

  const lines: LyricLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const start = raw[i].start - offset;
    const nextStart = i + 1 < raw.length ? raw[i + 1].start - offset : Math.min(durationMs, start + LAST_LINE_FALLBACK_MS);
    const timed = parseTimedWords(raw[i].body, start, offset);
    const words = timed ?? estimateWords(raw[i].body, start, nextStart);
    if (!words.length) continue; // lege regel = instrumentaal stukje

    const lastWordEnd = words[words.length - 1].end;
    lines.push({
      start,
      end: Math.max(Math.min(nextStart, lastWordEnd + LINGER_MS), lastWordEnd),
      text: words.map((w) => w.text).join(' '),
      words,
      wordTimed: timed !== null,
      chorus: false,
    });
  }

  const counts = new Map<string, number>();
  for (const l of lines) counts.set(normalize(l.text), (counts.get(normalize(l.text)) ?? 0) + 1);
  for (const l of lines) l.chorus = (counts.get(normalize(l.text)) ?? 0) >= 2;

  return lines;
}

/** Index van de regel die op tijd t actief is, of -1. */
export function findLineIndex(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found >= 0 && t < lines[found].end ? found : -1;
}

/** Index van de eerstvolgende regel die na t begint. */
export function findNextLineIndex(lines: LyricLine[], t: number): number {
  return lines.findIndex((l) => l.start > t);
}

/** Index van het woord dat op tijd t gezongen wordt (laatst begonnen woord), of -1. */
export function findWordIndex(line: LyricLine, t: number): number {
  let idx = -1;
  for (let i = 0; i < line.words.length; i++) {
    if (line.words[i].start <= t) idx = i;
    else break;
  }
  return idx;
}
