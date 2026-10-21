"use strict";
// Interfaccia del gemello: due modi (orto in terra, idroponica in garage), editor di ogni componente, grafici, costi.

// ---------- configurazione ----------
const CHIAVE = "gemello-agritech-v2";
const DEFAULT = Object.assign(JSON.parse(JSON.stringify(ESEMPIO)), {modalita: "orto", idro: JSON.parse(JSON.stringify(IDRO_ESEMPIO))});
let cfg;
try { cfg = JSON.parse(localStorage.getItem(CHIAVE) || "null"); } catch (e) { cfg = null; }
function unisci(base, sopra) {
  const out = Array.isArray(base) ? [...base] : Object.assign({}, base);
  for (const k in sopra) {
    if (sopra[k] && typeof sopra[k] === "object" && !Array.isArray(sopra[k]) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) out[k] = unisci(base[k], sopra[k]);
    else out[k] = sopra[k];
  }
  return out;
}
cfg = cfg && Array.isArray(cfg.zone) ? unisci(DEFAULT, cfg) : JSON.parse(JSON.stringify(DEFAULT));
function salva() { try { localStorage.setItem(CHIAVE, JSON.stringify(cfg)); } catch (e) {} }
const idro = () => cfg.modalita === "idro";
const etGiorno = d => { const m = meseDi(d); return (d - INIZIO_MESE[m] + 1) + " " + MESI[m]; };

// ---------- piccoli costruttori di modulo ----------
let idSeq = 0;
function campoSel(etichetta, valore, voci, cambia) {
  const id = "c" + (++idSeq), s = el("select", {id});
  voci.forEach(([v, t]) => { const o = el("option", {value: v, text: t}); if (String(v) === String(valore)) o.selected = true; s.append(o); });
  s.addEventListener("change", e => cambia(e.target.value));
  return el("label", {class: "campo", for: id}, document.createTextNode(etichetta), s);
}
function campoNum(etichetta, valore, min, max, passo, cambia, unita) {
  const id = "c" + (++idSeq), i = el("input", {id, type: "number", min, max, step: passo, value: valore});
  i.addEventListener("change", e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= min && v <= max) cambia(v); });
  return el("label", {class: "campo", for: id}, document.createTextNode(etichetta + (unita ? " (" + unita + ")" : "")), i);
}
function spunta(etichetta, valore, cambia, nota) {
  const id = "c" + (++idSeq), i = el("input", {id, type: "checkbox"}); i.checked = !!valore;
  i.addEventListener("change", e => cambia(e.target.checked));
  return el("label", {class: "spunta", for: id}, i, el("span", null, document.createTextNode(etichetta), nota ? el("span", {class: "piccolo", text: " · " + nota}) : null));
}
function schede(etichetta, valore, voci, cambia, chiave) {
  // voci: [[valore, nome, riga di dettaglio, pro, contro]]
  const g = el("div", {class: "opzioni", role: "radiogroup", "aria-label": etichetta, id: chiave ? "ed-" + chiave : null});
  voci.forEach(([v, nome, dett, pro, contro]) => {
    const b = el("button", {class: "opzione" + (String(v) === String(valore) ? " scelta" : ""), role: "radio", "aria-checked": String(v) === String(valore) ? "true" : "false", type: "button"},
      el("span", {class: "op-nome", text: nome}), dett ? el("span", {class: "op-dett", text: dett}) : null,
      pro ? el("span", {class: "op-pro", text: "+ " + pro}) : null, contro ? el("span", {class: "op-contro", text: "− " + contro}) : null);
    b.addEventListener("click", () => cambia(v));
    g.append(b);
  });
  return el("div", {class: "blocco"}, el("span", {class: "etichetta", text: etichetta}), g);
}
const prezzoTesto = p => p[1] === 0 ? "0 €" : p[0] === p[1] ? p[0] + " €" : p[0] + "–" + p[1] + " €";
function riquadro(titolo, ...figli) { return el("div", {class: "riquadro blocco"}, el("h3", {text: titolo}), ...figli); }
function griglia(...figli) { return el("div", {class: "campi"}, ...figli); }
function chip(tipo, testo) { return el("span", {class: "chip " + tipo, text: testo}); }
function messaggio(tipo, titolo, testo, chiave) {
  return el("div", {class: "msg"}, chip(tipo, tipo === "ok" ? "a posto" : tipo === "warn" ? "attenzione" : "problema"),
    el("div", null, el("strong", {text: titolo}), el("p", {class: "piccolo", text: testo}),
      chiave ? el("button", {class: "link", type: "button", text: "Cambia", onclick: () => vaiA(chiave)}) : null));
}
function vaiA(chiave) {
  const sezioni = idro() ? {sistema: "progetto", colture: "progetto", luce: "progetto", economia: "progetto", locale: "progetto", struttura: "progetto", meteo: "progetto", clima: "progetto", tenda: "progetto", acqua: "progetto", nutrienti: "progetto", scaffale: "progetto", serbatoio: "progetto", substrato: "progetto", semi: "progetto", strumenti: "progetto"}
                        : {ambiente: "progetto", cisterna: "progetto", logica: "logica"};
  apri(sezioni[chiave] || "componenti");
  setTimeout(() => { const t = document.getElementById("ed-" + chiave); if (t) { t.scrollIntoView({behavior: "smooth", block: "center"}); t.classList.add("evidenzia"); setTimeout(() => t.classList.remove("evidenzia"), 1600); } }, 60);
}

// ---------- EDITOR: ORTO ----------
function editorProgettoOrto(box) {
  const c = cfg;
  box.append(
    riquadro("Dove e come", griglia(
      campoSel("Zona d'Italia", c.regione, Object.entries(REGIONI).map(([k, r]) => [k, r.nome]), v => { c.regione = v; aggiorna(); }),
      campoSel("Anno da simulare", c.anno, Object.entries(ANNI).map(([k, a]) => [k, a.nome]), v => { c.anno = v; aggiorna(); }),
      campoSel("Terreno", c.terreno, Object.entries(TERRENI).map(([k, t]) => [k, t.nome]), v => { c.terreno = v; aggiorna(); })),
      schede("Ambiente", c.ambiente, Object.entries(AMBIENTI).map(([k, a]) => [k, a.nome, a.descr]), v => { c.ambiente = v; if (v === "interno") { c.acqua.fonte = c.acqua.fonte === "cisterna" ? "cisterna" : "rubinetto"; c.acqua.cisterna_l = Math.min(c.acqua.cisterna_l, 60); c.componenti.alimentazione = "rete"; } aggiorna(true); }, "ambiente")),
  );
  if (c.ambiente === "interno") box.append(riquadro("Stanza interna", griglia(
    campoNum("Luce LED", c.interno.led_w_m2, 20, 400, 10, v => { c.interno.led_w_m2 = v; aggiorna(); }, "W per m²"),
    campoNum("Ore di luce al giorno", c.interno.ore_luce, 8, 20, 1, v => { c.interno.ore_luce = v; aggiorna(); }),
    campoNum("Temperatura della stanza", c.interno.temp, 10, 30, 1, v => { c.interno.temp = v; aggiorna(); }, "°C"),
    campoNum("Ventola", c.interno.ventola_w, 0, 100, 5, v => { c.interno.ventola_w = v; aggiorna(); }, "W"))));
  // zone
  const tb = el("tbody");
  c.zone.forEach((z, i) => {
    const P = PIANTE[z.coltura];
    const sc = el("select", {"aria-label": "Pianta zona " + (i + 1)}); Object.entries(PIANTE).forEach(([k, p]) => { const o = el("option", {value: k, text: p.nome}); if (k === z.coltura) o.selected = true; sc.append(o); });
    sc.addEventListener("change", e => { z.coltura = e.target.value; if (!PIANTE[z.coltura].mesi.includes(z.mese)) z.mese = PIANTE[z.coltura].mesi[0]; aggiorna(true); });
    const ar = el("input", {type: "number", min: "0.5", step: "0.5", value: z.area, "aria-label": "m² zona " + (i + 1)}); ar.addEventListener("change", e => { const v = parseFloat(e.target.value); if (v > 0) { z.area = v; aggiorna(); } });
    const ms = el("select", {"aria-label": "Mese zona " + (i + 1)}); P.mesi.forEach(m => { const o = el("option", {value: m, text: MESI[m - 1]}); if (m === z.mese) o.selected = true; ms.append(o); });
    ms.addEventListener("change", e => { z.mese = +e.target.value; aggiorna(); });
    const cc = el("input", {type: "number", min: "1", max: "4", value: z.cicli, "aria-label": "Cicli zona " + (i + 1)}); cc.addEventListener("change", e => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= 4) { z.cicli = v; aggiorna(); } });
    const pc = el("input", {type: "checkbox", "aria-label": "Pacciamatura zona " + (i + 1)}); pc.checked = z.pacciamatura; pc.addEventListener("change", e => { z.pacciamatura = e.target.checked; aggiorna(); });
    const rl = el("input", {type: "checkbox", "aria-label": "Rialzata zona " + (i + 1)}); rl.checked = z.rialzata; rl.addEventListener("change", e => { z.rialzata = e.target.checked; aggiorna(); });
    const via = el("button", {class: "az sec", type: "button", text: "Togli"}); via.disabled = c.zone.length <= 1; via.addEventListener("click", () => { c.zone.splice(i, 1); aggiorna(true); });
    tb.append(el("tr", null, el("td", null, el("span", {class: "pallino", style: `background:${COLORI[i]}`}), document.createTextNode(String(i + 1))),
      el("td", null, sc), el("td", null, ar), el("td", null, ms), el("td", null, cc), el("td", null, pc), el("td", null, rl), el("td", null, via)));
  });
  const agg = el("button", {class: "az sec", type: "button", text: "Aggiungi zona"}); agg.disabled = c.zone.length >= 4;
  agg.addEventListener("click", () => { c.zone.push({coltura: "peperone", area: 2, mese: 4, cicli: 1, pacciamatura: true, rialzata: false}); aggiorna(true); });
  box.append(riquadro("Zone e piante", el("p", {class: "piccolo", text: "Una zona è un gruppo di piante con la stessa sete e la stessa valvola."}),
    el("div", {class: "scorri"}, el("table", {class: "zone"}, el("thead", null, el("tr", null, ...["Zona", "Pianta", "m²", "Da", "Cicli", "Pacciam.", c.ambiente === "interno" ? "Cassone" : "Rialzata", ""].map(t => el("th", {text: t})))), tb)), el("div", null, agg)));
  // acqua e prezzi
  const acq = [campoSel("Da dove prendi l'acqua", c.acqua.fonte, [["cisterna", c.ambiente === "interno" ? "Tanica + pompa" : "Cisterna di acqua piovana + pompa"], ["rubinetto", "Rubinetto (senza pompa)"]], v => { c.acqua.fonte = v; aggiorna(true); })];
  if (c.acqua.fonte === "cisterna") acq.push(campoNum(c.ambiente === "interno" ? "Tanica" : "Cisterna", c.acqua.cisterna_l, 20, 10000, 20, v => { c.acqua.cisterna_l = v; aggiorna(); }, "litri"));
  if (c.acqua.fonte === "cisterna" && c.ambiente !== "interno") acq.push(campoNum("Tetto collegato alla grondaia", c.acqua.tetto_m2, 0, 500, 1, v => { c.acqua.tetto_m2 = v; aggiorna(); }, "m²"));
  acq.push(campoNum("Prezzo acqua di rete", c.prezzi.acqua_m3, 0, 10, 0.1, v => { c.prezzi.acqua_m3 = v; aggiorna(); }, "€/m³"), campoNum("Prezzo corrente", c.prezzi.kwh, 0, 1, 0.01, v => { c.prezzi.kwh = v; aggiorna(); }, "€/kWh"));
  box.append(riquadro("Acqua e prezzi", el("div", {id: "ed-cisterna"}, griglia(...acq)), c.acqua.fonte === "cisterna" ? spunta("Se la cisterna è vuota uso il rubinetto", c.acqua.rete_riserva, v => { c.acqua.rete_riserva = v; aggiorna(); }) : null));
  box.append(meteoVeroUI());
}
function voceCat(fam, k, extra) {
  const o = CATALOGO[fam].opzioni[k];
  const dett = [o.p ? prezzoTesto(o.p) : null, o.w != null && o.w > 0 ? o.w + " W" : null, extra ? extra(o) : null].filter(Boolean).join(" · ");
  return [k, o.nome, dett, o.pro, o.contro];
}
function editorComponentiOrto(box) {
  const c = cfg, comp = c.componenti, ex = c.extra;
  const set = (k, v, ricostruisci = true) => { comp[k] = v; c.preset = null; aggiorna(ricostruisci); };
  const pre = el("div", {class: "opzioni"});
  Object.entries(PRESET).forEach(([k, p]) => { const b = el("button", {class: "opzione" + (c.preset === k ? " scelta" : ""), type: "button"}, el("span", {class: "op-nome", text: p.nome}), el("span", {class: "op-dett", text: p.descr}));
    b.addEventListener("click", () => { Object.assign(comp, p.componenti); Object.assign(ex, p.extra); c.preset = k; aggiorna(true); }); pre.append(b); });
  box.append(riquadro("Parti da un pacchetto", el("p", {class: "piccolo", text: "Poi cambia quello che vuoi pezzo per pezzo: il gemello ricalcola tutto e ti dice se qualcosa non va."}), pre));
  const fam = (f, k, extra) => schede(CATALOGO[f].titolo, comp[k], Object.keys(CATALOGO[f].opzioni).map(o => voceCat(f, o, extra)), v => set(k, v), k);
  box.append(riquadro("Microcontrollore", el("p", {class: "piccolo", text: CATALOGO.micro.spiega}),
    fam("micro", "micro", o => o.adc + " ingressi analogici · " + o.linguaggio),
    solareAttivo(c) ? spunta("Risparmio energetico (sonno profondo tra una misura e l'altra)", comp.sonno, v => set("sonno", v, false)) : null));
  box.append(riquadro("Sensori nel terreno", el("p", {class: "piccolo", text: CATALOGO.sensore_suolo.spiega}),
    fam("sensore_suolo", "sensore_suolo", o => "precisione ±" + Math.round(o.rumore * 100) + "% · dura " + (o.vita >= 3650 ? "10+ anni" : o.vita >= 365 ? Math.round(o.vita / 365) + " anni" : Math.round(o.vita / 30) + " mesi")),
    griglia(campoNum("Sensori per zona", comp.sensori_zona, 1, 3, 1, v => set("sensori_zona", v)),
      campoSel("Sostituzione programmata", comp.sostituzione_mesi, [[0, "Solo quando si rompe"], [3, "Ogni 3 mesi"], [6, "Ogni 6 mesi"], [12, "Ogni anno"], [24, "Ogni 2 anni"]], v => set("sostituzione_mesi", +v, false)))));
  const ambiente = [fam("aria", "aria")];
  if (c.acqua.fonte === "cisterna") ambiente.push(fam("livello", "livello"));
  const extraBox = el("div", {class: "campi", id: "ed-extra"});
  for (const k of ["galleggiante", "flussimetro", "pioggia", "sonda_quadro", "luce", "co2", "filtro"]) {
    if (k === "galleggiante" && c.acqua.fonte !== "cisterna") continue;
    extraBox.append(el("div", {id: "ed-" + k}, spunta(EXTRA[k].nome + " (" + prezzoTesto(EXTRA[k].p) + ")", ex[k], v => { ex[k] = v; c.preset = null; aggiorna(true); }, EXTRA[k].spiega)));
  }
  box.append(riquadro("Aria, livello e altri sensori", ...ambiente, el("span", {class: "etichetta", text: "Sensori e accessori sì/no"}), extraBox));
  const att = [];
  if (c.acqua.fonte === "cisterna") att.push(fam("pompa", "pompa", o => o.portata + " L/min"));
  att.push(fam("valvole", "valvole", o => o.w_aperta + " W quando è aperta"), fam("erogatori", "erogatori", o => Math.round(o.efficienza * 100) + "% dell'acqua alle radici"));
  box.append(riquadro("Pompa, valvole, erogatori", ...att));
  const corr = [];
  if (c.ambiente !== "interno") corr.push(schede("Alimentazione", comp.alimentazione, [["rete", "Presa di casa → alimentatore 12 V", "8-14 €"], ["solare", "Pannello solare + batteria", "per orti senza presa"]], v => set("alimentazione", v), "alimentazione"));
  if (solareAttivo(c)) {
    corr.push(griglia(campoSel("Pannello", comp.pannello_w, PANNELLI.map(w => [w, w + " W"]), v => set("pannello_w", +v)),
      campoSel("Batteria", comp.batteria_ah, BATTERIE_AH.map(a => [a, a + " Ah (12 V)"]), v => set("batteria_ah", +v))));
    corr.push(schede("Tipo di batteria", comp.batteria, Object.entries(CATALOGO.batteria.opzioni).map(([k, o]) => [k, o.nome, o.euro_ah[0] + "–" + o.euro_ah[1] + " €/Ah · usi il " + Math.round(o.utile * 100) + "%", o.pro, o.contro]), v => set("batteria", v), "batteria"));
    corr.push(schede("Regolatore", comp.regolatore, Object.entries(CATALOGO.regolatore.opzioni).map(([k, o]) => [k, o.nome, prezzoTesto(o.p) + " · resa " + Math.round(o.resa * 100) + "%"]), v => set("regolatore", v), "regolatore"));
  }
  corr.push(el("div", {id: "ed-step_down"}, spunta(EXTRA.step_down.nome + " (" + prezzoTesto(EXTRA.step_down.p) + ")", ex.step_down, v => { ex.step_down = v; c.preset = null; aggiorna(); }, EXTRA.step_down.spiega)));
  if (!solareAttivo(c)) corr.push(el("div", {id: "ed-ups"}, spunta(EXTRA.ups.nome + " (" + prezzoTesto(EXTRA.ups.p) + ")", ex.ups, v => { ex.ups = v; c.preset = null; aggiorna(); }, EXTRA.ups.spiega)));
  box.append(riquadro("Corrente", ...corr));
  box.append(riquadro("Connessione, avvisi e quadro", fam("connessione", "connessione"), fam("centrale", "centrale"), fam("quadro", "quadro"),
    c.ambiente !== "interno" ? griglia(campoNum("Altezza del quadro da terra", comp.quadro_cm, 0, 150, 5, v => set("quadro_cm", v), "cm")) : null));
}
function editorLogicaOrto(box) {
  const L = cfg.logica, set = (k, v) => { L[k] = v; aggiorna(); };
  box.append(riquadro("Come decide quando irrigare", el("div", {id: "ed-logica"}),
    schede("Strategia", L.strategia, [["sensori", "Sensori di umidità", "irriga quando il terreno lo chiede"], ["timer", "Timer a orario fisso", "stessi minuti ogni giorno, piova o no"]], v => set("strategia", v)),
    griglia(campoNum("Inizia a irrigare sotto", L.soglia_on, 10, 90, 1, v => set("soglia_on", v), "%"),
      campoNum("Smette sopra", L.soglia_off, 20, 100, 1, v => set("soglia_off", v), "%"),
      campoNum("Soglia critica (irriga anche con pioggia prevista)", L.soglia_critica, 0, 60, 1, v => set("soglia_critica", v), "%"),
      campoNum("Salta se è prevista pioggia oltre", L.pioggia_salta_mm, 0, 50, 1, v => set("pioggia_salta_mm", v), "mm"),
      campoNum("Tempo massimo per irrigazione", L.max_min, 1, 120, 1, v => set("max_min", v), "min"),
      campoNum("Pausa minima", L.pausa_min, 0, 1440, 5, v => set("pausa_min", v), "min"),
      campoNum("Timer: minuti al giorno", L.timer_min, 1, 240, 1, v => set("timer_min", v), "min"),
      campoNum("Sensore guasto: minuti al giorno", L.emergenza_min, 0, 60, 1, v => set("emergenza_min", v), "min"),
      campoNum("Riserva della cisterna", L.riserva_l, 0, 5000, 10, v => set("riserva_l", v), "L")),
    spunta("Niente irrigazione col gelo", L.blocco_gelo, v => set("blocco_gelo", v)),
    spunta("Controllo 'acqua inattesa' (valvola bloccata aperta)", L.acqua_inattesa, v => set("acqua_inattesa", v)),
    griglia(campoSel("Quanto ci metti a riparare un guasto", cfg.reazione_giorni == null ? "auto" : cfg.reazione_giorni, [["auto", "Automatico (1 giorno con avvisi, 7 senza)"], [0, "Subito"], [1, "1 giorno"], [3, "3 giorni"], [7, "7 giorni"], [14, "14 giorni"]], v => { cfg.reazione_giorni = v === "auto" ? null : +v; aggiorna(); }))),
    el("p", {class: "piccolo", text: "Sono gli stessi parametri di PARAMETRI_DEFAULT in sistema/controllo.py: quello che scegli qui va in firmware/esp32-irrigazione/config.py."}));
}
function editorGuasti(box, tipi, opzZona) {
  const lista = idro() ? cfg.idro.guasti : cfg.guasti;
  const righe = el("div");
  lista.forEach((g, i) => righe.append(el("div", {class: "mat"}, el("span", null, document.createTextNode(tipi[g.tipo].nome + (g.zona != null && tipi[g.tipo].zona ? " · zona " + (g.zona + 1) : "") + " · " + etGiorno(g.giorno) + (g.durata ? " · " + g.durata + " giorni" : "") + (g.ore ? " · " + g.ore + " ore" : ""))),
    el("button", {class: "link", type: "button", text: "Togli", onclick: () => { lista.splice(i, 1); aggiorna(); }}), el("span", {class: "perche", text: tipi[g.tipo].spiega}))));
  if (!lista.length) righe.append(el("p", {class: "piccolo", text: "Nessun guasto programmato: l'anno scorre liscio. Aggiungine uno per vedere come reagisce l'impianto."}));
  const nuovo = {tipo: Object.keys(tipi)[0], zona: 0, mese: 7, giorno: 10, durata: 3, ore: 5};
  const form = griglia(
    campoSel("Guasto", nuovo.tipo, Object.entries(tipi).map(([k, t]) => [k, t.nome]), v => nuovo.tipo = v),
    ...(opzZona ? [campoSel("Zona", 0, cfg.zone.map((z, i) => [i, (i + 1) + " · " + PIANTE[z.coltura].nome]), v => nuovo.zona = +v)] : []),
    campoSel("Mese", 7, MESI_LUNGHI.map((m, i) => [i + 1, m]), v => nuovo.mese = +v),
    campoNum("Giorno", 10, 1, 31, 1, v => nuovo.giorno = v),
    idro() ? campoNum("Ore (blackout)", 5, 1, 48, 1, v => nuovo.ore = v) : campoNum("Durata (blackout)", 3, 1, 30, 1, v => nuovo.durata = v, "giorni"));
  const agg = el("button", {class: "az", type: "button", text: "Aggiungi guasto"});
  agg.addEventListener("click", () => {
    const d = Math.min(364, INIZIO_MESE[nuovo.mese - 1] + Math.min(GIORNI_MESE[nuovo.mese - 1], nuovo.giorno) - 1);
    const g = {tipo: nuovo.tipo, giorno: d};
    if (tipi[nuovo.tipo].zona) g.zona = nuovo.zona;
    if (nuovo.tipo === "blackout") { if (idro()) g.ore = nuovo.ore; else g.durata = nuovo.durata; }
    lista.push(g); aggiorna();
  });
  const pronti = idro()
    ? [["Estate difficile", [{tipo: "blackout", giorno: 200, ore: 5}, {tipo: "pompa_guasta", giorno: 215}]], ["Sonda pH sbagliata", [{tipo: "sonda_ph", giorno: 120}]], ["Perdita in garage", [{tipo: "perdita", giorno: 250}]], ["Lampada rotta", [{tipo: "lampada", giorno: 60}]]]
    : [["Autunno con nubifragio", [{tipo: "nubifragio", giorno: 290}]], ["Alimentatore debole", [{tipo: "alimentatore_debole", giorno: 160}]], ["Valvola bloccata", [{tipo: "valvola_aperta", zona: Math.min(1, cfg.zone.length - 1), giorno: 180}]], ["Sensore fuori terra", [{tipo: "sensore_fuori_terra", zona: 0, giorno: 170}]], ["Blackout in vacanza", [{tipo: "blackout", giorno: 215, durata: 4}]]];
  const bp = el("div", {class: "opzioni"});
  pronti.forEach(([n, gg]) => { const b = el("button", {class: "opzione", type: "button"}, el("span", {class: "op-nome", text: n})); b.addEventListener("click", () => { gg.forEach(g => lista.push(Object.assign({}, g))); aggiorna(); }); bp.append(b); });
  box.append(riquadro("Guasti programmati", righe), riquadro("Aggiungi un guasto", form, el("div", null, agg)), riquadro("Scenari pronti", bp,
    lista.length ? el("button", {class: "az sec", type: "button", text: "Togli tutti i guasti", onclick: () => { lista.length = 0; aggiorna(); }}) : null));
}

