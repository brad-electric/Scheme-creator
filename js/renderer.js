/**
 * SVG renderer — CAD stil + A4 landscape paginacija
 *
 * List 1: Dolaz → Glavni → sabirnica → FID-ovi koliko stanu
 * List 2+: nastavak sabirnice → preostali FID-ovi
 */

const CAD = {
  colW: 44,
  busGap: 10,
  mcbH: 36,
  cableH: 70,
  nPeH: 36,
  tableNazivH: 70,
  tableBrojH: 24,
  tableLokH: 22,
  ink: "#111",
  gapFid: 28,
  mainX: 70,
  busStart: 155,
  fidZoneW: 120,
  // A4 landscape (mm→px @96dpi ≈ 297×210 → 1123×794)
  pageW: 1123,
  pageH: 794,
  margin: 18,
};

function svgDefs() {
  return `<defs>
    <style>
      text { paint-order: stroke; stroke: #fff; stroke-width: 2.4px; stroke-linejoin: round }
      .t-title { font: 600 11px Arial,sans-serif; fill:#111 }
      .t-label { font: 700 10px Arial,sans-serif; fill:#111 }
      .t-tiny { font: 500 8px Arial,sans-serif; fill:#111 }
      .t-cable { font: 500 7.5px Arial,sans-serif; fill:#111; stroke-width: 3px }
      .t-table { font: 500 8px Arial,sans-serif; fill:#111 }
      .t-room { font: 700 9px Arial,sans-serif; fill:#111 }
      .t-phase { font: 700 9px Arial,sans-serif; fill:#111 }
      .t-fid { font: 700 11px Arial,sans-serif; fill:#111 }
      .t-page { font: 500 9px Arial,sans-serif; fill:#444 }
      .t-cover-kicker { font: 600 12px Arial,sans-serif; fill:#111; letter-spacing: 0.28em }
      .t-cover-title { font: 700 36px Arial,sans-serif; fill:#111 }
      .t-cover-sub { font: 500 16px Arial,sans-serif; fill:#333 }
      .t-cover-label { font: 500 10px Arial,sans-serif; fill:#666; letter-spacing: 0.12em }
      .t-cover-investitor { font: 700 28px Arial,sans-serif; fill:#111 }
      .t-cover-lok { font: 500 16px Arial,sans-serif; fill:#222 }
    </style>
  </defs>`;
}

/** Glavni ulaz: container (npr. #shema-pages), ne jedan SVG */
function renderShema(model, containerEl) {
  const schemaPages = buildPages(model);
  const withCover = model.naslovna !== false;
  const pages = withCover
    ? [{ isCover: true }, ...schemaPages]
    : schemaPages;

  containerEl.innerHTML = "";
  pages.forEach((page, pi) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.classList.add("shema-page");
    if (page.isCover) svg.classList.add("shema-cover");
    svg.dataset.page = String(pi + 1);
    if (page.isCover) {
      fillCoverSvg(model, svg, pi, pages.length, schemaPages.length);
    } else {
      const schemaIndex = withCover ? pi - 1 : pi;
      fillPageSvg(model, page, svg, schemaIndex, schemaPages.length);
    }
    containerEl.appendChild(svg);
  });
  return pages.length;
}

function fidWidth(fid) {
  const krugovi = fid.krugovi || [];
  if (!krugovi.length) return CAD.fidZoneW + CAD.colW + 8;
  let w = 0;
  krugovi.forEach((k, i) => {
    w += circuitSpan(k) + (i ? 8 : 0);
  });
  return CAD.fidZoneW + w + 8;
}

function circuitSpan(k) {
  const p = polesFrom(k.polovi, 1);
  if (p >= 3) return CAD.colW * 3.0;
  if (p === 2) return CAD.colW * 1.6;
  return CAD.colW;
}

function isMultiPole(k) {
  return polesFrom(k.polovi, 1) >= 3;
}

function buildPages(model) {
  const fidovi = model.fidovi || [];
  const pages = [];
  const startBroj = model.startBroj || 1;
  const dirN = (model.direktni || []).length;

  if (!fidovi.length && !dirN) {
    return [{ isFirst: true, fidovi: [], fidGlobalIndices: [], startF: startBroj, direktniStartF: startBroj }];
  }

  // FID brojevi počinju nakon direktnih osigurača
  let startF = startBroj + dirN;
  let pageStartF = startF;
  let batch = [];
  let batchIndices = [];
  let isFirst = true;
  const page1Avail =
    CAD.pageW -
    CAD.margin -
    (CAD.busStart + 36) -
    (dirN ? 160 : 0) -
    ((model.spd && model.spd.enabled) ? 68 : 0);
  const contAvail = CAD.pageW - CAD.margin - 70;
  let avail = Math.max(page1Avail, 200);

  const batchWidth = () =>
    batch.reduce((sum, f, i) => sum + fidWidth(f) + (i ? CAD.gapFid : 0), 0);

  const flush = () => {
    pages.push({
      isFirst,
      fidovi: batch.slice(),
      fidGlobalIndices: batchIndices.slice(),
      startF: pageStartF,
      direktniStartF: startBroj,
    });
    batch = [];
    batchIndices = [];
    pageStartF = startF;
    isFirst = false;
    avail = contAvail;
  };

  if (!fidovi.length) {
    pages.push({
      isFirst: true,
      fidovi: [],
      fidGlobalIndices: [],
      startF: startBroj + dirN,
      direktniStartF: startBroj,
    });
    return pages;
  }

  fidovi.forEach((fid, fi) => {
    const w = fidWidth(fid);
    const nextW = batchWidth() + w + (batch.length ? CAD.gapFid : 0);
    if (batch.length && nextW > avail) flush();
    batch.push(fid);
    batchIndices.push(fi);
    startF += (fid.krugovi || []).length;
  });
  if (batch.length) flush();
  return pages;
}

