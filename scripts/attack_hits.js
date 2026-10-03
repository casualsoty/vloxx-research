// Per-player hit / knock rate for one boss attack, from raw logs.
//   node scripts/attack_hits.js <skillId> [account-or-name filter]      e.g.  node scripts/attack_hits.js 80512 Account-F4C4
// A "cast" = the boss's cast start (statechange 67) → cast end (68) + 1 s. For each cast and each player who is alive and
// present at the start: hit = any damage event of that skill on the player in the window (incl. 0-damage / evade / block
// results); knocked = the player moved > 150 units within 0.6 s of the first hit (knockback / launch / pull).
// Phase: Staff (before the first Spear spawn), Spear (→ first Bulwark/Sword spawn), later.
// Writes data/attack_hits_<skillId>.csv (one row per player × cast).
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw');
const SKILL = +process.argv[2]; if (!SKILL) { console.error('usage: node scripts/attack_hits.js <skillId> [filter]'); process.exit(1); }
const filter = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
const pb = Buffer.alloc(8); const rows = []; let skillName = '';
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, skills, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue; const t0 = s9.t;
  skillName = skillName || skills.get(SKILL) || '';
  const firstSpawn = rx => { const ids = [...agents.values()].filter(a => rx.test(a.name || '')).map(a => a.addr); const t = ev.filter(e => e.sc === 6 && ids.includes(e.src)).map(e => e.t); return t.length ? Math.min(...t) : Infinity; };
  const spear = firstSpawn(/Aspect of the Spear/), after = Math.min(firstSpawn(/Cosmic Bulwark/), firstSpawn(/Aspect of the Sword/));
  const phase = t => t < spear ? 'Staff' : t < after ? 'Spear' : 'later';
  const players = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff);
  const pos = new Map(); for (const e of ev) if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
  const at = (a, t) => { const p = pos.get(a); if (!p) return null; let r = null; for (const q of p) { if (q[0] > t) break; r = q; } return r; };
  const state = new Map(); for (const e of ev) if ([3, 4, 5, 6].includes(e.sc)) (state.get(e.src) || state.set(e.src, []).get(e.src)).push([e.t, e.sc]);
  const alive = (a, t) => { let up = true; for (const [tt, sc] of state.get(a) || []) { if (tt > t) break; up = sc === 3 || sc === 6; } return up; };
  const starts = ev.filter(e => e.skill === SKILL && e.sc === 67);
  const hits = ev.filter(e => e.skill === SKILL && e.sc === 0 && e.buff === 0);
  for (const c of starts) {
    const end = ev.find(e => e.skill === SKILL && e.sc === 68 && e.src === c.src && e.t > c.t); const w1 = (end ? end.t : c.t + 8000) + 1000;
    for (const p of players) {
      const acc = (p.name.split('\0')[1] || '').replace(/^:/, ''), nm = p.name.split('\0')[0]; if (filter && !filter.test(acc) && !filter.test(nm)) continue;
      const here = at(p.addr, c.t); if (!here || c.t - here[0] > 3000 || !alive(p.addr, c.t)) continue;
      const h = hits.filter(e => e.dst === p.addr && e.t >= c.t && e.t <= w1);
      let moved = 0; if (h.length) { const a = at(p.addr, h[0].t), b = at(p.addr, h[0].t + 600); if (a && b) moved = Math.hypot(b[1] - a[1], b[2] - a[2]); }
      rows.push({ log: f.replace('.zevtc', ''), cast_s: ((c.t - t0) / 1000).toFixed(1), phase: phase(c.t), account: acc, name: nm, hit: h.length ? 1 : 0,
        hits: h.length, damage: h.reduce((s, e) => s + Math.max(0, e.value), 0), results: [...new Set(h.map(e => e.result))].join(' '), moved: Math.round(moved), knocked: h.length && moved > 150 ? 1 : 0 });
    }
  }
}
const H = Object.keys(rows[0] || { log: 0 });
fs.writeFileSync(path.join(ROOT, 'data', `attack_hits_${SKILL}.csv`), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const sum = rs => { const n = rs.length, h = rs.filter(r => r.hit).length, k = rs.filter(r => r.knocked).length; return `${n} casts present, hit ${h} (${(100 * h / Math.max(1, n)).toFixed(1)} %), knocked ${k} (${(100 * k / Math.max(1, n)).toFixed(1)} %)`; };
console.log(`skill ${SKILL} ${skillName}`);
for (const ph of ['Staff', 'Spear', 'later']) {
  const rs = rows.filter(r => r.phase === ph); if (!rs.length) continue; console.log(`\n${ph} phase — all players: ${sum(rs)}`);
  const by = {}; rs.forEach(r => (by[r.account] = by[r.account] || []).push(r));
  Object.entries(by).filter(([, v]) => v.length >= (filter ? 1 : 20)).sort((a, b) => b[1].filter(r => r.knocked).length / b[1].length - a[1].filter(r => r.knocked).length / a[1].length)
    .forEach(([a, v]) => console.log(`  ${a.padEnd(26)} ${sum(v)}`));
}
