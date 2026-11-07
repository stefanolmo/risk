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
function buildMap() {
  const svg = clear($('#map')), T = Object.fromEntries(MAP.territories.map((t) => [t.id, t]));
  for (const c of MAP.continents) for (const id of c.terrs || MAP.territories.filter((t) => t.continent === c.id).map((t) => t.id))
    svg.append(sv('circle', { class: 'halo', cx: T[id].x, cy: T[id].y, r: 62, fill: c.color }));
  for (const [a, b] of MAP.edges) {
    const A = T[a], B = T[b];
    if ((a === 'ala' && b === 'kam') || (a === 'kam' && b === 'ala')) {
      svg.append(sv('line', { class: 'edge wrap', x1: T.ala.x, y1: T.ala.y, x2: 0, y2: T.ala.y }), sv('line', { class: 'edge wrap', x1: T.kam.x, y1: T.kam.y, x2: 1000, y2: T.kam.y }));
    } else svg.append(sv('line', { class: 'edge', x1: A.x, y1: A.y, x2: B.x, y2: B.y }));
  }
  for (const t of MAP.territories) {
    const c = sv('circle', { r: 22, cx: 0, cy: 0 }), n = sv('text', { class: 'n' }), l = sv('text', { class: 'l', y: 36 }, t.name);
    const g = sv('g', { class: 'node', transform: `translate(${t.x},${t.y})` }, c, n, l, sv('title', {}, t.name));
    g.onclick = () => onTerr(t.id);
    svg.append(g); nodes[t.id] = { g, c, n };
  }
  mapBuilt = true;
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
  for (const id in nodes) {
    const t = g.terr[id], nd = nodes[id];
    nd.c.setAttribute('fill', t.owner ? col[t.owner] : '#667');
    nd.n.textContent = t.armies;
    nd.g.classList.toggle('sel', sel.from === id);
    nd.g.classList.toggle('tgt', sel.to === id || tg.has(id));
    nd.g.classList.toggle('dim', mine && g.phase === 'attack' && sel.from && sel.from !== id && !tg.has(id) && t.owner !== S.me.id);
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
      h('div', { class: 'dice' }, b.att.map((d) => h('span', { class: 'a' }, d)), ' vs ', b.def.map((d) => h('span', { class: 'd' }, d))),
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
  MAP = m; m.edges.forEach(([a, b]) => { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); });
  buildMap(); if (S && S.game && S.game.status !== 'lobby') renderGame(S.game);
});
connect();