function fillPageSvg(model, page, svgEl, pageIndex, pageCount) {
  const layout = computePageLayout(model, page);
  const parts = [];

  parts.push(`<rect width="${CAD.pageW}" height="${CAD.pageH}" fill="#fff"/>`);
  parts.push(...drawTitleBlock(model, pageIndex, pageCount));

  if (page.isFirst) {
    parts.push(...drawIncomingAndMain(model, layout));
    if (layout.spd) {
      parts.push(...drawSpd(model, layout.spd));
    }
    if (layout.direktni) {
      parts.push(
        ...drawDirektniGroup(model, layout.direktni, page.direktniStartF || model.startBroj || 1)
      );
    }
  } else {
    parts.push(...drawContinuationBus(model, layout, pageIndex + 1));
  }

  let startF = page.startF;
  page.fidovi.forEach((fid, i) => {
    const gi = page.fidGlobalIndices[i];
    parts.push(...drawFidGroup(model, fid, layout.groups[i], startF, gi));
    startF += (fid.krugovi || []).length;
  });

  svgEl.setAttribute("viewBox", `0 0 ${CAD.pageW} ${CAD.pageH}`);
  svgEl.setAttribute("width", String(CAD.pageW));
  svgEl.setAttribute("height", String(CAD.pageH));
  svgEl.innerHTML = `${svgDefs()}\n${parts.join("\n")}`;
}

function sheetTitle(model) {
  const inv = (model.investitor || "").trim();
  if (inv) return `Jednopolna shema — ${inv}`;
  const n = (model.naziv || "").trim();
  if (n && !/direktni\s*3p/i.test(n)) return n;
  return "Jednopolna shema";
}

/** Naslovna A4 landscape stranica */
function fillCoverSvg(model, svgEl, pageIndex, totalPages, schemaPageCount) {
  const parts = [];
  const W = CAD.pageW;
  const H = CAD.pageH;
  const m = 48;
  const nFid = (model.fidovi || []).length;
  const nDir = (model.direktni || []).length;
  const nKrug =
    nDir + (model.fidovi || []).reduce((a, f) => a + (f.krugovi?.length || 0), 0);
  const g = model.glavni || {};
  const d = model.dolaz || {};
  const today = new Date();
  const datum = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}.`;

  parts.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
  // vanjski okvir
  parts.push(
    `<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${CAD.ink}" stroke-width="1.4"/>`
  );
  parts.push(
    `<rect x="${m + 8}" y="${m + 8}" width="${W - 2 * m - 16}" height="${H - 2 * m - 16}" fill="none" stroke="${CAD.ink}" stroke-width="0.7"/>`
  );

  const cx = W / 2;
  parts.push(
    `<text x="${cx}" y="${m + 90}" text-anchor="middle" class="t-cover-kicker">ELEKTROINSTALACIJE</text>`
  );
  parts.push(
    `<text x="${cx}" y="${m + 150}" text-anchor="middle" class="t-cover-title">JEDNOPOLNA SHEMA</text>`
  );
  parts.push(
    `<text x="${cx}" y="${m + 178}" text-anchor="middle" class="t-cover-sub">razvodnog ormara</text>`
  );

  // linija
  parts.push(hline(cx - 160, m + 200, cx + 160, m + 200, 1.2));

  const inv = (model.investitor || "").trim() || "—";
  const lok = (model.lokacija || "").trim() || "—";
  parts.push(
    `<text x="${cx}" y="${m + 245}" text-anchor="middle" class="t-cover-label">Investitor</text>`
  );
  parts.push(
    `<text x="${cx}" y="${m + 278}" text-anchor="middle" class="t-cover-investitor">${escapeXml(inv)}</text>`
  );
  parts.push(
    `<text x="${cx}" y="${m + 310}" text-anchor="middle" class="t-cover-label">Lokacija</text>`
  );
  parts.push(
    `<text x="${cx}" y="${m + 338}" text-anchor="middle" class="t-cover-lok">${escapeXml(lok)}</text>`
  );

  // sažetak tablice
  const boxX = cx - 220;
  const boxY = m + 380;
  const boxW = 440;
  const boxH = 150;
  parts.push(
    `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="none" stroke="${CAD.ink}" stroke-width="1.1"/>`
  );
  const rows = [
    ["Dolaz", formatDolazShort(d)],
    ["Glavni prekidač", `${g.polovi || "4P"} ${g.karakteristika || "C"}${g.struja || "63"}A`],
    ["SPD", model.spd?.enabled ? spdTipLabel(model.spd.tip) : "nema"],
    ["Zaštita", `${nDir ? nDir + " direktno · " : ""}${nFid} FID · ${nKrug} krugova`],
    ["Shema", `${schemaPageCount} A4 list${schemaPageCount === 1 ? "" : "a"} (+ naslovna)`],
  ];
  rows.forEach((row, i) => {
    const y = boxY + 26 + i * 26;
    if (i) parts.push(hline(boxX, boxY + 8 + i * 26, boxX + boxW, boxY + 8 + i * 26, 0.6));
    parts.push(`<text x="${boxX + 14}" y="${y}" class="t-tiny">${escapeXml(row[0])}</text>`);
    parts.push(
      `<text x="${boxX + boxW - 14}" y="${y}" text-anchor="end" class="t-label">${escapeXml(row[1])}</text>`
    );
  });

  parts.push(
    `<text x="${cx}" y="${H - m - 36}" text-anchor="middle" class="t-page">Datum: ${datum}</text>`
  );
  parts.push(
    `<text x="${cx}" y="${H - m - 18}" text-anchor="middle" class="t-page">List ${pageIndex + 1} / ${totalPages} · A4 landscape</text>`
  );

  svgEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svgEl.setAttribute("width", String(W));
  svgEl.setAttribute("height", String(H));
  svgEl.innerHTML = `${svgDefs()}\n${parts.join("\n")}`;
}

function spdTipLabel(tip) {
  if (tip === "t1") return "Tip 1 (klasa B)";
  if (tip === "t1t2") return "Tip 1+2 (B+C)";
  return "Tip 2 (klasa C)";
}

