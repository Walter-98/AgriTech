"use strict";
// Calibrazione ambiente: confronto tra il modello del clima (clima.js) e le temperature misurate nel garage, nella tenda
// e nella soluzione; correzione dei due parametri del modello (fUA dispersioni, fSole sole sul garage) con giorni di
// CALIBRAZIONE e controllo su giorni di VERIFICA mai usati per correggere. Senza giorni di verifica il modello resta
// "calibrato, non validato". Il modello gira con la temperatura esterna MISURATA: così l'errore del meteo non viene
// scambiato per errore del modello.

// cosa si confronta: misura -> uscita giornaliera di simulaClimaIdro
const VARIABILI_AMBIENTE = [
  {k: "tenda_max", nome: "Tenda, massima", mis: "t_tenda_max", prev: "tMaxTenda", periodo: "giorno"},
  {k: "tenda_min", nome: "Tenda, minima", mis: "t_tenda_min", prev: "tMinTenda", periodo: "notte"},
  {k: "tenda_luci", nome: "Tenda, media a luci accese", mis: "t_tenda_luci", prev: "tLuci", periodo: "giorno"},
  {k: "tenda_buio", nome: "Tenda, media a luci spente", mis: "t_tenda_buio", prev: "tBuio", periodo: "notte"},
  {k: "garage_max", nome: "Garage, massima", mis: "t_garage_max", prev: "tGarageMax", periodo: "giorno"},
  {k: "garage_min", nome: "Garage, minima", mis: "t_garage_min", prev: "tGarageMin", periodo: "notte"},
  {k: "acqua", nome: "Soluzione, media", mis: "t_acqua", prev: "tAcqua", periodo: null},
];
// colonne del CSV giornaliero (e nomi accettati per compatibilità con strumenti/storico_ha.py e il Registro)
const COLONNE_AMBIENTE = ["data", "t_est_min", "t_est_max", "t_garage_min", "t_garage_max", "t_tenda_min", "t_tenda_max",
                          "t_tenda_luci", "t_tenda_buio", "t_acqua", "ur", "ventilazione_ore", "kwh", "porta_aperture", "note"];
const ALIAS_AMBIENTE = {t_aria_min: "t_tenda_min", t_aria_max: "t_tenda_max", t_acqua_media: "t_acqua", ur_media: "ur", t_esterna_min: "t_est_min", t_esterna_max: "t_est_max"};
const GRIGLIA_AMBIENTE = {fUA: [0.5, 0.6, 0.7, 0.85, 1, 1.2, 1.4, 1.7, 2], fSole: [0, 0.5, 1, 1.5, 2, 3]};

const numeroOVuoto = v => v === "" || v == null || isNaN(+v) ? null : +v;
function separaCsv(testo) {
  const righe = testo.trim().split(/\r?\n/).filter(r => r.trim()), sep = righe[0].includes(";") ? ";" : ",";
  const testa = righe.shift().split(sep).map(x => x.trim().toLowerCase()).map(x => ALIAS_AMBIENTE[x] || x);
  // Excel in italiano salva con il punto e virgola e la virgola dei decimali: 15,5 -> 15.5
  return {testa, righe: righe.map(r => r.split(sep).map(x => sep === ";" ? x.trim().replace(/^(-?\d+),(\d+)$/, "$1.$2") : x.trim()))};
}

