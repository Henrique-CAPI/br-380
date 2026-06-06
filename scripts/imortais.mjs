#!/usr/bin/env node
// Scrapes imortaisdofutebol.com for legendary Brazilian club squads (classic eras).
// Source: imortaisdofutebol.com (Esquadrões Imortais articles, free to read).
// Each article has a "Time base:" field with the starting XI in formation order,
// and a "Grandes feitos:" field listing championships won.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(__dirname, "../.imortais-cache");
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

// Indexed from https://imortaisdofutebol.com/lista-de-esquadroes/ filtered to
// Brazilian clubs whose era extends into 1960 or later.
const SLUGS = [
  "esquadrao-imortal-atletico-mg-1970-1971",
  "esquadrao-imortal-atletico-mg-1978-1983",
  "esquadrao-imortal-atletico-mg-2012-2014",
  "esquadrao-imortal-atletico-mg-2021",
  "esquadrao-imortal-atletico-pr-2001",
  "esquadrao-imortal-athletico-paranaense-2018-2019",
  "esquadrao-imortal-bahia-1959-1962",
  "esquadrao-imortal-bahia-1988",
  "esquadrao-imortal-bangu-1960",
  "esquadrao-imortal-botafogo-1957-1964",
  "esquadrao-imortal-botafogo-1967-1968",
  "esquadrao-imortal-botafogo-1995-1998",
  "esquadrao-imortal-botafogo-2024",
  "esquadrao-imortal-bragantino-1990-1991",
  "esquadrao-imortal-chapecoense-2016",
  "esquadrao-imortal-corinthians-1982-1984",
  "esquadrao-imortal-corinthians-1990",
  "corinthians-1995-1997",
  "esquadrao-imortal-corinthians-1998-2000",
  "esquadrao-imortal-corinthians-2011-2012",
  "esquadrao-imortal-coritiba-1985",
  "esquadrao-imortal-criciuma-1991-1992",
  "esquadrao-imortal-cruzeiro-1965-1969",
  "esquadrao-imortal-cruzeiro-1975-1976",
  "esquadrao-imortal-cruzeiro-1996-2000",
  "esquadrao-imortal-cruzeiro-2003",
  "esquadrao-imortal-flamengo-1980-1983",
  "esquadrao-imortal-flamengo-1990-1992",
  "esquadrao-imortal-flamengo-2019",
  "esquadrao-imortal-flamengo-2022",
  "esquadrao-imortal-flamengo-2024-2025",
  "esquadrao-imortal-fluminense-1969-1971",
  "esquadrao-imortal-fluminense-1975-1976",
  "esquadrao-imortal-fluminense-1983-1985",
  "esquadrao-imortal-fluminense-2007-2012",
  "esquadrao-imortal-fluminense-2008",
  "esquadrao-imortal-fluminense-2023",
  "esquadrao-imortal-fortaleza-2018-2022",
  "esquadrao-imortal-gremio-1977",
  "esquadrao-imortal-gremio-1981-1983",
  "esquadrao-imortal-gremio-1994-1997",
  "esquadrao-imortal-gremio-2016-2018",
  "esquadrao-imortal-guarani-1978",
  "esquadrao-imortal-inter-de-limeira-1986",
  "esquadrao-imortal-internacional-1975-1976",
  "esquadrao-imortal-internacional-1979-1980",
  "esquadrao-imortal-internacional-2006-2008",
  "esquadrao-imortal-juventude-1998-1999",
  "esquadrao-imortal-palmeiras-1959-1969",
  "esquadrao-imortal-palmeiras-1972-1974",
  "esquadrao-imortal-palmeiras-1993-1994",
  "esquadrao-imortal-palmeiras-1996",
  "esquadrao-imortal-palmeiras-1998-2000",
  "esquadrao-imortal-palmeiras-2020-2022",
  "esquadrao-imortal-paulista-2005",
  "esquadrao-imortal-portuguesa-1996",
  "esquadrao-imortal-santo-andre-2004",
  "esquadrao-imortal-santos-1960-1969",
  "esquadrao-imortal-santos-2002-2004",
  "esquadrao-imortal-santos-2010-2012",
  "esquadrao-imortal-sao-caetano-2000-2002",
  "esquadrao-imortal-sao-paulo-1985-1987",
  "esquadrao-imortal-sao-paulo-1991-1994",
  "esquadrao-imortal-sao-paulo-2005-2006",
  "esquadrao-imortal-sao-paulo-2006-2008",
  "esquadrao-imortal-sport-2008",
  "esquadrao-imortal-vasco-1974",
  "esquadrao-imortal-vasco-1987-1989",
  "esquadrao-imortal-vasco-1997-1998",
  "esquadrao-imortal-vasco-2000",
];

