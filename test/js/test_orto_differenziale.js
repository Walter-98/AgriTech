"use strict";
// Confronto differenziale Python ↔ browser per il motore dell'orto (contratto generato da sistema/differenziale.py).
// Tolleranze: eventi della pompa e allarmi IDENTICI (stesso minuto, stessa zona): le due traduzioni fanno le stesse
// operazioni in virgola mobile a 64 bit nello stesso ordine. Sui numeri (litri, umidità) 1e-9 relativo: l'unica fonte
// di scarto è Math.sin del browser contro la libm del sistema (ultima cifra), che non deve spostare nessuna decisione.
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const {carica} = require("./carica.js");
const G = carica();
const C = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "contratti", "irrigazione.json"), "utf8"));
const vicino = (a, b, msg) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), msg + ": " + a + " contro " + b);

for (const caso of C.casi) {
  test("orto, stesso comportamento di Python: " + caso.nome, () => {
    const r = G.eseguiCasoOrto(JSON.parse(JSON.stringify(caso))), a = caso.atteso;
    assert.strictEqual(JSON.stringify(r.eventi_pompa), JSON.stringify(a.eventi_pompa), "eventi della pompa");
    assert.strictEqual(JSON.stringify(r.allarmi), JSON.stringify(a.allarmi), "allarmi");
    assert.strictEqual(r.giorni.length, a.giorni.length);
    r.giorni.forEach((g, d) => {
      vicino(g.litri, a.giorni[d].litri, "litri giorno " + d);
      vicino(g.serbatoio, a.giorni[d].serbatoio, "serbatoio giorno " + d);
      g.umidita.forEach((u, i) => vicino(u, a.giorni[d].umidita[i], "umidità zona " + i + " giorno " + d));
      g.zone.forEach((v, i) => v.forEach((x, k) => vicino(x, a.giorni[d].zone[i][k], "zona " + i + " voce " + k + " giorno " + d)));
    });
    for (const k of ["litri", "persi", "dispersi", "pompa_minuti", "troppo_pieno"]) vicino(r.totali[k], a.totali[k], k);
    assert.deepStrictEqual([...r.totali.ore_stress], a.totali.ore_stress);
    assert.deepStrictEqual([...r.totali.ore_ristagno], a.totali.ore_ristagno);
  });
}

test("orto: la sola logica di controllo dà le stesse decisioni sulle letture rumorose registrate dal Python", () => {
  const ctrl = new G.Controllore(2, {});
  let diverse = 0;
  C.replay.forEach((r, m) => {
    const [adc, basso, litri, temp, prevista, piove, flusso, pompa, zona, allarmi] = r;
    const out = ctrl.passo({minuto: m, adc, serbatoio_basso: basso, serbatoio_l: litri, temp_c: temp, pioggia_prevista_mm: prevista,
                            pioggia_in_corso: piove, flusso_l_min: flusso});
    if (out.pompa !== pompa || (pompa && out.valvole.indexOf(true) !== zona) || out.allarmi.join() !== allarmi.join()) diverse++;
  });
  assert.strictEqual(diverse, 0);
  assert.ok(C.replay.some(r => r[7]), "nel replay la pompa deve partire almeno una volta");
});
