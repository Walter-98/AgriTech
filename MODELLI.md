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

## 1b. Mappa della luce sul ripiano (A per la formula, C per le ipotesi)
- **Formula**:
  - ogni lampada è una griglia 4×3 di sorgenti puntiformi lambertiane: I(θ) = I0·cos θ, con I0 = PPF ÷ (n·π);
  - PPFD in un punto = Σ I0·h² ÷ d⁴, con h = distanza lampada-foglie e d = distanza sorgente-punto;
  - con la tenda: una riflessione su ciascuna delle 4 pareti come sorgente specchiata, riflettività 0,9.
- **Uscite**: minimo, media, massimo, uniformità (min ÷ media), DLI ai bordi e al centro.
- **Ipotesi (C)**: fascio lambertiano (tipico delle quantum board senza lenti), lampada larga l'80% del ripiano,
  pareti alla distanza del bordo del ripiano.
- **Controlli**:
  - senza pareti i fotoni sul ripiano sono meno di quelli emessi;
  - le pareti alzano media e uniformità;
  - lampada più alta = più uniforme;
  - la media sta entro il 20% del modello semplice (§1).

## 4b. Idraulica (A per le formule, C per i parametri)
- **Canali NFT**:
  - uno ogni passo della coltura (minimo 15 cm);
  - circa 1 L/min per canale: 0,5 al trapianto, 2 al massimo (Wikipedia/NFT, Atlas Scientific; altre prove indicano
    molto meno, 0,2-0,33 L/min);
  - pendenza 1:40 (le fonti vanno da 1:100 a 1:30).
- **Perdite nel tubo di mandata da 16 mm** (Hazen-Williams, C = 150 per il PVC): hf = 10,67·L·Q^1,852 ÷
  (C^1,852·D^4,87). Prevalenza = dislivello + perdite + 0,3 m di raccordi.
- **Pompa**:
  - curva ipotizzata lineare: Q = Qmax·(1 − H/Hmax), con Hmax ≥ 1,5 × prevalenza;
  - consumo = potenza idraulica ÷ 0,15 (rendimento delle piccole pompe sommerse: 10-25%). È questo consumo che entra
    nel bilancio della corrente.
- **Traboccamento**: l'acqua che torna dai canali a pompa ferma (velo di 0,25 L/m più 0,3 L per canale) deve stare
  nel 25% libero del serbatoio.
- **Esempio** (scaffale di esempio):
  - 6 canali, 6 L/min, 1,87 m di prevalenza, pompa da almeno 1.000 L/h e 3 m, circa 12 W;
  - tornano al serbatoio 4 L, contro 30 L liberi.

## 5b. Struttura, tenda e locale (A come geometria, C come margini)
- **Ripiano**: lunghezza × profondità in cm, distanza tra i ripiani. Altezza dello scaffale = 50 cm (serbatoio sotto)
  + piani × distanza + 10 cm.
- **Tenda**: la più piccola tra quelle in commercio (60×60 fino a 300×150 cm) che contiene il ripiano con 5 cm di
  margine ed è abbastanza alta. La sua superficie entra nel bilancio termico: UA = 4 W/K per m² di telo.
- **Locale**: impianto nell'angolo in fondo, quadro accanto, 60 cm davanti per lavorare, 80 cm lungo un lato per
  passare o per l'auto. Avvisa se non entra in lunghezza, larghezza o altezza.
- **Distinta collegata**: numero e lunghezza dei canali, metri di tubo di mandata e di ritorno, scaffale con misure e
  prezzo proporzionale alla superficie, tenda scelta, pompa dimensionata.

## 7b. Ricetta dei nutrienti (A per la stechiometria, C per EC e stime dell'acqua)
- **Riferimento**: soluzione di Hoagland n. 2 (Hoagland e Arnon 1950): N 210, P 31, K 235, Ca 160, Mg 48, S 64 mg/L.
  Altre versioni hanno Ca 200.
- **Calcolo**:
  - si cerca il fattore su Hoagland che, sommato all'acqua di partenza, dà l'EC della coltura;
  - i sali (nitrato di calcio commerciale 15,5-0-0 con 19% Ca, nitrato di potassio 13-0-46, MKP 0-52-34, solfato di
    magnesio, solfato di potassio) si dosano con minimi quadrati non negativi;
  - pesi: azoto 2, potassio 1, fosforo 0,7, calcio e magnesio 0,5, zolfo 0,2.
- **EC stimata** = cationi in meq/L ÷ 10, regola pratica (C).
- **Acido**: si neutralizzano i bicarbonati lasciando 0,5 meq/L; acido fosforico al 75% ≈ 12 meq/mL (C).
- **Acqua senza analisi** (C): calcio, magnesio e bicarbonati stimati dalla durezza, con 75% calcio, 25% magnesio e
  alcalinità all'80% della durezza.
- **Controlli**:
  - con acqua pura ed EC 2,2 si ritrova Hoagland entro il 7%;
  - l'EC calcolata coincide con quella della coltura;
  - con acqua dura il nitrato di calcio scende e l'acido sale;
  - il calcio sta solo nella tanica A.
- **Limiti**:
  - i microelementi non sono calcolati: si usa una miscela chelata alla dose dell'etichetta;
  - l'assorbimento selettivo nel tempo (squilibri nel ricircolo) non è simulato.

## 4c. Meteo vero
- Dal browser, Open-Meteo: geocodifica del comune e archivio storico giornaliero (temperatura minima e massima,
  pioggia, ET0 FAO). In alternativa il CSV di `strumenti/scarica_meteo.py`.
- Idroponica: la temperatura media del garage segue quella esterna come nel §4; l'escursione è la metà di quella
  esterna (un quarto se il garage è isolato).
- Orto: pioggia, ET0 e temperature vere al posto della generazione statistica.

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

## 8b. Serbatoio simulato per provare il controllo (C)
`sistema/idro_modello.py`. Serve a provare la logica, non a prevedere la chimica.
- **Volume**: le piante bevono 0,15 L al giorno per pianta, di più con le luci accese.
- **EC**:
  - le piante assorbono sali al 70% della concentrazione, quindi l'EC sale bevendo;
  - il rabbocco con acqua di rete la riporta giù;
  - 1 mL/L di A (o di B) alza l'EC di 0,3.
- **pH = 4 + 4·a/(a+0,8)**, con a = alcalinità in meq/L:
  - le piante rilasciano 0,15 meq/L al giorno (assorbono nitrati);
  - l'acqua di rete porta 3,6 meq/L di bicarbonati;
  - il pH- commerciale ne toglie circa 6 per mL.
  - **Risultato importante**: è soprattutto il **rabbocco con acqua dura** a far salire il pH. Il limite giornaliero
    del pH- deve coprirlo (0,15 mL/L).
- **Sonde**: rumore pH 0,02 ed EC 0,01; deriva, blocco e distacco programmabili.

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
