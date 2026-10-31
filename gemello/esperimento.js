"use strict";
// Primo esperimento reale: lattuga in Kratky, budget minimo, nelle Marche. Serve a misurare quanto sbaglia il modello
// di crescita (non a dimostrare che funziona). Usa il laboratorio del Registro (registro.js): previsione congelata prima
// della semina, ruolo calibrazione/validazione, metriche. Qui: disegno della prova, distinta, schede, diario, raccolta
// pianta per pianta, analisi degli errori. Il protocollo completo da stampare è in ESPERIMENTO_KRATKY.md.

// Disegno: due contenitori uguali, stessa varietà e stesso lotto di semi, stesse condizioni. Niente "trattamenti" a
// confronto: con 12 piante in un garage non controllato una differenza tra due condizioni non si potrebbe attribuire
// alla condizione. I due contenitori servono a misurare quanto variano piante uguali (la base per gli esperimenti dopo).
const PROVA_KRATKY = {
  contenitori: 2, piante_per_contenitore: 6, lung_cm: 60, prof_cm: 40, alt_cm: 20, griglia_cm: 20, litri_per_contenitore: 15,
  coltura: "lattuga", varieta: "lattuga cappuccio (es. Trocadero o Meraviglia d'inverno), stesso lotto per tutte le piante",
  luce_w: 60, ore_luce: 14, distanza_cm: 30,
  ec: [1.2, 1.6], ph: [5.8, 6.3],
  giorni_attesi: [45, 65],
};
// misure obbligatorie del diario (ogni giorno) e facoltative
const DIARIO_CAMPI = [
  {k: "t_min", nome: "Temperatura aria minima", unita: "°C", ogni: "giorno", obbligo: true},
  {k: "t_max", nome: "Temperatura aria massima", unita: "°C", ogni: "giorno", obbligo: true},
  {k: "ur", nome: "Umidità dell'aria", unita: "%", ogni: "giorno", obbligo: true},
  {k: "t_acqua", nome: "Temperatura della soluzione", unita: "°C", ogni: "giorno", obbligo: true},
  {k: "ph", nome: "pH", unita: "", ogni: "giorno", obbligo: true},
  {k: "ec", nome: "EC", unita: "mS/cm", ogni: "giorno", obbligo: true},
  {k: "livello_cm", nome: "Livello della soluzione (dal fondo)", unita: "cm", ogni: "giorno", obbligo: true},
  {k: "ore_luce", nome: "Ore di luce (fotoperiodo)", unita: "h", ogni: "giorno", obbligo: true},
  {k: "kwh", nome: "Contatore della presa (lettura)", unita: "kWh", ogni: "giorno", obbligo: true},
  {k: "piante_vive", nome: "Piante vive", unita: "", ogni: "giorno", obbligo: true},
  {k: "rabbocco_l", nome: "Acqua o soluzione aggiunta", unita: "L", ogni: "quando serve", obbligo: false},
  {k: "foto", nome: "Foto (nome del file)", unita: "", ogni: "ogni 3-4 giorni", obbligo: false},
  {k: "note", nome: "Note (alghe, foglie gialle, insetti, modifiche)", unita: "", ogni: "giorno", obbligo: false},
];
const CONDIZIONI_INIZIALI = [
  ["luogo", "Dove (garage, stanza, altezza dal pavimento)"], ["varieta", "Varietà e lotto dei semi"], ["semina", "Data di semina"],
  ["trapianto", "Data di trapianto nel Kratky"], ["piante", "Piantine trapiantate (numero)"], ["acqua", "Acqua usata (rubinetto, piovana) e durezza"],
  ["concime", "Concime (marca, dose per litro)"], ["ec0", "EC iniziale (mS/cm)"], ["ph0", "pH iniziale"], ["litri0", "Litri per contenitore"],
  ["lampada", "Lampada (marca, watt dichiarati, watt misurati)"], ["distanza", "Distanza lampada-foglie (cm)"], ["ppfd", "PPFD misurato se hai l'app o il sensore"],
  ["kwh0", "Lettura iniziale del contatore (kWh)"], ["posizioni", "Posizione di ogni pianta (A1…A6, B1…B6)"],
];

