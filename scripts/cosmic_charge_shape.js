// Cosmic Charge (Vloxx, skill 80512) geometry & timing from raw logs → data/cosmic_charge_summary.json (used by the planner preset).
// Every knockdown pulse (cluster of big hits ≥1,200 dmg, or block/evade/invuln results, within 150 ms) is measured at its exact ms:
// each alive player's position (interpolated) relative to Vloxx's position, hit or not at that pulse.
//  - start pulse (~3.1 s): radius = where the hit rate falls below 50 % (25-unit bands)
//  - dash pulses: frame aligned with the dash direction → side reach (|along| ≤ 150), front reach (|side| ≤ 150), back reach (|side| ≤ 150)
// Also: dash length/direction vs the fixated player, pulse times, trail half-width and how long the trail keeps ticking.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8);
const q = (a, f) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : null; };
const bands = {}; const band = (k, d, h) => { const b = Math.floor(d / 25) * 25; const o = (bands[k] = bands[k] || {}); (o[b] = o[b] || [0, 0])[h ? 0 : 1]++; };
const trail = { hit: [], miss: [] }; const length = [], angle = [], castDur = [], trailEnd = [], pulseT = {}; let casts = 0, logs = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  const cs = ev.filter(e => e.skill === 80512 && e.sc === 67 && e.src === boss.addr); if (!cs.length) continue; logs++;
  const P = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const pos = new Map(); for (const e of ev) if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
  // strict: refuse to interpolate across a long gap (player positions); bosses standing still log sparse positions, so not strict
  const at = (a, t, strict) => { const p = pos.get(a); if (!p) return null; const i = p.findIndex(x => x[0] > t); if (i < 0) return [p[p.length - 1][1], p[p.length - 1][2]]; if (i === 0) return null;
    const [t1, x1, y1] = p[i - 1], [t2, x2, y2] = p[i]; if (strict && t2 - t1 > 600 && Math.min(t - t1, t2 - t) > 300) return null; const k = (t - t1) / (t2 - t1); return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]; };
  // boss: last known position (no interpolation — a standing boss logs no positions, interpolating would land mid-dash)
  const atB = t => { const p = pos.get(boss.addr) || []; let r = null; for (const x of p) { if (x[0] > t) break; r = [x[1], x[2]]; } return r; };
  const state = new Map(); for (const e of ev) if ([3, 4, 5, 6].includes(e.sc)) (state.get(e.src) || state.set(e.src, []).get(e.src)).push([e.t, e.sc]);
  const alive = (a, t) => { let up = true; for (const [tt, sc] of state.get(a) || []) { if (tt > t) break; up = sc === 3 || sc === 6; } return up; };
  const fixEv = ev.filter(e => e.skill === 34508 && e.sc === 69); const holder = t => { let h = null; for (const e of fixEv) { if (e.t > t) break; h = e.dst; } return h; };
  const dmg = ev.filter(e => e.skill === 80512 && e.sc === 0 && e.buff === 0);
  const bigOrAvoid = dmg.filter(e => e.value >= 1200 || (e.value === 0 && [3, 4, 6].includes(e.result)));
  for (const c of cs) {
    const end = ev.find(e => e.skill === 80512 && e.sc === 68 && e.src === boss.addr && e.t > c.t); if (end) castDur.push((end.t - c.t) / 1000);
    const b0 = atB(c.t + 2900), b1 = atB(c.t + 7800); if (!b0 || !b1) continue; casts++;
    const L = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]); length.push(L);
    const h = holder(c.t), hp = h && at(h, c.t); if (hp && L > 100) { const m = Math.atan2(b1[1] - b0[1], b1[0] - b0[0]), p = Math.atan2(hp[1] - b0[1], hp[0] - b0[0]); angle.push(Math.abs(((m - p) * 180 / Math.PI + 540) % 360 - 180)); }
    dmg.filter(e => e.value >= 1200 && e.t >= c.t && e.t <= c.t + 9000).forEach(e => { const k = (Math.round((e.t - c.t) / 100) / 10).toFixed(1); pulseT[k] = (pulseT[k] || 0) + 1; });
    const ticks = dmg.filter(e => e.value > 0 && e.value < 1200 && e.t > c.t && e.t < c.t + 30000); if (ticks.length) trailEnd.push((Math.max(...ticks.map(e => e.t)) - c.t) / 1000);
    if (L < 1000) continue; const ux = (b1[0] - b0[0]) / L, uy = (b1[1] - b0[1]) / L;
    const pulses = []; for (const e of bigOrAvoid) { if (e.t < c.t + 2500 || e.t > c.t + 6200) continue; const p = pulses.find(p => Math.abs(p.t - e.t) < 150); if (p) p.h.add(e.dst); else pulses.push({ t: e.t, h: new Set([e.dst]) }); }
    for (const p of pulses) {
      const b = atB(p.t); if (!b) continue; const isStart = p.t - c.t < 3300;
      for (const pl of P) { if (!alive(pl, p.t)) continue; const qq = at(pl, p.t, true); if (!qq) continue;
        const dx = qq[0] - b[0], dy = qq[1] - b[1], hit = p.h.has(pl);
        if (isStart) { band('start', Math.hypot(dx, dy), hit); continue; }
        const al = dx * ux + dy * uy, pe = Math.abs(-dx * uy + dy * ux);
        if (Math.abs(al) <= 150) band('side', pe, hit); if (pe <= 150 && al > 0) band('front', al, hit); if (pe <= 150 && al < 0) band('back', -al, hit); }
    }
    for (const pl of P) { const tq = at(pl, c.t + 6500, true); if (!tq) continue; const k = Math.max(0, Math.min(1, ((tq[0] - b0[0]) * ux + (tq[1] - b0[1]) * uy) / L)); const pd = Math.hypot(tq[0] - (b0[0] + ux * L * k), tq[1] - (b0[1] + uy * L * k));
      (dmg.some(e => e.dst === pl && e.value > 0 && e.value < 1200 && e.t - c.t > 6300 && e.t - c.t < 6900) ? trail.hit : trail.miss).push(pd); }
  }
}
// reach = start of the first 25-unit band (with ≥ 10 samples) whose hit rate is < 50 % of the inner plateau, after the plateau
const reach = k => { const o = bands[k] || {}; const ks = Object.keys(o).map(Number).sort((a, b) => a - b); const rate = b => o[b][0] / (o[b][0] + o[b][1]);
  const inner = ks.filter(b => b < 350 && o[b][0] + o[b][1] >= 10); const plateau = inner.length ? inner.reduce((s, b) => s + rate(b), 0) / inner.length : 1;
  for (const b of ks) if (b >= 300 && o[b][0] + o[b][1] >= 5 && rate(b) < plateau / 2 && ks.filter(x => x > b && x < b + 100 && o[x][0] + o[x][1] >= 2).every(x => rate(x) < plateau / 2)) return { reach: b, plateauPct: Math.round(100 * plateau) }; return { reach: null, plateauPct: Math.round(100 * plateau) }; };
