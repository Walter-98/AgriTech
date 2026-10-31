"use strict";
// Scenari di accettazione di AgriTech 2.1: tre casi veri dell'utente, ognuno con simulazione, distinta, costi, rischi
// e un breve rapporto tecnico. Servono a controllare che il gemello, dalla domanda alla risposta, dia numeri coerenti
// e onesti. Non sono una validazione: nessuno di questi numeri è stato confrontato con un impianto vero.
//   A: 20 m² di orto in terra nelle Marche, irrigazione automatica, 500 €
//   B: garage di 15 m², 500 €, lattuga e basilico in idroponica
//   C: microgreens per una possibile vendita, con costi, scarti e domanda variabile

// domanda settimanale variabile: si semina ~10 giorni prima, quindi la produzione si decide senza sapere la domanda.
// Monte Carlo su 52 settimane: i vassoi non venduti sono costo senza ricavo. Prova diversi livelli di produzione.
function domandaVariabileMicro(c, s, M, opz = {}) {
  const base = microgreensVendita(c, s, M), Mm = base.M, cv = opz.cv ?? 0.35, anni = opz.anni ?? 200;
  const rnd = mulberry32(opz.seme ?? 31);
  const media = Mm.vassoi_settimana, capacita = Math.floor(base.capacitaSett);      // vassoi interi
  const variabile = base.costo - base.voci.consegna, fissoSett = Mm.km_settimana * Mm.euro_km;
  const livelli = [0.6, 0.8, 1.0, 1.2].map(f => Math.min(capacita, Math.round(media * f)));
  const prove = [...new Set(livelli)].map(prod => {
    const margini = [], invenduti = [];
    for (let a = 0; a < anni; a++) {
      let m = 0, inv = 0;
      for (let w = 0; w < 52; w++) {
        const d = Math.max(0, Math.round(media * (1 + cv * gaussDa(rnd))));
        const vend = Math.min(d, prod);
        m += vend * base.ricavo - prod * variabile - (prod > 0 ? fissoSett : 0); inv += prod - vend;
      }
      margini.push(m); invenduti.push(prod ? inv / (prod * 52) : 0);
    }
    margini.sort((x, y) => x - y);
    const q = p => margini[Math.floor(p * (margini.length - 1))];
    return {produzione: prod, p10: q(0.1), p50: q(0.5), p90: q(0.9), invenduto: invenduti.reduce((x, y) => x + y, 0) / anni,
            probPerdita: margini.filter(x => x < 0).length / margini.length};
  });
  const migliore = prove.reduce((a, b) => b.p50 > a.p50 ? b : a);
  return {cv, media, capacita, prove, migliore, fisso: base.margineAnno};
}

const SCENARI_ACCETTAZIONE = {
  A: {titolo: "20 m² di orto in terra nelle Marche, irrigazione automatica, 500 €",
      risposte: {luogo: "esterno", regione: "centro", superficie: 20, budget: 500, budget_mese: 30, colture: ["pomodoro", "zucchina", "lattuga", "basilico"], obiettivo: "autoconsumo", persone: 3, kwh: 0.28}},
  B: {titolo: "Garage di 15 m², 500 €, lattuga e basilico in idroponica",
      risposte: {luogo: "garage", regione: "centro", superficie: 15, budget: 500, budget_mese: 40, colture: ["lattuga", "basilico"], obiettivo: "autoconsumo", persone: 3, kwh: 0.28}},
  C: {titolo: "Microgreens per una possibile vendita, con costi, scarti e domanda variabile",
      // microgreens: solo acqua (niente nutrienti né dosaggio), scaffale nel garage senza tenda
      config: {sistema: "vassoi", piani: 4, colture: [{coltura: "microgreens", quota: 100}], economia: {quota_vendita: 90, prezzo_vendita: 70},
               clima: {tenda: false}, auto: {dosaggio: false, ph: false, ec: false}},
      micro: {vassoi_settimana: 12, grammi_vassoio: 250, prezzo_kg: 30, scarto: 15}},
};

