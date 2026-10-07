// Who does Fixated pick? For every Fixated application, rank the picked player among all players that were up at that moment on a
// list of features (distance to Vloxx, toughness and other stats, damage done, health, squad order, Fixated history, …) and compare
// with a random pick. A feature that drives the selection shows up as "picked player is rank 1 far more often than 1 in n".
// Source: Elite Insights JSON from GW2 Wingman (URLs in data/logs_index.csv); a slim copy without player names is cached in
// private/ei_fixated/ (local only, gitignored). EI positions are every 300 ms, so distance ranks between stacked players are noisy.
// Usage: node fixated_selection.js [--max N] [--no-fetch]      (default 40 logs, our own raw logs first)
// Writes data/fixated_selection.csv (one row per application) and data/fixated_selection_summary.json.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), CACHE = path.join(ROOT, 'private', 'ei_fixated');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; }; const MAX = +(arg('--max') || 40);
const csv = f => { const [h, ...L] = fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n'); const H = h.split(','); return L.map(l => { const v = l.split(','); return Object.fromEntries(H.map((k, i) => [k, v[i]])); }); };
const pct = (n, d) => d ? Math.round(100 * n / d) : null;
const slim = j => { const idx = Object.fromEntries(j.players.map((p, i) => [p.name, i])); const st = (p, id) => ((p.buffUptimes || []).find(b => b.id === id) || {}).states || [];
  const cr = a => { const c = a.combatReplayData || {}; return { start: c.start, positions: c.positions, orientations: c.orientations, dead: c.dead, down: c.down, dc: c.dc }; };
  const V = j.targets[0];
  return { pr: j.combatReplayMetaData.pollingRate, s: j.combatReplayMetaData.inchToPixel, dur: j.durationMS, phases: j.phases.map(p => [p.name, p.start, p.end]),
    players: j.players.map((p, i) => ({ i, prof: p.profession, group: p.group, inst: p.instanceID, tag: !!p.hasCommanderTag, tough: p.toughness, heal: p.healing, conc: p.concentration, condi: p.condition,
      cr: cr(p), fix: st(p, 34508), stealth: st(p, 13017), hp: p.healthPercents, dmg: ((p.targetDamage1S || [])[0] || [])[0] || [], taken: (p.damageTaken1S || [])[0] || [] })),
    vloxx: { cr: cr(V), hp: V.healthPercents, casts: (V.rotation || []).filter(r => r.id > 0).flatMap(r => r.skills.map(s => [s.castTime, s.duration, r.id])).sort((a, b) => a[0] - b[0]) },
    mech: Object.fromEntries(j.mechanics.filter(m => ['3Green.Slct', '2Green.Slct', 'Pddl.Drp'].includes(m.name)).map(m => [m.name, m.mechanicsData.filter(d => d.actor in idx).map(d => [d.time, idx[d.actor]])])) }; };
async function eiFor(log, url) { const f = path.join(CACHE, log + '.json'); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (process.argv.includes('--no-fetch')) return null;
  try { const r = await fetch('https://gw2wingman.nevermindcreations.de/api/getFullJson/' + url.split('/').pop(), { signal: AbortSignal.timeout(300000) }); if (!r.ok) return null;
    const s = slim(await r.json()); fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, JSON.stringify(s)); return s; } catch (e) { console.log('  could not fetch', log, e.message); return null; } }
