"use strict";
// Motore climatico dinamico: nodi termici Esterno → Locale (garage o serra) → Tenda → Serbatoio, passo di 10 minuti.
// Locale e serbatoio hanno inerzia (capacità termica, integrazione esplicita stabile: costanti di tempo di ore);
// la tenda ha poca massa e si risolve in equilibrio a ogni passo (costante di tempo di pochi minuti).
// Formule: bilanci di energia; trasmittanze U = 1 / ΣR con le resistenze superficiali di EN ISO 6946
// (Rsi 0,13 m²K/W flusso orizzontale); ricambio d'aria H = ρ·cp·portata = 0,34 W·h/(m³·K) × m³/h.
// Parametri dei materiali e capacità termiche: valori tipici dichiarati (affidabilità C), da calibrare con le misure.

const MATERIALI_TENDA = {
  // U di un telo sottile tra due ambienti interni: 1/(Rsi + Rtelo + Rsi). Il riflettente riduce lo scambio radiativo.
  mylar: {nome: "Telo riflettente (mylar) singolo", r: 0.01, u: 1 / (0.13 + 0.01 + 0.13) * 0.9, fonte: "EN ISO 6946 (Rsi 0,13); riflettente −10% (stima)"},
  tessuto: {nome: "Tessuto non riflettente", r: 0.01, u: 1 / (0.13 + 0.01 + 0.13), fonte: "EN ISO 6946"},
  pannelli: {nome: "Pannelli isolanti 2 cm (box autocostruito)", r: 0.5, u: 1 / (0.13 + 0.5 + 0.13), fonte: "EN ISO 6946; polistirene 2 cm ≈ 0,5 m²K/W"},
};
// Locali: U di pareti, tetto, porta (W/m²K), ricambi d'aria all'ora, capacità termica efficace per m² di pavimento
// (EN ISO 13790: costruzione media ≈ 165 kJ/m²K), frazione del sole sulla superficie che entra come calore.
const LOCALI = {
  non_isolato: {nome: "Garage in muratura non isolato, porta metallica", pareti: 1.8, tetto: 2.0, porta: 5.8, pavimento: 0.5, ach: 1.0, c_m2: 165000, sole: 0.04},
  isolato: {nome: "Garage isolato o interrato", pareti: 0.45, tetto: 0.35, porta: 1.5, pavimento: 0.3, ach: 0.4, c_m2: 165000, sole: 0.02},
  // serre: sopra 25 °C si aprono le finestre (ricambio 40 volumi/ora), come fa chi la gestisce o un apri-finestra automatico.
  // "sole": frazione dell'irraggiamento sul pavimento che diventa calore sensibile; in una serra coltivata circa metà
  // dell'energia assorbita va in evapotraspirazione (calore latente), quindi ~0,35 invece di ~0,65 (stima, C)
  serra_fredda: {nome: "Serra fredda, film plastico singolo", pareti: 8.0, tetto: 8.0, porta: 8.0, pavimento: 2.0, ach: 1.5, c_m2: 60000, sole: 0.35, serra: true, apri_sopra: 25, ach_aperta: 40},
  serra_doppia: {nome: "Serra con doppio film gonfiato", pareti: 4.5, tetto: 4.5, porta: 4.5, pavimento: 2.0, ach: 0.8, c_m2: 60000, sole: 0.3, serra: true, apri_sopra: 25, ach_aperta: 40},
};
const FONTI_CLIMA = [
  "EN ISO 6946: resistenze superficiali interne Rsi = 0,13 m²K/W (flusso orizzontale).",
  "EN ISO 13790: capacità termica efficace per costruzioni di media massa ≈ 165 kJ/(m²·K) di pavimento.",
  "Serre in polietilene: U ≈ 7,5-8,5 W/m²K film singolo, 4-5 W/m²K doppio film (NSW DPIRD).",
  "Temperatura del terreno in profondità ≈ media annua dell'aria (approssimazione classica).",
  "Calore latente di evaporazione 2,45 MJ/kg: l'acqua traspirata dalle piante toglie calore sensibile all'aria.",
];
// escursione giornaliera tipica per mese (°C) quando manca il meteo vero: valori tipici dell'entroterra italiano (C)
const ESCURSIONE_MESE = [7, 8, 9, 10, 11, 12, 12, 12, 10, 8, 7, 6];

