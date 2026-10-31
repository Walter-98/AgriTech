"use strict";
// Simulazione giornaliera del gemello: un anno dell'orto con i componenti scelti.
// È il modello di pianificazione (a giorni). Il simulatore del repository (sistema/, minuto per minuto) usa la stessa
// logica dell'ESP32 per provare le sicurezze; qui si confrontano scelte, consumi e costi.

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const meseDi = d => { for (let m = 11; m >= 0; m--) if (d >= INIZIO_MESE[m]) return m; return 0; };
const gaussDa = rnd => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const opzione = (fam, k) => CATALOGO[fam].opzioni[k];

// Meteo vero di un anno (Open-Meteo o CSV di strumenti/scarica_meteo.py): 365 giorni {et0, pioggia, tmin, tmax}
function meteoDaCsv(testo) {
  const righe = testo.trim().split(/\r?\n/), testa = righe.shift().split(/[,;]/).map(x => x.trim().toLowerCase());
  const col = n => testa.findIndex(t => t.startsWith(n));
  const iE = col("et0"), iP = col("pioggia"), iMin = col("t_min"), iMax = col("t_max"), iD = col("data");
  if (iMin < 0 || iMax < 0) throw new Error("Servono le colonne t_min e t_max (e possibilmente et0_mm, pioggia_mm)");
  const giorni = righe.map(r => r.split(/[,;]/)).filter(v => v.length >= testa.length && !isNaN(parseFloat(v[iMin])))
    .map(v => ({data: iD >= 0 ? v[iD] : "", et0: iE >= 0 ? +v[iE] : null, pioggia: iP >= 0 ? +v[iP] : 0, tmin: +v[iMin], tmax: +v[iMax]}));
  return completaAnno(giorni, "file CSV");
}
function meteoDaOpenMeteo(json, luogo) {
  const d = json.daily, giorni = d.time.map((t, i) => ({data: t, et0: d.et0_fao_evapotranspiration ? d.et0_fao_evapotranspiration[i] : null,
    pioggia: d.precipitation_sum ? d.precipitation_sum[i] || 0 : 0, tmin: d.temperature_2m_min[i], tmax: d.temperature_2m_max[i]})).filter(g => g.tmin != null && g.tmax != null);
  return completaAnno(giorni, "Open-Meteo, " + luogo);
}
function completaAnno(giorni, fonte) {
  if (giorni.length < 300) throw new Error("Servono almeno 300 giorni (meglio un anno intero), trovati " + giorni.length);
  const anno = [];
  for (let d = 0; d < 365; d++) {
    const g = giorni[d % giorni.length], t = (g.tmin + g.tmax) / 2;
    // ET0 mancante: Hargreaves semplificata con la radiazione media del mese di REGIONI non disponibile → stima da temperatura
    const et0 = g.et0 != null && !isNaN(g.et0) ? g.et0 : Math.max(0.2, 0.0023 * 0.408 * 25 * (t + 17.8) * Math.sqrt(Math.max(0, g.tmax - g.tmin)) * (0.5 + 0.5 * Math.sin((d - 80) / 365 * 2 * Math.PI)));
    anno.push({et0, pioggia: g.pioggia || 0, tmin: g.tmin, tmax: g.tmax, data: g.data});
  }
  return {fonte, dal: giorni[0].data, al: giorni[giorni.length - 1].data, giorni: anno};
}

// Nucleo fisico condiviso con sistema/nucleo.py (stesse formule, stessi casi di test in test/contratti/):
// du/dt = -r·min(1, u/0,5), r = et0·kc/capacità; lineare fino a u = 0,5 poi esponenziale.
function etGiorno(u, et0, kc, cap) {
  if (cap <= 0 || et0 <= 0 || kc <= 0 || u <= 0) return {u: Math.max(u, 0), et: 0};
  const r = et0 * kc / cap;
  let fine;
  if (u >= 0.5) { const t1 = (u - 0.5) / r; fine = t1 >= 1 ? u - r : 0.5 * Math.exp(-(r / 0.5) * (1 - t1)); }
  else fine = u * Math.exp(-2 * r);
  return {u: fine, et: (u - fine) * cap};
}

function meteo(c) {
  if (c.meteoReale && c.meteoReale.giorni && c.meteoReale.giorni.length >= 365) {
    const giorni = c.meteoReale.giorni.slice(0, 365).map((g, d) => ({m: meseDi(d), et0: g.et0, pioggia: g.pioggia, nuvoloso: g.pioggia > 1, t: (g.tmin + g.tmax) / 2, tmin: g.tmin, tmax: g.tmax}));
    for (const g of (c.guasti || [])) if (g.tipo === "nubifragio" && giorni[g.giorno]) Object.assign(giorni[g.giorno], {pioggia: 90, nuvoloso: true});
    return giorni;
  }
  const R = REGIONI[c.regione], A = ANNI[c.anno];
  const rnd = mulberry32(20240 + Object.keys(REGIONI).indexOf(c.regione) * 7 + Object.keys(ANNI).indexOf(c.anno));
  const scala = A.pioggia < 1 ? 0.75 : A.pioggia > 1 ? 1.2 : 1;
  const giorni = [];
  for (let d = 0; d < 365; d++) {
    const m = meseDi(d), gs = gaussDa(rnd);
    const prob = Math.min(0.95, R.gp[m] / GIORNI_MESE[m] * scala);
    const media = R.p[m] / R.gp[m] * A.pioggia / scala;
    const piove = rnd() < prob;
    giorni.push({m, et0: Math.max(0.2, R.et0[m] * A.et * (1 + 0.15 * gs)), pioggia: piove ? -Math.log(1 - rnd()) * media : 0,
                 nuvoloso: piove, t: R.t[m] + gaussDa(rnd) * 1.5});
  }
  for (const g of (c.guasti || [])) if (g.tipo === "nubifragio" && giorni[g.giorno]) Object.assign(giorni[g.giorno], {pioggia: 90, nuvoloso: true});
  return giorni;
}

function attiva(z, d) {
  const inizio = INIZIO_MESE[z.mese - 1], durata = Math.min(365, PIANTE[z.coltura].giorni * Math.max(1, z.cicli));
  return ((d - inizio + 365) % 365) < durata;
}
function portataZona(c, z) {
  const ero = opzione("erogatori", c.componenti.erogatori);
  const sorgente = c.acqua.fonte === "cisterna" ? opzione("pompa", c.componenti.pompa).portata : 4;
  return Math.min(sorgente, z.area * ero.l_min_m2);
}
function reazione(c) {
  if (c.reazione_giorni != null && c.reazione_giorni !== "") return +c.reazione_giorni;
  return c.componenti.centrale !== "nessuna" && c.componenti.connessione !== "nessuna" ? 1 : 7;
}
function solareAttivo(c) { return c.componenti.alimentazione === "solare" && c.ambiente !== "interno"; }

// Ingressi analogici richiesti e mappa dei pin per il microcontrollore scelto
function ingressi(c) {
  const comp = c.componenti, micro = opzione("micro", comp.micro);
  const analogici = c.zone.length * comp.sensori_zona + (comp.livello === "pressione" ? 1 : 0) + (solareAttivo(c) ? 1 : 0);
  const professionale = comp.sensore_suolo === "professionale";
  const servonoAdc = professionale ? Math.max(0, analogici - c.zone.length * comp.sensori_zona) : analogici;
  const ads = servonoAdc > micro.adc ? Math.ceil((servonoAdc - micro.adc) / 4) : 0;
  return {analogici: servonoAdc, ads, micro};
}

