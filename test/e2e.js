'use strict';
// Avvia il server su una porta temporanea e prova il flusso completo via WebSocket.
const { spawn } = require('child_process');
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const WebSocket = require('ws');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'risk-'));
const PORT = 3999;
const env = { ...process.env, PORT, RISK_DATA_DIR: dir, RISK_ADMIN_USER: 'boss', RISK_ADMIN_PASSWORD: 'segreta1' };
const start = () => new Promise((res) => { const p = spawn('node', [path.join(__dirname, '../server/server.js')], { env }); p.stdout.on('data', (d) => /ascolto/.test(d) && res(p)); });
const client = () => new Promise((res) => {
  const ws = new WebSocket('ws://localhost:' + PORT), c = { ws, last: null, errs: [], token: null };
  ws.on('message', (m) => { m = JSON.parse(m); if (m.type === 'state') c.last = m; if (m.type === 'error') c.errs.push(m.message); if (m.type === 'auth') c.token = m.token; if (m.type === 'notice') c.notice = m.message; });
  c.send = async (o) => { ws.send(JSON.stringify(o)); await new Promise((r) => setTimeout(r, 120)); };
  ws.on('open', () => res(c));
});
(async () => {
  let srv = await start();
  const [a, b, c, d, e, adm] = await Promise.all([1, 2, 3, 4, 5, 6].map(client));
  await a.send({ type: 'register', name: 'Anna' }); await b.send({ type: 'register', name: 'Bruno' });
  await c.send({ type: 'register', name: 'Carla' }); await d.send({ type: 'register', name: 'Dario' }); await e.send({ type: 'register', name: 'Elia' });
  await e.send({ type: 'register', name: 'anna' }); assert(e.errs.pop().includes('in uso'), 'nome duplicato online');
  await adm.send({ type: 'adminLogin', user: 'boss', password: 'sbagliata' }); await new Promise((r) => setTimeout(r, 1000)); assert(adm.errs.pop().includes('errate'));
  await adm.send({ type: 'adminLogin', user: 'boss', password: 'segreta1' });
  assert(adm.last.me.isAdmin && adm.last.admin.players.length === 6);
  await a.send({ type: 'createGame', name: 'G1' });
  const gid = a.last.me.gameId; assert(gid);
  for (const x of [b, c, d]) await x.send({ type: 'joinGame', id: gid });
  await e.send({ type: 'joinGame', id: gid }); assert(e.errs.pop().includes('al completo'), '5° giocatore rifiutato');
  await b.send({ type: 'startGame' }); assert(b.errs.pop().includes('Solo chi'), 'solo host avvia');
  await a.send({ type: 'startGame' });
  assert.strictEqual(a.last.game.status, 'playing');
  assert(a.last.game.players.every((p) => p.id === a.last.me.id ? p.cards : !p.cards), 'carte altrui nascoste');
  const first = a.last.game.players[a.last.game.turn].id;
  const mover = [a, b, c, d].find((x) => x.last.me.id !== first);
  await mover.send({ type: 'act', a: 'place', t: 'ala', n: 1 }); assert(mover.errs.pop().includes('turno'), 'turno rispettato');
  await b.send({ type: 'adminKick', id: a.last.me.id }); assert(b.errs.pop().includes('autorizzato'), 'kick solo admin');
  // persistenza: riavvio del server
  srv.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 400));
  srv = await start();
  const a2 = await client(); await a2.send({ type: 'resume', token: a.token });
  assert.strictEqual(a2.last.game.status, 'playing', 'partita ripristinata dopo riavvio');
  const adm2 = await client(); await adm2.send({ type: 'adminLogin', user: 'boss', password: 'segreta1' });
  // annullamento + reset
  await adm2.send({ type: 'cancelGame', id: gid }); assert(a2.notice && !a2.last.game, 'annullamento');
  await a2.send({ type: 'createGame', name: 'G2' });
  await adm2.send({ type: 'adminReset' });
  assert.strictEqual(adm2.last.games.length, 0); assert.strictEqual(adm2.last.admin.players.length, 1);
  await a2.send({ type: 'resume', token: a.token }); assert(a2.errs.pop().includes('scaduta'), 'giocatori rimossi dopo reset');
  console.log('OK e2e'); srv.kill(); setTimeout(() => process.exit(0), 100);
})().catch((e) => { console.error(e); process.exit(1); });
