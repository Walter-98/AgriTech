"use strict";
// Prove del gemello nel browser vero (Chromium con Playwright), senza rete: la pagina deve funzionare offline.
// I test numerici (test/js) caricano i moduli uno per uno e non vedono i problemi della pagina intera (nomi doppi
// tra script, errori dell'interfaccia, file mancanti): questi sì. Uso: node --test test/browser/
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path"), os = require("os");
const {chromium} = require("playwright");

const DIR = path.join(__dirname, "..", "..", "gemello");
const URL = "file://" + path.join(DIR, "index.html");
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { if (browser) await browser.close(); });

// pagina nuova, senza rete (ogni richiesta che non è un file locale viene bloccata e segnata), errori raccolti
async function apri(opz = {}) {
  const context = await browser.newContext({acceptDownloads: true});
  const errori = [], rete = [];
  await context.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file:") || u.startsWith("data:") || u.startsWith("blob:")) return r.continue();
    // i caratteri di Google Fonts sono solo estetica: offline la pagina usa quelli del sistema
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) return r.fulfill({status: 200, contentType: "text/css", body: ""});
    rete.push(u); return r.abort();
  });
  if (opz.prima) await context.addInitScript(opz.prima);
  const page = await context.newPage();
  page.on("pageerror", e => errori.push("errore: " + e.message));
  page.on("console", m => { if (m.type() === "error") errori.push("console: " + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelectorAll("#schede button").length > 5, null, {timeout: 20000});
  return {page, context, errori, rete};
}
const scheda = async (page, k) => { await page.click('#schede button[data-s="' + k + '"]'); await page.waitForTimeout(150); };
const modo = async (page, m) => { await page.click('.modo button[data-m="' + m + '"]'); await page.waitForTimeout(300); };
const livello = async (page, l) => { await page.click('.livello button[data-l="' + l + '"]'); await page.waitForTimeout(150); };

test("si apre senza errori, carica tutti i moduli e la 3D, senza chiedere niente alla rete", async () => {
  const {page, context, errori, rete} = await apri();
  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(DIR, src)), "file mancante: " + src);
  const tipi = await page.evaluate(() => ({ESEMPIO: typeof ESEMPIO, migra: typeof migra, simula: typeof simula, Controllore: typeof Controllore,
    MondoOrto: typeof MondoOrto, simulaIdro: typeof simulaIdro, simulaClimaIdro: typeof simulaClimaIdro, ricetta: typeof ricetta,
    progetta: typeof progetta, congelaPrevisione: typeof congelaPrevisione, versioneConfig: typeof versioneConfig, lineChart: typeof lineChart,
    Vista3D: typeof Vista3D, THREE: typeof THREE, OrbitControls: typeof THREE !== "undefined" && typeof THREE.OrbitControls}));
  for (const [k, v] of Object.entries(tipi)) assert.notStrictEqual(v, "undefined", k + " non caricato");
  assert.strictEqual(tipi.OrbitControls, "function");
  assert.ok(await page.evaluate(() => Vista3D !== null), "la vista 3D non si è avviata");
  assert.ok(await page.locator("#scena canvas").count() >= 1, "manca il canvas della 3D");
  assert.deepStrictEqual(errori, []);
  assert.deepStrictEqual(rete, [], "la pagina ha chiesto file alla rete");
  await context.close();
});

test("tutte le schede si aprono senza errori, nei due impianti e nei due livelli", async () => {
  const {page, context, errori} = await apri();
  for (const m of ["orto", "idro"]) for (const l of ["esperto", "principiante"]) {
    await modo(page, m); await livello(page, l);
    const visibili = await page.$$eval("#schede button", bs => bs.filter(b => !b.hidden).map(b => b.dataset.s));
    for (const k of visibili) {
      await scheda(page, k);
      const testo = await page.$eval("#contenuto", e => e.innerText.length).catch(() => page.evaluate(() => document.body.innerText.length));
      assert.ok(testo > 50, m + "/" + l + ": la scheda " + k + " è vuota");
    }
  }
  assert.deepStrictEqual(errori, []);
  await context.close();
});

