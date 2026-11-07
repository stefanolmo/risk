'use strict';
// Logica di gioco pura (nessun I/O), secondo il regolamento ufficiale RisiKo! (modalità tradizionale, 3-6 giocatori).
const { CONTINENTS, IDS, ADJ, TERRITORIES } = require('./map');
const OBJ = require('./objectives');

const MIN_PLAYERS = 3, MAX_PLAYERS = 6;
const START = { 3: 35, 4: 30, 5: 25, 6: 20 }; // armate della dotazione iniziale
// Tris: 3 cannoni 4, 3 fanti 6, 3 cavalieri 8, uno per tipo 10, jolly + 2 uguali 12 (tipi: 0 fante, 1 cavaliere, 2 cannone, 3 jolly)
const SAME_BONUS = { 0: 6, 1: 8, 2: 4 }, DIFF_BONUS = 10, JOKER_BONUS = 12, OWNED_CARD_BONUS = 2;
// Simbolo di ogni carta territorio, come sulle carte originali (0 fante, 1 cavaliere, 2 cannone); 16 fanti, 16 cavalieri, 10 cannoni.
const CARD_KIND = {};
'afg ukr gbr ala ido bra eaf sib ura sca seu weu alb nwt arg naf'.split(' ').forEach((t) => (CARD_KIND[t] = 0));
'mon sia isl neu eus wus per ven egy jap ind cam ont ngu eau mad'.split(' ').forEach((t) => (CARD_KIND[t] = 1));
'yak chi irk wau saf con mea kam gro que'.split(' ').forEach((t) => (CARD_KIND[t] = 2));
IDS.forEach((t) => { if (CARD_KIND[t] === undefined) throw new Error('simbolo mancante per ' + t); });
const NAMES = Object.fromEntries(TERRITORIES.map((t) => [t.id, t.name]));
const nm = (id) => NAMES[id];

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const die = () => 1 + Math.floor(Math.random() * 6);
const roll = (n) => Array.from({ length: n }, die).sort((a, b) => b - a);
const log = (g, t) => { g.log.push(t); if (g.log.length > 250) g.log.splice(0, g.log.length - 250); };
const pl = (g, id) => g.players.find((p) => p.id === id);
const cur = (g) => g.players[g.turn];
const owned = (g, id) => IDS.filter((t) => g.terr[t].owner === id);
const int = (v) => (Number.isInteger(v) ? v : NaN);

function createGame(id, name, host) {
  return { id, name, hostId: host.id, status: 'lobby', players: [{ id: host.id, name: host.name }], createdAt: Date.now(), log: [] };
}

function addPlayer(g, p) {
  if (g.status !== 'lobby') return 'La partita è già iniziata';
  if (g.players.length >= MAX_PLAYERS) return `Partita al completo (max ${MAX_PLAYERS})`;
  if (!pl(g, p.id)) g.players.push({ id: p.id, name: p.name });
  return null;
}

// PREPARAZIONE: lancio del dado (parità: si ripete tra i pari), poi scelta dei colori a turno dal primo.
function start(g) {
  if (g.status !== 'lobby') return 'Partita già avviata';
  if (g.players.length < MIN_PLAYERS) return `Servono almeno ${MIN_PLAYERS} giocatori`;
  g.log = [];
  let cand = g.players.map((p) => p.id);
  while (cand.length > 1) {
    const r = cand.map((id) => [id, die()]), max = Math.max(...r.map((x) => x[1]));
    log(g, 'Lancio del dado: ' + r.map(([id, v]) => `${pl(g, id).name} ${v}`).join(', '));
    cand = r.filter((x) => x[1] === max).map((x) => x[0]);
    if (cand.length > 1) log(g, 'Parità: ripetono il lancio ' + cand.map((id) => pl(g, id).name).join(', '));
  }
  const first = g.players.findIndex((p) => p.id === cand[0]);
  g.players = [...g.players.slice(first), ...g.players.slice(0, first)]; // senso orario a partire dal primo
  g.players.forEach((p) => { p.alive = true; p.cards = []; p.pool = 0; p.colorKey = p.colorName = p.color = undefined; });
  g.terr = {}; IDS.forEach((t) => (g.terr[t] = { owner: null, armies: 0 }));
  Object.assign(g, {
    status: 'playing', phase: 'colors', turn: 0, setupPlaced: 0, conquered: false, traded: false, pa: null, pending: null,
    lastBattle: null, winner: null, winReason: null, deck: [], discard: [], freeColors: OBJ.COLOR_DEFS.map((c) => c.key),
  });
  log(g, `${cur(g).name} ha il punteggio più alto: gioca per primo ed è il mazziere.`);
  log(g, `${cur(g).name} sceglie il colore dell'esercito.`);
  return null;
}

