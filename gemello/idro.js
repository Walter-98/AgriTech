"use strict";
// Idroponica in garage: dati da tecnico del settore, simulazione di un anno, materiali, compatibilità e pin.
// Valori indicativi da letteratura e pratica di coltivazione (range medi per varietà comuni): vanno confermati con le
// misure vere (penne pH ed EC, termometro, resa delle prime coltivazioni).

// ec mS/cm, ph, ppfd µmol/m²/s, dli mol/m²/giorno, ore di luce, t °C [min, max] dell'aria, ur %, passo cm tra le piante,
// giorni dal trapianto alla raccolta (+ vivaio), resa g per pianta per raccolta, acqua L/pianta/giorno a pianta grande,
// seme € per pianta (o piantina), prezzo €/kg al negozio, consumo kg per persona a settimana (stima per una famiglia
// italiana, da cambiare: oltre questo il raccolto va venduto o regalato), sistemi adatti
const IDRO_PIANTE = {
  lattuga:    {nome: "Lattuga", ec: [0.8, 1.2], ph: [5.5, 6.5], ppfd: [200, 300], dli: [12, 17], ore: 16, t: [16, 22], ur: [50, 70], passo: 20, giorni: 40, vivaio: 14, resa: 180, acqua: 0.15, seme: 0.02, prezzo: 3, consumo: 0.3, sistemi: ["nft", "torre", "dwc", "kratky"], note: "Sopra 24 °C va a seme (sale lo stelo) e diventa amara; sotto 5 °C si ferma. Bruciature ai bordi (tipburn) con poca ventilazione."},
  basilico:   {nome: "Basilico", ec: [1.0, 1.6], ph: [5.5, 6.5], ppfd: [300, 500], dli: [15, 22], ore: 16, t: [21, 27], ur: [50, 60], passo: 20, giorni: 35, vivaio: 14, resa: 90, acqua: 0.12, seme: 0.01, prezzo: 20, consumo: 0.03, sistemi: ["nft", "torre", "dwc", "kratky"], note: "Soffre il freddo sotto 15 °C (foglie nere). Si raccoglie a tagli: cima sopra il secondo nodo, ricresce in 3 settimane."},
  rucola:     {nome: "Rucola", ec: [0.8, 1.2], ph: [6.0, 6.5], ppfd: [200, 300], dli: [12, 16], ore: 14, t: [15, 21], ur: [50, 70], passo: 10, giorni: 25, vivaio: 7, resa: 40, acqua: 0.05, seme: 0.01, prezzo: 12, consumo: 0.05, sistemi: ["nft", "torre", "dwc", "kratky"], note: "Ciuffi di 4-5 semi per vasetto. Con caldo e luce lunga fiorisce presto."},
  spinacio:   {nome: "Spinacio", ec: [1.8, 2.3], ph: [6.0, 7.0], ppfd: [250, 350], dli: [12, 15], ore: 12, t: [15, 20], ur: [50, 70], passo: 15, giorni: 40, vivaio: 14, resa: 80, acqua: 0.08, seme: 0.01, prezzo: 6, consumo: 0.15, sistemi: ["nft", "torre", "dwc"], note: "Con più di 14 ore di luce o caldo va a seme: luce corta."},
  cavolo_riccio: {nome: "Cavolo riccio (kale)", ec: [1.2, 1.8], ph: [5.5, 6.5], ppfd: [300, 400], dli: [14, 18], ore: 16, t: [15, 22], ur: [50, 70], passo: 25, giorni: 45, vivaio: 14, resa: 200, acqua: 0.15, seme: 0.02, prezzo: 8, consumo: 0.1, sistemi: ["nft", "torre", "dwc"], note: "Si raccolgono le foglie basse, la pianta produce per mesi."},
  prezzemolo: {nome: "Prezzemolo", ec: [0.8, 1.8], ph: [5.5, 6.0], ppfd: [250, 400], dli: [12, 18], ore: 16, t: [16, 24], ur: [50, 70], passo: 20, giorni: 60, vivaio: 21, resa: 100, acqua: 0.08, seme: 0.01, prezzo: 12, consumo: 0.02, sistemi: ["nft", "torre", "dwc", "kratky"], note: "Germina lentamente (2-3 settimane): seme in ammollo una notte."},
  menta:      {nome: "Menta", ec: [2.0, 2.4], ph: [5.5, 6.5], ppfd: [300, 450], dli: [14, 20], ore: 16, t: [18, 24], ur: [50, 70], passo: 25, giorni: 45, vivaio: 14, resa: 120, acqua: 0.12, seme: 0.3, prezzo: 20, consumo: 0.02, sistemi: ["nft", "dwc", "torre"], note: "Da talea (radica in acqua in 10 giorni). Invadente: radici che tappano i canali."},
  fragola:    {nome: "Fragola (rifiorente)", ec: [1.2, 1.8], ph: [5.5, 6.2], ppfd: [400, 600], dli: [17, 25], ore: 14, t: [18, 24], ur: [60, 75], passo: 25, giorni: 90, vivaio: 0, resa: 150, acqua: 0.25, seme: 0.8, prezzo: 8, consumo: 0.15, sistemi: ["nft", "torre", "bucket"], note: "Da piantina (stolone). Al chiuso va impollinata: pennellino o ventola sui fiori."},
  pomodoro:   {nome: "Pomodoro ciliegino", ec: [2.0, 3.0], ph: [5.5, 6.5], ppfd: [500, 800], dli: [20, 30], ore: 16, t: [20, 26], ur: [60, 70], passo: 60, giorni: 120, vivaio: 28, resa: 3000, acqua: 1.2, seme: 0.05, prezzo: 5, consumo: 0.5, sistemi: ["bucket", "dwc"], note: "Pianta grande: secchi olandesi con perlite e spago al soffitto. Fiori da scuotere ogni giorno per l'impollinazione."},
  peperoncino: {nome: "Peperoncino", ec: [1.8, 2.4], ph: [5.8, 6.3], ppfd: [400, 600], dli: [18, 25], ore: 16, t: [22, 28], ur: [50, 70], passo: 50, giorni: 120, vivaio: 28, resa: 400, acqua: 0.6, seme: 0.05, prezzo: 15, consumo: 0.01, sistemi: ["bucket", "dwc"], note: "Ama il caldo: ideale d'estate in garage. Germina a 25-30 °C."},
  microgreens: {nome: "Microgreens (vassoi)", ec: [0, 0.6], ph: [5.5, 6.5], ppfd: [100, 250], dli: [6, 12], ore: 16, t: [18, 22], ur: [40, 60], passo: 0, giorni: 10, vivaio: 0, resa: 250, acqua: 0.25, seme: 0.75, prezzo: 30, consumo: 0.03, sistemi: ["vassoi"], note: "Per vassoio 25×50 cm: 15-30 g di seme (girasole e piselli 80-100 g), 3-4 giorni al buio, poi luce. Si vendono a ristoranti."},
};

