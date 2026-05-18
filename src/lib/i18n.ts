export type Lang = "fi" | "sv";

export const DEFAULT_LANG: Lang = "sv";

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
  runningLowEmpty: {
    fi: "Tee muutamia ostoksia, niin ehdotuksia alkaa tulla.",
    sv: "Gör några inköp så börjar förslagen dyka upp.",
  },
  catalog: { fi: "Tuotekatalogi", sv: "Varukatalog" },
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
  signInSubtitleCode: {
    fi: "Lähetämme sinulle 6-numeroisen kirjautumiskoodin.",
    sv: "Vi skickar dig en 6-siffrig inloggningskod.",
  },
  sendCode: { fi: "Lähetä koodi", sv: "Skicka kod" },
  codeSentTitle: { fi: "Anna koodi", sv: "Ange koden" },
  codeSentTo: {
    fi: "Lähetimme 6-numeroisen koodin osoitteeseen",
    sv: "Vi skickade en 6-siffrig kod till",
  },
  codeSentHint: {
    fi: "Koodi on voimassa noin tunnin. Tarkista myös roskaposti.",
    sv: "Koden gäller i cirka en timme. Kolla även skräpposten.",
  },
  codeLabel: { fi: "Koodi", sv: "Kod" },
  verify: { fi: "Vahvista", sv: "Verifiera" },
  invalidCode: {
    fi: "Koodi on virheellinen tai vanhentunut.",
    sv: "Koden är felaktig eller har gått ut.",
  },
  resendCode: {
    fi: "Lähetä uusi koodi",
    sv: "Skicka en ny kod",
  },
  codeResent: {
    fi: "Uusi koodi lähetetty.",
    sv: "Ny kod skickad.",
  },
  changeEmail: {
    fi: "Vaihda sähköpostiosoite",
    sv: "Ändra e-postadressen",
  },
  notePlaceholder: {
    fi: "Huomautus (esim. merkki, koko)",
    sv: "Anteckning (t.ex. märke, storlek)",
  },
  toBuy: { fi: "ostettavaa", sv: "att köpa" },
  inCartShort: { fi: "korissa", sv: "i vagnen" },
  history: { fi: "Historia", sv: "Historik" },
  historyEmpty: {
    fi: "Ei vielä valmiita ostoslistoja.",
    sv: "Inga slutförda inköpslistor ännu.",
  },
  reorderFromList: { fi: "Lisää uudelle listalle", sv: "Lägg till på ny lista" },
  itemsCount: { fi: "{n} tuotetta", sv: "{n} varor" },
  check: { fi: "Merkitse", sv: "Markera" },
  uncheck: { fi: "Poista merkki", sv: "Avmarkera" },
  frequent: {
    fi: "Usein ostettuja",
    sv: "Köps ofta",
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
  errorEmpty: {
    fi: "Kirjoita ensin jotain.",
    sv: "Skriv något först.",
  },
  // Items / catalog
  itemsTitle: { fi: "Tuotteet", sv: "Varor" },
  addItemLabel: { fi: "Lisää tuote", sv: "Lägg till vara" },
  addItemPlaceholder: {
    fi: "esim. maitoa tai 500g jauheliha",
    sv: "t.ex. mjölk eller 500g köttfärs",
  },
  addItemHint: {
    fi: "Tekoäly tunnistaa tuotteen ja luokittelee sen automaattisesti.",
    sv: "AI känner igen varan och kategoriserar den automatiskt.",
  },
  add: { fi: "Lisää", sv: "Lägg till" },
  itemAdded: { fi: "Lisätty", sv: "Tillagd" },
  itemMatched: { fi: "Tunnistettu", sv: "Identifierad" },
  itemsEmpty: {
    fi: "Ei vielä tuotteita. Lisää ensimmäinen yllä olevasta kentästä.",
    sv: "Inga varor ännu. Lägg till den första i fältet ovan.",
  },
  // Active list
  quickAddLabel: { fi: "Lisää listalle", sv: "Lägg till på listan" },
  quickAddPlaceholder: {
    fi: "esim. 2 maitoa, ruisleipä, 500g jauheliha",
    sv: "t.ex. 2 mjölk, rågbröd, 500g köttfärs",
  },
  quickAddPlaceholderShort: {
    fi: "Lisää tuote tai esim. \"2 maitoa\"…",
    sv: "Lägg till vara, t.ex. \"2 mjölk\"…",
  },
  all: { fi: "Kaikki", sv: "Alla" },
  removeChecked: {
    fi: "Poista merkityt ({n})",
    sv: "Ta bort markerade ({n})",
  },
  quickAddHint: {
    fi: "Useita tuotteita kerralla — pilkulla erotettuna. Käytä mikkiä myös puheella.",
    sv: "Flera varor på en gång — separera med komma. Mikrofonen funkar också.",
  },
  listEmpty: {
    fi: "Lista on tyhjä. Lisää tuotteita yllä olevasta kentästä.",
    sv: "Listan är tom. Lägg till varor i fältet ovan.",
  },
  listEmptyShort: {
    fi: "Tyhjä lista",
    sv: "Tom lista",
  },
  itemsAdded: {
    fi: "Lisätty {n} tuotetta",
    sv: "{n} varor tillagda",
  },
  inCart: {
    fi: "Korissa ({n})",
    sv: "I kundvagnen ({n})",
  },
  completeShopping: {
    fi: "Vahvista ostokset ({n})",
    sv: "Bekräfta inköpen ({n})",
  },
  usuallyEvery: {
    fi: "Yleensä {n} päivän välein",
    sv: "Vanligtvis var {n}:e dag",
  },
  daysAgo: {
    fi: "{n} päivää sitten",
    sv: "{n} dagar sedan",
  },
  conflictKept: {
    fi: "Listalla jo: {name} {qty} {unit}. Ei muutettu.",
    sv: "Redan på listan: {name} {qty} {unit}. Inte ändrad.",
  },
  edit: { fi: "Muokkaa", sv: "Redigera" },
  save: { fi: "Tallenna", sv: "Spara" },
  cancel: { fi: "Peruuta", sv: "Avbryt" },
  installTitle: {
    fi: "Asenna Ostoslista iPhonelle",
    sv: "Installera Inköpslistan på iPhone",
  },
  installLine1: {
    fi: "Avaa jako-valikko",
    sv: "Öppna delningsmenyn",
  },
  installLine2: {
    fi: "ja valitse \"Lisää aloitusnäyttöön\".",
    sv: "och välj \"Lägg till på hemskärmen\".",
  },
  // Household management
  inviteTitle: { fi: "Kutsu jäsen", sv: "Bjud in medlem" },
  invite: { fi: "Kutsu", sv: "Bjud in" },
  inviteHint: {
    fi: "Kutsuttu liittyy talouteen automaattisesti, kun hän kirjautuu samalla sähköpostiosoitteella.",
    sv: "Den inbjudna ansluter automatiskt när hen loggar in med samma e-postadress.",
  },
  inviteSent: { fi: "Kutsu lähetetty: {email}", sv: "Inbjudan skickad: {email}" },
  alreadyMember: { fi: "Käyttäjä on jo jäsen.", sv: "Användaren är redan medlem." },
  members: { fi: "Jäsenet", sv: "Medlemmar" },
  you: { fi: "sinä", sv: "du" },
  roleOwner: { fi: "omistaja", sv: "ägare" },
  roleMember: { fi: "jäsen", sv: "medlem" },
  pendingInvitations: {
    fi: "Odottavat kutsut",
    sv: "Väntande inbjudningar",
  },
  remove: { fi: "Poista", sv: "Ta bort" },
  revoke: { fi: "Peruuta", sv: "Återkalla" },
  leaveHousehold: { fi: "Poistu taloudesta", sv: "Lämna hushållet" },
  leaveConfirm: {
    fi: "Haluatko varmasti poistua taloudesta?",
    sv: "Vill du verkligen lämna hushållet?",
  },
} satisfies Dict;

export type TKey = keyof typeof dict;

export function t(
  key: TKey,
  lang: Lang,
  params?: Record<string, string | number>,
): string {
  let s = dict[key][lang];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}