// ---------- EDITOR: IDROPONICA ----------
function editorProgettoIdro(box) {
  const I = cfg.idro, k = capacitaIdro(cfg);
  const set = (o, kk, v, r = true) => { o[kk] = v; aggiorna(r); };
  box.append(riquadro("Sistema", el("div", {id: "ed-sistema"}),
    schede("Tipo di impianto", I.sistema, Object.entries(SISTEMI_IDRO).map(([kk, s]) => [kk, s.nome, s.descr, s.pro, s.contro]), v => {
      I.sistema = v; const adatte = Object.keys(IDRO_PIANTE).filter(p => IDRO_PIANTE[p].sistemi.includes(v));
      I.colture = I.colture.filter(x => adatte.includes(x.coltura)); if (!I.colture.length) I.colture = [{coltura: adatte[0], quota: 100}]; aggiorna(true); }),
    I.sistema === "torre" ? griglia(campoNum("Torri", I.torri, 1, 6, 1, v => set(I, "torri", v), "36 piante ciascuna"))
      : griglia(...(!["bucket", "goccia"].includes(I.sistema) ? [campoSel("Disposizione", I.disposizione, [["orizzontale", "Orizzontale (un piano)"], ["scaffale", "Scaffale a più piani"]], v => set(I, "disposizione", v))] : []),
        ...(I.disposizione === "scaffale" && !["bucket", "goccia"].includes(I.sistema) ? [campoNum("Piani", I.piani, 1, 5, 1, v => set(I, "piani", v))] : []),
        ...(() => { const m = misureImpianto(I), st = I.struttura = Object.assign({lung_cm: Math.round(m.lung * 100), prof_cm: Math.round(m.prof * 100), h_piano_cm: 45}, I.struttura || {});
          const aggiornaSup = () => { I.superficie_piano = st.lung_cm * st.prof_cm / 10000; aggiorna(true); };
          return [campoNum("Lunghezza del ripiano", st.lung_cm, 30, 400, 5, v => { st.lung_cm = v; aggiornaSup(); }, "cm"),
            campoNum("Profondità del ripiano", st.prof_cm, 30, 200, 5, v => { st.prof_cm = v; aggiornaSup(); }, "cm"),
            ...(I.disposizione === "scaffale" ? [campoNum("Distanza tra i ripiani", st.h_piano_cm, 30, 100, 5, v => { st.h_piano_cm = v; aggiorna(true); }, "cm")] : [])]; })(),
        ...(I.sistema === "bucket" ? [campoNum("Secchi", I.secchi, 1, 16, 1, v => set(I, "secchi", v))] : I.sistema === "goccia" ? [campoNum("Lastre da 100 cm", I.secchi, 1, 12, 1, v => set(I, "secchi", v), "3 piante ciascuna")] : []))));
  const Lc = I.locale = Object.assign({lung: 5, larg: 3, alt: 2.4, auto: true}, I.locale || {}), pos = posizionaImpianto(cfg);
  box.append(riquadro("Il locale", el("div", {id: "ed-locale"}), el("div", {id: "ed-struttura"}),
    griglia(campoNum("Lunghezza", Lc.lung, 1, 30, 0.1, v => set(Lc, "lung", v, false), "m"), campoNum("Larghezza", Lc.larg, 1, 20, 0.1, v => set(Lc, "larg", v, false), "m"),
      campoNum("Altezza", Lc.alt, 1.5, 6, 0.1, v => set(Lc, "alt", v, false), "m")),
    spunta("Deve restare il passaggio (o l'auto) lungo un lato", Lc.auto, v => set(Lc, "auto", v, false), "80 cm liberi"),
    el("p", {class: "piccolo", text: (pos.entra ? "Entra: " : "Non entra: ") + (pos.entra ? "occupa circa " + fmt(pos.m2, 1) + " m² con lo spazio per lavorare; altezza " + fmt(pos.altezza, 2) + " m." : pos.motivo) + " Tenda: " + (I.clima.tenda ? capacitaIdro(cfg).tenda.nome : "nessuna") + ". Pianta nella scheda Struttura."})));
  // colture
  const adatte = Object.entries(IDRO_PIANTE).filter(([kk, p]) => p.sistemi.includes(I.sistema));
  const tb = el("tbody");
  I.colture.forEach((x, i) => {
    const P = IDRO_PIANTE[x.coltura], kc = k.colture[i];
    const s = el("select", {"aria-label": "Coltura " + (i + 1)}); adatte.forEach(([kk, p]) => { const o = el("option", {value: kk, text: p.nome}); if (kk === x.coltura) o.selected = true; s.append(o); });
    s.addEventListener("change", e => { x.coltura = e.target.value; aggiorna(true); });
    const q = el("input", {type: "number", min: "5", max: "100", step: "5", value: x.quota, "aria-label": "Quota coltura " + (i + 1)}); q.addEventListener("change", e => { const v = parseFloat(e.target.value); if (v > 0) { x.quota = v; aggiorna(true); } });
    const via = el("button", {class: "az sec", type: "button", text: "Togli"}); via.disabled = I.colture.length <= 1; via.addEventListener("click", () => { I.colture.splice(i, 1); aggiorna(true); });
    tb.append(el("tr", null, el("td", null, s), el("td", null, q), el("td", {class: "n", text: kc ? kc.piante : "-"}), el("td", {class: "n", text: P.ec.join("–")}), el("td", {class: "n", text: P.ph.join("–")}), el("td", {class: "n", text: P.ppfd.join("–")}), el("td", {class: "n", text: P.t.join("–")}), el("td", null, via)));
  });
  const agg = el("button", {class: "az sec", type: "button", text: "Aggiungi coltura"}); agg.disabled = I.colture.length >= 4;
  agg.addEventListener("click", () => { const libera = adatte.find(([kk]) => !I.colture.some(x => x.coltura === kk)); I.colture.push({coltura: libera ? libera[0] : adatte[0][0], quota: 20}); aggiorna(true); });
  box.append(riquadro("Colture nello stesso serbatoio", el("div", {id: "ed-colture"}), el("p", {class: "piccolo", text: "La quota è lo spazio che dai a ogni coltura. Le colonne mostrano i valori da rispettare: se sono molto diversi, servono due serbatoi."}),
    el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Coltura", "Quota %", "Piante", "EC", "pH", "PPFD", "Aria °C", ""].map(t => el("th", {text: t})))), tb)), el("div", null, agg)));
  // luce
  box.append(riquadro("Luce", el("div", {id: "ed-luce"}),
    schede("Lampade", I.luce.tipo, Object.entries(LUCI_IDRO).map(([kk, l]) => [kk, l.nome, l.eff + " µmol/J · " + l.euro_w[0] + "–" + l.euro_w[1] + " €/W", l.pro, l.contro]), v => set(I.luce, "tipo", v)),
    griglia(campoNum("Obiettivo di luce (0 = consigliato dalle colture)", I.luce.ppfd, 0, 1000, 10, v => set(I.luce, "ppfd", v), "µmol/m²/s"),
      campoNum("Ore di luce (0 = consigliate)", I.luce.ore, 0, 20, 1, v => set(I.luce, "ore", v)),
      campoNum("Watt di lampade montati (0 = quelli che servono)", I.luce.w_installati || 0, 0, 3000, 10, v => set(I.luce, "w_installati", v), "W")),
    spunta("Luci accese di notte (da 20:00)", I.luce.notte, v => set(I.luce, "notte", v), "d'estate il garage è più fresco, d'inverno le luci scaldano quando fa più freddo"),
    el("p", {class: "piccolo", text: "Per " + k.ppfdObiettivo + " µmol/m²/s servono circa " + k.wRichiesti + " W. Montati " + k.wLuci + " W × " + k.L.eff + " µmol/J × " + k.geometria + " (luce che arriva alle foglie) ÷ " + k.chioma.toFixed(2) + " m² = " + k.ppfd + " µmol/m²/s per " + k.ore + " ore = DLI " + k.dli.toFixed(1) + " mol/m²/giorno. Lampade a 30-45 cm dalle foglie."}),
    el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Coltura", "DLI ideale", "DLI che riceve", "Resa rispetto al riferimento"].map((t, i) => el("th", {class: i ? "n" : "", text: t})))),
      el("tbody", null, ...k.colture.map(x => { const st = statoLuce(x.P, k.dli); return el("tr", null, el("td", {text: x.P.nome}), el("td", {class: "n", text: x.P.dli.join("–")}), el("td", {class: "n", text: k.dli.toFixed(1)}),
        el("td", {class: "n", text: Math.round(st.fattore * 100) + "%" + (st.stato === "poca" ? " · poca luce" : st.stato === "troppa" ? " · oltre il necessario" : "")})); })))),
    el("p", {class: "piccolo", text: "La resa cresce in proporzione alla luce del giorno fino al massimo della coltura, poi non cresce più (modello a efficienza d'uso della luce, da calibrare con le tue pesate)."}),
    ...mappaLuceUI(I, set)));
  // clima
  const CL = I.clima;
  box.append(riquadro("Clima del garage", el("div", {id: "ed-clima"}), el("div", {id: "ed-tenda"}),
    griglia(campoSel("Garage", CL.garage, [["non_isolato", "Non isolato (segue il clima di fuori)"], ["isolato", "Isolato o interrato"]], v => set(CL, "garage", v)),
      campoSel("Riscaldamento", CL.riscaldamento, [["nessuno", "Nessuno"], ["tappetino", "Riscaldatore per l'acqua (100 W)"], ["stufetta", "Termoventilatore 1000 W con termostato"]], v => set(CL, "riscaldamento", v)),
      campoNum("Temperatura minima", CL.t_min, 5, 25, 1, v => set(CL, "t_min", v), "°C")),
    spunta("Tenda da coltivazione", CL.tenda, v => set(CL, "tenda", v)), spunta("Estrattore con termostato", CL.estrattore, v => set(CL, "estrattore", v)),
    spunta("Ventilatore di circolazione", CL.circolazione, v => set(CL, "circolazione", v)), spunta("Deumidificatore", CL.deumidificatore, v => set(CL, "deumidificatore", v))));
  // acqua e nutrienti
  box.append(riquadro("Acqua e nutrienti", el("div", {id: "ed-acqua"}), el("div", {id: "ed-nutrienti"}),
    griglia(campoSel("Durezza dell'acqua di casa", I.acqua.durezza, Object.entries(DUREZZE).map(([kk, d]) => [kk, d.nome]), v => set(I.acqua, "durezza", v)),
      campoNum("Cambio completo della soluzione ogni", I.acqua.cambio_giorni, 7, 60, 1, v => set(I.acqua, "cambio_giorni", v), "giorni")),
    spunta("Osmosi inversa", I.acqua.osmosi, v => set(I.acqua, "osmosi", v)), spunta("Mescolo acqua piovana", I.acqua.piovana, v => set(I.acqua, "piovana", v)),
    schede("Nutrienti", I.nutrienti, Object.entries(NUTRIENTI).map(([kk, n]) => [kk, n.nome, prezzoTesto(n.kit) + " il kit", n.pro, n.contro]), v => { I.nutrienti = v; aggiorna(); }),
    ...ricettaUI(I, k),
    griglia(campoSel("Zona d'Italia (clima del garage)", cfg.regione, Object.entries(REGIONI).map(([kk, r]) => [kk, r.nome]), v => { cfg.regione = v; aggiorna(); }),
      campoNum("Prezzo corrente", cfg.prezzi.kwh, 0, 1, 0.01, v => { cfg.prezzi.kwh = v; aggiorna(); }, "€/kWh"),
      campoNum("Prezzo acqua", cfg.prezzi.acqua_m3, 0, 10, 0.1, v => { cfg.prezzi.acqua_m3 = v; aggiorna(); }, "€/m³"))));
  box.append(meteoVeroUI());
  // produzione ed economia
  const PR = I.produzione, E = I.economia;
  box.append(riquadro("Produzione ed economia", el("div", {id: "ed-economia"}),
    griglia(campoNum("Piante che muoiono o si scartano", PR.mortalita, 0, 50, 1, v => set(PR, "mortalita", v, false), "%"),
      campoNum("Giorni fermi tra un ciclo e l'altro", PR.fermo_giorni, 0, 30, 1, v => set(PR, "fermo_giorni", v, false), "pulizia e trapianto"),
      campoNum("Raccolto non utilizzabile", PR.scarto, 0, 50, 1, v => set(PR, "scarto", v, false), "%"),
      campoNum("Vita dell'impianto", E.vita_anni, 1, 15, 1, v => set(E, "vita_anni", v, false), "anni"),
      campoNum("Lavoro", E.ore_settimana, 0, 40, 0.5, v => set(E, "ore_settimana", v, false), "ore a settimana"),
      campoNum("Valore del tuo lavoro", E.euro_ora, 0, 50, 1, v => set(E, "euro_ora", v, false), "€/ora, 0 = hobby"),
      campoNum("Persone in famiglia", E.persone, 1, 10, 1, v => set(E, "persone", v, false), "quanto si mangia in casa"),
      campoNum("Raccolto venduto", E.quota_vendita, 0, 100, 5, v => set(E, "quota_vendita", v, false), "%"),
      campoNum("Prezzo di vendita", E.prezzo_vendita, 10, 150, 5, v => set(E, "prezzo_vendita", v, false), "% del prezzo al negozio")),
    el("p", {class: "piccolo", text: "Il raccolto mangiato in casa (fino a quanto mangia la tua famiglia) vale quanto costerebbe al negozio; quello venduto vale il prezzo di vendita (a ristoranti o mercati di solito meno del negozio). Per vendere servono le regole della scheda Percorso."})));
}
function editorComponentiIdro(box) {
  const A = cfg.idro.auto, set = (kk, v) => { A[kk] = v; aggiorna(true); };
  box.append(riquadro("Microcontrollore", el("div", {id: "ed-micro"}), schede("Scheda", A.micro, [["nessuno", "Nessuno: timer e penne", "0 € · niente allarmi", "Il modo più economico per imparare con un impianto piccolo.", "Controlli tu ogni giorno; nessun avviso per perdite o pompa ferma."], ...Object.keys(CATALOGO.micro.opzioni).map(o => voceCat("micro", o, x => x.linguaggio))],
    v => { if (v === "nessuno") Object.assign(A, LIVELLI_AUTO.nessuna.auto); set("micro", v); })));
  const sensori = [["ph", "Sonda pH", "35-60 €", "Si tara ogni mese; dura 12-18 mesi."], ["ec", "Sonda EC", "45-70 €", "Misura i nutrienti disciolti."], ["temp_acqua", "Temperatura acqua", "2-4 €", "Sopra 24 °C le radici soffrono."],
    ["aria", "Aria (temperatura e umidità)", "8-14 €", "Comanda estrattore e stufetta."], ["co2", "CO₂", "30-45 €", "Utile solo con tanta luce."], ["livello", "Galleggianti min/max", "4-6 €", "Pompa mai a secco, rabbocco."],
    ["perdita", "Sensore di perdita a pavimento", "4-10 €", "Indispensabile in garage."], ["flusso", "Flussimetro", "3-6 €", "Scopre una pompa ferma in pochi minuti."], ["luce_sens", "Sensore di luce", "2-4 €", "Scopre una lampada spenta."]];
  box.append(riquadro("Sensori", el("div", {id: "ed-sensori", class: "campi"}, ...sensori.map(([kk, n, p, s]) => spunta(n + " (" + p + ")", A[kk], v => set(kk, v), s)))));
  box.append(riquadro("Attuatori e sicurezza", el("div", {id: "ed-dosaggio"}), el("div", {id: "ed-alimentazione"}), el("div", {id: "ed-ups"}), el("div", {id: "ed-sicurezza"}),
    spunta("Dosaggio automatico (3 pompe peristaltiche: A, B, pH-)", A.dosaggio, v => set("dosaggio", v), "serve con sonde pH ed EC"),
    spunta("Rabbocco automatico", A.rabbocco, v => set("rabbocco", v)),
    spunta("Prese smart certificate per i carichi a 230 V", A.prese_smart, v => set("prese_smart", v), "luci, stufetta, estrattore"),
    spunta("UPS (gruppo di continuità)", A.ups, v => set("ups", v), "60-95 €"),
    griglia(campoNum("Taratura della sonda pH ogni", A.taratura_giorni, 7, 90, 1, v => set("taratura_giorni", v), "giorni"))));
  box.append(riquadro("Connessione e avvisi", el("div", {id: "ed-connessione"}), el("div", {id: "ed-centrale"}),
    schede("Connessione", A.connessione, Object.keys(CATALOGO.connessione.opzioni).map(o => voceCat("connessione", o)), v => set("connessione", v)),
    schede("Centrale", A.centrale, Object.keys(CATALOGO.centrale.opzioni).map(o => voceCat("centrale", o)), v => set("centrale", v))));
}
function editorLogicaIdro(box) {
  const k = capacitaIdro(cfg), I = cfg.idro, S = k.S;
  const regole = [
    ["Luci", k.ore + " ore al giorno" + (I.luce.notte ? " dalle 20:00 (di notte)" : " dalle 6:00") + "; spente se il sensore di perdita scatta."],
    ["Pompa", {nft: "sempre accesa (o 15 min sì / 15 no di notte)", torre: "15 minuti sì e 15 no", dwc: "pompa d'aria sempre accesa", kratky: "nessuna pompa", bucket: "4-6 cicli da 15 minuti durante la luce", ebb: "3-4 allagamenti al giorno da 15 minuti durante la luce, un vassoio alla volta", goccia: "6-10 irrigazioni brevi durante la luce; 20-30% di drenaggio, EC del drenaggio da controllare", vassoi: "irrigazione dal basso 1-2 volte al giorno"}[I.sistema]],
    ["EC", "obiettivo " + k.ec.toFixed(1) + " mS/cm (acqua di partenza " + DUREZZE[I.acqua.durezza].ec + "): se scende di 0,1 dosa A e B in parti uguali, aspetta 15 minuti e rimisura."],
    ["pH", "obiettivo " + k.ph.toFixed(1) + ": sopra +0,3 dosa pH- a piccole dosi; sempre dopo i nutrienti."],
    ["Temperatura aria", "estrattore sopra " + (Math.min(...k.colture.map(x => x.P.t[1])) - 1) + " °C, stufetta sotto " + I.clima.t_min + " °C."],
    ["Acqua", "rabbocco quando scende sotto il galleggiante minimo; cambio completo ogni " + I.acqua.cambio_giorni + " giorni; sopra 24 °C allarme ACQUA_CALDA."],
    ["Sicurezze", "perdita → tutto spento; flusso assente → allarme; " + (S.tolleranza_ore <= 2 ? "senza corrente le radici reggono " + S.tolleranza_ore + " ore: UPS." : "il sistema regge " + (S.tolleranza_ore >= 999 ? "senza corrente" : S.tolleranza_ore + " ore") + " senza pompa.")],
  ];
  box.append(riquadro("Il controllo vero (firmware ESP32)", el("p", {class: "piccolo", text: "Le regole qui sotto diventano la logica di sistema/idro_controllo.py, la stessa che gira sull'ESP32 (firmware/esp32-idroponica). Tre modalità: simulazione (nessun hardware), ombra (legge i sensori veri ma non comanda niente: dice cosa farebbe) e reale (solo con conferma esplicita nella configurazione). Provata su 12 scenari con il serbatoio simulato: sonda pH che deriva, sonda bloccata o staccata, flacone vuoto, perdita, pompa guasta, blackout, acqua calda, rete chiusa."}),
    el("div", {class: "scorri"}, el("table", null, el("tbody", null, ...[
      ["Dosaggio", "solo con letture valide e stabili, a piccole dosi (A e B " + fmt(0.03 * k.serbatoio, 1) + " mL, pH- " + fmt(0.01 * k.serbatoio, 1) + " mL), 10 minuti tra due dosi, il pH 15 minuti dopo i nutrienti, limite giornaliero per ogni dosatore"],
      ["Dosi senza effetto", "3 dosi che non spostano la lettura (flacone vuoto, tubo tappato) → dosaggio bloccato fino a reset"],
      ["Sonde", "fuori campo, bloccate un'ora sullo stesso valore o con salti → niente dosi; penna diversa dalla sonda di più di 0,3 → sonda da tarare"],
      ["Perdita", "sensore a pavimento → tutto spento fino a reset"],
      ["Pompa", "flusso assente dopo 90 secondi → riprova 3 volte, poi ferma fino a reset (non gira a secco)"],
      ["Riavvio", "dopo un blackout niente dosi per 15 minuti; allarmi e dosi del giorno salvati su file"],
      ["Limite hardware", "nessuna dose dura più di 20 secondi, qualunque cosa chieda la logica"]].map(r => el("tr", null, el("th", {text: r[0]}), el("td", {text: r[1]}))))))));
  box.append(riquadro("Regole del controllo (calcolate dalle tue colture)", el("div", {class: "scorri"}, el("table", null, el("tbody", null, ...regole.map(r => el("tr", null, el("th", {text: r[0]}), el("td", {text: r[1]}))))))),
    riquadro("Cambia luce e temperature", griglia(campoNum("Intensità della luce (0 = consigliata)", I.luce.ppfd, 0, 1000, 10, v => { I.luce.ppfd = v; aggiorna(); }, "µmol/m²/s"),
      campoNum("Ore di luce (0 = consigliate)", I.luce.ore, 0, 20, 1, v => { I.luce.ore = v; aggiorna(); }),
      campoNum("Temperatura minima", I.clima.t_min, 5, 25, 1, v => { I.clima.t_min = v; aggiorna(); }, "°C"))));
}

