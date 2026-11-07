'use strict';
// Logica di gioco pura (nessun I/O). Il server è l'unica autorità.
const { CONTINENTS, IDS, ADJ } = require('./map');

const OBJ = require('./objectives');
const START = { 2: 40, 3: 35, 4: 30 };
const MAX_PLAYERS = 4;
// Tris originali: cannoni (2) 4, fanti (0) 6, cavalli (1) 8, uno per tipo 10, jolly + 2 uguali 12.
const SAME_BONUS = { 0: 6, 1: 8, 2: 4 };
const DIFF_BONUS = 10, JOKER_BONUS = 12;

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const roll = (n) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
const log = (g, t) => { g.log.push(t); if (g.log.length > 200) g.log.splice(0, g.log.length - 200); };
const pl = (g, id) => g.players.find((p) => p.id === id);
const cur = (g) => g.players[g.turn];
const owned = (g, id) => IDS.filter((t) => g.terr[t].owner === id);

function createGame(id, name, host) {
  return { id, name, hostId: host.id, status: 'lobby', players: [{ id: host.id, name: host.name }], createdAt: Date.now(), log: [] };
}

function addPlayer(g, p) {
  if (g.status !== 'lobby') return 'La partita è già iniziata';
  if (g.players.length >= MAX_PLAYERS) return 'Partita al completo (max 4)';
  if (!pl(g, p.id)) g.players.push({ id: p.id, name: p.name });
  return null;
}

function start(g) {
  if (g.status !== 'lobby') return 'Partita già avviata';
  if (g.players.length < 2) return 'Servono almeno 2 giocatori';
  shuffle(g.players);
  const cols = OBJ.shuffle(OBJ.COLOR_DEFS.slice());
  g.players.forEach((p, i) => { p.colorKey = cols[i].key; p.colorName = cols[i].name; p.color = cols[i].hex; p.alive = true; p.cards = []; p.pool = 0; });
  g.terr = {};
  IDS.forEach((t) => (g.terr[t] = { owner: null, armies: 1 }));
  shuffle(IDS.slice()).forEach((t, i) => (g.terr[t].owner = g.players[i % g.players.length].id));
  g.players.forEach((p) => (p.pool = START[g.players.length] - owned(g, p.id).length));
  OBJ.deal(g);
  g.deck = shuffle([...IDS.map((t, i) => ({ t, k: i % 3 })), { t: null, k: 3 }, { t: null, k: 3 }]);
  g.discard = [];
  Object.assign(g, { winReason: null, status: 'playing', phase: 'setup', turn: 0, setupPlaced: 0, conquered: false, pending: null, lastBattle: null, winner: null, log: [] });
  log(g, 'La partita inizia! Ordine di gioco: ' + g.players.map((p) => p.name).join(', '));
  log(g, `Fase di piazzamento: ${cur(g).name} piazza fino a 3 armate per turno.`);
  return null;
}

const continentBonus = (g, id) => CONTINENTS.reduce((b, c) => b + (c.terrs.every((t) => g.terr[t].owner === id) ? c.bonus : 0), 0);
const calcReinforce = (g, id) => Math.max(3, Math.floor(owned(g, id).length / 3)) + continentBonus(g, id);

function tradeValue(cs) {
  if (cs.length !== 3) return 0;
  const jokers = cs.filter((c) => c.k === 3).length;
  const ks = cs.filter((c) => c.k !== 3).map((c) => c.k);
  if (jokers > 1) return 0;
  if (jokers === 1) return ks[0] === ks[1] ? JOKER_BONUS : 0; // il jolly vale solo con due carte uguali
  if (ks.every((k) => k === ks[0])) return SAME_BONUS[ks[0]];
  return new Set(ks).size === 3 ? DIFF_BONUS : 0;
}

