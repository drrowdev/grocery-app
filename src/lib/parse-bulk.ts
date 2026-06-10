import "server-only";
import { z } from "zod";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { UNIT_KEYS, type UnitKey } from "@/lib/categorize";

const ParsedItemSchema = z.object({
  name: z.string().min(1).max(80),
  qty: z.number().positive().nullable(),
  unit: z.enum(UNIT_KEYS).nullable(),
});

const ParseResultSchema = z.object({
  items: z.array(ParsedItemSchema).min(1).max(40),
});

export type ParsedBulkItem = {
  name: string;
  qty: number | null;
  unit: UnitKey | null;
};

const SYSTEM_PROMPT = `You parse a free-text shopping list line (which may contain multiple items) in Finnish, Swedish, or English. Split into individual items and extract quantity and unit when explicit.

CRITICAL: Multi-word product names must stay TOGETHER. Examples of multi-word items you must NOT split:
- "malet kött" (Finland-Swedish for ground beef) is ONE item, not two
- "rågbröd" is one item
- "crème fraîche" is one item
- "valkoinen kala" (white fish) is one item
- "rasvaton maito" (skim milk) is one item
- "10% jauheliha" is one item — the percentage is a fat-content descriptor, NOT a quantity

Rules:
- Each item: {name: string, qty: number|null, unit: enum|null}
- Quantity is null when not specified. NEVER guess a quantity.
- Unit is one of: kpl, kg, g, l, dl, ml, pkt. Use null when not specified.
- A "%" token is ALWAYS a descriptor (fat content, alcohol content, etc.) — NEVER a quantity or unit. Keep "X%" attached to the name.
- Numeric+unit prefixes parse: KEEP the unit the user typed. "500g" => qty: 500, unit: "g" (NOT 0.5 kg). "750ml" => qty: 750, unit: "ml" (NOT 0.75 l). "2dl" => qty: 2, unit: "dl". "2pkt" => qty: 2, unit: "pkt". "3dl" => qty: 3, unit: "dl". Do NOT convert grams to kilograms or millilitres to litres — the user picked the unit on purpose.
- A bare number with no unit attaches as qty only: "3 malet kött" => qty: 3, unit: null (NOT 3 kg, NOT 3 kpl).
- Size adjectives (små, stora, pieni, iso, large, small) are part of the name, NOT quantities. "2 små rödlökar" => qty: 2, unit: null (NOT 2 kg).
- Strip articles, leading numbers, and quantity tokens from the name. PRESERVE descriptive modifiers like fat % ("10%"), luomu/eko, rasvaton/kevyt/täys-, brand names, ecological markers. Keep the item term itself raw — do NOT canonicalize ("maitoa" stays "maitoa", "malet kött" stays "malet kött").
- Splits: commas, "ja"/"och"/"and", newlines. Never split on spaces. NEVER split on a percent token.
- Distribute a HEAD NOUN over a parenthetical or listed set of flavours/variants. "3 olika glassar (choklad, vanilj, jordgubb)" means three ice creams — attach the head noun "glass" to each flavour: "chokladglass", "vaniljglass", "jordgubbsglass". Likewise "2 jogurttia (vanilja, mansikka)" -> "vaniljajogurtti", "mansikkajogurtti". Drop count/variety words like "olika", "erilaista", "different", "sorter", "kinds" — "3 olika" means one of each kind, so qty is null, NOT 3.

Examples (study these carefully):
"2 maitoa, ruisleipä, 500g jauheliha" -> [
  {name:"maitoa", qty:2, unit:null},
  {name:"ruisleipä", qty:null, unit:null},
  {name:"jauheliha", qty:500, unit:"g"}
]
"3 malet kött" -> [{name:"malet kött", qty:3, unit:null}]
"2pkt maletkött" -> [{name:"maletkött", qty:2, unit:"pkt"}]
"1 10% jauheliha" -> [{name:"10% jauheliha", qty:1, unit:null}]
"500g 17% jauheliha" -> [{name:"17% jauheliha", qty:500, unit:"g"}]
"300g crème fraîche" -> [{name:"crème fraîche", qty:300, unit:"g"}]
"3dl felix kruunumajoneesi" -> [{name:"felix kruunumajoneesi", qty:3, unit:"dl"}]
"2 små rödlökar" -> [{name:"små rödlökar", qty:2, unit:null}]
"luomu maito" -> [{name:"luomu maito", qty:null, unit:null}]
"rasvaton maito" -> [{name:"rasvaton maito", qty:null, unit:null}]
"1l mehua ja 6 munaa" -> [
  {name:"mehua", qty:1, unit:"l"},
  {name:"munaa", qty:6, unit:null}
]
"crème fraîche" -> [{name:"crème fraîche", qty:null, unit:null}]
"3 olika glassar (choklad, vanilj, jordgubb)" -> [
  {name:"chokladglass", qty:null, unit:null},
  {name:"vaniljglass", qty:null, unit:null},
  {name:"jordgubbsglass", qty:null, unit:null}
]
"banana" -> [{name:"banana", qty:null, unit:null}]`;

