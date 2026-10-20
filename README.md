# Agricoltura tecnologica partendo da zero

Percorso pratico per arrivare a un orto/piccola azienda con sensori, irrigazione automatica e dati, partendo da
**zero competenze, zero conoscenze, zero soldi**. Regola d'oro: **ogni fase si paga con la precedente** – si spende
solo ciò che l'orto ha già fatto risparmiare o guadagnare, e si compra tecnologia solo dopo averla provata in
simulazione.

Strumenti nel repository:
- `strumenti/orto_sim.py` – piano colture del mese, simulazione irrigazione (timer contro sensore), registro di
  raccolti, spese e vendite. Solo Python, nessun hardware.
- `firmware/esp32-irrigazione/main.py` – irrigazione automatica per ESP32 (MicroPython), stessa logica del simulatore.
- `skills/agricoltura-tech/` – skill per l'agente: ti guida fase per fase, una cosa alla volta.

Per iniziare (serve solo Python 3):
```bash
python3 strumenti/orto_sim.py piano --mese 10            # cosa seminare questo mese
python3 strumenti/orto_sim.py simula --mese 7            # irrigazione a orario fisso contro sensore
python3 strumenti/orto_sim.py registro aggiungi --attivita raccolto --coltura ravanello --kg 0.3
python3 strumenti/orto_sim.py registro riepilogo
```

---

## Fase 0 – Zero euro (mesi 1-2): imparare facendo

**Obiettivo:** far crescere e raccogliere qualcosa, e tenere un registro.

| Serve | Come averlo gratis |
|---|---|
| Spazio | balcone, davanzale; poi orti urbani del Comune, terreni incolti in comodato d'uso gratuito (chiedi in Comune, ad anziani del paese, a parrocchie; alcune regioni hanno una "banca della terra" – in Sardegna chiedi all'agenzia regionale Laore) |
| Contenitori | cassette della frutta (chiedile al fruttivendolo), bottiglie e taniche tagliate con fori sul fondo |
| Terra | compost fatto in casa con scarti di cucina + foglie secche; terra di scavo migliorata con il compost |
| Semi e piante | pomodori maturi, peperoncini secchi, fagioli e fave secchi, patate germogliate, aglio, base di cipollotti, talee di basilico; scambio semi con vicini e gruppi locali |
| Acqua | raccolta dell'acqua piovana da grondaie in taniche; acqua di lavaggio delle verdure |
| Conoscenza | `orto_sim.py piano`, video gratuiti, l'agricoltore anziano del paese (la fonte migliore), corsi gratuiti di Laore/regione, app gratuite di riconoscimento piante e malattie |

Da fare:
1. `python3 strumenti/orto_sim.py piano --mese <mese>` → scegli **3 colture veloci** (ravanello, rucola, microgreens).
2. Avvia il compost subito (serve 2-3 mesi).
3. Ogni giorno 5 minuti: guarda, tocca la terra con un dito (asciutta a 2 cm = annaffia), annota.
4. Registro: `orto_sim.py registro aggiungi --attivita raccolto --coltura ravanello --kg 0.3`.

**Fatto quando:** hai raccolto almeno 3 colture diverse e sai riconoscere terra secca, pianta assetata, pianta con troppa acqua.

## Fase 1 – Tecnologia a costo zero (in parallelo alla fase 0)

Tutto software, gratis:
- **Simulazione irrigazione:** `orto_sim.py simula --mese 7` confronta un timer fisso con un controllo a sensore. Con i
  valori di prova: a luglio il timer da 10 min/giorno lascia le piante in stress per centinaia di ore; ad aprile spreca
  due terzi dell'acqua e fa ristagno. È il motivo per cui si misura invece di "dare acqua a orario".
- **Meteo reale:** Open-Meteo offre gratuitamente evapotraspirazione (ET0) e pioggia; salvale in un CSV
  `giorno,et0_mm,pioggia_mm` e usale con `--meteo`.
- **Elettronica senza comprare nulla:** il simulatore online Wokwi permette di provare un ESP32 con sensore e relè
  virtuali e di caricare `firmware/esp32-irrigazione/main.py`.
