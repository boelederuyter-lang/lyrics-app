# Lyrics

Verbind met Spotify en zie de lyrics van wat je luistert als een strakke zwart-wit lyric-video: woorden slaan erin op het moment dat ze gezongen worden, alles knikt mee op de beat.

## Wat zit erin

- **Spotify-koppeling** (login zonder backend via PKCE).
  - **Telefoon**: speel af in de Spotify-app, de lyrics volgen mee.
  - **Computer**: kan ook direct in de browser afspelen (Web Playback SDK, Premium).
- **Gesynchroniseerde lyrics** via [LRCLIB](https://lrclib.net) (gratis). Timing per woord als de bron die heeft, anders geschat.
- **3 stijlen**: `Hard` (één regel groot, woorden slaan erin), `Flow` (meekleurende regels), `Stack` (cover-achtige blokletters).
- **Op de beat**: tempo geschat uit de lyric-timing. Klopt het niet? Tik mee met **Tap beat**, of gebruik ½ / ×2 (onder de instellingenknop).
- **Sync per nummer**: met **Tik-sync** tik je drie keer als een regel begint; de app rekent de vertraging uit en onthoudt die per nummer. Nieuwe nummers starten met je gebruikelijke vertraging (handig met Bluetooth-oortjes).
- **Albumhoes op de achtergrond**: scherp in het midden met een wazige versie eromheen. Donkerder als er tekst staat, helder tijdens instrumentale stukken. Te wisselen tussen kleur, zwart-wit en alleen vaag (instellingen → *Hoes*).
- Grijstinten voor de tekst, filmkorrel, flits bij elke nieuwe regel.
- **Web-app voor je telefoon**: zet hem op je beginscherm, dan opent hij fullscreen en blijft het scherm aan.
- **Demo** zonder Spotify: open de app met `?demo`.

## Online zetten (GitHub Pages)

De workflow in `.github/workflows/deploy.yml` bouwt en publiceert de app bij elke push naar `main`.

1. GitHub → repo → **Settings → Pages** → bij *Source* kies **GitHub Actions**.
2. Merge naar `main`. De app komt op `https://<gebruiker>.github.io/lyrics-app/`.

## Spotify instellen (eenmalig)

1. Maak een app op [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), vink **Web API** en **Web Playback SDK** aan.
2. Redirect URI's toevoegen:
   - online: `https://<gebruiker>.github.io/lyrics-app/`
   - lokaal: `http://127.0.0.1:5173/` (Spotify accepteert geen `localhost`)
3. Client ID: plak hem in de app bij de eerste keer openen, **of** zet hem als repository variable `SPOTIFY_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables). Dan hoeven je vrienden niks in te vullen.
4. Vrienden toevoegen: dashboard → je app → **User Management** (naam + e-mail van hun Spotify-account).

## Delen met vrienden

In de app: instellingen → **Deel Lyrics**. Daar staat wat je moet doen:

1. Zet je vriend op de lijst in het Spotify-dashboard (**User Management**, max. 5 mensen).
2. Stuur de link. Jouw Client ID zit in de link (`?client=…`), dus je vriend hoeft niks in te stellen.
3. Een iPhone bewaart de app op het beginscherm los van Safari. Daar vraagt Lyrics één keer om de link: **Plak uitnodiging**.

Wil je dat niemand ooit iets hoeft te plakken? Zet je Client ID als repository variable `SPOTIFY_CLIENT_ID` (zie hierboven), dan zit hij in de app zelf.

Staat een vriend nog niet op de lijst, dan laat Lyrics dat duidelijk zien (**Nog geen toegang**). Zonder Premium werken de lyrics wel, maar bedienen kan alleen in Spotify zelf.

## Op je telefoon

- **iPhone**: open de link in Safari → deel-knop → *Zet op beginscherm*.
- **Android**: open in Chrome → menu ⋮ → *App installeren* / *Toevoegen aan startscherm*.

Start een nummer in de Spotify-app en ga terug naar Lyrics. Werkt op iPhone en Android hetzelfde.

### Afspelen bedienen vanuit de app

Play/pauze, vorige en volgende werken via Spotify Connect: de muziek speelt in de Spotify-app, Lyrics is de afstandsbediening.

- Staat Spotify al een tijdje op pauze, dan zet je telefoon de Spotify-app in slaapstand. Lyrics zoekt dan je telefoon in je Spotify-apparaten en start daar (nooit vanzelf op een speaker of tv).
- Slaapt Spotify helemaal, dan verschijnt **Open Spotify**. Even openen en teruggaan naar Lyrics is genoeg: de muziek start vanzelf.
- Op een iPhone gaat Spotify sneller slapen dan op Android.

## Lokaal ontwikkelen

```bash
npm install
npm run dev     # → http://127.0.0.1:5173
npm test
```

Client ID kan lokaal ook in `.env` (zie `.env.example`).

## Sneltoetsen (computer)

| Toets | Actie |
| --- | --- |
| `Spatie` | play / pauze |
| `←` / `→` | 5 s terug / vooruit |
| `N` / `P` | volgend / vorig nummer |
| `1` `2` `3` | Hard / Flow / Stack |
| `T` | tap tempo |
| `S` | tik-sync (daarna `Spatie` als de regel begint, `Esc` om te stoppen) |
| `H` | achtergrond: hoes in kleur / zwart-wit / vaag |
| `[` / `]` | lyrics 0,1 s eerder / later |
| `F` | fullscreen |

## Goed om te weten

- Spotify levert zelf geen lyrics via de API, en de beat-analyse is niet meer beschikbaar voor nieuwe apps. Daarom LRCLIB en een geschat beat-grid.
- Als je met de telefoon in de Spotify-app afspeelt, vraagt de app elke paar seconden de positie op en rekent daartussen zelf door. Kleine afwijkingen worden geleidelijk bijgestuurd (geen sprongen terug), en vlak na het einde van een nummer wordt meteen het volgende opgehaald.
- Woord-timing wordt geschat op lettergrepen als de lyrics-bron alleen het begin van elke regel geeft.