const UA = "brasileirao-380-research/1.0 (cph@insyght.io)";

async function fetchHtml(slug) {
  const cachePath = resolve(CACHE, slug + ".html");
  if (existsSync(cachePath)) return readFileSync(cachePath, "utf8");
  const res = await fetch(`https://imortaisdofutebol.com/${slug}/`, { headers: { "User-Agent": UA } });
  const text = await res.text();
  writeFileSync(cachePath, text);
  return text;
}

// Map URL slug → { clubName, accent, yearMin, yearMax }
const CLUB_MAP = {
  "atletico-mg": { name: "Atlético Mineiro", accent: "#000" },
  "atletico-pr": { name: "Athletico-PR", accent: "#cc0033" },
  "athletico-paranaense": { name: "Athletico-PR", accent: "#cc0033" },
  "bahia": { name: "Bahia", accent: "#1c4cad" },
  "bangu": { name: "Bangu", accent: "#cc0033" },
  "botafogo": { name: "Botafogo", accent: "#111" },
  "bragantino": { name: "Bragantino", accent: "#cc0033" },
  "chapecoense": { name: "Chapecoense", accent: "#00a651" },
  "corinthians": { name: "Corinthians", accent: "#111" },
  "coritiba": { name: "Coritiba", accent: "#0a5e30" },
  "criciuma": { name: "Criciúma", accent: "#ffd700" },
  "cruzeiro": { name: "Cruzeiro", accent: "#0c50a5" },
  "flamengo": { name: "Flamengo", accent: "#c80815" },
  "fluminense": { name: "Fluminense", accent: "#7a1d2c" },
  "fortaleza": { name: "Fortaleza", accent: "#1056a0" },
  "gremio": { name: "Grêmio", accent: "#0a4595" },
  "guarani": { name: "Guarani", accent: "#1b6f3a" },
  "inter-de-limeira": { name: "Inter de Limeira", accent: "#000" },
  "internacional": { name: "Internacional", accent: "#d12027" },
  "juventude": { name: "Juventude", accent: "#005f3d" },
  "palmeiras": { name: "Palmeiras", accent: "#1b6f3a" },
  "paulista": { name: "Paulista", accent: "#000" },
  "portuguesa": { name: "Portuguesa", accent: "#1b6f3a" },
  "santo-andre": { name: "Santo André", accent: "#ffd700" },
  "santos": { name: "Santos FC", accent: "#111" },
  "sao-caetano": { name: "São Caetano", accent: "#1056a0" },
  "sao-paulo": { name: "São Paulo FC", accent: "#e60026" },
  "sport": { name: "Sport", accent: "#cc0033" },
  "vasco": { name: "Vasco da Gama", accent: "#000" },
};

