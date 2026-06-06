#!/usr/bin/env node
// Fetches Wikipedia season pages, parses squad data, emits src/data.js.
// Source: en.wikipedia.org via MediaWiki API (free, no key).

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(__dirname, "../.wiki-cache");
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

// ───────────────────────────────────────────────────────────────────────────
// Targets: derived dynamically from a candidate list of Big-12 club season pages.
// Club metadata (name+accent) is matched by substring of the page slug.
// Achievements (BR/LIB/MUN/CB) are auto-detected from the wikitext infobox.
// ───────────────────────────────────────────────────────────────────────────
const CLUBS = [
  // "Big 12" — the most well-known Brazilian clubs
  { match: /CR Flamengo|Clube de Regatas do Flamengo/, name: "Flamengo", accent: "#c80815" },
  { match: /CR Vasco|Vasco da Gama/, name: "Vasco da Gama", accent: "#000" },
  { match: /Fluminense/, name: "Fluminense", accent: "#7a1d2c" },
  { match: /Botafogo FR|Botafogo Futebol/, name: "Botafogo", accent: "#111" },
  { match: /Santos FC/, name: "Santos FC", accent: "#111" },
  { match: /São Paulo FC/, name: "São Paulo FC", accent: "#e60026" },
  { match: /SE Palmeiras|Sociedade Esportiva Palmeiras/, name: "Palmeiras", accent: "#1b6f3a" },
  { match: /Corinthians Paulista|Sport Club Corinthians|SC Corinthians/, name: "Corinthians", accent: "#111" },
  { match: /Sport Club Internacional|Internacional/, name: "Internacional", accent: "#d12027" },
  { match: /Grêmio FBPA|Grêmio Foot-Ball/, name: "Grêmio", accent: "#0a4595" },
  { match: /Cruzeiro EC|Cruzeiro Esporte/, name: "Cruzeiro", accent: "#0c50a5" },
  { match: /Atlético Mineiro/, name: "Atlético Mineiro", accent: "#000" },
  // Other Série A clubs — recurring participants and former champions
  { match: /Club Athletico Paranaense|Atlético Paranaense/, name: "Athletico-PR", accent: "#cc0033" },
  { match: /Esporte Clube Bahia/, name: "Bahia", accent: "#1c4cad" },
  { match: /Esporte Clube Vitória/, name: "Vitória", accent: "#c41e3a" },
  { match: /Coritiba Foot Ball Club/, name: "Coritiba", accent: "#0a5e30" },
  { match: /Sport Club do Recife|Sport Recife/, name: "Sport", accent: "#cc0033" },
  { match: /Fortaleza Esporte Clube/, name: "Fortaleza", accent: "#1056a0" },
  { match: /Ceará Sporting Club/, name: "Ceará", accent: "#000" },
  { match: /Goiás Esporte Clube/, name: "Goiás", accent: "#0e7a3e" },
  { match: /Clube Náutico Capibaribe/, name: "Náutico", accent: "#cc0033" },
  { match: /Chapecoense/, name: "Chapecoense", accent: "#00a651" },
  { match: /Avaí FC/, name: "Avaí", accent: "#005baa" },
  { match: /Cuiabá Esporte Clube/, name: "Cuiabá", accent: "#ffd700" },
  { match: /Esporte Clube Juventude/, name: "Juventude", accent: "#005f3d" },
  { match: /Figueirense FC/, name: "Figueirense", accent: "#000" },
  { match: /Red Bull Bragantino/, name: "Bragantino", accent: "#cc0033" },
];

function clubFor(slug) {
  for (const c of CLUBS) if (c.match.test(slug.replace(/_/g, " "))) return c;
  return null;
}

function loadCandidateSlugs() {
  const path = resolve(__dirname, "../.candidate-slugs.txt");
  if (existsSync(path)) {
    return readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
  }
  console.error("No candidate-slugs.txt found at", path);
  return [];
}

const TARGETS = loadCandidateSlugs()
  .map((title) => {
    const year = parseInt(title.slice(0, 4), 10);
    const club = clubFor(title);
    if (!year || !club) return null;
    const slug = title.replace(/ /g, "_");
    return { slug, name: club.name, year, accent: club.accent, achievements: [] };
  })
  .filter(Boolean);

console.error(`Targets: ${TARGETS.length} Big-12 candidate season pages`);

const UA = "brasileirao-380-research/1.0 (cph@insyght.io)";

