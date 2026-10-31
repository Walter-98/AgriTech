"use strict";
// Scenari di accettazione A, B, C: dalla domanda dell'utente a simulazione, distinta, costi, rischi e rapporto.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica} = require("./carica");
const G = carica();
const R = {};
test.before(() => { for (const k of ["A", "B", "C"]) R[k] = G.eseguiAccettazione(k); });

test("A · orto di 20 m² nelle Marche: irrigazione automatica a sensori, dentro i 500 €, rapporto completo", () => {
  const r = R.A;
  assert.equal(r.c.logica.strategia, "sensori");
  assert.ok(r.distinta.max <= 500, "fuori budget: " + r.distinta.max);
  assert.equal(r.controlli.length, 0, r.controlli.join("; "));
  assert.ok(r.simulazione.acqua_l > 0 && r.simulazione.kg > 0);
  assert.ok(r.affidabilita.every(x => x.stato === "non_validato"));
  assert.match(G.rapportoAccettazione(r), /Scenario A[\s\S]*Distinta[\s\S]*Costi[\s\S]*Rischi[\s\S]*Sensibilità[\s\S]*Affidabilità/);
});

test("B · garage di 15 m² con lattuga e basilico: nei vincoli, dosaggio a mano, giudizio onesto", () => {
  const r = R.B;
  assert.ok(r.distinta.max <= 500, "fuori budget: " + r.distinta.max);
  assert.equal(r.controlli.length, 0, r.controlli.join("; "));
  assert.equal(r.sicurezza.dosaggio_automatico, false);
  assert.match(r.sicurezza.reale, /disattivato/);
  assert.notEqual(r.costi.giudizio, "conviene", "lattuga e basilico in garage per autoconsumo non si ripagano");
});

test("C · microgreens: la domanda variabile costa, il giudizio è ad alto rischio, il modo reale resta spento", () => {
  const r = R.C;
  assert.ok(r.domanda.migliore.p50 < r.micro.margineAnno, "con la domanda variabile il margine deve scendere");
  assert.ok(r.domanda.migliore.invenduto > 0);
  assert.ok(Number.isInteger(r.domanda.migliore.produzione));
  assert.ok(r.domanda.migliore.p10 <= r.domanda.migliore.p50 && r.domanda.migliore.p50 <= r.domanda.migliore.p90);
  assert.equal(r.sensibilita.rischio, "alto");
  assert.match(G.rapportoAccettazione(r), /Domanda variabile/);
});
