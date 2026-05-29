import type { CategoryKey } from "@/lib/categorize";

/**
 * Per-item emoji map keyed by canonical Finnish name (lowercase).
 * Falls back to category emoji when not in this map.
 */
const ITEM_EMOJI: Record<string, string> = {
  // Dairy
  maito: "🥛",
  kerma: "🥛",
  ranskankerma: "🥛",
  jogurtti: "🥣",
  juusto: "🧀",
  raejuusto: "🧀",
  rahka: "🥣",
  voi: "🧈",
  margariini: "🧈",
  kananmuna: "🥚",
  // Meat
  jauheliha: "🥩",
  kana: "🍗",
  "kanan sisäfilee": "🍗",
  "kanan ulkofilee": "🍗",
  "kanan paistileike": "🍗",
  "kanan koipi": "🍗",
  "kanan siipi": "🍗",
  sianliha: "🥓",
  naudanliha: "🥩",
  kinkku: "🥓",
  makkara: "🌭",
  pekoni: "🥓",
  // Fish
  lohi: "🐟",
  lohifile: "🐟",
  tonnikala: "🐟",
  silakka: "🐟",
  kirjolohi: "🐟",
  // Bakery
  leipä: "🍞",
  ruisleipä: "🍞",
  kahvileipä: "🥐",
  näkkileipä: "🍪",
  sämpylä: "🥖",
  // Produce
  peruna: "🥔",
  porkkana: "🥕",
  sipuli: "🧅",
  punasipuli: "🧅",
  "röd lök": "🧅",
  rödlök: "🧅",
  valkosipuli: "🧄",
  tomaatti: "🍅",
  kurkku: "🥒",
  paprika: "🫑",
  salaatti: "🥬",
  banaani: "🍌",
  omena: "🍎",
  appelsiini: "🍊",
  sitruuna: "🍋",
  mansikka: "🍓",
  // Herbs
  tilli: "🌿",
  dill: "🌿",
  "färsk dill": "🌿",
  persilja: "🌿",
  persilja_kihara: "🌿",
  basilika: "🌿",
  minttu: "🌿",
  oregano: "🌿",
  timjami: "🌿",
  rosmariini: "🌿",
  korianteri: "🌿",
  ruohosipuli: "🌿",
  // Frozen
  pakasteherneet: "🫛",
  pakastepizza: "🍕",
  // Dry goods
  riisi: "🍚",
  pasta: "🍝",
  vehnäjauho: "🌾",
  kaurahiutaleet: "🥣",
  müsli: "🥣",
  sokeri: "🍬",
  suola: "🧂",
  mustapippuri: "🧂",
  rypsiöljy: "🫒",
  oliiviöljy: "🫒",
  // Drinks
  kahvi: "☕",
  tee: "🍵",
  mehu: "🧃",
  limu: "🥤",
  kivennäisvesi: "💧",
  olut: "🍺",
  viini: "🍷",
  // Hygiene / household
  "wc-paperi": "🧻",
  talouspaperi: "🧻",
  astianpesuaine: "🧴",
  pyykinpesuaine: "🧺",
  hammastahna: "🪥",
  shampoo: "🧴",
};

const CATEGORY_EMOJI: Record<CategoryKey, string> = {
  produce: "🥕",
  meat: "🥩",
  fish: "🐟",
  dairy: "🥛",
  bakery: "🍞",
  frozen: "🧊",
  dry_goods: "🌾",
  canned: "🥫",
  spices: "🧂",
  drinks: "🥤",
  snacks: "🍫",
  household: "🧻",
  hygiene: "🧼",
  other: "📦",
};

export function getItemEmoji(
  canonicalFi: string,
  categoryKey: CategoryKey | string | null | undefined,
): string {
  if (!canonicalFi) return "📦";
  const key = canonicalFi.toLowerCase().trim();
  if (ITEM_EMOJI[key]) return ITEM_EMOJI[key];
  // Substring match on the canonical name so 'färsk dill', 'kruusperslja',
  // 'tuore tilli' etc. all resolve to the right herb/produce icon without
  // needing one entry per inflection.
  for (const k of Object.keys(ITEM_EMOJI)) {
    if (key.includes(k)) return ITEM_EMOJI[k];
  }
  // strip leading modifiers like "10%", "rasvaton" etc. and try base word
  const base = key
    .replace(/^\d+%\s+/, "")
    .replace(/^(rasvaton|kevyt|luomu|eko|täys-?|färsk|tuore|fryst|pakaste)\s+/, "")
    .trim();
  if (ITEM_EMOJI[base]) return ITEM_EMOJI[base];
  if (categoryKey && CATEGORY_EMOJI[categoryKey as CategoryKey]) {
    return CATEGORY_EMOJI[categoryKey as CategoryKey];
  }
  return "📦";
}
