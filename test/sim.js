'use strict';
// Simula partite complete con bot e verifica una per una le regole del regolamento RisiKo! (3-6 giocatori).
const assert = require('assert');
const G = require('../server/game');
const OBJ = require('../server/objectives');
const { IDS, ADJ, CONTINENTS } = require('../server/map');
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

function begin(n) {
  const g = G.createGame('x', 't', { id: 'p0', name: 'P0' });
  for (let i = 1; i < n; i++) G.addPlayer(g, { id: 'p' + i, name: 'P' + i });
  assert.strictEqual(G.start(g), null);
  while (g.phase === 'colors') assert.strictEqual(G.act(g, G.cur(g).id, { a: 'color', key: g.freeColors[0] }), null);
  return g;
}

function play(n) {
  const g = begin(n);
  let steps = 0;
  const total = () => IDS.reduce((s, t) => s + g.terr[t].armies, 0) + g.players.reduce((s, p) => s + p.pool, 0);
  const t0 = total();
  while (g.status === 'playing' && steps++ < 400000) {
    let e;
    if (g.phase === 'defend') { e = G.act(g, g.pa.defender, { a: 'defend', dice: G.maxDefDice(g) }); assert.strictEqual(e, null, 'defend: ' + e); continue; }
    const me = G.cur(g), mine = IDS.filter((t) => g.terr[t].owner === me.id);
    switch (g.phase) {
      case 'setup': e = G.act(g, me.id, { a: 'place', t: rnd(mine), n: 1 }); break;
      case 'reinforce': {
        if (!g.traded) for (let i = 0; i < me.cards.length; i++) for (let j = i + 1; j < me.cards.length; j++) for (let k = j + 1; k < me.cards.length; k++)
          if (!g.traded && G.tradeValue([me.cards[i], me.cards[j], me.cards[k]])) G.act(g, me.id, { a: 'trade', idx: [i, j, k] });
        if (me.pool > 0) {
          const border = mine.filter((t) => ADJ[t].some((x) => g.terr[x].owner !== me.id));
          e = G.act(g, me.id, { a: 'place', t: (border.length ? border : mine).sort((a, b) => g.terr[b].armies - g.terr[a].armies)[0], n: me.pool });
        } else e = G.act(g, me.id, { a: 'endReinforce' });
        break;
      }
      case 'attack': {
        const opts = [];
        mine.forEach((t) => g.terr[t].armies > 1 && ADJ[t].forEach((x) => g.terr[x].owner !== me.id && g.terr[t].armies > g.terr[x].armies + 1 && opts.push([t, x])));
        if (!opts.length) { e = G.act(g, me.id, { a: 'endAttack' }); break; }
        const [f, t] = rnd(opts); e = G.act(g, me.id, { a: 'attack', from: f, to: t, dice: Math.min(3, g.terr[f].armies - 1) }); break;
      }
      case 'conquer': e = G.act(g, me.id, { a: 'conquer', n: g.pending.max }); break;
      case 'fortify': e = G.act(g, me.id, { a: 'endTurn' }); break;
    }
    assert.strictEqual(e, null, `errore ${g.phase}: ${e}`);
    for (const t of IDS) assert(g.terr[t].armies >= 1, 'armate < 1 in ' + t);
  }
  assert.strictEqual(g.status, 'finished', 'partita non terminata (' + n + ' giocatori)');
  assert(g.players.find((p) => p.id === g.winner) && g.winReason);
  return g.winReason;
}

const reasons = {};
for (const n of [3, 4, 5, 6]) for (let i = 0; i < 15; i++) { const r = play(n).replace(/armata \w+/, 'armata X'); reasons[r] = (reasons[r] || 0) + 1; }
console.log('OK: 60 partite simulate (3-6 giocatori). Motivi di vittoria:', reasons);

