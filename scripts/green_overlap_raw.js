// Last-phase greens (Judgment of Eternity, failed-green skill 80378) from the raw logs: can one player fill two overlapping circles?
// Same question as green_overlap.js, but on logs/raw: exact positions, the failed-green hits themselves and the Ascension / Empowered events.
// Every circle resolves on its own, 8.0 s after its own marker (markers are 80 ms apart, so are the resolutions). A circle that fails leaves
// ground effect 29242 at its centre at that instant and hits everybody inside (skill 80378); a circle that passes leaves no event at all.
// For every circle: the players within the radius of the holder at that instant, which of them also stand in another circle of the round,
// and which of them stood in a circle that resolved earlier in the round ("already counted").
// Usage: node green_overlap_raw.js [--detail]
// Writes data/green_overlap_raw_circles.csv (one row per circle) and data/green_overlap_raw_summary.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'logs', 'raw'), DATA = path.join(ROOT, 'data');
const NEED = 3, DELAY = 8000, DETAIL = process.argv.includes('--detail');
// radius: the marker is drawn 240 wide, but a player standing still 246 from the centre is hit and counted, and nobody at 269 or more is (see hit_radius in the summary).
// R is the middle of that gap; R ± EDGE is "on the edge" (positions between two samples are interpolated).
const R = 255, EDGE = 15;
const GREEN = 10269, FAIL_FX = 29242, HIT = 80378, ASC = 80368, EMP = 81002, CHANNEL = 81071;
if (!fs.existsSync(DIR)) { console.log('no logs/raw: data/green_overlap_raw_* left as they are'); process.exit(0); }
// can every circle get NEED up players of its own (each player counted once)? sets = up players inside each circle
const exclusive = sets => { const used = new Set(); const go = (i, k, from) => { if (i === sets.length) return true; if (k === NEED) return go(i + 1, 0, 0);
  for (let x = from; x < sets[i].length; x++) { const p = sets[i][x]; if (used.has(p)) continue; used.add(p); if (go(i, k + 1, x + 1)) return true; used.delete(p); } return false; }; return go(0, 0, 0); };
