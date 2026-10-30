"use strict";
// Percorso guidato: dalle risposte essenziali (luogo, spazio, budget, tempo, colture, obiettivo) prova tutte le
// configurazioni sensate con i motori del gemello, scarta quelle che non rispettano i vincoli e propone tre soluzioni:
// A minimo investimento, B miglior rapporto costo/risultato, C maggiore automazione. Sa dire quando non conviene.

const RISPOSTE_ESEMPIO = {
  luogo: "garage", regione: "centro", superficie: 15, altezza: 2.4, spazio_esterno: 0, budget: 500, budget_mese: 40, ore_settimana: 3,
  colture: ["lattuga", "basilico", "fragola"], obiettivo: "imparare", persone: 3, kwh: 0.28,
};
const OBIETTIVI = {
  imparare: {nome: "Imparare", descr: "Fare esperienza spendendo poco: conta il costo, non il guadagno."},
  autoconsumo: {nome: "Verdura per la famiglia", descr: "Conta il costo al kg rispetto al negozio."},
  vendita: {nome: "Vendere", descr: "Conta il margine; servono clienti e le regole per vendere."},
};
const LIVELLI_AUTO = {
  nessuna: {nome: "Senza elettronica (timer e penne)", auto: {micro: "nessuno", ph: false, ec: false, temp_acqua: false, aria: false, co2: false, livello: false, perdita: false, dosaggio: false, rabbocco: false, flusso: false, luce_sens: false, connessione: "nessuna", centrale: "nessuna", ups: false, prese_smart: false}},
  base: {nome: "Sorveglianza (ESP32, temperature, livello, perdita)", auto: {micro: "esp32", ph: false, ec: false, temp_acqua: true, aria: true, co2: false, livello: true, perdita: true, dosaggio: false, rabbocco: false, flusso: true, luce_sens: true, connessione: "wifi", centrale: "pc", ups: false, prese_smart: true}},
  completa: {nome: "Automatico (sonde pH ed EC, dosaggio, rabbocco, UPS)", auto: {micro: "esp32", ph: true, ec: true, temp_acqua: true, aria: true, co2: false, livello: true, perdita: true, dosaggio: true, rabbocco: true, flusso: true, luce_sens: true, connessione: "wifi", centrale: "pc", ups: true, prese_smart: true}},
};

// strutture da provare per sistema
function strutture(sistema) {
  return {
    kratky: [{disposizione: "orizzontale", superficie_piano: 0.36}, {disposizione: "orizzontale", superficie_piano: 0.72}, {disposizione: "scaffale", piani: 2, superficie_piano: 0.72}],
    dwc: [{disposizione: "orizzontale", superficie_piano: 0.72}, {disposizione: "orizzontale", superficie_piano: 1.44}],
    nft: [{disposizione: "orizzontale", superficie_piano: 0.72}, {disposizione: "scaffale", piani: 2, superficie_piano: 0.72}, {disposizione: "scaffale", piani: 3, superficie_piano: 0.72}],
    torre: [{torri: 1}, {torri: 2}],
    bucket: [{secchi: 2, superficie_piano: 0.72}, {secchi: 4, superficie_piano: 1.44}, {secchi: 6, superficie_piano: 1.44}],
    ebb: [{disposizione: "orizzontale", superficie_piano: 0.72}, {disposizione: "scaffale", piani: 2, superficie_piano: 0.72}],
    goccia: [{secchi: 2, superficie_piano: 1.44}, {secchi: 4, superficie_piano: 1.44}],
    vassoi: [{disposizione: "orizzontale", superficie_piano: 0.72}, {disposizione: "scaffale", piani: 2, superficie_piano: 0.72}, {disposizione: "scaffale", piani: 3, superficie_piano: 0.72}],
  }[sistema];
}

