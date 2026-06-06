#!/usr/bin/env node
// Fetch club logos from Wikipedia (Commons), save to public/logos/, emit src/logos.js.
// Source: en.wikipedia.org via MediaWiki API.

import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(__dirname, "../public/logos");
if (!existsSync(PUB)) await mkdir(PUB, { recursive: true });

const UA = "brasileirao-380-research/1.0 (cph@insyght.io)";

// club display name → Wikipedia article title
const CLUBS = {
  "Santos FC": "Santos FC",
  "Palmeiras": "Sociedade Esportiva Palmeiras",
  "São Paulo FC": "São Paulo FC",
  "Flamengo": "Clube de Regatas do Flamengo",
  "Corinthians": "Sport Club Corinthians Paulista",
  "Vasco da Gama": "CR Vasco da Gama",
  "Internacional": "Sport Club Internacional",
  "Fluminense": "Fluminense FC",
  "Cruzeiro": "Cruzeiro Esporte Clube",
  "Atlético Mineiro": "Clube Atlético Mineiro",
  "Grêmio": "Grêmio Foot-Ball Porto Alegrense",
  "Botafogo": "Botafogo FR",
  "Bahia": "Esporte Clube Bahia",
  "Fortaleza": "Fortaleza Esporte Clube",
  "Náutico": "Clube Náutico Capibaribe",
  "Vitória": "Esporte Clube Vitória",
  "Bragantino": "Red Bull Bragantino",
  "Juventude": "Esporte Clube Juventude",
  "Ceará": "Ceará Sporting Club",
  "Chapecoense": "Associação Chapecoense de Futebol",
  "Coritiba": "Coritiba Foot Ball Club",
  "Criciúma": "Criciúma Esporte Clube",
  "Guarani": "Guarani FC",
  "Inter de Limeira": "Inter de Limeira",
  "Paulista": "Paulista FC",
  "Portuguesa": "Associação Portuguesa de Desportos",
  "São Caetano": "AD São Caetano",
  "Sport": "Sport Club do Recife",
  "Athletico-PR": "Club Athletico Paranaense",
  "Bangu": "Bangu Atlético Clube",
};

function slug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return res.json();
}

// Pull the infobox image filename from a club's Wikipedia article.
async function getInfoboxImage(wikiPage) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(wikiPage)}&format=json&prop=wikitext&redirects=1`;
  const json = await fetchJson(url);
  const wikitext = json?.parse?.wikitext?.["*"] || "";
  if (!wikitext) return null;
  // Try "image" then "logo".
  for (const field of ["image", "logo", "crest"]) {
    const rx = new RegExp(`^\\s*\\|\\s*${field}\\s*=\\s*([^\\n<]+)`, "im");
    const m = wikitext.match(rx);
    if (!m) continue;
    let val = m[1].trim();
    // Strip wikilink wrapper [[File:X|...]] or [[X]]
    val = val
      .replace(/^\[\[/, "")
      .replace(/\]\].*$/, "")
      .split("|")[0]
      .trim();
    val = val.replace(/^File:/i, "").replace(/^Image:/i, "").trim();
    if (val && /\.(svg|png|jpg|jpeg|webp)$/i.test(val)) return val;
  }
  return null;
}

async function getFileUrl(filename) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent("File:" + filename)}&prop=imageinfo&iiprop=url&format=json`;
  const json = await fetchJson(url);
  const pages = json?.query?.pages || {};
  for (const p of Object.values(pages)) {
    if (p.imageinfo?.[0]?.url) return p.imageinfo[0].url;
  }
  return null;
}

async function downloadFile(url, savePath) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  await writeFile(savePath, Buffer.from(buf));
  return buf.byteLength;
}

async function main() {
  const map = {};
  const failed = [];
  for (const [club, page] of Object.entries(CLUBS)) {
    try {
      console.error(`→ ${club} (Wikipedia: ${page})`);
      const filename = await getInfoboxImage(page);
      if (!filename) {
        console.error(`  ✗ no image field in infobox`);
        failed.push(club);
        continue;
      }
      console.error(`  image: ${filename}`);
      const url = await getFileUrl(filename);
      if (!url) {
        console.error(`  ✗ file URL not found`);
        failed.push(club);
        continue;
      }
      const ext = filename.split(".").pop().toLowerCase();
      const rasterExts = ["png", "jpg", "jpeg", "webp"];
      const isRaster = rasterExts.includes(ext);
      // SVG stays scalable; raster gets resized + WebP-ified (~10–20× smaller).
      const finalExt = isRaster ? "webp" : ext;
      const savePath = resolve(PUB, `${slug(club)}.${finalExt}`);
      if (isRaster) {
        const tmp = resolve(PUB, `${slug(club)}.${ext}`);
        await downloadFile(url, tmp);
        execSync(`cwebp -resize 256 0 -q 82 "${tmp}" -o "${savePath}"`, { stdio: "pipe" });
        await unlink(tmp);
      } else {
        await downloadFile(url, savePath);
      }
      const size = (await import("fs")).statSync(savePath).size;
      map[club] = `/logos/${slug(club)}.${finalExt}`;
      console.error(`  ✓ ${(size / 1024).toFixed(1)} KB → ${finalExt}`);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      failed.push(club);
    }
  }
  const out =
    `// AUTO-GENERATED by scripts/fetch-logos.mjs from en.wikipedia.org.\n` +
    `// Re-run: node scripts/fetch-logos.mjs\n\n` +
    `export const LOGOS = ${JSON.stringify(map, null, 2)};\n`;
  await writeFile(resolve(__dirname, "../src/logos.js"), out);
  console.error(`\nFetched ${Object.keys(map).length} / ${Object.keys(CLUBS).length} logos`);
  if (failed.length) console.error(`Failed: ${failed.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
