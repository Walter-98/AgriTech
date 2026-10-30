"use strict";
// Registro e calibrazione: confronta i raccolti veri (date e pesate) con quello che il gemello prevedeva per le stesse
// date e con il clima misurato, stima l'errore e propone un fattore di correzione per coltura SOLO con almeno 2 cicli.
// Le calibrazioni sono versionate e si può tornare indietro. Non toccano mai la logica di controllo e le sicurezze.

const MIN_CICLI_CALIBRAZIONE = 2;

function giornoAnno(data) {
  const d = new Date(data + "T12:00:00Z"), inizio = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.min(364, Math.floor((d - inizio) / 86400000));
}
function giorniTra(a, b) { return Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000); }

// misure giornaliere: [{data, t_aria_min, t_aria_max, t_acqua_media, ph_medio, ec_media}] (CSV di storico_ha.py)
function misureDaCsv(testo) {
  const righe = testo.trim().split(/\r?\n/), testa = righe.shift().split(/[,;]/).map(x => x.trim());
  return righe.map(r => { const v = r.split(/[,;]/), o = {};
    testa.forEach((t, i) => { o[t] = t === "data" ? v[i] : v[i] === "" || v[i] == null ? null : +v[i]; });
    return o; }).filter(o => o.data);
}

// previsione per un ciclo registrato: peso per pianta alla data di raccolta e giorni che il gemello avrebbe previsto
function previsioneCiclo(c, rec, misure, sim) {
  const P = IDRO_PIANTE[rec.coltura], s = sim || simulaIdro(c), k = s.k;
  const perData = {};
  for (const m of misure || []) perData[m.data] = m;
  const inizio = giornoAnno(rec.semina);
  const durata = giorniTra(rec.semina, rec.raccolta);
  let giorniMisurati = 0;
  const clima = g => {
    const data = new Date(Date.parse(rec.semina + "T12:00:00Z") + (g - inizio) * 86400000).toISOString().slice(0, 10);
    const m = perData[data], gs = s.giorni[g % 365];
    if (m && m.t_aria_min != null && m.t_aria_max != null) { giorniMisurati++; return {tMedia: (m.t_aria_min + m.t_aria_max) / 2, dli: gs.dli}; }
    return {tMedia: gs.tMedia, dli: gs.dli};
  };
  if (P.crescita) {
    const co = coorte(Object.assign({}, P, {resa: 1e9}), inizio, clima, P.passo || 20);
    const pesoPrevisto = co.curva[Math.min(co.curva.length - 1, Math.max(0, durata - 1))];
    const target = coorte(P, inizio, g => clima(g), P.passo || 20);
    return {pesoPrevisto, giorniPrevisti: target.giorniDaSemina, durata, giorniMisurati: Math.min(giorniMisurati, durata), modello: "crescita"};
  }
  const pesoPrevisto = P.resa * rispostaLuce(P, k.dli);
  return {pesoPrevisto, giorniPrevisti: P.vivaio + P.giorni, durata, giorniMisurati: 0, modello: "tabella"};
}

function confronto(c, registro, misure) {
  const sim = simulaIdro(c), righe = [];
  for (const rec of registro || []) {
    if (!rec.raccolta || !rec.peso_g || !rec.piante || !IDRO_PIANTE[rec.coltura]) continue;
    const p = previsioneCiclo(c, rec, misure, sim);
    const vero = rec.peso_g / rec.piante;
    righe.push(Object.assign({}, rec, p, {pesoVero: vero, errore: (p.pesoPrevisto - vero) / vero, rapporto: vero / p.pesoPrevisto}));
  }
  const perColtura = {};
  for (const r of righe) (perColtura[r.coltura] = perColtura[r.coltura] || []).push(r);
  const statistiche = Object.entries(perColtura).map(([coltura, l]) => {
    const n = l.length, media = l.reduce((a, r) => a + r.rapporto, 0) / n;
    const ds = n > 1 ? Math.sqrt(l.reduce((a, r) => a + (r.rapporto - media) ** 2, 0) / (n - 1)) : null;
    const mape = l.reduce((a, r) => a + Math.abs(r.errore), 0) / n;
    return {coltura, n, fattore: media, ds, mape, proponibile: n >= MIN_CICLI_CALIBRAZIONE,
            intervallo: ds != null ? [media - 2 * ds / Math.sqrt(n), media + 2 * ds / Math.sqrt(n)] : null};
  });
  return {righe, statistiche};
}

// errore medio dopo l'applicazione del fattore (sugli stessi cicli: è un controllo di coerenza, non una validazione)
function erroreDopo(st, righe) {
  const l = righe.filter(r => r.coltura === st.coltura);
  return l.reduce((a, r) => a + Math.abs((r.pesoPrevisto * st.fattore - r.pesoVero) / r.pesoVero), 0) / l.length;
}

