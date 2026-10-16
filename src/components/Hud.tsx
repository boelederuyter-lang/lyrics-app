import type { BeatGrid } from '../beat/tempo';
import type { PlaybackSnapshot } from '../spotify/usePlayback';
import { STAGE_STYLES, type StageStyle } from '../visual/LyricsStage';

interface Props {
  visible: boolean;
  snapshot: PlaybackSnapshot;
  deviceReady: boolean;
  style: StageStyle;
  onStyle: (s: StageStyle) => void;
  grid: BeatGrid;
  bpmFactor: number;
  onBpmFactor: (f: number) => void;
  onTap: () => void;
  offsetMs: number;
  onOffset: (ms: number) => void;
  lyricsNote: string | null;
  controls: {
    togglePlay: () => void;
    next: () => void;
    previous: () => void;
    playHere: () => void;
  };
  onFullscreen: () => void;
  onLogout: () => void;
}

export function Hud(p: Props) {
  const { track } = p.snapshot;
  const bpmLabel =
    p.grid.source === 'tap'
      ? `${p.grid.bpm.toFixed(0)} BPM`
      : p.grid.source === 'lyrics'
        ? `≈ ${p.grid.bpm.toFixed(0)} BPM`
        : '— BPM';

  return (
    <div className={`hud ${p.visible ? '' : 'hud-hidden'}`}>
      <header className="hud-top">
        <div className="now-playing">
          {track?.albumArt && <img src={track.albumArt} alt="" />}
          <div>
            <strong>{track?.name ?? 'Niets aan het spelen'}</strong>
            <span>
              {track ? track.artists.join(', ') : 'Start een nummer in Spotify'}
              {p.snapshot.deviceName && <em> · {p.snapshot.deviceName}</em>}
            </span>
            {p.lyricsNote && <small>{p.lyricsNote}</small>}
          </div>
        </div>
        <nav className="segmented" aria-label="Stijl">
          {STAGE_STYLES.map((s, i) => (
            <button
              key={s.id}
              className={p.style === s.id ? 'on' : ''}
              onClick={() => p.onStyle(s.id)}
              title={`${s.label} (${i + 1})`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      <footer className="hud-bottom">
        <div className="hud-group">
          <span className="chip" title={p.grid.source === 'lyrics' ? `Geschat uit lyrics (zekerheid ${(p.grid.confidence * 100).toFixed(0)}%)` : ''}>
            {bpmLabel}
          </span>
          <button className="ghost" onClick={p.onTap} title="Tik mee op de beat (T)">
            Tap
          </button>
          <button className={`ghost ${p.bpmFactor === 0.5 ? 'on' : ''}`} onClick={() => p.onBpmFactor(p.bpmFactor === 0.5 ? 1 : 0.5)} title="Half tempo">
            ½
          </button>
          <button className={`ghost ${p.bpmFactor === 2 ? 'on' : ''}`} onClick={() => p.onBpmFactor(p.bpmFactor === 2 ? 1 : 2)} title="Dubbel tempo">
            ×2
          </button>
          <span className="sep" />
          <button className="ghost" onClick={() => p.onOffset(p.offsetMs - 100)} title="Lyrics eerder ([)">
            −
          </button>
          <span className="chip" title="Sync-correctie">
            sync {p.offsetMs >= 0 ? '+' : ''}
            {(p.offsetMs / 1000).toFixed(1)}s
          </span>
          <button className="ghost" onClick={() => p.onOffset(p.offsetMs + 100)} title="Lyrics later (])">
            +
          </button>
        </div>

        <div className="transport">
          <button onClick={p.controls.previous} aria-label="Vorige">
            ⏮
          </button>
          <button className="play" onClick={p.controls.togglePlay} aria-label={p.snapshot.paused ? 'Afspelen' : 'Pauze'}>
            {p.snapshot.paused ? '▶' : '❚❚'}
          </button>
          <button onClick={p.controls.next} aria-label="Volgende">
            ⏭
          </button>
        </div>

        <div className="hud-group right">
          {!p.snapshot.isLocal && p.deviceReady && (
            <button className="accent" onClick={p.controls.playHere}>
              Speel hier af
            </button>
          )}
          <button className="ghost" onClick={p.onFullscreen} title="Fullscreen (F)">
            ⛶
          </button>
          <button className="ghost" onClick={p.onLogout} title="Uitloggen">
            Uitloggen
          </button>
        </div>
      </footer>
    </div>
  );
}
