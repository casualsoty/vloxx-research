// Can the 3-people greens (Judgment of Eternity) be stacked on top of each other? For every green round, at the moment the circles
// resolve: where each green holder stands, which players are inside which circle(s), and who is punished (loses Ascension, is floated).
// A circle "passes" when nobody inside it is punished. If one group of players can satisfy several overlapping circles at once, rounds
// exist where every circle passes although fewer than 3 x circles players stand in them.
// Source: Elite Insights JSON from GW2 Wingman (URLs in data/logs_index.csv, logs that reached the last phase); a slim copy without
// player names is cached in private/ei_greens/ (local only, gitignored). EI positions are every 300 ms (interpolated here).
// Usage: node green_overlap.js [--max N] [--no-fetch]
// Writes data/green_overlap_rounds.csv (one row per round), data/green_overlap_players.csv (player x round) and data/green_overlap_summary.json.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), CACHE = path.join(ROOT, 'private', 'ei_greens');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; }; const MAX = +(arg('--max') || 200);
const R = 240, NEED = 3, RESOLVE = 8160;   // circle radius (FINDINGS 5d), players a circle asks for, ms from marker to resolution (measured below)
const csv = f => { const [h, ...L] = fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n'); const H = h.split(','); return L.map(l => { const v = l.split(','); return Object.fromEntries(H.map((k, i) => [k, v[i]])); }); };
const slim = j => { const idx = Object.fromEntries(j.players.map((p, i) => [p.name, i])); const st = (p, id) => ((p.buffUptimes || []).find(b => b.id === id) || {}).states || [];
  const cr = a => { const c = a.combatReplayData || {}; return { start: c.start, positions: c.positions, dead: c.dead, down: c.down, dc: c.dc }; };
  // failed-green hits taken, per EI phase: [phase index, skill, hits, landed, blocked, evaded, invulnerable, missed, damage]
  const V = j.targets[0], jd = p => (p.totalDamageTaken || []).flatMap((ph, pi) => (ph || []).filter(d => d.id === 80629 || d.id === 80378).map(d => [pi, d.id, d.hits, d.connectedHits, d.blocked, d.evaded, d.invulned, d.missed, d.totalDamage]));
  return { pr: j.combatReplayMetaData.pollingRate, s: j.combatReplayMetaData.inchToPixel, dur: j.durationMS, success: !!j.success, phases: j.phases.map(p => [p.name, p.start, p.end]),
    players: j.players.map((p, i) => ({ i, prof: p.profession, cr: cr(p), asc: st(p, 80368), stab: st(p, 1122), aegis: st(p, 743), fix: st(p, 34508), hp: p.healthPercents, jd: jd(p) })),
    vloxx: { cr: cr(V), emp: ((V.buffs || []).find(b => b.id === 81002) || {}).states || [], casts: (V.rotation || []).filter(r => r.id > 0).flatMap(r => r.skills.map(s => [s.castTime, s.duration, r.id])).sort((a, b) => a[0] - b[0]) },
    mech: Object.fromEntries(j.mechanics.filter(m => ['3Green.Slct', 'Pddl.Drp', 'Flt', 'Lnch', 'Ascen.R', 'Downed', 'Dead'].includes(m.name)).map(m => [m.name, m.mechanicsData.filter(d => d.actor in idx).map(d => [d.time, idx[d.actor]])])) }; };
async function fetchOne(log, url) { const f = path.join(CACHE, log + '.json'); if (fs.existsSync(f)) return true; if (process.argv.includes('--no-fetch')) return false;
  for (let k = 0; k < 2; k++) try { const r = await fetch('https://gw2wingman.nevermindcreations.de/api/getFullJson/' + url.split('/').pop(), { signal: AbortSignal.timeout(300000) }); if (!r.ok) continue;
    const s = slim(await r.json()); fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, JSON.stringify(s)); return true; } catch (e) { console.log('  could not fetch', log, e.message); }
  return false; }