// ---------------- giocatori e dotazione ----------------
{
  const g = G.createGame('a', 'a', { id: 'p0', name: 'P0' }); G.addPlayer(g, { id: 'p1', name: 'P1' });
  assert(G.start(g), 'con 2 giocatori non si può iniziare');
  for (let i = 2; i < 6; i++) assert.strictEqual(G.addPlayer(g, { id: 'p' + i, name: 'P' + i }), null);
  assert(G.addPlayer(g, { id: 'p6', name: 'P6' }), 'il 7° giocatore è rifiutato');
  assert.strictEqual(G.MIN_PLAYERS, 3); assert.strictEqual(G.MAX_PLAYERS, 6);
}
{
  const expTot = { 3: 35, 4: 30, 5: 25, 6: 20 }, expTerr = { 3: [14, 14, 14], 4: [10, 11, 11, 10], 5: [8, 9, 9, 8, 8], 6: [7, 7, 7, 7, 7, 7] };
  for (const n of [3, 4, 5, 6]) {
    const g = begin(n);
    // il mazziere (primo) distribuisce partendo dal giocatore alla sua sinistra: i primi della fila ricevono i territori in più
    const cnt = g.players.map((p) => IDS.filter((t) => g.terr[t].owner === p.id).length);
    assert.deepStrictEqual(cnt, expTerr[n], `ripartizione territori con ${n}`);
    g.players.forEach((p, i) => assert.strictEqual(p.pool + cnt[i], expTot[n], 'dotazione iniziale ' + n));
    assert(g.players.every((p) => p.obj), 'ogni giocatore ha un obiettivo'); assert.strictEqual(g.deck.length, 44, 'mazzo di 42 territori + 2 jolly');
  }
}
{ // scelta dei colori: a turno, ognuno diverso, solo dal proprio turno
  const g = G.createGame('c', 'c', { id: 'p0', name: 'P0' }); ['p1', 'p2'].forEach((i) => G.addPlayer(g, { id: i, name: i })); G.start(g);
  const second = g.players[1].id;
  assert(G.act(g, second, { a: 'color', key: 'rosso' }), 'non è il suo turno di scelta');
  assert.strictEqual(G.act(g, G.cur(g).id, { a: 'color', key: 'blu' }), null);
  assert(G.act(g, G.cur(g).id, { a: 'color', key: 'blu' }), 'colore già preso');
  assert.strictEqual(g.freeColors.length, 5);
}
{ // piazzamento iniziale: 3 armate alla volta, a rotazione, ultimo giro con meno
  const g = begin(3), first = G.cur(g);
  const mine = IDS.filter((t) => g.terr[t].owner === first.id);
  assert(G.act(g, first.id, { a: 'place', t: mine[0], n: 4 }), 'max 3 alla volta');
  assert.strictEqual(G.act(g, first.id, { a: 'place', t: mine[0], n: 2 }), null); assert.strictEqual(G.cur(g).id, first.id);
  assert.strictEqual(G.act(g, first.id, { a: 'place', t: mine[1], n: 1 }), null); assert.notStrictEqual(G.cur(g).id, first.id, 'passa al giocatore successivo');
}

// ---------------- rinforzi ----------------
{
  const g = begin(3), me = G.cur(g);
  IDS.forEach((t) => { g.terr[t].owner = g.players[1].id; g.terr[t].armies = 3; });
  ['ala', 'nwt'].forEach((t) => (g.terr[t].owner = me.id));
  assert.strictEqual(G.calcReinforce(g, me.id), 0, '2 territori = 0 armate (nessun minimo di 3)');
  IDS.slice(0, 14).forEach((t) => (g.terr[t].owner = me.id));
  const own = IDS.filter((t) => g.terr[t].owner === me.id).length;
  assert.strictEqual(G.calcReinforce(g, me.id), Math.floor(own / 3) + CONTINENTS.reduce((b, c) => b + (c.terrs.every((t) => g.terr[t].owner === me.id) ? c.bonus : 0), 0));
  IDS.forEach((t) => (g.terr[t].owner = g.players[1].id));
  CONTINENTS.find((c) => c.id === 'oc').terrs.forEach((t) => (g.terr[t].owner = me.id));
  assert.strictEqual(G.calcReinforce(g, me.id), 1 + 2, '4 territori (1) + Oceania (2)');
  CONTINENTS.find((c) => c.id === 'as').terrs.forEach((t) => (g.terr[t].owner = me.id));
  assert.strictEqual(G.calcReinforce(g, me.id), Math.floor(16 / 3) + 2 + 7, 'Oceania 2 + Asia 7');
}
{ // valori dei bonus continente da regolamento
  const b = Object.fromEntries(CONTINENTS.map((c) => [c.id, c.bonus]));
  assert.deepStrictEqual(b, { oc: 2, eu: 5, sa: 2, na: 5, af: 3, as: 7 });
}

