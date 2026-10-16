import { useCallback, useEffect, useState } from 'react';
import type { LyricLine } from '../lyrics/types';
import { delayFromTap, median, pickTarget } from '../sync/delay';

const TAPS_NEEDED = 3;
/** Zo lang na de verwachte start wachten we op een tik; daarna schuiven we door naar de volgende regel. */
const MISS_AFTER_MS = 4000;

interface Props {
  lines: LyricLine[];
  /** Spotify-positie, zonder vertraging. */
  getPosition: () => number;
  /** Huidige vertraging, om te kiezen welke regel eraan komt. */
  delayMs: number;
  paused: boolean;
  onDone: (delayMs: number) => void;
  onCancel: () => void;
}

/**
 * Tik-sync: tik drie keer op het moment dat een regel begint. De mediaan van de drie metingen
 * wordt de vertraging voor dit nummer, dus één misser maakt niet uit.
 */
export function TapSync({ lines, getPosition, delayMs, paused, onDone, onCancel }: Props) {
  const [results, setResults] = useState<number[]>([]);
  const working = results.length ? median(results) : delayMs;
  const [target, setTarget] = useState(() => pickTarget(lines, getPosition() - delayMs));
  const [flashes, setFlashes] = useState(0);

  // Doelregel gemist (of geen regel meer, bv. na terugspoelen)? Dan door naar de eerstvolgende.
  useEffect(() => {
    const id = window.setInterval(() => {
      const lyricTime = getPosition() - working;
      setTarget((t) => (t < 0 || lyricTime > lines[t].start + MISS_AFTER_MS ? pickTarget(lines, lyricTime) : t));
    }, 250);
    return () => window.clearInterval(id);
  }, [lines, getPosition, working]);

  const tap = useCallback(
    (eventTime: number) => {
      if (paused || target < 0) return;
      // Positie op het moment van de tik zelf: de afhandeling van het event kan iets later zijn.
      const lag = performance.now() - eventTime;
      const tapPosition = getPosition() - (lag > 0 && lag < 250 ? lag : 0);
      const next = [...results, delayFromTap(tapPosition, lines[target].start)];
      setFlashes((f) => f + 1);
      if (next.length >= TAPS_NEEDED) {
        onDone(Math.round(median(next)));
        return;
      }
      setResults(next);
      setTarget(pickTarget(lines, tapPosition - median(next), 800, target));
    },
    [paused, target, results, lines, getPosition, onDone],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') onCancel();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        tap(e.timeStamp);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tap, onCancel]);

  const previous = target > 0 ? lines[target - 1].text : null;

  return (
    <div className="tap-sync" onPointerDown={(e) => tap(e.timeStamp)}>
      {flashes > 0 && <div key={flashes} className="tap-flash" />}
      <div className="tap-sync-card">
        <p className="tap-sync-hint">{paused ? 'Start eerst de muziek' : 'Tik zodra deze regel begint'}</p>
        {target >= 0 ? (
          <>
            {previous && <p className="tap-sync-prev">na: {previous}</p>}
            <p className="tap-sync-line">{lines[target].text}</p>
          </>
        ) : (
          <p className="tap-sync-line">Wachten op de volgende regel…</p>
        )}
        <div className="tap-sync-dots" aria-label={`${results.length} van ${TAPS_NEEDED}`}>
          {Array.from({ length: TAPS_NEEDED }, (_, i) => (
            <span key={i} className={i < results.length ? 'on' : ''} />
          ))}
        </div>
      </div>
      <button className="ghost tap-sync-cancel" onPointerDown={(e) => e.stopPropagation()} onClick={onCancel}>
        Annuleer
      </button>
    </div>
  );
}