// configurazione del gemello che rappresenta la prova (stessa zona e stesso garage del progetto)
function configProvaKratky(c) {
  const P = PROVA_KRATKY, base = JSON.parse(JSON.stringify(c));
  const clima = Object.assign({}, (c.idro && c.idro.clima) || {}, {tenda: false});
  base.idro = Object.assign(JSON.parse(JSON.stringify(c.idro || {})), {
    sistema: "kratky", disposizione: "orizzontale", piani: 1, superficie_piano: P.contenitori * P.lung_cm * P.prof_cm / 1e4,
    struttura: {lung_cm: P.contenitori * P.lung_cm, prof_cm: P.prof_cm, h_piano_cm: 45},
    colture: [{coltura: P.coltura, quota: 100}],
    luce: {tipo: "led_qb", ppfd: 0, ore: P.ore_luce, notte: false, w_installati: P.luce_w, distanza_cm: P.distanza_cm},
    clima,
    auto: {micro: "nessuno", ph: false, ec: false, temp_acqua: false, aria: false, co2: false, livello: false, perdita: false, dosaggio: false,
           rabbocco: false, flusso: false, luce_sens: false, connessione: "nessuna", centrale: "nessuna", ups: false, prese_smart: false, taratura_giorni: 30},
  });
  // la prova è definita dall'impianto, non dal registro: niente esperimenti, misure e calibrazioni del progetto
  for (const kk of ["esperimenti", "registro", "misure", "ambiente_misure", "energia", "calibrazioni"]) delete base.idro[kk];
  base.modalita = "idro";
  return base;
}
// distinta della prova: prezzi STIMATI (vedi catalogo componenti), da verificare prima di comprare
function distintaProvaKratky() {
  const P = PROVA_KRATKY;
  return [
    {nome: "Contenitore opaco con coperchio, circa 60×40×20 cm", q: P.contenitori, prezzo: [8, 15], perche: "Opaco: la luce nella soluzione fa crescere le alghe."},
    {nome: "Vasetti a rete 5 cm", q: P.contenitori * P.piante_per_contenitore + 4, prezzo: [0.15, 0.3], perche: "4 di riserva."},
    {nome: "Cubetti di lana di roccia o spugna per semina", q: 30, prezzo: [0.1, 0.2], perche: "Si semina il doppio delle piante che servono: si trapiantano le più uguali."},
    {nome: "Semi di lattuga, una bustina (stesso lotto)", q: 1, prezzo: [2, 4], perche: "Segna varietà e lotto."},
    {nome: "Concime idroponico in due parti (A+B) o completo per idroponica", q: 1, prezzo: [12, 20], perche: "Basta per tutta la prova e per le prossime."},
    {nome: "Penna EC tarabile", q: 1, prezzo: [10, 20], perche: "Con la sua soluzione di taratura."},
    {nome: "Penna pH tarabile con soluzioni 4 e 7", q: 1, prezzo: [12, 25], perche: "Si tara una volta alla settimana."},
    {nome: "pH meno (acido diluito per orticoltura)", q: 1, prezzo: [6, 10], perche: "Guanti e occhiali quando lo usi."},
    {nome: "Termometro con minima e massima e umidità", q: 1, prezzo: [6, 12], perche: "Aria vicino alle foglie."},
    {nome: "Termometro a sonda per la soluzione", q: 1, prezzo: [3, 8], perche: ""},
    {nome: "Presa con contatore di energia", q: 1, prezzo: [10, 15], perche: "Misura i kWh veri della lampada."},
    {nome: "Lampada LED bianca 50-65 W reali (a pannello o barra)", q: 1, prezzo: [25, 45], perche: "Se la prova è in una stanza luminosa può bastare meno luce: segnalo nel diario."},
    {nome: "Timer meccanico per la lampada", q: 1, prezzo: [4, 8], perche: ""},
    {nome: "Bilancia da cucina 1 g", q: 1, prezzo: [0, 12], perche: "Spesso c'è già in casa."},
    {nome: "Siringa o misurino 10 mL, guanti, spruzzino", q: 1, prezzo: [3, 6], perche: ""},
  ].map(v => Object.assign(v, {min: v.q * v.prezzo[0], max: v.q * v.prezzo[1], stato_prezzo: "stimato"}));
}

