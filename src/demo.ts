import { useCallback, useMemo, useRef, useState } from 'react';
import { parseLrc } from './lyrics/parseLrc';
import type { Lyrics } from './lyrics/types';
import type { TrackInfo } from './spotify/api';
import type { PlaybackSnapshot } from './spotify/usePlayback';

// Demo-modus (?demo): een verzonnen nummer, zodat je de visuals zonder Spotify kunt zien.

export const isDemo = new URLSearchParams(window.location.search).has('demo');

// Zelfgemaakte hoes: stad in de avondzon.
const COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop offset="0" stop-color="#120c1f"/><stop offset=".6" stop-color="#4a1e2c"/><stop offset="1" stop-color="#c2562b"/>
        </linearGradient>
        <radialGradient id="glow"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#f29c38" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="600" height="600" fill="url(#sky)"/>
      <circle cx="300" cy="380" r="210" fill="url(#glow)" opacity=".6"/>
      <circle cx="300" cy="380" r="105" fill="#ffcf6b"/>
      <path fill="#0b0710" d="M0 600V430h40v-60h50v80h30v-120h60v140h40v-90h45v110h35v-150h55v170h30v-70h50v50h40v-100h55v130h40v-60h30V600z"/>
      <text x="34" y="72" font-family="Impact, Arial Black, Arial, sans-serif" font-weight="900" font-size="46" fill="#f4f4f4" letter-spacing="1">ZWART OP WIT</text>
      <text x="36" y="104" font-family="Arial, sans-serif" font-size="15" fill="#f4f4f4" opacity=".7" letter-spacing="5">LYRICS DEMO</text>
    </svg>`,
  );

// Zelfgeschreven demo-tekst op 90 BPM (1 maat = 2,667 s).
export const DEMO_TRACK: TrackInfo = {
  id: 'demo-zwart-op-wit',
  uri: 'demo:zwart-op-wit',
  name: 'Zwart Op Wit',
  artists: ['Lyrics Demo'],
  album: 'Demo',
  albumArt: COVER,
  durationMs: 50_000,
};

const DEMO_LRC = `
[00:02.67]Kom uit de schaduw, stap in het licht
[00:05.33]Regen op m'n raam, maar vuur in m'n gedicht
[00:08.00]Beat in m'n borst en de bas in de straat
[00:10.67]Ik schrijf het op tot het blad niet meer praat
[00:13.33]Ze zeggen rustig aan, maar ik ga HARD (yeah)
[00:16.00]Heel de stad hoort nu eindelijk m'n stem
[00:18.67]Van niks naar iets, van de kelder naar boven
[00:21.33]Wat ik zie in m'n hoofd ga je straks pas geloven
[00:24.00]
[00:26.67]<00:26.67>Zwart <00:27.00>op <00:27.33>wit, <00:28.33>ik <00:28.67>zeg <00:29.00>het <00:29.33>zoals <00:29.67>het <00:30.00>is <00:31.00>
[00:32.00]<00:32.00>Elke <00:32.33>regel <00:32.67>die <00:33.00>ik <00:33.33>schrijf, <00:34.00>is <00:34.33>een <00:34.67>regel <00:35.00>die <00:35.33>blijft <00:36.33>
[00:37.33]Zwart op wit, ik zeg het zoals het is
[00:42.67]Elke regel die ik schrijf, is een regel die blijft
[00:48.00]
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
      openSpotify: () => {},
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

  return { snapshot, getPosition, deviceReady: true, controls, error: null, clearError: () => {}, asleep: false, notRegistered: null };
}