// difficoltà, rischio e ampliabilità (scala 1-5, giudizio da tecnico dichiarato, non misurato)
function valutazioni(c) {
  const I = c.idro, A = I.auto, S = SISTEMI_IDRO[I.sistema];
  const difficolta = Math.min(5, {kratky: 1, vassoi: 2, dwc: 2, ebb: 2, nft: 3, bucket: 3, goccia: 3, torre: 4}[I.sistema] + (A.dosaggio ? 1 : 0) + (A.micro !== "nessuno" ? 0.5 : 0));
  let rischio = S.tolleranza_ore <= 2 && !A.ups ? 4 : S.tolleranza_ore <= 2 ? 2.5 : 1.5;
  if (A.dosaggio) rischio += 0.5;                                  // sonda che deriva
  if (A.micro === "nessuno" && !["kratky", "vassoi"].includes(I.sistema)) rischio += 1;
  const gestione = Math.min(5, (A.ph && A.ec ? 1.5 : 2.5) + (I.sistema === "vassoi" ? 1.5 : 0) + (I.colture.length > 1 ? 0.5 : 0));
  const ampliabile = {kratky: 1, dwc: 3, ebb: 4, nft: 5, torre: 4, bucket: 3, goccia: 4, vassoi: 4}[I.sistema];
  return {difficolta: Math.round(difficolta), rischio: Math.min(5, Math.round(rischio)), gestione: Math.round(gestione), ampliabile};
}

// ingombro a terra con 60 cm per passare e lavorare davanti
function ingombro(c) {
  const k = capacitaIdro(c), t = c.idro.clima.tenda ? k.tenda : k.misure;
  return {m2: (t.lung + 0.7) * (t.prof + 0.6), altezza: Math.max(t.alt || 0, k.misure.alt)};
}

function candidatiIdro(R) {
  const lista = [];
  const desiderate = R.colture.filter(x => IDRO_PIANTE[x]);
  for (const sistema of Object.keys(SISTEMI_IDRO)) {
    const adatte = desiderate.filter(x => IDRO_PIANTE[x].sistemi.includes(sistema));
    if (!adatte.length) continue;
    const gruppi = adatte.map(x => [x]);
    if (adatte.length > 1) gruppi.push(adatte);
    for (const gruppo of gruppi) for (const st of strutture(sistema)) for (const luce of ["led_tubi", "led_qb"]) for (const liv of Object.keys(LIVELLI_AUTO)) for (const clima of ["tenda", "aperto"]) {
      if (liv === "nessuna" && ["torre"].includes(sistema)) continue;          // torri senza sorveglianza: rischio troppo alto
      const idro = JSON.parse(JSON.stringify(IDRO_ESEMPIO));
      Object.assign(idro, {sistema, piani: 1, disposizione: "orizzontale"}, st);
      delete idro.struttura;                                       // misure dalla superficie scelta qui sotto
      idro.colture = gruppo.map(x => ({coltura: x, quota: Math.round(100 / gruppo.length)}));
      idro.luce = {tipo: luce, ppfd: 0, ore: 0, notte: true, w_installati: 0};
      idro.auto = Object.assign({}, idro.auto, LIVELLI_AUTO[liv].auto);
      idro.clima = clima === "tenda" ? Object.assign({}, idro.clima, {tenda: true, riscaldamento: "stufetta", estrattore: liv !== "nessuna", circolazione: true})
                                     : Object.assign({}, idro.clima, {tenda: false, riscaldamento: "nessuno", estrattore: false, circolazione: true});
      idro.economia = Object.assign({}, idro.economia, {persone: R.persone, quota_vendita: R.obiettivo === "vendita" ? 80 : 0});
      const c = Object.assign(JSON.parse(JSON.stringify(ESEMPIO)), {modalita: "idro", regione: R.regione, prezzi: {kwh: R.kwh, acqua_m3: 2}, idro});
      c.idro.economia.ore_settimana = oreSettimanaIdro(c);
      lista.push({c, livello: liv, clima});
    }
  }
  return lista;
}

