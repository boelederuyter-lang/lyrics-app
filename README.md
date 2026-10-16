# 🎤 Lyrics Party

Verbind met Spotify en zie de lyrics van wat je luistert als een bewegende lyric-video: woorden springen op het moment dat ze gezongen worden, de achtergrond pulseert op de beat in de kleuren van de albumhoes.

## Wat zit erin

- **Spotify-koppeling** (login zonder backend via PKCE). Afspelen kan **in de browser** (Web Playback SDK, Premium) of op een ander apparaat (telefoon, desktop-app). De app volgt dan mee.
- **Gesynchroniseerde lyrics** via [LRCLIB](https://lrclib.net) (gratis). Timing per woord als de bron die heeft, anders geschat.
- **3 stijlen**: `Kinetic` (bewegende typografie), `Karaoke` (meekleurende regels), `Poster` (grote blokletters).
- **Op de beat**: het tempo wordt geschat uit de lyric-timing. Klopt het niet? Tik mee met **Tap**, of gebruik ½ / ×2.
- Kleuren uit de albumhoes, particles bij elke nieuwe regel, shockwaves op de tel, extra heftig tijdens het refrein.
- **Demo-modus** zonder Spotify: open de app met `?demo`.

## Starten

```bash
npm install
cp .env.example .env    # en vul je Client ID in (zie hieronder)
npm run dev             # → http://127.0.0.1:5173
```

### Spotify-app aanmaken (eenmalig)

1. Ga naar [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) en maak een app.
2. Vink **Web API** en **Web Playback SDK** aan.
3. Voeg als Redirect URI toe: `http://127.0.0.1:5173/` (Spotify accepteert geen `localhost`).
4. Zet de **Client ID** in `.env` als `VITE_SPOTIFY_CLIENT_ID`.

### Vrienden laten meedoen

Spotify-apps staan in *development mode*: alleen gebruikers die je toevoegt kunnen inloggen.
Ga in het dashboard naar je app → **User Management** en voeg je vrienden toe (naam + e-mail van hun Spotify-account).
Wil je dat ze het vanaf hun eigen computer gebruiken, host de app dan (bv. Vercel/Netlify) en voeg die URL ook als Redirect URI toe.

## Sneltoetsen

| Toets | Actie |
| --- | --- |
| `Spatie` | play / pauze |
| `←` / `→` | 5 s terug / vooruit |
| `N` / `P` | volgend / vorig nummer |
| `1` `2` `3` | Kinetic / Karaoke / Poster |
| `T` | tap tempo |
| `[` / `]` | lyrics 0,1 s eerder / later |
| `F` | fullscreen |

## Goed om te weten

- Spotify levert zelf geen lyrics via de API, en de beat-analyse (`audio-analysis`) is niet meer beschikbaar voor nieuwe apps. Daarom LRCLIB en een geschat beat-grid.
- Niet elk nummer staat in LRCLIB. Zonder gesynchroniseerde lyrics scrollt de tekst op schatting mee.

## Code

```
src/
  spotify/   login (PKCE), Web API, afspeelstatus + Web Playback SDK
  lyrics/    LRCLIB-client, LRC-parser (incl. woord-timing)
  beat/      tempo schatten uit lyrics, tap tempo
  visual/    canvas-achtergrond, lyric-stijlen, kleurenpalet, animatieklok
  demo.ts    demo-nummer voor ?demo
```

`npm test` draait de unit tests, `npm run build` maakt een productie-build.
