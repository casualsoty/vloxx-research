// Ascension's Sacrifice (skill 81076) — 2-people green "shackles" (agent effect 37976, EI GUID A47987D0864223429B261683B6452826).
// For every cast: who got the 3 markers, in what order, and how each pick ranks by distance to Vloxx / to other players.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const dir = path.join(__dirname, '..', 'logs', 'raw');
const rows = [];
const interp = (L, t) => { if (!L) return null; let i = L.findIndex(p => p[0] > t); if (i === -1) return L[L.length - 1].slice(1); if (i === 0) return L[0].slice(1); const [p, q] = [L[i - 1], L[i]]; const k = (t - p[0]) / (q[0] - p[0]); return [p[1] + k * (q[1] - p[1]), p[2] + k * (q[2] - p[2])]; };
const D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue; const t0 = s9.t;
  const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  if (Math.max(0, ...ev.filter(e => e.sc === 12 && e.src === boss.addr).map(e => Number(e.dst))) < 70e6) continue; // CM only
  const nm = a => (agents.get(a)?.name || '?').split('\0')[0];
  const players = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const tl = new Map(); const b = Buffer.alloc(8); for (const e of ev) if (e.sc === 19) { b.writeBigUInt64LE(e.dst); (tl.get(e.src) || tl.set(e.src, []).get(e.src)).push([e.t, b.readFloatLE(0), b.readFloatLE(4)]); }
  const fx = ev.filter(e => e.skill === 34508 && (e.sc === 69 || e.sc === 72));
  const fixAt = t => { let h = null; for (const e of fx) { if (e.t > t) break; if (e.sc === 69) h = e.dst; else if (e.src === h) h = null; } return h; };
  const up = (p, t) => { let s = 'up'; for (const e of ev) { if (e.t > t) break; if (e.src !== p) continue; if (e.sc === 4) s = 'D'; if (e.sc === 5) s = 'd'; if (e.sc === 3 || e.sc === 6) s = 'up'; } return s === 'up'; };
  const casts = ev.filter(e => e.src === boss.addr && e.sc === 67 && e.skill === 81076);
  const marks = ev.filter(e => e.sc === 62 && e.skill === 37976);
  for (const c of casts) {
    const ms = marks.filter(m => m.t - c.t >= 0 && m.t - c.t < 4000);
    const chosen = [];
    ms.forEach((m, i) => {
      const T = m.t; const bp = interp(tl.get(boss.addr), T); const fix = fixAt(T);
      const cand = players.filter(p => up(p, T) && !chosen.includes(p));
      const byBoss = cand.map(p => [p, D(interp(tl.get(p), T), bp)]).sort((a, b) => a[1] - b[1]);
      const rank = byBoss.findIndex(x => x[0] === m.dst) + 1;
      const far = byBoss.length - rank + 1;
      // how many other players within 300 of the target (crowding)
      const tp = interp(tl.get(m.dst), T); const crowd = players.filter(p => p !== m.dst && up(p, T) && D(interp(tl.get(p), T), tp) < 300).length;
      rows.push({ log: f.replace('.zevtc', ''), cast: ((c.t - t0) / 1000).toFixed(1), i: i + 1, dt: m.t - c.t, target: nm(m.dst), dist: Math.round(D(tp, bp)),
        rankNearest: rank, rankFarthest: far, of: byBoss.length, fixated: fix ? nm(fix) : '', isFix: fix === m.dst, crowd300: crowd,
        closest: byBoss.slice(0, 3).map(x => nm(x[0]).split(' ')[0] + '@' + Math.round(x[1])).join(' ') });
      chosen.push(m.dst);
    });
  }
}
const out = path.join(__dirname, '..', 'data', 'ascension_sacrifice_2green.csv');
fs.writeFileSync(out, 'log_id,cast_time_s,pick_no,ms_after_cast_start,target,dist_to_boss,rank_nearest,rank_farthest,candidates,fixated_player,target_is_fixated,players_within_300_of_target,closest_3_candidates\n' +
  rows.map(r => [r.log, r.cast, r.i, r.dt, r.target, r.dist, r.rankNearest, r.rankFarthest, r.of, r.fixated, r.isFix ? 1 : 0, r.crowd300, r.closest].join(',')).join('\n') + '\n');
const hist = k => { const h = {}; rows.forEach(r => h[r[k]] = (h[r[k]] || 0) + 1); return JSON.stringify(h); };
console.log('casts', new Set(rows.map(r => r.log + r.cast)).size, 'picks', rows.length);
console.log('marker timing after cast start (ms) by pick#:', [1, 2, 3].map(i => { const v = rows.filter(r => r.i === i).map(r => r.dt).sort((a, b) => a - b); return i + ': ' + v[0] + '-' + v[v.length - 1]; }).join(' | '));
console.log('rank by NEAREST to boss (1 = closest remaining):', hist('rankNearest'));
console.log('rank by FARTHEST from boss (1 = farthest remaining):', hist('rankFarthest'));
console.log('target is the fixated player:', rows.filter(r => r.isFix).length + '/' + rows.length);
console.log('by pick #:', [1, 2, 3].map(i => i + ': nearest-rank ' + JSON.stringify(rows.filter(r => r.i === i).reduce((h, r) => (h[r.rankNearest] = (h[r.rankNearest] || 0) + 1, h), {}))).join(' | '));
console.log('wrote', out);
