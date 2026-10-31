"use strict";
// Motore dell'orto minuto per minuto: traduzione riga per riga di sistema/controllo.py (la logica che gira sull'ESP32,
// fonte autorevole unica) e di sistema/modello.py (il mondo: terreno, pioggia, cisterna, pompa, sensori, guasti).
// Il gemello lo usa per l'irrigazione al posto della vecchia stima giornaliera, così browser e Python danno gli stessi
// eventi sugli stessi ingressi. Il contratto è test/contratti/irrigazione.json (generato da sistema/differenziale.py).
// Se cambi una riga qui, cambiala anche in Python e rigenera il contratto.

const PARAMETRI_ORTO = {
  soglia_on: 0.45, soglia_off: 0.70, soglia_critica: 0.30, max_min: 10, pausa_min: 60, attesa_avvio_min: 2,
  adc_secco: 3000, adc_bagnato: 1300, adc_min_valido: 200, adc_max_valido: 4000, pioggia_salta_mm: 3.0, filtro: 0.3,
  verifica_dopo_min: 8, aumento_minimo: 0.02, verifica_pompa_min: 8, calo_minimo_l: 1.0, emergenza_ogni_min: 1440,
  emergenza_durata_min: 3, gelo_c: 2.0, caldo_c: 38.0, blocco_gelo: true, portata_nominale_l_min: 1.0,
  flusso_verifica_min: 2, flusso_min_rel: 0.3, flusso_max_rel: 1.6, acqua_inattesa: 0.08, inattesa_max: 0.85,
  allagata_ore: 6, soglia_allagata: 0.95, riserva_l: null, soglia_on_riserva: 0.35, soglia_off_riserva: 0.55,
  batteria_min_pompa: 0.35, riavvii_max: 3,
};
const nnull = v => v === undefined ? null : v;