/** CAD tablica u donjem desnom kutu A4 lista */
function drawTitleBlock(model, pageIndex, pageCount) {
  const parts = [];
  const w = 260;
  const h = 58;
  const x = CAD.pageW - CAD.margin - w;
  const y = CAD.pageH - CAD.margin - h;
  const title = sheetTitle(model);

  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${CAD.ink}" stroke-width="1.2"/>`
  );
  parts.push(hline(x, y + 22, x + w, y + 22, 1));
  parts.push(hline(x, y + 40, x + w, y + 40, 0.9));
  parts.push(
    `<text x="${x + 8}" y="${y + 15}" class="t-title">${escapeXml(title)}</text>`
  );
  parts.push(
    `<text x="${x + 8}" y="${y + 34}" class="t-tiny">Investitor: ${escapeXml((model.investitor || "—").trim() || "—")}</text>`
  );
  parts.push(
    `<text x="${x + 8}" y="${y + 52}" class="t-tiny">${escapeXml(model.lokacija || "Razvodni ormar")}</text>`
  );
  parts.push(
    `<text x="${x + w - 8}" y="${y + 52}" text-anchor="end" class="t-page">A4 · ${pageIndex + 1}/${pageCount}</text>`
  );
  return parts;
}

function computePageLayout(model, page) {
  const busY0 = CAD.margin + 28;
  const mainYs = makeYs(busY0);
  const isFirst = page.isFirst;
  let x = isFirst ? CAD.busStart + 36 : 70;
  const groups = [];
  let maxH = mainYs[4] + 40;
  let direktniLayout = null;
  let spdLayout = null;

  // SPD — odmah nakon Q1 na glavnoj sabirnici
  if (isFirst && model.spd?.enabled) {
    const w = 58;
    spdLayout = {
      x,
      w,
      cx: x + 28,
      mainYs,
      tip: model.spd.tip || "t2",
    };
    x += w + 10;
  }

  // Direktni osigurači — samo na prvom listu, odmah nakon glavnog
  if (isFirst && (model.direktni || []).length) {
    const krugovi = model.direktni;
    let circW = 0;
    krugovi.forEach((k, i) => {
      circW += circuitSpan(k) + (i ? 10 : 0);
    });
    const centers = [];
    let cx = 0;
    krugovi.forEach((k) => {
      const span = circuitSpan(k);
      centers.push(cx + span / 2);
      cx += span + 10;
    });
    const branchTop = mainYs[4] + 28;
    const showTerm = !!model.prikaziStezaljke;
    const termExtra = showTerm ? 28 : 8;
    const branchH = 10 + CAD.mcbH + 14 + termExtra + CAD.nPeH + CAD.cableH + 14;
    const tableTop = branchTop + branchH + 4;
    const w = circW + 40;
    direktniLayout = {
      x,
      w,
      circ0: x + 20,
      centers,
      branchTop,
      tableTop,
      mainYs,
      label: "Direktno (bez FID)",
    };
    maxH = Math.max(maxH, tableTop + CAD.tableBrojH + CAD.tableNazivH + CAD.tableLokH);
    x += w + CAD.gapFid + 12;
  }

  page.fidovi.forEach((fid) => {
    const krugovi = fid.krugovi || [];
    const n = Math.max(krugovi.length, 1);
    let circW = 0;
    krugovi.forEach((k, i) => {
      circW += circuitSpan(k) + (i ? 8 : 0);
    });
    if (!krugovi.length) circW = CAD.colW;
    const w = CAD.fidZoneW + circW + 8;
    const subY0 = mainYs[4] + 90;
    const branchTop = subY0 + CAD.busGap * 3 + 32;
    const showTerm = !!model.prikaziStezaljke;
    const termExtra = showTerm ? 28 : 8;
    const branchH =
      10 + CAD.mcbH + 14 + termExtra + CAD.nPeH + CAD.cableH + 14;
    const tableTop = branchTop + branchH + 4;
    const tableH = CAD.tableBrojH + CAD.tableNazivH + CAD.tableLokH;

    const centers = [];
    let cx = 0;
    krugovi.forEach((k) => {
      const span = circuitSpan(k);
      centers.push(cx + span / 2);
      cx += span + 8;
    });

    groups.push({
      x,
      w,
      n,
      fidX: x + 78,
      circ0: x + CAD.fidZoneW,
      centers,
      subY0,
      branchTop,
      tableTop,
      mainYs,
    });
    maxH = Math.max(maxH, tableTop + tableH);
    x += w + CAD.gapFid;
  });

  return {
    width: CAD.pageW,
    height: CAD.pageH,
    mainYs,
    busEnd: CAD.pageW - CAD.margin,
    mainBottom: mainYs[4] + 140,
    groups,
    isFirst,
    direktni: direktniLayout,
    spd: spdLayout,
  };
}

function makeYs(y0) {
  return [y0, y0 + CAD.busGap, y0 + CAD.busGap * 2, y0 + CAD.busGap * 3 + 3, y0 + CAD.busGap * 4 + 5];
}

