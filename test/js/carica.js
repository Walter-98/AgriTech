"use strict";
// Carica i moduli del gemello (script da browser senza DOM) in un contesto Node isolato.
const fs = require("fs"), path = require("path"), vm = require("vm");
const DIR = path.join(__dirname, "..", "..", "gemello");
function carica() {
  const ctx = vm.createContext({console, Math, Object, JSON, Array, Number, Set, String, Infinity, isFinite, isNaN, Error, Date});
  for (const f of ["dati.js", "progetto.js", "sim.js", "idro.js", "progetta.js", "registro.js", "documenti.js", "clima.js", "orto_minuti.js", "calibrazione.js", "esperimento.js"]) vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), ctx, {filename: f});
  vm.runInContext("globalThis.G = {ESEMPIO, IDRO_ESEMPIO, IDRO_PIANTE, LUCI_IDRO, SISTEMI_IDRO, capacitaIdro, simulaIdro, costiAnnuiIdro, materialiIdro, economiaIdro, rispostaLuce, statoLuce, somma, oreSettimanaIdro, progetta, RISPOSTE_ESEMPIO, LIVELLI_AUTO, compatibilitaIdro, PIANTE, FONTI, DATI_COLTURE, fTemp, coorte, vpd, mappaLuce, idraulicaIdro, misureImpianto, sceltaTenda, posizionaImpianto, TENDE, previsioneCiclo, confronto, applicaCalibrazione, tornaIndietro, fattoriAttivi, confrontoEnergia, misureDaCsv, giornoAnno, versioneConfig, calendarioIdro, pianoMontaggio, pianoCollaudo, ipotesiELimiti, NORMATIVA, simulaClimaIdro, confrontoAmbienti, calibraClima, parametriClima, MATERIALI_TENDA, LOCALI, incertezzaIdro, lueIncidente, variaPianta, congelaPrevisione, nuovoEsperimento, concludiEsperimento, valutaEsperimenti, metriche, statisticheEsperimenti, migra, esportaProgetto, importaProgetto, VERSIONE_SCHEMA, confrontaTecnologie, paretiani, caricoScaffale, microgreensVendita, MICRO_ESEMPIO, Controllore, ControlloreTimer, MondoOrto, eseguiCasoOrto, PARAMETRI_ORTO, simula, meteo, misureAmbienteDaCsv, aggregaOrarieAmbiente, csvModelloAmbiente, climaConMisure, giorniUtiliAmbiente, calibraAmbiente, statisticheErrore, VARIABILI_AMBIENTE, giornoAnno, PROVA_KRATKY, DIARIO_CAMPI, CONDIZIONI_INIZIALI, configProvaKratky, distintaProvaKratky, avviaProvaKratky, aggiungiDiario, raccoltaProvaKratky, analisiProvaKratky};", ctx);
  return ctx.G;
}
// configurazione di riferimento (copia profonda) con modifiche al ramo idro
function config(G, mod = {}) {
  const c = JSON.parse(JSON.stringify(Object.assign({}, G.ESEMPIO, {idro: G.IDRO_ESEMPIO})));
  for (const [k, v] of Object.entries(mod)) c.idro[k] = typeof v === "object" && !Array.isArray(v) ? Object.assign(c.idro[k] || {}, v) : v;
  return c;
}
module.exports = {carica, config};
