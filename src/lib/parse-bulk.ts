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

const SYSTEM_PROMPT = `You parse a free-text shopping list line that may contain multiple items, in Finnish, Swedish, or English. Split into individual items and extract quantity and unit when explicit.

Rules:
- Each item: {name: string, qty: number|null, unit: enum|null}
- Quantity is null when not specified.
- Unit is one of: kpl, kg, g, l, dl, ml, pkt. Use null when not specified.
- Convert grams-style: "500g" => qty: 0.5, unit: "kg". "750ml" => qty: 0.75, unit: "l".
- Strip articles, leading numbers, and quantity tokens from the name. Keep the item term itself raw — do NOT canonicalize ("maitoa" stays "maitoa").
- Splits: commas, "ja"/"och"/"and", new lines.

Examples:
"2 maitoa, ruisleipä, 500g jauheliha" -> [
  {name:"maitoa", qty:2, unit:null},
  {name:"ruisleipä", qty:null, unit:null},
  {name:"jauheliha", qty:0.5, unit:"kg"}
]
"1l mehua ja 6 munaa" -> [
  {name:"mehua", qty:1, unit:"l"},
  {name:"munaa", qty:6, unit:null}
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

export async function parseBulkInput(text: string): Promise<ParsedBulkItem[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Fast path: single short token, no digits, no commas → skip Claude, treat as one item
  if (
    !/[,\n]/.test(trimmed) &&
    !/\d/.test(trimmed) &&
    trimmed.split(/\s+/).length <= 3
  ) {
    return [{ name: trimmed, qty: null, unit: null }];
  }

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
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