function drawIncomingAndMain(model, layout) {
  const parts = [];
  const ys = layout.mainYs;
  const mx = CAD.mainX;
  const g = model.glavni || {};
  const poles = Math.min(polesFrom(g.polovi, 4), 4);
  const poleGap = CAD.busGap;

  ["L1", "L2", "L3", "N", "PE"].forEach((lab, i) => {
    parts.push(`<text x="${CAD.busStart - 4}" y="${ys[i] - 3}" text-anchor="end" class="t-phase">${lab}</text>`);
    parts.push(hline(CAD.busStart, ys[i], layout.busEnd, ys[i], i < 3 ? 2.6 : 1.35));
  });
  parts.push(`<text x="${CAD.busStart + 50}" y="${ys[0] - 8}" class="t-phase">L1 L2 L3</text>`);

  const boxTop = ys[0] - 4;
  const boxH = poles * poleGap + 28;
  const x0Y = boxTop + boxH + 20;
  const dolazEnd = Math.min(x0Y + 52, CAD.pageH - 40);

  parts.push(symbolMainVertical(mx, boxTop, poles, poleGap, boxH));

  for (let i = 0; i < 4; i++) {
    parts.push(hline(mx + 20, ys[i], CAD.busStart, ys[i], 1.3));
    parts.push(`<circle cx="${CAD.busStart}" cy="${ys[i]}" r="2.2" fill="#fff" stroke="${CAD.ink}" stroke-width="1.15"/>`);
  }
  parts.push(vline(mx + 28, x0Y, ys[4], 1.15));
  parts.push(hline(mx + 28, ys[4], CAD.busStart, ys[4], 1.2));
  parts.push(`<circle cx="${CAD.busStart}" cy="${ys[4]}" r="2" fill="#fff" stroke="${CAD.ink}" stroke-width="1.1"/>`);

  parts.push(`<text x="${mx}" y="${boxTop - 6}" text-anchor="middle" class="t-label">${escapeXml(g.oznaka || "Q1")}</text>`);
  parts.push(`<text x="${mx + 26}" y="${x0Y - 16}" class="t-label">Glavni prekidač</text>`);
  parts.push(`<text x="${mx + 26}" y="${x0Y - 4}" class="t-tiny">${g.polovi || "4P"} ${g.karakteristika || "C"}${g.struja || "63"}A</text>`);

  parts.push(hline(mx - 18, x0Y, mx + 18, x0Y, 1.25));
  for (let i = 0; i < 4; i++) {
    const sx = mx - 12 + i * 8;
    parts.push(`<circle cx="${sx}" cy="${x0Y}" r="2.6" fill="#fff" stroke="${CAD.ink}" stroke-width="1.1"/>`);
    parts.push(`<line x1="${sx - 3}" y1="${x0Y - 3}" x2="${sx + 3}" y2="${x0Y + 3}" stroke="${CAD.ink}" stroke-width="1"/>`);
  }
  parts.push(vline(mx, boxTop + boxH, x0Y, 1.25));
  parts.push(`<text x="${mx - 24}" y="${x0Y + 4}" text-anchor="end" class="t-label">X0</text>`);

  parts.push(vline(mx, x0Y, dolazEnd, 1.4));
  parts.push(symbolLoadCad(mx, dolazEnd));
  const kabel = `PP00 ${formatDolazShort(model.dolaz)}`;
  const mid = (x0Y + dolazEnd) / 2;
  parts.push(
    `<text x="${mx + 12}" y="${mid}" class="t-cable" transform="rotate(90 ${mx + 12} ${mid})">${escapeXml(kabel)}</text>`
  );
  parts.push(`<text x="${mx}" y="${dolazEnd + 14}" text-anchor="middle" class="t-tiny">Dolaz</text>`);

  return parts;
}

/** Nastavak na sljedećem A4 listu — sabirnica bez ponovnog glavnog */
function drawContinuationBus(model, layout, pageNo) {
  const parts = [];
  const ys = layout.mainYs;
  const left = 70;

  ["L1", "L2", "L3", "N", "PE"].forEach((lab, i) => {
    parts.push(`<text x="${left - 6}" y="${ys[i] + 3}" text-anchor="end" class="t-phase">${lab}</text>`);
    parts.push(hline(left, ys[i], layout.busEnd, ys[i], i < 3 ? 2.6 : 1.35));
  });
  parts.push(
    `<text x="${left + 8}" y="${ys[0] - 10}" class="t-label">Nastavak sabirnice (nakon ${escapeXml(model.glavni?.oznaka || "Q1")}) · list ${pageNo}</text>`
  );
  // strelica "dolazi s prethodnog lista"
  parts.push(
    `<polygon points="${left - 2},${ys[1]} ${left - 12},${ys[1] - 5} ${left - 12},${ys[1] + 5}" fill="${CAD.ink}"/>`
  );
  return parts;
}

/**
 * Odvodnik prenapona (SPD) — tap s glavne sabirnice nakon Q1, na PE
 */
function drawSpd(model, grp) {
  const parts = [];
  if (!grp) return parts;
  const ys = grp.mainYs;
  const cx = grp.cx;
  const tipMap = { t1: "Tip 1", t2: "Tip 2", t1t2: "Tip 1+2" };
  const tipLab = tipMap[grp.tip] || tipMap[model.spd?.tip] || "Tip 2";

  // Spojevi L1 L2 L3 N
  for (let i = 0; i < 4; i++) {
    const px = cx - 12 + i * 8;
    parts.push(`<circle cx="${px}" cy="${ys[i]}" r="2.1" fill="#fff" stroke="${CAD.ink}" stroke-width="1.1"/>`);
    parts.push(vline(px, ys[i], ys[4] + 22, 1.05));
  }

  // zajednički spoj ispod N
  const joinY = ys[4] + 22;
  parts.push(hline(cx - 12, joinY, cx + 12, joinY, 1.1));
  parts.push(vline(cx, joinY, joinY + 10, 1.15));

  // SPD simbol — varistorski “blok” + strelica prema PE
  const boxY = joinY + 10;
  const boxH = 36;
  parts.push(
    `<rect x="${cx - 22}" y="${boxY}" width="44" height="${boxH}" rx="2" fill="#fff" stroke="${CAD.ink}" stroke-width="1.2"/>`
  );
  parts.push(`<text x="${cx}" y="${boxY + 13}" text-anchor="middle" class="t-fid">SPD</text>`);
  parts.push(`<text x="${cx}" y="${boxY + 24}" text-anchor="middle" class="t-tiny">${escapeXml(tipLab)}</text>`);
  parts.push(`<text x="${cx}" y="${boxY + 33}" text-anchor="middle" class="t-tiny">prenapon</text>`);

  // izlaz na PE sabirnicu
  const peTapX = cx + 28;
  parts.push(vline(cx, boxY + boxH, boxY + boxH + 14, 1.15));
  parts.push(hline(cx, boxY + boxH + 14, peTapX, boxY + boxH + 14, 1.1));
  parts.push(vline(peTapX, ys[4], boxY + boxH + 14, 1.1));
  parts.push(`<circle cx="${peTapX}" cy="${ys[4]}" r="2.1" fill="#fff" stroke="${CAD.ink}" stroke-width="1.1"/>`);

  // zemlja simbol ispod
  const gY = boxY + boxH + 18;
  parts.push(hline(cx - 8, gY, cx + 8, gY, 1.2));
  parts.push(hline(cx - 5, gY + 4, cx + 5, gY + 4, 1.1));
  parts.push(hline(cx - 2, gY + 8, cx + 2, gY + 8, 1));
  parts.push(`<text x="${cx}" y="${boxY - 4}" text-anchor="middle" class="t-label">FSPD</text>`);

  return parts;
}

/**
 * Direktni osigurači — tap s GLAVNE sabirnice nakon Q1, mimo FID-a
 */