// ---------- KPI, HUD, messaggi ----------
let S = null, M = null, VOCI = [], COSTI = null, ECO = null;
function kpi() {
  const tile = (et, val, sotto) => el("div", null, el("span", {class: "etichetta", text: et}), el("span", {class: "val", text: val}), el("span", {class: "sotto", text: sotto}));
  const ini = forbice(somma(VOCI, "min"), somma(VOCI, "max"));
  if (idro()) {
    const k = S.k;
    $("kpi").replaceChildren(tile("Per iniziare", ini, "materiale e automazione"), tile("Piante", fmt(k.piante), fmt(S.kg) + " kg all'anno · " + euro(S.valore)),
      tile("Corrente all'anno", fmt(S.kwh) + " kWh", euro(S.kwh * cfg.prezzi.kwh) + " · luci " + Math.round(S.kwhLuci / Math.max(1, S.kwh) * 100) + "%"),
      tile("Spese all'anno", euro(COSTI.totale), "corrente, acqua, nutrienti, semi"),
      tile("Costo al kg", isFinite(ECO.scenari.centrale.costoKg) ? euro(ECO.scenari.centrale.costoKg) : "-", "con ammortamento · al negozio ≈ " + euro(S.valore / Math.max(1, S.kg))));
  } else {
    const correnteEuro = S.solare ? 0 : S.kwh * cfg.prezzi.kwh;
    $("kpi").replaceChildren(tile("Per iniziare", ini, cfg.preset ? "pacchetto " + PRESET[cfg.preset].nome.toLowerCase() : "componenti scelti da te"),
      tile("Acqua all'anno", fmt(S.litri / 1000, 1) + " m³", fmt(S.daRete / 1000, 1) + " m³ dal rubinetto"),
      tile("Corrente all'anno", fmt(S.kwh, 1) + " kWh", S.solare ? "dal pannello · " + S.giorniSpento + " giorni spento" : euro(correnteEuro) + " in bolletta"),
      tile("Spese all'anno", euro(COSTI.totale), "acqua, corrente, ricambi, guasti"),
      tile("Verdura", fmt(S.kg) + " kg", "≈ " + euro(S.valore) + " al prezzo del negozio"));
  }
}
let giorno = 196;
function hud(d) {
  giorno = d;
  const g = S.giorni[d], box = $("hud-stato"), m = meseDi(d);
  const righe = [el("span", {class: "data", text: (d - INIZIO_MESE[m] + 1) + " " + MESI_LUNGHI[m] + " · " + String(Math.floor(ora)).padStart(2, "0") + ":00"})];
  if (idro()) {
    const on = Vista3D ? Vista3D.luciAccese() : true;
    righe.push(el("span", {class: "piccolo", text: "Luci " + (on ? "accese" : "spente") + " · garage " + fmt(g.tGarage, 0) + " °C"}),
      el("span", {class: "piccolo num", text: "Tenda " + fmt(on ? g.tLuci : g.tBuio, 0) + " °C · acqua " + fmt(g.tAcqua, 0) + " °C · UR " + fmt(g.ur, 0) + "%"}),
      el("span", {class: "piccolo num", text: "Raccolto " + fmt(g.kg * 1000) + " g al giorno · " + fmt(g.wh / 1000, 1) + " kWh"}));
  } else {
    righe.push(el("span", {class: "piccolo", text: (g.pioggia > 1 ? "Pioggia " + fmt(g.pioggia) + " mm" : "Sereno") + " · " + fmt(g.temp, 0) + " °C" + (g.litri > 0 ? " · irrigati " + fmt(g.litri) + " L" : "")}));
    if (cfg.acqua.fonte === "cisterna") righe.push(el("span", {class: "piccolo num", text: (cfg.ambiente === "interno" ? "Tanica " : "Cisterna ") + fmt(g.cisterna) + " / " + fmt(cfg.acqua.cisterna_l) + " L"}));
    if (g.soc != null) righe.push(el("span", {class: "piccolo num", text: "Batteria " + fmt(g.soc * 100) + "%"}));
    cfg.zone.forEach((z, i) => { const u = g.umid[i], l = g.lette[i];
      righe.push(el("div", {class: "zchip"}, el("span", {class: "pallino", style: `background:${COLORI[i]}`}), el("span", {text: PIANTE[z.coltura].nome}),
        el("span", {class: "barra"}, el("span", {style: `width:${u == null ? 0 : u * 100}%;background:${COLORI[i]}`})),
        el("b", {text: u == null ? "vuota" : fmt(u * 100) + "%"}), el("span", {class: "piccolo", text: u == null ? "" : l == null ? "sensore ✕" : "letto " + fmt(l * 100) + "%"}))); });
  }
  const al = (g.allarmi || []).slice(0, 3);
  righe.push(...(al.length ? al.map(a => el("span", {class: "avviso " + (/SPENTO|QUADRO|PERSE|POMPA|PERDITA|RIAVVII|PH_FUORI/.test(a) ? "crit" : "warn"), text: a})) : [el("span", {class: "avviso ok", text: "Tutto a posto"})]));
  box.replaceChildren(...righe);
  $("giorno").value = d;
}
function messaggi() {
  const box = $("messaggi"); box.replaceChildren();
  const lista = idro() ? compatibilitaIdro(cfg) : compatibilita(cfg);
  const ord = {crit: 0, warn: 1, ok: 2};
  if (idro()) {
    const k = S.k;
    const C = ECO.scenari.centrale;
    lista.push({tipo: ECO.giudizio === "conviene" ? "ok" : ECO.giudizio === "fragile" ? "warn" : "crit",
      titolo: ECO.giudizio === "conviene" ? "Economicamente sensato: si ripaga in " + fmt(C.pareggioAnni, 1) + " anni" : ECO.giudizio === "fragile" ? "Si ripaga, ma il margine è fragile" : "Sconsigliato: economicamente non conviene",
      testo: ECO.motivi.slice(0, 3).join(" ") || "Valore del raccolto " + euro(C.sostituzione + C.ricavo) + ", spese " + euro(C.opex) + " all'anno.", chiave: "economia"});
    if (S.giorniCaldo > 20) lista.push({tipo: "warn", titolo: S.giorniCaldo + " giorni troppo caldi per le colture", testo: "D'estate il garage scalda: luci di notte, estrattore, o colture da caldo (basilico, peperoncino).", chiave: "clima"});
    if (S.giorniFreddo > 20) lista.push({tipo: "warn", titolo: S.giorniFreddo + " notti troppo fredde", testo: "Alza la temperatura minima o metti la stufetta; l'inverno costa in corrente.", chiave: "clima"});
    if (S.giorniAcquaCalda > 20) lista.push({tipo: "warn", titolo: S.giorniAcquaCalda + " giorni con l'acqua sopra 24 °C", testo: "Serbatoio isolato e all'ombra, luci di notte, bottiglie di ghiaccio d'estate.", chiave: "clima"});
    if (S.giorniUmido > 20) lista.push({tipo: "warn", titolo: S.giorniUmido + " giorni con umidità troppo alta", testo: "Più ricambio d'aria o deumidificatore: rischio muffe.", chiave: "clima"});
    if (S.perse > 0) lista.push({tipo: "crit", titolo: "Piante perse per i guasti", testo: "Vedi gli eventi nella scheda Simulazione.", chiave: "ups"});
  } else {
    const comp = cfg.componenti;
    if (S.stress > 0) lista.push({tipo: "crit", titolo: "Piante in sofferenza " + S.stress + " giorni-zona", testo: S.giorniSpento ? "L'impianto è rimasto spento " + S.giorniSpento + " giorni." : S.mancata > 0 ? "Manca acqua: vedi la cisterna." : "Controlla soglie, portata e guasti.", chiave: S.giorniSpento ? "alimentazione" : "logica"});
    else lista.push({tipo: "ok", titolo: "Nessuna pianta in sofferenza", testo: "In tutto l'anno il terreno non scende mai sotto il 30% nelle zone coltivate."});
    if (S.drenati > 200) lista.push({tipo: "warn", titolo: fmt(S.drenati) + " L d'acqua sprecati in drenaggio", testo: "Il sensore legge più secco del vero o le soglie sono alte: l'acqua va sotto le radici.", chiave: "sensore_suolo"});
    if (S.sostituzioni > cfg.zone.length) lista.push({tipo: "warn", titolo: S.sostituzioni + " sensori da cambiare in un anno", testo: "Con " + opzione("sensore_suolo", comp.sensore_suolo).nome.toLowerCase() + " la manutenzione pesa.", chiave: "sensore_suolo"});
    if (cfg.acqua.fonte === "cisterna" && cfg.ambiente !== "interno") {
      const id = cisternaIdeale(cfg, M);
      if (S.daRete > 0 || S.mancata > 0) lista.push({tipo: S.mancata > 0 ? "crit" : "warn", titolo: "La cisterna non basta tutto l'anno", testo: (S.mancata > 0 ? fmt(S.mancata) + " L che le piante non ricevono. " : fmt(S.daRete) + " L dal rubinetto. ") + "Per non usare mai il rubinetto: cisterna da circa " + fmt(Math.ceil(id.litri / 100) * 100) + " L" + (id.entrata < id.domanda ? " e più tetto (il tetto raccoglie " + fmt(id.entrata) + " L contro " + fmt(id.domanda) + " L)." : "."), chiave: "cisterna"});
      else lista.push({tipo: "ok", titolo: "La cisterna basta", testo: "Non serve mai il rubinetto in questo anno."});
    }
    if (S.solare) { const id = solareIdeale(cfg, M);
      if (S.giorniSpento || S.giorniBatteriaBassa) lista.push({tipo: "crit", titolo: "Pannello o batteria troppo piccoli", testo: S.giorniSpento + " giorni spento, " + S.giorniBatteriaBassa + " senza pompa. " + (id ? "Basta " + id.w + " W con " + id.ah + " Ah." : "Valuta la presa di casa."), chiave: "alimentazione"});
      else lista.push({tipo: "ok", titolo: "Il solare regge tutto l'anno", testo: id && (id.w < comp.pannello_w || id.ah < comp.batteria_ah) ? "Basterebbe anche " + id.w + " W con " + id.ah + " Ah." : ""}); }
    else lista.push({tipo: "ok", titolo: "Corrente: " + euro(S.kwh * cfg.prezzi.kwh) + " all'anno", testo: fmt(S.baseW, 1) + " W sempre accesi più la pompa (" + fmt(S.minutiPompa / 60) + " ore in un anno)." + (S.whLed ? " Le luci LED pesano " + fmt(S.whLed / 1000) + " kWh." : "")});
    for (const e of S.eventi.filter(e => e.tipo === "crit").slice(0, 3)) lista.push({tipo: "crit", titolo: etGiorno(e.d), testo: e.testo});
  }
  lista.sort((a, b) => ord[a.tipo] - ord[b.tipo]);
  lista.forEach(x => box.append(messaggio(x.tipo, x.titolo, x.testo, x.chiave)));
}