function simula(c, opz = {}) {
  const M = opz.meteo || meteo(c), T = TERRENI[c.terreno], R = REGIONI[c.regione];
  const comp = Object.assign({}, c.componenti, opz.componenti || {}), ex = Object.assign({}, c.extra, opz.extra || {});
  const L = Object.assign({}, c.logica, opz.logica || {});
  const amb = c.ambiente;
  const cc = Object.assign({}, c, {componenti: comp, extra: ex, logica: L});
  const micro = opzione("micro", comp.micro), sens = opzione("sensore_suolo", comp.sensore_suolo);
  const ero = opzione("erogatori", comp.erogatori), valv = opzione("valvole", comp.valvole);
  const conCisterna = c.acqua.fonte === "cisterna";
  const cap = opz.capCisterna != null ? opz.capCisterna : (conCisterna ? c.acqua.cisterna_l : 0);
  const pompa = conCisterna ? opzione("pompa", comp.pompa) : null;
  const solare = solareAttivo(cc);
  const pannelloW = opz.pannello_w || comp.pannello_w;
  const batt = opzione("batteria", comp.batteria), reg = opzione("regolatore", comp.regolatore);
  const battWh = (opz.batteria_ah || comp.batteria_ah) * 12 * batt.utile;
  const reaz = reazione(cc);
  const n = c.zone.length, nSens = Math.max(1, comp.sensori_zona);
  const inter = c.interno || {};
  const areaTot = c.zone.reduce((a, z) => a + z.area, 0);
  // consumo di base (W sempre accesi)
  let baseW = (comp.sonno && solare && micro.w_sonno != null ? micro.w_sonno : micro.w) + sens.w * n * nSens;
  baseW += opzione("aria", comp.aria).w + opzione("livello", comp.livello).w + opzione("connessione", comp.connessione).w;
  for (const k in EXTRA) if (ex[k] && EXTRA[k].w) baseW += EXTRA[k].w;
  if (!solare) baseW += opzione("alimentazione", "rete").w_perdite + (micro.tensione === 24 ? 0.4 : 0);
  if (comp.sensore_suolo === "professionale") baseW += 0.1;           // convertitore RS485
  const ledWhGiorno = amb === "interno" ? (inter.led_w_m2 * areaTot + inter.ventola_w) * inter.ore_luce : 0;
  const ventolaSerraW = amb === "serra" ? 15 : 0;

  // guasti programmati
  const guasti = (c.guasti || []).map(g => Object.assign({fine: null, rilevato: null}, g));
  const zone = c.zone.map((z, i) => {
    const P = PIANTE[z.coltura];
    return {i, z, P, kc: P.kc * (z.pacciamatura ? 0.8 : 1), cap: T.cap, dren: z.rialzata ? Math.max(T.dren, 15) : T.dren,
            flusso: portataZona(cc, z), bias: 0, eta: 0, rotto: false, rottoDal: null,
            litri: 0, persi: 0, drenati: 0, stress: 0, ristagno: 0, attivi: 0, sostituzioni: 0};
  });
  let soc = battWh * 0.9, spento = false, quadroRotto = null, pompaBruciata = null, galleggiante = ex.galleggiante;
  const out = {giorni: [], mesi: Array.from({length: 12}, () => ({pioggia: 0, usata: 0, cisterna: 0, rete: 0, raccolta: 0, wh: 0})),
               litri: 0, daCisterna: 0, daRete: 0, mancata: 0, raccolta: 0, troppoPieno: 0, wh: 0, whLed: 0, giorniSpento: 0,
               giorniBatteriaBassa: 0, persi: 0, eventi: [], domanda: [], entrate: [], pompeBruciate: 0, quadriDistrutti: 0,
               minutiPompa: 0, giorniBloccoRiavvii: 0, drenati: 0, whGiorno: []};
  const evento = (d, tipo, testo) => out.eventi.push({d, tipo, testo});
  const attivo = (g, d) => d >= g.giorno && (g.fine == null || d < g.fine);
  const zonaG = (tipo, i, d) => guasti.find(g => g.tipo === tipo && g.zona === i && attivo(g, d));
  const globale = (tipo, d) => guasti.find(g => g.tipo === tipo && attivo(g, d));
  const ripara = (g, d, testo) => { if (g.rilevato == null) { g.rilevato = d; g.fine = d + reaz; evento(d, "warn", testo); } };

  // Acqua nel terreno e decisioni di irrigazione: motore minuto per minuto condiviso con sistema/ (orto_minuti.js).
  // Qui restano le cose che succedono a giorni: guasti e riparazioni, cisterna dal rubinetto, sole, quadro, costi.
  const esterno = amb === "esterno", conTimer = L.strategia === "timer";
  const giorniMondo = M.map(g => {
    const exc = g.escursione != null ? g.escursione : g.tmin != null && g.tmax != null ? g.tmax - g.tmin : 12;
    if (amb === "interno") return {et0: 0.6 + 0.018 * inter.led_w_m2 * inter.ore_luce / 16, pioggia: g.pioggia, t_media: inter.temp, escursione: 0, nuvoloso: g.nuvoloso, mese: g.m + 1};
    if (amb === "serra") return {et0: g.et0 * 1.1 + 0.3, pioggia: g.pioggia, t_media: g.t + 6, escursione: exc / 2, nuvoloso: g.nuvoloso, mese: g.m + 1};
    return {et0: g.et0, pioggia: g.pioggia, t_media: g.t, escursione: exc, nuvoloso: g.nuvoloso, mese: g.m + 1};
  });
  const galleggianteL = () => conCisterna && galleggiante ? cap * 0.05 : 0;
  const mondo = new MondoOrto(zone.map(s => ({area_m2: s.z.area, kc: s.kc, capacita_mm: s.cap, drenaggio_mm_h: s.dren, umidita: 0.6,
                                               efficienza: ero.efficienza, portata_l_min: s.flusso})), giorniMondo, {
    serbatoio_l: conCisterna ? cap * 0.8 : 1e12, capacita_serbatoio_l: conCisterna ? cap : 1e12, galleggiante_l: galleggianteL(),
    tetto_m2: conCisterna && amb !== "interno" ? c.acqua.tetto_m2 : 0, sensore_livello: conCisterna && comp.livello !== "nessuno",
    flussimetro: !!ex.flussimetro, sensore_pioggia: esterno && !!ex.pioggia, pioggia_zone: esterno,
    quadro_altezza_mm: amb === "interno" ? 1e9 : comp.quadro_cm * 10, sensore_allagamento_mm: ex.sonda_quadro && amb !== "interno" ? Math.max(5, comp.quadro_cm * 10 - 30) : null,
    // rumore di ogni lettura: il capacitivo è il riferimento di sistema/modello.py (15 punti ADC), gli altri in proporzione
    rumore_sensore: opz.rumore === 0 ? 0 : sens.rumore / 0.03 / Math.sqrt(nSens), rumore: opz.rumore === 0 ? 0 : 1, seme: 777});
  const flussoMin = Math.min(...zone.map(s => s.flusso)), verificaPompa = Math.min(8, L.max_min - 1);
  const flussoMax = Math.max(...zone.map(s => s.flusso));
  // taratura al collaudo: dopo un'irrigazione completa il sensore deve salire almeno del 40% di quanto ci si aspetta
  // con le portate vere (i valori di default di controllo.py sono per 1 L/min su 4 m²)
  const salitaAttesa = Math.min(...zone.map(s => s.flusso * L.max_min * ero.efficienza / s.z.area / s.cap)) * 0.92;
  const parCtrl = {soglia_on: L.soglia_on / 100, soglia_off: L.soglia_off / 100, soglia_critica: L.soglia_critica / 100,
                   pioggia_salta_mm: esterno ? L.pioggia_salta_mm : 1e9, max_min: L.max_min, pausa_min: L.pausa_min,
                   verifica_pompa_min: verificaPompa, calo_minimo_l: Math.min(1.0, 0.4 * flussoMin * verificaPompa), emergenza_durata_min: L.emergenza_min, blocco_gelo: !!L.blocco_gelo,
                   acqua_inattesa: L.acqua_inattesa ? 0.08 : 0, portata_nominale_l_min: flussoMax,
                   aumento_minimo: Math.min(0.02, 0.4 * salitaAttesa),
                   riserva_l: conCisterna && comp.livello !== "nessuno" && L.riserva_l > 0 ? L.riserva_l : null,
                   livello_pieno_l: conCisterna ? cap - 2 : null,
                   soglia_on_riserva: (L.soglia_on - 10) / 100, soglia_off_riserva: (L.soglia_off - 15) / 100};
  out.motore = {zone: mondo.zone.map(z => ({area_m2: z.area_m2, kc: z.kc, capacita_mm: z.capacita_mm, drenaggio_mm_h: z.drenaggio_mm_h,
                                             efficienza: z.efficienza, portata_l_min: z.portata_l_min})),
                mondo: {serbatoio_l: mondo.serbatoio, capacita_serbatoio_l: mondo.capacita, galleggiante_l: mondo.galleggiante_l, tetto_m2: mondo.tetto,
                        sensore_livello: mondo.sensore_livello, flussimetro: mondo.flussimetro, sensore_pioggia: mondo.sensore_pioggia,
                        pioggia_zone: mondo.pioggia_zone, quadro_altezza_mm: mondo.quadro_altezza, sensore_allagamento_mm: mondo.sensore_allagamento},
                parametri: parCtrl};
  const SPENTO_OUT = {pompa: false, valvole: Array(n).fill(false), umidita: Array(n).fill(null), allarmi: []};
  let ctrl = null, memoria = {}, accesoPrima = false, pompaPrima = false, riavvioFino = -1, bloccoDal = null, ultimaUscita = SPENTO_OUT;
  const BLOCCANTI = /_INEFFICACE|_PERDITA|POMPA_NON_EROGA|_ACQUA_INATTESA|RIAVVII_FREQUENTI/;

  for (let d = 0; d < 365; d++) {
    const g = M[d], m = g.m, gm = giorniMondo[d];
    const allarmi = [];
    const pioggiaAiuole = esterno ? g.pioggia : 0;
    const pioggiaTetto = amb === "interno" ? 0 : g.pioggia;
    const temp = gm.t_media;
    // cisterna: in casa si riempie a mano una volta alla settimana; fuori la riempie la pioggia (nel motore a minuti)
    let entrata = 0;
    if (conCisterna) {
      if (amb === "interno") { if (d % 7 === 0) { entrata = Math.max(0, cap - mondo.serbatoio); mondo.serbatoio += entrata; } }
      else entrata = pioggiaTetto * c.acqua.tetto_m2 * 0.8;
    }
    out.raccolta += entrata; out.mesi[m].raccolta += entrata; out.mesi[m].pioggia += pioggiaAiuole || pioggiaTetto; out.entrate.push(entrata);
    // corrente
    const blackout = globale("blackout", d);
    let acceso = !(blackout && !ex.ups && !solare);
    if (blackout && !acceso && blackout.rilevato == null) { blackout.rilevato = d; evento(d, "crit", "Blackout di " + (blackout.durata || 1) + " giorni" + (c.componenti.centrale !== "nessuna" ? ": la centrale avvisa che il nodo non risponde" : ": nessuno se ne accorge")); }
    if (blackout && blackout.fine == null) blackout.fine = blackout.giorno + (blackout.durata || 1);
    if (quadroRotto != null) { if (d >= quadroRotto) { quadroRotto = null; evento(d, "ok", "Quadro rifatto: impianto di nuovo acceso"); } else acceso = false; }
    let pompaPermessa = true;
    if (solare) {
      if (spento && soc > battWh * 0.25) spento = false;
      if (spento) acceso = false;
      if (acceso && soc < battWh * 0.35) { pompaPermessa = false; out.giorniBatteriaBassa++; }
    }
    if (!acceso) out.giorniSpento++;
    const debole = globale("alimentatore_debole", d), brownout = debole && !ex.step_down;
    if (pompaBruciata != null && d >= pompaBruciata) { pompaBruciata = null; galleggiante = true; mondo.galleggiante_l = galleggianteL(); evento(d, "ok", "Pompa nuova montata, questa volta con il galleggiante"); }
    // guasti del giorno nel mondo a minuti (dal primo minuto del giorno, tolti quando sono riparati)
    const G0 = d * 1440, gu = {};
    const metti = (nome, i) => { (gu[nome] = gu[nome] || {})[i] = G0; };
    const pg = globale("pompa_guasta", d);
    if (pg || pompaBruciata != null) gu.pompa_guasta = G0;
    const va = guasti.find(gg => gg.tipo === "valvola_aperta" && attivo(gg, d));
    if (va && zone[va.zona]) metti("valvola_bloccata_aperta", va.zona);
    for (const s of zone) {
      const on = attiva(s.z, d);
      if (on) s.attivi++;
      // sensore: età, deriva, sostituzioni
      s.eta++;
      if (comp.sostituzione_mesi > 0 && s.eta >= comp.sostituzione_mesi * 30) { s.eta = 0; s.bias = 0; s.rotto = false; s.sostituzioni += nSens; }
      s.bias -= sens.deriva;
      if (!s.rotto && s.eta > sens.vita) { s.rotto = true; s.rottoDal = d; evento(d, "warn", "Zona " + (s.i + 1) + ": sensore " + sens.nome.toLowerCase() + " a fine vita (Z" + (s.i + 1) + "_SENSORE)"); }
      if (s.rotto && d >= s.rottoDal + reaz) { s.rotto = false; s.eta = 0; s.bias = 0; s.sostituzioni += nSens; evento(d, "ok", "Zona " + (s.i + 1) + ": sensore sostituito"); }
      if (zonaG("sensore_staccato", s.i, d) || s.rotto) metti("sensore_staccato", s.i);
      if (zonaG("sensore_fuori_terra", s.i, d)) metti("sensore_fuori_terra", s.i);
      if (zonaG("tubo_rotto", s.i, d)) metti("tubo_rotto", s.i);
      const mz = mondo.zone[s.i];
      mz.kc = on ? s.kc : 0.25; mz.attiva = on; mz.bias = s.bias;
      s.oreStress = 0; s.oreRistagno = 0; s.litri0 = mz.litri; s.persi0 = mz.persi;
    }
    mondo.guasti = gu;
    // il tecnico arriva dopo i giorni di reazione e azzera i blocchi (reset manuale del controllore)
    if (bloccoDal != null && d >= bloccoDal + reaz) { if (ctrl && ctrl.reset) { ctrl.reset(); memoria = ctrl.memoria(); } bloccoDal = null; evento(d, "ok", "Riparato e sbloccato: l'impianto riprende a irrigare"); }
    // un giorno di minuti
    const usati0 = mondo.litri_usati, pompa0 = mondo.pompa_minuti, secco0 = mondo.minuti_a_secco, sommerso0 = mondo.quadro_sommerso_min;
    const visti = new Set();
    let fermaMax = 0, daRete = 0;
    for (let k = 0; k < 1440; k++) {
      const mm = G0 + k;
      const on = acceso && mm >= riavvioFino;
      if (on && !accesoPrima) {
        if (conTimer) ctrl = new ControlloreTimer(n, 420, L.timer_min);
        else { ctrl = new Controllore(n, parCtrl, memoria); ctrl.senza_stato = true; memoria = ctrl.memoria(); }
      }
      // cisterna con riserva dal rubinetto: sotto il minimo si apre l'acqua di casa e si riempie un quinto della cisterna.
      // (un rabbocco continuo mentre la pompa gira ingannerebbe la verifica sul livello: anche sull'impianto vero)
      if (conCisterna && c.acqua.rete_riserva && mondo.serbatoio < mondo.galleggiante_l + 5) { const r = cap * 0.2; mondo.serbatoio += r; daRete += r; }
      let o;
      if (on) {
        const Lt = mondo.letture(mm);
        if (solare) Lt.batteria = soc / battWh;
        if (!esterno) { Lt.pioggia_in_corso = false; Lt.pioggia_prevista_mm = 0; }
        o = ctrl.passo(Lt);
        if (ctrl.memoria_cambiata) memoria = ctrl.memoria();
        if (brownout && o.pompa && !pompaPrima) riavvioFino = mm + 2;      // la pompa parte, la tensione cede, si riavvia
      } else o = SPENTO_OUT;
      accesoPrima = on; pompaPrima = o.pompa;
      mondo.avanza(mm, o, on);
      for (const a of o.allarmi) visti.add(a);
      if (o !== SPENTO_OUT) ultimaUscita = o;
      if (k % 60 === 0) for (const s of zone) {
        const mz = mondo.zone[s.i];
        if (mz.attiva) { if (mz.acqua / mz.capacita_mm < 0.30) s.oreStress++; if (mz.superficie > 0) s.oreRistagno++; }
      }
      const lv = mondo.livello_acqua_a_terra(); if (lv > fermaMax) fermaMax = lv;
    }
    // cosa è successo oggi
    for (const a of visti) allarmi.push(a);
    if (solare && !pompaPermessa && !visti.has("BATTERIA_BASSA")) allarmi.push("BATTERIA_BASSA");
    if ([...visti].some(a => BLOCCANTI.test(a)) && bloccoDal == null) bloccoDal = d;
    if (visti.has("RIAVVII_FREQUENTI")) out.giorniBloccoRiavvii++;
    for (const gg of guasti) {
      if (!attivo(gg, d) || gg.rilevato != null) continue;
      const Z = gg.zona != null ? "Z" + (gg.zona + 1) : "";
      if (gg.tipo === "sensore_staccato" && visti.has(Z + "_SENSORE")) ripara(gg, d, Z + "_SENSORE: sensore staccato, la zona va a tempo (" + L.emergenza_min + " min al giorno)");
      else if (gg.tipo === "sensore_fuori_terra" && visti.has(Z + "_INEFFICACE")) ripara(gg, d, Z + "_INEFFICACE: sensore fuori dalla terra (legge sempre secco), zona bloccata");
      else if (gg.tipo === "tubo_rotto" && (visti.has(Z + "_INEFFICACE") || visti.has(Z + "_PERDITA"))) ripara(gg, d, Z + (visti.has(Z + "_PERDITA") ? "_PERDITA" : "_INEFFICACE") + ": tubo staccato, zona bloccata");
      else if (gg.tipo === "pompa_guasta" && (visti.has("POMPA_NON_EROGA") || [...visti].some(a => /_INEFFICACE/.test(a)))) ripara(gg, d, (visti.has("POMPA_NON_EROGA") ? "POMPA_NON_EROGA" : "Zone INEFFICACE") + ": pompa guasta, irrigazione ferma fino alla riparazione");
      else if (gg.tipo === "valvola_aperta" && visti.has(Z + "_ACQUA_INATTESA")) ripara(gg, d, Z + "_ACQUA_INATTESA: valvola bloccata aperta; si irriga solo finché la zona non è troppo bagnata");
      else if (gg.tipo === "valvola_aperta" && d - gg.giorno >= 14) { gg.rilevato = d; gg.fine = d; evento(d, "warn", "Valvola della zona " + (gg.zona + 1) + " bloccata aperta: te ne accorgi a occhio dopo due settimane"); }
      else if (gg.tipo === "alimentatore_debole" && visti.has("RIAVVII_FREQUENTI")) ripara(gg, d, "RIAVVII_FREQUENTI: il microcontrollore si riavvia quando parte la pompa; irrigazione ferma finché non sistemi l'alimentazione");
    }
    if (!galleggiante && conCisterna && mondo.minuti_a_secco > secco0 && pompaBruciata == null && pompa) {
      pompaBruciata = d + reaz; out.pompeBruciate++;
      evento(d, "crit", "Cisterna vuota senza galleggiante: la pompa gira a secco e si brucia");
    }
    // acqua del giorno
    const litriGiorno = mondo.litri_usati - usati0, minutiPompa = mondo.pompa_minuti - pompa0, minutiValvole = minutiPompa;
    if (conCisterna) { out.daCisterna += litriGiorno; out.mesi[m].cisterna += litriGiorno; out.daRete += daRete; out.mesi[m].rete += daRete; }
    else { out.daRete += litriGiorno; out.mesi[m].rete += litriGiorno; }
    const sOn = L.soglia_on / 100, sOff = L.soglia_off / 100;
    const umid = [], lette = [], acquaFerma = [], crescita = [], irrigata = [];
    zone.forEach(s => {
      const mz = mondo.zone[s.i], on = mz.attiva, u = mz.acqua / mz.capacita_mm, oggi = mz.litri - s.litri0;
      s.litri += oggi; s.persi += mz.persi - s.persi0; s.drenati = mz.sprecati; s.oggi = oggi;
      if (on) {
        s.stress += s.oreStress / 24; s.oreStressTot = (s.oreStressTot || 0) + s.oreStress; s.ristagno += s.oreRistagno;
        if (visti.has("SERBATOIO_BASSO") && u < sOn) out.mancata += (sOff - u) * s.cap * s.z.area / ero.efficienza;
      }
      umid.push(on ? u : null); lette.push(on ? ultimaUscita.umidita[s.i] : null);
      acquaFerma.push(on ? Math.min(1, mz.superficie / 30) : 0);
      const dal = (d - INIZIO_MESE[s.z.mese - 1] + 365) % 365;
      crescita.push(on ? (dal % s.P.giorni) / s.P.giorni : 0);
      irrigata.push(on && oggi > 0);
    });
    out.persi = zone.reduce((a, s) => a + s.persi, 0); out.drenati = zone.reduce((a, s) => a + s.drenati, 0);
    out.domanda.push(litriGiorno);
    const cisterna = conCisterna ? mondo.serbatoio : 0;
    if (amb !== "interno" && acceso && quadroRotto == null) {
      const acquaQuadro = mondo.quadro_sommerso_min > sommerso0;
      const infiltrazione = !opzione("quadro", comp.quadro).stagno && g.pioggia > 15;
      if (acquaQuadro || infiltrazione) {
        if (ex.sonda_quadro) allarmi.push("ALLAGAMENTO_QUADRO");
        quadroRotto = d + reaz + 2; out.quadriDistrutti++;
        evento(d, "crit", acquaQuadro ? "Nubifragio: l'acqua ferma arriva al quadro a " + comp.quadro_cm + " cm da terra. Elettronica da rifare" : "Pioggia forte: il quadro non stagno si riempie d'acqua. Elettronica da rifare");
      }
    }
    // energia
    const pompaW = conCisterna ? pompa.w : 0;
    const whAtt = minutiPompa / 60 * pompaW + minutiValvole / 60 * valv.w_aperta * (conCisterna ? 1 : 2) + (amb === "serra" && temp > 28 ? ventolaSerraW * 8 : 0);
    const whLed = acceso ? ledWhGiorno : 0;
    const wh = acceso ? baseW * 24 + whAtt + whLed : 0;
    out.whGiorno.push(wh);
    if (solare && !opz.batteriaIllimitata) {
      const prod = pannelloW * R.sole[m] * reg.resa * (g.nuvoloso ? 0.25 : 1);
      soc = Math.min(battWh, soc + prod * 0.95 - wh);
      if (soc <= 0) { soc = 0; if (!spento) evento(d, "crit", "Batteria scarica: il microcontrollore si spegne"); spento = true; }
    }
    out.minutiPompa += minutiPompa;
    out.wh += wh; out.whLed += whLed; out.mesi[m].wh += wh; out.litri += litriGiorno; out.mesi[m].usata += litriGiorno;
    if (!acceso) allarmi.push(quadroRotto != null ? "QUADRO_DA_RIFARE" : "SPENTO");
    out.giorni.push({d, umid, lette, cisterna, soc: solare ? soc / battWh : null, litri: litriGiorno, pioggia: g.pioggia,
                     acquaFerma, crescita, irrigata, acceso, pompaPermessa, temp, allarmi: [...new Set(allarmi)], minutiPompa});
  }
  out.troppoPieno = conCisterna ? mondo.troppo_pieno_l : 0;
  out.zone = zone.map(s => {
    const fattore = Math.max(0.3, 1 - 0.02 * s.stress - 0.002 * Math.max(0, s.ristagno - 24));
    const kg = s.P.resa * s.z.area * Math.max(1, s.z.cicli) * fattore * (c.ambiente === "interno" ? 0.85 : 1);
    s.stress = Math.round(s.stress * 10) / 10;       // giorni equivalenti sotto il 30% (ore / 24)
    return {litri: s.litri, persi: s.persi, drenati: s.drenati || 0, stress: s.stress, ristagno: s.ristagno, kg, valore: kg * s.P.prezzo, attivi: s.attivi,
            sostituzioni: s.sostituzioni, flusso: s.flusso, oreStress: s.oreStressTot || 0};
  });
  out.kg = out.zone.reduce((a, z) => a + z.kg, 0);
  out.valore = out.zone.reduce((a, z) => a + z.valore, 0);
  out.stress = out.zone.reduce((a, z) => a + z.stress, 0);
  out.ristagno = out.zone.reduce((a, z) => a + z.ristagno, 0);
  out.sostituzioni = out.zone.reduce((a, z) => a + z.sostituzioni, 0);
  out.kwh = out.wh / 1000;
  out.baseW = baseW;
  out.solare = solare;
  out.reazione = reaz;
  out.eventi.sort((a, b) => a.d - b.d);
  return out;
}

