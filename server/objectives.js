'use strict';
// Carte obiettivo del Risiko! (edizione standard) e colori degli eserciti.
const { CONTINENTS, IDS } = require('./map');

const COLOR_DEFS = [
  { key: 'blu', name: 'Blu', adj: 'blu', hex: '#3b82f6' },
  { key: 'rosso', name: 'Rosso', adj: 'rossa', hex: '#e74c3c' },
  { key: 'nero', name: 'Nero', adj: 'nera', hex: '#3a3f4b' },
  { key: 'giallo', name: 'Giallo', adj: 'gialla', hex: '#f1c40f' },
  { key: 'verde', name: 'Verde', adj: 'verde', hex: '#2ecc71' },
  { key: 'viola', name: 'Viola', adj: 'viola', hex: '#a855f7' },
];
const CNAME = { na: 'il Nord America', sa: 'il Sud America', eu: 'l\'Europa', af: 'l\'Africa', as: 'l\'Asia', oc: 'l\'Oceania' };

const T24TXT = 'Conquistare 24 territori a tua scelta';
const T24 = { id: 't24', type: 'terr', n: 24, text: T24TXT + '.' };
const adjOf = (key) => COLOR_DEFS.find((c) => c.key === key).adj;
const cont = (conts, extra) => ({
  id: conts.join('-') + (extra ? '+1' : ''), type: 'cont', conts, extra,
  text: 'Conquistare ' + conts.map((c) => CNAME[c]).join(extra ? ', ' : ' e ').replace(/, ([^,]*)$/, ' e $1') + (extra ? ' e un terzo continente a scelta.' : '.'),
});
const DEFS = [
  T24,
  { id: 't18', type: 'terr2', n: 18, text: 'Conquistare 18 territori occupandoli con almeno 2 armate ciascuno.' },
  cont(['as', 'sa']), cont(['as', 'af']), cont(['na', 'af']), cont(['na', 'oc']),
  cont(['eu', 'sa'], true), cont(['eu', 'oc'], true),
  ...COLOR_DEFS.map((c) => ({ id: 'd-' + c.key, type: 'destroy', color: c.key, text: `Distruggere completamente l'armata ${c.adj}.` })),
];

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fully = (g, pid, cid) => CONTINENTS.find((c) => c.id === cid).terrs.every((t) => g.terr[t].owner === pid);

function check(g, pid, o) {
  switch (o.type) {
    case 'terr': return IDS.filter((t) => g.terr[t].owner === pid).length >= o.n;
    case 'terr2': return IDS.filter((t) => g.terr[t].owner === pid && g.terr[t].armies >= 2).length >= o.n;
    case 'cont':
      if (!o.conts.every((c) => fully(g, pid, c))) return false;
      return !o.extra || CONTINENTS.some((c) => !o.conts.includes(c.id) && fully(g, pid, c.id));
    default: return false; // 'destroy' si risolve al momento dell'eliminazione
  }
}

// Distribuisce un obiettivo segreto a testa. Se l'armata da distruggere non è in gioco o è la propria -> 24 territori.
function deal(g) {
  const deck = shuffle(DEFS.map((d) => ({ ...d })));
  for (const p of g.players) {
    const d = deck.pop();
    if (d.type !== 'destroy') { p.obj = d; continue; }
    const target = g.players.find((x) => x.colorKey === d.color);
    const cname = adjOf(d.color);
    p.obj = target && target.id !== p.id ? { ...d, target: target.id }
      : { ...T24, text: `${T24TXT} (l'armata ${cname} da distruggere ${target ? 'è la tua' : 'non è in gioco'}).` };
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