class Controllore {
  constructor(nZone, parametri, memoria) {
    const p = Object.assign({}, PARAMETRI_ORTO, parametri || {});
    if (p.verifica_pompa_min >= p.max_min) throw new Error("verifica_pompa_min deve essere minore di max_min");
    this.p = p; this.n = nZone; this.avvio = null; this.zona = null; this.inizio = 0; this.emergenza = false;
    this.verificato = false; this.flusso_verificato = false; this.u_inizio = 0; this.l_inizio = null;
    const vuoto = v => Array(nZone).fill(v);
    this.ultima_fine = vuoto(null); this.ultimo_emergenza = vuoto(null); this.u_rif = vuoto(null); this.uf = vuoto(null);
    this.da_verificare = null; this.ore_bagnata = vuoto(0); this.bloccata = vuoto(false); this.perdita = vuoto(false);
    this.pompa_bloccata = false; this.acqua_inattesa = null; this.fermo_riavvii = false; this.ultima_pioggia = null;
    this.con_memoria = memoria != null; this.pompa_in_corso = false; this.riavvii_pompa = 0; this.memoria_cambiata = false;
    if (memoria != null) {
      const lista = (v, base) => { const a = (v || base).slice(0, nZone); while (a.length < nZone) a.push(false); return a; };
      this.bloccata = lista(memoria.bloccata, this.bloccata);
      this.perdita = lista(memoria.perdita, this.perdita);
      this.pompa_bloccata = memoria.pompa_bloccata || false;
      this.acqua_inattesa = nnull(memoria.acqua_inattesa);
      this.riavvii_pompa = (memoria.riavvii_pompa || 0) + (memoria.pompa_in_corso ? 1 : 0);
      this.fermo_riavvii = memoria.fermo_riavvii || this.riavvii_pompa >= p.riavvii_max;
      this.memoria_cambiata = true;
    }
  }
  memoria() {
    this.memoria_cambiata = false;
    return {bloccata: this.bloccata.slice(), perdita: this.perdita.slice(), pompa_bloccata: this.pompa_bloccata,
            acqua_inattesa: this.acqua_inattesa, pompa_in_corso: this.pompa_in_corso, riavvii_pompa: this.riavvii_pompa,
            fermo_riavvii: this.fermo_riavvii};
  }
  umidita(adc) {
    const p = this.p;
    if (adc == null || adc < p.adc_min_valido || adc > p.adc_max_valido) return null;
    const u = (p.adc_secco - adc) / (p.adc_secco - p.adc_bagnato);
    return Math.min(Math.max(u, 0.0), 1.0);
  }
  reset() {
    const vuoto = v => Array(this.n).fill(v);
    this.bloccata = vuoto(false); this.perdita = vuoto(false); this.pompa_bloccata = false; this.acqua_inattesa = null;
    this.fermo_riavvii = false; this.riavvii_pompa = 0; this.u_rif = vuoto(null); this.memoria_cambiata = true;
  }
  _ferma(minuto) {
    this.ultima_fine[this.zona] = minuto; this.zona = null; this.pompa_in_corso = false;
    if (minuto - this.inizio >= 2) this.riavvii_pompa = 0;
    this.memoria_cambiata = true;
  }
  _in_pausa(i, minuto) { const f = this.ultima_fine[i]; return f != null && minuto - f < this.p.pausa_min; }
  passo(L) {
    const p = this.p, m = L.minuto;
    if (this.avvio == null) { this.avvio = m; if (this.con_memoria) this.ultima_fine = Array(this.n).fill(m); }
    const u = new Array(L.adc.length);
    for (let i = 0; i < L.adc.length; i++) {
      const grezza = this.umidita(L.adc[i]);
      if (grezza == null) this.uf[i] = null;
      else if (this.uf[i] == null) this.uf[i] = grezza;
      else this.uf[i] += (grezza - this.uf[i]) * p.filtro;
      u[i] = this.uf[i];
    }
    const basso = L.serbatoio_basso || false, litri = nnull(L.serbatoio_l), flusso = nnull(L.flusso_l_min);
    const allagamento = L.allagamento || false, batteria = nnull(L.batteria), t = nnull(L.temp_c);
    const attive = L.zone_attive || Array(this.n).fill(true);
    const gelo = t != null && t <= p.gelo_c;
    let pioggia = (L.pioggia_prevista_mm != null ? L.pioggia_prevista_mm : 0.0) >= p.pioggia_salta_mm;
    const piove_ora = !!L.pioggia_in_corso;
    if (piove_ora) this.ultima_pioggia = m;
    pioggia = pioggia || piove_ora;
    const batteria_bassa = batteria != null && batteria < p.batteria_min_pompa;
    const riserva = p.riserva_l != null && litri != null && litri < p.riserva_l;
    const soglia_on = riserva ? p.soglia_on_riserva : p.soglia_on, soglia_off = riserva ? p.soglia_off_riserva : p.soglia_off;
    for (let i = 0; i < this.n; i++) {
      if (u[i] == null) { if (this.ultimo_emergenza[i] == null) this.ultimo_emergenza[i] = m; }
      else this.ultimo_emergenza[i] = null;
    }
    // 0. acqua inattesa
    const pioggia_nota = L.pioggia_in_corso != null;
    const pioggia_recente = this.ultima_pioggia != null && m - this.ultima_pioggia < 180;
    for (let i = 0; i < this.n; i++) {
      if (!pioggia_nota || pioggia_recente || u[i] == null || i === this.zona || this._in_pausa(i, m)) { this.u_rif[i] = null; continue; }
      if (this.u_rif[i] == null || u[i] < this.u_rif[i]) this.u_rif[i] = u[i];
      else if (p.acqua_inattesa > 0 && u[i] - this.u_rif[i] >= p.acqua_inattesa && this.acqua_inattesa == null) {
        this.acqua_inattesa = i; this.memoria_cambiata = true;
      }
    }
    const k = this.acqua_inattesa;
    const troppo_bagnata = k != null && (u[k] == null || u[k] >= p.inattesa_max);
    // 1. irrigazione in corso: condizioni di arresto
    const z = this.zona;
    if (z != null) {
      const durata = m - this.inizio;
      if (basso || this.pompa_bloccata || allagamento || batteria_bassa || troppo_bagnata || this.fermo_riavvii || (gelo && p.blocco_gelo)) this._ferma(m);
      else if (this.emergenza) { if (durata >= p.emergenza_durata_min || u[z] != null) this._ferma(m); }
      else if (u[z] == null || !attive[z]) this._ferma(m);
      else if (u[z] >= soglia_off) this._ferma(m);
      else if (durata >= p.max_min) { this.da_verificare = [z, this.u_inizio, m]; this._ferma(m); }
      if (this.zona != null && flusso != null && !this.flusso_verificato && durata >= p.flusso_verifica_min) {
        this.flusso_verificato = true;
        if (flusso < p.flusso_min_rel * p.portata_nominale_l_min) { this.pompa_bloccata = true; this.memoria_cambiata = true; this._ferma(m); }
        else if (flusso > p.flusso_max_rel * p.portata_nominale_l_min) { this.perdita[z] = true; this.memoria_cambiata = true; this._ferma(m); }
      }
      if (this.zona != null && !this.verificato && durata >= p.verifica_pompa_min) {
        this.verificato = true;
        const misura_valida = litri != null && this.l_inizio != null && litri <= this.l_inizio + 0.5
          && !(this.ultima_pioggia != null && this.ultima_pioggia >= this.inizio);
        if (flusso == null && misura_valida && this.l_inizio - litri < p.calo_minimo_l) {
          this.pompa_bloccata = true; this.memoria_cambiata = true; this._ferma(m); this.da_verificare = null;
        }
      }
    }
    // 1b. verifica di efficacia
    if (this.da_verificare != null && m - this.da_verificare[2] >= p.verifica_dopo_min) {
      const [zv, u0] = this.da_verificare;
      this.da_verificare = null;
      if (u[zv] != null && u[zv] - u0 < p.aumento_minimo) { this.bloccata[zv] = true; this.memoria_cambiata = true; }
    }
    // 2. avvio di una nuova irrigazione: la zona più secca tra quelle che ne hanno bisogno
    if (this.zona == null && !basso && !this.pompa_bloccata && !allagamento && !batteria_bassa && !troppo_bagnata
        && !this.fermo_riavvii && !(gelo && p.blocco_gelo) && m - this.avvio >= p.attesa_avvio_min) {
      let scelta = null;
      for (let i = 0; i < this.n; i++) {
        if (this.bloccata[i] || this.perdita[i] || this._in_pausa(i, m) || !attive[i]) continue;
        let cand;
        if (u[i] == null) {
          if (p.emergenza_durata_min > 0 && !pioggia && m - this.ultimo_emergenza[i] >= p.emergenza_ogni_min) cand = [2.0, i, true];
          else continue;
        } else if (u[i] < (pioggia ? p.soglia_critica : soglia_on)) cand = [u[i], i, false];
        else continue;
        if (scelta == null || cand[0] < scelta[0] || (cand[0] === scelta[0] && cand[1] < scelta[1])) scelta = cand;
      }
      if (scelta != null) {
        this.zona = scelta[1]; this.emergenza = scelta[2];
        this.inizio = m; this.verificato = false; this.flusso_verificato = false;
        this.u_inizio = u[this.zona] || 0.0; this.l_inizio = litri;
        this.pompa_in_corso = true; this.memoria_cambiata = true;
        if (this.emergenza) this.ultimo_emergenza[this.zona] = m;
      }
    }
    for (let i = 0; i < this.n; i++) {
      if (u[i] != null && u[i] >= p.soglia_allagata) { if (m % 60 === 0) this.ore_bagnata[i] += 1; }
      else this.ore_bagnata[i] = 0;
    }
    const allarmi = [];
    for (let i = 0; i < this.n; i++) {
      if (u[i] == null) allarmi.push("Z" + (i + 1) + "_SENSORE");
      if (this.bloccata[i]) allarmi.push("Z" + (i + 1) + "_INEFFICACE");
      if (this.perdita[i]) allarmi.push("Z" + (i + 1) + "_PERDITA");
      if (this.ore_bagnata[i] >= p.allagata_ore) allarmi.push("Z" + (i + 1) + "_ALLAGATA");
    }
    if (basso) allarmi.push("SERBATOIO_BASSO"); else if (riserva) allarmi.push("SERBATOIO_RISERVA");
    if (this.pompa_bloccata) allarmi.push("POMPA_NON_EROGA");
    if (this.acqua_inattesa != null) allarmi.push("Z" + (this.acqua_inattesa + 1) + "_ACQUA_INATTESA");
    if (allagamento) allarmi.push("ALLAGAMENTO_QUADRO");
    if (batteria_bassa) allarmi.push("BATTERIA_BASSA");
    if (this.fermo_riavvii) allarmi.push("RIAVVII_FREQUENTI");
    if (gelo) allarmi.push("GELO");
    if (t != null && t >= p.caldo_c) allarmi.push("CALDO");
    const stato = [];
    for (let i = 0; i < this.n; i++) {
      if (i === this.zona) stato.push(this.emergenza ? "emergenza" : "irriga");
      else if (this.bloccata[i] || this.perdita[i]) stato.push("bloccata");
      else if (u[i] == null) stato.push("sensore_guasto");
      else if (this._in_pausa(i, m)) stato.push("pausa");
      else stato.push("attesa");
    }
    const valvole = new Array(this.n);
    for (let i = 0; i < this.n; i++) valvole[i] = i === this.zona;
    return {pompa: this.zona != null, valvole, umidita: u, allarmi, stato};
  }
}

