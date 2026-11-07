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

Mappa classica (42 territori, 6 continenti, bonus 5/2/5/3/7/2). Armate iniziali 40/35/30 per 2/3/4 giocatori, piazzamento a turni di 3.
Turno: rinforzi (territori/3, min 3, + continenti, + tris) → attacco (1–3 dadi o blitz, difensore 1–2 dadi, spostamento dopo la conquista) → spostamento (una mossa, tra territori collegati) → carta se si è conquistato. Tris: 3 artiglieria 4, 3 cavalleria 6, 3 fanteria 8, 3 diverse 10, jolly jolly; obbligatorio con 5+ carte. Eliminando un avversario si prendono le sue carte. Vince l'ultimo giocatore rimasto (conquista del mondo): **non** sono implementate le carte obiettivo del Risiko italiano.

## Test

```bash
npm test            # 60 partite simulate con bot, invarianti delle regole
node test/e2e.js    # flusso completo via WebSocket (registrazione, admin, lobby, riavvio, reset)
```
