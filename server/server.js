'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const game = require('./game');
const MAP = require('./map');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.RISK_DATA_DIR || path.join(__dirname, '..', 'data');
const PUBLIC = path.join(__dirname, '..', 'public');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- Credenziali amministratore (userid + password) ----------
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
function setAdminPassword(admin, pw) {
  admin.salt = crypto.randomBytes(16).toString('hex');
  admin.hash = hashPw(pw, admin.salt);
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin), { mode: 0o600 });
}
function loadAdmin() {
  try { return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8')); } catch { /* primo avvio */ }
  const admin = { user: (process.env.RISK_ADMIN_USER || 'admin').trim() };
  let pw = process.env.RISK_ADMIN_PASSWORD;
  const generated = !pw;
  if (generated) pw = crypto.randomBytes(6).toString('base64url');
  setAdminPassword(admin, pw);
  console.log('==================================================');
  console.log(` Amministratore creato: userid="${admin.user}" password="${pw}"`);
  if (generated) console.log(' (password generata: cambiala dal pannello admin)');
  console.log('==================================================');
  return admin;
}
const ADMIN = loadAdmin();
const adminOk = (user, pw) => {
  const a = Buffer.from(hashPw(String(pw), ADMIN.salt), 'hex'), b = Buffer.from(ADMIN.hash, 'hex');
  return String(user).toLowerCase() === ADMIN.user.toLowerCase() && crypto.timingSafeEqual(a, b);
};

// ---------- Stato persistente ----------
const STATE_FILE = path.join(DATA_DIR, 'state.json');
let S = { players: {}, games: {} };
try { S = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { /* stato vuoto */ }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = STATE_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(S), (e) => { if (!e) fs.rename(tmp, STATE_FILE, () => {}); });
  }, 300);
}
const rid = () => crypto.randomBytes(6).toString('hex');
const tokenOf = () => crypto.randomBytes(24).toString('base64url');

// ---------- Connessioni ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
const online = (pid) => [...wss.clients].some((c) => c.pid === pid && c.readyState === 1);
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const sendTo = (pid, o) => wss.clients.forEach((c) => c.pid === pid && send(c, o));

function snapshot(p) {
  const games = Object.values(S.games).map((g) => ({
    id: g.id, name: g.name, status: g.status, hostId: g.hostId, max: game.MAX_PLAYERS,
    players: g.players.map((x) => ({ id: x.id, name: x.name })),
  }));
  const g = p.gameId && S.games[p.gameId];
  const msg = { type: 'state', me: { id: p.id, name: p.name, isAdmin: !!p.isAdmin, gameId: g ? g.id : null }, games, game: g ? game.view(g, p.id) : null };
  if (p.isAdmin) {
    msg.admin = { user: ADMIN.user, players: Object.values(S.players).map((x) => ({ id: x.id, name: x.name, isAdmin: !!x.isAdmin, gameId: x.gameId || null, online: online(x.id) })) };
  }
  return msg;
}
function broadcast() {
  save();
  wss.clients.forEach((c) => { const p = c.pid && S.players[c.pid]; if (p) send(c, snapshot(p)); });
}

// ---------- Operazioni ----------
function dropFromGame(p, why) {
  const g = S.games[p.gameId];
  p.gameId = null;
  if (!g) return;
  game.eliminate(g, p.id, why);
  if (g.status === 'lobby' && g.players.length === 0) delete S.games[g.id];
  else if (g.status !== 'lobby' && g.players.every((x) => !Object.values(S.players).some((q) => q.id === x.id && q.gameId === g.id))) delete S.games[g.id];
}
function cancelGame(g, byName) {
  Object.values(S.players).forEach((p) => {
    if (p.gameId === g.id) { p.gameId = null; sendTo(p.id, { type: 'notice', message: `La partita "${g.name}" è stata annullata da ${byName}.` }); }
  });
  delete S.games[g.id];
}
function removePlayer(p) {
  dropFromGame(p, 'è stato rimosso dall\'amministratore');
  delete S.players[p.id];
  wss.clients.forEach((c) => { if (c.pid === p.id) { send(c, { type: 'kicked', message: 'Sei stato rimosso dall\'amministratore.' }); c.pid = null; } });
}

const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
const failures = new Map(); // ip -> {n, until}

function authOk(ws, p) {
  ws.pid = p.id;
  send(ws, { type: 'auth', token: p.token });
}

