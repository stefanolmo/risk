'use strict';
const $ = (s) => document.querySelector(s);
const PHASES = { setup: 'Piazzamento iniziale', reinforce: 'Rinforzi', attack: 'Attacco', conquer: 'Conquista', fortify: 'Spostamento', finished: 'Fine partita' };
const KIND = ['Fanteria', 'Cavalleria', 'Artiglieria', 'Jolly'];
const KIND_ICON = ['🪖', '🐎', '💣', '🃏'];

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const clear = (e) => { while (e.firstChild) e.firstChild.remove(); return e; };

let ws, S = null, MAP = null, token = null;
try { token = localStorage.getItem('risiko_token'); } catch {}
const sel = { from: null, to: null, qty: 1, n: 1 };
let mapBuilt = false;

// ---------- rete ----------
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { if (token) send({ type: 'resume', token }); else show(); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'auth') { token = m.token; try { localStorage.setItem('risiko_token', token); } catch {} }
    else if (m.type === 'state') { S = m; render(); }
    else if (m.type === 'error') {
      if (m.code === 'auth') { token = null; try { localStorage.removeItem('risiko_token'); } catch {} S = null; show(); }
      $('#login-err').textContent = m.message; toast(m.message);
    } else if (m.type === 'notice') toast(m.message, true);
    else if (m.type === 'kicked') { token = null; try { localStorage.removeItem('risiko_token'); } catch {} S = null; show(); toast(m.message); }
  };
  ws.onclose = () => { toast('Connessione persa, riconnessione…'); setTimeout(connect, 1500); };
}
const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
const act = (o) => send({ type: 'act', ...o });
let toastT;
function toast(msg, ok) {
  const t = $('#toast'); t.textContent = msg; t.className = ok ? 'ok' : ''; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3500);
}

// ---------- login ----------
document.querySelectorAll('.tab').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
  $('#form-player').hidden = b.dataset.t !== 'p'; $('#form-admin').hidden = b.dataset.t !== 'a'; $('#login-err').textContent = '';
});
$('#form-player').onsubmit = (e) => { e.preventDefault(); $('#login-err').textContent = ''; send({ type: 'register', name: $('#in-name').value }); };
$('#form-admin').onsubmit = (e) => { e.preventDefault(); $('#login-err').textContent = ''; send({ type: 'adminLogin', user: $('#in-user').value, password: $('#in-pass').value }); };
$('#btn-logout').onclick = () => { send({ type: 'logout' }); token = null; try { localStorage.removeItem('risiko_token'); } catch {} S = null; show(); };
$('#form-create').onsubmit = (e) => { e.preventDefault(); send({ type: 'createGame', name: $('#in-game').value }); $('#in-game').value = ''; };

function show(view) {
  $('#login').hidden = view !== undefined; // login se nessuna view
  for (const id of ['lobby', 'room', 'game']) $('#' + id).hidden = id !== view;
  $('#top').hidden = !S;
}

// ---------- render ----------
function render() {
  $('#who').textContent = S.me.name + (S.me.isAdmin ? ' (admin)' : '');
  $('#btn-admin').hidden = !S.me.isAdmin;
  const g = S.game;
  if (!g) { show('lobby'); renderLobby(); }
  else if (g.status === 'lobby') { show('room'); renderRoom(g); }
  else { show('game'); renderGame(g); }
  if (S.me.isAdmin && $('#admin-dlg').open && !$('#admin-dlg').contains(document.activeElement)) renderAdmin();
}

function renderLobby() {
  const box = clear($('#gamelist'));
  if (!S.games.length) box.append(h('p', { class: 'mut' }, 'Nessuna partita. Creane una!'));
  for (const g of S.games) {
    const st = g.status === 'lobby' ? 'In attesa' : g.status === 'playing' ? 'In corso' : 'Terminata';
    const can = g.status === 'lobby' && g.players.length < g.max;
    box.append(h('div', { class: 'gitem' },
      h('div', {}, h('strong', {}, g.name), h('div', { class: 'mut' }, `${st} · ${g.players.map((p) => p.name).join(', ')} (${g.players.length}/${g.max})`)),
      h('div', { class: 'row' },
        can && h('button', { class: 'primary', onclick: () => send({ type: 'joinGame', id: g.id }) }, 'Unisciti'),
        S.me.isAdmin && h('button', { class: 'danger', onclick: () => confirm(`Annullare "${g.name}"?`) && send({ type: 'cancelGame', id: g.id }) }, 'Annulla'))));
  }
}

