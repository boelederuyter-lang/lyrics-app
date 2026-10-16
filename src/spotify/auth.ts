// Spotify login via Authorization Code + PKCE: er is geen backend of client secret nodig.

const CLIENT_ID_KEY = 'lyrics.client-id';
const ENV_CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '').trim();

/** Client ID uit de build (.env / GitHub-variabele), anders zelf ingevuld in de app. */
export function getClientId(): string {
  return ENV_CLIENT_ID || (localStorage.getItem(CLIENT_ID_KEY) ?? '').trim();
}

export function setClientId(id: string) {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}

export const REDIRECT_URI =
  (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined)?.trim() ||
  `${window.location.origin}${import.meta.env.BASE_URL}`;

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
];

const TOKEN_KEY = 'lyrics.tokens';
const VERIFIER_KEY = 'lyrics.pkce-verifier';
const STATE_KEY = 'lyrics.pkce-state';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function loadTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StoredTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function login(): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(16);
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: await codeChallenge(verifier),
    state,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

async function requestToken(body: Record<string, string>, previousRefresh?: string): Promise<StoredTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Spotify token-aanvraag mislukt (${res.status})`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const tokens: StoredTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? previousRefresh ?? '',
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

/** Rondt de login af als Spotify ons terugstuurde met ?code=... in de URL. */
export async function completeLoginFromUrl(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) return;

  const state = url.searchParams.get('state');
  for (const key of ['code', 'error', 'state']) url.searchParams.delete(key);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);

  if (error) throw new Error(`Spotify-login geannuleerd (${error})`);

  const verifier = localStorage.getItem(VERIFIER_KEY);
  const expectedState = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  if (!verifier || state !== expectedState) throw new Error('Login-sessie verlopen, probeer opnieuw.');

  await requestToken({
    grant_type: 'authorization_code',
    code: code!,
    redirect_uri: REDIRECT_URI,
    client_id: getClientId(),
    code_verifier: verifier,
  });
}

let refreshing: Promise<StoredTokens> | null = null;

export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;
  if (!forceRefresh && tokens.expiresAt - 60_000 > Date.now()) return tokens.accessToken;
  if (!tokens.refreshToken) {
    logout();
    return null;
  }
  refreshing ??= requestToken(
    { grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: getClientId() },
    tokens.refreshToken,
  ).finally(() => {
    refreshing = null;
  });
  try {
    return (await refreshing).accessToken;
  } catch {
    logout();
    return null;
  }
}

export function isLoggedIn(): boolean {
  return loadTokens() !== null;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}
