import { useState } from 'react';
import { clientIdFromBuild, getClientId, login, REDIRECT_URI, setClientId } from '../spotify/auth';
import { parseInvite } from '../spotify/invite';
import { Background } from '../visual/Background';
import { TitleCard } from '../visual/LyricsStage';
import { InstallHint } from './Install';

export function Login({ error, invited }: { error: string | null; invited: boolean }) {
  const [clientId, setClientIdState] = useState(getClientId);

  return (
    <main className="login">
      <Background art={null} lineKey={-1} />
      <div className="login-card">
        <TitleCard title="Lyrics" subtitle="Spotify lyrics, live op de beat" />

        {clientId ? (
          <div className="connect">
            {invited && <span className="label">Je bent uitgenodigd</span>}
            <button className="accent big" onClick={() => login()}>
              Verbind met Spotify
            </button>
            {!clientIdFromBuild && (
              <button
                className="text-link"
                onClick={() => {
                  setClientId('');
                  setClientIdState('');
                }}
              >
                Andere uitnodiging
              </button>
            )}
          </div>
        ) : (
          <div className="setup">
            <InvitePaste onAccepted={setClientIdState} />
            <OwnSetup />
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <InstallHint />
        <a className="demo-link" href="?demo">
          Eerst kijken? Open de demo
        </a>
      </div>
    </main>
  );
}

/** Uitnodigingslink (of Client ID) plakken. */
function InvitePaste({ onAccepted }: { onAccepted: (id: string) => void }) {
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const canPaste = typeof navigator.clipboard?.readText === 'function';

  const accept = (text: string) => {
    const id = parseInvite(text);
    if (!id) {
      setInvalid(true);
      return;
    }
    setClientId(id);
    onAccepted(id);
  };

  return (
    <section className="panel">
      <span className="label">Uitgenodigd?</span>
      <p>Plak de link die je kreeg. Daarna kun je meteen verbinden met Spotify.</p>
      {canPaste && (
        <button
          className="accent big"
          onClick={async () => {
            try {
              accept(await navigator.clipboard.readText());
            } catch {
              setInvalid(true);
            }
          }}
        >
          Plak uitnodiging
        </button>
      )}
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          accept(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          placeholder={canPaste ? 'Of typ: link of Client ID' : 'Link of Client ID'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Uitnodigingslink of Client ID"
        />
        <button className="ghost" type="submit">
          OK
        </button>
      </form>
      {invalid && <p className="error">Dat is geen geldige uitnodiging. Kopieer de hele link en probeer het opnieuw.</p>}
    </section>
  );
}

/** Uitleg voor wie Lyrics zelf aan zijn Spotify koppelt (eenmalig). */
function OwnSetup() {
  const [copied, setCopied] = useState(false);
  return (
    <details className="panel own-setup">
      <summary>
        <span className="label">Zelf instellen</span>
      </summary>
      <ol className="steps">
        <li>
          <strong>Maak een Spotify-app</strong>
          <p>
            Op{' '}
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
              developer.spotify.com/dashboard
            </a>
            . Vink <b>Web API</b> en <b>Web Playback SDK</b> aan.
          </p>
        </li>
        <li>
          <strong>Redirect URI</strong>
          <button
            className="copy"
            onClick={() => navigator.clipboard?.writeText(REDIRECT_URI).then(() => setCopied(true), () => {})}
          >
            <code>{REDIRECT_URI}</code>
            <span>{copied ? 'Gekopieerd' : 'Kopieer'}</span>
          </button>
        </li>
        <li>
          <strong>Client ID</strong>
          <p>Kopieer de Client ID van je app en plak hem hierboven.</p>
        </li>
      </ol>
    </details>
  );
}