function clubForSlug(slug) {
  // Slug shapes: "esquadrao-imortal-CLUB-YEARS" or "CLUB-YEARS" (rare)
  let body = slug.replace(/^esquadrao-imortal-/, "");
  // Extract trailing year span: e.g., "1981-1983" or "2003"
  const yearMatch = body.match(/-((?:19|20)\d{2}(?:-\d{4})?)$/);
  if (!yearMatch) return null;
  const yearPart = yearMatch[1];
  const clubKey = body.slice(0, yearMatch.index);
  const club = CLUB_MAP[clubKey];
  if (!club) return null;
  const [a, b] = yearPart.split("-").map(Number);
  return { ...club, yearMin: a, yearMax: b || a };
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#[0-9]+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract the starting-XI string from the article HTML.
// Different pages use either "Time base:" or "Time-base:".
function extractTimeBase(html) {
  const idx = html.search(/Time[\s\-]+base/i);
  if (idx < 0) return null;
  const pStart = html.lastIndexOf("<p", idx);
  const pEnd = html.indexOf("</p>", idx);
  if (pStart < 0 || pEnd < 0) return null;
  const paragraph = stripTags(html.slice(pStart, pEnd));
  const m = paragraph.match(/Time[\s\-]+base\s*:?\s*([^.]+(?:\.[^.]+)*)/i);
  if (!m) return null;
  let line = m[1];
  const stop = line.search(/T[éeê]cnico|Reservas?|Grandes\s+feitos|Esquadr[ãa]o/i);
  if (stop > 0) line = line.slice(0, stop);
  return line.trim().replace(/\.$/, "");
}

// Extract "Grandes feitos:" string for achievement detection.
function extractFeitos(html) {
  const idx = html.search(/Grandes\s*feitos/i);
  if (idx < 0) return null;
  const pStart = html.lastIndexOf("<p", idx);
  const pEnd = html.indexOf("</p>", idx);
  if (pStart < 0 || pEnd < 0) return null;
  const paragraph = stripTags(html.slice(pStart, pEnd));
  const m = paragraph.match(/Grandes\s*feitos\s*:?\s*(.+)/i);
  return m ? m[1].trim() : null;
}

// Parse the Time base XI string into 11 players slotted into 4-3-3.
// Format varies: 4-4-2, 4-3-3, 4-2-4, 4-2-3-1, etc. The string is always
// "GK; defense; ...middle groups...; attack" with the first group being GK
// and the last being the most attacking line. We flatten 'middle + final'
// into 6 outfield names beyond GK+DF and split them 3 MF / 3 FW.
function parseLineup(timeBaseStr) {
  const groups = timeBaseStr.split(";").map((g) => g.trim()).filter(Boolean);
  if (groups.length < 3) return null;
  function namesIn(group) {
    const cleaned = group.replace(/\([^)]*\)/g, "").replace(/&nbsp;/g, " ");
    return cleaned
      .split(/,| e | E /)
      .map((s) => s.trim().replace(/[.,;]$/, "").replace(/\s+/g, " "))
      .filter((s) => s.length > 1 && !/^\d+$/.test(s));
  }
  const gks = namesIn(groups[0]);
  const dfs = namesIn(groups[1]);
  const restGroups = groups.slice(2);
  const rest = restGroups.flatMap(namesIn);

  if (gks.length < 1 || dfs.length < 4 || rest.length < 6) return null;

  const players = [];
  players.push({ name: gks[0], pos: "GK" });
  for (const n of dfs.slice(0, 4)) players.push({ name: n, pos: "DF" });
  for (const n of rest.slice(0, 3)) players.push({ name: n, pos: "MF" });
  for (const n of rest.slice(3, 6)) players.push({ name: n, pos: "FW" });

  // Sanity: 11 distinct non-empty names.
  if (players.length !== 11) return null;
  const seen = new Set();
  for (const p of players) {
    if (!p.name || seen.has(p.name)) return null;
    seen.add(p.name);
  }
  return players;
}

// Map Portuguese achievement names to BR/LIB/MUN/CB.
function parseFeitos(feitosStr) {
  const found = new Set();
  if (!feitosStr) return [];
  const lower = feitosStr.toLowerCase();
  if (/(campeão|campeonato|tricampeão|tetracampeão|pentacampeão|bicampeão).*brasileiro|brasileirão|taça brasil|robertão/i.test(feitosStr))
    found.add("BR");
  if (/copa\s+libertadores|libertadores da américa/i.test(feitosStr)) found.add("LIB");
  if (/mundial\s+interclubes|copa intercontinental|clube mundial|club world cup|fifa club world cup|mundial de clubes/i.test(feitosStr))
    found.add("MUN");
  if (/copa do brasil/i.test(feitosStr)) found.add("CB");
  return [...found];
}

