# Idroponica in garage

Guida da tecnico per partire da zero, con i numeri calcolati dal gemello digitale (`gemello/index.html`, modo
**Idroponica in garage**; dati in `gemello/idro.js`). I valori sono intervalli medi per varietà comuni: confermali con
le tue misure (penne pH ed EC, termometro, peso del raccolto).

## In una riga
In garage la spesa vera è la **corrente** (luci circa l'80%, d'inverno anche la stufetta). Con la corrente a 0,28-0,30
€/kWh **nessun impianto per la sola famiglia si ripaga**: si fa per imparare, per la qualità e la comodità. Diventa un
affare solo vendendo prodotti di prezzo alto (microgreens, basilico) a clienti veri e con le regole in ordine.

## Quale sistema

| Sistema | Per cosa | Pro | Contro | Senza corrente regge |
|---|---|---|---|---|
| **Kratky** (contenitore con coperchio forato) | Lattuga, basilico, rucola | Nessuna pompa, il più economico: **si parte da qui** | Solo cicli brevi, acqua calda d'estate | Sempre |
| **NFT a canali** (velo d'acqua che scorre) | Insalate, erbe, fragole | Il più usato, pulito, leggero, multi-piano | Senza pompa radici secche in 1-2 ore: **serve l'UPS** | 2 ore |
| **DWC a zattera** (vasca con ossigeno) | Insalate, erbe, anche pomodori in secchio | Molto stabile | Pesante (80 L per m²), l'acqua si scalda | 12 ore |
| **Torri verticali** | Insalate, erbe, fragole | 36 piante in mezzo metro quadro | **Si risparmia pavimento, non corrente**: luci intorno alla torre, +50% di watt per pianta | 1 ora |
| **Secchi olandesi** con perlite | Pomodori, peperoncini, fragole | Piante grandi fino a fine ciclo | Servono 1,8-2 m d'altezza e tanta luce | 12 ore |
| **Vassoi per microgreens** | Germogli (rucola, senape, girasole, piselli) | Raccolta in 10 giorni, prezzo alto | Tanto seme, lavoro ogni giorno | 1 giorno |

Orizzontale o verticale? Uno **scaffale a più piani** (3-4 ripiani da 120 × 60 cm, una lampada per ripiano) dà quasi
la stessa densità delle torri con luce più efficiente (lampada sopra le piante, non di lato).

## Quante piante e quanto costa (dal gemello)
Garage non isolato nel Sud o nelle Isole, tenda, stufetta con termostato a 17 °C, estrattore, LED bianchi, corrente
0,30 €/kWh, acqua di casa media durezza, famiglia di 3 persone. Ipotesi di produzione: 5% di piante perse, 2 giorni
fermi tra un ciclo e l'altro, 10% di raccolto non utilizzabile. "Spese/anno" comprende corrente, acqua, nutrienti,
semi, substrati, sonda pH e ricambi (lampade, pompa). Il costo al kg comprende l'ammortamento del materiale in 5 anni.
"Valore" è quello che la famiglia mangia davvero, al prezzo del negozio, più quello che vende: il raccolto in più
non vale niente se nessuno lo compra. Modelli e limiti in [MODELLI.md](MODELLI.md).

| Impianto | Piante | Luci | Corrente/anno | Per iniziare | Spese/anno | Raccolto utile | Costo al kg | Valore/anno | Si ripaga in | Giudizio |
|---|---|---|---|---|---|---|---|---|---|---|
| NFT, scaffale 3 piani 120×60 (lattuga, basilico, rucola) | 77 | 280 W | 2079 kWh | 790–1404 € | 796 € | 61 kg | 16,8 € | 307 € | mai | **sconsigliato** |
| Torri verticali ×2 | 71 | 560 W | 3784 kWh | 1068–1968 € | 1337 € | 67 kg | 24,6 € | 284 € | mai | **sconsigliato** |
| DWC 120×120 (lattuga, basilico) | 35 | 190 W | 1756 kWh | 701–1215 € | 633 € | 38 kg | 21,8 € | 190 € | mai | **sconsigliato** |
| Kratky 120×60, controllo a mano | 24 | 100 W | 1065 kWh | 384–681 € | 365 € | 19 kg | 25,3 € | 132 € | mai | **sconsigliato** |
| Secchi: 6 tra pomodori e peperoncini | 9 | 700 W | 4438 kWh | 1185–2118 € | 1499 € | 35 kg | 51,9 € | 175 € | mai | **sconsigliato** |
| Microgreens, scaffale 4 piani, in casa | 23 | 220 W | 1614 kWh | 703–1235 € | 1224 € | 139 kg | 10,2 € | 140 € | mai | **sconsigliato** |
| Microgreens, scaffale 4 piani, 90% venduto al 70% del prezzo | 23 | 220 W | 1614 kWh | 703–1235 € | 1224 € | 139 kg | 10,2 € | 2767 € | 0,6 anni | conviene |

Cosa dicono i numeri:
- Con i **LED viola economici** lo stesso impianto NFT consuma circa il 55% in più; con i **neon T5** più del doppio.
- **Luci di notte**: nell'impianto NFT i giorni troppo caldi scendono da 227 a 132, il raccolto sale da 56 a 67 kg e la corrente scende da 2.294 a 2.066 kWh (d'inverno le luci scaldano quando fa più freddo).
- In un garage non isolato del Sud resta comunque caldo d'estate: lì si coltiva basilico o si ferma da luglio ad agosto.
- **Garage isolato** e **tenda**: meno stufetta d'inverno e meno caldo d'estate.
- L'impianto automatico costa di più all'inizio (sonde, dosatori, UPS); il Kratky a mano è il modo giusto per imparare.

