/**
 * Parser tekstualnog opisa razvodne ploče (hrvatski)
 * Primjer: "trofazni dolaz 5x10 na glavni 4P 63A, FID1 4P 40A 30mA:
 * pećnica 16A, svjetlo 10A, utičnica 16A"
 */

function parseOpis(tekst) {
  const model = defaultModel();
  if (!tekst || !tekst.trim()) return model;

  const lines = tekst
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Spoji sve za globalne podatke
  const full = tekst.replace(/\n/g, " ");

  // Dolaz
  const dolazMatch = full.match(
    /(\d)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:mm²|mm2)?/i
  );
  if (dolazMatch) {
    model.dolaz.presjek = dolazMatch[2].replace(",", ".");
    const zila = parseInt(dolazMatch[1], 10);
    if (zila >= 5) model.dolaz.tip = "3f5";
    else if (zila === 4) model.dolaz.tip = "3f4";
    else model.dolaz.tip = "1f3";
  }
  if (/\btrofaz|3\s*faz|3f\b/i.test(full)) {
    if (model.dolaz.tip === "1f3") model.dolaz.tip = "3f5";
  }
  if (/\bjednofaz|1\s*faz|1f\b/i.test(full)) {
    model.dolaz.tip = "1f3";
  }

  // Glavni prekidač
  const glavniMatch = full.match(
    /glavn\w*\s*(?:prekida[čc]|sklopk\w*|osigura[čc])?\s*(?:od\s*)?(\d+P(?:\+N)?|[1234]P(?:\+N)?)\s*(?:od\s*)?(\d+)\s*A/i
  ) ||
    full.match(
      /glavn\w*[^\d]{0,40}?(\d+P(?:\+N)?)\s*(?:od\s*)?(\d+)\s*A/i
    ) ||
    full.match(
      /(?:prekida[čc]|sklopk\w*)\s*(?:glavn\w*)?\s*(?:od\s*)?(\d+P(?:\+N)?)\s*(?:od\s*)?(\d+)\s*A/i
    );

  if (glavniMatch) {
    model.glavni.polovi = normalizePolovi(glavniMatch[1]);
    model.glavni.struja = glavniMatch[2];
  } else {
    const alt = full.match(/glavn\w*[^\d]{0,30}?(\d+)\s*A/i);
    if (alt) model.glavni.struja = alt[1];
  }

  // Brojilo
  if (/\bbrojil/i.test(full)) model.brojilo = true;

  // SPD / prednaponska zaštita
  if (/\b(spd|odvodnik|prenapon|prednapon)/i.test(full)) {
    model.spd.enabled = true;
    if (/tip\s*1\+?2|b\+c|1\+2/i.test(full)) model.spd.tip = "t1t2";
    else if (/tip\s*1|klasa\s*b\b/i.test(full)) model.spd.tip = "t1";
    else model.spd.tip = "t2";
  }

  // Karakteristika glavnog (B/C/D)
  const karG = full.match(/glavn\w*[^\n]{0,40}?\b([BCD])\s*\d+\s*A/i) || full.match(/\b([BCD])\s*(\d+)\s*A\b/i);
  if (karG && /glavn/i.test(full)) model.glavni.karakteristika = karG[1].toUpperCase();

  // Direktni krugovi — s sabirnice NAKON glavnog, mimo FID-a
  model.direktni = extractDirektni(tekst);

  // FID grupe: podijeli po FID / RCD
  const fidParts = splitFidSections(tekst);
  if (fidParts.length) {
    model.fidovi = fidParts.map((part, i) => parseFidSection(part, i + 1));
  } else if (!model.direktni.length) {
    // Nema FID ni direktno — svi krugovi na jedan default FID
    const krugovi = extractKrugovi(tekst);
    if (krugovi.length) {
      model.fidovi = [
        {
          id: uid(),
          oznaka: "FID1",
          oznakaQ: "Q2",
          tip: "rcd",
          polovi: model.dolaz.tip.startsWith("3") ? "4P" : "2P",
          struja: "40",
          diferencijalna: "30",
          tipFid: "A",
          stezaljka: "X2",
          krugovi,
        },
      ];
    } else {
      model.fidovi = [];
    }
  } else {
    // Ima direktne, nema FID u tekstu — isprazni default FID-ove
    model.fidovi = [];
  }

  model.naziv =
    tekst.match(/(?:ormar|ploča|ploca|razvod)\s*[:\-]?\s*([^\n,;]{3,40})/i)?.[1]?.trim() ||
    model.naziv;

  // Investitor: Ana Cus  |  Jednopolna shema — Ana Cus
  const inv =
    tekst.match(/investitor\s*[:\-–—]\s*([^\n,;]{2,60})/i)?.[1]?.trim() ||
    tekst.match(/jednopoln\w*\s*shem\w*\s*[\-–—:]\s*([A-ZČĆŽŠĐa-zčćžšđ][^\n,;]{1,50})/i)?.[1]?.trim();
  if (inv && !/direktni|fid\b|odvodnik|trofaz|glavn|lokacij/i.test(inv)) {
    model.investitor = inv.replace(/\s*[—\-–].*$/, "").trim();
    model.naziv = `Jednopolna shema — ${model.investitor}`;
  }

  // Lokacija: Resetari 50 Kastav
  const lok = tekst.match(/lokacij\w*\s*[:\-–—]\s*([^\n;]{2,80})/i)?.[1]?.trim();
  if (lok) model.lokacija = lok;

  return model;
}

