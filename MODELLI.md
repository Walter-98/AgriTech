# Schede dei modelli

Ogni calcolo del gemello idroponico (`gemello/idro.js`) con formula, fonte, ipotesi, campo di validità, errori noti
ed esempio verificabile. I test numerici sono in `test/js/test_idro.js` (`node --test test/js/test_*.js`).

Livello di affidabilità:
- **A**: formula fisica o definizione, esatta.
- **B**: relazione supportata dalla letteratura, con parametri medi.
- **C**: stima euristica, da calibrare con misure vere.
- **D**: ipotesi di lavoro senza fonte, da sostituire.

Nessun modello è stato ancora confrontato con un raccolto vero: la calibrazione è la fase 8 della [roadmap](AUDIT.md).

---

## 1. Luce: PPFD e DLI (A)
- **Formula**:
  - PPFD sulle foglie = W montati × efficienza (µmol/J) × utilizzo ÷ superficie coltivata (m²);
  - DLI = PPFD × ore × 0,0036 (3.600 s/h ÷ 1.000.000 µmol/mol).
- **Parametri**:
  - utilizzo 0,85 su scaffale o vasca in tenda riflettente, 0,55 per le torri (luce laterale, dispersa);
  - efficienze in `LUCI_IDRO`: LED bianchi 2,7, tubi T8 2,0, LED viola 1,6, T5 1,1 µmol/J.
- **Fonti**:
  - il DLC chiede almeno 1,9 µmol/J alle lampade da orticoltura; le migliori in lista nel 2020 erano circa
    2,8 µmol/J (University of Kentucky, *LED Efficacy*, 2022);
  - il fattore di utilizzo è un'ipotesi (**D**).
- **Campo**: PPFD medio sul piano. Non calcola la distribuzione: i bordi ricevono il 20-40% in meno del centro, e
  mancano uniformità e distanza lampada-pianta (fase 4).
- **Esempio**: 280 W × 2,7 × 0,85 ÷ 2,16 m² = 297,5 µmol/m²/s. Per 16 h il DLI è 17,1 mol/m²/giorno.
- **Si verifica con**: un luxmetro o un quantometro (PAR meter) in 9 punti del ripiano.

## 2. Risposta della crescita alla luce (B/C)
- **Formula**: resa relativa = min(DLI, DLImax) ÷ DLIrif, con DLIrif = centro dell'intervallo `dli` della coltura. La
  resa di tabella (`resa`, g per pianta) vale a DLIrif.
- **Fonti**:
  - modello a efficienza d'uso della luce: Monteith J.L. (1977), *Phil. Trans. R. Soc. B* 281:277-294;
  - basilico: crescita lineare con il DLI sotto LED (ISHS Acta Hortic. 1337);
  - basilico: massa fresca +144-208% passando da DLI 7 a 15 (Iowa State, ASHS 2015);
  - lattuga: oltre 16-17 mol/m²/giorno cresce il rischio di bruciature ai bordi (Michigan State, *Urban Ag Series*).
- **Ipotesi**:
  - la luce cambia il peso, non la durata del ciclo;
  - CO₂, temperatura e nutrienti agiscono come fattori separati (vedi 5).
- **Campo**: tra circa 6 e 17-25 mol/m²/giorno secondo la coltura. Sotto 6 la lattuga allunga lo stelo e il modello
  è ottimista.
- **Errori noti**:
  - la risposta reale si appiattisce gradualmente, non di colpo al massimo;
  - le varietà differiscono molto.
- **Esempio**: lattuga (dli 12-17, DLIrif 14,5).
  - Con DLI 8,6 la resa è 59% di quella di tabella.
  - Con DLI 17,1 è 117% (17 ÷ 14,5).
  - Con DLI 30 resta 117%.
- **Si verifica con**: la pesata delle teste alla raccolta (bilancia da cucina), con il DLI misurato.

