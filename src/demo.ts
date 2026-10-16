import { useCallback, useMemo, useRef, useState } from 'react';
import { parseLrc } from './lyrics/parseLrc';
import type { Lyrics } from './lyrics/types';
import type { TrackInfo } from './spotify/api';
import type { PlaybackSnapshot } from './spotify/usePlayback';

// Demo-modus (?demo): een verzonnen nummer op 120 BPM, zodat je de visuals zonder Spotify kunt zien.

export const isDemo = new URLSearchParams(window.location.search).has('demo');

const COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#ff2bd6"/><stop offset=".5" stop-color="#7a3cff"/><stop offset="1" stop-color="#18e0ff"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="44" cy="20" r="10" fill="#ffd23f"/></svg>`,
  );

export const DEMO_TRACK: TrackInfo = {
  id: 'demo-neon-hartslag',
  uri: 'demo:neon-hartslag',
  name: 'Neon Hartslag',
  artists: ['Lyrics Party Demo'],
  album: 'Demo',
  albumArt: COVER,
  durationMs: 54_000,
};

const DEMO_LRC = `
[00:04.00]Zet het licht aan, zet het harder
[00:08.00]Voel de bas door de vloer
[00:12.00]We zingen mee met elke tel
[00:16.00]Tot de nacht niet meer bestaat
[00:20.00]
[00:26.00]<00:26.00>Neon <00:26.50>hartslag <00:27.50>in <00:28.00>mijn <00:28.50>hoofd <00:29.50>
[00:30.00]<00:30.00>Neon <00:30.50>hartslag <00:31.50>laat <00:32.00>niet <00:32.50>los <00:33.50>
[00:34.00]Neon hartslag in mijn hoofd
[00:38.00]Neon hartslag laat niet los
[00:42.00]Handen hoog, nog één keer!
[00:46.00]Neon hartslag in mijn hoofd
[00:50.00]
`;

export const DEMO_LYRICS: Lyrics = (() => {
  const lines = parseLrc(DEMO_LRC, DEMO_TRACK.durationMs);
  return { kind: 'synced', lines, wordTimed: lines.some((l) => l.wordTimed) };
})();

export function useDemoPlayback() {
  const start = Number(new URLSearchParams(window.location.search).get('t') ?? 0) * 1000;
  const anchor = useRef({ positionMs: start, receivedAt: performance.now(), paused: false });
  const [paused, setPaused] = useState(false);

  const getPosition = useCallback(() => {
    const a = anchor.current;
    const pos = a.paused ? a.positionMs : a.positionMs + (performance.now() - a.receivedAt);
    return pos % DEMO_TRACK.durationMs;
  }, []);

  const set = useCallback(
    (positionMs: number, nextPaused: boolean) => {
      anchor.current = { positionMs: Math.max(0, positionMs), receivedAt: performance.now(), paused: nextPaused };
      setPaused(nextPaused);
    },
    [],
  );

  const controls = useMemo(
    () => ({
      togglePlay: () => set(getPosition(), !anchor.current.paused),
      next: () => set(0, false),
      previous: () => set(0, false),
      seek: (ms: number) => set(ms, anchor.current.paused),
      playHere: () => {},
    }),
    [getPosition, set],
  );

  const snapshot: PlaybackSnapshot = {
    track: DEMO_TRACK,
    positionMs: anchor.current.positionMs,
    paused,
    receivedAt: anchor.current.receivedAt,
    deviceName: 'Demo',
    isLocal: true,
  };

  return { snapshot, getPosition, deviceReady: true, controls, error: null, clearError: () => {} };
}
