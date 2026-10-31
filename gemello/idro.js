"use strict";
// Idroponica in garage: dati da tecnico del settore, simulazione di un anno, materiali, compatibilità e pin.
// Valori indicativi da letteratura e pratica di coltivazione (range medi per varietà comuni): vanno confermati con le
// misure vere (penne pH ed EC, termometro, resa delle prime coltivazioni).

// ec mS/cm, ph, ppfd µmol/m²/s, dli mol/m²/giorno, ore di luce, t °C [min, max] dell'aria, ur %, passo cm tra le piante,
// giorni dal trapianto alla raccolta (+ vivaio), resa g per pianta per raccolta, acqua L/pianta/giorno a pianta grande,
// seme € per pianta (o piantina), prezzo €/kg al negozio, consumo kg per persona a settimana (stima per una famiglia
// italiana, da cambiare: oltre questo il raccolto va venduto o regalato), sistemi adatti
const IDRO_PIANTE = {
  lattuga:    {crescita: {tb: 8, to: 26, tm: 36, k: 0.9, lar: 0.075, a: 0.7, dliRif: 17, d0: 0.004, sec: 0.047,
                          rif: {giorni: 35, dli: 17, t: 22.3, passo: 20, fresco: 150, fonte: "both1995"}},
               nome: "Lattuga", ec: [0.8, 1.2], ph: [5.5, 6.5], ppfd: [200, 300], dli: [12, 17], ore: 16, t: [16, 22], ur: [50, 70], passo: 20, giorni: 40, vivaio: 14, resa: 180, acqua: 0.15, seme: 0.02, prezzo: 3, consumo: 0.3, sistemi: ["nft", "torre", "dwc", "kratky", "ebb"], note: "Sopra 24 °C va a seme (sale lo stelo) e diventa amara; sotto 5 °C si ferma. Bruciature ai bordi (tipburn) con poca ventilazione."},
  basilico:   {crescita: {tb: 8, to: 30, tm: 40, k: 0.8, lar: 0.06, a: 0.7, dliRif: 15, d0: 0.003, sec: 0.08,
                          rif: {giorni: 49, dli: 18.5, t: 25, passo: 20, fresco: 90, fonte: "tabella"}},
               nome: "Basilico", ec: [1.0, 1.6], ph: [5.5, 6.5], ppfd: [300, 500], dli: [15, 22], ore: 16, t: [21, 27], ur: [50, 60], passo: 20, giorni: 35, vivaio: 14, resa: 90, acqua: 0.12, seme: 0.01, prezzo: 20, consumo: 0.03, sistemi: ["nft", "torre", "dwc", "kratky", "ebb"], note: "Soffre il freddo sotto 15 °C (foglie nere). Si raccoglie a tagli: cima sopra il secondo nodo, ricresce in 3 settimane."},
  rucola:     {nome: "Rucola", ec: [0.8, 1.2], ph: [6.0, 6.5], ppfd: [200, 300], dli: [12, 16], ore: 14, t: [15, 21], ur: [50, 70], passo: 10, giorni: 25, vivaio: 7, resa: 40, acqua: 0.05, seme: 0.01, prezzo: 12, consumo: 0.05, sistemi: ["nft", "torre", "dwc", "kratky", "ebb"], note: "Ciuffi di 4-5 semi per vasetto. Con caldo e luce lunga fiorisce presto."},
  spinacio:   {nome: "Spinacio", ec: [1.8, 2.3], ph: [6.0, 7.0], ppfd: [250, 350], dli: [12, 15], ore: 12, t: [15, 20], ur: [50, 70], passo: 15, giorni: 40, vivaio: 14, resa: 80, acqua: 0.08, seme: 0.01, prezzo: 6, consumo: 0.15, sistemi: ["nft", "torre", "dwc", "ebb"], note: "Con più di 14 ore di luce o caldo va a seme: luce corta."},
  cavolo_riccio: {nome: "Cavolo riccio (kale)", ec: [1.2, 1.8], ph: [5.5, 6.5], ppfd: [300, 400], dli: [14, 18], ore: 16, t: [15, 22], ur: [50, 70], passo: 25, giorni: 45, vivaio: 14, resa: 200, acqua: 0.15, seme: 0.02, prezzo: 8, consumo: 0.1, sistemi: ["nft", "torre", "dwc", "ebb"], note: "Si raccolgono le foglie basse, la pianta produce per mesi."},
  prezzemolo: {nome: "Prezzemolo", ec: [0.8, 1.8], ph: [5.5, 6.0], ppfd: [250, 400], dli: [12, 18], ore: 16, t: [16, 24], ur: [50, 70], passo: 20, giorni: 60, vivaio: 21, resa: 100, acqua: 0.08, seme: 0.01, prezzo: 12, consumo: 0.02, sistemi: ["nft", "torre", "dwc", "kratky", "ebb"], note: "Germina lentamente (2-3 settimane): seme in ammollo una notte."},
  menta:      {nome: "Menta", ec: [2.0, 2.4], ph: [5.5, 6.5], ppfd: [300, 450], dli: [14, 20], ore: 16, t: [18, 24], ur: [50, 70], passo: 25, giorni: 45, vivaio: 14, resa: 120, acqua: 0.12, seme: 0.3, prezzo: 20, consumo: 0.02, sistemi: ["nft", "dwc", "torre", "ebb"], note: "Da talea (radica in acqua in 10 giorni). Invadente: radici che tappano i canali."},
  fragola:    {nome: "Fragola (rifiorente)", ec: [1.2, 1.8], ph: [5.5, 6.2], ppfd: [400, 600], dli: [17, 25], ore: 14, t: [18, 24], ur: [60, 75], passo: 25, giorni: 90, vivaio: 0, resa: 150, acqua: 0.25, seme: 0.8, prezzo: 8, consumo: 0.15, sistemi: ["nft", "torre", "bucket", "ebb", "goccia"], note: "Da piantina (stolone). Al chiuso va impollinata: pennellino o ventola sui fiori."},
  pomodoro:   {nome: "Pomodoro ciliegino", ec: [2.0, 3.0], ph: [5.5, 6.5], ppfd: [500, 800], dli: [20, 30], ore: 16, t: [20, 26], ur: [60, 70], passo: 60, giorni: 120, vivaio: 28, resa: 3000, acqua: 1.2, seme: 0.05, prezzo: 5, consumo: 0.5, sistemi: ["bucket", "dwc", "goccia"], note: "Pianta grande: secchi olandesi con perlite e spago al soffitto. Fiori da scuotere ogni giorno per l'impollinazione."},
  peperoncino: {nome: "Peperoncino", ec: [1.8, 2.4], ph: [5.8, 6.3], ppfd: [400, 600], dli: [18, 25], ore: 16, t: [22, 28], ur: [50, 70], passo: 50, giorni: 120, vivaio: 28, resa: 400, acqua: 0.6, seme: 0.05, prezzo: 15, consumo: 0.01, sistemi: ["bucket", "dwc", "ebb", "goccia"], note: "Ama il caldo: ideale d'estate in garage. Germina a 25-30 °C."},
  cetriolo:   {nome: "Cetriolo (partenocarpico)", ec: [1.7, 2.5], ph: [5.5, 6.0], ppfd: [400, 600], dli: [20, 30], ore: 16, t: [21, 28], ur: [60, 75], passo: 50, giorni: 70, vivaio: 21, resa: 3000, acqua: 1.5, seme: 0.4, prezzo: 2.5, consumo: 0.15, sistemi: ["bucket", "goccia"], note: "Varietà partenocarpiche: fanno frutti senza impollinazione. Pianta rampicante: spago al soffitto, si cimano i getti laterali. Teme l'oidio con umidità alta."},
  peperone:   {nome: "Peperone dolce", ec: [2.0, 2.5], ph: [5.8, 6.3], ppfd: [400, 700], dli: [20, 30], ore: 16, t: [21, 27], ur: [60, 70], passo: 50, giorni: 110, vivaio: 35, resa: 2000, acqua: 1.0, seme: 0.1, prezzo: 3.5, consumo: 0.2, sistemi: ["bucket", "goccia", "ebb"], note: "Lento: 5 settimane di vivaio a 25 °C. Fiori da scuotere al chiuso. Sotto 15 °C di notte i frutti si deformano."},
  microgreens: {nome: "Microgreens (vassoi)", ec: [0, 0.6], ph: [5.5, 6.5], ppfd: [100, 250], dli: [6, 12], ore: 16, t: [18, 22], ur: [40, 60], passo: 0, giorni: 10, vivaio: 0, resa: 250, acqua: 0.25, seme: 0.75, prezzo: 30, consumo: 0.03, sistemi: ["vassoi"], note: "Per vassoio 25×50 cm: 15-30 g di seme (girasole e piselli 80-100 g), 3-4 giorni al buio, poi luce. Si vendono a ristoranti."},
};

for (const P of Object.values(IDRO_PIANTE)) if (P.crescita) calibraCrescita(P);

