"use strict";
// "Quanto posso fidarmi di questa previsione?". Per ogni risultato del gemello: modello e versione, fonte dei dati,
// parametri ipotizzati e misurati, prove automatiche, calibrazione, errori misurati, incertezza, limiti.
// Regola: le prove automatiche dicono che il codice fa quello che dichiara, NON che la previsione è giusta. Senza
// misure vere su dati indipendenti un risultato è "non validato", qualunque sia il numero di test che passano.

const numA = (v, d = 0) => Number(v).toLocaleString("it-IT", {minimumFractionDigits: d, maximumFractionDigits: d});
const euroA = v => numA(v) + " €";
const VERSIONE_MODELLI = {
  orto: "2.1 · terreno e irrigazione minuto per minuto, stessa logica di sistema/controllo.py (ESP32)",
  crescita: "2.0 · LUE sulla luce intercettata, temperatura, acclimatazione",
  clima: "2.0 · bilancio termico orario esterno → garage → tenda → serbatoio",
  luce: "2.0 · PPFD e DLI dai watt, mappa sul piano",
  economia: "2.1 · CAPEX dalla distinta con stato dei prezzi, OPEX, ammortamento, VAN e TIR",
};
const STATO_VALIDAZIONE = {
  non_validato: "NON VALIDATO con dati reali",
  calibrato: "CALIBRATO, non ancora verificato su dati indipendenti",
  verificato: "VERIFICATO su dati indipendenti",
};

function rapportoAffidabilita(c, S, voci) {
  return c.modalita === "idro" ? affidabilitaIdro(c, S, voci) : affidabilitaOrto(c, S, voci);
}

function sezionePrezzi(voci) {
  const r = riepilogoPrezzi(voci || []);
  return {risultato: "Spesa iniziale e costo al kg", modello: VERSIONE_MODELLI.economia,
    fonte: Math.round((1 - r.quotaStimata) * 100) + "% della spesa da prezzi verificati, il resto stime del gemello",
    ipotizzati: ["prezzi stimati a forbice per " + Math.round(r.quotaStimata * 100) + "% della spesa", "vita dell'impianto", "tasso del 3% per il VAN"],
    misurati: r.per.verificato > 0 ? ["prezzi controllati dall'utente con link e data (" + euroA(r.per.verificato) + ")"] : [],
    prove: "test/js/test_catalogo.js, test_idro.js: i conti sono coerenti (somme, IVA, ricalcolo)",
    calibrazione: "non applicabile", errori: null,
    incertezza: "forbice minimo-massimo della distinta; analisi di sensibilità nella scheda Costi",
    limiti: "prezzi che cambiano nel tempo; spedizioni e sconti; i consumi di corrente vengono dalla simulazione",
    stato: r.provvisorio ? "non_validato" : "verificato", nota: r.giudizio};
}

