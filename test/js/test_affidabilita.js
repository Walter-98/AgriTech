"use strict";
// "Quanto posso fidarmi": senza dati veri tutto è NON VALIDATO, qualunque sia il numero di test; con misure
// indipendenti lo stato cambia e riporta gli errori misurati.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();
const CAMPI = ["risultato", "modello", "fonte", "ipotizzati", "misurati", "prove", "calibrazione", "errori", "incertezza", "limiti", "stato"];

test("progetto nuovo: ogni risultato ha tutte le voci ed è NON VALIDATO", () => {
  for (const c of [Object.assign(config(G), {modalita: "idro"}), Object.assign(JSON.parse(JSON.stringify(G.ESEMPIO)), {modalita: "orto"})]) {
    const voci = c.modalita === "idro" ? G.materialiIdro(c) : G.materiali(c);
    const r = G.rapportoAffidabilita(c, null, voci);
    assert.ok(r.length >= 3);
    for (const x of r) { for (const k of CAMPI) assert.ok(k in x, x.risultato + " senza " + k); assert.equal(x.stato, "non_validato", x.risultato); assert.equal(x.errori, null); }
    assert.ok(r.every(x => /test|prov|nessuna/.test(x.prove)), "deve dire che cosa provano i test");
  }
});

test("con raccolti di validazione e clima verificato lo stato cambia e riporta gli errori misurati", () => {
  const c = Object.assign(config(G), {modalita: "idro"});
  const aggiungi = (ruolo, peso) => { const e = G.nuovoEsperimento(c, {coltura: "lattuga", semina: "2027-03-01", piante: 10, ruolo});
    G.concludiEsperimento(e, "2027-04-20", peso * 10, 10, null); };
  aggiungi("calibrazione", 150); aggiungi("validazione", 160); aggiungi("validazione", 140);
  const cr2 = G.rapportoAffidabilita(c, null, G.materialiIdro(c)).find(x => /Raccolto/.test(x.risultato));
  assert.equal(cr2.stato, "calibrato", "2 cicli di validazione non bastano per dire verificato");
  aggiungi("validazione", 155);
  const r = G.rapportoAffidabilita(c, null, G.materialiIdro(c));
  const cr = r.find(x => /Raccolto/.test(x.risultato));
  assert.equal(cr.stato, "verificato");
  assert.match(cr.errori, /3 cicli di validazione/);
  assert.equal(r.find(x => /Temperature/.test(x.risultato)).stato, "non_validato", "il clima resta non validato senza misure");
});
