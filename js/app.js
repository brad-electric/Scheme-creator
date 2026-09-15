/**
 * Glavna logika aplikacije — Jednopolna shema
 */

let model = defaultModel();

document.addEventListener("DOMContentLoaded", () => {
  bindTabs();
  bindToolbar();
  fillSelects();
  renderForm();
  redraw();
});

function bindTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });
}

function bindToolbar() {
  document.getElementById("btn-primijeni-opis").addEventListener("click", () => {
    const tekst = document.getElementById("opis-tekst").value;
    model = parseOpis(tekst);
    renderForm();
    redraw();
    // ostani na Opisu — shema se vidi desno
  });

  document.getElementById("btn-primjer").addEventListener("click", () => {
    document.getElementById("opis-tekst").value = PRIMJER_OPISA;
    model = parseOpis(PRIMJER_OPISA);
    renderForm();
    redraw();
  });

  document.getElementById("btn-nova").addEventListener("click", () => {
    model = defaultModel();
    model.fidovi = [];
    renderForm();
    redraw();
  });

  document.getElementById("btn-print").addEventListener("click", () => window.print());

  document.getElementById("btn-svg").addEventListener("click", exportSvg);

  document.getElementById("btn-png").addEventListener("click", exportPng);

  document.getElementById("btn-pdf").addEventListener("click", () => {
    exportPdf().catch((err) => {
      console.error(err);
      if (confirm("PDF export nije uspio. Otvoriti ispis (pa Spremi kao PDF)?")) {
        window.print();
      }
    });
  });

  document.getElementById("btn-dodaj-fid").addEventListener("click", () => {
    const n = model.fidovi.length + 1;
    model.fidovi.push({
      id: uid(),
      oznaka: `FID${n}`,
      tip: "rcd",
      polovi: model.dolaz.tip.startsWith("3") ? "4P" : "2P",
      struja: "40",
      diferencijalna: "30",
      tipFid: "A",
      krugovi: [],
    });
    renderForm();
    redraw();
  });
}

function switchTab(id) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === id);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === id);
  });
}

function fillSelects() {
  // se popunjava u renderForm
}

