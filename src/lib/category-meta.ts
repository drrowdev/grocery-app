// Client-friendly mirror of the categories seed in 0001_init.sql so we
// can render correct labels/icons in optimistic placeholders without a
// DB round-trip. Keep in sync with the seed if categories are renamed.

export type CategoryMeta = {
  key: string;
  name_fi: string;
  name_sv: string;
  icon: string | null;
  sort_order: number;
};

export const CATEGORY_META: Record<string, CategoryMeta> = {
  produce: { key: "produce", name_fi: "Hedelmät & vihannekset", name_sv: "Frukt & grönt", icon: "🥕", sort_order: 10 },
  meat: { key: "meat", name_fi: "Liha", name_sv: "Kött", icon: "🥩", sort_order: 20 },
  fish: { key: "fish", name_fi: "Kala", name_sv: "Fisk", icon: "🐟", sort_order: 30 },
  dairy: { key: "dairy", name_fi: "Maitotuotteet", name_sv: "Mejeriprodukter", icon: "🥛", sort_order: 40 },
  bakery: { key: "bakery", name_fi: "Leipä & leivonnaiset", name_sv: "Bröd & bageri", icon: "🍞", sort_order: 50 },
  frozen: { key: "frozen", name_fi: "Pakasteet", name_sv: "Fryst", icon: "🧊", sort_order: 60 },
  dry_goods: { key: "dry_goods", name_fi: "Kuivatuotteet", name_sv: "Torrvaror", icon: "🌾", sort_order: 70 },
  canned: { key: "canned", name_fi: "Säilykkeet", name_sv: "Konserver", icon: "🥫", sort_order: 80 },
  spices: { key: "spices", name_fi: "Mausteet", name_sv: "Kryddor", icon: "🧂", sort_order: 90 },
  drinks: { key: "drinks", name_fi: "Juomat", name_sv: "Drycker", icon: "🥤", sort_order: 100 },
  snacks: { key: "snacks", name_fi: "Makeiset & napostelu", name_sv: "Godis & snacks", icon: "🍫", sort_order: 110 },
  household: { key: "household", name_fi: "Kodin tarvikkeet", name_sv: "Hushållsartiklar", icon: "🧻", sort_order: 120 },
  hygiene: { key: "hygiene", name_fi: "Hygienia", name_sv: "Hygien", icon: "🧼", sort_order: 130 },
  other: { key: "other", name_fi: "Muut", name_sv: "Övrigt", icon: "📦", sort_order: 999 },
};
