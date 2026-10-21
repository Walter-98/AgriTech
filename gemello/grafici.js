"use strict";
// Utilità per il DOM e grafici SVG del gemello (linee con mirino, colonne impilate), colori dai token del tema.
// ---------- utilità ----------
const $ = id => document.getElementById(id);
const fmt = (v, d = 0) => Number(v).toLocaleString("it-IT", {minimumFractionDigits: d, maximumFractionDigits: d});
const euro = v => fmt(v, v < 10 ? 2 : 0) + " €";
const forbice = (a, b) => Math.round(a) === Math.round(b) ? euro(a) : fmt(a) + "–" + fmt(b) + " €";
function el(tag, attrs, ...figli) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === "class") e.className = attrs[k];
    else if (k === "text") e.textContent = attrs[k];
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  for (const f of figli) if (f != null) e.append(f);
  return e;
}
const NS = "http://www.w3.org/2000/svg";
function sv(tag, attrs, testo) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (testo != null) e.textContent = testo;
  return e;
}
const COLORI = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];

// ---------- grafici ----------
function scala(v0, v1, p0, p1) { return v => p0 + (v - v0) / (v1 - v0) * (p1 - p0); }
function asseY(svg, y, ticks, fmtT, x0, x1) {
  for (const t of ticks) {
    svg.append(sv("line", {x1: x0, x2: x1, y1: y(t), y2: y(t), stroke: "var(--riga)", "stroke-width": 1}));
    svg.append(sv("text", {x: x0 - 8, y: y(t) + 4, "text-anchor": "end"}, fmtT(t)));
  }
}
function lineChart(cont, o) {
  cont.replaceChildren();
  const W = o.larghezza || 960;
  const H = o.altezza || 280, sx = 48, dx = 16, top = 12, basso = 28;
  const n = o.n, x = scala(0, n - 1, sx, W - dx), y = scala(o.yMin, o.yMax, H - basso, top);
  const svg = sv("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.titolo});
  asseY(svg, y, o.ticks, o.fmt, sx, W - dx);
  for (const r of (o.riferimenti || [])) {
    svg.append(sv("line", {x1: sx, x2: W - dx, y1: y(r.v), y2: y(r.v), stroke: "var(--asse)", "stroke-width": 1}));
    svg.append(sv("text", {x: W - dx - 4, y: y(r.v) - 4, "text-anchor": "end"}, r.testo));
  }
  // tacche sull'asse X: mesi dell'anno, oppure quelle date (o.tickX = [{i, testo}])
  const tacche = o.tickX || MESI.map((t, m) => ({i: INIZIO_MESE[m] * (n - 1) / 364, testo: t}));
  tacche.forEach((t, j) => {
    const xm = x(t.i);
    if (W > 700 || j % 2 === 0) svg.append(sv("text", {x: xm + 4, y: H - 8}, t.testo));
    svg.append(sv("line", {x1: xm, x2: xm, y1: H - basso, y2: H - basso + 5, stroke: "var(--asse)", "stroke-width": 1}));
  });
  svg.append(sv("line", {x1: sx, x2: W - dx, y1: H - basso, y2: H - basso, stroke: "var(--asse)", "stroke-width": 1}));
  for (const s of o.serie) {
    let dpath = "", su = false;
    s.valori.forEach((v, i) => {
      if (v == null) { su = false; return; }
      dpath += (su ? "L" : "M") + x(i).toFixed(1) + "," + y(Math.min(o.yMax, Math.max(o.yMin, v))).toFixed(1);
      su = true;
    });
    if (s.area) {
      const chiuso = dpath + `L${x(n - 1)},${y(o.yMin)}L${x(0)},${y(o.yMin)}Z`;
      svg.append(sv("path", {d: chiuso, fill: s.colore, "fill-opacity": 0.1, stroke: "none"}));
    }
    svg.append(sv("path", {d: dpath, fill: "none", stroke: s.colore, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"}));
  }
  const croce = sv("line", {y1: top, y2: H - basso, stroke: "var(--muted)", "stroke-width": 1, opacity: 0});
  svg.append(croce);
  const punti = o.serie.map(s => { const c = sv("circle", {r: 4, fill: s.colore, stroke: "var(--carta)", "stroke-width": 2, opacity: 0}); svg.append(c); return c; });
  const hit = sv("rect", {x: sx, y: top, width: W - dx - sx, height: H - basso - top, fill: "transparent", tabindex: 0});
  svg.append(hit);
  const tip = el("div", {class: "tip", hidden: ""});
  cont.append(svg, tip);
  function mostra(i) {
    const xi = x(i);
    croce.setAttribute("x1", xi); croce.setAttribute("x2", xi); croce.setAttribute("opacity", 1);
    tip.replaceChildren(el("div", {class: "etichetta", text: o.etichettaX(i)}));
    o.serie.forEach((s, k) => {
      const v = s.valori[i];
      if (v == null) { punti[k].setAttribute("opacity", 0); return; }
      punti[k].setAttribute("cx", xi); punti[k].setAttribute("cy", y(Math.min(o.yMax, Math.max(o.yMin, v)))); punti[k].setAttribute("opacity", 1);
      tip.append(el("div", {class: "r"}, el("span", null, el("i", {class: "k", style: `background:${s.colore}`}), document.createTextNode(s.nome)), el("b", {text: o.fmtTip(v)})));
    });
    tip.hidden = false;
    const larg = cont.clientWidth, px = xi / W * larg;
    tip.style.left = Math.min(Math.max(0, px + 12), larg - tip.offsetWidth - 4) + "px";
    tip.style.top = "8px";
  }
  function nascondi() { tip.hidden = true; croce.setAttribute("opacity", 0); punti.forEach(p => p.setAttribute("opacity", 0)); }
  let attuale = Math.round(n / 2);
  hit.addEventListener("pointermove", e => {
    const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W;
    attuale = Math.max(0, Math.min(n - 1, Math.round((vx - sx) / (W - dx - sx) * (n - 1)))); mostra(attuale);
  });
  hit.addEventListener("pointerleave", nascondi);
  hit.addEventListener("focus", () => mostra(attuale));
  hit.addEventListener("blur", nascondi);
  hit.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { attuale = Math.min(n - 1, attuale + 7); mostra(attuale); e.preventDefault(); }
    if (e.key === "ArrowLeft") { attuale = Math.max(0, attuale - 7); mostra(attuale); e.preventDefault(); }
  });
}
function barChart(cont, o) {
  cont.replaceChildren();
  const W = o.larghezza || 960;
  const H = o.altezza || 240, sx = 52, dx = 12, top = 16, basso = 26;
  const cats = o.categorie, nc = cats.length;
  const tot = cats.map((_, i) => o.serie.reduce((a, s) => a + s.valori[i], 0));
  const max = o.yMax || Math.max(1, ...tot);
  const ticks = niceTicks(max), yMax = ticks[ticks.length - 1];
  const y = scala(0, yMax, H - basso, top);
  const banda = (W - sx - dx) / nc, larg = Math.min(24 * (o.largo || 1.6), banda * 0.6);
  const svg = sv("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.titolo});
  asseY(svg, y, ticks, o.fmt, sx, W - dx);
  const tip = el("div", {class: "tip", hidden: ""});
  cats.forEach((c, i) => {
    const xc = sx + banda * i + banda / 2;
    if (banda > 30 || i % 2 === 0) svg.append(sv("text", {x: xc, y: H - 8, "text-anchor": "middle"}, c));
    let base = 0;
    const visibili = o.serie.map((s, k) => ({s, k, v: s.valori[i]})).filter(q => q.v > 0);
    visibili.forEach((q, j) => {
      const y0 = y(base), y1 = y(base + q.v);
      const alto = j === visibili.length - 1;
      const h = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0));
      const yb = y0 - (j > 0 ? 2 : 0);
      const r = alto ? Math.min(4, h) : 0, xl = xc - larg / 2;
      const d = `M${xl},${yb}L${xl},${yb - h + r}Q${xl},${yb - h} ${xl + r},${yb - h}L${xl + larg - r},${yb - h}Q${xl + larg},${yb - h} ${xl + larg},${yb - h + r}L${xl + larg},${yb}Z`;
      svg.append(sv("path", {d, fill: q.s.colore}));
      base += q.v;
    });
    const area = sv("rect", {x: sx + banda * i, y: top, width: banda, height: H - basso - top, fill: "transparent", tabindex: 0});
    const mostra = () => {
      tip.replaceChildren(el("div", {class: "etichetta", text: o.etichetteLunghe ? o.etichetteLunghe[i] : c}));
      o.serie.forEach(s => tip.append(el("div", {class: "r"}, el("span", null, el("i", {class: "k", style: `background:${s.colore}`}), document.createTextNode(s.nome)), el("b", {text: o.fmtTip(s.valori[i])}))));
      if (o.serie.length > 1) tip.append(el("div", {class: "r"}, el("span", {text: "Totale"}), el("b", {text: o.fmtTip(tot[i])})));
      tip.hidden = false;
      const lw = cont.clientWidth, px = xc / W * lw;
      tip.style.left = Math.min(Math.max(0, px + 14), lw - tip.offsetWidth - 4) + "px"; tip.style.top = "8px";
    };
    area.addEventListener("pointerenter", mostra); area.addEventListener("focus", mostra);
    area.addEventListener("pointerleave", () => tip.hidden = true); area.addEventListener("blur", () => tip.hidden = true);
    svg.append(area);
  });
  svg.append(sv("line", {x1: sx, x2: W - dx, y1: H - basso, y2: H - basso, stroke: "var(--asse)", "stroke-width": 1}));
  cont.append(svg, tip);
}
function niceTicks(max) {
  const passo0 = max / 4, mag = Math.pow(10, Math.floor(Math.log10(passo0)));
  const passo = [1, 2, 2.5, 5, 10].map(f => f * mag).find(p => p >= passo0);
  const t = []; for (let v = 0; v <= max + passo * 0.999; v += passo) t.push(+v.toFixed(6));
  return t;
}
const compatto = v => v >= 1000 ? fmt(v / 1000, v % 1000 ? 1 : 0) + "K" : fmt(v);
function legenda(cont, voci, box) {
  cont.replaceChildren(...voci.map(v => el("span", null, el("i", {class: box ? "box" : "", style: `background:${v.colore}`}), document.createTextNode(v.nome))));
}

