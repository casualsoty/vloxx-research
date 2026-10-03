// Worldpiercer (Vloxx, skill 80916) hits per player and phase, from raw logs. For each cast: was the player alive and
// present, was he hit (damage event, incl. 0-damage / evaded / blocked results), and was he displaced afterwards
// (moved > 150 units within 0.6 s of the hit = knockback). Phase = Staff (before the first Spear spawn), Spear (first Spear
// spawn → first Bulwark/Sword spawn), later. Usage: node scripts/worldpiercer_hits.js [account-or-name filter]
// Writes data/worldpiercer_hits.csv (one row per player × cast).
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw');
const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
const pb = Buffer.alloc(8); const rows = [];
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue; const t0 = s9.t;
  const firstSpawn = rx => { const ids = [...agents.values()].filter(a => rx.test(a.name || '')).map(a => a.addr); const t = ev.filter(e => e.sc === 6 && ids.includes(e.src)).map(e => e.t); return t.length ? Math.min(...t) : Infinity; };
  const spear = firstSpawn(/Aspect of the Spear/), after = Math.min(firstSpawn(/Cosmic Bulwark/), firstSpawn(/Aspect of the Sword/));
  const phase = t => t < spear ? 'Staff' : t < after ? 'Spear' : 'later';
  const players = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff);
  const pos = new Map(); for (const e of ev) if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
  const at = (a, t) => { const p = pos.get(a); if (!p) return null; let r = null; for (const q of p) { if (q[0] > t) break; r = q; } return r; };
  // alive intervals: down(5)/dead(4) → up(3)/spawn(6)
  const state = new Map(); for (const e of ev) if ([3, 4, 5, 6].includes(e.sc)) (state.get(e.src) || state.set(e.src, []).get(e.src)).push([e.t, e.sc]);
  const alive = (a, t) => { const s = state.get(a) || []; let up = true; for (const [tt, sc] of s) { if (tt > t) break; up = sc === 3 || sc === 6; } return up; };
  const casts = []; for (const e of ev) if (e.skill === 80916 && e.sc === 58) { const c = casts[casts.length - 1]; if (!c || e.t - c.t > 500) casts.push({ t: e.t }); }
  const hits = ev.filter(e => e.skill === 80916 && e.sc === 0 && e.buff === 0);
  for (const c of casts) for (const p of players) {
    const acc = p.name.split('\0')[1] || '', nm = p.name.split('\0')[0]; if (filter && !filter.test(acc) && !filter.test(nm)) continue;
    const here = at(p.addr, c.t); if (!here || c.t - here[0] > 3000 || !alive(p.addr, c.t)) continue;
    const h = hits.filter(e => e.dst === p.addr && e.t >= c.t && e.t <= c.t + 1600);
    let moved = 0; if (h.length) { const a = at(p.addr, h[0].t), b = at(p.addr, h[0].t + 600); if (a && b) moved = Math.hypot(b[1] - a[1], b[2] - a[2]); }
    rows.push({ log: f.replace('.zevtc', ''), cast_s: ((c.t - t0) / 1000).toFixed(1), phase: phase(c.t), account: acc.replace(/^:/, ''), name: nm,
      hit: h.length ? 1 : 0, damage: h.reduce((s, e) => s + Math.max(0, e.value), 0), results: [...new Set(h.map(e => e.result))].join(' '), moved: Math.round(moved), knocked: h.length && moved > 150 ? 1 : 0 });
  }
}
const H = Object.keys(rows[0] || { log: 0 }); fs.writeFileSync(path.join(ROOT, 'data', 'worldpiercer_hits.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const sum = (rs) => { const n = rs.length, h = rs.filter(r => r.hit).length, k = rs.filter(r => r.knocked).length; return `${n} casts present, hit ${h} (${(100 * h / Math.max(1, n)).toFixed(1)} %), knocked ${k} (${(100 * k / Math.max(1, n)).toFixed(1)} %)`; };
for (const ph of ['Staff', 'Spear', 'later']) {
  const rs = rows.filter(r => r.phase === ph); if (!rs.length) continue; console.log(`\n${ph} phase — all players: ${sum(rs)}`);
  const byAcc = {}; rs.forEach(r => (byAcc[r.account] = byAcc[r.account] || []).push(r));
  Object.entries(byAcc).filter(([, v]) => v.length >= 20).sort((a, b) => b[1].filter(r => r.hit).length / b[1].length - a[1].filter(r => r.hit).length / a[1].length)
    .forEach(([a, v]) => console.log(`  ${a.padEnd(26)} ${sum(v)}`));
}