const SISTEMI_IDRO = {
  nft:    {nome: "NFT a canali (film nutritivo)", verticale: false, descr: "Canali in PVC leggermente inclinati: un velo d'acqua scorre sulle radici e torna nel serbatoio.", pro: "Il più usato per insalate ed erbe; pulito, leggero.", contro: "Se la pompa si ferma le radici seccano in 1-2 ore: serve l'UPS.", tolleranza_ore: 2, struttura_m2: [25, 50]},
  torre:  {nome: "Torri verticali (aeroponica/NFT verticale)", verticale: true, descr: "Colonne con vasetti a spirale: l'acqua sale in cima e ricade sulle radici.", pro: "36 piante su mezzo metro quadro di pavimento.", contro: "Le luci devono stare intorno alla torre: si risparmia pavimento, non corrente. Pompa a cicli: se si ferma, radici secche in meno di un'ora.", tolleranza_ore: 1, struttura_torre: [70, 160], piante_torre: 36},
  dwc:    {nome: "DWC a zattera galleggiante", verticale: false, descr: "Vasca profonda 20-30 cm, zattera di polistirolo con i vasetti, ossigeno da una pompa d'aria.", pro: "Molto stabile: tanta acqua, regge ore senza corrente.", contro: "Pesante (80 L per m²), l'acqua si scalda d'estate.", tolleranza_ore: 12, struttura_m2: [20, 40]},
  kratky: {nome: "Kratky (passivo, senza pompe)", verticale: false, descr: "Contenitore con coperchio forato: l'acqua cala e le radici trovano aria da sole.", pro: "Il più economico, nessun consumo, ottimo per iniziare.", contro: "Solo piante a ciclo breve; niente ricircolo, l'acqua calda d'estate fa marcire le radici.", tolleranza_ore: 999, struttura_m2: [8, 20]},
  bucket: {nome: "Secchi olandesi (dutch bucket) con perlite", verticale: false, descr: "Un secchio per pianta, gocciolatoio e ritorno: per piante grandi.", pro: "Pomodori, peperoncini, fragole fino a fine ciclo.", contro: "Serve altezza (1,8-2 m) e tanta luce.", tolleranza_ore: 12, struttura_secchio: [12, 25]},
  vassoi: {nome: "Vassoi per microgreens", verticale: false, descr: "Vassoi 25×50 cm su scaffale, irrigati dal basso o con lo spruzzino.", pro: "Raccolta in 10 giorni, prezzo di vendita alto.", contro: "Tanto seme per vassoio, lavoro quotidiano.", tolleranza_ore: 24, struttura_m2: [10, 20]},
};

// Lampade: efficienza in µmol/J (quanta luce utile per watt), prezzo €/W, vita in ore fino al 70% della luce (dato dei
// costruttori, da verificare sulla scheda tecnica) e quota del prezzo da ricomprare a fine vita (i T5 cambiano solo i tubi).
// Riferimento: il DLC (DesignLights Consortium) chiede almeno 1,9 µmol/J alle lampade per orticoltura; le migliori ~2,8-3.
const LUCI_IDRO = {
  led_qb:    {nome: "LED bianco full spectrum (quantum board o barre)", eff: 2.7, euro_w: [0.7, 1.3], vita_h: 50000, quota_ricambio: 1, pro: "La più efficiente: luce bianca, vedi bene piante e malattie, scalda poco.", contro: "Costa di più all'acquisto."},
  led_tubi:  {nome: "Tubi LED T8 bianchi da negozio", eff: 2.0, euro_w: [0.4, 0.8], vita_h: 30000, quota_ricambio: 1, pro: "Economici e facili, vanno bene per microgreens, piantine e insalate.", contro: "Poca luce per piante da frutto."},
  led_viola: {nome: "LED economico rosso/blu (viola)", eff: 1.6, euro_w: [0.3, 0.6], vita_h: 25000, quota_ricambio: 1, pro: "Costa poco.", contro: "Consuma il 70% in più a parità di luce; con la luce viola non vedi le carenze."},
  t5:        {nome: "Neon T5 HO", eff: 1.1, euro_w: [0.6, 1.0], vita_h: 10000, quota_ricambio: 0.3, pro: "Luce uniforme.", contro: "Tecnologia vecchia: consuma più del doppio dei LED buoni, tubi da cambiare ogni anno."},
};
const DUREZZE = {dolce: {nome: "Dolce (< 15 °f)", ec: 0.15, ph_ml: 0.05}, media: {nome: "Media (15-30 °f)", ec: 0.4, ph_ml: 0.15}, dura: {nome: "Dura (> 30 °f)", ec: 0.7, ph_ml: 0.3}};
const NUTRIENTI = {
  polvere: {nome: "Sali in polvere (base 4-18-38 + nitrato di calcio + solfato di magnesio)", euro_l_ms: 0.007, kit: [25, 40], pro: "Il più economico: un kit fa circa 3000 L.", contro: "Si pesano e si sciolgono in due taniche madre A e B."},
  liquido: {nome: "Concime liquido A+B pronto", euro_l_ms: 0.03, kit: [20, 35], pro: "Pronto: 1-3 mL per litro di ciascuna parte.", contro: "Costa circa 4 volte la polvere."},
};
const GUASTI_IDRO = {
  blackout:      {nome: "Blackout", ore: true, spiega: "Manca la corrente per alcune ore."},
  pompa_guasta:  {nome: "Pompa ferma", spiega: "La pompa del ricircolo si blocca (radici, sporco)."},
  sonda_ph:      {nome: "Sonda pH che deriva", spiega: "La sonda legge mezzo punto in più: il dosatore mette troppo acido."},
  perdita:       {nome: "Perdita dal serbatoio", spiega: "Un raccordo perde: l'acqua finisce sul pavimento del garage."},
  lampada:       {nome: "Lampada guasta", spiega: "Si spegne un pannello LED su un piano."},
};
const ALLARMI_IDRO = [
  ["LIVELLO_BASSO", "Serbatoio sotto il minimo: pompa ferma.", "Rabbocca con acqua (e controlla l'EC dopo).", "Da solo."],
  ["PERDITA", "Acqua sul pavimento: pompe e prese spente.", "Trova la perdita; non toccare prese bagnate: stacca il salvavita.", "Pulsante reset."],
  ["FLUSSO_ASSENTE", "La pompa è accesa ma l'acqua non scorre nei canali.", "Pulisci la pompa e l'ingresso dei canali (radici).", "Pulsante reset."],
  ["PH_FUORI", "pH fuori dall'intervallo della coltura.", "Misura con la penna: se la sonda sbaglia, tarala con pH 4 e 7.", "Da solo."],
  ["EC_FUORI", "Concentrazione dei nutrienti fuori intervallo.", "EC alta: aggiungi acqua; bassa: aggiungi A e B in parti uguali.", "Da solo."],
  ["ACQUA_CALDA", "Soluzione sopra 24 °C: poco ossigeno, rischio di marciume delle radici.", "Ombreggia e isola il serbatoio, bottiglie di ghiaccio, luci di notte.", "Da solo."],
  ["CALDO / FREDDO", "Aria della tenda fuori dall'intervallo della coltura.", "Estrattore, luci di notte d'estate; stufetta con termostato d'inverno.", "Da solo."],
  ["UMIDITA_ALTA", "Umidità sopra il massimo: muffe e bruciature.", "Più ricambio d'aria, deumidificatore.", "Da solo."],
  ["LUCE_ASSENTE", "Il sensore di luce non vede luce durante l'orario: lampada o timer guasti.", "Controlla alimentatore della lampada e presa smart.", "Da solo."],
];

const IDRO_ESEMPIO = {
  sistema: "nft", disposizione: "scaffale", piani: 3, superficie_piano: 0.72, torri: 2, secchi: 6, vassoi: 0,
  colture: [{coltura: "lattuga", quota: 60}, {coltura: "basilico", quota: 25}, {coltura: "rucola", quota: 15}],
  luce: {tipo: "led_qb", ppfd: 0, ore: 0, notte: true, w_installati: 0},
  clima: {garage: "non_isolato", tenda: true, riscaldamento: "stufetta", t_min: 17, estrattore: true, circolazione: true, deumidificatore: false},
  acqua: {durezza: "media", osmosi: false, piovana: false, cambio_giorni: 21},
  nutrienti: "polvere",
  auto: {micro: "esp32", ph: true, ec: true, temp_acqua: true, aria: true, co2: false, livello: true, perdita: true, dosaggio: true,
         rabbocco: true, flusso: true, luce_sens: true, connessione: "wifi", centrale: "pc", ups: true, prese_smart: true, taratura_giorni: 30},
  produzione: {mortalita: 5, fermo_giorni: 2, scarto: 10},
  economia: {vita_anni: 5, ore_settimana: 3, euro_ora: 0, persone: 3, quota_vendita: 0, prezzo_vendita: 70},
  guasti: [],
};

