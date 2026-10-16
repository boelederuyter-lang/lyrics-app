import { useEffect, useState } from 'react';
import { clientIdFromBuild, inviteLink } from '../spotify/auth';

/** Uitleg + knop om Lyrics met vrienden te delen. */
export function ShareSheet({ onClose }: { onClose: () => void }) {
  const link = inviteLink();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lyrics', text: 'Zie je Spotify-lyrics live meebewegen op de beat.', url: link });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // zelf geannuleerd
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt('Kopieer deze link:', link);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="share-title">Deel Lyrics</h2>
        <ol className="steps">
          <li>
            <strong>Zet je vriend op de lijst</strong>
            <p>
              Spotify laat alleen mensen toe die jij toevoegt, maximaal vijf. Ga in het dashboard naar je app →{' '}
              <b>User Management</b> en vul hun naam en het e-mailadres van hun Spotify-account in.
            </p>
            <a className="ghost" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
              Open dashboard
            </a>
          </li>
          <li>
            <strong>Stuur de link</strong>
            <p>
              {clientIdFromBuild
                ? 'Ze openen hem, verbinden met Spotify en zijn klaar.'
                : 'Jouw Spotify-app zit in de link, ze hoeven zelf niks in te stellen.'}
            </p>
            <button className="accent" onClick={share}>
              {copied ? 'Link gekopieerd' : 'Deel link'}
            </button>
          </li>
          {!clientIdFromBuild && (
            <li>
              <strong>Vrienden met een iPhone</strong>
              <p>
                Na het zetten op hun beginscherm vraagt Lyrics één keer om de link: dan tikken ze op <b>Plak uitnodiging</b>.
              </p>
            </li>
          )}
        </ol>
        <button className="ghost modal-close" onClick={onClose}>
          Sluiten
        </button>
      </div>
    </div>
  );
}
