import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const isAndroid = /Android/i.test(navigator.userAgent);

/** Draait Lyrics al als app vanaf het beginscherm? */
export const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Tip om Lyrics op je beginscherm te zetten (alleen op een telefoon, en alleen als dat nog niet zo is). */
export function InstallHint() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Android/Chrome: eigen installatieknop in plaats van uitleg.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (isStandalone || !(isIos || isAndroid)) return null;

  return (
    <div className="install-hint">
      <span className="label">Tip</span>
      {isIos ? (
        <p>
          Zet Lyrics eerst op je beginscherm: tik op <ShareGlyph /> en kies <b>Zet op beginscherm</b>. Open hem daarna vanaf je beginscherm.
        </p>
      ) : prompt ? (
        <p>Installeer Lyrics als app, dan opent hij schermvullend.</p>
      ) : (
        <p>
          Zet Lyrics op je startscherm: tik op <b>⋮</b> en kies <b>App installeren</b>.
        </p>
      )}
      {prompt && (
        <button
          className="ghost"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          Installeer
        </button>
      )}
    </div>
  );
}

/** Het deel-icoon van iOS (vierkantje met pijl omhoog). */
function ShareGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 24 24" width="16" height="16" aria-label="de deelknop">
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