- Impara le basi in quest'ordine: Python (piccoli script) → cos'è un sensore analogico → cos'è un relè → MicroPython.

**Fatto quando:** il firmware gira su Wokwi e sai spiegare a parole perché servono isteresi e tempo massimo pompa.

## Fase 2 – Primi guadagni (mesi 2-6): far pagare la tecnologia all'orto

Colture con ciclo breve e prezzo alto per poco spazio:
- **Microgreens** (10-14 giorni, vassoi riciclati, si vendono a ristoranti e conoscenti);
- **piantine da trapianto** in primavera (pomodori, peperoncini, basilico da seme o talea);
- **aromatiche** in vaso (basilico, prezzemolo, rosmarino da talea).

Prima di vendere informati sulle regole (vendita diretta di prodotti agricoli, eventuali obblighi fiscali e
igienico-sanitari): chiedi a un'associazione di categoria o al CAF. Registra ogni euro: `--attivita spesa/vendita`,
poi `orto_sim.py registro riepilogo`.

**Obiettivo:** ~30-40 € di margine, cioè il primo kit della fase 3.

## Fase 3 – Il primo sistema "tech" (~30-40 €)

| Componente | Prezzo indicativo |
|---|---|
| ESP32 DevKit | 5-10 € |
| Sensore di umidità **capacitivo** (non quello resistivo a forchetta: si corrode) | 2-4 € |
| Modulo relè 1 canale o MOSFET | 2-3 € |
| Pompetta 5 V + tubo + alimentatore USB 5 V | 8-12 € |
| Gocciolatoi, raccordi, cavetti | 5-8 € |

1. Monta tutto sul tavolo con un bicchiere d'acqua e un vaso di prova.
2. Taratura: annota la lettura in aria e in acqua, scrivila in `ADC_SECCO`/`ADC_BAGNATO`.
3. Una settimana su **un solo vaso**, confrontandolo con un vaso annaffiato a mano. Poi estendi.
4. Solo bassa tensione (5-12 V). Pompe a 230 V, quadri ed elettrovalvole di rete: solo con un elettricista.

**Fatto quando:** l'orto si annaffia da solo per una settimana senza piante sofferenti e senza ristagni.

## Fase 4 – Dati e controllo da remoto (~20-50 € in più)

- Più sensori: temperatura e umidità aria, livello del serbatoio dell'acqua piovana, luce.
- I dati dell'ESP32 via Wi-Fi verso un pannello (Home Assistant o Node-RED su un vecchio PC/Raspberry Pi; MQTT).
- Previsione meteo: niente irrigazione se domani piove (il simulatore già lo fa con `pioggia_prevista_mm`).
- Allarmi sul telefono: serbatoio vuoto, sensore guasto, umidità fuori campo.
- Se conosci i PLC: la stessa logica su un LOGO! 8 è un ottimo esercizio (skill `plc-logo-programmazione` e simulatore `strumenti/logo_sim.py` nel repository `agenti-automazione`) e il
  passaggio naturale verso impianti più grandi.

## Fase 5 – Crescere davvero

- **Idroponica senza pompa (metodo Kratky):** contenitore scuro, soluzione nutritiva, rete; ottima per lattughe ed erbe.
  Poi NFT/acquaponica con pompa e controllo di pH ed EC.
- **Serra o tunnel** con apertura ventilazione automatica in base alla temperatura.
- **Finanziamenti:** per giovani che si insediano in agricoltura esistono bandi regionali (sviluppo rurale) e misure
  nazionali (es. ISMEA per giovani agricoltori). Cambiano spesso: verifica i bandi aperti con la regione, un CAA o
  un'associazione di categoria. Il registro di raccolti, spese e vendite delle fasi precedenti è la base del business plan.

---

## Errori tipici da evitare
- Comprare kit costosi prima di aver fatto crescere qualcosa a mano.
- Troppe colture all'inizio: meglio 3 fatte bene.
- Annaffiare a orario invece di misurare (vedi simulazione).
- Sensori resistivi economici: si corrodono in poche settimane.
- Pompa senza tempo massimo: un sensore staccato svuota il serbatoio o allaga.
- Non annotare: senza registro non sai cosa funziona e cosa ti costa.
