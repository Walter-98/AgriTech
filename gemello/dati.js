"use strict";
// Dati del gemello AgriTech: clima, terreni, piante e catalogo dei componenti con prezzi, consumi e caratteristiche.
// Valori medi indicativi: i prezzi vanno verificati al momento dell'acquisto, il clima vero si scarica con
// strumenti/scarica_meteo.py, i consumi e le portate si tarano con le prove al banco (COLLAUDO.md).

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MESI_LUNGHI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const INIZIO_MESE = GIORNI_MESE.reduce((a, g, i) => { a.push(i ? a[i - 1] + GIORNI_MESE[i - 1] : 0); return a; }, []);

// ET0 mm/giorno, pioggia mm/mese, giorni di pioggia, temperatura media °C, sole kWh/m²/giorno
const REGIONI = {
  nord:   {nome: "Nord (pianura)", et0: [0.6, 1.1, 2.0, 3.0, 4.0, 4.8, 5.2, 4.4, 3.0, 1.6, 0.8, 0.5], p: [60, 55, 70, 80, 90, 65, 55, 70, 80, 100, 95, 65], gp: [7, 6, 7, 9, 9, 7, 5, 6, 6, 8, 8, 7], t: [2, 4, 9, 13, 18, 22, 25, 24, 19, 13, 7, 3], sole: [1.5, 2.4, 3.6, 4.6, 5.5, 6.2, 6.6, 5.6, 4.2, 2.7, 1.6, 1.2]},
  centro: {nome: "Centro", et0: [1.0, 1.5, 2.4, 3.3, 4.4, 5.4, 6.0, 5.3, 3.8, 2.3, 1.3, 0.9], p: [80, 75, 65, 70, 50, 30, 20, 35, 75, 110, 110, 90], gp: [8, 8, 8, 8, 6, 4, 2, 3, 6, 8, 9, 9], t: [8, 9, 11, 14, 18, 22, 25, 25, 21, 17, 12, 9], sole: [2.0, 2.9, 4.1, 5.1, 6.0, 6.8, 7.1, 6.3, 4.8, 3.4, 2.2, 1.7]},
  sud:    {nome: "Sud", et0: [1.1, 1.6, 2.6, 3.5, 4.6, 5.7, 6.3, 5.7, 4.1, 2.6, 1.5, 1.0], p: [90, 80, 70, 55, 35, 20, 15, 25, 60, 95, 110, 100], gp: [9, 8, 8, 7, 5, 3, 2, 3, 5, 8, 9, 10], t: [9, 10, 12, 15, 19, 23, 26, 26, 23, 18, 14, 11], sole: [2.3, 3.1, 4.3, 5.3, 6.3, 7.1, 7.4, 6.6, 5.1, 3.7, 2.5, 2.0]},
  isole:  {nome: "Isole (Sardegna, Sicilia)", et0: [1.2, 1.7, 2.7, 3.6, 4.8, 5.9, 6.6, 6.0, 4.3, 2.8, 1.6, 1.1], p: [65, 60, 50, 45, 30, 12, 5, 12, 40, 70, 85, 80], gp: [8, 7, 7, 6, 4, 2, 1, 2, 4, 7, 8, 9], t: [10, 10, 12, 14, 18, 22, 25, 26, 23, 19, 15, 11], sole: [2.4, 3.3, 4.5, 5.5, 6.6, 7.3, 7.6, 6.8, 5.3, 3.9, 2.7, 2.1]},
};
const ANNI = {medio: {nome: "Anno medio", pioggia: 1, et: 1}, secco: {nome: "Anno secco (metà pioggia, più caldo)", pioggia: 0.5, et: 1.1}, piovoso: {nome: "Anno piovoso", pioggia: 1.6, et: 0.95}};
const TERRENI = {
  sabbioso:  {nome: "Sabbioso (sciolto)", cap: 35, dren: 30},
  medio:     {nome: "Medio (franco)", cap: 60, dren: 8},
  argilloso: {nome: "Argilloso (pesante)", cap: 85, dren: 2},
  terriccio: {nome: "Terriccio da vaso (cassoni)", cap: 70, dren: 20},
};
const AMBIENTI = {
  esterno: {nome: "Orto all'aperto", descr: "Pioggia, sole e vento veri: la cisterna raccoglie dal tetto."},
  serra:   {nome: "Serra a tunnel", descr: "Niente pioggia sulle piante, più caldo (+6 °C), stagione più lunga; si ventila d'estate."},
  interno: {nome: "Stanza interna con luci LED", descr: "Clima costante, luce solo dai LED: la corrente diventa la spesa principale."},
};