// Dopo l'ultima scelta di colore: il mazziere distribuisce obiettivi e territori e si piazzano le armate iniziali.
function finishColors(g) {
  const n = g.players.length;
  g.turn = 0;
  shuffle(IDS.slice()).forEach((t, i) => { g.terr[t] = { owner: g.players[(1 + i) % n].id, armies: 1 }; }); // si parte dal giocatore a sinistra del mazziere
  g.players.forEach((p) => (p.pool = START[n] - owned(g, p.id).length));
  OBJ.deal(g);
  g.deck = shuffle([...IDS.map((t) => ({ t, k: CARD_KIND[t] })), { t: null, k: 3 }, { t: null, k: 3 }]);
  g.phase = 'setup'; g.setupPlaced = 0;
  log(g, `${g.players[0].name} (mazziere) distribuisce gli obiettivi segreti e i territori; ogni territorio riceve un'armata.`);
  log(g, `Piazzamento: ${cur(g).name} posiziona 3 armate alla volta, poi a turno gli altri.`);
}

const continentBonus = (g, id) => CONTINENTS.reduce((b, c) => b + (c.terrs.every((t) => g.terr[t].owner === id) ? c.bonus : 0), 0);
// territori ÷ 3 per difetto (nessun minimo), più i bonus dei continenti interi
const calcReinforce = (g, id) => Math.floor(owned(g, id).length / 3) + continentBonus(g, id);

function tradeValue(cs) {
  if (cs.length !== 3) return 0;
  const jokers = cs.filter((c) => c.k === 3).length;
  const ks = cs.filter((c) => c.k !== 3).map((c) => c.k);
  if (jokers > 1) return 0;
  if (jokers === 1) return ks[0] === ks[1] ? JOKER_BONUS : 0; // il jolly vale solo con due carte uguali
  if (ks.every((k) => k === ks[0])) return SAME_BONUS[ks[0]];
  return new Set(ks).size === 3 ? DIFF_BONUS : 0;
}

function win(g, p, reason) {
  g.status = 'finished'; g.phase = 'finished'; g.winner = p.id; g.pending = null; g.pa = null; g.winReason = reason;
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
  g.phase = 'reinforce'; g.conquered = false; g.traded = false; g.pending = null; g.pa = null;
  log(g, `Turno di ${p.name}: ${p.pool} armate di rinforzo.`);
}

function draw(g, p) {
  if (!g.deck.length) return;
  p.cards.push(g.deck.pop());
  log(g, `${p.name} pesca una carta.`);
  if (!g.deck.length && g.discard.length) { g.deck = shuffle(g.discard); g.discard = []; } // chi pesca l'ultima carta rimescola gli scarti
}

function advanceTurn(g, giveCard) {
  const p = cur(g);
  if (giveCard && g.conquered && p.alive) draw(g, p); // una sola carta, se si è conquistato almeno un territorio
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
  log(g, 'Piazzamento terminato: inizia il gioco!');
  beginReinforce(g);
}

// COMBATTIMENTO: l'attaccante dichiara territori e dadi; il difensore dichiara i suoi dadi (1-3); poi si lanciano.
function maxDefDice(g) { return g.pa ? Math.min(3, g.terr[g.pa.to].armies) : 0; }

function declareAttack(g, m) {
  const me = cur(g), { from, to } = m;
  if (!g.terr[from] || !g.terr[to]) return 'Territorio non valido';
  const F = g.terr[from], T = g.terr[to];
  if (F.owner !== me.id) return 'Il territorio di partenza non è tuo';
  if (T.owner === me.id) return 'Non puoi attaccare un tuo territorio';
  if (!ADJ[from].includes(to)) return 'I territori non sono confinanti (né via terra né via mare)';
  if (F.armies < 2) return 'Non puoi attaccare da un territorio presidiato da una sola armata';
  const dice = int(m.dice);
  if (!(dice >= 1 && dice <= 3 && dice <= F.armies - 1)) return 'Numero di dadi non valido (almeno un\'armata deve restare a presidio)';
  g.pa = { from, to, dice, defender: T.owner };
  log(g, `${me.name} attacca ${nm(to)} da ${nm(from)} con ${dice} ${dice === 1 ? 'dado' : 'dadi'}.`);
  if (!T.owner) return resolveAttack(g, Math.min(3, T.armies)); // territorio neutrale: nessuno decide
  g.phase = 'defend';
  return null;
}