test("simulazioni nella pagina: riproducibili e con i grafici", async () => {
  const {page, context, errori} = await apri();
  await modo(page, "orto"); await livello(page, "esperto"); await scheda(page, "simulazione");
  assert.ok(await page.locator("svg").count() > 2, "mancano i grafici dell'orto");
  const due = await page.evaluate(() => { const a = simula(JSON.parse(JSON.stringify(ESEMPIO))), b = simula(JSON.parse(JSON.stringify(ESEMPIO)));
    return [a.litri, b.litri, a.stress, b.stress, a.kwh, b.kwh]; });
  assert.strictEqual(due[0], due[1]); assert.strictEqual(due[2], due[3]); assert.strictEqual(due[4], due[5]);
  assert.ok(due[0] > 500, "l'orto di esempio deve consumare acqua");
  await modo(page, "idro"); await scheda(page, "simulazione");
  assert.ok(await page.locator("svg").count() > 2, "mancano i grafici dell'idroponica");
  const idro = await page.evaluate(() => { const c = Object.assign(JSON.parse(JSON.stringify(ESEMPIO)), {idro: JSON.parse(JSON.stringify(IDRO_ESEMPIO))});
    return [simulaIdro(c).kg, simulaIdro(c).kg]; });
  assert.strictEqual(idro[0], idro[1]);
  assert.deepStrictEqual(errori, []);
  await context.close();
});

test("percorso guidato: crea un progetto e lo apre nel gemello", async () => {
  const {page, context, errori} = await apri();
  await scheda(page, "inizia");
  await page.click("text=Calcola le proposte");
  await page.waitForSelector("text=Apri nel gemello", {timeout: 90000});
  const prima = await page.evaluate(() => versioneConfig(cfg));
  await page.locator("text=Apri nel gemello").first().click();
  await page.waitForTimeout(800);
  assert.notStrictEqual(await page.evaluate(() => versioneConfig(cfg)), prima, "la proposta non è stata applicata");
  assert.deepStrictEqual(errori, []);
  await context.close();
});

test("salvataggio: la configurazione resta dopo aver ricaricato la pagina", async () => {
  const {page, context, errori} = await apri();
  await modo(page, "idro");
  const v = await page.evaluate(() => versioneConfig(cfg));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("#schede button").length > 5);
  assert.strictEqual(await page.evaluate(() => cfg.modalita), "idro");
  assert.strictEqual(await page.evaluate(() => versioneConfig(cfg)), v);
  assert.deepStrictEqual(errori, []);
  await context.close();
});

test("progetto in JSON: si salva, si riapre in una pagina pulita e dà gli stessi risultati", async () => {
  const a = await apri();
  await modo(a.page, "idro"); await livello(a.page, "esperto"); await scheda(a.page, "documenti");
  const [dl] = await Promise.all([a.page.waitForEvent("download"), a.page.click("text=Salva il progetto (JSON)")]);
  const file = path.join(os.tmpdir(), "agritech-prova-" + process.pid + ".json");
  await dl.saveAs(file);
  const salvato = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.strictEqual(salvato.formato, "agritech-progetto");
  const vPrima = await a.page.evaluate(() => versioneConfig(cfg)), kgPrima = await a.page.evaluate(() => S.kg);
  await a.context.close();
  const b = await apri();                                  // contesto nuovo: niente memoria del browser
  assert.notStrictEqual(await b.page.evaluate(() => cfg.modalita), "idro");
  await livello(b.page, "esperto"); await scheda(b.page, "documenti");
  await b.page.setInputFiles('input[type="file"][accept*="json"]', file);
  await b.page.waitForSelector("text=Progetto caricato", {timeout: 20000});
  assert.strictEqual(await b.page.evaluate(() => versioneConfig(cfg)), vPrima);
  assert.strictEqual(await b.page.evaluate(() => S.kg), kgPrima, "stesso progetto, stessi risultati");
  assert.deepStrictEqual(a.errori.concat(b.errori), []);
  fs.unlinkSync(file);
  await b.context.close();
});

test("esportazioni: CSV, Excel, pianta SVG e relazione completa", async () => {
  const {page, context, errori} = await apri();
  await modo(page, "idro"); await livello(page, "esperto"); await scheda(page, "documenti");
  const scarica = async testo => { const [dl] = await Promise.all([page.waitForEvent("download", {timeout: 30000}), page.click("text=" + testo)]);
    const f = path.join(os.tmpdir(), "agritech-" + process.pid + "-" + dl.suggestedFilename()); await dl.saveAs(f); const b = fs.readFileSync(f); fs.unlinkSync(f); return {nome: dl.suggestedFilename(), b}; };
  const csv = await scarica("Lista materiali (CSV)");
  assert.match(csv.nome, /\.csv$/); assert.ok(csv.b.toString("utf8").split("\n").length > 5, "CSV quasi vuoto");
  const x = await scarica("Scarica Excel (.xlsx)");
  assert.match(x.nome, /\.xlsx$/); assert.strictEqual(x.b.slice(0, 2).toString(), "PK", "l'Excel non è un file .xlsx");
  assert.ok(await page.locator(".doc-sezione").count() >= 10, "la relazione ha poche sezioni");
  await scheda(page, "struttura");
  const s = await scarica("Scarica la pianta (SVG)");
  assert.match(s.b.toString("utf8"), /<svg/);
  assert.deepStrictEqual(errori, []);
  await context.close();
});