function costiAnnui(c, s, voci) {
  const comp = c.componenti, sens = opzione("sensore_suolo", comp.sensore_suolo);
  const prezzoSens = (sens.p[0] + sens.p[1]) / 2;
  const elettronica = voci.filter(v => v.cat === "Elettronica" || v.cat === "Corrente").reduce((a, v) => a + (v.min + v.max) / 2, 0);
  const pompa = c.acqua.fonte === "cisterna" ? opzione("pompa", comp.pompa) : null;
  const righe = [
    ["Acqua dal rubinetto", (s.daRete / 1000).toFixed(1) + " m³", s.daRete / 1000 * c.prezzi.acqua_m3],
    ["Corrente", s.kwh.toFixed(1) + " kWh" + (s.whLed ? " (luci " + (s.whLed / 1000).toFixed(0) + " kWh)" : ""), s.solare ? 0 : s.kwh * c.prezzi.kwh],
    ["Sensori sostituiti", s.sostituzioni + " pezzi", s.sostituzioni * prezzoSens],
    ["Connessione", opzione("connessione", comp.connessione).nome, opzione("connessione", comp.connessione).anno],
  ];
  if (s.solare) { const b = opzione("batteria", comp.batteria); righe.push(["Batteria (quota annua)", "dura circa " + b.anni + " anni", comp.batteria_ah * (b.euro_ah[0] + b.euro_ah[1]) / 2 / b.anni]); }
  if (s.pompeBruciate) righe.push(["Pompe bruciate", s.pompeBruciate + "", s.pompeBruciate * (pompa ? (pompa.p[0] + pompa.p[1]) / 2 : 0)]);
  if (s.quadriDistrutti) righe.push(["Elettronica allagata da rifare", s.quadriDistrutti + " volte", s.quadriDistrutti * elettronica]);
  righe.push(["Raccordi, gocciolatoi, piccoli ricambi", "", 5]);
  return {righe, totale: righe.reduce((a, r) => a + r[2], 0)};
}