// ---------- capacità e luce ----------
function capacitaIdro(c) {
  const I = c.idro, S = SISTEMI_IDRO[I.sistema];
  const quote = I.colture.reduce((a, x) => a + x.quota, 0) || 1;
  const piani = I.disposizione === "scaffale" && !S.verticale ? Math.max(1, I.piani) : 1;
  const superficie = S.verticale ? I.torri * 0.5 : I.superficie_piano * piani;
  const colture = I.colture.map(x => {
    const P = IDRO_PIANTE[x.coltura], q = x.quota / quote;
    let piante;
    if (I.sistema === "torre") piante = Math.floor(I.torri * S.piante_torre * q);
    else if (I.sistema === "bucket") piante = Math.max(1, Math.round(I.secchi * q * (x.coltura === "fragola" ? 4 : x.coltura === "peperoncino" ? 2 : 1)));
    else if (I.sistema === "vassoi") piante = Math.floor(superficie * q / 0.125);
    else piante = Math.floor(superficie * q / Math.pow(P.passo / 100, 2));
    const chioma = I.sistema === "torre" ? piante * 0.04 : I.sistema === "bucket" ? piante * Math.pow(P.passo / 100, 2) : superficie * q;
    return {coltura: x.coltura, P, quota: q, piante, chioma};
  });
  const chioma = colture.reduce((a, x) => a + x.chioma, 0);
  const ppfd = I.luce.ppfd > 0 ? I.luce.ppfd : Math.round(colture.reduce((a, x) => a + x.quota * (x.P.ppfd[0] + x.P.ppfd[1]) / 2, 0));
  const ore = I.luce.ore > 0 ? I.luce.ore : Math.round(colture.reduce((a, x) => a + x.quota * x.P.ore, 0));
  const L = LUCI_IDRO[I.luce.tipo];
  const geometria = S.verticale ? 0.55 : 0.85;           // luce che arriva davvero alle foglie
  // watt che servono per l'obiettivo e watt montati davvero: la luce che arriva alle piante viene da quelli montati
  const wRichiesti = Math.ceil(ppfd * Math.max(chioma, 0.1) / (L.eff * geometria) / 10) * 10;
  const wLuci = I.luce.w_installati > 0 ? I.luce.w_installati : wRichiesti;
  const ppfdReale = wLuci * L.eff * geometria / Math.max(chioma, 0.1);
  const footprint = S.verticale ? Math.max(0.6, I.torri * 0.5) : I.superficie_piano * (I.sistema === "bucket" ? 1.4 : 1);
  const lato = Math.max(0.8, Math.sqrt(footprint));
  const altezza = 2.0;
  const superficieTenda = 2 * (lato * lato + 2 * lato * altezza);
  const volume = (c.idro.clima.tenda ? lato * lato * altezza : 30);
  const piante = colture.reduce((a, x) => a + x.piante, 0);
  let serbatoio = {nft: Math.max(40, piante * 1.5), torre: I.torri * 60, dwc: superficie * 80, kratky: superficie * 60, bucket: Math.max(50, I.secchi * 8), vassoi: 10}[I.sistema];
  serbatoio = Math.ceil(serbatoio / 10) * 10;
  const ec = colture.reduce((a, x) => a + x.quota * (x.P.ec[0] + x.P.ec[1]) / 2, 0);
  const ph = colture.reduce((a, x) => a + x.quota * (x.P.ph[0] + x.P.ph[1]) / 2, 0);
  return {S, colture, piante, piani, superficie, chioma, ppfdObiettivo: ppfd, ppfd: Math.round(ppfdReale), ore, dli: ppfdReale * ore * 0.0036,
          dliObiettivo: ppfd * ore * 0.0036, L, geometria, wRichiesti, wLuci, footprint, lato, altezza,
          superficieTenda, volume, serbatoio, ec, ph};
}

// ---------- risposta alla luce ----------
// Modello a efficienza d'uso della luce (Monteith): sotto la saturazione la massa fresca cresce in proporzione alla luce
// del giorno (DLI). Prove su lattuga e basilico mostrano una risposta quasi lineare tra circa 6 e 17 mol/m²/giorno.
// La resa di tabella (P.resa) vale al centro dell'intervallo P.dli; sopra il massimo non cresce di più (per la lattuga
// sopra 16-17 aumenta il rischio di bruciature ai bordi). Stima euristica da calibrare con le pesate vere.
function rispostaLuce(P, dli) {
  const rif = (P.dli[0] + P.dli[1]) / 2;
  return Math.max(0, Math.min(dli, P.dli[1])) / rif;
}
function statoLuce(P, dli) {
  return {dli, min: P.dli[0], max: P.dli[1], fattore: rispostaLuce(P, dli), stato: dli < P.dli[0] * 0.95 ? "poca" : dli > P.dli[1] * 1.05 ? "troppa" : "giusta"};
}