const TOOL = {
  name: "parse_shopping_line",
  description: "Return parsed items from the user's free-text input.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            qty: { type: ["number", "null"] },
            unit: { type: ["string", "null"], enum: [...UNIT_KEYS, null] },
          },
          required: ["name", "qty", "unit"],
        },
      },
    },
    required: ["items"],
  },
};

// Tokens that signal multiple items or descriptor semantics ("%", "ja"/
// "och"/"and", parentheses) that the LLM parser handles more reliably. A
// single grocery item rarely contains these.
const MULTI_RE = /[,\n%()]/;
const CONJUNCTION_RE = /(?:^|\s)(?:ja|och|and)(?:\s|$)/i;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

/**
 * Resolve the common single-item inputs locally — including a leading
 * quantity and/or unit ("2 maitoa", "500g jauheliha", "3dl kerma") — so
 * the add path doesn't pay for an LLM round-trip. Returns null (forcing the
 * Claude fallback) whenever the input might contain multiple items or
 * descriptor semantics the local heuristics can't safely handle.
 */
function tryLocalParse(trimmed: string): ParsedBulkItem[] | null {
  if (MULTI_RE.test(trimmed) || CONJUNCTION_RE.test(trimmed)) return null;

  const unitAlt = UNIT_KEYS.join("|");

  // Leading quantity + unit: "500g jauheliha", "3dl kerma", "2 pkt maitoa".
  const qtyUnit = trimmed.match(
    new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${unitAlt})\\s+(.+)$`, "i"),
  );
  if (qtyUnit) {
    const name = qtyUnit[3].trim();
    if (name && !/\d/.test(name) && wordCount(name) <= 4) {
      return [
        {
          name,
          qty: Number(qtyUnit[1].replace(",", ".")),
          unit: qtyUnit[2].toLowerCase() as UnitKey,
        },
      ];
    }
    return null;
  }

  // Leading bare quantity, no unit: "2 maitoa", "3 malet kött",
  // "2 små rödlökar" (the size adjective stays part of the name).
  const qtyOnly = trimmed.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (qtyOnly) {
    const name = qtyOnly[2].trim();
    if (name && !/\d/.test(name) && wordCount(name) <= 4) {
      return [{ name, qty: Number(qtyOnly[1].replace(",", ".")), unit: null }];
    }
    return null;
  }

  // No digits at all — a single simple item name.
  if (!/\d/.test(trimmed) && wordCount(trimmed) <= 4) {
    return [{ name: trimmed, qty: null, unit: null }];
  }

  return null;
}

export async function parseBulkInput(text: string): Promise<ParsedBulkItem[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const local = tryLocalParse(trimmed);
  if (local) return local;

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: trimmed }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Bulk parser did not return tool_use");
  }
  const parsed = ParseResultSchema.parse(toolUse.input);
  return parsed.items;
}