function valutaIdro(R, x) {
  const c = x.c, s = simulaIdro(c, {passoClima: 1, passoCoorti: 14}), voci = materialiIdro(c), costi = costiAnnuiIdro(c, s), e = economiaIdro(c, s, voci, costi);
  const ing = ingombro(c), C = e.scenari.centrale, v = valutazioni(c);
  const vincoli = [];
  if (e.capex.medio > R.budget) vincoli.push("budget: servono circa " + Math.round(e.capex.medio) + " €");
  if (C.opex / 12 > R.budget_mese) vincoli.push("spese: " + Math.round(C.opex / 12) + " € al mese");
  if (ing.m2 > R.superficie) vincoli.push("spazio: " + ing.m2.toFixed(1) + " m²");
  if (ing.altezza > R.altezza) vincoli.push("altezza: " + ing.altezza.toFixed(1) + " m");
  if (c.idro.economia.ore_settimana > R.ore_settimana) vincoli.push("tempo: " + c.idro.economia.ore_settimana + " ore a settimana");
  const critici = compatibilitaIdro(c).filter(m => m.tipo === "crit" && !/sensore di perdita|UPS|230 V/.test(m.titolo));
  if (critici.length) vincoli.push("tecnica: " + critici[0].titolo);
  if (C.kgUtili <= 0) vincoli.push("nessun raccolto");
  return Object.assign(x, {s, voci, costi, e, ing, v, vincoli, ok: !vincoli.length,
    riassunto: {capexMin: e.capex.min, capexMax: e.capex.max, capex: e.capex.medio, opex: C.opex, kg: C.kgUtili, costoKg: C.costoKg, margine: C.margine, utile: C.utile, pareggio: C.pareggioAnni,
      acqua: s.acqua / 1000, kwh: s.kwh, ore: c.idro.economia.ore_settimana, piante: s.k.piante, giudizio: e.giudizio}});
}

function nomeProposta(x) {
  const I = x.c.idro, S = SISTEMI_IDRO[I.sistema];
  const dim = I.sistema === "torre" ? I.torri + (I.torri > 1 ? " torri" : " torre") : I.sistema === "bucket" ? I.secchi + " secchi" : I.sistema === "goccia" ? I.secchi + (I.secchi > 1 ? " lastre" : " lastra")
    : (I.disposizione === "scaffale" ? I.piani + " piani da " : "") + ({0.36: "60×60", 0.72: "120×60", 1.44: "120×120"}[I.superficie_piano] || I.superficie_piano + " m²") + " cm";
  return S.nome.split(" (")[0] + ", " + dim + " · " + I.colture.map(c => IDRO_PIANTE[c.coltura].nome.toLowerCase()).join(" e ") + " · " + LUCI_IDRO[I.luce.tipo].nome.split(" (")[0].toLowerCase() + (x.clima === "tenda" ? " · tenda e stufetta" : " · senza tenda (stagione mite)");
}

function scegli(lista, chiave, filtro) {
  const l = lista.filter(filtro || (() => true));
  if (!l.length) return null;
  return l.reduce((a, b) => chiave(b) < chiave(a) ? b : a);
}

