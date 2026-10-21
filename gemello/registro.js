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
