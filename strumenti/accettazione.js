#!/usr/bin/env node
// Scrive ACCETTAZIONE_2.1.md con i tre scenari di accettazione (gemello/accettazione.js).
// Uso: node strumenti/accettazione.js [file]
const fs = require("fs"), path = require("path");
const {carica} = require(path.join(__dirname, "..", "test", "js", "carica.js"));
const G = carica();
const parti = ["# AgriTech 2.1 · Scenari di accettazione", "",
  "Generato da `node strumenti/accettazione.js` il " + new Date().toISOString().slice(0, 10) + ". Tutti i numeri sono **simulati**: nessuno è stato " +
  "confrontato con un impianto vero. Servono a controllare che il gemello dia risposte coerenti e oneste, non a promettere risultati.", ""];
for (const k of ["A", "B", "C"]) parti.push(G.rapportoAccettazione(G.eseguiAccettazione(k)));
const file = process.argv[2] || path.join(__dirname, "..", "ACCETTAZIONE_2.1.md");
fs.writeFileSync(file, parti.join("\n"));
console.log("scritto " + file);