function renderRoom(g) {
  const host = g.hostId === S.me.id, r = clear($('#room'));
  r.append(h('h2', {}, g.name), h('p', { class: 'mut' }, 'Sala d\'attesa — servono da 2 a 4 giocatori.'),
    ...g.players.map((p) => h('div', { class: 'pl' }, h('span', { class: 'chip', style: `background:${p.color}` }), p.name, p.id === g.hostId ? ' 👑' : '')),
    h('div', { class: 'btns' },
      host && h('button', { class: 'primary', disabled: g.players.length < 2, onclick: () => send({ type: 'startGame' }) }, 'Avvia partita'),
      h('button', { onclick: () => send({ type: 'leaveGame' }) }, 'Esci dalla sala'),
      host && h('button', { class: 'danger', onclick: () => send({ type: 'cancelGame' }) }, 'Annulla partita')));
}

// ---------- mappa ----------
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); e.append(...kids); return e; };
const nodes = {};
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const view = { x: 0, y: 0, w: 750, h: 520, k: 1 };
let moved = false;

function setView() {
  const svg = $('#map');
  view.w = MAP.view.w / view.k; view.h = MAP.view.h / view.k;
  const mx = MAP.view.w * 0.08, my = MAP.view.h * 0.08;
  view.x = Math.max(-mx, Math.min(view.x, MAP.view.w - view.w + mx));
  view.y = Math.max(-my, Math.min(view.y, MAP.view.h - view.h + my));
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  svg.classList.toggle('zoomed', view.k >= 1.9);
}
function zoomAt(f, cx, cy) { // cx,cy in coordinate mappa
  const k = Math.max(1, Math.min(7, view.k * f)), r = view.k / k;
  view.x = cx - (cx - view.x) * r; view.y = cy - (cy - view.y) * r; view.k = k; setView();
}
function toMap(ev) { const svg = $('#map'), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function initZoom() {
  const svg = $('#map');
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const p = toMap(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y); }, { passive: false });
  let drag = null;
  svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, s: svg.getScreenCTM().a }; moved = false; });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 5) moved = true;
    if (moved) { view.x = drag.vx - dx / drag.s; view.y = drag.vy - dy / drag.s; setView(); }
  });
  window.addEventListener('pointerup', () => { drag = null; setTimeout(() => (moved = false), 0); });
  $('#zin').onclick = () => zoomAt(1.4, view.x + view.w / 2, view.y + view.h / 2);
  $('#zout').onclick = () => zoomAt(1 / 1.4, view.x + view.w / 2, view.y + view.h / 2);
  $('#zreset').onclick = () => { view.k = 1; view.x = view.y = 0; setView(); };
}

function showHover(id) {
  const g = S && S.game, box = $('#hoverinfo');
  if (!g || !g.terr || !id) { box.hidden = true; return; }
  const t = g.terr[id], o = g.players.find((p) => p.id === t.owner), T = MAP.territories.find((x) => x.id === id);
  clear(box).append(h('b', {}, T.name), ` — ${o ? o.name : 'neutrale'} · ${t.armies} ${t.armies === 1 ? 'armata' : 'armate'}`);
  box.hidden = false;
}

