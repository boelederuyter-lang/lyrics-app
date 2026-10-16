import { useEffect, useState } from 'react';
import type { TrackInfo } from '../spotify/api';
import { fetchLyrics } from './lrclib';
import type { Lyrics } from './types';

export type LyricsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; lyrics: Lyrics }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export function useLyrics(track: TrackInfo | null): LyricsState {
  const [state, setState] = useState<LyricsState>({ status: 'idle' });
  const trackId = track?.id;

  useEffect(() => {
    if (!track) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchLyrics(track, controller.signal)
      .then((lyrics) => setState(lyrics ? { status: 'ready', lyrics } : { status: 'missing' }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
    // Alleen opnieuw laden bij een ander nummer.
  }, [trackId]);

  return state;
}