function connected(g, from, to, pid) {
  const seen = new Set([from]); const q = [from];
  while (q.length) {
    const x = q.shift();
    if (x === to) return true;
    for (const n of ADJ[x]) if (!seen.has(n) && g.terr[n].owner === pid) { seen.add(n); q.push(n); }
  }
  return false;
}

function win(g, p, reason) {
  g.status = 'finished'; g.phase = 'finished'; g.winner = p.id; g.pending = null; g.winReason = reason;
  log(g, `🏆 ${p.name} ${reason} e vince la partita!`);
}
function checkWin(g) {
  const alive = g.players.filter((p) => p.alive);
  if (alive.length === 1 && g.status === 'playing') { win(g, alive[0], 'è l\'ultimo giocatore rimasto'); return true; }
  return false;
}

function beginReinforce(g) {
  const p = cur(g);
  p.pool = calcReinforce(g, p.id);
  g.phase = 'reinforce'; g.conquered = false; g.pending = null;
  log(g, `Turno di ${p.name}: ${p.pool} armate di rinforzo.`);
}

function advanceTurn(g, giveCard) {
  const p = cur(g);
  if (giveCard && g.conquered && p.alive) {
    if (!g.deck.length) { g.deck = shuffle(g.discard); g.discard = []; }
    const c = g.deck.pop();
    if (c) { p.cards.push(c); log(g, `${p.name} pesca una carta.`); }
  }
  do { g.turn = (g.turn + 1) % g.players.length; } while (!cur(g).alive);
  beginReinforce(g);
}

function advanceSetup(g) {
  g.setupPlaced = 0;
  const n = g.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (g.turn + i) % n;
    if (g.players[idx].alive && g.players[idx].pool > 0) { g.turn = idx; return; }
  }
  g.turn = g.players.findIndex((p) => p.alive);
  log(g, 'Piazzamento terminato. Si inizia a giocare!');
  beginReinforce(g);
}

function attackOnce(g, from, to, dice) {
  const F = g.terr[from], T = g.terr[to], me = cur(g);
  const defDice = Math.min(3, T.armies);
  const a = roll(dice), d = roll(defDice);
  let al = 0, dl = 0;
  for (let i = 0; i < Math.min(a.length, d.length); i++) (a[i] > d[i] ? dl++ : al++);
  F.armies -= al; T.armies -= dl;
  return { a, d, al, dl };
}

function conquer(g, from, to, dice) {
  const F = g.terr[from], T = g.terr[to], me = cur(g);
  const prev = T.owner ? pl(g, T.owner) : null;
  T.owner = me.id; g.conquered = true;
  log(g, `${me.name} conquista ${nm(to)}${prev ? ' a ' + prev.name : ''}.`);
  if (prev && !owned(g, prev.id).length) {
    prev.alive = false;
    me.cards.push(...prev.cards);
    log(g, `💀 ${prev.name} è eliminato! ${me.name} prende le sue ${prev.cards.length} carte.`);
    prev.cards = []; prev.pool = 0;
    if (me.obj.type === 'destroy' && me.obj.target === prev.id) win(g, me, `ha distrutto l'armata ${OBJ.adjOf(prev.colorKey)}, il suo obiettivo`);
    else OBJ.retarget(g, prev.id);
  }
  if (g.status === 'finished' || checkWin(g)) { const mv = F.armies - 1; F.armies -= mv; T.armies += mv; return; }
  const min = Math.min(dice, F.armies - 1), max = F.armies - 1;
  F.armies -= min; T.armies += min; // spostamento obbligatorio immediato
  if (min >= max) { g.pending = null; g.phase = 'attack'; }
  else { g.pending = { from, to, min, max }; g.phase = 'conquer'; }
}

const { TERRITORIES } = require('./map');
const NAMES = Object.fromEntries(TERRITORIES.map((t) => [t.id, t.name]));
function nm(id) { return NAMES[id]; }