## Le colture

EC in mS/cm (1 mS/cm ≈ 500-700 ppm), luce PPFD in µmol/m²/s, DLI in mol/m²/giorno, ore di luce, temperatura
dell'aria in °C, umidità relativa in %, distanza tra le piante, giorni (vivaio + dal trapianto alla raccolta), resa per
pianta per raccolta, acqua per pianta grande al giorno.

| Coltura | EC | pH | PPFD | DLI | Ore | °C | UR % | Distanza | Giorni | Resa | Acqua | Sistemi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Lattuga | 0,8–1,2 | 5,5–6,5 | 200–300 | 12–17 | 16 | 16–22 | 50–70 | 20 cm | 14 + 40 | 180 g | 0,15 L | NFT a canali, Torri verticali, DWC a zattera galleggiante, Kratky |
| Basilico | 1–1,6 | 5,5–6,5 | 300–500 | 15–22 | 16 | 21–27 | 50–60 | 20 cm | 14 + 35 | 90 g | 0,12 L | NFT a canali, Torri verticali, DWC a zattera galleggiante, Kratky |
| Rucola | 0,8–1,2 | 6–6,5 | 200–300 | 12–16 | 14 | 15–21 | 50–70 | 10 cm | 7 + 25 | 40 g | 0,05 L | NFT a canali, Torri verticali, DWC a zattera galleggiante, Kratky |
| Spinacio | 1,8–2,3 | 6–7 | 250–350 | 12–15 | 12 | 15–20 | 50–70 | 15 cm | 14 + 40 | 80 g | 0,08 L | NFT a canali, Torri verticali, DWC a zattera galleggiante |
| Cavolo riccio (kale) | 1,2–1,8 | 5,5–6,5 | 300–400 | 14–18 | 16 | 15–22 | 50–70 | 25 cm | 14 + 45 | 200 g | 0,15 L | NFT a canali, Torri verticali, DWC a zattera galleggiante |
| Prezzemolo | 0,8–1,8 | 5,5–6 | 250–400 | 12–18 | 16 | 16–24 | 50–70 | 20 cm | 21 + 60 | 100 g | 0,08 L | NFT a canali, Torri verticali, DWC a zattera galleggiante, Kratky |
| Menta | 2–2,4 | 5,5–6,5 | 300–450 | 14–20 | 16 | 18–24 | 50–70 | 25 cm | 14 + 45 | 120 g | 0,12 L | NFT a canali, DWC a zattera galleggiante, Torri verticali |
| Fragola (rifiorente) | 1,2–1,8 | 5,5–6,2 | 400–600 | 17–25 | 14 | 18–24 | 60–75 | 25 cm | 90 | 150 g | 0,25 L | NFT a canali, Torri verticali, Secchi olandesi |
| Pomodoro ciliegino | 2–3 | 5,5–6,5 | 500–800 | 20–30 | 16 | 20–26 | 60–70 | 60 cm | 28 + 120 | 3 kg | 1,2 L | Secchi olandesi, DWC a zattera galleggiante |
| Peperoncino | 1,8–2,4 | 5,8–6,3 | 400–600 | 18–25 | 16 | 22–28 | 50–70 | 50 cm | 28 + 120 | 400 g | 0,6 L | Secchi olandesi, DWC a zattera galleggiante |
| Microgreens (vassoi) | 0–0,6 | 5,5–6,5 | 100–250 | 6–12 | 16 | 18–22 | 40–60 | fitto | 10 | 250 g | 0,25 L | Vassoi per microgreens |

