"use strict";
// Analisi di sensibilità: quanto cambia la convenienza se un'ipotesi è sbagliata. Ogni ipotesi si sposta da sola
// (le altre restano al valore del progetto) tra un valore basso e uno alto plausibili. Se una sola ipotesi plausibile
// rovescia il giudizio (da "conviene" a "non conviene" o viceversa), la configurazione è ad ALTO RISCHIO: la sua
// convenienza poggia su un'ipotesi fragile. Vale per l'idroponica (simulaIdro) e per l'orto (simula).

// [chiave, nome, unità, basso, alto, come si applica]. "sim" = serve una simulazione nuova; "eco" = solo i conti.
const IPOTESI_IDRO = [
  {k: "kwh", nome: "Prezzo dell'energia", unita: "€/kWh", basso: c => c.prezzi.kwh * 0.7, alto: c => c.prezzi.kwh * 1.5, sim: false, applica: (c, v) => { c.prezzi.kwh = v; }},
  {k: "t_est", nome: "Temperatura esterna", unita: "°C rispetto all'anno medio", basso: () => -2, alto: () => 2, sim: true, applica: (c, v) => { c.scostamento_t_esterna = v; }},
  {k: "resa", nome: "Resa delle piante", unita: "× la resa del modello", basso: () => 0.7, alto: () => 1.15, sim: false, resa: true},
  {k: "mortalita", nome: "Piante perse", unita: "%", basso: () => 0, alto: () => 20, sim: true, applica: (c, v) => { c.idro.produzione = Object.assign({}, c.idro.produzione, {mortalita: v}); }},
  {k: "prezzo_vendita", nome: "Prezzo di vendita", unita: "% del prezzo del negozio", basso: () => 40, alto: () => 100, sim: false, soloVendita: true,
   applica: (c, v) => { c.idro.economia = Object.assign({}, c.idro.economia, {prezzo_vendita: v}); }},
  {k: "persone", nome: "Consumo della famiglia", unita: "persone", basso: () => 1, alto: () => 5, sim: false, applica: (c, v) => { c.idro.economia = Object.assign({}, c.idro.economia, {persone: v}); }},
  {k: "capex", nome: "Costi iniziali", unita: "× la distinta", basso: () => 0.8, alto: () => 1.4, sim: false, capex: true},
  {k: "euro_ora", nome: "Ore di lavoro (valore di un'ora)", unita: "€/ora", basso: () => 0, alto: () => 8, sim: false, applica: (c, v) => { c.idro.economia = Object.assign({}, c.idro.economia, {euro_ora: v}); }},
  {k: "vita", nome: "Durata dei componenti", unita: "anni", basso: () => 3, alto: () => 8, sim: false, applica: (c, v) => { c.idro.economia = Object.assign({}, c.idro.economia, {vita_anni: v}); }},
];

function esitoIdro(c, s, opz = {}) {
  const sim = s || simulaIdro(c, {passoClima: 1});
  const s2 = opz.resa ? Object.assign({}, sim, {perColtura: sim.perColtura.map(x => Object.assign({}, x, {kg: x.kg * opz.resa}))}) : sim;
  let voci = materialiIdro(c);
  if (opz.capex) voci = voci.map(v => Object.assign({}, v, {min: v.min * opz.capex, max: v.max * opz.capex}));
  const costi = costiAnnuiIdro(c, s2), e = economiaIdro(c, s2, voci, costi), C = e.scenari.centrale;
  return {utile: C.utile, margine: C.margine, costoKg: C.costoKg, pareggio: C.pareggioAnni, giudizio: e.giudizio, conviene: e.giudizio === "conviene"};
}