// Choose a representative year for the era.
// Preference: the most recent year with a major title; else mid-range; else yearMax.
function pickYear(yearMin, yearMax, feitosStr) {
  if (!feitosStr) return Math.floor((yearMin + yearMax) / 2);
  const titleYears = [];
  const yearRx = /\b(19|20)\d{2}\b/g;
  let m;
  while ((m = yearRx.exec(feitosStr)) !== null) {
    const y = parseInt(m[0], 10);
    if (y >= yearMin && y <= yearMax) titleYears.push(y);
  }
  if (titleYears.length === 0) return Math.floor((yearMin + yearMax) / 2);
  // Use the most-mentioned year.
  const freq = {};
  for (const y of titleYears) freq[y] = (freq[y] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  return parseInt(sorted[0][0], 10);
}

// Compute rating for an imortais starter. Based on team-level championship tier.
// We lack per-player apps/goals here, so ratings are tier-based with position spread.
function teamTierRating(achievements) {
  let base = 78;
  if (achievements.includes("MUN")) base = 88;
  else if (achievements.includes("LIB")) base = 85;
  else if (achievements.includes("BR")) base = 82;
  else if (achievements.includes("CB")) base = 80;
  return base;
}

function ratingFor(pos, idx, teamBase) {
  // Within a team, FW get slight bump, GK gets slight dip, DF/MF mid.
  // First-listed at each position typically = highest profile.
  let r = teamBase;
  if (pos === "FW") r += 4;
  else if (pos === "MF") r += 2;
  else if (pos === "DF") r += 0;
  else if (pos === "GK") r -= 1;
  // First slot of each position group is the star — small bump.
  if (idx === 0) r += 2;
  return Math.min(99, Math.max(60, r));
}

async function main() {
  const teams = [];
  const failed = [];
  for (const slug of SLUGS) {
    const club = clubForSlug(slug);
    if (!club) {
      failed.push({ slug, reason: "unknown club mapping" });
      continue;
    }
    // Skip pre-1960 (state-era teams).
    if (club.yearMax < 1960) {
      failed.push({ slug, reason: `pre-1960 (${club.yearMax})` });
      continue;
    }
    const html = await fetchHtml(slug);
    if (!html || html.length < 2000) {
      failed.push({ slug, reason: "fetch empty" });
      continue;
    }
    const timeBase = extractTimeBase(html);
    if (!timeBase) {
      failed.push({ slug, reason: "no Time base" });
      continue;
    }
    const players = parseLineup(timeBase);
    if (!players) {
      failed.push({ slug, reason: "lineup parse failed", timeBase });
      continue;
    }
    const feitos = extractFeitos(html);
    const achievements = parseFeitos(feitos);
    const year = pickYear(club.yearMin, club.yearMax, feitos);
    const teamBase = teamTierRating(achievements);
    // Star-bump first FW (typically the main scorer / icon).
    const grouped = { GK: [], DF: [], MF: [], FW: [] };
    for (const p of players) grouped[p.pos].push(p);
    const enriched = [];
    for (const pos of ["GK", "DF", "MF", "FW"]) {
      grouped[pos].forEach((p, i) => {
        enriched.push({ ...p, rating: ratingFor(pos, i, teamBase), nat: "BRA", apps: 0, goals: 0 });
      });
    }

    teams.push({
      id: slug,
      name: club.name,
      year,
      yearMin: club.yearMin,
      yearMax: club.yearMax,
      accent: club.accent,
      badge: club.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase(),
      achievements,
      players: enriched,
      source: "imortais",
    });
    console.error(`✓ ${slug} → ${club.name} ${year} [${achievements.join(",") || "—"}]`);
  }
  console.error(`\nParsed ${teams.length} / ${SLUGS.length} imortais teams`);
  console.error(`Failed: ${failed.length}`);
  for (const f of failed) console.error(`  - ${f.slug}: ${f.reason}`);

  // Output JSON for build-data.mjs to consume.
  process.stdout.write(JSON.stringify(teams, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