function drawDirektniGroup(model, grp, startF) {
  const parts = [];
  const krugovi = model.direktni || [];
  if (!krugovi.length || !grp) return parts;

  const mainYs = grp.mainYs;
  const xs = [];
  const showTerm = !!model.prikaziStezaljke;
  let termY = 0;

  krugovi.forEach((k, ki) => {
    const cx = grp.circ0 + (grp.centers ? grp.centers[ki] : (ki + 0.5) * CAD.colW);
    xs.push(cx);
    const fNum = startF + ki;
    const multi = isMultiPole(k);
    const poles = Math.min(polesFrom(k.polovi, 1), 3);

    if (multi) {
      for (let p = 0; p < poles; p++) {
        const px = cx + (p - (poles - 1) / 2) * 8;
        parts.push(`<circle cx="${px}" cy="${mainYs[p]}" r="2.2" fill="#fff" stroke="${CAD.ink}" stroke-width="1.15"/>`);
        parts.push(vline(px, mainYs[p], grp.branchTop, 1.15));
      }
    } else {
      const phase = mainYs[ki % 3];
      parts.push(`<circle cx="${cx}" cy="${phase}" r="2.2" fill="#fff" stroke="${CAD.ink}" stroke-width="1.15"/>`);
      parts.push(vline(cx, phase, grp.branchTop, 1.15));
    }

    let y = grp.branchTop;
    const poleHalf = multi ? ((poles - 1) / 2) * 8 : 0;
    const labelX = cx + poleHalf + 14;

    if (multi) {
      parts.push(`<text x="${labelX}" y="${y + 12}" class="t-label">F${fNum}</text>`);
      parts.push(symbolMcb3P(cx, y, poles));
      parts.push(`<text x="${labelX}" y="${y + 26}" class="t-tiny">${k.polovi} ${k.karakteristika || "C"}${k.struja}A</text>`);
      y += CAD.mcbH + 6;
    } else {
      parts.push(`<text x="${cx}" y="${y - 6}" text-anchor="middle" class="t-label">F${fNum}</text>`);
      parts.push(symbolMcbIec(cx, y));
      y += CAD.mcbH;
      parts.push(`<text x="${cx + 12}" y="${y - 6}" class="t-tiny">${k.struja}A, ${k.karakteristika || "B"}</text>`);
      y += 8;
    }

    if (showTerm) {
      termY = y + 14;
      parts.push(vline(cx, y, termY, 1.15));
      parts.push(symbolTerminal(cx, termY));
      y = termY + 10;
    } else if (multi) {
      y += 4;
    }

    const nPeTop = y;
    const nX = cx - (multi ? poleHalf + 14 : 8);
    const peX2 = multi ? labelX + 36 : cx + 8;
    parts.push(`<circle cx="${nX}" cy="${mainYs[3]}" r="1.8" fill="${CAD.ink}"/>`);
    parts.push(vline(nX, mainYs[3], nPeTop, 1));
    parts.push(`<circle cx="${peX2}" cy="${mainYs[4]}" r="1.8" fill="${CAD.ink}"/>`);
    parts.push(vline(peX2, mainYs[4], nPeTop, 1));

    if (multi) {
      for (let p = 0; p < poles; p++) {
        const px = cx + (p - (poles - 1) / 2) * 8;
        parts.push(vline(px, y, nPeTop + 8, 1.05));
      }
      parts.push(hline(cx - poleHalf, nPeTop + 8, cx + poleHalf, nPeTop + 8, 1.05));
      parts.push(vline(cx, nPeTop + 8, nPeTop + CAD.nPeH, 1.2));
    } else {
      parts.push(vline(cx, y, nPeTop + CAD.nPeH, 1.2));
    }
    parts.push(vline(nX, nPeTop, nPeTop + CAD.nPeH, 1));
    parts.push(vline(peX2, nPeTop, nPeTop + CAD.nPeH, 1));
    parts.push(`<text x="${nX - 4}" y="${nPeTop + 16}" text-anchor="end" class="t-tiny">N</text>`);
    parts.push(`<text x="${peX2 + 4}" y="${nPeTop + 16}" class="t-tiny">PE</text>`);

    const bundleY = nPeTop + CAD.nPeH;
    parts.push(hline(nX, bundleY, peX2, bundleY, 1));
    y = bundleY + 4;

    const kabel = k.kabel || defaultKabel(k);
    const mid = y + CAD.cableH / 2;
    parts.push(vline(cx, y, y + CAD.cableH, 1.15));
    parts.push(
      `<text x="${cx - 5}" y="${mid}" text-anchor="middle" class="t-cable" transform="rotate(-90 ${cx - 5} ${mid})">${escapeXml(kabel)}</text>`
    );
    parts.push(symbolLoadCad(cx, y + CAD.cableH));
  });

  parts.push(...drawTable(krugovi, xs, grp.tableTop, startF, CAD.colW));
  return parts;
}