function sensibilitaIdro(c0) {
  const c = JSON.parse(JSON.stringify(c0)), sBase = simulaIdro(c, {passoClima: 1}), base = esitoIdro(c, sBase);
  const vende = ((c.idro.economia || {}).quota_vendita || 0) > 0;
  const righe = IPOTESI_IDRO.map(h => {
    const prova = v => {
      if (h.resa) return esitoIdro(c, sBase, {resa: v});
      if (h.capex) return esitoIdro(c, sBase, {capex: v});
      const c2 = JSON.parse(JSON.stringify(c)); h.applica(c2, v);
      return esitoIdro(c2, h.sim ? simulaIdro(c2, {passoClima: 1}) : sBase);
    };
    const vb = h.basso(c), va = h.alto(c), b = prova(vb), a = prova(va);
    const ribalta = b.conviene !== base.conviene || a.conviene !== base.conviene;
    return {k: h.k, nome: h.nome, unita: h.unita, basso: {valore: vb, esito: b}, alto: {valore: va, esito: a},
            escursione: Math.abs(a.utile - b.utile), ribalta, nonIncide: h.soloVendita && !vende};
  }).sort((x, y) => y.escursione - x.escursione);
  const fragili = righe.filter(r => r.ribalta);
  return {base, righe, fragili, rischio: fragili.length ? "alto" : "basso",
          messaggio: fragili.length ? "ALTO RISCHIO: il giudizio cambia se è sbagliata anche una sola ipotesi: " + fragili.map(r => r.nome.toLowerCase()).join(", ") + "."
                                    : base.conviene ? "Il giudizio (conviene) regge a ogni ipotesi presa da sola: resta da verificare quando sbagliano più ipotesi insieme."
                                                    : "Non conviene con nessuna delle ipotesi prese da sola: non è una questione di ipotesi fragili."};
}

// orto: le ipotesi economiche si ricalcolano senza rifare l'anno (che è minuto per minuto); la temperatura sì
const IPOTESI_ORTO = [
  {k: "kwh", nome: "Prezzo dell'energia", unita: "€/kWh", basso: c => c.prezzi.kwh * 0.7, alto: c => c.prezzi.kwh * 1.5, applica: (c, v) => { c.prezzi.kwh = v; }},
  {k: "acqua", nome: "Prezzo dell'acqua", unita: "€/m³", basso: c => c.prezzi.acqua_m3 * 0.7, alto: c => c.prezzi.acqua_m3 * 1.5, applica: (c, v) => { c.prezzi.acqua_m3 = v; }},
  {k: "resa", nome: "Resa delle piante", unita: "× la resa del modello", basso: () => 0.6, alto: () => 1.2, resa: true},
  {k: "capex", nome: "Costi iniziali", unita: "× la distinta", basso: () => 0.8, alto: () => 1.4, capex: true},
  {k: "vita", nome: "Durata dei componenti", unita: "anni", basso: () => 3, alto: () => 8, vita: true},
  {k: "t_est", nome: "Temperatura esterna", unita: "°C rispetto all'anno medio", basso: () => -2, alto: () => 2, sim: true},
];
function esitoOrto(c, s, opz = {}) {
  let voci = materiali(c);
  if (opz.capex) voci = voci.map(v => Object.assign({}, v, {min: v.min * opz.capex, max: v.max * opz.capex}));
  const costi = costiAnnui(c, s, voci), capex = (somma(voci, "min") + somma(voci, "max")) / 2;
  const valore = s.valore * (opz.resa || 1), kg = s.kg * (opz.resa || 1), vita = opz.vita || 5;
  const margine = valore - costi.totale, utile = margine - capex / vita;
  return {utile, margine, costoKg: kg ? (costi.totale + capex / vita) / kg : Infinity, pareggio: margine > 0 ? capex / margine : Infinity, conviene: utile > 0};
}
function sensibilitaOrto(c0, M, S) {
  const c = JSON.parse(JSON.stringify(c0)), Mb = M || meteo(c), Sb = S || simula(c, {meteo: Mb}), base = esitoOrto(c, Sb);
  const righe = IPOTESI_ORTO.map(h => {
    const prova = v => {
      if (h.resa) return esitoOrto(c, Sb, {resa: v});
      if (h.capex) return esitoOrto(c, Sb, {capex: v});
      if (h.vita) return esitoOrto(c, Sb, {vita: v});
      if (h.sim) { const M2 = Mb.map(g => Object.assign({}, g, {t: g.t + v}, g.tmin != null ? {tmin: g.tmin + v, tmax: g.tmax + v} : {})); return esitoOrto(c, simula(c, {meteo: M2})); }
      const c2 = JSON.parse(JSON.stringify(c)); h.applica(c2, v); return esitoOrto(c2, Sb);
    };
    const vb = h.basso(c), va = h.alto(c), b = prova(vb), a = prova(va);
    return {k: h.k, nome: h.nome, unita: h.unita, basso: {valore: vb, esito: b}, alto: {valore: va, esito: a}, escursione: Math.abs(a.utile - b.utile),
            ribalta: b.conviene !== base.conviene || a.conviene !== base.conviene};
  }).sort((x, y) => y.escursione - x.escursione);
  const fragili = righe.filter(r => r.ribalta);
  return {base, righe, fragili, rischio: fragili.length ? "alto" : "basso",
          messaggio: fragili.length ? "ALTO RISCHIO: il giudizio cambia se è sbagliata anche una sola ipotesi: " + fragili.map(r => r.nome.toLowerCase()).join(", ") + "."
                                    : base.conviene ? "Il giudizio (conviene) regge a ogni ipotesi presa da sola." : "Non conviene con nessuna delle ipotesi prese da sola."};
}