function progettaIdro(R) {
  const tutti = candidatiIdro(R).map(x => valutaIdro(R, x));
  const ok = tutti.filter(x => x.ok);
  const valore = x => R.obiettivo === "imparare" ? x.riassunto.capex + 2 * x.riassunto.opex : R.obiettivo === "vendita" ? -x.riassunto.utile : isFinite(x.riassunto.costoKg) ? x.riassunto.costoKg : 1e9;
  const A = scegli(ok, x => x.riassunto.capex + x.riassunto.opex * 0.2);
  // B: deve dare qualcosa in più di A (più raccolto o più colture), altrimenti non è una vera alternativa
  const diversa = x => x !== A && (x.riassunto.kg >= 1.5 * A.riassunto.kg || x.c.idro.colture.length > A.c.idro.colture.length);
  const B = scegli(ok, R.obiettivo === "imparare" ? (x => isFinite(x.riassunto.costoKg) ? x.riassunto.costoKg : 1e9) : valore, diversa) || scegli(ok, valore, x => x !== A);
  const C = scegli(ok, valore, x => x.livello === "completa");
  const proposte = [];
  if (A) proposte.push({lettera: "A", titolo: "Minimo investimento", x: A});
  if (B) proposte.push({lettera: "B", titolo: R.obiettivo === "imparare" ? "Miglior equilibrio spesa/esperienza" : R.obiettivo === "vendita" ? "Miglior margine" : "Miglior costo al kg", x: B});
  if (C) proposte.push({lettera: "C", titolo: "Maggiore automazione", x: C});
  for (const p of proposte) p.nome = nomeProposta(p.x);
  const autoMin = scegli(tutti.filter(x => x.livello === "completa"), x => x.riassunto.capex);
  if (!C && autoMin) proposte.push({lettera: "C", titolo: "Maggiore automazione", x: null, nome: "Non sta nei vincoli",
    nota: "L'impianto automatico più economico (" + nomeProposta(autoMin) + ") richiede circa " + Math.round(autoMin.riassunto.capex) + " €" + (autoMin.vincoli.length ? " (" + autoMin.vincoli.join(", ") + ")" : "") + ". Per iniziare l'automazione non serve: si aggiunge dopo."});
  // perché manca qualcosa
  const motiviScarto = {};
  for (const x of tutti) for (const v of x.vincoli) { const k = v.split(":")[0]; motiviScarto[k] = (motiviScarto[k] || 0) + 1; }
  const minimoBudget = Math.min(...tutti.filter(x => x.vincoli.every(v => v.startsWith("budget"))).map(x => x.riassunto.capex));
  const autoMinimo = Math.min(...tutti.filter(x => x.livello === "completa" && x.vincoli.every(v => v.startsWith("budget") || v.startsWith("spese"))).map(x => x.riassunto.capex));
  return {tipo: "idro", proposte, tutti, ok, motiviScarto, minimoBudget, autoMinimo, giudizio: giudizioGlobale(R, proposte, ok, tutti)};
}

function giudizioGlobale(R, proposte, ok, tutti) {
  const righe = [];
  if (!ok.length) {
    const vicino = scegli(tutti, x => x.vincoli.length * 1e4 + x.riassunto.capex);
    righe.push({tipo: "crit", testo: "Nessuna configurazione rispetta tutti i vincoli. La più vicina è " + nomeProposta(vicino) + ": manca " + vicino.vincoli.join(", ") + "."});
    return {esito: "impossibile", righe};
  }
  const conv = ok.filter(x => x.riassunto.giudizio === "conviene");
  if (R.obiettivo === "imparare") righe.push({tipo: "ok", testo: "Obiettivo imparare: parti dalla proposta A e misura tutto (kWh, temperature, peso del raccolto) per correggere il gemello prima di spendere di più."});
  if (R.obiettivo !== "imparare" && !conv.length) {
    righe.push({tipo: "crit", testo: "Sconsigliato come investimento: nessuna delle " + ok.length + " configurazioni possibili si ripaga" + (R.obiettivo === "autoconsumo" ? " con la verdura mangiata in casa" : "") + ". La corrente (luci e d'inverno la stufetta) costa più del raccolto. Ha senso solo per imparare o per la qualità."});
    return {esito: "sconsigliato", righe};
  }
  if (conv.length) righe.push({tipo: "ok", testo: conv.length + " configurazioni su " + ok.length + " si ripagano entro la vita dell'impianto" + (R.obiettivo === "vendita" ? ", se trovi davvero i clienti e metti in regola la vendita" : "") + "."});
  else righe.push({tipo: "warn", testo: "Nessuna configurazione si ripaga: va bene per imparare, non come investimento."});
  return {esito: conv.length ? "possibile" : "solo_esperienza", righe};
}