// ---------- simulazione: grafici ----------
function schedaSimulazione(box) {
  if (idro()) {
    const k = S.k;
    const serieE = [{nome: "Luci", colore: "var(--s1)", valori: S.mesi.map(m => m.luci)}, {nome: "Clima", colore: "var(--s2)", valori: S.mesi.map(m => m.clima)},
                    {nome: "Pompe e aria", colore: "var(--s3)", valori: S.mesi.map(m => m.pompe)}, {nome: "Elettronica", colore: "var(--s4)", valori: S.mesi.map(m => m.elettronica)}];
    const gE = el("div", {class: "grafico"}), lE = el("div", {class: "legenda"});
    const gT = el("div", {class: "grafico"}), lT = el("div", {class: "legenda"});
    const gP = el("div", {class: "grafico"}), gA = el("div", {class: "grafico"});
    box.append(riquadro("Corrente mese per mese (kWh)", el("p", {class: "piccolo", text: fmt(S.kwh) + " kWh nell'anno: luci " + fmt(S.kwhLuci) + ", clima " + fmt(S.kwhClima) + ", pompe " + fmt(S.kwhPompe) + ", elettronica " + fmt(S.kwhElettronica) + "."}), lE, gE),
      riquadro("Temperature: garage e tenda", el("p", {class: "piccolo", text: (() => { const a = Math.max(...k.colture.map(x => x.P.t[0])), b = Math.min(...k.colture.map(x => x.P.t[1]));
      return a < b ? "Le colture stanno bene tutte tra " + a + " e " + b + " °C." : "Le colture non hanno una fascia comune (" + k.colture.map(x => x.P.nome + " " + x.P.t.join("–")).join(", ") + " °C): conviene alternarle per stagione."; })()}), lT, gT),
      el("div", {class: "due"}, riquadro("Raccolto mese per mese (kg)", gP), riquadro("Acqua mese per mese (L)", gA)));
    legenda(lE, serieE, true);
    barChart(gE, {titolo: "Corrente per mese", categorie: MESI, serie: serieE, fmt: v => fmt(v), fmtTip: v => fmt(v, 1) + " kWh"});
    const serieT = [{nome: "Garage", colore: "var(--s4)", valori: S.giorni.map(g => g.tGarage)}, {nome: "Tenda con luci", colore: "var(--s2)", valori: S.giorni.map(g => g.tLuci)}, {nome: "Tenda al buio", colore: "var(--s1)", valori: S.giorni.map(g => g.tBuio)}];
    legenda(lT, serieT);
    const tmin = Math.floor(Math.min(...S.giorni.map(g => Math.min(g.tGarage, g.tBuio))) / 5) * 5, tmax = Math.ceil(Math.max(...S.giorni.map(g => g.tLuci)) / 5) * 5;
    const ticks = []; for (let t = tmin; t <= tmax; t += 5) ticks.push(t);
    lineChart(gT, {titolo: "Temperature", n: 365, yMin: tmin, yMax: tmax, ticks, fmt: t => t + "°", serie: serieT, etichettaX: etGiorno, fmtTip: v => fmt(v, 1) + " °C"});
    barChart(gP, {larghezza: 520, largo: 0.8, titolo: "Raccolto per mese", categorie: MESI, serie: [{nome: "Raccolto", colore: "var(--s3)", valori: S.mesi.map(m => m.kg)}], fmt: v => fmt(v, v < 10 ? 1 : 0), fmtTip: v => fmt(v, 1) + " kg"});
    barChart(gA, {larghezza: 520, largo: 0.8, titolo: "Acqua per mese", categorie: MESI, serie: [{nome: "Acqua", colore: "var(--s1)", valori: S.mesi.map(m => m.acqua)}], fmt: compatto, fmtTip: v => fmt(v) + " L"});
    const conModello = Object.keys(S.coorti || {});
    if (conModello.length) {
      const gC = el("div", {class: "grafico"}), lC = el("div", {class: "legenda"}), gD = el("div", {class: "grafico"}), lD = el("div", {class: "legenda"});
      const curve = [];
      conModello.forEach((kk, i) => { for (const [m, nome] of [[0, "gennaio"], [6, "luglio"]]) { const co = S.coorti[kk][INIZIO_MESE[m]];
        curve.push({nome: IDRO_PIANTE[kk].nome + " seminata a " + nome, colore: COLORI[curve.length % COLORI.length], valori: co.curva}); } });
      const n = Math.max(...curve.map(c => c.valori.length)), top = Math.max(...curve.map(c => Math.max(...c.valori)));
      curve.forEach(c => { while (c.valori.length < n) c.valori.push(null); });
      const tk = niceTicks(top);
      box.append(el("div", {class: "due"},
        riquadro("Crescita di una pianta (modello)", el("p", {class: "piccolo", text: "Peso fresco giorno per giorno dalla semina, con la luce e la temperatura della tua tenda. Si raccoglie al peso di tabella. Modello a efficienza d'uso della luce con temperature cardinali, calibrato sulla lattuga di Cornell (150 g a 35 giorni): vedi Guida → fonti."}), lC, gC),
        riquadro("Giorni dal trapianto al raccolto, per mese di semina", lD, gD)));
      legenda(lC, curve);
      lineChart(gC, {larghezza: 520, titolo: "Peso fresco", n, yMin: 0, yMax: tk[tk.length - 1], ticks: tk, fmt: v => v + " g", serie: curve, etichettaX: d => "giorno " + (d + 1), fmtTip: v => fmt(v) + " g", altezza: 240,
        tickX: Array.from({length: Math.floor((n - 1) / 20) + 1}, (_, j) => ({i: j * 20, testo: j ? "giorno " + j * 20 : "semina"}))});
      const serieD = conModello.map((kk, i) => ({nome: IDRO_PIANTE[kk].nome, colore: COLORI[i], valori: MESI.map((_, m) => S.coorti[kk][INIZIO_MESE[m] + 14].giorni)}));
      legenda(lD, serieD);
      const tkD = niceTicks(Math.max(...serieD.flatMap(x => x.valori)));
      lineChart(gD, {larghezza: 520, titolo: "Durata del ciclo", n: 12, yMin: 0, yMax: tkD[tkD.length - 1], ticks: tkD, fmt: v => v + " gg", serie: serieD, etichettaX: m => "semina a " + MESI_LUNGHI[m], fmtTip: v => fmt(v) + " giorni", altezza: 240,
        tickX: MESI.map((t, m) => ({i: m, testo: t}))});
    }
    box.append(riquadro("Coltura per coltura", el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Coltura", "Piante", "Giorni del ciclo", "Raccolti all'anno", "kg all'anno", "Valore €", "Semi €"].map((t, i) => el("th", {class: i ? "n" : "", text: t})))),
      el("tbody", null, ...S.perColtura.map(x => el("tr", null, el("td", {text: IDRO_PIANTE[x.coltura].nome}), el("td", {class: "n", text: fmt(x.piante)}), el("td", {class: "n", text: fmt(x.giorniCiclo) + (x.modello ? " (modello)" : "")}), el("td", {class: "n", text: fmt(x.raccolti)}), el("td", {class: "n", text: fmt(x.kg, 1)}), el("td", {class: "n", text: fmt(x.valore)}), el("td", {class: "n", text: fmt(x.raccolti * 1.2 * IDRO_PIANTE[x.coltura].seme, 2)}))))))));
  } else {
    const serie = cfg.zone.map((z, i) => ({nome: (i + 1) + " · " + PIANTE[z.coltura].nome, colore: COLORI[i], valori: S.giorni.map(g => g.umid[i] == null ? null : g.umid[i] * 100)}));
    const gU = el("div", {class: "grafico"}), lU = el("div", {class: "legenda"});
    box.append(riquadro("Umidità vera del terreno", el("p", {class: "piccolo", text: "Sotto il 30% la pianta soffre; il sistema irriga sotto il " + cfg.logica.soglia_on + "% (letto dal sensore) e smette al " + cfg.logica.soglia_off + "%. Nel pannello sopra la scena vedi anche quanto legge il sensore."}), lU, gU));
    legenda(lU, serie);
    lineChart(gU, {titolo: "Umidità", n: 365, yMin: 0, yMax: 100, ticks: [0, 30, cfg.logica.soglia_on, cfg.logica.soglia_off, 100].sort((a, b) => a - b), fmt: t => t + "%", serie, etichettaX: etGiorno, fmtTip: v => fmt(v) + "%"});
    const serA = [{nome: cfg.acqua.fonte === "cisterna" ? "Dalla cisterna" : "Dal rubinetto", colore: "var(--s1)", valori: S.mesi.map(m => cfg.acqua.fonte === "cisterna" ? m.cisterna : m.rete)}];
    if (cfg.acqua.fonte === "cisterna") serA.push({nome: "Dal rubinetto", colore: "var(--s2)", valori: S.mesi.map(m => m.rete)});
    const gA = el("div", {class: "grafico"}), lA = el("div", {class: "legenda"}), gC = el("div", {class: "grafico"}), gE = el("div", {class: "grafico"});
    const due = el("div", {class: "due"}, riquadro("Acqua usata mese per mese", lA, gA));
    if (cfg.acqua.fonte === "cisterna") due.append(riquadro(cfg.ambiente === "interno" ? "Livello della tanica" : "Livello della cisterna", gC));
    box.append(due, riquadro("Corrente mese per mese (Wh)", gE));
    legenda(lA, serA, true);
    barChart(gA, {larghezza: 520, largo: 0.8, titolo: "Acqua per mese", categorie: MESI, serie: serA, fmt: compatto, fmtTip: v => fmt(v) + " L"});
    if (cfg.acqua.fonte === "cisterna") { const tk = niceTicks(cfg.acqua.cisterna_l);
      lineChart(gC, {larghezza: 520, titolo: "Cisterna", n: 365, yMin: 0, yMax: tk[tk.length - 1], ticks: tk, fmt: compatto, altezza: 240, serie: [{nome: "Cisterna", colore: "var(--s1)", area: true, valori: S.giorni.map(g => g.cisterna)}], etichettaX: etGiorno, fmtTip: v => fmt(v) + " L"}); }
    barChart(gE, {titolo: "Corrente per mese", categorie: MESI, serie: [{nome: "Corrente", colore: "var(--s1)", valori: S.mesi.map(m => m.wh)}], fmt: compatto, fmtTip: v => fmt(v) + " Wh", altezza: 220});
    if (S.solare) { const gB = el("div", {class: "grafico"}); box.append(riquadro("Carica della batteria", gB));
      lineChart(gB, {titolo: "Batteria", n: 365, yMin: 0, yMax: 100, ticks: [0, 35, 100], fmt: t => t + "%", altezza: 220, serie: [{nome: "Batteria", colore: "var(--s1)", area: true, valori: S.giorni.map(g => g.soc * 100)}], etichettaX: etGiorno, fmtTip: v => fmt(v) + "%"}); }
    box.append(riquadro("Zona per zona", el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Zona", "Acqua L", "Persa L", "Drenata L", "Sofferenza gg", "Acqua ferma h", "Sensori cambiati", "kg"].map((t, i) => el("th", {class: i ? "n" : "", text: t})))),
      el("tbody", null, ...S.zone.map((z, i) => el("tr", null, el("td", null, el("span", {class: "pallino", style: `background:${COLORI[i]}`}), document.createTextNode((i + 1) + " · " + PIANTE[cfg.zone[i].coltura].nome)),
        ...[z.litri, z.persi, z.drenati, z.stress, z.ristagno, z.sostituzioni, z.kg].map((v, j) => el("td", {class: "n", text: fmt(v, j === 6 ? 1 : 0)})))))))));
  }
  const ev = S.eventi;
  box.append(riquadro("Diario dell'anno", ev.length ? el("div", null, ...ev.slice(0, 80).map(e => el("div", {class: "msg"}, chip(e.tipo, e.tipo === "ok" ? "risolto" : e.tipo === "warn" ? "avviso" : "danno"), el("div", null, el("strong", {text: etGiorno(e.d)}), el("p", {class: "piccolo", text: e.testo})))))
    : el("p", {class: "piccolo", text: "Nessun evento: nessun guasto programmato e nessun problema. Prova la scheda Guasti."})));
}