// ---------- simulazione di un anno ----------
function simulaIdro(c, opz = {}) {
  const I = Object.assign({}, c.idro, opz.idro || {}), cc = Object.assign({}, c, {idro: I});
  const k = capacitaIdro(cc), R = REGIONI[c.regione], A = I.auto, CL = I.clima, S = k.S;
  const rnd = mulberry32(4242);
  const D = DUREZZE[I.acqua.durezza];
  const ecBase = I.acqua.osmosi ? 0.02 : I.acqua.piovana ? (D.ec + 0.05) / 2 : D.ec;
  const ecNutr = Math.max(0, k.ec - ecBase);
  const UA = CL.tenda ? 4 * k.superficieTenda : 20 * k.footprint + 40;   // W/K verso il garage
  const UAvent = CL.estrattore ? 55 : 8;                                  // ricambio d'aria quando fa caldo
  const stufaW = {nessuno: 0, tappetino: 0, stufetta: 1000}[CL.riscaldamento];
  const microW = (CATALOGO.micro.opzioni[A.micro] || CATALOGO.micro.opzioni.esp32).w;
  const sensW = 0.2 * [A.ph, A.ec, A.temp_acqua, A.aria, A.co2, A.livello, A.perdita, A.flusso, A.luce_sens].filter(Boolean).length;
  const elettronicaW = microW + sensW + (A.connessione === "g4" ? 0.8 : A.connessione === "nessuna" ? 0 : 0.15) + (A.ups ? 4 : 0) + (A.prese_smart ? 0.8 * 4 : 0) + 0.4;
  const pompaW = {nft: 10 + k.piante * 0.04, torre: I.torri * 12, dwc: 0, kratky: 0, bucket: 20, vassoi: 0}[I.sistema];
  const pompaOre = {nft: 24, torre: 12, dwc: 0, kratky: 0, bucket: 1.5, vassoi: 0}[I.sistema];
  const ariaW = I.sistema === "dwc" ? 3 + k.superficie * 3 : I.sistema === "bucket" ? 3 : 0;
  const guasti = (I.guasti || []).map(g => Object.assign({}, g));
  const reaz = A.connessione !== "nessuna" && A.centrale !== "nessuna" ? 0.2 : 2;     // giorni per accorgersi
  const out = {giorni: [], mesi: Array.from({length: 12}, () => ({luci: 0, clima: 0, pompe: 0, elettronica: 0, acqua: 0, kg: 0, nutrienti: 0})),
               kwh: 0, kwhLuci: 0, kwhClima: 0, kwhPompe: 0, kwhElettronica: 0, acqua: 0, acquaCambi: 0, acquaScarto: 0,
               kg: 0, valore: 0, raccolti: 0, semi: 0, nutrienti: 0, phDown: 0, eventi: [], giorniCaldo: 0, giorniFreddo: 0,
               giorniAcquaCalda: 0, giorniUmido: 0, perse: 0, k, ecBase, ecNutr, UA};
  const evento = (d, tipo, testo) => out.eventi.push({d, tipo, testo});
  let perditaKgStock = 0, lampadaFino = -1, phFino = -1, pompaFino = -1;
  const PR = Object.assign({mortalita: 0, fermo_giorni: 0, scarto: 0}, I.produzione || {});
  const vive = 1 - PR.mortalita / 100, fermo = PR.fermo_giorni;
  for (let d = 0; d < 365; d++) {
    const m = meseDi(d);
    const tEst = R.t[m] + gaussDa(rnd) * 1.5;
    const tGarage = CL.garage === "isolato" ? 0.6 * tEst + 8 : tEst + 3;
    const escursione = CL.garage === "isolato" ? 1.5 : 3;
    const tGarageLuci = I.luce.notte ? tGarage - escursione : tGarage + escursione;
    const tGarageBuio = I.luce.notte ? tGarage + escursione : tGarage - escursione;
    // guasti del giorno
    let oreSenzaCorrente = 0, luceFattore = 1, phFattore = 1;
    for (const g of guasti) {
      if (g.giorno !== d) continue;
      if (g.tipo === "blackout") oreSenzaCorrente = g.ore || 4;
      if (g.tipo === "lampada") { lampadaFino = d + (A.luce_sens && reaz < 1 ? 1 : 4); evento(d, "warn", "Si spegne un pannello LED" + (A.luce_sens ? ": LUCE_ASSENTE, avviso" : ": te ne accorgi guardando le piante")); }
      if (g.tipo === "sonda_ph") {
        if (A.dosaggio && A.ph) { const giorni = Math.max(1, A.taratura_giorni - (d % A.taratura_giorni)); phFino = d + Math.min(giorni, 14); evento(d, "crit", "La sonda pH legge 0,5 in più: il dosatore aggiunge acido e il pH vero scende verso 5. Te ne accorgi alla prossima taratura o con la penna (" + Math.min(giorni, 14) + " giorni)"); }
        else evento(d, "ok", "Sonda pH che deriva: senza dosaggio automatico non succede niente (misuri tu con la penna)");
      }
      if (g.tipo === "pompa_guasta" && pompaW > 0) {
        const ore = A.flusso && reaz < 1 ? 0.5 : A.flusso ? 4 : 10;
        pompaFino = d; oreSenzaCorrente = Math.max(oreSenzaCorrente, 0);
        g.oreFerma = ore;
        evento(d, ore > S.tolleranza_ore ? "crit" : "warn", "Pompa ferma: " + (A.flusso ? "FLUSSO_ASSENTE" + (reaz < 1 ? ", avviso sul telefono" : "") : "nessun sensore di flusso") + ", intervento dopo circa " + ore + " ore");
      }
      if (g.tipo === "perdita") evento(d, A.perdita ? "warn" : "crit", A.perdita ? "PERDITA: acqua sul pavimento, il sensore spegne pompe e prese" : "Perdita senza sensore: il serbatoio si svuota sul pavimento del garage, la pompa gira a secco");
    }
    if (d < lampadaFino) luceFattore = 1 - 1 / Math.max(2, k.piani * (S.verticale ? 2 : 1));
    if (d < phFino) phFattore = 0.6;
    const blackoutEff = A.ups && oreSenzaCorrente <= 3 ? 0 : oreSenzaCorrente;
    // perdite di piante per mancanza di ricircolo
    const pg = guasti.find(g => g.tipo === "pompa_guasta" && g.giorno === d);
    const oreSecche = Math.max(blackoutEff, pg && pompaW > 0 ? pg.oreFerma : 0, guasti.some(g => g.tipo === "perdita" && g.giorno === d && !A.perdita) ? 12 : 0);
    if (oreSecche > S.tolleranza_ore && pompaW + ariaW > 0) {
      const quota = Math.min(0.8, (oreSecche - S.tolleranza_ore) / 4);
      out.perse += quota;
      evento(d, "crit", Math.round(quota * 100) + "% delle piante perse: radici rimaste senz'acqua per " + oreSecche + " ore (" + S.nome + " regge circa " + S.tolleranza_ore + " ore)");
      perditaKgStock += quota;
    } else if (blackoutEff > 0) evento(d, "warn", "Blackout di " + blackoutEff + " ore: " + S.nome + " regge (" + (S.tolleranza_ore >= 999 ? "nessuna pompa" : "fino a " + S.tolleranza_ore + " ore") + ")");
    else if (oreSenzaCorrente > 0 && A.ups) evento(d, "ok", "Blackout di " + oreSenzaCorrente + " ore coperto dall'UPS");
    // clima della tenda
    const qLuci = k.wLuci * luceFattore;
    let tLuci = tGarageLuci + qLuci / UA;
    const tMax = Math.min(...k.colture.map(x => x.P.t[1])), tMin = Math.max(...k.colture.map(x => x.P.t[0]));
    if (tLuci > tMax - 1) tLuci = Math.max(tGarageLuci, tGarageLuci + qLuci / (UA + UAvent));
    let tBuio = tGarageBuio;
    let whStufa = 0;
    const set = CL.t_min;
    if (stufaW && tBuio < set) { const p = Math.min(stufaW, UA * (set - tBuio)); whStufa += p * (24 - k.ore); tBuio += p / UA; }
    if (stufaW && tLuci < set) { const p = Math.min(stufaW, UA * (set - tLuci)); whStufa += p * k.ore; tLuci += p / UA; }
    const tAcqua = (tLuci * k.ore + tBuio * (24 - k.ore)) / 24 + (CL.riscaldamento === "tappetino" ? Math.max(0, 19 - ((tLuci * k.ore + tBuio * (24 - k.ore)) / 24)) : 0);
    const caldo = tLuci > tMax + 2, freddo = tBuio < tMin - 4;
    if (caldo) out.giorniCaldo++;
    if (freddo) out.giorniFreddo++;
    const acquaCalda = tAcqua > 24;
    if (acquaCalda) out.giorniAcquaCalda++;
    // crescita e raccolto (produzione continua a semina scaglionata)
    let kgGiorno = 0, traspirazione = 0;
    const fattoreLuce = Math.min(...k.colture.map(x => rispostaLuce(x.P, k.dli * luceFattore)));
    for (const x of k.colture) {
      let f = rispostaLuce(x.P, k.dli * luceFattore) * phFattore * (A.dosaggio ? 0.98 : 0.92) * vive;
      if (tLuci > x.P.t[1] + 2) f *= 0.5;
      if (tBuio < x.P.t[0] - 4) f *= 0.5;
      if (acquaCalda && (I.sistema === "dwc" || I.sistema === "kratky" || I.sistema === "nft")) f *= 0.8;
      f *= Math.max(0, 1 - perditaKgStock);
      const raccolte = x.piante / (x.P.giorni + fermo);
      kgGiorno += raccolte * x.P.resa / 1000 * f;
      out.raccolti += raccolte;
      out.semi += raccolte * 1.2 * x.P.seme;
      traspirazione += x.piante * x.P.acqua * 0.6 * Math.max(0.4, f) * Math.max(0.6, tLuci / 22);
    }
    perditaKgStock = Math.max(0, perditaKgStock - 1 / 30);          // le piante perse si rimpiazzano in un mese
    // l'aria ricambiata porta via l'acqua traspirata: ~4 g per m³ per 20 punti di umidità
    const urGarage = CL.garage === "isolato" ? 55 : 65;
    const ricambio = (CL.estrattore ? 3600 : CL.tenda ? 150 : 600) * 0.004;     // L/giorno per 20 punti di umidità
    const ur = Math.min(95, urGarage + 20 * traspirazione / ricambio);
    let whDeum = 0;
    if (CL.deumidificatore && ur > 65) whDeum = traspirazione / 2 * 1000;
    const urMax = k.colture.reduce((a, x) => a + x.quota * x.P.ur[1], 0);
    const umido = !CL.deumidificatore && ur > urMax + 10;
    if (umido) out.giorniUmido++;
    // acqua e nutrienti
    let acqua = traspirazione * 1.05;
    if (d % I.acqua.cambio_giorni === 0) { acqua += k.serbatoio; out.acquaCambi += k.serbatoio; }
    if (I.acqua.osmosi) out.acquaScarto += acqua * 2.5;
    const nutr = acqua * ecNutr * NUTRIENTI[I.nutrienti].euro_l_ms;
    const phd = acqua * D.ph_ml * (I.acqua.osmosi ? 0.15 : 1);
    out.nutrienti += nutr; out.phDown += phd;
    // energia del giorno (Wh)
    const oreOn = 24 - blackoutEff;
    const whLuci = qLuci * k.ore * (oreOn / 24);
    const whPompe = (pompaW * pompaOre + ariaW * 24) * (oreOn / 24);
    const whClima = whStufa + whDeum + (CL.estrattore ? 25 * (tLuci > tMax - 1 ? k.ore : 3) : 0) + (CL.circolazione ? 10 * 24 : 0);
    const whEl = elettronicaW * 24;
    const wh = whLuci + whPompe + whClima + whEl;
    out.kwh += wh / 1000; out.kwhLuci += whLuci / 1000; out.kwhClima += whClima / 1000; out.kwhPompe += whPompe / 1000; out.kwhElettronica += whEl / 1000;
    const M = out.mesi[m];
    M.luci += whLuci / 1000; M.clima += whClima / 1000; M.pompe += whPompe / 1000; M.elettronica += whEl / 1000;
    M.acqua += acqua; M.kg += kgGiorno; M.nutrienti += nutr;
    out.acqua += acqua; out.kg += kgGiorno;
    const allarmi = [];
    if (caldo) allarmi.push("CALDO"); if (freddo) allarmi.push("FREDDO"); if (acquaCalda) allarmi.push("ACQUA_CALDA"); if (umido) allarmi.push("UMIDITA_ALTA");
    if (d < phFino) allarmi.push(A.ph ? "PH_FUORI (sonda da tarare)" : "PH_FUORI"); if (d < lampadaFino) allarmi.push("LUCE_ASSENTE");
    out.giorni.push({d, tGarage, tLuci, tBuio, tAcqua, ur, kg: kgGiorno, acqua, wh, allarmi, luce: fattoreLuce, perse: perditaKgStock, blackout: blackoutEff});
  }
  // valore del raccolto: ripartito per coltura
  const pesi = k.colture.map(x => x.piante / (x.P.giorni + fermo) * x.P.resa * rispostaLuce(x.P, k.dli));
  const totPesi = pesi.reduce((a, b) => a + b, 0) || 1;
  out.perColtura = k.colture.map((x, i) => ({coltura: x.coltura, piante: x.piante, quota: x.quota, kg: out.kg * pesi[i] / totPesi, valore: out.kg * pesi[i] / totPesi * x.P.prezzo,
                                             raccolti: x.piante / (x.P.giorni + fermo) * 365, luce: statoLuce(x.P, k.dli)}));
  out.valore = out.perColtura.reduce((a, x) => a + x.valore, 0);
  out.eventi.sort((a, b) => a.d - b.d);
  return out;
}

