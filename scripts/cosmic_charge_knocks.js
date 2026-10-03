// Cosmic Charge (Vloxx, skill 80512, Spear phase) knockdowns per player, from raw logs.
// A cast (7.8 s) has: a big hit ~3.1 s in around Vloxx, big hits as Vloxx dashes 1,398 units toward the fixated player,
// then small trail ticks every ~0.5 s. Only the big hits (≥ 1,200 dmg) carry the CC: they strip a Stability stack at the same ms
// (1,638 of 5,033) while trail ticks almost never do. Knockdown, not knockback — hit players don't move faster than before.
// knocked = a big hit that deals damage (normal/crit/glance) while the player has NO Stability (stacks tracked from buff 1122:
// statechange 69 apply with value = duration, 71 single-stack remove, 72 remove all).
// usage: node scripts/cosmic_charge_knocks.js [account-or-name filter]   → data/cosmic_charge_knocks.csv (player × cast)
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw');
const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
const BIG = 1200; const rows = []; const pb = Buffer.alloc(8);
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue; const t0 = s9.t;
  const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  const casts = ev.filter(e => e.skill === 80512 && e.sc === 67 && e.src === boss.addr); if (!casts.length) continue;
  const players = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff);
  const lastPos = new Map(); for (const e of ev) if (e.sc === 19) (lastPos.get(e.src) || lastPos.set(e.src, []).get(e.src)).push(e.t);
  const present = (a, t) => (lastPos.get(a) || []).some(x => Math.abs(x - t) < 4000);
  const state = new Map(); for (const e of ev) if ([3, 4, 5, 6].includes(e.sc)) (state.get(e.src) || state.set(e.src, []).get(e.src)).push([e.t, e.sc]);
  const alive = (a, t) => { let up = true; for (const [tt, sc] of state.get(a) || []) { if (tt > t) break; up = sc === 3 || sc === 6; } return up; };
  // stability stacks timeline per player
  const stabEv = new Map(); for (const e of ev) { if (e.skill !== 1122) continue; const who = e.sc === 69 ? e.dst : (e.sc === 71 || e.sc === 72) ? e.src : null; if (who != null) (stabEv.get(who) || stabEv.set(who, []).get(who)).push(e); }
  const hasStab = (a, t) => { let st = []; for (const e of stabEv.get(a) || []) { if (e.t >= t) break; st = st.filter(s => s > e.t);
      if (e.sc === 69) st.push(e.t + e.value); else if (e.sc === 71) { st.sort((x, y) => x - y); st.shift(); } else if (e.sc === 72) st = []; }
    return st.some(s => s > t); };
  const dmg = ev.filter(e => e.skill === 80512 && e.sc === 0 && e.buff === 0);
  for (const c of casts) for (const p of players) {
    const acc = (p.name.split('\0')[1] || '').replace(/^:/, ''), nm = p.name.split('\0')[0]; if (filter && !filter.test(acc) && !filter.test(nm)) continue;
    if (!present(p.addr, c.t) || !alive(p.addr, c.t)) continue;
    const big = dmg.filter(e => e.dst === p.addr && e.t >= c.t && e.t <= c.t + 9000 && (e.value >= BIG || (e.value === 0 && [3, 4, 6].includes(e.result) && e.t - c.t > 2500)));
    const landed = big.filter(e => e.value >= BIG && e.result <= 2);
    const knocks = landed.filter(e => !hasStab(p.addr, e.t));
    const avoided = big.filter(e => e.value === 0).length;
    rows.push({ log: f.replace('.zevtc', ''), cast_s: ((c.t - t0) / 1000).toFixed(1), account: acc, name: nm, big_hits: landed.length,
      knocked: knocks.length ? 1 : 0, knock_hits: knocks.length, stab_protected: landed.length - knocks.length, blocked_evaded_invuln: avoided,
      first_knock_s: knocks.length ? ((knocks[0].t - c.t) / 1000).toFixed(2) : '' });
  }
}
const H = Object.keys(rows[0] || { log: 0 });
fs.writeFileSync(path.join(ROOT, 'data', 'cosmic_charge_knocks.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + ' %';
const sum = rs => { const n = rs.length, k = rs.filter(r => r.knocked).length, h = rs.filter(r => r.big_hits).length, s = rs.filter(r => r.big_hits && !r.knocked).length;
  return `${String(n).padStart(4)} casts present | knocked in ${String(k).padStart(3)} (${pct(k, n).padStart(7)}) | hit by a big hit ${pct(h, n).padStart(7)} | hit but saved by stability ${pct(s, Math.max(1, h)).padStart(7)} of hits`; };
console.log('Cosmic Charge (80512) — all players: ' + sum(rows));
const by = {}; rows.forEach(r => (by[r.account] = by[r.account] || []).push(r));
Object.entries(by).filter(([, v]) => v.length >= (filter ? 1 : 20)).sort((a, b) => b[1].filter(r => r.knocked).length / b[1].length - a[1].filter(r => r.knocked).length / a[1].length)
  .forEach(([a, v]) => console.log(`  ${a.padEnd(26)} ${sum(v)}`));
