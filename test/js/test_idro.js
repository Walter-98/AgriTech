"use strict";
// Test numerici del motore idroponico: casi di riferimento calcolabili a mano e coerenza fisica dei risultati.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();
const vicino = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + ` atteso ${b} ± ${tol}, ottenuto ${a}`);
const anno = (mod) => { const c = config(G, mod); const s = G.simulaIdro(c); const v = G.materialiIdro(c); const k = G.costiAnnuiIdro(c, s); return {c, s, v, k, e: G.economiaIdro(c, s, v, k)}; };

test("DLI = PPFD × ore × 0,0036", () => {
  const c = config(G, {luce: {w_installati: 0, ppfd: 250, ore: 16}});
  const k = G.capacitaIdro(c);
  vicino(k.dliObiettivo, 250 * 16 * 0.0036, 1e-9);
  vicino(k.dli, k.ppfd * 16 * 0.0036, 0.01 * k.dli + 0.05);
});

test("PPFD dai watt montati: W × µmol/J × utilizzo ÷ superficie", () => {
  const c = config(G, {luce: {w_installati: 280, tipo: "led_qb", ore: 16}});
  const k = G.capacitaIdro(c);                         // scaffale 3 ripiani 110 × 55 cm = 1,815 m² di chioma
  vicino(k.chioma, 3 * 1.1 * 0.55, 1e-9);
  vicino(k.ppfd, Math.round(280 * 2.7 * 0.85 / 1.815), 0);
});

test("energia delle luci senza guasti = W × ore × 365", () => {
  const {s} = anno({luce: {w_installati: 280, ore: 16}});
  vicino(s.kwhLuci, 280 * 16 * 365 / 1000, 0.01);
  assert.ok(s.kwh > s.kwhLuci, "il totale comprende pompe, clima, elettronica");
  vicino(s.kwh, s.kwhLuci + s.kwhClima + s.kwhPompe + s.kwhElettronica, 1e-6);
});

test("la stessa luce con lampade meno efficienti costa più corrente nella proporzione delle efficienze", () => {
  const qb = G.capacitaIdro(config(G, {luce: {tipo: "led_qb"}})), t5 = G.capacitaIdro(config(G, {luce: {tipo: "t5"}}));
  vicino(t5.wRichiesti / qb.wRichiesti, 2.7 / 1.1, 0.1);              // i watt si arrotondano a 10
});

test("meno watt montati → meno luce → meno raccolto (la luce limita davvero la crescita)", () => {
  const pieno = anno({}), meta = anno({luce: {w_installati: Math.round(G.capacitaIdro(config(G)).wRichiesti / 2)}});
  assert.ok(meta.s.k.dli < pieno.s.k.dli * 0.55);
  assert.ok(meta.s.kg < pieno.s.kg * 0.6, `kg ${meta.s.kg} contro ${pieno.s.kg}`);
  assert.ok(meta.s.kwhLuci < pieno.s.kwhLuci * 0.55);
});

test("oltre il DLI massimo della coltura la resa non cresce più", () => {
  const P = G.IDRO_PIANTE.lattuga;
  assert.equal(G.rispostaLuce(P, P.dli[1]), G.rispostaLuce(P, P.dli[1] * 2));
  vicino(G.rispostaLuce(P, (P.dli[0] + P.dli[1]) / 2), 1, 1e-12);
  assert.equal(G.statoLuce(P, P.dli[1] * 1.5).stato, "troppa");
  assert.equal(G.statoLuce(P, P.dli[0] * 0.5).stato, "poca");
});

test("mortalità e giorni fermi riducono il raccolto in proporzione", () => {
  const base = anno({produzione: {mortalita: 0, fermo_giorni: 0, scarto: 0}, clima: {garage: "isolato"}});
  const morte = anno({produzione: {mortalita: 20, fermo_giorni: 0, scarto: 0}, clima: {garage: "isolato"}});
  vicino(morte.s.kg / base.s.kg, 0.8, 0.01);
  const fermo = anno({produzione: {mortalita: 0, fermo_giorni: 10, scarto: 0}, clima: {garage: "isolato"}});
  assert.ok(fermo.s.kg < base.s.kg);
});