async function fetchWikitext(slug) {
  const cachePath = resolve(CACHE, slug.replace(/[/]/g, "_") + ".wiki");
  if (existsSync(cachePath)) return readFileSync(cachePath, "utf8");
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(slug)}&format=json&prop=wikitext&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const json = await res.json();
  const text = json?.parse?.wikitext?.["*"] || "";
  writeFileSync(cachePath, text);
  return text;
}

// ───────────────────────────────────────────────────────────────────────────
// Parse helpers
// ───────────────────────────────────────────────────────────────────────────

// Strip wiki link syntax: [[X|Y]] → Y, [[X]] → X. Also italic/bold markers.
function unlink(s) {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''([^']+)'''/g, "$1")
    .replace(/''([^']+)''/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

// Normalize broad position: GK / DF / MF / FW
function normalizePos(raw) {
  if (!raw) return null;
  const p = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (p === "GK" || p.startsWith("GOAL")) return "GK";
  if (["DF", "RB", "LB", "CB", "RCB", "LCB", "SW", "RWB", "LWB", "FB", "DEF"].includes(p)) return "DF";
  if (["MF", "CM", "DM", "AM", "RM", "LM", "RDM", "LDM", "RCM", "LCM", "CDM", "CAM", "RAM", "LAM", "MID"].includes(p)) return "MF";
  if (["FW", "ST", "CF", "RF", "LF", "RW", "LW", "SS", "F", "FOR"].includes(p)) return "FW";
  return null;
}

// Find all top-level {{template|...}} blocks whose name matches the given regex.
// Handles nested {{...}} (e.g., {{flagicon|BRA}} inside) by counting braces.
function findTemplates(text, nameRx) {
  const results = [];
  let i = 0;
  while ((i = text.indexOf("{{", i)) !== -1) {
    // Find matching closing }}
    let depth = 1;
    let j = i + 2;
    while (j < text.length && depth > 0) {
      if (text[j] === "{" && text[j + 1] === "{") {
        depth++;
        j += 2;
      } else if (text[j] === "}" && text[j + 1] === "}") {
        depth--;
        j += 2;
      } else {
        j++;
      }
    }
    if (depth === 0) {
      const body = text.slice(i + 2, j - 2);
      const firstPipe = body.indexOf("|");
      const tmplName = (firstPipe < 0 ? body : body.slice(0, firstPipe)).trim();
      if (nameRx.test(tmplName)) {
        results.push({ name: tmplName, body: firstPipe < 0 ? "" : body.slice(firstPipe + 1) });
      }
      i = j;
    } else {
      break;
    }
  }
  return results;
}

// Split a template body by top-level | (not within nested {{...}})
function splitParams(body) {
  const parts = [];
  let depth = 0;
  let buf = "";
  for (let k = 0; k < body.length; k++) {
    const c = body[k];
    if (c === "{" && body[k + 1] === "{") {
      depth++;
      buf += c;
      continue;
    }
    if (c === "}" && body[k + 1] === "}") {
      depth--;
      buf += c;
      continue;
    }
    if (c === "[" && body[k + 1] === "[") {
      depth++;
      buf += c;
      continue;
    }
    if (c === "]" && body[k + 1] === "]") {
      depth--;
      buf += c;
      continue;
    }
    if (c === "|" && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  parts.push(buf);
  return parts.map((s) => s.trim());
}

// Parse all squad-player templates:
//   {{Extended football squad player|...}}  (with inline apps/goals)
//   {{Football squad player|...}}
//   {{fs player|...}}                       (identity only)
function parseSquadTemplates(wikitext) {
  const tmpls = findTemplates(
    wikitext,
    /^(?:Extended\s+)?(?:[Ff]ootball\s+squad\s+player|fs\s+player)$/i
  );
  const players = [];
  for (const t of tmpls) {
    const parts = splitParams(t.body);
    const named = {};
    const numbered = [];
    for (const p of parts) {
      const eq = p.indexOf("=");
      if (eq > 0) named[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
      else numbered.push(p);
    }
    const name = unlink(named.name || "");
    const pos = normalizePos(named.pos);
    if (!name || !pos) continue;
    let totalApps = 0;
    let totalGoals = 0;
    for (let i = 0; i < numbered.length; i++) {
      const v = numbered[i];
      const num = parseAppsValue(v);
      if (i % 2 === 0) totalApps += num;
      else totalGoals += num;
    }
    players.push({
      name,
      pos,
      nat: normalizeNat(named.nat || ""),
      apps: totalApps,
      goals: totalGoals,
      no: parseInt(named.no, 10) || null,
    });
  }
  return players;
}

function parseAppsValue(v) {
  if (!v) return 0;
  // "5+1" → 6, "5" → 5
  const parts = v.split("+").map((x) => parseInt(x.trim(), 10) || 0);
  return parts.reduce((a, b) => a + b, 0);
}

// Country name → ISO3 (small lookup; flagicon templates often use full names).
const NAT_NAME = {
  BRAZIL: "BRA", ARGENTINA: "ARG", URUGUAY: "URU", PARAGUAY: "PAR",
  CHILE: "CHI", COLOMBIA: "COL", PERU: "PER", VENEZUELA: "VEN",
  ECUADOR: "ECU", BOLIVIA: "BOL", PORTUGAL: "POR", SPAIN: "ESP",
  ITALY: "ITA", FRANCE: "FRA", ENGLAND: "ENG", NETHERLANDS: "NED",
  GERMANY: "GER", BELGIUM: "BEL",
};
function normalizeNat(raw) {
  if (!raw) return "";
  const r = raw.toUpperCase().trim();
  return NAT_NAME[r] || (r.length <= 3 ? r : r.slice(0, 3));
}

// Parse player rows from per-player stats wikitables. Each match is scoped to a
// SINGLE subsection (e.g. ===Appearances===) so the kind is unambiguous and
// neighbouring subsections don't bleed into one another.
function parseStatisticsTable(wikitext) {
  // First, segment the wikitext into (header, body) blocks at any =N=...=N= header.
  // Then process only those whose header matches a stat-section name.
  const headerRx = /(?:^|\n)(==+)\s*([^=\n]+?)\s*\1\s*(?=\n)/g;
  const segments = [];
  let last = 0;
  let lastHeader = "";
  let lastLevel = 0;
  let m;
  while ((m = headerRx.exec(wikitext)) !== null) {
    if (lastHeader) {
      segments.push({ header: lastHeader, level: lastLevel, body: wikitext.slice(last, m.index) });
    }
    lastHeader = m[2].trim();
    lastLevel = m[1].length;
    last = m.index + m[0].length;
  }
  if (lastHeader) segments.push({ header: lastHeader, level: lastLevel, body: wikitext.slice(last) });

  const kindFor = (h) => {
    const x = h.toLowerCase();
    if (x === "appearances") return "apps";
    if (x === "appearances and goals") return "combined";
    if (x === "statistics" || x === "squad statistics") return "combined";
    if (x === "scorers" || x === "top scorers" || x === "goalscorers" || x === "goal scorers")
      return "goals";
    return null;
  };

  const players = [];
  for (const seg of segments) {
    const kind = kindFor(seg.header);
    if (!kind) continue;
    const rows = seg.body.split(/\n\|-\s*\n/);
    for (const row of rows) {
      if (!/\b[Ff]lag\s?icon\b/i.test(row)) continue;
      const posMatch = row.match(
        /\|\s*(?:align[^|]*\|)?\s*(GK|DF|MF|FW|CB|RCB|LCB|RB|LB|RWB|LWB|SW|FB|CM|RCM|LCM|DM|CDM|AM|CAM|RAM|LAM|RM|LM|ST|CF|RF|LF|RW|LW|SS|F)\b/i
      );
      if (!posMatch) continue;
      const pos = normalizePos(posMatch[1]);
      const natMatch = row.match(/\{\{[Ff]lag\s?icon\|([^|}]+)/);
      const nat = natMatch ? normalizeNat(natMatch[1]) : "";
      const nameMatch = row.match(/[Ff]lag[ ]?icon[^}]*\}\}[^[]*?\[\[([^\]]+)\]\]/);
      if (!nameMatch) continue;
      const name = unlink("[[" + nameMatch[1] + "]]").trim();
      if (!name) continue;
      // Collect numeric cells. Format: "|N ||M" or "N||M". Strip {{sort|...|N}}.
      const afterFlag = row.slice(row.search(/[Ff]lag[ ]?icon/));
      const stripped = afterFlag
        .replace(/\{\{[Ss]ort\|[^|}]*\|([^}]+)\}\}/g, "$1")
        .replace(/\[\[[^\]]+\]\]/g, "");
      const cellRx = /(\d+)(?:\s*\(\s*\d+\s*\))?(?:\+(\d+))?/g;
      const nums = [];
      let cm;
      while ((cm = cellRx.exec(stripped)) !== null) {
        nums.push((parseInt(cm[1], 10) || 0) + (parseInt(cm[2], 10) || 0));
      }
      if (nums.length < 1) continue;
      let apps = 0,
        goals = 0;
      if (kind === "apps") {
        apps = Math.max(0, nums[nums.length - 1]);
      } else if (kind === "goals") {
        goals = Math.max(0, nums[nums.length - 1]);
      } else {
        // Combined apps+goals: even pairs preferred; odd → last is total apps.
        if (nums.length % 2 === 0) {
          apps = Math.max(0, nums[nums.length - 2]);
          goals = Math.max(0, nums[nums.length - 1]);
        } else {
          apps = Math.max(0, nums[nums.length - 1]);
        }
      }
      // Sanity bounds — single-season apps can't exceed ~90; goals ≤ 100 (Pelé/Coutinho hit 65).
      if (apps > 90) apps = 0;
      if (goals > 100) goals = 0;
      if (pos === "GK" && goals > 5) goals = 0;
      players.push({ name, pos, nat, apps, goals, no: null });
    }
  }
  return players;
}

// Parse classic "Goal scorers" wikitable rows:
// | rowspan="1" | 1
// | FW || 9 || align="left" |{{flagicon|BRA}} [[Nunes]]||21||16||6||2
// !45
function parseGoalScorersTable(wikitext) {
  const startIdx = wikitext.search(/==+\s*Goal\s*scorers?\s*==+/i);
  if (startIdx < 0) return [];
  const after = wikitext.slice(startIdx);
  const endIdx = after.search(/\n==+[^=]/);
  const section = after.slice(0, endIdx > 0 ? endIdx : undefined);
  const rows = section.split(/\|-\s*\n/);
  const players = [];
  for (const row of rows) {
    if (!/\b[Ff]lag\s?icon\b/i.test(row)) continue;
    // Position
    const posMatch = row.match(/\|\s*(GK|DF|MF|FW)\s*(?:\|\||\n)/i);
    if (!posMatch) continue;
    const pos = normalizePos(posMatch[1]);
    // Country
    const natMatch = row.match(/\{\{[Ff]lag\s?icon\|([A-Z]{2,3})/);
    const nat = natMatch ? natMatch[1].toUpperCase() : "";
    // Name (first [[link]] after flagicon)
    const nameMatch = row.match(/[Ff]lag[ ]?icon[^}]*\}\}\s*(\[\[[^\]]+\]\]|[^|<\n]+)/);
    let name = nameMatch ? unlink(nameMatch[1]).trim() : "";
    if (!name) continue;
    // Total goals from trailing "!NN"
    const totalMatch = row.match(/!\s*(\d+)\s*$/m);
    const goals = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    players.push({ name, pos, nat, apps: 0, goals, no: null });
  }
  return players;
}

// Parse a roster/squad wikitable. Handles multi-line cell layouts.
// Walks the ==Squad== / ==Roster== / ==First-team squad== sections.
function parseRosterTable(wikitext) {
  const sectionRx = /==+\s*(?:Squad|Roster|First[- ]team\s+squad|Players|Current\s+squad)\s*==+/gi;
  const players = [];
  let m;
  while ((m = sectionRx.exec(wikitext)) !== null) {
    const idx = m.index;
    const after = wikitext.slice(idx);
    const endIdx = after.slice(50).search(/\n==[^=]/);
    const section = after.slice(0, endIdx > 0 ? endIdx + 50 : undefined);
    const rows = section.split(/\n\|-\s*\n/);
    for (const row of rows) {
      if (!/\b[Ff]lag\s?icon\b/i.test(row)) continue;
      // Position: either bare GK/DF/MF/FW, or in a [[...|GK]] link.
      let posRaw = null;
      const linkPos = row.match(/\[\[[^\]]*\|(GK|DF|MF|FW|Goalkeeper|Defender|Midfielder|Forward)\]\]/i);
      if (linkPos) posRaw = linkPos[1];
      else {
        const bare = row.match(/\|\s*(?:align[^|]*\|)?\s*(GK|DF|MF|FW)\b/);
        if (bare) posRaw = bare[1];
      }
      if (!posRaw) continue;
      const pos = normalizePos(posRaw);
      if (!pos) continue;
      const natMatch = row.match(/\{\{[Ff]lag\s?icon\|([^|}]+)/);
      const nat = natMatch ? normalizeNat(natMatch[1]) : "";
      const nameMatch = row.match(/\[\[([^\]]+)\]\]/);
      if (!nameMatch) continue;
      const name = unlink("[[" + nameMatch[1] + "]]").trim();
      if (!name) continue;
      if (!players.find((p) => p.name === name)) {
        players.push({ name, pos, nat, apps: 0, goals: 0, no: null });
      }
    }
  }
  return players;
}

