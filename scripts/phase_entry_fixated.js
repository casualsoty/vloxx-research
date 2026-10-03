// Does anything change when nobody holds Fixated at the start of P2 (Spear phase) / P3 (Sword phase)? From raw logs.
// A phase change: split starts (first spawn of the next Aspect) → Vloxx returns channelling Visions of Eternity with its breakbar →
// the bar is broken and the boss phase resumes. Entry = the end of that Visions of Eternity cast (statechange 68).
// "Fixated at entry" = a player holds buff 34508 at that ms. All timings below are measured from the entry.
// Compared between the two groups: when Fixated is next applied, Vloxx's cast sequence and timings after the phase start, the first
// green round (time, number of greens, whether the fixated player has slot 1), the first Cosmic Charge (who it is aimed at).
// Writes data/phase_entry_fixated.csv (one row per log × phase) and prints the comparison.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const pb = Buffer.alloc(8);
const q = (a, f) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : null; };
const rows = []; const seqs = {};
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, skills, ev, evStart, buf } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue; ev.forEach((e, i) => e.i = i);
  const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue; const isP = a => (agents.get(a) || {}).isPlayer;
  const P = [...agents.values()].filter(a => a.isPlayer && a.elite !== 0xffffffff).map(a => a.addr);
  const firstSpawn = rx => { const ids = [...agents.values()].filter(a => rx.test(a.name || '')).map(a => a.addr); const t = ev.filter(e => e.sc === 6 && ids.includes(e.src)).map(e => e.t); return t.length ? Math.min(...t) : null; };
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  // Fixated timeline: apply (69, dst = player), removals (71 / 72, src = bearer)
  const fx = ev.filter(e => e.skill === 34508 && ((e.sc === 69 && isP(e.dst)) || ((e.sc === 71 || e.sc === 72) && isP(e.src)))).sort((a, b) => a.t - b.t);
  const holderAt = t => { let h = null, end = 0; for (const e of fx) { if (e.t > t) break; if (e.sc === 69) { h = e.dst; end = e.t + e.value; } else if (e.src === h) { h = null; } } return h != null && end > t ? h : null; };
  const applies = fx.filter(e => e.sc === 69);
  const state = new Map(); for (const e of ev) if ([3, 4, 5, 6].includes(e.sc) && isP(e.src)) (state.get(e.src) || state.set(e.src, []).get(e.src)).push([e.t, e.sc]);
  const up = (a, t) => { let u = true; for (const [tt, sc] of state.get(a) || []) { if (tt > t) break; u = sc === 3 || sc === 6; } return u; };
  const pos = new Map(); for (const e of ev) if (e.sc === 19) { pb.writeBigUInt64LE(e.dst); (pos.get(e.src) || pos.set(e.src, []).get(e.src)).push([e.t, pb.readFloatLE(0), pb.readFloatLE(4)]); }
  const at = (a, t) => { let r = null; for (const x of pos.get(a) || []) { if (x[0] > t) break; r = x; } return r; };
  const greens = ev.filter(e => e.sc === 62 && gid.get(e.skill) === 'BC9F7038' && isP(e.dst)); // green markers on players
  const bossCasts = ev.filter(e => e.sc === 67 && e.src === boss.addr);
  for (const [phase, rx, endRx] of [['P2 Spear', /Aspect of the Spear/, /Cosmic Bulwark|Aspect of the Sword/], ['P3 Sword', /Aspect of the Sword/, /Cosmic Sunderer/]]) {
    const tSplit = firstSpawn(rx); if (tSplit == null) continue; const vis = bossCasts.find(e => e.t >= tSplit && e.t < tSplit + 30000 && /Visions of Eternity/.test(skills.get(e.skill) || '')); if (!vis) continue;
    const visEnd = ev.find(e => e.sc === 68 && e.src === boss.addr && e.skill === vis.skill && e.t > vis.t); if (!visEnd) continue; const t0 = visEnd.t; const tEnd = Math.min(firstSpawn(endRx) || Infinity, ev[ev.length - 1].t); if (tEnd - t0 < 25000) continue; // need at least 25 s of the phase
    const h = holderAt(t0 - 50); const lastApp = applies.filter(e => e.t <= t0 - 50).pop(); const nextApp = applies.find(e => e.t > t0 - 50 && e.t < tEnd);
    const holderEnd = h != null ? (() => { const e = fx.find(x => x.t > t0 - 50 && (x.sc === 71 || x.sc === 72) && x.src === h); const nat = lastApp.t + lastApp.value; return Math.min(e ? e.t : Infinity, nat); })() : null;
    const casts = bossCasts.filter(e => e.t >= t0 - 100 && e.t < Math.min(tEnd, t0 + 60000)).map(e => ({ n: skills.get(e.skill) || String(e.skill), dt: (e.t - t0) / 1000 }));
    // first green round of the phase: markers within 400 ms of the first marker
    const g1 = greens.find(e => e.t > t0 && e.t < tEnd); let gr = null; if (g1) { const ms = greens.filter(e => e.t >= g1.t && e.t - g1.t < 400); const hg = holderAt(g1.t); gr = { dt: (g1.t - t0) / 1000, n: new Set(ms.map(e => e.dst)).size, up: P.filter(p => up(p, g1.t)).length, holder: hg != null, slot1: hg != null && ms[0].dst === hg }; }
    // first Cosmic Charge: who is the dash aimed at?
    const cc = bossCasts.find(e => e.skill === 80512 && e.t > t0 && e.t < tEnd); let ccR = null; if (cc) { const a = at(boss.addr, cc.t + 2900), b = at(boss.addr, cc.t + 7800); const hc = holderAt(cc.t);
      if (a && b && Math.hypot(b[1] - a[1], b[2] - a[2]) > 500) { const dir = Math.atan2(b[2] - a[2], b[1] - a[1]); const offs = P.filter(p => up(p, cc.t)).map(p => { const q2 = at(p, cc.t); if (!q2) return null; let d = Math.abs(Math.atan2(q2[2] - a[2], q2[1] - a[1]) - dir) * 180 / Math.PI; if (d > 180) d = 360 - d; return { p, d, dist: Math.hypot(q2[1] - a[1], q2[2] - a[2]) }; }).filter(Boolean).sort((x, y) => x.d - y.d);
        const byDist = offs.slice().sort((x, y) => x.dist - y.dist); ccR = { dt: (cc.t - t0) / 1000, holder: hc != null, toHolder: hc != null ? (offs.find(o => o.p === hc) || {}).d : null, nearestAngle: offs[0] ? offs[0].d : null, aimedRankByDistance: offs[0] ? byDist.findIndex(o => o.p === offs[0].p) + 1 : null, aimedDist: offs[0] ? offs[0].dist : null }; } }
    const grp = h != null ? 'fixated' : 'nobody';
    rows.push({ log: f.replace('.zevtc', ''), phase, split_start_s: ((tSplit - s9.t) / 1000).toFixed(1), phase_start_s: ((t0 - s9.t) / 1000).toFixed(1), split_and_visions_s: ((t0 - tSplit) / 1000).toFixed(1), fixated_at_entry: h != null ? 1 : 0, last_apply_s_before: lastApp ? ((t0 - lastApp.t) / 1000).toFixed(1) : '', next_apply_s_after: nextApp ? ((nextApp.t - t0) / 1000).toFixed(1) : '',
      holder_fixated_ends_s_after: holderEnd != null ? ((holderEnd - t0) / 1000).toFixed(1) : '', gap_until_next_apply_s: holderEnd != null && nextApp ? ((nextApp.t - holderEnd) / 1000).toFixed(1) : '', next_holder_same: nextApp && h != null ? (nextApp.dst === h ? 1 : 0) : '',
      entry_kind: h == null ? 'nobody' : (t0 - lastApp.t) <= 3000 ? 'fresh' : 'carried', entry_holder_dist_rank: (() => { if (h == null) return ''; const ta = (t0 - lastApp.t) <= 3000 ? lastApp.t : t0; const b = at(boss.addr, ta); const ds = P.filter(p => up(p, ta)).map(p => { const q2 = at(p, ta); return q2 && b ? [p, Math.hypot(q2[1] - b[1], q2[2] - b[2])] : null; }).filter(Boolean).sort((x, y) => x[1] - y[1]); const i = ds.findIndex(x => x[0] === h); return i < 0 ? '' : i + 1; })(),
      entry_holder_was_previous_holder: (() => { if (h == null || (t0 - lastApp.t) > 3000) return ''; const prev = applies.filter(e => e.t < lastApp.t).pop(); return prev ? (prev.dst === h ? 1 : 0) : ''; })(),
      second_green_s: (() => { const g2 = greens.find(e => e.t > t0 + 15000 && e.t < tEnd); return g2 ? ((g2.t - t0) / 1000).toFixed(1) : ''; })(), second_green_holder: (() => { const g2 = greens.find(e => e.t > t0 + 15000 && e.t < tEnd); return g2 ? (holderAt(g2.t) != null ? 1 : 0) : ''; })(), second_green_n: (() => { const g2 = greens.find(e => e.t > t0 + 15000 && e.t < tEnd); return g2 ? new Set(greens.filter(e => e.t >= g2.t && e.t - g2.t < 400).map(e => e.dst)).size : ''; })(), second_green_up: (() => { const g2 = greens.find(e => e.t > t0 + 15000 && e.t < tEnd); return g2 ? P.filter(p => up(p, g2.t)).length : ''; })(),
      first_casts: casts.slice(0, 6).map(c => c.n + '@' + c.dt.toFixed(1)).join(' > '), first_green_s: gr ? gr.dt.toFixed(1) : '', first_green_n: gr ? gr.n : '', first_green_up: gr ? gr.up : '', first_green_holder: gr ? (gr.holder ? 1 : 0) : '', first_green_slot1_holder: gr ? (gr.slot1 ? 1 : 0) : '',
      cc_s: ccR ? ccR.dt.toFixed(1) : '', cc_holder: ccR ? (ccR.holder ? 1 : 0) : '', cc_angle_to_holder: ccR && ccR.toHolder != null ? Math.round(ccR.toHolder) : '', cc_angle_to_nearest_dir_player: ccR ? Math.round(ccR.nearestAngle) : '', cc_aimed_player_distance_rank: ccR ? ccR.aimedRankByDistance : '', cc_aimed_player_dist: ccR ? Math.round(ccR.aimedDist) : '' });
    const key = phase + ' | ' + grp; const o = (seqs[key] = seqs[key] || { n: 0, order: {}, times: {} }); o.n++; const ord = casts.slice(0, 5).map(c => c.n).join(' > '); o.order[ord] = (o.order[ord] || 0) + 1;
    const seen = new Set(); for (const c of casts) { if (seen.has(c.n)) continue; seen.add(c.n); (o.times[c.n] = o.times[c.n] || []).push(c.dt); }
  }
}
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'phase_entry_fixated.csv'), [H.join(','), ...rows.map(r => H.map(k => String(r[k]).replace(/,/g, ';')).join(','))].join('\n'));
const num = (r, k) => r.map(x => x[k]).filter(v => v !== '').map(Number);
for (const phase of ['P2 Spear', 'P3 Sword']) { console.log('\n================ ' + phase + ' ================');
  for (const g of [1, 0]) { const r = rows.filter(x => x.phase === phase && x.fixated_at_entry === g); const label = g ? 'someone fixated at entry' : 'NOBODY fixated at entry'; if (!r.length) { console.log(label + ': 0 fights'); continue; }
    console.log(`\n${label}: ${r.length} fights`);
    console.log('  last Fixated applied before the phase start (s): p10/p50/p90', [0.1, 0.5, 0.9].map(f => q(num(r, 'last_apply_s_before'), f)).join(' / '));
    console.log('  next Fixated applied after the phase start (s):   p10/p50/p90', [0.1, 0.5, 0.9].map(f => q(num(r, 'next_apply_s_after'), f)).join(' / '), `(n ${num(r, 'next_apply_s_after').length})`);
    const gr = r.filter(x => x.first_green_s !== ''); console.log('  first green round: at', [0.1, 0.5, 0.9].map(f => q(num(gr, 'first_green_s'), f)).join(' / '), 's | someone fixated then:', gr.filter(x => x.first_green_holder === 1).length + '/' + gr.length,
      '| greens = min(3, up/3):', gr.filter(x => +x.first_green_n === Math.min(3, Math.floor(+x.first_green_up / 3))).length + '/' + gr.length, '| count distribution', JSON.stringify(gr.reduce((o, x) => (o[x.first_green_n + ' (up ' + x.first_green_up + ')'] = (o[x.first_green_n + ' (up ' + x.first_green_up + ')'] || 0) + 1, o), {})));
    const cc = r.filter(x => x.cc_s !== ''); console.log('  first Cosmic Charge: at', [0.1, 0.5, 0.9].map(f => q(num(cc, 'cc_s'), f)).join(' / '), 's | someone fixated at the cast:', cc.filter(x => x.cc_holder === 1).length + '/' + cc.length,
      '| angle to the fixated player p50/p90:', q(num(cc.filter(x => x.cc_holder === 1), 'cc_angle_to_holder'), 0.5), '/', q(num(cc.filter(x => x.cc_holder === 1), 'cc_angle_to_holder'), 0.9));
    const nf = cc.filter(x => x.cc_holder === 0); if (nf.length) console.log('    with NOBODY fixated at the cast (' + nf.length + '): angle to the best-aligned player p50/p90', q(num(nf, 'cc_angle_to_nearest_dir_player'), 0.5), '/', q(num(nf, 'cc_angle_to_nearest_dir_player'), 0.9), '| that player\'s distance rank (1 = closest to Vloxx):', JSON.stringify(nf.reduce((o, x) => (o[x.cc_aimed_player_distance_rank] = (o[x.cc_aimed_player_distance_rank] || 0) + 1, o), {})));
    if (g) console.log('  the entry holder keeps Fixated for (s after entry): p10/p50/p90', [0.1, 0.5, 0.9].map(f => q(num(r, 'holder_fixated_ends_s_after'), f)).join(' / '), '| then the next one comes after (s): p10/p50/p90', [0.1, 0.5, 0.9].map(f => q(num(r, 'gap_until_next_apply_s'), f)).join(' / '), '| same player again:', r.filter(x => x.next_holder_same === 1).length + '/' + r.filter(x => x.next_holder_same !== '').length);
    console.log('  split + Visions of Eternity lasted (s): p10/p50/p90', [0.1, 0.5, 0.9].map(f => q(num(r, 'split_and_visions_s'), f)).join(' / '));
    const o = seqs[phase + ' | ' + (g ? 'fixated' : 'nobody')]; console.log('  first casts (order of the first 5), top 3:'); Object.entries(o.order).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([k, n]) => console.log('    ×' + n + '  ' + k));
    console.log('  first time each skill is cast after the phase start (median s, n):', Object.entries(o.times).filter(([, v]) => v.length >= Math.max(3, o.n * 0.3)).sort((a, b) => q(a[1], 0.5) - q(b[1], 0.5)).map(([k, v]) => `${k} ${q(v, 0.5).toFixed(1)} (${v.length})`).join(' | ')); } }