test("compatibilità: progetto JSON dello schema 1 e salvataggio vecchio nel browser", async () => {
  const a = await apri();
  await livello(a.page, "esperto"); await scheda(a.page, "documenti");
  await a.page.setInputFiles('input[type="file"][accept*="json"]', path.join(__dirname, "progetto_schema1.json"));
  await a.page.waitForSelector("text=Progetto caricato", {timeout: 20000});
  const c = await a.page.evaluate(() => ({v: cfg.versione_schema, mort: cfg.idro.produzione.mortalita, sistema: cfg.idro.sistema, kg: S.kg}));
  assert.strictEqual(c.v, 2); assert.strictEqual(c.mort, 5); assert.strictEqual(c.sistema, "nft"); assert.ok(c.kg > 0);
  await a.context.close();
  // salvataggio di prima di AgriTech 2.0 nella memoria del browser: senza numero di schema e senza i campi nuovi
  const vecchio = {modalita: "idro", regione: "centro", idro: {sistema: "dwc", colture: [{coltura: "lattuga", quota: 100}]}};
  const b = await apri({prima: `try { localStorage.setItem("gemello-agritech-v2", ${JSON.stringify(JSON.stringify(vecchio))}); } catch (e) {}`});
  assert.strictEqual(await b.page.evaluate(() => cfg.idro.sistema), "dwc");
  assert.ok(await b.page.evaluate(() => S.kg > 0));
  assert.deepStrictEqual(a.errori.concat(b.errori), []);
  await b.context.close();
});

test("con la memoria del browser bloccata la pagina funziona lo stesso", async () => {
  const {page, context, errori} = await apri({prima: `Object.defineProperty(window, "localStorage", {get() { throw new Error("bloccato"); }});`});
  await scheda(page, "simulazione");
  assert.ok(await page.locator("svg").count() > 2);
  assert.deepStrictEqual(errori, []);
  await context.close();
});

test("il pacchetto da pubblicare contiene tutti i file che la pagina usa", async () => {
  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  const elenco = JSON.parse(fs.readFileSync(path.join(DIR, "pubblica.json"), "utf8"));
  const usati = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).concat(["lib/xlsx.full.min.js"]);
  for (const f of usati) assert.ok(elenco.file.includes(f), "manca nel pacchetto da pubblicare: " + f);
  for (const f of elenco.file) assert.ok(fs.existsSync(path.join(DIR, f)), "nel pacchetto ma non esiste: " + f);
});

test("calibrazione ambiente: importa le misure da CSV, mostra la verifica e applica la calibrazione", async () => {
  const {carica} = require("../js/carica.js");
  const G = carica(), c = JSON.parse(JSON.stringify(Object.assign({}, G.ESEMPIO, {idro: G.IDRO_ESEMPIO})));
  const k = G.capacitaIdro(c), righe = [];
  for (let d = 0; d < 22; d++) righe.push({data: new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10), t_est_min: 4 + 3 * Math.sin(d / 3), t_est_max: 13 + 4 * Math.sin(d / 4)});
  const Gc = G.simulaClimaIdro(G.climaConMisure(c, righe, {fUA: 1.4, fSole: 0.5}), k, {passoOre: 1}).giorni;
  let csv = "data;t_est_min;t_est_max;t_tenda_min;t_tenda_max;t_garage_min;t_garage_max\n";
  for (const r of righe) { const g = Gc[G.giornoAnno(r.data)];
    csv += [r.data, r.t_est_min, r.t_est_max, g.tMinTenda, g.tMaxTenda, g.tGarageMin, g.tGarageMax].map((v, i) => i ? (+v).toFixed(2).replace(".", ",") : v).join(";") + "\n"; }
  const file = path.join(os.tmpdir(), "ambiente-" + process.pid + ".csv"); fs.writeFileSync(file, csv);
  const {page, context, errori} = await apri();
  await modo(page, "idro"); await scheda(page, "ambiente");
  assert.match(await page.locator("#contenuto").innerText(), /Dati insufficienti/);
  await page.setInputFiles('input[type="file"][accept*="csv"]', file);
  await page.waitForSelector("text=Verificato su giorni indipendenti", {timeout: 30000});
  assert.strictEqual(await page.evaluate(() => cfg.idro.ambiente_misure.length), 22);
  await page.click("text=Usa la calibrazione nel gemello");
  await page.waitForTimeout(500);
  const cal = await page.evaluate(() => cfg.idro.clima.calibrazione);
  assert.ok(cal && cal.stato === "verificato" && Math.abs(cal.fUA - 1.4) <= 0.3, JSON.stringify(cal));
  assert.deepStrictEqual(errori, []);
  fs.unlinkSync(file);
  await context.close();
});