(async () => {
  const idx = csv('logs_index.csv').filter(l => /gw2wingman/.test(l.url) && l.difficulty === 'CM').sort((a, b) => (a.source === 'raw' ? 0 : 1) - (b.source === 'raw' ? 0 : 1));
  const logs = []; for (const l of idx) { if (logs.length >= MAX) break; const j = await eiFor(l.log_id, l.url); if (j) logs.push({ id: l.log_id, j }); }
  if (!logs.length) { console.log('no EI JSON available (cache empty and Wingman not reachable): data/fixated_selection.* left as they are'); return; }
  const rows = [];
  for (const { id, j } of logs) {
    const pos = (a, t) => { const p = a.cr.positions || [], i = (t - a.cr.start) / j.pr; if (i < 0 || !p.length) return null; const k = Math.min(Math.floor(i), p.length - 1), k2 = Math.min(k + 1, p.length - 1), w = Math.min(1, i - k); return [(p[k][0] * (1 - w) + p[k2][0] * w) / j.s, (p[k][1] * (1 - w) + p[k2][1] * w) / j.s]; };
    const inIv = (a, t) => (a || []).some(([s, e]) => s <= t && t <= e); const up = (p, t) => !inIv(p.cr.dead, t) && !inIv(p.cr.down, t) && !inIv(p.cr.dc, t);
    const state = (st, t) => { let v = 0; for (const [tt, s] of st || []) { if (tt > t) break; v = s; } return v; };
    const cum = (a, t) => { const i = Math.max(0, Math.min(a.length - 1, Math.floor(t / 1000))); return a[i] || 0; };
    const apps = []; for (const p of j.players) for (let i = 1; i < p.fix.length; i++) if (p.fix[i][1] > 0 && p.fix[i - 1][1] === 0) { let end = j.dur; for (let n = i + 1; n < p.fix.length; n++) if (p.fix[n][1] === 0) { end = p.fix[n][0]; break; } apps.push({ t: p.fix[i][0], p: p.i, end }); }
    apps.sort((a, b) => a.t - b.t); const lp = (j.vloxx.casts.find(c => c[2] === 81071) || [])[0];
    apps.forEach((a, ai) => { const t = a.t - 150, v = pos(j.vloxx, t); const C = j.players.filter(p => up(p, t) && pos(p, t)); if (!v || C.length < 4 || !C.some(p => p.i === a.p)) return;
      const prev = apps[ai - 1], before = apps.slice(0, ai); const lastHeld = p => { const b = before.filter(x => x.p === p.i).pop(); return b ? a.t - b.end : 1e9; };
      const lastMech = (name, win) => new Set((j.mech[name] || []).filter(([mt]) => mt <= a.t + 50 && mt > a.t - win).map(x => x[1]));
      const g3 = lastMech('3Green.Slct', 40000), pd = lastMech('Pddl.Drp', 40000); const pv = prev ? pos(j.players[prev.p], t) : null; const cast = j.vloxx.casts.filter(c => c[0] <= a.t).pop();
      const phase = (j.phases.filter(p => /Phase|Split/.test(p[0]) && p[1] <= a.t && a.t <= p[2]).pop() || ['?'])[0];
      const ctx = ai === 0 ? 'fight start' : lp != null && a.t >= lp ? 'last phase' : j.phases.some(p => / Phase$/.test(p[0]) && p[1] > 0 && Math.abs(a.t - p[1]) < 2500) ? 'phase entry (bar break)' : 'boss phase';
      // every feature: higher value = "more" of it; ranks are computed both ways below
      const F = { dist_to_vloxx: p => Math.hypot(pos(p, t)[0] - v[0], pos(p, t)[1] - v[1]), toughness: p => p.tough, healing_power: p => p.heal, concentration: p => p.conc, condition_dmg: p => p.condi,
        dmg_to_vloxx_total: p => cum(p.dmg, t), dmg_to_vloxx_last10s: p => cum(p.dmg, t) - cum(p.dmg, t - 10000), dmg_taken_last10s: p => cum(p.taken, t) - cum(p.taken, t - 10000), health_pct: p => state(p.hp, t),
        subgroup: p => p.group, instance_id: p => p.inst, squad_list_order: p => p.i, times_fixated_before: p => before.filter(x => x.p === p.i).length, time_since_own_last_fixated: p => lastHeld(p),
        dist_to_previous_holder: p => pv ? Math.hypot(pos(p, t)[0] - pv[0], pos(p, t)[1] - pv[1]) : 0 };
      const r = { log: id, t_s: (a.t / 1000).toFixed(1), context: ctx, phase, players_up: C.length, picked_prof: j.players[a.p].prof, gap_since_previous_end_s: prev ? ((a.t - prev.end) / 1000).toFixed(1) : '', vloxx_cast_at_apply: cast ? cast[2] : '',
        picked_is_previous_holder: prev ? +(prev.p === a.p) : '', previous_holder_up: prev ? +C.some(p => p.i === prev.p) : '', picked_never_fixated_before: +!before.some(x => x.p === a.p), never_fixated_available: C.filter(p => !before.some(x => x.p === p.i)).length,
        picked_in_stealth: +(state(j.players[a.p].stealth, t) > 0), in_stealth_up: C.filter(p => state(p.stealth, t) > 0).length, picked_had_green_last40s: +g3.has(a.p), green_last40s_up: C.filter(p => g3.has(p.i)).length, picked_had_spread_last40s: +pd.has(a.p), spread_last40s_up: C.filter(p => pd.has(p.i)).length,
        picked_has_tag: +j.players[a.p].tag };
      for (const [k, f] of Object.entries(F)) { const vals = C.map(p => f(p)), mine = f(j.players[a.p]); const lower = vals.filter(x => x < mine).length, eq = vals.filter(x => x === mine).length;
        r[k] = Math.round(mine * 10) / 10; r[k + '_rank'] = lower + (eq + 1) / 2; r[k + '_ties'] = eq; }
      rows.push(r); });
  }
  const FEATS = Object.keys(rows[0]).filter(k => k.endsWith('_rank')).map(k => k.slice(0, -5));
  const test = R => Object.fromEntries(FEATS.map(f => { const U = R.filter(r => r[f + '_ties'] < r.players_up); if (!U.length) return [f, null]; // skip rows where every candidate has the same value
    const pc = U.map(r => (r[f + '_rank'] - 1) / (r.players_up - 1)), m = pc.reduce((a, b) => a + b, 0) / U.length, z = (m - 0.5) / Math.sqrt(1 / 12 / U.length);
    const lo = U.filter(r => r[f + '_rank'] === 1).length, hi = U.filter(r => r[f + '_rank'] === r.players_up).length, exp = U.reduce((s, r) => s + 1 / r.players_up, 0);
    return [f, { n: U.length, meanPercentile: +m.toFixed(3), z: +z.toFixed(1), pickedIsLowest: lo, pickedIsHighest: hi, expectedEach: +exp.toFixed(1) }]; }));
  const flags = R => { const P = R.filter(r => r.picked_is_previous_holder !== '' && r.previous_holder_up === 1), N = R.filter(r => r.never_fixated_available > 0 && r.never_fixated_available < r.players_up);
    const share = (k, avail) => { const U = R.filter(r => r[avail] > 0); return { rounds: U.length, picked: U.filter(r => r[k] === 1).length, expected: +U.reduce((s, r) => s + r[avail] / r.players_up, 0).toFixed(1) }; };
    return { previousHolderPickedAgain: { n: P.filter(r => r.picked_is_previous_holder === 1).length, of: P.length, expected: +P.reduce((s, r) => s + 1 / r.players_up, 0).toFixed(1) },
      neverFixatedBeforePicked: { n: N.filter(r => r.picked_never_fixated_before === 1).length, of: N.length, expected: +N.reduce((s, r) => s + r.never_fixated_available / r.players_up, 0).toFixed(1) },
      inStealth: share('picked_in_stealth', 'in_stealth_up'), hadGreenInLast40s: share('picked_had_green_last40s', 'green_last40s_up'), hadSpreadInLast40s: share('picked_had_spread_last40s', 'spread_last40s_up'),
      commanderTag: { picked: R.filter(r => r.picked_has_tag === 1).length, of: R.length, expected: +R.reduce((s, r) => s + 1 / r.players_up, 0).toFixed(1) } }; };
  const prof = R => { const o = {}; for (const r of R) o[r.picked_prof] = (o[r.picked_prof] || 0) + 1; return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); };
  const ctxs = ['fight start', 'boss phase', 'phase entry (bar break)', 'last phase'];
  const summary = { logs: logs.length, applications: rows.length, note: 'meanPercentile 0.5 and |z| < 3 = no effect; pickedIsLowest/Highest vs expectedEach = how often the picked player is the extreme one',
    all: { features: test(rows), flags: flags(rows) }, byContext: Object.fromEntries(ctxs.map(c => { const R = rows.filter(r => r.context === c); return [c, R.length ? { applications: R.length, features: test(R), flags: flags(R) } : null]; })), pickedProfession: prof(rows) };
  const K = Object.keys(rows[0]); fs.writeFileSync(path.join(DATA, 'fixated_selection.csv'), [K.join(','), ...rows.map(r => K.map(k => r[k]).join(','))].join('\n'));
  fs.writeFileSync(path.join(DATA, 'fixated_selection_summary.json'), JSON.stringify(summary, null, 1));
  const show = (name, o) => { console.log(`\n${name}`); for (const [f, v] of Object.entries(o.features)) if (v) console.log(`  ${f.padEnd(28)} n=${String(v.n).padStart(4)} mean pct ${v.meanPercentile.toFixed(2)} z=${String(v.z).padStart(5)}  lowest ${String(v.pickedIsLowest).padStart(3)} highest ${String(v.pickedIsHighest).padStart(3)} (expected ${v.expectedEach})`); console.log('  ' + JSON.stringify(o.flags)); };
  console.log(`${logs.length} logs, ${rows.length} Fixated applications`); show('ALL', summary.all); for (const c of ctxs) if (summary.byContext[c]) show(`${c} (${summary.byContext[c].applications})`, summary.byContext[c]); console.log(JSON.stringify(summary.pickedProfession));
})();