function drawFidGroup(model, fid, grp, startF, index) {
  const parts = [];
  const krugovi = fid.krugovi || [];
  if (!krugovi.length || !grp) return parts;

  const mainYs = grp.mainYs;
  const fx = grp.fidX;
  const subYs = makeYs(grp.subY0);
  // Pod-sabirnica ide do kraja FID grupe (ne samo do starog colW×n)
  const subEnd = grp.x + grp.w - 4;
  const nPoles = Math.min(polesFrom(fid.polovi, 4), 4);
  const poleGapX = 9;

  const poleXs = [];
  for (let i = 0; i < nPoles; i++) {
    poleXs.push(fx - ((nPoles - 1) * poleGapX) / 2 + i * poleGapX);
  }

  const contactY = mainYs[3] + 18;
  const coilCy = contactY + 16;
  const outY = coilCy + 18;

  for (let i = 0; i < nPoles; i++) {
    const px = poleXs[i];
    parts.push(`<circle cx="${px}" cy="${mainYs[i]}" r="2.4" fill="${CAD.ink}"/>`);
    parts.push(vline(px, mainYs[i], contactY, 1.25));
  }

  parts.push(symbolFidLikeCad(poleXs, contactY, coilCy));

  const qOzn = fid.oznakaQ || `Q${index + 2}`;
  const diff = formatDiff(fid.diferencijalna);
  const boxW = 74;
  const boxH = 46;
  const boxX = poleXs[0] - 14 - boxW;
  const boxY = contactY - 6;

  parts.push(
    `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="2" fill="#fff" stroke="${CAD.ink}" stroke-width="1.1"/>`
  );
  parts.push(
    `<text x="${boxX + boxW / 2}" y="${boxY + 14}" text-anchor="middle" class="t-fid">${escapeXml(fid.oznaka || "FID" + (index + 1))}</text>`
  );
  parts.push(
    `<text x="${boxX + boxW / 2}" y="${boxY + 26}" text-anchor="middle" class="t-tiny">${escapeXml(qOzn)} · ${fid.polovi} · tip ${fid.tipFid || "A"}</text>`
  );
  parts.push(
    `<text x="${boxX + boxW / 2}" y="${boxY + 38}" text-anchor="middle" class="t-tiny">Fid ${fid.struja}/${diff}A</text>`
  );
  parts.push(hline(boxX + boxW, boxY + boxH / 2, poleXs[0] - 4, boxY + boxH / 2, 0.9));

  for (let i = 0; i < nPoles; i++) {
    const px = poleXs[i];
    parts.push(vline(px, outY, subYs[i], 1.2));
    parts.push(`<circle cx="${px}" cy="${subYs[i]}" r="2.2" fill="${CAD.ink}"/>`);
    parts.push(hline(px, subYs[i], subEnd, subYs[i], i < 3 ? 2.2 : 1.2));
  }

  const peX = poleXs[nPoles - 1] + 16;
  parts.push(`<circle cx="${peX}" cy="${mainYs[4]}" r="2.2" fill="${CAD.ink}"/>`);
  parts.push(vline(peX, mainYs[4], subYs[4], 1.15));
  parts.push(hline(peX, subYs[4], subEnd, subYs[4], 1.2));
  parts.push(`<text x="${peX + 4}" y="${subYs[4] + 3}" class="t-tiny">PE</text>`);

  const xs = [];
  const showTerm = !!model.prikaziStezaljke;
  let termY = 0;

  krugovi.forEach((k, ki) => {
    const span = circuitSpan(k);
    const cx = grp.circ0 + (grp.centers ? grp.centers[ki] : (ki + 0.5) * CAD.colW);
    xs.push(cx);
    const fNum = startF + ki;
    const multi = isMultiPole(k);
    const poles = Math.min(polesFrom(k.polovi, 1), 3);

    // Spoj na fazne sabirnice
    if (multi) {
      for (let p = 0; p < poles; p++) {
        const px = cx + (p - (poles - 1) / 2) * 8;
        parts.push(`<circle cx="${px}" cy="${subYs[p]}" r="2.1" fill="#fff" stroke="${CAD.ink}" stroke-width="1.1"/>`);
        parts.push(vline(px, subYs[p], grp.branchTop, 1.1));
      }
    } else {
      const phase = subYs[ki % 3];
      parts.push(`<circle cx="${cx}" cy="${phase}" r="2.2" fill="#fff" stroke="${CAD.ink}" stroke-width="1.15"/>`);
      parts.push(vline(cx, phase, grp.branchTop, 1.15));
    }

    let y = grp.branchTop;
    const poleHalf = multi ? ((poles - 1) / 2) * 8 : 0;
    // Oznake desno od polova — ne preko L/N/PE
    const labelX = cx + poleHalf + 14;

    if (multi) {
      parts.push(`<text x="${labelX}" y="${y + 12}" class="t-label">F${fNum}</text>`);
      parts.push(symbolMcb3P(cx, y, poles));
      parts.push(`<text x="${labelX}" y="${y + 26}" class="t-tiny">${k.polovi} ${k.struja}A</text>`);
      parts.push(`<text x="${labelX}" y="${y + 38}" class="t-tiny">${k.karakteristika || "C"}</text>`);
      y += CAD.mcbH + 6;
    } else {
      parts.push(`<text x="${cx}" y="${y - 6}" text-anchor="middle" class="t-label">F${fNum}</text>`);
      parts.push(symbolMcbIec(cx, y));
      y += CAD.mcbH;
      parts.push(`<text x="${cx + 12}" y="${y - 6}" class="t-tiny">${k.struja}A, ${k.karakteristika || "B"}</text>`);
      y += 8;
    }

    // Opcionalne stezaljke
    if (showTerm) {
      termY = y + 14;
      parts.push(vline(cx, y, termY, 1.15));
      parts.push(symbolTerminal(cx, termY));
      parts.push(`<text x="${cx + 8}" y="${termY + 3}" class="t-tiny">${fNum}</text>`);
      if (ki === 0) {
        parts.push(
          `<text x="${grp.circ0 - 8}" y="${termY + 3}" text-anchor="end" class="t-label">${escapeXml(fid.stezaljka || model.stezaljka || "X" + (index + 1))}</text>`
        );
      }
      y = termY + 10;
    } else if (multi) {
      y += 4;
    }

    // N i PE izvan 3P polova i desnih oznaka
    const nPeTop = y;
    const nX = cx - (multi ? poleHalf + 14 : 8);
    const peX2 = multi ? labelX + 36 : cx + 8;
    parts.push(`<circle cx="${nX}" cy="${subYs[3]}" r="1.8" fill="${CAD.ink}"/>`);
    parts.push(vline(nX, subYs[3], nPeTop, 1));
    parts.push(`<circle cx="${peX2}" cy="${subYs[4]}" r="1.8" fill="${CAD.ink}"/>`);
    parts.push(vline(peX2, subYs[4], nPeTop, 1));

    parts.push(vline(cx, y, nPeTop + CAD.nPeH, 1.2));
    // za 3P: tri faze se spoje u snop, pa N/PE uz njih
    if (multi) {
      for (let p = 0; p < poles; p++) {
        const px = cx + (p - (poles - 1) / 2) * 8;
        parts.push(vline(px, y, nPeTop + 8, 1.05));
      }
      parts.push(hline(cx - poleHalf, nPeTop + 8, cx + poleHalf, nPeTop + 8, 1.05));
      parts.push(vline(cx, nPeTop + 8, nPeTop + CAD.nPeH, 1.2));
    }
    parts.push(vline(nX, nPeTop, nPeTop + CAD.nPeH, 1));
    parts.push(vline(peX2, nPeTop, nPeTop + CAD.nPeH, 1));
    parts.push(`<text x="${nX - 4}" y="${nPeTop + 16}" text-anchor="end" class="t-tiny">N</text>`);
    parts.push(`<text x="${peX2 + 4}" y="${nPeTop + 16}" class="t-tiny">PE</text>`);

    const bundleY = nPeTop + CAD.nPeH;
    parts.push(hline(nX, bundleY, peX2, bundleY, 1));
    y = bundleY + 4;

    const kabel = k.kabel || defaultKabel(k);
    const mid = y + CAD.cableH / 2;
    parts.push(vline(cx, y, y + CAD.cableH, 1.15));
    parts.push(
      `<text x="${cx - 5}" y="${mid}" text-anchor="middle" class="t-cable" transform="rotate(-90 ${cx - 5} ${mid})">${escapeXml(kabel)}</text>`
    );
    parts.push(symbolLoadCad(cx, y + CAD.cableH));
  });

  if (showTerm && xs.length) {
    parts.push(hline(xs[0] - 10, termY, xs[xs.length - 1] + 10, termY, 1));
  }
  parts.push(...drawTable(krugovi, xs, grp.tableTop, startF, CAD.colW));
  return parts;
}