// ---------------- tris ----------------
assert.strictEqual(G.tradeValue([{ k: 2 }, { k: 2 }, { k: 2 }]), 4, '3 cannoni');
assert.strictEqual(G.tradeValue([{ k: 0 }, { k: 0 }, { k: 0 }]), 6, '3 fanti');
assert.strictEqual(G.tradeValue([{ k: 1 }, { k: 1 }, { k: 1 }]), 8, '3 cavalieri');
assert.strictEqual(G.tradeValue([{ k: 0 }, { k: 1 }, { k: 2 }]), 10, 'uno per tipo');
assert.strictEqual(G.tradeValue([{ k: 3 }, { k: 0 }, { k: 0 }]), 12, 'jolly + 2 uguali');
assert.strictEqual(G.tradeValue([{ k: 3 }, { k: 0 }, { k: 1 }]), 0); assert.strictEqual(G.tradeValue([{ k: 3 }, { k: 3 }, { k: 0 }]), 0); assert.strictEqual(G.tradeValue([{ k: 0 }, { k: 0 }, { k: 1 }]), 0);
{
  const g = begin(3), me = G.cur(g);
  g.phase = 'reinforce'; me.pool = 0; g.traded = false;
  IDS.forEach((t) => (g.terr[t].owner = g.players[1].id));
  g.terr.ala.owner = me.id; g.terr.nwt.owner = me.id;
  me.cards = [{ t: 'ala', k: 2 }, { t: 'nwt', k: 2 }, { t: 'gro', k: 2 }, { t: 'alb', k: 0 }, { t: 'ont', k: 0 }, { t: 'que', k: 0 }, { t: null, k: 3 }];
  assert.strictEqual(G.act(g, me.id, { a: 'trade', idx: [0, 1, 2] }), null);
  assert.strictEqual(me.pool, 4 + 2 * 2, '3 cannoni (4) + 2 armate per ciascuna delle 2 carte di territori posseduti');
  assert(G.act(g, me.id, { a: 'trade', idx: [0, 1, 2] }), 'un solo tris per turno');
  me.pool = 0; me.cards.push({ t: 'isl', k: 0 }, { t: 'sca', k: 1 });
  assert.strictEqual(G.act(g, me.id, { a: 'endReinforce' }), null, 'con molte carte il tris non è obbligatorio (modalità tradizionale)'); assert(me.cards.length >= 5);
}