// cisterna che servirebbe per non usare mai il rubinetto (picco sequenziale su due anni)
function cisternaIdeale(c, M) {
  const s = simula(Object.assign({}, c, {acqua: Object.assign({}, c.acqua, {fonte: "cisterna", rete_riserva: true})}), {meteo: M, capCisterna: 1e9});
  let k = 0, max = 0;
  for (let giro = 0; giro < 2; giro++) for (let d = 0; d < 365; d++) { k = Math.max(0, k + s.domanda[d] - s.entrate[d]); max = Math.max(max, k); }
  return {litri: max, domanda: s.domanda.reduce((a, b) => a + b, 0), entrata: s.entrate.reduce((a, b) => a + b, 0)};
}
const PANNELLI = [10, 20, 30, 50, 80, 100, 150];
const BATTERIE_AH = [7, 12, 18, 26, 40, 60, 100];
// Pannello e batteria più economici senza nessun giorno spento o con la batteria bassa.
// Una sola simulazione con batteria illimitata dà il consumo di ogni giorno: finché la batteria non scende sotto il 35%
// l'irrigazione è identica, quindi per ogni coppia basta il bilancio giornaliero della batteria (stesse formule di simula).
function solareIdeale(c, M) {
  const base = simula(c, {meteo: M, componenti: {alimentazione: "solare"}, batteriaIllimitata: true});
  if (!base.solare || base.giorniSpento > 0) return null;
  const comp = c.componenti, b = opzione("batteria", comp.batteria), reg = opzione("regolatore", comp.regolatore), R = REGIONI[c.regione];
  let migliore = null;
  for (const w of PANNELLI) for (const ah of BATTERIE_AH) {
    const battWh = ah * 12 * b.utile;
    let soc = battWh * 0.9, ok = true;
    for (let d = 0; d < 365 && ok; d++) {
      if (soc < battWh * 0.35) { ok = false; break; }
      const g = M[d];
      soc = Math.min(battWh, soc + w * R.sole[g.m] * reg.resa * (g.nuvoloso ? 0.25 : 1) * 0.95 - base.whGiorno[d]);
      if (soc <= 0) ok = false;
    }
    if (ok) {
      const costo = w * 1.15 + ah * (b.euro_ah[0] + b.euro_ah[1]) / 2;
      if (!migliore || costo < migliore.costo) migliore = {w, ah, costo};
    }
  }
  return migliore;
}

