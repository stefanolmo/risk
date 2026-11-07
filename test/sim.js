'use strict';
// Simula partite complete con bot casuali e verifica gli invarianti delle regole.
const assert = require('assert');
const G = require('../server/game');
const { IDS, ADJ } = require('../server/map');

function play(n, seed) {
  const g = G.createGame('x', 't', { id: 'p0', name: 'P0' });
  for (let i = 1; i < n; i++) G.addPlayer(g, { id: 'p' + i, name: 'P' + i });
  assert.strictEqual(G.start(g), null);
  let steps = 0;
  const armiesTotal = () => IDS.reduce((s, t) => s + g.terr[t].armies, 0) + g.players.reduce((s, p) => s + p.pool, 0);
  const startTotal = armiesTotal();
  while (g.status === 'playing' && steps++ < 400000) {
    const me = G.cur(g), mine = IDS.filter((t) => g.terr[t].owner === me.id);
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    let e;
    switch (g.phase) {
      case 'setup': e = G.act(g, me.id, { a: 'place', t: rnd(mine), n: 1 }); break;
      case 'reinforce':
        if (me.cards.length >= 3) for (let i = 0; i < me.cards.length; i++) for (let j = i + 1; j < me.cards.length; j++) for (let k = j + 1; k < me.cards.length; k++)
          if (me.cards.length >= 5 && G.tradeValue([me.cards[i], me.cards[j], me.cards[k]])) { G.act(g, me.id, { a: 'trade', idx: [i, j, k] }); i = j = k = 99; }
        if (me.pool > 0) { const border = mine.filter((t) => ADJ[t].some((x) => g.terr[x].owner !== me.id)); e = G.act(g, me.id, { a: 'place', t: (border.length ? border : mine).sort((a, b) => g.terr[b].armies - g.terr[a].armies)[0], n: me.pool }); }
        else e = G.act(g, me.id, { a: 'endReinforce' });
        break;
      case 'attack': {
        const opts = [];
        mine.forEach((t) => g.terr[t].armies > 1 && ADJ[t].forEach((x) => g.terr[x].owner !== me.id && g.terr[t].armies > g.terr[x].armies + 1 && opts.push([t, x])));
        if (!opts.length || false) { e = G.act(g, me.id, { a: 'endAttack' }); break; }
        const [f, t] = rnd(opts); e = G.act(g, me.id, { a: Math.random() < .8 ? 'blitz' : 'attack', from: f, to: t, dice: Math.min(3, g.terr[f].armies - 1) }); break;
      }
      case 'conquer': e = G.act(g, me.id, { a: 'conquer', n: g.pending.max }); break;
      case 'fortify': e = G.act(g, me.id, { a: 'endTurn' }); break;
    }
    assert.strictEqual(e, null, `errore ${g.phase}: ${e}`);
    for (const t of IDS) assert(g.terr[t].armies >= 1, 'armate < 1 in ' + t);
  }
  assert.strictEqual(g.status, 'finished', 'partita non terminata');
  const w = g.players.find((p) => p.id === g.winner);
  assert(w && g.winReason, 'vincitore e motivo');
  return g.winReason;
}
const reasons = {};
for (const n of [2, 3, 4]) for (let i = 0; i < 20; i++) { const r = play(n).replace(/armata \w+/, 'armata X'); reasons[r] = (reasons[r] || 0) + 1; }
console.log('motivi di vittoria:', reasons);
// regole specifiche
assert.strictEqual(G.tradeValue([{ k: 2 }, { k: 2 }, { k: 2 }]), 4);
assert.strictEqual(G.tradeValue([{ k: 0 }, { k: 1 }, { k: 2 }]), 10);
assert.strictEqual(G.tradeValue([{ k: 0 }, { k: 0 }, { k: 0 }]), 6, 'tre fanti 6');
assert.strictEqual(G.tradeValue([{ k: 1 }, { k: 1 }, { k: 1 }]), 8, 'tre cavalli 8');
assert.strictEqual(G.tradeValue([{ k: 3 }, { k: 0 }, { k: 0 }]), 12, 'jolly + 2 uguali 12');
assert.strictEqual(G.tradeValue([{ k: 3 }, { k: 0 }, { k: 1 }]), 0, 'jolly non sostituisce');
assert.strictEqual(G.tradeValue([{ k: 3 }, { k: 3 }, { k: 0 }]), 0);
assert.strictEqual(G.tradeValue([{ k: 0 }, { k: 0 }, { k: 1 }]), 0);
const g = G.createGame('y', 'y', { id: 'a', name: 'A' });
for (let i = 1; i < 4; i++) G.addPlayer(g, { id: 'b' + i, name: 'B' + i });
assert(G.addPlayer(g, { id: 'z', name: 'Z' }), 'il 5° giocatore deve essere rifiutato');
console.log('OK: 60 partite simulate, regole verificate');

