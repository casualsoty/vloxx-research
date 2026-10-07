// Excision Extremis (Vloxx, skill 81053): the placement rule of the 16 slashes, the four "flowers".
// Works from the committed datasets, so it runs without the raw logs:
//   data/excision_slashes.csv (excision_geometry.js), data/aspect_events.csv (build_dataset.js), data/excision_melee.csv (excision_safespot.js).
// Part 1 (every complete cast): the 16 slashes are 4 squares ("flowers") of 4 half-circles, each 400 from the square's centre.
//   Measures where each flower lies relative to Vloxx's facing, whether its half-circles face inward (centre covered) or outward
//   (centre free), per pulse, and whether the Aspect of the Sword being alive changes any of it.
// Part 2 (who is the centre): for our raw logs that also exist on GW2 Wingman (URL in data/logs_index.csv) the EI JSON gives player
//   positions every 300 ms. The slim copy is cached in private/ei_positions/ (local only, gitignored). Each flower centre is compared with every
//   player's position 2.0 s before the flower's first slash (= when its first telegraph appears).
//   If Wingman can't be reached and nothing is cached, the "targeting" block of the previous summary is kept.
// Usage: node excision_flowers.js [--no-fetch]
// Writes data/excision_flowers.csv (one row per flower) and data/excision_flowers_summary.json.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), CACHE = path.join(ROOT, 'private', 'ei_positions');
const csv = f => { const [h, ...L] = fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n'); const H = h.split(','); return L.map(l => { const v = l.split(','); return Object.fromEntries(H.map((k, i) => [k, v[i]])); }); };
const nd = a => ((a + 180) % 360 + 360) % 360 - 180, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const q = (a, f) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : null; };
const med = a => q(a, 0.5), pct = (n, d) => d ? Math.round(100 * n / d) : null, H2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// pulse (s after cast start) and nominal rotation (deg, relative to the first slash) of the 16 slashes, grouped per flower
const NOM = { '4.8': [0], '5.3': [0, 90], '5.8': [180, 90], '6.2': [0], '6.3': [180, -90], '6.7': [-90], '6.8': [0, 90], '7.2': [180], '7.3': [-90], '7.8': [180, 90], '8.4': [90] };
const FLOWERS = { 1: ['4.8|0', '5.3|90', '5.8|180', '6.3|-90'], 2: ['5.3|0', '5.8|90', '6.3|180', '6.8|0'], 3: ['6.2|0', '6.7|-90', '7.2|180', '7.8|180'], 4: ['6.8|90', '7.3|-90', '7.8|90', '8.4|90'] };

