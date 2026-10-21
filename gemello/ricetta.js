"use strict";
// Ricetta della soluzione nutritiva a partire dall'acqua di casa: quanti grammi di ciascun sale per 100 L, in due
// taniche madre A e B. Riferimento: soluzione di Hoagland n. 2 (Hoagland e Arnon 1950): N 210, P 31, K 235, Ca 160,
// Mg 48, S 64 mg/L, scalata sull'EC della coltura. Le percentuali dei sali sono quelle commerciali standard (A); la
// stima dell'EC (somma dei cationi in meq/L ÷ 10, regola pratica) e la stima di calcio, magnesio e bicarbonati dalla
// durezza (quando non hai l'analisi dell'acqua) sono approssimazioni (C).

const HOAGLAND = {N: 210, P: 31, K: 235, Ca: 160, Mg: 48, S: 64};
const SALI = {
  nitrato_calcio:  {nome: "Nitrato di calcio (15,5-0-0 + 19% Ca)", N: 0.155, NH4: 0.011, Ca: 0.19, tanica: "A", prezzo_kg: 2.5},
  nitrato_potassio: {nome: "Nitrato di potassio (13-0-46)", N: 0.13, K: 0.382, tanica: "B", prezzo_kg: 3.5},
  mkp:             {nome: "Fosfato monopotassico MKP (0-52-34)", P: 0.227, K: 0.282, tanica: "B", prezzo_kg: 5},
  solfato_magnesio: {nome: "Solfato di magnesio eptaidrato (sale inglese)", Mg: 0.0986, S: 0.13, tanica: "B", prezzo_kg: 1.5},
  solfato_potassio: {nome: "Solfato di potassio (0-0-50 + 18% S)", K: 0.415, S: 0.18, tanica: "B", prezzo_kg: 3},
};
const DUREZZA_GRADI = {dolce: 10, media: 22, dura: 35};      // °f tipici della classe

// acqua: {durezza: "media"} oppure analisi {ca, mg, hco3, na} in mg/L (dall'etichetta del gestore dell'acqua)
function acquaDiPartenza(a) {
  const f = DUREZZA_GRADI[a.durezza] || 22;                  // 1 °f = 0,1 mmol/L di Ca+Mg
  const stima = {ca: f / 10 * 0.75 * 40.08, mg: f / 10 * 0.25 * 24.31, hco3: f / 10 * 2 * 0.8 * 61.02, na: 15, stimata: true};
  const v = Object.assign({}, stima);
  for (const kk of ["ca", "mg", "hco3", "na"]) if (a[kk] != null && a[kk] !== "" && !isNaN(a[kk])) { v[kk] = +a[kk]; v.stimata = false; }
  return v;
}
// EC stimata della soluzione: cationi (meq/L) ÷ 10
function ecDaIoni(x) { return ((x.Ca || 0) / 20.04 + (x.Mg || 0) / 12.15 + (x.K || 0) / 39.1 + (x.NH4 || 0) / 14.01 + (x.Na || 0) / 22.99) / 10; }

// minimi quadrati non negativi (discesa per coordinate): sali ≥ 0 che avvicinano acqua + sali agli obiettivi
const PESI = {N: 2, K: 1, Ca: 0.5, P: 0.7, Mg: 0.5, S: 0.2};      // l'azoto conta di più; calcio e zolfo in eccesso si tollerano
function dosaSali(T, w) {
  const chiavi = Object.keys(SALI), el = Object.keys(PESI), base = {Ca: w.ca, Mg: w.mg};
  const x = Object.fromEntries(chiavi.map(kk => [kk, 0]));
  const residuo = e => (base[e] || 0) + chiavi.reduce((s, kk) => s + x[kk] * (SALI[kk][e] || 0), 0) - T[e];
  for (let it = 0; it < 400; it++) for (const kk of chiavi) {
    let num = 0, den = 0;
    for (const e of el) { const a = SALI[kk][e] || 0; if (!a) continue; const pe = PESI[e] / (T[e] * T[e]); num += pe * a * residuo(e); den += pe * a * a; }
    if (den > 0) x[kk] = Math.max(0, x[kk] - num / den);
  }
  return x;
}
function soluzione(T, w) {
  const mg = dosaSali(T, w), ott = {N: 0, P: 0, K: 0, Ca: w.ca, Mg: w.mg, S: 0, NH4: 0, Na: w.na};
  for (const [kk, q] of Object.entries(mg)) for (const e of ["N", "P", "K", "Ca", "Mg", "S", "NH4"]) ott[e] += q * (SALI[kk][e] || 0);
  return {mg, ott, ec: ecDaIoni(ott)};
}