// CSV giornaliero (una riga per giorno, colonne COLONNE_AMBIENTE) oppure orario (colonne data, ora, t_est, t_garage,
// t_tenda, t_acqua, ur, ventilazione 0/1, w, porta): quello orario viene riassunto giorno per giorno.
function misureAmbienteDaCsv(testo, c) {
  const {testa, righe} = separaCsv(testo);
  if (!testa.includes("data")) throw new Error("Manca la colonna data (AAAA-MM-GG)");
  const oggetti = righe.map(v => { const o = {}; testa.forEach((t, i) => { o[t] = t === "data" || t === "note" ? v[i] || "" : numeroOVuoto(v[i]); }); return o; })
    .filter(o => /^\d{4}-\d{2}-\d{2}$/.test(o.data));
  if (testa.includes("ora")) return aggregaOrarieAmbiente(oggetti, c);
  return oggetti.map(o => { const r = {data: o.data}; for (const k of COLONNE_AMBIENTE.slice(1)) if (o[k] != null && o[k] !== "") r[k] = o[k]; return r; });
}
// letture orarie -> giorni: minime e massime, medie a luci accese e spente (orari delle luci del progetto)
function aggregaOrarieAmbiente(ore, c) {
  const I = c && c.idro, k = I ? capacitaIdro(c) : null;
  const inizio = I && I.luce.notte ? 20 : 6, durata = k ? k.ore : 16;
  const accesa = h => ((h - inizio + 24) % 24) < durata;
  const giorni = {};
  for (const o of ore) {
    const g = giorni[o.data] = giorni[o.data] || {data: o.data, _: {}};
    const add = (nome, v) => { if (v == null) return; (g._[nome] = g._[nome] || []).push(v); };
    add("est", o.t_est); add("gar", o.t_garage); add("ten", o.t_tenda); add("acq", o.t_acqua); add("ur", o.ur);
    if (o.t_tenda != null && o.ora != null) add(accesa(o.ora) ? "luci" : "buio", o.t_tenda);
    if (o.ventilazione != null) g.ventilazione_ore = (g.ventilazione_ore || 0) + (o.ventilazione > 0 ? 1 : 0);
    if (o.w != null) g.kwh = (g.kwh || 0) + o.w / 1000;
    if (o.porta != null) g.porta_aperture = (g.porta_aperture || 0) + o.porta;
  }
  const media = a => a.reduce((x, y) => x + y, 0) / a.length;
  return Object.values(giorni).sort((a, b) => a.data < b.data ? -1 : 1).map(g => {
    const r = {data: g.data}, s = g._;
    if (s.est) { r.t_est_min = Math.min(...s.est); r.t_est_max = Math.max(...s.est); }
    if (s.gar) { r.t_garage_min = Math.min(...s.gar); r.t_garage_max = Math.max(...s.gar); }
    if (s.ten) { r.t_tenda_min = Math.min(...s.ten); r.t_tenda_max = Math.max(...s.ten); }
    if (s.luci) r.t_tenda_luci = media(s.luci);
    if (s.buio) r.t_tenda_buio = media(s.buio);
    if (s.acq) r.t_acqua = media(s.acq);
    if (s.ur) r.ur = media(s.ur);
    for (const kk of ["ventilazione_ore", "kwh", "porta_aperture"]) if (g[kk] != null) r[kk] = g[kk];
    return r;
  });
}
function csvModelloAmbiente() {
  return COLONNE_AMBIENTE.join(",") + "\n2026-11-03,6.5,14.0,9.0,13.5,17.0,24.5,,,19.5,62,0,3.1,2,esempio: cancella questa riga\n";
}

