# AgriTech 2.1 · Scenari di accettazione

Generato da `node strumenti/accettazione.js` il 2026-10-31. Tutti i numeri sono **simulati**: nessuno è stato confrontato con un impianto vero. Servono a controllare che il gemello dia risposte coerenti e oneste, non a promettere risultati.

## Scenario A · 20 m² di orto in terra nelle Marche, irrigazione automatica, 500 €

**Proposta:** B · Orto 14 m² a goccia · pacchetto sicuro (consigliato) · pomodoro, zucchina, lattuga, basilico

**Simulazione (un anno):** 3409 L d'acqua (1600 dal rubinetto), 69 kg di raccolto, 11,5 kWh, 0,0 giorni-zona di sofferenza, 0 eventi

**Distinta:** 24 voci, 144–261 €. Giudizio economico PROVVISORIO: il 100% della spesa iniziale poggia su prezzi stimati o vecchi.

**Costi:** 11 € all'anno, 0,75 €/kg con l'ammortamento, utile 160 € all'anno.

**Rischi:** Controllo 'acqua inattesa' spento; Nessun avviso sul telefono.
**Sensibilità:** Il giudizio (conviene) regge a ogni ipotesi presa da sola. Ipotesi che pesano di più: resa delle piante, durata dei componenti, costi iniziali.
**Affidabilità:** Acqua per l'irrigazione e decisioni della centralina NON VALIDATO con dati reali; Raccolto NON VALIDATO con dati reali; Spesa iniziale e costo al kg NON VALIDATO con dati reali.

## Scenario B · Garage di 15 m², 500 €, lattuga e basilico in idroponica

**Proposta:** A · Kratky, 60×60 cm · lattuga · led bianco full spectrum · senza tenda (stagione mite)

**Simulazione (un anno):** 8 posti (piante o vassoi), 40 W di luci, 7,3 kg utili, 321 kWh, 695 L d'acqua

**Distinta:** 13 voci, 167–301 €. Giudizio economico PROVVISORIO: il 100% della spesa iniziale poggia su prezzi stimati o vecchi.

**Costi:** 105 € all'anno, 23,17 €/kg con l'ammortamento, utile -132 € all'anno, VAN -626 € (giudizio: non conviene).

**Rischi:** Peso dei ripiani da verificare; Senza elettronica; Senza tenda; Controllo manuale.
**Sensibilità:** Non conviene con nessuna delle ipotesi prese da sola: non è una questione di ipotesi fragili. Ipotesi che pesano di più: ore di lavoro (valore di un'ora), prezzo dell'energia, durata dei componenti.
**Dosaggio:** a mano; modo REALE disattivato: servono chiave fisica, autotest del taglio, collaudo F1-F12 e verifica della dose (SICUREZZA_DOSAGGIO.md).
**Affidabilità:** Raccolto NON VALIDATO con dati reali; Temperature della tenda, del garage e della soluzione NON VALIDATO con dati reali; Corrente NON VALIDATO con dati reali; Spesa iniziale e costo al kg NON VALIDATO con dati reali.

## Scenario C · Microgreens per una possibile vendita, con costi, scarti e domanda variabile

**Proposta:** Scaffale a vassoi, 4 piani, 12 vassoi a settimana venduti al 70% del prezzo

**Simulazione (un anno):** 19 posti (piante o vassoi), 190 W di luci, 136,2 kg utili, 3838 kWh, 1010 L d'acqua

**Distinta:** 25 voci, 532–963 €. Giudizio economico PROVVISORIO: il 100% della spesa iniziale poggia su prezzi stimati o vecchi.

**Costi:** 1739 € all'anno, 15,40 €/kg con l'ammortamento, utile 570 € all'anno, VAN 2546 €, TIR 92,6% (giudizio: fragile).

**Vendita:** 6,38 € di ricavo e 5,42 € di costo per vassoio (scarto 15%); a domanda fissa 553 € all'anno.
**Domanda variabile** (±35% a settimana, si semina prima di sapere quanto si vende): producendo 11 vassoi a settimana il margine è 43 / 151 / 266 € (P10/P50/P90), invenduto 11%, anni in perdita 4%.

**Rischi:** Scaffale da fissare al muro; Senza tenda; Controllo manuale; Microgreens.
**Sensibilità:** ALTO RISCHIO: il giudizio cambia se è sbagliata anche una sola ipotesi: prezzo di vendita. Ipotesi che pesano di più: prezzo di vendita, ore di lavoro (valore di un'ora), resa delle piante.
**Dosaggio:** a mano; modo REALE disattivato: servono chiave fisica, autotest del taglio, collaudo F1-F12 e verifica della dose (SICUREZZA_DOSAGGIO.md).
**Affidabilità:** Raccolto NON VALIDATO con dati reali; Temperature della tenda, del garage e della soluzione NON VALIDATO con dati reali; Corrente NON VALIDATO con dati reali; Spesa iniziale e costo al kg NON VALIDATO con dati reali.
