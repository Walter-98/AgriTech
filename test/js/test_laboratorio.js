"use strict";
// AgriTech 2.0: laboratorio esperimenti con previsioni congelate, metriche, schema del progetto versionato.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();

test("la previsione congelata non cambia se dopo cambio il progetto", () => {
  const c = config(G);
  const e = G.nuovoEsperimento(c, {coltura: "lattuga", semina: "2026-03-01", piante: 12});
  const prima = JSON.stringify(e.previsione);
  c.idro.luce.w_installati = 80;                                   // metà della luce dopo l'inizio
  G.concludiEsperimento(e, "2026-04-10", 1200, 12, 60);
  assert.equal(JSON.stringify(e.previsione), prima);
  assert.ok(e.previsione.pesoP10 <= e.previsione.pesoP90);
  assert.ok(e.previsione.kwhPeriodo > 0);
});

test("ruoli alternati e metriche separate: la validazione non usa i cicli di calibrazione", () => {
  const c = config(G);
  const es = [];
  for (let i = 0; i < 4; i++) es.push(G.nuovoEsperimento(c, {coltura: "lattuga", semina: `2026-0${3 + i}-01`, piante: 10}));
  assert.deepEqual(es.map(e => e.ruolo), ["calibrazione", "validazione", "calibrazione", "validazione"]);
  // veri: calibrazione all'80% del previsto, validazione al 100%
  es.forEach(e => G.concludiEsperimento(e, "2026-06-01", e.previsione.peso * 10 * (e.ruolo === "calibrazione" ? 0.8 : 1), 10, null));
  const v = G.valutaEsperimenti(c.idro);
  assert.equal(v.validazione.n, 2);
  assert.ok(Math.abs(v.validazione.mae) < 1e-9);
  assert.ok(v.calibrazione.bias > 0);
  const st = G.statisticheEsperimenti(c.idro);
  assert.ok(Math.abs(st[0].fattore - 0.8) < 1e-9 && st[0].n === 2 && st[0].proponibile);
});

test("metriche MAE, RMSE, bias su un caso calcolato a mano", () => {
  const m = G.metriche([10, -10, 20]);
  assert.ok(Math.abs(m.mae - 40 / 3) < 1e-9);
  assert.ok(Math.abs(m.rmse - Math.sqrt(600 / 3)) < 1e-9);
  assert.ok(Math.abs(m.bias - 20 / 3) < 1e-9);
  assert.equal(G.metriche([]), null);
});

test("progetto salvato e ricaricato dà gli stessi risultati (simulazione riproducibile)", () => {
  const c = config(G);
  const testo = G.esportaProgetto(c, {kg: 1});
  const r = G.importaProgetto(testo);
  assert.equal(r.cfg.versione_schema, G.VERSIONE_SCHEMA);
  const a = G.simulaIdro(c), b = G.simulaIdro(r.cfg);
  assert.equal(a.kg, b.kg); assert.equal(a.kwh, b.kwh);
  assert.throws(() => G.importaProgetto("{}"), /Non è un progetto/);
  assert.throws(() => G.importaProgetto(JSON.stringify({formato: "agritech-progetto", versione_schema: 99, configurazione: {}})), /più nuova/);
});

test("migrazione dallo schema 1: aggiunge i campi nuovi senza toccare quelli esistenti", () => {
  const vecchio = JSON.parse(JSON.stringify(config(G)));
  delete vecchio.idro.produzione; delete vecchio.idro.economia; vecchio.idro.luce = {tipo: "led_tubi", ppfd: 0, ore: 0, notte: true};
  const m = G.migra(vecchio);
  assert.equal(m.versione_schema, 2);
  assert.equal(m.idro.produzione.mortalita, 5);
  assert.equal(m.idro.luce.tipo, "led_tubi");
  assert.equal(m.idro.luce.distanza_cm, 35);
  assert.ok(Number.isFinite(G.simulaIdro(m).kg));
});