const trailReach = (() => { let r = 0; for (let lo = 0; lo < 600; lo += 25) { const h = trail.hit.filter(d => d >= lo && d < lo + 25).length, m = trail.miss.filter(d => d >= lo && d < lo + 25).length; if (h + m >= 10 && h / (h + m) >= 0.25) r = lo + 25; } return r; })();
const pulses = Object.entries(pulseT).filter(([, v]) => v >= casts * 0.15).map(([k]) => +k).sort((a, b) => a - b).filter((t, i, a) => !i || t - a[i - 1] > 0.25);
const S = reach('start'), SD = reach('side'), F = reach('front'), B = reach('back');
const out = { skill: 80512, logs, casts, castS: +q(castDur, 0.5).toFixed(2), dashLength: Math.round(q(length, 0.5)),
  angleToFixatedDeg: { p50: Math.round(q(angle, 0.5)), p90: Math.round(q(angle, 0.9)) }, knockPulsesS: pulses,
  startRadius: S.reach, startPlateauPct: S.plateauPct, dashSideReach: SD.reach, dashFrontReach: F.reach, dashBackReach: B.reach, dashPlateauPct: SD.plateauPct,
  trailHalfWidth: trailReach, trailEndS: +q(trailEnd, 0.5).toFixed(1),
  bands: Object.fromEntries(Object.entries(bands).map(([k, o]) => [k, Object.fromEntries(Object.entries(o).filter(([b]) => +b >= 300 && +b < 900).map(([b, [h, m]]) => [b, `${h}/${h + m}`]))])),
  note: 'reach = where the hit rate drops below half of the inner plateau; dash pulses hit only ~60 % of players in range per pulse (unexplained)' };
fs.writeFileSync(path.join(ROOT, 'data', 'cosmic_charge_summary.json'), JSON.stringify(out, null, 1));
console.log({ ...out, bands: '(in json)' });