function splitFidSections(tekst) {
  const re = /(?:^|\n|;|,)\s*((?:FID|RCD|fid|rcd)\s*\d*)\b/gi;
  const indices = [];
  let m;
  const src = tekst;
  while ((m = re.exec(src)) !== null) {
    const offset = m[0].search(/FID|RCD/i);
    indices.push({ start: m.index + offset, label: m[1] });
  }
  if (!indices.length) return [];

  return indices.map((item, i) => {
    const end = i + 1 < indices.length ? indices[i + 1].start : src.length;
    return src.slice(item.start, end).trim();
  });
}

/**
 * Direktni osigurači — napon s glavne sabirnice NAKON Q1, NE preko FID-a
 * Primjeri:
 *   Direktno: štednjak 32A 3P Kuhinja
 *   Trofazni osigurač 3P C32: štednjak Kuhinja
 *   Bez FID: štednjak 32A 3P, ...
 */
function extractDirektni(tekst) {
  const blocks = [];
  const re =
    /(?:^|\n)\s*((?:Direktno|Direktni|Bez\s*FID|Trofazni\s+osigura[čc])[^\n]*)/gi;
  let m;
  const src = tekst;
  const hits = [];
  while ((m = re.exec(src)) !== null) {
    hits.push({ start: m.index + m[0].search(/\S/), text: m[1].trim() });
  }
  // kraj bloka = sljedeći Direktno/FID ili kraj
  hits.forEach((h, i) => {
    let end = src.length;
    if (i + 1 < hits.length) end = hits[i + 1].start;
    const fidNext = src.slice(h.start).search(/\n\s*FID\s*\d*/i);
    if (fidNext >= 0) end = Math.min(end, h.start + fidNext);
    blocks.push(src.slice(h.start, end).trim());
  });

  const krugovi = [];
  blocks.forEach((block) => {
    let body = block
      .replace(/^(?:Direktno|Direktni|Bez\s*FID)\s*:?\s*/i, "")
      .replace(/^Trofazni\s+osigura[čc]\s*/i, "");

    // "3P C32: štednjak" ili "3P 32A: štednjak"
    const head = body.match(
      /^(?:([BCD])\s*)?(\d+P(?:\+N)?)\s*(?:([BCD])\s*)?(\d+)\s*A?\s*:?\s*/i
    );
    let forcePolovi = null;
    let forceStruja = null;
    let forceKar = "C";
    if (head) {
      forcePolovi = normalizePolovi(head[2]);
      forceKar = (head[1] || head[3] || "C").toUpperCase();
      forceStruja = head[4];
      body = body.slice(head[0].length);
    } else if (/trofaz/i.test(block) || /^3P/i.test(body)) {
      forcePolovi = "3P";
    }

    // Ako je samo "štednjak" nakon "Trofazni osigurač 3P C32:"
    if (forceStruja && body && !/\d+\s*A/i.test(body)) {
      const raw = body.split(/,/)[0].trim() || "Trofazni krug";
      const prostorija = extractProstorija(raw);
      const nazivClean =
        raw
          .replace(
            /\s*(u|za)?\s*(kuhinj|kupatil|dnevni|spavać|spavac|garaž|garaz|hodnik|ostav|restoran|šank|sank|bašt|bast|vrt|stubi)\w*/i,
            ""
          )
          .trim() || raw;
      const tip = detectPotrosac(nazivClean);
      const def = defaultZaPotrosac(tip);
      krugovi.push({
        id: uid(),
        tip,
        naziv: nazivClean.charAt(0).toUpperCase() + nazivClean.slice(1),
        struja: forceStruja,
        polovi: forcePolovi || "3P",
        karakteristika: forceKar,
        tipOsiguraca: "mcb",
        prostorija,
        kabelMm: defaultKabelMm(forceStruja),
        kabelTip: "PP00-Y",
        direktno: true,
      });
      return;
    }

    const found = extractKrugovi(body || block);
    found.forEach((k) => {
      if (forcePolovi) k.polovi = forcePolovi;
      if (forceStruja && found.length === 1) k.struja = forceStruja;
      if (forceKar) k.karakteristika = forceKar;
      if (polesFromSafe(k.polovi) >= 3 && k.karakteristika === "B") k.karakteristika = "C";
      k.direktno = true;
      krugovi.push(k);
    });
  });

  return krugovi;
}

