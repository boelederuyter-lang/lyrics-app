import { useState } from 'react';
import type { BeatGrid } from '../beat/tempo';
import { formatDelay } from '../sync/delay';
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
  delayMs: number;
  onNudgeDelay: (deltaMs: number) => void;
  onTapSync: (() => void) | null;
  lyricsNote: string | null;
  controls: {
    togglePlay: () => void;
    next: () => void;
    previous: () => void;
    playHere: () => void;
  };
  onFullscreen: (() => void) | null;
  onLogout: () => void;
  logoutLabel: string;
}

export function Hud(p: Props) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const { track } = p.snapshot;
  const bpmLabel =
    p.grid.source === 'tap' ? `${p.grid.bpm.toFixed(0)} BPM` : p.grid.source === 'lyrics' ? `≈${p.grid.bpm.toFixed(0)} BPM` : '— BPM';

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
            <button key={s.id} className={p.style === s.id ? 'on' : ''} onClick={() => p.onStyle(s.id)} title={`${s.label} (${i + 1})`}>
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      <footer className="hud-bottom">
        <div className={`hud-group tools ${toolsOpen ? 'open' : ''}`}>
          {p.onTapSync && (
            <button className="ghost" onClick={p.onTapSync} title="Tik drie keer als een regel begint (S)">
              Tik-sync
            </button>
          )}
          <button className="ghost" onClick={() => p.onNudgeDelay(-100)} title="Lyrics eerder ([)" aria-label="Lyrics eerder">
            −
          </button>
          <span className="chip plain" title="Vertraging van de lyrics voor dit nummer">
            sync {formatDelay(p.delayMs)}
          </span>
          <button className="ghost" onClick={() => p.onNudgeDelay(100)} title="Lyrics later (])" aria-label="Lyrics later">
            +
          </button>
          <span className="sep" />
          <span className="chip" title={p.grid.source === 'lyrics' ? `Geschat uit lyrics (${(p.grid.confidence * 100).toFixed(0)}% zeker)` : ''}>
            {bpmLabel}
          </span>
          <button className="ghost" onClick={p.onTap} title="Tik mee op de beat (T)">
            Tap beat
          </button>
          <button className={`ghost ${p.bpmFactor === 0.5 ? 'on' : ''}`} onClick={() => p.onBpmFactor(p.bpmFactor === 0.5 ? 1 : 0.5)} title="Half tempo">
            ½
          </button>
          <button className={`ghost ${p.bpmFactor === 2 ? 'on' : ''}`} onClick={() => p.onBpmFactor(p.bpmFactor === 2 ? 1 : 2)} title="Dubbel tempo">
            ×2
          </button>
          <span className="sep" />
          <button className="ghost" onClick={p.onLogout}>
            {p.logoutLabel}
          </button>
        </div>

        <div className="transport">
          <button onClick={p.controls.previous} aria-label="Vorige">
            <Icon d="M7 6v12M18 6l-9 6 9 6z" />
          </button>
          <button className="play" onClick={p.controls.togglePlay} aria-label={p.snapshot.paused ? 'Afspelen' : 'Pauze'}>
            {p.snapshot.paused ? <Icon d="M8 5l11 7-11 7z" fill /> : <Icon d="M7 5h4v14H7zM13 5h4v14h-4z" fill />}
          </button>
          <button onClick={p.controls.next} aria-label="Volgende">
            <Icon d="M17 6v12M6 6l9 6-9 6z" />
          </button>
        </div>

        <div className="hud-group right">
          {!p.snapshot.isLocal && p.deviceReady && (
            <button className="accent" onClick={p.controls.playHere}>
              Speel hier af
            </button>
          )}
          {p.onFullscreen && (
            <button className="ghost fullscreen-btn" onClick={p.onFullscreen} title="Fullscreen (F)" aria-label="Fullscreen">
              <Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </button>
          )}
          <button className={`ghost tools-toggle ${toolsOpen ? 'on' : ''}`} onClick={() => setToolsOpen((o) => !o)} aria-label="Instellingen">
            <Icon d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function Icon({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d={d} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={fill ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
