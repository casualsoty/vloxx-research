// Which conditions does each enemy attack apply to players?
// Source: Elite Insights JSON from GW2 Wingman (URLs in data/logs_index.csv). EI gives, per player and per condition, the stack
// history PER SOURCE (statesPerSource), the time of every attack hit it tracks (mechanics, e.g. "Excision Extremis Hit") and every
// cast of Vloxx and the adds (rotation). A slim copy without player names is cached in private/ei_conditions/ (local only, gitignored).
// Method:
//   * an "application" = the stack count from one enemy source going up on one player;
//   * attack side: for each tracked hit, did a condition from an enemy source go up on that player within −100 … +300 ms?
//     For conditions that stack in duration (Crippled, Weakness, …) EI only shows present / absent, so a hit only counts when
//     that source's condition was absent just before;
//   * condition side: each application is attributed to the tracked hit at the same moment (±200 ms), else to the source's cast
//     in progress (or finished < 3 s before), else left unattributed. This catches attacks EI has no mechanic for.
// Blocked / evaded hits and Resistance are not visible here, so the percentages are lower bounds.
// Usage: node attack_conditions.js [--max N] [--no-fetch]     (default: 20 logs, our own raw logs first)
// Writes data/attack_conditions.csv and data/attack_conditions_summary.json. Without any cached or fetchable log it leaves them untouched.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), CACHE = path.join(ROOT, 'private', 'ei_conditions');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; }; const MAX = +(arg('--max') || 20);
const csv = f => { const [h, ...L] = fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n'); const H = h.split(','); return L.map(l => { const v = l.split(','); return Object.fromEntries(H.map((k, i) => [k, v[i]])); }); };
const q = (a, f) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : null; };
const pct = (n, d) => d ? Math.round(100 * n / d) : null;
const src = n => n.replace(/^(Champion|Elite) /, '').replace(/ \d+$/, '');
const SKIP = new Set(['Dead', 'Downed', 'Got up', 'Res', 'Knck.Dwn', 'Knck.Pll', 'Flt', 'Lnch', 'Lckt']); // generic CC mechanics: no attack behind them
const slim = j => { const names = j.players.map(p => p.name), idx = Object.fromEntries(names.map((n, i) => [n, i]));
  const cond = id => (j.buffMap['b' + id] || {}).classification === 'Condition';
  return { players: j.players.map(p => ({ cond: (p.buffUptimes || []).filter(b => cond(b.id) && b.statesPerSource).map(b => ({ name: j.buffMap['b' + b.id].name, stacking: !!j.buffMap['b' + b.id].stacking,
      bySource: Object.fromEntries(Object.entries(b.statesPerSource).filter(([s]) => !(s in idx))) })).filter(b => Object.keys(b.bySource).length) })),
    hits: j.mechanics.filter(m => !SKIP.has(m.name)).map(m => ({ name: m.name, full: m.fullName, data: m.mechanicsData.filter(d => d.actor in idx).map(d => [d.time, idx[d.actor]]) })).filter(m => m.data.length),
    targets: j.targets.map(t => ({ name: t.name, casts: (t.rotation || []).filter(r => r.id > 0).flatMap(r => r.skills.map(s => [s.castTime, s.duration, (j.skillMap['s' + r.id] || {}).name || String(r.id)])) })) }; };
async function eiFor(log, url) { const f = path.join(CACHE, log + '.json'); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (process.argv.includes('--no-fetch')) return null;
  try { const r = await fetch('https://gw2wingman.nevermindcreations.de/api/getFullJson/' + url.split('/').pop(), { signal: AbortSignal.timeout(300000) }); if (!r.ok) return null;
    const s = slim(await r.json()); fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, JSON.stringify(s)); return s; } catch (e) { console.log('  could not fetch', log, e.message); return null; } }
