import type { CategoryKey, UnitKey } from "@/lib/categorize";

export type DictEntry = {
  fi: string; // canonical Finnish
  sv: string; // canonical Finland-Swedish (finlandssvenska) — NOT rikssvenska
  category: CategoryKey;
  unit: UnitKey;
  default_qty: number;
  aliases: string[]; // matching forms (lowercase). Include inflections + cross-lang variants.
};

/**
 * Hardcoded vocabulary of common grocery items in Finnish + Finland-Swedish.
 * Checked before Claude — saves an LLM call and guarantees correctness for
 * the most common items.
 *
 * Finland-Swedish (finlandssvenska) is preferred over rikssvenska:
 *   maletkött (FI-SV) — not köttfärs (rikssvenska)
 *   saft (FI-SV)       — not juice
 *   keso (FI-SV)       — not keso/cottage cheese
 *   semla (FI-SV)      — bread roll (different meaning than in Sweden)
 */
export const GROCERY_DICT: DictEntry[] = [
  // Dairy
  { fi: "maito", sv: "mjölk", category: "dairy", unit: "l", default_qty: 1,
    aliases: ["maito", "maitoa", "mjölk", "milk", "kulutusmaito", "lättmjölk"] },
  // Finland milk colour codes — explicit entries so the fat level / colour
  // modifier never gets stripped.
  { fi: "täysmaito", sv: "röd mjölk", category: "dairy", unit: "l", default_qty: 1,
    aliases: ["täysmaito", "täysmaitoa", "röd mjölk", "röd-mjölk", "rödmjölk", "punainen maito", "full milk", "whole milk"] },
  { fi: "kevytmaito", sv: "lätt mjölk", category: "dairy", unit: "l", default_qty: 1,
    aliases: ["kevytmaito", "kevytmaitoa", "lätt mjölk", "lättmjölk", "blå mjölk", "blåmjölk", "sininen maito", "kevyt maito"] },
  { fi: "rasvaton maito", sv: "fettfri mjölk", category: "dairy", unit: "l", default_qty: 1,
    aliases: ["rasvaton maito", "rasvatonta maitoa", "fettfri mjölk", "fettfri-mjölk", "grön mjölk", "grönmjölk", "vihreä maito", "skimmed milk", "rasvaton"] },
  { fi: "kerma", sv: "grädde", category: "dairy", unit: "dl", default_qty: 2,
    aliases: ["kerma", "kermaa", "grädde", "cream", "kuohukerma", "vispgrädde"] },
  { fi: "ranskankerma", sv: "crème fraîche", category: "dairy", unit: "pkt", default_qty: 1,
    aliases: ["ranskankerma", "ranskan kerma", "crème fraîche", "creme fraiche"] },
  { fi: "jogurtti", sv: "yoghurt", category: "dairy", unit: "pkt", default_qty: 1,
    aliases: ["jogurtti", "jogurttia", "yoghurt", "yogurt"] },
  { fi: "juusto", sv: "ost", category: "dairy", unit: "pkt", default_qty: 1,
    aliases: ["juusto", "juustoa", "ost", "cheese"] },
  { fi: "raejuusto", sv: "keso", category: "dairy", unit: "pkt", default_qty: 1,
    aliases: ["raejuusto", "raejuustoa", "keso", "cottage cheese"] },
  { fi: "Rahka", sv: "Kvarg", category: "dairy", unit: "pkt", default_qty: 1,
    aliases: ["rahka", "rahkaa", "kvarg", "kvargen", "quark", "vaniljarahka", "marjarahka", "maitorahka"] },
  { fi: "voi", sv: "smör", category: "dairy", unit: "pkt", default_qty: 1,
    aliases: ["voi", "voita", "smör", "butter"] },
  { fi: "margariini", sv: "margarin", category: "dairy", unit: "pkt", default_qty: 1,
    aliases: ["margariini", "margariinia", "margarin", "margarine"] },
  { fi: "kananmuna", sv: "ägg", category: "dairy", unit: "kpl", default_qty: 6,
    aliases: ["kananmuna", "kananmunia", "muna", "munaa", "munat", "ägg", "egg", "eggs"] },

  // Meat
  { fi: "jauheliha", sv: "maletkött", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["jauheliha", "jauhelihaa", "malet kött", "maletkött", "köttfärs", "ground beef", "ground meat", "mince", "mincemeat", "naudan jauheliha"] },
  { fi: "kana", sv: "kyckling", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["kana", "kanaa", "kyckling", "chicken", "broileri", "broilerin fileesuikale", "kanafile", "kananfilee", "höna"] },
  { fi: "kanan sisäfilee", sv: "kycklinginnerfilé", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["kanan sisäfile", "kanan sisäfilee", "broilerin sisäfilee", "broilerin sisäfile",
              "sisäfilee", "sisäfile", "sisäfileesuikale", "sisäfilesuikale",
              "kycklinginnerfilé", "kyckling innerfilé", "kycklingens innerfilé",
              "innerfilé", "innerfile", "inre filé", "inre file", "inrefilé", "inrefile",
              "höna inre file", "höna inre filé", "höna inrefilé", "höna inrefile",
              "kyckling inre file", "kyckling inrefile", "kyckling innerfile",
              "chicken tenderloin", "chicken inner fillet"] },
  { fi: "kanan ulkofilee", sv: "kycklingytterfilé", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["kanan ulkofile", "kanan ulkofilee", "broilerin ulkofilee", "broilerin ulkofile",
              "ulkofilee", "ulkofile",
              "kycklingytterfilé", "kyckling ytterfilé", "kycklingens ytterfilé",
              "ytterfilé", "ytterfile", "yttre filé", "yttre file", "ytterfile",
              "höna ytterfile", "höna ytterfilé",
              "chicken breast"] },
  { fi: "kanan paistileike", sv: "kycklingstekbit", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["kanan paistileike", "broilerin paistileike", "paistileike",
              "kycklingstekbit", "kyckling stekbit", "kycklingens stekbit", "stekbit"] },
  { fi: "kanan koipi", sv: "kycklinglår", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["kanan koipi", "broilerin koipi", "koipi", "kycklinglår", "kyckling lår", "chicken leg", "chicken thigh"] },
  { fi: "kanan siipi", sv: "kycklingvinge", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["kanan siipi", "broilerin siipi", "siipi", "kycklingvinge", "kyckling vinge", "chicken wing"] },
  { fi: "sianliha", sv: "fläsk", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["sianliha", "sianlihaa", "fläsk", "pork", "porsas", "porsasta"] },
  { fi: "naudanliha", sv: "nötkött", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["naudanliha", "naudanlihaa", "nötkött", "beef"] },
  { fi: "kinkku", sv: "skinka", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["kinkku", "kinkkua", "skinka", "ham"] },
  { fi: "makkara", sv: "korv", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["makkara", "makkaraa", "korv", "sausage", "nakit", "nakkeja"] },
  { fi: "pekoni", sv: "bacon", category: "meat", unit: "pkt", default_qty: 1,
    aliases: ["pekoni", "pekonia", "bacon"] },

  // Fish
  { fi: "lohi", sv: "lax", category: "fish", unit: "pkt", default_qty: 1,
    aliases: ["lohi", "lohta", "lax", "salmon"] },
  { fi: "lohifile", sv: "laxfilé", category: "fish", unit: "pkt", default_qty: 1,
    aliases: ["lohifile", "lohifilee", "laxfilé", "laxfile", "salmon fillet"] },
  { fi: "tonnikala", sv: "tonfisk", category: "fish", unit: "pkt", default_qty: 1,
    aliases: ["tonnikala", "tonnikalaa", "tonfisk", "tuna"] },
  { fi: "silakka", sv: "strömming", category: "fish", unit: "pkt", default_qty: 1,
    aliases: ["silakka", "silakkaa", "strömming"] },
  { fi: "kirjolohi", sv: "regnbåge", category: "fish", unit: "pkt", default_qty: 1,
    aliases: ["kirjolohi", "kirjolohta", "regnbåge", "regnbågslax", "rainbow trout"] },

  // Bakery
  { fi: "leipä", sv: "bröd", category: "bakery", unit: "kpl", default_qty: 1,
    aliases: ["leipä", "leipää", "bröd", "bread"] },
  { fi: "ruisleipä", sv: "rågbröd", category: "bakery", unit: "kpl", default_qty: 1,
    aliases: ["ruisleipä", "ruisleipää", "rågbröd", "rye bread"] },
  { fi: "kahvileipä", sv: "kaffebröd", category: "bakery", unit: "pkt", default_qty: 1,
    aliases: ["kahvileipä", "kaffebröd", "pulla", "pullaa"] },
  { fi: "näkkileipä", sv: "knäckebröd", category: "bakery", unit: "pkt", default_qty: 1,
    aliases: ["näkkileipä", "näkkileipää", "knäckebröd"] },
  { fi: "sämpylä", sv: "semla", category: "bakery", unit: "kpl", default_qty: 4,
    aliases: ["sämpylä", "sämpylöitä", "semla", "semlor", "bread roll"] },

  // Produce
  { fi: "peruna", sv: "potatis", category: "produce", unit: "kg", default_qty: 1,
    aliases: ["peruna", "perunoita", "potatis", "potato", "potatoes"] },
  { fi: "porkkana", sv: "morot", category: "produce", unit: "kg", default_qty: 0.5,
    aliases: ["porkkana", "porkkanoita", "morot", "morötter", "carrot", "carrots"] },
  { fi: "sipuli", sv: "lök", category: "produce", unit: "kpl", default_qty: 2,
    aliases: ["sipuli", "sipulia", "lök", "onion"] },
  { fi: "valkosipuli", sv: "vitlök", category: "produce", unit: "kpl", default_qty: 1,
    aliases: ["valkosipuli", "valkosipulia", "vitlök", "garlic"] },
  { fi: "tomaatti", sv: "tomat", category: "produce", unit: "kg", default_qty: 0.5,
    aliases: ["tomaatti", "tomaatteja", "tomat", "tomater", "tomato", "tomatoes"] },
  { fi: "kurkku", sv: "gurka", category: "produce", unit: "kpl", default_qty: 1,
    aliases: ["kurkku", "kurkkua", "gurka", "cucumber"] },
  { fi: "paprika", sv: "paprika", category: "produce", unit: "kpl", default_qty: 2,
    aliases: ["paprika", "paprikoita", "bell pepper"] },
  { fi: "salaatti", sv: "sallad", category: "produce", unit: "kpl", default_qty: 1,
    aliases: ["salaatti", "salaattia", "sallad", "salad", "lettuce", "jääsalaatti", "isbergssallad"] },
  { fi: "banaani", sv: "banan", category: "produce", unit: "kpl", default_qty: 5,
    aliases: ["banaani", "banaania", "banaaneja", "banan", "bananer", "banana", "bananas"] },
  { fi: "omena", sv: "äpple", category: "produce", unit: "kpl", default_qty: 4,
    aliases: ["omena", "omenoita", "äpple", "äpplen", "apple", "apples"] },
  { fi: "appelsiini", sv: "apelsin", category: "produce", unit: "kpl", default_qty: 4,
    aliases: ["appelsiini", "appelsiineja", "apelsin", "apelsiner", "orange"] },
  { fi: "sitruuna", sv: "citron", category: "produce", unit: "kpl", default_qty: 2,
    aliases: ["sitruuna", "sitruunoita", "citron", "lemon"] },
  { fi: "mansikka", sv: "jordgubbe", category: "produce", unit: "pkt", default_qty: 1,
    aliases: ["mansikka", "mansikoita", "jordgubbe", "jordgubbar", "strawberry", "strawberries"] },

  // Frozen
  { fi: "pakasteherneet", sv: "frysta ärtor", category: "frozen", unit: "pkt", default_qty: 1,
    aliases: ["pakasteherneet", "herneet", "frysta ärtor", "ärtor", "frozen peas"] },
  { fi: "pakastepizza", sv: "fryspizza", category: "frozen", unit: "kpl", default_qty: 1,
    aliases: ["pakastepizza", "fryspizza", "frozen pizza"] },

  // Dry goods
  { fi: "riisi", sv: "ris", category: "dry_goods", unit: "pkt", default_qty: 1,
    aliases: ["riisi", "riisiä", "ris", "rice"] },
  { fi: "pasta", sv: "pasta", category: "dry_goods", unit: "pkt", default_qty: 1,
    aliases: ["pasta", "pastaa", "spagetti", "spaghetti", "makaroni", "makaronia"] },
  { fi: "vehnäjauho", sv: "vetemjöl", category: "dry_goods", unit: "pkt", default_qty: 1,
    aliases: ["vehnäjauho", "vehnäjauhoa", "jauho", "jauhoa", "vetemjöl", "mjöl", "wheat flour", "flour"] },
  { fi: "kaurahiutaleet", sv: "havregryn", category: "dry_goods", unit: "pkt", default_qty: 1,
    aliases: ["kaurahiutaleet", "kaurahiutaleita", "havregryn", "oats", "oatmeal"] },
  { fi: "müsli", sv: "müsli", category: "dry_goods", unit: "pkt", default_qty: 1,
    aliases: ["müsli", "mysli", "muesli", "granola"] },
  { fi: "sokeri", sv: "socker", category: "dry_goods", unit: "pkt", default_qty: 1,
    aliases: ["sokeri", "sokeria", "socker", "sugar"] },
  { fi: "suola", sv: "salt", category: "spices", unit: "pkt", default_qty: 1,
    aliases: ["suola", "suolaa", "salt"] },
  { fi: "mustapippuri", sv: "svartpeppar", category: "spices", unit: "pkt", default_qty: 1,
    aliases: ["mustapippuri", "pippuri", "pippuria", "svartpeppar", "peppar", "pepper", "black pepper"] },

  // Oils
  { fi: "rypsiöljy", sv: "rapsolja", category: "dry_goods", unit: "l", default_qty: 1,
    aliases: ["rypsiöljy", "rypsiöljyä", "rapsolja", "öljy", "olja", "rapeseed oil", "canola oil"] },
  { fi: "oliiviöljy", sv: "olivolja", category: "dry_goods", unit: "l", default_qty: 1,
    aliases: ["oliiviöljy", "oliiviöljyä", "olivolja", "olive oil"] },

  // Drinks
  { fi: "kahvi", sv: "kaffe", category: "drinks", unit: "pkt", default_qty: 1,
    aliases: ["kahvi", "kahvia", "kaffe", "coffee"] },
  { fi: "tee", sv: "te", category: "drinks", unit: "pkt", default_qty: 1,
    aliases: ["tee", "teetä", "te", "tea"] },
  { fi: "mehu", sv: "saft", category: "drinks", unit: "l", default_qty: 1,
    aliases: ["mehu", "mehua", "saft", "juice", "appelsiinimehu", "omenamehu"] },
  { fi: "limu", sv: "läsk", category: "drinks", unit: "l", default_qty: 1.5,
    aliases: ["limu", "limua", "limsa", "läsk", "soft drink", "soda"] },
  { fi: "kivennäisvesi", sv: "mineralvatten", category: "drinks", unit: "l", default_qty: 1.5,
    aliases: ["kivennäisvesi", "mineraalivesi", "mineralvatten", "mineral water"] },
  { fi: "olut", sv: "öl", category: "drinks", unit: "pkt", default_qty: 1,
    aliases: ["olut", "olutta", "öl", "beer", "kalja"] },
  { fi: "viini", sv: "vin", category: "drinks", unit: "kpl", default_qty: 1,
    aliases: ["viini", "viiniä", "vin", "wine", "punaviini", "valkoviini", "rödvin", "vitvin"] },

  // Household
  { fi: "wc-paperi", sv: "toalettpapper", category: "hygiene", unit: "pkt", default_qty: 1,
    aliases: ["wc-paperi", "wc paperi", "vessapaperi", "toalettpapper", "toilet paper"] },
  { fi: "talouspaperi", sv: "hushållspapper", category: "household", unit: "pkt", default_qty: 1,
    aliases: ["talouspaperi", "hushållspapper", "kitchen paper", "paper towel"] },
  { fi: "astianpesuaine", sv: "diskmedel", category: "household", unit: "pkt", default_qty: 1,
    aliases: ["astianpesuaine", "diskmedel", "dish soap"] },
  { fi: "pyykinpesuaine", sv: "tvättmedel", category: "household", unit: "pkt", default_qty: 1,
    aliases: ["pyykinpesuaine", "tvättmedel", "laundry detergent"] },
  { fi: "hammastahna", sv: "tandkräm", category: "hygiene", unit: "pkt", default_qty: 1,
    aliases: ["hammastahna", "hammastahnaa", "tandkräm", "toothpaste"] },
  { fi: "shampoo", sv: "schampo", category: "hygiene", unit: "pkt", default_qty: 1,
    aliases: ["shampoo", "schampo", "shampoo"] },
];

/**
 * Look up a free-text grocery term in the hardcoded dictionary.
 * Returns the dictionary entry or null if no match.
 */
export function lookupDict(text: string): DictEntry | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  for (const entry of GROCERY_DICT) {
    if (entry.aliases.some((a) => a.toLowerCase() === q)) return entry;
  }
  return null;
}