function drawTable(krugovi, xs, tableTop, startF, colW) {
  const parts = [];
  if (!xs.length) return parts;

  const half = (i) => {
    if (xs.length === 1) return colW / 2;
    if (i === 0) return (xs[1] - xs[0]) / 2;
    if (i === xs.length - 1) return (xs[i] - xs[i - 1]) / 2;
    return Math.min(xs[i] - xs[i - 1], xs[i + 1] - xs[i]) / 2;
  };

  const left = xs[0] - half(0);
  const right = xs[xs.length - 1] + half(xs.length - 1);
  const r1 = tableTop;
  const r2 = r1 + CAD.tableBrojH;
  const r3 = r2 + CAD.tableNazivH;
  const r4 = r3 + CAD.tableLokH;

  parts.push(`<rect x="${left}" y="${r1}" width="${right - left}" height="${r4 - r1}" fill="none" stroke="${CAD.ink}" stroke-width="1.1"/>`);
  parts.push(hline(left, r2, right, r2, 1));
  parts.push(hline(left, r3, right, r3, 1));

  krugovi.forEach((k, i) => {
    const x0 = xs[i] - half(i);
    if (i > 0) parts.push(vline(x0, r1, r3, 1));
    const cy = (r1 + r2) / 2;
    parts.push(`<circle cx="${xs[i]}" cy="${cy}" r="8" fill="none" stroke="${CAD.ink}" stroke-width="1.1"/>`);
    parts.push(`<text x="${xs[i]}" y="${cy + 3}" text-anchor="middle" class="t-tiny">${startF + i}</text>`);
    const tx = xs[i];
    const ty = (r2 + r3) / 2;
    parts.push(`<text x="${tx}" y="${ty}" text-anchor="middle" class="t-table" transform="rotate(-90 ${tx} ${ty})">${escapeXml(truncate(k.naziv || "", 18))}</text>`);
  });

  groupRooms(krugovi).forEach((g) => {
    const x0 = xs[g.from] - half(g.from);
    const x1 = xs[g.to] + half(g.to);
    parts.push(vline(x0, r3, r4, 1));
    parts.push(vline(x1, r3, r4, 1));
    if (g.label) {
      parts.push(`<text x="${(x0 + x1) / 2}" y="${(r3 + r4) / 2 + 3}" text-anchor="middle" class="t-room">${escapeXml(g.label)}</text>`);
    }
  });
  return parts;
}

function groupRooms(krugovi) {
  const groups = [];
  let i = 0;
  while (i < krugovi.length) {
    const label = (krugovi[i].prostorija || "").trim();
    let j = i;
    while (j + 1 < krugovi.length && (krugovi[j + 1].prostorija || "").trim() === label) j++;
    groups.push({ from: i, to: j, label });
    i = j + 1;
  }
  return groups;
}

function symbolMainVertical(x, yTop, poles, gap, boxH) {
  const h = boxH || poles * gap + 28;
  let s = `<g transform="translate(${x},${yTop})">`;
  s += `<rect x="-20" y="0" width="40" height="${h}" fill="#fff" stroke="${CAD.ink}" stroke-width="1.25"/>`;
  for (let i = 0; i < poles; i++) {
    const yy = 10 + i * gap;
    s += `<line x1="0" y1="${yy - 4}" x2="0" y2="${yy}" stroke="${CAD.ink}" stroke-width="1.2"/>`;
    s += `<circle cx="0" cy="${yy}" r="2" fill="none" stroke="${CAD.ink}" stroke-width="1.2"/>`;
    s += `<line x1="0" y1="${yy}" x2="10" y2="${yy + 8}" stroke="${CAD.ink}" stroke-width="1.45"/>`;
    s += `<circle cx="0" cy="${yy + 10}" r="2" fill="${CAD.ink}"/>`;
    s += `<line x1="0" y1="${yy + 10}" x2="0" y2="${yy + gap - 4}" stroke="${CAD.ink}" stroke-width="1.15"/>`;
  }
  s += `<line x1="8" y1="10" x2="8" y2="${10 + (poles - 1) * gap + 10}" stroke="${CAD.ink}" stroke-width="0.85" stroke-dasharray="2 1.5"/>`;
  s += `<line x1="0" y1="${h - 8}" x2="0" y2="${h}" stroke="${CAD.ink}" stroke-width="1.3"/>`;
  s += `</g>`;
  return s;
}