function ricetta(ecObiettivo, a, litri = 100) {
  const w = acquaDiPartenza(a || {});
  const ecAcqua = ecDaIoni({Ca: w.ca, Mg: w.mg, Na: w.na});
  // fattore su Hoagland cercato per bisezione: EC di acqua + sali = EC della coltura
  let lo = 0.05, hi = 1.6, f = 1, sol = null;
  for (let i = 0; i < 40; i++) {
    f = (lo + hi) / 2;
    const T = {}; for (const [kk, v] of Object.entries(HOAGLAND)) T[kk] = v * f;
    sol = soluzione(T, w);
    if (sol.ec > ecObiettivo) hi = f; else lo = f;
  }
  const T = {}; for (const [kk, v] of Object.entries(HOAGLAND)) T[kk] = v * f;
  const {mg, ott, ec} = sol;
  // acido per i bicarbonati: si lasciano circa 0,5 meq/L come tampone. Acido fosforico 75%: circa 12 meq/mL
  const hco3meq = w.hco3 / 61.02, acidoMl = Math.max(0, hco3meq - 0.5) * litri / 12;
  const grammi = {}; for (const [kk, q] of Object.entries(mg)) grammi[kk] = q * litri / 1000;
  const costo = Object.entries(grammi).reduce((s, [kk, g]) => s + g / 1000 * SALI[kk].prezzo_kg, 0) + acidoMl * 0.009;
  const scarti = Object.fromEntries(Object.keys(PESI).map(e => [e, T[e] ? (ott[e] - T[e]) / T[e] : 0]));
  return {fattore: f, obiettivo: T, ottenuto: ott, scarti, acqua: w, ecAcqua, ec, grammi, acidoMl, litri, costo,
          taniche: {A: Object.keys(grammi).filter(kk => SALI[kk].tanica === "A" && grammi[kk] > 0.05), B: Object.keys(grammi).filter(kk => SALI[kk].tanica === "B" && grammi[kk] > 0.05)},
          avvisi: [
            ...(w.stimata ? ["Calcio, magnesio e bicarbonati sono stimati dalla durezza: con l'analisi del gestore dell'acqua (bolletta o sito) la ricetta diventa precisa."] : []),
            ...(Object.entries(scarti).filter(([e, v]) => Math.abs(v) > 0.25).map(([e, v]) => e + (v > 0 ? " più alto" : " più basso") + " del riferimento del " + Math.round(Math.abs(v) * 100) + "%: con questi sali e quest'acqua non si fa di meglio" + (e === "Ca" && v > 0 ? " (il calcio arriva dall'acqua dura)" : "") + ".")),
            ...(w.na > 50 ? ["Sodio alto (" + Math.round(w.na) + " mg/L): si accumula nel ricircolo, cambia la soluzione più spesso o usa acqua piovana/osmosi."] : []),
            "Mai mescolare le taniche A e B concentrate: calcio con solfati e fosfati fa un precipitato bianco insolubile.",
            "Aggiungi i microelementi chelati (ferro compreso) alla dose dell'etichetta nella tanica B. L'EC non misura i singoli elementi: ogni 2-3 cambi conviene un'analisi della soluzione."]};
}
if (typeof module !== "undefined") module.exports = {ricetta, acquaDiPartenza, ecDaIoni, HOAGLAND, SALI};
