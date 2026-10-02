// Unified loader for Vloxx (Nexus of Eternity, boss id 28106) logs.
// Handles raw arcdps .zevtc (unzipped EVTC) via evtc.js and Elite Insights JSON (dps.report / Wingman).
// Every loader returns the same shape so the analysis scripts don't care about the source.
const fs = require('fs');
const path = require('path');
const { parseEvtc } = require('./evtc');

const ID = {
  BOSS_SPECIES: 28106,
  GREEN_EFFECT: 10269,     // agent effect "Judgment of Eternity" 3-people green marker (raw id in these logs)
  PD_EFFECT: 6188,         // agent effect "Probability Distribution" spread/puddle marker (raw id)
  FIXATED: 34508,          // buff "Fixated (Timed)"
  STEALTH: 13017,
  ASCENSION: 80368,
  LAST_PHASE_CHANNEL: 81071, // Vloxx channel that starts the last phase ("P3")
  ORB_MAXHP: 14940,        // Ascension Orb agents have this max HP
};

function interp(L, t) {
  if (!L || !L.length) return null;
  let i = L.findIndex(p => p[0] > t);
  if (i === -1) return L[L.length - 1].slice(1);
  if (i === 0) return L[0].slice(1);
  const [p, q] = [L[i - 1], L[i]];
  const k = (t - p[0]) / (q[0] - p[0]);
  return [p[1] + k * (q[1] - p[1]), p[2] + k * (q[2] - p[2])];
}

// ---------- raw EVTC ----------
function loadRaw(file) {
  const { agents, skills, ev } = parseEvtc(file);
  const s9 = ev.find(e => e.sc === 9); if (!s9) return null;
  const t0 = s9.t;
  const T = e => e.t - t0;
  const nm = a => (agents.get(a)?.name || '?').split('\0')[0];
  const bossA = [...agents.values()].find(a => a.species === ID.BOSS_SPECIES); if (!bossA) return null;
  const boss = bossA.addr;
  const maxHP = Math.max(0, ...ev.filter(e => e.sc === 12 && e.src === boss).map(e => Number(e.dst)));
  const playersA = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff);
  const players = playersA.map(a => nm(a.addr));
  const byName = new Map(playersA.map(a => [nm(a.addr), a.addr]));
  const tl = new Map(); const b = Buffer.alloc(8);
  for (const e of ev) if (e.sc === 19) { b.writeBigUInt64LE(e.dst); (tl.get(e.src) || tl.set(e.src, []).get(e.src)).push([T(e), b.readFloatLE(0), b.readFloatLE(4)]); }
  const p3e = ev.find(e => e.skill === ID.LAST_PHASE_CHANNEL && e.sc === 67);
  const fix = ev.filter(e => e.skill === ID.FIXATED && (e.sc === 69 || e.sc === 72)).map(e => ({ t: T(e), on: e.sc === 69, p: nm(e.sc === 69 ? e.dst : e.src) }));
  const stealth = {}, curS = {};
  for (const e of ev) if (e.skill === ID.STEALTH) {
    if (e.sc === 69 && agents.get(e.dst)?.isPlayer) { const p = nm(e.dst); if (curS[p] == null) curS[p] = T(e); }
    if (e.sc === 72 && agents.get(e.src)?.isPlayer) { const p = nm(e.src); if (curS[p] != null) { (stealth[p] = stealth[p] || []).push([curS[p], T(e)]); curS[p] = null; } }
  }
  const down = {}, dead = {};
  for (const a of playersA) {
    const n = nm(a.addr); let s = null, st = null;
    for (const e of ev) { if (e.src !== a.addr) continue; const t = T(e);
      if (e.sc === 5) { s = 'd'; st = t; }
      if (e.sc === 4) { if (s === 'd') (down[n] = down[n] || []).push([st, t]); (dead[n] = dead[n] || []).push([t, 1e12]); s = 'D'; }
      if ((e.sc === 3 || e.sc === 6) && s === 'd') { (down[n] = down[n] || []).push([st, t]); s = null; }
    }
    if (s === 'd') (down[n] = down[n] || []).push([st, 1e12]);
  }
  const orbIds = new Set(ev.filter(e => e.sc === 12 && Number(e.dst) === ID.ORB_MAXHP).map(e => e.src));
  const orbs = [];
  for (const o of orbIds) {
    const E = ev.filter(e => e.src === o); const sp = E.find(e => e.sc === 6); if (!sp) continue;
    const endE = E.find(e => e.sc === 77); const tc = E.find(e => e.sc === 22);
    orbs.push({ spawn: T(sp), end: endE ? T(endE) : null, teamChange: tc ? T(tc) : null, pos: interp(tl.get(o), T(sp) + 100) });
  }
  const aspects = [];
  const aspType = a => { const m = (agents.get(a)?.name || '').match(/Aspect of the (Staff|Spear|Sword)/); return m ? m[1] : null; };
  const pct = new Map(), state = new Map(); const b4 = Buffer.alloc(4);
  for (const e of ev) { const ty = aspType(e.src); if (!ty) continue;
    if (e.sc === 6) aspects.push({ t: T(e), kind: 'spawn', type: ty, id: e.src.toString(16) });
    if (e.sc === 4) aspects.push({ t: T(e), kind: 'death', type: ty, id: e.src.toString(16) });
    if (e.sc === 35) { b4.writeInt32LE(e.value); pct.set(e.src, b4.readFloatLE(0)); }
    if (e.sc === 34) { const prev = state.get(e.src); state.set(e.src, e.value);
      if (e.value === 2 && prev === 0 && (pct.get(e.src) ?? 1) < 0.05) aspects.push({ t: T(e), kind: 'breakbar_broken', type: ty, id: e.src.toString(16) }); }
  }
  const bossHP = ev.filter(e => e.sc === 8 && e.src === boss).map(e => [T(e), Number(e.dst) / 100]);
  return {
    source: 'raw', file: path.basename(file), recordedBy: null, bossMaxHP: maxHP, success: null,
    durationMs: T(ev[ev.length - 1]), p3: p3e ? T(p3e) : null, phases: null, players,
    greens: ev.filter(e => e.sc === 62 && e.skill === ID.GREEN_EFFECT).map(e => ({ t: T(e), p: nm(e.dst) })),
    pd: ev.filter(e => e.sc === 62 && e.skill === ID.PD_EFFECT).map(e => ({ t: T(e), p: nm(e.dst) })),
    fix, stealth, down, dead, orbs, aspects, bossHP,
    pos: (p, t) => interp(tl.get(byName.get(p)), t),
    bossPos: t => interp(tl.get(boss), t),
  };
}

