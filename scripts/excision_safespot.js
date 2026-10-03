// Excision Extremis (Vloxx, skill 81053): is there a safe spot in melee range of Vloxx, and does it depend on how far the
// fixated player stands from Vloxx?
// For every cast with at least 14 slashes: Vloxx's position and facing (last known: Vloxx stands still during the cast), the fixated
// player (buff 34508) and their mean position over the eight damage pulses (4.8 → 8.4 s after the cast starts), and for every other
// living player: mean position over the pulses, largest distance from Vloxx, number of Excision damage events received (blocked,
// evaded and absorbed ones count: the slash did reach the player).
// Geometry: every slash (ground effect GUID B4868841…) is a half-circle of radius ~525; a point at bearing b from the slash origin
// is covered when norm(b + rotation) < 0 (see excision_geometry.js). "Safe" = covered by none of the cast's slashes.
// Usage: node excision_safespot.js [log dir ...]   (default logs/raw)
// Writes data/excision_melee.csv (one row per non-fixated player per cast) and data/excision_safespot_summary.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dirs = process.argv.length > 2 ? process.argv.slice(2) : [path.join(ROOT, 'logs', 'raw')]; const pb = Buffer.alloc(8);
const norm = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; const RAD = 525, HITBOX = 150, MELEE = HITBOX + 300; // melee = within 300 of the edge of Vloxx's hitbox
const PULSES = [4800, 5300, 5800, 6300, 6800, 7300, 7800, 8400];
const q = (a, f) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? Math.round(a[Math.floor(f * (a.length - 1))]) : null; };
const seen = new Set(), files = []; for (const d of dirs) for (const f of fs.readdirSync(d).sort()) if (f.endsWith('.zevtc') && !seen.has(f)) { seen.add(f); files.push(path.join(d, f)); }
const rows = [], casts = []; let logs = 0;
for (const file of files) {
  let pr; try { pr = parseEvtc(file); } catch (e) { continue; } const { agents, ev, evStart, buf } = pr; const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  const cs = ev.filter(e => e.sc === 67 && e.src === boss.addr && e.skill === 81053); if (!cs.length) continue; ev.forEach((e, i) => e.i = i);
  const isP = a => (agents.get(a) || {}).isPlayer; const players = [...agents.values()].filter(a => a.isPlayer);
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  const slashes = ev.filter(e => e.sc === 60 && gid.get(e.skill) === 'B4868841' && e.src === boss.addr).map(e => { pb.writeBigUInt64LE(e.dst); const h = buf.subarray(evStart + e.i * 64, evStart + e.i * 64 + 64);
    return { t: e.t, x: pb.readInt16LE(0) * 10, y: pb.readInt16LE(2) * 10, rot: h.readInt16LE(26) / 1000 }; });
  const pos = new Map(), face = [], life = new Map();
  for (const e of ev) { if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
    else if (e.sc === 21 && e.src === boss.addr) { pb.writeBigUInt64LE(e.dst); face.push([e.t, Math.atan2(pb.readFloatLE(4), pb.readFloatLE(0))]); }
    else if ((e.sc === 3 || e.sc === 4 || e.sc === 5) && isP(e.src)) (life.get(e.src) || life.set(e.src, []).get(e.src)).push([e.t, e.sc]); }
  const step = (a, t) => { let r = null; for (const x of pos.get(a) || []) { if (x[0] > t) break; r = x; } return r; }; const stepF = t => { let r = null; for (const x of face) { if (x[0] > t) break; r = x; } return r; };
  const lerp = (a, t) => { const p = pos.get(a) || []; let lo = null, hi = null; for (const x of p) { if (x[0] <= t) lo = x; else { hi = x; break; } } if (!lo) return hi; if (!hi) return lo; const k = (t - lo[0]) / (hi[0] - lo[0]); return [t, lo[1] + k * (hi[1] - lo[1]), lo[2] + k * (hi[2] - lo[2])]; };
  const alive = (a, t) => { let s = 3; for (const x of life.get(a) || []) { if (x[0] > t) break; s = x[1]; } return s === 3; };
  const fx = ev.filter(e => e.skill === 34508 && ((e.sc === 69 && isP(e.dst)) || ((e.sc === 71 || e.sc === 72) && isP(e.src)))).sort((a, b) => a.t - b.t);
  const holderAt = t => { let h = null, end = 0; for (const e of fx) { if (e.t > t) break; if (e.sc === 69) { h = e.dst; end = e.t + e.value; } else if (e.src === h) h = null; } return h != null && end > t ? h : null; };
  const dmg = ev.filter(e => e.sc === 0 && !e.buff && e.skill === 81053 && e.src === boss.addr && isP(e.dst)); let used = false;
  cs.forEach((c, ci) => { const ss = slashes.filter(s => s.t >= c.t + 4000 && s.t < c.t + 9500); if (ss.length < 14) return; const h = holderAt(c.t + 2500); const bp = step(boss.addr, c.t + 4500), fc = stepF(c.t + 4500); if (!bp || !fc) return;
    const ux = Math.cos(fc[1]), uy = Math.sin(fc[1]); const mean = a => { const ps = PULSES.map(t => lerp(a, c.t + t)); if (ps.some(x => !x)) return null; return { x: ps.reduce((s, p) => s + p[1], 0) / 8 - bp[1], y: ps.reduce((s, p) => s + p[2], 0) / 8 - bp[2], rMax: Math.max(...ps.map(p => Math.hypot(p[1] - bp[1], p[2] - bp[2]))), move: Math.hypot(ps[7][1] - ps[0][1], ps[7][2] - ps[0][2]) }; };
    const F = h != null ? mean(h) : null; const cast = { id: path.basename(file).slice(0, 15) + '#' + (ci + 1), fixated: F ? 1 : 0, dFix: F ? Math.hypot(F.x, F.y) : null, fixMove: F ? F.move : null, F, nMelee: 0, nMeleeHit: 0,
      slashes: ss.map(s => ({ x: s.x - bp[1], y: s.y - bp[2], rot: s.rot })) }; casts.push(cast); used = true;
    for (const p of players) { if (p.addr === h || !alive(p.addr, c.t + 4500) || !alive(p.addr, c.t + 8500)) continue; const m = mean(p.addr); if (!m) continue;
      const hits = dmg.filter(e => e.dst === p.addr && e.t >= c.t + 4000 && e.t < c.t + 9500).length; const melee = m.rMax <= MELEE; if (melee) { cast.nMelee++; if (hits) cast.nMeleeHit++; }
      // side of Vloxx relative to the fixated player: projection of the player on the Vloxx→fixated line
      const proj = F ? (m.x * F.x + m.y * F.y) / (cast.dFix || 1) : null;
      rows.push({ cast: cast.id, fixated: cast.fixated, vloxx_to_fixated: F ? Math.round(cast.dFix) : '', fixated_moved: F ? Math.round(F.move) : '', dist_from_vloxx_mean: Math.round(Math.hypot(m.x, m.y)), dist_from_vloxx_max: Math.round(m.rMax),
        ahead_of_vloxx: Math.round(m.x * ux + m.y * uy), beside_vloxx: Math.round(-m.x * uy + m.y * ux), toward_fixated: proj == null ? '' : Math.round(proj), dist_from_fixated: F ? Math.round(Math.hypot(m.x - F.x, m.y - F.y)) : '', in_melee: melee ? 1 : 0, hits }); } });
  if (used) logs++;
}
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'excision_melee.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const nCov = (c, x, y) => c.slashes.filter(s => { const dx = x - s.x, dy = y - s.y; return Math.hypot(dx, dy) <= RAD && norm(Math.atan2(dy, dx) + s.rot) < 0; }).length;
const pct = (n, d) => d ? Math.round(100 * n / d) : null; const BINS = [[0, 200], [200, 300], [300, 400], [400, 500], [500, 700], [700, 99999]]; const lab = ([a, b]) => b > 9999 ? a + '+' : a + '–' + b;
const st = y => ({ players: y.length, hitPct: pct(y.filter(r => r.hits).length, y.length), meanHits: y.length ? +(y.reduce((s, r) => s + r.hits, 0) / y.length).toFixed(1) : null });
const M = rows.filter(r => r.fixated && r.in_melee); const summary = { logs, casts: casts.length, castsWithFixated: casts.filter(c => c.fixated).length, slashRadius: RAD, meleeRadius: MELEE,
  vloxxToFixated: { p10: q(casts.map(c => c.dFix), .1), p50: q(casts.map(c => c.dFix), .5), p90: q(casts.map(c => c.dFix), .9) }, fixatedMoved: { p50: q(casts.map(c => c.fixMove), .5), p90: q(casts.map(c => c.fixMove), .9) },
  hitsPerPlayerPerCast: { p10: q(rows.map(r => r.hits), .1), p50: q(rows.map(r => r.hits), .5), p90: q(rows.map(r => r.hits), .9), neverHitPct: pct(rows.filter(r => !r.hits).length, rows.length) },
  noFixated: st(rows.filter(r => !r.fixated && r.in_melee)), melee: {}, meleeRing: {}, byDistFromFixated: {}, origins: {} };
