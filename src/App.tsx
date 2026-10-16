import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_GRID, estimateBeatGrid, gridFromTaps, type BeatGrid } from './beat/tempo';
import { Hud } from './components/Hud';
import { DEMO_LYRICS, DEMO_TRACK, isDemo, useDemoPlayback } from './demo';
import { primeLyrics } from './lyrics/lrclib';
import { useLyrics } from './lyrics/useLyrics';
import { completeLoginFromUrl, hasClientId, isLoggedIn, login, logout, REDIRECT_URI } from './spotify/auth';
import { usePlayback } from './spotify/usePlayback';
import { Background } from './visual/Background';
import { Equalizer, LyricsStage, STAGE_STYLES, TitleCard, type StageStyle } from './visual/LyricsStage';
import { DEFAULT_PALETTE, extractPalette, hsl, type Palette } from './visual/palette';
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
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    completeLoginFromUrl()
      .then(() => setLoggedIn(isLoggedIn()))
      .catch((err: unknown) => setAuthError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (isDemo) return <Player demo onLogout={() => window.location.assign(window.location.pathname)} />;
  if (!loggedIn) return <Login error={authError} />;
  return (
    <Player
      onLogout={() => {
        logout();
        setLoggedIn(false);
      }}
    />
  );
}

function Login({ error }: { error: string | null }) {
  return (
    <main className="login">
      <Background palette={DEFAULT_PALETTE} getTime={() => performance.now()} grid={DEFAULT_GRID} paused={false} lineKey={-1} hype={false} />
      <div className="login-card">
        <TitleCard title="Lyrics Party" subtitle="Je Spotify-nummers als bewegende lyric-video, live op de beat." />
        {hasClientId ? (
          <motion.button className="accent big" onClick={() => login()} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}>
            Verbind met Spotify
          </motion.button>
        ) : (
          <div className="setup">
            <p>Nog één stap: maak een Spotify-app aan en zet de Client ID in <code>.env</code>.</p>
            <ol>
              <li>
                Ga naar <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a> en maak een app.
              </li>
              <li>
                Vink <b>Web API</b> en <b>Web Playback SDK</b> aan en voeg deze Redirect URI toe: <code>{REDIRECT_URI}</code>
              </li>
              <li>
                Kopieer <code>.env.example</code> naar <code>.env</code>, vul <code>VITE_SPOTIFY_CLIENT_ID</code> in en herstart <code>npm run dev</code>.
              </li>
            </ol>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <a className="demo-link" href="?demo">Eerst even kijken? Probeer de demo →</a>
      </div>
    </main>
  );
}

if (isDemo) primeLyrics(DEMO_TRACK.id, DEMO_LYRICS);

function Player({ onLogout, demo = false }: { onLogout: () => void; demo?: boolean }) {
  const spotify = usePlayback(!demo);
  const demoPlayback = useDemoPlayback();
  const { snapshot, getPosition, deviceReady, controls, error, clearError } = demo ? demoPlayback : spotify;
  const track = snapshot.track;
  const lyricsState = useLyrics(track);
  const lyrics = lyricsState.status === 'ready' ? lyricsState.lyrics : null;
  const lines = lyrics?.kind === 'synced' ? lyrics.lines : null;

  const [style, setStyle] = usePersisted<StageStyle>('lyrics.style', 'kinetic');
  const [offsetMs, setOffsetMs] = usePersisted('lyrics.offset', 0);
  const [bpmFactor, setBpmFactor] = useState(1);
  const [tapGrid, setTapGrid] = useState<BeatGrid | null>(null);
  const taps = useRef<number[]>([]);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);

  const getTime = useCallback(() => getPosition() + offsetMs, [getPosition, offsetMs]);

  // Nieuw nummer: tap-tempo en tempofactor resetten.
  useEffect(() => {
    setTapGrid(null);
    setBpmFactor(1);
    taps.current = [];
  }, [track?.id]);

  // Kleuren uit de albumhoes.
  useEffect(() => {
    if (!track?.albumArt) return;
    let cancelled = false;
    extractPalette(track.albumArt)
      .then((p) => !cancelled && setPalette(p))
      .catch(() => !cancelled && setPalette(DEFAULT_PALETTE));
    return () => {
      cancelled = true;
    };
  }, [track?.albumArt]);

  useEffect(() => {
    const root = document.documentElement.style;
    palette.colors.forEach((c, i) => root.setProperty(`--c${i}`, hsl(c)));
    root.setProperty('--base', hsl(palette.base));
  }, [palette]);

  const estimated = useMemo(() => {
    if (!lines) return DEFAULT_GRID;
    const onsets = lyrics?.kind === 'synced' && lyrics.wordTimed ? lines.flatMap((l) => l.words.map((w) => w.start)) : lines.map((l) => l.start);
    return estimateBeatGrid(onsets);
  }, [lines, lyrics]);

  const grid = useMemo<BeatGrid>(() => {
    const g = tapGrid ?? estimated;
    return { ...g, bpm: g.bpm * bpmFactor };
  }, [tapGrid, estimated, bpmFactor]);

  const cursor = useStageClock(lines, getTime, grid, snapshot.paused);
  const hype = cursor.line >= 0 && !!lines?.[cursor.line]?.chorus;

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
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
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
          setOffsetMs((o) => o - 100);
          break;
        case ']':
          setOffsetMs((o) => o + 100);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controls, getPosition, onTap, setOffsetMs, setStyle, toggleFullscreen]);

  const lyricsNote =
    !track
      ? null
      : lyricsState.status === 'loading'
        ? 'Lyrics zoeken…'
        : lyricsState.status === 'missing'
          ? 'Geen lyrics gevonden'
          : lyricsState.status === 'error'
            ? lyricsState.message
            : lyrics?.kind === 'plain'
              ? 'Alleen ongesynchroniseerde lyrics'
              : lyrics?.kind === 'synced' && !lyrics.wordTimed
                ? 'Woord-timing geschat'
                : null;

  return (
    <main className={`player ${hudVisible ? '' : 'cursor-hidden'}`}>
      <Background palette={palette} getTime={getTime} grid={grid} paused={snapshot.paused} lineKey={cursor.line} hype={hype} />

      {!track ? (
        <div className="stage">
          <TitleCard title="Klaar voor de show" subtitle={deviceReady ? 'Start een nummer in Spotify, of klik op "Speel hier af".' : 'Spotify-speler aan het verbinden…'} />
        </div>
      ) : lines ? (
        <LyricsStage lines={lines} cursor={cursor} style={style} title={track.name} />
      ) : lyrics?.kind === 'plain' ? (
        <PlainLyrics lines={lyrics.lines} getTime={getTime} durationMs={track.durationMs} />
      ) : (
        <div className="stage">
          <TitleCard key={track.id} title={track.name} subtitle={track.artists.join(', ')} />
          {lyricsState.status !== 'loading' && <Equalizer />}
        </div>
      )}

      <Hud
        visible={hudVisible}
        snapshot={snapshot}
        deviceReady={deviceReady}
        style={style}
        onStyle={setStyle}
        grid={grid}
        bpmFactor={bpmFactor}
        onBpmFactor={setBpmFactor}
        onTap={onTap}
        offsetMs={offsetMs}
        onOffset={setOffsetMs}
        lyricsNote={lyricsNote}
        controls={controls}
        onFullscreen={toggleFullscreen}
        onLogout={onLogout}
      />

      {error && (
        <div className="toast" role="alert" onClick={clearError}>
          {error}
        </div>
      )}
    </main>
  );
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