(async () => {
  const idx = csv('logs_index.csv').filter(l => /gw2wingman/.test(l.url) && l.difficulty === 'CM' && l.reached_last_phase === 'true').slice(0, MAX);
  const q = idx.slice(); await Promise.all([0, 1, 2, 3, 4, 5].map(async () => { while (q.length) { const l = q.shift(); await fetchOne(l.log_id, l.url); } }));
  const logs = idx.filter(l => fs.existsSync(path.join(CACHE, l.log_id + '.json'))).map(l => ({ id: l.log_id, j: JSON.parse(fs.readFileSync(path.join(CACHE, l.log_id + '.json'), 'utf8')) }));
  if (!logs.length) { console.log('no EI JSON available (cache empty and Wingman not reachable): data/green_overlap_* left as they are'); return; }
  const rounds = [], prow = [];
  for (const { id, j } of logs) {
    const pos = (a, t) => { const p = a.cr.positions || [], i = (t - a.cr.start) / j.pr; if (i < 0 || !p.length) return null; const k = Math.min(Math.floor(i), p.length - 1), k2 = Math.min(k + 1, p.length - 1), w = Math.min(1, i - k); return [(p[k][0] * (1 - w) + p[k2][0] * w) / j.s, (p[k][1] * (1 - w) + p[k2][1] * w) / j.s]; };
    const inIv = (a, t) => (a || []).some(([s, e]) => s <= t && t <= e), dead = (p, t) => inIv(p.cr.dead, t) || inIv(p.cr.dc, t), down = (p, t) => inIv(p.cr.down, t);
    const state = (st, t) => { let v = 0; for (const [tt, s] of st || []) { if (tt > t) break; v = s; } return v; };
    const M = n => j.mech[n] || [], lp = (j.vloxx.casts.find(c => c[2] === 81071) || [])[0];
    const rs = []; for (const [t, p] of M('3Green.Slct')) { const r = rs[rs.length - 1]; if (r && t - r.t < 1500) r.h.push(p); else rs.push({ t, h: [p] }); }
    for (const r of rs) {
      if (r.t + RESOLVE + 600 > j.dur) continue;   // the log ended before the circles resolved
      // the resolution moment: the Ascension-loss / float events 7.5-9 s after the markers, else the measured delay
      const ev = n => M(n).filter(([t]) => t >= r.t + 7500 && t <= r.t + 9000), lost = ev('Ascen.R'), flt = ev('Flt');
      const tr = lost.length ? Math.min(...lost.map(x => x[0])) : flt.length ? Math.min(...flt.map(x => x[0])) : r.t + RESOLVE;
      const H = r.h.map(h => ({ h, xy: pos(j.players[h], tr), gone: dead(j.players[h], tr) })), P = [];
      for (const p of j.players) { const xy = pos(p, tr); if (!xy || dead(p, tr - 100)) continue;
        const d = H.map(c => c.xy ? Math.hypot(xy[0] - c.xy[0], xy[1] - c.xy[1]) : 1e9), inC = d.map(x => x <= R);
        const ascLost = lost.filter(x => x[1] === p.i).length, a0 = state(p.asc, tr - 300), a1 = state(p.asc, tr + 600);
        P.push({ p, xy, d, inC, n: inC.filter(Boolean).length, down: down(p, tr - 100), ascLost, a0, a1, floated: flt.some(x => x[1] === p.i), stab: state(p.stab, tr - 50) > 0, pun: ascLost > 0 || a1 < a0 || flt.some(x => x[1] === p.i) }); }
      const C = H.map((c, ci) => { const ins = P.filter(x => x.inC[ci]); return { ...c, n: ins.length, nUp: ins.filter(x => !x.down).length, pun: ins.filter(x => x.pun).length, only: ins.filter(x => x.n === 1).length }; });
      const union = P.filter(x => x.n > 0), sep = []; for (let a = 0; a < H.length; a++) for (let b = a + 1; b < H.length; b++) if (H[a].xy && H[b].xy) sep.push(Math.hypot(H[a].xy[0] - H[b].xy[0], H[a].xy[1] - H[b].xy[1]));
      // groups of circles that share at least one player
      const grp = H.map((_, i) => i); const find = i => grp[i] === i ? i : (grp[i] = find(grp[i])); for (const x of P) { if (x.down) continue; const cs = x.inC.map((v, i) => v ? i : -1).filter(i => i >= 0); for (const c of cs.slice(1)) grp[find(c)] = find(cs[0]); }
      const groups = [...new Set(H.map((_, i) => find(i)))].map(g => { const cs = H.map((_, i) => i).filter(i => find(i) === g), ins = P.filter(x => !x.down && x.inC.some((v, i) => v && cs.includes(i))); return { circles: cs.length, players: ins.length, punished: ins.filter(x => x.pun).length }; });
      // a split (Visions of Eternity) or the last phase starting before the circles resolve cancels the round
      const split = j.vloxx.casts.some(c => [80420, 80591, 81017, 81071].includes(c[2]) && c[0] > r.t && c[0] < r.t + RESOLVE + 200);
      const phase = lp != null && r.t >= lp ? 'last' : 'early';
      // Empowered (81002) on Vloxx: stacks gained in the instant the circles resolve (a failed green gives 1 per Ascension stack removed)
      const emp = j.vloxx.emp.filter(([t]) => t >= tr - 250 && t <= tr + 400), e0 = state(j.vloxx.emp, tr - 251); let empGain = 0, pe = e0; for (const [, v] of emp) { if (v > pe) empGain += v - pe; pe = v; }
      const row = { log: id, phase, tick_s: phase === 'last' ? Math.round((r.t - lp) / 1000) : '', select_s: (r.t / 1000).toFixed(1), resolve_delay_ms: lost.length || flt.length ? tr - r.t : '', split_before_resolve: +split, greens: H.length, players_alive: P.length,
        players_per_circle: C.map(c => c.n).join('/'), up_players_per_circle: C.map(c => c.nUp).join('/'), players_in_any_circle: union.length, players_in_2plus_circles: P.filter(x => x.n >= 2).length, players_in_all_circles: H.length > 1 ? P.filter(x => x.n === H.length).length : '', shared_players_punished: P.filter(x => x.n >= 2 && x.pun).length,
        holder_separation: sep.map(x => Math.round(x)).join('/'), circle_groups: groups.map(g => g.circles + 'c:' + g.players + 'p').join(' '), punished_players: P.filter(x => x.pun).length, punished_per_circle: C.map(c => c.pun).join('/'),
        punished_outside_all_circles: P.filter(x => x.pun && x.n === 0).length, empowered_gained: empGain, asc_stacks_lost: P.reduce((s, x) => s + Math.max(x.ascLost, x.a0 - x.a1, 0), 0), floated: P.filter(x => x.floated).length,
        // stacked = a group of 2+ circles that share players (up players only) and holds fewer than 3 players per circle
        stacked_short_group: +groups.some(g => g.circles >= 2 && g.players < NEED * g.circles), stacked_short_group_punished: +groups.some(g => g.circles >= 2 && g.players < NEED * g.circles && g.punished > 0) };
      rounds.push(row); row._g = groups; row._C = C;
      for (const x of P) prow.push({ log: id, phase, tick_s: row.tick_s, select_s: row.select_s, player: x.p.i, prof: x.p.prof, is_holder: +r.h.includes(x.p.i), downed: +x.down, circles_inside: x.n, dist_to_holders: x.d.map(v => v > 1e8 ? '' : Math.round(v)).join('/'),
        ascension_before: x.a0, ascension_after: x.a1, ascension_lost_events: x.ascLost, floated: +x.floated, had_stability: +x.stab, punished: +x.pun });
    }
  }
  const out = (f, rows) => { const H = Object.keys(rows[0]).filter(k => k[0] !== '_'); fs.writeFileSync(path.join(DATA, f), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n') + '\n'); };
  out('green_overlap_rounds.csv', rounds); out('green_overlap_players.csv', prow);
  const pct = (n, d) => d ? Math.round(1000 * n / d) / 10 : null, S = {};
  for (const ph of ['early', 'last']) { const Rn = rounds.filter(r => r.phase === ph && !r.split_before_resolve), Pn = prow.filter(r => r.phase === ph && Rn.some(x => x.log === r.log && x.select_s === r.select_s)), multi = Rn.filter(r => r.greens >= 2);
    const byN = n => { const a = Pn.filter(r => (n === 2 ? r.circles_inside >= 2 : r.circles_inside === n)); return { players: a.length, punished: a.filter(r => r.punished).length, pct: pct(a.filter(r => r.punished).length, a.length), ascension_lost_3: a.filter(r => r.ascension_before - r.ascension_after === 3).length, ascension_lost_6plus: a.filter(r => r.ascension_before - r.ascension_after >= 6).length }; };
    const G = Rn.flatMap(r => r._g.map(g => ({ ...g, r }))).filter(g => g.circles >= 2), C = Rn.flatMap(r => r._C).filter(c => !c.gone);
    const cb = f => { const a = C.filter(f); return { circles: a.length, with_punished_player: a.filter(c => c.pun).length }; };
    const hit = id => logs.flatMap(l => l.j.players.flatMap(p => p.jd.filter(d => d[0] === 0 && d[1] === id))).reduce((t, d) => ({ hits: t.hits + d[2], landed: t.landed + d[3], blocked: t.blocked + d[4], evaded: t.evaded + d[5], invulnerable: t.invulnerable + d[6] }), { hits: 0, landed: 0, blocked: 0, evaded: 0, invulnerable: 0 });
    const pun = Pn.filter(r => r.punished), fl = f => { const a = pun.filter(f); return { punished: a.length, floated: a.filter(r => r.floated).length }; };
    S[ph] = { rounds: Rn.length, rounds_dropped_split_before_resolve: rounds.filter(r => r.phase === ph && r.split_before_resolve).length, rounds_2plus_greens: multi.length,
      rounds_with_a_player_in_2plus_circles: multi.filter(r => r.players_in_2plus_circles > 0).length, rounds_all_holders_within_radius: multi.filter(r => r.holder_separation.split('/').every(x => +x <= R)).length,
      resolve_delay_ms: (() => { const d = Rn.map(r => +r.resolve_delay_ms).filter(Boolean).sort((a, b) => a - b); return d.length ? { n: d.length, min: d[0], median: d[d.length >> 1], max: d[d.length - 1] } : null; })(),
      failed_green_hits: hit(ph === 'early' ? 80629 : 80378),
      player_punished_by_circles_inside: { 0: byN(0), 1: byN(1), '2+': byN(2) },
      circle_by_up_players_inside: { under_3: cb(c => c.nUp < 3), exactly_3: cb(c => c.nUp === 3), '4_or_more': cb(c => c.nUp >= 4) },
      empowered_gained_at_resolve: (() => { const f = a => ({ rounds: a.length, with_gain: a.filter(r => r.empowered_gained > 0).length, stacks: a.reduce((t, r) => t + r.empowered_gained, 0), ascension_lost: a.reduce((t, r) => t + r.asc_stacks_lost, 0) });
        return { nobody_punished_no_shared_player: f(Rn.filter(r => !r.punished_players && !r.players_in_2plus_circles)), nobody_punished_shared_players: f(Rn.filter(r => !r.punished_players && r.players_in_2plus_circles > 0)), somebody_punished: f(Rn.filter(r => r.punished_players > 0)) }; })(),
      float_on_punished: { up_with_stability: fl(r => !r.downed && r.had_stability), up_without_stability: fl(r => !r.downed && !r.had_stability), downed: fl(r => r.downed) },
      overlapping_groups: { all: { groups: G.length, punished: G.filter(g => g.punished).length }, under_3_players_per_circle: { groups: G.filter(g => g.players < NEED * g.circles).length, punished: G.filter(g => g.players < NEED * g.circles && g.punished).length } },
      overlapping_groups_list: G.map(g => ({ log: g.r.log, tick_s: g.r.tick_s, select_s: g.r.select_s, circles: g.circles, up_players: g.players, punished: g.punished, empowered_gained: g.r.empowered_gained, up_players_per_circle: g.r.up_players_per_circle, holder_separation: g.r.holder_separation })) }; }
  S.logs = logs.length; S.radius = R; fs.writeFileSync(path.join(DATA, 'green_overlap_summary.json'), JSON.stringify(S, null, 1) + '\n');
  console.log(`green overlap: ${logs.length} logs, circle radius ${R}`);
  for (const ph of ['early', 'last']) { const s = S[ph]; console.log(`[${ph}] ${s.rounds} rounds (${s.rounds_dropped_split_before_resolve} dropped: split before they resolve), ${s.rounds_2plus_greens} with 2+ greens, ${s.rounds_with_a_player_in_2plus_circles} with a player inside 2+ circles, ${s.rounds_all_holders_within_radius} with every holder within ${R} of the others`);
    console.log('  failed-green hits', JSON.stringify(s.failed_green_hits), '| resolve delay', JSON.stringify(s.resolve_delay_ms)); console.log('  punished by number of circles the player stands in:', JSON.stringify(s.player_punished_by_circles_inside));
    console.log('  circles by up players inside:', JSON.stringify(s.circle_by_up_players_inside)); console.log('  Empowered gained at resolve:', JSON.stringify(s.empowered_gained_at_resolve)); console.log('  float on punished players:', JSON.stringify(s.float_on_punished)); console.log('  overlapping groups:', JSON.stringify(s.overlapping_groups)); }
})();