// Merge multiple parse sources by name.
function mergePlayers(arrays) {
  const map = new Map();
  for (const arr of arrays) {
    for (const p of arr) {
      const key = p.name.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.apps = Math.max(existing.apps, p.apps);
        existing.goals = Math.max(existing.goals, p.goals);
        if (!existing.no && p.no) existing.no = p.no;
        if (!existing.nat && p.nat) existing.nat = p.nat;
        if (!existing.pos && p.pos) existing.pos = p.pos;
      } else {
        map.set(key, { ...p });
      }
    }
  }
  return Array.from(map.values());
}

// Returns true if the season's primary league was top-flight (Brasileirão Série A
// or its earlier equivalents). Used to filter out Série B / Série C participants.
function checkTopFlight(wikitext) {
  const start = wikitext.indexOf("{{Infobox football club season");
  if (start < 0) return true; // Be lenient if no infobox; player parser will skip empty pages.
  const slice = wikitext.slice(start, start + 5000);
  const leagueMatch = slice.match(/\|\s*league\s*=\s*([^\n]+)/i);
  const league = leagueMatch ? unlink(leagueMatch[1]).toLowerCase() : "";
  if (/série [bcd]/.test(league)) return false;
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// Parse the infobox to derive the competitions won.
// Looks for `| league = X` + `| league result = Y` and `| cupN = X` + `| cupN result = Y` pairs.
// Y is a "winner" if it contains "Winners", "Champions", "Champion", or is exactly "1st".
// ───────────────────────────────────────────────────────────────────────────
function parseInfoboxAchievements(wikitext) {
  const start = wikitext.indexOf("{{Infobox football club season");
  if (start < 0) return [];
  // Find matching closing }}
  let depth = 1;
  let i = start + "{{Infobox football club season".length;
  while (i < wikitext.length && depth > 0) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i += 2;
    } else {
      i++;
    }
  }
  const infobox = wikitext.slice(start, i);
  // Walk line-by-line. A field starts with `|`, ends at next `|` at line-start.
  const fieldRx = /\n\s*\|\s*([a-z0-9]+(?:\s+[a-z0-9]+)?)\s*=\s*([^\n]+)/gi;
  const fields = {};
  let m;
  while ((m = fieldRx.exec(infobox)) !== null) {
    const key = m[1].toLowerCase().replace(/\s+/g, "");
    fields[key] = m[2].trim();
  }
  const isWinner = (s) => {
    if (!s) return false;
    const lower = unlink(s).toLowerCase();
    return /\bwinners?\b|\bchampions?\b|^\s*1st\s*$/.test(lower);
  };
  const competitionFor = (name) => {
    if (!name) return null;
    const n = unlink(name).toLowerCase();
    if (/série [bcd]/.test(n)) return null; // Lower divisions don't count.
    if (/série a|brasileiro|taça brasil|robertão|brasileirão/.test(n)) return "BR";
    if (/copa libertadores|libertadores/.test(n)) return "LIB";
    if (/copa do brasil/.test(n) && !/sub-/.test(n)) return "CB";
    if (/intercontinental cup|club world cup/.test(n)) return "MUN";
    return null;
  };
  const achievements = new Set();
  // league + league result, league2 + league2 result, cup1..N + cupN result
  const pairs = [
    ["league", "leagueresult"],
    ["league2", "league2result"],
  ];
  for (let n = 1; n <= 6; n++) pairs.push([`cup${n}`, `cup${n}result`]);
  for (const [compKey, resKey] of pairs) {
    const comp = competitionFor(fields[compKey]);
    if (comp && isWinner(fields[resKey])) achievements.add(comp);
  }
  return [...achievements];
}