// ---------- part 1: rebuild the casts and their flowers ----------
const slashes = csv('excision_slashes.csv').filter(r => r.caster === 'Vloxx' && r.skill === '81053');
const sword = {}; for (const a of csv('aspect_events.csv')) if (a.aspect === 'Sword' && a.event !== 'breakbar_broken') (sword[a.log_id] = sword[a.log_id] || []).push([+a.time_s, a.event]);
const swordAlive = (log, t) => { let s = null; for (const [tt, e] of (sword[log] || []).sort((a, b) => a[0] - b[0])) { if (tt > t) break; s = e === 'spawn'; } return s; };
const melee = {}; for (const m of csv('excision_melee.csv')) if (!(m.cast in melee)) melee[m.cast] = m;
const byLog = {}; for (const r of slashes) (byLog[r.log] = byLog[r.log] || []).push({ c0: +r.t - +r.pulse_s, r });
const casts = []; let nCasts = 0; const perCast = {};
for (const [log, L] of Object.entries(byLog)) { L.sort((a, b) => a.c0 - b.c0); const groups = []; let cur = [];
  for (const x of L) { if (cur.length && x.c0 - cur[0].c0 > 3) { groups.push(cur); cur = []; } cur.push(x); } if (cur.length) groups.push(cur);
  groups.forEach((g, gi) => { nCasts++; const t0 = med(g.map(x => x.c0)); const s = g.map(x => x.r).filter(r => +r.pulse_s >= 4.7 && +r.pulse_s <= 8.5).sort((a, b) => +a.t - +b.t);
    perCast[s.length] = (perCast[s.length] || 0) + 1; const first = s.filter(r => r.pulse_s === '4.8'); if (s.length !== 16 || first.length !== 1) return;
    // frame: origin = first slash, forward = the direction it covers (Vloxx's facing). A slash with rotation rot (clockwise) covers the half-plane around −rot − 90°.
    const rot0 = rad(+first[0].slash_rot_deg), phi = -rot0 - Math.PI / 2, fx = Math.cos(phi), fy = Math.sin(phi), ox = +first[0].x, oy = +first[0].y;
    const pts = s.map(r => { const dx = +r.x - ox, dy = +r.y - oy; return { p: r.pulse_s, t: +r.t, wx: +r.x, wy: +r.y, f: dx * fx + dy * fy, l: -dx * fy + dy * fx, r: nd(-(+r.slash_rot_deg - deg(rot0))) }; });
    const slot = {}; for (const [k, nom] of Object.entries(NOM)) { let ps = pts.filter(p => p.p === k); if (ps.length !== nom.length) return;
      if (nom.length === 2 && Math.abs(nd(nd(ps[1].r - nom[0]) - nd(ps[0].r - nom[1]))) < Math.abs(nd(nd(ps[0].r - nom[0]) - nd(ps[1].r - nom[1])))) ps = [ps[1], ps[0]];
      ps.forEach((p, i) => { slot[k + '|' + nom[i]] = p; }); }
    const a0 = swordAlive(log, t0), a1 = swordAlive(log, t0 + 5); const m = melee[log + '#' + (gi + 1)];
    const c = { log, i: gi + 1, t0, sword: a0 === a1 ? a0 : null, dFix: m && m.vloxx_to_fixated !== '' ? +m.vloxx_to_fixated : null, flowers: [] };
    for (const [k, keys] of Object.entries(FLOWERS)) { const P = keys.map(x => slot[x]); const cf = P.reduce((s, p) => s + p.f, 0) / 4, cl = P.reduce((s, p) => s + p.l, 0) / 4;
      const inward = P.map(p => Math.abs(nd(p.r - deg(Math.atan2(cl - p.l, cf - p.f)))) < 90);
      c.flowers.push({ k: +k, P, cw: [P.reduce((s, p) => s + p.wx, 0) / 4, P.reduce((s, p) => s + p.wy, 0) / 4], aw: [P[0].wx, P[0].wy], tFirst: P[0].t,
        radius: P.map(p => Math.hypot(p.f - cf, p.l - cl)), dir: deg(Math.atan2(cl - P[0].l, cf - P[0].f)), inward, nIn: inward.filter(Boolean).length,
        ccw: (P[1].f - P[0].f) * (P[2].l - P[1].l) - (P[1].l - P[0].l) * (P[2].f - P[1].f) > 0 }); }
    casts.push(c); });
}
const F = casts.flatMap(c => c.flowers.map(f => ({ ...f, c })));
const BANDS = [[0, 45], [45, 90], [90, 135], [135, 180.01]];
const band = fl => BANDS.map(([a, b]) => { const g = fl.filter(f => Math.abs(f.dir) >= a && Math.abs(f.dir) < b); return { dirVsFacingDeg: `${a}–${Math.floor(b)}`, flowers: g.length, centreFreePct: pct(g.filter(f => f.nIn === 0).length, g.length), centreCoveredBy4Pct: pct(g.filter(f => f.nIn === 4).length, g.length) }; });
const behind = F.filter(f => Math.abs(f.dir) >= 135); const byPulse = {};
for (const f of behind) f.P.forEach((p, i) => { const o = byPulse[p.p] = byPulse[p.p] || [0, 0]; o[1]++; if (f.inward[i]) o[0]++; });
const cmp = on => { const g = F.filter(f => f.c.sword === on); return { casts: casts.filter(c => c.sword === on).length, flowers: g.length, centreFreePct: pct(g.filter(f => f.nIn === 0).length, g.length), meanInwardSlashes: +(g.reduce((s, f) => s + f.nIn, 0) / g.length).toFixed(2),
  behindVloxxPct: pct(g.filter(f => Math.abs(f.dir) >= 90).length, g.length), dirVsFacingAbsDeg_p25_50_75: [0.25, 0.5, 0.75].map(x => Math.round(q(g.map(f => Math.abs(f.dir)), x))) }; };
