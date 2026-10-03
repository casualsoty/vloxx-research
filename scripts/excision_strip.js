// Excision Extremis (81053 Vloxx, 81326 Aspect of the Sword, 80901 Vloxx last phase): boon strip / Crippled / Bleeding per hit
// and the internal cooldown (ICD) between strips on the same player. From raw logs.
// A "hit" = damaging events (result normal/crit/glance, value > 0) of the skill on one player within 100 ms.
// stripped = n boons removed from that player by the caster within ±30 ms (statechange 71 single stack / 72 all stacks, dst = remover).
// Boon presence is tracked from buff apply (69) / remove (71, 72) so "no strip" is only counted when the player had a boon.
// Writes data/excision_strip.csv (one row per hit).
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw');
const EE = new Set([81053, 81326, 80901]);
const BOONS = { 740: 'Might', 725: 'Fury', 717: 'Protection', 718: 'Regeneration', 719: 'Swiftness', 873: 'Resolution', 1122: 'Stability', 30328: 'Alacrity', 1187: 'Quickness', 726: 'Vigor', 743: 'Aegis', 26980: 'Resistance' };
const rows = [];
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const s9 = ev.find(e => e.sc === 9); if (!s9) continue;
  const isP = a => (agents.get(a) || {}).isPlayer; const hs = ev.filter(e => EE.has(e.skill) && e.sc === 0 && e.buff === 0 && isP(e.dst) && e.value > 0 && e.result <= 2); if (!hs.length) continue;
  const casters = new Set(hs.map(e => e.src));
  // per player: boon events (for presence) and enemy removals / condition applies indexed by time
  const boonEv = new Map(), rem = new Map(), cond = new Map();
  for (const e of ev) {
    if (e.sc === 69 && BOONS[e.skill] && isP(e.dst)) (boonEv.get(e.dst) || boonEv.set(e.dst, []).get(e.dst)).push(e);
    else if ((e.sc === 71 || e.sc === 72) && BOONS[e.skill] && isP(e.src)) { (boonEv.get(e.src) || boonEv.set(e.src, []).get(e.src)).push(e); if (casters.has(e.dst)) (rem.get(e.src) || rem.set(e.src, []).get(e.src)).push(e); }
    else if (e.sc === 69 && (e.skill === 721 || e.skill === 736) && isP(e.dst) && casters.has(e.src)) (cond.get(e.dst) || cond.set(e.dst, []).get(e.dst)).push(e);
  }
  const boonsAt = (p, t) => { const st = {}; for (const e of boonEv.get(p) || []) { if (e.t >= t - 30) break; const b = e.skill; if (e.sc === 69) { (st[b] = st[b] || []).push(e.t + e.value); } else if (e.sc === 71) { if (st[b]) st[b].shift(); } else st[b] = []; }
    return Object.entries(st).filter(([, a]) => a.some(x => x > t)).map(([b]) => BOONS[b]); };
  // group hits per player (100 ms)
  const groups = []; for (const e of hs) { const g = groups.find(x => x.p === e.dst && x.skill === e.skill && Math.abs(x.t - e.t) <= 100); if (g) { g.n++; g.dmg += e.value; } else groups.push({ p: e.dst, t: e.t, skill: e.skill, n: 1, dmg: e.value }); }
  groups.sort((a, b) => a.t - b.t); const lastStrip = new Map(), lastCrip = new Map(), lastHit = new Map();
  for (const g of groups) {
    const near = a => (a || []).filter(e => Math.abs(e.t - g.t) <= 130 && e.t >= g.t - 30);
    const r = near(rem.get(g.p)); const stripped = [...new Set(r.map(e => BOONS[e.skill]))]; const c = near(cond.get(g.p));
    const crip = c.some(e => e.skill === 721), bleed = c.some(e => e.skill === 736); const had = boonsAt(g.p, g.t);
    rows.push({ log: f.replace('.zevtc', ''), t: ((g.t - s9.t) / 1000).toFixed(3), skill: g.skill, damage: g.dmg, boons_before: had.length, stripped: stripped.length, stripped_boons: stripped.join('+'),
      crippled: crip ? 1 : 0, bleeding: bleed ? 1 : 0, since_last_hit_s: lastHit.has(g.p) ? ((g.t - lastHit.get(g.p)) / 1000).toFixed(3) : '', since_last_strip_s: lastStrip.has(g.p) ? ((g.t - lastStrip.get(g.p)) / 1000).toFixed(3) : '',
      since_last_cripple_s: lastCrip.has(g.p) ? ((g.t - lastCrip.get(g.p)) / 1000).toFixed(3) : '' });
    lastHit.set(g.p, g.t); if (stripped.length) lastStrip.set(g.p, g.t); if (crip) lastCrip.set(g.p, g.t);
  }
}
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'excision_strip.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '-';
console.log('Excision Extremis hits (damaging, grouped per player):', rows.length);
for (const sk of [81053, 81326, 80901]) { const r = rows.filter(x => x.skill === sk); if (!r.length) continue; const wb = r.filter(x => x.boons_before > 0);
  console.log(` ${sk}: hits ${r.length} | had ≥1 boon ${wb.length} → stripped ${pct(wb.filter(x => x.stripped).length, wb.length)} | Crippled ${pct(r.filter(x => x.crippled).length, r.length)} | Bleeding ${pct(r.filter(x => x.bleeding).length, r.length)} | boons removed per strip: ${JSON.stringify(r.filter(x => x.stripped).reduce((o, x) => (o[x.stripped] = (o[x.stripped] || 0) + 1, o), {}))}`); }