// ---------- fonti e affidabilità dei dati ----------
// A = definizione o formula esatta, B = letteratura con parametri medi, C = manuali e pratica (da verificare),
// D = ipotesi senza fonte. Ogni riga dice a quali condizioni vale il dato.
const FONTI = {
  both1995: {testo: "Both A.J. (1995), tesi di dottorato Cornell; riassunto in Both, Ten years of hydroponic lettuce research (2003)", url: "https://www.haifa-group.com/sites/default/files/2024-03/AJBothTenYearsofHydroponicLettuceResearch2003.pdf"},
  msu_cardinali: {testo: "Michigan State University, tesi sulle temperature cardinali di lattuga, rucola e cavolo riccio (prove 8-33 °C)", url: "https://d.lib.msu.edu/etd/50442"},
  msu_tipburn: {testo: "Michigan State University, Urban Ag Series parte 2", url: "https://www.canr.msu.edu/floriculture/uploads/files/Urban-Ag-Series-Part-2.pdf"},
  iowa_basilico_luce: {testo: "Iowa State University, ASHS 2015: basilico a DLI 7 e 15", url: "https://ashs.confex.com/ashs/2015/webprogram/Paper21160.html"},
  iowa_basilico_temp: {testo: "Iowa State University (Walters, Currey): temperatura base del basilico 8,3 °C, crescita fino a circa 29-30 °C", url: "https://producegrower.com/article/hydroponic-production-primer-how-temperature-and-light-affect-basil-production"},
  walters2023: {testo: "Walters et al. (2023), PLoS ONE: temperatura ottimale del basilico 32,6-35,5 °C secondo il DLI", url: "https://doaj.org/article/18bde24b4cad47839506133a26e2bfa0"},
  ishs1337: {testo: "ISHS Acta Horticulturae 1337: basilico indoor sotto LED, crescita lineare con il DLI", url: "https://ishs.org/ishs-article/1337_22/"},
  ishs1425: {testo: "ISHS Acta Horticulturae 1425: ortaggi a foglia, 150-300 µmol/m²/s per 16 h = DLI 8,6-17,3", url: "https://ishs.org/ishs-article/1425_51/"},
  uky_led: {testo: "University of Kentucky, LED Efficacy (2022) e DLC: minimo 1,9 µmol/J", url: "https://greenhousehort.ca.uky.edu/sites/greenhousehort.ca.uky.edu/files/2022-03/LED%20Efficacy.pdf"},
  yan_hunt: {testo: "Yan W., Hunt L.A. (1999), An equation for modelling the temperature response of plants using only the cardinal temperatures, Annals of Botany 84", url: ""},
  monteith: {testo: "Monteith J.L. (1977), Climate and the efficiency of crop production in Britain, Phil. Trans. R. Soc. B 281", url: ""},
  fao56: {testo: "Allen R.G. et al. (1998), FAO Irrigation and Drainage Paper 56: pressione di vapore (formula di Tetens)", url: "https://www.fao.org/4/x0490e/x0490e00.htm"},
  manuali: {testo: "Manuali di coltivazione idroponica e pratica dei coltivatori (intervalli tipici, non legati a una prova)", url: ""},
  tabella: {testo: "Valore di tabella del gemello (resa tipica), usato come riferimento finché non ci sono pesate vere", url: ""},
};
const DATI_COLTURE = [
  // [coltura, parametro, valore, unità, fonte, condizioni, affidabilità]
  ["lattuga", "Nome scientifico", "Lactuca sativa L.", "", "manuali", "", "A"],
  ["lattuga", "Peso fresco a 35 giorni dalla semina", "150 (7 secchi)", "g/pianta", "both1995", "DLI 17, aria 24/18,8 °C giorno/notte, serra con HPS, floating", "B"],
  ["lattuga", "DLI oltre cui aumentano le bruciature ai bordi", "16-17", "mol/m²/giorno", "msu_tipburn", "secondo varietà e ventilazione", "B"],
  ["lattuga", "Temperatura base / ottimale", "8 / 26", "°C", "msu_cardinali", "varietà 'Rex' e 'Rouxaï RZ', prove 8-33 °C", "B"],
  ["lattuga", "Temperatura massima di crescita", "36", "°C", "manuali", "ipotesi: le prove arrivano a 33 °C", "D"],
  ["lattuga", "Aria consigliata per la qualità (non sale a seme)", "16-22", "°C", "manuali", "sopra 24 °C rischio di salita a seme e amaro", "C"],
  ["lattuga", "EC / pH", "0,8-1,2 / 5,5-6,5", "mS/cm / -", "manuali", "", "C"],
  ["lattuga", "Sostanza secca", "4,7", "%", "both1995", "7 g secchi su 150 g freschi", "B"],
  ["lattuga", "Germinazione", "2-7 giorni a 15-20 °C; sopra 25-28 °C può non germinare", "", "manuali", "dipende dalla varietà", "C"],
  ["lattuga", "Carenze e problemi", "bruciature ai bordi = poco calcio nelle foglie giovani (poca ventilazione); foglie vecchie gialle = poco azoto; radici marroni = acqua calda", "", "manuali", "", "C"],
  ["basilico", "Nome scientifico", "Ocimum basilicum L.", "", "manuali", "", "A"],
  ["basilico", "Aumento di massa fresca da DLI 7 a 15", "+144% / +208%", "", "iowa_basilico_luce", "basilico dolce / limone e sacro, serra", "B"],
  ["basilico", "DLI per una crescita accettabile al chiuso", "8-10 (di più rende di più)", "mol/m²/giorno", "ishs1337", "LED, piccola scala", "B"],
  ["basilico", "Temperatura base", "8,3", "°C", "iowa_basilico_temp", "per l'apertura delle foglie", "B"],
  ["basilico", "Temperatura ottimale", "30 (32,6-35,5 secondo il DLI)", "°C", "walters2023", "temperatura media del giorno, DLI 6-11", "B"],
  ["basilico", "Temperatura massima", "40", "°C", "manuali", "ipotesi: a 35 °C già cala", "D"],
  ["basilico", "Sostanza secca", "8", "%", "manuali", "", "C"],
  ["basilico", "Peso al primo taglio", "90", "g/pianta", "tabella", "da confermare con le pesate", "D"],
  ["basilico", "Carenze e problemi", "foglie nere sotto 10-12 °C; peronospora con umidità alta; foglie pallide = poco azoto o ferro (pH alto)", "", "manuali", "", "C"],
  ["cetriolo", "Nome scientifico", "Cucumis sativus L.", "", "manuali", "", "A"],
  ["cetriolo", "EC, pH, luce, temperature, resa", "vedi tabella", "", "manuali", "valori tipici di serra, da verificare", "C"],
  ["peperone", "Nome scientifico", "Capsicum annuum L.", "", "manuali", "", "A"],
  ["peperone", "EC, pH, luce, temperature, resa", "vedi tabella", "", "manuali", "valori tipici di serra, da verificare", "C"],
  ["rucola", "Temperatura base / ottimale", "6 / 23", "°C", "msu_cardinali", "rucola in coltura fuori suolo", "B"],
  ["cavolo_riccio", "Temperatura base / ottimale", "6 / 23", "°C", "msu_cardinali", "", "B"],
  ["tutte", "DLI = PPFD × ore × 0,0036", "", "mol/m²/giorno", "manuali", "definizione", "A"],
  ["tutte", "Effetto della luce: crescita proporzionale alla luce intercettata", "", "", "monteith", "", "B"],
  ["tutte", "Risposta alla temperatura: funzione beta delle temperature cardinali", "", "", "yan_hunt", "", "B"],
  ["tutte", "VPD consigliato per ortaggi a foglia", "0,8-1,2", "kPa", "manuali", "", "C"],
  ["tutte", "Pressione di vapore (VPD)", "0,6108·e^(17,27T/(T+237,3))·(1−UR)", "kPa", "fao56", "", "A"],
  ["tutte", "Efficienza minima lampade da coltivazione", "1,9", "µmol/J", "uky_led", "DLC", "A"],
];

const SISTEMI_IDRO = {
  nft:    {nome: "NFT a canali (film nutritivo)", verticale: false, descr: "Canali in PVC leggermente inclinati: un velo d'acqua scorre sulle radici e torna nel serbatoio.", pro: "Il più usato per insalate ed erbe; pulito, leggero.", contro: "Se la pompa si ferma le radici seccano in 1-2 ore: serve l'UPS.", tolleranza_ore: 2, struttura_m2: [8, 15]},
  torre:  {nome: "Torri verticali (aeroponica/NFT verticale)", verticale: true, descr: "Colonne con vasetti a spirale: l'acqua sale in cima e ricade sulle radici.", pro: "36 piante su mezzo metro quadro di pavimento.", contro: "Le luci devono stare intorno alla torre: si risparmia pavimento, non corrente. Pompa a cicli: se si ferma, radici secche in meno di un'ora.", tolleranza_ore: 1, struttura_torre: [70, 160], piante_torre: 36},
  dwc:    {nome: "DWC a zattera galleggiante", verticale: false, descr: "Vasca profonda 20-30 cm, zattera di polistirolo con i vasetti, ossigeno da una pompa d'aria.", pro: "Molto stabile: tanta acqua, regge ore senza corrente.", contro: "Pesante (80 L per m²), l'acqua si scalda d'estate.", tolleranza_ore: 12, struttura_m2: [20, 40]},
  kratky: {nome: "Kratky (passivo, senza pompe)", verticale: false, descr: "Contenitore con coperchio forato: l'acqua cala e le radici trovano aria da sole.", pro: "Il più economico, nessun consumo, ottimo per iniziare.", contro: "Solo piante a ciclo breve; niente ricircolo, l'acqua calda d'estate fa marcire le radici.", tolleranza_ore: 999, struttura_m2: [8, 20]},
  bucket: {nome: "Secchi olandesi (dutch bucket) con perlite", verticale: false, descr: "Un secchio per pianta, gocciolatoio e ritorno: per piante grandi.", pro: "Pomodori, peperoncini, fragole fino a fine ciclo.", contro: "Serve altezza (1,8-2 m) e tanta luce.", tolleranza_ore: 12, struttura_secchio: [12, 25]},
  ebb:    {nome: "Flusso e riflusso (ebb & flow)", verticale: false, descr: "Vassoio profondo 15 cm con vasetti di argilla o lana di roccia: la pompa lo allaga 15 minuti 3-4 volte al giorno, poi l'acqua torna nel serbatoio.", pro: "Semplice, va bene per quasi tutte le piante, le radici prendono aria tra un allagamento e l'altro.", contro: "Il serbatoio deve contenere tutta l'acqua di un vassoio; il substrato va lavato tra un ciclo e l'altro.", tolleranza_ore: 12, struttura_m2: [25, 45]},
  goccia: {nome: "Goccia su substrato (lastre di cocco)", verticale: false, descr: "Lastre di fibra di cocco o lana di roccia da 100 cm con 3 piante: gocciolatoi a tempo, il 20-30% d'acqua drena via (a perdere).", pro: "Il sistema delle serre professionali per pomodori, cetrioli e peperoni: robusto, regge ore senza acqua.", contro: "Consuma più acqua e nutrienti (drenaggio a perdere); serve altezza e tanta luce.", tolleranza_ore: 6, struttura_secchio: [8, 15]},
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
  sistema: "nft", disposizione: "scaffale", piani: 3, superficie_piano: 0.605, torri: 2, secchi: 6, vassoi: 0,
  struttura: {lung_cm: 110, prof_cm: 55, h_piano_cm: 40},
  colture: [{coltura: "lattuga", quota: 60}, {coltura: "basilico", quota: 25}, {coltura: "rucola", quota: 15}],
  luce: {tipo: "led_qb", ppfd: 0, ore: 0, notte: true, w_installati: 0, distanza_cm: 35},
  clima: {garage: "non_isolato", tenda: true, riscaldamento: "stufetta", t_min: 17, estrattore: true, circolazione: true, deumidificatore: false},
  acqua: {durezza: "media", osmosi: false, piovana: false, cambio_giorni: 21},
  nutrienti: "polvere",
  auto: {micro: "esp32", ph: true, ec: true, temp_acqua: true, aria: true, co2: false, livello: true, perdita: true, dosaggio: true,
         rabbocco: true, flusso: true, luce_sens: true, connessione: "wifi", centrale: "pc", ups: true, prese_smart: true, taratura_giorni: 30},
  produzione: {mortalita: 5, fermo_giorni: 2, scarto: 10},
  economia: {vita_anni: 5, ore_settimana: 3, euro_ora: 0, persone: 3, quota_vendita: 0, prezzo_vendita: 70},
  guasti: [],
};

