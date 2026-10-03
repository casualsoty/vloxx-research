// Measures the real hit shape of enemy attacks from raw logs (generalises the Cosmic Charge / Worldpiercer method).
// For each skill: hits on players are grouped into "impacts" (same caster, within 150 ms). At each impact every alive player with
// a reliable position is either hit (any damage event of that skill incl. block/evade/invuln results) or not.
// Shapes tested (all measured at the impact ms; NPC positions = last logged, players interpolated):
//   caster   — circle around the caster
//   cone     — same, plus angle to the caster's facing (statechange 21) → half-angle
//   effect:N — circle around effect N (ground effect position, or the agent carrying an agent effect) created by the caster
//              0–8 s before the impact, by the caster, any other NPC, or (for the known target markers 10269 green, 12014,
//              6188 Probability Distribution, 37976 shackle) anyone — the effect id that best separates hit / not hit is chosen
// Radius = where the hit rate falls below half of the inner plateau (25-unit bands). Score = plateau − rate just outside.
// usage: node scripts/attack_shapes.js [skillId ...]   → data/attack_shapes.json (all skills in the list below if none given)
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8);
// skill id → label (planner preset it validates, if any)
const SKILLS = {
  80629: 'Judgment of Eternity — failed 3-people green (early phases)', 80378: 'Judgment of Eternity — failed green (last phase)',
  81076: "Ascension's Sacrifice — 2-people green (shackle)", 80809: 'Probability Distribution (spread)', 81318: 'Probability Distribution (2)',
  80484: '80484 (Vloxx)', 80483: '80483 (Vloxx, big hit)', 81230: '81230 Surrounding Curse? (Staff)', 80810: 'Raging Storm (Vloxx)', 80965: 'Raging Storm (Bulwark)',
  81176: 'Raging Storm (Vloxx, last phase)', 80323: 'Annihilating Orb (Vloxx)', 81238: 'Annihilating Orb (2)', 81273: '81273 (Cosmic Piercer)',
  81053: 'Excision Extremis (Vloxx)', 80901: 'Excision Extremis (Vloxx, last phase)', 81326: 'Excision Extremis (Sword)', 81271: 'Echoing Blade (Vloxx)',
  81330: 'Division Eternal (Sword)', 80585: '80585 (Vloxx)', 80555: 'Thousand Strikes (Vloxx)', 80709: 'Thousand Strikes (Spear)',
  80940: 'Ancora Strike (Staff/Spear)', 81327: 'Ancora Strike (Sword)', 80871: 'Cosmic Charge (Spear)', 80420: 'Visions of Eternity', 81017: 'Visions of Eternity (2)',
  81015: 'Worldpiercer (Cosmic Bulwark)', 80717: '80717 (Cosmic Bulwark)', 80512: 'Cosmic Charge (Vloxx) — reference, measured separately',
};
const want = process.argv.slice(2).map(Number).filter(Boolean); const IDS = want.length ? want : Object.keys(SKILLS).map(Number);
const acc = {}; for (const id of IDS) acc[id] = { name: '', impacts: 0, casters: {}, caster: {}, cone: [], eff: {} };
const add = (o, d, h) => { const b = Math.floor(d / 25) * 25; (o[b] = o[b] || [0, 0])[h ? 0 : 1]++; };
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, skills, ev } = parseEvtc(path.join(dir, f)); if (!ev.find(e => e.sc === 9)) continue;
  const P = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr); const PS = new Set(P);
  const pos = new Map(), face = new Map();
  for (const e of ev) { if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
    else if (e.sc === 21) { pb.writeBigUInt64LE(e.dst); (face.get(e.src) || face.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); } }
  const step = (m, a, t) => { const p = m.get(a); if (!p) return null; let r = null; for (const x of p) { if (x[0] > t) break; r = x; } return r && [r[1], r[2]]; };
  const interp = (a, t) => { const p = pos.get(a); if (!p) return null; const i = p.findIndex(x => x[0] > t); if (i <= 0) return null; const [t1, x1, y1] = p[i - 1], [t2, x2, y2] = p[i];
    if (t2 - t1 > 600 && Math.min(t - t1, t2 - t) > 300) return null; const k = (t - t1) / (t2 - t1); return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]; };
  const where = (a, t) => PS.has(a) ? interp(a, t) : step(pos, a, t);
  const state = new Map(); for (const e of ev) if ([3, 4, 5, 6].includes(e.sc)) (state.get(e.src) || state.set(e.src, []).get(e.src)).push([e.t, e.sc]);
  const alive = (a, t) => { let up = true; for (const [tt, sc] of state.get(a) || []) { if (tt > t) break; up = sc === 3 || sc === 6; } return up; };
  // effects (ground 60 → packed position; agent 62 → carrier agent) by owner
  // effect ids are assigned per log → key everything by GUID (statechange 46). Known target markers by GUID prefix:
  // BC9F7038 green circle, BA183F42 green companion, BDF70822 Probability Distribution, A47987D0 shackle
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  const MARK = new Set(['BC9F7038', 'BA183F42', 'BDF70822', 'A47987D0']);
  // NPC = not a player and not owned by a player (illusions, pets, minions, turrets are excluded)
  const inst = new Map(); for (const e of ev) if (e.srcInst && !inst.has(e.src)) inst.set(e.src, e.srcInst);
  const pInst = new Set([...agents.values()].filter(a => a.isPlayer).map(a => inst.get(a.addr)).filter(Boolean));
  const owned = new Set(); for (const e of ev) if (e.srcMaster && pInst.has(e.srcMaster)) owned.add(e.src);
  const npc = a => { const x = agents.get(a); return x && !x.isPlayer && !owned.has(a); };
  const effBy = new Map(); const effNpc = []; for (const e of ev) { if (e.sc !== 60 && e.sc !== 62) continue; let p = null, carrier = null;
    if (e.sc === 60) { pb.writeBigUInt64LE(e.dst); p = [pb.readInt16LE(0) * 10, pb.readInt16LE(2) * 10]; } else carrier = e.dst;
    const x = { t: e.t, id: gid.get(e.skill) || ('id' + e.skill), p, carrier }; (effBy.get(e.src) || effBy.set(e.src, []).get(e.src)).push(x); if (npc(e.src) || MARK.has(x.id)) effNpc.push(x); }
  const hitsBy = new Map(); for (const e of ev) if (e.sc === 0 && e.buff === 0 && PS.has(e.dst) && acc[e.skill] && !(agents.get(e.src) || {}).isPlayer) (hitsBy.get(e.skill) || hitsBy.set(e.skill, []).get(e.skill)).push(e);
  for (const [id, hs] of hitsBy) {
    const A = acc[id]; A.name = A.name || skills.get(id) || '';
    const imps = []; for (const e of hs) { const im = imps.find(x => x.src === e.src && Math.abs(x.t - e.t) < 150); if (im) im.h.add(e.dst); else imps.push({ src: e.src, t: e.t, h: new Set([e.dst]) }); }
    for (const im of imps) {
      const cpos = step(pos, im.src, im.t); const cname = ((agents.get(im.src) || {}).name || '?').split('\0')[0]; A.casters[cname] = (A.casters[cname] || 0) + 1; A.impacts++;
      const fc = step(face, im.src, im.t); const fa = fc ? Math.atan2(fc[1], fc[0]) : null;
      const own = new Set(effBy.get(im.src) || []); const effs = effNpc.filter(x => x.t <= im.t && im.t - x.t <= 8000).concat((effBy.get(im.src) || []).filter(x => !effNpc.includes(x) && x.t <= im.t && im.t - x.t <= 8000));
      for (const pl of P) { if (!alive(pl, im.t)) continue; const q = where(pl, im.t); if (!q) continue; const hit = im.h.has(pl);
        if (cpos) { const d = Math.hypot(q[0] - cpos[0], q[1] - cpos[1]); add(A.caster, d, hit);
          if (fa != null && d < 1600) { let ang = Math.abs((Math.atan2(q[1] - cpos[1], q[0] - cpos[0]) - fa) * 180 / Math.PI) % 360; if (ang > 180) ang = 360 - ang; A.cone.push([d, ang, hit ? 1 : 0]); } }
        // nearest instance of each effect id (anchor) → distance
        const byId = {}; for (const x of effs) { const ap = x.p || (x.carrier && where(x.carrier, im.t)); if (!ap) continue; const d = Math.hypot(q[0] - ap[0], q[1] - ap[1]); if (byId[x.id] == null || d < byId[x.id].d) byId[x.id] = { d, x, ap }; }
        for (const [eid, v] of Object.entries(byId)) { const o = (A.eff[eid] = A.eff[eid] || { n: 0, b: {}, dt: [], dc: [], carried: 0, ground: 0 }); add(o.b, v.d, hit);
          if (hit && o.dt.length < 4000) { o.dt.push((im.t - v.x.t) / 1000); if (cpos) o.dc.push(Math.hypot(v.ap[0] - cpos[0], v.ap[1] - cpos[1])); v.x.p ? o.ground++ : o.carried++; } }
      }
      for (const eid of new Set(effs.map(x => x.id))) A.eff[eid] && A.eff[eid].n++;
    }
  }
}
// edge of a band histogram
function edge(b) {
  const ks = Object.keys(b).map(Number).sort((x, y) => x - y); const rate = k => b[k][0] / (b[k][0] + b[k][1]); const n = k => b[k][0] + b[k][1];
  const hitsTot = ks.reduce((s, k) => s + b[k][0], 0); if (hitsTot < 20) return null;
  // plateau: first bands containing the inner 50 % of hits
  let cum = 0, innerEnd = ks[0]; for (const k of ks) { cum += b[k][0]; innerEnd = k; if (cum >= hitsTot * 0.5) break; }
  const inner = ks.filter(k => k <= innerEnd && n(k) >= 5); if (!inner.length) return null; const plateau = inner.reduce((s, k) => s + b[k][0], 0) / inner.reduce((s, k) => s + n(k), 0);
  for (const k of ks) if (k > innerEnd && n(k) >= 5 && rate(k) < plateau / 2 && ks.filter(x => x > k && x < k + 100 && n(x) >= 3).every(x => rate(x) < plateau / 2)) {
    const out = ks.filter(x => x >= k + 50 && x < k + 300); const outRate = out.reduce((s, x) => s + b[x][0], 0) / Math.max(1, out.reduce((s, x) => s + n(x), 0));
    const at = ks.find(x => x === k - 25); return { radius: k, plateau: +plateau.toFixed(2), outside: +outRate.toFixed(2), score: +(plateau - outRate).toFixed(2), edgeRate: at != null ? +rate(at).toFixed(2) : null };
  }
  return { radius: null, plateau: +plateau.toFixed(2), score: 0 };
}
const out = {};
for (const id of IDS) {
  const A = acc[id]; if (!A.impacts) { out[id] = { label: SKILLS[id], impacts: 0 }; continue; }
  const models = []; const c = edge(A.caster); if (c) models.push({ model: 'caster', ...c });
  for (const [eid, o] of Object.entries(A.eff)) { if (o.n < A.impacts * 0.3) continue; const e = edge(o.b); const med = a => { a = a.slice().sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
    if (e && e.radius) models.push({ model: 'effect:' + eid, coverage: +(o.n / A.impacts).toFixed(2), ...e, delayS: +(med(o.dt) || 0).toFixed(2), anchorToCaster: Math.round(med(o.dc) || 0), anchor: o.ground >= o.carried ? 'ground' : 'carried by an agent' }); }
  models.sort((x, y) => y.score - x.score);
  // cone (only meaningful for caster-centred attacks): half-angle containing 90 % of hits within the caster radius
  let cone = null; const R = c && c.radius; if (R) { const inR = A.cone.filter(x => x[0] < R); const hitA = inR.filter(x => x[2]).map(x => x[1]).sort((a, b) => a - b);
    if (hitA.length >= 20) { const half = hitA[Math.floor(0.9 * (hitA.length - 1))]; const insideRate = inR.filter(x => x[1] <= half); const outside = inR.filter(x => x[1] > half + 15);
      cone = { halfAngle90: Math.round(half), hitRateInside: +(insideRate.filter(x => x[2]).length / Math.max(1, insideRate.length)).toFixed(2), hitRateOutside: +(outside.filter(x => x[2]).length / Math.max(1, outside.length)).toFixed(2) }; } }
  out[id] = { label: SKILLS[id], name: A.name, impacts: A.impacts, casters: A.casters, best: models[0] || null, models: models.slice(0, 3), cone };
}
fs.writeFileSync(path.join(ROOT, 'data', 'attack_shapes.json'), JSON.stringify(out, null, 1));
for (const [id, o] of Object.entries(out)) { if (!o.impacts) { console.log(id, o.label, '— no hits'); continue; }
  const b = o.best; const cn = o.cone && o.cone.halfAngle90 < 150 ? ` | cone ±${o.cone.halfAngle90}° (in ${o.cone.hitRateInside}, out ${o.cone.hitRateOutside})` : '';
  console.log(`${id} ${o.label} [${Object.keys(o.casters).slice(0, 2).join(', ')}] impacts ${o.impacts} → ${b ? `${b.model} r≈${b.radius} (plateau ${b.plateau}, outside ${b.outside}, score ${b.score}${b.delayS != null ? `; ${b.anchor}, appears ${b.delayS}s before, ${b.anchorToCaster} from caster` : ''})` : 'no clear shape'}${cn}`); }