// ---------------- combattimento ----------------
{
  const g = begin(3), a = G.cur(g), b = g.players[1];
  IDS.forEach((t) => { g.terr[t].owner = g.players[2].id; g.terr[t].armies = 1; });
  g.terr.alb.owner = a.id; g.terr.alb.armies = 10; g.terr.ala.owner = b.id; g.terr.ala.armies = 5; g.terr.nwt.owner = a.id; g.terr.nwt.armies = 1;
  g.phase = 'attack'; a.pool = 0;
  assert(G.act(g, a.id, { a: 'attack', from: 'nwt', to: 'ala', dice: 1 }), 'non si attacca da un territorio con una sola armata');
  assert(G.act(g, a.id, { a: 'attack', from: 'alb', to: 'gro', dice: 1 }), 'solo contro territori confinanti');
  assert(G.act(g, a.id, { a: 'attack', from: 'alb', to: 'ala', dice: 4 }), 'massimo 3 dadi');
  assert.strictEqual(G.act(g, a.id, { a: 'attack', from: 'alb', to: 'ala', dice: 3 }), null);
  assert.strictEqual(g.phase, 'defend', 'il difensore deve dichiarare i dadi');
  assert(G.act(g, a.id, { a: 'endAttack' }), 'nessuna azione finché il difensore non sceglie');
  assert(G.act(g, a.id, { a: 'defend', dice: 1 }), 'solo il difensore sceglie');
  assert(G.act(g, b.id, { a: 'defend', dice: 4 }), 'al massimo 3 dadi');
  let calls = 0; const R = Math.random; Math.random = () => [0.99, 0.99, 0.99, 0, 0][calls++]; // attaccante 6,6,6 - difensore 1,1
  assert.strictEqual(G.act(g, b.id, { a: 'defend', dice: 2 }), null); Math.random = R;
  assert.strictEqual(g.terr.ala.armies, 3, 'il difensore perde 2 armate'); assert.strictEqual(g.terr.alb.armies, 10);
  // parità: vince il difensore
  assert.strictEqual(G.act(g, a.id, { a: 'attack', from: 'alb', to: 'ala', dice: 1 }), null);
  calls = 0; Math.random = () => 0.5; assert.strictEqual(G.act(g, b.id, { a: 'defend', dice: 1 }), null); Math.random = R;
  assert.strictEqual(g.terr.alb.armies, 9, 'a parità l\'attaccante perde un\'armata'); assert.strictEqual(g.terr.ala.armies, 3);
  // difensore con 3 armate può tirare 3 dadi: si confrontano i due/tre dadi più alti
  assert.strictEqual(G.act(g, a.id, { a: 'attack', from: 'alb', to: 'ala', dice: 3 }), null);
  const seq = [0.99, 0.99, 0.99, 0.99, 0.99, 0]; let k = 0; Math.random = () => seq[k++]; // att 6,6,6 - dif 6,6,1 (ordinati 6,6,1)
  assert.strictEqual(G.act(g, b.id, { a: 'defend', dice: 3 }), null); Math.random = R;
  assert.strictEqual(g.terr.alb.armies, 7, 'pari: perde 2 l\'attaccante'); assert.strictEqual(g.terr.ala.armies, 2, 'terzo dado: perde 1 il difensore');
  // conquista: si sposta almeno quanto i dadi dell'ultimo lancio e si possono spostare più armate
  g.terr.ala.armies = 1;
  assert.strictEqual(G.act(g, a.id, { a: 'attack', from: 'alb', to: 'ala', dice: 3 }), null);
  k = 0; const seq2 = [0.99, 0.99, 0.99, 0]; Math.random = () => seq2[k++]; assert.strictEqual(G.act(g, b.id, { a: 'defend', dice: 1 }), null); Math.random = R;
  assert.strictEqual(g.phase, 'conquer'); assert.strictEqual(g.terr.ala.owner, a.id); assert.strictEqual(g.pending.min, 3);
  assert(G.act(g, a.id, { a: 'conquer', n: 2 }), 'almeno le armate dell\'ultimo lancio');
  assert.strictEqual(G.act(g, a.id, { a: 'conquer', n: 6 }), null); assert.strictEqual(g.terr.alb.armies, 1); assert.strictEqual(g.terr.ala.armies, 6);
  assert.strictEqual(g.phase, 'attack', 'il territorio conquistato può servire da base per altri attacchi');
  // via mare: Alaska-Kamchatka
  g.terr.kam.owner = g.players[2].id; g.terr.kam.armies = 1;
  assert.strictEqual(G.act(g, a.id, { a: 'attack', from: 'ala', to: 'kam', dice: 1 }), null, 'Alaska può attaccare la Kamchatka');
}

