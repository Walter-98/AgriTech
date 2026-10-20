# Piano del sistema di controllo e gestione AgriTech

**Regola:** prima tutto in virtuale (0 €), poi si compra **solo** quello che ha superato le prove virtuali, e
**un pezzo alla volta**. Ogni fase ha un **cancello**: non si passa alla successiva (e non si spende) finché tutte le
prove del cancello non sono segnate come superate in `COLLAUDO.md`.

```
 FASE  0 Strumenti       0 €   PC, Python, Git, Wokwi
 FASE  1 Requisiti       0 €   cosa deve fare il TUO impianto (scheda sotto)
 FASE  2 Simulazione     0 €   il tuo orto nel simulatore, parametri tarati
 FASE  3 Collaudo virt.  0 €   test automatici + ESP32 virtuale su Wokwi
 ──────────── cancello: da qui in poi si spende ────────────
 FASE  4 Banco       ~20-50 €  hardware vero sul tavolo, bicchiere d'acqua e secchio
 FASE  5 Campo       ~40-90 €  1 zona vera per 2 settimane, poi la seconda
 FASE  6 Gestione        0 €*  dati, pannello, meteo, avvisi sul telefono (*su un vecchio PC)
 FASE  7 Crescere     a step   più zone, serra, idroponica, solare
```

I soldi delle fasi 4-5 vengono dall'orto stesso (fase 2 di `README.md`: microgreens, piantine, aromatiche).

## Come è fatto il sistema

```
   [sensori umidità] [galleggiante] [livello cisterna] [temperatura]
            \              |               |               /
             └──────────── ESP32 (nodo di campo) ─────────┘
                    main.py   = lettura pin e uscite (hardware)
                    controllo.py = LOGICA + SICUREZZE (provata in virtuale)
                           |                 \
                  [relè pompa] [relè valvole]  \ Wi-Fi (fase 6)
                                                \
                                     Centrale: vecchio PC / Raspberry Pi
                                     registro dati, pannello, meteo, avvisi
```

- Le **sicurezze stanno sull'ESP32**, non sulla centrale: se cade il Wi-Fi o si spegne il PC, l'orto continua a
  essere irrigato e la pompa non gira mai a secco.
- `sistema/controllo.py` è **un solo file** usato sia dal simulatore sia dall'ESP32: quello che provi al PC è
  esattamente quello che comanda la pompa. È già provato anche su MicroPython vero (v1.25).
- Perché ESP32: costa 5-10 €, ha Wi-Fi, si programma in MicroPython (Python semplice) e si simula gratis su Wokwi.
  Un LOGO! o un PLC va benissimo per impianti più grandi, ma costa 10-20 volte di più per iniziare.

---

## FASE 0 – Strumenti (0 €, 1-2 serate)
1. Installa **Python 3** (python.org) e **Git**; facoltativo **VS Code** come editor.
2. Scarica il repository: `git clone https://github.com/Walter-98/AgriTech` e entra nella cartella.
3. Crea un account gratuito su **wokwi.com**.
4. Prova che funziona tutto: `python3 -m unittest discover -s test -t .` → deve finire con `OK`.

**Cancello 0:** i test girano sul tuo PC e finiscono con `OK`.

## FASE 1 – Requisiti del tuo impianto (0 €, 1 serata)
Compila questa scheda (copiala in un file `mio-impianto.md`). Ogni risposta diventa un parametro del simulatore.