// calibrazioni versionate in c.idro.calibrazioni = [{versione, data, fattori: {coltura: f}, note}], attiva = ultima
function applicaCalibrazione(I, statistiche, data) {
  const lista = I.calibrazioni = I.calibrazioni || [];
  const prec = lista.length ? lista[lista.length - 1].fattori : {};
  const fattori = Object.assign({}, prec);
  const usate = statistiche.filter(s => s.proponibile);
  if (!usate.length) return null;
  // la previsione confrontata è quella del modello senza calibrazioni: il fattore è assoluto, non si moltiplica
  for (const s of usate) fattori[s.coltura] = s.fattore;
  const v = {versione: lista.length + 1, data: data || new Date().toISOString().slice(0, 10), fattori,
             note: usate.map(s => IDRO_PIANTE[s.coltura].nome + " × " + s.fattore.toFixed(2) + " (" + s.n + " cicli)").join(", ")};
  lista.push(v);
  return v;
}
function tornaIndietro(I) {
  if (I.calibrazioni && I.calibrazioni.length) return I.calibrazioni.pop();
  return null;
}
function fattoriAttivi(I) {
  const l = I.calibrazioni || [];
  return l.length ? l[l.length - 1].fattori : {};
}

// energia: kWh letti sulla presa con contatore in un periodo contro quelli simulati negli stessi giorni
function confrontoEnergia(c, letture) {
  const s = simulaIdro(c);
  return (letture || []).filter(l => l.dal && l.al && l.kwh > 0).map(l => {
    const a = giornoAnno(l.dal), n = Math.max(1, giorniTra(l.dal, l.al));
    let sim = 0; for (let i = 0; i < n; i++) sim += s.giorni[(a + i) % 365].wh / 1000;
    return Object.assign({}, l, {simulati: sim, errore: (sim - l.kwh) / l.kwh});
  });
}
if (typeof module !== "undefined") module.exports = {previsioneCiclo, confronto, applicaCalibrazione, tornaIndietro, fattoriAttivi, confrontoEnergia, misureDaCsv, giornoAnno, erroreDopo};