// ---------- Elite Insights JSON ----------
function loadEI(file) {
  const raw = fs.readFileSync(file); const j = JSON.parse((file.endsWith('.gz') ? require('zlib').gunzipSync(raw) : raw).toString('utf8'));
  const md = j.combatReplayMetaData;
  const boss = j.targets.find(t => /^Vloxx/.test(t.name)); if (!boss) return null;
  const sample = (cr, t) => { if (!cr || !cr.positions) return null; const i = Math.min(cr.positions.length - 1, Math.max(0, Math.round((t - (cr.start || 0)) / md.pollingRate))); const q = cr.positions[i]; return [q[0] / md.inchToPixel, q[1] / md.inchToPixel]; };
  const mech = re => { const o = []; for (const m of j.mechanics) if (re.test(m.name)) for (const d of m.mechanicsData) o.push({ t: d.time, p: d.actor }); return o.sort((a, b) => a.t - b.t); };
  const greens = mech(/3Green/), pd = mech(/Pddl/);
  let p3 = null; const fin = j.phases.find(p => /Final/.test(p.name));
  if (fin) { const gP3 = greens.filter(x => x.t > fin.start - 20000); const x = gP3.length ? pd.find(x => x.t > gP3[0].t) : null; if (x) p3 = x.t - 23000; }
  const fix = [], stealth = {}, down = {}, dead = {};
  for (const p of j.players) {
    const bf = (p.buffUptimes || []).find(b => b.id === ID.FIXATED); if (bf) { let prev = 0; for (const [t, v] of bf.states) { if (v && !prev) fix.push({ t, on: true, p: p.name }); if (!v && prev) fix.push({ t, on: false, p: p.name }); prev = v; } }
    const bs = (p.buffUptimes || []).find(b => b.id === ID.STEALTH); if (bs) { let prev = 0, a = 0; for (const [t, v] of bs.states) { if (v && !prev) a = t; if (!v && prev) (stealth[p.name] = stealth[p.name] || []).push([a, t]); prev = v; } }
    down[p.name] = p.combatReplayData.down || []; dead[p.name] = p.combatReplayData.dead || [];
  }
  fix.sort((a, b) => a.t - b.t);
  return {
    source: 'EI', file: path.basename(file), recordedBy: j.recordedBy, bossMaxHP: boss.totalHealth, success: j.success,
    durationMs: j.durationMS, p3, phases: j.phases.filter(p => /^(Staff|Spear|Sword) Phase|^Split \d|^Final Form/.test(p.name)).map(p => ({ name: p.name, start: p.start, end: p.end })),
    players: j.players.map(p => p.name), greens, pd, fix, stealth, down, dead, orbs: null, aspects: null,
    bossHP: boss.healthPercents,
    pos: (p, t) => { const pl = j.players.find(x => x.name === p); const q = sample(pl.combatReplayData, t); const c = sample(boss.combatReplayData, 0); return q && c && Math.hypot(q[0] - c[0], q[1] - c[1]) < 0.01 ? null : q; },
    bossPos: t => sample(boss.combatReplayData, t),
  };
}

// helpers shared by analyses
function holderAt(L, t) { let h = null; for (const e of L.fix) { if (e.t > t) break; if (e.on) h = e.p; else if (e.p === h) h = null; } return h; }
function isUp(L, p, t) { return !(L.down[p] || []).some(([a, b]) => t >= a && t < b) && !(L.dead[p] || []).some(([a, b]) => t >= a && t < b); }
function inStealth(L, p, t) { return (L.stealth[p] || []).some(([a, b]) => t >= a - 150 && t <= b + 150); }
function lossCause(L, on, off) {
  const held = (off.t - on.t) / 1000;
  if (Math.abs(held - 60) < 0.4) return 'expired';
  if ((L.stealth[on.p] || []).some(([a]) => Math.abs(a - off.t) < 300)) return 'stealth';
  if ((L.down[on.p] || []).some(([a]) => Math.abs(a - off.t) < 600)) return 'down';
  if ((L.dead[on.p] || []).some(([a]) => Math.abs(a - off.t) < 900)) return 'dead';
  return 'other';
}
function fixSpans(L) { // [{p,on,off,cause}]
  const out = []; const open = {};
  for (const e of L.fix) { if (e.on) { const s = { p: e.p, on: e.t, off: null }; out.push(s); open[e.p] = s; } else if (open[e.p] && open[e.p].off == null) open[e.p].off = e.t; }
  for (const s of out) s.cause = s.off == null ? 'still_on' : lossCause(L, { p: s.p, t: s.on }, { t: s.off });
  return out;
}
module.exports = { ID, loadRaw, loadEI, holderAt, isUp, inStealth, fixSpans };