function affidabilitaIdro(c, S, voci) {
  const I = c.idro, cal = (I.clima || {}).calibrazione, val = valutaEsperimenti(I);
  const amb = (I.ambiente_misure || []).length ? calibraAmbiente(c, I.ambiente_misure, {partenza: cal}) : null;
  const meteo = c.meteoReale ? "meteo vero: " + c.meteoReale.fonte : "clima medio della zona " + (REGIONI[c.regione] || {}).nome + " (anno tipo, non il tuo anno)";
  const statoClima = amb && amb.stato === "verificato" && cal && cal.dal ? "verificato" : cal ? "calibrato" : "non_validato";
  // almeno 3 cicli di validazione per dire "verificato": uno o due dicono solo quanto ha sbagliato quelle volte
  const statoCrescita = val.validazione && val.validazione.n >= 3 ? "verificato" : val.validazione || val.calibrazione ? "calibrato" : "non_validato";
  const errCrescita = val.validazione ? "su " + val.validazione.n + " cicli di validazione: errore medio " + numA(val.validazione.mae, 0) + " g per pianta, bias " + numA(val.validazione.bias, 0) + " g" +
    (val.copertura != null ? ", " + Math.round(val.copertura * 100) + "% dentro la forbice P10-P90" : "") : null;
  return [
    {risultato: "Raccolto (kg all'anno, peso per pianta, giorni)", modello: VERSIONE_MODELLI.crescita,
     fonte: "parametri delle colture da letteratura (affidabilità A-D in MODELLI.md) e " + meteo,
     ipotizzati: ["efficienza della luce (LUE)", "temperature cardinali delle colture", "piante perse " + ((I.produzione || {}).mortalita ?? 5) + "%", "scarto " + ((I.produzione || {}).scarto ?? 10) + "%"],
     misurati: [val.righe.length ? val.righe.length + " raccolti registrati nel laboratorio" : null].filter(Boolean),
     prove: "test/js/test_crescita.js confronta con dati pubblicati (non con il tuo impianto); test_laboratorio.js e test_esperimento_kratky.js controllano i conti",
     calibrazione: val.calibrazione ? "sì, " + val.calibrazione.n + " cicli di calibrazione" : "no",
     errori: errCrescita, incertezza: "P10-P90 nella scheda Costi (40 simulazioni) e nella previsione congelata di ogni prova",
     limiti: "varietà, piantine di partenza, malattie, alghe e carenze non sono nel modello; valido per lattuga, basilico, rucola, fragole e microgreens alle condizioni dichiarate",
     stato: statoCrescita},
    {risultato: "Temperature della tenda, del garage e della soluzione", modello: VERSIONE_MODELLI.clima,
     fonte: meteo, ipotizzati: ["dispersioni del garage (tipo di locale)", "sole sul garage", "ricambi d'aria", "potenza delle lampade"],
     misurati: amb && amb.utili ? [amb.utili + " giorni misurati nella scheda Calibrazione"] : [],
     prove: "test/js/test_clima.js (bilancio dell'energia < 0,1%) e test_calibrazione_ambiente.js (ritrova parametri nascosti)",
     calibrazione: cal ? "sì: dispersioni ×" + numA(cal.fUA, 2) + ", sole ×" + numA(cal.fSole, 1) + (cal.dal ? " (misure " + cal.dal + " – " + cal.al + ")" : " (senza giorni di verifica)") : "no",
     errori: amb && amb.verifica ? "su " + amb.verifica.giorni + " giorni di verifica: RMSE " + numA(amb.verifica.rmseDopo, 1) + " °C" : null,
     incertezza: amb && amb.verifica ? "con i parametri compatibili l'errore va da " + numA(amb.verifica.rmseCompatibili[0], 1) + " a " + numA(amb.verifica.rmseCompatibili[1], 1) + " °C" : "non misurata",
     limiti: "un garage con fonti di calore o spifferi non modellati; vale per la stagione in cui è stato misurato", stato: statoClima},
    {risultato: "Corrente (kWh all'anno)", modello: VERSIONE_MODELLI.luce + "; " + VERSIONE_MODELLI.clima,
     fonte: "watt delle lampade e del clima dal progetto", ipotizzati: ["watt veri delle lampade", "ore di luce", "stufetta e ventole secondo il clima simulato"],
     misurati: (I.energia || []).length ? [(I.energia || []).length + " letture del contatore nel Registro"] : [],
     prove: "test/js/test_idro.js (conti dell'energia)", calibrazione: "no", errori: (I.energia || []).length ? "confronto nel Registro (scheda Registro)" : null,
     incertezza: "±10% sui kWh nella simulazione dell'incertezza", limiti: "stufetta e deumidificatore dipendono dal clima, che può non essere validato", stato: (I.energia || []).length ? "calibrato" : "non_validato"},
    sezionePrezzi(voci),
  ];
}

function affidabilitaOrto(c, S, voci) {
  const meteo = c.meteoReale ? "meteo vero: " + c.meteoReale.fonte : "meteo sintetico della zona " + (REGIONI[c.regione] || {}).nome;
  return [
    {risultato: "Acqua per l'irrigazione e decisioni della centralina", modello: VERSIONE_MODELLI.orto,
     fonte: meteo + "; terreno " + (TERRENI[c.terreno] || {}).nome,
     ipotizzati: ["capacità del terreno e drenaggio (tabella)", "coefficienti colturali Kc (FAO-56)", "portata degli erogatori", "taratura del sensore (0,92 a capacità di campo)"],
     misurati: [], prove: "test/js/test_orto_differenziale.js: il browser dà gli stessi eventi e litri del motore Python (16 casi, anno intero compreso); è un controllo del codice, non del tuo orto",
     calibrazione: "no", errori: null, incertezza: "non stimata: l'errore dipende soprattutto da terreno e sensori veri",
     limiti: "un solo strato di terreno; pioggia distribuita tra le 14 e le 17; niente ruscellamento in pendenza", stato: "non_validato"},
    {risultato: "Raccolto (kg all'anno)", modello: "tabella di resa per coltura ridotta dai giorni di sofferenza e di ristagno",
     fonte: "rese medie indicative (dati.js)", ipotizzati: ["resa per m²", "effetto della sofferenza (−2% al giorno)"], misurati: [],
     prove: "nessuna prova contro dati misurati", calibrazione: "no", errori: null, incertezza: "non stimata (vedi sensibilità: resa 0,6-1,2×)",
     limiti: "varietà, concimazione, parassiti e malattie non sono nel modello", stato: "non_validato"},
    sezionePrezzi(voci),
  ];
}
if (typeof module !== "undefined") module.exports = {VERSIONE_MODELLI, STATO_VALIDAZIONE, rapportoAffidabilita};