const bins = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 10, 1e9];
const table = (key, flag, onlyBoons) => { console.log(`\n${flag} vs time since the previous ${key.includes('strip') ? 'strip' : 'Crippled'} on the same player${onlyBoons ? ' (hits where the player had a boon)' : ''}:`);
  const first = rows.filter(x => x[key] === '' && (!onlyBoons || x.boons_before > 0)); console.log(`  first (no previous)   n ${String(first.length).padStart(5)}  ${flag} ${pct(first.filter(x => x[flag]).length, first.length)}`);
  for (let i = 1; i < bins.length; i++) { const r = rows.filter(x => x[key] !== '' && +x[key] >= bins[i - 1] && +x[key] < bins[i] && (!onlyBoons || x.boons_before > 0)); if (!r.length) continue;
    console.log(`  ${String(bins[i - 1]).padStart(4)}–${bins[i] > 1e8 ? '∞  ' : String(bins[i]).padEnd(3)} s          n ${String(r.length).padStart(5)}  ${flag} ${pct(r.filter(x => x[flag]).length, r.length)}`); } };
table('since_last_strip_s', 'stripped', true); table('since_last_cripple_s', 'crippled', false);
const q = (a, f) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : null; };
const ns = rows.filter(x => x.boons_before > 0 && !x.stripped && x.since_last_strip_s !== '').map(x => +x.since_last_strip_s); const ys = rows.filter(x => x.stripped && x.since_last_strip_s !== '').map(x => +x.since_last_strip_s);
console.log(`\nnon-strips (player had a boon, a previous strip exists): n ${ns.length}, time since previous strip min ${q(ns, 0)} / p50 ${q(ns, 0.5)} / p95 ${q(ns, 0.95)} / p99 ${q(ns, 0.99)} / max ${q(ns, 1)} s`);
console.log(`strips: n ${ys.length}, time since previous strip min ${q(ys, 0)} / p1 ${q(ys, 0.01)} / p5 ${q(ys, 0.05)} / p50 ${q(ys, 0.5)} s`);
const nc = rows.filter(x => !x.crippled && x.since_last_cripple_s !== '').map(x => +x.since_last_cripple_s), yc = rows.filter(x => x.crippled && x.since_last_cripple_s !== '').map(x => +x.since_last_cripple_s);
console.log(`non-cripples: n ${nc.length}, since previous Crippled min ${q(nc, 0)} / p50 ${q(nc, 0.5)} / p95 ${q(nc, 0.95)} / p99 ${q(nc, 0.99)} / max ${q(nc, 1)} s | cripples: n ${yc.length}, min ${q(yc, 0)} / p1 ${q(yc, 0.01)} / p5 ${q(yc, 0.05)} s`);

// The actual rule: a 1.0 s lockout restarted by every hit that LANDS (blocked / evaded / invulnerable hits don't restart it).
// → strip + Crippled rate by time since that player's previous damaging Excision hit of any kind.
{
  const b = {}; rows.filter(x => x.since_last_hit_s !== '').forEach(x => { const g = +x.since_last_hit_s; const k = g < 0.95 ? 'under 1.0 s' : g < 3 ? '1.0–3 s' : g < 8 ? '3–8 s' : '8 s or more'; (b[k] = b[k] || [0, 0, 0])[0]++; if (x.crippled) b[k][1]++; if (x.stripped) b[k][2]++; });
  console.log('\nstrip + Crippled vs time since the player\'s previous Excision hit that landed (any hit, stripping or not):');
  for (const k of ['under 1.0 s', '1.0–3 s', '3–8 s', '8 s or more']) if (b[k]) console.log(`  ${k.padEnd(12)} n ${String(b[k][0]).padStart(5)}  Crippled ${pct(b[k][1], b[k][0]).padStart(7)}  boons stripped ${pct(b[k][2], b[k][0]).padStart(7)}`);
  const first = rows.filter(x => x.since_last_hit_s === ''); console.log(`  first hit    n ${String(first.length).padStart(5)}  Crippled ${pct(first.filter(x => x.crippled).length, first.length).padStart(7)}  boons stripped ${pct(first.filter(x => x.stripped).length, first.length).padStart(7)}`);
  fs.writeFileSync(path.join(ROOT, 'data', 'excision_strip_summary.json'), JSON.stringify({ hits: rows.length, lockoutS: 1.0,
    bySinceLastHit: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, { n: v[0], crippledPct: +(100 * v[1] / v[0]).toFixed(1), strippedPct: +(100 * v[2] / v[0]).toFixed(1) }])),
    firstHit: { n: first.length, crippledPct: +(100 * first.filter(x => x.crippled).length / first.length).toFixed(1) } }, null, 1));
}
