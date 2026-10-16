import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAccessToken } from './auth';
import * as api from './api';
import type { TrackInfo } from './api';
import { createSlew, NO_SLEW, predictPosition, slewOffset, type Slew } from './clock';
import { pickDevice } from './devices';

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
/** Zo lang na "Open Spotify" starten we de muziek vanzelf als je terugkomt in de app. */
const RESUME_ON_RETURN_MS = 3 * 60_000;
/** Zo lang na een play-commando controleren we of de muziek echt speelt. */
const VERIFY_PLAY_MS = 2500;
const LAST_DEVICE_KEY = 'lyrics.last-device';
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

/**
 * Spotify-app in development mode: alleen accounts die de eigenaar in User Management heeft gezet,
 * mogen erin. Een weigering (403) bij het ophalen van wat er speelt betekent dus: geen toegang.
 */
export function isAccessDenied(err: unknown): boolean {
  return err instanceof api.SpotifyError && err.status === 403;
}

function describeError(err: unknown): string {
  if (err instanceof api.SpotifyError) {
    if (err.status === 403 && /premium/i.test(err.message))
      return 'Bedienen vanuit Lyrics kan alleen met Spotify Premium. Bedien de muziek in Spotify, de lyrics lopen gewoon mee.';
    if (err.status === 404)
      return browserPlaybackSupported
        ? 'Geen actief Spotify-apparaat. Klik op "Speel hier af" of start muziek in Spotify.'
        : 'Spotify is niet actief. Open Spotify even en probeer het opnieuw.';
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
  /** Laatst gebruikte Spotify-apparaat, om daar te hervatten als er niets actief is. */
  const lastDeviceIdRef = useRef<string | null>(localStorage.getItem(LAST_DEVICE_KEY));
  /** Spotify is niet bereikbaar (app slaapt): dan moet je hem even openen. */
  const [asleep, setAsleep] = useState(false);
  /** Dit Spotify-account mag (nog) niet in de app; bevat de melding van Spotify. */
  const [notRegistered, setNotRegistered] = useState<string | null>(null);
  const resumeOnReturnRef = useRef(0);
  /** Telt elke play/pauze-druk, zodat een latere controle weet of je intussen iets anders deed. */
  const toggleCountRef = useRef(0);

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

  /**
   * Hervatten, ook als Spotify geen actief apparaat meer heeft (bv. na een lange pauze):
   * dan zoeken we je telefoon (of computer) in de apparatenlijst en starten we daar.
   * Geeft false als er geen geschikt apparaat bereikbaar is.
   */
  const resumeAnywhere = useCallback(async (): Promise<boolean> => {
    try {
      await api.resume();
      return true;
    } catch (err) {
      if (!(err instanceof api.SpotifyError) || err.status !== 404) throw err;
    }
    const found = await api.getDevices();
    const device = pickDevice(found?.devices ?? [], {
      preferTypes: browserPlaybackSupported ? ['Computer'] : ['Smartphone', 'Tablet'],
      lastDeviceId: lastDeviceIdRef.current,
      ownDeviceId: deviceIdRef.current,
    });
    if (!device?.id) {
      setAsleep(true);
      return false;
    }
    await api.transferPlayback(device.id, true);
    return true;
  }, []);

  /** Een slapende Spotify-app neemt het commando soms aan zonder te spelen: even nakijken. */
  const verifyPlaying = useCallback(() => {
    const press = toggleCountRef.current;
    window.setTimeout(async () => {
      // Intussen zelf weer op pauze gedrukt (of in de browser aan het afspelen)? Dan niets zeggen.
      if (toggleCountRef.current !== press || snapRef.current.isLocal) return;
      try {
        const state = await api.getPlayerState();
        if (!state?.is_playing) setAsleep(true);
      } catch {
        // de gewone polling meldt fouten al
      }
    }, VERIFY_PLAY_MS);
  }, []);

  // Muziek speelt weer: melding over slapende Spotify weghalen.
  useEffect(() => {
    if (snapshot.track && !snapshot.paused) setAsleep(false);
  }, [snapshot]);

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
          setNotRegistered(null);
          if (!state) {
            update({ ...EMPTY, receivedAt });
          } else {
            if (state.device.id && state.device.id !== lastDeviceIdRef.current) {
              lastDeviceIdRef.current = state.device.id;
              localStorage.setItem(LAST_DEVICE_KEY, state.device.id);
            }
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
          if (isAccessDenied(err)) setNotRegistered((err as Error).message);
          else setError(describeError(err));
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
      if (document.visibilityState !== 'visible') return;
      poll();
      // Net Spotify wakker gemaakt via "Open Spotify"? Dan de muziek starten.
      if (resumeOnReturnRef.current && Date.now() - resumeOnReturnRef.current < RESUME_ON_RETURN_MS) {
        resumeOnReturnRef.current = 0;
        window.setTimeout(async () => {
          try {
            const state = await api.getPlayerState();
            if (state?.is_playing) return; // al aangezet in Spotify zelf
            if (await resumeAnywhere()) verifyPlaying();
          } catch (err) {
            setError(describeError(err));
          } finally {
            pollNowRef.current();
          }
        }, 600);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    poll();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, update, resumeAnywhere, verifyPlaying]);

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
          toggleCountRef.current += 1;
          // Optimistisch bijwerken zodat de animaties direct reageren.
          if (s.track) update({ ...s, paused: !s.paused, positionMs: shown(s, slewRef.current), receivedAt: performance.now() });
          if (local()) return playerRef.current!.togglePlay();
          if (!s.paused) return api.pause();
          setAsleep(false);
          if (await resumeAnywhere()) verifyPlaying();
        }),
      /** Spotify-app openen om hem wakker te maken; bij terugkomst start de muziek vanzelf. */
      openSpotify: () => {
        setAsleep(false);
        resumeOnReturnRef.current = Date.now();
        window.location.href = 'spotify:';
      },
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
  }, [update, resumeAnywhere, verifyPlaying]);

  return {
    snapshot,
    getPosition,
    deviceReady: deviceId !== null,
    controls,
    error,
    clearError: () => setError(null),
    asleep,
    notRegistered,
  };
}