// ---------- costi, materiali, struttura, gestione, guida, percorso ----------
const TAPPE = [["4a", "Banco minimo"], ["4b", "Banco completo"], ["5", "Campo / montaggio"], ["6", "Dati e avvisi"]];
function schedaCosti(box) {
  const righe = [["0-3", "Strumenti, progetto, simulazione, collaudo virtuale", 0, 0]];
  TAPPE.forEach(([f, n]) => { const v = VOCI.filter(x => x.fase === f); if (v.length) righe.push([f, n, somma(v, "min"), somma(v, "max")]); });
  let cum = [0, 0]; const cumul = [];
  const tb = el("tbody");
  righe.forEach(r => { cum = [cum[0] + r[2], cum[1] + r[3]]; cumul.push((cum[0] + cum[1]) / 2);
    tb.append(el("tr", null, el("td", {text: "Fase " + r[0] + " · " + r[1]}), el("td", {class: "n", text: forbice(r[2], r[3])}), el("td", {class: "n", text: forbice(cum[0], cum[1])}))); });
  const gT = el("div", {class: "grafico"});
  const ta = el("tbody", null, ...COSTI.righe.map(r => el("tr", null, el("td", {text: r[0]}), el("td", {class: "n", text: r[1]}), el("td", {class: "n", text: euro(r[2])}))),
    el("tr", null, el("th", {text: "Totale spese"}), el("td"), el("th", {class: "n", text: euro(COSTI.totale)})));
  const iniziale = (somma(VOCI, "min") + somma(VOCI, "max")) / 2, netto = S.valore - COSTI.totale;
  const rit = idro() ? "Il bilancio completo, con ammortamento e scenari, è qui sotto." : netto > 0 ? "Il materiale (≈ " + euro(iniziale) + ") si ripaga in circa " + fmt(Math.max(1, Math.ceil(iniziale / netto * 12))) + " mesi di raccolto, al prezzo del negozio." : "Con queste scelte il raccolto (≈ " + euro(S.valore) + ") non copre le spese di ogni anno (" + euro(COSTI.totale) + ").";
  box.append(el("div", {class: "due"}, riquadro("Spesa a tappe", gT, el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, el("th", {text: "Tappa"}), el("th", {class: "n", text: "Questa tappa"}), el("th", {class: "n", text: "Totale fin qui"}))), tb))),
    riquadro("Ogni anno", el("div", {class: "scorri"}, el("table", null, ta)), el("p", {class: "piccolo", text: rit}))));
  barChart(gT, {larghezza: 520, titolo: "Spesa cumulata", categorie: righe.map(r => "Fase " + r[0]), etichetteLunghe: righe.map(r => r[1]), serie: [{nome: "Totale fin qui (medio)", colore: "var(--accent)", valori: cumul}], fmt: v => fmt(v) + " €", fmtTip: v => fmt(v) + " €", altezza: 240, largo: 1.6});
  if (idro()) bilancioIdro(box);
  // confronti rapidi
  const varianti = idro() ? [
    ["La tua configurazione", {}],
    ["LED economici viola", {luce: Object.assign({}, cfg.idro.luce, {tipo: "led_viola"})}],
    ["Luci di giorno invece che di notte", {luce: Object.assign({}, cfg.idro.luce, {notte: !cfg.idro.luce.notte})}],
    ["Garage isolato", {clima: Object.assign({}, cfg.idro.clima, {garage: "isolato"})}],
    ["Senza tenda", {clima: Object.assign({}, cfg.idro.clima, {tenda: false})}],
    ["Kratky (senza pompe, controllo a mano)", {sistema: "kratky", disposizione: cfg.idro.disposizione, auto: Object.assign({}, cfg.idro.auto, {dosaggio: false, ph: false, ec: false, flusso: false})}],
    ["Senza automazione (penne pH ed EC, timer)", {auto: Object.assign({}, cfg.idro.auto, {dosaggio: false, ph: false, ec: false, rabbocco: false, co2: false, centrale: "nessuna"})}],
    ["Metà dei watt di lampade", {luce: Object.assign({}, cfg.idro.luce, {w_installati: Math.round(capacitaIdro(cfg).wLuci / 2)})}],
  ] : [
    ["La tua configurazione", {}],
    ["Pacchetto base", {componenti: PRESET.base.componenti, extra: PRESET.base.extra}],
    ["Pacchetto completo", {componenti: PRESET.completo.componenti, extra: PRESET.completo.extra}],
    ["Sensori resistivi", {componenti: {sensore_suolo: "resistivo"}}],
    ["Timer invece dei sensori", {logica: {strategia: "timer"}}],
    ["Pacciamatura su tutto", {zone: true}],
  ];
  const tc = el("tbody");
  for (const [nome, mod] of varianti) {
    let r, cst, voci;
    if (idro()) { const c2 = Object.assign({}, cfg, {idro: Object.assign({}, cfg.idro, mod)}); r = simulaIdro(c2); cst = costiAnnuiIdro(c2, r); voci = materialiIdro(c2); const e2 = economiaIdro(c2, r, voci, cst), C2 = e2.scenari.centrale;
      tc.append(el("tr", null, el("td", {text: nome}), el("td", {class: "n", text: forbice(somma(voci, "min"), somma(voci, "max"))}), el("td", {class: "n", text: fmt(r.kwh)}), el("td", {class: "n", text: euro(cst.totale)}), el("td", {class: "n", text: fmt(r.kg)}),
        el("td", {class: "n", text: isFinite(C2.costoKg) ? euro(C2.costoKg) : "-"}), el("td", {class: "n", text: isFinite(C2.pareggioAnni) ? fmt(C2.pareggioAnni, 1) + " anni" : "mai"})));
    } else { const c2 = JSON.parse(JSON.stringify(cfg));
      if (mod.componenti) Object.assign(c2.componenti, mod.componenti); if (mod.extra) Object.assign(c2.extra, mod.extra); if (mod.logica) Object.assign(c2.logica, mod.logica);
      if (mod.zone) c2.zone.forEach(z => z.pacciamatura = true);
      r = simula(c2, {meteo: M}); voci = materiali(c2); cst = costiAnnui(c2, r, voci);
      tc.append(el("tr", null, el("td", {text: nome}), el("td", {class: "n", text: forbice(somma(voci, "min"), somma(voci, "max"))}), el("td", {class: "n", text: fmt(r.litri)}), el("td", {class: "n", text: euro(cst.totale)}), el("td", {class: "n", text: fmt(r.stress)}), el("td", {class: "n", text: fmt(r.drenati)}))); }
  }
  const intest = idro() ? ["Variante", "Per iniziare", "kWh/anno", "Spese/anno", "kg/anno", "€ al kg con ammortamento", "Si ripaga in"] : ["Variante", "Per iniziare", "Acqua L", "Spese/anno", "Sofferenza gg", "Drenata L"];
  box.append(riquadro("Confronti rapidi", el("p", {class: "piccolo", text: "Stesso anno, una sola differenza per riga."}), el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...intest.map((t, i) => el("th", {class: i ? "n" : "", text: t})))), tc))));
}
function bilancioIdro(box) {
  const SC = ECO.scenari, C = SC.centrale;
  const riga = (n, v, forte) => el("tr", null, el("td", null, forte ? el("strong", {text: n}) : document.createTextNode(n)), el("td", {class: "n"}, forte ? el("strong", {text: v}) : document.createTextNode(v)));
  const anni = x => isFinite(x) ? fmt(x, 1) + " anni" : "mai";
  box.append(el("div", {class: "due"},
    riquadro("Bilancio (scenario centrale)", el("div", {class: "scorri"}, el("table", null, el("tbody", null,
      riga("Investimento iniziale (CAPEX)", forbice(ECO.capex.min, ECO.capex.max)),
      ...ECO.perCategoria.map(x => riga("· " + x.cat, forbice(x.min, x.max))),
      riga("Spese di ogni anno (OPEX)", euro(C.opex)), riga("· di cui corrente", euro(ECO.energia)),
      riga("Ammortamento (" + ECO.vita + " anni)", euro(C.ammortamento)), riga("Costo totale all'anno", euro(C.costoAnno), true),
      riga("Raccolto utilizzabile", fmt(C.kgUtili, 1) + " kg"), riga("Costo al kg", isFinite(C.costoKg) ? euro(C.costoKg) : "-", true),
      riga("Mangiato in casa", fmt(C.casa, 1) + " kg"), riga("Venduto", fmt(C.venduti, 1) + " kg"), riga("In più (regalato o buttato)", fmt(C.eccedenza, 1) + " kg"),
      riga("Valore in casa (prezzo del negozio)", euro(C.sostituzione)), riga("Ricavo dalle vendite", euro(C.ricavo)),
      riga("Margine di ogni anno (senza ammortamento)", euro(C.margine), true), riga("Si ripaga in", anni(C.pareggioAnni), true),
      riga("Lavoro", fmt(ECO.ore) + " ore all'anno"))))),
    riquadro("Caso peggiore, normale e migliore", el("p", {class: "piccolo", text: "Pessimistico: prezzi alti del materiale, resa -30%, corrente +15%, prezzi -20%. Ottimistico: prezzi bassi, resa +10%, corrente -5%. Sono prove di robustezza, non probabilità."}),
      el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["", "Pessimistico", "Centrale", "Ottimistico"].map((t, i) => el("th", {class: i ? "n" : "", text: t})))),
        el("tbody", null, ...[["Investimento", x => euro(x.capex)], ["Raccolto", x => fmt(x.kgUtili) + " kg"], ["Spese all'anno", x => euro(x.opex)], ["Costo al kg", x => isFinite(x.costoKg) ? euro(x.costoKg) : "-"],
          ["Margine all'anno", x => euro(x.margine)], ["Si ripaga in", x => anni(x.pareggioAnni)]].map(([n, f]) => el("tr", null, el("td", {text: n}), ...["pessimistico", "centrale", "ottimistico"].map(kk => el("td", {class: "n", text: f(SC[kk])}))))))),
      el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Coltura", "kg utili", "Costo al kg", "Al negozio", ""].map((t, i) => el("th", {class: i ? "n" : "", text: t})))),
        el("tbody", null, ...ECO.colture.map(x => el("tr", null, el("td", {text: IDRO_PIANTE[x.coltura].nome}), el("td", {class: "n", text: fmt(x.kg, 1)}), el("td", {class: "n", text: isFinite(x.costoKg) ? euro(x.costoKg) : "-"}),
          el("td", {class: "n", text: euro(x.prezzo)}), el("td", null, chip(x.conviene ? "ok" : "warn", x.conviene ? "conviene" : "non conviene")))))))),
    ));
  box.append(riquadro(ECO.giudizio === "conviene" ? "Giudizio: conviene" : ECO.giudizio === "fragile" ? "Giudizio: si ripaga, ma fragile" : "Giudizio: sconsigliato",
    ...(ECO.motivi.length ? ECO.motivi : ["Nessun motivo per sconsigliarlo con queste ipotesi: verificale con un piccolo impianto di prova."]).map(t => el("p", {class: "piccolo", text: t}))));
}
function distintaCsv() {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const righe = [["Categoria", "Fase", "Descrizione", "Quantità", "Prezzo min €", "Prezzo max €", "Stato del prezzo", "Data", "Perché"].map(q).join(";")];
  const oggi = new Date().toISOString().slice(0, 10);
  for (const v of VOCI) righe.push([v.cat, v.fase, v.nome, v.q, v.min.toFixed(2).replace(".", ","), v.max.toFixed(2).replace(".", ","), "stima del gemello, da verificare", oggi, v.perche || ""].map(q).join(";"));
  righe.push(["Totale", "", "", "", somma(VOCI, "min").toFixed(2).replace(".", ","), somma(VOCI, "max").toFixed(2).replace(".", ","), "", oggi, ""].map(q).join(";"));
  return "\ufeff" + righe.join("\r\n");
}
function schedaMateriali(box) {
  const csv = el("button", {class: "az sec", type: "button", text: "Scarica la lista (CSV per Excel)"});
  csv.addEventListener("click", () => scarica("lista-materiali.csv", "text/csv;charset=utf-8", distintaCsv()));
  box.append(el("p", {class: "piccolo"}, document.createTextNode("Ogni voce è collegata al progetto: cambi una misura o un componente e quantità e prezzi si aggiornano. I prezzi sono stime a forbice, da verificare dal fornitore. "), csv));
  const cats = [...new Set(VOCI.map(v => v.cat))];
  const due = el("div", {class: "due"});
  for (const cat of cats) { const v = VOCI.filter(x => x.cat === cat);
    const r = el("div", {class: "riquadro blocco"}, el("div", {class: "testa-riga"}, el("h3", {text: cat}), el("span", {class: "num piccolo", text: forbice(somma(v, "min"), somma(v, "max"))})));
    v.forEach(x => r.append(el("div", {class: "mat"}, el("span", null, document.createTextNode((x.q > 1 ? x.q + " × " : "") + x.nome), el("span", {class: "liv", text: "fase " + x.fase})),
      el("span", {class: "num", text: x.max === 0 ? "0 €" : forbice(x.min, x.max)}), el("span", {class: "perche", text: x.perche}),
      x.chiave ? el("button", {class: "link", type: "button", text: "Cambia", onclick: () => vaiA(x.chiave)}) : null)));
    due.append(r); }
  box.append(el("p", {class: "piccolo", text: "Calcolata sui componenti che hai scelto. Prezzi indicativi da negozi online di elettronica, giardinaggio e coltivazione: verificali al momento."}), due);
}
function schemaSvg(fila, ramiTitolo, rami, larg) {
  const bw = 150, gap = 22, y0 = 24;
  const xc = 10 + fila.length * (bw + gap) - gap, L = Math.max(720, xc + 30, larg || 0);
  const svg = sv("svg", {viewBox: `0 0 ${L} ${rami.length ? 330 : 120}`, width: L, role: "img", "aria-label": "Schema"});
  const defs = sv("defs", {}), mk = sv("marker", {id: "pt", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto"});
  mk.append(sv("path", {d: "M0,0L10,5L0,10Z", fill: "var(--muted)"})); defs.append(mk); svg.append(defs);
  const sc = (x, y, w, h, t, s, acc) => { svg.append(sv("rect", {x, y, width: w, height: h, rx: 8, fill: acc ? "var(--accent-soft)" : "var(--carta)", stroke: acc ? "var(--accent)" : "var(--asse)", "stroke-width": 1.5}));
    svg.append(sv("text", {x: x + w / 2, y: y + (s ? h / 2 - 3 : h / 2 + 5), "text-anchor": "middle", style: "fill:var(--ink);font:600 13px var(--f-body)"}, t));
    if (s) svg.append(sv("text", {x: x + w / 2, y: y + h / 2 + 13, "text-anchor": "middle", style: "fill:var(--ink-2);font:11px var(--f-body)"}, s)); };
  const fr = (x1, y1, x2, y2) => svg.append(sv("line", {x1, y1, x2, y2, stroke: "var(--s1)", "stroke-width": 2.5, "marker-end": "url(#pt)"}));
  fila.forEach((f, i) => { const x = 10 + i * (bw + gap); sc(x, y0, bw, 56, f[0], f[1], f[2]); if (i) fr(x - gap, y0 + 28, x - 2, y0 + 28); });
  if (rami.length) {
    const ym = 140, colw = (xc - 10) / rami.length;
    svg.append(sv("polyline", {points: `${xc},${y0 + 28} ${xc + 14},${y0 + 28} ${xc + 14},${ym} ${10 + colw / 2},${ym}`, fill: "none", stroke: "var(--s1)", "stroke-width": 2.5}));
    svg.append(sv("text", {x: 12, y: ym - 8, style: "fill:var(--muted);font:12px var(--f-body)"}, ramiTitolo));
    rami.forEach((r, i) => { const cx = 10 + colw * i + colw / 2, w = Math.min(150, colw - 16);
      fr(cx, ym, cx, ym + 22); sc(cx - w / 2, ym + 24, w, 52, r[0], r[1], true); fr(cx, ym + 76, cx, ym + 100); sc(cx - w / 2, ym + 102, w, 52, r[2], r[3]); });
  }
  return svg;
}
function schedaStruttura(box) {
  let svgA, svgE;
  if (idro()) {
    const I = cfg.idro, k = capacitaIdro(cfg), A = I.auto;
    const fila = [["Rubinetto" + (I.acqua.osmosi ? " + osmosi" : ""), DUREZZE[I.acqua.durezza].nome], ["Serbatoio " + k.serbatoio + " L", "sonde " + [A.ph && "pH", A.ec && "EC", A.temp_acqua && "T"].filter(Boolean).join(", ")]];
    if (A.dosaggio) fila.splice(1, 0, ["Dosatori A, B, pH-", "pompe peristaltiche", true]);
    if (I.sistema !== "kratky" && I.sistema !== "vassoi") fila.push(["Pompa", I.sistema === "dwc" ? "pompa d'aria" : "ricircolo"]);
    if (A.flusso) fila.push(["Flussimetro", "acqua che scorre"]);
    fila.push([SISTEMI_IDRO[I.sistema].nome.split(" (")[0], k.piante + " piante", true], ["Ritorno al serbatoio", I.sistema === "kratky" ? "nessuno" : "per gravità"]);
    svgA = schemaSvg(fila, "", []);
    const filaE = [["Presa con salvavita", "ciabatta sollevata"], ...(A.ups ? [["UPS", "blackout brevi"]] : []), ["Prese smart", "luci, clima", true], ...(A.micro === "nessuno" ? [["Timer da presa", "luci e pompa a orario", true]] : [["Alimentatore 12 V", "pompe, dosatori"], [CATALOGO.micro.opzioni[A.micro].nome, "logica e sicurezze", true]])];
    svgE = schemaSvg(filaE, "", []);
  } else {
    const c = cfg, comp = c.componenti, cist = c.acqua.fonte === "cisterna";
    const fila = cist ? (c.ambiente === "interno" ? [["Tanica", c.acqua.cisterna_l + " L"]] : [["Tetto e grondaia", c.acqua.tetto_m2 + " m²"], ["Cisterna " + c.acqua.cisterna_l + " L", c.extra.galleggiante ? "galleggiante" : "SENZA galleggiante"]]) : [["Rubinetto", "acqua di rete"], ["Valvola generale", ""]];
    if (cist) fila.push(["Pompa", opzione("pompa", comp.pompa).portata + " L/min"]);
    if (c.extra.flussimetro) fila.push(["Flussimetro", "litri al minuto"]);
    if (c.extra.filtro) fila.push(["Filtro a rete", ""]);
    svgA = schemaSvg(fila, "collettore", c.zone.map((z, i) => ["Valvola " + (i + 1), opzione("valvole", comp.valvole).nome.split(" ")[0], PIANTE[z.coltura].nome, z.area + " m² · " + opzione("erogatori", comp.erogatori).nome.split(" ")[0]]));
    const filaE = [solareAttivo(c) ? ["Pannello " + comp.pannello_w + " W", "regolatore " + opzione("regolatore", comp.regolatore).nome.split(" ")[0]] : ["Presa 230 V", "alimentatore 12 V"], ...(solareAttivo(c) ? [["Batteria " + comp.batteria_ah + " Ah", opzione("batteria", comp.batteria).nome.split(" ")[0]]] : []),
      ["Fusibile", "sul 12 V"], ["Step-down 5 V", c.extra.step_down ? "separato + condensatore" : "condiviso"], [CATALOGO.micro.opzioni[comp.micro].nome, "logica e sicurezze", true], ["Relè" + (opzione("valvole", comp.valvole).driver ? " + driver" : ""), "pompa e valvole"]];
    svgE = schemaSvg(filaE, "", []);
  }
  const pin = idro() ? pinMappaIdro(cfg) : pinMappa(cfg);
  const micro = idro() ? cfg.idro.auto.micro : cfg.componenti.micro;
  box.append(riquadro("Percorso dell'acqua", el("div", {class: "scorri"}, svgA)), riquadro("Percorso della corrente", el("div", {class: "scorri"}, svgE)));
  if (idro()) { const idr = idraulicaIdro(cfg);
    if (idr) box.append(riquadro("Idraulica: canali, portate e pompa", el("p", {class: "piccolo", text: "Calcolo: portata per canale ~1 L/min (da 0,5 a 2), pendenza 1:40, perdite nel tubo con Hazen-Williams, pompa con curva lineare e margine del 50% sulla prevalenza. Fonti e limiti in MODELLI.md."}),
      el("div", {class: "scorri"}, el("table", null, el("tbody", null, ...idr.righe.map(r => el("tr", null, el("th", {text: r[0]}), el("td", {text: r[1]})))))))); }
  if (idro()) box.append(piantaUI());
  if (idro() && micro === "nessuno") return;
  box.append(riquadro("Collegamenti di " + CATALOGO.micro.opzioni[micro].nome, el("p", {class: "piccolo", text: "Software: " + CATALOGO.micro.opzioni[micro].firmware + "."}),
      el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, el("th", {text: "Cosa"}), el("th", {text: "Pin"}), el("th", {text: "Note"}))), el("tbody", null, ...pin.map(p => el("tr", null, el("td", {text: p[0]}), el("td", {class: "dati", text: p[1]}), el("td", {text: p[2]}))))))));
}
function schedaGestione(box) {
  const r = idro() ? [
    ["Ogni giorno · 2 minuti", ["Guarda il telefono o il LED del quadro.", "Un'occhiata alle radici (bianche, non marroni) e alle foglie.", "Fragole e pomodori: scuoti i fiori."]],
    ["2-3 volte a settimana · 5 minuti", ["Misura pH ed EC con le penne, anche con le sonde automatiche.", "Rabbocca il serbatoio (se non è automatico) e annota quanta acqua hanno bevuto.", "Semina un nuovo giro: produzione continua."]],
    ["Ogni 2-3 settimane · 30 minuti", ["Svuota e rifai la soluzione (l'acqua vecchia va benissimo sull'orto o nei vasi).", "Pulisci i filtri e l'ingresso della pompa.", "Tara le sonde pH (4 e 7) ed EC (1413 µS)."]],
    ["A fine ciclo e a ogni stagione", ["Lava canali e serbatoio con perossido di idrogeno al 3% e risciacqua.", "Estate: luci di notte, serbatoio all'ombra, colture da caldo.", "Inverno: termostato, colture da freddo (lattuga, spinacio, cavolo).", "Ogni anno: sonda pH nuova, controlla cavi e prese."]],
  ] : [
    ["Ogni giorno · 1 minuto", ["Guarda il telefono o il LED del quadro: nessun allarme?", "Un'occhiata alle piante: foglie tese, nessuna pozza."]],
    ["Ogni settimana · 15 minuti", ["Pulisci il filtro a rete.", "Controlla che i gocciolatoi gocciolino tutti.", "Segna il raccolto."]],
    ["Ogni mese", ["Controlla che i sensori siano ben piantati e i cavi integri.", "Pulisci il filtro della grondaia.", "Prova la sonda del quadro con un dito umido."]],
    ["A ogni stagione", ["Autunno: scoli aperti, troppo pieno libero.", "Prima del gelo: svuota tubi e pompa.", "Primavera: tara i sensori (aria/acqua).", "Estate: pacciamatura e ombra sulle insalate."]],
  ];
  const al = idro() ? ALLARMI_IDRO : ALLARMI;
  box.append(el("div", {class: "tre"}, ...r.map(([t, l]) => riquadro(t, el("ul", {class: "lista"}, ...l.map(x => el("li", {text: x})))))),
    riquadro("Cosa vuol dire ogni allarme", el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Allarme", "Cosa succede", "Cosa fai", "Si sblocca"].map(t => el("th", {text: t})))),
      el("tbody", null, ...al.map(a => el("tr", null, el("td", {class: "dati", text: a[0]}), el("td", {text: a[1]}), el("td", {text: a[2]}), el("td", {text: a[3]}))))))));
}
function fontiColture(box) {
  const nomeC = k => k === "tutte" ? "Tutte" : IDRO_PIANTE[k].nome;
  const cella = (r) => { const F = FONTI[r[4]]; return el("td", null, F.url ? el("a", {href: F.url, target: "_blank", rel: "noopener", text: F.testo}) : document.createTextNode(F.testo)); };
  box.append(riquadro("Da dove vengono i dati (fonti e affidabilità)",
    el("p", {class: "piccolo", text: "A = definizione o formula esatta · B = letteratura con parametri medi · C = manuali e pratica, da verificare · D = ipotesi senza fonte. Il gemello usa questi valori: quelli C e D vanno sostituiti con le tue misure."}),
    el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Coltura", "Dato", "Valore", "Condizioni", "Fonte", ""].map(t => el("th", {text: t})))),
      el("tbody", null, ...DATI_COLTURE.map(r => el("tr", null, el("td", {text: nomeC(r[0])}), el("td", {text: r[1]}), el("td", {text: r[2] + (r[3] ? " " + r[3] : "")}), el("td", {class: "piccolo", text: r[5]}), cella(r), el("td", null, chip(r[6] <= "B" ? "ok" : "warn", r[6])))))))));
}
function schedaGuida(box) {
  if (idro()) {
    const t = el("tbody", null, ...Object.values(IDRO_PIANTE).map(P => el("tr", null, el("td", null, el("strong", {text: P.nome}), el("br"), el("span", {class: "piccolo", text: P.note})),
      el("td", {class: "n", text: P.ec.join("–")}), el("td", {class: "n", text: P.ph.join("–")}), el("td", {class: "n", text: P.ppfd.join("–")}), el("td", {class: "n", text: P.dli.join("–")}), el("td", {class: "n", text: P.ore}),
      el("td", {class: "n", text: P.t.join("–")}), el("td", {class: "n", text: P.ur.join("–")}), el("td", {class: "n", text: P.passo ? P.passo + " cm" : "fitto"}), el("td", {class: "n", text: (P.vivaio ? P.vivaio + " + " : "") + P.giorni}),
      el("td", {class: "n", text: P.resa >= 1000 ? fmt(P.resa / 1000, 1) + " kg" : P.resa + " g"}), el("td", {class: "n", text: P.acqua + " L"}), el("td", {class: "n", text: P.seme < 0.1 ? fmt(P.seme * 100, 0) + " cent" : fmt(P.seme, 2) + " €"}),
      el("td", {class: "n", text: P.prezzo + " €"}), el("td", {text: P.sistemi.map(s => SISTEMI_IDRO[s].nome.split(" (")[0]).join(", ")}))));
    const luci = el("tbody", null, ...Object.values(LUCI_IDRO).map(l => el("tr", null, el("td", {text: l.nome}), el("td", {class: "n", text: l.eff + " µmol/J"}), el("td", {class: "n", text: Math.round(250 / (l.eff * 0.85)) + " W"}), el("td", {class: "n", text: l.euro_w.join("–") + " €/W"}), el("td", {text: l.pro + " " + l.contro}))));
    box.append(
      riquadro("Le colture, da tecnico", el("p", {class: "piccolo", text: "EC in mS/cm (1 mS/cm ≈ 500-700 ppm), luce in µmol/m²/s, DLI in mol/m²/giorno, temperature dell'aria in °C, umidità relativa in %, giorni: vivaio + dal trapianto alla raccolta, acqua per pianta grande al giorno, seme per pianta, prezzo al negozio."}),
        el("div", {class: "scorri"}, el("table", {class: "guida"}, el("thead", null, el("tr", null, ...["Coltura", "EC", "pH", "PPFD", "DLI", "Ore", "°C", "UR %", "Distanza", "Giorni", "Resa", "Acqua/g", "Seme", "€/kg", "Sistemi"].map((x, i) => el("th", {class: i && i < 14 ? "n" : "", text: x})))), t))),
      riquadro("Le lampade: quanto consumano davvero", el("p", {class: "piccolo", text: "Conta l'efficienza (µmol/J), non i watt scritti sulla scatola. Formula: watt per m² = PPFD ÷ (efficienza × 0,85). DLI = PPFD × ore × 0,0036. Esempio lattuga: 250 µmol/m²/s per 16 ore = DLI 14,4."}),
        el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Lampada", "Efficienza", "Watt per m² (lattuga)", "Prezzo", "Note"].map((x, i) => el("th", {class: i && i < 4 ? "n" : "", text: x})))), luci)),
        el("p", {class: "piccolo", text: "Distanza dalle foglie: LED bianchi 30-45 cm (piantine 50-60 cm), tubi T8 10-20 cm, neon T5 15-25 cm. Se le foglie si sbiancano o si arricciano in su, la luce è troppa; se gli steli si allungano, è poca."})),
      riquadro("Nutrienti e pH, passo per passo", el("ol", {class: "lista"},
        el("li", {text: "Riempi il serbatoio d'acqua e misura EC e pH di partenza (acqua di casa: EC 0,2-0,7, pH 7-8)."}),
        el("li", {text: "Aggiungi la parte A, mescola 5 minuti; poi la parte B. Mai A e B concentrate insieme: il calcio precipita."}),
        el("li", {text: "Porta l'EC all'obiettivo della coltura (sale di circa 0,1 mS/cm per ogni 0,1 g/L di sali)."}),
        el("li", {text: "Per ultimo correggi il pH con il pH- a gocce, aspetta 15 minuti e rimisura: obiettivo 5,8-6,2 per quasi tutte le colture."}),
        el("li", {text: "Ogni giorno le piante bevono acqua più dei sali: l'EC sale. Rabbocca con acqua semplice, non con soluzione."}),
        el("li", {text: "Ricetta economica in polvere (per 100 L, EC circa 1,5): 60 g di base 4-18-38, 60 g di nitrato di calcio, 30 g di solfato di magnesio, sciolti in due taniche madre separate."}))),
      riquadro("Acqua, aria e radici", el("ul", {class: "lista"},
        el("li", {text: "Temperatura della soluzione 18-22 °C. Sopra 24 °C l'ossigeno cala e arriva il marciume delle radici (Pythium): radici marroni e viscide."}),
        el("li", {text: "Umidità: piantine 70-80%, piante adulte 50-70%. Troppo umido = muffe e bruciature ai bordi; troppo secco = foglie che appassiscono con la luce accesa."}),
        el("li", {text: "Aria: un ventilatore sempre acceso rinforza gli steli; l'estrattore ricambia tutta l'aria della tenda ogni 1-3 minuti."}),
        el("li", {text: "Serbatoio scuro e chiuso, lontano dalla luce: niente alghe. Lavaggio con perossido di idrogeno al 3% a fine ciclo."}))),
      riquadro("Semina e trapianto", el("ul", {class: "lista"},
        el("li", {text: "Cubetti di lana di roccia ammollati 1 ora in acqua a pH 5,5 (o spugne di torba). 1 seme per cubetto (rucola 4-5)."}),
        el("li", {text: "2-3 giorni al buio a 20-24 °C (basilico e peperoncino 25-28 °C), poi luce debole a 50-60 cm."}),
        el("li", {text: "Soluzione leggera (EC 0,5-0,8) dalle prime foglie vere; trapianto nei vasetti a rete dopo 10-14 giorni, quando le radici escono dal cubetto."}),
        el("li", {text: "Costo vero dei semi: bustine da 2-4 € con centinaia di semi (meno di 2 centesimi a pianta); i microgreens ne usano 15-100 g per vassoio, le fragole partono da piantine (0,5-1,5 €)."}))),
      riquadro("Sicurezza in garage", el("ul", {class: "lista"},
        el("li", {text: "Acqua e corrente insieme: impianto di casa con salvavita, ciabatte e prese sollevate da terra, sensore di perdita sul pavimento."}),
        el("li", {text: "I carichi a 230 V (luci, stufetta, deumidificatore) con prese smart certificate, mai con moduli relè fai da te."}),
        el("li", {text: "Stufetta: mai vicino al telo della tenda, sempre con termostato; non lasciarla accesa con la tenda chiusa senza ricambio d'aria."}),
        el("li", {text: "Niente fumi di auto e solventi nella stessa aria delle piante: tenda chiusa, aria presa da fuori se possibile."}))),
    );
  } else {
    const t = el("tbody", null, ...Object.values(PIANTE).map(P => el("tr", null, el("td", {text: P.nome}), el("td", {class: "n", text: P.kc}), el("td", {text: P.mesi.map(m => MESI[m - 1]).join(", ")}), el("td", {class: "n", text: P.giorni}), el("td", {class: "n", text: P.m2}), el("td", {class: "n", text: P.resa}), el("td", {class: "n", text: P.prezzo}))));
    const sens = el("div", {class: "tre"}, ...Object.entries(CATALOGO.sensore_suolo.opzioni).map(([k, o]) => riquadro(o.nome, el("p", {class: "piccolo", text: prezzoTesto(o.p) + " · precisione ±" + Math.round(o.rumore * 100) + "% · dura " + (o.vita >= 3650 ? "10+ anni" : o.vita >= 365 ? Math.round(o.vita / 365) + " anni" : Math.round(o.vita / 30) + " mesi")}), el("p", {class: "piccolo", text: "+ " + o.pro}), el("p", {class: "piccolo", text: "− " + o.contro}))));
    box.append(riquadro("Le piante dell'orto", el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Pianta", "Kc", "Semina/trapianto", "Giorni", "Piante/m²", "kg/m²", "€/kg"].map((x, i) => el("th", {class: [1, 3, 4, 5, 6].includes(i) ? "n" : "", text: x})))), t))),
      el("div", {class: "blocco"}, el("h3", {text: "Sensori di umidità a confronto"}), sens),
      riquadro("Dove mettere i sensori", el("ul", {class: "lista"}, el("li", {text: "A 10-15 cm di profondità (dove ci sono le radici), a 10 cm da un gocciolatoio."}), el("li", {text: "Elettronica fuori terra e riparata; cavo che scende verso il basso prima di entrare nel quadro."}),
        el("li", {text: "Due sensori per zona se la zona è grande o il terreno disomogeneo: il gemello fa la media."}), el("li", {text: "Taratura: lettura in aria (secco) e in un bicchiere d'acqua (saturo), da ripetere ogni primavera."}))));
  }
  if (idro()) fontiColture(box);
}
function schedaPercorso(box) {
  const costo = f => { const v = VOCI.filter(x => x.fase === f); return v.length ? forbice(somma(v, "min"), somma(v, "max")) : "0 €"; };
  const passi = idro() ? [
    ["Impara con il Kratky · 20-40 €", "Un contenitore scuro, un coperchio forato, 6 lattughe, una lampada da 30-50 W, penne pH ed EC. In 5 settimane impari pH, EC, luce e radici.", "6 lattughe raccolte, nessuna radice marrone."],
    ["Il tuo impianto nel gemello · 0 €", "Sistema, colture, luce, clima e componenti qui: guarda corrente, costi al kg e allarmi.", "Nessun messaggio rosso; sai quanto costa il kg."],
    ["Banco · " + costo("4a"), "Microcontrollore, sonde pH, EC e temperatura in un secchio: tara le sonde, prova il dosaggio a piccole dosi.", "Sonde tarate, dosaggio che non sbaglia per una settimana."],
    ["Impianto · " + costo("4b"), "Tenda, sistema, luci, clima e automazione; prima settimana senza piante, solo acqua: perdite, pompa, temperature.", "Una settimana senza perdite e senza allarmi."],
    ["Primo ciclo", "Semina scaglionata: un giro ogni settimana. Annota acqua, EC, pH, temperatura e raccolto.", "Primo raccolto, dati veri da confrontare con il gemello."],
    ["Avvisi · " + costo("6"), "Centrale e notifiche sul telefono.", "Avviso entro 5 minuti da una perdita provocata."],
  ] : [
    ["Strumenti · 0 €", "Python, Git e un account gratuito Wokwi. Scarica il repository e lancia i test.", "I test finiscono con OK."],
    ["Il tuo orto nel gemello · 0 €", "Zone, piante, componenti, logica e guasti qui.", "Nessun messaggio rosso."],
    ["Simulazione dettagliata · 0 €", "Il comando qui sotto prova le tue zone minuto per minuto con la logica dell'ESP32.", "Ogni guasto dà l'allarme giusto."],
    ["ESP32 virtuale · 0 €", "Il firmware vero su Wokwi: prove W1-W11.", "Tutte le prove W superate. Solo ora si compra."],
    ["Banco minimo · " + costo("4a"), "Microcontrollore, sensore, relè sul tavolo: prove B1-B5.", "Sensore tarato, relè mai accesi all'avvio."],
    ["Banco completo · " + costo("4b"), "Il resto dell'elettronica e la pompa in un secchio: prove B6-B13.", "Nessun riavvio alla partenza della pompa."],
    ["Campo · " + costo("5"), "Una zona per 14 giorni accanto a un vaso annaffiato a mano, poi le altre: prove C1-C7.", "Piante sane, gemello tarato con i dati veri."],
    ["Avvisi · " + costo("6"), "Centrale su un vecchio PC: dati e avvisi sul telefono.", "Senza Wi-Fi l'orto continua da solo."],
  ];
  box.append(el("div", {class: "riquadro"}, el("div", {class: "passi"}, ...passi.map(p => el("div", {class: "passo"}, el("div", null, el("h3", {text: p[0]}), el("p", {class: "piccolo", text: p[1]}), el("p", {class: "piccolo"}, el("strong", {text: "Cancello: "}), document.createTextNode(p[2]))))))));
  if (!idro()) {
    const T0 = TERRENI[cfg.terreno];
    const zone = cfg.zone.map(z => ({nome: PIANTE[z.coltura].nome.toLowerCase(), area_m2: z.area, kc: PIANTE[z.coltura].kc, capacita_mm: T0.cap, drenaggio_mm_h: z.rialzata ? Math.max(T0.dren, 15) : T0.dren, pacciamatura: z.pacciamatura}));
    const cmd = "python3 -m sistema.simula tutti --portata " + Math.max(...cfg.zone.map(z => portataZona(cfg, z))).toFixed(2) + " --zone '" + JSON.stringify(zone) + "'";
    const pre = el("pre", {text: cmd}), esito = el("span", {class: "piccolo", "aria-live": "polite"});
    const b = el("button", {class: "az sec", type: "button", text: "Copia il comando"});
    b.addEventListener("click", () => { try { navigator.clipboard.writeText(cmd).then(() => esito.textContent = "Copiato.", () => { selezionaTesto(pre); esito.textContent = "Selezionato: premi Ctrl+C."; }); } catch (e) { selezionaTesto(pre); } });
    box.append(riquadro("Porta il tuo orto nel simulatore dettagliato", el("p", {class: "piccolo", text: "Il simulatore del repository lavora minuto per minuto con la stessa logica dell'ESP32. Lancia il comando nella cartella del progetto."}), pre, el("div", null, b, document.createTextNode(" "), esito)));
  }
  box.append(riquadro("La tua configurazione (JSON)", el("details", null, el("summary", {text: "Mostra"}), el("pre", {text: JSON.stringify(cfg, null, 2)}))));
}
function selezionaTesto(n) { const r = document.createRange(); r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

// ---------- pianta del locale ----------
function piantaSvg() {
  const P = posizionaImpianto(cfg), Lc = P.locale, k = capacitaIdro(cfg), sc = 100, pad = 30;
  const W = Lc.lung * sc + 2 * pad, H = Lc.larg * sc + 2 * pad + 20;
  const svg = sv("svg", {xmlns: "http://www.w3.org/2000/svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Pianta del locale", style: "width:100%;max-width:640px;display:block;font-family:sans-serif"});
  const r = (o, fill, stroke, testo, tratteggio) => { svg.append(sv("rect", {x: pad + o.x * sc, y: pad + o.y * sc, width: o.lung * sc, height: o.prof * sc, fill, stroke, "stroke-width": 1.5, "stroke-dasharray": tratteggio ? "6 4" : ""}));
    if (testo) svg.append(sv("text", {x: pad + (o.x + o.lung / 2) * sc, y: pad + (o.y + o.prof / 2) * sc + 4, "text-anchor": "middle", "font-size": 11, fill: "#16201a"}, testo)); };
  r({x: 0, y: 0, lung: Lc.lung, prof: Lc.larg}, "#f6f6f2", "#4a554d", null);
  if (P.passaggio) r(P.passaggio, "#eef0ec", "#9aa39c", "passaggio 80 cm", true);
  r(P.lavoro, "#e3eee5", "#2f6b45", "spazio per lavorare 60 cm", true);
  r(P.ingombro, "#cfe0f5", "#2a78d6", cfg.idro.clima.tenda ? "tenda " + k.tenda.nome.split("×").slice(0, 2).join("×") : "impianto");
  r({x: P.ingombro.x + (P.ingombro.lung - k.misure.lung) / 2, y: P.ingombro.y + (P.ingombro.prof - k.misure.prof) / 2, lung: k.misure.lung, prof: k.misure.prof}, "none", "#16201a", null);
  r(P.quadro, "#fbe3d6", "#eb6834", "quadro");
  svg.append(sv("line", {x1: pad + Lc.lung * sc, y1: pad + Lc.larg * sc * 0.15, x2: pad + Lc.lung * sc, y2: pad + Lc.larg * sc * 0.85, stroke: "#eb6834", "stroke-width": 5}));
  svg.append(sv("text", {x: pad + Lc.lung * sc - 6, y: pad + Lc.larg * sc / 2, "text-anchor": "end", "font-size": 11, fill: "#8a3a14"}, "porta"));
  svg.append(sv("text", {x: pad, y: H - 8, "font-size": 11, fill: "#4a554d"}, "Locale " + Lc.lung + " × " + Lc.larg + " m, alto " + Lc.alt + " m · scala: 1 m = " + sc + " px · " + (P.entra ? "entra" : "NON entra: " + P.motivo)));
  return svg;
}
function scarica(nome, tipo, testo) {
  const a = el("a", {href: URL.createObjectURL(new Blob([testo], {type: tipo})), download: nome}); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function piantaUI() {
  const svg = piantaSvg(), b = el("button", {class: "az sec", type: "button", text: "Scarica la pianta (SVG)"});
  b.addEventListener("click", () => scarica("pianta-impianto.svg", "image/svg+xml", new XMLSerializer().serializeToString(piantaSvg())));
  return riquadro("Pianta del locale (vista dall'alto)", el("p", {class: "piccolo", text: "Disegno in scala per verificare ingombri, spazio per lavorare e passaggio. È una rappresentazione per decidere, non un disegno esecutivo: misura il locale vero prima di comprare."}), el("div", {class: "scorri"}, svg), el("div", null, b));
}

// ---------- meteo vero ----------
function meteoVeroUI() {
  const MR = cfg.meteoReale, esito = el("p", {class: "piccolo", "aria-live": "polite"});
  const luogo = el("input", {type: "text", placeholder: "Comune, es. Ancona", "aria-label": "Comune"});
  const anno = el("input", {type: "number", min: "1950", max: String(new Date().getFullYear() - 1), value: String(new Date().getFullYear() - 1), "aria-label": "Anno"});
  const scarica = el("button", {class: "az sec", type: "button", text: "Scarica da Open-Meteo"});
  scarica.addEventListener("click", async () => {
    esito.textContent = "Cerco " + luogo.value + "…";
    try {
      const g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=it&country=IT&name=" + encodeURIComponent(luogo.value))).json();
      if (!g.results || !g.results.length) throw new Error("comune non trovato");
      const p = g.results[0], a = +anno.value;
      esito.textContent = "Scarico il " + a + " di " + p.name + "…";
      const url = "https://archive-api.open-meteo.com/v1/archive?latitude=" + p.latitude + "&longitude=" + p.longitude + "&start_date=" + a + "-01-01&end_date=" + a + "-12-31&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration&timezone=Europe%2FRome";
      cfg.meteoReale = meteoDaOpenMeteo(await (await fetch(url)).json(), p.name + " " + a);
      aggiorna(true);
    } catch (e) { esito.textContent = "Download non riuscito (" + e.message + "). Se la pagina non può uscire in rete, usa lo script strumenti/scarica_meteo.py e carica qui il CSV."; }
  });
  const file = el("input", {type: "file", accept: ".csv,text/csv", "aria-label": "File CSV del meteo"});
  file.addEventListener("change", () => { const f = file.files[0]; if (!f) return; f.text().then(t => { try { cfg.meteoReale = meteoDaCsv(t); aggiorna(true); } catch (e) { esito.textContent = "CSV non valido: " + e.message; } }); });
  const togli = el("button", {class: "az sec", type: "button", text: "Torna al clima medio"});
  togli.addEventListener("click", () => { delete cfg.meteoReale; aggiorna(true); });
  return riquadro("Meteo vero del tuo comune", el("div", {id: "ed-meteo"}),
    el("p", {class: "piccolo", text: MR ? "In uso: " + MR.fonte + " (" + MR.dal + " → " + MR.al + "). Temperature minime e massime vere giorno per giorno" + (idro() ? ": il garage segue il meteo di quell'anno." : ", pioggia ed evapotraspirazione.") : "Ora il gemello usa le medie mensili della zona. Con un anno vero del tuo comune vedi ondate di calore, gelate e piogge vere."}),
    el("div", {class: "campi"}, luogo, anno, scarica), el("div", {class: "campi"}, el("label", {class: "campo"}, document.createTextNode("Oppure carica un CSV (data, et0_mm, pioggia_mm, t_min, t_max)"), file), MR ? togli : null), esito);
}

// ---------- ricetta dei nutrienti ----------
function ricettaUI(I, k) {
  const an = I.acqua.analisi = Object.assign({ca: null, mg: null, hco3: null, na: null}, I.acqua.analisi || {});
  const r = ricetta(k.ec, Object.assign({durezza: I.acqua.durezza}, an), 100);
  const setA = (kk, v) => { an[kk] = v > 0 ? v : null; aggiorna(false); };
  const nomeSale = kk => SALI[kk].nome;
  const righe = Object.entries(r.grammi).filter(([, g]) => g > 0.05);
  return [el("div", {class: "blocco"}, el("span", {class: "etichetta", text: "Ricetta per EC " + fmt(k.ec, 1) + " (dalle tue colture)"}),
    el("p", {class: "piccolo", text: "Analisi dell'acqua (dal sito o dalla bolletta del gestore; vuoto = stimata dalla durezza):"}),
    griglia(campoNum("Calcio", an.ca || 0, 0, 300, 1, v => setA("ca", v), "mg/L"), campoNum("Magnesio", an.mg || 0, 0, 150, 1, v => setA("mg", v), "mg/L"),
      campoNum("Bicarbonati", an.hco3 || 0, 0, 600, 1, v => setA("hco3", v), "mg/L"), campoNum("Sodio", an.na || 0, 0, 300, 1, v => setA("na", v), "mg/L")),
    el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Tanica", "Sale", "g per 100 L", "g per il serbatoio (" + k.serbatoio + " L)"].map((t, i) => el("th", {class: i > 1 ? "n" : "", text: t})))),
      el("tbody", null, ...righe.map(([kk, g]) => el("tr", null, el("td", {text: SALI[kk].tanica}), el("td", {text: nomeSale(kk)}), el("td", {class: "n", text: fmt(g, 1)}), el("td", {class: "n", text: fmt(g * k.serbatoio / 100, 1)}))),
        el("tr", null, el("td", {text: "-"}), el("td", {text: "Acido fosforico 75% per i bicarbonati"}), el("td", {class: "n", text: fmt(r.acidoMl, 0) + " mL"}), el("td", {class: "n", text: fmt(r.acidoMl * k.serbatoio / 100, 0) + " mL"}))))),
    el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["mg/L", "N", "P", "K", "Ca", "Mg", "S"].map((t, i) => el("th", {class: i ? "n" : "", text: t})))),
      el("tbody", null, el("tr", null, el("td", {text: "Obiettivo (Hoagland × " + fmt(r.fattore, 2) + ")"}), ...["N", "P", "K", "Ca", "Mg", "S"].map(e => el("td", {class: "n", text: fmt(r.obiettivo[e])}))),
        el("tr", null, el("td", {text: "Ottenuto (acqua + sali)"}), ...["N", "P", "K", "Ca", "Mg", "S"].map(e => el("td", {class: "n", text: fmt(r.ottenuto[e])})))))),
    el("p", {class: "piccolo", text: "EC stimata " + fmt(r.ec, 2) + " mS/cm (acqua " + fmt(r.ecAcqua, 2) + "). Costo dei sali circa " + euro(r.costo) + " ogni 100 L. Taniche madre 100 volte concentrate: 1 L di A e 1 L di B ogni 100 L d'acqua."}),
    ...r.avvisi.map(t => el("p", {class: "piccolo", text: "• " + t})))];
}