function meteoGiorno(c, d, rnd) {
  // scostamento_t_esterna: per l'analisi di sensibilità (anno più caldo o più freddo della media)
  const dt = c.scostamento_t_esterna || 0;
  const v = c.meteoReale && c.meteoReale.giorni && c.meteoReale.giorni[d];
  if (v) return {tmin: v.tmin + dt, tmax: v.tmax + dt};
  const m = meseDi(d), R = REGIONI[c.regione], t = R.t[m] + gaussDa(rnd) * 1.5 + dt, e = ESCURSIONE_MESE[m];
  return {tmin: t - e / 2, tmax: t + e / 2};
}
function tEsternaOra(g, h) { return (g.tmin + g.tmax) / 2 + (g.tmax - g.tmin) / 2 * Math.cos(2 * Math.PI * (h - 15) / 24); }
function soleOra(kwhGiorno, h, m) {
  // irraggiamento (W/m²) con profilo sinusoidale tra alba e tramonto; durata del giorno 9-15 ore secondo il mese
  const durata = 12 + 3 * Math.sin((m - 2.7) / 12 * 2 * Math.PI), alba = 12.5 - durata / 2, x = (h - alba) / durata;
  if (x <= 0 || x >= 1) return 0;
  return kwhGiorno * 1000 * Math.PI / (2 * durata) * Math.sin(Math.PI * x);
}

// geometria e parametri del sistema termico dell'impianto idroponico
function parametriClima(c, k) {
  const I = c.idro, CL = I.clima, cal = Object.assign({fUA: 1, fSole: 1}, CL.calibrazione || {});
  const Lc = Object.assign({lung: 5, larg: 3, alt: 2.4}, I.locale || {});
  const tipo = LOCALI[CL.locale_tipo || CL.garage] || LOCALI.non_isolato;
  const pav = Lc.lung * Lc.larg, pareti = 2 * (Lc.lung + Lc.larg) * Lc.alt, porta = tipo.serra ? 0 : Math.min(5, Lc.larg * 0.8 * 2.1);
  const UAinv = ((pareti - porta) * tipo.pareti + porta * tipo.porta + pav * tipo.tetto) * cal.fUA;
  const Hinf = 0.34 * tipo.ach * pav * Lc.alt * cal.fUA;
  const mat = MATERIALI_TENDA[CL.tenda_materiale || "mylar"];
  const tenda = CL.tenda ? {UA: mat.u * k.superficieTenda, Hv: 0.34 * 0.5 * k.volume, Hest: CL.estrattore ? 0.34 * (CL.estrattore_m3h || 150) : 0} : null;
  const Hapre = tipo.apri_sopra ? 0.34 * tipo.ach_aperta * pav * Lc.alt : 0;
  return {tipo, pav, UAinv, UApav: pav * tipo.pavimento, Hinf, Hapre, Cg: pav * tipo.c_m2 / 3600 /* Wh/K */, solePav: pav * tipo.sole * cal.fSole, tenda, mat, cal,
          Cw: k.serbatoio * 4.186 * 1000 / 3600 /* Wh/K */, Hw: {nft: 25, torre: 20, dwc: 8, kratky: 5, bucket: 12, ebb: 15, goccia: 10, vassoi: 4}[I.sistema] || 8};
}