const circles = [], rounds = [], delay = [], hitD = [], missD = [], fxOff = []; let logs = 0, endedEarly = 0;
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.zevtc')).sort()) {
  const { agents, ev } = parseEvtc(path.join(DIR, f)); const boss = [...agents.values()].find(a => a.species === 28106); if (!boss || !ev.find(e => e.sc === 9)) continue;
  const lpi = ev.findIndex(e => e.skill === CHANNEL && e.sc === 67); if (lpi < 0) continue; const lp = ev[lpi];
  if (Math.max(0, ...ev.filter(e => e.sc === 12 && e.src === boss.addr).map(e => Number(e.dst))) < 70e6) continue;   // CM only
  const players = [...agents.values()].filter(a => a.isPlayer).map(a => a.addr), isP = new Set(players), id = f.replace('.zevtc', ''); logs++;
  const tl = new Map(), b = Buffer.alloc(8), st = new Map(players.map(a => [a, []]));
  ev.forEach((e, i) => { if (!isP.has(e.src)) return; if (e.sc === 19) { b.writeBigUInt64LE(e.dst); (tl.get(e.src) || tl.set(e.src, []).get(e.src)).push([e.t, b.readFloatLE(0), b.readFloatLE(4)]); } else if ([3, 4, 5, 6, 7].includes(e.sc)) st.get(e.src).push([i, e.sc]); });
  const pos = (a, t) => { const L = tl.get(a); if (!L) return null; const i = L.findIndex(p => p[0] > t); if (i === -1) return L[L.length - 1].slice(1); if (i === 0) return L[0].slice(1); const p = L[i - 1], q = L[i], k = (t - p[0]) / (q[0] - p[0]); return [p[1] + k * (q[1] - p[1]), p[2] + k * (q[2] - p[2])]; };
  // state just before event number i (a down caused by the failed green itself comes after it in the log)
  const stateAt = (a, i) => { let s = 'up'; for (const [k, sc] of st.get(a)) { if (k >= i) break; s = sc === 5 ? 'down' : sc === 4 ? 'dead' : sc === 7 ? 'gone' : 'up'; } return s; };
  const late = []; for (let i = lpi; i < ev.length; i++) { const e = ev[i]; if ((e.sc === 62 && e.skill === GREEN && isP.has(e.dst)) || (e.sc === 60 && e.skill === FAIL_FX) || (e.sc === 0 && !e.buff && e.skill === HIT && isP.has(e.dst)) || (e.skill === ASC && (e.sc === 71 || e.sc === 72) && isP.has(e.src)) || (e.skill === EMP && e.sc === 69 && e.dst === boss.addr)) late.push([i, e]); }
  const rs = []; for (const [, g] of late) { if (g.sc !== 62) continue; const r = rs[rs.length - 1]; if (r && g.t - r.t < 1500) r.c.push({ h: g.dst, t: g.t }); else rs.push({ t: g.t, c: [{ h: g.dst, t: g.t }] }); }
  const last = ev[ev.length - 1].t, bossDead = (ev.find(e => e.sc === 4 && e.src === boss.addr) || {}).t || Infinity;
  for (const r of rs) {
    if (r.t + DELAY + 500 > Math.min(last, bossDead)) { endedEarly++; continue; }   // the log ended, or Vloxx died, before the circles resolved
    const tick = Math.round((r.t - lp.t) / 1000), near = (e, c) => Math.abs(e.t - c.t - DELAY) <= 20;
    for (const c of r.c) { const fx = late.find(([, e]) => e.sc === 60 && near(e, c)), hits = late.filter(([, e]) => e.sc === 0 && near(e, c));
      c.failed = !!fx; c.tr = fx ? fx[1].t : c.t + DELAY; c.i = fx ? Math.min(fx[0], ...hits.map(x => x[0])) : ev.findIndex(e => e.t > c.tr); if (c.i < 0) c.i = ev.length;
      c.hit = new Set(hits.map(x => x[1].dst)); c.asc = late.filter(([, e]) => e.skill === ASC && near(e, c)).length; c.emp = late.filter(([, e]) => e.skill === EMP && near(e, c)).length;
      const hp = pos(c.h, c.tr); if (fx) { b.writeBigUInt64LE(fx[1].dst); c.xy = [b.readInt16LE(0) * 10, b.readInt16LE(2) * 10]; delay.push(c.tr - c.t); if (stateAt(c.h, c.i) !== 'dead') fxOff.push(Math.hypot(c.xy[0] - hp[0], c.xy[1] - hp[1])); } else c.xy = hp;
      c.d = new Map(players.filter(a => !['dead', 'gone'].includes(stateAt(a, c.i))).map(a => { const p = pos(a, c.tr); return [a, a === c.h && !fx ? 0 : Math.hypot(p[0] - c.xy[0], p[1] - c.xy[1])]; }));
      c.in = [...c.d.keys()].filter(a => c.d.get(a) <= R); c.up = c.in.filter(a => stateAt(a, c.i) === 'up'); c.edge = [...c.d.keys()].filter(a => Math.abs(c.d.get(a) - R) <= EDGE && stateAt(a, c.i) === 'up').length;
      if (fx) for (const [a, d] of c.d) { (c.hit.has(a) ? hitD : missD).push(d); if (DETAIL && (c.hit.has(a) ? d > R - 30 : d < R + 60)) console.log('  radius check:', id, '+' + tick, c.hit.has(a) ? 'HIT at' : 'not hit at', Math.round(d), stateAt(a, c.i), a === c.h ? 'holder' : '', 'position samples (ms from the hit):', (tl.get(a) || []).filter(p => Math.abs(p[0] - c.tr) < 500).map(p => p[0] - c.tr).join(',') || 'none (standing still)'); } }
    const shared = a => r.c.filter(c => c.in.includes(a)).length >= 2, counted = new Set();
    r.c.forEach((c, i) => { const others = r.c.filter(x => x !== c), fresh = c.up.filter(a => !counted.has(a)), far = c.in.map(a => c.d.get(a)), out = [...c.d].filter(([a]) => !c.in.includes(a)).map(x => x[1]);
      circles.push({ log: id, tick_s: tick, greens: r.c.length, circle: i + 1, marker_offset_ms: c.t - r.t, holder_state: stateAt(c.h, c.i), up_inside: c.up.length, downed_inside: c.in.length - c.up.length, up_on_the_edge: c.edge,
        shared_up_inside: c.up.filter(shared).length, up_inside_not_in_an_earlier_circle: fresh.length, nearest_other_holder: others.length ? Math.round(Math.min(...others.map(x => Math.hypot(c.xy[0] - x.xy[0], c.xy[1] - x.xy[1])))) : '',
        farthest_inside: far.length ? Math.round(Math.max(...far)) : '', nearest_outside: out.length ? Math.round(Math.min(...out)) : '', failed: +c.failed, players_hit: c.hit.size, shared_players_hit: [...c.hit].filter(shared).length,
        ascension_removals: c.asc, empowered_applications: c.emp, resolve_ms_after_marker: c.failed ? c.tr - c.t : '' });
      if (DETAIL && ((c.failed && c.up.length >= NEED) || (!c.failed && c.up.length < NEED) || r.c.some(x => x.up.some(shared))))
        console.log(id, '+' + tick, 'circle', i + 1, c.failed ? 'FAILED' : 'passed', '| up inside', c.up.length, 'not in an earlier circle', fresh.length, '|', [...c.d].filter(x => x[1] <= 400).map(([a, d]) => `${a === c.h ? 'H' : ''}${r.c.some(x => x.h === a && x !== c) ? 'h' + (r.c.findIndex(x => x.h === a) + 1) : ''}${shared(a) ? 's' : ''}${counted.has(a) ? 'c' : ''}${stateAt(a, c.i) === 'up' ? '' : '(' + stateAt(a, c.i) + ')'} ${Math.round(d)}${c.hit.has(a) ? ' HIT' : ''}`).join(' | '));
      for (const a of c.in) counted.add(a); });
    rounds.push({ log: id, tick_s: tick, greens: r.c.length, failed_circles: r.c.filter(c => c.failed).length, up_players_per_circle: r.c.map(c => c.up.length).join('/'), up_players_in_any_circle: new Set(r.c.flatMap(c => c.up)).size,
      up_players_in_2plus_circles: new Set(r.c.flatMap(c => c.up.filter(shared))).size, players_hit: new Set(r.c.flatMap(c => [...c.hit])).size, ascension_removals: r.c.reduce((s, c) => s + c.asc, 0), empowered_applications: r.c.reduce((s, c) => s + c.emp, 0),
      every_circle_has_3_up_inside: +r.c.every(c => c.up.length >= NEED), three_own_players_per_circle_possible: +exclusive(r.c.map(c => c.up)) });
  }
}
const out = (f, rows) => { const H = Object.keys(rows[0]); fs.writeFileSync(path.join(DATA, f), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n') + '\n'); };
if (!circles.length) { console.log('no last-phase green round in logs/raw'); process.exit(0); }
out('green_overlap_raw_circles.csv', circles);
const C = circles, cb = f => { const a = C.filter(f); return { circles: a.length, failed: a.filter(c => c.failed).length }; }, multi = rounds.filter(r => r.greens >= 2), q = a => { a = a.slice().sort((x, y) => x - y); return a.length ? { n: a.length, min: Math.round(a[0]), median: Math.round(a[a.length >> 1]), max: Math.round(a[a.length - 1]) } : null; };
const key = r => r.log + '|' + r.tick_s, sharedRounds = multi.filter(r => r.up_players_in_2plus_circles > 0), clear = c => !c.up_on_the_edge;
const S = { logs, radius: R, edge: EDGE, rounds: rounds.length, rounds_dropped_ended_before_resolve: endedEarly, rounds_2plus_greens: multi.length, circles: C.length, failed_circles: C.filter(c => c.failed).length,
  failed_ms_after_own_marker: q(delay), failed_effect_distance_from_holder: q(fxOff),
  hit_radius: { farthest_player_hit: Math.round(Math.max(...hitD)), nearest_player_not_hit: Math.round(Math.min(...missD)), players_hit: hitD.length, hit_beyond_radius: hitD.filter(d => d > R).length, not_hit_within_radius: missD.filter(d => d <= R).length },
  circle_by_up_players_inside: { under_3: cb(c => c.up_inside < 3), exactly_3: cb(c => c.up_inside === 3), '4_or_more': cb(c => c.up_inside >= 4) },
  circle_by_up_players_inside_nobody_on_the_edge: { under_3: cb(c => clear(c) && c.up_inside < 3), exactly_3: cb(c => clear(c) && c.up_inside === 3), '4_or_more': cb(c => clear(c) && c.up_inside >= 4) },
  rounds_with_a_player_in_2plus_circles: sharedRounds.length,
  // the test: circles with 3+ up players inside, of which fewer than 3 are not in a circle that resolved earlier in the round
  circles_filled_only_with_shared_players: cb(c => c.up_inside >= NEED && c.up_inside_not_in_an_earlier_circle < NEED),
  circles_3plus_up_and_3plus_not_in_an_earlier_circle: cb(c => c.up_inside >= NEED && c.up_inside_not_in_an_earlier_circle >= NEED),
  // rounds where every circle has 3+ up players inside: can each circle also get 3 of its own?
  rounds_every_circle_3plus_inside: { three_own_players_per_circle_possible: (a => ({ rounds: a.length, a_circle_failed: a.filter(r => r.failed_circles).length }))(multi.filter(r => r.every_circle_has_3_up_inside && r.three_own_players_per_circle_possible)),
    only_by_counting_a_player_twice: (a => ({ rounds: a.length, a_circle_failed: a.filter(r => r.failed_circles).length }))(multi.filter(r => r.every_circle_has_3_up_inside && !r.three_own_players_per_circle_possible)) },
  circles_under_3_up_but_3_with_downed: cb(c => c.up_inside < NEED && c.up_inside + c.downed_inside >= NEED), failed_circles_with_a_dead_holder: C.filter(c => c.failed && c.holder_state === 'dead').length,
  shared_rounds: sharedRounds, shared_round_circles: C.filter(c => sharedRounds.some(r => key(r) === key(c))) };
fs.writeFileSync(path.join(DATA, 'green_overlap_raw_summary.json'), JSON.stringify(S, null, 1) + '\n');
console.log(`green overlap (raw): ${logs} logs reached the last phase, ${S.rounds} rounds (${endedEarly} dropped: ended before the circles resolved), ${S.rounds_2plus_greens} with 2+ greens, ${S.circles} circles, ${S.failed_circles} failed`);
console.log('  failed circle, ms after its own marker:', JSON.stringify(S.failed_ms_after_own_marker), '| effect centre vs holder position:', JSON.stringify(S.failed_effect_distance_from_holder));
console.log('  hit radius:', JSON.stringify(S.hit_radius));
console.log('  circles by up players inside:', JSON.stringify(S.circle_by_up_players_inside)); console.log('  same, nobody on the edge:', JSON.stringify(S.circle_by_up_players_inside_nobody_on_the_edge));
console.log('  rounds with a player in 2+ circles:', S.rounds_with_a_player_in_2plus_circles, '| circles with 3+ up inside but fewer than 3 not already in an earlier circle:', JSON.stringify(S.circles_filled_only_with_shared_players), '| other circles with 3+:', JSON.stringify(S.circles_3plus_up_and_3plus_not_in_an_earlier_circle));
console.log('  rounds where every circle has 3+ up inside:', JSON.stringify(S.rounds_every_circle_3plus_inside), '| under 3 up but 3 with downed players:', JSON.stringify(S.circles_under_3_up_but_3_with_downed), '| failed circles with a dead holder:', S.failed_circles_with_a_dead_holder);
for (const r of S.shared_rounds) console.log('  ', JSON.stringify(r));