// Piante: coefficiente colturale, mesi di semina/trapianto, giorni del ciclo, piante per m², resa kg/m² per ciclo, €/kg al negozio
const PIANTE = {
  pomodoro:  {nome: "Pomodoro", kc: 1.10, mesi: [4, 5], giorni: 120, m2: 2.5, resa: 6, prezzo: 2.5, foglie: "Bagnare le foglie favorisce la peronospora: solo goccia."},
  zucchina:  {nome: "Zucchina", kc: 1.00, mesi: [4, 5, 6], giorni: 90, m2: 1, resa: 5, prezzo: 2.0, foglie: "Oidio con foglie bagnate la sera."},
  peperone:  {nome: "Peperone", kc: 1.05, mesi: [4, 5], giorni: 120, m2: 3, resa: 3, prezzo: 3.0},
  melanzana: {nome: "Melanzana", kc: 1.05, mesi: [4, 5], giorni: 120, m2: 2.5, resa: 4, prezzo: 2.5},
  fagiolino: {nome: "Fagiolino", kc: 1.05, mesi: [4, 5, 6, 7], giorni: 75, m2: 12, resa: 1.5, prezzo: 4.0},
  lattuga:   {nome: "Lattuga", kc: 1.00, mesi: [3, 4, 5, 8, 9], giorni: 60, m2: 9, resa: 2.5, prezzo: 2.0},
  rucola:    {nome: "Rucola", kc: 1.00, mesi: [3, 4, 9, 10], giorni: 40, m2: 100, resa: 1.2, prezzo: 10},
  spinacio:  {nome: "Spinacio", kc: 1.00, mesi: [2, 3, 9, 10], giorni: 50, m2: 40, resa: 1.5, prezzo: 4.0},
  basilico:  {nome: "Basilico", kc: 1.00, mesi: [4, 5, 6], giorni: 90, m2: 16, resa: 1.2, prezzo: 15},
  carota:    {nome: "Carota", kc: 1.00, mesi: [3, 4, 7, 8], giorni: 100, m2: 80, resa: 3, prezzo: 1.5},
  patata:    {nome: "Patata", kc: 1.10, mesi: [2, 3, 4], giorni: 110, m2: 4, resa: 3, prezzo: 1.2},
  cipolla:   {nome: "Cipolla", kc: 1.00, mesi: [2, 3, 10], giorni: 150, m2: 40, resa: 3, prezzo: 1.5},
  aglio:     {nome: "Aglio", kc: 0.95, mesi: [10, 11], giorni: 230, m2: 30, resa: 1, prezzo: 6},
  fava:      {nome: "Fava", kc: 1.05, mesi: [10, 11], giorni: 180, m2: 8, resa: 1.5, prezzo: 3.0},
  cavolo:    {nome: "Cavolfiore", kc: 1.00, mesi: [7, 8], giorni: 120, m2: 3, resa: 2.5, prezzo: 2.0},
  fragola:   {nome: "Fragola", kc: 0.90, mesi: [3, 4, 9], giorni: 365, m2: 8, resa: 1.2, prezzo: 6},
};