// ---------------- spostamento strategico e carta di fine turno ----------------
{
  const g = begin(3), a = G.cur(g);
  IDS.forEach((t) => { g.terr[t].owner = g.players[1].id; g.terr[t].armies = 1; });
  ['ala', 'nwt', 'alb', 'ont'].forEach((t) => { g.terr[t].owner = a.id; g.terr[t].armies = 1; }); g.terr.ala.armies = 6;
  g.phase = 'fortify';
  assert(G.act(g, a.id, { a: 'fortify', from: 'ala', to: 'ont', n: 2 }), 'solo verso un territorio contiguo, non lungo una catena');
  assert(G.act(g, a.id, { a: 'fortify', from: 'ala', to: 'nwt', n: 6 }), 'deve restare almeno 1 armata');
  g.conquered = true; const before = a.cards.length, deck = g.deck.length;
  assert.strictEqual(G.act(g, a.id, { a: 'fortify', from: 'ala', to: 'nwt', n: 5 }), null);
  assert.strictEqual(a.cards.length, before + 1, 'una sola carta a fine turno se si è conquistato'); assert.strictEqual(g.deck.length, deck - 1);
  assert.notStrictEqual(G.cur(g).id, a.id, 'dopo lo spostamento il turno è finito');
  // nessuna carta se non si è conquistato
  const b = G.cur(g); g.phase = 'attack'; g.conquered = false; const nb = b.cards.length; G.act(g, b.id, { a: 'endTurn' }); assert.strictEqual(b.cards.length, nb);
}
{ // chi pesca l'ultima carta rimescola gli scarti
  const g = begin(3), a = G.cur(g);
  g.deck = [{ t: 'ala', k: 0 }]; g.discard = [{ t: 'nwt', k: 1 }, { t: 'gro', k: 2 }];
  g.phase = 'attack'; g.conquered = true; G.act(g, a.id, { a: 'endTurn' });
  assert.strictEqual(g.deck.length, 2); assert.strictEqual(g.discard.length, 0);
}
{ // eliminazione: si prendono le carte dell'avversario
  const g = begin(3), [a, b, c] = g.players;
  IDS.forEach((t) => { g.terr[t].owner = c.id; g.terr[t].armies = 5; });
  g.terr.ala.owner = b.id; g.terr.ala.armies = 1; g.terr.nwt.owner = a.id; g.terr.nwt.armies = 3;
  a.obj = OBJ.DEFS.find((d) => d.id === 't18'); c.obj = a.obj; b.cards = [{ t: 'gro', k: 0 }, { t: 'isl', k: 1 }];
  g.turn = 0; g.phase = 'attack'; const R = Math.random; let k = 0; const seq = [0.99, 0];
  assert.strictEqual(G.act(g, a.id, { a: 'attack', from: 'nwt', to: 'ala', dice: 1 }), null);
  Math.random = () => seq[k++]; assert.strictEqual(G.act(g, b.id, { a: 'defend', dice: 1 }), null); Math.random = R;
  assert(!b.alive && a.cards.length === 2 && b.cards.length === 0, 'eliminato: carte a chi lo elimina');
}