class ControlloreTimer {
  constructor(nZone, oraMin = 420, durataMin = 15) { this.n = nZone; this.ora = oraMin; this.durata = durataMin; }
  passo(L) {
    const m = L.minuto, dal = m % 1440 - this.ora;
    let zona = null;
    if (this.durata > 0 && dal >= 0 && dal < this.durata * this.n) zona = Math.floor(dal / this.durata);
    const basso = L.serbatoio_basso || false, allagamento = L.allagamento || false;
    if (basso || allagamento) zona = null;
    const allarmi = [];
    if (basso) allarmi.push("SERBATOIO_BASSO");
    if (allagamento) allarmi.push("ALLAGAMENTO_QUADRO");
    return {pompa: zona != null, valvole: Array.from({length: this.n}, (_, i) => i === zona), umidita: Array(this.n).fill(null),
            allarmi, stato: Array.from({length: this.n}, (_, i) => i === zona ? "irriga" : "attesa")};
  }
}

const ORE_SOLE_MESE_ORTO = {1: 2.5, 2: 3.2, 3: 4.3, 4: 5.2, 5: 6.2, 6: 7.0, 7: 7.3, 8: 6.5, 9: 5.2, 10: 3.8, 11: 2.7, 12: 2.2};
function orePioggiaOrto(g) {
  if (g.ore_pioggia) return g.ore_pioggia;
  return g.pioggia > 0 ? {14: g.pioggia / 3, 15: g.pioggia / 3, 16: g.pioggia / 3} : {};
}