function costiAnnuiIdro(c, s) {
  const A = c.idro.auto, kwhPrezzo = c.prezzi.kwh;
  const righe = [
    ["Corrente: luci", s.kwhLuci.toFixed(0) + " kWh", s.kwhLuci * kwhPrezzo],
    ["Corrente: riscaldamento, ventole, deumidificatore", s.kwhClima.toFixed(0) + " kWh", s.kwhClima * kwhPrezzo],
    ["Corrente: pompe e aria", s.kwhPompe.toFixed(0) + " kWh", s.kwhPompe * kwhPrezzo],
    ["Corrente: elettronica", s.kwhElettronica.toFixed(0) + " kWh", s.kwhElettronica * kwhPrezzo],
    ["Acqua", ((s.acqua + s.acquaScarto) / 1000).toFixed(1) + " m³" + (s.acquaScarto ? " (con scarto osmosi)" : ""), (s.acqua + s.acquaScarto) / 1000 * c.prezzi.acqua_m3],
    ["Nutrienti", NUTRIENTI[c.idro.nutrienti].nome.split(" (")[0], s.nutrienti],
    ["Correttore pH", s.phDown.toFixed(0) + " mL", s.phDown * 0.009],
    ["Semi e piantine", Math.round(s.raccolti * 1.2) + " pezzi", s.semi],
    ["Cubetti, spugne, vasetti", "", s.raccolti * 1.2 * 0.06],
  ];
  const k = s.k, L = k.L, oreLuci = k.ore * 365;
  const prezzoLuci = k.wLuci * (L.euro_w[0] + L.euro_w[1]) / 2;
  righe.push(["Ricambio lampade (vita " + fmtMigliaia(L.vita_h) + " ore)", Math.round(oreLuci) + " ore all'anno", prezzoLuci * L.quota_ricambio * oreLuci / L.vita_h]);
  if (["nft", "torre", "bucket"].includes(c.idro.sistema)) righe.push(["Ricambio pompa (ogni 3 anni circa)", "", 20 * (c.idro.sistema === "torre" ? c.idro.torri : 1) / 3]);
  if (A.ph) righe.push(["Sonda pH (da cambiare ogni 12-18 mesi) e soluzioni di taratura", "", 30]);
  if (A.connessione === "g4") righe.push(["SIM 4G", "", 12]);
  const E = Object.assign({ore_settimana: 0, euro_ora: 0}, c.idro.economia || {});
  if (E.euro_ora > 0) righe.push(["Lavoro", Math.round(E.ore_settimana * 52) + " ore", E.ore_settimana * 52 * E.euro_ora]);
  return {righe, totale: righe.reduce((a, r) => a + r[2], 0), ore: E.ore_settimana * 52};
}
const n1 = x => x.toFixed(1).replace(".", ",");
const fmtMigliaia = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// ---------- bilancio economico ----------
// CAPEX = materiale per partire (forbice min-max dei prezzi), OPEX = spese di ogni anno, ammortamento = CAPEX medio diviso
// per gli anni di vita. Il raccolto mangiato in casa vale quanto costerebbe al negozio (valore di sostituzione), quello
// venduto vale il prezzo di vendita: sono due cose diverse e si tengono separate. Gli scenari pessimistico e ottimistico
// sono prove di robustezza con fattori dichiarati, non probabilità.
const SCENARI_ECO = {
  pessimistico: {nome: "Pessimistico", capex: "max", resa: 0.7, energia: 1.15, prezzo: 0.8},
  centrale:     {nome: "Centrale", capex: "medio", resa: 1, energia: 1, prezzo: 1},
  ottimistico:  {nome: "Ottimistico", capex: "min", resa: 1.1, energia: 0.95, prezzo: 1},
};
function economiaIdro(c, s, voci, costi) {
  const E = Object.assign({vita_anni: 5, persone: 3, quota_vendita: 0, prezzo_vendita: 70}, c.idro.economia || {});
  const PR = Object.assign({scarto: 0}, c.idro.produzione || {});
  costi = costi || costiAnnuiIdro(c, s);
  const capex = {min: somma(voci, "min"), max: somma(voci, "max")}; capex.medio = (capex.min + capex.max) / 2;
  const perCategoria = [...new Set(voci.map(v => v.cat))].map(cat => {
    const v = voci.filter(x => x.cat === cat); return {cat, min: somma(v, "min"), max: somma(v, "max")}; });
  const energia = s.kwh * c.prezzi.kwh, altro = costi.totale - energia;
  // per coltura: prima la parte venduta, poi quello che la famiglia mangia davvero, il resto è eccedenza (regalata o buttata)
  const ripartisci = (x, resa) => {
    const P = IDRO_PIANTE[x.coltura], kgU = x.kg * resa * (1 - PR.scarto / 100);
    const venduti = kgU * E.quota_vendita / 100, casa = Math.max(0, Math.min(kgU - venduti, P.consumo * E.persone * 52));
    return {P, kgU, venduti, casa, eccedenza: kgU - venduti - casa};
  };
  const scenari = {};
  for (const [kk, sc] of Object.entries(SCENARI_ECO)) {
    let kgUtili = 0, venduti = 0, casa = 0, eccedenza = 0, sostituzione = 0, ricavo = 0;
    for (const x of s.perColtura) { const r = ripartisci(x, sc.resa);
      kgUtili += r.kgU; venduti += r.venduti; casa += r.casa; eccedenza += r.eccedenza;
      sostituzione += r.casa * r.P.prezzo * sc.prezzo; ricavo += r.venduti * r.P.prezzo * E.prezzo_vendita / 100 * sc.prezzo; }
    const opex = energia * sc.energia + altro;
    const inv = capex[sc.capex], ammortamento = inv / E.vita_anni;
    const margine = sostituzione + ricavo - opex;                    // senza ammortamento: quello che resta in tasca ogni anno
    scenari[kk] = {nome: sc.nome, kgUtili, venduti, casa, eccedenza, sostituzione, ricavo, opex, capex: inv, ammortamento, costoAnno: opex + ammortamento,
                   costoKg: kgUtili > 0 ? (opex + ammortamento) / kgUtili : Infinity, margine, utile: margine - ammortamento,
                   pareggioAnni: margine > 0 ? inv / margine : Infinity};
  }
  // coltura per coltura: spese ripartite per spazio occupato
  const C = scenari.centrale;
  const colture = s.perColtura.map(x => {
    const kgU = x.kg * (1 - PR.scarto / 100), costo = C.costoAnno * x.quota;
    return {coltura: x.coltura, kg: kgU, costoKg: kgU > 0 ? costo / kgU : Infinity, prezzo: IDRO_PIANTE[x.coltura].prezzo, conviene: kgU > 0 && costo / kgU <= IDRO_PIANTE[x.coltura].prezzo};
  });
  const motivi = [];
  if (C.margine <= 0) motivi.push("Le spese di ogni anno (" + Math.round(C.opex) + " €) superano il valore del raccolto (" + Math.round(C.sostituzione + C.ricavo) + " €): l'impianto non si ripaga mai.");
  else if (C.pareggioAnni > E.vita_anni) motivi.push("Si ripaga in " + n1(C.pareggioAnni) + " anni, più della vita dell'impianto (" + E.vita_anni + " anni).");
  if (energia > 0.5 * costi.totale) motivi.push("La corrente è il " + Math.round(energia / costi.totale * 100) + "% delle spese: conta l'efficienza delle lampade e il prezzo del kWh.");
  for (const x of colture) if (!x.conviene) motivi.push(IDRO_PIANTE[x.coltura].nome + ": costa " + (isFinite(x.costoKg) ? n1(x.costoKg) + " €/kg" : "più di quanto produce") + " contro " + x.prezzo + " €/kg al negozio.");
  if (scenari.pessimistico.margine <= 0 && C.margine > 0) motivi.push("Nello scenario pessimistico (resa -30%, corrente +15%, prezzi -20%) le spese non sono coperte: margine fragile.");
  if (C.eccedenza > 0.2 * C.kgUtili) motivi.push(n1(C.eccedenza) + " kg all'anno in più di quanto mangia una famiglia di " + E.persone + " persone: senza venderli non valgono niente (vendere richiede clienti e regole, vedi Percorso).");
  const giudizio = C.margine <= 0 || C.pareggioAnni > E.vita_anni ? "non_conviene" : scenari.pessimistico.margine <= 0 ? "fragile" : "conviene";
  return {capex, perCategoria, energia, opex: costi.totale, ore: costi.ore, scenari, colture, giudizio, motivi, vita: E.vita_anni};
}