const perLog = {}; for (const f of F) (perLog[f.c.log] = perLog[f.c.log] || []).push(f.nIn === 0 ? 1 : 0);
const logShare = Object.values(perLog).filter(v => v.length >= 20).map(v => pct(v.reduce((a, b) => a + b, 0), v.length)).sort((a, b) => a - b);
const summary = { castsSeen: nCasts, slashesPerCastInExcisionWindow: perCast, completeCasts: casts.length, logs: Object.keys(perLog).length, flowers: F.length,
  structure: { flowerStartS: [4.8, 5.3, 6.2, 6.8], slashEveryS: 0.5, slashToCentre_p10_50_90: [0.1, 0.5, 0.9].map(x => Math.round(q(F.flatMap(f => f.radius), x))), sameTurningSensePct: pct(F.filter(f => f.ccw).length, F.length) },
  centre: { freePct: pct(F.filter(f => f.nIn === 0).length, F.length), coveredBy4Pct: pct(F.filter(f => f.nIn === 4).length, F.length), byInwardSlashes: [0, 1, 2, 3, 4].map(n => F.filter(f => f.nIn === n).length),
    byDirectionVsFacing: band(F), freePctPerLog_min_median_max: [logShare[0], med(logShare), logShare[logShare.length - 1]] },
  behindVloxx135: { flowers: behind.length, inwardPctByPulseS: Object.fromEntries(Object.entries(byPulse).sort((a, b) => a[0] - b[0]).map(([k, [a, b]]) => [k, { n: b, inwardPct: pct(a, b) }])),
    withAnInwardSlashPctByFlower: [1, 2, 3, 4].map(k => pct(behind.filter(f => f.k === k && f.nIn > 0).length, behind.filter(f => f.k === k).length)) },
  swordAspect: { alive: cmp(true), dead: cmp(false) } };

// ---------- part 2: who is at the centre (EI positions from Wingman) ----------
const slim = j => { const cr = a => { const c = a.combatReplayData || {}; return { start: c.start, positions: c.positions, dead: c.dead, down: c.down, dc: c.dc }; };
  return { meta: j.combatReplayMetaData, players: j.players.map((p, i) => ({ i, cr: cr(p), fix: (p.buffUptimes || []).filter(b => b.id === 34508).map(b => ({ states: b.states })) })),
    targets: [{ cr: cr(j.targets[0]), casts: (j.targets[0].rotation || []).filter(r => r.id === 81053).flatMap(r => r.skills) }] }; };
async function eiFor(log, url) { const f = path.join(CACHE, log + '.json'); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (process.argv.includes('--no-fetch') || !/gw2wingman/.test(url)) return null;
  try { const r = await fetch('https://gw2wingman.nevermindcreations.de/api/getFullJson/' + url.split('/').pop(), { signal: AbortSignal.timeout(300000) }); if (!r.ok) return null;
    const s = slim(await r.json()); fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, JSON.stringify(s)); return s; } catch (e) { console.log('  could not fetch', log, e.message); return null; } }
