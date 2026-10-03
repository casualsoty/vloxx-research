// Echoing Blade (Vloxx, skill 81271): the spinning half-circle centred on Vloxx, with projectiles. From raw logs.
// Telegraph = ground effect GUID A5962B65… (shared with Excision Extremis); slash = ground effect GUID 40EF37BF…, 0.8 s later, at
// Vloxx's position. Effect z rotation = int16 at byte 26 (mrad, clockwise): a player at bearing b from the origin is on the hit
// side when norm(b + rot) < 0. Measures: pulses per cast, rotation step between pulses, telegraph ↔ slash mismatch per pulse,
// semicircle radius, hit rate on each side, projectiles (missile launch events 58) per cast / per pulse and their launch distance.
// Writes data/echoing_blade_summary.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8), b12 = Buffer.alloc(12);
const norm = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; const deg = a => Math.round(a * 180 / Math.PI);
const i16 = e => { b12.writeInt32LE(e.value, 0); b12.writeInt32LE(e.buffDmg, 4); b12.writeUInt32LE(e.over, 8); return [0, 2, 4, 6, 8, 10].map(o => b12.readInt16LE(o) * 10); };
const q = (a, f) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : null; };
const durs = {}, steps = {}, firstStep = {}, byPulse = {}, rad = {}, side = [0, 0, 0, 0], missPerCast = {}, missPulse = {}, launchDist = [], fromBoss = [], delay = {}; let logs = 0, casts = 0, slashesN = 0, reflectedOnBoss = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev, evStart, buf } = parseEvtc(path.join(dir, f)); const cs = ev.filter(e => e.skill === 81271 && e.sc === 67); if (!cs.length) continue; logs++; ev.forEach((e, i) => e.i = i);
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  const boss = cs[0].src; const isP = a => (agents.get(a) || {}).isPlayer; const P = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const fx = g => ev.filter(e => e.sc === 60 && gid.get(e.skill) === g && e.src === boss).map(e => { pb.writeBigUInt64LE(e.dst); const h = buf.subarray(evStart + e.i * 64, evStart + e.i * 64 + 64);
    return { t: e.t, x: pb.readInt16LE(0) * 10, y: pb.readInt16LE(2) * 10, rot: h.readInt16LE(26) / 1000 }; });
  const teles = fx('A5962B65'), slashes = fx('40EF37BF');
  const pos = new Map(); for (const e of ev) if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
  const stepB = t => { let r = null; for (const x of pos.get(boss) || []) { if (x[0] > t) break; r = x; } return r; };
  const interp = (a, t) => { const p = pos.get(a); if (!p) return null; const i = p.findIndex(x => x[0] > t); if (i <= 0) return null; const [t1, x1, y1] = p[i - 1], [t2, x2, y2] = p[i];
    if (t2 - t1 > 600 && Math.min(t - t1, t2 - t) > 300) return null; const k = (t - t1) / (t2 - t1); return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]; };
  const hits = ev.filter(e => e.skill === 81271 && e.sc === 0 && e.buff === 0 && e.src === boss && isP(e.dst));
  reflectedOnBoss += ev.filter(e => e.skill === 81271 && e.sc === 0 && e.buff === 0 && isP(e.src) && e.dst === boss).length;
  for (const c of cs) { casts++; const end = ev.find(e => e.skill === 81271 && e.sc === 68 && e.src === boss && e.t > c.t); const d = end ? (Math.round((end.t - c.t) / 100) / 10).toFixed(1) : '?'; durs[d] = (durs[d] || 0) + 1;
    const ts = teles.filter(t => t.t >= c.t && t.t - c.t < 4800); if (ts.length >= 8) { for (let i = 1; i < 8; i++) { const st = deg(norm(ts[i].rot - ts[i - 1].rot)); (i === 1 ? firstStep : steps)[st] = ((i === 1 ? firstStep : steps)[st] || 0) + 1; } }
    const ms = ev.filter(e => e.skill === 81271 && e.sc === 58 && e.src === boss && e.t >= c.t && e.t - c.t < 6000); missPerCast[ms.length] = (missPerCast[ms.length] || 0) + 1;
    for (const m of ms) { const p = (Math.round((m.t - c.t) / 100) / 10).toFixed(1); missPulse[p] = (missPulse[p] || 0) + 1; const v = i16(m); const b = stepB(m.t); if (b) launchDist.push(Math.round(Math.hypot(v[3] - b[1], v[4] - b[2]))); }
    for (const s of slashes.filter(s => s.t >= c.t && s.t - c.t < 6500)) { slashesN++; const b = stepB(s.t); if (b) fromBoss.push(Math.round(Math.hypot(s.x - b[1], s.y - b[2])));
      const pulse = (Math.round((s.t - c.t) / 100) / 10).toFixed(1); const te = teles.filter(t => s.t - t.t > 300 && s.t - t.t < 1500 && Math.hypot(t.x - s.x, t.y - s.y) < 20).pop();
      if (te) { const dl = ((s.t - te.t) / 1000).toFixed(1); delay[dl] = (delay[dl] || 0) + 1; const dd = norm(s.rot - te.rot); const mism = Math.abs(dd) > 0.17 && Math.abs(Math.abs(dd) - Math.PI) > 0.17; (byPulse[pulse] = byPulse[pulse] || [0, 0])[mism ? 0 : 1]++; }
      const hitSet = new Set(hits.filter(e => Math.abs(e.t - s.t) <= 150).map(e => e.dst));
      for (const p of P) { const qq = interp(p, s.t); if (!qq) continue; const dx = qq[0] - s.x, dy = qq[1] - s.y, r = Math.hypot(dx, dy); if (r > 900) continue; const a = norm(Math.atan2(dy, dx) + s.rot), h = hitSet.has(p);
        if (a < -0.26 && a > -2.88) { const k = Math.floor(r / 50) * 50; (rad[k] = rad[k] || [0, 0])[h ? 0 : 1]++; }
        if (r > 60 && r < 450 && Math.abs(Math.abs(a) - Math.PI / 2) < 1.2) { const hs = a < 0; side[hs ? 0 : 2] += h ? 1 : 0; side[hs ? 1 : 3]++; } } } }
}
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : null; const topKey = o => +Object.entries(o).sort((a, b) => b[1] - a[1])[0][0];
let radius = null; for (const k of Object.keys(rad).map(Number).sort((a, b) => a - b)) { const [h, m] = rad[k]; if (k >= 200 && h + m >= 10 && h / (h + m) < 0.5) { radius = k; break; } }
const out = { skill: 81271, logs, casts, castS: topKey(durs), slashes: slashesN, slashOriginFromVloxx: { p50: q(fromBoss, 0.5), p90: q(fromBoss, 0.9) }, telegraphDelayS: topKey(delay),
  pulsesS: Object.keys(byPulse).filter(k => byPulse[k][0] + byPulse[k][1] >= casts * 0.3).map(Number).sort((a, b) => a - b), rotationStepDeg: steps, firstStepDeg: firstStep,
  mismatchByPulsePct: Object.fromEntries(Object.entries(byPulse).filter(([, v]) => v[0] + v[1] >= casts * 0.3).sort((a, b) => a[0] - b[0]).map(([k, [m, ok]]) => [k, pct(m, m + ok)])),
  semicircleRadius: radius, radiusBands: Object.fromEntries(Object.entries(rad).sort((a, b) => a[0] - b[0]).map(([k, [h, m]]) => [k, `${h}/${h + m}`])),
  hitRatePct: { hitSide: pct(side[0], side[1]), otherSide: pct(side[2], side[3]) }, projectilesPerCast: missPerCast,
  projectileLaunchFromVloxx: { p50: q(launchDist, 0.5), p90: q(launchDist, 0.9) }, reflectedHitsOnVloxx: reflectedOnBoss };
fs.writeFileSync(path.join(ROOT, 'data', 'echoing_blade_summary.json'), JSON.stringify(out, null, 1));
console.log({ ...out, radiusBands: '(in json)' });