function materialiIdro(c) {
  const I = c.idro, A = I.auto, k = capacitaIdro(c), S = k.S, CL = I.clima;
  const voci = [];
  const add = (cat, fase, nome, q, p, perche, chiave) => { if (q > 0) voci.push({cat, fase, nome, q, min: p[0] * q, max: p[1] * q, perche, chiave}); };
  // struttura
  if (CL.tenda) {
    const t = k.lato <= 0.7 ? ["60×60×160 cm", [40, 60]] : k.lato <= 0.9 ? ["80×80×180 cm", [55, 80]] : k.lato <= 1.1 ? ["100×100×200 cm", [70, 100]] : k.lato <= 1.3 ? ["120×120×200 cm", [90, 130]] : ["150×150×200 cm", [120, 170]];
    add("Struttura", "4b", "Tenda da coltivazione " + t[0] + " (interno riflettente)", 1, t[1], "Tiene caldo, luce e umidità dove servono: in garage senza tenda si scalda tutto il garage.", "tenda");
  }
  if (!S.verticale && k.piani > 1) add("Struttura", "4b", "Scaffale metallico " + k.piani + " ripiani", 1, [25, 50], "Un ripiano per livello, ognuno con la sua luce.", "scaffale");
  if (I.sistema === "torre") add("Struttura", "4b", "Torre verticale da " + S.piante_torre + " vasetti", I.torri, S.struttura_torre, S.pro + " " + S.contro, "sistema");
  else if (I.sistema === "bucket") add("Struttura", "4b", "Secchio olandese con sifone + perlite", I.secchi, S.struttura_secchio, S.pro, "sistema");
  else add("Struttura", "4b", S.nome + " per " + (k.superficie).toFixed(2) + " m²", 1, [S.struttura_m2[0] * k.superficie, S.struttura_m2[1] * k.superficie], S.pro + " " + S.contro, "sistema");
  add("Acqua", "4b", "Serbatoio " + k.serbatoio + " L scuro con coperchio", 1, k.serbatoio <= 60 ? [10, 20] : k.serbatoio <= 120 ? [20, 35] : [40, 70], "Scuro e chiuso: con la luce crescono le alghe.", "serbatoio");
  if (I.sistema === "nft" || I.sistema === "torre" || I.sistema === "bucket") add("Acqua", "4b", "Pompa sommersa " + Math.round({nft: 10 + k.piante * 0.04, torre: 12, bucket: 20}[I.sistema]) + " W", I.sistema === "torre" ? I.torri : 1, [12, 28], "Fa girare la soluzione nutritiva.", "pompa");
  if (I.sistema === "dwc" || I.sistema === "bucket") add("Acqua", "4b", "Pompa d'aria + pietre porose", 1, [15, 30], "Ossigeno alle radici: senza, marciscono.", "aria");
  // luci
  const L = k.L;
  add("Luce", "4b", L.nome + " " + k.wLuci + " W totali", 1, [k.wLuci * L.euro_w[0], k.wLuci * L.euro_w[1]], "Per " + k.ppfd + " µmol/m²/s per " + k.ore + " ore (DLI " + k.dli.toFixed(1) + "). " + L.pro, "luce");
  add("Luce", "4b", "Ganci a cricchetto per regolare l'altezza", Math.max(1, S.verticale ? I.torri : k.piani), [6, 10], "Lampade a 30-45 cm dalle foglie (LED bianchi).", "luce");
  // clima
  if (CL.estrattore) add("Clima", "4b", "Estrattore in linea 100 mm con termostato", 1, [30, 55], "Toglie caldo e umidità dalla tenda.", "clima");
  if (CL.circolazione) add("Clima", "4b", "Ventilatore a clip", 1, [10, 20], "Aria che si muove: steli robusti, niente muffe.", "clima");
  if (CL.riscaldamento === "stufetta") add("Clima", "4b", "Termoventilatore 1000 W con termostato", 1, [20, 40], "D'inverno il garage scende sotto la minima delle piante.", "clima");
  if (CL.riscaldamento === "tappetino") add("Clima", "4b", "Riscaldatore da acquario 100 W per il serbatoio", 1, [15, 25], "Scalda la soluzione (radici calde), non l'aria.", "clima");
  if (CL.deumidificatore) add("Clima", "4b", "Deumidificatore 10-12 L/giorno", 1, [120, 200], "Toglie l'acqua che le piante traspirano.", "clima");
  // acqua e nutrienti
  if (I.acqua.osmosi) add("Acqua", "4b", "Impianto a osmosi inversa", 1, [60, 120], "Acqua quasi pura: dosi precise. Scarta 2-3 litri per ogni litro buono; serve cal-mag.", "acqua");
  if (I.acqua.piovana) add("Acqua", "4b", "Tanica per acqua piovana dalla grondaia del garage", 1, [10, 25], "Acqua dolce gratis da mescolare a quella di rete.", "acqua");
  const N = NUTRIENTI[I.nutrienti];
  add("Consumabili", "4a", "Nutrienti: " + N.nome, 1, N.kit, N.pro, "nutrienti");
  add("Consumabili", "4a", "Correttore pH- (acido fosforico)", 1, [8, 10], "L'acqua di rete è quasi sempre troppo alta di pH.", "nutrienti");
  add("Consumabili", "4a", "Penne pH ed EC/TDS + soluzioni di taratura pH 4 / 7 e 1413 µS", 1, [30, 55], "Servono sempre, anche con le sonde automatiche: sono il controllo incrociato.", "strumenti");
  add("Consumabili", "4a", "Cubetti di lana di roccia o spugne (100) + vasetti a rete", 1, [12, 20], "Per far nascere e reggere le piantine.", "substrato");
  if (I.sistema === "bucket") add("Consumabili", "4a", "Perlite o argilla espansa 50 L", 1, [15, 25], "Riempie i secchi.", "substrato");
  add("Consumabili", "4a", "Semi (" + I.colture.map(x => IDRO_PIANTE[x.coltura].nome.toLowerCase()).join(", ") + ")", I.colture.length, [2, 4], "Bustine da 2-4 €: centinaia di semi. Per microgreens e fragole il costo vero è nel consumo annuo.", "semi");
  // automazione
  const micro = CATALOGO.micro.opzioni[A.micro];
  add("Automazione", "4a", micro.nome, 1, micro.p, micro.pro + " Software: " + micro.firmware + ".", "micro");
  if (A.ph) add("Automazione", "4a", "Sonda pH industriale + scheda di interfaccia", 1, [35, 60], "Sonda da tenere sempre in acqua; si tara ogni mese, si cambia ogni 12-18 mesi.", "sensori");
  if (A.ec) add("Automazione", "4a", "Sonda EC K=1 + scheda di interfaccia", 1, [45, 70], "Misura i nutrienti disciolti.", "sensori");
  if (A.temp_acqua) add("Automazione", "4a", "Sonda temperatura acqua DS18B20 impermeabile", 1, [2, 4], "Sopra 24 °C le radici soffrono.", "sensori");
  if (A.aria) add("Automazione", "4b", "Sensore aria SHT31 (temperatura e umidità)", 1, [8, 14], "Comanda estrattore, stufetta e deumidificatore.", "sensori");
  if (A.co2) add("Automazione", "4b", "Sensore CO₂ SCD40", 1, [30, 45], "Utile solo con tanta luce e tenda chiusa.", "sensori");
  if (A.livello) add("Automazione", "4b", "Due galleggianti (minimo e massimo)", 1, [4, 6], "Pompa ferma col serbatoio vuoto, rabbocco fino al massimo.", "sensori");
  if (A.perdita) add("Automazione", "4b", "Sensore di perdita a pavimento", 2, [2, 5], "In garage l'acqua sul pavimento vicino alle prese è pericolosa.", "sensori");
  if (A.flusso) add("Automazione", "4b", "Flussimetro sul ritorno", 1, [3, 6], "Sa se l'acqua scorre davvero nei canali.", "sensori");
  if (A.luce_sens) add("Automazione", "4b", "Sensore di luce BH1750", 1, [2, 4], "Controlla che le lampade si accendano.", "sensori");
  if (A.dosaggio) add("Automazione", "4b", "Pompe peristaltiche 12 V (A, B, pH-) + driver", 3, [8, 13], "Dosano da sole nutrienti e acido a piccole dosi.", "dosaggio");
  if (A.rabbocco) add("Automazione", "4b", "Elettrovalvola o pompa di rabbocco", 1, [6, 12], "Rabbocca l'acqua che le piante bevono.", "dosaggio");
  add("Automazione", "4b", "Alimentatore 12 V 3 A + step-down + modulo relè per pompe 12 V", 1, [15, 25], "Bassa tensione per pompe e dosatori.", "alimentazione");
  if (A.prese_smart) add("Automazione", "4b", "Prese smart certificate 16 A (luci, stufetta, estrattore, deumidificatore)", 4, [10, 18], "I carichi a 230 V solo con prese certificate, mai con relè fai da te.", "alimentazione");
  if (A.ups) add("Automazione", "4b", "UPS 600-800 VA", 1, [60, 95], "Tiene accese pompa ed elettronica nei blackout brevi.", "ups");
  if (A.connessione === "lora") add("Automazione", "6", "Modulo LoRa", 1, [15, 25], "", "connessione");
  if (A.connessione === "g4") add("Automazione", "6", "Modulo 4G", 1, [25, 40], "", "connessione");
  if (A.centrale === "rpi") add("Automazione", "6", "Raspberry Pi 4 come centrale", 1, [45, 65], "Dati, pannello e avvisi.", "centrale");
  add("Sicurezza", "4b", "Ciabatta con interruttore e magnetotermico, sollevata da terra", 1, [15, 30], "Mai prese e ciabatte sul pavimento vicino all'acqua; l'impianto di casa deve avere il salvavita.", "sicurezza");
  return voci;
}