function doAttack(g, m, blitz) {
  const me = cur(g);
  const { from, to } = m;
  if (!g.terr[from] || !g.terr[to]) return 'Territorio non valido';
  const F = g.terr[from], T = g.terr[to];
  if (F.owner !== me.id) return 'Il territorio di partenza non è tuo';
  if (T.owner === me.id) return 'Non puoi attaccare un tuo territorio';
  if (!ADJ[from].includes(to)) return 'I territori non sono confinanti';
  if (F.armies < 2) return 'Servono almeno 2 armate per attaccare';
  let dice = blitz ? Math.min(3, F.armies - 1) : m.dice;
  if (!Number.isInteger(dice) || dice < 1 || dice > 3 || dice > F.armies - 1) return 'Numero di dadi non valido';
  const defName = T.owner ? pl(g, T.owner).name : 'neutrale';
  let tAl = 0, tDl = 0, rounds = 0, last;
  do {
    dice = Math.min(3, F.armies - 1);
    if (!blitz) dice = m.dice;
    last = attackOnce(g, from, to, dice);
    tAl += last.al; tDl += last.dl; rounds++;
    if (T.armies <= 0) break;
  } while (blitz && F.armies > 1);
  g.lastBattle = { from, to, att: last.a, def: last.d, al: tAl, dl: tDl, rounds, by: me.name, vs: defName };
  log(g, `${me.name} attacca ${nm(to)} da ${nm(from)}${blitz ? ' (blitz)' : ''}: perde ${tAl}, ${defName} perde ${tDl}.`);
  if (T.armies <= 0) conquer(g, from, to, dice);
  return null;
}

// Eliminazione/abbandono di un giocatore: i suoi territori restano neutrali.
function eliminate(g, pid, why) {
  const p = pl(g, pid);
  if (!p) return;
  if (g.status === 'lobby') {
    g.players = g.players.filter((x) => x.id !== pid);
    if (g.hostId === pid && g.players.length) g.hostId = g.players[0].id;
    return;
  }
  if (g.status !== 'playing' || !p.alive) return;
  const wasTurn = cur(g).id === pid;
  p.alive = false; p.pool = 0;
  g.discard.push(...p.cards); p.cards = [];
  IDS.forEach((t) => { if (g.terr[t].owner === pid) g.terr[t].owner = null; });
  log(g, `${p.name} ${why || 'ha lasciato la partita'}; i suoi territori diventano neutrali.`);
  OBJ.retarget(g, pid);
  if (checkWin(g)) return;
  if (wasTurn) {
    g.pending = null; g.conquered = false;
    if (g.phase === 'setup') advanceSetup(g); else advanceTurn(g, false);
  } else if (g.phase === 'setup' && g.players.every((x) => !x.alive || x.pool === 0)) advanceSetup(g);
}

const int = (v) => (Number.isInteger(v) ? v : NaN);

function act(g, pid, m) {
  const e = actInner(g, pid, m);
  if (!e && g.status === 'playing') {
    const p = pl(g, pid);
    if (p && p.alive && p.obj && OBJ.check(g, pid, p.obj)) win(g, p, 'ha raggiunto il proprio obiettivo');
  }
  return e;
}