// ---- obiettivi ----
const OBJ = require('../server/objectives');
assert.strictEqual(OBJ.DEFS.length, 14);
const mk = (n) => { const g = G.createGame('o', 'o', { id: 'p0', name: 'P0' }); for (let i = 1; i < n; i++) G.addPlayer(g, { id: 'p' + i, name: 'P' + i }); G.start(g); return g; };
for (let i = 0; i < 200; i++) { // ogni giocatore ha un obiettivo; i 'destroy' puntano a un avversario in gioco o ripiegano sui 24
  const g = mk(4);
  g.players.forEach((p) => { assert(p.obj); if (p.obj.type === 'destroy') assert(p.obj.target && p.obj.target !== p.id); });
}
{ // 2 giocatori: i 'destroy' di colori assenti diventano 24 territori
  for (let i = 0; i < 100; i++) { const g = mk(2); g.players.forEach((p) => p.obj.type === 'destroy' && assert(g.players.some((x) => x.id === p.obj.target))); }
}
{ // continenti
  const g = mk(2), [a, b] = g.players;
  const own = (ids, pid) => ids.forEach((t) => (g.terr[t].owner = pid));
  const C = (id) => require('../server/map').CONTINENTS.find((c) => c.id === id).terrs;
  IDS.forEach((t) => (g.terr[t].owner = b.id));
  a.obj = OBJ.DEFS.find((d) => d.id === 'eu-sa+1'); assert(!OBJ.check(g, a.id, a.obj));
  own([...C('eu'), ...C('sa')], a.id); assert(!OBJ.check(g, a.id, a.obj), 'serve un terzo continente');
  own(C('oc'), a.id); assert(OBJ.check(g, a.id, a.obj));
  a.obj = OBJ.DEFS.find((d) => d.id === 'as-af'); assert(!OBJ.check(g, a.id, a.obj));
  own([...C('as'), ...C('af')], a.id); assert(OBJ.check(g, a.id, a.obj));
  // 18 territori con almeno 2 armate
  IDS.forEach((t) => { g.terr[t].owner = b.id; g.terr[t].armies = 1; });
  a.obj = OBJ.DEFS.find((d) => d.id === 't18');
  IDS.slice(0, 18).forEach((t) => { g.terr[t].owner = a.id; g.terr[t].armies = 2; });
  assert(OBJ.check(g, a.id, a.obj)); g.terr[IDS[0]].armies = 1; assert(!OBJ.check(g, a.id, a.obj), 'uno con 1 sola armata');
  // vittoria automatica dopo un'azione (24 territori, fase rinforzi)
  a.obj = OBJ.DEFS.find((d) => d.id === 't24');
  IDS.forEach((t) => { g.terr[t].owner = b.id; g.terr[t].armies = 1; });
  IDS.slice(0, 24).forEach((t) => (g.terr[t].owner = a.id));
  g.phase = 'reinforce'; g.turn = g.players.indexOf(a); a.pool = 1; b.pool = 0;
  assert.strictEqual(G.act(g, a.id, { a: 'place', t: IDS[0], n: 1 }), null);
  assert.strictEqual(g.status, 'finished'); assert.strictEqual(g.winner, a.id);
  const v = G.view(g, b.id); assert(v.players.every((p) => p.objective), 'a fine partita gli obiettivi sono rivelati');
}
{ // distruggere: vince solo chi elimina; se elimina un altro, si ripiega sui 24
  const g = mk(3), [a, b, c] = g.players;
  a.obj = { ...OBJ.DEFS.find((d) => d.id === 'd-' + b.colorKey), target: b.id };
  c.obj = { ...OBJ.DEFS.find((d) => d.id === 'd-' + a.colorKey), target: a.id };
  IDS.forEach((t) => { g.terr[t].owner = c.id; g.terr[t].armies = 5; });
  g.terr.ala.owner = b.id; g.terr.ala.armies = 1; g.terr.nwt.owner = a.id; g.terr.nwt.armies = 1;
  g.turn = g.players.indexOf(c); g.phase = 'attack';
  const origRandom = Math.random; let calls = 0; Math.random = () => (calls++ < 3 ? 0.99 : 0); // attaccante 6,6,6 - difensore 1
  assert.strictEqual(G.act(g, c.id, { a: 'attack', from: 'alb', to: 'ala', dice: 3 }), null);
  Math.random = origRandom;
  assert(!b.alive, 'b eliminato');
  assert.strictEqual(a.obj.type, 'terr', 'a ripiega sui 24 territori'); assert.strictEqual(g.status, 'playing');
}
console.log('OK obiettivi');