function compatibilitaIdro(c) {
  const I = c.idro, A = I.auto, k = capacitaIdro(c), CL = I.clima, r = [];
  const add = (tipo, titolo, testo, chiave) => r.push({tipo, titolo, testo, chiave});
  for (const x of k.colture) if (!x.P.sistemi.includes(I.sistema)) add("crit", x.P.nome + " non adatta a " + k.S.nome, "Sistemi adatti: " + x.P.sistemi.map(s => SISTEMI_IDRO[s].nome).join(", ") + ".", "sistema");
  const ecMin = Math.max(...k.colture.map(x => x.P.ec[0])), ecMax = Math.min(...k.colture.map(x => x.P.ec[1]));
  if (k.colture.length > 1 && ecMin > ecMax) add("warn", "Colture con nutrienti diversi nello stesso serbatoio", k.colture.map(x => x.P.nome + " EC " + x.P.ec.join("-")).join(", ") + ". Si lavora a EC " + k.ec.toFixed(1) + ": meglio due serbatoi.", "colture");
  const tMin = Math.max(...k.colture.map(x => x.P.t[0])), tMax = Math.min(...k.colture.map(x => x.P.t[1]));
  if (k.colture.length > 1 && tMin > tMax) add("warn", "Temperature incompatibili", k.colture.map(x => x.P.nome + " " + x.P.t.join("-") + " °C").join(", ") + ". Idea: d'inverno le colture fresche, d'estate quelle da caldo.", "colture");
  if (k.wLuci < k.wRichiesti * 0.95) add("warn", "Lampade sotto l'obiettivo", "Montati " + k.wLuci + " W, ne servono circa " + k.wRichiesti + " per " + k.ppfdObiettivo + " µmol/m²/s: arrivano " + k.ppfd + " µmol/m²/s (DLI " + n1(k.dli) + ") e le piante crescono in proporzione meno.", "luce");
  for (const x of k.colture) { const st = statoLuce(x.P, k.dli);
    if (st.stato === "poca") add("warn", x.P.nome + ": poca luce", "DLI " + n1(k.dli) + " contro " + x.P.dli.join("-") + " mol/m²/giorno: resa circa " + Math.round(st.fattore * 100) + "% di quella di riferimento.", "luce");
    if (st.stato === "troppa") add("warn", x.P.nome + ": luce oltre il necessario", "DLI " + n1(k.dli) + " sopra " + x.P.dli[1] + ": niente resa in più, solo corrente" + (x.coltura === "lattuga" ? " e rischio di bruciature ai bordi (tipburn)" : "") + ".", "luce"); }
  if (k.L.eff < 2) add("warn", "Lampade poco efficienti", "Con LED bianchi buoni (2,7 µmol/J) la stessa luce costerebbe " + Math.round((1 - k.L.eff / 2.7) * 100) + "% di corrente in meno.", "luce");
  if (k.S.verticale) add("warn", "Verticale: si risparmia spazio, non luce", "Ogni pianta ha bisogno della stessa luce: le torri richiedono lampade intorno e più watt per pianta (luce persa nella geometria).", "sistema");
  if (k.S.tolleranza_ore <= 2 && !A.ups) add("crit", "Nessun UPS su un sistema a ricircolo", k.S.nome + ": senza pompa le radici seccano in " + k.S.tolleranza_ore + " ore. Prova il guasto 'Blackout'.", "ups");
  if (!A.perdita) add("crit", "Nessun sensore di perdita", "In garage una perdita bagna pavimento e prese: sensore a pavimento e ciabatta sollevata.", "sicurezza");
  if (!CL.tenda) add("warn", "Senza tenda", "Si scalda e si illumina tutto il garage: riscaldamento e umidità costano molto di più.", "tenda");
  if (I.acqua.durezza === "dura" && !I.acqua.osmosi) add("warn", "Acqua dura", "Parte da EC " + DUREZZE.dura.ec + ": per la lattuga resta poco spazio ai nutrienti e serve tanto pH-. Mescola acqua piovana o usa l'osmosi.", "acqua");
  if (I.acqua.osmosi) add("warn", "Osmosi: aggiungi calcio e magnesio", "L'acqua di osmosi è quasi pura: serve un cal-mag e la soluzione è meno tamponata (pH che si muove di più).", "acqua");
  if (!A.ph && !A.ec) add("warn", "Controllo manuale", "Misura pH ed EC con le penne 2-3 volte a settimana e correggi a mano: funziona, costa meno, rende un po' meno.", "sensori");
  if (A.dosaggio && (!A.ph || !A.ec)) add("crit", "Dosaggio automatico senza sonde", "I dosatori hanno bisogno delle sonde pH ed EC.", "dosaggio");
  if (A.dosaggio) add("warn", "Dosaggio automatico: taratura", "Tara la sonda pH ogni " + A.taratura_giorni + " giorni e controlla con la penna ogni settimana: una sonda sbagliata manda il pH a picco (prova il guasto 'Sonda pH che deriva').", "dosaggio");
  if (!A.prese_smart) add("crit", "Carichi a 230 V", "Luci, stufetta e deumidificatore vanno comandati da prese smart certificate, non da relè fai da te.", "alimentazione");
  if (k.colture.some(x => x.coltura === "fragola" || x.coltura === "pomodoro" || x.coltura === "peperoncino")) add("warn", "Impollinazione", "Al chiuso non ci sono insetti: scuoti i fiori o usa un pennellino ogni giorno.", "colture");
  if (k.colture.some(x => x.coltura === "spinacio") && k.ore > 14) add("warn", "Spinacio e luce lunga", "Con più di 14 ore di luce lo spinacio va a seme.", "luce");
  if (I.sistema === "vassoi") add("warn", "Microgreens", "Niente nutrienti (o EC 0,5): il costo vero è il seme. Si vendono freschi a ristoranti: trova i clienti prima.", "colture");
  if (A.co2 && k.ppfd < 600) add("warn", "CO₂ poco utile", "Con meno di 600 µmol/m²/s la CO₂ aggiunta non dà quasi niente.", "sensori");
  return r;
}