// ---------- catalogo dei componenti ----------
// p: prezzo indicativo [min, max] €; w: consumo medio in watt; altri campi specifici per famiglia.
const CATALOGO = {
  micro: {
    titolo: "Microcontrollore",
    spiega: "Il cervello del quadro: legge i sensori e comanda pompa e valvole con la logica provata nel simulatore.",
    opzioni: {
      esp32:   {nome: "ESP32 DevKit", p: [6, 10], w: 0.5, w_sonno: 0.06, adc: 6, wifi: true, tensione: 12, linguaggio: "MicroPython", firmware: "pronto nel repository (firmware/esp32-irrigazione)", pro: "Economico, Wi-Fi, simulabile gratis su Wokwi.", contro: "ADC poco lineare sopra 2,5 V (si tara)."},
      esp32s3: {nome: "ESP32-S3 DevKit", p: [9, 14], w: 0.55, w_sonno: 0.05, adc: 10, wifi: true, tensione: 12, linguaggio: "MicroPython", firmware: "pronto (cambiare i pin in config.py)", pro: "Più ingressi analogici, più memoria.", contro: "Costa un po' di più."},
      picow:   {nome: "Raspberry Pi Pico W", p: [7, 9], w: 0.3, w_sonno: 0.02, adc: 3, wifi: true, tensione: 12, linguaggio: "MicroPython", firmware: "da adattare: stessa logica, pin diversi", pro: "Consuma poco, ADC preciso.", contro: "Solo 3 ingressi analogici: oltre 3 zone serve un ADS1115."},
      arduino: {nome: "Arduino Uno R4 WiFi", p: [25, 30], w: 0.6, w_sonno: 0.3, adc: 6, wifi: true, tensione: 12, linguaggio: "C++ (Arduino)", firmware: "da riscrivere in C++ (la logica è la stessa)", pro: "Robusto, tanta documentazione, morsetti 5 V.", contro: "Più caro; la logica del repository va riscritta in C++."},
      pizero:  {nome: "Raspberry Pi Zero 2 W", p: [18, 25], w: 0.9, w_sonno: 0.9, adc: 0, wifi: true, tensione: 12, linguaggio: "Python (Linux)", firmware: "controllo.py gira direttamente in Python", pro: "Fa anche da centrale (dati, pannello) nello stesso quadro.", contro: "Nessun ingresso analogico (serve ADS1115), scheda SD che si rovina con i blackout, consuma di più."},
      logo:    {nome: "Siemens LOGO! 8 (PLC)", p: [130, 190], w: 1.5, w_sonno: 1.5, adc: 4, wifi: false, tensione: 24, linguaggio: "LOGO!Soft Comfort", firmware: "programma a blocchi (simulatore logo_sim.py in agenti-automazione)", pro: "Industriale: robusto, morsetti a vite, alimentazione 24 V.", contro: "Costa 20 volte un ESP32, ingressi 0-10 V, niente Wi-Fi senza modulo."},
    },
  },
  sensore_suolo: {
    titolo: "Sensore di umidità del terreno",
    spiega: "Uno (o più) per zona. È il componente che decide quanta acqua dare: un sensore sbagliato fa seccare o allagare.",
    opzioni: {
      capacitivo:  {nome: "Capacitivo v2.0", p: [2, 3], w: 0.02, rumore: 0.03, deriva: 0.0002, vita: 900, pro: "Economico, non si corrode (nessun metallo nel terreno).", contro: "Rumore di qualche %, va tarato in aria e in acqua.", forma: "lama"},
      resistivo:   {nome: "Resistivo a forchetta", p: [1, 1.5], w: 0.02, rumore: 0.05, deriva: 0.004, vita: 75, pro: "Il più economico.", contro: "Gli elettrodi si corrodono in 2-3 mesi: la lettura scivola verso 'secco' e il sistema allaga.", forma: "forchetta"},
      professionale: {nome: "Professionale RS485/SDI-12 (umidità + temperatura)", p: [35, 60], w: 0.15, rumore: 0.01, deriva: 0, vita: 3650, pro: "Preciso (±2%), dura anni, cavi lunghi senza disturbi.", contro: "Costa 15-20 volte un capacitivo, serve un convertitore RS485.", forma: "sonda"},
      tensiometro: {nome: "Tensiometro con trasduttore", p: [60, 90], w: 0.05, rumore: 0.015, deriva: 0.0008, vita: 1800, manutenzione: "da riempire d'acqua ogni mese", pro: "Misura quanto la pianta fatica a prendere l'acqua: il dato più vicino alla pianta.", contro: "Caro, va riempito ogni mese, non funziona in terreno molto secco.", forma: "tubo"},
    },
  },
  aria: {
    titolo: "Sensore dell'aria",
    spiega: "Temperatura e umidità dell'aria: blocca l'irrigazione col gelo, avvisa col caldo; in serra e in casa comanda la ventola.",
    opzioni: {
      nessuno: {nome: "Nessuno", p: [0, 0], w: 0},
      dht22:   {nome: "DHT22", p: [3, 5], w: 0.01, pro: "Economico e semplice.", contro: "Impreciso con umidità alta (serra) dopo un paio d'anni."},
      bme280:  {nome: "BME280 (anche pressione)", p: [4, 7], w: 0.01, pro: "Preciso, misura anche la pressione (aiuta a prevedere il tempo).", contro: "Bus I²C: cavo corto (meno di 1-2 m)."},
      sht31:   {nome: "SHT31 in capsula da esterno", p: [8, 14], w: 0.01, pro: "Il più affidabile in serra e all'aperto.", contro: "Costa di più."},
    },
  },
  livello: {
    titolo: "Livello della cisterna",
    spiega: "I litri che restano: riserva, previsione, e per scoprire una pompa che gira a vuoto.",
    opzioni: {
      nessuno:    {nome: "Solo galleggiante", p: [0, 0], w: 0},
      ultrasuoni: {nome: "Ultrasuoni JSN-SR04T", p: [6, 9], w: 0.03, pro: "Senza contatto con l'acqua.", contro: "Condensa e gocce danno letture a salti."},
      pressione:  {nome: "Sonda di pressione sommersa 4-20 mA", p: [25, 45], w: 0.2, pro: "Precisa, non sente la condensa.", contro: "Cara, serve un convertitore 4-20 mA."},
    },
  },
  pompa: {
    titolo: "Pompa",
    spiega: "Spinge l'acqua dalla cisterna. Con il rubinetto non serve.",
    opzioni: {
      membrana_piccola: {nome: "A membrana 12 V, 1,5 L/min, 12 W", p: [8, 15], w: 12, portata: 1.5, pro: "Autoadescante, economica.", contro: "Rumorosa, portata bassa."},
      membrana_media:   {nome: "A membrana 12 V, 3,5 L/min, 36 W", p: [15, 30], w: 36, portata: 3.5, pro: "Basta per 4 zone grandi.", contro: "Assorbe 3 A: alimentatore e cavi adeguati."},
      sommersa:         {nome: "Sommersa 12 V brushless, 8 L/min, 20 W", p: [20, 35], w: 20, portata: 8, pro: "Silenziosa, efficiente, dentro la cisterna.", contro: "Non autoadescante; il cavo entra nella cisterna."},
    },
  },
  valvole: {
    titolo: "Elettrovalvole",
    spiega: "Una per zona: si aprono solo quando l'ESP32 le comanda.",
    opzioni: {
      solenoide:   {nome: "Solenoide 12 V normalmente chiusa", p: [5, 8], w_aperta: 5, pro: "Economica, semplice; senza corrente resta chiusa.", contro: "Consuma 5 W per tutto il tempo che è aperta: pesa col solare."},
      bistabile:   {nome: "Bistabile (latching) 9-12 V", p: [9, 14], w_aperta: 0.05, driver: true, pro: "Consuma solo un impulso per aprire e chiudere: ideale col pannello.", contro: "Serve un driver a ponte H; se manca la corrente resta come era."},
      motorizzata: {nome: "Valvola a sfera motorizzata 12 V", p: [14, 22], w_aperta: 0.1, pro: "Non si blocca con lo sporco, tiene anche alta pressione.", contro: "Più cara e lenta (5 s per aprire)."},
    },
  },
  erogatori: {
    titolo: "Erogatori",
    spiega: "Come esce l'acqua sulle piante.",
    opzioni: {
      goccia:  {nome: "Ala gocciolante 2 L/h ogni 30 cm", p_m: [0.25, 0.4], l_min_m2: 0.19, efficienza: 0.9, pro: "Acqua alle radici, foglie asciutte.", contro: "Gocciolatoi che si tappano senza filtro."},
      spruzzo: {nome: "Micro-irrigatori a spruzzo", p_m: [0.8, 1.2], l_min_m2: 0.65, efficienza: 0.75, pro: "Bagna tutta la superficie (semine fitte).", contro: "Un quarto dell'acqua va persa col vento e il sole; bagna le foglie."},
      poroso:  {nome: "Tubo poroso (trasudante)", p_m: [0.5, 0.8], l_min_m2: 0.1, efficienza: 0.92, pro: "Il più dolce, ottimo nei cassoni.", contro: "Portata bassa: tempi lunghi; si intasa con acqua dura."},
    },
  },
  alimentazione: {
    titolo: "Alimentazione",
    spiega: "Da dove arriva la corrente.",
    opzioni: {
      rete:   {nome: "Presa di casa → alimentatore 12 V", p: [8, 12], w_perdite: 0.4},
      solare: {nome: "Pannello solare + batteria", p: [0, 0], w_perdite: 0},
    },
  },
  batteria: {
    titolo: "Batteria (solare)",
    opzioni: {
      piombo: {nome: "Piombo AGM 12 V", euro_ah: [1.9, 2.6], utile: 0.5, anni: 4, pro: "Economica.", contro: "Si usa metà della capacità, dura 3-5 anni."},
      litio:  {nome: "Litio LiFePO4 12 V", euro_ah: [4, 6], utile: 0.9, anni: 10, pro: "Si usa quasi tutta, dura 10 anni.", contro: "Costa il doppio; non si carica sotto 0 °C."},
    },
  },
  regolatore: {
    titolo: "Regolatore di carica (solare)",
    opzioni: {
      pwm:  {nome: "PWM 10 A", p: [8, 12], resa: 0.75},
      mppt: {nome: "MPPT 10 A", p: [25, 45], resa: 0.92},
    },
  },
  connessione: {
    titolo: "Connessione",
    spiega: "Come arrivano dati e avvisi al telefono. Le sicurezze funzionano anche senza.",
    opzioni: {
      nessuna: {nome: "Nessuna (solo LED sul quadro)", p: [0, 0], w: 0, anno: 0},
      wifi:    {nome: "Wi-Fi di casa", p: [0, 0], w: 0.15, anno: 0, pro: "Gratis se il segnale arriva all'orto.", contro: "Portata 20-50 m; oltre serve un ripetitore (15-25 €)."},
      lora:    {nome: "LoRa (fino a 2-5 km)", p: [15, 25], w: 0.05, anno: 0, pro: "Lontano e con pochissimo consumo: ideale per orti fuori casa.", contro: "Serve un gateway (o una rete TTN in zona); pochi dati per volta."},
      g4:      {nome: "4G con SIM dati", p: [25, 40], w: 0.8, anno: 12, pro: "Funziona ovunque ci sia campo.", contro: "SIM da pagare ogni anno, consuma di più."},
    },
  },
  centrale: {
    titolo: "Centrale (dati e avvisi)",
    opzioni: {
      nessuna: {nome: "Nessuna", p: [0, 0]},
      pc:      {nome: "Vecchio PC o portatile di casa", p: [0, 0]},
      rpi:     {nome: "Raspberry Pi 4 dedicato", p: [45, 65]},
    },
  },
  quadro: {
    titolo: "Quadro elettrico",
    opzioni: {
      ip65:    {nome: "Scatola stagna IP65 con pressacavi", p: [8, 15], stagno: true},
      normale: {nome: "Scatola di plastica qualsiasi", p: [2, 5], stagno: false},
    },
  },
};
// Sensori e accessori sì/no
const EXTRA = {
  galleggiante: {nome: "Galleggiante di minimo in cisterna", p: [2, 3], w: 0, spiega: "La pompa non gira mai a secco."},
  flussimetro:  {nome: "Flussimetro YF-S201", p: [3, 6], w: 0.03, spiega: "Perdite e tubi scoppiati in 2 minuti, pompa guasta anche senza sensore di livello."},
  pioggia:      {nome: "Sensore di pioggia", p: [2, 5], w: 0.01, spiega: "Distingue la pioggia da una valvola bloccata aperta; fuori dalla serra."},
  sonda_quadro: {nome: "Sonda acqua sul fondo del quadro", p: [1, 2], w: 0, spiega: "Se entra acqua nel quadro: allarme e pompa ferma."},
  luce:         {nome: "Sensore di luce BH1750", p: [2, 4], w: 0.01, spiega: "Quanta luce prendono le piante; in casa controlla che i LED funzionino."},
  co2:          {nome: "Sensore CO₂ SCD40", p: [30, 45], w: 0.2, spiega: "In stanza chiusa la CO₂ scende e le piante crescono meno: comanda il ricambio d'aria."},
  step_down:    {nome: "Step-down separato per l'ESP32 + condensatore 1000 µF", p: [2, 3], w: 0, spiega: "Evita i riavvii quando parte la pompa."},
  ups:          {nome: "Mini UPS 12 V (batteria tampone)", p: [20, 35], w: 0.3, spiega: "Tiene acceso l'impianto durante i blackout (rete)."},
  filtro:       {nome: "Filtro a rete", p: [3, 5], w: 0, spiega: "Lo sporco tappa i gocciolatoi e blocca le valvole aperte."},
  ads1115:      {nome: "Convertitore analogico ADS1115 (4 ingressi)", p: [3, 5], w: 0.01, spiega: "Aggiunge 4 ingressi per i sensori quando il microcontrollore non ne ha abbastanza."},
};

