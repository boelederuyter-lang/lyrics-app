export interface LyricWord {
  text: string;
  /** ms vanaf begin van het nummer */
  start: number;
  end: number;
}

export interface LyricLine {
  start: number;
  end: number;
  text: string;
  words: LyricWord[];
  /** true als de woord-timing uit de bron komt (enhanced LRC), anders geschat. */
  wordTimed: boolean;
  /** Regel komt vaker voor: waarschijnlijk refrein. */
  chorus: boolean;
}

export type Lyrics =
  | { kind: 'synced'; lines: LyricLine[]; wordTimed: boolean }
  | { kind: 'plain'; lines: string[] }
  | { kind: 'instrumental' };
