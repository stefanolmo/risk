'use strict';
// Le 12 carte missione del gioco originale (Risk_Mission_Card.pdf) e i colori degli eserciti.
const { CONTINENTS, IDS } = require('./map');

// I colori sono quelli nominati sulle carte (verde, giallo, blu, arancione, indaco) più il rosso.
// trp = aggettivo per "le truppe ...", adj = per "l'armata ..."
const COLOR_DEFS = [
  { key: 'rosso', name: 'Rosso', adj: 'rossa', trp: 'rosse', hex: '#e74c3c' },
  { key: 'arancione', name: 'Arancione', adj: 'arancione', trp: 'arancioni', hex: '#f0832a' },
  { key: 'giallo', name: 'Giallo', adj: 'gialla', trp: 'gialle', hex: '#f1c40f' },
  { key: 'verde', name: 'Verde', adj: 'verde', trp: 'verdi', hex: '#2e9e52' },
  { key: 'blu', name: 'Blu', adj: 'blu', trp: 'blu', hex: '#3b82f6' },
  { key: 'indaco', name: 'Indaco', adj: 'indaco', trp: 'indaco', hex: '#4b3aa6' },
];
const CNAME = { na: 'il Nord America', sa: 'il Sud America', eu: 'l\'Europa', af: 'l\'Africa', as: 'l\'Asia', oc: 'l\'Australia' };

const T24TXT = 'Occupare 24 territori a tua scelta';
const T24 = { id: 't24', type: 'terr', n: 24, text: T24TXT + '.' };
const adjOf = (key) => COLOR_DEFS.find((c) => c.key === key).adj;
const cont = (a, b) => ({ id: a + '-' + b, type: 'cont', conts: [a, b], text: `Conquistare i continenti di ${CNAME[a].replace(/^(il|l')\s?/, '').replace(/^./, (c) => c.toUpperCase())} e ${CNAME[b].replace(/^(il|l')\s?/, '').replace(/^./, (c) => c.toUpperCase())}.` });
const DESTROY = ['verde', 'giallo', 'blu', 'arancione', 'indaco']; // le sole armate nominate sulle carte
const DEFS = [
  cont('eu', 'oc'), cont('as', 'af'), cont('as', 'sa'), cont('na', 'oc'), cont('na', 'af'),
  T24,
  { id: 't18', type: 'terr2', n: 18, text: 'Occupare 18 territori a tua scelta, ognuno con almeno 2 truppe.' },
  ...DESTROY.map((k) => ({ id: 'd-' + k, type: 'destroy', color: k, text: `Distruggere tutte le truppe ${COLOR_DEFS.find((c) => c.key === k).trp}.` })),
];

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fully = (g, pid, cid) => CONTINENTS.find((c) => c.id === cid).terrs.every((t) => g.terr[t].owner === pid);

function check(g, pid, o) {
  switch (o.type) {
    case 'terr': return IDS.filter((t) => g.terr[t].owner === pid).length >= o.n;
    case 'terr2': return IDS.filter((t) => g.terr[t].owner === pid && g.terr[t].armies >= 2).length >= o.n;
    case 'cont': return o.conts.every((c) => fully(g, pid, c));
    default: return false; // 'destroy' si risolve al momento dell'eliminazione
  }
}

// Un obiettivo segreto a testa (p.card = carta pescata, non cambia; p.obj = obiettivo effettivo).
// La carta stessa dice: se comandi tu l'armata da distruggere, occupa 24 territori. Se quell'armata non è in gioco
// il caso non è previsto dalla carta: si applica la stessa regola dei 24 territori.
function deal(g) {
  const deck = shuffle(DEFS.map((d) => ({ ...d })));
  for (const p of g.players) {
    const d = deck.pop();
    p.card = d.id;
    if (d.type !== 'destroy') { p.obj = d; continue; }
    const target = g.players.find((x) => x.colorKey === d.color);
    const cname = adjOf(d.color);
    p.obj = target && target.id !== p.id ? { ...d, target: target.id }
      : { ...T24, text: `${T24TXT} (${target ? 'comandi tu' : 'non è in gioco'} l'armata ${cname} da distruggere).` };
  }
}

// Un giocatore è uscito dal gioco: chi doveva distruggerlo ripiega sui 24 territori.
function retarget(g, deadId) {
  const dead = g.players.find((p) => p.id === deadId);
  for (const p of g.players) {
    if (p.alive && p.obj && p.obj.type === 'destroy' && p.obj.target === deadId) {
      p.obj = { ...T24, text: `${T24TXT} (l'armata ${adjOf(dead.colorKey)} è stata eliminata da un altro giocatore).` };
    }
  }
}

module.exports = { adjOf, COLOR_DEFS, DEFS, check, deal, retarget, shuffle };
