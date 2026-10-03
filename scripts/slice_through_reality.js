// Slice Through Reality (Vloxx, skill 80585): size of its two hits, from raw logs.
// During the cast Vloxx spawns ground effect GUID BA8654BD… twice: at ~1.24 s on its own position (departure) and at ~2.60 s on the
// point it teleports to (arrival). Vloxx's logged position only updates ~4.2 s into the cast, so distances must be taken from the
// effect positions, not from the agent position.
// Hit 1 = damage within 1.0–1.6 s of the cast start, measured from the departure point.
// Hit 2 = damage from the arrival effect until 1.6 s later (several pulses), measured from the departure point too: in a frame
// along the teleport direction (ahead = toward the arrival point) and beside it. The arrival point itself is checked as well.
// Portal: the area left at the departure point is a portal. For every hit from the arrival effect on (up to 9 s later): where the
// player was just before the hit (distance from the departure point) and 1.2 s after it (distance from the arrival point).
// The portal effects themselves are GUID D33CD046… (9 s), spawned at the departure point ~2.2 s and at the arrival point ~3.6 s.
// Writes data/slice_through_reality_summary.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8);
const med = a => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
const h1 = {}, h2r = {}, h2g = {}, arr = [0, 0], tele = [], tA = [], tB = [], pulses = {}; let casts = 0, logs = 0; const port = { hits: 0, ported: 0, inD: [], outD: [], lateD: [], hitsBySecond: {}, portalFx: { entranceAt: [], exitAt: [], dur: [] } };
const qq = (a, f) => { a = a.slice().sort((x, y) => x - y); return a.length ? Math.round(a[Math.floor(f * (a.length - 1))]) : null; };
const bump = (o, k, hit) => { o[k] = o[k] || [0, 0]; o[k][1]++; if (hit) o[k][0]++; };
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  const cs = ev.filter(e => e.sc === 67 && e.src === boss.addr && e.skill === 80585); if (!cs.length) continue; logs++;
  const isP = a => (agents.get(a) || {}).isPlayer; const P = [...agents.values()].filter(a => a.isPlayer).map(a => a.addr);
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  const pos = new Map(), life = new Map();
  for (const e of ev) { if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
    else if ([3, 4, 5].includes(e.sc) && isP(e.src)) (life.get(e.src) || life.set(e.src, []).get(e.src)).push([e.t, e.sc]); }
  const lerp = (a, t) => { const p = pos.get(a) || []; let lo = null, hi = null; for (const x of p) { if (x[0] <= t) lo = x; else { hi = x; break; } } if (!lo || !hi || hi[0] - lo[0] > 800) return null; const k = (t - lo[0]) / (hi[0] - lo[0]); return [lo[1] + k * (hi[1] - lo[1]), lo[2] + k * (hi[2] - lo[2])]; };
  const step = (a, t) => { let r = null; for (const x of pos.get(a) || []) { if (x[0] > t) break; r = x; } return r; };
  const alive = (a, t) => { let s = 3; for (const x of life.get(a) || []) { if (x[0] > t) break; s = x[1]; } return s === 3; };
  for (const c of cs) { const fx = ev.filter(e => e.sc === 60 && e.src === boss.addr && gid.get(e.skill) === 'BA8654BD' && e.t >= c.t && e.t < c.t + 4000).map(e => { pb.writeBigUInt64LE(e.dst); return { t: e.t, x: pb.readInt16LE(0) * 10, y: pb.readInt16LE(2) * 10 }; });
    if (fx.length !== 2) continue; casts++; const [A, B] = fx; const L = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L; tele.push(L); tA.push((A.t - c.t) / 1000); tB.push((B.t - c.t) / 1000);
    const dmg = ev.filter(e => e.sc === 0 && !e.buff && e.skill === 80585 && isP(e.dst) && e.t >= c.t && e.t < c.t + 6000);
    const s1 = new Set(dmg.filter(e => e.t >= A.t - 150 && e.t < A.t + 400).map(e => e.dst)); const d2 = dmg.filter(e => e.t >= B.t - 100 && e.t < B.t + 1600); const s2 = new Set(d2.map(e => e.dst));
    for (const e of ev) if (e.sc === 60 && !isP(e.src) && gid.get(e.skill) === 'D33CD046' && e.t >= c.t && e.t < c.t + 6000) { pb.writeBigUInt64LE(e.dst); const x = pb.readInt16LE(0) * 10, y = pb.readInt16LE(2) * 10; if (Math.hypot(x - A.x, y - A.y) < 60) port.portalFx.entranceAt.push((e.t - c.t) / 1000); else if (Math.hypot(x - B.x, y - B.y) < 60) port.portalFx.exitAt.push((e.t - c.t) / 1000); }
    for (const h of ev) if (h.sc === 0 && !h.buff && h.skill === 80585 && isP(h.dst) && h.t >= B.t - 100 && h.t < c.t + 11500) { const b4 = step(h.dst, h.t - 1), af = step(h.dst, h.t + 1200); if (!b4 || !af) continue; port.hits++; const dA = Math.hypot(b4[1] - A.x, b4[2] - A.y), dB = Math.hypot(af[1] - B.x, af[2] - B.y);
      port.inD.push(dA); const k = Math.floor((h.t - c.t) / 1000); port.hitsBySecond[k] = (port.hitsBySecond[k] || 0) + 1; if (h.t > B.t + 1700) port.lateD.push(dA); if (dB < 500 && dA < 700) { port.ported++; port.outD.push(dB); } }
    d2.forEach(e => { const k = (Math.round((e.t - c.t) / 200) * 0.2).toFixed(1); pulses[k] = (pulses[k] || 0) + 1; });
    for (const p of P) { if (!alive(p, A.t)) continue; const q = lerp(p, A.t); if (q) { const d = Math.hypot(q[0] - A.x, q[1] - A.y); if (d < 900) bump(h1, Math.floor(d / 50) * 50, s1.has(p)); }
      if (!alive(p, B.t)) continue; const first = d2.find(e => e.dst === p); const r = lerp(p, first ? first.t : B.t + 300); if (!r) continue;
      const dx = r[0] - A.x, dy = r[1] - A.y, d = Math.hypot(dx, dy), al = dx * ux + dy * uy, sd = Math.abs(-dx * uy + dy * ux);
      if (d < 900) bump(h2r, Math.floor(d / 50) * 50, s2.has(p)); if (al >= -500 && al < 1000 && sd < 600) bump(h2g, Math.floor(al / 250) * 250 + '|' + Math.floor(sd / 100) * 100, s2.has(p));
      if (Math.hypot(r[0] - B.x, r[1] - B.y) < 400) bump({ a: arr }, 'a', s2.has(p)); } }
}
const tab = o => Object.keys(o).map(Number).sort((a, b) => a - b).map(k => ({ from: k, to: k + 50, hitPct: Math.round(100 * o[k][0] / o[k][1]), players: o[k][1] }));
const summary = { logs, casts, departureEffectAtS: +med(tA).toFixed(2), arrivalEffectAtS: +med(tB).toFixed(2), teleportDistance: { median: Math.round(med(tele)), min: Math.round(Math.min(...tele)), max: Math.round(Math.max(...tele)), castsWithin50OfMedian: tele.filter(x => Math.abs(x - med(tele)) <= 50).length },
  hit1ByDistanceFromVloxx: tab(h1), hit2ByDistanceFromDeparturePoint: tab(h2r), hit2Grid: Object.entries(h2g).map(([k, v]) => { const [al, sd] = k.split('|').map(Number); return { aheadFrom: al, besideFrom: sd, hitPct: Math.round(100 * v[0] / v[1]), players: v[1] }; }).sort((a, b) => a.aheadFrom - b.aheadFrom || a.besideFrom - b.besideFrom),
  hit2PulseTimesS: pulses, portal: { hitsFromArrivalOn: port.hits, playerAtExitAfterHitPct: Math.round(100 * port.ported / port.hits), distanceFromEntranceWhenHit: { p50: qq(port.inD, .5), p90: qq(port.inD, .9), max: qq(port.inD, 1) }, landingDistanceFromExitCentre: { p50: qq(port.outD, .5), p90: qq(port.outD, .9), max: qq(port.outD, 1) },
    lateHits: { n: port.lateD.length, distanceFromEntrance: { p10: qq(port.lateD, .1), p50: qq(port.lateD, .5), p90: qq(port.lateD, .9) } }, hitsBySecondOfCast: port.hitsBySecond, entranceEffectAtS: +med(port.portalFx.entranceAt).toFixed(1), exitEffectAtS: +med(port.portalFx.exitAt).toFixed(1), effectDurationS: 9 }, playersWithin400OfArrivalPoint: { players: arr[1], hit: arr[0] } };
