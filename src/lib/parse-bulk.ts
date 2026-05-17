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
- Numeric+unit prefixes parse: "500g" => qty: 0.5, unit: "kg". "750ml" => qty: 0.75, unit: "l". "2pkt" => qty: 2, unit: "pkt".
- A bare number with no unit attaches as qty only: "3 malet kött" => qty: 3, unit: null (NOT 3 kg, NOT 3 kpl).
- Strip articles, leading numbers, and quantity tokens from the name. PRESERVE descriptive modifiers like fat % ("10%"), luomu/eko, rasvaton/kevyt/täys-, brand names, ecological markers. Keep the item term itself raw — do NOT canonicalize ("maitoa" stays "maitoa", "malet kött" stays "malet kött").
- Splits: commas, "ja"/"och"/"and", newlines. Never split on spaces. NEVER split on a percent token.

Examples (study these carefully):
"2 maitoa, ruisleipä, 500g jauheliha" -> [
  {name:"maitoa", qty:2, unit:null},
  {name:"ruisleipä", qty:null, unit:null},
  {name:"jauheliha", qty:0.5, unit:"kg"}
]
"3 malet kött" -> [{name:"malet kött", qty:3, unit:null}]
"2pkt maletkött" -> [{name:"maletkött", qty:2, unit:"pkt"}]
"1 10% jauheliha" -> [{name:"10% jauheliha", qty:1, unit:null}]
"500g 17% jauheliha" -> [{name:"17% jauheliha", qty:0.5, unit:"kg"}]
"luomu maito" -> [{name:"luomu maito", qty:null, unit:null}]
"rasvaton maito" -> [{name:"rasvaton maito", qty:null, unit:null}]
"1l mehua ja 6 munaa" -> [
  {name:"mehua", qty:1, unit:"l"},
  {name:"munaa", qty:6, unit:null}
]
"crème fraîche" -> [{name:"crème fraîche", qty:null, unit:null}]
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

export async function parseBulkInput(text: string): Promise<ParsedBulkItem[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Fast path: short token, no commas, no digits, no % token
  if (
    !/[,\n%]/.test(trimmed) &&
    !/\d/.test(trimmed) &&
    trimmed.split(/\s+/).length <= 3
  ) {
    return [{ name: trimmed, qty: null, unit: null }];
  }

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