function renderForm() {
  document.getElementById("investitor").value = model.investitor || "";
  document.getElementById("lokacija").value = model.lokacija || "";
  document.getElementById("start-broj").value = model.startBroj || 1;
  document.getElementById("stezaljka").value = model.stezaljka || "X2";
  document.getElementById("prikazi-stezaljke").checked = !!model.prikaziStezaljke;
  document.getElementById("naslovna").checked = model.naslovna !== false;

  const dolazTip = document.getElementById("dolaz-tip");
  dolazTip.innerHTML = BAZA_KOMPONENTI.dolaz.tipovi
    .map((t) => `<option value="${t.id}" ${t.id === model.dolaz.tip ? "selected" : ""}>${t.label}</option>`)
    .join("");

  const dolazPresjek = document.getElementById("dolaz-presjek");
  dolazPresjek.innerHTML = BAZA_KOMPONENTI.dolaz.presjeci
    .map((p) => `<option value="${p}" ${p === model.dolaz.presjek ? "selected" : ""}>${p} mm²</option>`)
    .join("");

  document.getElementById("brojilo").checked = !!model.brojilo;
  document.getElementById("spd").checked = !!model.spd?.enabled;
  document.getElementById("glavni-enabled").checked = model.glavni?.enabled === true;

  const spdTip = document.getElementById("spd-tip");
  spdTip.innerHTML = BAZA_KOMPONENTI.spd.tipovi
    .map((t) => `<option value="${t.id}" ${t.id === model.spd?.tip ? "selected" : ""}>${t.label}</option>`)
    .join("");
  spdTip.disabled = !model.spd?.enabled;

  const gTip = document.getElementById("glavni-tip");
  gTip.innerHTML = BAZA_KOMPONENTI.glavni.tipovi
    .map((t) => `<option value="${t.id}" ${t.id === model.glavni.tip ? "selected" : ""}>${t.label}</option>`)
    .join("");

  const gPolovi = document.getElementById("glavni-polovi");
  gPolovi.innerHTML = BAZA_KOMPONENTI.glavni.polovi
    .map((t) => `<option value="${t.id}" ${t.id === model.glavni.polovi ? "selected" : ""}>${t.label}</option>`)
    .join("");

  const gStruja = document.getElementById("glavni-struja");
  gStruja.innerHTML = BAZA_KOMPONENTI.glavni.struje
    .map((t) => `<option value="${t}" ${t === model.glavni.struja ? "selected" : ""}>${t} A</option>`)
    .join("");

  const gKar = document.getElementById("glavni-kar");
  gKar.innerHTML = BAZA_KOMPONENTI.glavni.karakteristike
    .map((t) => `<option value="${t}" ${t === model.glavni.karakteristika ? "selected" : ""}>${t}</option>`)
    .join("");

  [
    ["investitor", (v) => {
      model.investitor = v;
      model.naziv = v.trim() ? `Jednopolna shema — ${v.trim()}` : "Jednopolna shema";
    }],
    ["lokacija", (v) => (model.lokacija = v)],
    ["start-broj", (v) => (model.startBroj = parseInt(v, 10) || 1)],
    ["stezaljka", (v) => (model.stezaljka = v)],
    ["dolaz-tip", (v) => (model.dolaz.tip = v)],
    ["dolaz-presjek", (v) => (model.dolaz.presjek = v)],
    ["glavni-tip", (v) => (model.glavni.tip = v)],
    ["glavni-polovi", (v) => (model.glavni.polovi = v)],
    ["glavni-struja", (v) => (model.glavni.struja = v)],
    ["glavni-kar", (v) => (model.glavni.karakteristika = v)],
    ["spd-tip", (v) => (model.spd.tip = v)],
  ].forEach(([id, fn]) => {
    const el = document.getElementById(id);
    el.onchange = el.oninput = () => {
      fn(el.type === "checkbox" ? el.checked : el.value);
      redraw();
    };
  });

  document.getElementById("brojilo").onchange = (e) => {
    model.brojilo = e.target.checked;
    redraw();
  };
  document.getElementById("prikazi-stezaljke").onchange = (e) => {
    model.prikaziStezaljke = e.target.checked;
    redraw();
  };
  document.getElementById("naslovna").onchange = (e) => {
    model.naslovna = e.target.checked;
    redraw();
  };
  document.getElementById("spd").onchange = (e) => {
    model.spd.enabled = e.target.checked;
    document.getElementById("spd-tip").disabled = !e.target.checked;
    redraw();
  };
  document.getElementById("glavni-enabled").onchange = (e) => {
    model.glavni.enabled = e.target.checked;
    redraw();
  };

  renderFidovi();
}

