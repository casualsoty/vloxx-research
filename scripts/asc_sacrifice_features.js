// For shackle picks 2 and 3 (Ascension's Sacrifice, effect 37976): test many candidate features.
// For each feature we rank the candidates (players up, not already marked) and record the picked player's rank,
// both ascending and descending. A selection rule shows up as rank 1 far more often than chance.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const dir = path.join(__dirname, '..', 'logs', 'raw');
const interp = (L, t) => { if (!L || !L.length) return null; let i = L.findIndex(p => p[0] > t); if (i === -1) return L[L.length - 1].slice(1); if (i === 0) return L[0].slice(1); const [p, q] = [L[i - 1], L[i]]; const k = (t - p[0]) / (q[0] - p[0]); return [p[1] + k * (q[1] - p[1]), p[2] + k * (q[2] - p[2])]; };
const D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const stats = {}; let N = 0, chance = 0; const samples = [];
function addRank(name, cands, val, picked) {
  // val: Map player->number (undefined = missing). rank with ties averaged
  const vals = cands.map(p => val.get(p)); if (vals.some(v => v == null || Number.isNaN(v))) return;
  for (const dir of ['asc', 'desc']) {
    const pv = val.get(picked); const better = vals.filter(v => dir === 'asc' ? v < pv : v > pv).length; const ties = vals.filter(v => v === pv).length;
    const rank1 = better === 0 ? 1 / ties : 0; // probability picked is "the" top under random tie-break
    const k = name + ' (' + (dir === 'asc' ? 'lowest' : 'highest') + ')';
    stats[k] = stats[k] || { top: 0, n: 0, exp: 0 }; stats[k].top += rank1; stats[k].n++; stats[k].exp += 1 / cands.length;
  }
}
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, skills, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue;
  const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  if (Math.max(0, ...ev.filter(e => e.sc === 12 && e.src === boss.addr).map(e => Number(e.dst))) < 70e6) continue;
  const PA = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff);
  const players = PA.map(a => a.addr);
  const raw = fs.readFileSync(path.join(dir, f)); // agent extra stats from evtc agent struct
  const parts = a => a.name.split('\0');
  const sub = new Map(PA.map(a => [a.addr, +(parts(a)[2] || 0)]));
  const order = new Map(PA.map((a, i) => [a.addr, i]));
  const inst = new Map(); for (const e of ev) if (agents.get(e.src)?.isPlayer && e.srcInst && !inst.has(e.src)) inst.set(e.src, e.srcInst);
  const tl = new Map(); const b = Buffer.alloc(8); for (const e of ev) if (e.sc === 19) { b.writeBigUInt64LE(e.dst); (tl.get(e.src) || tl.set(e.src, []).get(e.src)).push([e.t, b.readFloatLE(0), b.readFloatLE(4)]); }
  const facing = ev.filter(e => e.sc === 21 && e.src === boss.addr).map(e => { b.writeBigUInt64LE(e.dst); return [e.t, b.readFloatLE(0), b.readFloatLE(4)]; });
  const faceAt = t => { let r = null; for (const x of facing) { if (x[0] > t) break; r = x; } return r ? [r[1], r[2]] : null; };
  const hp = new Map(); const hpAt = (p, t) => { const L = hp.get(p); if (!L) return 100; let v = 100; for (const [tt, x] of L) { if (tt > t) break; v = x; } return v; };
  for (const e of ev) if (e.sc === 8 && agents.get(e.src)?.isPlayer) (hp.get(e.src) || hp.set(e.src, []).get(e.src)).push([e.t, Number(e.dst) / 100]);
  const up = (p, t) => { let s = 'up'; for (const e of ev) { if (e.t > t) break; if (e.src !== p) continue; if (e.sc === 4) s = 'D'; if (e.sc === 5) s = 'd'; if (e.sc === 3 || e.sc === 6) s = 'up'; } return s === 'up'; };
  const inst2 = new Map(); for (const e of ev) if (e.sc === 0 && agents.get(e.src)?.isPlayer) inst2.set(e.srcInst, e.src);
  const owner = e => agents.get(e.src)?.isPlayer ? e.src : (e.srcMaster ? inst2.get(e.srcMaster) : null);
  const dmgEv = ev.filter(e => e.sc === 0 && e.dst === boss.addr).map(e => ({ t: e.t, o: owner(e), v: e.buff ? e.buffDmg : e.value })).filter(x => x.o && x.v > 0);
  const takenEv = ev.filter(e => e.sc === 0 && agents.get(e.dst)?.isPlayer && !agents.get(e.src)?.isPlayer && !e.buff && e.value > 0).map(e => ({ t: e.t, p: e.dst, v: e.value }));
  const hitByBoss = ev.filter(e => e.sc === 0 && e.src === boss.addr && agents.get(e.dst)?.isPlayer && !e.buff).map(e => ({ t: e.t, p: e.dst }));
  const asc = new Map(players.map(p => [p, 10])); const ascEv = ev.filter(e => e.skill === 80368 && (e.sc === 69 || e.sc === 71 || e.sc === 72));
  const ascAt = (p, t) => { let v = 10; for (const e of ascEv) { if (e.t > t) break; if (e.sc === 69 && e.dst === p) v++; if (e.sc === 71 && e.src === p && e.brem !== 1) v--; } return v; };
  const g3 = ev.filter(e => e.sc === 62 && e.skill === 10269), pdE = ev.filter(e => e.sc === 62 && e.skill === 6188), sh = ev.filter(e => e.sc === 62 && e.skill === 37976);
  const fixE = ev.filter(e => e.skill === 34508 && e.sc === 69);
  const toughness = new Map(); { let o = 20; const n = raw.readUInt32LE !== undefined ? null : null; }
  for (const c of ev.filter(e => e.src === boss.addr && e.sc === 67 && e.skill === 81076)) {
    const ms = sh.filter(m => m.t - c.t >= 0 && m.t - c.t < 4000);
    for (let i = 1; i < ms.length; i++) {
      const T = ms[i].t; const chosen = ms.slice(0, i).map(m => m.dst); const cands = players.filter(p => up(p, T) && !chosen.includes(p)); if (cands.length < 2) continue;
      const picked = ms[i].dst; N++; chance += 1 / cands.length;
      const bp = interp(tl.get(boss.addr), T), fv = faceAt(T); const pos = new Map(cands.map(p => [p, interp(tl.get(p), T)]));
      const F = {};
      F['dist to boss'] = new Map(cands.map(p => [p, D(pos.get(p), bp)]));
      F['dist to boss at cast start'] = new Map(cands.map(p => [p, D(interp(tl.get(p), c.t), interp(tl.get(boss.addr), c.t))]));
      F['dist to boss 2s before cast'] = new Map(cands.map(p => [p, D(interp(tl.get(p), c.t - 2000), interp(tl.get(boss.addr), c.t - 2000))]));
      if (fv) F['angle from boss facing'] = new Map(cands.map(p => { const q = pos.get(p); const a = Math.atan2(q[1] - bp[1], q[0] - bp[0]) - Math.atan2(fv[1], fv[0]); return [p, Math.abs(Math.atan2(Math.sin(a), Math.cos(a)))]; }));
      F['HP%'] = new Map(cands.map(p => [p, hpAt(p, T)]));
      F['Ascension stacks'] = new Map(cands.map(p => [p, ascAt(p, T)]));
      F['subgroup'] = new Map(cands.map(p => [p, sub.get(p)]));
      F['squad order (agent list)'] = new Map(cands.map(p => [p, order.get(p)]));
      F['instance id'] = new Map(cands.map(p => [p, inst.get(p) ?? 0]));
      for (const W of [5, 15, 60]) {
        F['dmg on boss last ' + W + 's'] = new Map(cands.map(p => [p, dmgEv.filter(x => x.o === p && x.t < T && x.t > T - W * 1000).reduce((a, x) => a + x.v, 0)]));
        F['dmg taken last ' + W + 's'] = new Map(cands.map(p => [p, takenEv.filter(x => x.p === p && x.t < T && x.t > T - W * 1000).reduce((a, x) => a + x.v, 0)]));
      }
      F['total dmg on boss so far'] = new Map(cands.map(p => [p, dmgEv.filter(x => x.o === p && x.t < T).reduce((a, x) => a + x.v, 0)]));
      F['time since last hit by boss'] = new Map(cands.map(p => { const h = hitByBoss.filter(x => x.p === p && x.t < T).pop(); return [p, h ? T - h.t : 1e9]; }));
      F['times 3-green so far'] = new Map(cands.map(p => [p, g3.filter(x => x.dst === p && x.t < T).length]));
      F['times PD so far'] = new Map(cands.map(p => [p, pdE.filter(x => x.dst === p && x.t < T).length]));
      F['times shackled so far'] = new Map(cands.map(p => [p, sh.filter(x => x.dst === p && x.t < c.t).length]));
      F['times fixated so far'] = new Map(cands.map(p => [p, fixE.filter(x => x.dst === p && x.t < T).length]));
      F['time since last fixated'] = new Map(cands.map(p => { const h = fixE.filter(x => x.dst === p && x.t < T).pop(); return [p, h ? T - h.t : 1e9]; }));
      F['dist to fixated/1st target'] = new Map(cands.map(p => [p, D(pos.get(p), interp(tl.get(ms[0].dst), T))]));
      F['dist to previous target'] = new Map(cands.map(p => [p, D(pos.get(p), interp(tl.get(ms[i - 1].dst), T))]));
      F['nb players within 240'] = new Map(cands.map(p => [p, players.filter(o => o !== p && D(interp(tl.get(o), T), pos.get(p)) < 240).length]));
      F['profession id'] = new Map(cands.map(p => [p, agents.get(p).prof * 100 + (agents.get(p).elite % 100)]));
      for (const [k, v] of Object.entries(F)) addRank(k, cands, v, picked);
      samples.push({ f, c: c.t, i, picked, cands: cands.length });
    }
  }
}
console.log('picks analysed:', N, ' chance of top-1 at random:', (chance / N * 100).toFixed(1) + '%');
const rows = Object.entries(stats).map(([k, v]) => [k, v.top / v.n, v.exp / v.n, v.n]).sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
for (const [k, top, exp, n] of rows) console.log((top * 100).toFixed(1).padStart(5) + '% picked = ' + k.padEnd(42) + ' (random ' + (exp * 100).toFixed(1) + '%, n=' + n + ')');
