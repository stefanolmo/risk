'use strict';
// Carte originali RisiKo!: sfondo, simboli e stemma estratti dai PDF delle carte (vedi tools/extract-cards.py);
// nomi dei territori e testi delle missioni composti qui, in italiano.
const Cards = (() => {
  const W = 670, H = 1046, NS = 'http://www.w3.org/2000/svg';
  const SER = "'Times New Roman',Times,'Liberation Serif',serif";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let LAYOUT = null;
  fetch('/cards/layout.json').then((r) => r.json()).then((j) => { LAYOUT = j; document.dispatchEvent(new Event('cards-ready')); });

  const SYM = ['fante', 'cavaliere', 'cannone'];           // 0, 1, 2
  const SYM_NAME = ['Fante', 'Cavaliere', 'Cannone', 'Jolly'];
  const COL = { na: '#bb9f27', sa: '#1f9a8c', eu: '#3d7e8e', af: '#e04a5f', as: '#7e9b5d', oc: '#bd5b88' }; // colori dei continenti sulle carte
  const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
  const frame = () => `<image href="/cards/card-bg.jpg" width="${W}" height="${H}" preserveAspectRatio="none"/>`;
  const svg = (inner, label) => `<svg class="cardart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" xmlns="${NS}">${frame()}${inner}</svg>`;

  // --- bbox delle sagome (cache) ---
  const bb = {};
  function bbox(t) {
    if (bb[t.id]) return bb[t.id];
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', t.d); s.append(p); document.body.append(s);
    const b = p.getBBox(); s.remove(); return (bb[t.id] = { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height });
  }

  function symbol(kind, cx, bottom) { // simbolo al centro in basso, come sulle carte territorio
    const [x0, y0, x1, y1] = LAYOUT[SYM[kind]], w = x1 - x0, h = y1 - y0;
    return `<image href="/cards/sym-${SYM[kind]}.png" x="${cx - w / 2}" y="${bottom - h}" width="${w}" height="${h}"/>`;
  }
  function twoLines(name) {
    const w = name.split(' ');
    if (name.length <= 13 || w.length < 2) return [name];
    let best = [name], bd = 1e9;
    for (let k = 1; k < w.length; k++) { const a = w.slice(0, k).join(' '), b = w.slice(k).join(' '), d = Math.max(a.length, b.length); if (d < bd) { bd = d; best = [a, b]; } }
    return best;
  }

  // Carta territorio: nome in alto, sagoma colorata per continente, simbolo dell'arma in basso. kind 3 = jolly.
  function territory(card, MAP) {
    if (!LAYOUT) return '';
    if (card.k === 3) {
      const put = (n) => { const [x0, y0, x1, y1] = LAYOUT[n]; return `<image href="/cards/sym-${n}.png" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>`; };
      return svg(put('cannone') + put('fante') + put('cavaliere'), 'Jolly');
    }
    const t = MAP.territories.find((x) => x.id === card.t), b = bbox(t), c = COL[t.continent];
    const lines = twoLines(t.full || t.name);
    const s = Math.min(4.6, 440 / b.w, 390 / b.h);
    const name = lines.map((ln, i) => `<tspan x="${W / 2}" dy="${i ? 60 : 0}">${esc(ln)}</tspan>`).join('');
    return svg(`<text x="${W / 2}" y="${lines.length > 1 ? 118 : 135}" text-anchor="middle" font-family="${SER}" font-size="56" fill="#111">${name}</text>
      <g transform="translate(${W / 2},${lines.length > 1 ? 410 : 400}) scale(${s}) translate(${-b.x},${-b.y})">
        <path d="${t.d}" fill="${c}" stroke="${shade(c, .5)}" stroke-width="${8 / s}" stroke-linejoin="round" paint-order="stroke"/>
        <path d="${t.d}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="${2 / s}" stroke-linejoin="round"/></g>
      ${symbol(card.k, W / 2, 925)}`, (t.full || t.name) + ' - ' + SYM_NAME[card.k]);
  }

  // --- carte missione (12 dell'originale, in italiano) ---
  const B = (t) => ({ b: t });
  const CONT = (a, b) => ['Conquista i', 'continenti di', [B(a)], 'e', [B(b + '.')]];
  const DESTROY = (c) => ['Distruggi tutte', 'le truppe', [B(c.toUpperCase() + '.')], '', 'Se comandi le', `truppe ${c},`, 'occupa invece', [B('24 TERRITORI')], 'a tua scelta.'];
  const MISSIONS = {
    'eu-oc': CONT('EUROPA', 'AUSTRALIA'), 'as-af': CONT('ASIA', 'AFRICA'), 'as-sa': CONT('ASIA', 'SUD AMERICA'),
    'na-oc': CONT('NORD AMERICA', 'AUSTRALIA'), 'na-af': CONT('NORD AMERICA', 'AFRICA'),
    t24: ['Occupa', [B('24 TERRITORI')], 'a tua scelta.'],
    t18: ['Occupa', [B('18 TERRITORI')], 'a tua scelta.', 'Ognuno deve avere', 'almeno 2 truppe.'],
    'd-verde': DESTROY('verdi'), 'd-giallo': DESTROY('gialle'), 'd-blu': DESTROY('blu'), 'd-arancione': DESTROY('arancioni'), 'd-indaco': DESTROY('indaco'),
  };
  function mission(id) {
    if (!LAYOUT || !MISSIONS[id]) return '';
    const L = MISSIONS[id], destroy = id.startsWith('d-'), small = destroy ? 40 : 46, big = destroy ? 54 : 62;
    const lines = L.map((ln) => (typeof ln === 'string' ? { t: ln, sz: small } : { t: ln[0].b, sz: big }));
    const lh = (l) => (l.t === '' ? small * .6 : l.sz * 1.28);
    const total = lines.reduce((a, l) => a + lh(l), 0), top = 440 + (540 - total) / 2;
    let y = top; const out = [];
    for (const l of lines) { y += lh(l); if (l.t) out.push(`<text x="${W / 2}" y="${(y - l.sz * .28).toFixed(1)}" text-anchor="middle" font-family="${SER}" font-size="${l.sz}" fill="#111">${esc(l.t)}</text>`); }
    const [cx0, cy0, cx1, cy1] = LAYOUT.crest;
    return svg(`<image href="/cards/crest.png" x="${cx0}" y="${cy0}" width="${cx1 - cx0}" height="${cy1 - cy0}"/>
      <text x="${(cx0 + cx1) / 2}" y="364" text-anchor="middle" font-family="${SER}" font-size="54" fill="#be1e2e" textLength="205" lengthAdjust="spacingAndGlyphs">MISSIONE</text>${out.join('')}`, 'Carta missione');
  }

  return { territory, mission, SYM_NAME, ready: () => !!LAYOUT, MISSIONS };
})();
