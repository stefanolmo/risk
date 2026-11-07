'use strict';
// Estrae da Risk_board.svg (layer "countries": 42 path) i contorni, il punto migliore per la pedina e i
// collegamenti via mare, e scrive server/shapes.json. Uso: node tools/build-map.js percorso/Risk_board.svg
// Richiede Playwright (solo per questo script: il server a runtime non ne ha bisogno).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { EDGES } = require('../server/map');

// indice del path nel layer "countries" -> id territorio (abbinamento verificato a vista)
const IDX = { 0: 'eau', 1: 'ido', 2: 'ngu', 3: 'ala', 4: 'ont', 5: 'nwt', 6: 'ven', 7: 'mad', 8: 'naf', 9: 'gro', 10: 'isl', 11: 'gbr', 12: 'sca', 13: 'jap', 14: 'yak',
  15: 'kam', 16: 'sib', 17: 'ura', 18: 'afg', 19: 'mea', 20: 'ind', 21: 'sia', 22: 'chi', 23: 'mon', 24: 'irk', 25: 'ukr', 26: 'seu', 27: 'weu', 28: 'neu', 29: 'egy',
  30: 'eaf', 31: 'con', 32: 'saf', 33: 'bra', 34: 'arg', 35: 'eus', 36: 'wus', 37: 'que', 38: 'cam', 39: 'per', 40: 'wau', 41: 'alb' };

(async () => {
  const file = path.resolve(process.argv[2] || '');
  if (!fs.existsSync(file)) { console.error('Indicare il file SVG'); process.exit(1); }
  const br = await chromium.launch(), p = await br.newPage();
  await p.goto('file://' + file);
  const out = await p.evaluate((IDX) => {
    const layer = [...document.querySelectorAll('g')].find((g) => g.getAttribute('inkscape:label') === 'countries');
    const m = /translate\(([-\d.e]+),([-\d.e]+)\)/.exec(layer.getAttribute('transform'));
    const tx = +m[1], ty = +m[2];
    const res = {};
    [...layer.querySelectorAll('path')].forEach((pa, i) => {
      if (pa.getAttribute('transform')) throw new Error('path con transform proprio: ' + i);
      const len = pa.getTotalLength(), n = Math.max(40, Math.ceil(len / 1.2)), pts = [];
      for (let k = 0; k < n; k++) { const q = pa.getPointAtLength((len * k) / n); pts.push([q.x, q.y]); }
      const b = pa.getBBox(); let best = null, bd = -1;
      for (let x = b.x; x <= b.x + b.width; x += 1.5) for (let y = b.y; y <= b.y + b.height; y += 1.5) {
        if (!pa.isPointInFill(new DOMPoint(x, y))) continue;
        let md = 1e9; for (const [px, py] of pts) { const d = (px - x) ** 2 + (py - y) ** 2; if (d < md) md = d; }
        if (md > bd) { bd = md; best = [x, y]; }
      }
      res[IDX[i]] = { d: pa.getAttribute('d'), pts: pts.map(([x, y]) => [x + tx, y + ty]), x: best[0] + tx, y: best[1] + ty, r: Math.sqrt(bd) };
    });
    const svg = document.documentElement;
    return { w: parseFloat(svg.getAttribute('width')), h: parseFloat(svg.getAttribute('height')), tx, ty, res };
  }, IDX);
  await br.close();

  const R = out.res, ids = Object.keys(R);
  if (ids.length !== 42) throw new Error('attesi 42 territori, trovati ' + ids.length);
  const closest = (a, b) => { let best = [1e9]; for (const [x1, y1] of R[a].pts) for (const [x2, y2] of R[b].pts) { const d = Math.hypot(x1 - x2, y1 - y2); if (d < best[0]) best = [d, x1, y1, x2, y2]; } return best; };
  const near = (a, b) => { let c = 0; for (const [x1, y1] of R[a].pts) for (const [x2, y2] of R[b].pts) if (Math.hypot(x1 - x2, y1 - y2) < 1.8) { if (++c >= 3) return true; } return false; };
  const isEdge = new Set(EDGES.flatMap(([a, b]) => [a + '-' + b, b + '-' + a]));
  const sea = [], problems = [];
  for (const [a, b] of EDGES) {
    if (a === 'ala' && b === 'kam') continue;
    if (!near(a, b)) { const c = closest(a, b); sea.push({ a, b, x1: +c[1].toFixed(1), y1: +c[2].toFixed(1), x2: +c[3].toFixed(1), y2: +c[4].toFixed(1) }); }
  }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (near(ids[i], ids[j]) && !isEdge.has(ids[i] + '-' + ids[j])) problems.push(ids[i] + '-' + ids[j]);
  const ext = (id, dir) => R[id].pts.reduce((m, q) => (dir * q[0] > dir * m[0] ? q : m));
  const al = ext('ala', -1), ka = ext('kam', 1);
  const wrap = [{ x1: al[0], y1: al[1], x2: 0, y2: al[1] }, { x1: ka[0], y1: ka[1], x2: out.w, y2: ka[1] }];

  const terr = {}; for (const id of ids) terr[id] = { d: R[id].d, x: +R[id].x.toFixed(1), y: +R[id].y.toFixed(1), r: +R[id].r.toFixed(1) };
  fs.writeFileSync(path.join(__dirname, '../server/shapes.json'), JSON.stringify({ w: out.w, h: out.h, tx: out.tx, ty: out.ty, terr, sea, wrap }));
  console.log('territori:', ids.length, '| collegamenti via mare:', sea.length);
  console.log('mare:', sea.map((s) => s.a + '-' + s.b).join(' '));
  console.log('PROBLEMA - si toccano ma non sono adiacenti nel gioco:', problems.length ? problems.join(' ') : 'nessuno');
  console.log('raggio libero minimo (territori piccoli):', ids.map((i) => [i, terr[i].r]).sort((a, b) => a[1] - b[1]).slice(0, 8).map((x) => x.join('=')).join(' '));
})();