// ---------- orto all'aperto: i tre pacchetti del gemello dimensionati sulla superficie ----------
function progettaOrto(R, ambiente = "esterno") {
  const adatte = R.colture.filter(x => PIANTE[x]);
  const colture = adatte.length ? adatte : ["pomodoro", "zucchina", "lattuga"];
  const area = Math.max(2, Math.min((R.luogo === "esterno" ? R.superficie : R.spazio_esterno || R.superficie) * 0.7, 60));
  const zone = colture.slice(0, 4).map(k => ({coltura: k, area: Math.max(1, Math.round(area / Math.min(4, colture.length))), mese: PIANTE[k].mesi[0], cicli: PIANTE[k].giorni < 70 ? 2 : 1, pacciamatura: PIANTE[k].giorni > 70, rialzata: false}));
  const tutti = ["base", "sicuro", "completo"].map(p => {
    const c = JSON.parse(JSON.stringify(ESEMPIO));
    Object.assign(c, {regione: R.regione, zone, preset: p, prezzi: {kwh: R.kwh, acqua_m3: 2}, modalita: "orto", ambiente});
    Object.assign(c.componenti, PRESET[p].componenti); Object.assign(c.extra, PRESET[p].extra);
    c.acqua = Object.assign({}, c.acqua, {cisterna_l: 500, tetto_m2: Math.min(15, R.superficie)});
    const M = meteo(c), s = simula(c, {meteo: M}), voci = materiali(c), costi = costiAnnui(c, s, voci);
    const capex = (somma(voci, "min") + somma(voci, "max")) / 2;
    const vincoli = [];
    if (capex > R.budget) vincoli.push("budget: servono circa " + Math.round(capex) + " €");
    if (costi.totale / 12 > R.budget_mese) vincoli.push("spese: " + Math.round(costi.totale / 12) + " € al mese");
    const margine = s.valore - costi.totale;
    return {c, s, voci, costi, livello: p, ok: !vincoli.length, vincoli,
      riassunto: {capexMin: somma(voci, "min"), capexMax: somma(voci, "max"), capex, opex: costi.totale, kg: s.kg, costoKg: s.kg ? (costi.totale + capex / 5) / s.kg : Infinity,
        margine, utile: margine - capex / 5, pareggio: margine > 0 ? capex / margine : Infinity, acqua: s.litri / 1000, kwh: s.kwh, ore: Math.round((1 + area * 0.1) * 4) / 4, piante: zone.length, giudizio: margine - capex / 5 > 0 ? "conviene" : "non_conviene"}};
  });
  const nomi = {base: ["A", "Minimo investimento"], sicuro: ["B", "Miglior rapporto (consigliato)"], completo: ["C", "Maggiore automazione"]};
  const proposte = tutti.filter(x => x.ok).map(x => ({lettera: nomi[x.livello][0], titolo: nomi[x.livello][1], x, nome: (ambiente === "serra" ? "Serra fredda a tunnel, " : "Orto ") + area.toFixed(0) + " m² a goccia · pacchetto " + PRESET[x.livello].nome.toLowerCase() + " · " + zone.map(z => PIANTE[z.coltura].nome.toLowerCase()).join(", ")}));
  const righe = [];
  if (!proposte.length) righe.push({tipo: "crit", testo: "Neanche il pacchetto base sta nel budget: servono circa " + Math.round(tutti[0].riassunto.capex) + " €. Si può partire con irrigazione a mano e un solo sensore."});
  else righe.push({tipo: "ok", testo: "All'aperto la luce è gratis: l'orto in terra costa molto meno al kg dell'idroponica in garage. Spesa principale: acqua e materiale."});
  return {tipo: "orto", proposte, tutti, ok: tutti.filter(x => x.ok), giudizio: {esito: proposte.length ? "possibile" : "impossibile", righe}};
}

