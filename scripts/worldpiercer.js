// Worldpiercer (skill 80916) geometry from raw logs: missile create/launch/remove events + damage hits.
// Missile fields (arcdps 20260929): int16 positions ×10 packed in value/buffDmg/overstack bytes:
//   57 create : [ox, oy, oz]                       (origin = Vloxx)
//   58 launch : [tx, ty, tz, ox, oy, oz]           (aim point, then origin again)
//   59 remove : bytes 4.. = [x, y, z]              (where the projectile ended)
// Writes data/worldpiercer.csv (one row per projectile) + data/worldpiercer_summary.json (used by the planner + generated plan).
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const dir = path.join(__dirname, '..', 'logs', 'raw');
const A = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'arena.json'), 'utf8')); const C = A.centre;
const b = Buffer.alloc(12), pb = Buffer.alloc(8);
const i16 = e => { b.writeInt32LE(e.value, 0); b.writeInt32LE(e.buffDmg, 4); b.writeUInt32LE(e.over, 8); return [0, 2, 4, 6, 8, 10].map(o => b.readInt16LE(o) * 10); };
const rows = [], hits = [], misses = []; let casts = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue; const t0 = s9.t;
  const players = new Set([...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr));
  const pos = new Map(); // player -> [[t,x,y]]
  for (const e of ev) if (e.sc === 19 && players.has(e.src)) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
  const at = (p, t) => { const a = pos.get(p); if (!a) return null; let lo = 0, hi = a.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m][0] <= t) lo = m; else hi = m - 1; } return a[lo]; };
  let cast = null;
  for (const e of ev) {
    if (e.skill !== 80916) continue;
    if (e.sc === 58) { const v = i16(e); if (!cast || e.t - cast.t > 500) { cast = { t: e.t, o: [v[3], v[4]], m: [] }; casts++; } cast.m.push({ aim: [v[0], v[1]], launch: e.t }); }
    else if (e.sc === 59 && cast) { const v = i16(e); const end = [v[2], v[3]]; // attach to the projectile whose line passes closest
      let best = null; for (const m of cast.m) { if (m.end) continue; const d = perp(cast.o, m.aim, end); if (!best || d.perp < best.d.perp) best = { m, d }; }
      if (best) { best.m.end = end; best.m.endT = e.t; rows.push({ log: f.replace('.zevtc', ''), t: ((cast.t - t0) / 1000).toFixed(3), ox: cast.o[0], oy: cast.o[1], aimx: best.m.aim[0], aimy: best.m.aim[1],
        aim_dist: Math.round(Math.hypot(best.m.aim[0] - cast.o[0], best.m.aim[1] - cast.o[1])), endx: end[0], endy: end[1], travelled: Math.round(best.d.along), end_from_centre: Math.round(Math.hypot(end[0] - C.x, end[1] - C.y)),
        flight_s: ((e.t - best.m.launch) / 1000).toFixed(3), speed: Math.round(best.d.along / ((e.t - best.m.launch) / 1000)), n_in_cast: cast.m.length }); } }
    else if (e.sc === 0 && players.has(e.dst) && cast && e.t - cast.t < 3000) { const p = at(e.dst, e.t); if (!p) continue;
      let best = null; for (const m of cast.m) { const d = perp(cast.o, m.aim, [p[1], p[2]]); if (!best || d.perp < best.perp) best = d; } hits.push(best); }
  }
}
function perp(o, aim, p) { const dx = aim[0] - o[0], dy = aim[1] - o[1], l = Math.hypot(dx, dy) || 1; const ux = dx / l, uy = dy / l; const qx = p[0] - o[0], qy = p[1] - o[1]; return { along: qx * ux + qy * uy, perp: Math.abs(-qx * uy + qy * ux) }; }
const q = (a, f) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(f * (a.length - 1))]; };
const H = Object.keys(rows[0] || {}); fs.writeFileSync(path.join(__dirname, '..', 'data', 'worldpiercer.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const per = {}; rows.forEach(r => per[r.n_in_cast] = (per[r.n_in_cast] || 0) + 1);
console.log({ casts, projectiles: rows.length, projectilesPerCast: per,
  aimDist: [q(rows.map(r => r.aim_dist), 0), q(rows.map(r => r.aim_dist), 0.5), q(rows.map(r => r.aim_dist), 1)],
  endFromCentre: [q(rows.map(r => r.end_from_centre), 0.01), q(rows.map(r => r.end_from_centre), 0.5), q(rows.map(r => r.end_from_centre), 0.99)],
  speed: [q(rows.map(r => r.speed), 0.1), q(rows.map(r => r.speed), 0.5), q(rows.map(r => r.speed), 0.9)],
  hits: hits.length, hitPerp: hits.length ? [0.5, 0.9, 0.95, 0.99, 1].map(f => Math.round(q(hits.map(h => h.perp), f))) : null,
  hitAlong: hits.length ? [0, 0.5, 1].map(f => Math.round(q(hits.map(h => h.along), f))) : null });

// ---- width: closest approach of each projectile to each player during flight (positions interpolated),
//      compared between players that were hit (damage event within 1.6 s of launch) and players that were not.
//      Also the fan shape (gaps between the 6 projectiles) and aim relative to players.
const hitD = [], missD = [], gaps = [], aimed = [], firstCast = [];
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue;
  const players = new Set([...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr));
  const pos = new Map(); for (const e of ev) if (e.sc === 19 && players.has(e.src)) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
  const at = (p, t) => { const a = pos.get(p); if (!a) return null; const i = a.findIndex(x => x[0] > t); if (i <= 0) return null; const [t1, x1, y1] = a[i - 1], [t2, x2, y2] = a[i]; if (t2 - t1 > 1500) return null; const k = (t - t1) / (t2 - t1); return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]; };
  const casts = []; let c = null;
  for (const e of ev) { if (e.skill !== 80916) continue;
    if (e.sc === 58) { const v = i16(e); if (!c || e.t - c.t > 500) { c = { t: e.t, o: [v[3], v[4]], m: [], hits: new Set() }; casts.push(c); } c.m.push(v); }
    else if (e.sc === 0 && c && players.has(e.dst) && e.t - c.t < 1600) c.hits.add(e.dst); }
  if (casts.length) firstCast.push((casts[0].t - s9.t) / 1000);
  for (const c of casts) {
    const ang = c.m.map(v => Math.atan2(v[1] - c.o[1], v[0] - c.o[0]) * 180 / Math.PI).sort((a, b) => a - b);
    ang.forEach((a, i) => gaps.push(Math.round(((i ? a - ang[i - 1] : a + 360 - ang[ang.length - 1]) + 360) % 360)));
    const ps = [...players].map(p => at(p, c.t)).filter(Boolean);
    for (const v of c.m) { const a = Math.atan2(v[1] - c.o[1], v[0] - c.o[0]); if (ps.length) aimed.push(Math.min(...ps.map(p => { let x = Math.abs(Math.atan2(p[1] - c.o[1], p[0] - c.o[0]) - a) * 180 / Math.PI; return x > 180 ? 360 - x : x; }))); }
    for (const p of players) { let best = Infinity;
      for (const v of c.m) { const dx = v[0] - c.o[0], dy = v[1] - c.o[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
        for (let t = 0; t <= 1500; t += 20) { const q2 = at(p, c.t + t); if (!q2) continue; const s = 3.013 * t; best = Math.min(best, Math.hypot(q2[0] - c.o[0] - ux * s, q2[1] - c.o[1] - uy * s)); } }
      if (Number.isFinite(best)) (c.hits.has(p) ? hitD : missD).push(best); }
  }
}
const bands = [0, 50, 75, 100, 125, 150, 200, 300].map((r, i, a) => i ? { band: `${a[i - 1]}-${r}`, hit: hitD.filter(d => d > a[i - 1] && d <= r).length, miss: missD.filter(d => d > a[i - 1] && d <= r).length } : null).filter(Boolean);
// effective half-width: largest band edge where hits still outnumber misses
let half = 100; for (const b of bands) if (b.hit > b.miss) half = +b.band.split('-')[1];
const summary = { skill: 80916, casts, projectiles: rows.length, perCast: per, gapDeg: [...new Set(gaps)].slice(0, 5), aimToNearestPlayerDeg: q(aimed, 0.5),
  aimRange: q(rows.map(r => r.aim_dist), 0.5), speed: q(rows.map(r => r.speed), 0.5), endFromCentre: q(rows.map(r => r.end_from_centre), 0.5),
  telegraphEffect: 39208, launchDelayS: 2.75, halfWidth: half, width: 2 * half + 20, hitBands: bands, firstCastFightS: firstCast.length ? +(q(firstCast, 0.5) - 3).toFixed(1) : null, logs: firstCast.length };
fs.writeFileSync(path.join(__dirname, '..', 'data', 'worldpiercer_summary.json'), JSON.stringify(summary, null, 1));
console.log(summary);
