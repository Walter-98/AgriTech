"use strict";
// Prezzi tracciabili della distinta. I prezzi interni del gemello sono STIME a forbice (nessun fornitore, codice o
// disponibilità inventati). L'utente aggiunge le offerte che ha controllato davvero: fornitore, link, prezzo, IVA,
// spedizione, data. Ogni voce della distinta prende uno stato:
//   verificato       offerta con link controllata da non più di GIORNI_VERIFICATO giorni
//   storico          offerta più vecchia: il prezzo può essere cambiato
//   stimato          nessuna offerta: forbice del gemello
//   non_disponibile  l'utente ha segnato il prodotto come non disponibile (resta la stima, segnalata)
// Le offerte stanno in c.prezzi_verificati = {chiave voce: [offerte]} e si applicano dentro materiali() e
// materialiIdro(): CAPEX, costi annui ed economia si ricalcolano da soli quando cambia un componente o un'offerta.

const GIORNI_VERIFICATO = 30;
const STATI_PREZZO = {
  verificato: {nome: "PREZZO VERIFICATO", breve: "verificato"},
  storico: {nome: "PREZZO STORICO", breve: "storico"},
  stimato: {nome: "PREZZO STIMATO", breve: "stimato"},
  non_disponibile: {nome: "PREZZO NON DISPONIBILE", breve: "non disponibile"},
};
// chiave di una voce: il nome normalizzato (cambia se cambia il prodotto, per esempio una tenda di un'altra misura)
const chiaveVoce = nome => String(nome || "").toLowerCase().replace(/\s+/g, " ").trim();

function giorniDa(data, oggi) {
  const a = Date.parse(String(data) + "T12:00:00Z"), b = Date.parse(String(oggi) + "T12:00:00Z");
  return isFinite(a) && isFinite(b) ? Math.round((b - a) / 86400000) : Infinity;
}
// controlla un'offerta: niente valori inventati, solo quello che l'utente ha scritto
function validaOfferta(o) {
  const errori = [];
  if (!o || typeof o !== "object") return ["offerta vuota"];
  if (!o.fornitore || !String(o.fornitore).trim()) errori.push("manca il fornitore");
  if (!(+o.prezzo >= 0)) errori.push("prezzo non valido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.data || "")) errori.push("manca la data del controllo (AAAA-MM-GG)");
  if (o.url && !/^https?:\/\/[^\s]+\.[^\s]+/.test(o.url)) errori.push("link non valido");
  if (o.iva != null && !(+o.iva >= 0 && +o.iva <= 30)) errori.push("IVA fuori dal 0-30%");
  return errori;
}
// prezzo per un pezzo con IVA e spedizione divisa sui pezzi dell'ordine
function costoOfferta(o, q) {
  const iva = o.iva == null ? 22 : +o.iva;
  const unitario = o.iva_inclusa === false ? +o.prezzo * (1 + iva / 100) : +o.prezzo;
  const spedizione = +o.spedizione || 0;
  return {unitario, spedizione, totale: unitario * q + spedizione};
}
function statoOfferta(o, oggi) {
  if (o.disponibilita === "non_disponibile") return "non_disponibile";
  return o.url && giorniDa(o.data, oggi) <= GIORNI_VERIFICATO ? "verificato" : "storico";
}
// confronto tra offerte equivalenti per la stessa voce: dalla più conveniente, IVA e spedizione comprese
function confrontaOfferte(offerte, q, oggi) {
  return (offerte || []).filter(o => !validaOfferta(o).length).map(o => Object.assign({}, o, costoOfferta(o, q), {stato: statoOfferta(o, oggi), giorni: giorniDa(o.data, oggi)}))
    .sort((a, b) => (a.stato === "non_disponibile") - (b.stato === "non_disponibile") || a.totale - b.totale);
}
// applica le offerte alla distinta: ogni voce ha stato_prezzo; le voci con un'offerta usabile hanno min = max = costo
function applicaPrezzi(voci, offerte, oggi = new Date().toISOString().slice(0, 10)) {
  return voci.map(v => {
    const conf = confrontaOfferte((offerte || {})[chiaveVoce(v.nome)], v.q, oggi);
    const migliore = conf.find(o => o.stato !== "non_disponibile");
    if (migliore) return Object.assign({}, v, {min: migliore.totale, max: migliore.totale, stato_prezzo: migliore.stato, offerta: migliore, stima: [v.min, v.max], offerte: conf.length});
    if (conf.length) return Object.assign({}, v, {stato_prezzo: "non_disponibile", offerte: conf.length});
    return Object.assign({}, v, {stato_prezzo: "stimato"});
  });
}
// quanto della spesa iniziale poggia su prezzi controllati
function riepilogoPrezzi(voci) {
  const per = {verificato: 0, storico: 0, stimato: 0, non_disponibile: 0};
  for (const v of voci) per[v.stato_prezzo || "stimato"] += (v.min + v.max) / 2;
  const tot = Object.values(per).reduce((a, b) => a + b, 0);
  const quotaStimata = tot ? (per.stimato + per.storico + per.non_disponibile) / tot : 0;
  return {per, totale: tot, quotaStimata, provvisorio: quotaStimata > 0.2,
          giudizio: quotaStimata > 0.2 ? "Giudizio economico PROVVISORIO: il " + Math.round(quotaStimata * 100) + "% della spesa iniziale poggia su prezzi stimati o vecchi."
                                       : "Il " + Math.round((1 - quotaStimata) * 100) + "% della spesa iniziale poggia su prezzi verificati negli ultimi " + GIORNI_VERIFICATO + " giorni."};
}
function aggiungiOfferta(c, nomeVoce, o) {
  const errori = validaOfferta(o);
  if (errori.length) throw new Error(errori.join(", "));
  c.prezzi_verificati = c.prezzi_verificati || {};
  const k = chiaveVoce(nomeVoce), pulita = {};
  for (const kk of ["fornitore", "url", "prezzo", "iva", "iva_inclusa", "spedizione", "data", "codice", "produttore", "specifiche", "disponibilita"])
    if (o[kk] !== undefined && o[kk] !== "") pulita[kk] = ["prezzo", "iva", "spedizione"].includes(kk) ? +o[kk] : o[kk];
  (c.prezzi_verificati[k] = c.prezzi_verificati[k] || []).push(pulita);
  return pulita;
}
if (typeof module !== "undefined") module.exports = {GIORNI_VERIFICATO, STATI_PREZZO, chiaveVoce, validaOfferta, costoOfferta, confrontaOfferte, applicaPrezzi, riepilogoPrezzi, aggiungiOfferta};