// ---------- mappa della luce ----------
function mappaLuceUI(I, set) {
  const m = mappaLuce(cfg);
  if (!m) return [el("p", {class: "piccolo", text: "Per le torri la luce arriva di lato: la mappa sul piano non si applica."})];
  const W = 520, H = Math.round(W * m.prof / m.lung), gx = m.griglia[0].length, gy = m.griglia.length;
  const svg = sv("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Mappa della luce sul ripiano", style: "width:100%;max-width:520px;display:block"});
  const scalaCol = v => { const t = Math.max(0, Math.min(1, (v - m.min) / Math.max(1, m.max - m.min))); return `color-mix(in oklab, var(--s1) ${Math.round(12 + 88 * t)}%, var(--carta))`; };
  m.griglia.forEach((riga, j) => riga.forEach((v, i) => {
    const r = sv("rect", {x: i * W / gx, y: j * H / gy, width: W / gx + 0.5, height: H / gy + 0.5, fill: scalaCol(v)});
    r.append(sv("title", {}, Math.round(v) + " µmol/m²/s")); svg.append(r); }));
  return [griglia(campoNum("Distanza lampada-foglie", I.luce.distanza_cm || 35, 10, 100, 5, v => set(I.luce, "distanza_cm", v), "cm")),
    el("div", {class: "blocco"}, el("span", {class: "etichetta", text: "Luce sul ripiano (vista dall'alto, " + Math.round(m.lung * 100) + " × " + Math.round(m.prof * 100) + " cm)"}), el("div", {class: "scorri"}, svg), el("p", {class: "piccolo num", text: "min " + Math.round(m.min) + " · media " + Math.round(m.media) + " · max " + Math.round(m.max) + " µmol/m²/s · uniformità " + fmt(m.uniformita, 2) + " (chiaro = meno luce, scuro = più luce)"})),
    el("p", {class: "piccolo", text: "Ai bordi arriva il " + Math.round((1 - m.min / m.media) * 100) + "% di luce in meno della media: DLI da " + fmt(m.dliMin, 1) + " a " + fmt(m.max * capacitaIdro(cfg).ore * 0.0036, 1) + ". " + (m.uniformita < 0.6 ? "Uniformità bassa: alza la lampada o usa barre distribuite; ai bordi metti le piante che vogliono meno luce." : "Uniformità accettabile (sopra 0,6).") + " Calcolo con sorgenti lambertiane" + (I.clima.tenda ? " e pareti riflettenti della tenda (90%)" : "") + "; con la mappa del costruttore è più preciso."})];
}

