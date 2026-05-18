#!/usr/bin/env node
/**
 * Ingest Finnish products from Open Food Facts.
 *
 * Source: https://world.openfoodfacts.org — CC BY-SA 4.0
 *
 * Pages through products tagged `countries_tags=finland`, extracts
 * FI/SV names, brand, and maps OFF's category taxonomy to our 14 keys.
 * Outputs src/lib/product-catalog-data.json as a Map<lowercased_name, entry>.
 *
 * Run: `node scripts/build-product-catalog.mjs`
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "src", "lib", "product-catalog-data.json");

const PAGE_SIZE = 100;
const MAX_PAGES = 60; // 6000 products — enough coverage, manageable size
const FIELDS = [
  "product_name",
  "product_name_fi",
  "product_name_sv",
  "brands",
  "categories_tags",
].join(",");

// OFF category tag -> our category key. Order specific to general.
// Matched against tags stripped of "en:" prefix.
const CATEGORY_RULES = [
  // Dairy / eggs
  [/^(eggs|chicken-eggs|hen-eggs)$/, "dairy"],
  [/^(cheeses?|milks?|yogurts?|butters?|creams?|fermented-milk-products?|dairies|dairy-desserts|crème-fraîches?)$/, "dairy"],
  // Meat / fish
  [/^(meats?|sausages?|hams?|charcuteries?|bacons?|prepared-meats?|ground-meats?|chicken|beef|pork)$/, "meat"],
  [/^(fishes?|seafood|salmons?|tunas?|smoked-fishes?|canned-fishes?)$/, "fish"],
  // Bakery
  [/^(breads?|rye-breads?|pastries|cookies|biscuits|crackers|crispbreads?|baguettes?|pita-breads?)$/, "bakery"],
  // Produce — be strict so we don't catch "plant-based-foods" generically
  [/^(fruits?|vegetables?|leafy-vegetables?|root-vegetables?|fresh-vegetables?|fresh-fruits?|salads?|herbs|berries|apples?|bananas?|potatoes|carrots|onions|tomatoes|cucumbers|peppers|lettuces?|cabbages?|mushrooms?|garlics?)$/, "produce"],
  // Frozen
  [/^(frozen-foods?|frozen-vegetables?|frozen-fruits?|ice-creams?|frozen-meals?|frozen-pizzas?)$/, "frozen"],
  // Dry goods
  [/^(cereals?|breakfast-cereals?|pastas?|rices?|flours?|grains?|legumes?|oats?|mueslis?|granolas?|cooking-oils?|sugars?)$/, "dry_goods"],
  // Canned
  [/^(canned-foods?|preserved-foods?|canned-vegetables?|canned-fruits?|canned-soups?|canned-fishes?)$/, "canned"],
  // Spices / condiments
  [/^(spices|salts?|ground-spices?|peppers?|condiments|sauces|mustards?|ketchups?|vinegars?|herbs-and-spices)$/, "spices"],
  // Drinks
  [/^(beverages?|waters?|juices?|coffees?|teas?|sodas?|beers?|wines?|alcoholic-beverages|non-alcoholic-beverages|plant-based-beverages?|plant-based-milks?)$/, "drinks"],
  // Snacks
  [/^(snacks?|chocolates?|candies|sweets|confectionaries|chips|crisps|nuts|dried-fruits?|cereal-bars?)$/, "snacks"],
  // Non-food
  [/^(hygiene|cosmetics|personal-care|toothpaste|shampoo|soap)$/, "hygiene"],
  [/^(cleaning|household|laundry-detergent|dish-soap|paper-towels?|toilet-papers?)$/, "household"],
];

function mapCategory(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "other";
  // OFF lists tags from broad to specific; iterate REVERSED so specific
  // tags (like 'breads' or 'cheeses') win over generic ones
  // (like 'plant-based-foods-and-beverages').
  for (let i = tags.length - 1; i >= 0; i--) {
    const stripped = String(tags[i]).replace(/^en:/, "");
    for (const [re, key] of CATEGORY_RULES) {
      if (re.test(stripped)) return key;
    }
  }
  return "other";
}

function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip a leading brand from a product name: "Valio Oltermanni" → "Oltermanni". */
function stripBrand(name, brands) {
  const base = normalize(name);
  if (!brands) return base;
  const brandList = String(brands)
    .split(",")
    .map((b) => normalize(b))
    .filter(Boolean);
  let s = base;
  for (const b of brandList) {
    if (s.startsWith(b + " ")) s = s.slice(b.length + 1).trim();
    if (s.endsWith(" " + b)) s = s.slice(0, -b.length - 1).trim();
  }
  return s;
}

async function fetchPage(page) {
  const url = `https://world.openfoodfacts.org/api/v2/search?countries_tags=finland&fields=${FIELDS}&page_size=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Ostoslista-Build/1.0 (https://github.com/drrowdev/grocery-app)" },
  });
  if (!res.ok) throw new Error(`OFF page ${page}: HTTP ${res.status}`);
  return res.json();
}

const catalog = new Map();

for (let page = 1; page <= MAX_PAGES; page++) {
  process.stdout.write(`Fetching page ${page}/${MAX_PAGES}…\r`);
  let data;
  try {
    data = await fetchPage(page);
  } catch (e) {
    console.warn(`\nPage ${page} failed:`, e.message);
    continue;
  }
  const products = data.products ?? [];
  if (products.length === 0) {
    console.log(`\nNo more products at page ${page}.`);
    break;
  }
  for (const p of products) {
    const nameFi = p.product_name_fi || p.product_name;
    const nameSv = p.product_name_sv || p.product_name;
    if (!nameFi && !nameSv) continue;
    const category = mapCategory(p.categories_tags);
    const brand = (p.brands || "").split(",")[0].trim() || null;

    // Index multiple keys so users can match different spellings
    const keys = new Set();
    if (nameFi) {
      keys.add(normalize(nameFi));
      const stripped = stripBrand(nameFi, p.brands);
      if (stripped && stripped !== normalize(nameFi)) keys.add(stripped);
    }
    if (nameSv && nameSv !== nameFi) {
      keys.add(normalize(nameSv));
      const stripped = stripBrand(nameSv, p.brands);
      if (stripped && stripped !== normalize(nameSv)) keys.add(stripped);
    }

    const entry = {
      fi: nameFi || nameSv,
      sv: nameSv || nameFi,
      brand,
      category,
    };

    for (const k of keys) {
      if (!k || k.length < 2 || k.length > 80) continue;
      if (!catalog.has(k)) catalog.set(k, entry);
    }
  }
  // Polite throttle
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`\nCollected ${catalog.size} unique normalized product names.`);

const map = {};
for (const [k, v] of catalog) map[k] = v;

const out = {
  source:
    "Open Food Facts (https://world.openfoodfacts.org), CC BY-SA 4.0. Finnish products only.",
  generated_at: new Date().toISOString(),
  count: catalog.size,
  entries: map,
};

await writeFile(OUT, JSON.stringify(out));
console.log(`Wrote ${OUT}`);