// simulazione oraria (passo 10 minuti) di un anno: restituisce i valori giornalieri per il motore idroponico
const CACHE_CLIMA = new Map();
function simulaClimaIdro(c, k, opz = {}) {
  const I = c.idro, CL = I.clima, P = parametriClima(c, k), R = REGIONI[c.regione];
  const rnd = mulberry32(4242), dt = opz.passoOre || 0.5;        // ore: 30 minuti, molto meno delle costanti di tempo (ore)
  // stessi ingressi → stesso risultato: il percorso guidato prova centinaia di varianti che spesso condividono il clima
  const chiave = JSON.stringify([c.regione, c.scostamento_t_esterna || 0, c.meteoReale ? c.meteoReale.fonte + c.meteoReale.dal : "", P, CL, k.wLuci, k.ore, I.luce.notte, k.serbatoio,
    k.colture.map(x => [x.coltura, x.piante]), opz.pompaW || 0, dt]);
  if (CACHE_CLIMA.has(chiave)) return CACHE_CLIMA.get(chiave);
  if (CACHE_CLIMA.size > 300) CACHE_CLIMA.clear();
  const passi = Math.round(24 / dt), cosOra = [], soleMese = [];
  for (let s = 0; s < passi; s++) cosOra.push(Math.cos(2 * Math.PI * (s * dt - 15) / 24));
  for (let m = 0; m < 12; m++) { soleMese.push([]); for (let s = 0; s < passi; s++) soleMese[m].push(soleOra(R.sole[m], s * dt, m)); }
  const tSuolo = R.t.reduce((a, b) => a + b, 0) / 12;
  const tMaxColture = Math.min(...k.colture.map(x => x.P.t[1])), set = CL.t_min;
  const stufaW = {nessuno: 0, tappetino: 0, stufetta: 1000}[CL.riscaldamento] || 0;
  const pompaW = opz.pompaW || 0, oreLuce = k.ore, inizio = I.luce.notte ? 20 : 6;
  // calore latente: acqua traspirata durante la luce (kg/h) × 2,45 MJ/kg → W
  const trasp = k.colture.reduce((a, x) => a + x.piante * x.P.acqua * 0.6, 0);
  const latenteW = trasp / oreLuce * 2.45e6 / 3600;
  let Tg = R.t[0] + 3, Tw = Tg;
  const giorni = [], bil = {ingresso: 0, uscita: 0, accumulo: 0};
  const Tg0 = Tg, Tw0 = Tw;
  for (let d = 0; d < 365; d++) {
    const g = meteoGiorno(c, d, rnd), m = meseDi(d);
    const acc = {tg: 0, tgMin: 99, tgMax: -99, tl: 0, nl: 0, tb: 0, nb: 0, tw: 0, tMin: 99, tMax: -99, whStufa: 0, oreEst: 0, oreCaldo: 0, oreGelo: 0, te: 0};
    const tMedio = (g.tmin + g.tmax) / 2, ampiezza = (g.tmax - g.tmin) / 2, soleM = soleMese[m];
    for (let s = 0; s < passi; s++) {
      const h = s * dt, Te = tMedio + ampiezza * cosOra[s];
      const luce = ((h - inizio + 24) % 24) < oreLuce;
      // il calore latente della traspirazione si toglie da quello delle lampade, al massimo il 60% (Graamans et al. 2018:
      // nelle vertical farm gran parte dell'energia delle lampade esce come vapore); resta almeno il 40% sensibile
      const Hi = P.Hapre && Tg > P.tipo.apri_sopra ? P.Hinf + P.Hapre : P.Hinf;
      const Qlamp = luce ? Math.max(0.4 * k.wLuci, k.wLuci - latenteW) : 0;
      const Qsol = soleM[s] * P.solePav;
      let Tt, Qst = 0, est = false;
      if (P.tenda) {
        const T = P.tenda, H0 = T.UA + T.Hv;
        Tt = (Qlamp + H0 * Tg + P.Hw * Tw) / (H0 + P.Hw);
        if (stufaW && Tt < set) { Qst = Math.min(stufaW, (set - Tt) * (H0 + P.Hw)); Tt = (Qlamp + Qst + H0 * Tg + P.Hw * Tw) / (H0 + P.Hw); }
        if (T.Hest && Tt > tMaxColture - 1) { est = true; Tt = (Qlamp + Qst + (H0 + T.Hest) * Tg + P.Hw * Tw) / (H0 + T.Hest + P.Hw); }
        const Hout = T.UA + T.Hv + (est ? T.Hest : 0);
        // energia: la tenda scambia con locale e serbatoio, tutto il resto finisce nel locale
        const Qtg = Hout * (Tt - Tg), Qtw = P.Hw * (Tt - Tw);
        const Qtappetino = CL.riscaldamento === "tappetino" && Tw < 20 ? Math.min(100, (20 - Tw) * P.Cw / dt) : 0;
        const dTw = (Qtw + pompaW + Qtappetino) * dt / P.Cw;
        const Qg = Qtg + Qsol + (P.UAinv + Hi) * (Te - Tg) + P.UApav * (tSuolo - Tg);
        const dTg = Qg * dt / P.Cg;
        bil.ingresso += (Qlamp + Qst + pompaW + Qtappetino + Qsol) * dt; bil.uscita += ((P.UAinv + Hi) * (Tg - Te) + P.UApav * (Tg - tSuolo)) * dt;
        Tw += dTw; Tg += dTg;
        acc.whStufa += Qst * dt + Qtappetino * dt;
      } else {
        // senza tenda: piante nell'aria del locale; lampade e stufetta scaldano tutto il locale
        Tt = Tg;
        if (stufaW && Tg < set) Qst = Math.min(stufaW, (set - Tg) * (P.UAinv + P.Hinf + P.UApav) + P.Cg * (set - Tg) / dt * 0.2);
        const Qtw = P.Hw * (Tg - Tw);
        const Qtappetino = CL.riscaldamento === "tappetino" && Tw < 20 ? Math.min(100, (20 - Tw) * P.Cw / dt) : 0;
        const Qg = Qlamp + Qst + Qsol - Qtw + (P.UAinv + Hi) * (Te - Tg) + P.UApav * (tSuolo - Tg);
        bil.ingresso += (Qlamp + Qst + pompaW + Qtappetino + Qsol) * dt; bil.uscita += ((P.UAinv + Hi) * (Tg - Te) + P.UApav * (Tg - tSuolo)) * dt;
        Tw += (Qtw + pompaW + Qtappetino) * dt / P.Cw; Tg += Qg * dt / P.Cg;
        acc.whStufa += (Qst + Qtappetino) * dt;
      }
      acc.te += Te / (24 / dt);
      acc.tg += Tg / (24 / dt); acc.tgMin = Math.min(acc.tgMin, Tg); acc.tgMax = Math.max(acc.tgMax, Tg);
      if (luce) { acc.tl += Tt; acc.nl++; } else { acc.tb += Tt; acc.nb++; }
      acc.tw += Tw / (24 / dt); acc.tMin = Math.min(acc.tMin, Tt); acc.tMax = Math.max(acc.tMax, Tt);
      if (est) acc.oreEst += dt;
      if (Tt > tMaxColture + 2) acc.oreCaldo += dt;
      if (Tt < 1) acc.oreGelo += dt;
    }
    giorni.push({tEst: acc.te, tGarage: acc.tg, tGarageMin: acc.tgMin, tGarageMax: acc.tgMax, tLuci: acc.nl ? acc.tl / acc.nl : acc.tb / acc.nb, tBuio: acc.nb ? acc.tb / acc.nb : acc.tl / acc.nl,
                 tAcqua: acc.tw, tMinTenda: acc.tMin, tMaxTenda: acc.tMax, whStufa: acc.whStufa, oreEstrattore: acc.oreEst, oreCaldo: acc.oreCaldo, oreGelo: acc.oreGelo});
  }
  bil.accumulo = P.Cg * (Tg - Tg0) + P.Cw * (Tw - Tw0);
  const ris = {giorni, parametri: P, bilancio: bil, latenteW};
  CACHE_CLIMA.set(chiave, ris);
  return ris;
}

