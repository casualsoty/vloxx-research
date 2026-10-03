// Breakbars (defiance bars) of Vloxx, the Aspects and the Cosmic adds, from raw logs.
// Events used: statechange 34 = breakbar state (0 active, 1 recovering, 2 immune, 3 none), 35 = breakbar percent (float at byte 24),
// damage events with result 10 = breakbar damage, value in TENTHS (2000 = 200 breakbar damage). Player hits are positive; the
// unattributed ticks are soft CC (positive) and the bar's own drain while it is open (negative values, one tick per 0.3 s).
// Both kinds of tick empty the bar: player + soft CC + drain adds up to a constant per unit = the size of the bar.
// A "window" = from the bar becoming active (state 0) until it leaves that state. For each window: start/end percent, net breakbar
// damage logged, whether it was broken (percent reached 0), time to break. Size of the bar = net damage ÷ fraction of the bar removed,
// estimated on windows that were broken from (almost) full. Also: what the unit was casting when the bar opened, how long an
// unbroken bar stays open, the recovering time after a break, the regeneration per second.
// Writes data/breakbars.csv (one row per window) and data/breakbars_summary.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw');
const UNITS = [['Vloxx', /^Vloxx$/], ['Aspect of the Staff', /^Aspect of the Staff$/], ['Aspect of the Spear', /^Aspect of the Spear$/], ['Aspect of the Sword', /^Aspect of the Sword$/],
  ['Cosmic Piercer', /^Cosmic Piercer$/], ['Cosmic Bulwark', /^Cosmic Bulwark$/], ['Cosmic Sunderer', /^Cosmic Sunderer$/]];