(async () => {
  const idx = csv('logs_index.csv').filter(l => /gw2wingman/.test(l.url) && l.difficulty === 'CM').sort((a, b) => (a.source === 'raw' ? 0 : 1) - (b.source === 'raw' ? 0 : 1));
  const logs = []; for (const l of idx) { if (logs.length >= MAX) break; const j = await eiFor(l.log_id, l.url); if (j) logs.push(j); }
  if (!logs.length) { console.log('no EI JSON available (cache empty and Wingman not reachable): data/attack_conditions.* left as they are'); return; }
  const A = {}, C = {}; // A[attack] = { hits, cond: { 'source|condition': { n, eligible, stacks[], dur[] } } };  C['source|condition'] = { total, by: { label: n } }
  for (const j of logs) {
    const hitsByP = {}; for (const m of j.hits) for (const [t, p] of m.data) (hitsByP[p] = hitsByP[p] || []).push({ t, m: m.full.replace(/ Hit$/, '') }); for (const v of Object.values(hitsByP)) v.sort((a, b) => a.t - b.t);
    const casts = {}; for (const t of j.targets) for (const c of t.casts) (casts[src(t.name)] = casts[src(t.name)] || []).push(c);
    j.players.forEach((p, pi) => { const H = hitsByP[pi] || [];
      // applications per source|condition
      const apps = {}; for (const b of p.cond) for (const [s, st] of Object.entries(b.bySource)) { if (s === 'UNKNOWN') continue; const k = src(s) + '|' + b.name; const a = apps[k] = apps[k] || { st: [], list: [] };
        for (let i = 1; i < st.length; i++) if (st[i][1] > st[i - 1][1]) { let end = null; for (let n = i + 1; n < st.length; n++) { if (st[n][1] > st[n - 1][1]) break; if (st[n][1] === 0) { end = st[n][0]; break; } }
          a.list.push({ t: st[i][0], add: st[i][1] - st[i - 1][1], from: st[i - 1][1], dur: st[i - 1][1] === 0 && end != null ? (end - st[i][0]) / 1000 : null }); }
        a.st.push(st); }
      const present = (k, t) => (apps[k].st || []).some(st => { let v = 0; for (const [tt, s] of st) { if (tt >= t) break; v = s; } return v > 0; });
      // attack side
      for (const h of H) { const a = A[h.m] = A[h.m] || { hits: 0, cond: {} }; a.hits++;
        for (const [k, ap] of Object.entries(apps)) { const c = a.cond[k] = a.cond[k] || { n: 0, eligible: 0, stacks: [], dur: [] }; const was = present(k, h.t - 100); if (!was) c.eligible++;
          const m = ap.list.filter(x => x.t >= h.t - 100 && x.t <= h.t + 300); if (m.length) { c.n++; if (!was) c.clean = (c.clean || 0) + 1; c.stacks.push(m.reduce((s, x) => s + x.add, 0)); for (const x of m) if (x.dur != null) c.dur.push(x.dur); } } }
      // condition side
      for (const [k, ap] of Object.entries(apps)) { const s = k.split('|')[0], c = C[k] = C[k] || { total: 0, by: {}, dur: [] };
        for (const x of ap.list) { c.total++; if (x.dur != null) c.dur.push(x.dur); const near = H.filter(h => Math.abs(h.t - x.t) <= 200).map(h => h.m);
          let lab; if (near.length) lab = [...new Set(near)].sort().join(' + '); else { const cs = (casts[s] || []).filter(([t, d]) => t <= x.t && x.t <= t + d + 3000).sort((a, b) => b[0] - a[0])[0]; lab = cs ? `during ${cs[2]} (no tracked hit)` : 'unattributed'; }
          c.by[lab] = (c.by[lab] || 0) + 1; } } });
  }
  const rows = []; for (const [attack, a] of Object.entries(A)) for (const [k, c] of Object.entries(a.cond)) { const [source, condition] = k.split('|'); if (c.n < 5 || c.n / a.hits < 0.03) continue;
    rows.push({ attack, hits: a.hits, source, condition, hits_applying: c.n, pct_of_hits: pct(c.n, a.hits), pct_when_absent_before: pct(c.clean || 0, c.eligible), stacks_median: q(c.stacks, 0.5), duration_s_median: q(c.dur, 0.5) == null ? '' : +q(c.dur, 0.5).toFixed(1), duration_s_p90: q(c.dur, 0.9) == null ? '' : +q(c.dur, 0.9).toFixed(1) }); }
  rows.sort((a, b) => a.attack.localeCompare(b.attack) || b.hits_applying - a.hits_applying);
  const bySource = {}; for (const [k, c] of Object.entries(C)) { const [s, cn] = k.split('|'); if (c.total < 5) continue; (bySource[s] = bySource[s] || {})[cn] = { applications: c.total, duration_s_median: q(c.dur, 0.5) == null ? null : +q(c.dur, 0.5).toFixed(1), duration_s_p90: q(c.dur, 0.9) == null ? null : +q(c.dur, 0.9).toFixed(1),
    from: Object.fromEntries(Object.entries(c.by).sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= Math.max(3, c.total * 0.03)).map(([l, n]) => [l, `${n} (${pct(n, c.total)} %)`])) }; }
  const summary = { logs: logs.length, trackedAttacks: Object.fromEntries(Object.entries(A).sort((a, b) => a[0].localeCompare(b[0])).map(([k, a]) => [k, { hits: a.hits, conditions: rows.filter(r => r.attack === k).map(r => `${r.condition} (${r.source}) ${r.pct_of_hits} %`) }])), bySourceAndCondition: bySource };
  const K = Object.keys(rows[0]); fs.writeFileSync(path.join(DATA, 'attack_conditions.csv'), [K.join(','), ...rows.map(r => K.map(k => r[k]).join(','))].join('\n'));
  fs.writeFileSync(path.join(DATA, 'attack_conditions_summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
})();