function doDefend(g, pid, m) {
  if (g.phase !== 'defend' || !g.pa) return 'Nessun attacco da cui difendersi';
  if (g.pa.defender !== pid) return 'Non sei tu il difensore';
  const d = int(m.dice);
  if (!(d >= 1 && d <= maxDefDice(g))) return `Scegli da 1 a ${maxDefDice(g)} dadi`;
  return resolveAttack(g, d);
}

function resolveAttack(g, ddice) {
  const { from, to, dice } = g.pa, F = g.terr[from], T = g.terr[to], me = cur(g);
  const a = roll(dice), d = roll(ddice);
  let al = 0, dl = 0;
  for (let i = 0; i < Math.min(a.length, d.length); i++) (a[i] > d[i] ? dl++ : al++); // a parità vince sempre il difensore
  F.armies -= al; T.armies -= dl;
  const vs = T.owner ? pl(g, T.owner).name : 'neutrale';
  g.lastBattle = { from, to, att: a, def: d, al, dl, by: me.name, vs };
  log(g, `${nm(from)} → ${nm(to)}: attaccante [${a}] contro difensore [${d}]. Perde ${al} l'attaccante, ${dl} ${vs}.`);
  g.pa = null; g.phase = 'attack';
  if (T.armies <= 0) conquer(g, from, to, dice);
  return null;
}

function conquer(g, from, to, dice) {
  const F = g.terr[from], T = g.terr[to], me = cur(g);
  const prev = T.owner ? pl(g, T.owner) : null;
  T.owner = me.id; g.conquered = true;
  log(g, `${me.name} conquista ${nm(to)}${prev ? ' a ' + prev.name : ''}.`);
  if (prev && !owned(g, prev.id).length) { // eliminazione: si prendono anche le carte
    prev.alive = false;
    me.cards.push(...prev.cards);
    log(g, `💀 ${prev.name} è eliminato! ${me.name} prende le sue ${prev.cards.length} carte.`);
    prev.cards = []; prev.pool = 0;
    if (me.obj.type === 'destroy' && me.obj.target === prev.id) win(g, me, `ha distrutto l'armata ${OBJ.adjOf(prev.colorKey)}, il suo obiettivo`);
    else OBJ.retarget(g, prev.id);
  }
  // si occupa con le armate dell'ultimo lancio (almeno tanti quanti i dadi); si possono spostare anche di più
  const max = F.armies - 1, min = Math.min(dice, max);
  F.armies -= min; T.armies += min;
  if (g.status === 'finished' || checkWin(g)) { const mv = F.armies - 1; F.armies -= mv; T.armies += mv; return; }
  if (min >= max) { g.pending = null; g.phase = 'attack'; } else { g.pending = { from, to, min, max }; g.phase = 'conquer'; }
}