for (const b of BINS) { const y = M.filter(r => r.vloxx_to_fixated >= b[0] && r.vloxx_to_fixated < b[1]); const cc = casts.filter(c => c.fixated && c.dFix >= b[0] && c.dFix < b[1]); const c3 = cc.filter(c => c.nMelee >= 3);
  summary.melee[lab(b)] = { ...st(y), fixatedSide: st(y.filter(r => r.toward_fixated > 75)), middle: st(y.filter(r => Math.abs(r.toward_fixated) <= 75)), farSide: st(y.filter(r => r.toward_fixated < -75)), castsWith3InMelee: c3.length, castsNobodyInMeleeHit: c3.filter(c => !c.nMeleeHit).length };
  // geometry: ring 200–450 around Vloxx's centre (50–300 from the hitbox edge), half toward the fixated player vs half away from them
  const acc = { near: [0, 0, 0], far: [0, 0, 0] }; let backClean = 0;
  for (const c of cc) { const base = Math.atan2(c.F.y, c.F.x); let clean = true; for (const r of [200, 325, 450]) for (let an = -165; an <= 180; an += 30) { const th = base + an * Math.PI / 180; const k = nCov(c, r * Math.cos(th), r * Math.sin(th)); const key = Math.abs(an) < 90 ? 'near' : 'far'; acc[key][0]++; if (!k) acc[key][1]++; acc[key][2] += k; if (Math.abs(an) > 120 && k) clean = false; } if (clean) backClean++; }
  summary.meleeRing[lab(b)] = { casts: cc.length, towardFixated: { safePct: pct(acc.near[1], acc.near[0]), meanSlashes: acc.near[0] ? +(acc.near[2] / acc.near[0]).toFixed(1) : null }, awayFromFixated: { safePct: pct(acc.far[1], acc.far[0]), meanSlashes: acc.far[0] ? +(acc.far[2] / acc.far[0]).toFixed(1) : null }, castsBackThirdUntouched: backClean }; }