## 2b. Modello di crescita giorno per giorno: lattuga e basilico (B/C)
- **Formula** (per pianta, un passo al giorno):
  - massa secca: dD = LUE × DLI × A × (1 − e^(−k·LAR·D/A)) × f(T);
  - A = spazio per pianta: cubetto 5×5 cm in vivaio, poi passo²;
  - k = coefficiente di estinzione della luce (0,9 lattuga, 0,8 basilico);
  - LAR = superficie fogliare per grammo secco. Con poca luce le foglie si allargano (acclimatazione all'ombra):
    LAR = LARrif × (DLIrif/DLI)^0,7;
  - f(T) = funzione beta delle temperature cardinali (Yan e Hunt 1999) sulla temperatura media del giorno in tenda;
  - massa fresca = massa secca ÷ sostanza secca (4,7% lattuga, 8% basilico).
- **Calibrazione**:
  - LUE si calcola all'avvio in modo che la lattuga faccia **150 g a 35 giorni dalla semina** con DLI 17 e 22,3 °C
    medi (Both 1995, Cornell): risulta circa 0,6 g secchi per mole di luce;
  - per il basilico il riferimento è il valore di tabella (90 g a 49 giorni con DLI 18,5 e 25 °C, affidabilità **D**).
- **Temperature cardinali** (base / ottimale / massima):
  - lattuga 8 / 26 / 36 °C: base e ottimo da Michigan State, massima ipotizzata;
  - basilico 8 / 30 / 40 °C: base 8,3 e crescita fino a circa 30 °C da Iowa State, massima ipotizzata.
- **Uso nella simulazione**:
  - una coorte seminata ogni 7 giorni cresce con la luce e la temperatura dei giorni seguenti fino al peso di
    raccolta: la durata del ciclo cambia con la stagione;
  - produzione = piante ÷ (ciclo + giorni fermi) × peso;
  - col caldo oltre la massima di qualità (lattuga 24 °C) metà raccolto è considerato non vendibile (salita a seme,
    amaro): euristica **D**.
- **Controlli contro i dati pubblicati** (`test/js/test_crescita.js`):
  - lattuga 150 g ±1% al punto Cornell;
  - lattuga a DLI 8,6 pesa il 40-65% di quella a DLI 17 (risposta quasi lineare, ISHS);
  - basilico da DLI 7 a 15 cresce di +100-260% (Iowa State: +144-208%);
  - basilico più pesante a 30 °C che a 24 °C, meno a 37 °C.
- **Errori noti**:
  - sotto 18 °C la crescita rallenta probabilmente troppo: l'effetto della temperatura si moltiplica giorno dopo
    giorno. Basilico seminato a gennaio con la tenda a 17 °C: 90-130 giorni secondo il modello;
  - nessun effetto di CO₂, VPD o nutrienti sulla crescita;
  - varietà diverse hanno parametri diversi.
- **Si verifica con**: pesata di 3 piante a settimana nel primo ciclo, con DLI e temperatura media misurati.

## 3. Energia elettrica (A per le luci, C per il resto)
- **Formula**:
  - luci = W × ore × 365 (meno le ore di blackout);
  - pompe = W × ore di funzionamento;
  - elettronica = somma dei consumi a riposo;
  - clima = stufetta + estrattore + ventilatore + deumidificatore.
- **Fonte**: definizione per le luci. Per gli altri carichi, potenze tipiche di catalogo (**C**).
- **Esempio**: 280 W × 16 h × 365 = 1.635 kWh, il valore del test. Il totale dell'impianto NFT di esempio è circa
  2.070 kWh.
- **Si verifica con**: una presa con misuratore di consumo (10-15 €) su ogni ciabatta per una settimana.

## 4. Clima della tenda (C)
- **Formule**:
  - garage non isolato = media mensile esterna + 3 °C; garage isolato = 0,6 × esterna + 8 °C;
  - escursione giorno/notte ±3 °C (±1,5 se isolato);
  - tenda = garage + calore delle lampade ÷ UA, con UA = 4 W/K per m² di telo, più 55 W/K quando l'estrattore gira;
  - la stufetta copre UA × (minima − tenda) fino a 1.000 W.
- **Fonte**: bilancio termico stazionario. Coefficienti ipotizzati (**D**).
- **Campo**: medie mensili. Ondate di calore e notti gelide non ci sono.
- **Errori noti**:
  - mancano l'inerzia del garage, il sole sulla saracinesca e il calore dell'auto;
  - le temperature mensili sono medie per macro-zona (`REGIONI`), non per comune.
- **Si verifica con**: un termometro con memoria nel garage e uno nella tenda per 2 settimane. È il primo dato da
  misurare.

## 5. Fattori di stress (C)
- **Fattori sulla resa**:
  - caldo oltre la massima +2 °C: × 0,5;
  - freddo sotto la minima −4 °C: × 0,5;
  - soluzione sopra 24 °C: × 0,8;
  - pH fuori per una sonda che deriva: × 0,6;
  - controllo manuale: × 0,92, automatico × 0,98.
- **Fonte**: pratica di coltivazione (soglie dei manuali di idroponica). I moltiplicatori sono ipotesi (**D**).
- **Errori noti**: stress a soglia, non graduali. Da sostituire con curve di risposta alla temperatura (fase 3).

## 6. Produzione (C)
- **Formula**:
  - raccolte al giorno = piante ÷ (giorni del ciclo + giorni fermi);
  - kg = raccolte × resa × fattori × (1 − mortalità);
  - raccolto utile = kg × (1 − scarto).
- **Parametri di default**: mortalità 5%, 2 giorni fermi, 10% di scarto. Si cambiano nella scheda Progetto.
- **Ipotesi**:
  - semina scaglionata, ogni posto sempre occupato;
  - piantine in un vivaio a parte;
  - basilico e fragole trattati a cicli con resa media per ciclo.
- **Si verifica con**: il registro di semine e raccolte con le pesate (fase 8).

## 7. Acqua e nutrienti (C)
- **Formule**:
  - acqua = traspirazione × 1,05 + cambio completo del serbatoio ogni N giorni;
  - traspirazione = piante × acqua per pianta × 0,6 × crescita × temperatura;
  - nutrienti (€) = litri × (EC obiettivo − EC dell'acqua di partenza) × €/(L·mS).
- **Errori noti**:
  - l'EC è trattata come misura unica dei nutrienti: non si seguono i singoli ioni (azoto, potassio, calcio…) né
    l'accumulo di sodio e cloruri;
  - non c'è il calcolo di una ricetta. Fase 4.
- **Si verifica con**: litri rabboccati segnati sul serbatoio e penne EC/pH.

## 8. Economia (A come formule, C come ingressi)
- **Formule**:
  - CAPEX = somma della distinta (forbice min-max dei prezzi);
  - OPEX = corrente + acqua + nutrienti + semi + substrati + sonda pH + ricambi (lampade a fine vita, pompa ogni 3
    anni) + lavoro, se gli dai un valore;
  - ammortamento = CAPEX medio ÷ anni di vita;
  - costo al kg = (OPEX + ammortamento) ÷ kg utili;
  - mangiato in casa = min(raccolto non venduto, consumo per persona × persone × 52), al prezzo del negozio;
  - venduto = quota × raccolto, al prezzo di vendita (% del negozio);
  - il resto è eccedenza e vale 0;
  - margine = valore in casa + ricavo − OPEX;
  - pareggio = CAPEX ÷ margine (mai, se il margine è ≤ 0).
- **Scenari** (prove di robustezza, non probabilità):
  - pessimistico: CAPEX massimo, resa −30%, corrente +15%, prezzi −20%;
  - ottimistico: CAPEX minimo, resa +10%, corrente −5%.
- **Giudizio**:
  - "sconsigliato" se il margine è ≤ 0 o il pareggio supera la vita dell'impianto;
  - "fragile" se lo scenario pessimistico non copre le spese;
  - altrimenti "conviene".
- **Errori noti**:
  - prezzi stimati, non letti da fornitori (fase 9 della roadmap originale);
  - consumi per persona ipotizzati;
  - non c'è l'IVA per chi vende.
- **Esempio verificabile**: nel test "bilancio", costo al kg = (OPEX + CAPEX medio ÷ 5) ÷ (kg × 0,9).

## 9. Guasti (C)
- Il blackout fa perdere piante quando le ore senza pompa superano la tolleranza del sistema: NFT 2 h, torri 1 h,
  DWC e secchi 12 h, vassoi 24 h, Kratky illimitata.
- Quota persa = min(80%, (ore − tolleranza) ÷ 4). Le piante perse si rimpiazzano in 30 giorni.
- **Fonte**: tolleranze da pratica di coltivazione (**C/D**). Da verificare staccando la pompa a mano nel primo
  impianto, controllando le radici ogni 30 minuti.

---

## Fonti citate
- University of Kentucky, *LED Efficacy* (2022) e DesignLights Consortium, Horticultural Technical Requirements:
  soglia 1,9 µmol/J, migliori lampade circa 2,8 µmol/J.
- Michigan State University, *Urban Ag Series part 2*: lattuga, bruciature ai bordi oltre 16-17 mol/m²/giorno.
- Iowa State University, ASHS 2015: basilico da DLI 7 a 15, massa fresca +144-208%.
- ISHS Acta Horticulturae 1337: basilico indoor sotto LED, risposta lineare al DLI.
- ISHS Acta Horticulturae 1425: ortaggi a foglia con 16 h di luce a 150-300 µmol/m²/s = DLI 8,6-17,3.
- Monteith J.L. (1977), *Climate and the efficiency of crop production in Britain*, Phil. Trans. R. Soc. B 281.
- Cornell CEA, *Hydroponic Lettuce Handbook*: riferimento per la lattuga in floating. Da consultare per i valori di
  dettaglio, non ancora riportati riga per riga nel database.

I valori della tabella colture in `IDRO_PIANTE` sono intervalli da manuali e pratica di coltivazione: per ognuno manca
ancora la fonte puntuale. È il primo lavoro della fase 3.