// ---------- registro e calibrazione ----------
function schedaRegistro(box) {
  if (!idro()) { box.append(el("p", {class: "piccolo", text: "Il registro con la calibrazione per ora è per l'idroponica. Per l'orto: il simulatore Python accetta il meteo vero e le tue soglie (scheda Percorso)."})); return; }
  const I = cfg.idro;
  I.registro = I.registro || []; I.misure = I.misure || []; I.energia = I.energia || [];
  const oggi = new Date().toISOString().slice(0, 10);
  // nuovo ciclo
  const col = el("select", {"aria-label": "Coltura"}); I.colture.forEach(x => col.append(el("option", {value: x.coltura, text: IDRO_PIANTE[x.coltura].nome})));
  const sem = el("input", {type: "date", "aria-label": "Semina"}), rac = el("input", {type: "date", value: oggi, "aria-label": "Raccolta"});
  const npi = el("input", {type: "number", min: "1", value: "6", "aria-label": "Piante raccolte"}), peso = el("input", {type: "number", min: "1", placeholder: "g in tutto", "aria-label": "Peso totale in grammi"});
  const nota = el("input", {type: "text", placeholder: "note (varietà, problemi)", "aria-label": "Note"});
  const agg = el("button", {class: "az", type: "button", text: "Aggiungi ciclo"});
  agg.addEventListener("click", () => { if (!sem.value || !rac.value || !(+peso.value > 0)) return;
    I.registro.push({coltura: col.value, semina: sem.value, raccolta: rac.value, piante: +npi.value, peso_g: +peso.value, note: nota.value}); salva(); disegnaScheda(); });
  box.append(el("p", {class: "piccolo", text: "Scrivi qui ogni raccolto vero: date e peso. Il gemello calcola cosa avrebbe previsto per le stesse date (con le temperature misurate, se le carichi) e misura il suo errore. Con almeno 2 cicli per coltura propone una correzione, che puoi applicare e annullare. Le correzioni cambiano solo le previsioni di resa: mai la logica di controllo e le sicurezze."}),
    riquadro("Nuovo ciclo raccolto", el("div", {class: "campi"},
      el("label", {class: "campo"}, document.createTextNode("Coltura"), col), el("label", {class: "campo"}, document.createTextNode("Semina"), sem),
      el("label", {class: "campo"}, document.createTextNode("Raccolta"), rac), el("label", {class: "campo"}, document.createTextNode("Piante raccolte"), npi),
      el("label", {class: "campo"}, document.createTextNode("Peso totale (g)"), peso), el("label", {class: "campo"}, document.createTextNode("Note"), nota)), el("div", null, agg)));
  // misure e energia
  const file = el("input", {type: "file", accept: ".csv", "aria-label": "CSV delle misure"});
  const esito = el("p", {class: "piccolo", "aria-live": "polite", text: I.misure.length ? I.misure.length + " giorni di misure caricati (" + I.misure[0].data + " → " + I.misure[I.misure.length - 1].data + ")." : "Nessuna misura caricata: il gemello usa le temperature simulate."});
  file.addEventListener("change", () => { const f = file.files[0]; if (!f) return; f.text().then(t => { try { I.misure = misureDaCsv(t); salva(); disegnaScheda(); } catch (e) { esito.textContent = "CSV non valido: " + e.message; } }); });
  const dal = el("input", {type: "date", "aria-label": "Dal"}), al = el("input", {type: "date", "aria-label": "Al"}), kwh = el("input", {type: "number", min: "0", step: "0.1", "aria-label": "kWh letti"});
  const aggE = el("button", {class: "az sec", type: "button", text: "Aggiungi lettura"});
  aggE.addEventListener("click", () => { if (dal.value && al.value && +kwh.value > 0) { I.energia.push({dal: dal.value, al: al.value, kwh: +kwh.value}); salva(); disegnaScheda(); } });
  const ce = confrontoEnergia(cfg, I.energia);
  box.append(el("div", {class: "due"},
    riquadro("Misure dell'impianto (da Home Assistant)", el("p", {class: "piccolo", text: "CSV di strumenti/storico_ha.py (data, t_aria_min, t_aria_max, …): le temperature vere sostituiscono quelle simulate nelle previsioni."}), file, esito),
    riquadro("Corrente letta sulla presa con contatore", el("div", {class: "campi"}, el("label", {class: "campo"}, document.createTextNode("Dal"), dal), el("label", {class: "campo"}, document.createTextNode("Al"), al), el("label", {class: "campo"}, document.createTextNode("kWh"), kwh)), el("div", null, aggE),
      ce.length ? el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Periodo", "Letti", "Gemello", "Errore"].map((t, i) => el("th", {class: i ? "n" : "", text: t})))),
        el("tbody", null, ...ce.map(x => el("tr", null, el("td", {text: x.dal + " → " + x.al}), el("td", {class: "n", text: fmt(x.kwh, 1)}), el("td", {class: "n", text: fmt(x.simulati, 1)}), el("td", {class: "n", text: (x.errore > 0 ? "+" : "") + fmt(x.errore * 100) + "%"})))))) : el("p", {class: "piccolo", text: "Tolleranza attesa ±5% (AUDIT.md §7)."}))));
  // confronto raccolti
  const cf = confronto(cfg, I.registro, I.misure), att = fattoriAttivi(I);
  if (cf.righe.length) box.append(riquadro("Raccolti: vero contro gemello", el("div", {class: "scorri"}, el("table", null,
    el("thead", null, el("tr", null, ...["Coltura", "Semina → raccolta", "Giorni", "g/pianta veri", "Gemello", "Errore", "Giorni previsti", "Giorni con misure", ""].map((t, i) => el("th", {class: i > 1 ? "n" : "", text: t})))),
    el("tbody", null, ...cf.righe.map(r => { const del = el("button", {class: "link", type: "button", text: "Togli"});
      del.addEventListener("click", () => { I.registro.splice(I.registro.indexOf(I.registro.find(x => x.semina === r.semina && x.raccolta === r.raccolta && x.coltura === r.coltura)), 1); salva(); disegnaScheda(); });
      return el("tr", null, el("td", {text: IDRO_PIANTE[r.coltura].nome}), el("td", {text: r.semina + " → " + r.raccolta}), el("td", {class: "n", text: fmt(r.durata)}),
        el("td", {class: "n", text: fmt(r.pesoVero)}), el("td", {class: "n", text: fmt(r.pesoPrevisto) + (att[r.coltura] ? " (×" + fmt(att[r.coltura], 2) + " = " + fmt(r.pesoPrevisto * att[r.coltura]) + ")" : "")}),
        el("td", {class: "n", text: (r.errore > 0 ? "+" : "") + fmt(r.errore * 100) + "%"}), el("td", {class: "n", text: fmt(r.giorniPrevisti)}), el("td", {class: "n", text: fmt(r.giorniMisurati) + "/" + fmt(r.durata)}), el("td", null, del)); }))))));
  else box.append(riquadro("Raccolti: vero contro gemello", el("p", {class: "piccolo", text: "Ancora nessun raccolto registrato."})));
  // calibrazione
  const righeSt = cf.statistiche.map(st => el("tr", null, el("td", {text: IDRO_PIANTE[st.coltura].nome}), el("td", {class: "n", text: st.n}),
    el("td", {class: "n", text: fmt(st.mape * 100) + "%"}), el("td", {class: "n", text: "× " + fmt(st.fattore, 2) + (st.intervallo ? " (" + fmt(st.intervallo[0], 2) + "–" + fmt(st.intervallo[1], 2) + ")" : "")}),
    el("td", {class: "n", text: st.proponibile ? fmt(erroreDopo(st, cf.righe) * 100) + "%" : "-"}), el("td", null, chip(st.proponibile ? "ok" : "warn", st.proponibile ? "proponibile" : 2 - st.n === 1 ? "serve ancora 1 ciclo" : "servono " + (2 - st.n) + " cicli"))));
  const appl = el("button", {class: "az", type: "button", text: "Applica la correzione (nuova versione)"});
  appl.disabled = !cf.statistiche.some(s => s.proponibile);
  appl.addEventListener("click", () => { applicaCalibrazione(I, cf.statistiche); aggiorna(false); });
  const indietro = el("button", {class: "az sec", type: "button", text: "Torna alla versione precedente"});
  indietro.disabled = !(I.calibrazioni && I.calibrazioni.length);
  indietro.addEventListener("click", () => { tornaIndietro(I); aggiorna(false); });
  box.append(riquadro("Calibrazione del modello",
    cf.statistiche.length ? el("div", {class: "scorri"}, el("table", null, el("thead", null, el("tr", null, ...["Coltura", "Cicli", "Errore medio ora", "Correzione proposta (95%)", "Errore dopo", ""].map((t, i) => el("th", {class: i ? "n" : "", text: t})))), el("tbody", null, ...righeSt))) : el("p", {class: "piccolo", text: "Servono almeno 2 cicli registrati per coltura."}),
    el("p", {class: "piccolo", text: "L'errore \"dopo\" è calcolato sugli stessi cicli: dice che la correzione è coerente, non che è giusta. Verificala sui prossimi raccolti."}),
    el("div", null, appl, document.createTextNode(" "), indietro),
    ...(I.calibrazioni || []).slice().reverse().map((v, i) => el("p", {class: "piccolo", text: (i ? "" : "In uso: ") + "versione " + v.versione + " del " + v.data + " · " + v.note}))));
}

