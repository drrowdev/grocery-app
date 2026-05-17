import "server-only";
import { z } from "zod";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { lookupDict } from "@/lib/grocery-dict";
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
- "malet kött" (FI-SV) — NOT "köttfärs" (rikssvenska)
- "saft" (FI-SV, juice in Finland)
- "keso" (FI-SV)
- "semla" (FI-SV: bread roll)

Return fields:
- canonical_fi: user input in standard Finnish (preserve modifiers; only normalize whitespace + case)
- canonical_sv: Finland-Swedish translation of the FULL phrase (including modifiers)
- category_key: produce, meat, fish, dairy, bakery, frozen, dry_goods, canned, spices, drinks, snacks, household, hygiene, or other
- unit: kpl, kg, g, l, dl, ml, pkt
- default_qty: sensible default (milk: 1 l, eggs: 6 kpl, mince: 1 pkt)

Examples:
"10% jauheliha" -> {canonical_fi: "10% jauheliha", canonical_sv: "10% malet kött", category_key: "meat", unit: "pkt", default_qty: 1}
"luomu kananmuna" -> {canonical_fi: "luomu kananmuna", canonical_sv: "ekologiskt ägg", category_key: "dairy", unit: "kpl", default_qty: 6}
"rasvaton maito" -> {canonical_fi: "rasvaton maito", canonical_sv: "fettfri mjölk", category_key: "dairy", unit: "l", default_qty: 1}
"banana" -> {canonical_fi: "banaani", canonical_sv: "banan", category_key: "produce", unit: "kpl", default_qty: 4}

Return one tool call. NEVER output a Finnish word that doesn't exist in real Finnish.`;

const TOOL_DEFINITION = {
  name: "register_grocery_item",
  description: "Register a single canonical grocery item.",
  input_schema: {
    type: "object" as const,
    properties: {
      canonical_fi: { type: "string", description: "Finnish singular nominative" },
      canonical_sv: { type: "string", description: "Swedish singular" },
      category_key: { type: "string", enum: [...CATEGORY_KEYS] },
      unit: { type: "string", enum: [...UNIT_KEYS] },
      default_qty: { type: "number", minimum: 0.001 },
    },
    required: [
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
  return ClaudeItemSchema.parse(toolUse.input);
}

/**
 * Categorize via local dictionary first (free, deterministic, Finland-Swedish
 * correct), then Claude for the long tail. Always post-correct the resulting
 * Swedish form to Finland-Swedish (finlandssvenska) using FSOB.
 */
async function categorize(input: string): Promise<ClaudeItem> {
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

  const fromClaude = await categorizeWithClaude(input);

  // FSOB post-correction: rikssvenska canonical_sv -> Finland-Swedish.
  const correctedSv = toFinlandSwedish(fromClaude.canonical_sv);
  let correctedFi = fromClaude.canonical_fi;
  if (correctedSv !== fromClaude.canonical_sv) {
    const knownFi = finlandSwedishToFinnish(correctedSv);
    if (knownFi) correctedFi = knownFi;
  }

  // Default-unit override for meat/fish: in Finnish supermarkets these are
  // sold in vacuum packs. If the user didn't specify a weight (g/kg/ml/l),
  // the parser strips numeric prefixes BEFORE calling categorize, so any
  // weight intent is captured at the parser stage as an explicit unit on
  // the parsed item. Here we just ensure Claude's default unit isn't kg.
  let unit = fromClaude.unit;
  let default_qty = fromClaude.default_qty;
  if (
    (fromClaude.category_key === "meat" || fromClaude.category_key === "fish") &&
    unit === "kg"
  ) {
    unit = "pkt";
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

  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("key", claudeItem.category_key)
    .single();

  const { data: inserted, error: insertError } = await supabase
    .from("items")
    .insert({
      household_id: householdId,
      canonical_fi: claudeItem.canonical_fi,
      canonical_sv: claudeItem.canonical_sv,
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
        .eq("canonical_fi", claudeItem.canonical_fi)
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
    {
      item_id: inserted.id,
      alias: claudeItem.canonical_fi.toLowerCase(),
      lang: "fi" as const,
    },
    {
      item_id: inserted.id,
      alias: claudeItem.canonical_sv.toLowerCase(),
      lang: "sv" as const,
    },
  ];
  await supabase
    .from("item_aliases")
    .upsert(aliases, { onConflict: "item_id,alias,lang", ignoreDuplicates: true });

  return { ...(inserted as Omit<ResolvedItem, "wasCreated">), wasCreated: true };
}
