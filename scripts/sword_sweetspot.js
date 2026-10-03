// Aspect of the Sword — Division Eternal (skill 81330): what it is, who it is aimed at, and when the squad stacked on Vloxx is safe.
// The attack: a first hit around the Sword ~0.4 s into the cast, then a line of 6 half-circle slashes (the Excision slash effect,
// radius ~525) marching outward along the Sword's facing, 250 apart (75 → 1,325 from the Sword), at 0.8 → 1.8 s. The facing is
// set at the start of the cast and does not change.
// Measured here: the hit zone in the Sword's frame, which player the line is aimed at (farthest / closest / fixated / …), and how
// often players stacked within 400 of Vloxx are hit depending on where Vloxx is relative to the line.
// usage: node scripts/sword_sweetspot.js [folder with .zevtc]   (default logs/raw) → data/sword_casts.csv, data/sword_division_summary.json
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = process.argv[2] || path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8);
const norm = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; const dg = a => Math.abs(norm(a)) * 180 / Math.PI;
const rows = [], grid = {}, firstBand = {}, rule = {}; const ok = (k, v) => { (rule[k] = rule[k] || [0, 0])[1]++; if (v) rule[k][0]++; }; let logs = 0;
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.zevtc')).sort()) {
  let pr; try { pr = parseEvtc(path.join(dir, f)); } catch (e) { continue; } const { agents, ev } = pr; const s9 = ev.find(e => e.sc === 9); if (!s9) continue;
  const swords = new Set([...agents.values()].filter(a => /Aspect of the Sword/.test(a.name || '')).map(a => a.addr)); if (!swords.size) continue;
  const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue; const isP = a => (agents.get(a) || {}).isPlayer; const P = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const casts = ev.filter(e => e.sc === 67 && swords.has(e.src) && e.skill === 81330); if (!casts.length) continue; logs++;
  const pos = new Map(), face = new Map();
  for (const e of ev) { if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
    else if (e.sc === 21 && swords.has(e.src)) { pb.writeBigUInt64LE(e.dst); (face.get(e.src) || face.set(e.src, []).get(e.src)).push([e.t, Math.atan2(pb.readFloatLE(4), pb.readFloatLE(0))]); } }
  const step = (m, a, t) => { let r = null; for (const x of m.get(a) || []) { if (x[0] > t) break; r = x; } return r; };
  const interp = (a, t) => { const p = pos.get(a); if (!p) return null; const i = p.findIndex(x => x[0] > t); if (i <= 0) return null; const [t1, x1, y1] = p[i - 1], [t2, x2, y2] = p[i]; if (t2 - t1 > 1500) return [x1, y1]; const k = (t - t1) / (t2 - t1); return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]; };
  const state = new Map(); for (const e of ev) if ([3, 4, 5, 6].includes(e.sc) && isP(e.src)) (state.get(e.src) || state.set(e.src, []).get(e.src)).push([e.t, e.sc]);
  const st = (a, t) => { let s = 'up'; for (const [tt, sc] of state.get(a) || []) { if (tt > t) break; s = sc === 5 ? 'down' : sc === 4 ? 'dead' : 'up'; } return s; };
  const fx = ev.filter(e => e.skill === 34508 && ((e.sc === 69 && isP(e.dst)) || ((e.sc === 71 || e.sc === 72) && isP(e.src)))).sort((a, b) => a.t - b.t);
  const holderAt = t => { let h = null, end = 0; for (const e of fx) { if (e.t > t) break; if (e.sc === 69) { h = e.dst; end = e.t + e.value; } else if (e.src === h) h = null; } return h != null && end > t ? h : null; };
  const lp = ev.find(e => e.skill === 81071 && e.sc === 67);
  for (const c of casts) { const fc = step(face, c.src, c.t + 600), sp = step(pos, c.src, c.t), bp = step(pos, boss.addr, c.t); if (!fc || !sp || !bp || fc[0] < c.t - 100) continue; // facing set at the start of this cast
    const dmg = ev.filter(e => e.skill === 81330 && e.sc === 0 && e.buff === 0 && e.src === c.src && isP(e.dst) && e.t >= c.t && e.t <= c.t + 3500);
    const first = new Set(dmg.filter(e => e.t < c.t + 600).map(e => e.dst)), line = new Set(dmg.filter(e => e.t >= c.t + 600).map(e => e.dst));
    const ux = Math.cos(fc[1]), uy = Math.sin(fc[1]);
    // who is the line aimed at (positions at the cast start)
    const cand = P.map(p => { const q = interp(p, c.t); return q && st(p, c.t) !== 'dead' ? { p, dS: Math.hypot(q[0] - sp[1], q[1] - sp[2]), dB: Math.hypot(q[0] - bp[1], q[1] - bp[2]), o: dg(Math.atan2(q[1] - sp[2], q[0] - sp[1]) - fc[1]) } : null; }).filter(Boolean);
    let target = null; if (cand.length >= 6) { const best = cand.slice().sort((a, b) => a.o - b.o)[0]; ok('a player within 3° of the line', best.o < 3);
      if (best.o < 3) { target = best; const far = cand.slice().sort((a, b) => b.dS - a.dS), h = holderAt(c.t); ok('the farthest player from the Sword', far[0].p === best.p); ok('one of the 2 farthest from the Sword', far.slice(0, 2).some(x => x.p === best.p));
        ok('the closest player to the Sword', far[far.length - 1].p === best.p); ok('the farthest player from Vloxx', cand.slice().sort((a, b) => b.dB - a.dB)[0].p === best.p); if (h != null) ok('the fixated player', h === best.p); ok('(chance = 1 / players)', Math.random() < 1 / cand.length); } }
    // hit zone in the Sword frame (positions 1.2 s into the cast for the line, 0.4 s for the first hit)
    const all = P.filter(p => st(p, c.t) === 'up').map(p => { const q = interp(p, c.t + 1200), q0 = interp(p, c.t + 400); if (!q || !q0) return null; const dx = q[0] - sp[1], dy = q[1] - sp[2];
      return { p, al: dx * ux + dy * uy, sd: Math.abs(-dx * uy + dy * ux), dS0: Math.hypot(q0[0] - sp[1], q0[1] - sp[2]), dB: Math.hypot(q[0] - bp[1], q[1] - bp[2]) }; }).filter(Boolean);
    for (const o of all) { const k = Math.floor(o.al / 200) * 200 + ',' + Math.floor(o.sd / 100) * 100; (grid[k] = grid[k] || [0, 0])[line.has(o.p) ? 0 : 1]++; const k2 = Math.floor(o.dS0 / 100) * 100; (firstBand[k2] = firstBand[k2] || [0, 0])[first.has(o.p) ? 0 : 1]++; }
    const stack = all.filter(o => o.dB < 400); const bAl = (bp[1] - sp[1]) * ux + (bp[2] - sp[2]) * uy, bSd = Math.abs(-(bp[1] - sp[1]) * uy + (bp[2] - sp[2]) * ux);
    rows.push({ log: f.replace('.zevtc', ''), t: ((c.t - s9.t) / 1000).toFixed(1), last_phase: lp && c.t >= lp.t ? 1 : 0, sword_to_vloxx: Math.round(Math.hypot(bp[1] - sp[1], bp[2] - sp[2])), line_vs_vloxx_deg: Math.round(dg(Math.atan2(bp[2] - sp[2], bp[1] - sp[1]) - fc[1])),
      vloxx_along_line: Math.round(bAl), vloxx_side_of_line: Math.round(bSd), target_dist_from_sword: target ? Math.round(target.dS) : '', target_is_farthest: target ? (cand.slice().sort((a, b) => b.dS - a.dS)[0].p === target.p ? 1 : 0) : '',
      target_is_fixated: target && holderAt(c.t) != null ? (holderAt(c.t) === target.p ? 1 : 0) : '', stack_on_vloxx: stack.length, stack_hit_by_line: stack.filter(o => line.has(o.p)).length, stack_hit_by_first: stack.filter(o => first.has(o.p)).length }); }
}
if (!rows.length) { console.log('no Sword Division Eternal casts found in', dir); process.exit(0); }
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'sword_casts.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const rate = v => v && v[0] + v[1] >= 10 ? v[0] / (v[0] + v[1]) : null;
// zone edges: where the hit rate falls below 50 %
const sideEdge = (() => { for (let s = 0; s <= 900; s += 100) { let h = 0, n = 0; for (let a = 200; a <= 1200; a += 200) { const v = grid[a + ',' + s]; if (v) { h += v[0]; n += v[0] + v[1]; } } if (n >= 15 && h / n < 0.5) return s; } return null; })();
const aheadEdge = (() => { for (let a = 0; a <= 2400; a += 200) { let h = 0, n = 0; for (const s of [0, 100, 200]) { const v = grid[a + ',' + s]; if (v) { h += v[0]; n += v[0] + v[1]; } } if (a >= 800 && n >= 10 && h / n < 0.5) return a; } return null; })();
const behindEdge = (() => { for (let a = -200; a >= -1000; a -= 200) { let h = 0, n = 0; for (const s of [0, 100, 200, 300]) { const v = grid[a + ',' + s]; if (v) { h += v[0]; n += v[0] + v[1]; } } if (n >= 10 && h / n < 0.5) return -a; } return null; })();
const firstEdge = (() => { for (const k of Object.keys(firstBand).map(Number).sort((a, b) => a - b)) { const r = rate(firstBand[k]); if (r != null && r < 0.5) return k; } return null; })();
const tab = f => { const x = rows.filter(r => r.stack_on_vloxx >= 4).filter(f); const n = x.reduce((s, r) => s + r.stack_on_vloxx, 0); return { casts: x.length, stackHitPct: n ? Math.round(100 * x.reduce((s, r) => s + r.stack_hit_by_line, 0) / n) : null, castsNobodyHit: x.filter(r => r.stack_hit_by_line === 0).length }; };
const summary = { skill: 81330, logs, casts: rows.length, zone: { sideHalfWidth: sideEdge, aheadLength: aheadEdge, behind: behindEdge, firstHitRadius: firstEdge },
  aimedAt: Object.fromEntries(Object.entries(rule).map(([k, [h, n]]) => [k, { n, pct: Math.round(100 * h / n) }])),
  stackOnVloxx: { 'Vloxx ahead, < 300 beside the line': tab(r => r.vloxx_along_line > 0 && r.vloxx_side_of_line < 300), 'Vloxx ahead, 300–600 beside the line': tab(r => r.vloxx_along_line > 0 && r.vloxx_side_of_line >= 300 && r.vloxx_side_of_line < 600),
    'Vloxx ahead, 600+ beside the line': tab(r => r.vloxx_along_line > 0 && r.vloxx_side_of_line >= 600), 'Vloxx behind the Sword by 0–300': tab(r => r.vloxx_along_line <= 0 && r.vloxx_along_line > -300), 'Vloxx behind the Sword by 300+': tab(r => r.vloxx_along_line <= -300) },
  swordToVloxx: (() => { const a = rows.map(r => r.sword_to_vloxx).sort((x, y) => x - y); return { p10: a[Math.floor(0.1 * (a.length - 1))], p50: a[a.length >> 1], p90: a[Math.floor(0.9 * (a.length - 1))] }; })() };
fs.writeFileSync(path.join(ROOT, 'data', 'sword_division_summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