for (const b of [[0, 250], [250, 450], [450, 650], [650, 1000], [1000, 99999]]) summary.byDistFromFixated[lab(b)] = st(rows.filter(r => r.fixated && r.dist_from_fixated >= b[0] && r.dist_from_fixated < b[1]));
// where the slash origins are: the four on Vloxx (hit direction = Vloxx's facing) and the twelve further out
{ const on = [], off = []; for (const c of casts) for (const s of c.slashes) (Math.hypot(s.x, s.y) < 250 ? on : off).push(Math.hypot(s.x, s.y));
  summary.origins = { onVloxxSharePct: pct(on.length, on.length + off.length), onVloxxDist: { p50: q(on, .5), p90: q(on, .9) }, outerDist: { p10: q(off, .1), p50: q(off, .5), p90: q(off, .9) }, outerWithinReachOfVloxxCentrePct: pct(off.filter(d => d <= RAD).length, off.length) }; }
// Geometry only (no player needed): which part of Vloxx's melee area (HITBOX → MELEE from its centre) does no slash of the cast cover?
// Angles are measured from "directly behind Vloxx" = the direction opposite the fixated player. A "standing spot" is a point whose
// whole neighbourhood of radius SPOT is uncovered and inside the melee area: room for a stack, not a single pixel.
{ const SPOT = 75, GB = [[0, 200], [200, 300], [300, 400], [400, 500], [500, 600], [600, 700], [700, 850], [850, 1000], [1000, 99999]]; const grid = [];
  for (let r = HITBOX; r <= MELEE; r += 50) for (let an = -180; an < 180; an += 10) grid.push({ r, an }); const ring = []; for (let k = 0; k < 8; k++) ring.push([SPOT * Math.cos(k * Math.PI / 4), SPOT * Math.sin(k * Math.PI / 4)]);
  const geo = c => { const back = Math.atan2(-c.F.y, -c.F.x); let safe = 0, backSafe = 0, backN = 0, spots = []; for (const g of grid) { const th = back + g.an * Math.PI / 180, x = g.r * Math.cos(th), y = g.r * Math.sin(th); const ok = !nCov(c, x, y); if (ok) safe++;
      if (Math.abs(g.an) <= 60) { backN++; if (ok) backSafe++; }
      if (ok && g.r >= HITBOX + SPOT && g.r <= MELEE - SPOT && ring.every(([dx, dy]) => !nCov(c, x + dx, y + dy))) spots.push(g); }
    return { safePct: 100 * safe / grid.length, backPct: 100 * backSafe / backN, spot: spots.length > 0, spotBehind: spots.some(g => Math.abs(g.an) <= 60), spotAngles: spots.map(g => Math.abs(g.an)) }; };
  const mk = cc => { const g = cc.map(geo); const ang = g.flatMap(x => x.spotAngles); return { casts: cc.length, meleeAreaSafePct: cc.length ? Math.round(g.reduce((s, x) => s + x.safePct, 0) / g.length) : null, backSectorSafePct: cc.length ? Math.round(g.reduce((s, x) => s + x.backPct, 0) / g.length) : null,
    castsBackSectorFullySafe: g.filter(x => x.backPct === 100).length, castsBackSectorMostlySafe: g.filter(x => x.backPct >= 75).length, castsWithStandingSpot: g.filter(x => x.spot).length, castsWithStandingSpotBehind: g.filter(x => x.spotBehind).length,
    standingSpotAngleFromBehind: ang.length ? { p25: q(ang, .25), p50: q(ang, .5), p75: q(ang, .75) } : null }; };
  summary.safeArea = { spotRadius: SPOT, all: {}, fixatedStill: {}, fixatedMoving: {} }; const withF = casts.filter(c => c.fixated && c.dFix > 50);
  for (const b of GB) { const cc = withF.filter(c => c.dFix >= b[0] && c.dFix < b[1]); summary.safeArea.all[lab(b)] = mk(cc); summary.safeArea.fixatedStill[lab(b)] = mk(cc.filter(c => c.fixMove < 200)); summary.safeArea.fixatedMoving[lab(b)] = mk(cc.filter(c => c.fixMove >= 200)); }
  for (const k of ['all', 'fixatedStill', 'fixatedMoving']) { console.log('safe melee area from the slash geometry, ' + k + ':'); for (const [l, v] of Object.entries(summary.safeArea[k])) if (v.casts) console.log('  ' + l.padEnd(9), 'casts', String(v.casts).padStart(3), '| melee area safe', String(v.meleeAreaSafePct).padStart(3) + ' %', '| back sector (±60°) safe', String(v.backSectorSafePct).padStart(3) + ' %', '| back fully safe in', v.castsBackSectorFullySafe, '| ≥75 % safe in', v.castsBackSectorMostlySafe, '| standing spot in', v.castsWithStandingSpot, '(behind:', v.castsWithStandingSpotBehind + ')', v.standingSpotAngleFromBehind ? '| spot angle from behind p25/50/75 ' + Object.values(v.standingSpotAngleFromBehind).join('/') : ''); } }