// ---------- Laboratorio esperimenti: previsioni congelate prima di iniziare ----------
// La previsione si salva PRIMA della semina (con data, impronta della configurazione e intervallo P10-P90) e non si
// ricalcola più: il confronto con il raccolto usa quella. Così il modello non può "aggiustare" il passato.
// Ogni esperimento è di calibrazione o di validazione: le metriche di validazione usano solo quelli non usati per
// calibrare.
const PROTOCOLLO_MISURE = [
  ["Temperatura e umidità dell'aria", "ogni 15 minuti (sensore o termometro con memoria)"],
  ["Temperatura della soluzione", "ogni 15 minuti"],
  ["pH ed EC", "ogni giorno, penne tarate"],
  ["Livello e acqua rabboccata", "ogni giorno (litri)"],
  ["Corrente (kWh)", "ogni giorno dalla presa con contatore"],
  ["PPFD e ore di luce", "all'inizio e dopo ogni modifica"],
  ["Altezza e numero di foglie", "ogni 3-4 giorni, 3 piante segnate"],
  ["Foto dalla stessa posizione", "ogni 3-4 giorni"],
  ["Stress, alghe, malattie", "ogni giorno (note)"],
  ["Peso fresco edibile e scarto", "alla raccolta, pianta per pianta"],
  ["Varietà e lotto dei semi, piantine iniziali, piante morte, rabbocchi e modifiche alla soluzione", "nel registro"],
];
function congelaPrevisione(c, esp, n = 30) {
  const P = IDRO_PIANTE[esp.coltura], s = simulaIdro(c, {passoClima: 1}), inizio = giornoAnno(esp.semina);
  const clima = g => s.giorni[g % 365];
  const raccolta = esp.raccolta_prevista ? giorniTra(esp.semina, esp.raccolta_prevista) : null;
  const rnd = mulberry32(7 + inizio), norm = (m, sd) => m + sd * gaussDa(rnd);
  const pesi = [], durate = [];
  for (let i = 0; i < n; i++) {
    const v = i === 0 ? null : {fLue: Math.min(1.4, Math.max(0.6, norm(1, 0.15))), dT: norm(0, 1)};
    const Pv = variaPianta(P, v);
    if (P.crescita) {
      const co = coorte(Object.assign({}, Pv, {resa: 1e9}), inizio, clima, P.passo || 20);
      const fine = coorte(Pv, inizio, clima, P.passo || 20);
      const giorni = raccolta || fine.giorniDaSemina;
      pesi.push(co.curva[Math.min(co.curva.length - 1, giorni - 1)]); durate.push(fine.giorniDaSemina);
    } else { pesi.push(Pv.resa * rispostaLuce(P, s.k.dli)); durate.push(P.vivaio + P.giorni); }
  }
  const ord = l => l.slice(1).sort((a, b) => a - b), q = (l, p) => l[Math.floor(p * (l.length - 1) + 0.5)];
  const op = ord(pesi), od = ord(durate);
  const giorniKwh = raccolta || durate[0];
  let kwh = 0; for (let g = 0; g < giorniKwh; g++) kwh += s.giorni[(inizio + g) % 365].wh / 1000;
  return {data: new Date().toISOString().slice(0, 10), impronta: typeof versioneConfig === "function" ? versioneConfig(c) : "",
          peso: pesi[0], pesoP10: q(op, 0.1), pesoP90: q(op, 0.9), giorni: durate[0], giorniP10: q(od, 0.1), giorniP90: q(od, 0.9),
          kwhPeriodo: kwh, giorniRaccolta: raccolta || durate[0], modello: P.crescita ? "crescita" : "tabella"};
}
function nuovoEsperimento(c, dati) {
  const I = c.idro; I.esperimenti = I.esperimenti || [];
  const esp = Object.assign({id: "E" + (I.esperimenti.length + 1), stato: "in corso", ruolo: dati.ruolo || (I.esperimenti.filter(e => e.ruolo === "calibrazione").length <= I.esperimenti.filter(e => e.ruolo === "validazione").length ? "calibrazione" : "validazione")}, dati);
  esp.previsione = congelaPrevisione(c, esp);
  I.esperimenti.push(esp);
  return esp;
}
function concludiEsperimento(esp, raccolta, peso_g, piante_raccolte, kwh) {
  // la previsione congelata non si tocca
  Object.assign(esp, {stato: "concluso", raccolta, peso_g, piante_raccolte, kwh_misurati: kwh});
  return esp;
}
function metriche(errori) {
  const n = errori.length; if (!n) return null;
  const mae = errori.reduce((a, e) => a + Math.abs(e), 0) / n, rmse = Math.sqrt(errori.reduce((a, e) => a + e * e, 0) / n), bias = errori.reduce((a, e) => a + e, 0) / n;
  return {n, mae, rmse, bias};
}
function valutaEsperimenti(I) {
  const conclusi = (I.esperimenti || []).filter(e => e.stato === "concluso" && e.peso_g > 0 && e.piante_raccolte > 0);
  const righe = conclusi.map(e => { const vero = e.peso_g / e.piante_raccolte, p = e.previsione;
    return {id: e.id, coltura: e.coltura, ruolo: e.ruolo, vero, previsto: p.peso, p10: p.pesoP10, p90: p.pesoP90, dentro: vero >= p.pesoP10 && vero <= p.pesoP90,
            errore: p.peso - vero, erroreRel: (p.peso - vero) / vero, kwhPrevisti: p.kwhPeriodo, kwhMisurati: e.kwh_misurati, congelata: p.data}; });
  const per = ruolo => metriche(righe.filter(r => r.ruolo === ruolo).map(r => r.errore));
  const val = righe.filter(r => r.ruolo === "validazione");
  return {righe, calibrazione: per("calibrazione"), validazione: per("validazione"),
          copertura: val.length ? val.filter(r => r.dentro).length / val.length : null,
          giudizio: !val.length ? "Nessun esperimento di validazione concluso: l'affidabilità del modello non è ancora misurata."
            : Math.abs(per("validazione").bias) / (val.reduce((a, r) => a + r.vero, 0) / val.length) < 0.25 && val.filter(r => r.dentro).length / val.length >= 0.6
              ? "Il modello regge sui cicli di validazione: errore sistematico sotto il 25% e la maggior parte dei raccolti dentro l'intervallo previsto."
              : "Il modello sbaglia sui cicli di validazione: usa i cicli di calibrazione per correggerlo e ripeti un ciclo di validazione prima di fidarti."};
}
if (typeof module !== "undefined") Object.assign(module.exports, {congelaPrevisione, nuovoEsperimento, concludiEsperimento, valutaEsperimenti, metriche, PROTOCOLLO_MISURE});
// statistiche per la calibrazione dai soli esperimenti di calibrazione (previsioni congelate)
function statisticheEsperimenti(I) {
  const v = valutaEsperimenti(I), per = {};
  for (const r of v.righe.filter(r => r.ruolo === "calibrazione")) (per[r.coltura] = per[r.coltura] || []).push(r.vero / r.previsto);
  return Object.entries(per).map(([coltura, l]) => ({coltura, n: l.length, fattore: l.reduce((a, b) => a + b, 0) / l.length, proponibile: l.length >= MIN_CICLI_CALIBRAZIONE}));
}
if (typeof module !== "undefined") module.exports.statisticheEsperimenti = statisticheEsperimenti;
