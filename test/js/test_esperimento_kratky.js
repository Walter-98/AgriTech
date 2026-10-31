"use strict";
// Primo esperimento Kratky: previsione congelata sulla configurazione della prova, diario, raccolta pianta per pianta,
// analisi degli errori che non dichiara affidabile il modello per un solo raccolto.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();

test("la configurazione della prova è un Kratky manuale da 2 contenitori, con la zona del progetto", () => {
  const c = config(G); c.regione = "centro";
  const p = G.configProvaKratky(c);
  assert.equal(p.idro.sistema, "kratky"); assert.equal(p.regione, "centro"); assert.equal(p.idro.auto.dosaggio, false);
  assert.ok(Math.abs(p.idro.superficie_piano - 0.48) < 1e-9);
  assert.ok(G.capacitaIdro(p).piante >= 10, "la prova deve avere circa 12 piante");
  // budget indicativo della prova: 120 € di Kratky e materiali + 130 € di strumenti di misura
  const d = G.distintaProvaKratky(), min = d.reduce((a, v) => a + v.min, 0), tot = d.reduce((a, v) => a + v.max, 0);
  assert.ok(tot <= 250 && min <= 150, "distinta " + min + "-" + tot + " €");
  assert.ok(d.every(v => v.stato_prezzo === "stimato"), "i prezzi sono stime: devono dirlo");
});

test("avvio: la previsione congelata è della prova, ha l'incertezza e non si può modificare", () => {
  const c = config(G);
  const e = G.avviaProvaKratky(c, {semina: "2027-03-01", ruolo: "calibrazione", condizioni: {kwh0: 100}});
  assert.equal(e.tipo, "kratky");
  assert.ok(e.previsione.pesoP10 <= e.previsione.peso && e.previsione.peso <= e.previsione.pesoP90);
  assert.equal(e.previsione.impronta, G.versioneConfig(G.configProvaKratky(c)), "la previsione deve essere quella del Kratky, non del progetto");
  assert.ok(Object.isFrozen(e.previsione_prova));
  assert.throws(() => { "use strict"; e.previsione_prova.kwh_giorno = 0; });
});

test("diario: valori fuori range segnalati, data obbligatoria, un giorno per data", () => {
  const c = config(G), e = G.avviaProvaKratky(c, {semina: "2027-03-01"});
  assert.throws(() => G.aggiungiDiario(e, {ph: 6}));
  const r = G.aggiungiDiario(e, {data: "2027-03-10", ph: 7.4, ec: 1.4, t_min: 3, t_acqua: 18});
  assert.equal(r.avvisi.length, 2);
  G.aggiungiDiario(e, {data: "2027-03-10", ec: 1.5});
  assert.equal(e.diario.length, 1); assert.equal(e.diario[0].ec, 1.5); assert.equal(e.diario[0].ph, 7.4);
});

test("analisi: errore del peso contro la previsione congelata, mortalità, differenza tra contenitori, avvisi onesti", () => {
  const c = config(G), e = G.avviaProvaKratky(c, {semina: "2027-03-01", condizioni: {kwh0: 100}});
  for (let d = 0; d < 50; d++) G.aggiungiDiario(e, {data: new Date(Date.UTC(2027, 2, 1 + d)).toISOString().slice(0, 10), t_min: 12, t_max: 22, ur: 65, t_acqua: 18, ph: 6, ec: 1.4,
    livello_cm: 12, ore_luce: 14, kwh: 100 + d * 0.8, piante_vive: 12});
  const piante = [];
  for (const cont of ["A", "B"]) for (let i = 1; i <= 6; i++) piante.push({pos: cont + i, peso_g: cont === "A" && i === 6 ? 0 : 120 + i * 5 + (cont === "B" ? 15 : 0), scarto_g: 10});
  G.raccoltaProvaKratky(e, "2027-04-19", piante, 140);
  const a = G.analisiProvaKratky(e);
  assert.equal(a.piante.raccolte, 11); assert.equal(a.piante.morte, 1);
  assert.ok(Math.abs(a.piante.pesoMedio - (piante.filter(p => p.peso_g > 0).reduce((s, p) => s + p.peso_g, 0) / 11)) < 1e-9);
  assert.ok(Math.abs(a.peso.errore - (e.previsione.peso - a.piante.pesoMedio)) < 1e-9);
  assert.equal(typeof a.peso.dentro, "boolean");
  assert.equal(a.energia.misurati, 40);
  assert.ok(a.piante.differenzaContenitori > 0);
  assert.ok(a.avvisi.some(x => /Un solo raccolto non rende affidabile/.test(x)));
  // il raccolto entra nel laboratorio: errore misurato in calibrazione o validazione
  const v = G.valutaEsperimenti(c.idro);
  assert.equal(v.righe.length, 1);
});

test("diario incompleto: l'analisi lo dice invece di attribuire l'errore al modello", () => {
  const c = config(G), e = G.avviaProvaKratky(c, {semina: "2027-03-01"});
  G.aggiungiDiario(e, {data: "2027-03-02", ph: 6});
  G.raccoltaProvaKratky(e, "2027-04-19", [{pos: "A1", peso_g: 100}], null);
  const a = G.analisiProvaKratky(e);
  assert.ok(a.avvisi.some(x => /Diario incompleto/.test(x)));
  assert.equal(a.energia, undefined, "senza le letture del contatore niente errore sull'energia");
});