function eseguiAccettazione(chiave) {
  const S0 = SCENARI_ACCETTAZIONE[chiave], out = {chiave, titolo: S0.titolo};
  if (chiave === "A") {
    const res = progetta(S0.risposte), p = res.proposte.find(x => x.x && x.lettera === "B") || res.proposte.find(x => x.x);
    const c = p.x.c, M = meteo(c), s = simula(c, {meteo: M}), voci = materiali(c), costi = costiAnnui(c, s, voci);
    Object.assign(out, {proposta: p.lettera + " · " + p.nome, c, controlli: controllaProposte(res),
      simulazione: {acqua_l: s.litri, da_rete_l: s.daRete, stress_giorni: s.stress, kg: s.kg, kwh: s.kwh, eventi: s.eventi.length},
      distinta: {voci: voci.length, min: somma(voci, "min"), max: somma(voci, "max"), prezzi: riepilogoPrezzi(voci)},
      costi: {anno: costi.totale, costoKg: p.x.riassunto.costoKg, utile: p.x.riassunto.utile},
      rischi: compatibilita(c).filter(m => m.tipo !== "ok").map(m => m.titolo),
      sensibilita: sensibilitaOrto(c, M, s), affidabilita: rapportoAffidabilita(Object.assign({}, c, {modalita: "orto"}), s, voci)});
  } else {
    let c, nome, res = null;
    if (chiave === "B") { res = progetta(S0.risposte); const p = res.proposte.find(x => x.x && x.lettera === "A") || res.proposte.find(x => x.x); c = p.x.c; nome = p.lettera + " · " + p.nome; }
    else { c = Object.assign(JSON.parse(JSON.stringify(ESEMPIO)), {modalita: "idro", regione: "centro", idro: JSON.parse(JSON.stringify(IDRO_ESEMPIO))});
           for (const [k, v] of Object.entries(S0.config)) c.idro[k] = typeof v === "object" && !Array.isArray(v) ? Object.assign({}, c.idro[k], v) : v;
           nome = "Scaffale a vassoi, 4 piani, " + S0.micro.vassoi_settimana + " vassoi a settimana venduti al " + c.idro.economia.prezzo_vendita + "% del prezzo"; }
    c.modalita = "idro";
    const s = simulaIdro(c), voci = materialiIdro(c), costi = costiAnnuiIdro(c, s), e = economiaIdro(c, s, voci, costi), C = e.scenari.centrale;
    Object.assign(out, {proposta: nome, c, controlli: res ? controllaProposte(res) : [],
      simulazione: {kg: s.kg, kwh: s.kwh, acqua_l: s.acqua, piante: s.k.piante, wLuci: s.k.wLuci},
      distinta: {voci: voci.length, min: somma(voci, "min"), max: somma(voci, "max"), prezzi: riepilogoPrezzi(voci)},
      costi: {anno: costi.totale, costoKg: C.costoKg, utile: C.utile, van: C.van, tir: C.tir, giudizio: e.giudizio},
      rischi: compatibilitaIdro(c).filter(m => m.tipo !== "ok").map(m => m.titolo),
      sicurezza: {dosaggio_automatico: !!c.idro.auto.dosaggio, reale: "disattivato: servono chiave fisica, autotest del taglio, collaudo F1-F12 e verifica della dose (SICUREZZA_DOSAGGIO.md)"},
      sensibilita: sensibilitaIdro(c), affidabilita: rapportoAffidabilita(c, s, voci)});
    if (chiave === "C") { out.micro = microgreensVendita(c, s, S0.micro); out.domanda = domandaVariabileMicro(c, s, S0.micro); }
  }
  return out;
}

// rapporto tecnico in testo (Markdown), lo stesso per i tre scenari
function rapportoAccettazione(r) {
  const n = (v, d = 0) => v == null || !isFinite(v) ? "–" : Number(v).toLocaleString("it-IT", {minimumFractionDigits: d, maximumFractionDigits: d});
  const righe = ["## Scenario " + r.chiave + " · " + r.titolo, "", "**Proposta:** " + r.proposta, ""];
  const S = r.simulazione;
  righe.push("**Simulazione (un anno):** " + (r.chiave === "A"
    ? n(S.acqua_l) + " L d'acqua (" + n(S.da_rete_l) + " dal rubinetto), " + n(S.kg) + " kg di raccolto, " + n(S.kwh, 1) + " kWh, " + n(S.stress_giorni, 1) + " giorni-zona di sofferenza, " + S.eventi + " eventi"
    : n(S.piante) + " posti (piante o vassoi), " + n(S.wLuci) + " W di luci, " + n(S.kg, 1) + " kg utili, " + n(S.kwh) + " kWh, " + n(S.acqua_l) + " L d'acqua"), "");
  righe.push("**Distinta:** " + r.distinta.voci + " voci, " + n(r.distinta.min) + "–" + n(r.distinta.max) + " €. " + r.distinta.prezzi.giudizio, "");
  righe.push("**Costi:** " + n(r.costi.anno) + " € all'anno, " + n(r.costi.costoKg, 2) + " €/kg con l'ammortamento, utile " + n(r.costi.utile) + " € all'anno" +
    (r.costi.van != null ? ", VAN " + n(r.costi.van) + " €" + (r.costi.tir != null ? ", TIR " + n(r.costi.tir * 100, 1) + "%" : "") : "") + (r.costi.giudizio ? " (giudizio: " + r.costi.giudizio.replace("_", " ") + ")" : "") + ".", "");
  if (r.micro) {
    const d = r.domanda, m = d.migliore;
    righe.push("**Vendita:** " + n(r.micro.ricavo, 2) + " € di ricavo e " + n(r.micro.costo, 2) + " € di costo per vassoio (scarto " + r.micro.M.scarto + "%); a domanda fissa " + n(r.micro.margineAnno) + " € all'anno.");
    righe.push("**Domanda variabile** (±" + Math.round(d.cv * 100) + "% a settimana, si semina prima di sapere quanto si vende): producendo " + m.produzione + " vassoi a settimana il margine è " +
      n(m.p10) + " / " + n(m.p50) + " / " + n(m.p90) + " € (P10/P50/P90), invenduto " + Math.round(m.invenduto * 100) + "%, anni in perdita " + Math.round(m.probPerdita * 100) + "%.", "");
  }
  righe.push("**Rischi:** " + (r.rischi.length ? r.rischi.join("; ") : "nessun avviso del gemello") + ".");
  righe.push("**Sensibilità:** " + r.sensibilita.messaggio + " Ipotesi che pesano di più: " + r.sensibilita.righe.slice(0, 3).map(x => x.nome.toLowerCase()).join(", ") + ".");
  if (r.sicurezza) righe.push("**Dosaggio:** " + (r.sicurezza.dosaggio_automatico ? "automatico previsto" : "a mano") + "; modo REALE " + r.sicurezza.reale + ".");
  righe.push("**Affidabilità:** " + r.affidabilita.map(x => x.risultato.split(" (")[0] + " " + STATO_VALIDAZIONE[x.stato]).join("; ") + ".");
  if (r.controlli.length) righe.push("**Problemi dell'ottimizzatore:** " + r.controlli.join("; ") + ".");
  righe.push("");
  return righe.join("\n");
}
if (typeof module !== "undefined") module.exports = {SCENARI_ACCETTAZIONE, eseguiAccettazione, rapportoAccettazione, domandaVariabileMicro};
