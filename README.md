# Risiko LAN

Risiko multigiocatore (2–4 giocatori) giocabile da browser su rete locale.
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
- **Sessioni**: più partite in parallelo, ognuna max 4 giocatori. Chi crea la partita la avvia e può annullarla; l'admin può annullare qualsiasi partita. Chi abbandona una partita in corso lascia i suoi territori neutrali.

## Regole implementate

Mappa classica (42 territori, 6 continenti, bonus 5/2/5/3/7/2). Armate iniziali 35/30 per 3/4 giocatori (40 per 2), piazzamento a turni di 3. Eserciti di 6 colori (blu, rosso, nero, giallo, verde, viola), 4 assegnati a caso.
Turno: rinforzi (territori/3, min 3, + continenti, + tris) → attacco (attaccante 1–3 dadi, **difensore 1–3 dadi**, pareggio al difensore, blitz, spostamento dopo la conquista) → spostamento (una mossa, tra territori collegati) → carta se si è conquistato.
Tris: 3 cannoni 4, 3 fanti 6, 3 cavalli 8, uno per tipo 10, jolly + 2 uguali 12 (il jolly non sostituisce altre carte); obbligatorio con 5+ carte. Eliminando un avversario si prendono le sue carte.

### Carte obiettivo (segrete)
Ogni giocatore riceve a caso una delle 14 carte, vince chi per primo la realizza (controllo immediato dopo ogni sua azione):
conquistare 24 territori · 18 territori con almeno 2 armate ciascuno · Asia + Sud America · Asia + Africa · Nord America + Africa · Nord America + Oceania · Europa + Sud America + un terzo continente · Europa + Oceania + un terzo continente · distruggere l'armata di uno dei 6 colori.
Se l'armata da distruggere non è in gioco, è la propria, o viene eliminata da un altro giocatore, l'obiettivo diventa **24 territori**. A fine partita tutti gli obiettivi vengono rivelati. Vince comunque chi resta l'ultimo giocatore.

> **Da verificare:** non ho potuto consultare il regolamento ufficiale. I tipi di obiettivo, i valori dei tris, il jolly, i 3 dadi di difesa e la regola del colore non in gioco sono confermati da fonti consultate; l'elenco esatto dei continenti nelle carte e il minimo di 3 rinforzi per turno sono da memoria. L'edizione "Torneo" ha 16 obiettivi diversi, non implementata. Gli obiettivi sono tutti in `server/objectives.js` (`DEFS`), modificabili in un punto solo.

## Mappa

Le sagome dei 42 territori vengono da un file SVG del tabellone fornito dall'utente (`Risk_board.svg`, layer "countries"); sono salvate già elaborate in `server/shapes.json`, quindi per far girare il gioco non serve altro. Per rigenerarle (serve Playwright e il file SVG originale, non incluso nel repository):

```bash
node tools/build-map.js percorso/Risk_board.svg
```

Lo script verifica anche che i territori che si toccano sulla mappa coincidano esattamente con le adiacenze delle regole, e deduce i collegamenti via mare. Nel gioco: rotella o pulsanti +/− per lo zoom, trascinamento per spostare la mappa, i nomi compaiono da ingrandito e al passaggio del mouse.

> **Licenza:** il file SVG non riporta la licenza. Prima di distribuire il progetto fuori dalla rete locale verificare le condizioni d'uso della fonte originale.

## Test

```bash
npm test            # 60 partite simulate con bot, invarianti delle regole
node test/e2e.js    # flusso completo via WebSocket (registrazione, admin, lobby, riavvio, reset)
```
