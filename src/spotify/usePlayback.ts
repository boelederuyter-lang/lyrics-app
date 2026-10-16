import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAccessToken } from './auth';
import * as api from './api';
import type { TrackInfo } from './api';
import { createSlew, NO_SLEW, predictPosition, slewOffset, type Slew } from './clock';

export interface PlaybackSnapshot {
  track: TrackInfo | null;
  positionMs: number;
  paused: boolean;
  /** performance.now() op het moment dat positionMs gold. */
  receivedAt: number;
  deviceName: string | null;
  /** true als er in deze browser wordt afgespeeld (Web Playback SDK). */
  isLocal: boolean;
}

const EMPTY: PlaybackSnapshot = {
  track: null,
  positionMs: 0,
  paused: true,
  receivedAt: 0,
  deviceName: null,
  isLocal: false,
};

/**
 * De Web Playback SDK werkt niet in mobiele browsers. Daar speel je af in de Spotify-app
 * en volgen wij mee via de Web API.
 */
export const browserPlaybackSupported =
  !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) &&
  !(navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

const POLL_MS = 2500;
/** Na een nieuw nummer snel nog eens meten: de eerste positie na een wissel is vaak onnauwkeurig. */
const TRACK_CHANGE_POLL_MS = 1000;
/** Zo kort na het verwachte einde van een nummer vragen we het volgende op. */
const END_OF_TRACK_MARGIN_MS = 250;
const LOCAL_SYNC_MS = 1000;
/** Kleinere verschillen zijn meetruis. */
const DRIFT_TOLERANCE_MS = 40;

function predict(s: PlaybackSnapshot, now = performance.now()): number {
  if (!s.track) return 0;
  return predictPosition({ positionMs: s.positionMs, at: s.receivedAt, paused: s.paused, durationMs: s.track.durationMs }, now);
}

/** De positie die we tonen: voorspelling plus een eventuele lopende bijsturing. */
function shown(s: PlaybackSnapshot, slew: Slew, now = performance.now()): number {
  if (!s.track) return 0;
  const pos = predict(s, now) + (s.paused ? 0 : slewOffset(slew, now));
  return Math.min(Math.max(pos, 0), s.track.durationMs || Infinity);
}

function describeError(err: unknown): string {
  if (err instanceof api.SpotifyError) {
    if (err.status === 404) return 'Geen actief Spotify-apparaat. Klik op "Speel hier af" of start muziek in Spotify.';
    if (err.status === 403) return `Spotify weigerde dit: ${err.message}`;
    if (err.status === 429) return 'Even rustig aan: Spotify rate limit bereikt.';
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export function usePlayback(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(EMPTY);
  const snapRef = useRef<PlaybackSnapshot>(EMPTY);
  const slewRef = useRef<Slew>(NO_SLEW);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollNowRef = useRef<() => void>(() => {});

  const update = useCallback((next: PlaybackSnapshot) => {
    const prev = snapRef.current;
    const now = performance.now();
    const continuous =
      !!next.track && prev.track?.id === next.track.id && prev.isLocal === next.isLocal && !prev.paused && !next.paused;
    if (continuous) {
      // Zelfde nummer, speelt door: niet springen maar geleidelijk bijsturen.
      const was = shown(prev, slewRef.current, now);
      const measured = predict(next, now);
      if (Math.abs(was - measured) < DRIFT_TOLERANCE_MS && prev.deviceName === next.deviceName) return;
      slewRef.current = createSlew(was, measured, now);
    } else {
      slewRef.current = NO_SLEW;
    }
    snapRef.current = next;
    setSnapshot(next);
  }, []);

  const getPosition = useCallback(() => shown(snapRef.current, slewRef.current), []);

  const handleSdkState = useCallback(
    (state: Spotify.PlaybackState | null) => {
      if (!state) {
        if (snapRef.current.isLocal) update({ ...snapRef.current, isLocal: false });
        return;
      }
      const t = state.track_window.current_track;
      update({
        track: t ? api.toTrackInfo(t) : null,
        positionMs: state.position,
        paused: state.paused,
        receivedAt: performance.now(),
        deviceName: 'Deze browser',
        isLocal: true,
      });
    },
    [update],
  );

  // Web Playback SDK: maakt van deze browser een Spotify-apparaat (vereist Premium).
  useEffect(() => {
    if (!enabled || !browserPlaybackSupported) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || playerRef.current) return;
      const player = new window.Spotify.Player({
        name: 'Lyrics Party 🎤',
        getOAuthToken: (cb) => {
          getAccessToken().then((t) => t && cb(t));
        },
        volume: 0.8,
      });
      player.addListener('ready', ({ device_id }) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
      });
      player.addListener('not_ready', () => {
        deviceIdRef.current = null;
        setDeviceId(null);
      });
      player.addListener('player_state_changed', handleSdkState);
      player.addListener('initialization_error', ({ message }) =>
        setError(`Browser-speler kon niet starten: ${message}`),
      );
      player.addListener('authentication_error', () => setError('Spotify-login verlopen, log opnieuw in.'));
      player.addListener('account_error', () => setError('Afspelen in de browser vereist Spotify Premium.'));
      player.addListener('autoplay_failed', () => setError('Autoplay geblokkeerd door de browser: klik op play.'));
      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.getElementById('spotify-sdk')) {
        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [enabled, handleSdkState]);

  // Lokaal: elke seconde de exacte positie ophalen om drift te corrigeren.
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (!snapRef.current.isLocal) return;
      playerRef.current?.getCurrentState().then(handleSdkState);
    }, LOCAL_SYNC_MS);
    return () => window.clearInterval(id);
  }, [enabled, handleSdkState]);

  // Ander apparaat (telefoon, desktop-app): de Web API pollen.
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: number | undefined;

    const poll = async () => {
      window.clearTimeout(timer);
      if (stopped) return;
      let delay = POLL_MS;
      if (!snapRef.current.isLocal) {
        const previousTrack = snapRef.current.track?.id;
        try {
          const started = performance.now();
          const state = await api.getPlayerState();
          const receivedAt = (started + performance.now()) / 2;
          if (stopped) return;
          if (!state) {
            update({ ...EMPTY, receivedAt });
          } else {
            update({
              track: state.item && state.currently_playing_type === 'track' ? api.toTrackInfo(state.item) : null,
              positionMs: state.progress_ms ?? 0,
              paused: !state.is_playing,
              receivedAt,
              deviceName: state.device.name,
              isLocal: false,
            });
          }
        } catch (err) {
          setError(describeError(err));
        }
        const s = snapRef.current;
        if (s.track?.id !== previousTrack) delay = TRACK_CHANGE_POLL_MS;
        // Vlak na het verwachte einde opnieuw vragen, zodat het volgende nummer meteen verschijnt.
        if (s.track && !s.paused && !s.isLocal) {
          const remaining = s.track.durationMs - predict(s);
          if (remaining > 0) delay = Math.min(delay, remaining + END_OF_TRACK_MARGIN_MS);
        }
      }
      if (!stopped) timer = window.setTimeout(poll, delay);
    };

    pollNowRef.current = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, 350);
    };
    // Terug in de app (bv. na een nummer kiezen in Spotify): meteen verversen.
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    poll();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, update]);

  const controls = useMemo(() => {
    const run = async (fn: () => Promise<unknown>) => {
      try {
        setError(null);
        await fn();
      } catch (err) {
        setError(describeError(err));
      } finally {
        pollNowRef.current();
      }
    };
    const local = () => snapRef.current.isLocal && playerRef.current;

    return {
      togglePlay: () =>
        run(async () => {
          const s = snapRef.current;
          // Optimistisch bijwerken zodat de animaties direct reageren.
          update({ ...s, paused: !s.paused, positionMs: shown(s, slewRef.current), receivedAt: performance.now() });
          if (local()) await playerRef.current!.togglePlay();
          else if (s.paused) await api.resume();
          else await api.pause();
        }),
      next: () => run(() => (local() ? playerRef.current!.nextTrack() : api.next())),
      previous: () => run(() => (local() ? playerRef.current!.previousTrack() : api.previous())),
      seek: (ms: number) => run(() => (local() ? playerRef.current!.seek(ms) : api.seek(ms))),
      playHere: () =>
        run(async () => {
          await playerRef.current?.activateElement();
          if (!deviceIdRef.current) throw new Error('Browser-speler is nog niet klaar, probeer zo opnieuw.');
          await api.transferPlayback(deviceIdRef.current, true);
        }),
    };
  }, [update]);

  return { snapshot, getPosition, deviceReady: deviceId !== null, controls, error, clearError: () => setError(null) };
}