const PRESET = {
  base: {nome: "Base", descr: "Il minimo che funziona in sicurezza: ESP32, sensori capacitivi, galleggiante.",
         componenti: {micro: "esp32", sensore_suolo: "capacitivo", sensori_zona: 1, aria: "nessuno", livello: "nessuno", valvole: "solenoide", erogatori: "goccia", connessione: "nessuna", centrale: "nessuna", quadro: "ip65", quadro_cm: 5},
         extra: {galleggiante: true, flussimetro: false, pioggia: false, sonda_quadro: false, luce: false, co2: false, step_down: false, ups: false, filtro: false}},
  sicuro: {nome: "Sicuro (consigliato)", descr: "In più tutto quello che il simulatore ha dimostrato necessario: alimentazione separata, quadro rialzato con sonda, aria e livello.",
         componenti: {micro: "esp32", sensore_suolo: "capacitivo", sensori_zona: 1, aria: "dht22", livello: "ultrasuoni", valvole: "solenoide", erogatori: "goccia", connessione: "wifi", centrale: "nessuna", quadro: "ip65", quadro_cm: 55},
         extra: {galleggiante: true, flussimetro: false, pioggia: false, sonda_quadro: true, luce: false, co2: false, step_down: true, ups: false, filtro: true}},
  completo: {nome: "Completo", descr: "In più flussimetro, pioggia, centrale e avvisi sul telefono: ti accorgi dei guasti in giornata.",
         componenti: {micro: "esp32", sensore_suolo: "capacitivo", sensori_zona: 2, aria: "sht31", livello: "ultrasuoni", valvole: "solenoide", erogatori: "goccia", connessione: "wifi", centrale: "pc", quadro: "ip65", quadro_cm: 55},
         extra: {galleggiante: true, flussimetro: true, pioggia: true, sonda_quadro: true, luce: true, co2: false, step_down: true, ups: false, filtro: true}},
};

