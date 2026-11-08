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

**Preparazione.** Ogni giocatore tira un dado (a parità si ripete tra i pari): chi fa di più gioca per primo ed è il mazziere, gli altri seguono in ordine di arrivo. A turno, dal primo, si sceglie il colore (rosso, arancione, giallo, verde, blu, indaco: quelli nominati sulle carte missione, più il rosso). Il mazziere distribuisce gli obiettivi segreti e i 42 territori, partendo dal giocatore alla sua sinistra (quindi i primi della fila ricevono i territori in più). Dotazione iniziale: 35 armate con 3 giocatori, 30 con 4, 25 con 5, 20 con 6; una su ogni territorio, le altre si piazzano 3 alla volta a rotazione (nell'ultimo giro anche meno di 3).

**Turno, in 3 fasi.**
1. *Rinforzi*: territori ÷ 3 arrotondato per difetto (**nessun minimo**) + bonus continenti (Oceania 2, Sud America 2, Africa 3, Europa 5, Nord America 5, Asia 7). Si può giocare **un tris**: 3 cannoni 4, 3 fanti 6, 3 cavalieri 8, uno per tipo 10, jolly + 2 uguali 12; **+2 armate per ogni carta del tris che raffigura un territorio che possiedi**. Il tris non è mai obbligatorio. Le armate si collocano dove si vuole, tutte prima di combattere.
2. *Combattimenti*: si attacca un territorio confinante via terra o via mare (linee tratteggiate, anche Alaska–Kamchatka), mai da un territorio con una sola armata. L'attaccante dichiara i dadi (1–3, almeno un'armata resta a presidio); **il difensore dichiara quanti dadi usa (1–3) prima che l'attaccante tiri**. Si confrontano i dadi in ordine di grandezza; a parità vince il difensore. Chi conquista occupa con almeno le armate dell'ultimo lancio e può spostarne di più; il territorio conquistato può servire da base per altri attacchi. Non c'è blitz: ogni lancio è un attacco.
3. *Spostamento strategico*: uno solo per turno, da un tuo territorio a un tuo territorio **contiguo**, lasciando almeno un'armata; poi il turno è finito. Si può saltare.

A fine turno, se si è conquistato almeno un territorio, si pesca **una** carta (44 carte: 42 territori + 2 jolly). Chi pesca l'ultima carta rimescola gli scarti. Eliminando un avversario si prendono le sue carte. Se il difensore è scollegato, difende in automatico con il massimo dei dadi.

**Turno attuale.** Nel pannello laterale si segue il turno in corso passo dopo passo: rinforzi, tris, ogni attacco e gli spostamenti. Un attacco compare appena dichiarato (dadi coperti, difensore che sceglie); quando il difensore ha dichiarato i suoi dadi escono prima quelli dell'attaccante e, dopo circa un secondo, quelli del difensore, con il confronto dado per dado e il risultato. La mappa e i conteggi si aggiornano solo a lancio concluso. L'ordine rispetta il regolamento (il difensore dichiara prima che l'attaccante tiri): per questo i dadi dell'attaccante non sono visibili prima della scelta del difensore. L'ultimo scontro resta come voce comprimibile.

**Missioni segrete.** Le 12 carte del gioco originale (`Risk_Mission_Card.pdf`), tradotte in italiano. Vince chi per primo raggiunge la propria (controllo immediato; a fine partita si rivelano tutte): conquistare i continenti di Europa e Australia · Asia e Africa · Asia e Sud America · Nord America e Australia · Nord America e Africa · occupare 24 territori a scelta · occupare 18 territori ognuno con almeno 2 truppe · distruggere tutte le truppe verdi / gialle / blu / arancioni / indaco. Come stampato sulla carta, se comandi tu l'armata da distruggere devi invece occupare 24 territori. Se quell'armata non è in gioco, o viene eliminata da un altro, la carta non lo prevede: applico la stessa regola dei 24 territori.

**Carte territorio.** 42 carte (come nel PDF `Risk_Territory_Card.pdf`: 16 fanti, 16 cavalieri, 10 cannoni) più 2 jolly. In basso, durante la partita, vedi come carte vere la tua missione (cliccala per girarla a faccia in giù) e le tue carte territorio, con i nomi in italiano; passando il mouse si ingrandiscono e si evidenzia il territorio sulla mappa. Nella fase di rinforzo clicca 3 carte per scegliere il tris: l'anteprima mostra le armate che otterrai.

**Non implementato, per scelta** (varianti del regolamento): modalità Time Attack, Punteggi Vittoria dei territori, regola speciale rinforzi (+1 armata).

> **Nota:** il regolamento non descrive il contenuto delle carte missione: l'elenco viene dal PDF delle carte. Il PDF nomina solo 5 colori da distruggere (non il rosso, che qui è il sesto esercito); i colori del regolamento a stampa (viola, nero) sono quindi sostituiti da arancione e indaco. Il regolamento nota inoltre che nessuno può essere eliminato prima della fine del 4° turno: lo considero una conseguenza del gioco, non una regola da imporre.

## Mappa

Le sagome dei 42 territori vengono da un file SVG del tabellone fornito dall'utente (`Risk_board.svg`, layer "countries"); sono salvate già elaborate in `server/shapes.json`, quindi per far girare il gioco non serve altro. Per rigenerarle (serve Playwright e il file SVG originale, non incluso nel repository):

```bash
node tools/build-map.js percorso/Risk_board.svg
```

Lo script verifica anche che i territori che si toccano sulla mappa coincidano esattamente con le adiacenze delle regole, e deduce i collegamenti via mare. Nel gioco: rotella o pulsanti +/− per lo zoom, trascinamento per spostare la mappa, i nomi compaiono da ingrandito e al passaggio del mouse.

> **Licenza:** il file SVG non riporta la licenza. Prima di distribuire il progetto fuori dalla rete locale verificare le condizioni d'uso della fonte originale.

## Grafica delle carte

Sfondo, simboli (fante, cavaliere, cannone) e stemma delle carte sono estratti dai PDF originali con `tools/extract-cards.py` (richiede poppler, Pillow, numpy e i due PDF, non inclusi nel repository); i file prodotti sono in `public/cards/`. Nomi dei territori e testi delle missioni sono composti in italiano da `public/cards.js`.

> **Licenza:** i PDF delle carte e il file SVG della mappa non riportano la licenza. Prima di distribuire il progetto fuori dalla rete locale verificare le condizioni d'uso delle fonti originali.

## Test

```bash
npm test            # 60 partite simulate con bot (3–6 giocatori) e test di ogni regola del regolamento
node test/e2e.js    # flusso completo via WebSocket (registrazione, admin, lobby, riavvio, reset)
```