// ---------- materiali calcolati dai componenti ----------
function materiali(c) {
  const comp = c.componenti, ex = c.extra, n = c.zone.length, amb = c.ambiente;
  const cist = c.acqua.fonte === "cisterna", sol = solareAttivo(c);
  const areaTot = c.zone.reduce((a, z) => a + z.area, 0);
  const micro = opzione("micro", comp.micro), sens = opzione("sensore_suolo", comp.sensore_suolo);
  const ing = ingressi(c), valv = opzione("valvole", comp.valvole), ero = opzione("erogatori", comp.erogatori);
  const voci = [];
  const add = (cat, fase, nome, q, p, perche, chiave) => { if (q > 0) voci.push({cat, fase, nome, q, min: p[0] * q, max: p[1] * q, perche, chiave}); };
  add("Elettronica", "4a", micro.nome, 1, micro.p, micro.pro + " Software: " + micro.firmware + ".", "micro");
  add("Elettronica", "4a", "Sensore " + sens.nome, n * comp.sensori_zona, sens.p, (comp.sensori_zona > 1 ? comp.sensori_zona + " per zona: la media riduce gli errori. " : "") + sens.contro, "sensore_suolo");
  if (comp.sensore_suolo === "professionale") add("Elettronica", "4b", "Convertitore RS485 (MAX485)", 1, [3, 6], "Per leggere i sensori professionali.", "sensore_suolo");
  add("Elettronica", "4a", "Convertitore ADS1115 (4 ingressi analogici)", ing.ads, EXTRA.ads1115.p, "Il " + micro.nome + " ha " + micro.adc + " ingressi analogici, ne servono " + ing.analogici + ".", "micro");
  const uscite = n + (cist ? 1 : 0) + (cist ? 0 : 1) + (amb === "interno" ? 1 : 0);
  if (comp.micro === "logo" && uscite <= 4) { /* uscite a relè già sul LOGO! */ }
  else if (valv.driver) {
    add("Elettronica", "4a", "Driver a ponte H DRV8833 (2 valvole bistabili)", Math.ceil((n + (cist ? 0 : 1)) / 2), [3, 5], "Le valvole bistabili si comandano con un impulso + / −.", "valvole");
    add("Elettronica", "4a", "Modulo relè 2 canali (pompa" + (amb === "interno" ? ", luci" : "") + ")", cist || amb === "interno" ? 1 : 0, [3, 4], "Accende la pompa.", "pompa");
  } else add("Elettronica", "4a", "Modulo relè " + (uscite <= 4 ? 4 : 8) + " canali optoisolato", 1, uscite <= 4 ? [4, 6] : [6, 9], "Accende pompa e valvole comandato dal microcontrollore (" + uscite + " uscite).", "valvole");
  add("Elettronica", "4a", "Breadboard, cavetti, morsetti", 1, [5, 8], "Prove sul tavolo e collegamenti nel quadro.");
  add("Elettronica", "4b", "Pulsante reset allarmi", 1, [0.5, 1], "Sblocca gli allarmi dopo che hai riparato.");
  const aria = opzione("aria", comp.aria); add("Elettronica", "4b", "Sensore aria " + aria.nome, comp.aria !== "nessuno" ? 1 : 0, aria.p, aria.pro || "", "aria");
  const liv = opzione("livello", comp.livello); add("Elettronica", "4b", "Livello " + liv.nome, cist && comp.livello !== "nessuno" ? 1 : 0, liv.p, liv.pro || "", "livello");
  if (comp.livello === "pressione" && cist) add("Elettronica", "4b", "Convertitore 4-20 mA", 1, [5, 8], "Per leggere la sonda di pressione.", "livello");
  for (const k of ["galleggiante", "flussimetro", "pioggia", "sonda_quadro", "luce", "co2", "filtro"]) {
    if (!ex[k]) continue;
    if (k === "galleggiante" && !cist) continue;
    add(k === "filtro" ? "Acqua" : "Elettronica", k === "filtro" ? "5" : "4b", EXTRA[k].nome, 1, EXTRA[k].p, EXTRA[k].spiega, k);
  }
  // corrente
  if (!sol) add("Corrente", "4b", micro.tensione === 24 ? "Alimentatore 24 V 2,5 A da guida DIN" : "Alimentatore 12 V " + (cist && opzione("pompa", comp.pompa).w > 20 ? "5 A" : "3 A"), 1, micro.tensione === 24 ? [25, 40] : [8, 14], "Dalla presa a bassa tensione, con margine sulla pompa.", "alimentazione");
  add("Corrente", "4b", "Step-down 12→5 V", micro.tensione === 24 ? 0 : 1, [1, 2], "Alimenta il microcontrollore.", "alimentazione");
  if (ex.step_down) add("Corrente", "4b", EXTRA.step_down.nome, 1, EXTRA.step_down.p, EXTRA.step_down.spiega, "step_down");
  if (ex.ups && !sol) add("Corrente", "4b", EXTRA.ups.nome, 1, EXTRA.ups.p, EXTRA.ups.spiega, "ups");
  add("Corrente", "5", "Portafusibile, fusibile, diodi 1N4007", 1, [2, 3], "Protegge da cortocircuiti; i diodi proteggono i relè.");
  if (sol) {
    const b = opzione("batteria", comp.batteria), r = opzione("regolatore", comp.regolatore);
    add("Corrente", "5", "Pannello solare " + comp.pannello_w + " W", 1, [comp.pannello_w * 0.9 + 5, comp.pannello_w * 1.4 + 8], "Il gemello calcola se basta tutto l'anno.", "alimentazione");
    add("Corrente", "5", "Batteria " + b.nome + " " + comp.batteria_ah + " Ah", 1, [comp.batteria_ah * b.euro_ah[0] + 5, comp.batteria_ah * b.euro_ah[1] + 8], b.pro + " " + b.contro, "batteria");
    add("Corrente", "5", "Regolatore " + r.nome, 1, r.p, r.nome.startsWith("MPPT") ? "Ricava dal pannello circa il 20% in più del PWM." : "Semplice ed economico.", "regolatore");
    add("Struttura", "5", "Staffa inclinata per il pannello", 1, [5, 15], "Esposto a sud, inclinato 30-35°.");
  }
  // connessione e centrale
  const con = opzione("connessione", comp.connessione); add("Elettronica", "6", "Modulo " + con.nome, con.p[1] > 0 ? 1 : 0, con.p, con.pro || "", "connessione");
  const cen = opzione("centrale", comp.centrale); add("Elettronica", "6", "Centrale: " + cen.nome, comp.centrale !== "nessuna" ? 1 : 0, cen.p, "Raccoglie i dati, mostra il pannello, manda gli avvisi sul telefono.", "centrale");
  // acqua
  if (cist) {
    const pm = opzione("pompa", comp.pompa); add("Acqua", "5", "Pompa " + pm.nome, 1, pm.p, pm.pro + " " + pm.contro, "pompa");
    const l = c.acqua.cisterna_l;
    if (amb === "interno") add("Acqua", "5", "Tanica " + l + " L", 1, [8, 20], "Riempita a mano una volta a settimana.", "cisterna");
    else if (l <= 400) add("Acqua", "5", "Fusti alimentari 200 L", Math.ceil(l / 200), [0, 12], "Recuperati da negozi e aziende alimentari (spesso gratis).", "cisterna");
    else add("Acqua", "5", "Cisterna IBC 1000 L usata", Math.ceil(l / 1000), [30, 60], "Al riparo dal sole o coperta: niente alghe.", "cisterna");
    if (amb !== "interno") { add("Acqua", "5", "Raccordo con filtro per la grondaia", 1, [5, 15], "Porta la pioggia del tetto in cisterna senza foglie.", "cisterna");
      add("Acqua", "5", "Tubo di troppo pieno", 1, [3, 5], "Con un nubifragio la cisterna trabocca: l'acqua va portata lontano.", "cisterna"); }
  } else {
    add("Acqua", "5", "Valvola generale (stesso tipo delle valvole di zona)", 1, valv.p, "Con l'acqua di rete una valvola bloccata aperta non si ferma da sola: la generale chiude tutto.", "valvole");
    add("Acqua", "5", "Riduttore di pressione e attacco rubinetto", 1, [6, 12], "Gli erogatori lavorano a bassa pressione.");
  }
  add("Acqua", "5", "Elettrovalvola " + valv.nome, n, valv.p, valv.pro + " " + valv.contro, "valvole");
  const m = Math.ceil(areaTot * 2);
  add("Acqua", "5", ero.nome + " per " + areaTot + " m²", 1, [areaTot * 2 * ero.p_m[0], areaTot * 2 * ero.p_m[1]], ero.pro + " " + ero.contro, "erogatori");
  add("Acqua", "5", "Tubo 16 mm, raccordi, tappi, collettore", 1, [8, 15], "Collega pompa (o rubinetto), valvole e zone.");
  // struttura e ambiente
  const q = opzione("quadro", comp.quadro); add("Struttura", "5", q.nome, 1, q.p, q.stagno ? "Elettronica all'asciutto, pressacavi rivolti in basso." : "Non è stagna: con la pioggia forte entra acqua.", "quadro");
  if (comp.quadro_cm >= 30 && amb !== "interno") add("Struttura", "5", "Palo o staffa per il quadro a " + comp.quadro_cm + " cm", 1, [0, 5], "Con il quadro a terra un nubifragio distrugge l'elettronica.", "quadro");
  if (c.zone.some(z => z.pacciamatura)) add("Struttura", "5", "Pacciamatura (paglia, foglie, cartone)", 1, [0, 0], "Fino al 20% d'acqua in meno: materiale di recupero.");
  const rialzate = c.zone.filter(z => z.rialzata).length;
  if (rialzate) add("Struttura", "5", amb === "interno" ? "Cassoni in legno" : "Aiuole rialzate (assi recuperate, terra, compost)", rialzate, amb === "interno" ? [12, 25] : [0, 15], "Drenano: niente radici senza ossigeno dopo i temporali.");
  if (amb === "serra") add("Struttura", "5", "Serra a tunnel " + Math.ceil(areaTot * 1.8) + " m² con aperture", 1, [areaTot * 1.8 * 8, areaTot * 1.8 * 14], "Archi zincati e telo: niente pioggia sulle piante, stagione più lunga.", "ambiente");
  if (amb === "serra") add("Corrente", "5", "Ventola di ricambio aria 12 V", 1, [10, 18], "Sopra 28 °C esce l'aria calda.", "ambiente");
  if (amb === "interno") {
    const w = Math.round(c.interno.led_w_m2 * areaTot);
    add("Corrente", "5", "Luci LED da coltivazione " + w + " W", 1, [w * 0.5, w * 0.9], "Accese " + c.interno.ore_luce + " ore al giorno: sono la spesa più grande di corrente.", "ambiente");
    add("Corrente", "5", "Ventola " + c.interno.ventola_w + " W", 1, [12, 25], "Ricambio d'aria e foglie più robuste.", "ambiente");
  }
  // prezzi verificati dall'utente (catalogo.js): stato del prezzo su ogni voce, CAPEX ricalcolato
  return typeof applicaPrezzi === "function" ? applicaPrezzi(voci, c.prezzi_verificati) : voci;
}
const somma = (voci, k) => voci.reduce((a, v) => a + v[k], 0);

