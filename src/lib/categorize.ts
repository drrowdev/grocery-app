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

The user input may be in Finnish, Swedish, English, or a mix. Recognize the source language by the words themselves and translate to the actual Finnish and **Finland-Swedish (finlandssvenska)** supermarket terms — NOT rikssvenska (Sweden-Swedish), and NEVER invent Finnish words by phonetic transliteration of Swedish stems.

Finland-Swedish vs Sweden-Swedish — always prefer the Finland-Swedish form:
- "malet kött" (FI-SV) — NOT "köttfärs" (rikssvenska)
- "saft" (FI-SV, means juice in Finland) — NOT "juice"
- "keso" (FI-SV) — NOT "cottage cheese"
- "semla" (FI-SV, means a bread roll, not a cardamom bun)

If unsure whether the user typed Finland-Swedish or rikssvenska, output the Finland-Swedish form in canonical_sv.

Return fields:
- canonical_fi: standard Finnish singular nominative ("maito", "ruisleipä", "lohifile")
- canonical_sv: standard Finland-Swedish singular ("mjölk", "rågbröd", "laxfilé", "malet kött")
- category_key: one of: produce, meat, fish, dairy, bakery, frozen, dry_goods, canned, spices, drinks, snacks, household, hygiene, other
- unit: kpl (pieces), kg, g, l, dl, ml, pkt (package)
- default_qty: sensible default (milk: 1 l, eggs: 6 kpl, mince: 0.5 kg)

Always return one tool call with valid arguments. NEVER output a Finnish word that doesn't exist in real Finnish — if unsure whether the word would appear on a Finnish supermarket shelf, pick a real one that's close.`;

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

  // FSOB post-correction: if Claude returned a rikssvenska form, swap to FI-SV.
  // Also: if the swap yields a known Finland-Swedish form, fix canonical_fi
  // when Claude's Finnish doesn't match the FSOB-known Finnish for that FI-SV.
  const correctedSv = toFinlandSwedish(fromClaude.canonical_sv);
  let correctedFi = fromClaude.canonical_fi;
  if (correctedSv !== fromClaude.canonical_sv) {
    const knownFi = finlandSwedishToFinnish(correctedSv);
    if (knownFi) correctedFi = knownFi;
  }

  return {
    ...fromClaude,
    canonical_fi: correctedFi,
    canonical_sv: correctedSv,
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