// controlli sull'ottimizzatore: le configurazioni proposte rispettano i vincoli, il fronte di Pareto è giusto, i costi
// sono calcolati tutti allo stesso modo e i numeri sono plausibili. Restituisce l'elenco dei problemi (vuoto = a posto).
const RESA_MAX_KG_M2_ANNO = 60;    // lattuga in idroponica al chiuso, per m² di superficie coltivata: oltre è irrealistico
function controllaProposte(res, obiettivi) {
  const problemi = [];
  for (const p of res.proposte || []) {
    if (!p.x) continue;
    if (p.x.vincoli && p.x.vincoli.length) problemi.push(p.lettera + ": proposta che non rispetta i vincoli (" + p.x.vincoli.join(", ") + ")");
    if (!res.ok.includes(p.x)) problemi.push(p.lettera + ": proposta fuori dall'elenco delle configurazioni possibili");
    if (res.tipo === "idro") {
      const v = materialiIdro(p.x.c), capex = (somma(v, "min") + somma(v, "max")) / 2;
      if (Math.abs(capex - p.x.riassunto.capex) > 0.01) problemi.push(p.lettera + ": spesa iniziale calcolata in modo diverso (" + capex + " contro " + p.x.riassunto.capex + ")");
      const I = p.x.c.idro, sup = SISTEMI_IDRO[I.sistema].verticale ? null : I.superficie_piano * (I.piani || 1);
      if (sup && p.x.riassunto.kg / sup > RESA_MAX_KG_M2_ANNO) problemi.push(p.lettera + ": resa irrealistica " + (p.x.riassunto.kg / sup).toFixed(0) + " kg/m² all'anno");
    }
    if (p.x.riassunto.giudizio === "conviene" && !(p.x.riassunto.utile > 0)) problemi.push(p.lettera + ": detta conveniente con utile non positivo");
  }
  if (obiettivi) {
    const fronte = paretiani(res.ok, obiettivi);
    for (const a of fronte) if (res.ok.some(b => obiettivi.every(f => f(b) <= f(a)) && obiettivi.some(f => f(b) < f(a)))) problemi.push("fronte di Pareto con un elemento dominato");
    for (const a of res.ok) if (!fronte.includes(a) && !fronte.some(b => obiettivi.every(f => f(b) <= f(a)))) problemi.push("configurazione non dominata esclusa dal fronte");
  }
  return problemi;
}
if (typeof module !== "undefined") module.exports = {IPOTESI_IDRO, IPOTESI_ORTO, sensibilitaIdro, sensibilitaOrto, esitoIdro, esitoOrto, controllaProposte, RESA_MAX_KG_M2_ANNO};
