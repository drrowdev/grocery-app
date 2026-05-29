import "server-only";
import { z } from "zod";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { lookupDict } from "@/lib/grocery-dict";
import { lookupCatalog } from "@/lib/product-catalog";
import { toFinlandSwedish, finlandSwedishToFinnish } from "@/lib/fsob";

export const CATEGORY_KEYS = [
  "produce",
  "meat",
  "fish",
  "dairy",
  "bakery",
  "frozen",
  "dry_goods",
  "canned",
  "spices",
  "drinks",
  "snacks",
  "household",
  "hygiene",
  "other",
] as const;

export const UNIT_KEYS = ["kpl", "kg", "g", "l", "dl", "ml", "pkt"] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export type UnitKey = (typeof UNIT_KEYS)[number];

const ClaudeItemSchema = z.object({
  canonical_fi: z.string().min(1).max(80),
  canonical_sv: z.string().min(1).max(80),
  source_lang: z.enum(["fi", "sv", "en", "other"]).optional(),
  category_key: z.enum(CATEGORY_KEYS),
  unit: z.enum(UNIT_KEYS),
  default_qty: z.number().positive().max(10000),
});

export type ClaudeItem = z.infer<typeof ClaudeItemSchema>;

const SYSTEM_PROMPT = `You categorize grocery items for a Finnish/Swedish shopping list app used in Finland.

The user input may be in Finnish, Swedish, English, or a mix. Recognize the source language and translate to the actual Finnish and **Finland-Swedish (finlandssvenska)** supermarket terms — NOT rikssvenska, and NEVER invent Finnish words by phonetic transliteration of Swedish stems.

PRESERVE the user's input shape closely. Do NOT strip these qualifiers when they appear:
- Fat content / composition: "10%", "17%", "7%", "1.5%"
- Lean/full-fat markers: "rasvaton", "kevyt", "täys-", "fettfri", "lätt", "mager"
- Origin/quality: "luomu", "eko", "ekologisk", "organic", "tuore", "pakaste", "fryst"
- Brand-like tokens
- Color/type modifiers: "valkoinen", "punainen", "vit", "röd"

Output canonical_fi as close to the user's Finnish input as possible (just lowercase + trim). Output canonical_sv as the Finland-Swedish translation of the FULL phrase including any preserved modifiers.

Finland-Swedish preferred over rikssvenska in canonical_sv:
- "maletkött" (FI-SV, single word as used in Finland) — NOT "malet kött", NOT "köttfärs" (rikssvenska)
- "saft" (FI-SV, juice in Finland)
- "keso" (FI-SV)
- "semla" (FI-SV: bread roll)

Return fields:
- source_lang: "fi" | "sv" | "en" | "other" — the language the user typed in
- canonical_fi: standard Finnish translation of the phrase including all preserved modifiers
- canonical_sv: Finland-Swedish translation of the phrase including all preserved modifiers
- category_key: produce, meat, fish, dairy, bakery, frozen, dry_goods, canned, spices, drinks, snacks, household, hygiene, or other
- unit: kpl, kg, g, l, dl, ml, pkt
- default_qty: sensible default (milk: 1 l, eggs: 6 kpl, mince: 1 pkt)

ALWAYS translate to the other language. If the user typed FI, give the full SV translation. If they typed SV, give the full FI translation. If they typed EN, give both FI and SV. Preserve modifiers ('maustamaton', 'frysta', 'färska', '10%', 'luomu') in both translations.

Category guidance (when in doubt):
- Condiments, sauces, dressings, mayonnaise, ketchup, mustard, vinegar, soy sauce, sriracha, pesto, jam, honey → "canned" (jars/bottles)
- Bouillon cubes, stock, soup → "canned"
- Cooking oil, vinegar → "canned"
- Crackers, chips, chocolate, candy, nuts → "snacks"
- Coffee, tea, juice, soda, beer, wine, water → "drinks"
- Sugar, flour, oats, rice, pasta, cereal, lentils, beans → "dry_goods"
- Yoghurt, cottage cheese, quark, kefir, butter, margarine, cream → "dairy"
- Salt, pepper, paprika, cumin, dried herbs → "spices"
- Fresh herbs (dill, basilika, persilja, mint) → "produce"
- Frozen pizza, frozen berries, ice cream → "frozen"
- Toilet paper, dish soap, cleaning supplies → "household"
- Shampoo, toothpaste, soap, deodorant → "hygiene"
- Use "other" only when nothing above fits.

Examples:
"10% jauheliha" -> {canonical_fi: "10% jauheliha", canonical_sv: "10% maletkött", category_key: "meat", unit: "pkt", default_qty: 1}
"luomu kananmuna" -> {canonical_fi: "luomu kananmuna", canonical_sv: "ekologiskt ägg", category_key: "dairy", unit: "kpl", default_qty: 6}
"rasvaton maito" -> {canonical_fi: "rasvaton maito", canonical_sv: "fettfri mjölk", category_key: "dairy", unit: "l", default_qty: 1}
"banana" -> {canonical_fi: "banaani", canonical_sv: "banan", category_key: "produce", unit: "kpl", default_qty: 4}
"felix kruunumajoneesi" -> {canonical_fi: "felix kruunumajoneesi", canonical_sv: "felix kronmajonnäs", category_key: "canned", unit: "dl", default_qty: 3}
"sinappi" -> {canonical_fi: "sinappi", canonical_sv: "senap", category_key: "canned", unit: "pkt", default_qty: 1}
"ketsuppi" -> {canonical_fi: "ketsuppi", canonical_sv: "ketchup", category_key: "canned", unit: "pkt", default_qty: 1}

Return one tool call. NEVER output a Finnish word that doesn't exist in real Finnish.`;