function buildMap() {
  const svg = clear($('#map')), T = Object.fromEntries(MAP.territories.map((t) => [t.id, t]));
  const col = Object.fromEntries(MAP.continents.map((c) => [c.id, c.color]));
  const W = MAP.view.w, H = MAP.view.h;
  svg.append(sv('defs', {},
    sv('radialGradient', { id: 'sea', cx: '50%', cy: '45%', r: '75%' }, sv('stop', { offset: '0', 'stop-color': '#2c6f93' }), sv('stop', { offset: '1', 'stop-color': '#173f5c' })),
    sv('pattern', { id: 'waves', width: 30, height: 15, patternUnits: 'userSpaceOnUse' }, sv('path', { d: 'M0 7 q7.5 -6 15 0 t15 0', fill: 'none', stroke: '#ffffff', 'stroke-opacity': '.07', 'stroke-width': .8 })),
    sv('radialGradient', { id: 'tokshine', cx: '35%', cy: '30%', r: '70%' }, sv('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '.55' }), sv('stop', { offset: '.5', 'stop-color': '#fff', 'stop-opacity': '0' })),
    sv('filter', { id: 'shadow', x: '-5%', y: '-5%', width: '110%', height: '115%' }, sv('feDropShadow', { dx: 0, dy: 1.6, stdDeviation: 1.6, 'flood-color': '#000', 'flood-opacity': '.55' })),
    sv('filter', { id: 'tokshadow', x: '-40%', y: '-40%', width: '180%', height: '180%' }, sv('feDropShadow', { dx: 0, dy: 1.2, stdDeviation: 1, 'flood-color': '#000', 'flood-opacity': '.7' }))));
  svg.append(sv('rect', { x: -1500, y: -900, width: 4000, height: 2400, fill: 'url(#sea)' }), sv('rect', { x: -1500, y: -900, width: 4000, height: 2400, fill: 'url(#waves)' }));
  // terre: sagome originali del tabellone
  const land = sv('g', { filter: 'url(#shadow)' });
  for (const t of MAP.territories) {
    const el = sv('path', { class: 'land', d: t.d, fill: col[t.continent] }, sv('title', {}, t.name));
    el.onclick = () => !moved && onTerr(t.id);
    el.onmouseenter = () => showHover(t.id); el.onmouseleave = () => showHover(null);
    land.append(el); nodes[t.id] = { land: el };
  }
  svg.append(sv('g', { transform: `translate(${MAP.shapesTx},${MAP.shapesTy})` }, land));
  // collegamenti via mare (tratteggiati)
  const sea = sv('g', { class: 'sea' });
  for (const l of [...MAP.sea, ...MAP.wrap]) sea.append(sv('line', { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }));
  svg.append(sea);
  // evidenziazioni
  const hl = sv('g', { 'pointer-events': 'none', transform: `translate(${MAP.shapesTx},${MAP.shapesTy})` });
  for (const t of MAP.territories) { const e = sv('path', { class: 'hl', d: t.d }); hl.append(e); nodes[t.id].hl = e; }
  svg.append(hl);
  // bussola + titolo
  svg.append(sv('g', { transform: 'translate(40,440) scale(.62)', opacity: '.85', 'pointer-events': 'none' },
    sv('circle', { r: 46, fill: 'none', stroke: '#e8d9a8', 'stroke-width': 1.5 }), sv('circle', { r: 38, fill: 'none', stroke: '#e8d9a8', 'stroke-width': .8 }),
    sv('path', { d: 'M0 -44 L7 -7 L44 0 L7 7 L0 44 L-7 7 L-44 0 L-7 -7Z', fill: '#e8d9a8', 'fill-opacity': .85, stroke: '#3b2a14' }),
    sv('path', { d: 'M0 -44 L7 -7 L0 0 L-7 -7Z', fill: '#c0392b' }),
    sv('text', { y: -52, 'text-anchor': 'middle', fill: '#e8d9a8', 'font-size': 13, 'font-family': 'Georgia,serif', 'font-weight': 700 }, 'N')));
  svg.append(sv('rect', { x: 8, y: 486, width: 92, height: 21, rx: 3, fill: '#b3261e', stroke: '#e8d9a8', 'stroke-width': 1, 'pointer-events': 'none' }),
    sv('text', { x: 54, y: 501, 'text-anchor': 'middle', fill: '#fff', 'font-size': 14, 'font-weight': 900, 'font-style': 'italic', 'font-family': 'Georgia,serif', 'letter-spacing': 1.5, 'pointer-events': 'none' }, 'RISIKO!'));
  // nomi (visibili da ingrandito) e pedine
  const names = sv('g', { class: 'names', 'pointer-events': 'none' }), toks = sv('g');
  for (const t of MAP.territories) {
    const w = t.name.toUpperCase().split(' ');
    let lines = [w.join(' ')];
    if (w.length > 1 && lines[0].length > 10) {
      let best = 1e9;
      for (let k = 1; k < w.length; k++) { const a = w.slice(0, k).join(' '), b = w.slice(k).join(' '), m = Math.max(a.length, b.length); if (m < best) { best = m; lines = [a, b]; } }
    }
    const tx = sv('text', { class: 'tname', x: t.x, y: t.y + 19 });
    lines.forEach((ln, k) => tx.append(sv('tspan', { x: t.x, dy: k ? 5 : 0 }, ln)));
    names.append(tx);
    const c = sv('circle', { r: 10, cx: 0, cy: 0 }), sh = sv('circle', { r: 10, fill: 'url(#tokshine)' }), ring = sv('circle', { r: 8, class: 'ring' });
    const n = sv('text', { class: 'tn' });
    const g = sv('g', { class: 'tok', transform: `translate(${t.x},${t.y})`, filter: 'url(#tokshadow)' }, c, ring, sh, n);
    g.onclick = () => !moved && onTerr(t.id);
    g.onmouseenter = () => showHover(t.id); g.onmouseleave = () => showHover(null);
    toks.append(g); Object.assign(nodes[t.id], { g, c, n, x: t.x, y: t.y });
  }
  svg.append(names, toks);
  setView(); mapBuilt = true;
}

function myTurn(g) { const p = g.players[g.turn]; return g.status === 'playing' && p && p.id === S.me.id; }
const adj = {};
function targets(g) {
  const out = new Set();
  if (!sel.from) return out;
  const near = adj[sel.from] || [];
  if (g.phase === 'attack') near.forEach((t) => g.terr[t].owner !== S.me.id && out.add(t));
  return out;
}

function renderMap(g) {
  const tg = targets(g), mine = myTurn(g);
  const col = Object.fromEntries(g.players.map((p) => [p.id, p.color]));
  const attacking = mine && g.phase === 'attack' && sel.from;
  for (const id in nodes) {
    const t = g.terr[id], nd = nodes[id];
    nd.c.setAttribute('fill', t.owner ? col[t.owner] : '#8a8f98');
    nd.n.textContent = t.armies; nd.n.setAttribute('class', 'tn' + (t.armies > 99 ? ' s3' : t.armies > 9 ? ' s2' : ''));
    const isSel = sel.from === id, isTgt = sel.to === id || tg.has(id);
    nd.hl.setAttribute('class', 'hl' + (isSel ? ' sel' : isTgt ? (sel.to === id ? ' tgt pick' : ' tgt') : ''));
    nd.land.setAttribute('class', 'land' + (attacking && !isSel && !isTgt ? ' dim' : ''));
    nd.g.setAttribute('transform', `translate(${nd.x},${nd.y})${isSel ? ' scale(1.2)' : ''}`);
  }
}

function onTerr(id) {
  const g = S.game; if (!g || g.status !== 'playing' || !myTurn(g)) return;
  const t = g.terr[id], mineT = t.owner === S.me.id, me = g.players[g.turn];
  if (g.phase === 'setup') { if (mineT) act({ a: 'place', t: id, n: 1 }); return; }
  if (g.phase === 'reinforce') { if (mineT) act({ a: 'place', t: id, n: Math.min(sel.qty, me.pool) }); return; }
  if (g.phase === 'attack') {
    if (mineT) { if (t.armies > 1) { sel.from = id; sel.to = null; } }
    else if (sel.from && adj[sel.from].includes(id)) sel.to = id;
  } else if (g.phase === 'fortify') {
    if (!mineT) return;
    if (sel.from === id) { sel.from = sel.to = null; }
    else if (!sel.from) { sel.from = id; sel.n = 1; }
    else { sel.to = id; sel.n = Math.max(1, Math.min(sel.n, g.terr[sel.from].armies - 1)); }
  }
  renderGame(g);
}

// ---------- pannello partita ----------
let lastPhaseKey = '';
function renderGame(g) {
  if (!mapBuilt) return;
  const key = g.id + g.phase + g.turn;
  if (key !== lastPhaseKey) { sel.from = sel.to = null; sel.qty = 1; lastPhaseKey = key; }
  if (sel.from && g.terr[sel.from].owner !== S.me.id) sel.from = sel.to = null;
  renderMap(g);
  const side = clear($('#side')), cp = g.players[g.turn], mine = myTurn(g);
  const stats = (p) => { let t = 0, a = 0; for (const k in g.terr) if (g.terr[k].owner === p.id) { t++; a += g.terr[k].armies; } return { t, a }; };

  // stato turno
  const ban = h('div', { class: 'box' });
  if (g.status === 'finished') {
    const w = g.players.find((p) => p.id === g.winner);
    ban.append(h('div', { class: 'banner' }, `🏆 Vince ${w ? w.name : '—'}!`), h('div', { class: 'mut' }, `${w ? w.name : ''} ${g.winReason || ''}.`));
  } else {
    ban.append(h('div', { class: 'banner' }, mine ? `Tocca a te — ${PHASES[g.phase]}` : `Turno di ${cp.name} — ${PHASES[g.phase]}`));
    ban.append(h('div', { class: 'mut' }, hint(g, mine, cp)));
  }
  side.append(ban);

  // giocatori
  const pb = h('div', { class: 'box' }, h('h3', {}, 'Giocatori'));
  g.players.forEach((p, i) => {
    const s = stats(p);
    pb.append(h('div', { class: 'pl' + (g.status === 'playing' && i === g.turn ? ' turn' : '') + (p.alive ? '' : ' dead') },
      h('span', { class: 'chip', style: `background:${p.color}` }), h('span', { class: 'n', title: p.colorName }, p.name + (p.id === S.me.id ? ' (tu)' : ''), p.colorName ? h('span', { class: 'mut' }, ` · ${p.colorName}`) : ''),
      h('span', { class: 'mut', title: 'territori / armate / carte' }, `🗺${s.t} ⚔${s.a} 🂠${p.cardCount}` + (g.phase === 'setup' || (g.phase === 'reinforce' && i === g.turn) ? ` +${p.pool}` : ''))));
  });
  side.append(pb);

  // obiettivo segreto (a fine partita sono rivelati tutti)
  const meP = g.players.find((p) => p.id === S.me.id);
  if (g.status === 'finished') {
    side.append(h('div', { class: 'box' }, h('h3', {}, 'Obiettivi rivelati'),
      ...g.players.map((p) => h('div', { class: 'pl' }, h('span', { class: 'chip', style: `background:${p.color}` }), h('span', {}, `${p.name}: ${p.objective || '—'}`)))));
  } else if (meP && meP.objective) {
    const ob = h('div', { class: 'box obj' }, h('h3', {}, '🎯 Il tuo obiettivo (segreto)'), h('div', { class: 'banner', id: 'objtxt' }, meP.objective));
    side.append(ob);
  }

  // azioni
  if (mine) side.append(actionsBox(g, cp));

  // carte
  const me = g.players.find((p) => p.id === S.me.id);
  if (me && me.cards && me.cards.length) side.append(cardsBox(g, me, mine));

  // ultimo scontro
  const b = g.lastBattle;
  if (b) {
    const T = Object.fromEntries(MAP.territories.map((t) => [t.id, t.name]));
    side.append(h('div', { class: 'box' }, h('h3', {}, 'Ultimo scontro'),
      h('div', {}, `${b.by}: ${T[b.from]} → ${T[b.to]}${b.rounds > 1 ? ` (${b.rounds} round)` : ''}`),
      h('div', { class: 'dice' }, b.att.map((d) => h('span', { class: 'a' }, FACES[d - 1])), h('i', {}, 'vs'), b.def.map((d) => h('span', { class: 'd' }, FACES[d - 1]))),
      h('div', { class: 'mut' }, `Perdite: attaccante ${b.al}, difensore ${b.dl}`)));
  }

  // log
  const lg = h('div', { class: 'box' }, h('h3', {}, 'Cronaca'), h('div', { class: 'log', id: 'log' }, g.log.map((l) => h('div', {}, l))));
  side.append(lg); const L = $('#log'); L.scrollTop = L.scrollHeight;

  // uscita
  side.append(h('div', { class: 'btns' },
    g.status === 'finished'
      ? h('button', { class: 'primary', onclick: () => send({ type: 'leaveGame' }) }, 'Torna alla lobby')
      : h('button', { onclick: () => confirm('Abbandonare la partita? I tuoi territori diventeranno neutrali.') && send({ type: 'leaveGame' }) }, 'Abbandona'),
    g.hostId === S.me.id && g.status !== 'finished' && h('button', { class: 'danger', onclick: () => confirm('Annullare la partita per tutti?') && send({ type: 'cancelGame' }) }, 'Annulla partita')));
}

function hint(g, mine, cp) {
  if (!mine) return 'Attendi il tuo turno.';
  switch (g.phase) {
    case 'setup': return `Clicca un tuo territorio per piazzare 1 armata (ancora ${Math.min(3 - g.setupPlaced, cp.pool)} in questo turno, ${cp.pool} totali).`;
    case 'reinforce': return `Armate da piazzare: ${cp.pool}. Clicca un tuo territorio.`;
    case 'attack': return 'Scegli un tuo territorio (≥2 armate), poi un confinante nemico.';
    case 'conquer': return 'Territorio conquistato: scegli quante armate spostare.';
    case 'fortify': return 'Facoltativo: sposta armate tra due tuoi territori collegati, poi il turno finisce.';
  }
  return '';
}

function actionsBox(g, cp) {
  const T = Object.fromEntries(MAP.territories.map((t) => [t.id, t.name]));
  const bx = h('div', { class: 'box' }, h('h3', {}, 'Azioni')), bt = h('div', { class: 'btns' });
  const rr = () => renderGame(S.game);
  if (g.phase === 'reinforce') {
    const max = cp.pool;
    sel.qty = Math.max(1, Math.min(sel.qty, max || 1));
    if (max > 0) bx.append(h('div', { class: 'row' }, `Armate per click: `, h('input', { type: 'range', min: 1, max, value: sel.qty, oninput: (e) => { sel.qty = +e.target.value; $('#qv').textContent = sel.qty; } }), h('b', { id: 'qv' }, sel.qty)));
    bt.append(h('button', { class: 'primary', disabled: cp.pool > 0, onclick: () => act({ a: 'endReinforce' }) }, 'Vai all\'attacco'));
  } else if (g.phase === 'attack') {
    const f = sel.from && g.terr[sel.from], ok = f && sel.to && f.armies > 1;
    bx.append(h('div', {}, sel.from ? `${T[sel.from]} (${f.armies})` : '—', ' → ', sel.to ? `${T[sel.to]} (${g.terr[sel.to].armies})` : '—'));
    for (const d of [1, 2, 3]) bt.append(h('button', { disabled: !ok || f.armies - 1 < d, onclick: () => act({ a: 'attack', from: sel.from, to: sel.to, dice: d }) }, `Attacca ${d}🎲`));
    bt.append(h('button', { class: 'primary', disabled: !ok, onclick: () => act({ a: 'blitz', from: sel.from, to: sel.to }) }, 'Blitz'));
    bt.append(h('button', { onclick: () => act({ a: 'endAttack' }) }, 'Fine attacco'));
    bt.append(h('button', { onclick: () => act({ a: 'endTurn' }) }, 'Passa il turno'));
  } else if (g.phase === 'conquer' && g.pending) {
    const { from, to, min, max } = g.pending;
    sel.n = Math.max(min, Math.min(sel.n < min ? max : sel.n, max));
    bx.append(h('div', {}, `Sposta da ${T[from]} a ${T[to]}:`), h('div', { class: 'row' }, h('input', { type: 'range', min, max, value: sel.n, oninput: (e) => { sel.n = +e.target.value; $('#nv').textContent = sel.n; } }), h('b', { id: 'nv' }, sel.n)));
    bt.append(h('button', { class: 'primary', onclick: () => act({ a: 'conquer', n: sel.n }) }, 'Conferma spostamento'));
  } else if (g.phase === 'fortify') {
    const ok = sel.from && sel.to;
    if (ok) {
      const max = g.terr[sel.from].armies - 1; sel.n = Math.max(1, Math.min(sel.n, max));
      bx.append(h('div', {}, `${T[sel.from]} → ${T[sel.to]}`), h('div', { class: 'row' }, h('input', { type: 'range', min: 1, max, value: sel.n, oninput: (e) => { sel.n = +e.target.value; $('#nv').textContent = sel.n; } }), h('b', { id: 'nv' }, sel.n)));
      bt.append(h('button', { class: 'primary', disabled: max < 1, onclick: () => act({ a: 'fortify', from: sel.from, to: sel.to, n: sel.n }) }, 'Sposta e finisci turno'));
    }
    bt.append(h('button', { onclick: () => act({ a: 'endTurn' }) }, 'Finisci turno senza spostare'));
  } else if (g.phase === 'setup') bx.append(h('div', { class: 'mut' }, 'Piazza le armate cliccando sui tuoi territori.'));
  bx.append(bt); return bx;
}

function cardsBox(g, me, mine) {
  const chosen = new Set(), bx = h('div', { class: 'box' }, h('h3', {}, 'Le tue carte'));
  const btn = h('button', { class: 'primary', disabled: true, onclick: () => act({ a: 'trade', idx: [...chosen] }) }, 'Gioca tris');
  const T = Object.fromEntries(MAP.territories.map((t) => [t.id, t.name]));
  me.cards.forEach((c, i) => bx.append(h('label', { class: 'card-it' },
    h('input', { type: 'checkbox', disabled: !(mine && g.phase === 'reinforce'), onchange: (e) => { e.target.checked ? chosen.add(i) : chosen.delete(i); btn.disabled = chosen.size !== 3; } }),
    `${KIND_ICON[c.k]} ${KIND[c.k]}${c.t ? ' · ' + T[c.t] : ''}`)));
  bx.append(h('div', { class: 'mut' }, 'Tris: 3 cannoni 4, 3 fanti 6, 3 cavalli 8, uno per tipo 10, jolly + 2 uguali 12. Il jolly vale solo in quest\'ultima combinazione. Con 5+ carte il tris è obbligatorio.'));
  if (mine && g.phase === 'reinforce') bx.append(h('div', { class: 'btns' }, btn));
  return bx;
}

// ---------- admin ----------
$('#btn-admin').onclick = () => { renderAdmin(); $('#admin-dlg').showModal(); };
$('#admin-close').onclick = () => $('#admin-dlg').close();
function renderAdmin() {
  const b = clear($('#admin-body')), a = S.admin; if (!a) return;
  b.append(h('h3', {}, 'Giocatori registrati'));
  const tp = h('table');
  a.players.forEach((p) => tp.append(h('tr', {}, h('td', {}, (p.online ? '🟢 ' : '⚪ ') + p.name + (p.isAdmin ? ' (admin)' : '')),
    h('td', { class: 'mut' }, p.gameId ? (S.games.find((g) => g.id === p.gameId) || {}).name || '' : '—'),
    h('td', {}, !p.isAdmin && h('button', { class: 'danger', onclick: () => confirm(`Rimuovere ${p.name}?`) && send({ type: 'adminKick', id: p.id }) }, 'Rimuovi')))));
  b.append(tp, h('h3', {}, 'Partite'));
  if (!S.games.length) b.append(h('p', { class: 'mut' }, 'Nessuna partita.'));
  const tg = h('table');
  S.games.forEach((g) => tg.append(h('tr', {}, h('td', {}, g.name), h('td', { class: 'mut' }, `${g.status} · ${g.players.length} giocatori`),
    h('td', {}, h('button', { class: 'danger', onclick: () => confirm(`Annullare "${g.name}"?`) && send({ type: 'cancelGame', id: g.id }) }, 'Annulla')))));
  b.append(tg, h('h3', {}, 'Azioni globali'),
    h('div', { class: 'btns' }, h('button', { class: 'danger', onclick: () => confirm('RESET TOTALE: elimina tutte le partite e tutti i giocatori (tranne te). Continuare?') && send({ type: 'adminReset' }) }, '⚠ Reset totale')),
    h('h3', {}, 'Cambia password admin'),
    h('div', { class: 'row' }, h('input', { id: 'in-newpw', type: 'password', placeholder: 'Nuova password (min 6)', autocomplete: 'new-password' }),
      h('button', { onclick: () => { send({ type: 'adminPassword', password: $('#in-newpw').value }); $('#in-newpw').value = ''; } }, 'Salva')));
}

// ---------- avvio ----------
fetch('/map.json').then((r) => r.json()).then((m) => {
  MAP = m; MAP.shapesTx = m.tx; MAP.shapesTy = m.ty; m.edges.forEach(([a, b]) => { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); });
  initZoom(); buildMap(); if (S && S.game && S.game.status !== 'lobby') renderGame(S.game);
});
connect();
