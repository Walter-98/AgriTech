"use strict";
// AgriTech 2.0, motore climatico dinamico: conservazione dell'energia, fisica di base, calibrazione.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();
const clima = (mod, opz = {}) => { const c = config(G, mod); c.regione = "centro"; return G.simulaClimaIdro(c, G.capacitaIdro(c), opz); };

test("conservazione dell'energia: entrate = uscite + accumulo (±0,1%)", () => {
  for (const mod of [{}, {clima: {tenda: false}}, {clima: {garage: "isolato"}}, {clima: {riscaldamento: "tappetino"}}]) {
    const b = clima(mod, {pompaW: 12}).bilancio;
    assert.ok(Math.abs(b.ingresso - b.uscita - b.accumulo) / b.ingresso < 0.001, JSON.stringify(b));
  }
});

test("U del telo della tenda da EN ISO 6946: 1/(0,13 + 0,01 + 0,13) meno il 10% per il riflettente", () => {
  assert.ok(Math.abs(G.MATERIALI_TENDA.mylar.u - 0.9 / 0.27) < 1e-9);
  assert.ok(G.MATERIALI_TENDA.pannelli.u < 1.4);
});

test("garage isolato: escursione giornaliera e annuale più piccola del garage non isolato", () => {
  const ni = clima({clima: {tenda: false, riscaldamento: "nessuno"}}).giorni, is = clima({clima: {garage: "isolato", tenda: false, riscaldamento: "nessuno"}}).giorni;
  const escursione = G2 => G2.reduce((a, g) => a + g.tGarageMax - g.tGarageMin, 0) / 365;
  assert.ok(escursione(is) < escursione(ni));
  assert.ok(Math.min(...is.map(g => g.tGarageMin)) > Math.min(...ni.map(g => g.tGarageMin)));
});

test("senza tenda le piante stanno all'aria del garage; con la tenda e le luci accese fa più caldo dentro", () => {
  const senza = clima({clima: {tenda: false, riscaldamento: "nessuno"}}).giorni[180];
  assert.ok(Math.abs(senza.tLuci - senza.tGarage) < 3);
  const con = clima({clima: {tenda: true, riscaldamento: "nessuno", estrattore: false}}).giorni[30];
  assert.ok(con.tLuci > con.tGarage + 1, `${con.tLuci} contro ${con.tGarage}`);
});

test("la stufetta tiene la tenda alla minima impostata quando la potenza basta", () => {
  const G2 = clima({clima: {tenda: true, riscaldamento: "stufetta", t_min: 17}}).giorni;
  assert.ok(Math.min(...G2.map(g => g.tMinTenda)) > 16.9);
  assert.ok(G2.slice(0, 60).reduce((a, g) => a + g.whStufa, 0) > G2.slice(150, 210).reduce((a, g) => a + g.whStufa, 0));
});

test("serra fredda: più fredda di notte e più calda di giorno del garage", () => {
  const sf = clima({clima: {garage: "serra_fredda", tenda: false, riscaldamento: "nessuno"}}).giorni, ga = clima({clima: {tenda: false, riscaldamento: "nessuno"}}).giorni;
  assert.ok(Math.min(...sf.map(g => g.tGarageMin)) < Math.min(...ga.map(g => g.tGarageMin)));
  assert.ok(Math.max(...sf.map(g => g.tGarageMax)) > Math.max(...ga.map(g => g.tGarageMax)));
});

test("con passo di 1 ora i risultati restano entro 0,5 °C da quelli a 10 minuti (integrazione stabile)", () => {
  const a = clima({}, {passoOre: 1 / 6}).giorni, b = clima({}, {passoOre: 1}).giorni;
  for (let d = 0; d < 365; d++) assert.ok(Math.abs(a[d].tGarage - b[d].tGarage) < 0.5 && Math.abs(a[d].tLuci - b[d].tLuci) < 0.5, String(d));
});

test("calibrazione: da misure generate con dispersioni ×1,5 ritrova il fattore 1,5", () => {
  // senza stufetta né estrattore: la temperatura della tenda segue davvero le dispersioni (non è tenuta dal termostato)
  const c = config(G, {clima: {riscaldamento: "nessuno", estrattore: false}}); c.regione = "centro";
  const vero = JSON.parse(JSON.stringify(c)); vero.idro.clima.calibrazione = {fUA: 1.5, fSole: 1};
  const Gv = G.simulaClimaIdro(vero, G.capacitaIdro(vero)).giorni;
  const misure = [];
  for (let d = 0; d < 40; d++) misure.push({data: new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10), t_aria_min: Gv[d].tMinTenda, t_aria_max: Gv[d].tMaxTenda});
  const r = G.calibraClima(c, misure);
  assert.ok(r.ok);
  assert.equal(r.fUA, 1.5);
  assert.ok(r.rmseDopo < 1e-6 && r.rmsePrima > 0.1);
  assert.equal(G.calibraClima(c, misure.slice(0, 3)).ok, false);
});

test("confronto ambienti: sei scenari con numeri finiti", () => {
  const c = config(G); c.regione = "centro";
  const r = G.confrontoAmbienti(c);
  assert.equal(r.length, 6);
  for (const x of r) assert.ok([x.tMin, x.tMax, x.kwhRiscaldamento, x.oreGelo].every(Number.isFinite));
  assert.ok(r[0].kwhRiscaldamento === 0 && r[2].kwhRiscaldamento > 0);
});
