// Arena geometry for the raid planner, measured from the raw logs: centre, platform radius, player-position heatmap,
// spawn points of every add type, entrance area. Writes data/arena.json (embedded into docs by build_docs.js).
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const dir = path.join(__dirname, '..', 'logs', 'raw');
const CELL = 50, HALF = 3000;
const centres = [], pos = [], entrance = [], spawns = {};
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue; const t0 = s9.t;
  const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  const b = Buffer.alloc(8); const xy = e => { b.writeBigUInt64LE(e.dst); return [b.readFloatLE(0), b.readFloatLE(4)]; };
  const p3 = ev.find(e => e.skill === 81071 && e.sc === 67);
  if (p3) { const L = ev.filter(e => e.sc === 19 && e.src === boss.addr && e.t <= p3.t); if (L.length) centres.push(xy(L[L.length - 1])); }
  const first = new Map(); for (const e of ev) if (e.sc === 19 && !first.has(e.src)) first.set(e.src, [e.t, ...xy(e)]);
  for (const e of ev) {
    if (e.sc !== 6) continue; const a = agents.get(e.src); if (!a || a.isPlayer) continue;
    const m = (a.name || '').split('\0')[0].match(/Aspect of the (Staff|Spear|Sword)|Cosmic (Piercer|Bulwark|Sunderer)/); if (!m) continue;
    const p = first.get(e.src); if (!p || p[0] - e.t > 2000) continue;
    const k = m[1] ? 'Aspect of the ' + m[1] : 'Cosmic ' + m[2]; (spawns[k] = spawns[k] || []).push([p[1], p[2]]);
  }
  const players = new Set([...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr));
  for (const e of ev) { if (e.sc !== 19 || !players.has(e.src)) continue; const q = xy(e); if (e.t - t0 < 6000) entrance.push(q); else pos.push(q); }
}
const mean = a => [a.reduce((s, p) => s + p[0], 0) / a.length, a.reduce((s, p) => s + p[1], 0) / a.length];
const C = mean(centres);
const d = pos.map(p => Math.hypot(p[0] - C[0], p[1] - C[1])).sort((a, b) => a - b);
const q = f => d[Math.floor(f * (d.length - 1))];
// heatmap (log scale 0..255), rows from top (max y) to bottom
const W = 2 * HALF / CELL; const H = new Float64Array(W * W);
for (const [x, y] of pos) { const cx = Math.floor((x - (C[0] - HALF)) / CELL), cy = Math.floor(((C[1] + HALF) - y) / CELL); if (cx >= 0 && cy >= 0 && cx < W && cy < W) H[cy * W + cx]++; }
const mx = Math.max(...H); const bytes = Buffer.from(H.map(v => v ? Math.max(1, Math.round(255 * Math.log1p(v) / Math.log1p(mx))) : 0));
// spawn points: median of each type (they are fixed), plus how many variants
const sp = {}; for (const [k, v] of Object.entries(spawns)) { const xs = v.map(p => p[0]).sort((a, b) => a - b), ys = v.map(p => p[1]).sort((a, b) => a - b);
  const uniq = [...new Set(v.map(p => Math.round(p[0] / 25) * 25 + ',' + Math.round(p[1] / 25) * 25))];
  sp[k] = { x: +xs[xs.length >> 1].toFixed(1), y: +ys[ys.length >> 1].toFixed(1), n: v.length, variants: uniq.length, all: uniq.length > 1 ? uniq.slice(0, 6) : undefined }; }
// Cosmic adds spawn on a ring of fixed points: cluster all Cosmic spawns
const cosmic = []; for (const [k, v] of Object.entries(spawns)) if (k.startsWith('Cosmic')) for (const p of v) { let c = cosmic.find(c => Math.hypot(c.x - p[0], c.y - p[1]) < 60); if (!c) { c = { x: p[0], y: p[1], n: 0, types: {} }; cosmic.push(c); } c.n++; c.types[k] = (c.types[k] || 0) + 1; }
// a real spawn point is used ~100 times; a cluster seen a couple of times is an add whose first logged position came late (it had already moved)
const cosmicMin = Math.max(5, 0.1 * Math.max(0, ...cosmic.map(c => c.n)));
const cosmicPoints = cosmic.filter(c => c.n >= cosmicMin).map(c => ({ x: +c.x.toFixed(1), y: +c.y.toFixed(1), n: c.n, types: c.types, angle: Math.round(Math.atan2(c.y - C[1], c.x - C[0]) * 180 / Math.PI), dist: Math.round(Math.hypot(c.x - C[0], c.y - C[1])) })).sort((a, b) => a.angle - b.angle);
const out = { cosmicPoints, platformRadius: 2470, centre: { x: +C[0].toFixed(1), y: +C[1].toFixed(1), samples: centres.length },
  radius: { p99: Math.round(q(0.99)), p999: Math.round(q(0.999)), max: Math.round(d[d.length - 1]) },
  entrance: entrance.length ? (() => { const m = mean(entrance); return { x: Math.round(m[0]), y: Math.round(m[1]), dist: Math.round(Math.hypot(m[0] - C[0], m[1] - C[1])) }; })() : null,
  spawns: sp, heat: { cell: CELL, half: HALF, size: W, origin: 'top-left = (centre.x-half, centre.y+half)', b64: bytes.toString('base64') },
  positions: pos.length, toMapUnits: 0.0254 };
fs.writeFileSync(path.join(__dirname, '..', 'data', 'arena.json'), JSON.stringify(out));
console.log(JSON.stringify({ ...out, heat: { ...out.heat, b64: out.heat.b64.length + ' chars' } }, null, 1));
