"use strict";
// Prezzi tracciabili: stati VERIFICATO / STORICO / STIMATO / NON DISPONIBILE, CAPEX ricalcolato, nessun dato inventato.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();
const OGGI = new Date().toISOString().slice(0, 10);
const giorniFa = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

test("senza offerte tutte le voci sono STIMATE e il giudizio economico è provvisorio", () => {
  const c = config(G), v = G.materialiIdro(c);
  assert.ok(v.length > 5 && v.every(x => x.stato_prezzo === "stimato"));
  assert.ok(v.every(x => !x.offerta), "nessun fornitore inventato");
  const r = G.riepilogoPrezzi(v);
  assert.equal(r.provvisorio, true); assert.match(r.giudizio, /PROVVISORIO/);
});

test("un'offerta verificata sostituisce la stima e ricalcola il CAPEX, IVA e spedizione comprese", () => {
  const c = config(G), prima = G.materialiIdro(c), voce = prima.find(x => x.q === 1 && x.max > 20);
  const capexPrima = G.economiaIdro(c, G.simulaIdro(c), prima, G.costiAnnuiIdro(c, G.simulaIdro(c))).capex;
  G.aggiungiOfferta(c, voce.nome, {fornitore: "Negozio di prova", url: "https://esempio.it/prodotto", prezzo: 10, iva: 22, iva_inclusa: false, spedizione: 5, data: OGGI});
  const dopo = G.materialiIdro(c), v2 = dopo.find(x => x.nome === voce.nome);
  assert.equal(v2.stato_prezzo, "verificato");
  assert.ok(Math.abs(v2.min - (10 * 1.22 + 5)) < 1e-9 && v2.min === v2.max);
  assert.equal(JSON.stringify(v2.stima), JSON.stringify([voce.min, voce.max]), "la stima resta visibile accanto al prezzo verificato");
  const capexDopo = G.economiaIdro(c, G.simulaIdro(c), dopo, G.costiAnnuiIdro(c, G.simulaIdro(c))).capex;
  assert.ok(Math.abs((capexPrima.min - capexDopo.min) - (voce.min - v2.min)) < 1e-6, "il CAPEX deve cambiare esattamente della differenza");
});

test("offerta vecchia: STORICO; prodotto non disponibile: resta la stima ma segnalata; vince la più conveniente", () => {
  const c = config(G), voce = G.materialiIdro(c).find(x => x.q === 1 && x.max > 20);
  G.aggiungiOfferta(c, voce.nome, {fornitore: "A", url: "https://a.it/x", prezzo: 30, data: giorniFa(90)});
  assert.equal(G.materialiIdro(c).find(x => x.nome === voce.nome).stato_prezzo, "storico");
  G.aggiungiOfferta(c, voce.nome, {fornitore: "B", url: "https://b.it/x", prezzo: 25, spedizione: 8, data: OGGI});
  const v = G.materialiIdro(c).find(x => x.nome === voce.nome);
  assert.equal(v.offerta.fornitore, "A", "30 € senza spedizione costa meno di 25 + 8");
  const conf = G.confrontaOfferte(c.prezzi_verificati[G.chiaveVoce(voce.nome)], 1, OGGI);
  assert.equal(conf.map(o => o.fornitore).join(), "A,B");
  const d = config(G), w = G.materialiIdro(d).find(x => x.q === 1 && x.max > 20);
  G.aggiungiOfferta(d, w.nome, {fornitore: "C", prezzo: 5, data: OGGI, disponibilita: "non_disponibile"});
  const w2 = G.materialiIdro(d).find(x => x.nome === w.nome);
  assert.equal(w2.stato_prezzo, "non_disponibile"); assert.equal(w2.min, w.min);
  // un'offerta senza link non è "verificata": non si può controllare
  const e = config(G), z = G.materialiIdro(e).find(x => x.q === 1 && x.max > 20);
  G.aggiungiOfferta(e, z.nome, {fornitore: "D", prezzo: 12, data: OGGI});
  assert.equal(G.materialiIdro(e).find(x => x.nome === z.nome).stato_prezzo, "storico");
});

test("dati mancanti o sbagliati vengono rifiutati", () => {
  const c = config(G);
  assert.throws(() => G.aggiungiOfferta(c, "x", {prezzo: 10, data: OGGI}), /fornitore/);
  assert.throws(() => G.aggiungiOfferta(c, "x", {fornitore: "A", prezzo: 10}), /data/);
  assert.throws(() => G.aggiungiOfferta(c, "x", {fornitore: "A", prezzo: -1, data: OGGI}), /prezzo/);
  assert.throws(() => G.aggiungiOfferta(c, "x", {fornitore: "A", prezzo: 1, data: OGGI, url: "non-un-link"}), /link/);
});

test("vale anche per l'orto: materiali() applica le offerte", () => {
  const c = JSON.parse(JSON.stringify(G.ESEMPIO)), v = G.materiali(c), voce = v.find(x => x.max > 5);
  G.aggiungiOfferta(c, voce.nome, {fornitore: "E", url: "https://e.it/y", prezzo: 1, data: OGGI});
  assert.equal(G.materiali(c).find(x => x.nome === voce.nome).stato_prezzo, "verificato");
});