// ---------- compatibilità e consigli sui componenti ----------
function compatibilita(c) {
  const comp = c.componenti, ex = c.extra, amb = c.ambiente, n = c.zone.length;
  const micro = opzione("micro", comp.micro), ing = ingressi(c), cist = c.acqua.fonte === "cisterna";
  const r = [];
  const add = (tipo, titolo, testo, chiave) => r.push({tipo, titolo, testo, chiave});
  if (ing.ads) add("warn", "Servono " + ing.analogici + " ingressi analogici", "Il " + micro.nome + " ne ha " + micro.adc + ": aggiunto " + ing.ads + " ADS1115 alla lista della spesa.", "micro");
  if (comp.micro === "pizero") add("warn", "Raspberry Pi e blackout", "Con le mancanze di corrente la scheda SD si può rovinare: metti l'UPS o usa un ESP32 per le sicurezze.", "micro");
  if (comp.micro === "arduino") add("warn", "Arduino: logica da riscrivere", "Il firmware del repository è in MicroPython. La logica è la stessa ma va riscritta in C++.", "micro");
  if (comp.micro === "logo") add("warn", "LOGO!: 24 V e ingressi 0-10 V", "Serve un alimentatore 24 V; i sensori capacitivi danno 0-3 V (si leggono ma con poca risoluzione). Le uscite a relè sono già sul LOGO! (fino a 4).", "micro");
  if (comp.micro === "logo" && comp.connessione !== "nessuna") add("warn", "LOGO! senza Wi-Fi", "Per gli avvisi serve il modulo di rete o la centrale collegata via Ethernet.", "connessione");
  if (comp.sensore_suolo === "resistivo") add("crit", "Sensori resistivi: si corrodono", "In 2-3 mesi la lettura scivola verso 'secco' e il sistema dà sempre più acqua. Guarda la simulazione: zone allagate e sensori da cambiare.", "sensore_suolo");
  if (comp.sensore_suolo === "tensiometro") add("warn", "Tensiometri: manutenzione", "Vanno riempiti d'acqua ogni mese e non funzionano in terreno molto secco.", "sensore_suolo");
  if (cist && !ex.galleggiante) add("crit", "Cisterna senza galleggiante", "Quando la cisterna si svuota la pompa gira a secco e si brucia.", "galleggiante");
  if (!ex.step_down && cist) add("warn", "Alimentazione non separata", "Senza step-down separato e condensatore la partenza della pompa può far riavviare il microcontrollore (prova il guasto 'Alimentatore debole').", "step_down");
  if (amb !== "interno" && comp.quadro_cm < 30) add("warn", "Quadro vicino a terra", "Con un nubifragio l'acqua ferma può arrivare all'elettronica: alzalo a 50 cm (prova il guasto 'Nubifragio').", "quadro");
  if (amb === "esterno" && comp.quadro === "normale") add("crit", "Quadro non stagno all'aperto", "La prima pioggia forte lo riempie d'acqua.", "quadro");
  if (amb !== "esterno" && ex.pioggia) add("warn", "Sensore di pioggia inutile", amb === "serra" ? "In serra la pioggia non arriva sulle piante: il sensore servirebbe solo fuori." : "In casa non piove: toglilo.", "pioggia");
  if (amb === "esterno" && !ex.pioggia && c.logica.acqua_inattesa) add("warn", "Controllo 'acqua inattesa' spento", "Senza sensore di pioggia non si distingue la pioggia da una valvola bloccata aperta.", "pioggia");
  if (amb === "interno" && comp.alimentazione === "solare") add("crit", "Solare in casa", "In una stanza il pannello non prende sole: il gemello usa la presa di casa.", "alimentazione");
  if (solareAttivo(c) && comp.valvole === "solenoide") add("warn", "Valvole a solenoide col solare", "Consumano 5 W per tutto il tempo che sono aperte: le bistabili consumano solo un impulso.", "valvole");
  if (solareAttivo(c) && (comp.micro === "pizero" || comp.micro === "logo")) add("warn", micro.nome + " col solare", "Consuma " + micro.w + " W giorno e notte: servono pannello e batteria più grandi.", "micro");
  if (solareAttivo(c) && !comp.sonno && micro.w_sonno < micro.w * 0.5) add("warn", "Risparmio energetico spento", "Con il pannello conviene mettere il microcontrollore in sonno profondo tra una misura e l'altra.", "micro");
  if (comp.erogatori === "spruzzo") {
    if (amb === "esterno") add("warn", "Spruzzo all'aperto", "Circa un quarto dell'acqua si perde con vento e sole.", "erogatori");
    if (c.zone.some(z => PIANTE[z.coltura].foglie)) add("warn", "Foglie bagnate", c.zone.filter(z => PIANTE[z.coltura].foglie).map(z => PIANTE[z.coltura].nome + ": " + PIANTE[z.coltura].foglie).join(" "), "erogatori");
  }
  if (comp.connessione === "g4") add("warn", "4G", "SIM dati da pagare ogni anno (circa 12 €) e 0,8 W in più.", "connessione");
  if (comp.connessione === "nessuna" || comp.centrale === "nessuna") add("warn", "Nessun avviso sul telefono", "Te ne accorgi solo passando dall'orto: il gemello conta " + reazione(c) + " giorni prima di ogni riparazione.", "centrale");
  if (comp.micro !== "logo" && n > 4 && micro.adc + ing.ads * 4 < n) add("crit", "Troppe zone", "Ingressi insufficienti.", "micro");
  if (c.logica.max_min + c.logica.pausa_min > 720) add("warn", "Pausa molto lunga", "Con questa pausa si irriga al massimo una volta al giorno per zona.", "logica");
  if (cist && opzione("pompa", comp.pompa).portata < Math.max(...c.zone.map(z => z.area * opzione("erogatori", comp.erogatori).l_min_m2))) add("warn", "Pompa sotto dimensionata", "La zona più grande vorrebbe più acqua al minuto di quella che la pompa dà: i tempi si allungano.", "pompa");
  return r;
}