// ---------------- obiettivi ----------------
assert.strictEqual(OBJ.DEFS.length, 12, 'le 12 carte missione del gioco originale');
assert.deepStrictEqual(OBJ.DEFS.filter((d) => d.type === 'destroy').map((d) => d.color).sort(), ['arancione', 'blu', 'giallo', 'indaco', 'verde']);
assert.deepStrictEqual(OBJ.DEFS.filter((d) => d.type === 'cont').map((d) => d.id).sort(), ['as-af', 'as-sa', 'eu-oc', 'na-af', 'na-oc']);
{ const k = Object.values(G.CARD_KIND).reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {}); assert.deepStrictEqual(k, { 0: 16, 1: 16, 2: 10 }, 'simboli delle carte territorio come nel PDF'); assert.strictEqual(Object.keys(G.CARD_KIND).length, 42); }
const mk = (n = 3) => begin(n);
for (let i = 0; i < 200; i++) { const g = mk(6); g.players.forEach((p) => { assert(p.obj); if (p.obj.type === 'destroy') assert(p.obj.target && p.obj.target !== p.id); }); }
for (let i = 0; i < 100; i++) { const g = mk(3); g.players.forEach((p) => p.obj.type === 'destroy' && assert(g.players.some((x) => x.id === p.obj.target), 'colore assente -> 24 territori')); }
{
  const g = mk(3), [a, b] = g.players;
  const own = (ids, pid) => ids.forEach((t) => (g.terr[t].owner = pid));
  const C = (id) => CONTINENTS.find((c) => c.id === id).terrs;
  IDS.forEach((t) => (g.terr[t].owner = b.id));
  a.obj = OBJ.DEFS.find((d) => d.id === 'eu-oc'); assert(!OBJ.check(g, a.id, a.obj));
  own(C('eu'), a.id); assert(!OBJ.check(g, a.id, a.obj), 'servono entrambi i continenti');
  own(C('oc'), a.id); assert(OBJ.check(g, a.id, a.obj));
  a.obj = OBJ.DEFS.find((d) => d.id === 'as-af'); own([...C('as'), ...C('af')], a.id); assert(OBJ.check(g, a.id, a.obj));
  IDS.forEach((t) => { g.terr[t].owner = b.id; g.terr[t].armies = 1; });
  a.obj = OBJ.DEFS.find((d) => d.id === 't18');
  IDS.slice(0, 18).forEach((t) => { g.terr[t].owner = a.id; g.terr[t].armies = 2; });
  assert(OBJ.check(g, a.id, a.obj)); g.terr[IDS[0]].armies = 1; assert(!OBJ.check(g, a.id, a.obj), 'uno con 1 sola armata');
  a.obj = OBJ.DEFS.find((d) => d.id === 't24');
  IDS.forEach((t) => { g.terr[t].owner = b.id; g.terr[t].armies = 1; });
  IDS.slice(0, 24).forEach((t) => (g.terr[t].owner = a.id));
  g.phase = 'reinforce'; g.turn = g.players.indexOf(a); a.pool = 1;
  assert.strictEqual(G.act(g, a.id, { a: 'place', t: IDS[0], n: 1 }), null);
  assert.strictEqual(g.status, 'finished'); assert.strictEqual(g.winner, a.id);
  assert(G.view(g, b.id).players.every((p) => p.objective), 'a fine partita gli obiettivi sono rivelati');
}
{ // distruggere: vince solo chi elimina; se elimina un altro, si ripiega sui 24
  const g = mk(4), [a, b, c] = g.players, R = Math.random;
  a.obj = { id: 'd-test', type: 'destroy', color: b.colorKey, target: b.id, text: '' };
  c.obj = { id: 'd-test', type: 'destroy', color: a.colorKey, target: a.id, text: '' };
  IDS.forEach((t) => { g.terr[t].owner = c.id; g.terr[t].armies = 5; });
  g.terr.ala.owner = b.id; g.terr.ala.armies = 1; g.terr.nwt.owner = a.id; g.terr.nwt.armies = 1;
  g.turn = g.players.indexOf(c); g.phase = 'attack';
  assert.strictEqual(G.act(g, c.id, { a: 'attack', from: 'alb', to: 'ala', dice: 3 }), null);
  let k = 0; const seq = [0.99, 0.99, 0.99, 0]; Math.random = () => seq[k++]; assert.strictEqual(G.act(g, b.id, { a: 'defend', dice: 1 }), null); Math.random = R;
  assert(!b.alive); assert.strictEqual(a.obj.type, 'terr', 'a ripiega sui 24 territori'); assert.strictEqual(g.status, 'playing');
}
console.log('OK: regole verificate (giocatori, dotazione, colori, piazzamento, rinforzi, tris, combattimento, spostamento, carte, obiettivi)');
