/**
 * Baza električnih komponenti za jednopolne sheme razvodnih ormara
 * Oznake u skladu s uobičajenom praksom (IEC 60617 / HRN HD 60364 stil)
 */

const BAZA_KOMPONENTI = {
  dolaz: {
    id: "dolaz",
    naziv: "Dolazni kabel",
    oznaka: "W",
    tipovi: [
      { id: "3f5", label: "Trofazni 5-žilni (3P+N+PE)", zila: 5, faza: 3 },
      { id: "3f4", label: "Trofazni 4-žilni (3P+N / PEN)", zila: 4, faza: 3 },
      { id: "1f3", label: "Jednofazni 3-žilni (L+N+PE)", zila: 3, faza: 1 },
    ],
    presjeci: ["1.5", "2.5", "4", "6", "10", "16", "25", "35", "50", "70"],
  },

  glavni: {
    id: "glavni",
    naziv: "Glavni prekidač / sklopka",
    oznaka: "Q",
    tipovi: [
      { id: "mcb", label: "Automatski prekidač (MCB)", simbol: "mcb" },
      { id: "mccb", label: "Kompaktni prekidač (MCCB)", simbol: "mccb" },
      { id: "switch", label: "Sklopka / rastavljač", simbol: "switch" },
      { id: "isolator", label: "Rastavljač pod opterećenjem", simbol: "isolator" },
    ],
    polovi: [
      { id: "1P", label: "1P", broj: 1 },
      { id: "1P+N", label: "1P+N", broj: 2 },
      { id: "2P", label: "2P", broj: 2 },
      { id: "3P", label: "3P", broj: 3 },
      { id: "3P+N", label: "3P+N", broj: 4 },
      { id: "4P", label: "4P", broj: 4 },
    ],
    struje: ["6", "10", "16", "20", "25", "32", "40", "50", "63", "80", "100", "125", "160", "200", "250"],
    karakteristike: ["B", "C", "D"],
  },

  fid: {
    id: "fid",
    naziv: "FID / RCD (strujni zaštitni prekidač)",
    oznaka: "FID",
    tipovi: [
      { id: "rcd", label: "FID / RCD (samo diferencijalni)", simbol: "rcd" },
      { id: "rcbo", label: "RCBO (FID + nadstrujna zaštita)", simbol: "rcbo" },
    ],
    polovi: [
      { id: "2P", label: "2P", broj: 2 },
      { id: "4P", label: "4P", broj: 4 },
    ],
    struje: ["16", "20", "25", "32", "40", "63", "80", "100"],
    diferencijalne: ["10", "30", "100", "300"],
    tipoviFid: ["A", "AC", "B", "F"],
  },

  osigurac: {
    id: "osigurac",
    naziv: "Automatski osigurač / MCB",
    oznaka: "F",
    tipovi: [
      { id: "mcb", label: "Automatski prekidač MCB", simbol: "mcb" },
      { id: "fuse", label: "Osigurač s umetkom", simbol: "fuse" },
      { id: "rcbo", label: "RCBO (kombinirani)", simbol: "rcbo" },
    ],
    polovi: [
      { id: "1P", label: "1P", broj: 1 },
      { id: "1P+N", label: "1P+N", broj: 2 },
      { id: "2P", label: "2P", broj: 2 },
      { id: "3P", label: "3P", broj: 3 },
      { id: "3P+N", label: "3P+N", broj: 4 },
      { id: "4P", label: "4P", broj: 4 },
    ],
    struje: ["2", "4", "6", "10", "13", "16", "20", "25", "32", "40", "50", "63"],
    karakteristike: ["B", "C", "D"],
  },

  spd: {
    id: "spd",
    naziv: "Odvodnik prenapona (SPD)",
    oznaka: "SPD",
    tipovi: [
      { id: "t1", label: "Tip 1 (klasa B)", simbol: "spd" },
      { id: "t2", label: "Tip 2 (klasa C)", simbol: "spd" },
      { id: "t1t2", label: "Tip 1+2 (B+C)", simbol: "spd" },
    ],
  },

  brojilo: {
    id: "brojilo",
    naziv: "Brojilo energije",
    oznaka: "kWh",
    tipovi: [
      { id: "1f", label: "Jednofazno", simbol: "meter" },
      { id: "3f", label: "Trofazno", simbol: "meter" },
    ],
  },

  potrosac: {
    id: "potrosac",
    naziv: "Potrošač / krug",
    tipovi: [
      { id: "svjetlo", label: "Svjetlo / rasvjeta", ikona: "light", defaultStruja: "10", defaultPolovi: "1P", defaultMm: "1.5" },
      { id: "uticnica", label: "Utičnice", ikona: "socket", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "pecnica", label: "Pećnica", ikona: "oven", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "ploca", label: "Štednjak / ploča", ikona: "stove", defaultStruja: "32", defaultPolovi: "3P", defaultMm: "6" },
      { id: "indukcija", label: "Indukcijska ploča", ikona: "stove", defaultStruja: "16", defaultPolovi: "3P", defaultMm: "2.5" },
      { id: "bojler", label: "Bojler", ikona: "boiler", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "klima", label: "Klima uređaj", ikona: "ac", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "perilica", label: "Perilica rublja", ikona: "washer", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "sudoper", label: "Perilica suđa", ikona: "dishwasher", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "sušilica", label: "Sušilica", ikona: "dryer", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "garaza", label: "Garaža / radionica", ikona: "garage", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "vrt", label: "Vanjski / vrt", ikona: "garden", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "rezerva", label: "Rezerva", ikona: "spare", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
      { id: "ostalo", label: "Ostalo", ikona: "other", defaultStruja: "16", defaultPolovi: "1P", defaultMm: "2.5" },
    ],
  },

  kabel: {
    tipovi: ["PP00-Y", "PP/L-Y", "H05VV-F", "NYY-J", "NYM-J"],
    presjeci: ["1.5", "2.5", "4", "6", "10", "16"],
  },
};

/** Mapiranje ključnih riječi (HR) → tip potrošača */
const RIJECI_POTROSAC = [
  { tip: "pecnica", r: /\b(pečnic|pecnic|pećnic|oven)\w*/i },
  { tip: "indukcija", r: /(indukcij)\w*/i },
  { tip: "ploca", r: /(štednjak|stednjak|ploč[aeu]?|ploc[aeu]?)\w*/i },
  { tip: "svjetlo", r: /\b(svjetl|rasvjet|light|led)\w*/i },
  { tip: "uticnica", r: /\b(utičnic|uticnic|utič|utic|priključnic|socket)\w*/i },
  { tip: "bojler", r: /\b(bojler|boiler|vodogrij)\w*/i },
  { tip: "klima", r: /\b(klim|split|ac)\w*/i },
  { tip: "perilica", r: /\b(perilic\w*\s*rubl|veš\s*mašin|ves\s*masin)\w*/i },
  { tip: "sudoper", r: /\b(perilic\w*\s*suđ|sudomatin|dishwasher)\w*/i },
  { tip: "sušilica", r: /\b(sušilic|susilic|dryer)\w*/i },
  { tip: "garaza", r: /\b(garaž|garaz)\w*/i },
  { tip: "vrt", r: /\b(vrt|vanjsk|terasa|balkon)\w*/i },
  { tip: "rezerva", r: /\b(rezerv)\w*/i },
];

/** Presjek kabla prema In osigurača (kućni razvod) */
function defaultKabelMm(struja) {
  const a = Number(String(struja).replace(",", ".")) || 16;
  if (a <= 10) return "1.5";
  if (a <= 16) return "2.5";
  if (a <= 25) return "4";
  return "6";
}

function nazivPotrosaca(tipId) {
  return BAZA_KOMPONENTI.potrosac.tipovi.find((t) => t.id === tipId)?.label || tipId;
}

function defaultZaPotrosac(tipId) {
  return BAZA_KOMPONENTI.potrosac.tipovi.find((t) => t.id === tipId) || BAZA_KOMPONENTI.potrosac.tipovi.at(-1);
}