Colture insieme nello stesso serbatoio solo se EC, pH e temperature si sovrappongono (lattuga, rucola, basilico, prezzemolo
sì; spinacio, menta, pomodori a parte). D'inverno colture da freddo (lattuga, spinacio, cavolo riccio), d'estate da caldo
(basilico, peperoncino).

## Luce: servono lampade particolari?
Sì: lampade da coltivazione, ma conta l'**efficienza** (µmol/J), non i watt scritti sulla scatola.

| Lampada | Efficienza | Watt per m² (lattuga, 250 µmol/m²/s) | Prezzo indicativo |
|---|---|---|---|
| LED bianco full spectrum (quantum board, barre) | 2,7 µmol/J | ~110 W | 0,7-1,3 €/W |
| Tubi LED T8 bianchi | 2,0 µmol/J | ~150 W | 0,4-0,8 €/W |
| LED economico rosso/blu ("viola") | 1,6 µmol/J | ~185 W | 0,3-0,6 €/W |
| Neon T5 HO | 1,1 µmol/J | ~270 W | 0,6-1,0 €/W |

- **Formula**: watt per m² = PPFD ÷ (efficienza × 0,85); **DLI** = PPFD × ore × 0,0036 (lattuga 250 × 16 h = 14,4).
- **Corrente**: watt × ore × 365. Esempio: 280 W × 16 h = 4,5 kWh al giorno = 1.635 kWh all'anno ≈ 490 € a 0,30 €/kWh.
- **Distanza** dalle foglie: LED bianchi 30-45 cm (piantine 50-60 cm), tubi T8 10-20 cm. Foglie sbiancate o arricciate
  in su: troppa luce; steli lunghi e deboli: poca.
- Temporizzatore (o presa smart) con orario fisso: le piante vogliono la stessa durata ogni giorno.

## Nutrienti e pH
1. Riempi il serbatoio e misura EC e pH dell'acqua di casa (di solito EC 0,2-0,7, pH 7-8).
2. Aggiungi la **parte A**, mescola 5 minuti, poi la **parte B**. Mai A e B concentrate insieme (il calcio precipita).
3. Porta l'EC all'obiettivo della coltura; **per ultimo** il pH con il pH- a gocce, aspetta 15 minuti e rimisura
   (obiettivo 5,8-6,2 per quasi tutte).
