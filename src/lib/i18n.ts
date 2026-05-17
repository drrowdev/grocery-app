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
  // Auth
  emailLabel: { fi: "Sähköposti", sv: "E-post" },
  emailPlaceholder: { fi: "sinun@sähköposti.fi", sv: "din@epost.se" },
  sendMagicLink: {
    fi: "Lähetä kirjautumislinkki",
    sv: "Skicka inloggningslänk",
  },
  magicLinkSent: {
    fi: "Tarkista sähköpostisi ja klikkaa kirjautumislinkkiä.",
    sv: "Kolla din e-post och klicka på inloggningslänken.",
  },
  signInTitle: {
    fi: "Tervetuloa ostoslistalle",
    sv: "Välkommen till inköpslistan",
  },
  signInSubtitle: {
    fi: "Saat kertakäyttöisen kirjautumislinkin sähköpostiisi.",
    sv: "Du får en engångs-inloggningslänk till din e-post.",
  },
  // Households
  createHouseholdTitle: {
    fi: "Luo ensimmäinen taloutesi",
    sv: "Skapa ditt första hushåll",
  },
  createHouseholdSubtitle: {
    fi: "Talous kerää ostoksesi ja jakaa listat valitsemiesi henkilöiden kanssa.",
    sv: "Hushållet samlar dina inköp och delar listor med personer du väljer.",
  },
  householdNameLabel: { fi: "Talouden nimi", sv: "Hushållets namn" },
  householdNamePlaceholder: {
    fi: "esim. Koti tai Kämppä",
    sv: "t.ex. Hemma eller Stugan",
  },
  create: { fi: "Luo", sv: "Skapa" },
  // Errors
  errorGeneric: {
    fi: "Jotain meni pieleen. Yritä uudelleen.",
    sv: "Något gick fel. Försök igen.",
  },
  errorInvalidEmail: {
    fi: "Tarkista sähköpostiosoite.",
    sv: "Kontrollera e-postadressen.",
  },
} satisfies Dict;

export type TKey = keyof typeof dict;

export function t(key: TKey, lang: Lang): string {
  return dict[key][lang];
}