const TOOL_DEFINITION = {
  name: "register_grocery_item",
  description: "Register a single canonical grocery item.",
  input_schema: {
    type: "object" as const,
    properties: {
      source_lang: { type: "string", enum: ["fi", "sv", "en", "other"], description: "Language the user typed in" },
      canonical_fi: { type: "string", description: "Finnish translation including all preserved modifiers" },
      canonical_sv: { type: "string", description: "Finland-Swedish translation including all preserved modifiers" },
      category_key: { type: "string", enum: [...CATEGORY_KEYS] },
      unit: { type: "string", enum: [...UNIT_KEYS] },
      default_qty: { type: "number", minimum: 0.001 },
    },
    required: [
      "source_lang",
      "canonical_fi",
      "canonical_sv",
      "category_key",
      "unit",
      "default_qty",
    ],
  },
};

/**
 * Call Claude to normalize a free-text grocery term into a canonical item.
 */
export async function categorizeWithClaude(input: string): Promise<ClaudeItem> {
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: TOOL_DEFINITION.name },
    messages: [{ role: "user", content: input }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  // Defensive coercion: Claude occasionally returns an invented
  // category_key (e.g. "majoneesi") that isn't in the enum. Snap unknown
  // values to "other" so the user sees a working result instead of a
  // Zod validation error in the UI.
  const raw = toolUse.input as Record<string, unknown>;
  if (
    typeof raw.category_key === "string" &&
    !(CATEGORY_KEYS as readonly string[]).includes(raw.category_key)
  ) {
    raw.category_key = "other";
  }
  if (
    typeof raw.unit === "string" &&
    !(UNIT_KEYS as readonly string[]).includes(raw.unit)
  ) {
    raw.unit = "kpl";
  }

  const parsed = ClaudeItemSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // Last-resort fallback so the user never sees a raw Zod error.
  return {
    canonical_fi: typeof raw.canonical_fi === "string" ? raw.canonical_fi : "",
    canonical_sv: typeof raw.canonical_sv === "string" ? raw.canonical_sv : "",
    category_key: "other",
    unit: "kpl",
    default_qty: typeof raw.default_qty === "number" ? raw.default_qty : 1,
  };
}

/**
 * Categorize via local dictionary first (free, deterministic, Finland-Swedish
 * correct), then Claude for the long tail. Always post-correct the resulting
 * Swedish form to Finland-Swedish (finlandssvenska) using FSOB.
 */