// ---------- struttura: misure vere, tenda, locale ----------
// Tende in commercio (cm) con prezzo indicativo; si sceglie la più piccola che contiene l'impianto con 5 cm di margine.
const TENDE = [[60, 60, 160, [40, 60]], [80, 80, 180, [55, 80]], [100, 100, 200, [70, 100]], [120, 60, 180, [60, 90]], [120, 120, 200, [90, 130]],
               [150, 150, 200, [120, 170]], [240, 120, 200, [150, 220]], [300, 150, 200, [200, 290]]];
function misureImpianto(I) {
  const S = SISTEMI_IDRO[I.sistema];
  if (S.verticale) { const n = Math.max(1, I.torri); return {lung: Math.min(n, 3) * 0.5, prof: Math.ceil(n / 3) * 0.5, alt: 1.7}; }
  const st = I.struttura || {};
  const d = DIMENSIONI_PIANO[I.superficie_piano];
  let lung = st.lung_cm ? st.lung_cm / 100 : d ? d[0] / 100 : Math.sqrt(I.superficie_piano), prof = st.prof_cm ? st.prof_cm / 100 : d ? d[1] / 100 : Math.sqrt(I.superficie_piano);
  if (I.sistema === "bucket") { lung = Math.max(lung, Math.min(4, I.secchi) * 0.4); prof = Math.max(prof, Math.ceil(I.secchi / 4) * 0.45); }
  if (I.sistema === "goccia") { lung = Math.max(lung, Math.min(2, I.secchi) * 1.05); prof = Math.max(prof, Math.ceil(I.secchi / 2) * 0.5); }
  const piani = I.disposizione === "scaffale" && !["bucket", "goccia"].includes(I.sistema) ? Math.max(1, I.piani) : 1;
  const hPiano = (st.h_piano_cm || 45) / 100;
  const alt = I.sistema === "bucket" || I.sistema === "goccia" ? 1.9 : 0.5 + piani * hPiano + 0.1;       // sotto il primo ripiano il serbatoio
  return {lung, prof, alt, piani, hPiano};
}
function sceltaTenda(m) {
  const t = [...TENDE].sort((x, y) => x[0] * x[1] - y[0] * y[1]).find(([a, b, h]) => (a / 100 >= m.lung + 0.049 && b / 100 >= m.prof + 0.049 || b / 100 >= m.lung + 0.049 && a / 100 >= m.prof + 0.049) && h / 100 >= m.alt - 0.001) || TENDE[TENDE.length - 1];
  return {lung: t[0] / 100, prof: t[1] / 100, alt: t[2] / 100, nome: t[0] + "×" + t[1] + "×" + t[2] + " cm", prezzo: t[3], basta: t !== TENDE[TENDE.length - 1] || (t[0] / 100 >= m.lung + 0.1 && t[2] / 100 >= m.alt)};
}

// Posizione nel locale: impianto (o tenda) in un angolo in fondo, quadro e stufetta accanto, 60 cm liberi davanti per
// lavorare e 80 cm per passare fino alla porta. Locale in metri (lung × larg × alt), porta sul lato corto davanti.
function posizionaImpianto(c) {
  const I = c.idro, Lc = Object.assign({lung: 5, larg: 3, alt: 2.4, auto: true}, I.locale || {});
  const m = misureImpianto(I), t = I.clima.tenda ? sceltaTenda(m) : {lung: m.lung, prof: m.prof, alt: m.alt};
  const ingombro = {x: 0.1, y: 0.1, lung: t.lung, prof: t.prof};
  const quadro = {x: ingombro.x + ingombro.lung + 0.1, y: 0.05, lung: 0.6, prof: 0.25};
  const lavoro = {x: ingombro.x, y: ingombro.y + ingombro.prof, lung: Math.max(ingombro.lung, 0.8), prof: 0.6};
  const passaggio = Lc.auto ? {x: 0, y: Lc.larg - 0.8, lung: Lc.lung, prof: 0.8} : null;      // corridoio per l'auto o il passaggio
  const occupato = ingombro.prof + lavoro.prof + 0.1;
  const altezza = Math.max(t.alt || 0, m.alt);
  let motivo = "";
  if (quadro.x + quadro.lung > Lc.lung) motivo = "Lungo " + (quadro.x + quadro.lung).toFixed(1) + " m con il quadro, il locale " + Lc.lung + " m.";
  else if (occupato > Lc.larg - (passaggio ? passaggio.prof : 0)) motivo = "Profondo " + occupato.toFixed(1) + " m con lo spazio per lavorare: " + (passaggio ? "resta meno di 80 cm per passare." : "il locale è largo " + Lc.larg + " m.");
  else if (altezza > Lc.alt) motivo = "Alto " + altezza.toFixed(1) + " m, il locale " + Lc.alt + " m.";
  return {locale: Lc, ingombro, quadro, lavoro, passaggio, altezza, entra: !motivo, motivo, m2: (ingombro.lung + 0.7) * (ingombro.prof + lavoro.prof)};
}

// ---------- carichi sullo scaffale (verifica preliminare) ----------
// Pesi per ripiano: acqua (canali NFT: velo + ristagno; vasche DWC/Kratky: 20 cm; flusso e riflusso: 5 cm allagato),
// substrato bagnato, piante adulte, lampada. Confronto con la portata dichiarata dal costruttore per ripiano, se la
// conosci; senza, la verifica NON è disponibile. Ribaltamento: scaffale alto e stretto con peso in alto → fissarlo
// al muro. Non è un calcolo strutturale né una certificazione.
function caricoScaffale(c) {
  const I = c.idro, k = capacitaIdro(c), m = k.misure;
  if (k.S.verticale || I.sistema === "bucket" || I.sistema === "goccia") return null;
  const area = m.lung * m.prof, piante = k.piante / Math.max(1, k.piani);
  const acqua = {nft: idraulicaIdro(c) ? idraulicaIdro(c).canali / k.piani * m.lung * 1.0 : 0, dwc: area * 200, kratky: area * 150, ebb: area * 50, vassoi: area * 4}[I.sistema] || 0;
  const struttura = {nft: 2 * m.lung, dwc: 8 * area, kratky: 5 * area, ebb: 6 * area, vassoi: 3 * area}[I.sistema] || 0;
  const pianteKg = piante * Math.max(...k.colture.map(x => x.P.resa)) / 1000 * 1.3;
  const lampada = k.wLuci / Math.max(1, k.piani) * 0.02 + 1;
  const perPiano = acqua + struttura + pianteKg + lampada;
  const portata = (I.struttura || {}).portata_kg || null;
  const snellezza = m.alt / Math.max(0.3, m.prof);
  return {perPiano, acqua, struttura, piante: pianteKg, lampada, totale: perPiano * k.piani, portata,
          verifica: portata ? (perPiano <= portata * 0.8 ? "ok" : perPiano <= portata ? "al limite" : "no") : "non disponibile",
          ribaltamento: snellezza > 3 && k.piani > 1, snellezza};
}