function symbolFidLikeCad(poleXs, contactY, coilCy) {
  const left = poleXs[0];
  const right = poleXs[poleXs.length - 1];
  const midX = (left + right) / 2;
  let s = `<g>`;
  poleXs.forEach((px) => {
    s += `<circle cx="${px}" cy="${contactY}" r="1.8" fill="${CAD.ink}"/>`;
    s += `<line x1="${px}" y1="${contactY}" x2="${px + 8}" y2="${contactY + 9}" stroke="${CAD.ink}" stroke-width="1.4"/>`;
    s += `<circle cx="${px}" cy="${contactY + 11}" r="1.7" fill="none" stroke="${CAD.ink}" stroke-width="1.15"/>`;
    s += `<line x1="${px}" y1="${contactY + 11}" x2="${px}" y2="${coilCy - 8}" stroke="${CAD.ink}" stroke-width="1.2"/>`;
  });
  s += `<line x1="${left}" y1="${contactY + 5}" x2="${right}" y2="${contactY + 5}" stroke="${CAD.ink}" stroke-width="0.85" stroke-dasharray="2 1.5"/>`;
  const rx = (right - left) / 2 + 10;
  s += `<ellipse cx="${midX}" cy="${coilCy}" rx="${rx}" ry="9" fill="none" stroke="${CAD.ink}" stroke-width="1.25"/>`;
  poleXs.forEach((px) => {
    s += `<line x1="${px}" y1="${coilCy - 8}" x2="${px}" y2="${coilCy + 14}" stroke="${CAD.ink}" stroke-width="1.2"/>`;
  });
  const boxX = right + 14;
  const boxY = contactY + 2;
  s += `<line x1="${right + 2}" y1="${contactY + 5}" x2="${boxX}" y2="${boxY + 6}" stroke="${CAD.ink}" stroke-width="0.9" stroke-dasharray="2 1.5"/>`;
  s += `<rect x="${boxX}" y="${boxY}" width="16" height="12" fill="#fff" stroke="${CAD.ink}" stroke-width="1.15"/>`;
  s += `<line x1="${boxX + 2}" y1="${boxY + 10}" x2="${boxX + 14}" y2="${boxY + 2}" stroke="${CAD.ink}" stroke-width="1.1"/>`;
  s += `</g>`;
  return s;
}

function symbolMcbIec(x, y) {
  const h = CAD.mcbH;
  return `
    <g transform="translate(${x},${y})">
      <line x1="0" y1="0" x2="0" y2="5" stroke="${CAD.ink}" stroke-width="1.2"/>
      <circle cx="0" cy="7" r="2.1" fill="#fff" stroke="${CAD.ink}" stroke-width="1.15"/>
      <line x1="0" y1="7" x2="11" y2="19" stroke="${CAD.ink}" stroke-width="1.4"/>
      <circle cx="0" cy="21" r="2" fill="none" stroke="${CAD.ink}" stroke-width="1.15"/>
      <path d="M 0 23 Q -7 27 -3 33" fill="none" stroke="${CAD.ink}" stroke-width="1.2"/>
      <line x1="0" y1="23" x2="0" y2="${h}" stroke="${CAD.ink}" stroke-width="1.2"/>
    </g>`;
}

/** Trofazni / višepolni MCB — 3 okomita kontakta povezana isprekidanom crtom */
function symbolMcb3P(x, y, poles) {
  const n = poles || 3;
  const gap = 8;
  const h = CAD.mcbH;
  let s = `<g transform="translate(${x},${y})">`;
  for (let i = 0; i < n; i++) {
    const px = (i - (n - 1) / 2) * gap;
    s += `<line x1="${px}" y1="0" x2="${px}" y2="5" stroke="${CAD.ink}" stroke-width="1.15"/>`;
    s += `<circle cx="${px}" cy="7" r="1.9" fill="#fff" stroke="${CAD.ink}" stroke-width="1.1"/>`;
    s += `<line x1="${px}" y1="7" x2="${px + 7}" y2="17" stroke="${CAD.ink}" stroke-width="1.3"/>`;
    s += `<circle cx="${px}" cy="19" r="1.7" fill="none" stroke="${CAD.ink}" stroke-width="1.1"/>`;
    s += `<path d="M ${px} 21 Q ${px - 5} 25 ${px - 2} 30" fill="none" stroke="${CAD.ink}" stroke-width="1.1"/>`;
    s += `<line x1="${px}" y1="21" x2="${px}" y2="${h}" stroke="${CAD.ink}" stroke-width="1.15"/>`;
  }
  const left = (-(n - 1) / 2) * gap;
  const right = ((n - 1) / 2) * gap;
  s += `<line x1="${left}" y1="12" x2="${right}" y2="12" stroke="${CAD.ink}" stroke-width="0.85" stroke-dasharray="2 1.5"/>`;
  s += `</g>`;
  return s;
}

function symbolTerminal(x, y) {
  return `<g transform="translate(${x},${y})">
    <circle cx="0" cy="0" r="3.2" fill="#fff" stroke="${CAD.ink}" stroke-width="1.1"/>
    <line x1="-4" y1="-4" x2="4" y2="4" stroke="${CAD.ink}" stroke-width="1.15"/>
  </g>`;
}

function symbolLoadCad(x, y) {
  return `<g transform="translate(${x},${y})">
    <line x1="0" y1="0" x2="0" y2="2" stroke="${CAD.ink}" stroke-width="1.1"/>
    <path d="M -7 2 A 7 7 0 0 0 7 2" fill="none" stroke="${CAD.ink}" stroke-width="1.2"/>
  </g>`;
}

function hline(x1, y, x2, _y2, sw) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${CAD.ink}" stroke-width="${sw || 1}"/>`;
}
function vline(x, y1, y2, sw) {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${CAD.ink}" stroke-width="${sw || 1}"/>`;
}
function formatDolazShort(d) {
  if (!d) return "5 x 10mm2";
  const tip = BAZA_KOMPONENTI.dolaz.tipovi.find((t) => t.id === d.tip);
  return `${tip?.zila || 5} x ${d.presjek}mm2`;
}
function formatDiff(mA) {
  return (Number(mA) / 1000).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function polesFrom(p, fb) {
  if (!p) return fb;
  if (p === "4P" || p === "3P+N") return 4;
  if (p === "3P") return 3;
  if (p === "2P" || p === "1P+N") return 2;
  return p === "1P" ? 1 : fb;
}
function defaultKabel(k) {
  const tip = k.kabelTip || "PP00-Y";
  const zile = /3P|4P/.test(k.polovi || "") ? 5 : 3;
  const mm = k.kabelMm || defaultKabelMm(k.struja);
  return `${tip} ${zile} x ${mm}mm2`;
}
function truncate(s, n) {
  return !s ? "" : s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
