import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_GRID, estimateBeatGrid, gridFromTaps, type BeatGrid } from './beat/tempo';
import { Hud } from './components/Hud';
import { Login } from './components/Login';
import { ShareSheet } from './components/Share';
import { TapSync } from './components/TapSync';
import { DEMO_LYRICS, DEMO_TRACK, isDemo, useDemoPlayback } from './demo';
import { primeLyrics } from './lyrics/lrclib';
import { useLyrics } from './lyrics/useLyrics';
import { acceptInviteFromUrl, completeLoginFromUrl, isLoggedIn, logout } from './spotify/auth';
import { browserPlaybackSupported, usePlayback } from './spotify/usePlayback';
import { delayFor, formatDelay, withDelay, type SyncStore } from './sync/delay';
import { ART_MODES, Background, type ArtMode } from './visual/Background';
import { Bars, LyricsStage, STAGE_STYLES, TitleCard, type StageStyle } from './visual/LyricsStage';
import { useStageClock } from './visual/useStageClock';

function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // opslag niet beschikbaar: geen probleem
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export default function App() {
  const [invited] = useState(acceptInviteFromUrl);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    completeLoginFromUrl()
      .then(() => setLoggedIn(isLoggedIn()))
      .catch((err: unknown) => setAuthError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (isDemo) return <Player demo onLogout={() => window.location.assign(window.location.pathname)} />;
  if (!loggedIn) return <Login error={authError} invited={invited} />;
  return (
    <Player
      onLogout={() => {
        logout();
        setLoggedIn(false);
      }}
    />
  );
}

if (isDemo) primeLyrics(DEMO_TRACK.id, DEMO_LYRICS);

function Player({ onLogout, demo = false }: { onLogout: () => void; demo?: boolean }) {
  const spotify = usePlayback(!demo);
  const demoPlayback = useDemoPlayback();
  const { snapshot, getPosition, deviceReady, controls, error, clearError, asleep, notRegistered } = demo
    ? demoPlayback
    : spotify;
  const track = snapshot.track;
  const lyricsState = useLyrics(track);
  const lyrics = lyricsState.status === 'ready' ? lyricsState.lyrics : null;
  const lines = lyrics?.kind === 'synced' ? lyrics.lines : null;

  const [style, setStyle] = usePersisted<StageStyle>('lyrics.style', 'kinetic');
  const [artMode, setArtMode] = usePersisted<ArtMode>('lyrics.art', 'color');
  const cycleArtMode = useCallback(
    () => setArtMode((m) => ART_MODES[(ART_MODES.findIndex((a) => a.id === m) + 1) % ART_MODES.length].id),
    [setArtMode],
  );
  const [bpmFactor, setBpmFactor] = useState(1);
  const [tapGrid, setTapGrid] = useState<BeatGrid | null>(null);
  const taps = useRef<number[]>([]);

  // Sync: vertraging van de lyrics, per nummer onthouden (positief = lyrics later).
  const trackId = track?.id;
  const [syncStore, setSyncStore] = usePersisted<SyncStore>('lyrics.sync', {});
  const delayMs = delayFor(syncStore, trackId);
  const setDelay = useCallback(
    (ms: number | ((current: number) => number)) => {
      if (!trackId) return;
      setSyncStore((store) => withDelay(store, trackId, typeof ms === 'function' ? ms(delayFor(store, trackId)) : ms));
    },
    [trackId, setSyncStore],
  );
  const nudgeDelay = useCallback((delta: number) => setDelay((d) => d + delta), [setDelay]);
  const [syncing, setSyncing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Nummer in de titel van het tabblad / de app-switcher.
  useEffect(() => {
    document.title = track ? `${track.name} · ${track.artists[0] ?? ''} · Lyrics` : 'Lyrics';
  }, [track?.name, track?.artists]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(id);
  }, [notice]);

  const getTime = useCallback(() => getPosition() - delayMs, [getPosition, delayMs]);

  // Nieuw nummer: tap-tempo, tempofactor en tik-sync resetten.
  useEffect(() => {
    setTapGrid(null);
    setBpmFactor(1);
    setSyncing(false);
    taps.current = [];
  }, [trackId]);

  const estimated = useMemo(() => {
    if (!lines) return DEFAULT_GRID;
    // Alleen echte tijdstempels: per woord als de bron dat heeft, anders het begin van de regel.
    const onsets = lines.flatMap((l) => (l.wordTimed ? l.words.map((w) => w.start) : [l.start]));
    return estimateBeatGrid(onsets);
  }, [lines]);

  const grid = useMemo<BeatGrid>(() => {
    const g = tapGrid ?? estimated;
    return { ...g, bpm: g.bpm * bpmFactor };
  }, [tapGrid, estimated, bpmFactor]);

  const cursor = useStageClock(lines, getTime, grid, snapshot.paused);
  // Instrumentaal stuk midden in het nummer (geen tekst in beeld): dan mag de hoes helder.
  const coverMoment = !!lines && style !== 'karaoke' && cursor.line < 0 && cursor.next !== 0;

  useWakeLock();

  const onTap = useCallback(() => {
    const t = getTime();
    const list = taps.current;
    if (list.length && (t - list[list.length - 1] > 2000 || t < list[list.length - 1])) list.length = 0;
    list.push(t);
    if (list.length > 16) list.shift();
    const g = gridFromTaps(list);
    if (g) {
      setTapGrid(g);
      setBpmFactor(1);
    }
  }, [getTime]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  // HUD verbergen als je de muis even niet beweegt.
  const [hudVisible, setHudVisible] = useState(true);
  useEffect(() => {
    let timer = window.setTimeout(() => setHudVisible(false), 3500);
    const wake = () => {
      setHudVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHudVisible(false), 3500);
    };
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (syncing || sharing || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const styleIndex = Number(e.key) - 1;
      if (STAGE_STYLES[styleIndex]) return setStyle(STAGE_STYLES[styleIndex].id);
      switch (e.key) {
        case ' ':
          e.preventDefault();
          controls.togglePlay();
          break;
        case 'ArrowRight':
          controls.seek(getPosition() + 5000);
          break;
        case 'ArrowLeft':
          controls.seek(getPosition() - 5000);
          break;
        case 'n':
          controls.next();
          break;
        case 'p':
          controls.previous();
          break;
        case 't':
          onTap();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case '[':
          nudgeDelay(-100);
          break;
        case ']':
          nudgeDelay(100);
          break;
        case 's':
          if (lines) setSyncing(true);
          break;
        case 'h':
          cycleArtMode();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controls, getPosition, onTap, nudgeDelay, setStyle, toggleFullscreen, syncing, sharing, lines, cycleArtMode]);

  const lyricsNote =
    !track
      ? null
      : lyricsState.status === 'loading'
        ? 'Lyrics zoeken…'
        : lyricsState.status === 'missing'
          ? 'Geen lyrics gevonden'
          : lyricsState.status === 'error'
            ? lyricsState.message
            : lyrics?.kind === 'instrumental'
              ? 'Instrumentaal'
              : lyrics?.kind === 'plain'
              ? 'Alleen ongesynchroniseerde lyrics'
              : lyrics?.kind === 'synced' && !lyrics.wordTimed
                ? 'Woord-timing geschat'
                : null;

  return (
    <main className={`player ${hudVisible ? '' : 'cursor-hidden'}`} data-art={artMode}>
      <Background art={track?.albumArt ?? null} lineKey={cursor.line} mode={artMode} dim={!coverMoment} />

      {notRegistered ? (
        <div className="stage">
          <div className="idle">
            <TitleCard title="Nog geen toegang" subtitle="Je Spotify-account staat nog niet op de lijst" />
            <p className="explain">
              Vraag degene die je de link stuurde om je toe te voegen in het Spotify-dashboard (User Management), met het
              e-mailadres van je Spotify-account. Daarna werkt het meteen.
            </p>
            <div className="button-row">
              <button className="accent big" onClick={() => window.location.reload()}>
                Opnieuw proberen
              </button>
              <button className="ghost big" onClick={onLogout}>
                Ander account
              </button>
            </div>
          </div>
        </div>
      ) : !track ? (
        <div className="stage">
          <div className="idle">
            <TitleCard
              title="Druk op play"
              subtitle={
                !browserPlaybackSupported
                  ? 'Of start een nummer in de Spotify-app'
                  : deviceReady
                    ? 'Of start een nummer in Spotify, of klik op "Speel hier af"'
                    : 'Spotify-speler aan het verbinden…'
              }
            />
            <button className="accent big" onClick={controls.togglePlay}>
              ▶ Verder luisteren
            </button>
          </div>
        </div>
      ) : lines ? (
        <LyricsStage lines={lines} cursor={cursor} style={style} title={track.name} />
      ) : lyrics?.kind === 'plain' ? (
        <PlainLyrics lines={lyrics.lines} getTime={getTime} durationMs={track.durationMs} />
      ) : (
        <div className="stage">
          <div className="idle">
            <TitleCard key={track.id} title={track.name} subtitle={track.artists.join(', ')} />
            <span className={`label ${lyricsState.status === 'loading' ? 'pulse' : ''}`}>
              {lyricsState.status === 'loading'
                ? 'Lyrics zoeken'
                : lyrics?.kind === 'instrumental'
                  ? 'Instrumentaal'
                  : 'Geen lyrics gevonden voor dit nummer'}
            </span>
            {lyricsState.status !== 'loading' && <Bars />}
          </div>
        </div>
      )}

      <Hud
        visible={(hudVisible || snapshot.paused) && !syncing}
        snapshot={snapshot}
        deviceReady={deviceReady}
        style={style}
        onStyle={setStyle}
        grid={grid}
        bpmFactor={bpmFactor}
        onBpmFactor={setBpmFactor}
        onTap={onTap}
        delayMs={delayMs}
        onNudgeDelay={nudgeDelay}
        onTapSync={lines ? () => setSyncing(true) : null}
        lyricsNote={lyricsNote}
        controls={controls}
        onFullscreen={document.fullscreenEnabled ? toggleFullscreen : null}
        artMode={artMode}
        onArtMode={setArtMode}
        onShare={() => setSharing(true)}
        onLogout={onLogout}
        logoutLabel={demo ? 'Demo sluiten' : 'Uitloggen'}
      />

      {sharing && <ShareSheet onClose={() => setSharing(false)} />}

      {syncing && lines && (
        <TapSync
          lines={lines}
          getPosition={getPosition}
          delayMs={delayMs}
          paused={snapshot.paused}
          onDone={(ms) => {
            setDelay(ms);
            setSyncing(false);
            setNotice(`Gesynct: lyrics ${formatDelay(ms)}`);
          }}
          onCancel={() => setSyncing(false)}
        />
      )}

      {asleep ? (
        <div className="toast toast-action" role="alert">
          <span>
            Spotify slaapt{browserPlaybackSupported ? '' : ' op je telefoon'}. Open hem even, dan start de muziek
            zodra je terug bent.
          </span>
          <button className="accent" onClick={controls.openSpotify}>
            Open Spotify
          </button>
        </div>
      ) : error ? (
        <div className="toast" role="alert" onClick={clearError}>
          {error}
        </div>
      ) : (
        notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )
      )}
    </main>
  );
}

/** Houdt het scherm aan zolang de app open is (handig op je telefoon). */
function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then(
        (l) => {
          if (released) l.release();
          else lock = l;
        },
        () => {},
      );
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      released = true;
      lock?.release();
      document.removeEventListener('visibilitychange', acquire);
    };
  }, []);
}

/** Zonder timing: tekst scrollt rustig mee op basis van de voortgang in het nummer. */
function PlainLyrics({ lines, getTime, durationMs }: { lines: string[]; getTime: () => number; durationMs: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const progress = Math.min(1, Math.max(0, getTime() / Math.max(1, durationMs)));
        const travel = el.scrollHeight - window.innerHeight * 0.5;
        el.style.transform = `translateY(${(window.innerHeight * 0.4 - progress * travel).toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getTime, durationMs]);

  return (
    <div className="stage stage-plain">
      <div ref={ref} className="plain-scroll">
        {lines.map((l, i) => (
          <p key={i}>{l || ' '}</p>
        ))}
      </div>
    </div>
  );
}