async function categorize(input: string): Promise<ClaudeItem> {
  // 1. Curated dictionary (60+ common items with Finland-Swedish correctness)
  const dictHit = lookupDict(input);
  if (dictHit) {
    return {
      canonical_fi: dictHit.fi,
      canonical_sv: dictHit.sv,
      category_key: dictHit.category,
      unit: dictHit.unit,
      default_qty: dictHit.default_qty,
    };
  }

  // 2. Open Food Facts catalog (~3800 Finnish branded products).
  // Many OFF entries don't actually have a real Swedish translation —
  // sv just mirrors fi. When that happens we still take OFF's category
  // / unit / qty (those are reliable), but call Claude on top to fill
  // in a proper Finland-Swedish translation.
  const catalogHit = lookupCatalog(input);
  if (catalogHit) {
    const fiNorm = catalogHit.canonical_fi.trim().toLowerCase();
    const svNorm = catalogHit.canonical_sv.trim().toLowerCase();
    if (fiNorm !== svNorm) {
      return catalogHit;
    }
    // Same string in both languages — augment with Claude translation.
    try {
      const fromClaude = await categorizeWithClaude(input);
      const correctedSv = toFinlandSwedish(fromClaude.canonical_sv);
      return {
        ...catalogHit,
        // Keep OFF's FI canonical (it's the user's term as Finnish
        // grocery shoppers know it). Use Claude's SV translation if it
        // actually differs from the FI side; otherwise keep what we had.
        canonical_sv:
          correctedSv.trim().toLowerCase() !== fiNorm
            ? correctedSv
            : catalogHit.canonical_sv,
        source_lang: fromClaude.source_lang ?? "fi",
      };
    } catch {
      // If Claude is unavailable, fall back to what OFF gave us.
      return catalogHit;
    }
  }

  // 3. Claude for the long tail, with FSOB rikssvenska -> FI-SV correction
  const fromClaude = await categorizeWithClaude(input);

  const correctedSv = toFinlandSwedish(fromClaude.canonical_sv);
  let correctedFi = fromClaude.canonical_fi;
  if (correctedSv !== fromClaude.canonical_sv) {
    const knownFi = finlandSwedishToFinnish(correctedSv);
    if (knownFi) correctedFi = knownFi;
  }

  let unit = fromClaude.unit;
  let default_qty = fromClaude.default_qty;
  if (
    (fromClaude.category_key === "meat" || fromClaude.category_key === "fish") &&
    unit === "kg"
  ) {
    unit = "pkt";
    default_qty = 1;
  }
  // Produce items default to "kpl" (count) — onions, apples, lemons etc.
  // are bought by piece in Finnish supermarkets. Claude sometimes guesses
  // kg which then renders "2 kg små rödlökar" for "2 små rödlökar".
  // The parser only converts to non-null unit when the input had an
  // explicit unit, so flipping kg→kpl here is safe (the upstream qty/unit
  // override in actions.ts still wins when the user typed "500g sipuli").
  if (fromClaude.category_key === "produce" && unit === "kg") {
    unit = "kpl";
    default_qty = 1;
  }

  return {
    ...fromClaude,
    canonical_fi: correctedFi,
    canonical_sv: correctedSv,
    unit,
    default_qty,
  };
}

export type ResolvedItem = {
  id: string;
  canonical_fi: string;
  canonical_sv: string;
  category_id: string | null;
  unit: UnitKey;
  default_qty: number;
  wasCreated: boolean;
};

/**
 * Resolve a free-text grocery term to a household item.
 * - Tries exact alias match, then exact canonical match, then trigram fuzzy match
 *   (all via the `match_item` SQL function).
 * - Falls back to Claude + inserts a new item + alias.
 * - Always records the original input as an alias so future lookups skip Claude.
 */
