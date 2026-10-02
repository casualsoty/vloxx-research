// Randomness tests for shackle picks 2 and 3 (Ascension's Sacrifice, effect 37976), without knowing the cause.
// Monte Carlo: re-draw every pick uniformly among the same candidate set, recompute each statistic, get p-values.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const dir = path.join(__dirname, '..', 'logs', 'raw');
const casts = []; // {fight, idx, fixedFirst, picks:[{cands:[acc], picked:acc}], sub:Map acc->subgroup}
const fights = [];
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  if (Math.max(0, ...ev.filter(e => e.sc === 12 && e.src === boss.addr).map(e => Number(e.dst))) < 70e6) continue;
  const PA = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff); const acc = a => agents.get(a).name.split('\0')[1];
  const sub = new Map(PA.map(a => [acc(a.addr), a.name.split('\0')[2]]));
  const up = (p, t) => { let s = 'up'; for (const e of ev) { if (e.t > t) break; if (e.src !== p) continue; if (e.sc === 4) s = 'D'; if (e.sc === 5) s = 'd'; if (e.sc === 3 || e.sc === 6) s = 'up'; } return s === 'up'; };
  const sh = ev.filter(e => e.sc === 62 && e.skill === 37976); let idx = 0; const fc = [];
  for (const c of ev.filter(e => e.src === boss.addr && e.sc === 67 && e.skill === 81076)) {
    const ms = sh.filter(m => m.t - c.t >= 0 && m.t - c.t < 4000); if (ms.length < 3) continue;
    const picks = []; for (let i = 1; i < ms.length; i++) { const chosen = ms.slice(0, i).map(m => m.dst); picks.push({ cands: PA.map(a => a.addr).filter(p => up(p, ms[i].t) && !chosen.includes(p)).map(acc), picked: acc(ms[i].dst) }); }
    const cc = { fight: f, idx: idx++, first: acc(ms[0].dst), picks, sub }; casts.push(cc); fc.push(cc);
  }
  fights.push(fc);
}
const rnd = a => a[Math.floor(Math.random() * a.length)];
function draw(useReal) { // returns array per cast of [pick2, pick3]
  return casts.map(c => { if (useReal) return c.picks.map(p => p.picked); const out = []; for (const p of c.picks) { const cands = p.cands.filter(x => !out.includes(x)); out.push(rnd(cands)); } return out; });
}
const STATS = {
  'player spread (chi-square over accounts)': P => { const o = {}, e = {}; casts.forEach((c, i) => c.picks.forEach((p, j) => { const cands = p.cands.filter(x => !P[i].slice(0, j).includes(x)); cands.forEach(x => e[x] = (e[x] || 0) + 1 / cands.length); o[P[i][j]] = (o[P[i][j]] || 0) + 1; })); return Object.keys(e).reduce((s, k) => s + ((o[k] || 0) - e[k]) ** 2 / e[k], 0); },
  'same player shackled again in 2nd cast of the fight': P => { let n = 0; fights.forEach(fc => { if (fc.length < 2) return; const a = P[casts.indexOf(fc[0])], b = P[casts.indexOf(fc[1])]; n += b.filter(x => a.includes(x)).length; }); return n; },
  'pick 2/3 = player who had shackle 1 in other cast': P => { let n = 0; fights.forEach(fc => { if (fc.length < 2) return; n += P[casts.indexOf(fc[1])].filter(x => x === fc[0].first).length + P[casts.indexOf(fc[0])].filter(x => x === fc[1].first).length; }); return n; },
  'same subgroup as shackle-1 player (picks 2/3)': P => casts.reduce((s, c, i) => s + P[i].filter(x => c.sub.get(x) === c.sub.get(c.first)).length, 0),
  'picks 2 and 3 in same subgroup': P => casts.reduce((s, c, i) => s + (P[i].length === 2 && c.sub.get(P[i][0]) === c.sub.get(P[i][1]) ? 1 : 0), 0),
  'same picks as the previous fight (same cast #)': P => { let n = 0; for (let k = 1; k < fights.length; k++) for (let ci = 0; ci < Math.min(fights[k].length, fights[k - 1].length); ci++) { const a = P[casts.indexOf(fights[k - 1][ci])], b = P[casts.indexOf(fights[k][ci])]; n += b.filter(x => a.includes(x)).length; } return n; },
  'most-picked pair count (any two accounts together)': P => { const m = {}; P.forEach(x => { if (x.length === 2) { const k = x.slice().sort().join('+'); m[k] = (m[k] || 0) + 1; } }); return Math.max(...Object.values(m)); },
  'max picks by a single account': P => { const m = {}; P.flat().forEach(x => m[x] = (m[x] || 0) + 1); return Math.max(...Object.values(m)); },
  'min picks among regular accounts (>=40 candidate slots)': P => { const m = {}, slots = {}; casts.forEach((c, i) => c.picks.forEach(p => p.cands.forEach(x => slots[x] = (slots[x] || 0) + 1))); P.flat().forEach(x => m[x] = (m[x] || 0) + 1); return Math.min(...Object.keys(slots).filter(k => slots[k] >= 40).map(k => m[k] || 0)); },
};
const real = draw(true); const SIM = 5000; const res = {};
for (const [k, fn] of Object.entries(STATS)) res[k] = { obs: fn(real), sims: [] };
for (let s = 0; s < SIM; s++) { const P = draw(false); for (const [k, fn] of Object.entries(STATS)) res[k].sims.push(fn(P)); }
console.log(`casts ${casts.length} (fights ${fights.length}), picks 2/3: ${casts.reduce((a, c) => a + c.picks.length, 0)}, simulations ${SIM}\n`);
console.log('statistic'.padEnd(56), 'observed', ' random mean', ' p(random >= obs)', ' p(random <= obs)');
for (const [k, v] of Object.entries(res)) { const mean = v.sims.reduce((a, x) => a + x, 0) / SIM; const ge = v.sims.filter(x => x >= v.obs).length / SIM, le = v.sims.filter(x => x <= v.obs).length / SIM;
  console.log(k.padEnd(56), String(+v.obs.toFixed(2)).padStart(8), mean.toFixed(2).padStart(12), ge.toFixed(3).padStart(17), le.toFixed(3).padStart(17)); }
