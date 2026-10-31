"use strict";
// Documenti di progetto: calendario di semina e raccolta, piano di montaggio, piano di collaudo, ipotesi e limiti,
// regole per vendere. Funzioni pure (niente pagina): la scheda Documenti le impagina e le stampa in PDF.

// JSON con le chiavi in ordine alfabetico: lo stesso progetto ha la stessa impronta anche dopo un salvataggio e una
// riapertura (che ricostruiscono gli oggetti con le chiavi in un altro ordine)
function jsonOrdinato(v) {
  if (Array.isArray(v)) return "[" + v.map(jsonOrdinato).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + jsonOrdinato(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
function versioneConfig(c) {
  // impronta breve della configurazione: due documenti con la stessa impronta descrivono lo stesso progetto
  const t = jsonOrdinato(c.idro || c.zone || c);
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// semina scaglionata: ogni 7 giorni si seminano le piantine che servono a tenere pieni i posti
function calendarioIdro(c, s) {
  s = s || simulaIdro(c);
  const fermo = (c.idro.produzione || {}).fermo_giorni || 0, righe = [];
  for (const x of s.perColtura) {
    const P = IDRO_PIANTE[x.coltura];
    const settimana = Math.max(1, Math.ceil(x.piante * 7 / (x.giorniCiclo + fermo)));
    for (let m = 0; m < 12; m++) {
      const d = INIZIO_MESE[m];
      const co = s.coorti && s.coorti[x.coltura] ? s.coorti[x.coltura][d] : null;
      const giorni = co ? co.giorniDaSemina : P.vivaio + P.giorni;
      const r = (d + giorni) % 365, mr = meseDi(r);
      righe.push({mese: m, coltura: x.coltura, seminaSettimana: Math.ceil(settimana * 1.2), trapiantoSettimana: settimana,
                  giorniSeminaRaccolta: giorni, raccolta: (r - INIZIO_MESE[mr] + 1) + " " + MESI_LUNGHI[mr], semiMese: Math.ceil(settimana * 1.2 * 4.3)});
    }
  }
  return righe;
}

function pianoMontaggio(c) {
  const I = c.idro, A = I.auto, S = SISTEMI_IDRO[I.sistema], k = capacitaIdro(c), passi = [];
  const p = (t, d) => passi.push([t, d]);
  p("Misura e pulisci il posto", "Misura il locale e confrontalo con la pianta (scheda Struttura). Pavimento pulito e in piano, presa con salvavita vicina ma lontana dall'acqua.");
  if (I.clima.tenda) p("Monta la tenda", "Tenda " + k.tenda.nome + ": telaio, telo, cerniere chiuse. Prova che le cerniere scorrano con le mani bagnate.");
  if (["nft", "vassoi", "ebb", "kratky", "dwc"].includes(I.sistema) && k.piani > 1) p("Monta lo scaffale", k.piani + " ripiani a " + Math.round(k.misure.hPiano * 100) + " cm; il primo a 50 cm da terra per il serbatoio. Controlla con la livella.");
  if (I.sistema === "nft") p("Canali NFT", "Tappi alle estremità, fori da 5 cm ogni " + Math.round(Math.max(15, ...k.colture.map(x => x.P.passo || 15))) + " cm, pendenza 1:40 verso il collettore di ritorno. Prova con un secchio d'acqua che non ci siano ristagni.");
  if (I.sistema === "ebb") p("Vassoi a flusso e riflusso", "Raccordo di riempimento e troppo pieno a 5 cm dal fondo: il vassoio non deve mai traboccare anche se la pompa resta accesa.");
  if (I.sistema === "dwc") p("Vasca DWC", "Vasca scura, zattera di polistirolo alimentare, pietre porose sul fondo collegate alla pompa d'aria (con valvola di non ritorno).");
  if (I.sistema === "bucket" || I.sistema === "goccia") p(I.sistema === "goccia" ? "Lastre e gocciolatoi" : "Secchi e gocciolatoi", "Lava il substrato prima di usarlo, poi gocciolatoi a picchetto, tubo da 16 mm e scarico del drenaggio. Spago al soffitto per le piante rampicanti.");
  if (I.sistema === "torre") p("Torri", "Base stabile, pompa nel serbatoio alla base, timer a cicli. Le luci intorno alla torre, non sopra.");
  p("Serbatoio", k.serbatoio + " L, scuro, con coperchio, sotto il primo ripiano. Segna sul fianco il livello pieno e il minimo.");
  const idr = idraulicaIdro(c);
  if (idr) p("Pompa e tubi", "Pompa da almeno " + idr.qMax + " L/h e " + idr.hMax + " m di prevalenza; tubo di mandata da 16 mm con una valvolina per regolare la portata.");
  p("Lampade", Math.round(k.wLuci) + " W di " + k.L.nome.toLowerCase() + " a " + (I.luce.distanza_cm || 35) + " cm dalle foglie, appese con ganci a cricchetto. Cavi e alimentatori in alto, lontani dagli spruzzi.");
  if (I.clima.estrattore || I.clima.circolazione) p("Aria", (I.clima.estrattore ? "Estrattore in alto con il tubo verso l'esterno del garage. " : "") + (I.clima.circolazione ? "Ventilatore a clip che muove le foglie senza seccarle." : ""));
  if (A.micro !== "nessuno") p("Quadro di controllo", "ESP32, alimentatore 12 V, MOSFET per pompa e dosatori in una scatola IP65 a parete, sopra il livello di qualsiasi perdita. Collegamenti come nella tabella pin.");
  else p("Timer", "Timer da presa per luci" + (idr ? " e pompa" : "") + "; termometro minima/massima in tenda e uno nel serbatoio.");
  if (A.perdita) p("Sensore di perdita", "A pavimento, nel punto più basso vicino al serbatoio.");
  p("Ciabatta e prese", "Ciabatta con interruttore e magnetotermico fissata in alto; prese smart certificate per i carichi a 230 V. Mai prese sul pavimento.");
  return passi;
}

function pianoCollaudo(c) {
  const A = c.idro.auto, idr = idraulicaIdro(c), prove = [];
  const p = (t, come, ok) => prove.push([t, come, ok]);
  p("Tenuta dell'acqua", "Una settimana solo con acqua, senza piante e senza nutrienti" + (idr ? ", pompa accesa" : ""), "Pavimento asciutto, livello che cala solo per evaporazione");
  if (idr) p("Pompa ferma", "Stacca la pompa a impianto pieno", "L'acqua che torna (" + Math.round(idr.volumeRitorno) + " L) non fa traboccare il serbatoio");
  p("Luci", "Timer o presa smart: un giorno intero", "Accensione e spegnimento agli orari giusti; temperatura in tenda sotto il massimo delle colture");
  if (A.micro !== "nessuno") {
    if (A.livello) p("Galleggianti", "Alza e abbassa a mano ciascun galleggiante", "Minimo: pompa e dosatori fermi. Massimo: rabbocco fermo");
    if (A.perdita) p("Sensore di perdita", "Panno bagnato sul sensore", "Tutto spento entro un minuto, allarme sul telefono");
    if (A.flusso) p("Flussimetro", "Chiudi la valvolina della mandata", "Allarme FLUSSO_ASSENTE entro 2 minuti; pompa ferma dopo 3 tentativi");
    if (A.ph) p("Sonda pH", "Soluzioni di taratura 7,00 e 4,00", "Lettura entro ±0,1 dopo la taratura; con la penna entro ±0,2");
    if (A.ec) p("Sonda EC", "Soluzione 1413 µS/cm", "Lettura 1,41 ±0,05 mS/cm");
    if (A.dosaggio) p("Dosatori", "Cilindro graduato: 10 secondi per ciascuna pompa", "Portata misurata scritta in ML_AL_SECONDO; dose massima interrotta a 20 secondi");
    p("Modalità ombra", "Una settimana in ombra con l'impianto vero", "Le dosi proposte sono quelle che faresti tu con le penne");
    p("Blackout", "Stacca la corrente 10 minuti", "Al ritorno niente dosi per 15 minuti; allarmi ancora presenti");
  }
  p("Primo ciclo", "6-8 piante, pesate ogni settimana", "Registro compilato: confronto con il gemello nella scheda Registro");
  return prove;
}

function ipotesiELimiti(c) {
  return [
    "Clima: " + (c.meteoReale ? "anno vero (" + c.meteoReale.fonte + ")" : "medie mensili della zona " + REGIONI[c.regione].nome) + "; garage modellato con un bilancio termico semplice (MODELLI.md §4).",
    "Prezzi: stime a forbice senza fornitori né date di verifica; da confermare prima di comprare.",
    "Crescita: modello a efficienza d'uso della luce calibrato su un dato pubblicato (lattuga Cornell) per lattuga e basilico; per le altre colture valori di tabella (affidabilità C).",
    "Economia: consumo di casa ipotizzato per persona, scenari pessimistico e ottimistico con fattori dichiarati; nessuna imposta.",
    "Controllo: logica provata su serbatoio simulato e firmware provato con hardware finto; nessuna prova su scheda vera.",
    "Strutture: nessun calcolo di resistenza; scaffali e staffe vanno scelti con portata adeguata al peso dell'acqua (circa 1 kg per litro).",
    "Impianto elettrico: schema preliminare, non un progetto; i carichi a 230 V vanno verificati da un elettricista.",
  ];
}

// Regole per vendere: quadro informativo, non un parere legale. Ogni voce dice cosa verificare e con chi.
const NORMATIVA = [
  {tema: "Autoconsumo", testo: "Coltivare per la propria famiglia non richiede adempimenti. Regalare a parenti e amici neppure, purché non sia un'attività organizzata.", verifica: "-"},
  {tema: "Chi può vendere i propri prodotti", testo: "La vendita diretta dei prodotti ottenuti in prevalenza dalla propria azienda è riservata agli imprenditori agricoli iscritti al registro delle imprese (D.Lgs. 228/2001, art. 4), nel rispetto delle norme igienico-sanitarie.", verifica: "Inquadramento (imprenditore agricolo, art. 2135 c.c.), Partita IVA, iscrizione alla Camera di Commercio e all'INPS: commercialista o associazione agricola."},
  {tema: "Comunicazione di vendita", testo: "La vendita al dettaglio si comunica al Comune: in genere quello dove si vende (locali o posteggio) o quello dove ha sede l'azienda (itinerante, online). Le modalità variano: si passa dal SUAP.", verifica: "SUAP del Comune (nelle Marche modulistica regionale)."},
  {tema: "Igiene degli alimenti", testo: "Chi produce alimenti per la vendita è operatore del settore alimentare (Reg. CE 852/2004): registrazione presso l'autorità sanitaria e buone pratiche igieniche; per la produzione primaria valgono i requisiti dell'allegato I (acqua pulita, registri dei trattamenti, pulizia).", verifica: "Notifica sanitaria tramite SUAP all'Azienda Sanitaria Territoriale (AST, nelle Marche)."},
  {tema: "Locali e acqua", testo: "Un garage può andare bene per la produzione primaria se pulibile, protetto da animali e contaminazioni, con acqua potabile o adeguata. Confezionamento e lavorazione possono richiedere requisiti in più.", verifica: "AST e tecnico: idoneità del locale e destinazione d'uso."},
  {tema: "Tracciabilità", testo: "Bisogna poter dire a chi si è venduto e da chi si è comprato (Reg. CE 178/2002, art. 18): registro di vendite, lotti di semi e nutrienti.", verifica: "Il Registro del gemello aiuta, ma serve una registrazione delle vendite."},
  {tema: "Germogli", testo: "I germogli (semi germinati consumati con il seme) hanno regole speciali: stabilimento riconosciuto dall'autorità (Reg. UE 210/2013), tracciabilità dei semi (Reg. UE 208/2013) e criteri microbiologici (Reg. UE 209/2013).", verifica: "Regione e AST: riconoscimento prima di iniziare."},
  {tema: "Microgreens", testo: "I microgreens si tagliano sopra il substrato senza seme e di solito non sono considerati germogli, ma non c'è una definizione univoca: l'inquadramento va chiesto prima di vendere.", verifica: "AST: chiedi per iscritto se il tuo prodotto è germoglio o ortaggio fresco."},
  {tema: "Etichetta e confezione", testo: "Ortaggi freschi venduti sfusi: poche indicazioni (nome, origine, prezzo). Confezionati: etichettatura secondo il Reg. UE 1169/2011 e le norme di commercializzazione degli ortofrutticoli.", verifica: "Associazione di categoria o consulente per l'etichetta."},
];
if (typeof module !== "undefined") module.exports = {versioneConfig, calendarioIdro, pianoMontaggio, pianoCollaudo, ipotesiELimiti, NORMATIVA};
