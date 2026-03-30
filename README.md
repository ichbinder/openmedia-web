# OpenMedia Web

Next.js Frontend für die CineScope Film-Plattform.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Theme:** Dunkles Cinema-Theme (oklch)
- **Daten:** TMDB API (serverseitig)
- **Auth:** JWT via httpOnly Cookie (Proxy zu openmedia-api)
- **Tests:** Vitest + Playwright

## Setup

```bash
# Dependencies installieren
npm install

# Playwright Browser installieren (für E2E)
npx playwright install chromium

# Dev-Server starten
npm run dev
```

## Umgebungsvariablen

```env
TMDB_API_KEY=dein-tmdb-api-key
BACKEND_URL=http://localhost:4000
```

## Seiten

- `/` — Trending-Startseite mit Hero-Banner
- `/search` — Filmsuche
- `/genres` — Genre-Übersicht
- `/movie/[id]` — Film-Detailseite
- `/login` — Anmelden
- `/register` — Registrieren
- `/watchlist` — Persönliche Watchlist
- `/downloads` — Bereitstellungen
- `/bibliothek` — Persönliche Bibliothek

## Tests

```bash
# Unit Tests
npm test

# E2E Tests (braucht laufende Server)
npm run test:e2e

# E2E mit UI
npm run test:e2e:ui
```

## API Proxy

Requests an `/api/backend/*` werden an den Express-Server weitergeleitet.
JWT wird als httpOnly Cookie gesetzt — kein Token im Browser-JavaScript sichtbar.