| Domanda | Esempio | Diventa |
|---|---|---|
| Quante zone (gruppi di piante con la stessa sete)? | 2: pomodori, insalata | `--zone` |
| Superficie di ogni zona (m²) | 2 e 1 | `area_m2` |
| Coltura (consumo d'acqua) | pomodoro 1,15 – insalata 1,0 | `kc` |
| Da dove arriva l'acqua? | cisterna 1000 L da grondaia di 10 m² | serbatoio, tetto |
| Portata della pompa o dei gocciolatoi per zona | 1 L/min | `--portata` |
| Corrente disponibile vicino all'orto? | presa 230 V in garage → alimentatore 12 V | scelta alimentazione |
| Wi-Fi arriva all'orto? | sì / no | fase 6 |
| Quanto puoi stare senza controllare? | 3 giorni | soglie e allarmi |

Il modo più semplice: apri il gemello digitale `gemello/index.html` con il browser (anche dal telefono). Inserisci zone,
piante, terreno, acqua e corrente e vedi subito in 3D come viene l'orto, quanta acqua e corrente consuma in un anno,
quanto costa a tappe, quali sensori servono e perché. Nella scheda "Percorso" c'è il comando già pronto per portare
le tue zone nel simulatore dettagliato della fase 2.

**Cancello 1:** scheda compilata, sai dire in una frase cosa deve fare l'impianto e cosa non deve mai fare
(es. "mai pompa a secco, mai allagare, avvisarmi se qualcosa si rompe").

## FASE 2 – Simulazione del tuo orto (0 €, 2-4 serate)
1. Guarda gli scenari: `python3 -m sistema.simula --elenco`.
2. Prova lo scenario normale con le **tue** zone:
   ```bash
   python3 -m sistema.simula normale --zone '[{"nome":"pomodori","area_m2":2,"kc":1.15},{"nome":"insalata","area_m2":1,"kc":1.0}]' --portata 1 --rapporto rapporto.html
   ```
   Apri `rapporto.html` nel browser: umidità per zona, cisterna, quando gira la pompa, allarmi.
3. Prova tutti i guasti e il meteo estremo: `python3 -m sistema.simula tutti` (con le stesse opzioni
   `--zone`/`--portata`). Ci sono guasti di sensori, tubi, valvole e pompa, ondata di calore, siccità di 60 giorni,
   nubifragio, due settimane di pioggia, previsione sbagliata, gelate, blackout, cali di tensione, pannello solare
   con giorni coperti e quadro elettrico allagato.
4. Meteo vero della tua zona: `python3 strumenti/scarica_meteo.py --lat .. --lon .. --da 2024-06-01 --a 2024-09-30
   --file estate.csv`, poi `python3 -m sistema.simula normale --meteo estate.csv --rapporto r.html` (anche con `tutti`).
5. Problemi e soluzioni a confronto: `python3 -m sistema.soluzioni` riscrive [`SOLUZIONI.md`](SOLUZIONI.md) con ogni
   problema simulato senza e con la soluzione, e la lista di cosa fare in ordine con i costi.
6. Se qualcosa non va (ore di sofferenza, ristagno, falsi allarmi) cambia i parametri e riprova, ad esempio:
   `--parametri '{"soglia_on": 0.5, "max_min": 15, "verifica_dopo_min": 10}'`.
   I parametri disponibili sono in `PARAMETRI_DEFAULT` all'inizio di `sistema/controllo.py`, ognuno spiegato.
7. Scrivi i parametri scelti in `firmware/esp32-irrigazione/config.py` → `PARAMETRI`.

Esempio di cosa trova la simulazione: nella prima versione la pioggia riempiva la cisterna proprio mentre la pompa
girava, il livello saliva e il sistema dava un falso "pompa guasta" bloccando l'irrigazione per settimane. Trovato e
corretto al PC, a costo zero; sul campo sarebbero morte le piante.

Altro esempio, di dimensionamento: con 3 zone (pomodori 4 m², zucchine 3 m², basilico 0,5 m²) e pompa da 2 L/min,
a luglio la cisterna da 800 L non basta (allarme cisterna bassa e piante in sofferenza) e la zona del basilico si
allaga, perché 10 minuti a 2 L/min su 0,5 m² sono troppa acqua. Soluzioni da provare nel simulatore prima di
comprare: cisterna più grande o rabbocco, gocciolatoi a portata più bassa sul basilico, `max_min` più corto.

**Cancello 2:** con le tue zone lo scenario `normale` dà 0 ore di sofferenza e 0 di ristagno, ogni guasto di
`tutti` dà l'allarme giusto, e hai deciso quali soluzioni di `SOLUZIONI.md` ti servono (sono già nella lista della
spesa qui sotto: quadro rialzato, alimentazione separata, aiuole rialzate, pacciamatura).

