import "server-only";
import catalogData from "@/lib/product-catalog-data.json";
import type { CategoryKey, UnitKey } from "@/lib/categorize";

type CatalogEntry = {
  fi: string;
  sv: string;
  brand: string | null;
  category: string;
};

type CatalogData = {
  source: string;
  generated_at: string;
  count: number;
  entries: Record<string, CatalogEntry>;
};

const data = catalogData as CatalogData;

// Per-category defaults for unit and qty when ingesting OFF entries.
const DEFAULTS: Record<CategoryKey, { unit: UnitKey; qty: number }> = {
  produce: { unit: "kpl", qty: 1 },
  meat: { unit: "pkt", qty: 1 },
  fish: { unit: "pkt", qty: 1 },
  dairy: { unit: "pkt", qty: 1 },
  bakery: { unit: "kpl", qty: 1 },
  frozen: { unit: "pkt", qty: 1 },
  dry_goods: { unit: "pkt", qty: 1 },
  canned: { unit: "kpl", qty: 1 },
  spices: { unit: "pkt", qty: 1 },
  drinks: { unit: "l", qty: 1 },
  snacks: { unit: "pkt", qty: 1 },
  household: { unit: "kpl", qty: 1 },
  hygiene: { unit: "kpl", qty: 1 },
  other: { unit: "kpl", qty: 1 },
};

export type CatalogHit = {
  canonical_fi: string;
  canonical_sv: string;
  category_key: CategoryKey;
  unit: UnitKey;
  default_qty: number;
};

/**
 * Look up a free-text grocery term in the Open Food Facts catalog
 * (~3800 Finnish products). Tries exact match first, then prefix match.
 */
export function lookupCatalog(text: string): CatalogHit | null {
  const q = text.trim().toLowerCase();
  if (!q || q.length < 2) return null;

  const exact = data.entries[q];
  let hit: CatalogEntry | null = exact ?? null;

  // Prefix fallback (only for queries 4+ chars to avoid noise).
  //
  // We only trim trailing noise off the *user's* query (q starts with a
  // catalog key, e.g. "oltermanni 500g" -> "oltermanni"). We deliberately
  // do NOT expand a short query into a longer catalog entry: that let a
  // generic word like "äppel" grab a branded product such as
  // "äppel-tranbär ekomysli". A matched key must also end on a word
  // boundary so a mid-word prefix ("kanelipulla" vs "kanel") never matches.
  if (!hit && q.length >= 4) {
    for (const k of Object.keys(data.entries)) {
      if (k.length >= 4 && q.startsWith(k)) {
        const rest = q.slice(k.length);
        if (rest === "" || /^[\s\-0-9]/.test(rest)) {
          hit = data.entries[k];
          break;
        }
      }
    }
  }

  if (!hit) return null;

  const category = (hit.category in DEFAULTS ? hit.category : "other") as CategoryKey;
  const defaults = DEFAULTS[category];
  return {
    canonical_fi: hit.fi,
    canonical_sv: hit.sv,
    category_key: category,
    unit: defaults.unit,
    default_qty: defaults.qty,
  };
}
