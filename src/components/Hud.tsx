import { useState } from 'react';
import type { BeatGrid } from '../beat/tempo';
import type { PlaybackSnapshot } from '../spotify/usePlayback';
import { formatDelay } from '../sync/delay';
import { ART_MODES, type ArtMode } from '../visual/Background';
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
  artMode: ArtMode;
  onArtMode: (m: ArtMode) => void;
  onShare: () => void;
  onLogout: () => void;
  logoutLabel: string;
}

export function Hud(p: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { track } = p.snapshot;
  const bpmLabel =
    p.grid.source === 'tap' ? `${p.grid.bpm.toFixed(0)} BPM` : p.grid.source === 'lyrics' ? `≈${p.grid.bpm.toFixed(0)} BPM` : '— BPM';

  return (
    <div className={`hud ${p.visible || sheetOpen ? '' : 'hud-hidden'}`}>
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
        <section className={`sheet ${sheetOpen ? 'open' : ''}`} aria-label="Instellingen" aria-hidden={!sheetOpen}>
          <div className="sheet-row">
            <span className="label">Sync</span>
            <div className="sheet-controls">
              {p.onTapSync && (
                <button className="ghost" onClick={p.onTapSync} title="Tik drie keer als een regel begint (S)">
                  Tik-sync
                </button>
              )}
              <button className="ghost square" onClick={() => p.onNudgeDelay(-100)} title="Lyrics eerder ([)" aria-label="Lyrics eerder">
                <Icon d="M6 12h12" size={16} />
              </button>
              <span className="chip" title="Vertraging van de lyrics voor dit nummer">
                {formatDelay(p.delayMs)}
              </span>
              <button className="ghost square" onClick={() => p.onNudgeDelay(100)} title="Lyrics later (])" aria-label="Lyrics later">
                <Icon d="M12 6v12M6 12h12" size={16} />
              </button>
            </div>
          </div>

          <div className="sheet-row">
            <span className="label">Beat</span>
            <div className="sheet-controls">
              <span
                className="chip"
                title={p.grid.source === 'lyrics' ? `Geschat uit lyrics (${(p.grid.confidence * 100).toFixed(0)}% zeker)` : ''}
              >
                {bpmLabel}
              </span>
              <button className="ghost" onClick={p.onTap} title="Tik mee op de beat (T)">
                Tap
              </button>
              <button className={`ghost square ${p.bpmFactor === 0.5 ? 'on' : ''}`} onClick={() => p.onBpmFactor(p.bpmFactor === 0.5 ? 1 : 0.5)} title="Half tempo">
                ½
              </button>
              <button className={`ghost square ${p.bpmFactor === 2 ? 'on' : ''}`} onClick={() => p.onBpmFactor(p.bpmFactor === 2 ? 1 : 2)} title="Dubbel tempo">
                ×2
              </button>
            </div>
          </div>

          <div className="sheet-row">
            <span className="label">Achtergrond</span>
            <div className="segmented" title="Achtergrond (H)">
              {ART_MODES.map((m) => (
                <button key={m.id} className={p.artMode === m.id ? 'on' : ''} onClick={() => p.onArtMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sheet-row">
            <span className="label">Vrienden</span>
            <div className="sheet-controls">
              <button className="accent" onClick={p.onShare}>
                Deel Lyrics
              </button>
            </div>
          </div>

          <div className="sheet-row">
            <span className="label">Account</span>
            <div className="sheet-controls">
              <button className="ghost" onClick={p.onLogout}>
                {p.logoutLabel}
              </button>
            </div>
          </div>
        </section>

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
            <button className="ghost square fullscreen-btn" onClick={p.onFullscreen} title="Fullscreen (F)" aria-label="Fullscreen">
              <Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </button>
          )}
          <button
            className={`ghost square sheet-toggle ${sheetOpen ? 'on' : ''}`}
            onClick={() => setSheetOpen((o) => !o)}
            aria-label={sheetOpen ? 'Instellingen sluiten' : 'Instellingen'}
            aria-expanded={sheetOpen}
          >
            {sheetOpen ? <Icon d="M6 6l12 12M18 6L6 18" /> : <Icon d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" />}
          </button>
        </div>
      </footer>
    </div>
  );
}

export function Icon({ d, fill = false, size = 20 }: { d: string; fill?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={d} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={fill ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