(async () => {
  const used = new Set(casts.map(c => c.log)); const rows = [];
  for (const l of csv('logs_index.csv')) { if (!used.has(l.log_id) || !l.url) continue; const j = await eiFor(l.log_id, l.url); if (!j || !j.targets[0].casts.length) continue;
    const cs = casts.filter(c => c.log === l.log_id), ec = j.targets[0].casts.map(x => x.castTime / 1000), pr = j.meta.pollingRate / 1000;
    // EI clock = raw clock + off (EI starts ~3 s earlier)
    const cnt = {}; for (const c of cs) for (const e of ec) { const k = (e - c.t0).toFixed(1); cnt[k] = (cnt[k] || 0) + 1; } const mode = +Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    const off = med(cs.flatMap(c => ec.map(e => e - c.t0)).filter(d => Math.abs(d - mode) < 0.3));
    const pos = (a, t) => { const p = a.cr.positions || [], i = (t * 1000 - a.cr.start) / 1000 / pr; if (i < 0 || i >= p.length - 1) return null; const k = Math.floor(i), w = i - k; return [p[k][0] * (1 - w) + p[k + 1][0] * w, p[k][1] * (1 - w) + p[k + 1][1] * w]; };
    for (const c of cs) for (const f of c.flowers) rows.push({ f, c, j, pos, t: f.tFirst + off }); }
  let targeting = null;
  if (rows.length) {
    // pixel = 0.15 × world + offset (y flipped). Offset: first from Vloxx standing near the first slash, then refined on the matched flowers.
    const S = 0.15; let ox = med(rows.filter(r => r.f.k === 1).map(r => { const p = r.pos(r.j.targets[0], r.t); return p ? p[0] - S * r.f.aw[0] : NaN; })), oy = med(rows.filter(r => r.f.k === 1).map(r => { const p = r.pos(r.j.targets[0], r.t); return p ? p[1] + S * r.f.aw[1] : NaN; }));
    const W = p => p && [(p[0] - ox) / S, -(p[1] - oy) / S];
    const players = (r, t) => r.j.players.map(p => ({ p, w: W(r.pos(p, t)) })).filter(x => x.w);
    const nearest = (r, dt) => players(r, r.t + dt).map(x => ({ ...x, d: H2(r.f.cw, x.w) })).sort((a, b) => a.d - b.d)[0];
    for (let it = 0; it < 3; it++) { const m = rows.map(r => ({ r, n: nearest(r, -2) })).filter(x => x.n && x.n.d < 150); const px = x => x.r.pos(x.n.p, x.r.t - 2);
      ox = med(m.map(x => px(x)[0] - S * x.r.f.cw[0])); oy = med(m.map(x => px(x)[1] + S * x.r.f.cw[1])); }
    const scan = {}; for (const dt of [0, -0.5, -1, -1.5, -2, -2.5, -3, -4]) { const d = rows.map(r => nearest(r, dt)).filter(Boolean).map(x => x.d); scan[dt] = { medianDist: Math.round(med(d)), within40Pct: pct(d.filter(x => x < 40).length, d.length) }; }
    const inIv = (a, t) => (a || []).some(([s, e]) => s <= t * 1000 && t * 1000 <= e); const up = (p, t) => !inIv(p.cr.dead, t) && !inIv(p.cr.down, t) && !inIv(p.cr.dc, t);
    const fixated = (p, t) => { let s = 0; for (const b of p.fix) for (const [tt, v] of b.states || []) if (tt <= t * 1000) s = v; return s > 0; };
    const M = []; for (const r of rows) { const t = r.t - 2, n = nearest(r, -2); if (!n || n.d >= 40) continue; const v = W(r.pos(r.j.targets[0], t)); const ups = players(r, t).filter(x => up(x.p, t)).sort((a, b) => H2(v, a.w) - H2(v, b.w));
      const dV = H2(v, n.w); Object.assign(r.f, { target: n.p.i, centreToTarget: n.d, targetUp: up(n.p, t), targetFixated: fixated(n.p, t), anyFixated: ups.some(x => fixated(x.p, t)), nUp: ups.length, rank: ups.findIndex(x => x.p === n.p), targetToVloxx: dV,
        firstSlashVsVloxxDeg: dV > 150 ? nd(deg(Math.atan2(r.f.aw[1] - r.f.cw[1], r.f.aw[0] - r.f.cw[0])) - deg(Math.atan2(v[1] - r.f.cw[1], v[0] - r.f.cw[0]))) : null, firstSlashToTarget: H2(r.f.aw, n.w) }); M.push(r.f); }
    const wf = M.filter(f => f.anyFixated); const full = [...new Set(rows.map(r => r.c))].filter(c => c.flowers.every(f => f.target != null)); const third = f => f.rank < f.nUp / 3 ? 0 : f.rank < 2 * f.nUp / 3 ? 1 : 2;
    targeting = { logs: new Set(rows.map(r => r.c.log)).size, casts: new Set(rows.map(r => r.c)).size, flowers: rows.length, centreOnAPlayerWithin40: M.length, centreToTargetMedian: Math.round(med(M.map(f => f.centreToTarget))),
      nearestPlayerToCentreBySecondsBeforeFirstSlash: scan, targetsUp: M.filter(f => f.targetUp).length,
      targetIsFixated: { n: wf.filter(f => f.targetFixated).length, of: wf.length, expectedByChance: +wf.reduce((s, f) => s + 1 / f.nUp, 0).toFixed(1), byFlower: [1, 2, 3, 4].map(k => `${wf.filter(f => f.k === k && f.targetFixated).length}/${wf.filter(f => f.k === k).length}`) },
      targetDistanceRankThirds_closest_middle_farthest: [0, 1, 2].map(i => M.filter(f => f.rank >= 0 && third(f) === i).length),
      distinctTargetsPerCast: full.reduce((o, c) => { const n = new Set(c.flowers.map(f => f.target)).size; o[n] = (o[n] || 0) + 1; return o; }, {}),
      firstSlashOnVloxxSideWithin20deg: { n: M.filter(f => f.firstSlashVsVloxxDeg != null && Math.abs(f.firstSlashVsVloxxDeg) < 20).length, of: M.filter(f => f.firstSlashVsVloxxDeg != null).length },
      firstSlashToTarget_p10_50_90: [0.1, 0.5, 0.9].map(x => Math.round(q(M.map(f => f.firstSlashToTarget), x))) };
  } else { try { targeting = JSON.parse(fs.readFileSync(path.join(DATA, 'excision_flowers_summary.json'), 'utf8')).targeting; if (targeting) targeting.note = 'kept from a previous run (no EI positions available)'; } catch (e) { /* first run without positions */ } }
  summary.targeting = targeting;
  const out = F.map(f => ({ log: f.c.log, cast: f.c.i, t_cast: f.c.t0.toFixed(1), flower: f.k, sword_alive: f.c.sword == null ? '' : +f.c.sword, vloxx_to_fixated: f.c.dFix ?? '', centre_x: Math.round(f.cw[0]), centre_y: Math.round(f.cw[1]),
    dir_vs_facing_deg: Math.round(f.dir), inward_slashes: f.nIn, centre_free: f.nIn === 0 ? 1 : 0, centre_to_target: f.target == null ? '' : Math.round(f.centreToTarget), target_is_fixated: f.target == null ? '' : +f.targetFixated,
    target_rank_from_vloxx: f.target == null || f.rank < 0 ? '' : f.rank + 1, players_up: f.target == null ? '' : f.nUp, target_to_vloxx: f.target == null ? '' : Math.round(f.targetToVloxx) }));
  const K = Object.keys(out[0]); fs.writeFileSync(path.join(DATA, 'excision_flowers.csv'), [K.join(','), ...out.map(r => K.map(k => r[k]).join(','))].join('\n'));
  fs.writeFileSync(path.join(DATA, 'excision_flowers_summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
})();