class MondoOrto {
  constructor(zone, meteo, o = {}) {
    const d = (k, v) => o[k] !== undefined ? o[k] : v;
    this.zone = zone.map(z0 => {
      const z = Object.assign({}, z0);
      if (z.capacita_mm == null) z.capacita_mm = 60.0;
      if (z.drenaggio_mm_h == null) z.drenaggio_mm_h = 8.0;
      z.acqua = z.capacita_mm * (z.umidita != null ? z.umidita : 0.6);
      z.superficie = 0.0;
      z.letta = 0.92 * z.acqua / z.capacita_mm;
      if (z.efficienza == null) z.efficienza = 1.0;
      if (z.bias == null) z.bias = 0.0;
      if (z.attiva == null) z.attiva = true;
      if (z.portata_l_min == null) z.portata_l_min = o.portata_l_min !== undefined ? o.portata_l_min : 1.0;
      z.litri = z.persi = z.sprecati = 0.0;
      return z;
    });
    this.meteo = meteo;
    // mm per ora del giorno, calcolati una volta (stessi valori di orePioggiaOrto)
    this.oreP = meteo.map(g => { const o = orePioggiaOrto(g), a = new Float64Array(24); for (const h in o) a[+h] = o[h]; return a; });
    this.serbatoio = d("serbatoio_l", 800.0); this.capacita = d("capacita_serbatoio_l", 1000.0);
    this.galleggiante_l = d("galleggiante_l", 50.0); this.tetto = d("tetto_m2", 10.0); this.portata = d("portata_l_min", 1.0);
    this.sensore_livello = d("sensore_livello", true); this.flussimetro = d("flussimetro", false);
    this.sensore_pioggia = d("sensore_pioggia", true); this.escursione = d("escursione_c", 10.0);
    this.rumore = d("rumore", 1.0); this.pioggia_zone = d("pioggia_zone", true); this.rnd = mulberry32(d("seme", 1));
    this.secco = d("adc_secco", 3000); this.bagnato = d("adc_bagnato", 1300); this.tau = d("ritardo_sensore_min", 5.0);
    this.quadro_altezza = d("quadro_altezza_mm", 300.0); this.sensore_allagamento = d("sensore_allagamento_mm", null);
    this.energia = o.energia ? Object.assign({carica: 0.8, consumo_w: 0.6, pompa_w: 24.0}, o.energia, {spento: false}) : null;
    this.guasti = o.guasti || {};
    this.flusso = 0.0; this.pompa_minuti = 0; this.litri_usati = 0.0; this.litri_persi = 0.0; this.litri_dispersi = 0.0;
    this.troppo_pieno_l = 0.0; this.minuti_a_secco = 0; this.quadro_sommerso_min = 0; this.ore_spento = 0;
  }
  _guasto(nome, zona, m) { const g = this.guasti[nome]; if (!g) return false; const dal = g[zona]; return dal != null && m >= dal; }
  _gauss(sigma) { return this.rumore ? sigma * gaussDa(this.rnd) : 0.0; }
  giorno(m) { return Math.min(Math.floor(m / 1440), this.meteo.length - 1); }
  temperatura(m) {
    const g = this.meteo[this.giorno(m)], ora = (m % 1440) / 60.0;
    return g.t_media + (g.escursione != null ? g.escursione : this.escursione) / 2 * Math.sin((ora - 9) / 24 * 2 * Math.PI);
  }
  pioggia_prevista(m) {
    const g = this.giorno(m);
    let d;
    if ((m % 1440) < 14 * 60) d = this.meteo[g];
    else if (g + 1 < this.meteo.length) d = this.meteo[g + 1];
    else return 0.0;
    return d.prevista != null ? d.prevista : d.pioggia;
  }
  piove(m) { return this.oreP[this.giorno(m)][Math.floor((m % 1440) / 60)] > 0; }
  livello_acqua_a_terra() { let x = -Infinity; for (const z of this.zone) if (z.superficie > x) x = z.superficie; return x; }
  batteria() { return this.energia ? this.energia.carica : null; }
  alimentato() { return !(this.energia && this.energia.spento); }
  letture(m) {
    const adc = new Array(this.zone.length);
    for (let i = 0; i < this.zone.length; i++) {
      const z = this.zone[i];
      if (this._guasto("sensore_staccato", i, m)) adc[i] = this.rumore ? Math.floor(this.rnd() * 61) : 30;
      else if (this._guasto("sensore_fuori_terra", i, m)) adc[i] = Math.trunc(this.secco + this._gauss(15 * this.rumore));
      else {
        const v = this.secco - (z.letta + z.bias) * (this.secco - this.bagnato) + this._gauss(15 * this.rumore);
        adc[i] = Math.trunc(Math.min(Math.max(v, 0), 4095));
      }
    }
    return {minuto: m, adc, serbatoio_basso: this.serbatoio < this.galleggiante_l,
            serbatoio_l: this.sensore_livello ? this.serbatoio + this._gauss(0.2 * this.rumore) : null,
            temp_c: this.temperatura(m), pioggia_prevista_mm: this.pioggia_prevista(m),
            pioggia_in_corso: this.sensore_pioggia ? this.piove(m) : null,
            flusso_l_min: this.flussimetro ? Math.max(0.0, this.flusso + this._gauss(0.03 * this.rumore)) : null,
            allagamento: this.sensore_allagamento != null && this.livello_acqua_a_terra() >= this.sensore_allagamento,
            batteria: this.batteria(), zone_attive: this.zone.map(z => z.attiva)};
  }
  _energia(m, pompa) {
    const e = this.energia, g = this.meteo[this.giorno(m)], ora = (m % 1440) / 60.0;
    const sole = ora >= 6 && ora <= 20 ? Math.sin(Math.PI * (ora - 6) / 14) : 0.0;
    const oreSole = ORE_SOLE_MESE_ORTO[g.mese != null ? g.mese : 7];
    const produzione = e.pannello_w * 0.75 * (g.nuvoloso ? 0.2 : 1.0) * sole * oreSole / (28 / Math.PI);
    const consumo = e.spento ? 0.0 : e.consumo_w + (pompa ? e.pompa_w : 0.0);
    e.carica += (produzione * 0.9 - consumo) / 60.0 / e.batteria_wh;
    e.carica = Math.min(Math.max(e.carica, 0.0), 1.0);
    if (e.carica <= 0.0) e.spento = true;
    else if (e.spento && e.carica >= 0.15) e.spento = false;
  }
  avanza(m, comandi, alimentato = true) {
    const g = this.meteo[this.giorno(m)], ora = Math.floor((m % 1440) / 60);
    alimentato = alimentato && this.alimentato();
    const pompa = comandi.pompa && alimentato;
    const pompa_ok = !(this.guasti.pompa_guasta != null && m >= this.guasti.pompa_guasta);
    if (this.energia) this._energia(m, pompa);
    if (pompa) { this.pompa_minuti += 1; if (this.serbatoio <= 0) this.minuti_a_secco += 1; }
    const aperte = [];
    for (let i = 0; i < this.zone.length; i++)
      if ((pompa && comandi.valvole[i]) || (pompa && this._guasto("valvola_bloccata_aperta", i, m))) aperte.push(i);
    this.flusso = 0.0;
    if (pompa && pompa_ok && aperte.length && this.serbatoio > 0) {
      const scoppiato = aperte.some(i => this._guasto("tubo_scoppiato", i, m));
      let base = -Infinity;
      for (const i of aperte) if (this.zone[i].portata_l_min > base) base = this.zone[i].portata_l_min;
      let totale = base * (scoppiato ? 2.0 : 1.0 + 0.5 * (aperte.length - 1));
      totale = Math.min(totale, this.serbatoio);
      this.flusso = totale; this.serbatoio -= totale; this.litri_usati += totale;
      for (const i of aperte) {
        const parte = totale / aperte.length;
        const z = this.zone[i];
        if (this._guasto("tubo_rotto", i, m) || this._guasto("tubo_scoppiato", i, m)) { this.litri_persi += parte; z.persi += parte; }
        else {
          const eff = z.efficienza;
          this.litri_dispersi += parte * (1 - eff);
          z.litri += parte;
          z.acqua += parte * eff / z.area_m2;
          if (z.acqua > z.capacita_mm) z.sprecati += Math.min(parte * eff, (z.acqua - z.capacita_mm) * z.area_m2);
        }
      }
    }
    const mm_pioggia = this.oreP[this.giorno(m)][ora] / 60.0;
    for (const z of this.zone) {
      const u = z.acqua / z.capacita_mm;
      if (ora >= 7 && ora < 19) {
        const kc = z.kc * (z.pacciamatura ? 0.8 : 1.0);
        z.acqua -= g.et0 * kc * Math.min(1.0, u / 0.5) / (12 * 60);
      }
      if (this.pioggia_zone) z.acqua += mm_pioggia;
      if (z.acqua > z.capacita_mm) { z.superficie += z.acqua - z.capacita_mm; z.acqua = z.capacita_mm; }
      z.superficie = Math.max(0.0, z.superficie - z.drenaggio_mm_h / 60.0);
      if (z.superficie > 0) z.acqua = z.capacita_mm;
      z.acqua = Math.max(z.acqua, 0.0);
      const vista = 0.92 * z.acqua / z.capacita_mm + (z.superficie > 0 ? 0.08 : 0.0);
      z.letta += (vista - z.letta) / this.tau;
    }
    const entrata = mm_pioggia * this.tetto * 0.8;
    this.serbatoio += entrata;
    if (this.serbatoio > this.capacita) { this.troppo_pieno_l += this.serbatoio - this.capacita; this.serbatoio = this.capacita; }
    if (this.livello_acqua_a_terra() > this.quadro_altezza) this.quadro_sommerso_min += 1;
  }
  umidita_vera() { return this.zone.map(z => z.acqua / z.capacita_mm); }
  in_ristagno() { return this.zone.map(z => z.superficie > 0); }
}

