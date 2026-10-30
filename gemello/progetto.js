"use strict";
// Schema del progetto versionato: salvataggio e caricamento in JSON riproducibili, migrazione dei salvataggi vecchi.
// Lo stesso file JSON ricaricato dà gli stessi risultati (simulazioni deterministiche con seme fisso).
const VERSIONE_SCHEMA = 2;

function migra(cfg) {
  const c = JSON.parse(JSON.stringify(cfg));
  const v = c.versione_schema || 1;
  if (v < 2 && c.idro) {
    // schema 1 (prima di AgriTech 2.0): niente misure del ripiano, del locale, produzione, economia
    c.idro.produzione = Object.assign({mortalita: 5, fermo_giorni: 2, scarto: 10}, c.idro.produzione || {});
    c.idro.economia = Object.assign({vita_anni: 5, ore_settimana: 3, euro_ora: 0, persone: 3, quota_vendita: 0, prezzo_vendita: 70}, c.idro.economia || {});
    c.idro.locale = Object.assign({lung: 5, larg: 3, alt: 2.4, auto: true}, c.idro.locale || {});
    c.idro.luce = Object.assign({w_installati: 0, distanza_cm: 35}, c.idro.luce || {});
  }
  c.versione_schema = VERSIONE_SCHEMA;
  return c;
}
function esportaProgetto(cfg, risultati) {
  return JSON.stringify({formato: "agritech-progetto", versione_schema: VERSIONE_SCHEMA, salvato: new Date().toISOString(),
                         impronta: typeof versioneConfig === "function" ? versioneConfig(cfg) : "", configurazione: cfg, risultati: risultati || null}, null, 2);
}
function importaProgetto(testo) {
  let d;
  try { d = JSON.parse(testo); } catch (e) { throw new Error("Non è un file JSON"); }
  if (d.formato !== "agritech-progetto" || !d.configurazione) throw new Error("Non è un progetto AgriTech");
  if ((d.versione_schema || 1) > VERSIONE_SCHEMA) throw new Error("Progetto salvato con una versione più nuova del gemello");
  return {cfg: migra(Object.assign({versione_schema: d.versione_schema || 1}, d.configurazione)), salvato: d.salvato, impronta: d.impronta, risultati: d.risultati};
}
if (typeof module !== "undefined") module.exports = {VERSIONE_SCHEMA, migra, esportaProgetto, importaProgetto};