const GUASTI = {
  sensore_staccato:    {nome: "Sensore staccato", zona: true, spiega: "Il cavo si stacca: il sensore legge fuori campo."},
  sensore_fuori_terra: {nome: "Sensore uscito dalla terra", zona: true, spiega: "Legge sempre 'secco'."},
  tubo_rotto:          {nome: "Tubo staccato", zona: true, spiega: "L'acqua esce prima di arrivare alle piante."},
  valvola_aperta:      {nome: "Valvola bloccata aperta", zona: true, spiega: "Ogni volta che la pompa gira, bagna anche questa zona."},
  pompa_guasta:        {nome: "Pompa guasta", zona: false, spiega: "Gira ma non spinge acqua."},
  blackout:            {nome: "Blackout", zona: false, durata: true, spiega: "Manca la corrente per alcuni giorni."},
  alimentatore_debole: {nome: "Alimentatore debole", zona: false, spiega: "Alla partenza della pompa la tensione cala e il microcontrollore si riavvia."},
  nubifragio:          {nome: "Nubifragio (90 mm)", zona: false, spiega: "Tre ore di pioggia fortissima (fuori e sul tetto)."},
};

const ALLARMI = [
  ["Zx_SENSORE", "Sensore staccato o in corto: la zona riceve poca acqua a tempo, mai a sensore.", "Controlla cavo e connettore del sensore.", "Da solo quando il sensore torna a leggere."],
  ["Zx_INEFFICACE", "Dopo un'irrigazione l'umidità non è salita: tubo staccato, valvola ferma, sensore fuori terra. Zona bloccata.", "Guarda tubi e gocciolatoi della zona, riposiziona il sensore.", "Pulsante reset."],
  ["Zx_PERDITA", "Il flussimetro vede il doppio dell'acqua: tubo scoppiato o raccordo saltato. Zona bloccata.", "Cerca la pozza lungo la linea della zona.", "Pulsante reset."],
  ["Zx_ACQUA_INATTESA", "Una zona si bagna senza pioggia e senza la sua valvola: valvola bloccata aperta. Si irriga solo finché quella zona non è troppo bagnata.", "Pulisci o cambia la valvola; metti il filtro a rete.", "Pulsante reset."],
  ["Zx_ALLAGATA", "Terreno saturo da oltre 6 ore: acqua ferma sulle radici. Non si irriga.", "Apri un solco di scolo; in futuro aiuola rialzata.", "Da solo quando l'acqua va via."],
  ["SERBATOIO_BASSO", "Cisterna al minimo: pompa ferma per non girare a secco.", "Riempi la cisterna o collega il rubinetto.", "Da solo quando l'acqua risale."],
  ["SERBATOIO_RISERVA", "Cisterna sotto la riserva: si irriga con soglie di risparmio.", "Niente di urgente: tieni d'occhio le piante.", "Da solo."],
  ["POMPA_NON_EROGA", "La pompa gira ma l'acqua non esce. Irrigazione bloccata.", "Controlla pompa, aspirazione, fusibile, filtro.", "Pulsante reset."],
  ["ALLAGAMENTO_QUADRO", "Acqua sul fondo del quadro: pompa e valvole ferme.", "Togli corrente, asciuga, trova da dove entra.", "Da solo quando la sonda è asciutta."],
  ["BATTERIA_BASSA", "Batteria sotto il 35%: pompa ferma, il microcontrollore resta acceso e avvisa.", "Pannello sporco o troppo piccolo: vedi il dimensionamento.", "Da solo quando la batteria si ricarica."],
  ["RIAVVII_FREQUENTI", "Il microcontrollore si è riavviato 3 volte di fila con la pompa accesa: alimentazione che cede. Tutto fermo.", "Alimentatore con margine, step-down separato, condensatore, cavi della pompa.", "Pulsante reset."],
  ["GELO", "Sotto 2 °C: niente irrigazione.", "Copri le piantine; a fine stagione svuota i tubi.", "Da solo."],
  ["CALDO", "Sopra 38 °C.", "Guarda le piante, ombreggia le insalate; in serra apri o accendi la ventola.", "Da solo."],
];

