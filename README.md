# OpenMedia Web

Next.js Frontend für die OpenMedia Film-Plattform.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Theme:** Dunkles Cinema-Theme (oklch)
- **Daten:** TMDB API (serverseitig) + openmedia-api (via Proxy)
- **Auth:** JWT in localStorage
- **Tests:** Vitest (10 Tests)

## Architektur

```
Browser ──▶ openmedia-web ──Proxy──▶ openmedia-api
                │
           TMDB API (Filme, Bilder)
```

Der Proxy (`/api/backend/*` in `next.config.ts`) leitet Requests an openmedia-api weiter. Auth-Token wird in localStorage gespeichert und als Bearer-Header mitgeschickt.

## Setup

```bash
npm install
npm run dev   # → http://localhost:3000
```

## Seiten

| Route | Beschreibung |
|---|---|
| `/` | Trending-Startseite mit Hero-Banner |
| `/search` | Filmsuche mit Debounce + Suchhistorie (zuletzt angeklickte Filme) |
| `/genres` | Genre-Übersicht + gefilterte Grids |
| `/movie/[id]` | Film-Detail (Cast, Trailer, ähnliche Filme, Download-Button) |
| `/login` | Anmelden |
| `/register` | Registrieren |
| `/watchlist` | Persönliche Watchlist |
| `/downloads` | Download-Status (Live-Polling, Fortschrittsanzeige) |
| `/bibliothek` | Persönliche Bibliothek mit Presigned Download-Links |

## Features

### Suchhistorie
- Filme die in den Suchergebnissen angeklickt werden, werden in der DB gespeichert
- Suchseite zeigt "Zuletzt angesehen" Grid wenn kein Query aktiv
- Max. 50 Einträge pro User, Auto-Trim
- "Verlauf löschen" Button

### Watchlist
- Filme per Herz-Icon zur Watchlist hinzufügen/entfernen
- Optimistisches UI mit per-Item Rollback bei API-Fehler
- AbortController für Race-Condition-Schutz

### Downloads
- Live-Polling mit adaptivem Intervall (3s–15s, Backoff)
- Toast-Notifications bei Status-Änderungen
- Poster + Filmtitel + Fortschrittsbalken
- Download-Link für abgeschlossene Jobs

## Tests

```bash
npm test    # 10 Unit Tests (Vitest)
```

## Umgebungsvariablen

| Variable | Beschreibung | Hinweis |
|---|---|---|
| `TMDB_API_KEY` | TMDB API Key | **Build-Arg** (wird zur Build-Zeit eingebaked) |
| `BACKEND_URL` | openmedia-api URL | **Build-Arg** (default: `http://localhost:4000`) |

## Docker Deployment

```bash
docker build \
  --build-arg BACKEND_URL=http://api:4000 \
  --build-arg TMDB_API_KEY=your-key \
  -t openmedia-web .
```

**Wichtig:** `BACKEND_URL` und `TMDB_API_KEY` müssen als Docker Build-Args übergeben werden — Next.js evaluiert `process.env` zur Build-Zeit.

Production: Läuft hinter Caddy Reverse Proxy auf `https://mediatoken.de`.