// Un giocatore lascia la partita: i suoi territori restano neutrali.
function eliminate(g, pid, why) {
  const p = pl(g, pid);
  if (!p) return;
  if (g.status === 'lobby') {
    g.players = g.players.filter((x) => x.id !== pid);
    if (g.hostId === pid && g.players.length) g.hostId = g.players[0].id;
    return;
  }
  if (g.status !== 'playing' || !p.alive) return;
  if (g.phase === 'colors') { // la scelta dei colori non è finita: si torna alla sala d'attesa
    g.players = g.players.filter((x) => x.id !== pid);
    if (g.hostId === pid && g.players.length) g.hostId = g.players[0].id;
    g.status = 'lobby'; g.phase = undefined; g.log = [];
    return;
  }
  const wasTurn = cur(g).id === pid;
  if (g.phase === 'defend') { g.pa = null; g.phase = 'attack'; }
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

function actInner(g, pid, m) {
  if (g.status !== 'playing') return 'La partita non è in corso';
  if (m.a === 'defend') return doDefend(g, pid, m);
  if (g.phase === 'defend') return 'Si attende la scelta dei dadi del difensore';
  const me = cur(g);
  if (me.id !== pid) return 'Non è il tuo turno';
  switch (m.a) {
    case 'color': {
      if (g.phase !== 'colors') return 'I colori sono già stati scelti';
      if (!g.freeColors.includes(m.key)) return 'Colore non disponibile';
      const c = OBJ.COLOR_DEFS.find((x) => x.key === m.key);
      Object.assign(me, { colorKey: c.key, colorName: c.name, color: c.hex });
      g.freeColors = g.freeColors.filter((k) => k !== m.key);
      log(g, `${me.name} sceglie il ${c.name.toLowerCase()}.`);
      g.turn++;
      if (g.turn >= g.players.length) finishColors(g); else log(g, `${cur(g).name} sceglie il colore dell'esercito.`);
      return null;
    }
    case 'place': {
      if (g.phase !== 'setup' && g.phase !== 'reinforce') return 'Non puoi piazzare armate ora';
      const t = g.terr[m.t], n = int(m.n);
      if (!t || t.owner !== pid) return 'Scegli un tuo territorio';
      if (!(n >= 1)) return 'Quantità non valida';
      if (n > me.pool) return 'Non hai abbastanza armate';
      if (g.phase === 'setup' && n > 3 - g.setupPlaced) return 'In questa fase si piazzano 3 armate alla volta';
      t.armies += n; me.pool -= n;
      if (g.phase === 'setup') { g.setupPlaced += n; if (g.setupPlaced >= 3 || me.pool === 0) advanceSetup(g); }
      return null;
    }
    case 'trade': {
      if (g.phase !== 'reinforce') return 'Il tris si gioca nella fase di rinforzo';
      if (g.traded) return 'Puoi giocare un solo tris per turno';
      const idx = Array.isArray(m.idx) ? m.idx.map(int) : [];
      if (idx.length !== 3 || new Set(idx).size !== 3 || idx.some((i) => !(i >= 0 && i < me.cards.length))) return 'Seleziona 3 carte';
      const cs = idx.map((i) => me.cards[i]), v = tradeValue(cs);
      if (!v) return 'Combinazione non valida';
      const extra = cs.filter((c) => c.t && g.terr[c.t].owner === pid).length * OWNED_CARD_BONUS; // +2 per carta di un tuo territorio
      me.cards = me.cards.filter((_, i) => !idx.includes(i));
      g.discard.push(...cs); me.pool += v + extra; g.traded = true;
      log(g, `${me.name} gioca un tris: +${v} armate${extra ? `, più ${extra} per i territori posseduti` : ''}.`);
      return null;
    }
    case 'endReinforce':
      if (g.phase !== 'reinforce') return 'Fase errata';
      if (me.pool > 0) return `Devi collocare ancora ${me.pool} armate prima di combattere`;
      g.phase = 'attack'; return null;
    case 'attack':
      if (g.phase !== 'attack') return 'Non puoi attaccare ora';
      return declareAttack(g, m);
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
    case 'fortify': { // spostamento strategico: uno solo, verso un territorio contiguo, lasciando almeno un'armata
      if (g.phase !== 'fortify') return 'Lo spostamento strategico si fa dopo i combattimenti';
      const F = g.terr[m.from], T = g.terr[m.to], n = int(m.n);
      if (!F || !T || F.owner !== pid || T.owner !== pid || m.from === m.to) return 'Territori non validi';
      if (!ADJ[m.from].includes(m.to)) return 'I territori devono essere contigui';
      if (!(n >= 1 && n <= F.armies - 1)) return 'Quantità non valida (deve restare almeno 1 armata)';
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

// L'obiettivo si controlla subito (per chi ha agito e per chi è di turno): raggiungerlo chiude la partita.
function act(g, pid, m) {
  const e = actInner(g, pid, m);
  if (!e && g.status === 'playing') {
    for (const p of [pl(g, pid), cur(g)]) {
      if (g.status === 'playing' && p && p.alive && p.obj && OBJ.check(g, p.id, p.obj)) win(g, p, 'ha raggiunto il proprio obiettivo');
    }
  }
  return e;
}

// Vista personalizzata: le carte e l'obiettivo altrui sono nascosti (a fine partita gli obiettivi sono rivelati).
function view(g, pid) {
  return {
    id: g.id, name: g.name, hostId: g.hostId, status: g.status, phase: g.phase, turn: g.turn, setupPlaced: g.setupPlaced,
    conquered: g.conquered, traded: g.traded, pending: g.pending, pa: g.pa, lastBattle: g.lastBattle, winner: g.winner, winReason: g.winReason,
    freeColors: g.freeColors, min: MIN_PLAYERS, max: MAX_PLAYERS, terr: g.terr, log: (g.log || []).slice(-60),
    colors: OBJ.COLOR_DEFS.map((c) => ({ key: c.key, name: c.name, hex: c.hex })),
    players: g.players.map((p) => ({
      id: p.id, name: p.name, color: p.color, colorName: p.colorName, alive: p.alive !== false, pool: p.pool || 0,
      cardCount: p.cards ? p.cards.length : 0, cards: p.id === pid && p.cards ? p.cards : undefined,
      objective: (p.id === pid || g.status === 'finished') && p.obj ? { card: p.card, text: p.obj.text, changed: p.obj.id !== p.card } : undefined,
    })),
  };
}

module.exports = { CARD_KIND, createGame, addPlayer, start, act, eliminate, view, tradeValue, calcReinforce, maxDefDice, MIN_PLAYERS, MAX_PLAYERS, START, pl, cur };