export async function resolveItem(
  householdId: string,
  rawInput: string,
): Promise<ResolvedItem> {
  const input = rawInput.trim();
  if (!input) throw new Error("Empty input");

  const supabase = await createClient();

  // 1. Dictionary lookup — authoritative for common items. Map the canonical
  //    Finnish name back to a household-level item (existing or new).
  const dictHit = lookupDict(input);
  if (dictHit) {
    const { data: existingByCanonical } = await supabase
      .from("items")
      .select("id, canonical_fi, canonical_sv, category_id, unit, default_qty")
      .eq("household_id", householdId)
      .eq("canonical_fi", dictHit.fi)
      .maybeSingle();

    if (existingByCanonical) {
      await supabase
        .from("item_aliases")
        .upsert(
          {
            item_id: existingByCanonical.id,
            alias: input.toLowerCase(),
            lang: "fi",
          },
          { onConflict: "item_id,alias,lang", ignoreDuplicates: true },
        );
      return {
        ...(existingByCanonical as Omit<ResolvedItem, "wasCreated">),
        wasCreated: false,
      };
    }

    // Create item from dict entry
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("key", dictHit.category)
      .single();

    const { data: inserted, error: insErr } = await supabase
      .from("items")
      .insert({
        household_id: householdId,
        canonical_fi: dictHit.fi,
        canonical_sv: dictHit.sv,
        category_id: cat?.id ?? null,
        unit: dictHit.unit,
        default_qty: dictHit.default_qty,
      })
      .select("id, canonical_fi, canonical_sv, category_id, unit, default_qty")
      .single();
    if (insErr) throw insErr;

    await supabase
      .from("item_aliases")
      .upsert(
        dictHit.aliases
          .concat([dictHit.fi, dictHit.sv, input.toLowerCase()])
          .map((a) => ({
            item_id: inserted.id,
            alias: a.toLowerCase(),
            lang: "fi" as const,
          })),
        { onConflict: "item_id,alias,lang", ignoreDuplicates: true },
      );

    return {
      ...(inserted as Omit<ResolvedItem, "wasCreated">),
      wasCreated: true,
    };
  }

  // 2. DB match (exact alias / canonical / trigram fuzzy) for non-dictionary items
  const { data: matchedId } = await supabase.rpc("match_item", {
    p_household: householdId,
    p_text: input,
  });

  if (matchedId) {
    const { data: existing, error } = await supabase
      .from("items")
      .select("id, canonical_fi, canonical_sv, category_id, unit, default_qty")
      .eq("id", matchedId)
      .single();
    if (error) throw error;

    await supabase
      .from("item_aliases")
      .upsert(
        { item_id: existing.id, alias: input.toLowerCase(), lang: "fi" },
        { onConflict: "item_id,alias,lang", ignoreDuplicates: true },
      );

    return { ...(existing as Omit<ResolvedItem, "wasCreated">), wasCreated: false };
  }

  // 3. Claude (with FSOB post-correction) for the long tail
  const claudeItem = await categorize(input);

  // Preserve the user's input verbatim in the language they typed in;
  // use Claude's translation for the other language. Earlier we stored
  // the raw input in BOTH languages to stop Claude from renaming things
  // ("Psyllium" -> "psyllium husk"); that also killed the bilingual
  // translation, which users rely on. So now we trust source_lang +
  // freeze the source side, but accept Claude's translation on the
  // other side.
  const raw = input.trim();
  let finalFi: string;
  let finalSv: string;
  if (claudeItem.source_lang === "sv") {
    finalSv = raw;
    finalFi = claudeItem.canonical_fi || raw;
  } else if (claudeItem.source_lang === "fi") {
    finalFi = raw;
    finalSv = claudeItem.canonical_sv || raw;
  } else {
    // English / other / unknown: trust both Claude translations.
    finalFi = claudeItem.canonical_fi || raw;
    finalSv = claudeItem.canonical_sv || raw;
  }

  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("key", claudeItem.category_key)
    .single();

  const { data: inserted, error: insertError } = await supabase
    .from("items")
    .insert({
      household_id: householdId,
      canonical_fi: finalFi,
      canonical_sv: finalSv,
      category_id: cat?.id ?? null,
      unit: claudeItem.unit,
      default_qty: claudeItem.default_qty,
    })
    .select("id, canonical_fi, canonical_sv, category_id, unit, default_qty")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("items")
        .select("id, canonical_fi, canonical_sv, category_id, unit, default_qty")
        .eq("household_id", householdId)
        .eq("canonical_fi", finalFi)
        .single();
      if (existing) {
        await supabase
          .from("item_aliases")
          .upsert(
            { item_id: existing.id, alias: input.toLowerCase(), lang: "fi" },
            { onConflict: "item_id,alias,lang", ignoreDuplicates: true },
          );
        return {
          ...(existing as Omit<ResolvedItem, "wasCreated">),
          wasCreated: false,
        };
      }
    }
    throw insertError;
  }

  const aliases = [
    { item_id: inserted.id, alias: input.toLowerCase(), lang: "fi" as const },
  ];
  await supabase
    .from("item_aliases")
    .upsert(aliases, { onConflict: "item_id,alias,lang", ignoreDuplicates: true });

  return { ...(inserted as Omit<ResolvedItem, "wasCreated">), wasCreated: true };
}