// Confronto di ambienti con lo stesso motore: stesse piante e lampade, involucri diversi
function confrontoAmbienti(c) {
  const varianti = [
    ["Garage non isolato, senza tenda, senza stufetta", {garage: "non_isolato", tenda: false, riscaldamento: "nessuno"}],
    ["Garage isolato, senza tenda, senza stufetta", {garage: "isolato", tenda: false, riscaldamento: "nessuno"}],
    ["Garage non isolato, tenda e stufetta", {garage: "non_isolato", tenda: true, riscaldamento: "stufetta"}],
    ["Garage isolato, tenda e stufetta", {garage: "isolato", tenda: true, riscaldamento: "stufetta"}],
    ["Serra fredda (film singolo), senza riscaldamento", {garage: "serra_fredda", tenda: false, riscaldamento: "nessuno"}],
    ["Serra con doppio film e stufetta", {garage: "serra_doppia", tenda: false, riscaldamento: "stufetta"}],
  ];
  return varianti.map(([nome, mod]) => {
    const c2 = JSON.parse(JSON.stringify(c)); Object.assign(c2.idro.clima, mod);
    const k = capacitaIdro(c2), s = simulaClimaIdro(c2, k), G = s.giorni;
    const tMax = Math.min(...k.colture.map(x => x.P.t[1])), tMin = Math.max(...k.colture.map(x => x.P.t[0]));
    return {nome, mod, tMin: Math.min(...G.map(g => g.tMinTenda)), tMax: Math.max(...G.map(g => g.tMaxTenda)),
            oreGelo: G.reduce((a, g) => a + g.oreGelo, 0), oreCaldo: G.reduce((a, g) => a + g.oreCaldo, 0),
            giorniBuoni: G.filter(g => g.tLuci <= tMax + 2 && g.tBuio >= tMin - 4).length, kwhRiscaldamento: G.reduce((a, g) => a + g.whStufa, 0) / 1000};
  });
}

