// Last phase: who do Vloxx's falling spears (Raging Storm, ground effect GUID D1132020…) target?
// A spear's 3 s ground effect appears on the position of a player; the target = the living player within 80 units of it at that ms.
// Model tested here: every 12 s from 15 s into the phase (15, 27, 39, …) Vloxx picks a SET of targets; the set receives a spear every
// 3 s for six waves (set start, +3, +6, +9, +12, +15 s). The last two waves of a set overlap the first two of the next one: those are
// the "double" waves. So the waves at +6 / +9 s of a set show that set alone.
// Checked: the same players in both single waves of a set; that set contained in the double waves before and after it; the fixated
// player (buff 34508) in the set; set size with and without a fixated player; who the other targets are (distance rank, repeats).
// Writes data/raging_storm_targets.csv (one row per set) and data/raging_storm_targets.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8); const C = [12221.6, 15327.4];
const rows = []; let logs = 0, spears = 0, onPlayer = 0, onDowned = 0;
const chk = { sameInBothSingles: [0, 0], inDoubleBefore: [0, 0], inDoubleAfter: [0, 0] }; const sizeBy = { fixated: {}, nobodyFixated: {} }; const fix = { sets: 0, inSet: 0 }; const rank = {}; const rep = { kept: 0, of: 0, chance: 0 };
const perPlayer = { never: 0, players: 0, max: [] };
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue; const lc = ev.find(e => e.sc === 67 && e.src === boss.addr && e.skill === 81071); if (!lc) continue; logs++;
  const isP = a => (agents.get(a) || {}).isPlayer; const P = [...agents.values()].filter(a => a.isPlayer);
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  const life = new Map(), pos = new Map(); for (const e of ev) { if ([3, 4, 5].includes(e.sc)) (life.get(e.src) || life.set(e.src, []).get(e.src)).push([e.t, e.sc]); if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); } }
  const st = (a, t) => { let s = 3; for (const x of life.get(a) || []) { if (x[0] > t) break; s = x[1]; } return s; };
  const lerp = (a, t) => { const p = pos.get(a) || []; let lo = null, hi = null; for (const x of p) { if (x[0] <= t) lo = x; else { hi = x; break; } } if (!lo) return null; if (!hi) return lo.slice(1); const k = (t - lo[0]) / (hi[0] - lo[0]); return [lo[1] + k * (hi[1] - lo[1]), lo[2] + k * (hi[2] - lo[2])]; };
  const fxb = ev.filter(e => e.skill === 34508 && ((e.sc === 69 && isP(e.dst)) || ((e.sc === 71 || e.sc === 72) && isP(e.src)))).sort((a, b) => a.t - b.t);
  const holderAt = t => { let h = null, end = 0; for (const e of fxb) { if (e.t > t) break; if (e.sc === 69) { h = e.dst; end = e.t + e.value; } else if (e.src === h) h = null; } return h != null && end > t ? h : null; };
  const fx = ev.filter(e => e.sc === 60 && e.src === boss.addr && gid.get(e.skill) === 'D1132020' && e.t >= lc.t).map(e => { pb.writeBigUInt64LE(e.dst); return { t: e.t, x: pb.readInt16LE(0) * 10, y: pb.readInt16LE(2) * 10 }; });
  const W = new Map(); for (const e of fx) { const slot = Math.round((e.t - lc.t) / 3000) * 3; const w = W.get(slot) || W.set(slot, { t: e.t, pts: [] }).get(slot); w.pts.push(e); }
  const cnt = new Map(P.map(a => [a.addr, 0]));
  for (const w of W.values()) { const live = P.filter(a => st(a.addr, w.t) !== 4).map(a => ({ a: a.addr, q: lerp(a.addr, w.t) })).filter(o => o.q); w.live = live; w.tg = [];
    for (const p of w.pts) { spears++; let best = null, bd = 1e9; live.forEach(o => { const d = Math.hypot(o.q[0] - p.x, o.q[1] - p.y); if (d < bd) { bd = d; best = o; } }); if (best && bd < 80) { onPlayer++; if (st(best.a, w.t) === 5) onDowned++; w.tg.push(best.a); cnt.set(best.a, cnt.get(best.a) + 1); } else w.tg.push(null); } }
  const len = (ev[ev.length - 1].t - lc.t) / 1000; if (len > 45) { const v = [...cnt.values()]; perPlayer.players += v.length; perPlayer.never += v.filter(x => !x).length; perPlayer.max.push(Math.max(...v)); }
  // sets: start slots 15, 27, 39, …; a set alone at start+6 and start+9
  let prev = null; for (let s = 15; W.has(s + 6); s += 12) { const a = W.get(s + 6), b = W.get(s + 9); if (a.tg.includes(null)) { prev = null; continue; } const set = new Set(a.tg); const h = holderAt(W.get(s) ? W.get(s).t : a.t), hNow = holderAt(a.t);
    const same = (x, y) => x.size === y.size && [...x].every(v => y.has(v)); const within = (x, w) => w && !w.tg.includes(null) ? [...x].every(v => w.tg.includes(v)) : null;
    if (b && !b.tg.includes(null)) { chk.sameInBothSingles[1]++; if (same(set, new Set(b.tg))) chk.sameInBothSingles[0]++; }
    const wb = s === 15 ? within(set, W.get(15)) : within(set, W.get(s)); if (wb != null) { chk.inDoubleBefore[1]++; if (wb) chk.inDoubleBefore[0]++; } const wa = within(set, W.get(s + 12)); if (wa != null) { chk.inDoubleAfter[1]++; if (wa) chk.inDoubleAfter[0]++; }
    const fixAlive = hNow != null && a.live.some(o => o.a === hNow); const k = fixAlive ? 'fixated' : 'nobodyFixated'; sizeBy[k][set.size] = (sizeBy[k][set.size] || 0) + 1; if (fixAlive) { fix.sets++; if (set.has(hNow)) fix.inSet++; }
    const others = a.live.filter(o => o.a !== hNow).map(o => ({ ...o, d: Math.hypot(o.q[0] - C[0], o.q[1] - C[1]) })).sort((x, y) => x.d - y.d); const nf = [...set].filter(v => v !== hNow);
    nf.forEach(v => { const r = others.findIndex(o => o.a === v) + 1; const third = r <= others.length / 3 ? 'closest third' : r > 2 * others.length / 3 ? 'farthest third' : 'middle third'; rank[third] = (rank[third] || 0) + 1; });
    if (prev) { rep.of += nf.length; rep.kept += nf.filter(v => prev.has(v)).length; rep.chance += nf.length * prev.size / Math.max(1, others.length); } prev = new Set(nf);
    rows.push({ log: f.replace('.zevtc', ''), set_start_s: s, targets: set.size, fixated_player_alive: fixAlive ? 1 : 0, fixated_in_set: fixAlive && set.has(hNow) ? 1 : 0, players_alive: a.live.length, same_targets_3s_later: b && !b.tg.includes(null) ? (same(set, new Set(b.tg)) ? 1 : 0) : '' }); } }
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'raging_storm_targets.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const pc = ([a, b]) => ({ yes: a, of: b, pct: b ? Math.round(100 * a / b) : null });
const summary = { logs, spears, onAPlayerPct: Math.round(100 * onPlayer / spears), onADownedPlayer: onDowned, sets: rows.length, model: { sameTargetsInBothSingleWaves: pc(chk.sameInBothSingles), setContainedInTheDoubleWaveBefore: pc(chk.inDoubleBefore), setContainedInTheDoubleWaveAfter: pc(chk.inDoubleAfter) },
  fixatedInTheSet: pc([fix.inSet, fix.sets]), setSize: sizeBy, otherTargetsByDistanceFromCentre: rank, otherTargetsKeptFromThePreviousSet: { kept: rep.kept, of: rep.of, pct: Math.round(100 * rep.kept / rep.of), byChancePct: Math.round(100 * rep.chance / rep.of) },
  perPlayerOverAPhase: { playersNeverTargetedPct: Math.round(100 * perPlayer.never / perPlayer.players), mostSpearsOnOnePlayer: { median: perPlayer.max.sort((a, b) => a - b)[Math.floor(perPlayer.max.length / 2)], max: Math.max(...perPlayer.max) } } };
fs.writeFileSync(path.join(ROOT, 'data', 'raging_storm_targets.json'), JSON.stringify(summary, null, 1)); console.log(JSON.stringify(summary, null, 1));
