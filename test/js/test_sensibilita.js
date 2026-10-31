"use strict";
// Ottimizzatore e sensibilità: proposte che rispettano i vincoli, fronte di Pareto giusto, costi uniformi, numeri
// plausibili; il giudizio "alto rischio" quando una sola ipotesi plausibile rovescia la convenienza.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();

test("idroponica: proposte nei vincoli, spesa calcolata in un solo modo, rese plausibili, Pareto corretto", () => {
  const R = Object.assign({}, G.RISPOSTE_ESEMPIO, {luogo: "garage", regione: "centro", budget: 500});
  const res = G.progettaIdro(R);
  assert.ok(res.ok.length > 10, "poche configurazioni possibili: " + res.ok.length);
  const ob = [x => x.riassunto.capex, x => isFinite(x.riassunto.costoKg) ? x.riassunto.costoKg : 1e9, x => x.riassunto.opex];
  const pr = G.controllaProposte(res, ob); assert.equal(pr.length, 0, pr.join("; "));
  for (const x of res.ok) assert.ok(x.riassunto.capex <= R.budget + 1e-9, "fuori budget: " + x.riassunto.capex);
});

test("i controlli dell'ottimizzatore trovano i problemi quando ci sono", () => {
  const R = Object.assign({}, G.RISPOSTE_ESEMPIO, {luogo: "garage", regione: "centro"});
  const res = G.progettaIdro(R), p = res.proposte.find(q => q.x);
  const finta = {tipo: "idro", ok: res.ok, proposte: [{lettera: "X", x: Object.assign({}, p.x, {vincoli: ["budget: troppo"], riassunto: Object.assign({}, p.x.riassunto, {capex: p.x.riassunto.capex + 50, kg: 1e5})})}]};
  const pr = G.controllaProposte(finta);
  assert.ok(pr.some(x => /vincoli/.test(x)) && pr.some(x => /spesa iniziale/.test(x)) && pr.some(x => /irrealistica/.test(x)) && pr.some(x => /fuori dall'elenco/.test(x)), pr.join("; "));
});

test("sensibilità idroponica: tutte le ipotesi richieste, ordinate per peso, energia più cara = utile più basso", () => {
  const c = config(G); c.regione = "centro";
  const r = G.sensibilitaIdro(c);
  const chiavi = r.righe.map(x => x.k).sort().join();
  assert.equal(chiavi, ["kwh", "t_est", "resa", "mortalita", "prezzo_vendita", "persone", "capex", "euro_ora", "vita"].sort().join());
  for (let i = 1; i < r.righe.length; i++) assert.ok(r.righe[i - 1].escursione >= r.righe[i].escursione);
  const e = r.righe.find(x => x.k === "kwh");
  assert.ok(e.alto.esito.utile < e.basso.esito.utile, "con l'energia più cara l'utile deve scendere");
  const t = r.righe.find(x => x.k === "t_est");
  assert.notEqual(t.alto.esito.utile, t.basso.esito.utile, "la temperatura esterna deve contare (stufetta, crescita)");
  assert.equal(r.righe.find(x => x.k === "prezzo_vendita").nonIncide, true, "senza vendita il prezzo di vendita non incide");
  assert.ok(r.messaggio.length > 10);
});

test("alto rischio quando la convenienza dipende da un'ipotesi fragile", () => {
  // microgreens venduti: conviene, ma con il prezzo di vendita basso o la resa bassa non più
  const c = config(G, {sistema: "vassoi", piani: 4, colture: [{coltura: "microgreens", quota: 100}], economia: {quota_vendita: 90, prezzo_vendita: 70}});
  const r = G.sensibilitaIdro(c);
  assert.equal(r.base.conviene, true, "il caso di partenza deve convenire");
  assert.equal(r.rischio, "alto");
  assert.ok(r.fragili.some(x => x.k === "prezzo_vendita" || x.k === "resa"), r.fragili.map(x => x.k).join());
  assert.match(r.messaggio, /ALTO RISCHIO/);
  // lattuga in casa: non conviene comunque, non è questione di ipotesi fragili
  const l = G.sensibilitaIdro(config(G));
  assert.equal(l.base.conviene, false); assert.equal(l.rischio, "basso"); assert.match(l.messaggio, /Non conviene/);
});

test("sensibilità dell'orto: stesse ipotesi economiche e temperatura, senza rifare l'anno per i soli conti", () => {
  const c = JSON.parse(JSON.stringify(G.ESEMPIO)), M = G.meteo(c), S = G.simula(c, {meteo: M});
  const r = G.sensibilitaOrto(c, M, S);
  assert.ok(r.righe.length >= 6);
  assert.ok(r.righe.find(x => x.k === "resa").alto.esito.utile > r.righe.find(x => x.k === "resa").basso.esito.utile);
});
