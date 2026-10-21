"use strict";
// Vista 3D del gemello: tutto in metri, scala reale. three.js r128 (UMD).
// Luce fisica (ACES, sRGB, riflessi dal cielo), texture generate al volo, piante a foglie istanziate per specie.

const Vista3D = (() => {
  const box = document.getElementById("scena");
  if (!window.THREE) {
    const nota = document.createElement("div");
    nota.className = "scena-nota";
    nota.textContent = "La vista 3D ha bisogno di internet per caricare la libreria three.js. Il resto del gemello funziona lo stesso.";
    box.append(nota);
    return null;
  }
  const T = THREE;
  const renderer = new T.WebGLRenderer({antialias: true, powerPreference: "high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  box.append(renderer.domElement);
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const scena = new T.Scene();
  const camera = new T.PerspectiveCamera(38, 1, 0.05, 300);
  const controlli = new T.OrbitControls(camera, renderer.domElement);
  Object.assign(controlli, {enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.52, minDistance: 0.6, maxDistance: 40});

  // ---------- colori, materiali, texture ----------
  const col = h => new T.Color(h).convertSRGBToLinear();
  const mat = (h, o) => new T.MeshStandardMaterial(Object.assign({color: col(h), roughness: 0.8, metalness: 0}, o || {}));
  const fisico = (h, o) => new T.MeshPhysicalMaterial(Object.assign({color: col(h), roughness: 0.4, metalness: 0}, o || {}));
  function texCanvas(dim, disegna, ripeti, srgb = true) {
    const c = document.createElement("canvas"); c.width = c.height = dim;
    disegna(c.getContext("2d"), dim);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; if (ripeti) t.repeat.set(ripeti, ripeti);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.anisotropy = ANISO;
    return t;
  }
  const rndT = mulberry32(99);
  const macchie = (g, dim, n, colori, rMin, rMax, alfa) => {
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alfa * (0.5 + rndT() * 0.5); g.fillStyle = colori[Math.floor(rndT() * colori.length)];
      const r = rMin + rndT() * (rMax - rMin), x = rndT() * dim, y = rndT() * dim;
      g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rndT() * 0.6), rndT() * 3, 0, 7); g.fill();
      if (x < r) { g.beginPath(); g.ellipse(x + dim, y, r, r, 0, 0, 7); g.fill(); }
      if (y < r) { g.beginPath(); g.ellipse(x, y + dim, r, r, 0, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
  };
  const TEX = {};
  function texture() {
    TEX.prato = texCanvas(512, (g, d) => {
      g.fillStyle = "#4f6d2c"; g.fillRect(0, 0, d, d);
      macchie(g, d, 260, ["#5a7a33", "#46622a", "#6a8a3c", "#3f5a25"], 8, 30, 0.35);
      for (let i = 0; i < 9000; i++) { g.strokeStyle = ["#6f9441", "#5b7f35", "#7fa34c", "#46662a", "#8aa957"][i % 5]; g.globalAlpha = 0.55; g.lineWidth = 1;
        const x = rndT() * d, y = rndT() * d; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rndT() - 0.5) * 3, y - 3 - rndT() * 6); g.stroke(); }
      g.globalAlpha = 1;
    }, 40);
    TEX.terra = texCanvas(512, (g, d) => {
      g.fillStyle = "#7a5a3c"; g.fillRect(0, 0, d, d);
      macchie(g, d, 900, ["#6b4d32", "#86664a", "#5e432b", "#8f7052"], 2, 10, 0.5);
      macchie(g, d, 300, ["#3f2c1c", "#a08566", "#b49a7d"], 1, 3, 0.7);
    }, 1);
    TEX.ghiaia = texCanvas(512, (g, d) => {
      g.fillStyle = "#7d7465"; g.fillRect(0, 0, d, d);
      macchie(g, d, 2600, ["#6b6252", "#938a77", "#5c5445", "#a39a86", "#776f60"], 2, 5, 0.8);
    }, 12);
    TEX.legno = texCanvas(512, (g, d) => {
      g.fillStyle = "#8e6a45"; g.fillRect(0, 0, d, d);
      for (let y = 0; y < d; y += 2) { g.globalAlpha = 0.25; g.fillStyle = (y / 2) % 3 ? "#7a5a39" : "#a07a52"; g.fillRect(0, y + Math.sin(y * 0.11) * 2, d, 1); }
      g.globalAlpha = 0.35; g.fillStyle = "#5e4127";
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(rndT() * d, rndT() * d, 10, 4, 0, 0, 7); g.fill(); }
      g.globalAlpha = 0.6; g.fillStyle = "#4a321c"; g.fillRect(0, d / 2 - 1, d, 2); g.globalAlpha = 1;
    }, 1);
    TEX.intonaco = texCanvas(512, (g, d) => {
      g.fillStyle = "#e7e0d2"; g.fillRect(0, 0, d, d);
      macchie(g, d, 1800, ["#ddd5c5", "#efe9dd", "#d6cdbb"], 1, 4, 0.5);
    }, 4);
    TEX.coppi = texCanvas(256, (g, d) => {
      g.fillStyle = "#a5502f"; g.fillRect(0, 0, d, d);
      for (let y = 0; y < d; y += 32) for (let x = 0; x < d; x += 32) {
        const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, "#7d3a22"); gr.addColorStop(0.5, "#c0663e"); gr.addColorStop(1, "#7d3a22");
        g.fillStyle = gr; g.fillRect(x, y, 32, 30); g.fillStyle = "#5b2a18"; g.fillRect(x, y + 28, 32, 4);
      }
    }, 1);
    TEX.cemento = texCanvas(512, (g, d) => {
      g.fillStyle = "#8f8e88"; g.fillRect(0, 0, d, d);
      macchie(g, d, 1500, ["#85847e", "#9a9993", "#7c7b75", "#a3a29c"], 3, 14, 0.25);
      macchie(g, d, 8, ["#6f6e68"], 30, 70, 0.12);
    }, 6);
    TEX.blocchi = texCanvas(512, (g, d) => {
      g.fillStyle = "#a9a7a0"; g.fillRect(0, 0, d, d);
      macchie(g, d, 1200, ["#9e9c95", "#b4b2ab", "#93918a"], 2, 6, 0.4);
      g.strokeStyle = "#7d7b75"; g.lineWidth = 4;
      for (let y = 0; y <= d; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(d, y); g.stroke();
        for (let x = (y / 64) % 2 ? 64 : 0; x < d; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } }
    }, 2);
    TEX.paglia = texCanvas(256, (g, d) => {
      g.fillStyle = "#b8995a"; g.fillRect(0, 0, d, d);
      for (let i = 0; i < 1400; i++) { g.strokeStyle = ["#d8bd7c", "#a3843f", "#c9ad6a", "#8e7238"][i % 4]; g.lineWidth = 1.5; g.globalAlpha = 0.8;
        const x = rndT() * d, y = rndT() * d, a = rndT() * 3.14, l = 6 + rndT() * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      g.globalAlpha = 1;
    }, 1);
    TEX.celle = texCanvas(256, (g, d) => {
      g.fillStyle = "#c9ced4"; g.fillRect(0, 0, d, d);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) {
        const gr = g.createLinearGradient(0, y * 42, 0, y * 42 + 40); gr.addColorStop(0, "#1b2b4f"); gr.addColorStop(1, "#0f1a33");
        g.fillStyle = gr; g.fillRect(x * 64 + 3, y * 42 + 3, 58, 38);
        g.strokeStyle = "#48597a"; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x * 64 + 3 + k * 14.5, y * 42 + 3); g.lineTo(x * 64 + 3 + k * 14.5, y * 42 + 41); g.stroke(); }
      }
    }, 1);
    TEX.parquet = texCanvas(512, (g, d) => {
      for (let y = 0; y < d; y += 32) for (let x = 0; x < d; x += 128) {
        const o = (y / 32) % 2 ? 64 : 0; g.fillStyle = ["#a4794c", "#93693e", "#b38758", "#8a6139"][(x + y) / 32 % 4];
        g.fillRect((x + o) % d, y, 126, 30); if ((x + o) % d + 126 > d) g.fillRect(0, y, (x + o) % d + 126 - d, 30);
      }
      macchie(g, d, 600, ["#6d4a28", "#c09466"], 1, 3, 0.3);
    }, 3);
    TEX.mylar = texCanvas(256, (g, d) => {
      g.fillStyle = "#d9dcdf"; g.fillRect(0, 0, d, d);
      for (let i = 0; i < 40; i++) { g.strokeStyle = rndT() > 0.5 ? "#f3f5f7" : "#b8bcc0"; g.globalAlpha = 0.5; g.lineWidth = 2 + rndT() * 6;
        const x = rndT() * d; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 20, d / 3, x - 20, d * 2 / 3, x + 5, d); g.stroke(); }
      g.globalAlpha = 1;
    }, 1);
    TEX.portone = texCanvas(256, (g, d) => {
      g.fillStyle = "#d8d6d0"; g.fillRect(0, 0, d, d);
      for (let y = 0; y < d; y += 64) { g.fillStyle = "#b9b7b1"; g.fillRect(0, y + 60, d, 4); g.fillStyle = "#e6e4de"; g.fillRect(0, y + 4, d, 6); }
    }, 1);
    // foglie (con trasparenza)
    TEX.foglie = {};
    const foglia = (nome, disegna) => { TEX.foglie[nome] = texCanvas(256, (g, d) => { g.clearRect(0, 0, d, d); disegna(g, d); }, 0); TEX.foglie[nome].wrapS = TEX.foglie[nome].wrapT = T.ClampToEdgeWrapping; };
    const riempi = (g, d, path, c1, c2, vene) => {
      const gr = g.createLinearGradient(0, d, 0, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.beginPath(); path(g); g.fill();
      g.save(); g.clip();
      g.strokeStyle = "rgba(255,255,240,0.45)"; g.lineWidth = 4; g.beginPath(); g.moveTo(d / 2, d); g.lineTo(d / 2, d * 0.06); g.stroke();
      if (vene) { g.lineWidth = 1.5; g.strokeStyle = "rgba(255,255,230,0.25)";
        for (let k = 1; k < 7; k++) { const y = d - k * d * 0.13; g.beginPath(); g.moveTo(d / 2, y); g.lineTo(d * 0.15, y - d * 0.12); g.moveTo(d / 2, y); g.lineTo(d * 0.85, y - d * 0.12); g.stroke(); } }
      g.restore();
    };
    foglia("ovale", (g, d) => riempi(g, d, p => { p.moveTo(d / 2, d); p.bezierCurveTo(d * 0.02, d * 0.7, d * 0.12, d * 0.15, d / 2, 2); p.bezierCurveTo(d * 0.88, d * 0.15, d * 0.98, d * 0.7, d / 2, d); }, "#2f6b25", "#5da13f", true));
    foglia("seghettata", (g, d) => riempi(g, d, p => { p.moveTo(d / 2, d);
      for (let k = 0; k <= 10; k++) { const t = k / 10, y = d - t * d, w = Math.sin(t * Math.PI) * d * 0.36 * (1 - t * 0.2); p.lineTo(d / 2 - w - (k % 2 ? 6 : 0), y); }
      for (let k = 10; k >= 0; k--) { const t = k / 10, y = d - t * d, w = Math.sin(t * Math.PI) * d * 0.36 * (1 - t * 0.2); p.lineTo(d / 2 + w + (k % 2 ? 6 : 0), y); } p.closePath(); }, "#2a5e22", "#4f8f36", true));
    foglia("lattuga", (g, d) => riempi(g, d, p => { p.moveTo(d / 2, d);
      for (let k = 0; k <= 24; k++) { const t = k / 24, y = d - t * d * 0.98, w = Math.pow(Math.sin(t * Math.PI * 0.85 + 0.25), 0.8) * d * 0.47 + Math.sin(k * 2.4) * 6; p.lineTo(d / 2 - w, y); }
      for (let k = 24; k >= 0; k--) { const t = k / 24, y = d - t * d * 0.98, w = Math.pow(Math.sin(t * Math.PI * 0.85 + 0.25), 0.8) * d * 0.47 + Math.cos(k * 2.1) * 6; p.lineTo(d / 2 + w, y); } p.closePath(); }, "#9ccc58", "#6fae32", false));
    foglia("lobata", (g, d) => riempi(g, d, p => { p.moveTo(d / 2, d);
      const lobi = [[0.08, 0.62], [0.2, 0.18], [0.5, 0.02], [0.8, 0.18], [0.92, 0.62]];
      p.lineTo(d * 0.35, d * 0.85);
      lobi.forEach(([x, y], i) => { p.quadraticCurveTo(d * (x + (i < 2 ? 0.1 : i > 2 ? -0.1 : 0)), d * (y + 0.25), d * x, d * y); p.quadraticCurveTo(d * (x * 0.6 + 0.2), d * (y * 0.5 + 0.35), d * (i < 4 ? lobi[i + 1][0] * 0.5 + 0.25 : 0.65), d * (i < 4 ? 0.45 : 0.85)); });
      p.lineTo(d / 2, d); }, "#2e5a24", "#447c31", true));
    foglia("trifogliata", (g, d) => {
      const fogliolina = (cx, cy, rot) => { g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(0.5, 0.55); g.translate(-d / 2, -d);
        riempi(g, d, p => { p.moveTo(d / 2, d); for (let k = 0; k <= 12; k++) { const t = k / 12, w = Math.sin(t * Math.PI) * d * 0.42; p.lineTo(d / 2 - w - (k % 2 ? 5 : 0), d - t * d); }
          for (let k = 12; k >= 0; k--) { const t = k / 12, w = Math.sin(t * Math.PI) * d * 0.42; p.lineTo(d / 2 + w + (k % 2 ? 5 : 0), d - t * d); } }, "#2d6625", "#4e9a3a", true); g.restore(); };
      fogliolina(d / 2, d * 0.6, 0); fogliolina(d / 2, d * 0.72, -0.9); fogliolina(d / 2, d * 0.72, 0.9);
      g.strokeStyle = "#3f7a2e"; g.lineWidth = 5; g.beginPath(); g.moveTo(d / 2, d); g.lineTo(d / 2, d * 0.7); g.stroke();
    });
    foglia("rucola", (g, d) => riempi(g, d, p => { p.moveTo(d / 2, d);
      for (let k = 0; k <= 8; k++) { const t = k / 8, w = d * (0.12 + (k % 2 ? 0.26 : 0.08) * Math.sin(t * Math.PI)); p.lineTo(d / 2 - w, d - t * d); }
      for (let k = 8; k >= 0; k--) { const t = k / 8, w = d * (0.12 + (k % 2 ? 0.26 : 0.08) * Math.sin(t * Math.PI)); p.lineTo(d / 2 + w, d - t * d); } p.closePath(); }, "#25521d", "#3d7a2c", false));
    foglia("lineare", (g, d) => riempi(g, d, p => { p.moveTo(d * 0.4, d); p.quadraticCurveTo(d * 0.38, d * 0.3, d / 2, 0); p.quadraticCurveTo(d * 0.62, d * 0.3, d * 0.6, d); }, "#4e8a3c", "#7fb35a", false));
    foglia("piumosa", (g, d) => { g.strokeStyle = "#3f7d2b"; g.lineWidth = 4; g.beginPath(); g.moveTo(d / 2, d); g.lineTo(d / 2, 8); g.stroke();
      for (let k = 1; k < 12; k++) { const y = d - k * d / 12, l = Math.sin(k / 12 * Math.PI) * d * 0.4; g.lineWidth = 2.5; g.strokeStyle = k % 2 ? "#4f9235" : "#3a7428";
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(d / 2, y); g.lineTo(d / 2 + s * l, y - 14); g.stroke(); for (let j = 1; j < 4; j++) { g.beginPath(); g.moveTo(d / 2 + s * l * j / 4, y - 14 * j / 4); g.lineTo(d / 2 + s * (l * j / 4 + 8), y - 14 * j / 4 - 12); g.stroke(); } } } });
    foglia("micro", (g, d) => riempi(g, d, p => { p.moveTo(d / 2, d); p.bezierCurveTo(-d * 0.1, d * 0.4, d * 0.2, 0, d / 2, d * 0.35); p.bezierCurveTo(d * 0.8, 0, d * 1.1, d * 0.4, d / 2, d); }, "#5f9e32", "#a3d36a", false));
  }

  // ---------- cielo e riflessi ----------
  const cieloMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: {alto: {value: col(0x4f86c6)}, orizzonte: {value: col(0xdfe9f2)}, basso: {value: col(0xb9c4b0)}},
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 alto; uniform vec3 orizzonte; uniform vec3 basso; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(orizzonte, alto, pow(h, 0.55)) : mix(orizzonte, basso, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }",
  });
  const cielo = new T.Mesh(new T.SphereGeometry(140, 32, 16), cieloMat);
  scena.add(cielo);
  // riflessi: cubo disegnato su canvas (funziona anche dove i render target in mezza precisione non ci sono)
  let envTex = null, envChiave = "";
  function aggiornaRiflessi() {
    const a = cieloMat.uniforms.alto.value, o = cieloMat.uniforms.orizzonte.value, b = cieloMat.uniforms.basso.value;
    const chiave = a.getHexString() + o.getHexString() + modo + (cfgCorrente ? cfgCorrente.ambiente : "");
    if (chiave === envChiave) return;
    envChiave = chiave;
    const css = c => "#" + c.clone().convertLinearToSRGB().getHexString();
    const interno = modo === "idro" || (cfgCorrente && cfgCorrente.ambiente === "interno");
    const [cA, cO, cB] = interno ? ["#3a3c3e", "#8d8f91", "#5e5d59"] : [css(a), css(o), css(b)];
    const faccia = tipo => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
      if (tipo === "su") { g.fillStyle = cA; g.fillRect(0, 0, 64, 64); } else if (tipo === "giu") { g.fillStyle = cB; g.fillRect(0, 0, 64, 64); }
      else { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, cA); gr.addColorStop(0.5, cO); gr.addColorStop(0.52, cB); gr.addColorStop(1, cB); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
      return c; };
    if (envTex) envTex.dispose();
    envTex = new T.CubeTexture([faccia("lato"), faccia("lato"), faccia("su"), faccia("giu"), faccia("lato"), faccia("lato")]);
    envTex.encoding = T.sRGBEncoding; envTex.needsUpdate = true;
    scena.environment = envTex;
  }
  const sole = new T.DirectionalLight(col(0xfff1dc), 2.4);
  sole.castShadow = true; sole.shadow.mapSize.set(2048, 2048); sole.shadow.bias = -0.0003; sole.shadow.normalBias = 0.02;
  Object.assign(sole.shadow.camera, {left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 60});
  scena.add(sole, sole.target);
  const emi = new T.HemisphereLight(col(0xcfe0f0), col(0x5b5340), 0.55);
  scena.add(emi);
  scena.fog = new T.Fog(col(0xdfe9f2), 30, 110);

  // ---------- primitive ----------
  const GEO = {box: new T.BoxGeometry(1, 1, 1), cil: new T.CylinderGeometry(1, 1, 1, 20), cil8: new T.CylinderGeometry(1, 1, 1, 8),
               sfera: new T.SphereGeometry(1, 16, 12), cono: new T.ConeGeometry(1, 1, 12)};
  let gruppo = null, aggiornabili = [], luciPiante = [], cliccabili = [];
  const ombre = (m, c = true, r = true) => { m.castShadow = c; m.receiveShadow = r; return m; };
  function blocco(w, h, d, m, x, y, z, info, g) { const o = ombre(new T.Mesh(GEO.box, m)); o.scale.set(w, h, d); o.position.set(x, y, z); if (info) o.userData.info = info; (g || gruppo).add(o); return o; }
  function cilindro(r, h, m, x, y, z, info, g, geo) { const o = ombre(new T.Mesh(geo || GEO.cil, m)); o.scale.set(r, h, r); o.position.set(x, y, z); if (info) o.userData.info = info; (g || gruppo).add(o); return o; }
  function tubo(punti, r, m, info, g, tensione = 0.0) {
    const curva = new T.CatmullRomCurve3(punti.map(p => new T.Vector3(...p)), false, "catmullrom", tensione);
    const o = ombre(new T.Mesh(new T.TubeGeometry(curva, Math.max(8, punti.length * 10), r, 8, false), m), true, false);
    if (info) o.userData.info = info; (g || gruppo).add(o); return o;
  }
  function tuboDritto(punti, r, m, info, g) {
    for (let i = 1; i < punti.length; i++) {
      const a = new T.Vector3(...punti[i - 1]), b = new T.Vector3(...punti[i]), l = a.distanceTo(b); if (l < 1e-4) continue;
      const o = ombre(new T.Mesh(GEO.cil, m), true, false); o.scale.set(r, l, r);
      o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      if (info) o.userData.info = info; (g || gruppo).add(o);
    }
  }
  function scatolaArrotondata(w, h, d, r, m) {
    const s = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
    s.moveTo(x, y - r); s.lineTo(x + W, y - r); s.quadraticCurveTo(x + W + r, y - r, x + W + r, y); s.lineTo(x + W + r, y + H);
    s.quadraticCurveTo(x + W + r, y + H + r, x + W, y + H + r); s.lineTo(x, y + H + r); s.quadraticCurveTo(x - r, y + H + r, x - r, y + H);
    s.lineTo(x - r, y); s.quadraticCurveTo(x - r, y - r, x, y - r);
    const g = new T.ExtrudeGeometry(s, {depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 4, curveSegments: 6});
    g.translate(0, 0, -(d - 2 * r) / 2);
    return ombre(new T.Mesh(g, m));
  }
  const info = (titolo, testo, chiave, voce) => ({titolo, testo, chiave, prezzo: voce ? (voce.max === 0 ? "0 €" : Math.round(voce.min) + "–" + Math.round(voce.max) + " €") : null});
  const trovaVoce = (voci, chiave, parola) => voci.find(v => (chiave && v.chiave === chiave && (!parola || v.nome.toLowerCase().includes(parola))) || (!chiave && parola && v.nome.toLowerCase().includes(parola)));

  // ---------- piante istanziate ----------
  const fogliaGeo = (() => { const g = new T.PlaneGeometry(0.6, 1, 3, 6); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + 0.5; p.setY(i, y); p.setZ(i, 0.18 * y * y + 0.12 * x * x); }
    g.computeVertexNormals(); return g; })();
  const fruttoGeo = new T.SphereGeometry(1, 14, 10);
  const MAT_PIANTE = {};
  function matFoglia(tipo) {
    if (!MAT_PIANTE[tipo]) MAT_PIANTE[tipo] = new T.MeshStandardMaterial({map: TEX.foglie[tipo], alphaTest: 0.45, side: T.DoubleSide, roughness: 0.65, metalness: 0, color: 0xffffff});
    return MAT_PIANTE[tipo];
  }
  const matStelo = mat(0x4f7d32, {roughness: 0.7}), matCanna = mat(0xc8b27e, {roughness: 0.8});
  const matFrutto = new T.MeshStandardMaterial({roughness: 0.28, metalness: 0, color: 0xffffff});
  const matFiore = mat(0xf2c418, {roughness: 0.6});
  const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _m = new T.Matrix4();
  function componi(x, y, z, yaw, pitch, roll, sx, sy, sz) { _e.set(pitch, yaw, roll, "YXZ"); _q.setFromEuler(_e); return new T.Matrix4().compose(new T.Vector3(x, y, z), _q.clone(), new T.Vector3(sx, sy == null ? sx : sy, sz == null ? sx : sz)); }
  const ORO = 2.39996;
  // ogni generatore riempie una lista di pezzi {k: tipo, m: matrice locale, soglia, colore}
  const SPECIE = {
    pomodoro: (A, r) => {
      A.canna(0.07, 0, 1.6, 0.011);
      let x = 0, z = 0;
      for (let i = 0; i < 7; i++) { const nx = (r() - 0.5) * 0.04, nz = (r() - 0.5) * 0.04; A.stelo(x, i * 0.2, z, nx, (i + 1) * 0.2, nz, 0.011 - i * 0.001); x = nx; z = nz; }
      for (let i = 0; i < 16; i++) { const h = 0.1 + i * 0.08, a = i * ORO, ca = Math.cos(a), sa = Math.sin(a), lun = 0.3 - i * 0.008;
        for (let j = 0; j < 7; j++) { const t = (j + 1) / 7 * lun, s = j === 6 ? 0.11 : 0.095 - Math.abs(j - 3) * 0.006;
          A.foglia("seghettata", ca * t + (j % 2 ? -sa : sa) * 0.03, h + 0.04 - t * 0.18, sa * t + (j % 2 ? ca : -ca) * 0.03, -a + Math.PI / 2 + (j % 2 ? 1.0 : -1.0) * (j < 6 ? 1 : 0), 1.15, (j % 2 ? 0.3 : -0.3), s, 0.62); } }
      for (let g = 0; g < 4; g++) { const h = 0.38 + g * 0.24, a = g * 2.1 + 0.6;
        for (let j = 0; j < 5; j++) A.frutto(Math.cos(a) * (0.12 + j * 0.02), h - j * 0.03, Math.sin(a) * (0.12 + j * 0.02), 0.022 + r() * 0.008, "pomodoro", 0.45 + g * 0.06); }
    },
    peperone: (A, r) => {
      for (let b = 0; b < 3; b++) A.stelo(0, 0, 0, Math.cos(b * 2.1) * 0.1, 0.45, Math.sin(b * 2.1) * 0.1, 0.009);
      for (let i = 0; i < 44; i++) { const a = i * ORO, rr = 0.06 + r() * 0.16, h = 0.12 + r() * 0.5; A.foglia("ovale", Math.cos(a) * rr, h, Math.sin(a) * rr, -a + Math.PI / 2, 1.1 + r() * 0.4, 0, 0.075 + r() * 0.02, 0.5); }
      for (let j = 0; j < 6; j++) { const a = j * 1.1; A.frutto(Math.cos(a) * 0.12, 0.25 + r() * 0.2, Math.sin(a) * 0.12, 0.028, "peperone", 0.5, 2.0); }
    },
    melanzana: (A, r) => {
      A.stelo(0, 0, 0, 0, 0.7, 0, 0.014);
      for (let i = 0; i < 26; i++) { const a = i * ORO, h = 0.15 + i * 0.022; A.foglia("ovale", Math.cos(a) * 0.05, h, Math.sin(a) * 0.05, -a + Math.PI / 2, 1.2, 0, 0.13 + r() * 0.03, 0.55, 0x9db08f); }
      for (let j = 0; j < 4; j++) { const a = j * 1.6; A.frutto(Math.cos(a) * 0.14, 0.22 + j * 0.06, Math.sin(a) * 0.14, 0.035, "melanzana", 0.55, 2.6); }
    },
    fagiolino: (A, r) => {
      A.canna(0, 0, 1.8, 0.01);
      for (let i = 0; i < 34; i++) { const h = 0.1 + i * 0.048, a = i * 1.3; A.foglia("trifogliata", Math.cos(a) * 0.05, h, Math.sin(a) * 0.05, -a + Math.PI / 2, 1.2, 0, 0.09, 0.5); }
      for (let j = 0; j < 10; j++) { const a = j * 2.3; A.frutto(Math.cos(a) * 0.08, 0.3 + j * 0.12, Math.sin(a) * 0.08, 0.006, "fagiolino", 0.5, 14); }
    },
    zucchina: (A, r) => {
      for (let i = 0; i < 9; i++) { const a = i * ORO, l = 0.18 + r() * 0.14, h = 0.22 + r() * 0.15;
        A.stelo(0, 0.02, 0, Math.cos(a) * l, h, Math.sin(a) * l, 0.009);
        A.foglia("lobata", Math.cos(a) * l, h, Math.sin(a) * l, -a + Math.PI / 2, 1.15 + r() * 0.25, 0, 0.36 + r() * 0.08, 1); }
      for (let j = 0; j < 2; j++) A.fiore(Math.cos(j * 3) * 0.08, 0.12, Math.sin(j * 3) * 0.08, 0.05, 0.35);
      for (let j = 0; j < 3; j++) { const a = j * 2.2 + 0.4; A.frutto(Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17, 0.028, "zucchina", 0.5, 3.4, a); }
    },
    cavolo: (A, r) => {
      for (let i = 0; i < 14; i++) { const a = i * ORO; A.foglia("ovale", Math.cos(a) * 0.04, 0.04, Math.sin(a) * 0.04, -a + Math.PI / 2, 0.55 + i * 0.05, 0, 0.26 + r() * 0.06, 0.7, 0x93b3a8); }
      A.frutto(0, 0.16, 0, 0.08, "cavolo", 0.55, 0.7);
    },
    lattuga: (A, r) => { for (let i = 0; i < 24; i++) { const t = i / 24, a = i * ORO; A.foglia("lattuga", Math.cos(a) * 0.01, 0.01, Math.sin(a) * 0.01, -a + Math.PI / 2, 0.35 + t * 0.95, (r() - 0.5) * 0.4, 0.06 + t * 0.09, 0.85); } },
    rucola: (A, r) => { for (let i = 0; i < 16; i++) { const a = i * ORO; A.foglia("rucola", 0, 0.01, 0, -a, 0.5 + r() * 0.5, 0, 0.1 + r() * 0.04, 0.45); } },
    spinacio: (A, r) => { for (let i = 0; i < 16; i++) { const a = i * ORO; A.foglia("ovale", 0, 0.01, 0, -a, 0.7 + r() * 0.5, 0, 0.09 + r() * 0.03, 0.75, 0x6f9a62); } },
    basilico: (A, r) => {
      for (let st = 0; st < 3; st++) { const ox = Math.cos(st * 2.1) * 0.03, oz = Math.sin(st * 2.1) * 0.03; A.stelo(0, 0, 0, ox, 0.34, oz, 0.005);
        for (let n = 0; n < 6; n++) { const h = 0.06 + n * 0.055, a = n * Math.PI / 2 + st, s = 0.06 - n * 0.004;
          for (const lato of [0, Math.PI]) A.foglia("ovale", ox * h / 0.34, h, oz * h / 0.34, a + lato, 1.0, 0, s, 0.7, 0xb8e0a0); } }
    },
    prezzemolo: (A, r) => { for (let i = 0; i < 14; i++) { const a = i * ORO, l = 0.1 + r() * 0.06; A.stelo(0, 0, 0, Math.cos(a) * l * 0.5, 0.2, Math.sin(a) * l * 0.5, 0.003);
      A.foglia("trifogliata", Math.cos(a) * l * 0.5, 0.2, Math.sin(a) * l * 0.5, -a + Math.PI / 2, 0.8, 0, 0.09, 0.9, 0xc8e8a8); } },
    menta: (A, r) => { for (let st = 0; st < 4; st++) { const ox = Math.cos(st * 1.6) * 0.05, oz = Math.sin(st * 1.6) * 0.05; A.stelo(0, 0, 0, ox, 0.3, oz, 0.004);
      for (let n = 0; n < 7; n++) for (const lato of [0, Math.PI]) A.foglia("seghettata", ox * n / 7, 0.05 + n * 0.035, oz * n / 7, n * Math.PI / 2 + lato, 1.1, 0, 0.045, 0.75, 0xb0e090); } },
    carota: (A, r) => { for (let i = 0; i < 9; i++) { const a = i * ORO; A.foglia("piumosa", 0, 0.01, 0, -a, 0.2 + r() * 0.35, 0, 0.26 + r() * 0.06, 0.9); } A.frutto(0, 0.0, 0, 0.018, "carota", 0.3, 0.6); },
    patata: (A, r) => { for (let i = 0; i < 46; i++) { const a = i * ORO, rr = 0.04 + r() * 0.2, h = 0.08 + r() * 0.42; A.foglia("ovale", Math.cos(a) * rr, h, Math.sin(a) * rr, -a + Math.PI / 2, 1.1, 0, 0.065, 0.6, 0xa8c890); } },
    cipolla: (A, r) => { for (let i = 0; i < 7; i++) A.foglia("lineare", 0, 0.02, 0, i * 0.9, 0.08 + r() * 0.3, 0, 0.42, 0.18); A.frutto(0, 0.02, 0, 0.035, "cipolla", 0.4, 0.8); },
    aglio: (A, r) => { for (let i = 0; i < 8; i++) A.foglia("lineare", 0, 0.02, 0, i * 0.8, 0.15 + r() * 0.35, 0, 0.45, 0.22, 0xa8c8a0); },
    fava: (A, r) => { for (let st = 0; st < 2; st++) { const ox = st ? 0.04 : -0.04; A.stelo(ox, 0, 0, ox, 0.8, 0, 0.008);
      for (let n = 0; n < 9; n++) for (const lato of [0, Math.PI]) A.foglia("ovale", ox, 0.1 + n * 0.08, 0, n * 1.1 + lato, 1.0, 0, 0.07, 0.55, 0x9fb8a0); }
      for (let j = 0; j < 4; j++) A.frutto(0.06, 0.25 + j * 0.12, 0, 0.012, "fava", 0.55, 6); },
    fragola: (A, r) => { for (let i = 0; i < 11; i++) { const a = i * ORO, l = 0.07 + r() * 0.04; A.stelo(0, 0, 0, Math.cos(a) * l, 0.12, Math.sin(a) * l, 0.003);
      A.foglia("trifogliata", Math.cos(a) * l, 0.12, Math.sin(a) * l, -a + Math.PI / 2, 1.2, 0, 0.1, 0.9); }
      for (let j = 0; j < 5; j++) { const a = j * 1.3; A.frutto(Math.cos(a) * 0.1, 0.05, Math.sin(a) * 0.1, 0.016, "fragola", 0.5, 1.3); } },
    microgreens: (A, r) => { for (let i = 0; i < 2; i++) A.foglia("micro", 0, 0.04, 0, i * Math.PI + r(), 1.35, 0, 0.022, 1); A.stelo(0, 0, 0, 0, 0.045, 0, 0.0012); },
  };
  const COLORI_FRUTTO = {pomodoro: [0x5f9e3a, 0xd8301f], peperone: [0x3f7a2a, 0xc8261c], melanzana: [0x3d2547, 0x2b1734], fagiolino: [0x6aa33d, 0x5c9935],
    zucchina: [0x3d6a2a, 0x2f5a22], cavolo: [0xe9e2c8, 0xf4efdc], carota: [0xe07a26, 0xe9852c], cipolla: [0xd9c79c, 0xc9a875], fava: [0x6f9c4c, 0x5f8f3e], fragola: [0xe8e2b0, 0xd51e2a]};

  // Un "campo" di piante dello stesso tipo: pochi InstancedMesh (foglie per tipo, steli, canne, frutti, fiori)
  function campo(coltura, posizioni, opz = {}) {
    const gen = SPECIE[coltura] || SPECIE.lattuga, pezzi = [];
    posizioni.forEach((p, idx) => {
      const r = mulberry32(idx * 131 + 7);
      const A = {
        foglia: (tipo, x, y, z, yaw, pitch, roll, s, larg, tinta) => pezzi.push({k: "f:" + tipo, idx, m: componi(x, y, z, yaw, pitch, roll, s * (larg || 0.6) / 0.6, s, s), tinta}),
        stelo: (x1, y1, z1, x2, y2, z2, r0) => { const a = new T.Vector3(x1, y1, z1), b = new T.Vector3(x2, y2, z2), l = a.distanceTo(b);
          const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          pezzi.push({k: "stelo", idx, m: new T.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new T.Vector3(r0, l, r0))}); },
        canna: (x, z, h, r0) => pezzi.push({k: "canna", idx, m: componi(x, h / 2, z, 0, 0, 0, r0, h, r0), fisso: true}),
        frutto: (x, y, z, rr, tipo, soglia, allunga, yaw) => pezzi.push({k: "frutto", idx, tipo, soglia, m: componi(x, y, z, yaw || 0, allunga && allunga > 1.5 ? 0 : 0, allunga > 3 ? Math.PI / 2 : 0, rr, rr * (allunga || 1), rr)}),
        fiore: (x, y, z, s, soglia) => pezzi.push({k: "fiore", idx, soglia, m: componi(x, y, z, 0, Math.PI, 0, s * 0.6, s, s * 0.6)}),
      };
      gen(A, r);
    });
    const perTipo = {};
    for (const p of pezzi) (perTipo[p.k] = perTipo[p.k] || []).push(p);
    const g = new T.Group();
    const mesh = {};
    for (const k in perTipo) {
      const lista = perTipo[k];
      let geo = fogliaGeo, m;
      if (k.startsWith("f:")) m = matFoglia(k.slice(2));
      else if (k === "stelo") { geo = GEO.cil8; m = matStelo; }
      else if (k === "canna") { geo = GEO.cil8; m = matCanna; }
      else if (k === "frutto") { geo = fruttoGeo; m = matFrutto; }
      else { geo = GEO.cono; m = matFiore; }
      const im = new T.InstancedMesh(geo, m, lista.length);
      im.castShadow = !opz.senzaOmbre; im.receiveShadow = true;
      im.instanceMatrix.setUsage(T.DynamicDrawUsage);
      const c = new T.Color();
      lista.forEach((p, i) => { if (k.startsWith("f:")) { c.set(p.tinta || 0xffffff); const v = 0.85 + ((p.idx * 7 + i) % 10) / 40; c.multiplyScalar(v); im.setColorAt(i, c); }
                                else if (k === "frutto") { im.setColorAt(i, col(COLORI_FRUTTO[p.tipo] ? COLORI_FRUTTO[p.tipo][0] : 0x8fbf5f)); } });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.userData.info = opz.info;
      g.add(im); mesh[k] = {im, lista};
    }
    const basi = posizioni.map(p => componi(p[0], p[1], p[2], p[3] || 0, p[4] || 0, 0, 1));
    const fasi = posizioni.map((p, i) => p[5] != null ? p[5] : 0);
    const cMat = new T.Color(), c0 = new T.Color(), c1 = new T.Color();
    function aggiorna(crescita, visibile, scaglionata) {
      g.visible = visibile;
      if (!visibile) return;
      for (const k in mesh) {
        const {im, lista} = mesh[k];
        lista.forEach((p, i) => {
          let cr = scaglionata ? (crescita + fasi[p.idx]) % 1 : crescita;
          let s = 0.12 + 0.88 * Math.min(1, cr * 1.4);
          if (p.fisso) s = 1;
          if ((k === "frutto" || k === "fiore") && cr < p.soglia) s = 0;
          _m.copy(basi[p.idx]).multiply(new T.Matrix4().makeScale(s, s, s)).multiply(p.m);
          im.setMatrixAt(i, _m);
          if (k === "frutto" && COLORI_FRUTTO[p.tipo]) { const mat0 = Math.min(1, Math.max(0, (cr - p.soglia - 0.1) / 0.3));
            c0.copy(col(COLORI_FRUTTO[p.tipo][0])); c1.copy(col(COLORI_FRUTTO[p.tipo][1])); cMat.copy(c0).lerp(c1, mat0); im.setColorAt(i, cMat); }
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }
    return {g, aggiorna};
  }

  // ---------- pezzi d'impianto ----------
  const MAT = {};
  function materiali() {
    MAT.acciaio = mat(0xb9bec2, {metalness: 0.85, roughness: 0.32});
    MAT.zincato = mat(0x9ea4a8, {metalness: 0.8, roughness: 0.45});
    MAT.pe = mat(0x1a1a1a, {roughness: 0.55});
    MAT.pvc = mat(0xf2f2ee, {roughness: 0.35});
    MAT.pvcGrigio = mat(0x8c9196, {roughness: 0.45});
    MAT.plastNera = mat(0x26282a, {roughness: 0.5});
    MAT.ottone = mat(0xc7a24a, {metalness: 0.9, roughness: 0.3});
    MAT.verdeIrr = mat(0x2f6b3a, {roughness: 0.6});
    MAT.quadro = mat(0xc9ccd0, {roughness: 0.45});
    MAT.vetro = fisico(0xffffff, {roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.18, metalness: 0});
    MAT.acqua = fisico(0x2f6f9a, {roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.65});
    MAT.pozza = fisico(0x5a7f9a, {roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.0});
    MAT.terra = new T.MeshStandardMaterial({map: TEX.terra, roughness: 0.95});
    MAT.legno = new T.MeshStandardMaterial({map: TEX.legno, roughness: 0.85});
    MAT.paglia = new T.MeshStandardMaterial({map: TEX.paglia, roughness: 1, color: col(0xc9b48a)});
    MAT.pcbBlu = mat(0x1e4f9a, {roughness: 0.5}); MAT.pcbNero = mat(0x161616, {roughness: 0.4}); MAT.pcbVerde = mat(0x1d6b3a, {roughness: 0.5});
    MAT.pcbTeal = mat(0x00878f, {roughness: 0.5});
  }
  function quadro(c, x, y, z, rotY, voci, microChiave) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0; gruppo.add(g);
    const microK = microChiave || c.componenti.micro;
    const logo = microK === "logo";
    const W = 0.32, H = 0.26, D = 0.14;
    const corpo = blocco(W, H, 0.01, MAT.quadro, 0, H / 2, -D / 2, info("Quadro elettrico", "Dentro: " + CATALOGO.micro.opzioni[microK].nome + ", relè, alimentazione. Coperchio trasparente.", "quadro", trovaVoce(voci, "quadro")), g);
    blocco(W, 0.01, D, MAT.quadro, 0, 0.005, 0, null, g); blocco(W, 0.01, D, MAT.quadro, 0, H, 0, null, g);
    blocco(0.01, H, D, MAT.quadro, -W / 2, H / 2, 0, null, g); blocco(0.01, H, D, MAT.quadro, W / 2, H / 2, 0, null, g);
    const coperchio = blocco(W, H, 0.006, MAT.vetro, 0, H / 2, D / 2, info("Quadro elettrico", "Coperchio trasparente: vedi i LED di stato senza aprire.", "quadro", trovaVoce(voci, "quadro")), g);
    coperchio.castShadow = false;
    // guida DIN e componenti
    blocco(W - 0.04, 0.035, 0.008, MAT.acciaio, 0, H * 0.72, -D / 2 + 0.01, null, g);
    if (logo) { blocco(0.072, 0.09, 0.055, mat(0xe8e8e2), -0.08, H * 0.72, -D / 2 + 0.035, info("Siemens LOGO! 8", CATALOGO.micro.opzioni.logo.pro, "micro", trovaVoce(voci, "micro")), g);
      blocco(0.05, 0.022, 0.002, mat(0x6e9a6e, {emissive: col(0x3a5a3a), emissiveIntensity: 0.5}), -0.08, H * 0.75, -D / 2 + 0.064, null, g); }
    else { const pcb = {esp32: MAT.pcbNero, esp32s3: MAT.pcbNero, picow: MAT.pcbVerde, arduino: MAT.pcbTeal, pizero: MAT.pcbVerde}[microK] || MAT.pcbNero;
      const dims = {esp32: [0.028, 0.052], esp32s3: [0.028, 0.062], picow: [0.021, 0.051], arduino: [0.053, 0.068], pizero: [0.065, 0.03]}[microK] || [0.028, 0.052];
      blocco(dims[0], dims[1], 0.003, pcb, -0.09, H * 0.45, -D / 2 + 0.02, info(CATALOGO.micro.opzioni[microK].nome, CATALOGO.micro.opzioni[microK].pro + " " + CATALOGO.micro.opzioni[microK].contro, "micro", trovaVoce(voci, "micro")), g);
      blocco(dims[0] * 0.5, dims[0] * 0.5, 0.003, mat(0xb8bcc0, {metalness: 0.8, roughness: 0.3}), -0.09, H * 0.45 + dims[1] * 0.25, -D / 2 + 0.023, null, g); }
    for (let i = 0; i < 4; i++) { blocco(0.016, 0.019, 0.016, mat(0x1e5fb4, {roughness: 0.4}), 0.0 + i * 0.022, H * 0.45, -D / 2 + 0.025, i ? null : info("Modulo relè", "Accende pompa e valvole a 12 V.", "valvole", trovaVoce(voci, "valvole", "relè")), g); }
    blocco(0.06, 0.04, 0.03, mat(0x55595d), 0.09, H * 0.2, -D / 2 + 0.025, info("Alimentatore e protezioni", "12 V con fusibile.", "alimentazione", trovaVoce(voci, "alimentazione")), g);
    for (let i = 0; i < 4; i++) cilindro(0.008, 0.02, MAT.plastNera, -0.1 + i * 0.065, -0.008, 0, null, g);
    const led = new T.Mesh(GEO.sfera, new T.MeshStandardMaterial({color: col(0x22c55e), emissive: col(0x22c55e), emissiveIntensity: 2}));
    led.scale.setScalar(0.006); led.position.set(W / 2 - 0.03, H - 0.03, D / 2 + 0.004); g.add(led);
    if (["lora", "g4"].includes(c.componenti ? c.componenti.connessione : "")) cilindro(0.004, 0.18, MAT.plastNera, W / 2 - 0.03, H + 0.09, 0, info("Antenna " + (c.componenti.connessione === "lora" ? "LoRa" : "4G"), "", "connessione"), g);
    return {g, led};
  }
  function sensoreSuolo(tipo, x, y, z, voci, i) {
    const inf = info("Sensore di umidità zona " + (i + 1), CATALOGO.sensore_suolo.opzioni[tipo].nome + ": " + CATALOGO.sensore_suolo.opzioni[tipo].pro + " " + CATALOGO.sensore_suolo.opzioni[tipo].contro, "sensore_suolo", trovaVoce(voci, "sensore_suolo"));
    if (tipo === "capacitivo") { blocco(0.023, 0.1, 0.003, MAT.pcbNero, x, y + 0.02, z, inf); blocco(0.023, 0.022, 0.012, mat(0x111111), x, y + 0.075, z, inf); }
    else if (tipo === "resistivo") { cilindro(0.0025, 0.06, MAT.acciaio, x - 0.008, y + 0.01, z, inf); cilindro(0.0025, 0.06, MAT.acciaio, x + 0.008, y + 0.01, z, inf); blocco(0.03, 0.015, 0.004, mat(0xb23a2a), x, y + 0.045, z, inf); }
    else if (tipo === "professionale") { cilindro(0.022, 0.08, mat(0x5d6064), x, y + 0.05, z, inf); for (const dx of [-0.01, 0, 0.01]) cilindro(0.0018, 0.06, MAT.acciaio, x + dx, y - 0.01, z, inf); }
    else { cilindro(0.011, 0.32, fisico(0xffffff, {transparent: true, opacity: 0.45, roughness: 0.1}), x, y + 0.08, z, inf); cilindro(0.016, 0.03, mat(0x2f8f3a), x, y + 0.25, z, inf); cilindro(0.025, 0.008, MAT.acciaio, x + 0.03, y + 0.2, z, inf).rotation.z = Math.PI / 2; }
  }
  function valvola(tipo, x, y, z, inf) {
    if (tipo === "motorizzata") { cilindro(0.017, 0.06, MAT.ottone, x, y, z, inf).rotation.z = Math.PI / 2; blocco(0.05, 0.06, 0.05, mat(0x2b2d30), x, y + 0.05, z, inf); }
    else { blocco(0.06, 0.04, 0.04, mat(0x1d1f22), x, y, z, inf); cilindro(0.017, 0.045, mat(tipo === "bistabile" ? 0x8a1f1f : 0x111111), x, y + 0.04, z, inf);
      tubo([[x, y + 0.065, z], [x + 0.02, y + 0.09, z], [x + 0.03, y + 0.06, z + 0.02]], 0.0015, mat(0xc0392b)); }
  }
  function cisternaIBC(x, z, livelloRef, voci, litri) {
    const n = Math.max(1, Math.ceil(litri / 1000));
    const vasche = [];
    for (let k = 0; k < n; k++) {
      const xx = x - k * 1.3;
      blocco(1.2, 0.14, 1.0, MAT.plastNera, xx, 0.07, z);
      for (const dz of [-0.4, 0, 0.4]) blocco(1.2, 0.02, 0.1, MAT.plastNera, xx, 0.15, z + dz);
      const vasca = scatolaArrotondata(1.12, 1.08, 0.94, 0.07, fisico(0xf3f3ee, {roughness: 0.35, transparent: true, opacity: 0.62, clearcoat: 0.3}));
      vasca.position.set(xx, 0.16 + 0.54, z); vasca.userData.info = info("Cisterna IBC 1000 L", "Plastica alimentare in gabbia d'acciaio. Tienila coperta o all'ombra: con la luce crescono le alghe.", "cisterna", trovaVoce(voci, "cisterna"));
      gruppo.add(vasca);
      const acqua = blocco(1.06, 0.01, 0.88, MAT.acqua, xx, 0.17, z); acqua.castShadow = false; vasche.push(acqua);
      for (let i = 0; i <= 4; i++) { const px = xx - 0.6 + i * 0.3; tuboDritto([[px, 0.16, z + 0.5], [px, 1.25, z + 0.5]], 0.009, MAT.zincato); tuboDritto([[px, 0.16, z - 0.5], [px, 1.25, z - 0.5]], 0.009, MAT.zincato); }
      for (let i = 0; i <= 3; i++) { const pz = z - 0.5 + i * 0.333; tuboDritto([[xx - 0.6, 0.16, pz], [xx - 0.6, 1.25, pz]], 0.009, MAT.zincato); tuboDritto([[xx + 0.6, 0.16, pz], [xx + 0.6, 1.25, pz]], 0.009, MAT.zincato); }
      for (const h of [0.45, 0.85, 1.25]) { tuboDritto([[xx - 0.6, h, z + 0.5], [xx + 0.6, h, z + 0.5], [xx + 0.6, h, z - 0.5], [xx - 0.6, h, z - 0.5], [xx - 0.6, h, z + 0.5]], 0.009, MAT.zincato); }
      cilindro(0.075, 0.04, mat(0xf0f0ea), xx, 1.26, z);
      cilindro(0.04, 0.09, MAT.pvcGrigio, xx + 0.62, 0.26, z + 0.25).rotation.z = Math.PI / 2;
      blocco(0.02, 0.09, 0.02, mat(0xd23c2c), xx + 0.67, 0.3, z + 0.25);
    }
    livelloRef.vasche = vasche; livelloRef.h = 1.0; livelloRef.fondo = 0.17;
  }

  // ---------- costruzione dell'orto ----------
  let stato = {}, modo = "orto";
  function svuota() {
    if (gruppo) { scena.remove(gruppo); gruppo.traverse(o => { if (o.geometry && !Object.values(GEO).includes(o.geometry) && o.geometry !== fogliaGeo && o.geometry !== fruttoGeo) o.geometry.dispose();
      if (o.material && !Object.values(MAT).includes(o.material) && !Object.values(MAT_PIANTE).includes(o.material) && ![matStelo, matCanna, matFrutto, matFiore].includes(o.material)) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } }); }
    gruppo = new T.Group(); scena.add(gruppo); aggiornabili = []; luciPiante = [];
  }
  function costruisciOrto(c, s, voci) {
    const amb = c.ambiente, comp = c.componenti, ex = c.extra, n = c.zone.length;
    const interno = amb === "interno", cist = c.acqua.fonte === "cisterna";
    const LARG = interno ? 0.8 : 1.2, VIA = interno ? 0.6 : 0.7;
    const lungh = c.zone.map(z => Math.max(0.6, z.area / LARG));
    const W = n * LARG + (n - 1) * VIA, x0 = -W / 2 + (interno ? 0 : 1.0), zMax = Math.max(...lungh);
    stato = {zone: [], cisterna: {}, led: null, rain: true, pioggia: null, centro: new T.Vector3(x0 + W / 2 - (interno ? 0 : 1.6), 0.3, zMax / 2 - 0.6)};
    // terreno e contorno
    if (interno) {
      const pav = ombre(new T.Mesh(new T.PlaneGeometry(14, 12), new T.MeshStandardMaterial({map: TEX.parquet, roughness: 0.6})), false, true);
      pav.rotation.x = -Math.PI / 2; pav.position.set(x0 + W / 2, 0, 1); gruppo.add(pav);
      const muro = new T.MeshStandardMaterial({map: TEX.intonaco, roughness: 0.95});
      blocco(14, 2.8, 0.12, muro, x0 + W / 2, 1.4, -2.3); blocco(0.12, 2.8, 12, muro, x0 - 2.6, 1.4, 1);
      blocco(14, 0.08, 0.02, mat(0xf2f0ea), x0 + W / 2, 0.04, -2.23);
      blocco(1.4, 1.2, 0.02, fisico(0xbcd7ee, {roughness: 0.05, transparent: true, opacity: 0.35}), x0 + W / 2 + 2.5, 1.6, -2.23);
      blocco(1.5, 0.06, 0.08, mat(0xeeeeea), x0 + W / 2 + 2.5, 0.98, -2.2);
    } else {
      const prato = ombre(new T.Mesh(new T.PlaneGeometry(120, 120), new T.MeshStandardMaterial({map: TEX.prato, roughness: 1})), false, true);
      prato.rotation.x = -Math.PI / 2; gruppo.add(prato);
      const gh = ombre(new T.Mesh(new T.PlaneGeometry(W + 7.2, zMax + 3.6), new T.MeshStandardMaterial({map: TEX.ghiaia, roughness: 1})), false, true);
      gh.material.map.repeat.set((W + 7.2) / 1.2, (zMax + 3.6) / 1.2);
      gh.rotation.x = -Math.PI / 2; gh.position.set(x0 + W / 2 - 2.3, 0.004, zMax / 2 - 1.0); gruppo.add(gh);
      // casa con grondaia
      const intonaco = new T.MeshStandardMaterial({map: TEX.intonaco, roughness: 0.95});
      const lungCasa = W + 10;
      blocco(lungCasa, 3.0, 0.3, intonaco, x0 + W / 2 - 2, 1.5, -3.4, info("Casa", "Il tetto collegato alla grondaia: " + c.acqua.tetto_m2 + " m² raccolgono la pioggia.", null));
      blocco(lungCasa, 0.35, 0.32, mat(0x8a857a, {roughness: 0.95}), x0 + W / 2 - 2, 0.17, -3.38);
      const tetto = blocco(lungCasa + 0.4, 0.06, 0.8, new T.MeshStandardMaterial({map: TEX.coppi, roughness: 0.75}), x0 + W / 2 - 2, 3.16, -3.25);
      tetto.material.map.repeat.set(lungCasa / 0.8, 1.5); tetto.rotation.x = 0.25;
      tuboDritto([[x0 - 7, 3.02, -2.55], [x0 + W + 3, 3.02, -2.55]], 0.06, mat(0xa8a9a6, {metalness: 0.6, roughness: 0.35}));
      for (const wx of [x0 + 1.2, x0 + W + 0.5]) { blocco(1.0, 1.25, 0.04, fisico(0x8eb0c8, {roughness: 0.04, metalness: 0.2}), wx, 1.75, -3.24); blocco(1.12, 0.06, 0.14, mat(0xefefea), wx, 1.1, -3.2); }
      // recinzione e alberi lontani
      for (let i = -12; i <= 12; i++) { blocco(0.08, 1.1, 0.08, MAT.legno, x0 + W / 2 + i * 1.6, 0.55, zMax + 4.5); }
      blocco(40, 0.06, 0.04, MAT.legno, x0 + W / 2, 0.95, zMax + 4.5); blocco(40, 0.06, 0.04, MAT.legno, x0 + W / 2, 0.45, zMax + 4.5);
      const chioma = mat(0x3f6a2a, {roughness: 0.9});
      for (const [tx, tz, ts] of [[x0 + W + 6, zMax + 9, 1.5], [x0 - 8, zMax + 12, 1.9], [x0 + W + 12, -6, 2.2], [x0 - 12, -2, 1.6]]) {
        cilindro(0.16 * ts, 2.2 * ts, mat(0x5e4630), tx, 1.1 * ts, tz);
        for (let k = 0; k < 6; k++) { const o = ombre(new T.Mesh(GEO.sfera, chioma)); o.scale.setScalar((0.9 + (k % 3) * 0.3) * ts); o.position.set(tx + Math.cos(k * 1.3) * 0.7 * ts, (2.6 + (k % 2) * 0.7) * ts, tz + Math.sin(k * 1.3) * 0.7 * ts); gruppo.add(o); }
      }
    }
    // acqua: cisterna (o tanica) e pompa
    const xc = interno ? x0 - 1.6 : x0 - 4.0, zc = interno ? -1.6 : -2.2;
    let uscita;
    if (cist) {
      if (interno) {
        const t = blocco(0.4, 0.5, 0.35, fisico(0xf3f1ea, {transparent: true, opacity: 0.7, roughness: 0.3}), xc, 0.25, zc, info("Tanica " + c.acqua.cisterna_l + " L", "Riempita a mano una volta a settimana.", "cisterna", trovaVoce(voci, "cisterna")));
        const a = blocco(0.37, 0.01, 0.32, MAT.acqua, xc, 0.02, zc); a.castShadow = false;
        stato.cisterna = {vasche: [a], h: 0.46, fondo: 0.02};
      } else if (c.acqua.cisterna_l > 400) {
        cisternaIBC(xc, zc, stato.cisterna, voci, c.acqua.cisterna_l);
        tubo([[xc + 0.2, 3.0, -2.55], [xc + 0.2, 2.2, -2.55], [xc + 0.2, 1.5, -2.4], [xc + 0.1, 1.32, zc]], 0.045, mat(0xa8a9a6, {metalness: 0.6, roughness: 0.35}), info("Pluviale con filtro", "Porta la pioggia del tetto in cisterna senza foglie.", "cisterna", trovaVoce(voci, "cisterna", "grondaia")));
        tubo([[xc - 0.5, 1.22, zc - 0.3], [xc - 0.9, 0.6, zc - 0.3], [xc - 1.2, 0.03, zc + 0.6], [xc - 2.5, 0.03, zc + 1.6]], 0.02, mat(0x5b5f63), info("Troppo pieno", "Con un nubifragio la cisterna trabocca: lontano da aiuole e quadro.", "cisterna", trovaVoce(voci, "cisterna", "troppo")));
      } else {
        const f = Math.max(1, Math.ceil(c.acqua.cisterna_l / 200)), blu = mat(0x1f5aa6, {roughness: 0.45});
        for (let k = 0; k < f; k++) { const fx = xc - 0.3 + (k % 2) * 0.62, fz = zc + Math.floor(k / 2) * 0.62;
          cilindro(0.29, 0.88, blu, fx, 0.44, fz, info("Fusto 200 L", "Fusto alimentare recuperato.", "cisterna", trovaVoce(voci, "cisterna")));
          for (const h of [0.25, 0.63]) { const anello = new T.Mesh(new T.TorusGeometry(0.29, 0.012, 8, 32), blu); anello.rotation.x = Math.PI / 2; anello.position.set(fx, h, fz); gruppo.add(anello); } }
        stato.cisterna = {vasche: [], h: 0, fondo: 0};
      }
      const xp = xc + (interno ? 0.45 : 1.05), zp = zc + 0.35;
      const pm = opzione("pompa", comp.pompa);
      if (comp.pompa === "sommersa") { uscita = [xc + 0.6, 0.3, zc + 0.3]; }
      else {
        blocco(0.36, 0.12, 0.26, mat(0x9a9890, {roughness: 0.95}), xp, 0.06, zp);
        const p1 = blocco(0.16, 0.09, 0.09, MAT.plastNera, xp - 0.03, 0.17, zp, info("Pompa: " + pm.nome, pm.pro + " " + pm.contro, "pompa", trovaVoce(voci, "pompa")));
        const p2 = cilindro(0.045, 0.12, mat(0x1e4f9a, {roughness: 0.35, metalness: 0.3}), xp + 0.09, 0.17, zp, info("Pompa: " + pm.nome, pm.pro + " " + pm.contro, "pompa", trovaVoce(voci, "pompa")));
        p2.rotation.z = Math.PI / 2; stato.pompa = p2;
        tubo([[xc + 0.62, 0.26, zc + 0.25], [xp - 0.2, 0.2, zp], [xp - 0.11, 0.17, zp]], 0.012, MAT.pe);
        uscita = [xp + 0.16, 0.17, zp];
      }
    } else {
      blocco(0.05, 0.08, 0.12, mat(0xbfc3c6, {metalness: 0.85, roughness: 0.25}), xc, 0.75, interno ? -2.2 : -3.22, info("Rubinetto", "Acqua di rete: niente pompa, ma serve la valvola generale.", "valvole"));
      blocco(0.08, 0.08, 0.08, MAT.plastNera, xc + 0.5, 0.12, zc, info("Riduttore di pressione e filtro", "", null, trovaVoce(voci, null, "riduttore")));
      valvola(comp.valvole, xc + 0.85, 0.12, zc, info("Valvola generale", "Chiude tutto se una valvola di zona resta aperta.", "valvole", trovaVoce(voci, "valvole", "generale")));
      tubo([[xc, 0.75, interno ? -2.15 : -3.15], [xc, 0.15, interno ? -2.0 : -3.0], [xc + 0.05, 0.12, zc], [xc + 1.1, 0.12, zc]], 0.01, MAT.pe);
      uscita = [xc + 1.1, 0.12, zc];
    }
    let xu = uscita[0];
    if (ex.flussimetro) { cilindro(0.02, 0.07, mat(0x111111), xu + 0.12, uscita[1], uscita[2], info("Flussimetro", EXTRA.flussimetro.spiega, "flussimetro", trovaVoce(voci, "flussimetro"))).rotation.z = Math.PI / 2;
      blocco(0.03, 0.02, 0.03, mat(0xe8c22b), xu + 0.12, uscita[1] + 0.025, uscita[2]); }
    if (ex.filtro) cilindro(0.035, 0.12, fisico(0x2e6fb0, {transparent: true, opacity: 0.7, roughness: 0.15}), xu + 0.3, uscita[1] + 0.02, uscita[2], info("Filtro a rete", EXTRA.filtro.spiega, "filtro", trovaVoce(voci, "filtro")));
    // collettore con le valvole (in vista, su un paletto)
    const xv = x0 - 1.2, zv = -1.25, yv = 0.28;
    tubo([uscita, [xu + 0.5, uscita[1], uscita[2]], [xv - 0.3, 0.1, zv], [xv - 0.15, yv, zv]], 0.011, MAT.pe, info("Tubo 16 mm", "Dalla pompa (o dal rubinetto) al collettore.", null, trovaVoce(voci, null, "tubo 16")));
    tuboDritto([[xv - 0.15, yv, zv], [xv + n * 0.16, yv, zv]], 0.016, MAT.pvcGrigio, info("Collettore", "Una valvola per zona.", "valvole"));
    blocco(0.06, yv, 0.06, MAT.legno, xv - 0.1, yv / 2, zv - 0.06);
    const valv = opzione("valvole", comp.valvole);
    c.zone.forEach((z, i) => valvola(comp.valvole, xv + 0.05 + i * 0.16, yv + 0.04, zv, info("Valvola zona " + (i + 1), valv.nome + ". " + valv.pro + " " + valv.contro, "valvole", trovaVoce(voci, "valvole", "elettrovalvola"))));
    // quadro
    const qx = interno ? xc + 0.6 : xc + 0.5, qz = interno ? -2.17 : -0.95, qy = interno ? 1.2 : comp.quadro_cm / 100;
    if (!interno && comp.quadro_cm >= 30) cilindro(0.035, 1.9, MAT.zincato, qx, 0.95, qz - 0.11, info("Palo del quadro", "Quadro a " + comp.quadro_cm + " cm da terra: un nubifragio non lo raggiunge.", "quadro", trovaVoce(voci, "quadro", "palo")));
    const q = quadro(c, qx, qy, qz, 0, voci);
    stato.led = q.led;
    if (comp.aria !== "nessuno") {
      const ax = interno ? x0 + W + 0.4 : qx - 1.0, az = interno ? -2.1 : qz + 0.3;
      if (!interno) cilindro(0.015, 1.4, MAT.zincato, ax, 0.7, az);
      for (let k = 0; k < 6; k++) cilindro(0.07 - k * 0.002, 0.012, mat(0xf4f4f0, {roughness: 0.5}), ax, (interno ? 1.4 : 1.25) + k * 0.025, az, info("Sensore aria " + opzione("aria", comp.aria).nome, "In uno schermo antiradiazione bianco, all'ombra e ventilato.", "aria", trovaVoce(voci, "aria")));
    }
    if (ex.pioggia && !interno) { blocco(0.06, 0.004, 0.04, mat(0x1f4e7a, {metalness: 0.4, roughness: 0.3}), qx, 1.92, qz - 0.11, info("Sensore di pioggia", EXTRA.pioggia.spiega, "pioggia", trovaVoce(voci, "pioggia"))).rotation.x = 0.4; }
    if (solareAttivo(c)) {
      const lato = Math.sqrt(comp.pannello_w / 120);
      const pan = blocco(lato * 1.1 + 0.2, 0.035, lato * 0.75 + 0.15, [mat(0xb8bcc0, {metalness: 0.8}), mat(0xb8bcc0, {metalness: 0.8}), new T.MeshStandardMaterial({map: TEX.celle, roughness: 0.25, metalness: 0.3}), mat(0x888888), mat(0xb8bcc0), mat(0xb8bcc0)], qx + 0.9, 1.3, qz + 0.2, info("Pannello solare " + comp.pannello_w + " W", "Rivolto a sud, inclinato 30-35°.", "alimentazione", trovaVoce(voci, "alimentazione", "pannello")));
      pan.rotation.x = 0.55;
      tuboDritto([[qx + 0.9, 0, qz + 0.1], [qx + 0.9, 1.25, qz + 0.1]], 0.025, MAT.zincato);
      blocco(0.18 + comp.batteria_ah / 300, 0.17, 0.16, mat(0x2c2c2c), qx + 0.45, 0.09, qz + 0.15, info("Batteria " + opzione("batteria", comp.batteria).nome + " " + comp.batteria_ah + " Ah", opzione("batteria", comp.batteria).pro, "batteria", trovaVoce(voci, "batteria")));
    }
    // aiuole
    c.zone.forEach((z, i) => {
      const xi = x0 + i * (LARG + VIA) + LARG / 2, L = lungh[i], alto = z.rialzata ? (interno ? 0.4 : 0.3) : 0.06;
      const P = PIANTE[z.coltura];
      const zInfo = info("Zona " + (i + 1) + " · " + P.nome, z.area + " m² (" + LARG.toFixed(1) + " × " + L.toFixed(1) + " m)" + (z.rialzata ? ", " + (interno ? "cassone" : "aiuola rialzata") : "") + (z.pacciamatura ? ", pacciamata" : "") + ". " + P.m2 + " piante per m².", null);
      if (z.rialzata) {
        const assi = MAT.legno.clone(); assi.map = TEX.legno.clone(); assi.map.needsUpdate = true; assi.map.repeat.set(L / 0.8, 1);
        for (const [w, d, px, pz] of [[0.05, L + 0.1, xi - LARG / 2 - 0.025, L / 2], [0.05, L + 0.1, xi + LARG / 2 + 0.025, L / 2], [LARG, 0.05, xi, -0.025], [LARG, 0.05, xi, L + 0.025]])
          blocco(w, alto + 0.02, d, assi, px, (alto + 0.02) / 2, pz);
        for (const [px, pz] of [[xi - LARG / 2 - 0.03, -0.03], [xi + LARG / 2 + 0.03, -0.03], [xi - LARG / 2 - 0.03, L + 0.03], [xi + LARG / 2 + 0.03, L + 0.03]]) blocco(0.07, alto + 0.06, 0.07, MAT.legno, px, (alto + 0.06) / 2, pz);
      }
      const terraM = MAT.terra.clone(); terraM.map = TEX.terra.clone(); terraM.map.needsUpdate = true; terraM.map.repeat.set(LARG / 0.7, L / 0.7);
      const terra = blocco(LARG, alto, L, terraM, xi, alto / 2, L / 2, zInfo);
      if (!z.rialzata) { terra.scale.y = 0.06; }
      let pacc = null;
      if (z.pacciamatura) { const pm = MAT.paglia.clone(); pm.map = TEX.paglia.clone(); pm.map.needsUpdate = true; pm.map.repeat.set(LARG / 0.5, L / 0.5);
        pacc = blocco(LARG - 0.04, 0.02, L - 0.04, pm, xi, alto + 0.01, L / 2, zInfo); }
      const pozza = new T.Mesh(new T.PlaneGeometry(LARG * 0.9, L * 0.85), MAT.pozza.clone()); pozza.rotation.x = -Math.PI / 2; pozza.position.set(xi, alto + 0.03, L / 2); gruppo.add(pozza);
      // erogatori
      const ero = comp.erogatori, alaM = mat(ero === "poroso" ? 0x5a3e2b : 0x161616, {roughness: 0.6});
      const spruzzi = [];
      if (ero === "spruzzo") { for (let k = 0; k < Math.max(1, Math.round(L)); k++) { const zz = 0.5 + k * (L - 0.4) / Math.max(1, Math.round(L) - 0.5);
          cilindro(0.006, 0.3, MAT.plastNera, xi, alto + 0.15, Math.min(L - 0.1, zz), info("Micro-irrigatore", opzione("erogatori", "spruzzo").pro + " " + opzione("erogatori", "spruzzo").contro, "erogatori", trovaVoce(voci, "erogatori")));
          cilindro(0.015, 0.02, mat(0x2e6fb0), xi, alto + 0.31, Math.min(L - 0.1, zz)); spruzzi.push([xi, alto + 0.32, Math.min(L - 0.1, zz)]); } }
      else for (const dx of [-0.3, 0.3]) { tubo([[xi + dx * LARG / 1.2, alto + 0.012, 0.04], [xi + dx * LARG / 1.2, alto + 0.012, L - 0.04]], ero === "poroso" ? 0.009 : 0.008, alaM, info(opzione("erogatori", ero).nome, opzione("erogatori", ero).pro + " " + opzione("erogatori", ero).contro, "erogatori", trovaVoce(voci, "erogatori")));
        if (ero === "goccia") for (let zz = 0.15; zz < L - 0.05; zz += 0.3) cilindro(0.011, 0.012, mat(0x2b2b2b), xi + dx * LARG / 1.2, alto + 0.014, zz); }
      tubo([[xv + 0.05 + i * 0.16, yv, zv + 0.03], [xv + 0.05 + i * 0.16, 0.04, zv + 0.25], [xi - 0.25 * LARG / 1.2, 0.04, -0.2], [xi - 0.3 * LARG / 1.2, alto + 0.012, 0.04]], 0.008, MAT.pe);
      // sensori e cavi
      for (let k = 0; k < comp.sensori_zona; k++) {
        const sx = xi + 0.08 - k * 0.2, sz = L / 2 + 0.12 - k * 0.25;
        sensoreSuolo(comp.sensore_suolo, sx, alto, sz, voci, i);
        tubo([[sx, alto + 0.09, sz], [sx + 0.03, alto + 0.02, sz - 0.05], [sx + 0.03, 0.012, Math.max(-0.1, sz - 0.3)], [sx + 0.03, 0.012, -0.5], [qx, 0.012, qz + 0.4], [qx, Math.max(0.02, qy - 0.02), qz]], 0.0025, mat(0x111111));
      }
      // piante
      const passo = Math.max(interno ? 0.2 : 0.25, 1 / Math.sqrt(P.m2));
      let colN = Math.max(1, Math.floor((LARG - 0.1) / passo)), fil = Math.max(1, Math.floor((L - 0.1) / passo));
      while (colN * fil > 48) { colN = Math.max(1, colN - 1); fil = Math.max(1, Math.floor(fil * 0.85)); }
      const pos = [];
      for (let a = 0; a < colN; a++) for (let b = 0; b < fil; b++) pos.push([xi - (colN - 1) * passo / 2 + a * passo + (b % 2) * 0.02, alto + (z.pacciamatura ? 0.02 : 0.005), L / 2 - (fil - 1) * passo / 2 + b * passo, (a * 7 + b * 3) % 6, 0]);
      const cp = campo(z.coltura, pos, {info: info(P.nome, "Kc " + P.kc + " · ciclo " + P.giorni + " giorni · resa indicativa " + P.resa + " kg/m² · " + P.prezzo + " €/kg al negozio.", null)});
      gruppo.add(cp.g);
      stato.zone.push({terra: terraM, pacc, pozza, ala: alaM, campo: cp, spruzzi});
    });
    // serra o stanza
    if (amb === "serra") {
      const larg = W + 1.6, lun = zMax + 1.6, cx = x0 + W / 2, cz = zMax / 2;
      const telo = new T.Mesh(new T.CylinderGeometry(larg / 2, larg / 2, lun, 40, 1, true, Math.PI / 2, Math.PI), fisico(0xeef3f0, {transparent: true, opacity: 0.38, roughness: 0.15, side: T.DoubleSide, depthWrite: false}));
      telo.rotation.x = Math.PI / 2; telo.rotation.y = 0; telo.position.set(cx, 0, cz); telo.scale.set(1, 1, 0.85); telo.userData.info = info("Serra a tunnel", "Archi zincati e telo: niente pioggia sulle piante, +6 °C, stagione più lunga.", "ambiente", trovaVoce(voci, "ambiente", "serra"));
      telo.castShadow = false; gruppo.add(telo);
      for (let k = 0; k <= Math.ceil(lun); k++) { const zz = cz - lun / 2 + k * lun / Math.ceil(lun); const pts = [];
        for (let a = 0; a <= 16; a++) { const t = Math.PI * a / 16; pts.push([cx + Math.cos(t) * larg / 2, Math.sin(t) * larg / 2 * 0.85, zz]); }
        tubo(pts, 0.014, MAT.zincato); }
      blocco(0.8, 1.7, 0.03, fisico(0xffffff, {transparent: true, opacity: 0.15, roughness: 0.1}), cx, 0.85, cz + lun / 2);
      stato.rain = false;
    }
    if (interno) {
      c.zone.forEach((z, i) => {
        const xi = x0 + i * (LARG + VIA) + LARG / 2, L = lungh[i], h = 1.25;
        const lamp = blocco(LARG * 0.9, 0.03, L * 0.9, mat(0x2a2a2a, {metalness: 0.6, roughness: 0.4}), xi, h, L / 2, info("Luci LED da coltivazione", "Accese " + c.interno.ore_luce + " ore al giorno: la spesa più grande di corrente.", "ambiente", trovaVoce(voci, "ambiente", "led")));
        const emis = blocco(LARG * 0.86, 0.004, L * 0.86, new T.MeshStandardMaterial({color: col(0xfff6e6), emissive: col(0xfff1d6), emissiveIntensity: 2.2}), xi, h - 0.017, L / 2);
        for (const dx of [-1, 1]) tuboDritto([[xi + dx * LARG * 0.4, h, L / 2], [xi + dx * LARG * 0.4, 2.8, L / 2]], 0.002, mat(0x111111));
        const sp = new T.SpotLight(col(0xfff2dc), 6, 3, 1.0, 0.6, 1.2); sp.position.set(xi, h - 0.05, L / 2); sp.target.position.set(xi, 0, L / 2);
        gruppo.add(sp, sp.target); luciPiante.push({sp, emis});
      });
      blocco(0.3, 0.3, 0.12, mat(0x2b2b2b), x0 + W + 0.8, 1.8, -2.15, info("Ventola", "Ricambio d'aria e foglie più robuste.", "ambiente", trovaVoce(voci, "ambiente", "ventola")));
      stato.rain = false;
    }
    stato.pioggia = null;
    if (stato.rain) {
      const N = 2400, pos = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 24 + stato.centro.x, y = Math.random() * 10, z = (Math.random() - 0.5) * 18 + stato.centro.z; pos.set([x, y, z, x + 0.01, y - 0.18, z], i * 6); }
      const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      stato.pioggia = new T.LineSegments(geo, new T.LineBasicMaterial({color: col(0xc6d6e4), transparent: true, opacity: 0.5}));
      stato.pioggia.visible = false; gruppo.add(stato.pioggia);
    }
    const nSpray = 300, pos = new Float32Array(nSpray * 3);
    stato.spray = new T.Points(new T.BufferGeometry().setAttribute("position", new T.BufferAttribute(pos, 3)), new T.PointsMaterial({color: col(0xd8ecff), size: 0.015, transparent: true, opacity: 0.8}));
    stato.spray.visible = false; gruppo.add(stato.spray);
    stato.inquadrature = {
      Panoramica: [stato.centro.clone().add(new T.Vector3(2.5, 2.8 + W * 0.15, 5.4 + W * 0.45)), stato.centro.clone()],
      Quadro: [new T.Vector3(qx + 0.5, qy + 0.35, qz + 0.9), new T.Vector3(qx, qy + 0.13, qz)],
      [cist ? (interno ? "Tanica" : "Cisterna") : "Rubinetto"]: [new T.Vector3(xc + 2.2, 1.6, zc + 2.6), new T.Vector3(xc + 0.3, 0.5, zc)],
      Valvole: [new T.Vector3(xv + 0.5, 0.75, zv + 0.9), new T.Vector3(xv + 0.25, yv, zv)],
      "Zona 1": [new T.Vector3(x0 + LARG / 2 + 1.0, 1.0, lungh[0] + 0.9), new T.Vector3(x0 + LARG / 2, 0.25, lungh[0] / 2)],
    };
  }

  // ---------- costruzione dell'idroponica in garage ----------
  function costruisciIdro(c, s, voci) {
    const I = c.idro, k = capacitaIdro(c), A = I.auto, S = k.S;
    const L = k.lato, H = 2.0;
    stato = {zone: [], led: null, rain: false, pioggia: null, campi: [], luci: [], centro: new T.Vector3(0, 0.9, 0)};
    // garage
    const pav = ombre(new T.Mesh(new T.PlaneGeometry(7, 6), new T.MeshStandardMaterial({map: TEX.cemento, roughness: 0.85, metalness: 0.05})), false, true);
    pav.rotation.x = -Math.PI / 2; pav.position.set(0.5, 0, 0.6); gruppo.add(pav);
    const bl = new T.MeshStandardMaterial({map: TEX.blocchi, roughness: 0.95});
    const muro1 = blocco(7, 2.6, 0.2, bl, 0.5, 1.3, -L / 2 - 0.6, info("Garage", I.clima.garage === "isolato" ? "Garage isolato: d'inverno resta più caldo, d'estate più fresco." : "Garage non isolato: segue il clima di fuori (+3 °C).", null));
    muro1.material.map.repeat.set(3.5, 1.3);
    const m2 = blocco(0.2, 2.6, 6, bl.clone(), -L / 2 - 1.0, 1.3, 0.6); m2.material.map = TEX.blocchi.clone(); m2.material.map.needsUpdate = true; m2.material.map.repeat.set(3, 1.3);
    const porta = blocco(0.06, 2.1, 2.5, new T.MeshStandardMaterial({map: TEX.portone, roughness: 0.5, metalness: 0.3}), 3.9, 1.05, 0.9, info("Portone del garage", "", null));
    porta.material.map.repeat.set(1, 2);
    // mensola con attrezzi sul fondo
    blocco(1.4, 0.03, 0.3, MAT.legno, 2.4, 1.6, -L / 2 - 0.45); blocco(1.4, 0.03, 0.3, MAT.legno, 2.4, 1.1, -L / 2 - 0.45);
    for (let i = 0; i < 4; i++) blocco(0.18, 0.2, 0.22, mat([0xc0392b, 0x2e86c1, 0x7f8c8d, 0xd4ac0d][i]), 1.9 + i * 0.33, 1.72, -L / 2 - 0.45);
    // tenda
    const tx = 0, tz = 0;
    if (I.clima.tenda) {
      const telo = new T.MeshStandardMaterial({map: TEX.mylar, roughness: 0.35, metalness: 0.75, side: T.DoubleSide});
      const fuori = mat(0x161616, {roughness: 0.9, side: T.FrontSide});
      const inf = info("Tenda da coltivazione", "Interno riflettente: rimanda la luce sulle piante e tiene caldo e umidità dove servono.", "tenda", trovaVoce(voci, "tenda"));
      blocco(L, H, 0.01, telo, tx, H / 2, tz - L / 2, inf).receiveShadow = true;
      blocco(0.01, H, L, telo, tx - L / 2, H / 2, tz, inf);
      blocco(0.01, H, L, telo, tx + L / 2, H / 2, tz, inf);
      blocco(L, 0.01, L, telo, tx, H, tz, inf);
      blocco(L + 0.02, H + 0.01, 0.005, fuori, tx, H / 2, tz - L / 2 - 0.008); blocco(0.005, H + 0.01, L + 0.02, fuori, tx - L / 2 - 0.008, H / 2, tz); blocco(0.005, H + 0.01, L + 0.02, fuori, tx + L / 2 + 0.008, H / 2, tz);
      const rot = cilindro(0.06, L, fuori, tx, H - 0.06, tz + L / 2); rot.rotation.z = Math.PI / 2;
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tuboDritto([[tx + px * L / 2, 0, tz + pz * L / 2], [tx + px * L / 2, H, tz + pz * L / 2]], 0.01, mat(0xf0f0f0));
      blocco(L, 0.06, 0.01, fuori, tx, 0.03, tz + L / 2);
    }
    // sistema
    const res = blocco(0.55, 0.38, 0.4, mat(0x1d1d1f, {roughness: 0.55}), tx + (S.verticale ? L / 2 - 0.33 : 0.05), 0.19, tz + (S.verticale ? L / 2 - 0.28 : -0.05), info("Serbatoio " + k.serbatoio + " L", "Scuro e chiuso: con la luce crescono le alghe. Cambio completo ogni " + I.acqua.cambio_giorni + " giorni.", "serbatoio", trovaVoce(voci, "serbatoio")));
    if (S.verticale || I.sistema === "dwc" || I.sistema === "kratky") res.visible = I.sistema !== "kratky";
    const rx = res.position.x, rz = res.position.z;
    if (A.ph) { cilindro(0.006, 0.22, fisico(0xffffff, {transparent: true, opacity: 0.6}), rx - 0.15, 0.4, rz, info("Sonda pH", "Sempre immersa; si tara ogni " + A.taratura_giorni + " giorni con le soluzioni pH 4 e 7.", "sensori", trovaVoce(voci, "sensori", "ph"))); cilindro(0.009, 0.04, mat(0x2b2b2b), rx - 0.15, 0.52, rz); }
    if (A.ec) { cilindro(0.008, 0.2, mat(0x2b2b2b), rx - 0.08, 0.42, rz, info("Sonda EC", "Misura i nutrienti disciolti (mS/cm).", "sensori", trovaVoce(voci, "sensori", "ec"))); }
    if (A.temp_acqua) cilindro(0.004, 0.1, MAT.acciaio, rx, 0.4, rz - 0.1, info("Sonda temperatura acqua", "Sopra 24 °C le radici soffrono.", "sensori", trovaVoce(voci, "sensori", "ds18b20")));
    const campi = [];
    const aggiungiCampo = (coltura, pos, quota) => { const P = IDRO_PIANTE[coltura];
      const cp = campo(coltura === "microgreens" ? "microgreens" : coltura === "cavolo_riccio" ? "cavolo" : coltura, pos, {senzaOmbre: pos.length > 120, info: info(P.nome, "EC " + P.ec.join("-") + " · pH " + P.ph.join("-") + " · " + P.ppfd.join("-") + " µmol/m²/s per " + P.ore + " h · " + P.t.join("-") + " °C · UR " + P.ur.join("-") + "% · raccolta in " + P.giorni + " giorni · " + P.resa + " g per pianta. " + P.note, "colture")});
      gruppo.add(cp.g); campi.push(cp); };
    const ripartisci = (n) => { const out = []; let resto = n; k.colture.forEach((x, i) => { const q = i === k.colture.length - 1 ? resto : Math.round(n * x.quota); out.push(q); resto -= q; }); return out; };
    const lampada = (x, y, z, w, d, info0) => { blocco(w, 0.035, d, mat(0x2e2e2e, {metalness: 0.6, roughness: 0.4}), x, y, z, info0);
      const e = blocco(w * 0.94, 0.004, d * 0.9, new T.MeshStandardMaterial({color: col(I.luce.tipo === "led_viola" ? 0xd36bff : 0xfff4e2), emissive: col(I.luce.tipo === "led_viola" ? 0xb43cff : 0xffefd2), emissiveIntensity: 2.4}), x, y - 0.02, z);
      const sp = new T.SpotLight(col(I.luce.tipo === "led_viola" ? 0xd590ff : 0xfff3e0), 5, 2.2, 1.15, 0.7, 1.4); sp.position.set(x, y - 0.03, z); sp.target.position.set(x, 0, z);
      gruppo.add(sp, sp.target); stato.luci.push({sp, e}); };
    const infLuce = info(k.L.nome + " · " + k.wLuci + " W in tutto", k.ppfd + " µmol/m²/s per " + k.ore + " ore = DLI " + k.dli.toFixed(1) + " mol/m²/giorno. " + k.L.pro + " " + k.L.contro, "luce", trovaVoce(voci, "luce"));
    if (I.sistema === "torre") {
      const nT = Math.max(1, I.torri), passoT = Math.min(L / nT, 0.7);
      const quoteT = ripartisci(nT * S.piante_torre);
      let coltIdx = 0, rimasti = quoteT[0];
      const posPerColtura = k.colture.map(() => []);
      for (let t = 0; t < nT; t++) {
        const cx = tx - (nT - 1) * passoT / 2 + t * passoT, cz = tz - 0.05;
        cilindro(0.24, 0.35, mat(0x1d1d1f), cx, 0.175, cz, info("Base della torre (serbatoio)", "", "sistema", trovaVoce(voci, "sistema")));
        cilindro(0.075, 1.5, MAT.pvc, cx, 0.35 + 0.75, cz, info(S.nome, S.descr + " " + S.pro + " " + S.contro, "sistema", trovaVoce(voci, "sistema")));
        for (let l = 0; l < 9; l++) for (let j = 0; j < 4; j++) {
          const a = j * Math.PI / 2 + l * Math.PI / 4, y = 0.45 + l * 0.15;
          const cx2 = cx + Math.cos(a) * 0.085, cz2 = cz + Math.sin(a) * 0.085;
          const coppa = cilindro(0.028, 0.06, MAT.pvc, cx2, y, cz2); coppa.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
          while (rimasti <= 0 && coltIdx < k.colture.length - 1) { coltIdx++; rimasti = quoteT[coltIdx]; }
          rimasti--;
          posPerColtura[coltIdx].push([cx + Math.cos(a) * 0.11, y + 0.03, cz + Math.sin(a) * 0.11, -a + Math.PI / 2, 0.55, ((t * 37 + l * 4 + j) % 10) / 10]);
        }
        for (const lx of [-1, 1]) { const bx = cx + lx * 0.3;
          blocco(0.03, 1.4, 0.05, mat(0x2a2a2a, {metalness: 0.5}), bx, 1.05, cz, infLuce);
          const e = blocco(0.004, 1.34, 0.04, new T.MeshStandardMaterial({color: col(0xfff4e2), emissive: col(0xffefd2), emissiveIntensity: 2.4}), bx - lx * 0.016, 1.05, cz);
          const sp = new T.PointLight(col(0xfff3e0), 1.6, 1.4, 1.6); sp.position.set(bx - lx * 0.05, 1.05, cz); gruppo.add(sp); stato.luci.push({sp, e}); }
      }
      k.colture.forEach((x, i) => aggiungiCampo(x.coltura, posPerColtura[i]));
    } else {
      const piani = I.sistema === "bucket" ? 1 : k.piani;
      const prof = Math.min(L - 0.15, Math.max(0.45, I.superficie_piano / Math.max(0.6, L - 0.15)));
      const largh = Math.min(L - 0.15, I.superficie_piano / prof);
      const y0 = I.sistema === "bucket" ? 0.12 : 0.5;                 // sotto il primo ripiano c'è il serbatoio
      const hPiano = I.sistema === "bucket" ? 0 : Math.min(0.55, (H - y0 - 0.1) / piani);
      // scaffale
      if (piani > 1 || I.sistema === "nft" || I.sistema === "vassoi") {
        for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) blocco(0.03, y0 + piani * hPiano + 0.1, 0.03, MAT.zincato, tx + px * largh / 2, (y0 + piani * hPiano + 0.1) / 2, tz + pz * prof / 2 - 0.05, info("Scaffale", k.piani + " ripiani, ognuno con la sua luce.", "scaffale", trovaVoce(voci, "scaffale")));
      }
      const quoteP = ripartisci(k.piante);
      const posPerColtura = k.colture.map(() => []);
      let coltIdx = 0, rimasti = quoteP[0];
      const prossima = () => { while (rimasti <= 0 && coltIdx < k.colture.length - 1) { coltIdx++; rimasti = quoteP[coltIdx]; } rimasti--; return coltIdx; };
      for (let p = 0; p < piani; p++) {
        const y = y0 + p * hPiano, zc0 = tz - 0.05;
        if (I.sistema !== "bucket") blocco(largh, 0.02, prof, MAT.zincato, tx, y - 0.02, zc0);
        const infSist = info(S.nome, S.descr + " " + S.pro + " " + S.contro, "sistema", trovaVoce(voci, "sistema"));
        if (I.sistema === "nft") {
          const canali = Math.max(2, Math.floor(prof / 0.2));
          for (let j = 0; j < canali; j++) { const cz = zc0 - prof / 2 + 0.1 + j * (prof - 0.2) / Math.max(1, canali - 1);
            blocco(largh - 0.04, 0.055, 0.1, MAT.pvc, tx, y + 0.035, cz, infSist);
            for (let xx = -largh / 2 + 0.12; xx < largh / 2 - 0.05; xx += 0.2) { cilindro(0.025, 0.02, MAT.plastNera, tx + xx, y + 0.065, cz); if (posPerColtura.reduce((a, l) => a + l.length, 0) < k.piante) { const ci = prossima(); posPerColtura[ci].push([tx + xx, y + 0.075, cz, (j * 3 + xx * 10) % 6, 0, ((p * 31 + j * 7 + Math.round(xx * 10)) % 10) / 10]); } } }
          tubo([[rx, 0.38, rz], [rx - 0.25, y + 0.1, zc0 - prof / 2 + 0.05], [tx - largh / 2 + 0.05, y + 0.08, zc0 - prof / 2 + 0.1]], 0.007, MAT.pe);
          tuboDritto([[tx + largh / 2 - 0.02, y + 0.03, zc0 - prof / 2], [tx + largh / 2 - 0.02, y + 0.03, zc0 + prof / 2]], 0.02, MAT.pvc);
        } else if (I.sistema === "dwc" || I.sistema === "kratky") {
          blocco(largh - 0.04, 0.22, prof - 0.04, mat(0x1c1c1e, {roughness: 0.5}), tx, y + 0.11, zc0, infSist);
          const acqua = blocco(largh - 0.08, 0.005, prof - 0.08, MAT.acqua, tx, y + 0.2, zc0);
          if (I.sistema === "dwc") blocco(largh - 0.1, 0.03, prof - 0.1, mat(0xf3f3ee, {roughness: 0.8}), tx, y + 0.215, zc0, infSist);
          else blocco(largh - 0.04, 0.012, prof - 0.04, mat(0x2a2a2c), tx, y + 0.226, zc0, infSist);
          const passo = Math.max(0.15, Math.sqrt(largh * prof / Math.max(1, quoteP.reduce((a, b) => a + b, 0) / piani)));
          for (let xx = -largh / 2 + passo / 2; xx < largh / 2 - 0.04; xx += passo) for (let zz = -prof / 2 + passo / 2; zz < prof / 2 - 0.04; zz += passo) {
            if (posPerColtura.reduce((a, l) => a + l.length, 0) >= k.piante) break;
            cilindro(0.025, 0.02, MAT.plastNera, tx + xx, y + 0.235, zc0 + zz); const ci = prossima(); posPerColtura[ci].push([tx + xx, y + 0.24, zc0 + zz, (xx * 13 + zz * 7) % 6, 0, ((p * 13 + Math.round(xx * 20 + zz * 30)) % 10 + 10) % 10 / 10]); }
          if (I.sistema === "dwc") tubo([[tx + largh / 2 + 0.1, 0.08, zc0 + prof / 2], [tx + largh / 2 - 0.1, y + 0.25, zc0], [tx + largh / 2 - 0.15, y + 0.1, zc0]], 0.003, fisico(0xffffff, {transparent: true, opacity: 0.6}));
        } else if (I.sistema === "bucket") {
          tuboDritto([[tx - largh / 2, 0.09, zc0], [tx + largh / 2, 0.09, zc0]], 0.025, MAT.pvc, infSist);
          const nB = Math.max(1, I.secchi), pb = largh / nB;
          for (let b = 0; b < nB; b++) { const bx = tx - largh / 2 + pb / 2 + b * pb;
            const sec = new T.Mesh(new T.CylinderGeometry(0.15, 0.12, 0.3, 4, 1), mat(0x1c1c1e)); sec.rotation.y = Math.PI / 4; sec.position.set(bx, 0.27, zc0); sec.castShadow = true; sec.userData.info = infSist; gruppo.add(sec);
            blocco(0.2, 0.01, 0.2, mat(0xe9e4d8, {roughness: 1}), bx, 0.415, zc0);
            tuboDritto([[bx, 0.43, zc0], [bx, H - 0.05, zc0]], 0.0012, mat(0xe8e2cf));
            const ci = prossima(); posPerColtura[ci].push([bx, 0.42, zc0, b, 0, (b * 3 % 10) / 10]); }
          tuboDritto([[tx - largh / 2, 0.5, zc0 - 0.12], [tx + largh / 2, 0.5, zc0 - 0.12]], 0.006, MAT.pe);
        } else if (I.sistema === "vassoi") {
          const vx = Math.max(1, Math.floor(largh / 0.52)), vz = Math.max(1, Math.floor(prof / 0.27));
          for (let a = 0; a < vx; a++) for (let b = 0; b < vz; b++) { const px = tx - (vx - 1) * 0.26 + a * 0.52, pz = zc0 - (vz - 1) * 0.135 + b * 0.27;
            blocco(0.5, 0.045, 0.25, mat(0x111111), px, y + 0.022, pz, infSist); blocco(0.48, 0.008, 0.23, mat(0xe8e2d0, {roughness: 1}), px, y + 0.046, pz);
            const ci = prossima(); const fase = ((p * 7 + a * 3 + b) % 10) / 10;
            for (let q = 0; q < 70; q++) posPerColtura[ci].push([px - 0.23 + (q % 10) * 0.051, y + 0.05, pz - 0.105 + Math.floor(q / 10) * 0.035, q, 0, fase]); }
        }
        // luce del ripiano
        const yl = I.sistema === "bucket" ? H - 0.25 : y + hPiano - 0.06;
        lampada(tx, yl, tz - 0.05, largh * 0.9, prof * 0.85, infLuce);
        tuboDritto([[tx - largh * 0.4, yl, tz - 0.05], [tx - largh * 0.4, Math.min(H, yl + 0.2), tz - 0.05]], 0.0015, mat(0x111111));
        tuboDritto([[tx + largh * 0.4, yl, tz - 0.05], [tx + largh * 0.4, Math.min(H, yl + 0.2), tz - 0.05]], 0.0015, mat(0x111111));
      }
      k.colture.forEach((x, i) => aggiungiCampo(x.coltura, posPerColtura[i]));
    }
    // clima
    if (I.clima.estrattore) { const e = cilindro(0.06, 0.2, mat(0x2f3134, {metalness: 0.5}), tx - L / 2 + 0.2, H - 0.15, tz - L / 2 + 0.2, info("Estrattore in linea", "Toglie caldo e umidità; termostato a " + (Math.min(...k.colture.map(x => x.P.t[1])) - 1) + " °C.", "clima", trovaVoce(voci, "clima", "estrattore"))); e.rotation.z = Math.PI / 2;
      const pts = []; for (let i = 0; i <= 12; i++) pts.push([tx - L / 2 + 0.1 - i * 0.05, H - 0.15 + Math.sin(i / 12 * Math.PI) * 0.15, tz - L / 2 + 0.2 - i * 0.02]);
      tubo(pts, 0.05, mat(0xc9ccd0, {metalness: 0.7, roughness: 0.35})); }
    if (I.clima.circolazione) { cilindro(0.08, 0.02, mat(0x222222), tx + L / 2 - 0.12, 1.4, tz, info("Ventilatore a clip", "Aria che si muove: steli robusti, niente muffe; aiuta l'impollinazione.", "clima", trovaVoce(voci, "clima", "ventilatore"))).rotation.z = Math.PI / 2; }
    if (I.clima.riscaldamento === "stufetta") blocco(0.3, 0.35, 0.18, mat(0xe9e9e4, {roughness: 0.5}), tx + L / 2 + 0.45, 0.175, tz + 0.2, info("Termoventilatore 1000 W", "Con termostato a " + I.clima.t_min + " °C: d'inverno è la seconda spesa di corrente.", "clima", trovaVoce(voci, "clima", "termoventilatore")));
    if (I.clima.deumidificatore) blocco(0.32, 0.5, 0.22, mat(0xf2f2ee, {roughness: 0.5}), tx - L / 2 - 0.45, 0.25, tz + 0.6, info("Deumidificatore", "", "clima", trovaVoce(voci, "clima", "deumidificatore")));
    // stazione di controllo a parete
    const wx = tx + L / 2 + 0.55, wz = -L / 2 - 0.48;
    blocco(0.9, 0.7, 0.02, MAT.legno, wx + 0.1, 1.15, wz, null);
    const q = A.micro === "nessuno" ? null : quadro(c, wx - 0.12, 1.0, wz + 0.09, 0, voci, A.micro);
    stato.led = q ? q.led : null;
    if (!q) { blocco(0.07, 0.12, 0.06, mat(0xf2f2ee), wx - 0.1, 1.2, wz + 0.04, info("Timer da presa", "Senza elettronica: accende e spegne luci" + (["nft", "torre", "bucket"].includes(I.sistema) ? " e pompa" : "") + " a orario. Controlli tu livello, pH, EC e temperature.", "alimentazione", trovaVoce(voci, "alimentazione", "timer")));
      blocco(0.06, 0.1, 0.02, mat(0xffffff), wx + 0.05, 1.3, wz + 0.02, info("Termometro minima/massima", "Ti dice quanto caldo e freddo ha fatto in tenda dall'ultima volta.", "sensori", trovaVoce(voci, "sensori", "termometro"))); }
    if (A.dosaggio) for (let i = 0; i < 3; i++) { blocco(0.06, 0.08, 0.05, mat(0x2f6fb0), wx + 0.2 + i * 0.09, 1.35, wz + 0.04, info("Pompe dosatrici peristaltiche", "A, B e pH- a piccole dosi, poi aspettano che la soluzione si mescoli.", "dosaggio", trovaVoce(voci, "dosaggio", "peristaltiche")));
      const fl = cilindro(0.04, 0.2, fisico([0x3b78c4, 0xc0392b, 0xe6c229][i], {transparent: true, opacity: 0.75, roughness: 0.2}), wx + 0.2 + i * 0.09, 0.9, wz + 0.1, info(["Nutriente A", "Nutriente B", "Correttore pH-"][i], NUTRIENTI[I.nutrienti].nome, "nutrienti", trovaVoce(voci, "nutrienti")));
      tubo([[wx + 0.2 + i * 0.09, 1.0, wz + 0.1], [wx + 0.2 + i * 0.09, 1.3, wz + 0.06]], 0.003, fisico(0xffffff, {transparent: true, opacity: 0.6})); }
    blocco(0.06, 0.16, 0.6, mat(0xf4f4f0), wx + 0.25, 1.7, wz + 0.05, info("Ciabatta con magnetotermico e prese smart", "Sollevata da terra: mai prese sul pavimento vicino all'acqua.", "alimentazione", trovaVoce(voci, "alimentazione", "prese"))).rotation.y = Math.PI / 2;
    if (A.ups) blocco(0.14, 0.22, 0.32, mat(0x2a2a2a), wx + 0.55, 0.11, wz + 0.25, info("UPS", "Tiene accese pompa ed elettronica nei blackout brevi.", "ups", trovaVoce(voci, "ups")));
    if (A.perdita) for (const [lx, lz] of [[rx, rz + 0.3], [tx - 0.2, tz + L / 2 + 0.1]]) cilindro(0.025, 0.012, mat(0xf2f2ee), lx, 0.006, lz, info("Sensore di perdita", "Se c'è acqua sul pavimento spegne pompe e prese.", "sensori", trovaVoce(voci, "sensori", "perdita")));
    if (I.acqua.osmosi) for (let i = 0; i < 3; i++) cilindro(0.045, 0.3, fisico(0x9fc6e8, {transparent: true, opacity: 0.7}), -L / 2 - 0.85 + i * 0.12, 0.9, -L / 2 - 0.4, info("Osmosi inversa", "Acqua quasi pura; scarta 2-3 litri per ogni litro buono.", "acqua", trovaVoce(voci, "acqua", "osmosi")));
    cavoGarage(rx, rz, wx, wz);
    stato.campi = campi;
    stato.inquadrature = {
      Tenda: [new T.Vector3(tx + 1.7, 1.7, tz + L / 2 + 3.1), new T.Vector3(tx + 0.2, 0.9, tz)],
      Piante: [new T.Vector3(tx + 0.4, 0.9, tz + L / 2 + 0.7), new T.Vector3(tx, 0.6, tz)],
      "Serbatoio e sonde": [new T.Vector3(rx + 0.6, 0.9, rz + 0.9), new T.Vector3(rx, 0.3, rz)],
      Controllo: [new T.Vector3(wx + 0.2, 1.3, wz + 1.2), new T.Vector3(wx + 0.1, 1.15, wz)],
      Garage: [new T.Vector3(3.2, 2.2, 4.2), new T.Vector3(0.3, 0.8, 0)],
    };
  }
  function cavoGarage(rx, rz, wx, wz) { tubo([[rx, 0.4, rz], [rx + 0.2, 0.5, rz - 0.1], [wx - 0.2, 0.8, wz + 0.1], [wx - 0.12, 1.0, wz + 0.1]], 0.003, mat(0x111111)); }

  // ---------- luce del giorno e stato giornaliero ----------
  let oraCorrente = 11, simCorrente = null, cfgCorrente = null;
  const tmpC = new T.Color();
  function impostaOra(h) {
    oraCorrente = h;
    const esterno = modo === "orto" && cfgCorrente && cfgCorrente.ambiente !== "interno";
    const elev = Math.max(-0.2, Math.sin((h - 6) / 12 * Math.PI)), az = (h - 12) / 12 * Math.PI;
    const centro = stato.centro || new T.Vector3();
    sole.position.set(centro.x + Math.sin(az) * 14, Math.max(0.5, elev * 16), centro.z + Math.cos(az) * 10);
    sole.target.position.copy(centro);
    const giorno = Math.max(0, elev);
    const caldo = 1 - Math.min(1, giorno * 2.2);
    tmpC.setRGB(1, 0.92 - caldo * 0.25, 0.82 - caldo * 0.45);
    sole.color.copy(tmpC);
    const pioggia = simCorrente && modo === "orto" && simCorrente.giorni[giornoCorrente] && simCorrente.giorni[giornoCorrente].pioggia > 1;
    sole.intensity = esterno ? (pioggia ? 0.5 : 2.6) * Math.min(1, giorno * 3) : modo === "idro" ? 0.25 : 0.6 * Math.min(1, giorno * 3);
    emi.intensity = esterno ? 0.25 + 0.4 * Math.min(1, giorno * 2) : modo === "idro" ? 0.35 : 0.45;
    const alto = pioggia ? 0x8a949c : giorno < 0.15 ? 0x2b3d5c : 0x4f86c6, oriz = pioggia ? 0xb7bec4 : giorno < 0.15 ? 0xe0a070 : 0xdfe9f2;
    cieloMat.uniforms.alto.value.copy(col(alto)); cieloMat.uniforms.orizzonte.value.copy(col(oriz));
    scena.fog.color.copy(col(oriz));
    if (modo === "idro") { scena.fog.near = 12; scena.fog.far = 30; } else { scena.fog.near = 30; scena.fog.far = 110; }
    aggiornaRiflessi();
    aggiornaLuciPiante();
  }
  function luciAccese() {
    if (!cfgCorrente) return false;
    if (modo === "idro") {
      const k = capacitaIdro(cfgCorrente), notte = cfgCorrente.idro.luce.notte, inizio = notte ? 20 : 6;
      const h = (oraCorrente - inizio + 24) % 24;
      const g = simCorrente && simCorrente.giorni[giornoCorrente];
      return h < k.ore && !(g && g.blackout >= 12);
    }
    if (cfgCorrente.ambiente === "interno") return ((oraCorrente - 6 + 24) % 24) < cfgCorrente.interno.ore_luce;
    return false;
  }
  function aggiornaLuciPiante() {
    const on = luciAccese();
    for (const l of [...luciPiante, ...(stato.luci || [])]) { l.sp.visible = on; l.e.material.emissiveIntensity = on ? 2.4 : 0; }
  }
  const SECCO = col(0xb08d62), BAGNATO = col(0x4a3524), INCOLTO = col(0x9a8466);
  let giornoCorrente = 196;
  function mostraGiorno(d) {
    giornoCorrente = d;
    if (!simCorrente || !cfgCorrente) return;
    const g = simCorrente.giorni[d];
    if (modo === "orto") {
      const piove = g.pioggia > 1;
      if (stato.pioggia) stato.pioggia.visible = piove;
      stato.zone.forEach((z, i) => {
        const u = g.umid[i];
        z.terra.color.copy(u == null ? INCOLTO : SECCO.clone().lerp(BAGNATO, Math.min(1, u)));
        if (z.pacc) z.pacc.material.color.copy(col(0xc9b48a).lerp(col(0x6e5c3c), u == null ? 0 : Math.min(1, u) * 0.6));
        z.pozza.material.opacity = Math.min(0.75, g.acquaFerma[i] * 1.3);
        z.ala.emissive.copy(g.irrigata[i] ? col(0x0d3a70) : col(0x000000));
        z.campo.aggiorna(g.crescita[i], u != null, false);
      });
      stato.sprayAttivo = stato.zone.some((z, i) => g.irrigata[i] && z.spruzzi.length);
      if (stato.cisterna && stato.cisterna.vasche) { const cap = cfgCorrente.acqua.cisterna_l, n = stato.cisterna.vasche.length;
        stato.cisterna.vasche.forEach((v, k) => { const quota = Math.max(0.01, Math.min(1, g.cisterna / cap * n - k)); const h = quota * stato.cisterna.h; v.scale.y = Math.max(0.01, h); v.position.y = stato.cisterna.fondo + h / 2; }); }
      if (stato.pompa) stato.pompa.material.emissive = g.litri > 0 ? col(0x10305c) : col(0x000000);
    } else {
      stato.campi.forEach(cp => cp.aggiorna((d % 365) / 30 % 1, true, true));
    }
    const crit = g.allarmi && g.allarmi.some(a => /SPENTO|QUADRO|SERBATOIO_BASSO|RIAVVII|POMPA|PERDITA|PH_FUORI|LUCE/.test(a)) || g.acceso === false;
    const colLed = crit ? 0xef4444 : g.allarmi && g.allarmi.length ? 0xf59e0b : 0x22c55e;
    if (stato.led) { stato.led.material.color.copy(col(colLed)); stato.led.material.emissive.copy(col(colLed)); }
    impostaOra(oraCorrente);
  }
  function costruisci(c, s, voci) {
    cfgCorrente = c; simCorrente = s; modo = c.modalita === "idro" ? "idro" : "orto";
    if (!TEX.prato) { texture(); materiali(); }
    svuota();
    if (modo === "idro") costruisciIdro(c, s, voci); else costruisciOrto(c, s, voci);
    cielo.visible = modo === "orto";
    scena.background = modo === "idro" ? col(0x1b1d1f) : null;
    if (!costruisci.chiave || costruisci.chiave !== modo + (c.ambiente || "")) { inquadra(Object.keys(stato.inquadrature)[0], true); costruisci.chiave = modo + (c.ambiente || ""); }
    mostraGiorno(giornoCorrente);
  }
  // ---------- inquadrature ----------
  let volo = null;
  function inquadra(nome, subito) {
    const q = stato.inquadrature && stato.inquadrature[nome]; if (!q) return;
    if (subito) { camera.position.copy(q[0]); controlli.target.copy(q[1]); return; }
    volo = {da: camera.position.clone(), a: q[0].clone(), tda: controlli.target.clone(), ta: q[1].clone(), t: 0};
  }
  // ---------- clic ----------
  const ray = new T.Raycaster(), pt = new T.Vector2();
  let giu = null, alClic = null;
  renderer.domElement.addEventListener("pointerdown", e => giu = [e.clientX, e.clientY]);
  renderer.domElement.addEventListener("pointerup", e => {
    if (!giu || Math.hypot(e.clientX - giu[0], e.clientY - giu[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    pt.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(pt, camera);
    const hit = ray.intersectObjects(gruppo.children, true).find(h => h.object.userData.info || (h.object.parent && h.object.parent.userData.info));
    if (alClic) alClic(hit ? (hit.object.userData.info || hit.object.parent.userData.info) : null);
  });
  function dimensiona() { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(dimensiona).observe(box);
  let visibile = true; new IntersectionObserver(v => visibile = v[0].isIntersecting).observe(box);
  const ridotto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ultimo = 0, alTick = null;
  function ciclo(t) {
    requestAnimationFrame(ciclo);
    const dt = Math.min(0.1, (t - ultimo) / 1000); ultimo = t;
    if (!visibile || document.hidden) return;
    if (alTick) alTick(dt);
    if (volo) { volo.t = Math.min(1, volo.t + dt * 1.2); const e = volo.t < 0.5 ? 2 * volo.t * volo.t : 1 - Math.pow(-2 * volo.t + 2, 2) / 2;
      camera.position.lerpVectors(volo.da, volo.a, e); controlli.target.lerpVectors(volo.tda, volo.ta, e); if (volo.t >= 1) volo = null; }
    if (stato.pioggia && stato.pioggia.visible && !ridotto) { const a = stato.pioggia.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 6) { a[i + 1] -= dt * 9; a[i + 4] -= dt * 9; if (a[i + 4] < 0) { a[i + 1] += 10; a[i + 4] += 10; } } stato.pioggia.geometry.attributes.position.needsUpdate = true; }
    if (stato.spray) { stato.spray.visible = !!stato.sprayAttivo && !ridotto;
      if (stato.spray.visible) { const a = stato.spray.geometry.attributes.position.array, sorg = stato.zone.flatMap(z => z.spruzzi);
        for (let i = 0; i < a.length / 3; i++) { const s0 = sorg[i % sorg.length], ang = Math.random() * 6.28, rr = Math.random() * 0.5; a[i * 3] = s0[0] + Math.cos(ang) * rr; a[i * 3 + 1] = s0[1] + Math.random() * 0.12 - rr * 0.25; a[i * 3 + 2] = s0[2] + Math.sin(ang) * rr; }
        stato.spray.geometry.attributes.position.needsUpdate = true; } }
    controlli.update(); renderer.render(scena, camera);
  }
  dimensiona(); requestAnimationFrame(ciclo);
  return {
    costruisci, mostraGiorno, impostaOra, inquadra,
    inquadrature: () => Object.keys(stato.inquadrature || {}),
    alClic: f => alClic = f, alTick: f => alTick = f,
    luciAccese,
  };
})();