function renderFidovi() {
  const root = document.getElementById("fidovi-lista");
  root.innerHTML = "";

  model.fidovi.forEach((fid, fi) => {
    const card = document.createElement("article");
    card.className = "fid-card";
    card.innerHTML = `
      <header class="fid-head">
        <strong>${escapeHtml(fid.oznaka)}</strong>
        <button type="button" class="btn-icon" data-del-fid="${fi}" title="Ukloni FID">✕</button>
      </header>
      <div class="grid-4">
        <label>Tip
          <select data-fid="${fi}" data-field="tip">${opts(BAZA_KOMPONENTI.fid.tipovi, fid.tip)}</select>
        </label>
        <label>Polovi
          <select data-fid="${fi}" data-field="polovi">${opts(BAZA_KOMPONENTI.fid.polovi, fid.polovi)}</select>
        </label>
        <label>In
          <select data-fid="${fi}" data-field="struja">${optsVal(BAZA_KOMPONENTI.fid.struje, fid.struja, "A")}</select>
        </label>
        <label>IΔn
          <select data-fid="${fi}" data-field="diferencijalna">${optsVal(BAZA_KOMPONENTI.fid.diferencijalne, fid.diferencijalna, "mA")}</select>
        </label>
        <label>Tip FID
          <select data-fid="${fi}" data-field="tipFid">${optsVal(BAZA_KOMPONENTI.fid.tipoviFid, fid.tipFid)}</select>
        </label>
        <label>Oznaka
          <input data-fid="${fi}" data-field="oznaka" value="${escapeHtml(fid.oznaka)}" />
        </label>
      </div>
      <div class="krugovi" data-krugovi="${fi}"></div>
      <button type="button" class="btn btn-ghost btn-sm" data-add-krug="${fi}">+ Dodaj osigurač / krug</button>
    `;
    root.appendChild(card);

    const krugRoot = card.querySelector(`[data-krugovi="${fi}"]`);
    (fid.krugovi || []).forEach((k, ki) => {
      const row = document.createElement("div");
      row.className = "krug-row";
      row.innerHTML = `
        <select data-fid="${fi}" data-krug="${ki}" data-field="tip" title="Tip">${opts(BAZA_KOMPONENTI.potrosac.tipovi, k.tip)}</select>
        <input data-fid="${fi}" data-krug="${ki}" data-field="naziv" value="${escapeHtml(k.naziv)}" placeholder="Naziv" />
        <input data-fid="${fi}" data-krug="${ki}" data-field="prostorija" value="${escapeHtml(k.prostorija || "")}" placeholder="Prostorija" />
        <select data-fid="${fi}" data-krug="${ki}" data-field="polovi" title="Polovi">${opts(BAZA_KOMPONENTI.osigurac.polovi, k.polovi)}</select>
        <select data-fid="${fi}" data-krug="${ki}" data-field="karakteristika" title="Kar.">${optsVal(BAZA_KOMPONENTI.osigurac.karakteristike, k.karakteristika || "B")}</select>
        <select data-fid="${fi}" data-krug="${ki}" data-field="struja" title="In">${optsVal(BAZA_KOMPONENTI.osigurac.struje, k.struja, "A")}</select>
        <select data-fid="${fi}" data-krug="${ki}" data-field="kabelMm" title="mm²">${optsVal(BAZA_KOMPONENTI.kabel.presjeci, k.kabelMm || "2.5", "mm²")}</select>
        <button type="button" class="btn-icon" data-del-krug="${fi}:${ki}" title="Ukloni">✕</button>
      `;
      krugRoot.appendChild(row);
    });
  });

  // Events
  root.querySelectorAll("select[data-fid], input[data-fid]").forEach((el) => {
    el.addEventListener("change", onFidField);
    el.addEventListener("input", onFidField);
  });

  root.querySelectorAll("[data-del-fid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      model.fidovi.splice(+btn.dataset.delFid, 1);
      renumberFid();
      renderForm();
      redraw();
    });
  });

  root.querySelectorAll("[data-add-krug]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fi = +btn.dataset.addKrug;
      const def = defaultZaPotrosac("uticnica");
      model.fidovi[fi].krugovi.push({
        id: uid(),
        tip: "uticnica",
        naziv: def.label,
        struja: def.defaultStruja,
        polovi: def.defaultPolovi,
        karakteristika: "B",
        tipOsiguraca: "mcb",
        prostorija: "",
        kabelMm: defaultKabelMm(def.defaultStruja),
        kabelTip: "PP00-Y",
      });
      renderForm();
      redraw();
    });
  });

  root.querySelectorAll("[data-del-krug]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [fi, ki] = btn.dataset.delKrug.split(":").map(Number);
      model.fidovi[fi].krugovi.splice(ki, 1);
      renderForm();
      redraw();
    });
  });
}

function onFidField(e) {
  const el = e.target;
  const fi = +el.dataset.fid;
  const field = el.dataset.field;
  if (el.dataset.krug !== undefined) {
    const ki = +el.dataset.krug;
    const krug = model.fidovi[fi].krugovi[ki];
    krug[field] = el.value;
    if (field === "tip") {
      const def = defaultZaPotrosac(el.value);
      krug.naziv = def.label;
      krug.struja = def.defaultStruja;
      krug.polovi = def.defaultPolovi;
      krug.kabelMm = def.defaultMm || "2.5";
      renderForm();
    }
  } else {
    model.fidovi[fi][field] = el.value;
  }
  redraw();
}

function renumberFid() {
  model.fidovi.forEach((f, i) => {
    if (/^FID\d+$/i.test(f.oznaka)) f.oznaka = `FID${i + 1}`;
  });
}