const ESEMPIO = {
  regione: "isole", anno: "medio", terreno: "medio", ambiente: "esterno",
  interno: {led_w_m2: 100, ore_luce: 16, temp: 22, ventola_w: 15},
  zone: [
    {coltura: "pomodoro", area: 4, mese: 4, cicli: 1, pacciamatura: true, rialzata: false},
    {coltura: "zucchina", area: 3, mese: 5, cicli: 1, pacciamatura: true, rialzata: false},
    {coltura: "lattuga", area: 2, mese: 3, cicli: 2, pacciamatura: false, rialzata: true},
    {coltura: "basilico", area: 1, mese: 5, cicli: 1, pacciamatura: false, rialzata: true},
  ],
  acqua: {fonte: "cisterna", cisterna_l: 1000, tetto_m2: 15, rete_riserva: true},
  prezzi: {kwh: 0.30, acqua_m3: 2.0},
  preset: "sicuro",
  componenti: Object.assign({pompa: "membrana_piccola", alimentazione: "rete", pannello_w: 30, batteria: "piombo", batteria_ah: 18, regolatore: "pwm", sonno: false, sostituzione_mesi: 0},
                            PRESET.sicuro.componenti),
  extra: Object.assign({}, PRESET.sicuro.extra),
  logica: {strategia: "sensori", soglia_on: 45, soglia_off: 70, soglia_critica: 30, pioggia_salta_mm: 3, max_min: 10, pausa_min: 60,
           timer_min: 15, emergenza_min: 3, blocco_gelo: true, riserva_l: 300, acqua_inattesa: true},
  guasti: [],
  reazione_giorni: null,
};
