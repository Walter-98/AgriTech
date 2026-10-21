"use strict";
// Fase 8: confronto con i raccolti veri, calibrazione versionata e ritorno indietro.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();

function cicli(c, coltura, rapporto, n) {
  // raccolti "veri" pari a rapporto × previsione del modello, in date diverse
  const reg = [];
  for (let i = 0; i < n; i++) {
    const semina = `2026-0${2 + i * 2}-01`, raccolta = `2026-0${2 + i * 2}-${30}`;
    const p = G.previsioneCiclo(c, {coltura, semina, raccolta, piante: 6}, []);
    reg.push({coltura, semina, raccolta, piante: 6, peso_g: p.pesoPrevisto * 6 * rapporto});
  }
  return reg;
}

test("con un solo ciclo non propone correzioni", () => {
  const c = config(G);
  const cf = G.confronto(c, cicli(c, "lattuga", 0.8, 1), []);
  assert.equal(cf.statistiche[0].n, 1);
  assert.equal(cf.statistiche[0].proponibile, false);
  assert.equal(G.applicaCalibrazione(c.idro, cf.statistiche), null);
});

test("raccolti veri all'80% del previsto: propone ×0,8 e l'errore scende", () => {
  const c = config(G);
  const cf = G.confronto(c, cicli(c, "lattuga", 0.8, 3), []);
  const st = cf.statistiche[0];
  assert.ok(Math.abs(st.fattore - 0.8) < 1e-9);
  assert.ok(Math.abs(st.mape - 0.25) < 1e-9);            // previsione +25% rispetto al vero
});

test("la calibrazione applicata cambia la resa simulata solo per quella coltura, e si annulla", () => {
  const c = config(G);
  const prima = G.simulaIdro(c).perColtura;
  const cf = G.confronto(c, cicli(c, "lattuga", 0.8, 2), []);
  const v = G.applicaCalibrazione(c.idro, cf.statistiche, "2026-10-21");
  assert.equal(v.versione, 1);
  const dopo = G.simulaIdro(c).perColtura;
  const kg = (l, k) => l.find(x => x.coltura === k).kg;
  assert.ok(Math.abs(kg(dopo, "lattuga") / kg(prima, "lattuga") - 0.8) < 1e-9);
  assert.ok(Math.abs(kg(dopo, "basilico") - kg(prima, "basilico")) < 1e-9);
  // una seconda calibrazione non si somma alla prima (il fattore è assoluto rispetto al modello)
  G.applicaCalibrazione(c.idro, cf.statistiche, "2026-10-22");
  assert.ok(Math.abs(G.fattoriAttivi(c.idro).lattuga - 0.8) < 1e-9);
  G.tornaIndietro(c.idro); G.tornaIndietro(c.idro);
  assert.equal(Object.keys(G.fattoriAttivi(c.idro)).length, 0);
  assert.ok(Math.abs(kg(G.simulaIdro(c).perColtura, "lattuga") - kg(prima, "lattuga")) < 1e-9);
});

test("le temperature misurate entrano nella previsione", () => {
  const c = config(G, {colture: [{coltura: "lattuga", quota: 100}]});
  const rec = {coltura: "lattuga", semina: "2026-01-05", raccolta: "2026-02-10", piante: 6, peso_g: 600};
  const freddo = [];
  for (let d = 0; d < 40; d++) freddo.push({data: new Date(Date.UTC(2026, 0, 5 + d)).toISOString().slice(0, 10), t_aria_min: 9, t_aria_max: 13});
  const conMisure = G.previsioneCiclo(c, rec, freddo), senza = G.previsioneCiclo(c, rec, []);
  assert.ok(conMisure.giorniMisurati >= 30);
  assert.ok(conMisure.pesoPrevisto < senza.pesoPrevisto);
});

test("CSV delle misure di Home Assistant", () => {
  const m = G.misureDaCsv("data,ph_medio,ec_media,t_acqua_media,t_acqua_max,t_aria_min,t_aria_max,ur_media\n2026-10-01,6.1,,21,22,18,24,60\n");
  assert.equal(m[0].data, "2026-10-01");
  assert.equal(m[0].t_aria_max, 24);
  assert.equal(m[0].ec_media, null);
});

test("energia: kWh simulati negli stessi giorni della lettura", () => {
  const c = config(G);
  const s = G.simulaIdro(c);
  const r = G.confrontoEnergia(c, [{dal: "2026-03-01", al: "2026-03-08", kwh: 30}])[0];
  const a = G.giornoAnno("2026-03-01");
  let atteso = 0; for (let i = 0; i < 7; i++) atteso += s.giorni[a + i].wh / 1000;
  assert.ok(Math.abs(r.simulati - atteso) < 1e-9);
  assert.ok(Math.abs(r.errore - (atteso - 30) / 30) < 1e-9);
});
