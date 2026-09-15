/**
 * Brzi testovi parsera, layouta i A4 paginacije (node test/run.js)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = {
  console,
  Math,
  Number,
  String,
  parseInt,
  parseFloat,
  Array,
  Object,
  RegExp,
  JSON,
  document: {
    createElementNS(_ns, tag) {
      return {
        tagName: tag,
        classList: { add() {} },
        dataset: {},
        attrs: {},
        innerHTML: "",
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        getAttribute(k) {
          return this.attrs[k];
        },
      };
    },
  },
};
vm.createContext(ctx);

for (const f of ["js/baza-komponenti.js", "js/parser.js", "js/renderer.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}

let passed = 0;
let failed = 0;

function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log("  ✓", name);
  } else {
    failed++;
    console.log("  ✗", name, detail ? "— " + detail : "");
  }
}

console.log("\n=== Test: parser ===");
const opis = `Trofazni dolaz 5x10 mm² na glavni prekidač 4P 63A
FID1 4P 25A 30mA tip A: pećnica 16A Kuhinja, svjetlo 10A Kuhinja, utičnice 16A Dnevni`;

const model = ctx.parseOpis(opis);
assert("dolaz 5x10", model.dolaz.tip === "3f5" && model.dolaz.presjek === "10", JSON.stringify(model.dolaz));
assert("glavni 4P 63A", model.glavni.polovi === "4P" && model.glavni.struja === "63", JSON.stringify(model.glavni));
assert("1 FID", model.fidovi.length === 1, String(model.fidovi.length));
assert("FID 25A / 30mA", model.fidovi[0].struja === "25" && model.fidovi[0].diferencijalna === "30");
assert("3 kruga", model.fidovi[0].krugovi.length === 3, String(model.fidovi[0].krugovi.length));
assert("pećnica 16A", model.fidovi[0].krugovi[0].struja === "16" && /pe[cćč]nic/i.test(model.fidovi[0].krugovi[0].naziv));
assert("prostorija Kuhinja", model.fidovi[0].krugovi[0].prostorija === "Kuhinja");
assert("nema default direktnog", !(model.direktni && model.direktni.length), String(model.direktni?.length));

console.log("\n=== Test: direktni (mimo FID) ===");
const dirOpis = `Trofazni dolaz 5x10 na glavni prekidač 4P 63A
Direktno: štednjak 32A 3P Kuhinja
FID1 4P 40A 30mA: pećnica 16A Kuhinja, svjetlo 10A Kuhinja
FID2 4P 40A 30mA: bojler 16A Kupaonica, utičnice 16A Kupaonica`;
const dirModel = ctx.parseOpis(dirOpis);
assert("1 direktni", dirModel.direktni.length === 1, String(dirModel.direktni.length));
assert("direktni 3P 32A", dirModel.direktni[0].polovi === "3P" && dirModel.direktni[0].struja === "32");
assert("direktni flag", dirModel.direktni[0].direktno === true);
assert("2 FID uz direktni", dirModel.fidovi.length === 2, String(dirModel.fidovi.length));
assert("šteednjak nije u FID", !dirModel.fidovi.some((f) => f.krugovi.some((k) => /štednjak|stednjak/i.test(k.naziv))));
const dirPages = ctx.buildPages(dirModel);
assert("FID broj počinje nakon direktnog", dirPages[0].startF === 2, String(dirPages[0].startF));
assert("direktniStartF = 1", dirPages[0].direktniStartF === 1);

const dirKids = [];
const dirBox = {
  innerHTML: "",
  appendChild(el) {
    dirKids.push(el);
  },
};
ctx.renderShema(dirModel, dirBox);
assert("SVG ima direktni 3P", dirKids.some((k) => /3P C32A/.test(k.innerHTML)));
assert("nema natpisa Direktno/bez FID", !dirKids.some((k) => /Direktno \(bez FID\)|bez FID/.test(k.innerHTML)));
assert("naslovna s investitorom ili shemom", /JEDNOPOLNA SHEMA|3P C32A/.test(dirKids[0].innerHTML));

console.log("\n=== Test: default model ===");
const def = ctx.defaultModel();
assert("ima FID", def.fidovi.length >= 1);
assert("ima više krugova", def.fidovi[0].krugovi.length >= 3);

console.log("\n=== Test: A4 paginacija ===");
// 5 FID grupa — mora ići na više listova
const big = ctx.parseOpis(`Trofazni dolaz 5x10 na glavni 4P 63A
FID1 4P 40A 30mA: a 16A Kuhinja, b 16A Kuhinja, c 16A Kuhinja, d 16A Kuhinja
FID2 4P 40A 30mA: e 16A Dnevni, f 16A Dnevni, g 10A Hodnik
FID3 4P 25A 30mA: h 16A Kupaonica, i 16A Kupaonica, j 16A Spavaća
FID4 4P 40A 30mA: k 16A Garaža, l 16A Bašta, m 16A Garaža
FID5 4P 25A 30mA: n 10A Hodnik, o 16A Hodnik, p 16A Hodnik`);
assert("5 FID-ova", big.fidovi.length === 5, String(big.fidovi.length));
const pages = ctx.buildPages(big);
assert("više od 1 A4 lista", pages.length >= 2, String(pages.length));
assert("prvi list ima glavni", pages[0].isFirst === true);
assert("drugi list nastavak", pages[1].isFirst === false);
assert("svi FID-ovi raspoređeni", pages.reduce((a, p) => a + p.fidovi.length, 0) === 5);

console.log("\n=== Test: SVG render u container ===");
const kids = [];
const fakeContainer = {
  innerHTML: "",
  appendChild(el) {
    kids.push(el);
  },
};
const n = ctx.renderShema(big, fakeContainer);
assert("vraća broj listova", n >= 3, String(n)); // naslovna + shema
assert("SVG stranice kreirane", kids.length === n, String(kids.length));
assert("viewBox A4", kids[0].attrs.viewBox === "0 0 1123 794", kids[0].attrs.viewBox);
assert("naslovna stranica", /JEDNOPOLNA SHEMA/.test(kids[0].innerHTML));
assert("ima Fid / Q na shemi", /Fid|Q2|FID/i.test(kids[1].innerHTML));
assert("ima nastavak na nastavku", kids.some((k) => /Nastavak sabirnice/.test(k.innerHTML)));

// bez naslovne
big.naslovna = false;
const kids2 = [];
ctx.renderShema(big, {
  innerHTML: "",
  appendChild(el) {
    kids2.push(el);
  },
});
assert("bez naslovne manje listova", kids2.length === n - 1, String(kids2.length));
assert("prvi je shema", /Fid|Q2|FID/i.test(kids2[0].innerHTML));

fs.writeFileSync(
  path.join(root, "test", "preview.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${kids[0].attrs.viewBox}" width="${kids[0].attrs.width}" height="${kids[0].attrs.height}">${kids[0].innerHTML}</svg>`
);
if (kids[1]) {
  fs.writeFileSync(
    path.join(root, "test", "preview-list2.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${kids[1].attrs.viewBox}" width="${kids[1].attrs.width}" height="${kids[1].attrs.height}">${kids[1].innerHTML}</svg>`
  );
}

console.log(`\n=== Rezultat: ${passed} OK, ${failed} FAIL ===\n`);
process.exit(failed ? 1 : 0);
