"use strict";
// Fase 10: documenti di progetto e regole per vendere.
const test = require("node:test"), assert = require("node:assert/strict");
const {carica, config} = require("./carica");
const G = carica();

test("versione della configurazione: stabile, cambia se cambia il progetto", () => {
  const a = config(G), b = config(G), c = config(G, {piani: 2});
  assert.equal(G.versioneConfig(a), G.versioneConfig(b));
  assert.notEqual(G.versioneConfig(a), G.versioneConfig(c));
  assert.match(G.versioneConfig(a), /^[0-9a-f]{8}$/);
});

test("calendario: i trapianti a settimana tengono pieni i posti", () => {
  const c = config(G), s = G.simulaIdro(c), cal = G.calendarioIdro(c, s);
  assert.equal(cal.length, 12 * s.perColtura.length);
  for (const x of s.perColtura) {
    const r = cal.find(r => r.coltura === x.coltura);
    const attesi = x.piante * 7 / (x.giorniCiclo + 2);
    assert.ok(r.trapiantoSettimana >= attesi && r.trapiantoSettimana < attesi + 1, `${x.coltura} ${r.trapiantoSettimana} contro ${attesi}`);
    assert.ok(r.seminaSettimana >= r.trapiantoSettimana);
  }
});

test("piano di montaggio e di collaudo seguono il progetto", () => {
  const nft = G.pianoMontaggio(config(G)), kr = G.pianoMontaggio(config(G, {sistema: "kratky", auto: {micro: "nessuno", perdita: false}}));
  assert.ok(nft.some(p => /Canali NFT/.test(p[0])));
  assert.ok(!kr.some(p => /Canali NFT|Pompa/.test(p[0])));
  assert.ok(kr.some(p => /Timer/.test(p[0])));
  const col = G.pianoCollaudo(config(G));
  assert.ok(col.some(p => /perdita/i.test(p[0])) && col.some(p => /ombra/i.test(p[0])));
  assert.ok(!G.pianoCollaudo(config(G, {sistema: "kratky", auto: {micro: "nessuno"}})).some(p => /Dosatori/.test(p[0])));
});

test("ipotesi, limiti e regole per vendere sono sempre dichiarati", () => {
  const ip = G.ipotesiELimiti(config(G));
  assert.ok(ip.some(t => /Prezzi/.test(t)) && ip.some(t => /elettricista/.test(t)));
  for (const n of G.NORMATIVA) assert.ok(n.tema && n.testo && n.verifica);
  assert.ok(G.NORMATIVA.some(n => /210\/2013/.test(n.testo)));
  assert.ok(G.NORMATIVA.some(n => /228\/2001/.test(n.testo)));
});

test("l'impronta del progetto non dipende dall'ordine delle chiavi (stesso progetto dopo salva e riapri)", () => {
  const a = {idro: {sistema: "nft", luce: {tipo: "led", w: 100}, colture: [{coltura: "lattuga", quota: 100}]}};
  const b = {idro: {colture: [{quota: 100, coltura: "lattuga"}], luce: {w: 100, tipo: "led"}, sistema: "nft"}};
  assert.strictEqual(G.versioneConfig(a), G.versioneConfig(b));
  assert.notStrictEqual(G.versioneConfig(a), G.versioneConfig({idro: {sistema: "dwc", luce: {tipo: "led", w: 100}, colture: []}}));
});