// pin del microcontrollore scelto (stessi nomi di firmware/esp32-irrigazione/config.py per l'ESP32)
function pinMappa(c) {
  const comp = c.componenti, n = c.zone.length, cist = c.acqua.fonte === "cisterna", ing = ingressi(c);
  const MAPPE = {
    esp32:   {adc: ["34", "35", "32", "36", "39", "33"], dig: ["26", "25", "27", "16", "17", "14", "13", "4", "5", "18", "19", "23", "21", "22"], i2c: "21 (SDA) / 22 (SCL)"},
    esp32s3: {adc: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], dig: ["11", "12", "13", "14", "15", "16", "17", "18", "21", "38", "39", "40", "41", "42"], i2c: "8 (SDA) / 9 (SCL)"},
    picow:   {adc: ["GP26", "GP27", "GP28"], dig: ["GP2", "GP3", "GP6", "GP7", "GP8", "GP9", "GP10", "GP11", "GP12", "GP13", "GP14", "GP15", "GP16", "GP17"], i2c: "GP4 (SDA) / GP5 (SCL)"},
    arduino: {adc: ["A0", "A1", "A2", "A3", "A4", "A5"], dig: ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"], i2c: "SDA / SCL (Qwiic)"},
    pizero:  {adc: [], dig: ["GPIO17", "GPIO27", "GPIO22", "GPIO23", "GPIO24", "GPIO25", "GPIO5", "GPIO6", "GPIO12", "GPIO13", "GPIO16", "GPIO26"], i2c: "GPIO2 (SDA) / GPIO3 (SCL)"},
    logo:    {adc: ["AI1 (I7)", "AI2 (I8)", "AI3 (I1)", "AI4 (I2)"], dig: ["Q1", "Q2", "Q3", "Q4", "I3", "I4", "I5", "I6"], i2c: "-"},
  };
  const mp = MAPPE[comp.micro];
  const adc = [...mp.adc], ads = []; for (let k = 0; k < ing.ads * 4; k++) ads.push("ADS1115 A" + (k % 4) + (ing.ads > 1 ? " (n." + (Math.floor(k / 4) + 1) + ")" : ""));
  const prendiA = () => adc.length ? adc.shift() : ads.shift() || "?";
  const dig = [...mp.dig], prendiD = () => dig.shift() || "espansione";
  const righe = [];
  if (comp.sensore_suolo === "professionale") righe.push(["Sensori di umidità (RS485)", "UART + modulo MAX485", "tutti sullo stesso bus a 2 fili, un indirizzo per sensore"]);
  else for (let i = 0; i < n; i++) for (let k = 0; k < comp.sensori_zona; k++) righe.push(["Umidità zona " + (i + 1) + (comp.sensori_zona > 1 ? " · sensore " + (k + 1) : ""), prendiA(), "uscita analogica 0-3 V"]);
  if (comp.micro === "logo") {
    if (cist) righe.push(["Pompa", prendiD(), "uscita a relè del LOGO!"]);
    for (let i = 0; i < n; i++) righe.push(["Valvola zona " + (i + 1), prendiD(), "uscita a relè"]);
  } else {
    if (cist) righe.push(["Pompa (relè)", prendiD(), "relè attivo basso"]);
    else righe.push(["Valvola generale", prendiD(), ""]);
    for (let i = 0; i < n; i++) righe.push(["Valvola zona " + (i + 1), opzione("valvole", comp.valvole).driver ? prendiD() + " + " + prendiD() : prendiD(), opzione("valvole", comp.valvole).driver ? "due pin verso il driver DRV8833" : "relè"]);
  }
  if (cist && c.extra.galleggiante) righe.push(["Galleggiante", prendiD(), "contatto verso GND"]);
  righe.push(["Pulsante reset", prendiD(), "verso GND"]);
  if (comp.aria !== "nessuno") righe.push(["Aria " + opzione("aria", comp.aria).nome, comp.aria === "dht22" ? prendiD() : mp.i2c, comp.aria === "dht22" ? "un filo dati" : "bus I²C"]);
  if (cist && comp.livello === "ultrasuoni") righe.push(["Livello a ultrasuoni TRIG / ECHO", prendiD() + " / " + prendiD(), "ECHO con partitore se a 5 V"]);
  if (cist && comp.livello === "pressione") righe.push(["Livello a pressione 4-20 mA", prendiA(), "con convertitore"]);
  if (c.extra.sonda_quadro) righe.push(["Acqua nel quadro", prendiD(), "due fili verso GND"]);
  if (c.extra.flussimetro) righe.push(["Flussimetro", prendiD(), "impulsi; partitore se a 5 V"]);
  if (c.extra.pioggia) righe.push(["Pioggia", prendiD(), "uscita digitale del modulo"]);
  if (c.extra.luce) righe.push(["Luce BH1750", mp.i2c, "bus I²C"]);
  if (c.extra.co2) righe.push(["CO₂ SCD40", mp.i2c, "bus I²C"]);
  if (c.ambiente === "interno") righe.push(["Luci LED (relè)", prendiD(), "accese " + c.interno.ore_luce + " ore"]);
  if (solareAttivo(c)) righe.push(["Tensione batteria", prendiA(), "partitore 40 kΩ + 10 kΩ"]);
  return righe;
}
if (typeof module !== "undefined") module.exports = {meteo, simula, materiali, compatibilita, pinMappa, costiAnnui, cisternaIdeale, solareIdeale, ingressi};