// ───────────────────────────────────────────────────────────────────────────
// Rating: derived from apps, goals, championship bonus.
// Signals are normalised first to handle pages that report only goals or only apps.
// ───────────────────────────────────────────────────────────────────────────
function normalizeSignals(player, teamMaxApps) {
  // If pages give goals but no apps (e.g., Scorers-only tables), infer
  // starter status: any player picked into the XI was a contributor.
  let apps = player.apps;
  const goals = player.goals;
  if (apps < 5) {
    if (goals > 0) apps = Math.max(apps, Math.min(40, goals * 2 + 10));
    else if (teamMaxApps < 5) apps = 25; // entire page lacks apps data — assume starter
  }
  return { apps, goals };
}

function computeRating(p, achievements, teamMaxApps) {
  const sig = normalizeSignals(p, teamMaxApps);
  let r = 65;
  // Apps bonus: up to +12 for 60+ apps
  r += Math.min(12, Math.sqrt(sig.apps * 2));
  // Goals bonus by position
  if (p.pos === "FW") r += Math.min(15, sig.goals * 0.45);
  else if (p.pos === "MF") r += Math.min(12, sig.goals * 0.55);
  else if (p.pos === "DF") r += Math.min(8, sig.goals * 1.0);
  else if (p.pos === "GK") r += Math.min(6, sig.goals * 1.5); // GK goals (Ceni!) are rare
  // Championship bonus
  if (achievements.includes("BR")) r += 5;
  if (achievements.includes("LIB")) r += 5;
  if (achievements.includes("MUN")) r += 4;
  if (achievements.includes("CB")) r += 2;
  if (r > 99) r = 99;
  if (r < 60) r = 60;
  return Math.round(r);
}