function parseFidSection(section, index) {
  const poloviMatch = section.match(/\b(\d+P(?:\+N)?)\b/i);
  const strujaMatch = section.match(/\b(\d+)\s*A\b/i);
  const diffMatch = section.match(/\b(\d+)\s*mA\b/i);
  const tipFidMatch = section.match(/\btip\s*([ABCF]|AC)\b/i);
  const labelMatch = section.match(/^(FID|RCD)\s*(\d*)/i);

  const oznaka = labelMatch
    ? `FID${labelMatch[2] || index}`
    : `FID${index}`;

  // Ukloni zaglavlje FID-a da ne pokupi njegovu struju kao krug
  let body = section.replace(/^(FID|RCD)\s*\d*\s*/i, "");
  body = body.replace(/^[^:]*?:/, ""); // nakon dvotočke

  // Makni FID specifikaciju s početka
  body = body.replace(
    /^(?:\s*(?:od\s*)?(?:\d+P(?:\+N)?)\s*)?(?:od\s*)?(?:\d+\s*A\s*)?(?:\d+\s*mA\s*)?(?:tip\s*[ABCF]{1,2}\s*)?/i,
    ""
  );

  return {
    id: uid(),
    oznaka,
    oznakaQ: `Q${index + 1}`,
    tip: /rcbo/i.test(section) ? "rcbo" : "rcd",
    polovi: poloviMatch ? normalizePolovi(poloviMatch[1]) : "4P",
    struja: strujaMatch ? strujaMatch[1] : "40",
    diferencijalna: diffMatch ? diffMatch[1] : "30",
    tipFid: tipFidMatch ? tipFidMatch[1].toUpperCase() : "A",
    stezaljka: `X${index + 1}`,
    krugovi: extractKrugovi(body || section),
  };
}

function extractKrugovi(tekst) {
  const krugovi = [];
  // "utičnice 16A Kuhinja", "indukcija B16 3P Kuhinja", "svjetlo C10A"
  const patterns = [
    /(?:za\s+)?([a-zA-ZčćžšđČĆŽŠĐ\s\/\-]{3,40}?)\s+(?:od\s+)?(?:([BCD])\s*(\d+)\s*A?|(\d+)\s*A)(?:\s*(\d+P(?:\+N)?))?(?:\s+([A-ZČĆŽŠĐa-zčćžšđ][A-ZČĆŽŠĐa-zčćžšđ0-9\s]{0,24}))?/gi,
  ];

  const seen = new Set();
  for (const re of patterns) {
    let m;
    while ((m = re.exec(tekst)) !== null) {
      const rawName = m[1].trim().replace(/^(za|i|te|tež|pod)\s+/i, "").trim();
      if (!rawName || /^(fid|rcd|glavn|dolaz|prekida|sklopk|osigura|direktn)/i.test(rawName)) continue;
      const karEx = m[2] ? m[2].toUpperCase() : null;
      const struja = m[3] || m[4];
      const poloviRaw = m[5];
      const prostorijaRaw = m[6] || "";
      const key = rawName.toLowerCase() + struja + prostorijaRaw;
      if (seen.has(key)) continue;
      seen.add(key);

      const tip = detectPotrosac(rawName);
      const def = defaultZaPotrosac(tip);
      const prostorija =
        (prostorijaRaw && !/^\d+P/i.test(prostorijaRaw) ? prostorijaRaw.trim() : "") ||
        extractProstorija(rawName);
      const nazivClean = rawName
        .replace(
          /\s*(u|za)?\s*(kuhinj|kupatil|dnevni|spavać|spavac|garaž|garaz|hodnik|ostav|restoran|šank|sank|bašt|bast|vrt|stubi|konob|teras|tavan|podrum|master|igraon|wc\s*\d*)\w*/i,
          ""
        )
        .trim();
      const poloviFinal = poloviRaw
        ? normalizePolovi(poloviRaw)
        : /\b3\s*f|\b3p|trofaz/i.test(rawName)
          ? "3P"
          : def.defaultPolovi;
      const kar = karEx || (polesFromSafe(poloviFinal) >= 3 ? "C" : "B");
      krugovi.push({
        id: uid(),
        tip,
        naziv: (nazivClean || rawName).charAt(0).toUpperCase() + (nazivClean || rawName).slice(1),
        struja,
        polovi: poloviFinal,
        karakteristika: kar,
        tipOsiguraca: "mcb",
        prostorija,
        kabelMm: defaultKabelMm(struja),
        kabelTip: "PP00-Y",
      });
    }
  }
  return krugovi;
}

