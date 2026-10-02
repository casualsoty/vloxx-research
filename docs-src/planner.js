/* Vloxx CM raid planner — self-contained, no dependencies.
   World coordinates = arcdps game units (x right, y up). Map/marker-tool coords = world × 0.0254.
   window.ARENA (from data/arena.json) provides centre, platform radius, spawn points, Cosmic ring, player heatmap. */
(function () {
  'use strict';
  const A = window.ARENA || { centre: { x: 12221.6, y: 15327.4 }, platformRadius: 2470, spawns: {}, cosmicPoints: [] };
  const C = A.centre, R_PLAT = A.platformRadius || 2470, MAPK = 0.0254;
  const root = document.getElementById('planner-root'); if (!root) return;
  const NS = 'http://www.w3.org/2000/svg';
  const LS_KEY = 'vloxx-planner-v1';
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = o => JSON.parse(JSON.stringify(o));
  const fmt = (v, d = 0) => (+v).toFixed(d);

  // ---------- catalogues ----------
  const PROFS = { '': ['—', '#9aa1ab'], Guardian: ['Gu', '#72C1D9'], Revenant: ['Re', '#D16E5A'], Warrior: ['Wa', '#FFD166'], Engineer: ['En', '#D09C59'], Ranger: ['Ra', '#8CDC82'], Thief: ['Th', '#C08F95'], Elementalist: ['El', '#F68A87'], Mesmer: ['Me', '#B679D5'], Necromancer: ['Ne', '#52A76F'] };
  const ROLES = ['', 'Tank', 'Healer', 'Quickness', 'Alacrity', 'DPS', 'Kiter', 'Pusher', 'CC'];
  const MARKERS = { arrow: ['Arrow', '#5ac24a', 'M0,-11 L9,1 L3,1 L3,11 L-3,11 L-3,1 L-9,1 Z'], circle: ['Circle', '#9b59d0', null], heart: ['Heart', '#e0464f', 'M0,10 C-14,0 -10,-12 0,-5 C10,-12 14,0 0,10 Z'], square: ['Square', '#3c7ee0', 'M-9,-9 H9 V9 H-9 Z'], star: ['Star', '#33c3c9', 'M0,-11 L3,-3 L11,-3 L5,2 L7,10 L0,5 L-7,10 L-5,2 L-11,-3 L-3,-3 Z'], spiral: ['Spiral', '#e57bc7', 'M0,0 m-1,0 a1,1 0 1,1 2,0 a3,3 0 1,1 -6,0 a5,5 0 1,1 10,0 a7,7 0 1,1 -14,0'], triangle: ['Triangle', '#f0c419', 'M0,-11 L10,8 L-10,8 Z'], x: ['X', '#ee8a35', 'M-8,-8 L8,8 M8,-8 L-8,8'] };
  const UNITS = { vloxx: ['Vloxx', '#d13b3b', 150, 'V'], staff: ['Aspect of the Staff', '#c98a2e', 90, 'St'], spear: ['Aspect of the Spear', '#3fa7c9', 90, 'Sp'], sword: ['Aspect of the Sword', '#b9b9c9', 90, 'Sw'], piercer: ['Cosmic Piercer', '#8f6fe0', 60, 'Pi'], bulwark: ['Cosmic Bulwark', '#5f8fe0', 70, 'Bu'], sunderer: ['Cosmic Sunderer', '#e06f9f', 70, 'Su'], orb: ['Ascension Orb', '#f3e37a', 16, 'o'], npc: ['Custom NPC', '#aaaaaa', 60, '?'] };
  const AOE = [ // [label, radius, color]  — sizes from Elite Insights (FINDINGS §5c)
    ['3-people green', 240, '#2fa84f'], ['2-people green (shackle)', 150, '#2fa84f'], ['Probability Distribution spread', 280, '#f0a040'], ['PD / Cosmic Charge puddle', 280, '#2f55c0'],
    ['Surrounding Curse', 200, '#f0a040'], ['Raging Storm', 150, '#f0a040'], ['Annihilating Orb', 240, '#e0464f'], ['Slice Through Reality', 220, '#f0a040'], ['Visions of Eternity', 560, '#f0a040'], ['Custom', 300, '#ffffff']];
  const CONES = [['Excision Extremis (Sword) 180°', 400, 180], ['Spear cone 135°', 1000, 135], ['Custom 90°', 600, 90]];
  // Worldpiercer measured from raw logs (scripts/worldpiercer.js → data/worldpiercer_summary.json, embedded as window.MECH)
  const WPM = (window.MECH && window.MECH.worldpiercer) || {};
  const WP = { n: +Object.keys(WPM.perCast || { 6: 1 })[0] || 6, gap: (WPM.gapDeg || [60])[0], width: WPM.width || 220, edge: WPM.endFromCentre || 2584 };
  const BEAMS = [[`Worldpiercer (Vloxx): ${WP.n} spokes ${WP.gap}° apart, ${WP.width} wide, to the arena edge`, WP.width, WP.n], [`Single Worldpiercer spoke ${WP.width} wide`, WP.width], ['Bulwark arrow 100 wide (EI)', 100], ['Staff sweep 1200 wide (EI)', 1200], ['Custom 200 wide', 200]];
  // end of a ray from p at angle a (rad) on the circle where Worldpiercer projectiles vanish
  function edgePoint(p, a) { const dx = Math.cos(a), dy = Math.sin(a), fx = p.x - C.x, fy = p.y - C.y; const bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - WP.edge * WP.edge; const t = -bq + Math.sqrt(Math.max(0, bq * bq - cq)); return { x: Math.round(p.x + dx * t), y: Math.round(p.y + dy * t) }; }
  const TOOLS = [['select', '↖', 'V', 'Select / move'], ['pan', '✋', 'H', 'Pan (or hold Space / middle mouse)'], ['player', '●', 'P', 'Place player'], ['marker', '◆', 'M', 'Squad marker'], ['unit', '☗', 'U', 'Boss / add'], ['circle', '◯', 'C', 'AoE circle (click = preset size, drag = custom; click a token to attach)'], ['cone', '◔', 'K', 'Cone'], ['beam', '▭', 'B', 'Beam / line attack'], ['line', '╱', 'L', 'Line'], ['arrow', '➜', 'A', 'Arrow'], ['text', 'T', 'T', 'Text'], ['pen', '✎', 'D', 'Freehand'], ['ruler', '📏', 'R', 'Measure distance'], ['eraser', '⌫', 'E', 'Erase']];

  // ---------- state ----------
  const S = { plan: null, step: 0, tool: 'select', sel: new Set(), view: { cx: C.x, cy: C.y, s: 6 }, undo: [], redo: [], drag: null, clip: null,
    toolOpt: { player: 0, marker: 'arrow', unit: 'vloxx', aoe: 0, cone: 0, beam: 0, color: '#ffd166' }, side: 'steps', playing: false, spaceDown: false };
  function defaultPlayers() { return Array.from({ length: 10 }, (_, i) => ({ name: 'Player ' + (i + 1), prof: '', role: '', sub: i < 5 ? 1 : 2 })); }
  function blankPlan() { return { format: 'vloxx-raid-plan', version: 1, title: 'Vloxx CM plan', notes: '', created: new Date().toISOString(), players: defaultPlayers(),
    layers: { platform: true, heat: true, grid: false, rings: true, spawns: true, cosmic: true, entrance: true, labels: true, compass: true }, snap: 0,
    steps: [{ id: uid(), name: 'Step 1', time: '', note: '', objects: [{ id: uid(), type: 'unit', u: 'vloxx', x: C.x, y: C.y }] }] }; }
  const step = () => S.plan.steps[S.step];
  const objs = () => step().objects;
  const byId = id => objs().find(o => o.id === id);

  // ---------- history & persistence ----------
  function snapshot() { return JSON.stringify(S.plan); }
  function commit(prev) { S.undo.push(prev); if (S.undo.length > 200) S.undo.shift(); S.redo = []; save(); updateTop(); }
  function change(fn) { const prev = snapshot(); fn(); commit(prev); render(); }
  function undo() { if (!S.undo.length) return; S.redo.push(snapshot()); S.plan = JSON.parse(S.undo.pop()); fixStep(); S.sel.clear(); save(); renderAll(); }
  function redo() { if (!S.redo.length) return; S.undo.push(snapshot()); S.plan = JSON.parse(S.redo.pop()); fixStep(); S.sel.clear(); save(); renderAll(); }
  function fixStep() { S.step = Math.max(0, Math.min(S.step, S.plan.steps.length - 1)); }
  let saveT = 0; function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify({ plan: S.plan, step: S.step })); } catch (e) { } }, 300); }
  function validPlan(p) { return p && p.format === 'vloxx-raid-plan' && Array.isArray(p.steps) && p.steps.length && Array.isArray(p.players); }
  function normalise(p) { const b = blankPlan(); p.layers = Object.assign(b.layers, p.layers || {}); while (p.players.length < 10) p.players.push(defaultPlayers()[p.players.length]); p.steps.forEach(s => { s.id = s.id || uid(); s.objects = (s.objects || []).map(o => (o.id = o.id || uid(), o)); }); return p; }

  // ---------- coordinates ----------
  let svg, gBg, gObj, gUi, stageEl, readout, stepName;
  function viewBox() { const r = stageEl.getBoundingClientRect(); const w = r.width * S.view.s, h = r.height * S.view.s; return [S.view.cx - w / 2, -S.view.cy - h / 2, w, h]; }
  function toWorld(ev) { const r = svg.getBoundingClientRect(); const vb = viewBox(); return { x: vb[0] + (ev.clientX - r.left) * S.view.s, y: -(vb[1] + (ev.clientY - r.top) * S.view.s) }; }
  const px = n => n * S.view.s; // screen px -> world units
  function snapP(p) { const g = S.plan.snap; return g ? { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g } : p; }
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const Y = y => -y;

  // ---------- heatmap image ----------
  let heatURL = null;
  function buildHeat() {
    if (!A.heat || !A.heat.b64) return; const n = A.heat.size, raw = atob(A.heat.b64); const cv = document.createElement('canvas'); cv.width = cv.height = n; const cx = cv.getContext('2d'); const img = cx.createImageData(n, n);
    for (let i = 0; i < n * n; i++) { const v = raw.charCodeAt(i) / 255; const o = i * 4; if (!v) { img.data[o + 3] = 0; continue; } img.data[o] = 255 * Math.min(1, 0.2 + 1.3 * v); img.data[o + 1] = 255 * Math.min(1, Math.max(0, 1.6 * v - 0.25)); img.data[o + 2] = 255 * Math.max(0, 0.5 - v) * 0.6; img.data[o + 3] = 40 + 170 * v; }
    cx.putImageData(img, 0, 0); heatURL = cv.toDataURL();
  }

  // ---------- rendering ----------
  function renderBg() {
    gBg.innerHTML = ''; const L = S.plan.layers; const lw = px(1.2);
    el('rect', { x: C.x - 6000, y: Y(C.y + 6000), width: 12000, height: 12000, fill: '#0f1215' }, gBg);
    if (L.platform) { el('circle', { cx: C.x, cy: Y(C.y), r: R_PLAT, fill: '#3a3d42', stroke: '#6d7178', 'stroke-width': px(3) }, gBg);
      for (let k = 1; k <= 12; k++) { const a = k * Math.PI / 6; el('path', { d: `M${C.x},${Y(C.y)} Q${C.x + R_PLAT * 0.55 * Math.cos(a + 0.9)},${Y(C.y + R_PLAT * 0.55 * Math.sin(a + 0.9))} ${C.x + R_PLAT * Math.cos(a)},${Y(C.y + R_PLAT * Math.sin(a))}`, fill: 'none', stroke: '#4a4e55', 'stroke-width': px(1) }, gBg); } }
    if (L.heat && heatURL) { const h = A.heat.half; el('image', { href: heatURL, x: C.x - h, y: Y(C.y + h), width: 2 * h, height: 2 * h, preserveAspectRatio: 'none', style: 'image-rendering:auto', opacity: 0.45 }, gBg); }
    if (L.grid) { const g = 250; for (let v = -3000; v <= 3000; v += g) { el('line', { x1: C.x + v, y1: Y(C.y - 3000), x2: C.x + v, y2: Y(C.y + 3000), stroke: v ? '#ffffff14' : '#ffffff30', 'stroke-width': lw }, gBg); el('line', { x1: C.x - 3000, y1: Y(C.y + v), x2: C.x + 3000, y2: Y(C.y + v), stroke: v ? '#ffffff14' : '#ffffff30', 'stroke-width': lw }, gBg); } }
    if (L.rings) for (const r of [500, 1000, 1500, 2000]) { el('circle', { cx: C.x, cy: Y(C.y), r, fill: 'none', stroke: '#ffffff22', 'stroke-dasharray': `${px(4)} ${px(6)}`, 'stroke-width': lw }, gBg); if (L.labels) txt(gBg, C.x + r * 0.707, C.y + r * 0.707, r + '', 10, '#ffffff55'); }
    if (L.cosmic) for (const p of A.cosmicPoints || []) { el('circle', { cx: p.x, cy: Y(p.y), r: px(7), fill: 'none', stroke: '#a98bff', 'stroke-width': px(1.6) }, gBg); }
    if (L.spawns) for (const [k, p] of Object.entries(A.spawns || {})) { if (!/Aspect/.test(k)) continue; const u = k.split(' ').pop().toLowerCase(); const col = (UNITS[u] || UNITS.npc)[1];
      el('circle', { cx: p.x, cy: Y(p.y), r: 90, fill: col + '22', stroke: col, 'stroke-dasharray': `${px(3)} ${px(3)}`, 'stroke-width': px(1.5) }, gBg); if (L.labels) txt(gBg, p.x, p.y - 140, k.replace('Aspect of the ', '') + ' spawn', 11, col); }
    if (L.entrance && A.entrance) { el('path', { d: `M${A.entrance.x - px(10)},${Y(A.entrance.y)} h${px(20)} M${A.entrance.x},${Y(A.entrance.y) - px(10)} v${px(20)}`, stroke: '#9fe7c6', 'stroke-width': px(2) }, gBg); if (L.labels) txt(gBg, A.entrance.x, A.entrance.y + px(18), 'entrance', 11, '#9fe7c6'); }
    el('circle', { cx: C.x, cy: Y(C.y), r: px(3), fill: '#ffffff88' }, gBg);
    if (L.compass) { const vb = viewBox(); const sx = vb[0] + px(18), sy = vb[1] + px(30); const len = niceLen(px(110)); el('line', { x1: sx, y1: sy, x2: sx + len, y2: sy, stroke: '#dfe4ea', 'stroke-width': px(2) }, gBg); txt(gBg, sx + len / 2, -(sy + px(12)), len + ' units', 10, '#dfe4ea'); }
  }
  function niceLen(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }
  function txt(g, x, y, s, size, fill, extra) { const t = el('text', Object.assign({ x, y: Y(y), 'font-size': px(size), fill, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': 'system-ui,sans-serif', 'pointer-events': 'none' }, extra || {}), g); t.textContent = s; return t; }
  function anchor(o) { if (o.attach) { const a = byId(o.attach); if (a) return { x: a.x, y: a.y }; } return { x: o.x, y: o.y }; }
  const ORDER = { path: 0, beam: 1, cone: 1, circle: 2, line: 3, arrow: 3, text: 6, unit: 4, marker: 5, player: 5 };
  function renderObjects(list, g, opts = {}) {
    g.innerHTML = ''; const L = S.plan.layers;
    const sorted = list.slice().sort((a, b) => (ORDER[a.type] || 0) - (ORDER[b.type] || 0));
    for (const o of sorted) {
      if (o.hidden) continue; const sel = !opts.static && S.sel.has(o.id); const grp = el('g', { 'data-id': o.id, class: 'pl-o', cursor: opts.static ? null : 'move' }, g);
      const col = o.color || '#ffd166'; const hl = sel ? '#ffffff' : null;
      if (o.type === 'circle') { const p = anchor(o); el('circle', { cx: p.x, cy: Y(p.y), r: o.r, fill: o.fill === false ? 'none' : col + '33', stroke: hl || col, 'stroke-width': px(sel ? 2.5 : 1.8), 'stroke-dasharray': o.dash ? `${px(6)} ${px(5)}` : null }, grp); if (o.inner) el('circle', { cx: p.x, cy: Y(p.y), r: o.inner, fill: 'none', stroke: col, 'stroke-width': px(1), 'stroke-dasharray': `${px(3)} ${px(3)}` }, grp); if (o.label && L.labels) txt(grp, p.x, p.y + o.r + px(10), o.label, 11, col); }
      else if (o.type === 'cone') { const a0 = (o.angle - o.spread / 2) * Math.PI / 180, a1 = (o.angle + o.spread / 2) * Math.PI / 180; const x1 = o.x + o.r * Math.cos(a0), y1 = o.y + o.r * Math.sin(a0), x2 = o.x + o.r * Math.cos(a1), y2 = o.y + o.r * Math.sin(a1);
        el('path', { d: `M${o.x},${Y(o.y)} L${x1},${Y(y1)} A${o.r},${o.r} 0 ${o.spread > 180 ? 1 : 0} 0 ${x2},${Y(y2)} Z`, fill: col + '33', stroke: hl || col, 'stroke-width': px(sel ? 2.5 : 1.8) }, grp); if (o.label && L.labels) txt(grp, o.x + o.r * 0.6 * Math.cos(o.angle * Math.PI / 180), o.y + o.r * 0.6 * Math.sin(o.angle * Math.PI / 180), o.label, 11, col); }
      else if (o.type === 'beam') { const dx = o.x2 - o.x1, dy = o.y2 - o.y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * o.w / 2, ny = dx / l * o.w / 2;
        el('path', { d: `M${o.x1 + nx},${Y(o.y1 + ny)} L${o.x2 + nx},${Y(o.y2 + ny)} L${o.x2 - nx},${Y(o.y2 - ny)} L${o.x1 - nx},${Y(o.y1 - ny)} Z`, fill: col + '33', stroke: hl || col, 'stroke-width': px(sel ? 2.5 : 1.8) }, grp); if (o.label && L.labels) txt(grp, (o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, o.label, 11, col); }
      else if (o.type === 'line' || o.type === 'arrow') { const w = px(o.width || 3); el('line', { x1: o.x1, y1: Y(o.y1), x2: o.x2, y2: Y(o.y2), stroke: hl || col, 'stroke-width': w * (sel ? 1.4 : 1), 'stroke-linecap': 'round', 'stroke-dasharray': o.dash ? `${w * 3} ${w * 2}` : null }, grp);
        el('line', { x1: o.x1, y1: Y(o.y1), x2: o.x2, y2: Y(o.y2), stroke: 'transparent', 'stroke-width': px(14) }, grp);
        if (o.type === 'arrow') { const ang = Math.atan2(Y(o.y2) - Y(o.y1), o.x2 - o.x1), h = px(14) + w; const p = (d) => `${o.x2 - h * Math.cos(ang + d)},${Y(o.y2) - h * Math.sin(ang + d)}`; el('path', { d: `M${p(0.45)} L${o.x2},${Y(o.y2)} L${p(-0.45)}`, fill: 'none', stroke: hl || col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grp); }
        if (o.label && L.labels) txt(grp, (o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2 + px(12), o.label, 11, col); }
      else if (o.type === 'path') { el('path', { d: 'M' + o.pts.map(p => p[0] + ',' + Y(p[1])).join(' L'), fill: 'none', stroke: hl || col, 'stroke-width': px(o.width || 3), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grp); el('path', { d: 'M' + o.pts.map(p => p[0] + ',' + Y(p[1])).join(' L'), fill: 'none', stroke: 'transparent', 'stroke-width': px(14) }, grp); }
      else if (o.type === 'text') { const p = anchor(o); const t = txt(grp, p.x + (o.attach ? 0 : 0), p.y + (o.attach ? px(26) : 0), o.text || '', o.size || 14, col, { 'pointer-events': 'all', 'font-weight': 600, 'paint-order': 'stroke', stroke: '#000a', 'stroke-width': px(3) }); if (sel) t.setAttribute('text-decoration', 'underline'); }
      else if (o.type === 'unit') { const u = UNITS[o.u] || UNITS.npc; const r = Math.max(u[2], px(o.u === 'orb' ? 6 : 12)); el('circle', { cx: o.x, cy: Y(o.y), r, fill: u[1] + 'cc', stroke: hl || '#000', 'stroke-width': px(sel ? 3 : 1.5) }, grp);
        txt(grp, o.x, o.y, o.u === 'orb' ? '' : u[3], o.u === 'vloxx' ? 15 : 11, '#111', { 'font-weight': 700 }); if (L.labels && o.u !== 'orb') txt(grp, o.x, o.y - r - px(10), o.label || u[0], 11, u[1]); }
      else if (o.type === 'marker') { const m = MARKERS[o.m] || MARKERS.arrow; const k = S.view.s; const t = el('g', { transform: `translate(${o.x},${Y(o.y)}) scale(${k * 1.25})` }, grp);
        el('rect', { x: -14, y: -14, width: 28, height: 28, rx: 6, fill: '#0b0d10dd', stroke: hl || m[1], 'stroke-width': sel ? 3 : 2, transform: 'rotate(45)' }, t);
        if (m[2]) el('path', { d: m[2], fill: o.m === 'x' || o.m === 'spiral' ? 'none' : m[1], stroke: m[1], 'stroke-width': o.m === 'x' || o.m === 'spiral' ? 3 : 1, 'stroke-linecap': 'round' }, t); else el('circle', { r: 8, fill: m[1] }, t); }
      else if (o.type === 'player') { const pl = S.plan.players[o.pid] || {}; const pr = PROFS[pl.prof || ''] || PROFS['']; const r = px(13);
        el('circle', { cx: o.x, cy: Y(o.y), r: r + px(2.5), fill: pl.sub === 2 ? '#e9e9e9' : '#1b1e22', opacity: 0.9 }, grp);
        el('circle', { cx: o.x, cy: Y(o.y), r, fill: pr[1], stroke: hl || '#000', 'stroke-width': px(sel ? 3 : 1.2) }, grp);
        txt(grp, o.x, o.y, String(o.pid + 1), 11, '#111', { 'font-weight': 700 });
        if (L.labels) txt(grp, o.x, o.y - r - px(10), (pl.name || '') + (pl.role ? ' · ' + pl.role : ''), 10.5, '#e8eaed', { 'paint-order': 'stroke', stroke: '#000c', 'stroke-width': px(3) }); }
    }
  }
  function renderUi() {
    gUi.innerHTML = '';
    if (S.sel.size === 1) { const o = byId([...S.sel][0]); if (o) handlesFor(o).forEach(h => el('circle', { cx: h.x, cy: Y(h.y), r: px(6), fill: '#fff', stroke: '#2f6f5e', 'stroke-width': px(2), 'data-handle': h.k, cursor: 'crosshair' }, gUi)); }
    const d = S.drag; if (!d) return;
    if (d.kind === 'marquee') { const x = Math.min(d.a.x, d.b.x), y = Math.max(d.a.y, d.b.y); el('rect', { x, y: Y(y), width: Math.abs(d.b.x - d.a.x), height: Math.abs(d.b.y - d.a.y), fill: '#6cc3a822', stroke: '#6cc3a8', 'stroke-width': px(1), 'stroke-dasharray': `${px(4)} ${px(3)}` }, gUi); }
    if (d.kind === 'ruler') { el('line', { x1: d.a.x, y1: Y(d.a.y), x2: d.b.x, y2: Y(d.b.y), stroke: '#fff', 'stroke-width': px(2), 'stroke-dasharray': `${px(6)} ${px(4)}` }, gUi); txt(gUi, (d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2 + px(14), fmt(Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y)) + ' units', 13, '#fff', { 'paint-order': 'stroke', stroke: '#000', 'stroke-width': px(3) }); }
    if (d.kind === 'create' && d.preview) renderObjects([d.preview], el('g', {}, gUi), { static: true });
  }
  function handlesFor(o) {
    if (o.type === 'circle' && !o.attach) return [{ k: 'r', x: o.x + o.r, y: o.y }];
    if (o.type === 'circle') { const p = anchor(o); return [{ k: 'r', x: p.x + o.r, y: p.y }]; }
    if (o.type === 'cone') return [{ k: 'tip', x: o.x + o.r * Math.cos(o.angle * Math.PI / 180), y: o.y + o.r * Math.sin(o.angle * Math.PI / 180) }];
    if (o.type === 'line' || o.type === 'arrow' || o.type === 'beam') return [{ k: 'p1', x: o.x1, y: o.y1 }, { k: 'p2', x: o.x2, y: o.y2 }];
    return [];
  }
  function render() { if (!svg) return; svg.setAttribute('viewBox', viewBox().join(' ')); renderBg(); renderObjects(objs(), gObj); renderUi(); stepName.textContent = `${S.step + 1}/${S.plan.steps.length} · ${step().name}${step().time ? ' · ' + step().time : ''}`; }
  function renderAll() { render(); renderSide(); updateTop(); }

  // ---------- object helpers ----------
  function moveObj(o, dx, dy) { if (o.attach && (o.type === 'circle' || o.type === 'text')) return; if ('x' in o) { o.x += dx; o.y += dy; } if ('x1' in o) { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; } if (o.pts) o.pts.forEach(p => { p[0] += dx; p[1] += dy; }); }
  function bbox(o) { if (o.type === 'circle') { const p = anchor(o); return [p.x - o.r, p.y - o.r, p.x + o.r, p.y + o.r]; } if ('x1' in o) return [Math.min(o.x1, o.x2), Math.min(o.y1, o.y2), Math.max(o.x1, o.x2), Math.max(o.y1, o.y2)]; if (o.pts) { const xs = o.pts.map(p => p[0]), ys = o.pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; } const p = anchor(o); return [p.x, p.y, p.x, p.y]; }
  function addObj(o) { change(() => { objs().push(o); S.sel = new Set([o.id]); }); renderSide(); }
  function deleteSel() { if (!S.sel.size) return; change(() => { const ids = S.sel; step().objects = objs().filter(o => !ids.has(o.id) && !ids.has(o.attach)); S.sel = new Set(); }); renderSide(); }
  function placeMarker(m, p) { change(() => { const ex = objs().find(o => o.type === 'marker' && o.m === m); if (ex) { ex.x = p.x; ex.y = p.y; S.sel = new Set([ex.id]); } else { const o = { id: uid(), type: 'marker', m, x: p.x, y: p.y }; objs().push(o); S.sel = new Set([o.id]); } }); renderSide(); }
  function placePlayer(pid, p) { change(() => { const ex = objs().find(o => o.type === 'player' && o.pid === pid); if (ex) { ex.x = p.x; ex.y = p.y; S.sel = new Set([ex.id]); } else { const o = { id: 'p' + pid, type: 'player', pid, x: p.x, y: p.y }; if (byId(o.id)) o.id = uid(); objs().push(o); S.sel = new Set([o.id]); } const nxt = [...Array(10).keys()].find(i => !objs().some(o => o.type === 'player' && o.pid === i)); if (nxt != null) S.toolOpt.player = nxt; }); renderSide(); }
  function hitObj(ev) { const g = ev.target.closest && ev.target.closest('[data-id]'); return g ? g.getAttribute('data-id') : null; }

  // ---------- pointer interaction ----------
  function onDown(ev) {
    if (S.playing) return; svg.setPointerCapture(ev.pointerId); const p = toWorld(ev); const sp = snapP(p);
    const handle = ev.target.getAttribute && ev.target.getAttribute('data-handle');
    if (ev.button === 1 || S.tool === 'pan' || S.spaceDown) { S.drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, cx: S.view.cx, cy: S.view.cy }; return; }
    if (handle) { const o = byId([...S.sel][0]); S.drag = { kind: 'handle', k: handle, o, prev: snapshot() }; return; }
    const id = hitObj(ev); const t = S.tool;
    if (t === 'eraser') { if (id) { S.sel = new Set([id]); deleteSel(); } S.drag = { kind: 'erase' }; return; }
    if (t === 'select') {
      if (id) { if (ev.shiftKey) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); } else if (!S.sel.has(id)) S.sel = new Set([id]);
        if (ev.altKey) { const prev = snapshot(); const map = {}; const copies = [...S.sel].map(i => byId(i)).filter(Boolean).filter(o => o.type !== 'player' && o.type !== 'marker').map(o => { const c = clone(o); c.id = uid(); map[o.id] = c.id; return c; }); copies.forEach(c => objs().push(c)); if (copies.length) S.sel = new Set(copies.map(c => c.id)); S.drag = { kind: 'move', last: p, prev, moved: true }; render(); renderSide(); return; }
        S.drag = { kind: 'move', last: sp, prev: snapshot(), moved: false }; render(); renderSide(); return; }
      if (!ev.shiftKey) S.sel = new Set(); S.drag = { kind: 'marquee', a: p, b: p }; render(); renderSide(); return; }
    if (t === 'player') { placePlayer(S.toolOpt.player, sp); return; }
    if (t === 'marker') { placeMarker(S.toolOpt.marker, sp); return; }
    if (t === 'unit') { addObj({ id: uid(), type: 'unit', u: S.toolOpt.unit, x: sp.x, y: sp.y }); return; }
    if (t === 'text') { const s = prompt('Text:', ''); if (s) { const o = { id: uid(), type: 'text', text: s, x: sp.x, y: sp.y, size: 14, color: S.toolOpt.color }; const tgt = id && byId(id); if (tgt && (tgt.type === 'player' || tgt.type === 'unit')) { o.attach = tgt.id; } addObj(o); } return; }
    if (t === 'ruler') { S.drag = { kind: 'ruler', a: p, b: p }; return; }
    const aoe = AOE[S.toolOpt.aoe];
    if (t === 'circle') { const tgt = id && byId(id); const base = { id: uid(), type: 'circle', r: aoe[1], color: aoe[2], label: aoe[0] === 'Custom' ? '' : aoe[0] };
      if (tgt && (tgt.type === 'player' || tgt.type === 'unit' || tgt.type === 'marker')) { addObj(Object.assign(base, { attach: tgt.id, x: tgt.x, y: tgt.y })); return; }
      S.drag = { kind: 'create', a: sp, preview: Object.assign(base, { x: sp.x, y: sp.y }), t }; return; }
    if (t === 'cone') { const c = CONES[S.toolOpt.cone]; S.drag = { kind: 'create', a: sp, t, preview: { id: uid(), type: 'cone', x: sp.x, y: sp.y, r: c[1], spread: c[2], angle: 0, color: '#f0a040', label: c[0].replace(/ \d+°$/, '') } }; return; }
    if (t === 'beam') { const b = BEAMS[S.toolOpt.beam]; S.drag = { kind: 'create', a: sp, t, preview: { id: uid(), type: 'beam', x1: sp.x, y1: sp.y, x2: sp.x, y2: sp.y, w: b[1], color: '#f0a040', label: b[2] ? 'Worldpiercer' : b[0].replace(/ \d+ wide.*$/, ''), star: b[2] || 0 } }; return; }
    if (t === 'line' || t === 'arrow') { S.drag = { kind: 'create', a: sp, t, preview: { id: uid(), type: t, x1: sp.x, y1: sp.y, x2: sp.x, y2: sp.y, color: S.toolOpt.color, width: 3 } }; return; }
    if (t === 'pen') { S.drag = { kind: 'create', a: p, t, preview: { id: uid(), type: 'path', pts: [[p.x, p.y]], color: S.toolOpt.color, width: 3 } }; return; }
  }
  function onMove(ev) {
    const p = toWorld(ev); updateReadout(p, ev); const d = S.drag; if (!d) return; const sp = snapP(p);
    if (d.kind === 'pan') { S.view.cx = d.cx - (ev.clientX - d.sx) * S.view.s; S.view.cy = d.cy + (ev.clientY - d.sy) * S.view.s; render(); return; }
    if (d.kind === 'erase') { const id = hitObj(ev); if (id) { S.sel = new Set([id]); deleteSel(); } return; }
    if (d.kind === 'move') { const dx = sp.x - d.last.x, dy = sp.y - d.last.y; if (!dx && !dy) return; [...S.sel].forEach(i => { const o = byId(i); if (o) moveObj(o, dx, dy); }); d.last = sp; d.moved = true; render(); return; }
    if (d.kind === 'handle') { const o = d.o; if (d.k === 'r') { const a = anchor(o); o.r = Math.max(10, Math.round(Math.hypot(sp.x - a.x, sp.y - a.y))); } else if (d.k === 'tip') { o.r = Math.max(10, Math.round(Math.hypot(sp.x - o.x, sp.y - o.y))); o.angle = Math.round(Math.atan2(sp.y - o.y, sp.x - o.x) * 180 / Math.PI); } else if (d.k === 'p1') { o.x1 = sp.x; o.y1 = sp.y; } else if (d.k === 'p2') { o.x2 = sp.x; o.y2 = sp.y; } render(); renderSide(); return; }
    if (d.kind === 'marquee' || d.kind === 'ruler') { d.b = p; render(); return; }
    if (d.kind === 'create') { const o = d.preview; if (o.type === 'circle') { const r = Math.round(Math.hypot(sp.x - d.a.x, sp.y - d.a.y)); if (r > px(8)) { o.r = r; o.dragged = true; } }
      else if (o.type === 'cone') { const r = Math.hypot(sp.x - o.x, sp.y - o.y); if (r > px(8)) { o.angle = Math.round(Math.atan2(sp.y - o.y, sp.x - o.x) * 180 / Math.PI); if (ev.shiftKey) o.r = Math.round(r); } }
      else if (o.type === 'path') { const l = o.pts[o.pts.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) > px(3)) o.pts.push([p.x, p.y]); }
      else { o.x2 = sp.x; o.y2 = sp.y; }
      render(); }
  }
  function onUp(ev) {
    const d = S.drag; S.drag = null; if (!d) return;
    if (d.kind === 'move') { if (d.moved) commit(d.prev); renderSide(); render(); return; }
    if (d.kind === 'handle') { commit(d.prev); render(); return; }
    if (d.kind === 'marquee') { const x0 = Math.min(d.a.x, d.b.x), x1 = Math.max(d.a.x, d.b.x), y0 = Math.min(d.a.y, d.b.y), y1 = Math.max(d.a.y, d.b.y);
      if (x1 - x0 > px(3) || y1 - y0 > px(3)) objs().forEach(o => { const b = bbox(o); if (b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1) S.sel.add(o.id); }); render(); renderSide(); return; }
    if (d.kind === 'create' && d.preview.star) { // Worldpiercer: N spokes from the start point to the arena edge; drag sets the first spoke's direction
      const o = d.preview, n = o.star, p = { x: o.x1, y: o.y1 }; const a0 = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) > px(6) ? Math.atan2(o.y2 - o.y1, o.x2 - o.x1) : 0;
      const beams = Array.from({ length: n }, (_, k) => { const e = edgePoint(p, a0 + k * 2 * Math.PI / n); return { id: uid(), type: 'beam', x1: p.x, y1: p.y, x2: e.x, y2: e.y, w: o.w, color: o.color, label: k ? '' : o.label }; });
      change(() => { beams.forEach(b => objs().push(b)); S.sel = new Set(beams.map(b => b.id)); }); renderSide(); return; }
    if (d.kind === 'create') { const o = d.preview; delete o.dragged;
      if ((o.type === 'line' || o.type === 'arrow' || o.type === 'beam') && Math.hypot(o.x2 - o.x1, o.y2 - o.y1) < px(6)) { render(); return; }
      if (o.type === 'path' && o.pts.length < 2) { render(); return; }
      addObj(o); return; }
    render();
  }
  function onWheel(ev) { ev.preventDefault(); const p = toWorld(ev); const k = Math.exp(ev.deltaY * 0.0012); zoomAt(p, k); }
  function zoomAt(p, k) { const s0 = S.view.s, s1 = Math.max(0.6, Math.min(40, s0 * k)); S.view.cx = p.x + (S.view.cx - p.x) * s1 / s0; S.view.cy = p.y + (S.view.cy - p.y) * s1 / s0; S.view.s = s1; render(); }
  function fit() { const r = stageEl.getBoundingClientRect(); S.view.cx = C.x; S.view.cy = C.y; S.view.s = (2 * R_PLAT * 1.08) / Math.max(200, Math.min(r.width, r.height)); render(); }
  function updateReadout(p, ev) {
    const id = ev && hitObj(ev); let hover = ''; if (id) { const o = byId(id); if (o) hover = o.type === 'player' ? (S.plan.players[o.pid] || {}).name : o.type === 'unit' ? (UNITS[o.u] || UNITS.npc)[0] : o.type === 'circle' ? `${o.label || 'circle'} r=${o.r}` : o.type === 'marker' ? MARKERS[o.m][0] + ' marker' : o.label || o.text || o.type; }
    readout.innerHTML = `world <b>${fmt(p.x, 1)}, ${fmt(p.y, 1)}</b><br>map&nbsp;&nbsp; <b>${fmt(p.x * MAPK, 3)}, ${fmt(p.y * MAPK, 3)}</b><br>from Vloxx centre ${fmt(Math.hypot(p.x - C.x, p.y - C.y))}${hover ? '<br>▸ ' + esc(hover) : ''}`;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- keyboard ----------
  function onKey(ev) {
    if (!root.classList.contains('on')) return; const tag = (ev.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = ev.key, mod = ev.ctrlKey || ev.metaKey;
    if (k === ' ') { S.spaceDown = true; ev.preventDefault(); return; }
    if (mod && k.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if (mod && k.toLowerCase() === 'y') { ev.preventDefault(); redo(); return; }
    if (mod && k.toLowerCase() === 'c') { S.clip = [...S.sel].map(byId).filter(Boolean).map(clone); toast(S.clip.length + ' copied'); return; }
    if (mod && k.toLowerCase() === 'v') { if (!S.clip || !S.clip.length) return; change(() => { const ids = []; S.clip.forEach(o => { if (o.type === 'player' || o.type === 'marker') { const ex = objs().find(x => x.type === o.type && (o.type === 'player' ? x.pid === o.pid : x.m === o.m)); if (ex) { ex.x = o.x; ex.y = o.y; ids.push(ex.id); return; } } const c = clone(o); c.id = o.type === 'player' && !byId('p' + o.pid) ? 'p' + o.pid : uid(); if (!(o.type === 'player' || o.type === 'marker')) moveObj(c, px(20), -px(20)); objs().push(c); ids.push(c.id); }); S.sel = new Set(ids); }); renderSide(); return; }
    if (mod && k.toLowerCase() === 'd') { ev.preventDefault(); S.clip = [...S.sel].map(byId).filter(Boolean).filter(o => o.type !== 'player' && o.type !== 'marker').map(clone); onKey({ key: 'v', ctrlKey: true, target: document.body }); return; }
    if (mod && k.toLowerCase() === 'a') { ev.preventDefault(); S.sel = new Set(objs().map(o => o.id)); render(); renderSide(); return; }
    if (mod) return;
    if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); deleteSel(); return; }
    if (k === 'Escape') { S.sel.clear(); S.drag = null; render(); renderSide(); return; }
    if (k.startsWith('Arrow') && S.sel.size) { ev.preventDefault(); const d = ev.shiftKey ? 100 : 10; const dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowUp' ? d : k === 'ArrowDown' ? -d : 0; change(() => [...S.sel].forEach(i => { const o = byId(i); if (o) moveObj(o, dx, dy); })); return; }
    if (k === '[' || k === 'PageUp') { goStep(S.step - 1); return; } if (k === ']' || k === 'PageDown') { goStep(S.step + 1); return; }
    if (k === 'f' || k === 'F') { fit(); return; } if (k === 'g' || k === 'G') { change(() => S.plan.layers.grid = !S.plan.layers.grid); renderSide(); return; }
    if (k === '?') { help(); return; } if (k === '+' || k === '=') { zoomAt({ x: S.view.cx, y: S.view.cy }, 0.8); return; } if (k === '-') { zoomAt({ x: S.view.cx, y: S.view.cy }, 1.25); return; }
    const t = TOOLS.find(t => t[2].toLowerCase() === k.toLowerCase()); if (t) setTool(t[0]);
    if (/^[0-9]$/.test(k) && S.tool === 'player') { S.toolOpt.player = (+k + 9) % 10; renderSide(); }
  }
  function onKeyUp(ev) { if (ev.key === ' ') S.spaceDown = false; }

  // ---------- steps ----------
  function goStep(i, animate) { if (i < 0 || i >= S.plan.steps.length || i === S.step) return; const from = clone(objs()); S.step = i; S.sel.clear(); save(); if (animate) tween(from, objs()); else render(); renderSide(); }
  function tween(from, to, dur = 900) { const fm = new Map(from.map(o => [o.id, o])); const t0 = performance.now(); const frame = now => { const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const mix = to.map(o => { const f = fm.get(o.id); if (!f) return o; const c = clone(o); for (const key of ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'r', 'angle']) if (typeof o[key] === 'number' && typeof f[key] === 'number') c[key] = f[key] + (o[key] - f[key]) * e; return c; });
      svg.setAttribute('viewBox', viewBox().join(' ')); renderBg(); renderObjects(mix, gObj, { static: true }); gUi.innerHTML = ''; stepName.textContent = `${S.step + 1}/${S.plan.steps.length} · ${step().name}${step().time ? ' · ' + step().time : ''}`;
      if (k < 1) requestAnimationFrame(frame); else render(); }; requestAnimationFrame(frame); }
  function play() { if (S.playing) { S.playing = false; updateTop(); return; } S.playing = true; updateTop(); if (S.step >= S.plan.steps.length - 1) { S.step = 0; render(); renderSide(); }
    const next = () => { if (!S.playing) return; if (S.step >= S.plan.steps.length - 1) { S.playing = false; updateTop(); return; } goStep(S.step + 1, true); setTimeout(next, 1900); }; setTimeout(next, 700); }
  function addStep(dup = true) { change(() => { const cur = step(); const s = { id: uid(), name: 'Step ' + (S.plan.steps.length + 1), time: '', note: '', objects: dup ? clone(cur.objects) : [] }; S.plan.steps.splice(S.step + 1, 0, s); S.step++; S.sel.clear(); }); renderSide(); }
  function delStep(i) { if (S.plan.steps.length < 2) { toast('A plan needs at least one step'); return; } if (!confirm('Delete step "' + S.plan.steps[i].name + '"?')) return; change(() => { S.plan.steps.splice(i, 1); fixStep(); S.sel.clear(); }); renderSide(); }
  function moveStep(i, d) { const j = i + d; if (j < 0 || j >= S.plan.steps.length) return; change(() => { const a = S.plan.steps; [a[i], a[j]] = [a[j], a[i]]; S.step = j; }); renderSide(); }

  // ---------- templates: shared ones from docs-src/plans/ (window.PLANS, built by scripts/build_plans.js) + personal ones saved in this browser ----------
  const REPO_TPL = (window.PLANS && window.PLANS.plans) || [];
  const TPL_KEY = 'vloxx-planner-templates';
  function myTemplates() { try { const a = JSON.parse(localStorage.getItem(TPL_KEY) || '[]'); return Array.isArray(a) ? a.filter(t => t && validPlan(t.plan)) : []; } catch (e) { return []; } }
  function setMyTemplates(a) { try { localStorage.setItem(TPL_KEY, JSON.stringify(a)); return true; } catch (e) { toast('Could not save in this browser: ' + e.message); return false; } }
  function findTemplate(id) { return id.startsWith('my:') ? myTemplates().find(t => 'my:' + t.id === id) : REPO_TPL.find(t => t.id === id); }
  function loadTemplate(id) { const t = findTemplate(id); if (!t) { toast('Template not found'); return; }
    if (!confirm('Load template "' + t.title + '"? It replaces the current plan (undo with Ctrl+Z; export first to keep a copy).')) return;
    loadPlan(clone(t.plan), 'template "' + t.title + '"'); }
  const slug = s => (s || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'plan';
  function saveAsTemplate() { const title = prompt('Template name:', S.plan.title || 'My plan'); if (!title) return; const description = prompt('Short description (optional):', '') || '';
    const a = myTemplates(); const id = slug(title); const i = a.findIndex(t => t.id === id); const t = { id, title, description, saved: new Date().toISOString(), plan: Object.assign(clone(S.plan), { title }) };
    if (i >= 0) { if (!confirm('Replace your existing template "' + a[i].title + '"?')) return; a[i] = t; } else a.push(t);
    if (setMyTemplates(a)) { toast('Saved to your templates'); S.side = 'templates'; renderSide(); } }
  function downloadTemplate(t) { const p = clone(t ? t.plan : S.plan); const title = t ? t.title : S.plan.title; const out = Object.assign({ title, description: (t && t.description) || '' }, p); delete out.template;
    download(slug(title) + '.json', new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); toast('Put the file in docs-src/plans/ and push — it becomes a shared template'); }
  function templatesPane() {
    const mine = myTemplates(); const built = window.PLANS && window.PLANS.built ? window.PLANS.built.slice(0, 16).replace('T', ' ') + ' UTC' : '';
    const row = (t, id, kind) => `<div class="pl-tpl"><div class="pl-tpl-t"><b>${esc(t.title)}</b>${t.description ? `<div class="pl-hint">${esc(t.description)}</div>` : ''}<div class="pl-hint">${t.plan.steps.length} step${t.plan.steps.length > 1 ? 's' : ''}${kind === 'repo' ? ' · <code>' + esc(t.file) + '</code>' : t.saved ? ' · saved ' + esc(t.saved.slice(0, 10)) : ''}</div></div>
      <div class="pl-row"><button class="pl-btn" data-tl="${esc(id)}">Load</button>${kind === 'repo' ? `<button class="pl-btn" data-tk="${esc(id)}" title="Copy a link that opens this template">Link</button>` : `<button class="pl-btn" data-td="${esc(id)}" title="Download as a file for docs-src/plans/">Download</button><button class="pl-btn" data-tx="${esc(id)}" title="Remove from this browser">✕</button>`}</div></div>`;
    return `<h5>Shared templates (${REPO_TPL.length})</h5>` + (REPO_TPL.map(t => row(t, t.id, 'repo')).join('') || `<p class="pl-hint">None yet. Any plan JSON placed in <code>docs-src/plans/</code> appears here after the next build${built ? ' (this page: ' + esc(built) + ')' : ''}.</p>`) +
      `<h5>My templates — this browser (${mine.length})</h5>` + (mine.map(t => row(t, 'my:' + t.id, 'mine')).join('') || '<p class="pl-hint">None yet.</p>') +
      `<h5>Add a template</h5><div class="pl-row"><button class="pl-btn" data-act="tplsave">Save current plan as template</button><button class="pl-btn" data-act="tpldl">Download for repo</button></div>
      <p class="pl-hint"><b>Save</b> keeps it in this browser's list. <b>Download for repo</b> gives a <code>.json</code> to put in <code>docs-src/plans/</code>: after a push (or <code>node scripts/build_docs.js</code>) it is a shared template for everyone opening the page.</p>`;
  }

  // ---------- import / export / share ----------
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  const fileName = ext => (S.plan.title || 'vloxx-plan').replace(/[^\w.-]+/g, '_') + ext;
  function exportJson() { download(fileName('.vloxxplan.json'), new Blob([JSON.stringify(S.plan, null, 2)], { type: 'application/json' })); }
  function loadPlan(p, src) { if (!validPlan(p)) { toast('Not a Vloxx plan file'); return false; } const prev = snapshot(); S.plan = normalise(p); S.step = 0; S.sel.clear(); commit(prev); renderAll(); fit(); toast('Plan loaded' + (src ? ' from ' + src : '')); return true; }
  function importFile() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(t => { try { loadPlan(JSON.parse(t), f.name); } catch (e) { toast('Invalid JSON'); } }); }; i.click(); }
  function pasteDialog() { modal(`<h4>Import / export plan JSON</h4><p class="pl-hint">Paste a plan JSON and press Load, or copy the current plan.</p><textarea id="pl-json">${esc(JSON.stringify(S.plan, null, 2))}</textarea><div class="pl-row" style="justify-content:flex-end;margin-top:8px"><button class="pl-btn" data-a="copy">Copy</button><button class="pl-btn" data-a="load">Load</button><button class="pl-btn" data-a="close">Close</button></div>`,
    (a, box) => { const ta = box.querySelector('#pl-json'); if (a === 'copy') { navigator.clipboard && navigator.clipboard.writeText(ta.value).then(() => toast('Copied')); return false; } if (a === 'load') { try { return loadPlan(JSON.parse(ta.value), 'paste'); } catch (e) { toast('Invalid JSON'); return false; } } return true; }); }
  async function encode(obj) { const bytes = new TextEncoder().encode(JSON.stringify(obj)); let out = bytes, tag = 'j';
    if (window.CompressionStream) { const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')); out = new Uint8Array(await new Response(cs).arrayBuffer()); tag = 'z'; }
    let s = ''; out.forEach(b => s += String.fromCharCode(b)); return tag + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  async function decode(str) { const tag = str[0]; const b = atob(str.slice(1).replace(/-/g, '+').replace(/_/g, '/')); const bytes = Uint8Array.from(b, c => c.charCodeAt(0));
    if (tag === 'z') { const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return JSON.parse(await new Response(ds).text()); } return JSON.parse(new TextDecoder().decode(bytes)); }
  async function share() { try { const code = await encode(S.plan); const url = location.href.split('#')[0] + '#planner=' + code; history.replaceState(null, '', '#planner=' + code); if (navigator.clipboard) await navigator.clipboard.writeText(url); toast('Share link copied (' + Math.round(url.length / 1024 * 10) / 10 + ' KB)'); } catch (e) { toast('Could not create link: ' + e.message); } }
  function svgString(w = 2000) { const c = svg.cloneNode(true); c.setAttribute('xmlns', NS); c.setAttribute('width', w); c.setAttribute('height', Math.round(w * svg.clientHeight / svg.clientWidth)); c.querySelectorAll('[data-handle]').forEach(n => n.remove()); return new XMLSerializer().serializeToString(c); }
  function exportPng() { const prevSel = S.sel; S.sel = new Set(); render(); const w = 2000; const s = svgString(w); S.sel = prevSel; render(); const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = Math.round(w * svg.clientHeight / svg.clientWidth); const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
      cx.fillStyle = 'rgba(15,18,21,.85)'; cx.fillRect(0, 0, cv.width, 54); cx.fillStyle = '#fff'; cx.font = '600 26px system-ui'; cx.fillText(`${S.plan.title} — ${S.step + 1}. ${step().name}${step().time ? ' (' + step().time + ')' : ''}`, 20, 36);
      cv.toBlob(b => download(fileName(`-step${S.step + 1}.png`), b)); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }
  function exportSvg() { download(fileName(`-step${S.step + 1}.svg`), new Blob([svgString()], { type: 'image/svg+xml' })); }
  function newPlan() { if (!confirm('Start a new empty plan? (Current plan stays in undo history; export it first if you want to keep it.)')) return; const prev = snapshot(); S.plan = blankPlan(); S.step = 0; S.sel.clear(); commit(prev); renderAll(); fit(); }

  // ---------- UI chrome ----------
  let topEls = {}, sideEl, toolsEl;
  function build() {
    root.innerHTML = `<div class="pl-top"><input class="pl-title" title="Plan title"><span class="pl-sep"></span>
      <button class="pl-btn" data-a="new" title="New empty plan">New</button><button class="pl-btn" data-a="template" title="Available templates: load one, or save the current plan as a template">Templates</button>
      <span class="pl-sep"></span><button class="pl-btn" data-a="import" title="Import a .json plan file">Import</button><button class="pl-btn" data-a="export" title="Download plan as JSON">Export JSON</button><button class="pl-btn" data-a="paste" title="View / paste plan JSON">JSON…</button><button class="pl-btn" data-a="share" title="Copy a link containing the whole plan">Share link</button><button class="pl-btn" data-a="png" title="Export current step as PNG">PNG</button><button class="pl-btn" data-a="svg" title="Export current step as SVG">SVG</button>
      <span class="pl-sep"></span><button class="pl-btn" data-a="undo" title="Undo (Ctrl+Z)">↶</button><button class="pl-btn" data-a="redo" title="Redo (Ctrl+Y)">↷</button>
      <span class="pl-sep"></span><button class="pl-btn" data-a="prev" title="Previous step ([)">◀</button><button class="pl-btn" data-a="play" title="Play through steps (animated)">▶ Play</button><button class="pl-btn" data-a="next" title="Next step (])">▶|</button><button class="pl-btn" data-a="add" title="Add step (copy of current)">+ Step</button>
      <span class="pl-sep"></span><button class="pl-btn" data-a="help" title="Shortcuts & help (?)">?</button></div>
      <div class="pl-body"><div class="pl-tools"></div><div class="pl-stage"><svg></svg><div class="pl-stepname"></div><div class="pl-readout"></div><div class="pl-zoom"><button data-z="in" title="Zoom in">+</button><button data-z="out" title="Zoom out">−</button><button data-z="fit" title="Fit arena (F)">⤢</button></div></div>
      <div class="pl-side"><div class="pl-tabs"><button data-t="steps">Steps</button><button data-t="players">Players</button><button data-t="tool">Tool</button><button data-t="props">Selection</button><button data-t="layers">Layers</button><button data-t="templates">Templates</button></div><div class="pl-pane"></div></div></div>`;
    stageEl = root.querySelector('.pl-stage'); svg = stageEl.querySelector('svg'); readout = stageEl.querySelector('.pl-readout'); stepName = stageEl.querySelector('.pl-stepname');
    gBg = el('g', {}, svg); gObj = el('g', {}, svg); gUi = el('g', {}, svg);
    toolsEl = root.querySelector('.pl-tools'); toolsEl.innerHTML = TOOLS.map(t => `<button class="pl-tool" data-tool="${t[0]}" title="${t[3]} (${t[2]})">${t[1]}<span class="k">${t[2]}</span></button>`).join('');
    toolsEl.addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });
    sideEl = root.querySelector('.pl-pane');
    root.querySelector('.pl-tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { S.side = b.dataset.t; renderSide(); } });
    const top = root.querySelector('.pl-top'); topEls.title = top.querySelector('.pl-title');
    topEls.title.addEventListener('change', () => change(() => S.plan.title = topEls.title.value));
    top.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) return; ({ new: newPlan, template: () => { S.side = 'templates'; renderSide(); }, import: importFile, export: exportJson, paste: pasteDialog, share, png: exportPng, svg: exportSvg, undo, redo, prev: () => goStep(S.step - 1, true), next: () => goStep(S.step + 1, true), play, add: () => addStep(true), help })[a.dataset.a](); });
    root.querySelector('.pl-zoom').addEventListener('click', e => { const z = e.target.dataset.z; if (z === 'in') zoomAt({ x: S.view.cx, y: S.view.cy }, 0.8); if (z === 'out') zoomAt({ x: S.view.cx, y: S.view.cy }, 1.25); if (z === 'fit') fit(); });
    svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onMove); svg.addEventListener('pointerup', onUp); svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('wheel', onWheel, { passive: false }); svg.addEventListener('dblclick', e => { const id = hitObj(e); const o = id && byId(id); if (o && o.type === 'text') { const s = prompt('Text:', o.text); if (s != null) change(() => o.text = s); } else if (o) { S.side = 'props'; renderSide(); } });
    svg.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    new ResizeObserver(() => render()).observe(stageEl);
  }
  function setTool(t) { S.tool = t; toolsEl.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); svg.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair'; if (['player', 'marker', 'unit', 'circle', 'cone', 'beam', 'line', 'arrow', 'text', 'pen'].includes(t)) S.side = 'tool'; renderSide(); }
  function updateTop() { if (!topEls.title) return; topEls.title.value = S.plan.title || ''; const q = s => root.querySelector(`.pl-top [data-a="${s}"]`); q('undo').disabled = !S.undo.length; q('redo').disabled = !S.redo.length; q('play').textContent = S.playing ? '■ Stop' : '▶ Play'; q('prev').disabled = S.step === 0; q('next').disabled = S.step >= S.plan.steps.length - 1; }
  function opt(list, val, labeler) { return list.map((v, i) => `<option value="${i}" ${i === val ? 'selected' : ''}>${esc(labeler ? labeler(v, i) : v)}</option>`).join(''); }
  function renderSide() {
    if (!sideEl) return; root.querySelectorAll('.pl-tabs [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === S.side)); let h = '';
    if (S.side === 'steps') {
      h += `<h5>Steps (${S.plan.steps.length})</h5>` + S.plan.steps.map((s, i) => `<div class="pl-step ${i === S.step ? 'on' : ''}" data-s="${i}"><span class="n">${i + 1}</span><span class="t">${esc(s.name)}</span><span class="tm">${esc(s.time || '')}</span><button class="pl-btn" data-up="${i}" title="Move up">↑</button><button class="pl-btn" data-dn="${i}" title="Move down">↓</button><button class="pl-btn" data-del="${i}" title="Delete step">✕</button></div>`).join('') +
        `<div class="pl-row"><button class="pl-btn" data-act="addcopy">+ Copy of this step</button><button class="pl-btn" data-act="addblank">+ Empty step</button></div>
        <h5>This step</h5><div class="pl-row"><label>Name</label><input type="text" data-f="name" value="${esc(step().name)}"></div><div class="pl-row"><label>Time</label><input type="text" data-f="time" placeholder="e.g. ~38 s / P3 +33 s" value="${esc(step().time || '')}"></div><textarea data-f="note" placeholder="Notes for this step (callouts, assignments…)">${esc(step().note || '')}</textarea>
        <h5>Plan notes</h5><textarea data-f="plannotes" placeholder="General notes">${esc(S.plan.notes || '')}</textarea>
        <p class="pl-hint">Steps keep object ids, so ▶ Play animates tokens moving between steps. Autosaved in this browser.</p>`;
    } else if (S.side === 'players') {
      h += `<h5>Squad</h5>` + S.plan.players.map((p, i) => { const pr = PROFS[p.prof || ''] || PROFS['']; const placed = objs().some(o => o.type === 'player' && o.pid === i);
        return `<div class="pl-player ${S.tool === 'player' && S.toolOpt.player === i ? 'on' : ''}" data-pl="${i}"><span class="dot" style="background:${pr[1]};${p.sub === 2 ? 'border-color:#fff' : ''}">${i + 1}</span><input type="text" data-p="name" value="${esc(p.name)}"><select data-p="prof">${Object.keys(PROFS).map(k => `<option ${k === (p.prof || '') ? 'selected' : ''} value="${k}">${k || 'Profession'}</option>`).join('')}</select><span></span><div class="wide"><select data-p="role">${ROLES.map(r => `<option ${r === (p.role || '') ? 'selected' : ''} value="${r}">${r || 'Role'}</option>`).join('')}</select><select data-p="sub"><option value="1" ${p.sub !== 2 ? 'selected' : ''}>Sub 1</option><option value="2" ${p.sub === 2 ? 'selected' : ''}>Sub 2</option></select><button class="pl-btn" data-place="${i}" title="${placed ? 'Select on map' : 'Place with the player tool'}">${placed ? '◎' : '＋'}</button></div></div>`; }).join('') +
        `<div class="pl-row"><button class="pl-btn" data-act="placeall">Place all (stack)</button><button class="pl-btn" data-act="spread">Spread ring</button><button class="pl-btn" data-act="clearpl">Remove from step</button></div><p class="pl-hint">Player tool: click the map to place the highlighted player (number keys pick 1–9, 0 = 10). Sub 2 tokens have a light ring.</p>`;
    } else if (S.side === 'tool') {
      const t = S.tool; h += `<h5>${esc((TOOLS.find(x => x[0] === t) || [])[3] || t)}</h5>`;
      if (t === 'marker') h += `<div class="pl-chips">${Object.entries(MARKERS).map(([k, m]) => `<button class="pl-chip ${S.toolOpt.marker === k ? 'on' : ''}" data-mk="${k}" style="border-color:${m[1]}">${m[0]}</button>`).join('')}</div><p class="pl-hint">One of each marker per step (like in game). Clicking moves the existing one.</p>`;
      else if (t === 'unit') h += `<div class="pl-chips">${Object.entries(UNITS).map(([k, u]) => `<button class="pl-chip ${S.toolOpt.unit === k ? 'on' : ''}" data-un="${k}" style="border-color:${u[1]}">${u[0]}</button>`).join('')}</div><div class="pl-row" style="margin-top:8px"><button class="pl-btn" data-act="spawns">Add all 3 Aspects at spawn</button><button class="pl-btn" data-act="cosmicring">Cosmic ring (8)</button></div><p class="pl-hint">Aspects always spawn at the same exact point and respawn 40 s after death. Cosmic adds use 8 fixed points on a ~650 ring.</p>`;
      else if (t === 'circle') h += `<div class="pl-row"><label>Preset</label><select data-to="aoe">${opt(AOE, S.toolOpt.aoe, a => a[0] + ' (' + a[1] + ')')}</select></div><p class="pl-hint">Click = preset size · drag = custom radius · click a player/add/marker = circle that follows it. Sizes from Elite Insights.</p>`;
      else if (t === 'cone') h += `<div class="pl-row"><label>Preset</label><select data-to="cone">${opt(CONES, S.toolOpt.cone, c => c[0])}</select></div><p class="pl-hint">Drag from the origin toward the direction. Hold Shift to set the radius by dragging.</p>`;
      else if (t === 'beam') h += `<div class="pl-row"><label>Preset</label><select data-to="beam">${opt(BEAMS, S.toolOpt.beam, b => b[0])}</select></div><p class="pl-hint">${BEAMS[S.toolOpt.beam][2] ? `Click on Vloxx (drag to aim the first spoke): ${WP.n} spokes ${WP.gap}° apart, ending where the projectiles vanish (${WP.edge} from the centre). Measured from the logs.` : "Drag from start to end."}</p>`;
      else if (t === 'player') h += `<p class="pl-hint">Placing <b>${esc(S.plan.players[S.toolOpt.player].name)}</b> (#${S.toolOpt.player + 1}). Change it in the Players tab or with number keys.</p>`;
      else h += `<p class="pl-hint">${t === 'select' ? 'Click to select, Shift+click to add, drag empty space for a box selection, Alt+drag to duplicate. Drag the white handles to resize.' : t === 'ruler' ? 'Drag to measure; the distance is shown in game units.' : t === 'pan' ? 'Drag to pan. Wheel zooms.' : t === 'eraser' ? 'Click or drag over objects to delete them.' : ''}</p>`;
      if (['line', 'arrow', 'pen', 'text'].includes(t)) h += `<div class="pl-row"><label>Colour</label><input type="color" data-to="color" value="${S.toolOpt.color}"></div>`;
      h += `<h5>Snap</h5><div class="pl-row"><select data-snap>${[0, 25, 50, 100, 250].map(v => `<option value="${v}" ${S.plan.snap === v ? 'selected' : ''}>${v ? v + ' units' : 'off'}</option>`).join('')}</select></div>`;
    } else if (S.side === 'props') {
      const sel = [...S.sel].map(byId).filter(Boolean);
      if (!sel.length) h += `<p class="pl-hint">Nothing selected. Use the select tool (V).</p>`;
      else if (sel.length > 1) h += `<h5>${sel.length} objects</h5><div class="pl-row"><button class="pl-btn" data-act="del">Delete</button><button class="pl-btn" data-act="dup">Duplicate</button></div>`;
      else { const o = sel[0]; const f = (k, label, type = 'text', extra = '') => `<div class="pl-row"><label>${label}</label><input type="${type}" data-o="${k}" value="${esc(o[k] ?? '')}" ${extra}></div>`;
        h += `<h5>${esc(o.type)}${o.attach ? ' (attached)' : ''}</h5>`;
        if (o.type === 'player') { const p = S.plan.players[o.pid]; h += `<p>${esc(p.name)} · ${esc(p.prof || '—')} ${esc(p.role || '')} · sub ${p.sub}</p>`; }
        if ('x' in o && !o.attach) h += `<div class="pl-row"><label>World x, y</label><input type="number" step="1" data-o="x" value="${fmt(o.x, 1)}"><input type="number" step="1" data-o="y" value="${fmt(o.y, 1)}"></div><div class="pl-hint">map ${fmt(o.x * MAPK, 3)}, ${fmt(o.y * MAPK, 3)} · ${fmt(Math.hypot(o.x - C.x, o.y - C.y))} from centre</div>`;
        if (o.type === 'circle') h += f('r', 'Radius', 'number', 'step=10') + f('inner', 'Inner ring', 'number', 'step=10') + `<label class="pl-chk"><input type="checkbox" data-ob="fill" ${o.fill !== false ? 'checked' : ''}>Filled</label><label class="pl-chk"><input type="checkbox" data-ob="dash" ${o.dash ? 'checked' : ''}>Dashed</label>` + (o.attach ? `<div class="pl-row"><button class="pl-btn" data-act="detach">Detach</button></div>` : '');
        if (o.type === 'cone') h += f('r', 'Radius', 'number', 'step=10') + f('angle', 'Angle °', 'number', 'step=5') + f('spread', 'Spread °', 'number', 'step=5');
        if (o.type === 'beam') h += f('w', 'Width', 'number', 'step=10');
        if (o.type === 'line' || o.type === 'arrow' || o.type === 'path') h += f('width', 'Width px', 'number', 'step=1 min=1') + (o.type !== 'path' ? `<label class="pl-chk"><input type="checkbox" data-ob="dash" ${o.dash ? 'checked' : ''}>Dashed</label>` : '');
        if (o.type === 'text') h += f('text', 'Text') + f('size', 'Size px', 'number', 'step=1');
        if (o.type === 'unit') h += `<div class="pl-row"><label>Type</label><select data-ou="u">${Object.entries(UNITS).map(([k, u]) => `<option value="${k}" ${o.u === k ? 'selected' : ''}>${u[0]}</option>`).join('')}</select></div>`;
        if (o.type === 'marker') h += `<div class="pl-row"><label>Marker</label><select data-ou="m">${Object.entries(MARKERS).map(([k, m]) => `<option value="${k}" ${o.m === k ? 'selected' : ''}>${m[0]}</option>`).join('')}</select></div>`;
        if (!['player', 'marker'].includes(o.type)) h += f('label', 'Label') + `<div class="pl-row"><label>Colour</label><input type="color" data-o="color" value="${o.color || (o.type === 'unit' ? (UNITS[o.u] || UNITS.npc)[1] : '#ffd166')}"></div>`;
        h += `<div class="pl-row"><label>Note</label><input type="text" data-o="note" value="${esc(o.note || '')}"></div><div class="pl-row"><button class="pl-btn" data-act="del">Delete</button>${!['player', 'marker'].includes(o.type) ? '<button class="pl-btn" data-act="dup">Duplicate</button>' : ''}<button class="pl-btn" data-act="front">To front</button><button class="pl-btn" data-act="toall" title="Copy this object (same id) into every step">Copy to all steps</button></div>`; }
    } else if (S.side === 'templates') { h += templatesPane();
    } else if (S.side === 'layers') {
      const L = S.plan.layers; const names = { platform: 'Platform (radius ≈ 2470)', heat: 'Where players stood (heatmap from logs)', grid: 'Grid (250 units)', rings: 'Range rings from centre', spawns: 'Aspect spawn points', cosmic: 'Cosmic add spawn ring (8 points)', entrance: 'Entrance', labels: 'Labels', compass: 'Scale bar' };
      h += `<h5>Map layers</h5>` + Object.keys(names).map(k => `<label class="pl-chk"><input type="checkbox" data-ly="${k}" ${L[k] ? 'checked' : ''}>${names[k]}</label>`).join('') +
        `<h5>Coordinates</h5><p class="pl-hint">World = arcdps game units. Map = world × 0.0254 (the squad-marker tool format). Centre = ${fmt(C.x, 1)}, ${fmt(C.y, 1)} (map ${fmt(C.x * MAPK, 2)}, ${fmt(C.y * MAPK, 2)}).</p>
        <h5>Arena data</h5><p class="pl-hint">Measured from ${A.positions ? A.positions.toLocaleString() : '—'} player positions in the research logs. Rebuilt with every docs build.</p>`;
    }
    sideEl.innerHTML = h; bindSide();
  }
  function bindSide() {
    const q = s => sideEl.querySelectorAll(s);
    q('[data-s]').forEach(n => n.addEventListener('click', e => { if (e.target.closest('button')) return; goStep(+n.dataset.s, true); }));
    q('[data-up]').forEach(n => n.onclick = () => moveStep(+n.dataset.up, -1)); q('[data-dn]').forEach(n => n.onclick = () => moveStep(+n.dataset.dn, 1)); q('[data-del]').forEach(n => n.onclick = () => delStep(+n.dataset.del));
    q('[data-f]').forEach(n => n.addEventListener('change', () => change(() => { const f = n.dataset.f; if (f === 'plannotes') S.plan.notes = n.value; else step()[f] = n.value; })));
    q('[data-p]').forEach(n => n.addEventListener('change', () => { const i = +n.closest('[data-pl]').dataset.pl; change(() => { const v = n.dataset.p === 'sub' ? +n.value : n.value; S.plan.players[i][n.dataset.p] = v; }); renderSide(); }));
    q('[data-pl]').forEach(n => n.addEventListener('click', e => { if (e.target.closest('input,select,button')) return; S.toolOpt.player = +n.dataset.pl; setTool('player'); S.side = 'players'; renderSide(); }));
    q('[data-place]').forEach(n => n.onclick = () => { const i = +n.dataset.place; const o = objs().find(o => o.type === 'player' && o.pid === i); if (o) { S.sel = new Set([o.id]); render(); } else { S.toolOpt.player = i; setTool('player'); S.side = 'players'; renderSide(); } });
    q('[data-mk]').forEach(n => n.onclick = () => { S.toolOpt.marker = n.dataset.mk; renderSide(); }); q('[data-un]').forEach(n => n.onclick = () => { S.toolOpt.unit = n.dataset.un; renderSide(); });
    q('[data-to]').forEach(n => n.addEventListener('change', () => { const k = n.dataset.to; S.toolOpt[k] = k === 'color' ? n.value : +n.value; }));
    q('[data-snap]').forEach(n => n.addEventListener('change', () => change(() => S.plan.snap = +n.value)));
    q('[data-ly]').forEach(n => n.addEventListener('change', () => change(() => S.plan.layers[n.dataset.ly] = n.checked)));
    const one = () => byId([...S.sel][0]);
    q('[data-o]').forEach(n => n.addEventListener('change', () => { const o = one(); if (!o) return; const k = n.dataset.o; change(() => { if (n.type === 'number') { const v = n.value === '' ? undefined : +n.value; if (v === undefined) delete o[k]; else o[k] = v; } else o[k] = n.value; }); renderSide(); }));
    q('[data-ob]').forEach(n => n.addEventListener('change', () => { const o = one(); if (o) change(() => o[n.dataset.ob] = n.checked); }));
    q('[data-ou]').forEach(n => n.addEventListener('change', () => { const o = one(); if (o) change(() => o[n.dataset.ou] = n.value); }));
    q('[data-act]').forEach(n => n.onclick = () => act(n.dataset.act));
    q('[data-tl]').forEach(n => n.onclick = () => loadTemplate(n.dataset.tl));
    q('[data-tk]').forEach(n => n.onclick = () => { const u = location.href.split('#')[0] + '#planner=t.' + n.dataset.tk; if (navigator.clipboard) navigator.clipboard.writeText(u).then(() => toast('Link copied')); });
    q('[data-td]').forEach(n => n.onclick = () => downloadTemplate(findTemplate(n.dataset.td)));
    q('[data-tx]').forEach(n => n.onclick = () => { const t = findTemplate(n.dataset.tx); if (t && confirm('Remove "' + t.title + '" from your templates?')) { setMyTemplates(myTemplates().filter(x => 'my:' + x.id !== n.dataset.tx)); renderSide(); } });
  }
  function act(a) {
    const ring = (n, r, cx, cy) => Array.from({ length: n }, (_, i) => ({ x: Math.round(cx + r * Math.cos(i * 2 * Math.PI / n)), y: Math.round(cy + r * Math.sin(i * 2 * Math.PI / n)) }));
    const putPlayers = pts => change(() => pts.forEach((p, i) => { const ex = objs().find(o => o.type === 'player' && o.pid === i); if (ex) { ex.x = p.x; ex.y = p.y; } else objs().push({ id: byId('p' + i) ? uid() : 'p' + i, type: 'player', pid: i, x: p.x, y: p.y }); }));
    if (a === 'tplsave') return saveAsTemplate(); if (a === 'tpldl') return downloadTemplate(null);
    if (a === 'addcopy') addStep(true); else if (a === 'addblank') addStep(false);
    else if (a === 'placeall') putPlayers(ring(10, 200, S.view.cx, S.view.cy)); else if (a === 'spread') putPlayers(ring(10, 900, C.x, C.y));
    else if (a === 'clearpl') change(() => step().objects = objs().filter(o => o.type !== 'player' && !(o.attach && /^p\d/.test(o.attach))));
    else if (a === 'spawns') change(() => { for (const [k, p] of Object.entries(A.spawns || {})) if (/Aspect/.test(k)) objs().push({ id: uid(), type: 'unit', u: k.split(' ').pop().toLowerCase(), x: p.x, y: p.y }); });
    else if (a === 'cosmicring') change(() => (A.cosmicPoints || []).forEach(p => objs().push({ id: uid(), type: 'unit', u: 'piercer', x: p.x, y: p.y })));
    else if (a === 'del') deleteSel(); else if (a === 'dup') { S.clip = [...S.sel].map(byId).filter(Boolean).map(clone); onKey({ key: 'v', ctrlKey: true, target: document.body }); }
    else if (a === 'detach') { const o = byId([...S.sel][0]); if (o) change(() => { const p = anchor(o); o.x = p.x; o.y = p.y; delete o.attach; }); }
    else if (a === 'front') { const ids = S.sel; change(() => { const keep = objs().filter(o => !ids.has(o.id)), top = objs().filter(o => ids.has(o.id)); step().objects = keep.concat(top); }); }
    else if (a === 'toall') { const o = byId([...S.sel][0]); if (!o) return; change(() => S.plan.steps.forEach((s, i) => { if (i === S.step) return; const j = s.objects.findIndex(x => x.id === o.id); if (j >= 0) s.objects[j] = clone(o); else s.objects.push(clone(o)); })); toast('Copied to all steps'); }
    renderSide();
  }
  function modal(html, onAction) { const m = document.createElement('div'); m.className = 'pl-modal'; m.innerHTML = `<div class="pl-dialog">${html}</div>`; document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) { m.remove(); return; } const a = e.target.closest('[data-a]'); if (a && onAction(a.dataset.a, m) !== false) m.remove(); }); return m; }
  function help() { modal(`<h4>Raid planner — help</h4><table>${TOOLS.map(t => `<tr><td><kbd>${t[2]}</kbd></td><td>${t[1]} ${esc(t[3])}</td></tr>`).join('')}
    <tr><td><kbd>Space</kbd> drag / middle mouse</td><td>Pan · wheel = zoom · <kbd>F</kbd> fit · <kbd>+</kbd>/<kbd>−</kbd> zoom</td></tr><tr><td><kbd>[</kbd> <kbd>]</kbd></td><td>Previous / next step (animated)</td></tr>
    <tr><td><kbd>Ctrl+Z</kbd> <kbd>Ctrl+Y</kbd></td><td>Undo / redo</td></tr><tr><td><kbd>Ctrl+C</kbd> <kbd>Ctrl+V</kbd> <kbd>Ctrl+D</kbd></td><td>Copy / paste / duplicate · <kbd>Alt</kbd>+drag duplicates</td></tr>
    <tr><td><kbd>Ctrl+A</kbd> <kbd>Del</kbd> <kbd>Esc</kbd></td><td>Select all / delete / deselect · arrows nudge 10 (Shift 100)</td></tr><tr><td><kbd>G</kbd> <kbd>?</kbd></td><td>Toggle grid / this help</td></tr></table>
    <p class="pl-hint">Plans autosave in this browser. Export JSON / Import to move them between machines; Share link puts the whole plan (compressed) in the URL. Coordinates: world = arcdps units, map = world × 0.0254. Mechanic sizes and spawn points come from the research findings.</p><div class="pl-row" style="justify-content:flex-end"><button class="pl-btn" data-a="close">Close</button></div>`, () => true); }
  let toastT; function toast(s) { let t = document.querySelector('.pl-toast'); if (!t) { t = document.createElement('div'); t.className = 'pl-toast'; document.body.appendChild(t); } t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

  // ---------- boot ----------
  let booted = false;
  async function boot() {
    if (booted) { render(); return; } booted = true; buildHeat(); build();
    let loaded = null; const m = location.hash.match(/planner=([\w.-]+)/);
    if (m && m[1].startsWith('t.')) { const t = REPO_TPL.find(p => p.id === m[1].slice(2)); if (t) loaded = normalise(clone(t.plan)); }
    else if (m) { try { const p = await decode(m[1]); if (validPlan(p)) loaded = normalise(p); } catch (e) { } }
    if (!loaded) { try { const st = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (st && validPlan(st.plan)) { loaded = normalise(st.plan); S.step = st.step || 0; } } catch (e) { } }
    S.plan = loaded || blankPlan(); fixStep(); setTool('select'); S.side = 'steps'; renderAll(); fit();
    if (!loaded && REPO_TPL.length) toast('Tip: the Templates tab lists ' + REPO_TPL.length + ' ready-made plan' + (REPO_TPL.length > 1 ? 's' : ''));
  }
  window.VloxxPlanner = { boot, get plan() { return S.plan; } };
})();
