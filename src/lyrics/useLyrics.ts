import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackInfo } from '../spotify/api';
import { fetchLyrics, LyricsUnavailableError } from './lrclib';
import type { Lyrics } from './types';

export type LyricsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; lyrics: Lyrics }
  | { status: 'missing' }
  | { status: 'error'; message: string; retrying: boolean };

/** Is de lyrics-server even druk, dan vanzelf nog een paar keer proberen. */
const AUTO_RETRY_MS = [5000, 15000, 30000];

export function useLyrics(track: TrackInfo | null): { state: LyricsState; retry: () => void } {
  const [state, setState] = useState<LyricsState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const autoRetries = useRef(0);
  const trackId = track?.id;

  // Nieuw nummer: opnieuw beginnen met tellen.
  useEffect(() => {
    autoRetries.current = 0;
  }, [trackId]);

  useEffect(() => {
    if (!track) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    let timer: number | undefined;
    setState({ status: 'loading' });
    fetchLyrics(track, controller.signal)
      .then((lyrics) => setState(lyrics ? { status: 'ready', lyrics } : { status: 'missing' }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const delay = err instanceof LyricsUnavailableError ? AUTO_RETRY_MS[autoRetries.current] : undefined;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err), retrying: delay !== undefined });
        if (delay !== undefined) {
          autoRetries.current += 1;
          timer = window.setTimeout(() => setAttempt((a) => a + 1), delay);
        }
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // Alleen opnieuw laden bij een ander nummer of een nieuwe poging.
  }, [trackId, attempt]);

  const retry = useCallback(() => {
    autoRetries.current = 0;
    setAttempt((a) => a + 1);
  }, []);

  return { state, retry };
}