function polesFromSafe(p) {
  if (!p) return 1;
  if (p === "4P" || p === "3P+N") return 4;
  if (p === "3P") return 3;
  if (p === "2P" || p === "1P+N") return 2;
  return 1;
}

function extractProstorija(name) {
  const map = [
    [/kuhinj/i, "Kuhinja"],
    [/kupatil|kupaon/i, "Kupaonica"],
    [/\bwc\s*1\b/i, "WC 1"],
    [/\bwc\s*2\b/i, "WC 2"],
    [/\bwc\b/i, "WC"],
    [/dnevn/i, "Dnevni boravak"],
    [/master/i, "Master"],
    [/igraon/i, "Igraona"],
    [/spavać|spavac/i, "Spavaća"],
    [/mala\s*sob/i, "Mala soba"],
    [/soba\s*2/i, "Soba 2"],
    [/garaž|garaz/i, "Garaža"],
    [/hodnik/i, "Hodnik"],
    [/stubi/i, "Stubište"],
    [/tavan/i, "Tavan"],
    [/ostav/i, "Ostava"],
    [/konob/i, "Konoba"],
    [/teras/i, "Terasa"],
    [/dvorišt|dvorist|van\b/i, "Van"],
    [/podrum/i, "Podrum"],
    [/kat\s*1/i, "Kat 1"],
    [/kat\s*2/i, "Kat 2"],
    [/kat\s*3/i, "Kat 3"],
    [/restoran/i, "Restoran"],
    [/šank|sank/i, "Šank"],
    [/bašt|bast|vrt|terasa/i, "Bašta"],
  ];
  for (const [r, label] of map) {
    if (r.test(name)) return label;
  }
  return "";
}

function detectPotrosac(name) {
  for (const { tip, r } of RIJECI_POTROSAC) {
    if (r.test(name)) return tip;
  }
  return "ostalo";
}

function normalizePolovi(p) {
  const s = String(p).toUpperCase().replace(/\s/g, "");
  if (s === "1P+N" || s === "2P" || s === "3P" || s === "3P+N" || s === "4P" || s === "1P") return s;
  if (s === "4") return "4P";
  if (s === "3") return "3P";
  if (s === "2") return "2P";
  if (s === "1") return "1P";
  return s.includes("4") ? "4P" : s.includes("3") ? "3P" : "1P";
}

function uid() {
  return "id_" + Math.random().toString(36).slice(2, 10);
}

function defaultModel() {
  return {
    naziv: "Jednopolna shema",
    investitor: "",
    lokacija: "",
    naslovna: true,
    stezaljka: "X1",
    prikaziStezaljke: false,
    startBroj: 1,
    dolaz: { tip: "3f5", presjek: "10", oznaka: "W1" },
    brojilo: false,
    spd: { enabled: false, tip: "t2" },
    glavni: {
      tip: "mcb",
      polovi: "4P",
      struja: "63",
      karakteristika: "C",
      oznaka: "Q1",
    },
    direktni: [
      {
        id: uid(),
        tip: "ploca",
        naziv: "Štednjak",
        struja: "32",
        polovi: "3P",
        karakteristika: "C",
        tipOsiguraca: "mcb",
        prostorija: "Kuhinja",
        kabelMm: "6",
        kabelTip: "PP00-Y",
        direktno: true,
      },
    ],
    fidovi: [
      {
        id: uid(),
        oznaka: "FID1",
        oznakaQ: "Q2",
        tip: "rcd",
        polovi: "4P",
        struja: "40",
        diferencijalna: "30",
        tipFid: "A",
        stezaljka: "X1",
        krugovi: [
          mkKrug("pecnica", "Pećnica", "16", "Kuhinja"),
          mkKrug("svjetlo", "Svjetlo", "10", "Kuhinja"),
          mkKrug("uticnica", "Utičnice", "16", "Kuhinja"),
        ],
      },
      {
        id: uid(),
        oznaka: "FID2",
        oznakaQ: "Q3",
        tip: "rcd",
        polovi: "4P",
        struja: "40",
        diferencijalna: "30",
        tipFid: "A",
        stezaljka: "X2",
        krugovi: [
          mkKrug("bojler", "Bojler", "16", "Kupaonica"),
          mkKrug("uticnica", "Utičnice", "16", "Kupaonica"),
          mkKrug("svjetlo", "Rasvjeta", "10", "Kupaonica"),
          mkKrug("rezerva", "Rezerva", "16", "Hodnik"),
        ],
      },
    ],
  };
}

function mkKrug(tip, naziv, struja, prostorija) {
  const def = defaultZaPotrosac(tip);
  return {
    id: uid(),
    tip,
    naziv,
    struja,
    polovi: def.defaultPolovi,
    karakteristika: "B",
    tipOsiguraca: "mcb",
    prostorija: prostorija || "",
    kabelMm: defaultKabelMm(struja),
    kabelTip: "PP00-Y",
  };
}