const q = (a, f) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : null; };
const rows = []; const recov = {}, regen = {}, firstOpen = {}, reopen = {};
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, skills, ev, evStart, buf } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue; ev.forEach((e, i) => e.i = i);
  const unitOf = new Map(); for (const a of agents.values()) { if (a.isPlayer) continue; const n = (a.name || '').split('\0')[0]; const u = UNITS.find(([, rx]) => rx.test(n)); if (u) unitOf.set(a.addr, u[0]); }
  const by = new Map(); for (const e of ev) { if (e.sc === 34 || e.sc === 35) { if (unitOf.has(e.src)) (by.get(e.src) || by.set(e.src, []).get(e.src)).push(e); }
    else if (e.sc === 0 && e.result === 10 && unitOf.has(e.dst)) (by.get(e.dst) || by.set(e.dst, []).get(e.dst)).push(e); }
  const hp = new Map(); for (const e of ev) if (e.sc === 8 && unitOf.has(e.src)) (hp.get(e.src) || hp.set(e.src, []).get(e.src)).push([e.t, Number(e.dst) / 100]);
  const hpAt = (a, t) => { let r = null; for (const x of hp.get(a) || []) { if (x[0] > t) break; r = x[1]; } return r; };
  const spawn = new Map(); for (const e of ev) if (e.sc === 6 && unitOf.has(e.src) && !spawn.has(e.src)) spawn.set(e.src, e.t);
  const castsOf = new Map(); for (const e of ev) if (e.sc === 67 && unitOf.has(e.src)) (castsOf.get(e.src) || castsOf.set(e.src, []).get(e.src)).push(e);
  for (const [addr, es] of by) { const unit = unitOf.get(addr); // same timestamp: percent updates first, then damage, then the state change (the "0 %" update and the closing state share a ms)
    const rank = e => e.sc === 35 ? 0 : e.sc === 34 ? 2 : 1; es.sort((a, b) => a.t - b.t || rank(a) - rank(b) || a.i - b.i); let w = null, pctNow = null, lastBreak = null, lastClose = null, nOpen = 0;
    const close = (t, state) => { if (!w) return; w.end = t; w.endState = state; // broken = the bar was emptied. The last percent update can lag the closing state by one tick, so "≤ 6 %" counts as empty.
      const broken = w.startPct != null && w.minPct <= 0.06;
      const cast = (castsOf.get(addr) || []).filter(c => c.t <= w.start + 100).pop(); const castName = cast && w.start - cast.t < 15000 ? (skills.get(cast.skill) || String(cast.skill)) : '';
      rows.push({ log: f.replace('.zevtc', ''), unit, agent: addr.toString(16).slice(-4), open_s: ((w.start - s9.t) / 1000).toFixed(1), since_spawn_s: spawn.has(addr) ? ((w.start - spawn.get(addr)) / 1000).toFixed(1) : '',
        hp_pct_at_open: hpAt(addr, w.start) == null ? '' : hpAt(addr, w.start).toFixed(1), duration_s: ((t - w.start) / 1000).toFixed(2), start_pct: w.startPct == null ? '' : (100 * w.startPct).toFixed(1), min_pct: (100 * w.minPct).toFixed(1), broken: broken ? 1 : 0, time_to_break_s: broken ? (((w.breakT || t) - w.start) / 1000).toFixed(2) : '',
        player_damage: Math.round(w.pd / 10), soft_cc: Math.round(w.soft / 10), self_drain: Math.round(-w.regen / 10), total_damage: Math.round((w.pd + w.soft - w.regen) / 10), player_hits: w.hits, end_state: state, casting_at_open: castName, cast_started_s_before: cast && castName ? ((w.start - cast.t) / 1000).toFixed(1) : '' });
      if (broken) lastBreak = w.breakT || t; lastClose = t; w = null; };
    for (const e of es) {
      if (e.sc === 35) { pctNow = buf.readFloatLE(evStart + e.i * 64 + 24); if (w) { if (w.startPct == null) { w.startPct = pctNow; w.minPct = pctNow; } else if (pctNow < w.minPct) { w.minPct = pctNow; if (pctNow <= 0.06 && !w.breakT) w.breakT = e.t; } } }
      else if (e.sc === 34) { const state = e.value; if (state === 0) { if (w) close(e.t, 0); // start percent: the value known when the bar opens if it is a real one (> 50 %), otherwise the first update inside the window
          w = { start: e.t, startPct: pctNow != null && pctNow > 0.5 ? pctNow : null, minPct: pctNow != null && pctNow > 0.5 ? pctNow : 1, pd: 0, soft: 0, regen: 0, hits: 0, breakT: null }; nOpen++;
          if (nOpen === 1 && spawn.has(addr)) (firstOpen[unit] = firstOpen[unit] || []).push((e.t - spawn.get(addr)) / 1000); if (lastClose != null) (reopen[unit] = reopen[unit] || []).push((e.t - lastClose) / 1000);
          if (lastBreak != null) (recov[unit] = recov[unit] || []).push((e.t - lastBreak) / 1000); }
        else close(e.t, state); }
      else if (w) { const fromPlayer = (agents.get(e.src) || {}).isPlayer; if (fromPlayer) { w.pd += e.value; w.hits++; } else if (e.value >= 0) w.soft += e.value; else { w.regen += e.value; (regen[unit] = regen[unit] || []).push(e.value / 10); } } }
    if (w) close(ev[ev.length - 1].t, 'log end'); }
}
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'breakbars.csv'), [H.join(','), ...rows.map(r => H.map(k => String(r[k]).replace(/,/g, ';')).join(','))].join('\n'));
const summary = {};
for (const [unit] of UNITS) { const r = rows.filter(x => x.unit === unit && x.end_state !== 'log end'); if (!r.length) continue;
  const broken = r.filter(x => x.broken); const full = broken.filter(x => +x.start_pct >= 99 && x.total_damage > 0); const sizes = full.map(x => x.total_damage); // player hits + soft CC + the bar's own drain = the whole bar
  // size without the regeneration/soft-CC bookkeeping: player damage only (upper bound if the bar regenerated meanwhile)
  const sizesP = full.map(x => x.player_damage); const unb = r.filter(x => !x.broken);
  const casts = {}; r.forEach(x => { const k = x.casting_at_open || '(nothing)'; casts[k] = (casts[k] || 0) + 1; });
  const castTop = Object.entries(casts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ×${v}`);
  const castDelay = r.filter(x => x.casting_at_open && x.casting_at_open === Object.entries(casts).sort((a, b) => b[1] - a[1])[0][0]).map(x => +x.cast_started_s_before);
  summary[unit] = { windows: r.length, broken: broken.length, brokenPct: +(100 * broken.length / r.length).toFixed(1),
    size: sizes.length ? { median: Math.round(q(sizes, 0.5)), p10: Math.round(q(sizes, 0.1)), p90: Math.round(q(sizes, 0.9)), n: sizes.length } : null,
    playerDamageToBreak: sizesP.length ? { median: Math.round(q(sizesP, 0.5)), p10: Math.round(q(sizesP, 0.1)), p90: Math.round(q(sizesP, 0.9)) } : null,
    timeToBreakS: broken.length ? { median: +q(broken.map(x => +x.time_to_break_s), 0.5).toFixed(1), p90: +q(broken.map(x => +x.time_to_break_s), 0.9).toFixed(1) } : null,
    unbrokenWindowS: unb.length ? { median: +q(unb.map(x => +x.duration_s), 0.5).toFixed(1), p10: +q(unb.map(x => +x.duration_s), 0.1).toFixed(1), p90: +q(unb.map(x => +x.duration_s), 0.9).toFixed(1), n: unb.length } : null,
    firstOpenAfterSpawnS: firstOpen[unit] ? { median: +q(firstOpen[unit], 0.5).toFixed(1), p10: +q(firstOpen[unit], 0.1).toFixed(1), p90: +q(firstOpen[unit], 0.9).toFixed(1) } : null,
    reopenAfterCloseS: reopen[unit] ? { median: +q(reopen[unit], 0.5).toFixed(1), p10: +q(reopen[unit], 0.1).toFixed(1), p90: +q(reopen[unit], 0.9).toFixed(1), n: reopen[unit].length } : null,
    reopenAfterBreakS: recov[unit] ? { median: +q(recov[unit], 0.5).toFixed(1), p10: +q(recov[unit], 0.1).toFixed(1), p90: +q(recov[unit], 0.9).toFixed(1), n: recov[unit].length } : null,
    hpPctAtOpen: (() => { const v = r.map(x => +x.hp_pct_at_open).filter(Number.isFinite); return v.length ? { p10: +q(v, 0.1).toFixed(1), median: +q(v, 0.5).toFixed(1), p90: +q(v, 0.9).toFixed(1) } : null; })(),
    selfDrainPerS: regen[unit] ? Math.round(-q(regen[unit], 0.5) / 0.3) : null, playerShareOfBreakPct: full.length ? Math.round(100 * q(full.map(x => x.player_damage / x.total_damage), 0.5)) : null, castingAtOpen: castTop, castStartedBeforeOpenS: castDelay.length ? +q(castDelay, 0.5).toFixed(1) : null };
}
fs.writeFileSync(path.join(ROOT, 'data', 'breakbars_summary.json'), JSON.stringify(summary, null, 1));
for (const [u, s] of Object.entries(summary)) console.log(u.padEnd(20), JSON.stringify(s));