function opts(list, selected) {
  return list
    .map((t) => `<option value="${t.id}" ${t.id === selected ? "selected" : ""}>${t.label}</option>`)
    .join("");
}

function optsVal(list, selected, suffix) {
  return list
    .map((t) => {
      const v = typeof t === "string" ? t : t;
      const lab = suffix ? `${v} ${suffix}` : v;
      return `<option value="${v}" ${v === selected ? "selected" : ""}>${lab}</option>`;
    })
    .join("");
}

function redraw() {
  const container = document.getElementById("shema-pages");
  const nPages = renderShema(model, container);
  updateStats(nPages);
}

function updateStats(nPages) {
  const nFid = model.fidovi.length;
  const nDir = (model.direktni || []).length;
  const nKrug =
    nDir + model.fidovi.reduce((a, f) => a + (f.krugovi?.length || 0), 0);
  const pages = nPages || document.querySelectorAll(".shema-page").length || 1;
  const gPart =
    model.glavni?.enabled === true
      ? ` · glavni ${model.glavni.polovi} ${model.glavni.struja}A`
      : " · bez glavnog";
  document.getElementById("stats").textContent =
    `${model.naslovna !== false ? "naslovna · " : ""}${nDir ? nDir + " direktno · " : ""}${nFid} FID · ${nKrug} krugova · ${pages} A4 list${pages === 1 ? "" : "a"}${gPart}`;
}

function exportSvg() {
  const pages = document.querySelectorAll(".shema-page");
  if (!pages.length) return;
  pages.forEach((svg, i) => {
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    downloadBlob(blob, `${safeName(model.naziv)}_list${i + 1}.svg`);
  });
}

function exportPng() {
  const pages = document.querySelectorAll(".shema-page");
  if (!pages.length) return;
  pages.forEach(async (svg, i) => {
    const blob = await svgToPngBlob(svg);
    downloadBlob(blob, `${safeName(model.naziv)}_list${i + 1}.png`);
  });
}

async function exportPdf() {
  const pages = [...document.querySelectorAll(".shema-page")];
  if (!pages.length) {
    alert("Nema sheme za spremanje. Prvo nacrtaj shemu.");
    return;
  }
  const jsPdfNs = window.jspdf;
  if (!jsPdfNs || !jsPdfNs.jsPDF) {
    throw new Error("jsPDF nije učitan");
  }
  const { jsPDF } = jsPdfNs;
  // A4 landscape u mm
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWmm = 297;
  const pageHmm = 210;

  for (let i = 0; i < pages.length; i++) {
    const dataUrl = await svgToPngDataUrl(pages[i], 2);
    if (i > 0) pdf.addPage();
    pdf.addImage(dataUrl, "PNG", 0, 0, pageWmm, pageHmm);
  }

  const base = safeName(model.investitor || model.naziv || "shema");
  pdf.save(`${base}.pdf`);
}

function svgToPngBlob(svg, scale = 2) {
  return svgToPngDataUrl(svg, scale).then(
    (dataUrl) =>
      new Promise((resolve) => {
        fetch(dataUrl)
          .then((r) => r.blob())
          .then(resolve);
      })
  );
}

function svgToPngDataUrl(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = svg.viewBox.baseVal.width || CAD.pageW;
        const h = svg.viewBox.baseVal.height || CAD.pageH;
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG → PNG nije uspio"));
    };
    img.src = url;
  });
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function safeName(s) {
  return (s || "shema").replace(/[^\w\-čćžšđČĆŽŠĐ]+/gi, "_").slice(0, 40);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

const PRIMJER_OPISA = `Investitor: Ana Cus
Lokacija: Resetari 50 Kastav
Trofazni dolaz 5x10 mm² na glavni prekidač 4P 63A
odvodnik prenapona tip 2

Direktno: štednjak 32A 3P Kuhinja

FID1 4P 40A 30mA: pećnica 16A Kuhinja, svjetlo 10A Kuhinja, utičnice 16A Kuhinja
FID2 4P 40A 30mA: bojler 16A Kupaonica, utičnice 16A Kupaonica, rasvjeta 10A Kupaonica, rezerva 16A Hodnik`;
