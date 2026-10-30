"use strict";
// Fase 3: modello di crescita e database delle fonti. Si confronta con i dati pubblicati, non solo con sé stesso.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();
const L = G.IDRO_PIANTE.lattuga, B = G.IDRO_PIANTE.basilico;
const costante = (t, dli) => () => ({tMedia: t, dli});
const pesoA = (P, giorni, t, dli, passo = 20) => { const c = G.coorte(Object.assign({}, P, {resa: 1e9}), 0, costante(t, dli), passo); return c.curva[giorni - 1]; };

test("funzione beta delle temperature cardinali: 0 alla base e alla massima, 1 all'ottimo", () => {
  assert.equal(G.fTemp(8, 8, 26, 36), 0);
  assert.equal(G.fTemp(36, 8, 26, 36), 0);
  assert.ok(Math.abs(G.fTemp(26, 8, 26, 36) - 1) < 1e-12);
  assert.ok(G.fTemp(20, 8, 26, 36) > G.fTemp(14, 8, 26, 36));
});

test("lattuga: riproduce il dato Cornell, 150 g a 35 giorni dalla semina con DLI 17 e 22,3 °C medi", () => {
  const w = pesoA(L, 35, 22.3, 17);
  assert.ok(Math.abs(w - 150) / 150 < 0.01, `${w}`);
});

test("lattuga: peso circa proporzionale alla luce tra DLI 8,6 e 17 (risposta quasi lineare)", () => {
  const r = pesoA(L, 35, 22.3, 8.6) / pesoA(L, 35, 22.3, 17);
  assert.ok(r > 0.4 && r < 0.65, `rapporto ${r}`);
});

test("lattuga: crescita massima vicino a 26 °C, più lenta a 16 °C", () => {
  assert.ok(pesoA(L, 35, 26, 17) > pesoA(L, 35, 22, 17));
  assert.ok(pesoA(L, 35, 16, 17) < 0.6 * pesoA(L, 35, 22, 17));
});

test("basilico: da DLI 7 a 15 la massa fresca cresce come nelle prove Iowa State (+144-208%, tolleranza ampia)", () => {
  const aumento = pesoA(B, 42, 23, 15) / pesoA(B, 42, 23, 7) - 1;
  assert.ok(aumento > 1.0 && aumento < 2.6, `+${Math.round(aumento * 100)}%`);
});

test("basilico: resa crescente fino a circa 30 °C, poi cala", () => {
  assert.ok(pesoA(B, 42, 30, 15) > pesoA(B, 42, 24, 15));
  assert.ok(pesoA(B, 42, 37, 15) < pesoA(B, 42, 30, 15));
});

test("nel garage senza stufetta il ciclo della lattuga dura di più in inverno che in primavera", () => {
  const s = G.simulaIdro(config(G, {clima: {riscaldamento: "nessuno"}, colture: [{coltura: "lattuga", quota: 100}]}));
  assert.ok(s.coorti.lattuga[10].giorni > s.coorti.lattuga[120].giorni);
});

test("la produzione delle colture con modello è la somma giorno per giorno", () => {
  const s = G.simulaIdro(config(G));
  const somma = s.giorni.reduce((a, g) => a + g.kg, 0);
  assert.ok(Math.abs(somma - s.kg) < 1e-6);
  assert.ok(Math.abs(s.perColtura.reduce((a, x) => a + x.kg, 0) - s.kg) < 1e-6);
});

test("VPD con la formula di Tetens: 25 °C e 60% = 1,27 kPa", () => {
  assert.ok(Math.abs(G.vpd(25, 60) - 1.267) < 0.002);
});

test("ogni dato del database ha una fonte esistente e un livello di affidabilità", () => {
  for (const r of G.DATI_COLTURE) {
    assert.ok(G.FONTI[r[4]], `fonte ${r[4]}`);
    assert.match(r[6], /^[ABCD]$/);
    assert.ok(r[0] === "tutte" || G.IDRO_PIANTE[r[0]], r[0]);
  }
});

test("acclimatazione all'ombra limitata: con pochissima luce le foglie non si allargano senza fine", () => {
  const molto = pesoA(L, 35, 22.3, 2), poco = pesoA(L, 35, 22.3, 4);
  assert.ok(molto < poco && molto > 0);
  // con il limite la crescita a DLI 2 è al massimo quella che avrebbe con foglie 1,6 volte più larghe
  assert.ok(molto / pesoA(L, 35, 22.3, 17) < 0.2);
});

test("LUE sulla luce incidente nello stesso ordine dei valori pubblicati (~0,55 g/mol nelle vertical farm)", () => {
  const r = G.lueIncidente(L, 35, 17, 22.3, 20);
  assert.ok(Math.abs(r.secco - 7) < 0.1);
  assert.ok(r.lue > 0.33 && r.lue < 0.77, String(r.lue));          // ±40% attorno a 0,55
});

test("incertezza Monte Carlo: riproducibile, quantili ordinati, probabilità tra 0 e 1", () => {
  const a = G.incertezzaIdro(config(G), 20, 7), b = G.incertezzaIdro(config(G), 20, 7);
  assert.equal(a.kg.p50, b.kg.p50);
  for (const k of ["kg", "costoKg", "margine"]) assert.ok(a[k].p10 <= a[k].p50 && a[k].p50 <= a[k].p90, k);
  assert.ok(a.probRipaga >= 0 && a.probRipaga <= 1);
  assert.ok(a.kg.p90 > a.kg.p10);
});
