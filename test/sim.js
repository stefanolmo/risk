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
  const alive = g.players.filter((p) => p.alive);
  assert.strictEqual(alive.length, 1);
  assert(IDS.every((t) => g.terr[t].owner === alive[0].id));
  return steps;
}
for (const n of [2, 3, 4]) for (let i = 0; i < 20; i++) play(n);
// regole specifiche
assert.strictEqual(G.tradeValue([{ k: 2 }, { k: 2 }, { k: 2 }]), 4);
assert.strictEqual(G.tradeValue([{ k: 0 }, { k: 1 }, { k: 2 }]), 10);
assert.strictEqual(G.tradeValue([{ k: 3 }, { k: 0 }, { k: 0 }]), 8);
assert.strictEqual(G.tradeValue([{ k: 0 }, { k: 0 }, { k: 1 }]), 0);
const g = G.createGame('y', 'y', { id: 'a', name: 'A' });
for (let i = 1; i < 4; i++) G.addPlayer(g, { id: 'b' + i, name: 'B' + i });
assert(G.addPlayer(g, { id: 'z', name: 'Z' }), 'il 5° giocatore deve essere rifiutato');
console.log('OK: 60 partite simulate, regole verificate');
