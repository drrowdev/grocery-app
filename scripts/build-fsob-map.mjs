#!/usr/bin/env node
/**
 * Build FSOB lookup tables from data/fsob-fisv-ordbok.xml.
 *
 * Outputs src/lib/fsob-data.json with:
 *   {
 *     entries: Array<{ fisv: string[]; fi?: string; riks?: string[] }>,
 *     riksToFisv: Record<string, string>,  // rikssvenska -> Finland-Swedish
 *     fiToFisv: Record<string, string>,    // Finnish -> Finland-Swedish
 *     fisvToFi: Record<string, string>,    // Finland-Swedish -> Finnish
 *   }
 *
 * Source: Finlandssvensk ordbok (FSOB), © Institutet för de inhemska språken
 * (Kotus). Licensed CC BY 4.0. https://kotus.fi/sanakirjat/muita-sanakirjoja/finlandssvensk-ordbok
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const XML_PATH = resolve(__dirname, "..", "data", "fsob-fisv-ordbok.xml");
const OUT_PATH = resolve(__dirname, "..", "src", "lib", "fsob-data.json");

const xml = await readFile(XML_PATH, "utf8");

// Crude but reliable: split on <DictionaryEntry boundaries and parse each chunk.
const entries = [];
const entryRe = /<DictionaryEntry\b[^>]*>([\s\S]*?)<\/DictionaryEntry>/g;

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitComma(s) {
  return s
    .split(/[,;]| eller /i)
    .map((p) => p.trim())
    .filter(Boolean);
}

let m;
while ((m = entryRe.exec(xml)) !== null) {
  const body = m[1];

  const fisvWords = [];
  for (const hw of body.matchAll(/<Headword>([^<]+)<\/Headword>/g)) {
    fisvWords.push(stripTags(hw[1]));
  }

  let fi;
  const fiMatch = body.match(
    /<Etymology[^>]*xml:lang="fi"[^>]*>([\s\S]*?)<\/Etymology>/,
  );
  if (fiMatch) {
    // Strip nested tags, keep text content.
    fi = stripTags(fiMatch[1]);
    // Remove parenthetical comments like "(vanh.)"
    fi = fi.replace(/\([^)]*\)/g, "").trim();
  }

  const riks = [];
  for (const v of body.matchAll(
    /<Variant\b[^>]*class="recommended"[^>]*>([\s\S]*?)<\/Variant>/g,
  )) {
    splitComma(stripTags(v[1])).forEach((w) => riks.push(w));
  }
  for (const t of body.matchAll(/<Translation>([\s\S]*?)<\/Translation>/g)) {
    splitComma(stripTags(t[1])).forEach((w) => riks.push(w));
  }

  if (fisvWords.length === 0) continue;
  entries.push({
    fisv: fisvWords,
    fi: fi || undefined,
    riks: riks.length ? Array.from(new Set(riks)) : undefined,
  });
}

// Build lookup maps. Use the FIRST Finland-Swedish headword as the canonical FI-SV.
const riksToFisv = {};
const fiToFisv = {};
const fisvToFi = {};

for (const e of entries) {
  const canonicalFisv = e.fisv[0];
  if (e.riks) {
    for (const r of e.riks) {
      const k = r.toLowerCase();
      // Don't overwrite if a shorter (likely better) entry already exists.
      if (!riksToFisv[k]) riksToFisv[k] = canonicalFisv;
    }
  }
  if (e.fi) {
    // FI etymology can contain multiple comma-separated forms.
    for (const f of splitComma(e.fi)) {
      const k = f.toLowerCase();
      if (!fiToFisv[k]) fiToFisv[k] = canonicalFisv;
      if (!fisvToFi[canonicalFisv.toLowerCase()]) {
        fisvToFi[canonicalFisv.toLowerCase()] = f;
      }
    }
  }
  // Also map all FI-SV variants to the canonical form (so e.g. "limsa" -> "limonad")
  for (const v of e.fisv) {
    const k = v.toLowerCase();
    if (!fisvToFi[k] && e.fi) {
      fisvToFi[k] = splitComma(e.fi)[0];
    }
  }
}

const out = {
  source:
    "Finlandssvensk ordbok (FSOB) — Institutet för de inhemska språken (Kotus), CC BY 4.0",
  count: entries.length,
  riksToFisv,
  fiToFisv,
  fisvToFi,
};

await writeFile(OUT_PATH, JSON.stringify(out, null, 0));
console.log(
  `Parsed ${entries.length} entries -> ${Object.keys(riksToFisv).length} riks→FI-SV, ${Object.keys(fiToFisv).length} FI→FI-SV, ${Object.keys(fisvToFi).length} FI-SV→FI`,
);
console.log(`Wrote ${OUT_PATH}`);