Altre falle trovate così, sempre a costo zero, e già corrette nel controllo:
- il rumore del sensore faceva sembrare "arrivata" l'acqua anche con un tubo scoppiato → letture filtrate e verifica
  8 minuti dopo la fine dell'irrigazione;
- con un alimentatore debole l'ESP32 si riavviava a ogni partenza della pompa e ogni riavvio azzerava le sicurezze:
  la zona si allagava senza allarmi → memoria su file salvata prima di accendere la pompa e blocco dopo 3 riavvii;
- bloccare tutto per una valvola bloccata aperta faceva seccare le altre zone → si continua a irrigare finché la
  zona con la valvola guasta non è troppo bagnata.

## FASE 3 – Collaudo virtuale (0 €, 2-3 serate)
1. Test automatici: `python3 -m unittest discover -s test -t .` → `OK` (logica, scenari, firmware con pin finti).
   Girano anche da soli su GitHub a ogni modifica (scheda **Actions** del repository).
2. ESP32 virtuale su Wokwi: segui `firmware/esp32-irrigazione/LEGGIMI.md` e fai le prove **W1-W8** di `COLLAUDO.md`.
3. Impara intanto, sempre sull'ESP32 virtuale: cos'è un relè, perché il diodo sulle elettrovalvole, cos'è un pull-up.

**Cancello 3 (quello dei soldi):** tutti i test `OK` e W1-W8 superate. Solo ora si compra.

## FASE 4 – Banco (hardware vero sul tavolo, niente acqua vera nell'orto)
Compra in due volte. Prezzi indicativi da negozi online di elettronica: verificali al momento dell'acquisto.

**4a – kit minimo (~20 €)**
| Pezzo | Prezzo | Note |
|---|---|---|
| ESP32 DevKit (con USB) | 6-10 € | prendi quello con chip CP2102 o CH340 |
| Sensore di umidità **capacitivo** v2.0 | 2-3 € | non quello a forchetta resistivo: si corrode |
| Modulo relè 2 o 4 canali con optoisolatore | 3-5 € | |
| Breadboard + cavetti | 4-6 € | |

Prove **B1-B5** di `COLLAUDO.md`, con LED o lampadine al posto di pompa e valvole.

**4b – resto del banco (~25-30 €)**, solo dopo B1-B5
| Pezzo | Prezzo | Note |
|---|---|---|
| Secondo sensore capacitivo | 2-3 € | |
| Galleggiante di livello | 2-3 € | |
| DHT22 | 3-5 € | temperatura aria |
| JSN-SR04T (ultrasuoni impermeabile) | 6-9 € | livello cisterna; facoltativo |
| Alimentatore 12 V 2 A + step-down 12→5 V | 9-12 € | l'ESP32 si alimenta dal 5 V |
| Pompa 12 V piccola (a membrana) | 6-10 € | prova in un secchio |
| Condensatore 1000 µF + secondo step-down per l'ESP32 | 2-3 € | contro i riavvii alla partenza della pompa |
| Sonda acqua per il quadro (due fili o modulo) | 1-2 € | allarme acqua nel quadro |
| Flussimetro YF-S201 (facoltativo) | 3-6 € | perdite in 2 minuti, pompa guasta |
| Sensore di pioggia (facoltativo) | 2-5 € | serve per scoprire una valvola bloccata aperta |

Prove **B6-B13**, compresa la prova di 72 ore e quella dei cali di tensione.

**Cancello 4:** B1-B10 superate, nessun riavvio strano in 72 ore, sensori tarati e valori scritti in `config.py`.