fs.writeFileSync(path.join(ROOT, 'data', 'excision_safespot_summary.json'), JSON.stringify(summary, null, 1));
console.log(`${logs} logs, ${casts.length} casts (${summary.castsWithFixated} with a fixated player), ${rows.length} player-casts`);
console.log('players in melee of Vloxx (≤ ' + MELEE + '), by Vloxx–fixated distance:');
for (const [k, v] of Object.entries(summary.melee)) console.log('  ' + k.padEnd(9), `hit ${v.hitPct} % of ${v.players} (mean ${v.meanHits} hits) | fixated side ${v.fixatedSide.hitPct} % (${v.fixatedSide.players}, ${v.fixatedSide.meanHits}) | far side ${v.farSide.hitPct} % (${v.farSide.players}, ${v.farSide.meanHits}) | casts with ≥3 in melee ${v.castsWith3InMelee}, nobody hit ${v.castsNobodyInMeleeHit}`);
console.log('melee ring uncovered by any slash:'); for (const [k, v] of Object.entries(summary.meleeRing)) console.log('  ' + k.padEnd(9), `casts ${v.casts} | toward fixated ${v.towardFixated.safePct} % safe (${v.towardFixated.meanSlashes} slashes) | away ${v.awayFromFixated.safePct} % safe (${v.awayFromFixated.meanSlashes}) | back third untouched in ${v.castsBackThirdUntouched}`);
console.log('by distance from the fixated player:', JSON.stringify(summary.byDistFromFixated)); console.log('origins:', JSON.stringify(summary.origins), '| no fixated:', JSON.stringify(summary.noFixated));
