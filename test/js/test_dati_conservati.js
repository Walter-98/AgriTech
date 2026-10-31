"use strict";
// Nessuna perdita di dati: salvare in JSON e riaprire conserva misure, prove, diario, previsioni congelate e prezzi.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();

test("salva e riapri: misure dell'ambiente, prova Kratky con diario e previsione congelata, prezzi verificati", () => {
  const c = Object.assign(config(G), {modalita: "idro"});
  c.idro.ambiente_misure = [{data: "2026-11-02", t_est_min: 5, t_est_max: 12, t_tenda_min: 15, t_tenda_max: 24}];
  const e = G.avviaProvaKratky(c, {semina: "2027-03-01", condizioni: {kwh0: 100, varieta: "Trocadero lotto 12"}});
  G.aggiungiDiario(e, {data: "2027-03-02", ph: 6.0, ec: 1.4, foto: "2027-03-02_A.jpg", note: "tutto bene"});
  const voce = G.materialiIdro(c)[0];
  G.aggiungiOfferta(c, voce.nome, {fornitore: "F", url: "https://f.it/a", prezzo: 9.9, data: "2026-10-31", codice: "ABC-1"});
  const r = G.importaProgetto(G.esportaProgetto(c));
  const a = JSON.parse(JSON.stringify(c)), b = JSON.parse(JSON.stringify(r.cfg));
  delete a.versione_schema; delete b.versione_schema;
  assert.equal(JSON.stringify(b.idro.ambiente_misure), JSON.stringify(a.idro.ambiente_misure));
  assert.equal(JSON.stringify(b.idro.esperimenti), JSON.stringify(a.idro.esperimenti), "prova, diario o previsione cambiati");
  assert.equal(JSON.stringify(b.prezzi_verificati), JSON.stringify(a.prezzi_verificati));
  assert.equal(G.versioneConfig(r.cfg), G.versioneConfig(c));
});