// Stesso giro di sistema/differenziale.py: esegui(caso) -> eventi della pompa, allarmi, giorni, totali
function eseguiCasoOrto(caso) {
  const meteo = caso.meteo, n = caso.zone.length;
  const mondo = new MondoOrto(caso.zone, meteo, Object.assign({}, caso.mondo || {}, {rumore: 0}));
  const par = caso.parametri || {}, interruzioni = caso.interruzioni || [];
  let memoria = {}, ctrl = null, accesoPrima = false, pompaPrima = false, usatiPrima = 0.0;
  const eventi = [], allarmiEv = [], giorni = [], oreStress = Array(n).fill(0), oreRistagno = Array(n).fill(0);
  let attivi = new Set(), chiave = "";
  for (let m = 0; m < meteo.length * 1440; m++) {
    let acceso = true;
    for (const [a, d] of interruzioni) if (a <= m && m < a + d) acceso = false;
    if (acceso && !accesoPrima) {
      if (caso.timer) ctrl = new ControlloreTimer(n, caso.timer.ora_min, caso.timer.durata_min);
      else { ctrl = new Controllore(n, par, memoria); memoria = ctrl.memoria(); }
    }
    let out;
    if (acceso) { out = ctrl.passo(mondo.letture(m)); if (ctrl.memoria_cambiata) memoria = ctrl.memoria(); }
    else out = {pompa: false, valvole: Array(n).fill(false), allarmi: []};
    if (out.pompa !== pompaPrima) eventi.push([m, out.pompa ? out.valvole.indexOf(true) : -1]);
    accesoPrima = acceso; pompaPrima = out.pompa;
    mondo.avanza(m, out, acceso);
    const k = out.allarmi.join(" ");
    if (k !== chiave) {
      const nuovi = new Set(out.allarmi);
      for (const a of [...nuovi].filter(x => !attivi.has(x)).sort()) allarmiEv.push([m, a, 1]);
      for (const a of [...attivi].filter(x => !nuovi.has(x)).sort()) allarmiEv.push([m, a, 0]);
      attivi = nuovi; chiave = k;
    }
    if (m % 60 === 0) {
      const uv = mondo.umidita_vera(), r = mondo.in_ristagno();
      for (let i = 0; i < n; i++) { oreStress[i] += uv[i] < 0.30 ? 1 : 0; oreRistagno[i] += r[i] ? 1 : 0; }
    }
    if (m % 1440 === 1439) { giorni.push({litri: mondo.litri_usati - usatiPrima, umidita: mondo.umidita_vera(), serbatoio: mondo.serbatoio,
                                          zone: mondo.zone.map(z => [z.litri, z.persi, z.sprecati])}); usatiPrima = mondo.litri_usati; }
  }
  return {eventi_pompa: eventi, allarmi: allarmiEv, giorni,
          totali: {litri: mondo.litri_usati, persi: mondo.litri_persi, dispersi: mondo.litri_dispersi, pompa_minuti: mondo.pompa_minuti,
                   troppo_pieno: mondo.troppo_pieno_l, ore_stress: oreStress, ore_ristagno: oreRistagno}};
}
