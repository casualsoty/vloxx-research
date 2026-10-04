// Annihilating Orb cast by Vloxx (skill 80323, P1): where it goes and how big each part is, from raw logs.
// Ground effects of one cast (all spawned by Vloxx): EE7B1787… at ~1.6 s marks the landing point (500, 1,000 or 1,500 from Vloxx);
// 51A65F90… / D21FF557… appear on that same point when the orb arrives. Damage: skill 80323 while the orb travels and afterwards
// around the landing point, skill 81238 = the explosion at the landing point.
// Measured per cast: landing distance and direction (versus Vloxx's facing, the fixated player, the farthest and the closest player),
// arrival time; hit rate of the travelling orb by distance beside the line Vloxx → landing point; hit rate of the explosion and of
// the later ticks by distance from the landing point.
// Writes data/annihilating_orb_summary.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8);
const norm = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; const deg = a => Math.abs(norm(a)) * 180 / Math.PI;
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
const bump = (o, k, hit) => { o[k] = o[k] || [0, 0]; o[k][1]++; if (hit) o[k][0]++; };
const wave = {}, waveHit = [0, 0]; const dist = {}, arrive = {}, aim = { facing: [], fixated: [], farthest: [], closest: [] }, travel = {}, travelAlong = {}, boom = {}, late = {}, travelT = {}, boomT = {}, lateT = {}; let casts = 0, logs = 0, withFix = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  const cs = ev.filter(e => e.sc === 67 && e.src === boss.addr && e.skill === 80323); if (!cs.length) continue; logs++;
  const isP = a => (agents.get(a) || {}).isPlayer; const P = [...agents.values()].filter(a => a.isPlayer).map(a => a.addr);
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  const pos = new Map(), face = [], life = new Map();
  for (const e of ev) { if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
    else if (e.sc === 21 && e.src === boss.addr) { pb.writeBigUInt64LE(e.dst); face.push([e.t, Math.atan2(pb.readFloatLE(4), pb.readFloatLE(0))]); }
    else if ([3, 4, 5].includes(e.sc) && isP(e.src)) (life.get(e.src) || life.set(e.src, []).get(e.src)).push([e.t, e.sc]); }
  const step = (a, t) => { let r = null; for (const x of pos.get(a) || []) { if (x[0] > t) break; r = x; } return r; };
  const lerp = (a, t) => { const p = pos.get(a) || []; let lo = null, hi = null; for (const x of p) { if (x[0] <= t) lo = x; else { hi = x; break; } } if (!lo || !hi || hi[0] - lo[0] > 800) return null; const k = (t - lo[0]) / (hi[0] - lo[0]); return [lo[1] + k * (hi[1] - lo[1]), lo[2] + k * (hi[2] - lo[2])]; };
  const alive = (a, t) => { let s = 3; for (const x of life.get(a) || []) { if (x[0] > t) break; s = x[1]; } return s === 3; };
  const fx = ev.filter(e => e.skill === 34508 && ((e.sc === 69 && isP(e.dst)) || ((e.sc === 71 || e.sc === 72) && isP(e.src)))).sort((a, b) => a.t - b.t);
  const holderAt = t => { let h = null, end = 0; for (const e of fx) { if (e.t > t) break; if (e.sc === 69) { h = e.dst; end = e.t + e.value; } else if (e.src === h) h = null; } return h != null && end > t ? h : null; };
  const eff = g => ev.filter(e => e.sc === 60 && e.src === boss.addr && gid.get(e.skill) === g).map(e => { pb.writeBigUInt64LE(e.dst); return { t: e.t, x: pb.readInt16LE(0) * 10, y: pb.readInt16LE(2) * 10 }; });
  const marks = eff('EE7B1787'), lands = eff('51A65F90');
  for (const c of cs) { const m = marks.find(x => x.t >= c.t && x.t < c.t + 3000), l = lands.find(x => x.t >= c.t && x.t < c.t + 8000); const bp = step(boss.addr, c.t + 1000); if (!m || !l || !bp) continue; casts++;
    const dx = m.x - bp[1], dy = m.y - bp[2], D = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), ux = dx / D, uy = dy / D; const dk = Math.round(D / 100) * 100; dist[dk] = (dist[dk] || 0) + 1; (arrive[dk] = arrive[dk] || []).push((l.t - c.t) / 1000);
    let fc = null; for (const x of face) { if (x[0] > m.t) break; fc = x[1]; } if (fc != null) aim.facing.push(deg(ang - fc));
    const pl = P.filter(p => alive(p, m.t)).map(p => { const q = lerp(p, m.t); return q ? { p, q, d: Math.hypot(q[0] - bp[1], q[1] - bp[2]) } : null; }).filter(Boolean).sort((a, b) => a.d - b.d); const to = o => deg(ang - Math.atan2(o.q[1] - bp[2], o.q[0] - bp[1]));
    const h = holderAt(m.t); const ho = pl.find(o => o.p === h); if (ho && ho.d > 100) { withFix++; aim.fixated.push(to(ho)); } if (pl.length && pl[pl.length - 1].d > 100) aim.farthest.push(to(pl[pl.length - 1])); if (pl.length && pl[0].d > 100) aim.closest.push(to(pl[0]));
    const d1 = ev.filter(e => e.sc === 0 && !e.buff && e.skill === 80323 && isP(e.dst) && e.t >= c.t && e.t < c.t + 12000), d2 = ev.filter(e => e.sc === 0 && !e.buff && e.skill === 81238 && isP(e.dst) && e.t >= c.t && e.t < c.t + 12000);
    const tk = (o, e) => { const k = (Math.round((e.t - c.t) / 500) / 2).toFixed(1); o[k] = (o[k] || 0) + 1; };
    // travelling orb: hits before it lands
    const trav = d1.filter(e => e.t < l.t); trav.forEach(e => tk(travelT, e)); const hitTrav = new Set(trav.map(e => e.dst)); const tm = trav.length ? med(trav.map(e => e.t)) : (c.t + l.t) / 2;
    for (const p of P) { if (!alive(p, tm)) continue; const first = trav.find(e => e.dst === p); const q = lerp(p, first ? first.t : tm); if (!q) continue; const al = (q[0] - bp[1]) * ux + (q[1] - bp[2]) * uy, sd = Math.abs(-(q[0] - bp[1]) * uy + (q[1] - bp[2]) * ux);
      if (al > 0 && al < D && sd < 600) bump(travel, Math.floor(sd / 50) * 50, hitTrav.has(p)); if (sd < 100 && al > -400 && al < D + 600) bump(travelAlong, Math.floor((al - D) / 100) * 100, hitTrav.has(p)); }
    // explosion (81238) and later ticks of 80323, around the landing point
    d2.forEach(e => tk(boomT, e)); for (const e of d2) { const q = lerp(e.dst, e.t); if (q && e.t >= l.t) { const k = (Math.round((e.t - l.t) / 300) * 0.3).toFixed(1); (wave[k] = wave[k] || []).push(Math.hypot(q[0] - m.x, q[1] - m.y)); } } const hitBoom = new Set(d2.map(e => e.dst)); const tb = d2.length ? med(d2.map(e => e.t)) : l.t + 1000;
    for (const p of P) { if (!alive(p, tb)) continue; const first = d2.find(e => e.dst === p); const q = lerp(p, first ? first.t : tb); if (!q) continue; const r = Math.hypot(q[0] - m.x, q[1] - m.y); if (r < 900) bump(boom, Math.floor(r / 50) * 50, hitBoom.has(p)); if (r >= 350 && r < 1200) { waveHit[1]++; if (hitBoom.has(p)) waveHit[0]++; } }
    const lt = d1.filter(e => e.t >= l.t); lt.forEach(e => { tk(lateT, e); const q = lerp(e.dst, e.t); if (q) { const k = Math.floor(Math.hypot(q[0] - m.x, q[1] - m.y) / 50) * 50; late[k] = (late[k] || 0) + 1; } }); }
}
const tab = o => Object.keys(o).map(Number).sort((a, b) => a - b).map(k => ({ from: k, hitPct: Math.round(100 * o[k][0] / o[k][1]), players: o[k][1] })); const qs = a => ({ p50: Math.round(med(a)), p90: Math.round(a.slice().sort((x, y) => x - y)[Math.floor(0.9 * (a.length - 1))] || 0), within10degPct: Math.round(100 * a.filter(x => x <= 10).length / a.length), n: a.length });
const summary = { logs, casts, landingDistance: dist, arrivalS: Object.fromEntries(Object.entries(arrive).map(([k, v]) => [k, +med(v).toFixed(1)])), aimOffDeg: { vloxxFacing: qs(aim.facing), fixatedPlayer: qs(aim.fixated), farthestPlayer: qs(aim.farthest), closestPlayer: qs(aim.closest) },
  travellingOrb: { hitTimesS: travelT, byDistanceBesideThePath: tab(travel), nearThePathByDistancePastTheLandingPoint: tab(travelAlong) }, explosion: (() => { const pts = Object.entries(wave).filter(([, v]) => v.length >= 30).map(([k, v]) => ({ afterLandingS: +k, radius: Math.round(med(v)), hits: v.length })).sort((a, b) => a.afterLandingS - b.afterLandingS); const a = pts[0], b = pts[pts.length - 1];
    return { skill: 81238, shape: 'ring expanding from the landing point', ringRadiusByTime: pts, speedPerS: Math.round((b.radius - a.radius) / (b.afterLandingS - a.afterLandingS)), reach: b.radius, playersInItsWayHitPct: Math.round(100 * waveHit[0] / waveHit[1]), playersInItsWay: waveHit[1], hitTimesS: boomT }; })(), afterLanding: { skill: 80323, hitTimesS: lateT, hitsByDistanceFromLandingPoint: late } };
fs.writeFileSync(path.join(ROOT, 'data', 'annihilating_orb_summary.json'), JSON.stringify(summary, null, 1));
console.log(`${logs} logs, ${casts} casts | landing distance: ${JSON.stringify(dist)} | arrival: ${JSON.stringify(summary.arrivalS)}`); console.log('aim off (deg):', JSON.stringify(summary.aimOffDeg));
const line = t => t.map(r => `${r.from}:${r.hitPct}%(${r.players})`).join(' ');
console.log('travelling orb, hit times', JSON.stringify(travelT)); console.log('  beside the path:', line(summary.travellingOrb.byDistanceBesideThePath)); console.log('  along (0 = landing point), within 100 of the path:', line(summary.travellingOrb.nearThePathByDistancePastTheLandingPoint));
console.log('explosion 81238 = expanding ring:', JSON.stringify(summary.explosion.ringRadiusByTime), 'speed', summary.explosion.speedPerS, '/s, reach', summary.explosion.reach, '| players in its way hit', summary.explosion.playersInItsWayHitPct + ' % of ' + summary.explosion.playersInItsWay);
console.log('80323 after landing, hit times', JSON.stringify(lateT)); console.log('  hits by distance from landing point:', JSON.stringify(late));
