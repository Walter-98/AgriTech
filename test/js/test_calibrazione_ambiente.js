"use strict";
// Calibrazione ambiente: un garage "vero" con parametri nascosti (fUA 1,4, fSole 0,5) genera le misure; la procedura
// deve ritrovarli, controllarli su giorni mai usati per calibrare e non dichiarare validato quello che non lo è.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();
const VERO = {fUA: 1.4, fSole: 0.5};

function misureSintetiche(c, giorni, opz = {}) {
  const k = G.capacitaIdro(c), out = [];
  let x = 12345;
  const rumore = () => { x = (x * 1103515245 + 12345) % 2147483648; return (x / 2147483648 - 0.5) * 2 * (opz.rumore ?? 0.3); };
  for (let d = 0; d < giorni; d++) {
    const data = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
    out.push({data, t_est_min: 4 + 3 * Math.sin(d / 3), t_est_max: 13 + 4 * Math.sin(d / 4)});
  }
  const G2 = G.simulaClimaIdro(G.climaConMisure(c, out, VERO), k, {passoOre: 1}).giorni;
  for (const m of out) { const g = G2[G.giornoAnno(m.data)];
    Object.assign(m, {t_tenda_min: g.tMinTenda + rumore(), t_tenda_max: g.tMaxTenda + rumore(), t_garage_min: g.tGarageMin + rumore(),
                      t_garage_max: g.tGarageMax + rumore(), t_acqua: g.tAcqua + rumore()}); }
  return out;
}
const cfg = () => { const c = config(G); c.idro.clima.riscaldamento = "nessuno"; return c; };

test("ritrova i parametri nascosti e li verifica su giorni indipendenti", () => {
  const c = cfg(), r = G.calibraAmbiente(c, misureSintetiche(c, 22));
  assert.equal(r.stato, "verificato");
  assert.ok(r.verifica.giorni >= 7);
  assert.ok(r.intervallo.fUA[0] <= VERO.fUA && VERO.fUA <= r.intervallo.fUA[1], "fUA vero fuori dall'intervallo " + r.intervallo.fUA);
  assert.ok(r.intervallo.fSole[0] <= VERO.fSole && VERO.fSole <= r.intervallo.fSole[1], "fSole vero fuori dall'intervallo " + r.intervallo.fSole);
  assert.ok(r.verifica.rmseDopo < r.verifica.rmsePrima, "la calibrazione deve migliorare anche i giorni di verifica");
  assert.ok(r.verifica.rmseDopo < 1, "errore di verifica " + r.verifica.rmseDopo);
  for (const k of ["mae", "rmse", "bias", "max"]) assert.ok(isFinite(r.verifica.variabili[0].dopo[k]), k);
  assert.ok(r.verifica.giorno.n > 0 && r.verifica.notte.n > 0, "servono le differenze giorno/notte");
});

test("i giorni di verifica non entrano nella calibrazione", () => {
  const c = cfg(), m = misureSintetiche(c, 22), a = G.calibraAmbiente(c, m);
  const guaste = m.map((x, i) => i >= Math.ceil((m.length - 1) * 0.6) + 1 ? Object.assign({}, x, {t_tenda_max: x.t_tenda_max + 15}) : x);
  const b = G.calibraAmbiente(c, guaste);
  assert.deepEqual(b.parametri, a.parametri, "parametri cambiati da misure che dovevano servire solo a verificare");
  assert.ok(b.verifica.rmseDopo > a.verifica.rmseDopo + 3, "la verifica deve accorgersi delle misure diverse");
  assert.equal(b.verifica.giudizio, "insufficiente");
});

test("pochi dati: calibrato ma non validato, oppure dati insufficienti", () => {
  const c = cfg();
  const r10 = G.calibraAmbiente(c, misureSintetiche(c, 11));
  assert.equal(r10.stato, "calibrato_non_validato");
  assert.equal(r10.verifica, undefined);
  assert.match(r10.messaggio, /NON è validato/);
  assert.equal(G.calibraAmbiente(c, misureSintetiche(c, 5)).stato, "dati_insufficienti");
});

test("esclude i giorni con la porta aperta, senza temperatura esterna e il primo della serie", () => {
  const c = cfg(), m = misureSintetiche(c, 10);
  m[4].porta_aperture = 3; delete m[6].t_est_min;
  const {utili, esclusi} = G.giorniUtiliAmbiente(m);
  assert.equal(utili.length, 10 - 3 - 1);       // il giorno dopo quello senza esterno è il primo di una nuova serie
  assert.ok(esclusi.some(e => /porta/.test(e.motivo)) && esclusi.some(e => /esterna/.test(e.motivo)) && esclusi.some(e => /primo/.test(e.motivo)));
});

test("CSV giornaliero (anche con i nomi di storico_ha.py) e CSV orario riassunto per giorno", () => {
  const c = cfg();
  const g = G.misureAmbienteDaCsv("data;t_aria_min;t_aria_max;t_acqua_media;t_est_min;t_est_max\n2026-11-02;15,5;24;19;5;12\n2026-11-03;16;25;;6;13", c);
  assert.equal(g.length, 2);
  // Excel in italiano: punto e virgola e virgola dei decimali
  assert.equal(g[0].t_tenda_min, 15.5); assert.equal(g[1].t_tenda_max, 25); assert.equal(g[1].t_acqua, undefined); assert.equal(g[0].t_est_min, 5);
  let csv = "data,ora,t_est,t_garage,t_tenda,t_acqua,ventilazione,w,porta\n";
  for (let h = 0; h < 24; h++) csv += "2026-11-02," + h + "," + (5 + h % 12) + ",10," + (h >= 6 && h < 22 ? 24 : 16) + ",19," + (h === 12 ? 1 : 0) + ",250," + (h === 8 ? 1 : 0) + "\n";
  const o = G.misureAmbienteDaCsv(csv, c);
  assert.equal(o.length, 1);
  assert.equal(o[0].t_tenda_min, 16); assert.equal(o[0].t_tenda_max, 24); assert.equal(o[0].t_est_min, 5); assert.equal(o[0].t_est_max, 16);
  assert.equal(o[0].ventilazione_ore, 1); assert.equal(o[0].porta_aperture, 1); assert.ok(Math.abs(o[0].kwh - 6) < 1e-9);
  assert.ok(isFinite(o[0].t_tenda_luci) && isFinite(o[0].t_tenda_buio));
  assert.match(G.csvModelloAmbiente(), /^data,t_est_min,t_est_max/);
});

test("una misura corretta cambia il risultato (niente risultati vecchi dalla cache del clima)", () => {
  const c = cfg(), m = misureSintetiche(c, 12), a = G.calibraAmbiente(c, m);
  const m2 = m.map(x => Object.assign({}, x, {t_est_min: x.t_est_min - 6, t_est_max: x.t_est_max - 6}));
  const b = G.calibraAmbiente(c, m2);
  assert.notEqual(a.calibrazione.rmsePrima, b.calibrazione.rmsePrima);
});
