# Sicurezza del dosaggio automatico

**Stato: il modo REALE è disattivato in questo prototipo e lo resta finché non ci sono le protezioni hardware montate e
collaudate.** Niente di quello che segue è stato provato su un impianto vero: le prove sono simulate
(`sistema/idro_modello.py`, `test/test_sicurezza_dosaggio.py`, `test/test_firmware_idro.py`). Prima di dosare in
automatico, il piano di collaudo della sezione 5 va fatto e fatto controllare da una persona competente
(elettricista o tecnico di automazione). Il primo impianto si dosa **a mano**.

## 1. Perché "si ferma entro 60 secondi" non basta

Il controllo software si accorge di un dosatore bloccato (EC che sale o pH che scende troppo) e apre il relè di
abilitazione. Ma:
- **un relè incollato**, o un MOSFET in corto con il relè incollato, non apre: il software chiede di spegnere e la
  corrente continua ad arrivare;
- **un ESP32 bloccato** non chiede niente;
- in 60 secondi una pompa peristaltica porta 30-120 mL. Quanto danno fanno dipende dal **volume** e dalla
  **capacità tampone** della soluzione, non da un numero fisso.

Per questo la protezione che conta è **fisica e indipendente dal firmware**. Il software aggiunge controlli in più.

## 2. Architettura fail-safe

Alimentazione 12 V dei dosatori, in serie, nell'ordine:

1. **Fusibile.**
2. **Arresto di emergenza a fungo**, contatto normalmente chiuso. Un secondo contatto, letto dall'ESP32, segnala l'arresto.
3. **Galleggiante di minimo**: con poca acqua i dosatori non hanno corrente.
4. **Flussostato** sul ricircolo: senza miscelazione i dosatori non hanno corrente.
5. **Relè temporizzato monostabile**: apre da solo dopo il tempo massimo di una dose anche se il comando resta, calcolato con
   `verifica_installazione` (sezione 3). È la protezione contro ESP32 bloccato, watchdog che non interviene e
   MOSFET in corto.
6. **Relè di abilitazione** comandato dall'ESP32 (GPIO 23): chiuso solo durante una dose.
7. **Sensore di tensione** subito dopo il relè di abilitazione (optoaccoppiatore su GPIO 34): serve all'**autotest del
   taglio**.
8. I **MOSFET** dei singoli dosatori (GPIO 16, 17, 18), con diodo di ricircolo.

**Interruttore a chiave** (GPIO 35) per il modo REALE: va chiuso a mano. Il modo REALE si attiva solo se, **a ogni passo**:
- la chiave fisica è chiusa;
- l'autotest del taglio è riuscito da meno di 24 ore. Il relè di abilitazione viene aperto e chiuso con tutti i
  dosatori spenti, e il sensore di tensione deve seguirlo; un relè incollato o un sensore guasto fanno fallire la prova;
- `verifica_installazione` dà esito "sicuro" per l'impianto vero;
- il collaudo è completo: 11 voci di `COLLAUDO_RICHIESTO`, tra cui titolazione, flussostato e temporizzatore;
- la taratura del pH ha meno di 30 giorni;
- c'è la conferma esplicita.

**Nessun parametro da solo lo attiva**: lo verifica `test_reale_mai_con_un_parametro_solo`. Con la configurazione del
repository il modo resta OMBRA anche con la chiave chiusa e l'autotest riuscito.

## 3. Dose massima per l'impianto vero

`sistema/sicurezza_dosaggio.py`, funzione `verifica_installazione`. Considera il caso peggiore: il dosatore di pH- resta
acceso finché non apre il relè a tempo, partendo dal pH più basso del funzionamento normale (obiettivo meno banda) e
dal volume al galleggiante di minimo. Il pH deve restare sopra **4,5**, la soglia di danno alle radici. Inoltre una
dose normale non deve spostare il pH più di **0,3**. Il calcolo usa:
- **la titolazione misurata**, che va sempre fatta: in un secchio con un volume noto della **tua** soluzione si
  aggiunge il **tuo** acido, poco alla volta, e si legge il pH dopo ogni aggiunta;
- altrimenti un modello chimico semplice (affidabilità C), solo per una prima idea.

Esempi con il modello (stesso acido, stesse pompe, impianti diversi):

| Impianto | Esito | pH nel caso peggiore | Acido massimo prima del danno | Temporizzatore massimo |
|---|---|---|---|---|
| 120 L, pH- diluito 1:10, pompa 0,5 mL/s, temporizzatore 20 s | **sicuro** | 5.4 | 73.1 mL | 146 s |
| 20 L, pH- non diluito, pompa 0,5 mL/s, temporizzatore 20 s | **non sicuro** | 1.9 | 1.2 mL | 2 s |
| 30 L, pH- diluito 1:10, pompa 2 mL/s, temporizzatore 60 s | **non sicuro** | 2.0 | 18.3 mL | 9 s |
| 120 L ma galleggiante di minimo a 40 L, 1:10, 0,5 mL/s, 20 s | **sicuro** | 5.2 | 24.4 mL | 49 s |