// ---------- confronto tra tecnologie e fronte di Pareto ----------
// Mette sullo stesso piano orto all'aperto, serra fredda e ogni sistema idroponico (la migliore configurazione di
// ciascuno che rispetta i vincoli). Obiettivi da minimizzare: investimento, costo al kg, rischio, ore di lavoro.
// Una soluzione è sul fronte di Pareto se nessun'altra è migliore o uguale in tutto e migliore in almeno una cosa.
function paretiani(lista, obiettivi) {
  return lista.filter(a => !lista.some(b => b !== a && obiettivi.every(f => f(b) <= f(a)) && obiettivi.some(f => f(b) < f(a))));
}
function confrontaTecnologie(R, idroCalcolato) {
  R = Object.assign({}, RISPOSTE_ESEMPIO, R);
  const righe = [];
  const idro = idroCalcolato || progettaIdro(Object.assign({}, R, {luogo: "garage"}));
  const perSistema = {};
  for (const x of idro.ok) { const k = x.c.idro.sistema; if (!perSistema[k] || x.riassunto.costoKg < perSistema[k].riassunto.costoKg) perSistema[k] = x; }
  for (const [sis, x] of Object.entries(perSistema)) righe.push({tecnologia: SISTEMI_IDRO[sis].nome.split(" (")[0] + " in garage", nome: nomeProposta(x), r: x.riassunto, rischio: x.v.rischio, x, tipo: "idro"});
  if (R.spazio_esterno > 0 || R.luogo === "esterno") for (const amb of ["esterno", "serra"]) {
    const o = progettaOrto(Object.assign({}, R, {luogo: "garage"}), amb);
    const migliore = o.ok.length ? o.ok.reduce((a, b) => b.riassunto.costoKg < a.riassunto.costoKg ? b : a) : null;
    if (migliore) righe.push({tecnologia: amb === "serra" ? "Serra fredda a tunnel" : "Orto all'aperto", nome: (o.proposte.find(p => p.x === migliore) || {}).nome || "", r: migliore.riassunto,
                              rischio: amb === "serra" ? 2 : 2, x: migliore, tipo: "orto", ambiente: amb});
    else righe.push({tecnologia: amb === "serra" ? "Serra fredda a tunnel" : "Orto all'aperto", nome: "non sta nel budget", r: null, tipo: "orto", ambiente: amb});
  }
  const valide = righe.filter(x => x.r);
  const obiettivi = [x => x.r.capex, x => isFinite(x.r.costoKg) ? x.r.costoKg : 1e9, x => x.rischio, x => x.r.ore];
  const fronte = paretiani(valide, obiettivi);
  for (const x of valide) x.pareto = fronte.includes(x);
  const migliorePer = {};
  for (const [nome, f] of [["investimento più basso", obiettivi[0]], ["costo al kg più basso", obiettivi[1]], ["rischio più basso", obiettivi[2]], ["meno lavoro", obiettivi[3]]])
    if (valide.length) { const m = valide.reduce((a, b) => f(b) < f(a) ? b : a); (m.motivi = m.motivi || []).push(nome); migliorePer[nome] = m; }
  righe.sort((a, b) => (a.r ? a.r.costoKg : 1e9) - (b.r ? b.r.costoKg : 1e9));
  return {righe, fronte, migliorePer, senzaEsterno: !(R.spazio_esterno > 0) && R.luogo !== "esterno"};
}

function progetta(R) {
  R = Object.assign({}, RISPOSTE_ESEMPIO, R);
  return R.luogo === "esterno" ? progettaOrto(R) : progettaIdro(R);
}
if (typeof module !== "undefined") module.exports = {confrontaTecnologie, paretiani, progetta, progettaIdro, progettaOrto, RISPOSTE_ESEMPIO, LIVELLI_AUTO};
