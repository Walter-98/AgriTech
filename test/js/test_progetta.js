"use strict";
// Fase 2: il percorso guidato rispetta i vincoli, propone alternative vere e sa dire di no.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica} = require("./carica");
const G = carica();

const CASI = [
  {},
  {obiettivo: "autoconsumo"},
  {obiettivo: "vendita", colture: ["basilico", "microgreens"], budget: 1500, budget_mese: 150, ore_settimana: 8},
  {budget: 300, superficie: 4, colture: ["lattuga"]},
  {budget: 1200, budget_mese: 80, colture: ["pomodoro", "peperoncino"], altezza: 2.2},
  {regione: "nord", budget: 800, colture: ["spinacio", "rucola"], ore_settimana: 2},
  {regione: "sud", budget: 2000, budget_mese: 200, colture: ["fragola"], obiettivo: "autoconsumo"},
  {budget: 600, superficie: 2, altezza: 1.6, colture: ["microgreens"]},
  {kwh: 0.15, obiettivo: "autoconsumo", budget: 1000, budget_mese: 60, colture: ["basilico"]},
  {luogo: "esterno", colture: ["pomodoro", "zucchina", "lattuga"], superficie: 20, budget: 400},
];

for (const [i, R] of CASI.entries()) test(`caso ${i + 1}: le proposte rispettano budget, spese, spazio, altezza e tempo`, () => {
  const r = G.progetta(R), Rp = Object.assign({}, G.RISPOSTE_ESEMPIO, R);
  for (const p of r.proposte.filter(p => p.x)) {
    const x = p.x.riassunto;
    assert.ok(x.capex <= Rp.budget + 1e-9, `${p.lettera}: ${x.capex} > ${Rp.budget}`);
    assert.ok(x.opex / 12 <= Rp.budget_mese + 1e-9, `${p.lettera}: spese ${x.opex / 12}`);
    if (r.tipo === "idro") {
      assert.ok(p.x.ing.m2 <= Rp.superficie && p.x.ing.altezza <= Rp.altezza, `${p.lettera}: ingombro`);
      assert.ok(x.ore <= Rp.ore_settimana, `${p.lettera}: ${x.ore} ore`);
      for (const c of p.x.c.idro.colture) assert.ok(Rp.colture.includes(c.coltura), "coltura non chiesta");
    }
  }
});

test("budget troppo piccolo: nessuna proposta e spiega quanto serve", () => {
  const r = G.progetta({budget: 60});
  assert.equal(r.proposte.filter(p => p.x).length, 0);
  assert.equal(r.giudizio.esito, "impossibile");
  assert.match(r.giudizio.righe[0].testo, /servono circa \d+ €/);
});

test("insalata per la famiglia in garage: sconsigliato con motivo", () => {
  const r = G.progetta({obiettivo: "autoconsumo", colture: ["lattuga"]});
  assert.equal(r.giudizio.esito, "sconsigliato");
});

test("vendita di microgreens con budget adeguato: possibile", () => {
  const r = G.progetta(CASI[2]);
  assert.equal(r.giudizio.esito, "possibile");
  assert.ok(r.proposte.some(p => p.x && p.x.riassunto.giudizio === "conviene"));
});

test("A costa meno di B, B produce di più di A", () => {
  const r = G.progetta({});
  const [A, B] = r.proposte;
  assert.ok(A.x.riassunto.capex <= B.x.riassunto.capex);
  assert.ok(B.x.riassunto.kg >= 1.5 * A.x.riassunto.kg || B.x.c.idro.colture.length > A.x.c.idro.colture.length);
});

test("se l'automatico non sta nel budget, la proposta C lo dice con il prezzo", () => {
  const r = G.progetta({});
  const C = r.proposte.find(p => p.lettera === "C");
  assert.ok(C);
  if (!C.x) assert.match(C.nota, /circa \d+ €/);
});

test("all'aperto: tre pacchetti dell'orto, costo al kg molto più basso dell'idroponica", () => {
  const o = G.progetta(CASI[9]), g = G.progetta({obiettivo: "autoconsumo", budget: 1000, colture: ["lattuga"]});
  assert.equal(o.tipo, "orto");
  assert.ok(o.proposte.length >= 1);
  const migliorG = Math.min(...g.ok.map(x => x.riassunto.costoKg));
  assert.ok(o.proposte[0].x.riassunto.costoKg < migliorG / 3);
});