// ---------- capacità e luce ----------
function capacitaIdro(c) {
  const I = c.idro, S = SISTEMI_IDRO[I.sistema];
  const quote = I.colture.reduce((a, x) => a + x.quota, 0) || 1;
  const piani = I.disposizione === "scaffale" && !S.verticale ? Math.max(1, I.piani) : 1;
  const st = I.struttura || {};
  const supPiano = st.lung_cm && st.prof_cm ? st.lung_cm * st.prof_cm / 10000 : I.superficie_piano;
  const superficie = S.verticale ? I.torri * 0.5 : supPiano * piani;
  const colture = I.colture.map(x => {
    const P = IDRO_PIANTE[x.coltura], q = x.quota / quote;
    let piante;
    if (I.sistema === "torre") piante = Math.floor(I.torri * S.piante_torre * q);
    else if (I.sistema === "bucket") piante = Math.max(1, Math.round(I.secchi * q * (x.coltura === "fragola" ? 4 : x.coltura === "peperoncino" ? 2 : 1)));
    else if (I.sistema === "goccia") piante = Math.max(1, Math.round(I.secchi * q * (x.coltura === "fragola" ? 8 : x.coltura === "peperoncino" ? 4 : 3)));
    else if (I.sistema === "vassoi") piante = Math.floor(superficie * q / 0.125);
    else piante = Math.floor(superficie * q / Math.pow(P.passo / 100, 2));
    const chioma = I.sistema === "torre" ? piante * 0.04 : (I.sistema === "bucket" || I.sistema === "goccia") ? piante * Math.pow(P.passo / 100, 2) * (I.sistema === "goccia" ? 0.6 : 1) : superficie * q;
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
  const misure = misureImpianto(I), tenda = sceltaTenda(misure);
  const footprint = c.idro.clima.tenda ? tenda.lung * tenda.prof : misure.lung * misure.prof;
  const lato = Math.sqrt(footprint);
  const altezza = c.idro.clima.tenda ? tenda.alt : 2.0;
  const superficieTenda = 2 * (tenda.lung * tenda.prof + (tenda.lung + tenda.prof) * tenda.alt);
  const volume = (c.idro.clima.tenda ? tenda.lung * tenda.prof * tenda.alt : 30);
  const piante = colture.reduce((a, x) => a + x.piante, 0);
  let serbatoio = {nft: Math.max(40, piante * 1.5), torre: I.torri * 60, dwc: superficie * 80, kratky: superficie * 60, bucket: Math.max(50, I.secchi * 8), ebb: Math.max(60, supPiano * 50 + 40), goccia: Math.max(60, I.secchi * 20), vassoi: 10}[I.sistema];
  serbatoio = Math.ceil(serbatoio / 10) * 10;
  const ec = colture.reduce((a, x) => a + x.quota * (x.P.ec[0] + x.P.ec[1]) / 2, 0);
  const ph = colture.reduce((a, x) => a + x.quota * (x.P.ph[0] + x.P.ph[1]) / 2, 0);
  return {S, colture, piante, piani, superficie, chioma, ppfdObiettivo: ppfd, ppfd: Math.round(ppfdReale), ore, dli: ppfdReale * ore * 0.0036,
          dliObiettivo: ppfd * ore * 0.0036, L, geometria, wRichiesti, wLuci, footprint, lato, altezza, misure, tenda,
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

// ---------- modello di crescita (lattuga, basilico) ----------
// Massa secca per pianta: dD/dt = LUE × DLI × A × (1 − e^(−k·LAR·D/A)) × f(T)
//   A = spazio per pianta (cubetto in vivaio, poi passo²), LAR = superficie fogliare per g secco, che aumenta con poca
//   luce (acclimatazione all'ombra: LAR = LARrif × (DLIrif/DLI)^a), f(T) = funzione beta delle temperature cardinali
//   (Yan e Hunt 1999). Massa fresca = secca ÷ sostanza secca. LUE si calibra sul caso di riferimento pubblicato.
// Vedi MODELLI.md §2b per fonti, ipotesi e limiti.
function fTemp(T, b, o, m) {
  if (T <= b || T >= m) return 0;
  return ((m - T) / (m - o)) * Math.pow((T - b) / (o - b), (o - b) / (m - o));
}
// L'acclimatazione all'ombra è limitata a foglie al massimo 1,6 volte più larghe (e 0,7 volte più strette) di quelle
// di riferimento: senza limiti la relazione empirica darebbe superfici fogliari irrealistiche con poca luce.
function passoCrescita(G, D, dli, T, A) {
  const acc = Math.min(1.6, Math.max(0.7, Math.pow(G.dliRif / Math.max(dli, 0.5), G.a)));      // ACCLIMATAZIONE
  return G.lue * dli * A * (1 - Math.exp(-G.k * G.lar * acc * D / A)) * fTemp(T, G.tb, G.to, G.tm);
}
// LUE del modello = grammi di sostanza secca per mole di luce INTERCETTATA dalla chioma. Per confrontarla con i valori
// pubblicati sulla luce INCIDENTE (es. ~0,55 g/mol nelle vertical farm) si divide la massa secca finale per tutta la
// luce arrivata sullo spazio della pianta durante il ciclo.
function lueIncidente(P, giorni, dli, T, passo) {
  const G = P.crescita; let D = G.d0, luce = 0;
  for (let g = 0; g < giorni; g++) { const A = g < P.vivaio ? 0.0025 : Math.pow(passo / 100, 2); D += passoCrescita(G, D, dli, T, A); luce += dli * A; }
  return {secco: D, luce, lue: D / luce};
}
const ACCLIMATAZIONE = [0.7, 1.6];
// copia di una coltura con parametri variati (per l'incertezza): LUE e resa × fLue, temperature cardinali + dT
function variaPianta(P, v) {
  if (!v) return P;
  const Q = Object.assign({}, P, {resa: P.resa * (P.crescita ? 1 : v.fLue || 1)});
  if (P.crescita) Q.crescita = Object.assign({}, P.crescita, {lue: P.crescita.lue * (v.fLue || 1), tb: P.crescita.tb + (v.dT || 0), to: P.crescita.to + (v.dT || 0), tm: P.crescita.tm + (v.dT || 0)});
  return Q;
}
function calibraCrescita(P) {
  const G = P.crescita, r = G.rif;
  let lo = 0.01, hi = 5;
  for (let i = 0; i < 60; i++) {
    G.lue = (lo + hi) / 2;
    let D = G.d0;
    for (let g = 0; g < r.giorni; g++) D += passoCrescita(G, D, r.dli, r.t, g < P.vivaio ? 0.0025 : Math.pow(r.passo / 100, 2));
    if (D > r.fresco * G.sec) hi = G.lue; else lo = G.lue;
  }
  return G.lue;
}
// una coorte seminata il giorno "inizio": clima(g) restituisce {tMedia, dli} del giorno g
function coorte(P, inizio, clima, passo) {
  const G = P.crescita, max = 3 * (P.vivaio + P.giorni), curva = [];
  let D = G.d0, g = 0;
  for (; g < max; g++) {
    const c = clima(inizio + g);
    D += passoCrescita(G, D, c.dli, c.tMedia, g < P.vivaio ? 0.0025 : Math.pow(passo / 100, 2));
    curva.push(D / G.sec);
    if (D / G.sec >= P.resa && g >= P.vivaio) break;
  }
  const giorni = Math.min(g + 1, max), fresco = D / G.sec;
  return {inizio, giorni: Math.max(1, giorni - P.vivaio), giorniDaSemina: giorni, fresco: Math.min(fresco, P.resa), secco: D, curva, completa: fresco >= P.resa};
}
// deficit di pressione di vapore (kPa) dall'aria: formula di Tetens
function vpd(T, ur) { return 0.6108 * Math.exp(17.27 * T / (T + 237.3)) * (1 - ur / 100); }

// ---------- simulazione di un anno ----------
function simulaIdro(c, opz = {}) {
  const I = Object.assign({}, c.idro, opz.idro || {}), cc = Object.assign({}, c, {idro: I});
  const k = capacitaIdro(cc), R = REGIONI[c.regione], A = I.auto, CL = I.clima, S = k.S;
  const rnd = mulberry32(4242);
  const D = DUREZZE[I.acqua.durezza];
  const ecBase = I.acqua.osmosi ? 0.02 : I.acqua.piovana ? (D.ec + 0.05) / 2 : D.ec;
  const ecNutr = Math.max(0, k.ec - ecBase);
  const UA = CL.tenda ? 4 * k.superficieTenda : 20 * k.footprint + 40;   // solo per compatibilità dei risultati (out.UA)
  const senzaElettronica = A.micro === "nessuno";
  const microW = senzaElettronica ? 0 : (CATALOGO.micro.opzioni[A.micro] || CATALOGO.micro.opzioni.esp32).w;
  const sensW = 0.2 * [A.ph, A.ec, A.temp_acqua, A.aria, A.co2, A.livello, A.perdita, A.flusso, A.luce_sens].filter(Boolean).length;
  const elettronicaW = senzaElettronica ? (A.prese_smart ? 0.8 * 2 : 0) + (A.ups ? 4 : 0) : microW + sensW + (A.connessione === "g4" ? 0.8 : A.connessione === "nessuna" ? 0 : 0.15) + (A.ups ? 4 : 0) + (A.prese_smart ? 0.8 * 4 : 0) + 0.4;
  const idr = idraulicaIdro(cc);
  const pompaW = idr ? idr.wPompa : 0;
  const pompaOre = {nft: 24, torre: 12, dwc: 0, kratky: 0, bucket: 1.5, ebb: 1, goccia: 1.5, vassoi: 0}[I.sistema];
  // clima: motore dinamico a nodi termici (clima.js), ora per ora; i guasti (lampada, blackout) non ne cambiano il calcolo
  const clima = simulaClimaIdro(cc, k, {pompaW: pompaW * pompaOre / 24, passoOre: opz.passoClima});
  const ariaW = I.sistema === "dwc" ? 3 + k.superficie * 3 : I.sistema === "bucket" ? 3 : 0;
  const guasti = (I.guasti || []).map(g => Object.assign({}, g));
  const reaz = A.connessione !== "nessuna" && A.centrale !== "nessuna" ? 0.2 : 2;     // giorni per accorgersi
  const out = {giorni: [], mesi: Array.from({length: 12}, () => ({luci: 0, clima: 0, pompe: 0, elettronica: 0, acqua: 0, kg: 0, nutrienti: 0})),
               kwh: 0, kwhLuci: 0, kwhClima: 0, kwhPompe: 0, kwhElettronica: 0, acqua: 0, acquaCambi: 0, acquaScarto: 0,
               kg: 0, valore: 0, raccolti: 0, semi: 0, nutrienti: 0, phDown: 0, eventi: [], giorniCaldo: 0, giorniFreddo: 0,
               giorniAcquaCalda: 0, giorniUmido: 0, perse: 0, k, ecBase, ecNutr, UA};
  const evento = (d, tipo, testo) => out.eventi.push({d, tipo, testo});
  let perditaKgStock = 0, lampadaFino = -1, phFino = -1, pompaFino = -1;
  const kgColtura = k.colture.map(() => 0);
  // calibrazione dai raccolti veri (scheda Registro): fattore per coltura, 1 se non c'è
  const calib = (I.calibrazioni && I.calibrazioni.length) ? I.calibrazioni[I.calibrazioni.length - 1].fattori : {};
  const fCal = k.colture.map(x => calib[x.coltura] || 1);
  const PR = Object.assign({mortalita: 0, fermo_giorni: 0, scarto: 0}, I.produzione || {});
  const vive = 1 - PR.mortalita / 100, fermo = PR.fermo_giorni;
  for (let d = 0; d < 365; d++) {
    const m = meseDi(d);
    const CG = clima.giorni[d], tGarage = CG.tGarage;
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
    const tMax = Math.min(...k.colture.map(x => x.P.t[1])), tMin = Math.max(...k.colture.map(x => x.P.t[0]));
    const tLuci = CG.tLuci, tBuio = CG.tBuio, whStufa = CG.whStufa, tAcqua = CG.tAcqua;
    const caldo = tLuci > tMax + 2, freddo = tBuio < tMin - 4;
    if (caldo) out.giorniCaldo++;
    if (freddo) out.giorniFreddo++;
    const acquaCalda = tAcqua > 24;
    if (acquaCalda) out.giorniAcquaCalda++;
    // crescita e raccolto (produzione continua a semina scaglionata)
    let kgGiorno = 0, traspirazione = 0;
    const fattoreLuce = Math.min(...k.colture.map(x => rispostaLuce(x.P, k.dli * luceFattore)));
    const fattori = [];
    for (const [i, x] of k.colture.entries()) {
      // fattori che il modello di crescita non contiene: pH, controllo, mortalità, radici calde, piante perse
      let altri = phFattore * (A.dosaggio ? 0.98 : 0.92) * vive * (acquaCalda && (I.sistema === "dwc" || I.sistema === "kratky" || I.sistema === "nft") ? 0.8 : 1) * Math.max(0, 1 - perditaKgStock);
      // col caldo la pianta cresce ma perde qualità (lattuga che sale a seme, amara): metà del raccolto non vendibile
      fattori.push(x.P.crescita && tLuci > x.P.t[1] + 2 ? altri * 0.5 : altri);
      let f = rispostaLuce(x.P, k.dli * luceFattore) * altri;
      if (tLuci > x.P.t[1] + 2) f *= 0.5;
      if (tBuio < x.P.t[0] - 4) f *= 0.5;
      const raccolte = x.piante / (x.P.giorni + fermo);
      const kgX = x.P.crescita ? 0 : raccolte * x.P.resa * (opz.variazione && opz.variazione.fLue || 1) / 1000 * f * fCal[i];      // con modello di crescita: calcolato dopo
      kgGiorno += kgX; kgColtura[i] += kgX;
      if (!x.P.crescita) { out.raccolti += raccolte; out.semi += raccolte * 1.2 * x.P.seme; }
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
    let acqua = traspirazione * (I.sistema === "goccia" ? 1.35 : 1.05);       // goccia a perdere: 25-30% di drenaggio
    if (d % I.acqua.cambio_giorni === 0) { acqua += k.serbatoio; out.acquaCambi += k.serbatoio; }
    if (I.acqua.osmosi) out.acquaScarto += acqua * 2.5;
    const nutr = acqua * ecNutr * NUTRIENTI[I.nutrienti].euro_l_ms;
    const phd = acqua * D.ph_ml * (I.acqua.osmosi ? 0.15 : 1);
    out.nutrienti += nutr; out.phDown += phd;
    // energia del giorno (Wh)
    const oreOn = 24 - blackoutEff;
    const whLuci = qLuci * k.ore * (oreOn / 24);
    const whPompe = (pompaW * pompaOre + ariaW * 24) * (oreOn / 24);
    const whClima = whStufa + whDeum + (CL.estrattore ? 25 * CG.oreEstrattore : 0) + (CL.circolazione ? 10 * 24 : 0);
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
    const tMedia = (tLuci * k.ore + tBuio * (24 - k.ore)) / 24;
    out.giorni.push({d, tEst: CG.tEst, tGarageMin: CG.tGarageMin, tGarageMax: CG.tGarageMax, tMinTenda: CG.tMinTenda, tMaxTenda: CG.tMaxTenda, tGarage, tLuci, tBuio, tAcqua, tMedia, vpd: vpd(tLuci, ur), ur, kg: kgGiorno, acqua, wh, allarmi, luce: fattoreLuce, dli: k.dli * luceFattore, fattori, perse: perditaKgStock, blackout: blackoutEff});
  }
  // colture con modello di crescita: una coorte seminata ogni giorno, cresce con il clima e la luce dei giorni
  // seguenti fino al peso di raccolta; produzione del giorno = piante ÷ (durata del ciclo + giorni fermi) × peso
  out.coorti = {};
  for (const [i, x] of k.colture.entries()) {
    if (!x.P.crescita) continue;
    const passo = x.P.passo || 20, cicli = [], ogni = opz.passoCoorti || 7;
    let c0 = null;
    for (let d = 0; d < 365; d++) {
      if (d % ogni === 0) c0 = coorte(variaPianta(x.P, opz.variazione), d, g => out.giorni[g % 365], passo);
      const raccolte = x.piante / (c0.giorni + fermo);
      const kgX = raccolte * c0.fresco / 1000 * out.giorni[d].fattori[i] * fCal[i];
      out.giorni[d].kg += kgX; out.mesi[meseDi(d)].kg += kgX; out.kg += kgX; kgColtura[i] += kgX;
      out.raccolti += raccolte; out.semi += raccolte * 1.2 * x.P.seme;
      cicli.push(c0);
    }
    out.coorti[x.coltura] = cicli;
  }
  out.perColtura = k.colture.map((x, i) => {
    const cicli = out.coorti[x.coltura], giorniCiclo = cicli ? cicli.reduce((a, c) => a + c.giorni, 0) / 365 : x.P.giorni;
    return {coltura: x.coltura, piante: x.piante, quota: x.quota, kg: kgColtura[i], valore: kgColtura[i] * x.P.prezzo,
            raccolti: x.piante / (giorniCiclo + fermo) * 365, giorniCiclo, luce: statoLuce(x.P, k.dli), modello: !!x.P.crescita};
  });
  out.valore = out.perColtura.reduce((a, x) => a + x.valore, 0);
  out.clima = {parametri: clima.parametri, bilancio: clima.bilancio, latenteW: clima.latenteW,
               oreGelo: clima.giorni.reduce((a, g) => a + g.oreGelo, 0), oreCaldo: clima.giorni.reduce((a, g) => a + g.oreCaldo, 0)};
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
  if (["nft", "torre", "bucket", "ebb", "goccia"].includes(c.idro.sistema)) righe.push(["Ricambio pompa (ogni 3 anni circa)", "", 20 * (c.idro.sistema === "torre" ? c.idro.torri : 1) / 3]);
  if (A.ph) righe.push(["Sonda pH (da cambiare ogni 12-18 mesi) e soluzioni di taratura", "", 30]);
  if (A.connessione === "g4") righe.push(["SIM 4G", "", 12]);
  const E = Object.assign({ore_settimana: 0, euro_ora: 0}, c.idro.economia || {});
  if (E.euro_ora > 0) righe.push(["Lavoro", Math.round(E.ore_settimana * 52) + " ore", E.ore_settimana * 52 * E.euro_ora]);
  return {righe, totale: righe.reduce((a, r) => a + r[2], 0), ore: E.ore_settimana * 52};
}
const n1 = x => x.toFixed(1).replace(".", ",");
const fmtMigliaia = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// ---------- mappa della luce sul ripiano ----------
// Ogni lampada è una griglia di sorgenti puntiformi lambertiane (I(θ) = I0·cos θ, I0 = PPF/π) a "distanza" cm sopra la
// chioma. PPFD in un punto = Σ I0·cos θ·cos θ / d² = Σ I0·h² / d⁴. Con la tenda le 4 pareti riflettenti (Mylar, ρ ≈ 0,9)
// aggiungono una riflessione come sorgenti specchiate. Formula fotometrica esatta per sorgenti puntiformi (A); la forma
// del fascio (lambertiano) e la riflettività sono ipotesi (C): con il file fotometrico della lampada si sostituiscono.
const DIMENSIONI_PIANO = {0.36: [60, 60], 0.48: [80, 60], 0.72: [120, 60], 1: [100, 100], 1.44: [120, 120], 2.25: [150, 150]};
function dimensioniPiano(I) {
  if (I.struttura && I.struttura.lung_cm && I.struttura.prof_cm) return {lung: I.struttura.lung_cm / 100, prof: I.struttura.prof_cm / 100};
  const d = DIMENSIONI_PIANO[I.superficie_piano];
  if (d) return {lung: d[0] / 100, prof: d[1] / 100};
  const lato = Math.sqrt(I.superficie_piano); return {lung: lato, prof: lato};
}
function mappaLuce(c, opz = {}) {
  const I = c.idro, k = capacitaIdro(c), L = k.L;
  if (k.S.verticale) return null;
  const {lung, prof} = I.sistema === "bucket" || I.sistema === "goccia" ? {lung: k.misure.lung, prof: k.misure.prof} : dimensioniPiano(I);
  const h = (I.luce.distanza_cm || 35) / 100, rho = I.clima.tenda ? 0.9 : 0;
  const wPiano = k.wLuci / Math.max(1, k.piani), ppf = wPiano * L.eff;
  // lampada larga l'80% del piano, sorgenti a griglia 4×3
  const nx = 4, ny = 3, sorgenti = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) sorgenti.push([lung * (0.1 + 0.8 * (i + 0.5) / nx), prof * (0.1 + 0.8 * (j + 0.5) / ny)]);
  const I0 = ppf / sorgenti.length / Math.PI;
  const specchi = [];
  for (const [x, y] of sorgenti) {
    specchi.push([x, y, 1]);
    if (rho) specchi.push([-x, y, rho], [2 * lung - x, y, rho], [x, -y, rho], [x, 2 * prof - y, rho]);
  }
  const gx = opz.gx || 24, gy = opz.gy || Math.max(6, Math.round(gx * prof / lung));
  const griglia = [];
  let somma = 0, min = Infinity, max = 0;
  for (let j = 0; j < gy; j++) { const riga = [];
    for (let i = 0; i < gx; i++) {
      const px = lung * (i + 0.5) / gx, py = prof * (j + 0.5) / gy;
      let e = 0;
      for (const [x, y, f] of specchi) { const d2 = (px - x) ** 2 + (py - y) ** 2 + h * h; e += f * I0 * h * h / (d2 * d2); }
      riga.push(e); somma += e; min = Math.min(min, e); max = Math.max(max, e);
    }
    griglia.push(riga); }
  const media = somma / (gx * gy);
  return {griglia, lung, prof, h, media, min, max, uniformita: min / media, dliMedio: media * k.ore * 0.0036, dliMin: min * k.ore * 0.0036,
          utilizzo: media * lung * prof / ppf, ppfdSemplice: k.ppfd};
}

// ---------- idraulica: canali NFT, torri, secchi ----------
// Portata per canale NFT circa 1 L/min (0,5 al trapianto, massimo 2), pendenza consigliata tra 1:100 e 1:30: valori
// da letteratura e pratica (C). Perdite nel tubo di mandata con Hazen-Williams (A): hf = 10,67·L·Q^1,852/(C^1,852·D^4,87).
const IDRAULICA = {portataCanale: 1.0, pendenza: 1 / 40, tuboMandata: 0.016, scabrezza: 150, efficienzaPompa: 0.15, filmLm: 0.25};
function idraulicaIdro(c) {
  const I = c.idro, k = capacitaIdro(c), H = IDRAULICA;
  if (!["nft", "torre", "bucket", "ebb", "goccia"].includes(I.sistema)) return null;
  let canali = 0, lungCanale = 0, portata = 0, altezza = 0, volumeRitorno = 0, righe = [];
  if (I.sistema === "nft") {
    const {lung, prof} = dimensioniPiano(I);
    const passoCanali = Math.max(0.15, Math.max(...k.colture.map(x => x.P.passo || 15)) / 100);
    const perPiano = Math.max(1, Math.floor(prof / passoCanali));
    canali = perPiano * k.piani; lungCanale = lung;
    portata = canali * H.portataCanale;                                     // L/min
    altezza = 0.45 * (k.piani - 1) + 0.6;                                   // ingresso del canale più alto sopra il serbatoio
    volumeRitorno = canali * lungCanale * H.filmLm + canali * 0.3;          // acqua che torna giù quando la pompa si ferma
    righe.push(["Canali", canali + " (" + perPiano + " per piano, uno ogni " + Math.round(passoCanali * 100) + " cm)"],
               ["Lunghezza dei canali", lung.toFixed(2).replace(".", ",") + " m"],
               ["Pendenza", "1:40 = " + (lung * H.pendenza * 100).toFixed(1).replace(".", ",") + " cm di dislivello per canale (da 1:100 a 1:30 secondo le fonti)"]);
  } else if (I.sistema === "torre") {
    canali = I.torri; portata = I.torri * 3; altezza = 1.7; volumeRitorno = I.torri * 2;
    righe.push(["Torri", I.torri + ", circa 3 L/min ciascuna in cima"]);
  } else if (I.sistema === "ebb") {
    // un vassoio alla volta: 5 cm d'acqua sul vassoio in 10 minuti, poi torna tutta nel serbatoio
    const {lung, prof} = dimensioniPiano(I);
    canali = k.piani; portata = lung * prof * 50 / 10; altezza = 0.45 * (k.piani - 1) + 0.6; volumeRitorno = lung * prof * 50;
    righe.push(["Vassoi", k.piani + " da " + Math.round(lung * 100) + "×" + Math.round(prof * 100) + " cm, allagati uno alla volta 15 minuti 3-4 volte al giorno"]);
  } else if (I.sistema === "goccia") {
    canali = I.secchi; portata = k.piante * 2 / 60; altezza = 0.8; volumeRitorno = I.secchi * 0.3;
    righe.push(["Lastre", I.secchi + " da 100 cm, un gocciolatoio da 2 L/h per pianta, 6-10 irrigazioni brevi al giorno"]);
  } else {
    canali = I.secchi; portata = I.secchi * 2 * 4 / 60; altezza = 1.0; volumeRitorno = I.secchi * 0.5;    // 2 gocciolatori autocompensanti da 4 L/h per secchio
    righe.push(["Secchi", I.secchi + ", 2 gocciolatori autocompensanti da 4 L/h ciascuno"]);
  }
  const Q = portata / 60000;                                                // m³/s
  const lungTubo = altezza + 1.5;
  const perdite = 10.67 * lungTubo * Math.pow(Q, 1.852) / (Math.pow(H.scabrezza, 1.852) * Math.pow(H.tuboMandata, 4.87));
  const prevalenza = altezza + perdite + 0.3;                               // + raccordi e uscita
  const potenzaIdraulica = 1000 * 9.81 * Q * prevalenza;                    // W
  const wPompa = Math.max(5, potenzaIdraulica / H.efficienzaPompa);
  // scelta della pompa: curva lineare Q = Qmax·(1 − H/Hmax), con Hmax ≥ 1,5 × prevalenza
  const hMax = Math.ceil(prevalenza * 1.5 * 2) / 2, qMax = Math.ceil(portata * 60 / (1 - prevalenza / hMax) / 100) * 100;
  const autonomia = k.serbatoio / Math.max(0.1, (k.colture.reduce((a, x) => a + x.piante * x.P.acqua, 0)));
  const liberoSerbatoio = k.serbatoio * (I.sistema === "ebb" ? 0.6 : 0.25);   // spazio tra livello di lavoro e bordo (ebb: si riempie a metà)
  righe.push(["Portata totale", portata.toFixed(1).replace(".", ",") + " L/min (" + Math.round(portata * 60) + " L/h)"],
             ["Prevalenza richiesta", prevalenza.toFixed(2).replace(".", ",") + " m (" + altezza.toFixed(2).replace(".", ",") + " di dislivello + " + perdite.toFixed(2).replace(".", ",") + " di perdite nel tubo da 16 mm + 0,3 raccordi)"],
             ["Pompa consigliata", "almeno " + qMax + " L/h di portata massima e " + hMax.toString().replace(".", ",") + " m di prevalenza massima (alla prevalenza richiesta dà ancora la portata)"],
             ["Consumo stimato della pompa", Math.round(wPompa) + " W (rendimento delle piccole pompe 10-25%)"],
             ["Acqua che torna al serbatoio a pompa ferma", Math.round(volumeRitorno) + " L: " + (volumeRitorno > liberoSerbatoio ? "PIÙ dello spazio libero nel serbatoio (" + Math.round(liberoSerbatoio) + " L): rischio di traboccare, serbatoio più grande o livello più basso" : "il serbatoio la contiene (" + Math.round(liberoSerbatoio) + " L liberi)")],
             ["Autonomia del serbatoio senza rabbocchi", Math.round(autonomia) + " giorni a piante adulte"]);
  return {canali, lungCanale, portata, altezza, perdite, prevalenza, wPompa, qMax, hMax, volumeRitorno, trabocca: volumeRitorno > liberoSerbatoio, autonomia, righe};
}

// ---------- incertezza: Monte Carlo ----------
// Ripete la simulazione variando i parametri più incerti con distribuzioni dichiarate e riporta P10, P50, P90:
//   efficienza della luce (e resa delle colture senza modello) ×N(1; 0,15) tra 0,6 e 1,4; temperature cardinali
//   +N(0; 1) °C; piante perse 2-10%; prezzi al negozio ×N(1; 0,15); prezzo del kWh ×N(1; 0,1); materiale uniforme
//   tra prezzo minimo e massimo. Seme fisso: stesso risultato a ogni esecuzione.
function incertezzaIdro(c, n = 40, seme = 99) {
  const rnd = mulberry32(seme), norm = (m, s, a, b) => Math.min(b, Math.max(a, m + s * gaussDa(rnd)));
  const voci = materialiIdro(c), capMin = somma(voci, "min"), capMax = somma(voci, "max");
  const corse = [];
  for (let i = 0; i < n; i++) {
    const v = {fLue: norm(1, 0.15, 0.6, 1.4), dT: norm(0, 1, -3, 3)};
    const fPrezzo = norm(1, 0.15, 0.5, 1.5), fKwh = norm(1, 0.1, 0.6, 1.4), mort = 2 + rnd() * 8, cap = capMin + rnd() * (capMax - capMin);
    const c2 = JSON.parse(JSON.stringify(c));
    c2.prezzi.kwh *= fKwh; c2.idro.produzione = Object.assign({}, c2.idro.produzione, {mortalita: mort});
    const s = simulaIdro(c2, {variazione: v, passoClima: 1, passoCoorti: 14});
    const e = economiaIdro(c2, s, voci), C = e.scenari.centrale;
    const valore = (C.sostituzione + C.ricavo) * fPrezzo, amm = cap / e.vita;
    corse.push({kg: C.kgUtili, kwh: s.kwh, costoKg: C.kgUtili > 0 ? (C.opex + amm) / C.kgUtili : Infinity, margine: valore - C.opex, utile: valore - C.opex - amm});
  }
  const q = (chiave, p) => { const l = corse.map(x => x[chiave]).filter(isFinite).sort((a, b) => a - b); return l.length ? l[Math.min(l.length - 1, Math.floor(p * (l.length - 1) + 0.5))] : NaN; };
  const r = {n, corse};
  for (const k of ["kg", "kwh", "costoKg", "margine", "utile"]) r[k] = {p10: q(k, 0.1), p50: q(k, 0.5), p90: q(k, 0.9)};
  r.probRipaga = corse.filter(x => x.utile > 0).length / n;
  return r;
}

// ---------- microgreens per la vendita: conto per vassoio ----------
// I prezzi di vendita, i clienti e i costi di confezione e consegna li inserisci tu (default dichiarati "da
// verificare"): il gemello non li conosce. Energia e acqua per vassoio vengono dalla simulazione dell'impianto.
const MICRO_ESEMPIO = {vassoi_settimana: 20, grammi_vassoio: 250, prezzo_kg: 30, confezione_g: 50, costo_confezione: 0.25,
                       km_settimana: 40, euro_km: 0.35, minuti_vassoio: 12, euro_ora: 0, scarto: 15, clienti: 3};
function microgreensVendita(c, s, M) {
  M = Object.assign({}, MICRO_ESEMPIO, M || {});
  const P = IDRO_PIANTE.microgreens, k = s.k;
  const vassoiAnno = s.perColtura.reduce((a, x) => a + (x.coltura === "microgreens" ? x.raccolti : 0), 0) || 1;
  const capacitaSett = vassoiAnno / 52;
  const energia = s.kwh * c.prezzi.kwh / vassoiAnno, acqua = s.acqua / 1000 * c.prezzi.acqua_m3 / vassoiAnno;
  const seme = P.seme * 1.0, substrato = 0.35;                                // € per vassoio (seme da tabella, substrato stima)
  const confezioni = M.grammi_vassoio * (1 - M.scarto / 100) / M.confezione_g;
  const venduti = Math.min(M.vassoi_settimana, capacitaSett);
  const consegna = M.km_settimana * M.euro_km / Math.max(1, venduti);
  const lavoro = M.minuti_vassoio / 60 * M.euro_ora;
  const costo = energia + acqua + seme + substrato + confezioni * M.costo_confezione + consegna + lavoro;
  const ricavo = M.grammi_vassoio * (1 - M.scarto / 100) / 1000 * M.prezzo_kg;
  const margine = ricavo - costo;
  const fissoSett = M.km_settimana * M.euro_km;                               // la consegna si paga anche con pochi vassoi
  const variabile = costo - consegna;
  const pareggioSett = ricavo > variabile ? fissoSett / (ricavo - variabile) : Infinity;
  return {M, capacitaSett, venduti, voci: {energia, acqua, seme, substrato, confezione: confezioni * M.costo_confezione, consegna, lavoro}, costo, ricavo, margine,
          margineAnno: margine * venduti * 52, pareggioSett, oreSettimana: venduti * M.minuti_vassoio / 60,
          avvisi: [
            ...(M.vassoi_settimana > capacitaSett ? ["L'impianto produce circa " + Math.round(capacitaSett) + " vassoi a settimana: per " + M.vassoi_settimana + " servono più ripiani."] : []),
            ...(pareggioSett > venduti ? ["Con " + Math.round(venduti) + " vassoi a settimana non copri nemmeno le consegne: ne servono almeno " + Math.ceil(pareggioSett) + "."] : []),
            "Prezzo, clienti e costi di confezione e consegna sono tuoi dati da verificare: chiedi ai ristoranti quanto pagano e quanto ne prendono davvero ogni settimana.",
            "Prima di vendere: inquadramento dell'attività, notifica sanitaria e tracciabilità dei lotti (Documenti → Regole per vendere)."]};
}

// ---------- lavoro ----------
// Ore a settimana stimate (euristica dichiarata): base per sistema + semina/trapianto/raccolta per pianta + misure a
// mano di pH ed EC se non ci sono le sonde. Va confrontata con il registro del tuo lavoro vero.
function oreSettimanaIdro(c) {
  const I = c.idro, A = I.auto, k = capacitaIdro(c);
  const base = {kratky: 0.5, dwc: 0.75, nft: 1, torre: 1.25, bucket: 1, ebb: 1, goccia: 1.25, vassoi: 1.5}[I.sistema];
  const perPianta = I.sistema === "vassoi" ? 0.15 : 0.02;
  const misure = A.ph && A.ec ? 0.25 : 0.75;
  const dosaggio = A.dosaggio ? 0 : 0.25;
  return Math.round((base + k.piante * perPianta + misure + dosaggio) * 4) / 4;
}

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
    const venduti = kgU * E.quota_vendita / 100, casa = Math.max(0, Math.min(kgU * (1 - E.quota_vendita / 100), P.consumo * E.persone * 52));
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
    // flusso di cassa: −investimento all'anno 0, poi margine ogni anno per la vita dell'impianto; tasso del 3%
    const van = -inv + margine * (1 - Math.pow(1.03, -E.vita_anni)) / 0.03;
    let tir = null;
    if (margine > 0 && margine * E.vita_anni > inv) { let lo = -0.99, hi = 10;
      for (let i = 0; i < 80; i++) { const r = (lo + hi) / 2, v = -inv + margine * (1 - Math.pow(1 + r, -E.vita_anni)) / r; if (v > 0) lo = r; else hi = r; } tir = (lo + hi) / 2; }
    scenari[kk] = {nome: sc.nome, kgUtili, venduti, casa, eccedenza, sostituzione, ricavo, opex, capex: inv, ammortamento, costoAnno: opex + ammortamento, van, tir,
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
    const t = [k.tenda.nome, k.tenda.prezzo];
    add("Struttura", "4b", "Tenda da coltivazione " + t[0] + " (interno riflettente)", 1, t[1], "Tiene caldo, luce e umidità dove servono: in garage senza tenda si scalda tutto il garage.", "tenda");
  }
  if (!S.verticale && (k.piani > 1 || I.sistema === "nft" || I.sistema === "vassoi")) { const m = k.misure;
    add("Struttura", "4b", "Scaffale metallico " + k.piani + (k.piani > 1 ? " ripiani " : " ripiano ") + Math.round(m.lung * 100) + "×" + Math.round(m.prof * 100) + " cm, alto " + Math.round(m.alt * 100) + " cm", 1, [12 + 8 * k.piani * m.lung * m.prof / 0.72, 25 + 15 * k.piani * m.lung * m.prof / 0.72], "Un ripiano ogni " + Math.round(m.hPiano * 100) + " cm, ognuno con la sua luce; sotto il primo il serbatoio.", "scaffale"); }
  if (I.sistema === "torre") add("Struttura", "4b", "Torre verticale da " + S.piante_torre + " vasetti", I.torri, S.struttura_torre, S.pro + " " + S.contro, "sistema");
  else if (I.sistema === "bucket") add("Struttura", "4b", "Secchio olandese con sifone + perlite", I.secchi, S.struttura_secchio, S.pro, "sistema");
  else if (I.sistema === "goccia") { add("Struttura", "4b", "Lastra di fibra di cocco 100×15 cm con vaschetta di raccolta", I.secchi, S.struttura_secchio, S.pro, "sistema");
    add("Acqua", "4b", "Gocciolatoi autocompensanti 2 L/h con picchetto, tubo 16 mm e drenaggio", 1, [10 + k.piante * 0.6, 20 + k.piante * 1.2], "Il 20-30% d'acqua drena via: si misura l'EC del drenaggio per capire se il substrato accumula sali.", "sistema"); }
  else if (I.sistema === "ebb") add("Struttura", "4b", "Vassoio per flusso e riflusso con raccordi di riempimento e troppo pieno", k.piani, [25 * k.superficie / k.piani + 15, 45 * k.superficie / k.piani + 25], S.pro, "sistema");
  else add("Struttura", "4b", (I.sistema === "nft" ? "Staffe e supporti inclinabili per i canali" : S.nome) + " per " + (k.superficie).toFixed(2) + " m²", 1, [S.struttura_m2[0] * k.superficie, S.struttura_m2[1] * k.superficie], S.pro + " " + S.contro, "sistema");
  add("Acqua", "4b", "Serbatoio " + k.serbatoio + " L scuro con coperchio", 1, k.serbatoio <= 60 ? [10, 20] : k.serbatoio <= 120 ? [20, 35] : [40, 70], "Scuro e chiuso: con la luce crescono le alghe.", "serbatoio");
  const idr = idraulicaIdro(c);
  if (idr) add("Acqua", "4b", "Pompa sommersa da " + idr.qMax + " L/h, prevalenza massima " + idr.hMax + " m (circa " + Math.round(idr.wPompa) + " W)", 1, idr.qMax <= 1000 ? [12, 25] : idr.qMax <= 2000 ? [20, 40] : [35, 70], "Dimensionata per " + Math.round(idr.portata * 60) + " L/h a " + idr.prevalenza.toFixed(1) + " m (scheda Struttura).", "pompa");
  if (I.sistema === "nft") { const {lung} = dimensioniPiano(I);
    add("Acqua", "4b", "Canali NFT in PVC alimentare (" + lung.toFixed(1) + " m)", idr.canali, [6 * lung, 12 * lung], "Uno ogni " + Math.round(Math.max(15, ...k.colture.map(x => x.P.passo || 15))) + " cm; tappi alle estremità.", "sistema");
    const mandata = Math.ceil(idr.altezza + lung + 1), ritorno = Math.ceil(k.misure.prof * k.piani + idr.altezza + 0.5);
    add("Acqua", "4b", "Tubo di mandata 16 mm (" + mandata + " m), " + idr.canali + " raccordi a T e tubicini, collettore di ritorno 40 mm (" + ritorno + " m)", 1, [5 + mandata * 0.8 + ritorno * 2.5 + idr.canali * 1, 10 + mandata * 1.5 + ritorno * 4 + idr.canali * 2], "Lunghezze calcolate dalle misure dello scaffale.", "sistema"); }
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
  if (I.sistema === "bucket" || I.sistema === "ebb") add("Consumabili", "4a", "Perlite o argilla espansa 50 L", 1, [15, 25], I.sistema === "ebb" ? "Riempie i vasetti nel vassoio." : "Riempie i secchi.", "substrato");
  add("Consumabili", "4a", "Semi (" + I.colture.map(x => IDRO_PIANTE[x.coltura].nome.toLowerCase()).join(", ") + ")", I.colture.length, [2, 4], "Bustine da 2-4 €: centinaia di semi. Per microgreens e fragole il costo vero è nel consumo annuo.", "semi");
  // automazione
  const senzaElettronica = A.micro === "nessuno";
  if (senzaElettronica) {
    if (!A.prese_smart) add("Automazione", "4a", "Timer da presa (luci" + (["nft", "torre", "bucket", "ebb", "goccia"].includes(I.sistema) ? " e pompa" : "") + ")", ["nft", "torre", "bucket", "ebb", "goccia"].includes(I.sistema) ? 2 : 1, [8, 15], "Accende e spegne a orario: niente elettronica fai da te a 230 V.", "alimentazione");
    add("Automazione", "4a", "Termometro minima/massima con sonda (aria e acqua)", 1, [10, 18], "Senza sensori, è l'unico modo di sapere quanto caldo e freddo fa davvero in tenda.", "sensori");
  } else {
  const micro = CATALOGO.micro.opzioni[A.micro];
  add("Automazione", "4a", micro.nome, 1, micro.p, micro.pro + " Software: " + micro.firmware + ".", "micro");
  if (A.ph && !senzaElettronica) add("Automazione", "4a", "Sonda pH industriale + scheda di interfaccia", 1, [35, 60], "Sonda da tenere sempre in acqua; si tara ogni mese, si cambia ogni 12-18 mesi.", "sensori");
  if (A.ec && !senzaElettronica) add("Automazione", "4a", "Sonda EC K=1 + scheda di interfaccia", 1, [45, 70], "Misura i nutrienti disciolti.", "sensori");
  if (A.temp_acqua && !senzaElettronica) add("Automazione", "4a", "Sonda temperatura acqua DS18B20 impermeabile", 1, [2, 4], "Sopra 24 °C le radici soffrono.", "sensori");
  if (A.aria && !senzaElettronica) add("Automazione", "4b", "Sensore aria SHT31 (temperatura e umidità)", 1, [8, 14], "Comanda estrattore, stufetta e deumidificatore.", "sensori");
  if (A.co2 && !senzaElettronica) add("Automazione", "4b", "Sensore CO₂ SCD40", 1, [30, 45], "Utile solo con tanta luce e tenda chiusa.", "sensori");
  if (A.livello && !senzaElettronica) add("Automazione", "4b", "Due galleggianti (minimo e massimo)", 1, [4, 6], "Pompa ferma col serbatoio vuoto, rabbocco fino al massimo.", "sensori");
  if (A.perdita && !senzaElettronica) add("Automazione", "4b", "Sensore di perdita a pavimento", 2, [2, 5], "In garage l'acqua sul pavimento vicino alle prese è pericolosa.", "sensori");
  if (A.flusso && !senzaElettronica) add("Automazione", "4b", "Flussimetro sul ritorno", 1, [3, 6], "Sa se l'acqua scorre davvero nei canali.", "sensori");
  if (A.luce_sens && !senzaElettronica) add("Automazione", "4b", "Sensore di luce BH1750", 1, [2, 4], "Controlla che le lampade si accendano.", "sensori");
  if (A.dosaggio && !senzaElettronica) add("Automazione", "4b", "Pompe peristaltiche 12 V (A, B, pH-) + driver", 3, [8, 13], "Dosano da sole nutrienti e acido a piccole dosi.", "dosaggio");
  if (A.dosaggio && !senzaElettronica) {
    add("Sicurezza", "4b", "Pulsante di emergenza a fungo con 2 contatti NC", 1, [12, 25], "Toglie fisicamente i 12 V ai dosatori e avvisa l'ESP32; premuto o filo tagliato = arresto.", "dosaggio");
    add("Sicurezza", "4b", "Relè temporizzato (delay off) per i 12 V dei dosatori", 1, [8, 25], "Apre dopo 30 s anche se il comando resta attivo: un relè incollato non diventa una dose infinita.", "dosaggio");
    add("Sicurezza", "4b", "Rilevatore di allagamento autonomo con uscita a relè", 1, [20, 40], "Apre i 12 V dei dosatori anche con l'ESP32 spento.", "dosaggio");
    add("Sicurezza", "4b", "Relè di abilitazione dei dosatori + portafusibile 2 A", 1, [5, 10], "Secondo interruttore in serie, chiuso solo durante la dose.", "dosaggio");
    add("Sicurezza", "4b", "Vaschetta di contenimento per i flaconi", 1, [8, 15], "A, B e acido separati: una perdita non li mescola.", "dosaggio"); }
  if (A.rabbocco && !senzaElettronica) add("Automazione", "4b", "Elettrovalvola o pompa di rabbocco", 1, [6, 12], "Rabbocca l'acqua che le piante bevono.", "dosaggio");
  add("Automazione", "4b", "Alimentatore 12 V 3 A + step-down + modulo relè per pompe 12 V", 1, [15, 25], "Bassa tensione per pompe e dosatori.", "alimentazione");
  }
  if (A.prese_smart) add("Automazione", "4b", "Prese smart certificate 16 A (luci, stufetta, estrattore, deumidificatore)", 4, [10, 18], "I carichi a 230 V solo con prese certificate, mai con relè fai da te.", "alimentazione");
  if (A.ups) add("Automazione", "4b", "UPS 600-800 VA", 1, [60, 95], "Tiene accese pompa ed elettronica nei blackout brevi.", "ups");
  if (A.connessione === "lora") add("Automazione", "6", "Modulo LoRa", 1, [15, 25], "", "connessione");
  if (A.connessione === "g4") add("Automazione", "6", "Modulo 4G", 1, [25, 40], "", "connessione");
  if (A.centrale === "rpi" && !senzaElettronica) add("Automazione", "6", "Raspberry Pi 4 come centrale", 1, [45, 65], "Dati, pannello e avvisi.", "centrale");
  add("Sicurezza", "4b", "Ciabatta con interruttore e magnetotermico, sollevata da terra", 1, [15, 30], "Mai prese e ciabatte sul pavimento vicino all'acqua; l'impianto di casa deve avere il salvavita.", "sicurezza");
  // prezzi verificati dall'utente (catalogo.js): stato del prezzo su ogni voce, CAPEX ricalcolato
  return typeof applicaPrezzi === "function" ? applicaPrezzi(voci, c.prezzi_verificati) : voci;
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
  const car = caricoScaffale(c);
  if (car && car.verifica === "no") add("crit", "Ripiani sovraccarichi", "Circa " + Math.round(car.perPiano) + " kg per ripiano contro " + car.portata + " kg dichiarati dal costruttore.", "struttura");
  if (car && car.verifica === "al limite") add("warn", "Ripiani al limite", "Circa " + Math.round(car.perPiano) + " kg per ripiano, oltre l'80% dei " + car.portata + " kg dichiarati.", "struttura");
  if (car && car.verifica === "non disponibile" && car.perPiano > 30) add("warn", "Peso dei ripiani da verificare", "Circa " + Math.round(car.perPiano) + " kg per ripiano (" + Math.round(car.acqua) + " kg d'acqua): scrivi la portata dichiarata dello scaffale nella scheda Progetto.", "struttura");
  if (car && car.ribaltamento) add("warn", "Scaffale da fissare al muro", "Alto " + Math.round(k.misure.alt * 100) + " cm e profondo " + Math.round(k.misure.prof * 100) + " cm con peso sui ripiani alti: può ribaltarsi.", "struttura");
  if (CL.tenda && k.misure.alt > k.tenda.alt + 0.001) add("crit", "Lo scaffale non entra nella tenda", "Scaffale alto " + Math.round(k.misure.alt * 100) + " cm, tenda " + Math.round(k.tenda.alt * 100) + " cm: meno piani o ripiani più bassi.", "struttura");
  if (CL.tenda && !k.tenda.basta) add("crit", "Nessuna tenda standard abbastanza grande", "Servono più tende o una stanza dedicata.", "struttura");
  const pos = posizionaImpianto(c);
  if (pos && !pos.entra) add("crit", "Non entra nel locale", pos.motivo, "locale");
  const idr = idraulicaIdro(c);
  if (idr && idr.trabocca) add("crit", "Il serbatoio può traboccare", "A pompa ferma tornano giù circa " + Math.round(idr.volumeRitorno) + " L dai canali: serve più spazio libero nel serbatoio (o serbatoio più grande).", "serbatoio");
  if (k.L.eff < 2) add("warn", "Lampade poco efficienti", "Con LED bianchi buoni (2,7 µmol/J) la stessa luce costerebbe " + Math.round((1 - k.L.eff / 2.7) * 100) + "% di corrente in meno.", "luce");
  if (k.S.verticale) add("warn", "Verticale: si risparmia spazio, non luce", "Ogni pianta ha bisogno della stessa luce: le torri richiedono lampade intorno e più watt per pianta (luce persa nella geometria).", "sistema");
  if (k.S.tolleranza_ore <= 2 && !A.ups) add("crit", "Nessun UPS su un sistema a ricircolo", k.S.nome + ": senza pompa le radici seccano in " + k.S.tolleranza_ore + " ore. Prova il guasto 'Blackout'.", "ups");
  if (A.micro === "nessuno") add("warn", "Senza elettronica", "Nessun allarme: controlli tu ogni giorno livello, temperatura e perdite. Va bene per imparare con un impianto piccolo; con pompe e più di 50 L d'acqua in garage conviene il sensore di perdita.", "micro");
  if (!A.perdita && A.micro !== "nessuno") add(["kratky", "vassoi"].includes(I.sistema) ? "warn" : "crit", "Nessun sensore di perdita", "In garage una perdita bagna pavimento e prese: sensore a pavimento e ciabatta sollevata.", "sicurezza");
  if (!CL.tenda) add("warn", "Senza tenda", "Si scalda e si illumina tutto il garage: riscaldamento e umidità costano molto di più.", "tenda");
  if (I.acqua.durezza === "dura" && !I.acqua.osmosi) add("warn", "Acqua dura", "Parte da EC " + DUREZZE.dura.ec + ": per la lattuga resta poco spazio ai nutrienti e serve tanto pH-. Mescola acqua piovana o usa l'osmosi.", "acqua");
  if (I.acqua.osmosi) add("warn", "Osmosi: aggiungi calcio e magnesio", "L'acqua di osmosi è quasi pura: serve un cal-mag e la soluzione è meno tamponata (pH che si muove di più).", "acqua");
  if (!A.ph && !A.ec) add("warn", "Controllo manuale", "Misura pH ed EC con le penne 2-3 volte a settimana e correggi a mano: funziona, costa meno, rende un po' meno.", "sensori");
  if (A.dosaggio && (!A.ph || !A.ec)) add("crit", "Dosaggio automatico senza sonde", "I dosatori hanno bisogno delle sonde pH ed EC.", "dosaggio");
  if (A.dosaggio) add("warn", "Primo impianto: dosaggio a mano", "Consigliato partire con il controllo che propone e tu che dosi. Il dosaggio automatico solo dopo il collaudo documentato e con le sicurezze hardware (fungo, relè temporizzato, rilevatore di allagamento autonomo): sono già nella lista dei materiali.", "dosaggio");
    if (A.dosaggio) add("warn", "Dosaggio automatico: taratura", "Tara la sonda pH ogni " + A.taratura_giorni + " giorni e controlla con la penna ogni settimana: una sonda sbagliata manda il pH a picco (prova il guasto 'Sonda pH che deriva').", "dosaggio");
  if (!A.prese_smart && A.micro !== "nessuno") add("crit", "Carichi a 230 V", "Luci, stufetta e deumidificatore vanno comandati da prese smart certificate, non da relè fai da te.", "alimentazione");
  if (k.colture.some(x => x.coltura === "fragola" || x.coltura === "pomodoro" || x.coltura === "peperoncino")) add("warn", "Impollinazione", "Al chiuso non ci sono insetti: scuoti i fiori o usa un pennellino ogni giorno.", "colture");
  if (k.colture.some(x => x.coltura === "spinacio") && k.ore > 14) add("warn", "Spinacio e luce lunga", "Con più di 14 ore di luce lo spinacio va a seme.", "luce");
  if (I.sistema === "vassoi") add("warn", "Microgreens", "Niente nutrienti (o EC 0,5): il costo vero è il seme. Si vendono freschi a ristoranti: trova i clienti prima.", "colture");
  if (A.co2 && k.ppfd < 600) add("warn", "CO₂ poco utile", "Con meno di 600 µmol/m²/s la CO₂ aggiunta non dà quasi niente.", "sensori");
  return r;
}

function pinMappaIdro(c) {
  const A = c.idro.auto, righe = [];
  if (A.micro === "nessuno") return righe;
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
if (typeof module !== "undefined") module.exports = {microgreensVendita, MICRO_ESEMPIO, caricoScaffale, incertezzaIdro, lueIncidente, variaPianta, ACCLIMATAZIONE, misureImpianto, sceltaTenda, posizionaImpianto, TENDE, mappaLuce, idraulicaIdro, dimensioniPiano, FONTI, DATI_COLTURE, fTemp, coorte, calibraCrescita, vpd, simulaIdro, capacitaIdro, materialiIdro, compatibilitaIdro, pinMappaIdro, costiAnnuiIdro, economiaIdro, rispostaLuce, statoLuce, oreSettimanaIdro};