test("prova Kratky: previsione congelata, diario, raccolta pianta per pianta e analisi degli errori", async () => {
  const {page, context, errori} = await apri();
  await modo(page, "idro"); await scheda(page, "registro");
  await page.fill('input[aria-label="Data di semina"]', "2027-03-01");
  await page.fill('input[data-cond="kwh0"]', "100");
  await page.click("text=Congela la previsione e inizia la prova");
  await page.waitForSelector("text=Prova in corso dal 2027-03-01");
  const prev = await page.evaluate(() => cfg.idro.esperimenti.find(e => e.tipo === "kratky").previsione.peso);
  await page.fill('input[aria-label="Data"]', "2027-03-05");
  await page.fill('input[data-dia="ph"]', "7.5"); await page.fill('input[data-dia="ec"]', "1.4");
  await page.click("text=Aggiungi al diario");
  await page.waitForSelector("text=pH 7.5 fuori da 5,5-6,8");
  for (const [p, g] of [["A1", 150], ["A2", 170], ["B1", 160], ["B2", 140]]) await page.fill('input[data-peso="' + p + '"]', String(g));
  await page.fill('input[data-nota="A3"]', "morta");
  await page.fill('input[aria-label="Lettura finale del contatore"]', "190");
  await page.click("text=Registra la raccolta e calcola gli errori");
  await page.waitForSelector("text=Un solo raccolto non rende affidabile il modello");
  const e = await page.evaluate(() => cfg.idro.esperimenti.find(e => e.tipo === "kratky"));
  assert.strictEqual(e.stato, "concluso"); assert.strictEqual(e.piante_raccolte, 4); assert.strictEqual(e.previsione.peso, prev, "la previsione è cambiata");
  assert.deepStrictEqual(errori, []);
  await context.close();
});

test("distinta: un prezzo controllato si salva, cambia la spesa e finisce nel CSV", async () => {
  const {page, context, errori} = await apri();
  await modo(page, "idro"); await livello(page, "esperto"); await scheda(page, "materiali");
  assert.match(await page.locator("#contenuto").innerText(), /PROVVISORIO/);
  const prima = await page.evaluate(() => somma(VOCI, "min"));
  const voce = await page.evaluate(() => VOCI.find(v => v.q === 1 && v.max > 20).nome);
  const riga = page.locator(".mat", {hasText: voce}).first();
  await riga.locator("text=Aggiungi un prezzo controllato").click();
  await riga.locator('input[data-off="fornitore"]').fill("Negozio di prova");
  await riga.locator('input[data-off="url"]').fill("https://esempio.it/p");
  await riga.locator('input[data-off="prezzo"]').fill("10");
  await riga.locator("text=Salva il prezzo").click();
  await page.waitForTimeout(500);
  const v = await page.evaluate(n => VOCI.find(x => x.nome === n), voce);
  assert.strictEqual(v.stato_prezzo, "verificato"); assert.strictEqual(v.min, 10);
  assert.ok(await page.evaluate(() => somma(VOCI, "min")) !== prima, "la spesa non è cambiata");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("text=Scarica la lista (CSV per Excel)")]);
  const f = path.join(os.tmpdir(), "lista-" + process.pid + ".csv"); await dl.saveAs(f);
  const testo = fs.readFileSync(f, "utf8"); fs.unlinkSync(f);
  assert.match(testo, /PREZZO VERIFICATO/); assert.match(testo, /Negozio di prova/); assert.match(testo, /PREZZO STIMATO/);
  assert.deepStrictEqual(errori, []);
  await context.close();
});

test("sensibilità nella scheda Costi, per l'idroponica e per l'orto", async () => {
  const {page, context, errori} = await apri();
  for (const m of ["idro", "orto"]) {
    await modo(page, m); await livello(page, "esperto"); await scheda(page, "costi");
    await page.click("text=Calcola la sensibilità (qualche secondo)");
    await page.waitForSelector("text=Rovescia il giudizio?", {timeout: 60000});
    assert.ok(await page.locator("text=Prezzo dell'energia").count() >= 1);
  }
  assert.deepStrictEqual(errori, []);
  await context.close();
});