test("bilancio: costo al kg = (spese + ammortamento) ÷ kg utilizzabili, pareggio = investimento ÷ margine", () => {
  const {e, s, k} = anno({});
  const C = e.scenari.centrale;
  vicino(C.ammortamento, e.capex.medio / e.vita, 1e-9);
  vicino(C.opex, k.totale, 1e-9);
  vicino(C.kgUtili, s.kg * (1 - 0.10), 1e-9);
  vicino(C.costoKg, (C.opex + C.ammortamento) / C.kgUtili, 1e-9);
  if (C.margine > 0) vicino(C.pareggioAnni, C.capex / C.margine, 1e-9); else assert.equal(C.pareggioAnni, Infinity);
  assert.ok(e.scenari.pessimistico.margine < C.margine && C.margine < e.scenari.ottimistico.margine + 1e-9);
});

test("il software sa sconsigliare: insalata in garage con la corrente a 0,30 €/kWh non si ripaga", () => {
  const {e} = anno({colture: [{coltura: "lattuga", quota: 100}]});
  assert.equal(e.giudizio, "non_conviene");
  assert.ok(e.motivi.length > 0);
  assert.equal(e.colture[0].conviene, false);
});

test("la parte venduta vale il prezzo di vendita, non quello del negozio", () => {
  const vendo = anno({economia: {quota_vendita: 100, prezzo_vendita: 50}});
  const atteso = vendo.s.perColtura.reduce((a, x) => a + x.kg * 0.9 * G.IDRO_PIANTE[x.coltura].prezzo * 0.5, 0);
  vicino(vendo.e.scenari.centrale.ricavo, atteso, 1e-6);
  assert.equal(vendo.e.scenari.centrale.sostituzione, 0);
});

test("in casa vale solo quello che la famiglia mangia: il resto è eccedenza", () => {
  const micro = {sistema: "vassoi", disposizione: "scaffale", piani: 3, colture: [{coltura: "microgreens", quota: 100}]};
  const casa = anno(micro), C = casa.e.scenari.centrale;
  vicino(C.casa, G.IDRO_PIANTE.microgreens.consumo * 3 * 52, 1e-9);
  vicino(C.casa + C.venduti + C.eccedenza, C.kgUtili, 1e-9);
  assert.equal(casa.e.giudizio, "non_conviene");
  const vendo = anno(Object.assign({}, micro, {economia: {quota_vendita: 90, prezzo_vendita: 70}}));
  assert.ok(vendo.e.scenari.centrale.margine > C.margine);
});

test("bilancio dell'acqua: acqua = traspirazione × 1,05 + cambi del serbatoio", () => {
  const {s} = anno({});
  const cambi = Math.ceil(365 / 21) * s.k.serbatoio;
  vicino(s.acquaCambi, cambi, 1e-6);
  assert.ok(s.acqua > s.acquaCambi);
});

test("tutti i sistemi e le lampade danno numeri finiti e non negativi", () => {
  for (const sis of Object.keys(G.SISTEMI_IDRO)) for (const l of Object.keys(G.LUCI_IDRO)) {
    const adatte = Object.keys(G.IDRO_PIANTE).filter(p => G.IDRO_PIANTE[p].sistemi.includes(sis));
    const {s, e} = anno({sistema: sis, colture: [{coltura: adatte[0], quota: 100}], luce: {tipo: l}});
    for (const v of [s.kwh, s.kg, s.acqua, s.valore, e.capex.min, e.capex.max, e.opex]) assert.ok(Number.isFinite(v) && v >= 0, `${sis}/${l}: ${v}`);
    assert.ok(e.capex.max >= e.capex.min);
  }
});

test("blackout di 5 ore senza UPS su NFT fa perdere piante, con DWC no", () => {
  const g = [{tipo: "blackout", giorno: 100, ore: 5}];
  const nft = anno({guasti: g, auto: {ups: false}}), dwc = anno({sistema: "dwc", disposizione: "orizzontale", guasti: g, auto: {ups: false}});
  assert.ok(nft.s.perse > 0);
  assert.equal(dwc.s.perse, 0);
});