// Calibrazione con le misure (CSV di Home Assistant: t_aria_min, t_aria_max della tenda o del locale): ricerca a
// griglia di due fattori (dispersioni e sole) che riducono l'errore quadratico medio. Non tocca il controllo.
// Versione semplice (tenda soltanto, meteo medio, nessun giorno di verifica): nell'interfaccia è sostituita da
// calibraAmbiente (calibrazione.js). Resta per i test e per chi la usa da riga di comando.
function calibraClima(c, misure) {
  const perData = {}; for (const m of misure || []) if (m.t_aria_min != null && m.t_aria_max != null) perData[m.data] = m;
  const date = Object.keys(perData);
  if (date.length < 7) return {ok: false, motivo: "Servono almeno 7 giorni di temperature misurate (ne hai " + date.length + ")."};
  const k = capacitaIdro(c);
  const errore = cal => {
    const c2 = JSON.parse(JSON.stringify(c)); c2.idro.clima.calibrazione = cal;
    const G = simulaClimaIdro(c2, k).giorni;
    let se = 0, n = 0;
    for (const data of date) { const g = G[giornoAnno(data)], m = perData[data];
      se += (g.tMinTenda - m.t_aria_min) ** 2 + (g.tMaxTenda - m.t_aria_max) ** 2; n += 2; }
    return Math.sqrt(se / n);
  };
  const prima = errore({fUA: 1, fSole: 1});
  let migliore = {fUA: 1, fSole: 1, rmse: prima};
  for (const fUA of [0.5, 0.7, 0.85, 1, 1.2, 1.5, 2]) for (const fSole of [0.5, 1, 1.5, 2]) {
    const e = errore({fUA, fSole}); if (e < migliore.rmse - 1e-9) migliore = {fUA, fSole, rmse: e};
  }
  return {ok: true, giorni: date.length, rmsePrima: prima, rmseDopo: migliore.rmse, fUA: migliore.fUA, fSole: migliore.fSole};
}
if (typeof module !== "undefined") module.exports = {simulaClimaIdro, confrontoAmbienti, calibraClima, parametriClima, MATERIALI_TENDA, LOCALI, FONTI_CLIMA, tEsternaOra, soleOra};