## FASE 5 – Campo (~40-90 €)
| Pezzo | Prezzo | Note |
|---|---|---|
| Cisterna | 0-60 € | fusti alimentari recuperati (gratis) o cisterna IBC 1000 L usata |
| 2 elettrovalvole 12 V normalmente chiuse | 10-16 € | con diodo di ricircolo |
| Tubo 16 mm, raccordi, gocciolatoi o ala gocciolante | 10-20 € | |
| Scatola stagna IP65 + pressacavi | 6-10 € | l'elettronica non deve mai bagnarsi: a 50 cm o più da terra |
| Palo o staffa per il quadro | 0-5 € | |
| Filtro a rete prima delle valvole | 3-5 € | lo sporco blocca le valvole aperte |
| Portafusibile + fusibile sul 12 V | 2-3 € | |

1. **Una sola zona** per 14 giorni, con a fianco un vaso uguale annaffiato a mano (confronto).
2. Prove **C1-C4**: annota acqua usata e umidità, confrontale con il simulatore e correggi il modello
   (`capacita_mm`, `drenaggio_mm_h`, ritardo del sensore) finché simulazione e realtà si somigliano (C7, con il
   meteo vero degli stessi giorni).
3. Aiuole rialzate e scoli dove dopo un temporale resta acqua ferma (C6), pacciamatura d'estate.
4. Poi la seconda zona (C5).

**Cancello 5:** 14 giorni senza piante sofferenti e senza intervento, guasti provati in campo con l'allarme giusto.

## FASE 6 – Gestione e dati (0 € su un PC che hai già)
Anche questa si fa **prima in virtuale** (Wokwi ha il Wi-Fi simulato; il broker si installa sul PC):
1. L'ESP32 manda letture e allarmi via Wi-Fi con **MQTT** a un broker (Mosquitto) sul PC o su un Raspberry Pi.
2. **Registro** dei dati e **pannello** (Node-RED o Home Assistant, gratuiti): umidità, cisterna, allarmi, storico.
3. **Meteo**: la centrale legge la pioggia prevista (Open-Meteo, gratuito) e la manda all'ESP32
   (`pioggia_prevista_mm`): niente irrigazione se domani piove.
4. **Avvisi sul telefono** (es. bot Telegram gratuito) per allarmi bloccanti e cisterna bassa.
5. Comandi a distanza solo "sicuri": reset allarmi e cambio soglie entro limiti; mai forzare la pompa a distanza.
6. Il registro delle colture (`strumenti/orto_sim.py registro`) e i dati dell'impianto diventano il tuo quaderno
   di campagna: acqua per kg raccolto, costi, ricavi.

**Cancello 6:** con il Wi-Fi spento l'impianto continua a funzionare da solo; quando torna, i dati e gli avvisi
riprendono.

## FASE 7 – Crescere (a step, sempre simulazione → banco → campo)
- Più zone (lo stesso firmware: aggiungi pin in `config.py`, scenario nel simulatore, test).
- Serra: apertura ventilazione e ombreggio in base alla temperatura.
- Idroponica: controllo di pH ed EC della soluzione nutritiva; guida completa in `IDROPONICA.md`, da progettare prima nel gemello (modo "Idroponica in garage").
- Energia solare: pannello 20-50 W + batteria per orti senza corrente (fai prima il bilancio dei consumi).
- Impianti più grandi o professionali: valuta PLC/LOGO! e un elettricista per la parte a 230 V.

## Errori da non fare
- Comprare prima di aver superato il cancello 3.
- Fidarsi di un solo sensore senza le sicurezze (tempo massimo, controllo di efficacia, galleggiante).
- Mettere le sicurezze solo sulla centrale o sul cloud.
- Toccare la parte a 230 V senza un elettricista.
- Cambiare `controllo.py` direttamente sull'ESP32 senza rilanciare i test.
