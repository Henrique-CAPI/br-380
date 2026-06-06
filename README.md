# Brasileirão 38-0

Draft a starting XI from random Brazilian club squads — past and present — then simulate a 38-match Brasileirão season. Can you go undefeated?

## What it is

A web game in the spirit of the basketball game *82-0*, adapted for the Brazilian football championship (38 rounds = max 38 wins).

- **11 picks**, one per slot (4-3-3): GK · 4 DF · 3 MF · 3 FW
- Each round shows a random Brazilian club from a specific era
- Player ratings derived from real career stats (apps, goals) + championship bonuses
- After the draft, the season is simulated: W/D/L over 38 matches
- 38-0 is rare — roughly 1-9% chance at peak rating, depending on the draft

## Data sources

All free, all attributed:

- **English Wikipedia** — squad listings + per-player stats for ~80 club-seasons (via the MediaWiki API)
- **imortaisdofutebol.com** — classic-era starting XIs for ~50 legendary squads (Pelé's Santos, Zico's Flamengo, Cruzeiro 2003, etc.)
- **Wikipedia Commons** — 30 club crests, fetched via the Imageinfo API and converted to WebP

Total: **124 team-seasons across 28 distinct clubs**, spanning **1962 → 2025**.

## Tech

- React + Vite (no TypeScript)
- Framer Motion for transitions
- ~10 KB of localStorage for language persistence
- Plain CSS, no design system

## Run it

```bash
npm install
npm run dev   # → http://localhost:5173
```

## Regenerate the data

```bash
# Pull Wikipedia season pages (~5 min, cached locally afterwards)
node scripts/build-data.mjs > src/data.js

# Pull legendary classic squads from imortaisdofutebol.com
node scripts/imortais.mjs > .imortais-data.json

# Pull club crests from Wikipedia Commons, resize, convert to WebP
node scripts/fetch-logos.mjs
```

## Languages

EN / PT toggle in the header. All UI strings localized.

## License

MIT for the code. Data and logos belong to their respective sources (Wikipedia under CC BY-SA, club crests under fair use for editorial/non-commercial display).