// configurazione con il meteo esterno misurato (i giorni senza misura restano sul clima medio della zona)
function climaConMisure(c, misure, cal) {
  const c2 = JSON.parse(JSON.stringify(c));
  const giorni = new Array(365);
  for (const m of misure) if (m.t_est_min != null && m.t_est_max != null) giorni[giornoAnno(m.data)] = {tmin: m.t_est_min, tmax: m.t_est_max};
  // "dal" entra nella chiave della cache del clima: impronta dei valori, così una misura corretta ricalcola il clima
  let h = 2166136261; const t = JSON.stringify(giorni);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  c2.meteoReale = {fonte: "misure del garage", dal: (h >>> 0).toString(16), giorni};
  if (cal) c2.idro.clima.calibrazione = cal;
  return c2;
}
// giorni utilizzabili: con la temperatura esterna misurata, senza porte aperte o disturbi segnati, e con il giorno prima
// misurato (il primo giorno di ogni serie serve ad avviare l'inerzia termica del garage)
function giorniUtiliAmbiente(misure) {
  const perData = {}; for (const m of misure) perData[m.data] = m;
  const esclusi = [], utili = [];
  for (const m of [...misure].sort((a, b) => a.data < b.data ? -1 : 1)) {
    const ieri = new Date(Date.parse(m.data + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
    if (m.t_est_min == null || m.t_est_max == null) esclusi.push({data: m.data, motivo: "temperatura esterna non misurata"});
    else if (!VARIABILI_AMBIENTE.some(v => m[v.mis] != null)) esclusi.push({data: m.data, motivo: "nessuna temperatura interna"});
    else if (m.porta_aperture > 0) esclusi.push({data: m.data, motivo: "porta del garage aperta " + m.porta_aperture + " volte"});
    else if (!perData[ieri] || perData[ieri].t_est_min == null) esclusi.push({data: m.data, motivo: "primo giorno della serie (avvio)"});
    else utili.push(m);
  }
  return {utili, esclusi};
}
function erroriAmbiente(c, k, giorni, cal, misure) {
  const G = simulaClimaIdro(climaConMisure(c, misure, cal), k, {passoOre: 1}).giorni;
  const per = {};
  for (const v of VARIABILI_AMBIENTE) per[v.k] = [];
  for (const m of giorni) { const g = G[giornoAnno(m.data)];
    for (const v of VARIABILI_AMBIENTE) if (m[v.mis] != null) per[v.k].push({data: m.data, misura: m[v.mis], previsione: g[v.prev], errore: g[v.prev] - m[v.mis]}); }
  return per;
}
function statisticheErrore(lista) {
  if (!lista.length) return {n: 0};
  const e = lista.map(x => x.errore), n = e.length;
  const peggiore = lista.reduce((a, b) => Math.abs(b.errore) > Math.abs(a.errore) ? b : a);
  return {n, mae: e.reduce((s, x) => s + Math.abs(x), 0) / n, rmse: Math.sqrt(e.reduce((s, x) => s + x * x, 0) / n),
          bias: e.reduce((s, x) => s + x, 0) / n, max: Math.abs(peggiore.errore), dataMax: peggiore.data};
}
function rmseTotale(per) {
  let se = 0, n = 0;
  for (const k in per) for (const x of per[k]) { se += x.errore * x.errore; n++; }
  return n ? Math.sqrt(se / n) : NaN;
}

// tutta la procedura: confronto, calibrazione sui primi giorni, verifica sugli altri, incertezza dei parametri
function calibraAmbiente(c, misure, opz = {}) {
  const {utili, esclusi} = giorniUtiliAmbiente(misure || []);
  const out = {giorniTotali: (misure || []).length, utili: utili.length, esclusi, griglia: GRIGLIA_AMBIENTE};
  if (utili.length < 7) return Object.assign(out, {stato: "dati_insufficienti",
    messaggio: "Servono almeno 7 giorni utili (con temperatura esterna e interna, senza porta aperta); ne hai " + utili.length + ". Per validare il modello ne servono almeno 14."});
  const k = capacitaIdro(c);
  // giorni in ordine di data: i primi ~60% per calibrare, gli ultimi per verificare (si controlla anche l'estrapolazione)
  const ord = [...utili].sort((a, b) => a.data < b.data ? -1 : 1);
  const nCal = ord.length >= 14 ? Math.ceil(ord.length * 0.6) : ord.length;
  const cal = ord.slice(0, nCal), ver = ord.slice(nCal);
  const base = Object.assign({fUA: 1, fSole: 1}, opz.partenza || {});
  const prova = p => ({p, perCal: erroriAmbiente(c, k, cal, p, misure)});
  const prove = [];
  for (const fUA of GRIGLIA_AMBIENTE.fUA) for (const fSole of GRIGLIA_AMBIENTE.fSole) { const r = prova({fUA, fSole}); r.rmse = rmseTotale(r.perCal); prove.push(r); }
  prove.sort((a, b) => a.rmse - b.rmse);
  const migliore = prove[0], iniziale = prova(base); iniziale.rmse = rmseTotale(iniziale.perCal);
  // incertezza: parametri che spiegano i giorni di calibrazione quasi altrettanto bene (entro il 10% + 0,1 °C)
  const soglia = migliore.rmse * 1.1 + 0.1, compatibili = prove.filter(r => r.rmse <= soglia).map(r => r.p);
  const intervallo = {fUA: [Math.min(...compatibili.map(p => p.fUA)), Math.max(...compatibili.map(p => p.fUA))],
                      fSole: [Math.min(...compatibili.map(p => p.fSole)), Math.max(...compatibili.map(p => p.fSole))]};
  const alBordo = migliore.p.fUA === GRIGLIA_AMBIENTE.fUA[0] || migliore.p.fUA === GRIGLIA_AMBIENTE.fUA[GRIGLIA_AMBIENTE.fUA.length - 1]
    || migliore.p.fSole === GRIGLIA_AMBIENTE.fSole[GRIGLIA_AMBIENTE.fSole.length - 1];
  const tabella = (perPrima, perDopo) => VARIABILI_AMBIENTE.map(v => ({k: v.k, nome: v.nome, periodo: v.periodo,
    prima: statisticheErrore(perPrima[v.k]), dopo: statisticheErrore(perDopo[v.k])})).filter(r => r.prima.n || r.dopo.n);
  Object.assign(out, {calibrazione: {giorni: cal.length, dal: cal[0].data, al: cal[cal.length - 1].data, rmsePrima: iniziale.rmse, rmseDopo: migliore.rmse,
                                    variabili: tabella(iniziale.perCal, migliore.perCal)},
                      parametri: migliore.p, intervallo, alBordo, compatibili: compatibili.length});
  if (!ver.length) return Object.assign(out, {stato: "calibrato_non_validato",
    messaggio: "Calibrato su " + cal.length + " giorni, ma senza giorni indipendenti: il modello NON è validato. Continua a misurare fino ad almeno 14 giorni utili."});
  const perVerPrima = erroriAmbiente(c, k, ver, base, misure), perVerDopo = erroriAmbiente(c, k, ver, migliore.p, misure);
  // incertezza della previsione: errore sui giorni di verifica con tutti i parametri compatibili
  const rmseCompatibili = compatibili.map(p => rmseTotale(erroriAmbiente(c, k, ver, p, misure)));
  const rv = rmseTotale(perVerDopo);
  const giudizio = rv <= 1.5 ? "buono" : rv <= 3 ? "accettabile" : "insufficiente";
  const notte = statisticheErrore(VARIABILI_AMBIENTE.filter(v => v.periodo === "notte").flatMap(v => perVerDopo[v.k]));
  const giorno = statisticheErrore(VARIABILI_AMBIENTE.filter(v => v.periodo === "giorno").flatMap(v => perVerDopo[v.k]));
  Object.assign(out, {verifica: {giorni: ver.length, dal: ver[0].data, al: ver[ver.length - 1].data, rmsePrima: rmseTotale(perVerPrima), rmseDopo: rv,
                                 rmseCompatibili: [Math.min(...rmseCompatibili), Math.max(...rmseCompatibili)],
                                 variabili: tabella(perVerPrima, perVerDopo), giorno, notte, giudizio, migliora: rv < rmseTotale(perVerPrima)}});
  if (ver.length < 7) return Object.assign(out, {stato: "calibrato_non_validato",
    messaggio: "Solo " + ver.length + " giorni di verifica: troppo pochi per dire che il modello è validato. Servono almeno 7 giorni indipendenti."});
  return Object.assign(out, {stato: "verificato",
    messaggio: "Verificato su " + ver.length + " giorni indipendenti (" + ver[0].data + " – " + ver[ver.length - 1].data + "): errore medio " +
      rv.toFixed(1).replace(".", ",") + " °C, giudizio " + giudizio + ". Vale per questo garage e per questa stagione: in un'altra stagione va riverificato."});
}
if (typeof module !== "undefined") module.exports = {VARIABILI_AMBIENTE, COLONNE_AMBIENTE, misureAmbienteDaCsv, aggregaOrarieAmbiente, csvModelloAmbiente,
  climaConMisure, giorniUtiliAmbiente, calibraAmbiente, statisticheErrore};