// avvio: condizioni iniziali, previsione congelata (con l'incertezza) del modello sulla configurazione della prova
function avviaProvaKratky(c, dati) {
  const cp = configProvaKratky(c);
  const k = capacitaIdro(cp), s = simulaIdro(cp, {passoClima: 1});
  const I = c.idro; I.esperimenti = I.esperimenti || [];
  const esp = nuovoEsperimento(c, Object.assign({coltura: PROVA_KRATKY.coltura, piante: PROVA_KRATKY.contenitori * PROVA_KRATKY.piante_per_contenitore,
                                                 note: "Prova Kratky"}, dati));
  // la previsione del laboratorio usa la configurazione del progetto: per la prova serve quella della prova.
  // Si raccoglie in una data FISSA decisa prima (quella prevista), non "quando sembra pronta": così il peso misurato
  // si confronta con il peso previsto per quel giorno, e la scelta della data non dipende da come vanno le piante.
  if (!esp.raccolta_prevista) {
    const prima = congelaPrevisione(cp, esp);
    esp.raccolta_prevista = new Date(Date.parse(esp.semina + "T12:00:00Z") + prima.giorni * 86400000).toISOString().slice(0, 10);
  }
  esp.previsione = congelaPrevisione(cp, esp);
  const giorniPrevisti = esp.previsione.giorni || null;
  // kWh previsti dal modello per il periodo (luci e, se c'è, stufetta), riportati a un giorno
  const kwhGiorno = esp.previsione.kwhPeriodo / Math.max(1, esp.previsione.giorniRaccolta);
  const acquaGiorno = s.acqua ? s.acqua / 365 / Math.max(1, k.piante) * esp.piante : null;
  Object.assign(esp, {tipo: "kratky", disegno: JSON.parse(JSON.stringify(PROVA_KRATKY)), condizioni: Object.assign({}, dati.condizioni || {}),
    diario: [], raccolta_piante: [],
    previsione_prova: {data: new Date().toISOString().slice(0, 10), kwh_giorno: kwhGiorno, acqua_l_giorno: acquaGiorno, piante_gemello: k.piante,
                       mortalita_attesa: (cp.idro.produzione || {}).mortalita ?? 5, giorni: giorniPrevisti}});
  Object.freeze(esp.previsione_prova);
  return esp;
}
function aggiungiDiario(esp, voce) {
  if (!voce || !/^\d{4}-\d{2}-\d{2}$/.test(voce.data || "")) throw new Error("Data mancante o non valida");
  const r = {data: voce.data};
  for (const f of DIARIO_CAMPI) if (voce[f.k] != null && voce[f.k] !== "") r[f.k] = f.k === "foto" || f.k === "note" ? String(voce[f.k]) : +voce[f.k];
  const fuori = [];
  if (r.ph != null && (r.ph < 5.5 || r.ph > 6.8)) fuori.push("pH " + r.ph + " fuori da 5,5-6,8");
  if (r.ec != null && (r.ec < 0.8 || r.ec > 2.2)) fuori.push("EC " + r.ec + " fuori da 0,8-2,2");
  if (r.t_acqua != null && r.t_acqua > 24) fuori.push("soluzione oltre 24 °C: radici a rischio");
  if (r.t_min != null && r.t_min < 5) fuori.push("minima sotto 5 °C: crescita quasi ferma");
  r.avvisi = fuori;
  const i = esp.diario.findIndex(x => x.data === r.data);
  if (i >= 0) esp.diario[i] = Object.assign({}, esp.diario[i], r); else esp.diario.push(r);
  esp.diario.sort((a, b) => a.data < b.data ? -1 : 1);
  return r;
}
// raccolta pianta per pianta: [{pos: "A1", peso_g, scarto_g, note}] (peso_g = parte edibile; pianta morta: peso 0 e note)
function raccoltaProvaKratky(esp, data, piante, kwhFinale) {
  esp.raccolta_piante = piante.map(p => ({pos: p.pos, peso_g: +p.peso_g || 0, scarto_g: +p.scarto_g || 0, morta: !!p.morta || !(+p.peso_g > 0), note: p.note || ""}));
  const vive = esp.raccolta_piante.filter(p => !p.morta);
  const kwh0 = esp.condizioni && +esp.condizioni.kwh0, kwh = kwhFinale != null && isFinite(kwh0) ? kwhFinale - kwh0 : null;
  concludiEsperimento(esp, data, vive.reduce((a, p) => a + p.peso_g, 0), vive.length, kwh);
  return esp;
}
const mediaDi = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
function analisiProvaKratky(esp) {
  const P = esp.previsione, Q = esp.previsione_prova || {}, out = {completo: esp.stato === "concluso", avvisi: []};
  // completezza del diario
  const giorni = esp.diario.length;
  const durata = esp.raccolta && esp.semina ? Math.round((Date.parse(esp.raccolta) - Date.parse(esp.semina)) / 86400000) + 1 : giorni;
  out.diario = {giorni, durata, campi: DIARIO_CAMPI.filter(f => f.obbligo).map(f => ({k: f.k, nome: f.nome, giorni: esp.diario.filter(d => d[f.k] != null).length,
                quota: durata ? esp.diario.filter(d => d[f.k] != null).length / durata : 0}))};
  out.diario.fuoriRange = esp.diario.filter(d => d.avvisi && d.avvisi.length).map(d => ({data: d.data, avvisi: d.avvisi}));
  const scarsi = out.diario.campi.filter(c => c.quota < 0.8);
  if (scarsi.length) out.avvisi.push("Diario incompleto (meno dell'80% dei giorni): " + scarsi.map(c => c.nome.toLowerCase()).join(", ") + ". Gli errori su queste grandezze non si possono attribuire al modello.");
  if (!out.completo) { out.avvisi.push("Prova non ancora conclusa: nessun errore del modello da misurare."); return out; }
  const vive = esp.raccolta_piante.filter(p => !p.morta), pesi = vive.map(p => p.peso_g);
  const m = mediaDi(pesi), sd = Math.sqrt(mediaDi(pesi.map(x => (x - m) ** 2)));
  const perCont = {}; for (const p of vive) (perCont[(p.pos || "?")[0]] = perCont[(p.pos || "?")[0]] || []).push(p.peso_g);
  out.piante = {raccolte: vive.length, morte: esp.raccolta_piante.length - vive.length, mortalita: esp.raccolta_piante.length ? (esp.raccolta_piante.length - vive.length) / esp.raccolta_piante.length : 0,
                pesoMedio: m, dev: sd, cv: m ? sd / m : NaN, scartoMedio: mediaDi(vive.map(p => p.scarto_g)),
                contenitori: Object.entries(perCont).map(([k, l]) => ({contenitore: k, n: l.length, media: mediaDi(l)}))};
  // errori della previsione congelata
  out.peso = {previsto: P.peso, p10: P.pesoP10, p90: P.pesoP90, misurato: m, errore: P.peso - m, erroreRel: (P.peso - m) / m, dentro: m >= P.pesoP10 && m <= P.pesoP90};
  out.durata = Q.giorni ? {previsti: Q.giorni, misurati: durata, errore: Q.giorni - durata} : null;
  if (esp.kwh_misurati != null && Q.kwh_giorno) out.energia = {previsti: Q.kwh_giorno * durata, misurati: esp.kwh_misurati, erroreRel: (Q.kwh_giorno * durata - esp.kwh_misurati) / esp.kwh_misurati};
  const rabbocchi = esp.diario.reduce((a, d) => a + (d.rabbocco_l || 0), 0);
  if (Q.acqua_l_giorno && rabbocchi > 0) out.acqua = {previsti: Q.acqua_l_giorno * durata, misurati: rabbocchi + esp.disegno.contenitori * esp.disegno.litri_per_contenitore,
    nota: "Misurato = soluzione iniziale + rabbocchi (meno quella rimasta, se la misuri)."};
  out.mortalita = {attesa: (Q.mortalita_attesa || 0) / 100, misurata: out.piante.mortalita};
  // tra due contenitori uguali: quanto conta il caso (la base per i confronti futuri)
  if (out.piante.contenitori.length === 2) { const [a, b] = out.piante.contenitori; out.piante.differenzaContenitori = Math.abs(a.media - b.media) / m; }
  out.avvisi.push("Un solo raccolto non rende affidabile il modello: misura quanto ha sbagliato QUESTA volta. Servono almeno 3 cicli, in stagioni diverse, alcuni usati solo per verificare.");
  if (out.piante.cv > 0.3) out.avvisi.push("Piante molto diverse tra loro (variabilità " + Math.round(out.piante.cv * 100) + "%): controlla luce ai bordi, posizione e piantine di partenza.");
  return out;
}
if (typeof module !== "undefined") module.exports = {PROVA_KRATKY, DIARIO_CAMPI, CONDIZIONI_INIZIALI, configProvaKratky, distintaProvaKratky, avviaProvaKratky,
  aggiungiDiario, raccoltaProvaKratky, analisiProvaKratky};
