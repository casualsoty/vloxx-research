// Excision Extremis (Vloxx 81053; last phase 80901; Aspect of the Sword 81326) geometry: do the slashes match their telegraphs?
// Telegraph = ground effect GUID A5962B65… (lasts 2.5 s). Slash = ground effect GUID B4868841…, created exactly 2.0 s later at
// the same position: the damage pulse. z rotation of an effect = int16 at byte 26 of the event, in mrad, CLOCKWISE:
// a player at bearing b (atan2(dy, dx) from the effect origin) is on the hit side when norm(b + rot) is in (−180°, 0°).
// Measures: telegraph ↔ slash position offset and rotation difference, mismatch rate per pulse, how the mismatch relates to
// Vloxx turning between telegraph and slash, and the hit rate by angle / distance in the slash frame and in the telegraph frame.
// Writes data/excision_slashes.csv (one row per slash) and data/excision_summary.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8);
const EE = new Set([81053, 81326, 80901]);
const norm = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; const deg = a => Math.round(a * 180 / Math.PI);
const rows = [], byPulse = {}, rad = {}, frame = { slash: { ok: [0, 0, 0, 0], bad: [0, 0, 0, 0] }, tele: { ok: [0, 0, 0, 0], bad: [0, 0, 0, 0] } }; // [hitSide hit, hitSide n, otherSide hit, otherSide n]
const perCast = {}; let logs = 0, turnMatch = 0, mismVloxx = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev, evStart, buf } = parseEvtc(path.join(dir, f)); if (!ev.some(e => EE.has(e.skill) && e.sc === 67)) continue; logs++;
  const s9 = ev.find(e => e.sc === 9); ev.forEach((e, i) => e.i = i);
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  const fx = g => ev.filter(e => e.sc === 60 && gid.get(e.skill) === g).map(e => { pb.writeBigUInt64LE(e.dst); const h = buf.subarray(evStart + e.i * 64, evStart + e.i * 64 + 64);
    return { t: e.t, src: e.src, x: pb.readInt16LE(0) * 10, y: pb.readInt16LE(2) * 10, rot: h.readInt16LE(26) / 1000 }; });
  const teles = fx('A5962B65'), slashes = fx('B4868841'); if (!slashes.length) continue;
  const P = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const pos = new Map(), face = new Map();
  for (const e of ev) { if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
    else if (e.sc === 21) { pb.writeBigUInt64LE(e.dst); (face.get(e.src) || face.set(e.src, []).get(e.src)).push([e.t, Math.atan2(pb.readFloatLE(4), pb.readFloatLE(0))]); } }
  const step = (m, a, t) => { let r = null; for (const x of m.get(a) || []) { if (x[0] > t) break; r = x; } return r; };
  const interp = (a, t) => { const p = pos.get(a); if (!p) return null; const i = p.findIndex(x => x[0] > t); if (i <= 0) return null; const [t1, x1, y1] = p[i - 1], [t2, x2, y2] = p[i];
    if (t2 - t1 > 600 && Math.min(t - t1, t2 - t) > 300) return null; const k = (t - t1) / (t2 - t1); return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]; };
  const hits = ev.filter(e => EE.has(e.skill) && e.sc === 0 && e.buff === 0 && P.includes(e.dst));
  const casts = ev.filter(e => EE.has(e.skill) && e.sc === 67);
  for (const c of casts.filter(c => c.skill === 81053)) { const n = slashes.filter(s => s.src === c.src && s.t >= c.t && s.t - c.t < 10000).length; perCast[n] = (perCast[n] || 0) + 1; }
  for (const s of slashes) {
    const owner = ((agents.get(s.src) || {}).name || '?').split('\0')[0];
    const te = teles.find(t => t.src === s.src && Math.abs(s.t - t.t - 2000) <= 60 && Math.hypot(t.x - s.x, t.y - s.y) < 20);
    const c = casts.filter(c => c.src === s.src && c.t <= s.t && s.t - c.t < 12000).pop(); const pulse = c ? (Math.round((s.t - c.t) / 100) / 10).toFixed(1) : '';
    const d = te ? norm(s.rot - te.rot) : null; const mism = te ? Math.abs(Math.abs(d) - Math.PI) > 0.17 : null;
    let turn = null; if (te) { const f1 = step(face, s.src, te.t), f2 = step(face, s.src, s.t); if (f1 && f2) turn = norm(f2[1] - f1[1]); }
    const extra = d == null ? null : norm(d - Math.PI);
    if (te && c && c.skill === 81053) { (byPulse[pulse] = byPulse[pulse] || [0, 0])[mism ? 0 : 1]++; if (mism) { mismVloxx++; if (turn != null && Math.abs(norm(extra + turn)) < 0.26) turnMatch++; } }
    const hitSet = new Set(hits.filter(e => e.src === s.src && Math.abs(e.t - s.t) <= 120).map(e => e.dst));
    rows.push({ log: f.replace('.zevtc', ''), t: ((s.t - s9.t) / 1000).toFixed(2), caster: owner, skill: c ? c.skill : '', pulse_s: pulse, x: s.x, y: s.y, slash_rot_deg: deg(s.rot), telegraph: te ? 1 : 0,
      tele_offset: te ? Math.round(Math.hypot(te.x - s.x, te.y - s.y)) : '', rot_diff_deg: te ? deg(d) : '', mismatch: mism == null ? '' : mism ? 1 : 0, boss_turn_deg: turn == null ? '' : deg(turn), players_hit: hitSet.size });
    // hit rate by side / distance (players near the other slash of the same pulse are skipped)
    const others = slashes.filter(x => x !== s && Math.abs(x.t - s.t) <= 150);
    for (const p of P) { const q = interp(p, s.t); if (!q) continue; const dx = q[0] - s.x, dy = q[1] - s.y, dd = Math.hypot(dx, dy); if (dd > 900) continue; if (others.some(x => Math.hypot(q[0] - x.x, q[1] - x.y) < 700)) continue;
      const b = Math.atan2(dy, dx), h = hitSet.has(p); const aS = norm(b + s.rot);
      if (te && aS < -0.26 && aS > -2.88) { const k = Math.floor(dd / 50) * 50; (rad[k] = rad[k] || [0, 0])[h ? 0 : 1]++; }
      if (dd < 60 || dd > 480 || !te) continue; const grp = mism ? 'bad' : 'ok';
      const sideS = aS < 0, sideT = norm(b + te.rot) > 0; // telegraph is drawn 180° from the slash, so its hit side is the positive half
      frame.slash[grp][sideS ? 0 : 2] += h ? 1 : 0; frame.slash[grp][sideS ? 1 : 3]++; frame.tele[grp][sideT ? 0 : 2] += h ? 1 : 0; frame.tele[grp][sideT ? 1 : 3]++; }
  }
}
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'excision_slashes.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : null; const withT = rows.filter(r => r.telegraph); const vl = withT.filter(r => r.skill === 81053);
// radius = where the hit rate on the hit side drops below 50 %
let radius = null; for (const k of Object.keys(rad).map(Number).sort((a, b) => a - b)) { const [h, m] = rad[k]; if (k >= 200 && h + m >= 10 && h / (h + m) < 0.5) { radius = k; break; } }
const side = v => ({ hitSide: pct(v[0], v[1]), otherSide: pct(v[2], v[3]), n: v[1] + v[3] });
const summary = { logs, slashes: rows.length, byCaster: rows.reduce((o, r) => (o[r.caster] = (o[r.caster] || 0) + 1, o), {}), withTelegraph: withT.length,
  telegraphDelayS: 2.0, positionOffsetOver20: withT.filter(r => +r.tele_offset > 20).length, slashesPerVloxxCast: perCast,
  vloxx: { matched: vl.length, mismatch: vl.filter(r => r.mismatch === 1).length, mismatchPct: pct(vl.filter(r => r.mismatch === 1).length, vl.length),
    mismatchByPulseS: Object.fromEntries(Object.entries(byPulse).filter(([, v]) => v[0] + v[1] >= 40).sort((a, b) => a[0] - b[0]).map(([k, [m, ok]]) => [k, { n: m + ok, mismatchPct: pct(m, m + ok) }])),
    mismatchEqualsBossTurn: turnMatch, mismatchTotal: mismVloxx },
  hitRatePct: { slashFrame: { matching: side(frame.slash.ok), mismatched: side(frame.slash.bad) }, telegraphFrame: { matching: side(frame.tele.ok), mismatched: side(frame.tele.bad) } },
  semicircleRadius: radius, radiusBands: Object.fromEntries(Object.entries(rad).sort((a, b) => a[0] - b[0]).map(([k, [h, m]]) => [k, `${h}/${h + m}`])) };
fs.writeFileSync(path.join(ROOT, 'data', 'excision_summary.json'), JSON.stringify(summary, null, 1));
console.log({ ...summary, radiusBands: '(in json)' }); console.log(JSON.stringify(summary.hitRatePct, null, 1)); console.log(JSON.stringify(summary.vloxx.mismatchByPulseS));
