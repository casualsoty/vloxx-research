// Hit-rate map of an enemy attack in the CASTER's frame: rows = distance ahead (+) / behind (−) along the caster's facing
// (statechange 21) at the impact ms, columns = sideways distance (|left/right|). Shows cones, lines and rectangles that a
// circle model can't. Impacts = hits of the skill grouped per caster within 150 ms; every alive player with a reliable position counts.
// usage: node scripts/attack_grid.js <skillId> [cell=150] [maxAhead=2700] [maxBehind=900] [maxSide=1500]
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const dir = path.join(__dirname, '..', 'logs', 'raw'); const pb = Buffer.alloc(8);
const [SK, CELL = 150, AH = 2700, BH = 900, SD = 1500] = process.argv.slice(2).map(Number); if (!SK) { console.error('usage: node scripts/attack_grid.js <skillId> [cell]'); process.exit(1); }
const g = {}; let imps = 0, name = '';
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, skills, ev } = parseEvtc(path.join(dir, f)); if (!ev.find(e => e.sc === 9)) continue;
  const hs = ev.filter(e => e.skill === SK && e.sc === 0 && e.buff === 0 && (agents.get(e.dst) || {}).isPlayer && !(agents.get(e.src) || {}).isPlayer); if (!hs.length) continue; name = name || skills.get(SK) || '';
  const P = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const pos = new Map(), face = new Map();
  for (const e of ev) { if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
    else if (e.sc === 21) { pb.writeBigUInt64LE(e.dst); (face.get(e.src) || face.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); } }
  const step = (m, a, t) => { const p = m.get(a); if (!p) return null; let r = null; for (const x of p) { if (x[0] > t) break; r = x; } return r && [r[1], r[2]]; };
  const interp = (a, t) => { const p = pos.get(a); if (!p) return null; const i = p.findIndex(x => x[0] > t); if (i <= 0) return null; const [t1, x1, y1] = p[i - 1], [t2, x2, y2] = p[i];
    if (t2 - t1 > 600 && Math.min(t - t1, t2 - t) > 300) return null; const k = (t - t1) / (t2 - t1); return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]; };
  const state = new Map(); for (const e of ev) if ([3, 4, 5, 6].includes(e.sc)) (state.get(e.src) || state.set(e.src, []).get(e.src)).push([e.t, e.sc]);
  const alive = (a, t) => { let up = true; for (const [tt, sc] of state.get(a) || []) { if (tt > t) break; up = sc === 3 || sc === 6; } return up; };
  const groups = []; for (const e of hs) { const im = groups.find(x => x.src === e.src && Math.abs(x.t - e.t) < 150); if (im) im.h.add(e.dst); else groups.push({ src: e.src, t: e.t, h: new Set([e.dst]) }); }
  for (const im of groups) { const c = step(pos, im.src, im.t), fc = step(face, im.src, im.t); if (!c || !fc) continue; imps++; const L = Math.hypot(fc[0], fc[1]) || 1, ux = fc[0] / L, uy = fc[1] / L;
    for (const p of P) { if (!alive(p, im.t)) continue; const q = interp(p, im.t); if (!q) continue; const dx = q[0] - c[0], dy = q[1] - c[1];
      const al = dx * ux + dy * uy, sd = Math.abs(-dx * uy + dy * ux); if (al > AH || al < -BH || sd > SD) continue;
      const k = Math.floor(al / CELL) * CELL + ',' + Math.floor(sd / CELL) * CELL; (g[k] = g[k] || [0, 0])[im.h.has(p) ? 0 : 1]++; } }
}
console.log(`skill ${SK} ${name}: ${imps} impacts. Hit % per cell (${CELL} units; '.' = < 8 samples). Rows: ahead(+)/behind(−) along the caster's facing; columns: sideways.`);
const cols = []; for (let s = 0; s <= SD - CELL; s += CELL) cols.push(s);
console.log('  ahead\\side ' + cols.map(c => String(c).padStart(5)).join(''));
for (let a = Math.floor(AH / CELL) * CELL - CELL; a >= -BH; a -= CELL) console.log(String(a).padStart(11) + ' ' + cols.map(c => { const v = g[a + ',' + c]; return v && v[0] + v[1] >= 8 ? String(Math.round(100 * v[0] / (v[0] + v[1]))).padStart(5) : '    .'; }).join(''));