function actInner(g, pid, m) {
  if (g.status !== 'playing') return 'La partita non è in corso';
  const me = cur(g);
  if (me.id !== pid) return 'Non è il tuo turno';
  switch (m.a) {
    case 'place': {
      if (g.phase !== 'setup' && g.phase !== 'reinforce') return 'Non puoi piazzare armate ora';
      const t = g.terr[m.t];
      if (!t || t.owner !== pid) return 'Scegli un tuo territorio';
      let n = int(m.n);
      if (!(n >= 1)) return 'Quantità non valida';
      if (n > me.pool) return 'Non hai abbastanza armate';
      if (g.phase === 'setup' && n > 3 - g.setupPlaced) return 'In questa fase al massimo 3 armate per turno';
      t.armies += n; me.pool -= n;
      if (g.phase === 'setup') {
        g.setupPlaced += n;
        if (g.setupPlaced >= 3 || me.pool === 0) advanceSetup(g);
      }
      return null;
    }
    case 'trade': {
      if (g.phase !== 'reinforce') return 'Le carte si giocano a inizio turno';
      const idx = Array.isArray(m.idx) ? m.idx.map(int) : [];
      if (idx.length !== 3 || new Set(idx).size !== 3 || idx.some((i) => !(i >= 0 && i < me.cards.length))) return 'Seleziona 3 carte';
      const cs = idx.map((i) => me.cards[i]);
      const v = tradeValue(cs);
      if (!v) return 'Combinazione non valida';
      me.cards = me.cards.filter((_, i) => !idx.includes(i));
      g.discard.push(...cs); me.pool += v;
      log(g, `${me.name} gioca un tris: +${v} armate.`);
      return null;
    }
    case 'endReinforce':
      if (g.phase !== 'reinforce') return 'Fase errata';
      if (me.pool > 0) return `Devi ancora piazzare ${me.pool} armate`;
      if (me.cards.length >= 5) return 'Con 5 o più carte devi giocare un tris';
      g.phase = 'attack'; return null;
    case 'attack': if (g.phase !== 'attack') return 'Non puoi attaccare ora'; return doAttack(g, m, false);
    case 'blitz': if (g.phase !== 'attack') return 'Non puoi attaccare ora'; return doAttack(g, m, true);
    case 'conquer': {
      if (g.phase !== 'conquer' || !g.pending) return 'Nessuna conquista in sospeso';
      const n = int(m.n), { from, to, min, max } = g.pending;
      if (!(n >= min && n <= max)) return `Sposta tra ${min} e ${max} armate`;
      g.terr[from].armies -= n - min; g.terr[to].armies += n - min;
      g.pending = null; g.phase = 'attack'; return null;
    }
    case 'endAttack':
      if (g.phase !== 'attack') return 'Fase errata';
      g.phase = 'fortify'; return null;
    case 'fortify': {
      if (g.phase !== 'fortify') return 'Spostamento non disponibile ora';
      const F = g.terr[m.from], T = g.terr[m.to], n = int(m.n);
      if (!F || !T || F.owner !== pid || T.owner !== pid || m.from === m.to) return 'Territori non validi';
      if (!(n >= 1 && n <= F.armies - 1)) return 'Quantità non valida (ne deve restare almeno 1)';
      if (!connected(g, m.from, m.to, pid)) return 'I territori non sono collegati da una catena tua';
      F.armies -= n; T.armies += n;
      log(g, `${me.name} sposta ${n} armate da ${nm(m.from)} a ${nm(m.to)}.`);
      advanceTurn(g, true); return null;
    }
    case 'endTurn':
      if (g.phase !== 'attack' && g.phase !== 'fortify') return 'Non puoi terminare il turno ora';
      advanceTurn(g, true); return null;
    default: return 'Azione sconosciuta';
  }
}

// Vista personalizzata: le carte altrui sono nascoste.
function view(g, pid) {
  const v = {
    id: g.id, name: g.name, hostId: g.hostId, status: g.status, phase: g.phase, turn: g.turn, setupPlaced: g.setupPlaced,
    conquered: g.conquered, pending: g.pending, lastBattle: g.lastBattle, winner: g.winner, winReason: g.winReason, terr: g.terr, log: g.log.slice(-60),
    players: g.players.map((p, i) => ({
      id: p.id, name: p.name, color: p.color || OBJ.COLOR_DEFS[i].hex, colorName: p.colorName, objective: (p.id === pid || g.status === 'finished') && p.obj ? p.obj.text : undefined, alive: p.alive !== false, pool: p.pool || 0,
      cardCount: p.cards ? p.cards.length : 0, cards: p.id === pid && p.cards ? p.cards : undefined,
    })),
  };
  return v;
}

module.exports = { createGame, addPlayer, start, act, eliminate, view, tradeValue, calcReinforce, MAX_PLAYERS, pl, cur };