"Acido diluito 1:10 e pompa da 0,5 mL/s" non è quindi un valore sicuro in generale: lo è su 120 L, non con un
serbatoio piccolo o con l'acido non diluito. Il calcolo coincide con il simulatore del serbatoio. Con l'acido non
diluito a 1,5 mL/s per 20 s su 120 L, calcolo e simulatore danno entrambi pH 2,7: lo verifica
`test_calcolo_uguale_al_simulatore_con_dosatore_bloccato`.

## 4. Matrice dei guasti

Scale da 1 a 5:
- **G, gravità**: 5 = piante perse o pericolo per le persone;
- **P, probabilità**: n.s. = non stimabile senza dati di campo; i valori sono una stima a priori, da correggere con
  l'esperienza;
- **R, rilevabilità**: 1 = rilevato subito, 5 = non rilevato.

Ogni guasto con gravità 4 o più ha una protezione che funziona anche con il firmware bloccato, e una prova fisica
(controllato da `test_matrice_dei_guasti_completa`).

| ID | Guasto | Causa | Effetto | G | P | R | G×P×R | Protezione software | Protezione hardware (indipendente dal firmware) | Prova fisica |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | Relè di abilitazione dei dosatori incollato chiuso | contatti saldati da correnti di spunto, fine vita | i MOSFET restano alimentati: basta un MOSFET in corto per dosare senza fine | 5 | 2 | 2 | 20 | autotest del taglio a ogni avvio e ogni 24 h: con il relè comandato aperto il sensore di tensione deve leggere 0; se no, dosaggio bloccato | temporizzatore hardware (relè a ritardo) in serie che apre comunque dopo pochi secondi; fusibile; galleggiante di minimo in serie | F3 (relè incollato simulato con un ponticello: il temporizzatore deve aprire) |
| G2 | MOSFET di un dosatore in corto | sovratensione senza diodo, calore | pompa sempre accesa quando il relè di abilitazione è chiuso | 5 | 2 | 3 | 30 | relè di abilitazione chiuso solo durante una dose; controllo EC/pH dopo ogni dose (DOSATORE_BLOCCATO) | relè di abilitazione in serie + temporizzatore hardware + diodo di ricircolo | F2 (MOSFET in corto simulato: la pompa deve fermarsi al massimo dopo il tempo del temporizzatore) |
| G3 | ESP32 bloccato con un'uscita accesa | errore nel firmware, disturbo, memoria piena | il firmware non spegne la pompa | 5 | 3 | 4 | 60 | watchdog (riavvio); al riavvio tutte le uscite a 0 | temporizzatore hardware indipendente dall'ESP32: apre l'alimentazione dei dosatori dopo il tempo massimo | F4 (firmware fermato con un comando di debug a dosatore acceso) |
| G4 | Watchdog che non interviene | disattivato per sbaglio, alimentato dal ciclo bloccato | l'ESP32 resta bloccato | 4 | 2 | 5 | 40 | nessuna affidabile (è il software stesso che è fermo) | temporizzatore hardware (G3) e arresto di emergenza a fungo NC | F4 |
| G5 | Sonda pH guasta, staccata o non tarata | elettrodo vecchio, bolla d'aria, taratura scaduta | il controllo vede pH alto e continua a dosare acido | 4 | 4 | 3 | 48 | letture fuori campo, ferme o con salti scartate; dose inefficace -> blocco; taratura entro 30 giorni; confronto con la penna | limite fisico dell'acido per ogni dose (volume del dosatore e temporizzatore) | F6 (sonda in aria e in soluzione tampone sbagliata: nessuna dose) |
| G6 | Pompa dosatrice con portata eccessiva | pompa diversa da quella collaudata, tubo più grosso | ogni dose è più grande del previsto | 4 | 3 | 3 | 36 | dose calcolata in mL dalla portata MISURATA al collaudo; verifica dell'effetto dopo ogni dose | temporizzatore hardware dimensionato con verifica_installazione sulla portata misurata | F1 (portata misurata con un cilindro graduato, 3 prove) |
| G7 | Dosatore vuoto o tubo con aria | tanica finita | dosi senza effetto, il controllo insiste | 2 | 4 | 2 | 16 | DOSAGGIO_INEFFICACE dopo 3 dosi senza effetto: blocco fino a reset | nessuna | F6 |
| G8 | Serbatoio piccolo o livello basso | evaporazione, rabbocco mancato, impianto più piccolo del previsto | la stessa dose sposta molto di più il pH | 4 | 3 | 2 | 24 | dose proporzionale al volume; verifica_installazione sul volume del galleggiante di minimo | galleggiante di minimo in serie all'alimentazione dei dosatori | F5 (galleggiante alzato a mano: i dosatori non devono partire) |
| G9 | Mancata miscelazione | pompa di ricircolo ferma o guasta | l'acido resta concentrato vicino alle radici; la sonda legge un valore sbagliato | 4 | 3 | 3 | 36 | dose solo con flusso confermato e attesa di miscelazione; FLUSSO_ASSENTE blocca | flussostato (interruttore di flusso) in serie all'alimentazione dei dosatori: senza ricircolo niente corrente (richiesto per il modo REALE) | F8 (pompa di ricircolo staccata: i dosatori non devono avere tensione) |
| G10 | Concentrazione chimica sbagliata | acido non diluito o di un'altra marca, errore di preparazione | ogni dose 5-10 volte più forte | 5 | 3 | 4 | 60 | controllo dell'effetto della prima dose dopo ogni cambio di tanica (salto massimo) | tanica piccola (non più acido di quello che il serbatoio sopporta: ml_massimi_prima_del_danno) | F7 (titolazione della soluzione vera con l'acido vero) |
| G11 | Blackout e ripristino | mancanza di corrente durante una dose | dose interrotta, stato non noto al riavvio | 3 | 4 | 2 | 24 | al riavvio uscite a 0, attesa e stato DISABILITATO/ATTESA; memoria dei blocchi; nessuna dose finché le letture non sono stabili | relè e MOSFET normalmente aperti senza alimentazione | F9 (spina staccata durante una dose ad acqua) |
| G12 | Riavvio con stati non coerenti | memoria salvata a metà, parametri modificati | il controllo riparte credendo di essere in un altro stato | 3 | 2 | 3 | 18 | stato ricostruito dalle letture e non dalla memoria; i blocchi salvati sopravvivono; modo REALE ricontrollato a ogni passo | nessuna | F9 |
| G13 | Modo REALE attivato per sbaglio | parametro cambiato da rete o a mano | dosaggio automatico senza collaudo | 5 | 2 | 2 | 20 | REALE solo con chiave fisica chiusa, autotest del taglio recente e collaudo completo: un parametro da solo non basta | chiave fisica (interruttore a chiave) letta su un pin di ingresso | F10 (con la chiave aperta il modo resta OMBRA qualunque sia il parametro) |

## 5. Piano di collaudo fisico (da far verificare a un tecnico prima dell'uso)

Tutte le prove si fanno **con acqua**, tranne la F7. Si annotano data, esito e chi le ha fatte; le voci diventano True in
`collaudo` solo dopo la prova.

| Prova | Come | Esito atteso |
|---|---|---|
| F1 Portata dei dosatori | 3 dosi da 10 s in un cilindro graduato, per ogni pompa | portata misurata (mL/s) in `ML_AL_SECONDO`; scarto fra le 3 prove < 10% |
| F2 MOSFET in corto | ponticello al posto del MOSFET del pH-, abilitazione comandata per una dose | la pompa si ferma al più tardi dopo il tempo del relè a tempo |
| F3 Relè incollato | ponticello sui contatti del relè di abilitazione | l'autotest fallisce, il modo resta OMBRA, il relè a tempo apre comunque |
| F4 ESP32 bloccato | comando di debug che ferma il firmware con un dosatore acceso | il relè a tempo apre; al riavvio tutte le uscite sono spente |
| F5 Galleggiante di minimo | galleggiante tenuto basso a mano | nessuna tensione ai dosatori (misura con il tester) |
| F6 Sonda pH | sonda in aria, poi in tampone 4 e 7 scambiati | nessuna dose, allarme |
| F7 Titolazione | 10 L della soluzione vera e acido vero, 0,5 mL alla volta, pH dopo ogni aggiunta | curva inserita in `verifica_installazione`: esito "sicuro" |
| F8 Flussostato | pompa di ricircolo staccata | nessuna tensione ai dosatori |
| F9 Blackout | spina staccata durante una dose, poi riattaccata | dose interrotta, al riavvio niente dosi finché le letture non sono stabili |
| F10 Chiave | modo "reale" nei parametri, chiave aperta | il controllo resta in OMBRA e lo scrive (REALE_NON_ATTIVO: chiave_fisica) |
| F11 Arresto a fungo | fungo premuto durante una dose ad acqua | tutto spento subito, anche con l'ESP32 staccato |
| F12 Settimana in ombra | 7 giorni in OMBRA con le dosi proposte confrontate con quelle che faresti a mano | nessuna dose proposta assurda |

Dopo il collaudo: almeno un mese con il dosaggio automatico **solo sull'EC** (A e B) prima del pH-.
