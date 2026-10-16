import { getAccessToken } from './auth';

export interface TrackInfo {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  durationMs: number;
}

export class SpotifyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}

export interface ApiPlayerState {
  device: { id: string | null; name: string };
  is_playing: boolean;
  progress_ms: number | null;
  currently_playing_type: string;
  item: ApiTrack | null;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) throw new SpotifyError(401, 'Niet ingelogd');

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (res.status === 401 && retry) {
    await getAccessToken(true);
    return request<T>(path, init, false);
  }
  if (!res.ok) {
    // Meestal JSON ({"error":{"message":…}}), maar soms losse tekst, bv. bij accounts die niet in
    // User Management staan: "User not registered in the Developer Dashboard".
    const body = (await res.text().catch(() => '')).trim();
    let message = body.slice(0, 200) || `Spotify API-fout (${res.status})`;
    try {
      message = JSON.parse(body)?.error?.message || message;
    } catch {
      // geen JSON-body: de tekst zelf is de melding
    }
    throw new SpotifyError(res.status, message);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

export function toTrackInfo(track: ApiTrack | Spotify.Track): TrackInfo {
  const duration = 'duration_ms' in track ? track.duration_ms : 0;
  return {
    id: track.id ?? track.uri,
    uri: track.uri,
    name: track.name,
    artists: track.artists.map((a) => a.name),
    album: track.album.name,
    albumArt: track.album.images[0]?.url ?? null,
    durationMs: duration,
  };
}

export interface ApiDevice {
  id: string | null;
  is_active: boolean;
  is_restricted: boolean;
  name: string;
  /** Bv. "Smartphone", "Computer", "Tablet", "Speaker", "TV". */
  type: string;
}

export const getPlayerState = () => request<ApiPlayerState>('/me/player');

export const getDevices = () => request<{ devices: ApiDevice[] }>('/me/player/devices');

export const transferPlayback = (deviceId: string, play = true) =>
  request('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play }) });

export const resume = () => request('/me/player/play', { method: 'PUT' });
export const pause = () => request('/me/player/pause', { method: 'PUT' });
export const next = () => request('/me/player/next', { method: 'POST' });
export const previous = () => request('/me/player/previous', { method: 'POST' });
export const seek = (positionMs: number) =>
  request(`/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`, { method: 'PUT' });