4. Le piante bevono più acqua che sali: l'EC sale. **Rabbocca con acqua semplice.**
5. **Cambio completo** ogni 2-3 settimane (la soluzione vecchia va benissimo sull'orto).
6. Ricetta economica in polvere per 100 L (EC ≈ 1,5): 60 g di base 4-18-38, 60 g di nitrato di calcio, 30 g di solfato
   di magnesio, in due taniche madre separate. Costo: meno di 1 € ogni 100 L. Il liquido A+B pronto costa circa 4 volte.
7. Acqua dura (> 30 °f): parte da EC alta e vuole tanto pH-; mescola acqua piovana o usa l'osmosi (con cal-mag).

## Clima: temperatura, umidità, acqua
- **Aria**: vedi la tabella delle colture; la notte 4-6 °C meno del giorno va bene.
- **Soluzione**: 18-22 °C. Sopra 24 °C cala l'ossigeno e arriva il marciume delle radici (radici marroni e viscide):
  serbatoio isolato e all'ombra, luci di notte, bottiglie di ghiaccio, pompa d'aria.
- **Umidità**: piantine 70-80%, adulte 50-70%. Troppo umido: muffe e bruciature ai bordi; servono estrattore (ricambio
  di tutta l'aria della tenda ogni 1-3 minuti) e un ventilatore sempre acceso.
- **Garage d'inverno**: tenda + stufetta con termostato; d'estate: estrattore e colture da caldo.
- **Acqua**: le insalate bevono 0,1-0,2 L per pianta al giorno; 77 piante NFT ≈ 3,5 m³ all'anno compresi i cambi.

## Semi e piantine
- Bustine da 2-4 € con centinaia di semi: **meno di 2 centesimi a pianta** per insalate ed erbe.
- Microgreens: 15-30 g di seme per vassoio 25 × 50 cm (girasole e piselli 80-100 g) → 0,5-1,5 € a vassoio.
- Fragole da piantina (stolone) 0,5-1,5 €; menta da talea (gratis).
- Semina in cubetti di lana di roccia (o spugne) ammollati a pH 5,5; 2-3 giorni al buio a 20-24 °C (basilico e
  peperoncino 25-28 °C); trapianto nei vasetti a rete dopo 10-14 giorni.
- **Semina scaglionata**: un giro ogni settimana, così raccogli ogni settimana.

## Automazione: cosa serve davvero
| Pezzo | Prezzo | A cosa serve |
|---|---|---|
| Penne pH ed EC + soluzioni di taratura | 30-55 € | **Sempre**, anche con le sonde: sono il controllo incrociato |
| Microcontrollore (ESP32) | 6-10 € | Luci, pompe, sicurezze, dati |
| Sonda pH industriale + scheda | 35-60 € | Taratura ogni mese, si cambia ogni 12-18 mesi |
| Sonda EC + scheda | 45-70 € | Nutrienti disciolti |
| Sonda temperatura acqua (DS18B20) | 2-4 € | Allarme acqua calda |
| Sensore aria (SHT31) | 8-14 € | Comanda estrattore e stufetta |
| Galleggianti minimo/massimo | 4-6 € | Pompa mai a secco, rabbocco |
| **Sensore di perdita a pavimento** | 4-10 € | **Indispensabile in garage** |
| Flussimetro | 3-6 € | Pompa ferma scoperta in minuti |
| Pompe peristaltiche A, B, pH- | 25-40 € | Dosaggio automatico a piccole dosi |
| Prese smart certificate | 40-70 € | Luci, stufetta, estrattore: mai relè fai da te a 230 V |
| UPS | 60-95 € | NFT e torri nei blackout |

Nel gemello, scheda **Guasti**, puoi provare: blackout di 5 ore (con NFT senza UPS si perde gran parte del raccolto),
sonda pH che deriva (con il dosaggio automatico il pH crolla finché non tari), pompa ferma, perdita, lampada guasta.

## Gestione
- **Ogni giorno, 2 minuti**: telefono o LED del quadro, radici bianche, foglie sane; scuoti i fiori di fragole e pomodori.
- **2-3 volte a settimana**: pH ed EC con le penne, rabbocco, nuova semina.
- **Ogni 2-3 settimane**: cambio della soluzione, pulizia filtri e pompa, taratura sonde.
- **A fine ciclo**: lavaggio con perossido di idrogeno al 3%; ogni anno sonda pH nuova.

## Sicurezza
Acqua e corrente insieme: salvavita, ciabatte e prese sollevate da terra, sensore di perdita, carichi a 230 V solo con
prese smart certificate, stufetta lontana dal telo e con termostato, aria della tenda lontana da fumi di auto e solventi.

## Come partire senza buttare soldi
1. **Kratky** (20-40 €): un contenitore scuro, 6 lattughe, una lampada da 30-50 W, penne pH ed EC. In 5 settimane impari.
2. Progetta l'impianto nel **gemello** (0 €): sistema, colture, luce, clima; guarda il costo al kg.
3. **Banco**: microcontrollore e sonde in un secchio, tara e prova il dosaggio per una settimana.
4. **Impianto**: tenda, sistema, luci, automazione; una settimana solo con acqua per scoprire perdite.
5. **Primo ciclo** con semina scaglionata, annotando acqua, EC, pH, temperature e raccolto da confrontare con il gemello.
