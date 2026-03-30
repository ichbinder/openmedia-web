# OpenMedia Web

Next.js Frontend für die OpenMedia Film-Plattform.

> 📚 **Gesamtdokumentation:** [openmedia-docs](https://github.com/ichbinder/openmedia-docs)

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Theme:** Dunkles Cinema-Theme (oklch)
- **Daten:** TMDB API (serverseitig) + openmedia-api (via Proxy)
- **Auth:** JWT via httpOnly Cookie
- **Tests:** Vitest (10) + Playwright E2E (10)

## Architektur

```
Browser ──▶ openmedia-web ──Proxy──▶ openmedia-api
                │
           TMDB API (Filme, Bilder)
```

Der Proxy (`/api/backend/*`) leitet Requests an openmedia-api weiter und handelt JWT-Cookies automatisch.

## Setup

```bash
npm install
npx playwright install chromium  # für E2E-Tests
npm run dev   # → http://localhost:3000
```

## Seiten

| Route | Beschreibung |
|---|---|
| `/` | Trending-Startseite mit Hero-Banner |
| `/search` | Filmsuche mit Debounce |
| `/genres` | Genre-Übersicht + gefilterte Grids |
| `/movie/[id]` | Film-Detail (Cast, Trailer, ähnliche Filme) |
| `/login` | Anmelden |
| `/register` | Registrieren |
| `/watchlist` | Persönliche Watchlist |
| `/downloads` | Bereitstellungen (Mock) |
| `/bibliothek` | Persönliche Bibliothek (Mock) |

## Tests

```bash
npm test          # 10 Unit Tests (Vitest)
npm run test:e2e  # 10 E2E Tests (Playwright)
```

## Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `TMDB_API_KEY` | TMDB API Key |
| `BACKEND_URL` | openmedia-api URL (default: `http://localhost:4000`) |
