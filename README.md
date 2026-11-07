# Risiko LAN

Risiko multigiocatore (da 3 a 6 giocatori) giocabile da browser su rete locale.
Server **Node.js** (unica dipendenza: `ws`), client HTML/JS puro con mappa SVG. Nessun database: lo stato è in memoria e salvato su `data/state.json` (sopravvive ai riavvii).

## Installazione su Ubuntu

```bash
git clone <repo> && cd risk
sudo ./deploy/install.sh
```

Lo script installa Node, copia l'app in `/opt/risiko`, crea il servizio systemd `risiko` (porta 3000, stato in `/var/lib/risiko`) e stampa la **password admin generata al primo avvio**
(recuperabile con `journalctl -u risiko | grep -A1 Amministratore`). Se l'`nodejs` di apt fosse < 18, installare Node LTS da NodeSource e rilanciare.

Se c'è `ufw` attivo: `sudo ufw allow from 192.168.0.0/16 to any port 3000 proto tcp` (adattare alla propria LAN).
Poi i giocatori aprono `http://IP-DEL-SERVER:3000`.

Prova locale senza installare: `npm install && npm start` (admin e password compaiono in console).
Variabili: `PORT`, `HOST`, `RISK_DATA_DIR`, `RISK_ADMIN_USER`, `RISK_ADMIN_PASSWORD` (queste ultime solo al primo avvio; poi la password si cambia dal pannello admin).

## Uso

- **Giocatori**: entrano con il solo nome (nessun controllo d'identità). Se perdono il browser possono rientrare con lo stesso nome finché nessuno lo sta usando.
- **Amministratore**: scheda "Amministratore", userid + password. È anche un giocatore normale; in più ha il pannello ⚙ per rimuovere giocatori, annullare singole partite, **reset totale** (cancella partite e giocatori) e cambiare password.
- **Sessioni**: più partite in parallelo, ognuna da 3 a 6 giocatori. Chi crea la partita la avvia e può annullarla; l'admin può annullare qualsiasi partita. Chi abbandona una partita in corso lascia i suoi territori neutrali.

## Regole implementate

Segue il regolamento ufficiale RisiKo! (Editrice Giochi), **modalità tradizionale**, **da 3 a 6 giocatori**.

**Preparazione.** Ogni giocatore tira un dado (a parità si ripete tra i pari): chi fa di più gioca per primo ed è il mazziere, gli altri seguono in ordine di arrivo. A turno, dal primo, si sceglie il colore (rosso, viola, giallo, verde, blu, nero). Il mazziere distribuisce gli obiettivi segreti e i 42 territori, partendo dal giocatore alla sua sinistra (quindi i primi della fila ricevono i territori in più). Dotazione iniziale: 35 armate con 3 giocatori, 30 con 4, 25 con 5, 20 con 6; una su ogni territorio, le altre si piazzano 3 alla volta a rotazione (nell'ultimo giro anche meno di 3).

**Turno, in 3 fasi.**
1. *Rinforzi*: territori ÷ 3 arrotondato per difetto (**nessun minimo**) + bonus continenti (Oceania 2, Sud America 2, Africa 3, Europa 5, Nord America 5, Asia 7). Si può giocare **un tris**: 3 cannoni 4, 3 fanti 6, 3 cavalieri 8, uno per tipo 10, jolly + 2 uguali 12; **+2 armate per ogni carta del tris che raffigura un territorio che possiedi**. Il tris non è mai obbligatorio. Le armate si collocano dove si vuole, tutte prima di combattere.
2. *Combattimenti*: si attacca un territorio confinante via terra o via mare (linee tratteggiate, anche Alaska–Kamchatka), mai da un territorio con una sola armata. L'attaccante dichiara i dadi (1–3, almeno un'armata resta a presidio); **il difensore dichiara quanti dadi usa (1–3) prima che l'attaccante tiri**. Si confrontano i dadi in ordine di grandezza; a parità vince il difensore. Chi conquista occupa con almeno le armate dell'ultimo lancio e può spostarne di più; il territorio conquistato può servire da base per altri attacchi. Non c'è blitz: ogni lancio è un attacco.
3. *Spostamento strategico*: uno solo per turno, da un tuo territorio a un tuo territorio **contiguo**, lasciando almeno un'armata; poi il turno è finito. Si può saltare.

A fine turno, se si è conquistato almeno un territorio, si pesca **una** carta (44 carte: 42 territori + 2 jolly). Chi pesca l'ultima carta rimescola gli scarti. Eliminando un avversario si prendono le sue carte. Se il difensore è scollegato, difende in automatico con il massimo dei dadi.

**Obiettivi segreti.** Vince chi per primo raggiunge il proprio (controllo immediato; a fine partita si rivelano tutti): 24 territori · 18 territori con almeno 2 armate ciascuno · Asia + Sud America · Asia + Africa · Nord America + Africa · Nord America + Oceania · Europa + Sud America + un terzo continente · Europa + Oceania + un terzo continente · distruggere l'armata di un colore. Se quell'armata non è in gioco, è la propria o viene eliminata da un altro, l'obiettivo diventa 24 territori.

**Non implementato, per scelta** (varianti del regolamento): modalità Time Attack, Punteggi Vittoria dei territori, regola speciale rinforzi (+1 armata).

> **Da verificare:** il regolamento non elenca il contenuto delle carte obiettivo né spiega cosa accade quando l'armata da distruggere non c'è. L'elenco sopra e la regola dei 24 territori vengono da fonti non ufficiali consultate in precedenza e dalla memoria, non dal regolamento. Gli obiettivi sono tutti in `server/objectives.js` (`DEFS`) e si cambiano in un punto solo. Il regolamento nota inoltre che un giocatore non può essere eliminato prima della fine del 4° turno: non è una regola da far rispettare ma una conseguenza del gioco, quindi non l'ho imposta.

## Mappa

Le sagome dei 42 territori vengono da un file SVG del tabellone fornito dall'utente (`Risk_board.svg`, layer "countries"); sono salvate già elaborate in `server/shapes.json`, quindi per far girare il gioco non serve altro. Per rigenerarle (serve Playwright e il file SVG originale, non incluso nel repository):

```bash
node tools/build-map.js percorso/Risk_board.svg
```

Lo script verifica anche che i territori che si toccano sulla mappa coincidano esattamente con le adiacenze delle regole, e deduce i collegamenti via mare. Nel gioco: rotella o pulsanti +/− per lo zoom, trascinamento per spostare la mappa, i nomi compaiono da ingrandito e al passaggio del mouse.

> **Licenza:** il file SVG non riporta la licenza. Prima di distribuire il progetto fuori dalla rete locale verificare le condizioni d'uso della fonte originale.

## Test

```bash
npm test            # 60 partite simulate con bot (3–6 giocatori) e test di ogni regola del regolamento
node test/e2e.js    # flusso completo via WebSocket (registrazione, admin, lobby, riavvio, reset)
```