async function handle(ws, m) {
  const fail = (message, code) => send(ws, { type: 'error', message, code });
  const p = ws.pid && S.players[ws.pid];

  if (m.type === 'register') {
    const name = cleanName(m.name);
    if (name.length < 2) return fail('Il nome deve avere almeno 2 caratteri');
    if (sameName(name, ADMIN.user)) return fail('Nome riservato');
    const ex = Object.values(S.players).find((x) => sameName(x.name, name));
    if (ex) {
      // nessun controllo d'identità: si può riprendere un nome solo se nessuno lo sta usando
      if (ex.isAdmin || online(ex.id)) return fail('Nome già in uso da un giocatore connesso');
      ex.token = tokenOf(); authOk(ws, ex); return broadcast();
    }
    const np = { id: rid(), name, token: tokenOf(), isAdmin: false, gameId: null, createdAt: Date.now() };
    S.players[np.id] = np; authOk(ws, np); return broadcast();
  }
  if (m.type === 'resume') {
    const ex = Object.values(S.players).find((x) => x.token && x.token === m.token);
    if (!ex) return fail('Sessione scaduta', 'auth');
    authOk(ws, ex); return broadcast();
  }
  if (m.type === 'adminLogin') {
    const ip = ws._ip, f = failures.get(ip) || { n: 0, until: 0 };
    if (Date.now() < f.until) return fail('Troppi tentativi, riprova tra qualche secondo');
    if (!adminOk(m.user || '', m.password || '')) {
      f.n++; if (f.n >= 5) { f.until = Date.now() + 30000; f.n = 0; } failures.set(ip, f);
      await new Promise((r) => setTimeout(r, 800));
      return fail('Credenziali errate');
    }
    failures.delete(ip);
    let ap = Object.values(S.players).find((x) => x.isAdmin);
    if (!ap) { ap = { id: rid(), isAdmin: true, gameId: null, createdAt: Date.now() }; S.players[ap.id] = ap; }
    ap.name = ADMIN.user; ap.token = tokenOf();
    authOk(ws, ap); return broadcast();
  }
  if (!p) return fail('Non autenticato', 'auth');

  switch (m.type) {
    case 'logout': ws.pid = null; return;
    case 'createGame': {
      if (p.gameId && S.games[p.gameId]) return fail('Sei già in una partita');
      const name = cleanName(m.name) || `Partita di ${p.name}`;
      const g = game.createGame(rid(), name, p);
      S.games[g.id] = g; p.gameId = g.id; return broadcast();
    }
    case 'joinGame': {
      if (p.gameId && S.games[p.gameId]) return fail('Sei già in una partita');
      const g = S.games[m.id];
      if (!g) return fail('Partita inesistente');
      const e = game.addPlayer(g, p);
      if (e) return fail(e);
      p.gameId = g.id; return broadcast();
    }
    case 'leaveGame': {
      const g = S.games[p.gameId];
      if (!g) { p.gameId = null; return broadcast(); }
      dropFromGame(p, 'ha abbandonato la partita'); return broadcast();
    }
    case 'startGame': {
      const g = S.games[p.gameId];
      if (!g || g.hostId !== p.id) return fail('Solo chi ha creato la partita può avviarla');
      const e = game.start(g);
      if (e) return fail(e);
      return broadcast();
    }
    case 'act': {
      const g = S.games[p.gameId];
      if (!g) return fail('Non sei in una partita');
      const e = game.act(g, p.id, m);
      if (e) return fail(e);
      return broadcast();
    }
    case 'cancelGame': {
      const g = S.games[p.isAdmin && m.id ? m.id : p.gameId];
      if (!g) return fail('Partita inesistente');
      if (!p.isAdmin && g.hostId !== p.id) return fail('Solo chi ha creato la partita (o l\'admin) può annullarla');
      cancelGame(g, p.isAdmin ? 'l\'amministratore' : p.name); return broadcast();
    }
    case 'adminKick': {
      if (!p.isAdmin) return fail('Non autorizzato');
      const t = S.players[m.id];
      if (!t || t.isAdmin) return fail('Giocatore non valido');
      removePlayer(t); return broadcast();
    }
    case 'adminReset': {
      if (!p.isAdmin) return fail('Non autorizzato');
      Object.values(S.games).forEach((g) => cancelGame(g, 'l\'amministratore (reset totale)'));
      Object.values(S.players).filter((x) => !x.isAdmin).forEach(removePlayer);
      S.games = {}; return broadcast();
    }
    case 'adminPassword': {
      if (!p.isAdmin) return fail('Non autorizzato');
      const pw = String(m.password || '');
      if (pw.length < 6) return fail('La password deve avere almeno 6 caratteri');
      setAdminPassword(ADMIN, pw);
      return send(ws, { type: 'notice', message: 'Password amministratore aggiornata.' });
    }
    default: return fail('Messaggio sconosciuto');
  }
}

wss.on('connection', (ws, req) => {
  ws._ip = req.socket.remoteAddress;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.type !== 'string') return;
    handle(ws, m).catch((e) => { console.error(e); send(ws, { type: 'error', message: 'Errore interno' }); });
  });
  ws.on('close', () => broadcast());
});
setInterval(() => wss.clients.forEach((c) => { if (!c.isAlive) return c.terminate(); c.isAlive = false; c.ping(); }), 30000);

// ---------- HTTP statico ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/map.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ continents: MAP.CONTINENTS, territories: MAP.TERRITORIES, edges: MAP.EDGES }));
  }
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});
server.on('upgrade', (req, sock, head) => wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws, req)));
server.listen(PORT, HOST, () => console.log(`Risiko in ascolto su http://${HOST}:${PORT}`));
process.on('SIGTERM', () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(S)); } catch {} process.exit(0); });
process.on('SIGINT', () => process.emit('SIGTERM'));
