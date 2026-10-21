"use strict";
// Fase 4: mappa della luce, idraulica, ricetta dei nutrienti, meteo vero.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
const {carica, config} = require("./carica");
const G = carica();
const ctxR = vm.createContext({Math, Object, JSON, Number, isNaN});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "gemello", "ricetta.js"), "utf8"), ctxR);
vm.runInContext("globalThis.X = {ricetta, ecDaIoni, acquaDiPartenza, HOAGLAND, SALI};", ctxR);
const RC = ctxR.X;

test("luce: senza pareti i fotoni sul ripiano sono meno di quelli emessi (conservazione)", () => {
  const c = config(G, {clima: {tenda: false}});
  const m = G.mappaLuce(c);
  assert.ok(m.utilizzo > 0.3 && m.utilizzo < 1, `utilizzo ${m.utilizzo}`);
});

test("luce: le pareti riflettenti della tenda alzano la media e l'uniformità", () => {
  const con = G.mappaLuce(config(G, {clima: {tenda: true}})), senza = G.mappaLuce(config(G, {clima: {tenda: false}}));
  assert.ok(con.media > senza.media);
  assert.ok(con.uniformita > senza.uniformita);
});

test("luce: lampada più alta = luce più uniforme", () => {
  const vicina = G.mappaLuce(config(G, {luce: {distanza_cm: 20}})), lontana = G.mappaLuce(config(G, {luce: {distanza_cm: 60}}));
  assert.ok(lontana.uniformita > vicina.uniformita);
});

test("luce: la media della mappa è coerente con il modello semplice (±20%)", () => {
  const m = G.mappaLuce(config(G));
  assert.ok(Math.abs(m.media - m.ppfdSemplice) / m.ppfdSemplice < 0.2, `${m.media} contro ${m.ppfdSemplice}`);
});

test("idraulica: Hazen-Williams su un caso calcolato a mano", () => {
  const h = G.idraulicaIdro(config(G));
  // 6 canali × 1 L/min = 1e-4 m³/s, tubo 16 mm, C 150, L = dislivello + 1,5 m
  const Q = 6 / 60000, L = h.altezza + 1.5;
  const atteso = 10.67 * L * Math.pow(Q, 1.852) / (Math.pow(150, 1.852) * Math.pow(0.016, 4.87));
  assert.ok(Math.abs(h.perdite - atteso) < 1e-9);
  assert.equal(h.canali, 6);
  assert.ok(Math.abs(h.prevalenza - (h.altezza + h.perdite + 0.3)) < 1e-9);
});

test("idraulica: la pompa consigliata dà la portata alla prevalenza richiesta", () => {
  const h = G.idraulicaIdro(config(G));
  const qAllaPrevalenza = h.qMax * (1 - h.prevalenza / h.hMax);           // L/h
  assert.ok(qAllaPrevalenza >= h.portata * 60);
});

test("idraulica: niente pompa per Kratky e DWC", () => {
  assert.equal(G.idraulicaIdro(config(G, {sistema: "kratky"})), null);
  assert.equal(G.idraulicaIdro(config(G, {sistema: "dwc"})), null);
});

test("ricetta: con acqua pura e EC 2,2 si ritrova Hoagland (±7%: il nitrato di calcio commerciale contiene ammonio)", () => {
  const r = RC.ricetta(2.2, {ca: 0, mg: 0, hco3: 0, na: 0});
  for (const e of ["N", "P", "K", "Ca", "Mg"]) assert.ok(Math.abs(r.scarti[e]) < 0.07, `${e} ${r.scarti[e]}`);
  // grammi di nitrato di calcio = Ca ÷ 0,19 (stechiometria)
  assert.ok(Math.abs(r.grammi.nitrato_calcio - r.obiettivo.Ca / 0.19 * 0.1) / r.grammi.nitrato_calcio < 0.05);
});

test("ricetta: l'EC stimata coincide con quella della coltura", () => {
  for (const ec of [0.8, 1.2, 1.8, 2.5]) assert.ok(Math.abs(RC.ricetta(ec, {durezza: "media"}).ec - ec) < 0.02);
});

test("ricetta: acqua dura → meno nitrato di calcio, più acido e avviso sul calcio", () => {
  const dolce = RC.ricetta(1.2, {durezza: "dolce"}), dura = RC.ricetta(1.2, {durezza: "dura"});
  assert.ok(dura.grammi.nitrato_calcio < dolce.grammi.nitrato_calcio);
  assert.ok(dura.acidoMl > dolce.acidoMl);
  assert.ok(dura.avvisi.some(a => /Ca più alto/.test(a)));
});

test("ricetta: i sali di calcio stanno nella tanica A, solfati e fosfati nella B", () => {
  const r = RC.ricetta(1.5, {durezza: "dolce"});
  assert.ok(r.taniche.A.includes("nitrato_calcio"));
  for (const kk of r.taniche.B) assert.ok(!RC.SALI[kk].Ca);
});

test("meteo vero da CSV: 365 giorni, il gemello lo usa al posto delle medie", () => {
  const righe = ["data,et0_mm,pioggia_mm,t_min,t_max"];
  for (let d = 0; d < 365; d++) righe.push(`2023-${d},2,0,${30 + (d % 3)},${38}`);   // un anno caldissimo
  const ctx = G;
  const fs2 = require("fs"), vm2 = require("vm");
  const c2 = vm2.createContext({console, Math, Object, JSON, Array, Number, Set, String, Infinity, isFinite, isNaN, Error});
  for (const f of ["dati.js", "sim.js", "idro.js"]) vm2.runInContext(fs2.readFileSync(path.join(__dirname, "..", "..", "gemello", f), "utf8"), c2);
  const M = vm2.runInContext(`meteoDaCsv(${JSON.stringify(righe.join("\n"))})`, c2);
  assert.equal(M.giorni.length, 365);
  const caldo = config(G); caldo.meteoReale = M;
  const sCaldo = G.simulaIdro(caldo), sMedio = G.simulaIdro(config(G));
  assert.ok(sCaldo.giorniCaldo > sMedio.giorniCaldo);
  assert.ok(Math.abs(sCaldo.giorni[0].tGarage - (34 + 3)) < 1.01);
});
