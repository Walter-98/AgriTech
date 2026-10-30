"use strict";
// Nel browser tutti gli script condividono lo stesso spazio di nomi: due "const"/"function"
// con lo stesso nome a livello alto bloccano l'intera pagina. Qui li cerchiamo in anticipo.
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "..", "gemello");
test("nessun nome duplicato a livello alto tra gli script della pagina", () => {
  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  const script = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(f => !/^https?:/.test(f));
  assert.ok(script.length >= 10);
  const visti = {}, doppi = [];
  for (const f of script) for (const m of fs.readFileSync(path.join(DIR, f), "utf8").matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (visti[m[1]] && visti[m[1]] !== f) doppi.push(m[1] + " (" + visti[m[1]] + ", " + f + ")");
    visti[m[1]] = visti[m[1]] || f;
  }
  assert.deepStrictEqual(doppi, []);
});
