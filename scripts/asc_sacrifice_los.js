// Line-of-sight test for shackle picks 2/3: if terrain blocked LoS, some areas (absolute map position, or
// direction+distance from Vloxx) would have pick rates near zero. Compare observed picks vs expected (uniform among candidates).
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const dir = path.join(__dirname, '..', 'logs', 'raw');
const interp = (L, t) => { if (!L || !L.length) return null; let i = L.findIndex(p => p[0] > t); if (i === -1) return L[L.length - 1].slice(1); if (i === 0) return L[0].slice(1); const [p, q] = [L[i - 1], L[i]]; const k = (t - p[0]) / (q[0] - p[0]); return [p[1] + k * (q[1] - p[1]), p[2] + k * (q[2] - p[2])]; };
const grid = {}, polar = {}, zcell = {}; let N = 0; const pts = [];
const add = (M, k, picked, w) => { M[k] = M[k] || { obs: 0, exp: 0, n: 0 }; M[k].exp += w; M[k].n++; if (picked) M[k].obs++; };
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue;
  if (Math.max(0, ...ev.filter(e => e.sc === 12 && e.src === boss.addr).map(e => Number(e.dst))) < 70e6) continue;
  const players = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const tl = new Map(); const b = Buffer.alloc(8), b4 = Buffer.alloc(4);
  for (const e of ev) if (e.sc === 19) { b.writeBigUInt64LE(e.dst); b4.writeInt32LE(e.value); (tl.get(e.src) || tl.set(e.src, []).get(e.src)).push([e.t, b.readFloatLE(0), b.readFloatLE(4), b4.readFloatLE(0)]); }
  const zAt = (a, t) => { const L = tl.get(a); if (!L) return null; let r = L[0]; for (const p of L) { if (p[0] > t) break; r = p; } return r[3]; };
  const up = (p, t) => { let s = 'up'; for (const e of ev) { if (e.t > t) break; if (e.src !== p) continue; if (e.sc === 4) s = 'D'; if (e.sc === 5) s = 'd'; if (e.sc === 3 || e.sc === 6) s = 'up'; } return s === 'up'; };
  const sh = ev.filter(e => e.sc === 62 && e.skill === 37976);
  for (const c of ev.filter(e => e.src === boss.addr && e.sc === 67 && e.skill === 81076)) {
    const ms = sh.filter(m => m.t - c.t >= 0 && m.t - c.t < 4000);
    for (let i = 1; i < ms.length; i++) {
      const T = ms[i].t; const chosen = ms.slice(0, i).map(m => m.dst); const cands = players.filter(p => up(p, T) && !chosen.includes(p)); if (cands.length < 2) continue; N++;
      const bp = interp(tl.get(boss.addr), T); const bz = zAt(boss.addr, T);
      for (const p of cands) { const q = interp(tl.get(p), T); if (!q || !bp) continue; const picked = p === ms[i].dst, w = 1 / cands.length;
        add(grid, Math.floor(q[0] / 300) * 300 + ',' + Math.floor(q[1] / 300) * 300, picked, w);
        const ang = Math.round(((Math.atan2(q[1] - bp[1], q[0] - bp[0]) * 180 / Math.PI) + 360) % 360 / 45) * 45 % 360; const d = Math.hypot(q[0] - bp[0], q[1] - bp[1]);
        add(polar, 'dir ' + String(ang).padStart(3) + '° ' + (d < 300 ? '0-300' : d < 600 ? '300-600' : '600+'), picked, w);
        const dz = zAt(p, T) - bz; add(zcell, dz > 30 ? 'player >30 above boss' : dz < -30 ? 'player >30 below boss' : 'same height (±30)', picked, w);
        pts.push([q[0], q[1], picked ? 1 : 0]); }
    }
  }
}
const show = (title, M, minExp) => { console.log('\n' + title); const rows = Object.entries(M).filter(([k, v]) => v.exp >= minExp).sort((a, b) => a[1].obs / a[1].exp - b[1].obs / b[1].exp);
  for (const [k, v] of rows) { const z = (v.obs - v.exp) / Math.sqrt(v.exp); console.log('   ' + k.padEnd(28) + ' picked ' + String(v.obs).padStart(4) + '  expected ' + v.exp.toFixed(1).padStart(6) + '  ratio ' + (v.obs / v.exp).toFixed(2) + '  z ' + z.toFixed(1)); } };
console.log('picks analysed', N);
show('By direction from Vloxx (0° = +x / east) and distance:', polar, 5);
show('By height relative to Vloxx:', zcell, 3);
show('By absolute map cell (300x300), cells with >= 8 expected picks, sorted by ratio:', grid, 8);
const chi = Object.values(grid).filter(v => v.exp >= 5).reduce((s, v) => s + (v.obs - v.exp) ** 2 / v.exp, 0), dof = Object.values(grid).filter(v => v.exp >= 5).length - 1;
console.log(`\nmap-cell chi-square ${chi.toFixed(1)} on ${dof} cells (random ≈ ${dof}, p<0.01 needs ≳ ${(dof + 2.33 * Math.sqrt(2 * dof)).toFixed(0)})`);
const pc = Object.values(polar).filter(v => v.exp >= 5); const chiP = pc.reduce((s, v) => s + (v.obs - v.exp) ** 2 / v.exp, 0);
console.log(`direction/distance chi-square ${chiP.toFixed(1)} on ${pc.length - 1} bins (p<0.01 needs ≳ ${(pc.length - 1 + 2.33 * Math.sqrt(2 * (pc.length - 1))).toFixed(0)})`);
fs.writeFileSync(path.join(__dirname, '..', 'data', 'ascension_sacrifice_positions.csv'), 'x,y,picked\n' + pts.map(p => p.map(v => Math.round(v)).join(',')).join('\n') + '\n');
