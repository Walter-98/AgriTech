"use strict";
// Fase 9: flusso e riflusso, goccia su substrato, cetriolo e peperone.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();

test("ogni coltura gira in ogni sistema adatto, con numeri finiti", () => {
  for (const [kk, P] of Object.entries(G.IDRO_PIANTE)) for (const sis of P.sistemi) {
    const s = G.simulaIdro(config(G, {sistema: sis, disposizione: "orizzontale", secchi: 2, colture: [{coltura: kk, quota: 100}]}));
    assert.ok(Number.isFinite(s.kg) && s.kg >= 0 && Number.isFinite(s.kwh), `${kk} in ${sis}`);
    assert.ok(G.materialiIdro(config(G, {sistema: sis, colture: [{coltura: kk, quota: 100}]})).length > 5);
  }
});

test("goccia a perdere consuma più acqua dei secchi olandesi a parità di piante", () => {
  const base = {colture: [{coltura: "pomodoro", quota: 100}]};
  const goccia = G.simulaIdro(config(G, Object.assign({sistema: "goccia", secchi: 2}, base)));     // 6 piante
  const secchi = G.simulaIdro(config(G, Object.assign({sistema: "bucket", secchi: 6}, base)));     // 6 piante
  assert.equal(goccia.k.piante, secchi.k.piante);
  assert.ok(goccia.acqua - goccia.acquaCambi > (secchi.acqua - secchi.acquaCambi) * 1.2);
});

test("flusso e riflusso: il serbatoio contiene l'acqua di un vassoio, la pompa lavora circa un'ora al giorno", () => {
  const c = config(G, {sistema: "ebb", disposizione: "scaffale", piani: 2, struttura: {lung_cm: 120, prof_cm: 60, h_piano_cm: 45}, superficie_piano: 0.72});
  const h = G.idraulicaIdro(c);
  assert.ok(!h.trabocca, `ritorno ${h.volumeRitorno} L`);
  assert.ok(Math.abs(h.volumeRitorno - 1.2 * 0.6 * 50) < 1e-9);
  const s = G.simulaIdro(c);
  assert.ok(s.kwhPompe > 0 && s.kwhPompe < 30);
});

test("cetriolo e peperone: ciclo, resa e sistemi coerenti", () => {
  for (const k of ["cetriolo", "peperone"]) {
    const P = G.IDRO_PIANTE[k];
    assert.ok(P.sistemi.includes("goccia"));
    assert.ok(P.resa >= 1000 && P.giorni >= 60);
    assert.ok(G.DATI_COLTURE.some(r => r[0] === k));
  }
});

test("il percorso guidato propone la goccia per i cetrioli", () => {
  const r = G.progetta({colture: ["cetriolo"], budget: 2000, budget_mese: 200, ore_settimana: 6, obiettivo: "autoconsumo"});
  assert.ok(r.ok.length > 0);
  assert.ok(r.ok.every(x => ["bucket", "goccia"].includes(x.c.idro.sistema)));
  assert.ok(r.ok.some(x => x.c.idro.sistema === "goccia"));
});
