// Ascension orb throws: for every Aspect breakbar break (from data/aspect_events.csv), count the orb-throw missiles
// (skill 80520, 3 per CC, 0.2 s apart, landing ~2 s later) and the orbs that appeared. Also notes projectile-hate skills
// cast near the Aspect just before (all ruled out as a cause, kept for checking new misses). Writes data/orb_throws.csv.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..');
const HATE = /^(Feedback|Corrosive Poison Cloud|Smoke Screen|Wall of Reflection|Swirling Winds|Shield of the Avenger|Sanctuary|Temporal Curtain|Dust Storm|Sand Swell|Bulwark Gyro|Magnetic Shield|Protect Me!|Shield of Absorption|Null Field)$/;
const rows = l => fs.readFileSync(path.join(ROOT, 'data', l), 'utf8').trim().split(/\r?\n/).slice(1).map(x => x.split(','));
const breaks = rows('aspect_events.csv').filter(r => r[3] === 'breakbar_broken');
const orbs = rows('ascension_orbs.csv');
const dur = Object.fromEntries(rows('logs_index.csv').map(r => [r[0], +r[7]]));
const by = {}; breaks.forEach(b => (by[b[0]] = by[b[0]] || []).push(b));
const pb = Buffer.alloc(8); const out = [];
for (const [log, bs] of Object.entries(by)) {
  const file = path.join(ROOT, 'logs', 'raw', log + '.zevtc'); if (!fs.existsSync(file)) continue;
  const { agents, skills, ev } = parseEvtc(file); const t0 = ev.find(e => e.sc === 9).t;
  const pos = new Map(); for (const e of ev) if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
  const at = (a, t) => { const p = pos.get(a); if (!p) return null; let r = p[0]; for (const q of p) { if (q[0] > t) break; r = q; } return r; };
  const players = new Set([...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr));
  const hate = ev.filter(e => e.sc === 67 && players.has(e.src) && HATE.test(skills.get(e.skill) || ''));
  for (const b of bs) {
    const ag = [...agents.values()].find(a => a.addr.toString(16) === b[4]); if (!ag) continue;
    const tb = t0 + +b[1] * 1000; const sp = at(ag.addr, tb);
    const throws = ev.filter(e => e.skill === 80520 && e.sc === 58 && e.src === ag.addr && e.t >= tb - 300 && e.t <= tb + 1500).length;
    const got = orbs.filter(o => o[0] === log && +o[1] >= +b[1] + 1.2 && +o[1] <= +b[1] + 3.0).length;
    const near = hate.filter(e => { const d = (tb - e.t) / 1000; const p = at(e.src, e.t); return d >= 0 && d <= 10 && p && sp && Math.hypot(p[1] - sp[1], p[2] - sp[2]) < 900; })
      .map(e => (skills.get(e.skill)) + ' ' + ((tb - e.t) / 1000).toFixed(1) + 's');
    out.push([log, b[1], b[2], throws, got, b[5] === 'no orbs' ? '' : b[5], (dur[log] - +b[1]).toFixed(1), [...new Set(near)].join(' / ')]);
  }
}
fs.writeFileSync(path.join(ROOT, 'data', 'orb_throws.csv'),
  ['log_id,break_s,aspect,throw_missiles_80520,orbs_within_1.2-3s,first_orb_after_s,s_until_log_end,projectile_hate_near_aspect_10s', ...out.map(r => r.join(','))].join('\n'));
const miss = out.filter(r => r[3] === 0);
console.log(`CCs ${out.length}: throw seen ${out.length - miss.length}, no throw ${miss.length}; thrown but no orbs ${out.filter(r => r[3] > 0 && r[4] === 0).length}`);
miss.forEach(r => console.log(`  no throw: ${r[0]} @${r[1]} (${r[2]}) ${r[6]} s before log end${r[7] ? ' | ' + r[7] : ''}`));