function pinMappaIdro(c) {
  const A = c.idro.auto, righe = [];
  const mappe = {esp32: {adc: ["34", "35", "32"], dig: ["26", "25", "27", "16", "17", "14", "13", "4", "5", "18", "19", "23"], i2c: "21 / 22"},
                 esp32s3: {adc: ["1", "2", "3"], dig: ["11", "12", "13", "14", "15", "16", "17", "18", "38", "39", "40", "41"], i2c: "8 / 9"},
                 picow: {adc: ["GP26", "GP27", "GP28"], dig: ["GP2", "GP3", "GP6", "GP7", "GP8", "GP9", "GP10", "GP11", "GP12", "GP13", "GP14", "GP15"], i2c: "GP4 / GP5"},
                 arduino: {adc: ["A0", "A1", "A2"], dig: ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"], i2c: "SDA / SCL"},
                 pizero: {adc: ["ADS1115 A0", "ADS1115 A1", "ADS1115 A2"], dig: ["GPIO17", "GPIO27", "GPIO22", "GPIO23", "GPIO24", "GPIO25", "GPIO5", "GPIO6", "GPIO12", "GPIO13", "GPIO16", "GPIO26"], i2c: "GPIO2 / GPIO3"},
                 logo: {adc: ["AI1", "AI2", "AI3"], dig: ["Q1", "Q2", "Q3", "Q4", "I3", "I4", "I5", "I6", "espansione", "espansione", "espansione", "espansione"], i2c: "-"}};
  const mp = mappe[A.micro] || mappe.esp32, adc = [...mp.adc], dig = [...mp.dig];
  const a = () => adc.shift() || "ADS1115", dd = () => dig.shift() || "espansione";
  if (A.ph) righe.push(["Sonda pH (scheda)", a(), "analogico, isolare la massa dall'EC"]);
  if (A.ec) righe.push(["Sonda EC (scheda)", a(), "non tenere pH ed EC accese insieme nello stesso serbatoio senza isolatore"]);
  if (A.temp_acqua) righe.push(["Temperatura acqua DS18B20", dd(), "1-Wire, resistenza 4,7 kΩ"]);
  if (A.aria) righe.push(["Aria SHT31", mp.i2c, "I²C"]);
  if (A.co2) righe.push(["CO₂ SCD40", mp.i2c, "I²C"]);
  if (A.luce_sens) righe.push(["Luce BH1750", mp.i2c, "I²C"]);
  if (A.livello) { righe.push(["Galleggiante minimo", dd(), "verso GND"]); righe.push(["Galleggiante massimo", dd(), "verso GND"]); }
  if (A.perdita) righe.push(["Sensore perdita", dd(), "verso GND"]);
  if (A.flusso) righe.push(["Flussimetro", dd(), "impulsi"]);
  if (c.idro.sistema !== "kratky" && c.idro.sistema !== "vassoi") righe.push(["Pompa 12 V (relè o MOSFET)", dd(), ""]);
  if (A.dosaggio) { righe.push(["Dosatore A", dd(), "MOSFET"]); righe.push(["Dosatore B", dd(), "MOSFET"]); righe.push(["Dosatore pH-", dd(), "MOSFET"]); }
  if (A.rabbocco) righe.push(["Rabbocco", dd(), ""]);
  if (A.prese_smart) righe.push(["Luci, estrattore, stufetta, deumidificatore", "Wi-Fi", "prese smart comandate via rete"]);
  return righe;
}
if (typeof module !== "undefined") module.exports = {simulaIdro, capacitaIdro, materialiIdro, compatibilitaIdro, pinMappaIdro, costiAnnuiIdro, economiaIdro, rispostaLuce, statoLuce};