// ───────────────────────────────────────────────────────────────────────────
// Pick 11: GK ×1, DF ×4, MF ×3, FW ×3 (4-3-3)
// Rank by "importance" = apps + goals*1.5, then pick top per position.
// ───────────────────────────────────────────────────────────────────────────
function pickEleven(players) {
  const importance = (p) => p.apps + p.goals * 1.5;
  const sorted = [...players].sort((a, b) => importance(b) - importance(a));
  const need = { GK: 1, DF: 4, MF: 3, FW: 3 };
  const picked = [];
  const filled = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const p of sorted) {
    if (filled[p.pos] < need[p.pos]) {
      picked.push(p);
      filled[p.pos]++;
    }
    if (picked.length === 11) break;
  }
  // Check if we hit all required positions
  const ok = Object.entries(need).every(([k, v]) => filled[k] === v);
  return { picked, complete: ok, filled };
}

// ───────────────────────────────────────────────────────────────────────────
// Generate team-era badge from accent color
// ───────────────────────────────────────────────────────────────────────────
function badgeFor(t) {
  const initials = t.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return initials;
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────
async function main() {
  const teams = [];
  const skipped = [];

  for (const t of TARGETS) {
    console.error(`Fetching ${t.slug}...`);
    let wikitext;
    try {
      wikitext = await fetchWikitext(t.slug);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      skipped.push({ slug: t.slug, reason: "fetch failed" });
      continue;
    }
    if (!wikitext || wikitext.length < 1000) {
      console.error(`  empty/redirect (size: ${wikitext.length})`);
      skipped.push({ slug: t.slug, reason: "empty" });
      continue;
    }

    const a = parseSquadTemplates(wikitext);
    const b = parseStatisticsTable(wikitext);
    const c = parseGoalScorersTable(wikitext);
    const d = parseRosterTable(wikitext);
    const merged = mergePlayers([a, b, c, d]);

    const { picked, complete, filled } = pickEleven(merged);
    if (!complete) {
      console.error(`  INCOMPLETE: got ${JSON.stringify(filled)}, raw players: ${merged.length}`);
      skipped.push({ slug: t.slug, reason: `incomplete: ${JSON.stringify(filled)}`, foundPlayers: merged.length });
      continue;
    }
    const achievements = parseInfoboxAchievements(wikitext);
    // Reject teams whose top-flight competition that season was Série B/C/D — out of scope.
    const isTopFlight = checkTopFlight(wikitext);
    if (!isTopFlight) {
      console.error(`  ✗ skipped (not Série A): ${t.slug}`);
      skipped.push({ slug: t.slug, reason: "not Série A" });
      continue;
    }
    console.error(`  ✓ ${picked.length} players (raw: ${merged.length}) [${achievements.join(",") || "—"}]`);

    teams.push({
      id: t.slug.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"),
      name: t.name,
      year: t.year,
      accent: t.accent,
      badge: badgeFor(t),
      achievements,
      players: picked.map((p) => {
        const teamMaxApps = Math.max(...picked.map((q) => q.apps));
        return {
          name: p.name,
          pos: p.pos,
          nat: p.nat || "BRA",
          apps: p.apps,
          goals: p.goals,
          rating: computeRating(p, achievements, teamMaxApps),
        };
      }),
    });
  }

  console.error(`\nIncluded (raw): ${teams.length} / ${TARGETS.length}`);
  console.error(`Skipped: ${skipped.length}`);

  // Merge in imortais.json (classic-era teams from imortaisdofutebol.com).
  const imortPath = resolve(__dirname, "../.imortais-data.json");
  if (existsSync(imortPath)) {
    const imortais = JSON.parse(readFileSync(imortPath, "utf8"));
    let added = 0;
    let dupes = 0;
    for (const it of imortais) {
      const collision = teams.find((t) => t.name === it.name && t.year === it.year);
      if (collision) {
        dupes++;
        continue;
      }
      teams.push(it);
      added++;
    }
    console.error(`Imortais merge: +${added} teams (${dupes} skipped as duplicates of Wikipedia entries)`);
  }

  // Per-club cap: keep variety by limiting how many seasons each club contributes.
  // Within a club, prefer (a) more titles, (b) higher weight title (LIB+MUN > LIB > BR > CB), (c) recency.
  const PER_CLUB_CAP = {
    default: 7,
    "São Paulo FC": 10,
    "Santos FC": 10,
    "Flamengo": 10,
    "Palmeiras": 10,
    "Corinthians": 10,
  };
  const TITLE_WEIGHT = { MUN: 4, LIB: 3, BR: 2, CB: 1 };
  function teamScore(t) {
    const titleScore = t.achievements.reduce((s, a) => s + (TITLE_WEIGHT[a] || 0), 0);
    return titleScore * 100 + t.year; // titles dominate, recency breaks ties
  }
  const byClub = new Map();
  for (const t of teams) {
    if (!byClub.has(t.name)) byClub.set(t.name, []);
    byClub.get(t.name).push(t);
  }
  const trimmed = [];
  for (const [clubName, list] of byClub) {
    list.sort((a, b) => teamScore(b) - teamScore(a));
    const cap = PER_CLUB_CAP[clubName] ?? PER_CLUB_CAP.default;
    trimmed.push(...list.slice(0, cap));
  }
  teams.length = 0;
  teams.push(...trimmed);
  console.error(`After per-club cap: ${teams.length} teams across ${byClub.size} clubs`);
  for (const [clubName, list] of byClub) {
    const kept = trimmed.filter((t) => t.name === clubName).length;
    console.error(`  ${clubName}: ${kept} / ${list.length}`);
  }

  // Emit data.js
  const out =
    `// AUTO-GENERATED by scripts/build-data.mjs from Wikipedia season pages.\n` +
    `// Source: en.wikipedia.org via MediaWiki API (CC BY-SA 4.0).\n` +
    `// Re-run: node scripts/build-data.mjs > src/data.js\n\n` +
    `export const TEAMS = ${JSON.stringify(teams, null, 2)};\n\n` +
    `// 4-3-3 broad formation. Each player has pos in {GK, DF, MF, FW}.\n` +
    `export const FORMATION = [\n` +
    `  { slot: "GK",  label: "Goalkeeper",  accepts: ["GK"] },\n` +
    `  { slot: "DF1", label: "Defender",    accepts: ["DF"] },\n` +
    `  { slot: "DF2", label: "Defender",    accepts: ["DF"] },\n` +
    `  { slot: "DF3", label: "Defender",    accepts: ["DF"] },\n` +
    `  { slot: "DF4", label: "Defender",    accepts: ["DF"] },\n` +
    `  { slot: "MF1", label: "Midfielder",  accepts: ["MF"] },\n` +
    `  { slot: "MF2", label: "Midfielder",  accepts: ["MF"] },\n` +
    `  { slot: "MF3", label: "Midfielder",  accepts: ["MF"] },\n` +
    `  { slot: "FW1", label: "Forward",     accepts: ["FW"] },\n` +
    `  { slot: "FW2", label: "Forward",     accepts: ["FW"] },\n` +
    `  { slot: "FW3", label: "Forward",     accepts: ["FW"] },\n` +
    `];\n`;
  process.stdout.write(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
