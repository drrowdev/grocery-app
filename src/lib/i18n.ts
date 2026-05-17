export type Lang = "fi" | "sv";

export const DEFAULT_LANG: Lang = "fi";

type Dict = Record<string, { fi: string; sv: string }>;

const dict = {
  appName: { fi: "Ostoslista", sv: "Inköpslista" },
  tagline: {
    fi: "Älykäs ostoslista — kahdella kielellä.",
    sv: "Smart inköpslista — på två språk.",
  },
  signIn: { fi: "Kirjaudu sisään", sv: "Logga in" },
  signOut: { fi: "Kirjaudu ulos", sv: "Logga ut" },
  quickAdd: { fi: "Lisää tuotteita", sv: "Lägg till varor" },
  myList: { fi: "Ostoslistani", sv: "Min lista" },
  pantry: { fi: "Varasto", sv: "Skafferi" },
  stores: { fi: "Kaupat", sv: "Butiker" },
  household: { fi: "Talous", sv: "Hushåll" },
  language: { fi: "Kieli", sv: "Språk" },
  finnish: { fi: "Suomi", sv: "Finska" },
  swedish: { fi: "Ruotsi", sv: "Svenska" },
  comingSoon: { fi: "Tulossa pian", sv: "Kommer snart" },
  runningLowSoon: { fi: "Loppumassa", sv: "Snart slut" },
  notConfigured: {
    fi: "Sovellus ei ole vielä määritetty. Aseta Supabase- ja Anthropic-avaimet ympäristömuuttujiin.",
    sv: "Appen är inte konfigurerad ännu. Ange Supabase- och Anthropic-nycklar i miljövariablerna.",
  },
} satisfies Dict;

export type TKey = keyof typeof dict;

export function t(key: TKey, lang: Lang): string {
  return dict[key][lang];
}
