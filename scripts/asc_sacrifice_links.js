// Shackle picks 2/3: are they linked to a player being hit/targeted by a specific enemy skill or effect shortly before?
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const dir = path.join(__dirname, '..', 'logs', 'raw');
const S = {}; let N = 0;
const bump = (k, picked, cands, hit) => { // hit: Set of players having the feature
  S[k] = S[k] || { pickHas: 0, n: 0, candRate: 0 }; S[k].n++; if (hit.has(picked)) S[k].pickHas++; S[k].candRate += cands.filter(p => hit.has(p)).length / cands.length;
};
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, skills, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue;
  const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  if (Math.max(0, ...ev.filter(e => e.sc === 12 && e.src === boss.addr).map(e => Number(e.dst))) < 70e6) continue;
  const players = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const isP = a => agents.get(a)?.isPlayer; const enemy = a => { const x = agents.get(a); return x && !x.isPlayer && x.species > 20000 && x.species < 30000; };
  const up = (p, t) => { let s = 'up'; for (const e of ev) { if (e.t > t) break; if (e.src !== p) continue; if (e.sc === 4) s = 'D'; if (e.sc === 5) s = 'd'; if (e.sc === 3 || e.sc === 6) s = 'up'; } return s === 'up'; };
  const sh = ev.filter(e => e.sc === 62 && e.skill === 37976);
  for (const c of ev.filter(e => e.src === boss.addr && e.sc === 67 && e.skill === 81076)) {
    const ms = sh.filter(m => m.t - c.t >= 0 && m.t - c.t < 4000);
    const win = ev.filter(e => e.t >= c.t - 8000 && e.t <= c.t + 3500);
    for (let i = 1; i < ms.length; i++) {
      const T = ms[i].t; const chosen = ms.slice(0, i).map(m => m.dst); const cands = players.filter(p => up(p, T) && !chosen.includes(p)); if (cands.length < 2) continue; N++;
      const feats = {};
      for (const e of win) { if (e.t > T) break; const age = T - e.t; const w = age < 1500 ? '<1.5s' : age < 4000 ? '1.5-4s' : '4-11s';
        let k = null, p = null;
        if (e.sc === 0 && enemy(e.src) && isP(e.dst) && !e.buff) { k = 'hit by ' + (agents.get(e.src).name.split('\0')[0].replace(/[-\d]+$/, '')) + ' ' + e.skill + ' ' + (skills.get(e.skill) || ''); p = e.dst; }
        else if (e.sc === 67 && enemy(e.src) && isP(e.dst)) { k = 'cast target of ' + agents.get(e.src).name.split('\0')[0].replace(/[-\d]+$/, '') + ' ' + e.skill + ' ' + (skills.get(e.skill) || ''); p = e.dst; }
        else if (e.sc === 62 && isP(e.dst) && !isP(e.src) && e.skill !== 37976) { k = 'agent effect ' + e.skill; p = e.dst; }
        else if (e.sc === 69 && isP(e.dst) && enemy(e.src)) { k = 'buff from enemy ' + e.skill + ' ' + (skills.get(e.skill) || ''); p = e.dst; }
        if (k) { k += ' [' + w + ' before pick]'; (feats[k] = feats[k] || new Set()).add(p); } }
      for (const [k, set] of Object.entries(feats)) bump(k, ms[i].dst, cands, set);
    }
  }
}
const rows = Object.entries(S).filter(([k, v]) => v.n >= 15).map(([k, v]) => [k, v.pickHas / N, v.candRate / N, v.n]).sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
console.log('picks', N, '— features present on the picked player vs on an average candidate (top & bottom):');
for (const r of [...rows.slice(0, 15), ['...'], ...rows.slice(-8)]) console.log(r.length < 2 ? '   ...' : '   picked ' + (r[1] * 100).toFixed(0).padStart(3) + '%  vs candidates ' + (r[2] * 100).toFixed(0).padStart(3) + '%   ' + r[0]);
