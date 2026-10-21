"use strict";
// Fase 5: struttura parametrica collegata a distinta, tenda, locale e consumi.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();
const conMisure = (lung, prof, extra = {}) => config(G, Object.assign({struttura: {lung_cm: lung, prof_cm: prof, h_piano_cm: 45}, superficie_piano: lung * prof / 10000}, extra));
const voce = (c, testo) => G.materialiIdro(c).find(v => v.nome.includes(testo));

test("ripiano più lungo: canali più lunghi, più piante, distinta e prezzo aggiornati", () => {
  const corto = conMisure(120, 60), lungo = conMisure(180, 60);
  const hc = G.idraulicaIdro(corto), hl = G.idraulicaIdro(lungo);
  assert.equal(hl.lungCanale, 1.8);
  assert.ok(G.capacitaIdro(lungo).piante > G.capacitaIdro(corto).piante);
  assert.match(voce(lungo, "Canali NFT").nome, /1\.8 m/);
  assert.ok(voce(lungo, "Canali NFT").max > voce(corto, "Canali NFT").max);
  assert.ok(G.somma(G.materialiIdro(lungo), "max") > G.somma(G.materialiIdro(corto), "max"));
  assert.match(voce(lungo, "Scaffale").nome, /180×60 cm/);
});

test("ripiano più profondo: più canali per piano", () => {
  assert.ok(G.idraulicaIdro(conMisure(120, 90)).canali > G.idraulicaIdro(conMisure(120, 60)).canali);
});

test("la tenda scelta contiene l'impianto con 5 cm di margine ed è la più piccola possibile", () => {
  for (const [l, p] of [[60, 50], [120, 60], [100, 100], [140, 110], [200, 100]]) {
    const m = G.misureImpianto(conMisure(l, p).idro), t = G.sceltaTenda(m);
    const entra = (t.lung >= m.lung + 0.049 && t.prof >= m.prof + 0.049) || (t.prof >= m.lung + 0.049 && t.lung >= m.prof + 0.049);
    assert.ok(entra && t.alt >= m.alt, `${l}×${p} in ${t.nome}`);
    const piuPiccole = G.TENDE.filter(x => x[0] * x[1] < t.lung * t.prof * 1e4);
    for (const x of piuPiccole) assert.ok(!((x[0] / 100 >= m.lung + 0.049 && x[1] / 100 >= m.prof + 0.049 || x[1] / 100 >= m.lung + 0.049 && x[0] / 100 >= m.prof + 0.049) && x[2] / 100 >= m.alt - 0.001), `${x} sarebbe bastata`);
  }
});

test("tenda più grande = più superficie che disperde calore = più corrente per la stufetta (a parità di lampade)", () => {
  const luce = {luce: {tipo: "led_qb", ppfd: 0, ore: 0, notte: true, w_installati: 250, distanza_cm: 35}};
  const piccolo = G.simulaIdro(conMisure(110, 60, luce)), grande = G.simulaIdro(conMisure(220, 100, luce));
  assert.ok(grande.k.superficieTenda > piccolo.k.superficieTenda);
  assert.ok(grande.kwhClima > piccolo.kwhClima);
});

test("scaffale troppo alto per la tenda o per il locale: avviso critico", () => {
  const alto = conMisure(120, 60, {piani: 5, struttura: {lung_cm: 120, prof_cm: 60, h_piano_cm: 60}});
  const msg = G.compatibilitaIdro(alto).map(m => m.titolo).join(" | ");
  assert.match(msg, /non entra/i);
});

test("locale troppo stretto: l'impianto non entra e lo dice", () => {
  const c = conMisure(120, 60, {locale: {lung: 2, larg: 1.2, alt: 2.4, auto: true}});
  const p = G.posizionaImpianto(c);
  assert.equal(p.entra, false);
  assert.ok(p.motivo.length > 0);
  const ok = G.posizionaImpianto(conMisure(120, 60, {locale: {lung: 5, larg: 3, alt: 2.4, auto: true}}));
  assert.equal(ok.entra, true);
});

test("le lunghezze dei tubi seguono le misure", () => {
  const corto = voce(conMisure(120, 60), "Tubo di mandata"), lungo = voce(conMisure(240, 60), "Tubo di mandata");
  const m = s => +s.nome.match(/16 mm \((\d+) m\)/)[1];
  assert.ok(m(lungo) > m(corto));
});