fs.writeFileSync(path.join(ROOT, 'data', 'slice_through_reality_summary.json'), JSON.stringify(summary, null, 1));
console.log(`${logs} logs, ${casts} casts | effects at ${summary.departureEffectAtS} s (departure) and ${summary.arrivalEffectAtS} s (arrival) | teleport ${summary.teleportDistance.median} (${summary.teleportDistance.min}–${summary.teleportDistance.max})`);
console.log('hit 1, by distance from Vloxx:        ' + summary.hit1ByDistanceFromVloxx.filter(r => r.from < 700).map(r => `${r.from}:${r.hitPct}%(${r.players})`).join(' '));
console.log('hit 2, by distance from the same spot: ' + summary.hit2ByDistanceFromDeparturePoint.filter(r => r.from < 700).map(r => `${r.from}:${r.hitPct}%(${r.players})`).join(' '));
console.log('hit 2 grid (ahead = toward the arrival point | beside):'); for (const g of summary.hit2Grid) if (g.players >= 3) console.log(`  ahead ${g.aheadFrom}..${g.aheadFrom + 250}, beside ${g.besideFrom}–${g.besideFrom + 100}: ${g.hitPct} % (${g.players})`);
console.log('portal:', JSON.stringify(summary.portal));
console.log('hit 2 pulse times (s after cast start):', JSON.stringify(pulses), '| players within 400 of the arrival point hit:', arr[0] + '/' + arr[1]);