// ---------- percorso guidato ----------
let PROPOSTE = null;
function schedaInizia(box) {
  const R = cfg.risposte = Object.assign({}, RISPOSTE_ESEMPIO, cfg.risposte || {});
  const set = (kk, v) => { R[kk] = v; PROPOSTE = null; salva(); disegnaScheda(); };
  const elenco = R.luogo === "esterno" ? PIANTE : IDRO_PIANTE;
  R.colture = R.colture.filter(k => elenco[k]);
  const colture = el("div", {class: "campi"}, ...Object.entries(elenco).map(([kk, p]) => spunta(p.nome, R.colture.includes(kk), v => set("colture", v ? [...R.colture, kk] : R.colture.filter(x => x !== kk)))));
  box.append(el("p", {class: "piccolo", text: "Rispondi a poche domande: il gemello prova tutte le combinazioni sensate (sistema, dimensione, lampade, automazione, tenda), scarta quelle che non rispettano spazio, budget e tempo, e ti propone tre soluzioni. Se non conviene, te lo dice."}),
    riquadro("Le tue risposte",
      griglia(campoSel("Dove", R.luogo, [["garage", "Garage, cantina o stanza (idroponica)"], ["esterno", "All'aperto (orto in terra)"]], v => { R.colture = []; set("luogo", v); }),
        campoSel("Zona d'Italia", R.regione, Object.entries(REGIONI).map(([kk, r]) => [kk, r.nome]), v => set("regione", v)),
        campoNum("Spazio utilizzabile", R.superficie, 1, 500, 1, v => set("superficie", v), "m²"),
        campoNum("Altezza utile", R.altezza, 1, 5, 0.1, v => set("altezza", v), "m"),
        campoNum("Budget per partire", R.budget, 0, 20000, 10, v => set("budget", v), "€"),
        campoNum("Spesa massima al mese", R.budget_mese, 0, 2000, 5, v => set("budget_mese", v), "€"),
        campoNum("Tempo disponibile", R.ore_settimana, 0, 40, 0.5, v => set("ore_settimana", v), "ore a settimana"),
        campoNum("Persone in famiglia", R.persone, 1, 10, 1, v => set("persone", v)),
        campoNum("Prezzo della corrente", R.kwh, 0, 1, 0.01, v => set("kwh", v), "€/kWh")),
      schede("Obiettivo", R.obiettivo, Object.entries(OBIETTIVI).map(([kk, o]) => [kk, o.nome, o.descr]), v => set("obiettivo", v)),
      el("div", {class: "blocco"}, el("span", {class: "etichetta", text: "Colture che ti interessano"}), colture)));
  const esito = el("div", {"aria-live": "polite"});
  const calcola = el("button", {class: "az", type: "button", text: PROPOSTE ? "Ricalcola" : "Calcola le proposte"});
  calcola.disabled = !R.colture.length && R.luogo !== "esterno";
  calcola.addEventListener("click", () => { esito.replaceChildren(el("p", {class: "piccolo", text: "Sto provando tutte le combinazioni…"})); setTimeout(() => { PROPOSTE = progetta(R); disegnaScheda(); }, 30); });
  box.append(el("div", {class: "blocco"}, calcola), esito);
  if (!PROPOSTE) return;
  const P = PROPOSTE;
  esito.append(riquadro("Giudizio", el("p", {class: "piccolo", text: "Configurazioni provate: " + P.tutti.length + ", possibili con i tuoi vincoli: " + P.ok.length + "."}),
    ...P.giudizio.righe.map(r => el("div", {class: "msg"}, chip(r.tipo, r.tipo === "ok" ? "ok" : r.tipo === "warn" ? "attenzione" : "no"), el("p", {class: "piccolo", text: r.testo})))));
  const riga = (n, v) => el("tr", null, el("td", {text: n}), el("td", {class: "n", text: v}));
  const scala = n => "●".repeat(n) + "○".repeat(5 - n);
  const carte = P.proposte.map(p => {
    if (!p.x) return riquadro(p.lettera + " · " + p.titolo, el("p", {class: "piccolo", text: p.nota}));
    const r = p.x.riassunto, v = p.x.v;
    const usa = el("button", {class: "az", type: "button", text: "Apri nel gemello"});
    usa.addEventListener("click", () => {
      if (P.tipo === "idro") { cfg.modalita = "idro"; cfg.idro = JSON.parse(JSON.stringify(p.x.c.idro)); }
      else { cfg.modalita = "orto"; for (const kk of ["zone", "componenti", "extra", "acqua", "preset"]) cfg[kk] = JSON.parse(JSON.stringify(p.x.c[kk])); }
      cfg.regione = R.regione; cfg.prezzi.kwh = R.kwh; aggiorna(true); apri("progetto"); });
    return riquadro(p.lettera + " · " + p.titolo, el("p", null, el("strong", {text: p.nome})),
      el("div", {class: "scorri"}, el("table", null, el("tbody", null,
        riga("Per iniziare", forbice(r.capexMin, r.capexMax)), riga("Spese all'anno", euro(r.opex)), riga("Raccolto utile", fmt(r.kg) + " kg all'anno"),
        riga("Costo al kg (con ammortamento)", isFinite(r.costoKg) ? euro(r.costoKg) : "-"), riga("Si ripaga in", isFinite(r.pareggio) ? fmt(r.pareggio, 1) + " anni" : "mai"),
        riga("Corrente", fmt(r.kwh) + " kWh all'anno"), riga("Acqua", fmt(r.acqua, 1) + " m³ all'anno"), riga("Lavoro", fmt(r.ore, 1) + " ore a settimana"),
        ...(v ? [riga("Difficoltà", scala(v.difficolta)), riga("Rischio tecnico", scala(v.rischio)), riga("Gestione", scala(v.gestione)), riga("Si può ingrandire", scala(v.ampliabile))] : [])))),
      el("p", null, chip(r.giudizio === "conviene" ? "ok" : "warn", r.giudizio === "conviene" ? "si ripaga" : "non si ripaga")), usa);
  });
  esito.append(el("div", {class: "tre"}, ...carte));
  if (P.motiviScarto && Object.keys(P.motiviScarto).length) esito.append(riquadro("Perché altre configurazioni sono state scartate",
    el("p", {class: "piccolo", text: Object.entries(P.motiviScarto).sort((a, b) => b[1] - a[1]).map(([k, n]) => n + " per " + k).join(", ") + ". Difficoltà, rischio e gestione sono giudizi da tecnico (scala 1-5), non misure."})));
}

// ---------- schede e aggiornamento ----------
const SCHEDE = [["inizia", "Inizia"], ["progetto", "Progetto"], ["componenti", "Componenti"], ["logica", "Logica"], ["guasti", "Guasti"], ["simulazione", "Simulazione"], ["registro", "Registro"], ["costi", "Costi"], ["materiali", "Materiali"], ["struttura", "Struttura"], ["gestione", "Gestione"], ["guida", "Guida"], ["percorso", "Percorso"]];
let schedaAperta = "progetto";
function apri(nome) {
  if (!SCHEDE.some(s => s[0] === nome)) nome = "progetto";
  schedaAperta = nome;
  document.querySelectorAll("nav.schede button").forEach(b => b.setAttribute("aria-selected", b.dataset.s === nome ? "true" : "false"));
  try { localStorage.setItem(CHIAVE + "-scheda", nome); } catch (e) {}
  disegnaScheda();
}
function disegnaScheda() {
  const box = $("contenuto"); box.replaceChildren();
  const titoli = {registro: "Registro: misure vere contro gemello", inizia: "Progetta il tuo primo impianto", progetto: idro() ? "Il tuo impianto idroponico" : "Il tuo orto", componenti: "Componenti", logica: "Logica di controllo", guasti: "Guasti e scenari", simulazione: "Un anno nel gemello",
    costi: "Quanto costa, davvero", materiali: "Lista della spesa", struttura: "Come è fatto", gestione: "Gestirlo ogni giorno", guida: idro() ? "Guida da tecnico dell'idroponica" : "Guida", percorso: "Dal gemello alla realtà"};
  box.append(el("h2", {text: titoli[schedaAperta]}));
  const f = {registro: () => schedaRegistro(box), inizia: () => schedaInizia(box), progetto: () => idro() ? editorProgettoIdro(box) : editorProgettoOrto(box), componenti: () => idro() ? editorComponentiIdro(box) : editorComponentiOrto(box),
    logica: () => idro() ? editorLogicaIdro(box) : editorLogicaOrto(box), guasti: () => editorGuasti(box, idro() ? GUASTI_IDRO : GUASTI, !idro()),
    simulazione: () => schedaSimulazione(box), costi: () => schedaCosti(box), materiali: () => schedaMateriali(box), struttura: () => schedaStruttura(box),
    gestione: () => schedaGestione(box), guida: () => schedaGuida(box), percorso: () => schedaPercorso(box)}[schedaAperta];
  f();
}
let timer3d = null;
function aggiorna(ricostruisci3d = true) {
  salva();
  if (idro()) { S = simulaIdro(cfg); VOCI = materialiIdro(cfg); COSTI = costiAnnuiIdro(cfg, S); ECO = economiaIdro(cfg, S, VOCI, COSTI); M = null; }
  else { M = meteo(cfg); S = simula(cfg, {meteo: M}); VOCI = materiali(cfg); COSTI = costiAnnui(cfg, S, VOCI); }
  kpi(); messaggi(); disegnaScheda(); hud(giorno);
  document.querySelectorAll(".modo button").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === cfg.modalita ? "true" : "false"));
  if (Vista3D) { clearTimeout(timer3d); timer3d = setTimeout(() => { Vista3D.costruisci(cfg, S, VOCI); Vista3D.mostraGiorno(giorno); disegnaInquadrature(); }, ricostruisci3d ? 30 : 30); }
}
function disegnaInquadrature() {
  const box = $("inquadrature"); box.replaceChildren(...Vista3D.inquadrature().map(n => el("button", {class: "chipbtn", type: "button", text: n, onclick: () => Vista3D.inquadra(n)})));
}

// ---------- avvio ----------
$("schede").replaceChildren(...SCHEDE.map(([k, n]) => { const b = el("button", {role: "tab", "data-s": k, "aria-selected": "false", type: "button", text: n}); b.addEventListener("click", () => apri(k)); return b; }));
document.querySelectorAll(".modo button").forEach(b => b.addEventListener("click", () => { cfg.modalita = b.dataset.m; Vista3D && (giorno = giorno); aggiorna(true); }));
let ora = 11, inGioco = false, accumulo = 0;
$("ora").addEventListener("input", e => { ora = +e.target.value; if (Vista3D) Vista3D.impostaOra(ora); hud(giorno); });
$("giorno").addEventListener("input", e => { giorno = +e.target.value; if (Vista3D) Vista3D.mostraGiorno(giorno); hud(giorno); });
$("gioca").addEventListener("click", () => { inGioco = !inGioco; $("gioca").textContent = inGioco ? "❚❚" : "▶"; $("gioca").setAttribute("aria-label", inGioco ? "Ferma" : "Avvia l'anno"); });
if (Vista3D) {
  Vista3D.alTick(dt => { if (!inGioco) return; accumulo += dt * +$("velocita").value; if (accumulo >= 1) { const p = Math.floor(accumulo); accumulo -= p; giorno = (giorno + p) % 365; Vista3D.mostraGiorno(giorno); hud(giorno); } });
  Vista3D.alClic(inf => {
    const box = $("hud-info");
    if (!inf) { box.classList.add("vuoto"); return; }
    box.classList.remove("vuoto");
    box.replaceChildren(el("span", {class: "etichetta", text: "Nel tuo impianto"}), el("strong", {text: inf.titolo}), el("span", {class: "piccolo", text: inf.testo || ""}),
      inf.prezzo ? el("span", {class: "num", text: inf.prezzo}) : null, inf.chiave ? el("button", {class: "az", type: "button", text: "Modifica", onclick: () => vaiA(inf.chiave)}) : null);
  });
}
try { const s = localStorage.getItem(CHIAVE + "-scheda"); if (s) schedaAperta = s; } catch (e) {}
const daHash = location.hash.slice(1); if (SCHEDE.some(s => s[0] === daHash)) schedaAperta = daHash;
document.querySelectorAll("nav.schede button").forEach(b => b.setAttribute("aria-selected", b.dataset.s === schedaAperta ? "true" : "false"));
aggiorna(true);
