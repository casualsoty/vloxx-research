// Last phase: does Vloxx's Raging Storm (the spears falling from the sky, damage skill 81176) fall more often while an Aspect is alive?
// Every impact is announced by ground effect GUID D1132020… (3 s) spawned by Vloxx. For every second of the last phase (from the start
// of channel 81071): number of those effects, whether each Aspect is alive (an agent of its species exists and has not died or
// despawned), players up. The Spear Aspect's own attack (Thousand Strikes, 80709) is counted separately.
// Writes data/raging_storm_last_phase.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const ASP = { Staff: 28017, Spear: 28033, Sword: 28107 };
const sec = [], waves = []; let logs = 0, tsHitsAlive = 0, tsHitsDead = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const boss = [...agents.values()].find(a => a.species === 28106); if (!boss) continue; const lc = ev.find(e => e.sc === 67 && e.src === boss.addr && e.skill === 81071); if (!lc) continue; logs++;
  const gid = new Map(); for (const e of ev) if (e.sc === 46) { const b = Buffer.alloc(16); b.writeBigUInt64LE(e.src, 0); b.writeBigUInt64LE(e.dst, 8); gid.set(e.skill, b.toString('hex').toUpperCase().slice(0, 8)); }
  const end = ev[ev.length - 1].t; const life = new Map(), firstSeen = new Map(); for (const e of ev) { if (e.src && !firstSeen.has(e.src)) firstSeen.set(e.src, e.t); if ([3, 4, 5, 7].includes(e.sc)) (life.get(e.src) || life.set(e.src, []).get(e.src)).push([e.t, e.sc]); }
  const alive = (sp, t) => [...agents.values()].some(a => a.species === sp && (firstSeen.get(a.addr) ?? Infinity) <= t && !(life.get(a.addr) || []).some(([tt, sc]) => (sc === 4 || sc === 7) && tt <= t));
  const up = t => [...agents.values()].filter(a => a.isPlayer).filter(a => { let s = 3; for (const x of life.get(a.addr) || []) { if (x[0] > t) break; if ([3, 4, 5].includes(x[1])) s = x[1]; } return s === 3; }).length;
  const fx = ev.filter(e => e.sc === 60 && e.src === boss.addr && gid.get(e.skill) === 'D1132020' && e.t >= lc.t).map(e => e.t);
  // waves: effects spawned within 150 ms of each other (one wave every 3 s)
  { let w = null; for (const t of fx) { if (w && t - w.t < 150) w.n++; else { w = { t, n: 1, log: f, slot: Math.round((t - lc.t) / 3000) * 3, Staff: alive(ASP.Staff, t), Spear: alive(ASP.Spear, t), Sword: alive(ASP.Sword, t), up: up(t) }; waves.push(w); } } }
  for (let t = lc.t; t + 1000 <= end; t += 1000) sec.push({ dt: Math.floor((t - lc.t) / 1000), n: fx.filter(x => x >= t && x < t + 1000).length, Staff: alive(ASP.Staff, t), Spear: alive(ASP.Spear, t), Sword: alive(ASP.Sword, t), up: up(t) });
  for (const e of ev) if (e.sc === 0 && !e.buff && e.skill === 80709 && e.t >= lc.t && (agents.get(e.dst) || {}).isPlayer) { if (alive(ASP.Spear, e.t - 1500)) tsHitsAlive++; else tsHitsDead++; }
}
const rate = flt => { const x = sec.filter(flt); return { seconds: x.length, perSecond: x.length ? +(x.reduce((s, r) => s + r.n, 0) / x.length).toFixed(2) : null }; };
const wv = flt => { const x = waves.filter(flt); const d = {}; x.forEach(w => d[w.n] = (d[w.n] || 0) + 1); const sm = x.filter(w => w.n === 2 || w.n === 3); return { waves: x.length, spearsPerWave: x.length ? +(x.reduce((s, w) => s + w.n, 0) / x.length).toFixed(2) : null, sizes: d, singleSetsOf2Pct: sm.length ? Math.round(100 * sm.filter(w => w.n === 2).length / sm.length) : null }; };
// the sequence: wave size at each 3 s slot of the phase, over the logs
const slots = [...new Set(waves.map(w => w.slot))].sort((a, b) => a - b); const sequence = slots.map(sl => { const x = waves.filter(w => w.slot === sl); const d = {}; x.forEach(w => d[w.n] = (d[w.n] || 0) + 1); const top = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
  const k = (sl - 15) / 3; const double = k >= 4 && Math.floor((k - 4) / 2) % 2 === 0; return { atS: sl, logs: x.length, kind: double ? 'double' : 'single', usual: +top[0], usualLogs: top[1], sizes: d }; }).filter(r => r.logs >= 4);
const singles = waves.filter(w => { const k = (w.slot - 15) / 3; return !(k >= 4 && Math.floor((k - 4) / 2) % 2 === 0); }); const byUp = {}; singles.forEach(w => { const o = (byUp[w.up] = byUp[w.up] || { waves: 0, three: 0, two: 0, other: 0 }); o.waves++; if (w.n === 3) o.three++; else if (w.n === 2) o.two++; else o.other++; });
const summary = { logs, sequence, singleWaveSizeByPlayersUp: byUp, waves: { all: wv(() => true), byAspect: Object.fromEntries(Object.keys(ASP).map(a => [a, { alive: wv(w => w[a]), dead: wv(w => !w[a]) }])), spearWithAllPlayersUp: { alive: wv(w => w.up === 10 && w.Spear), dead: wv(w => w.up === 10 && !w.Spear) } }, seconds: sec.length, impactsPerSecond: rate(() => true).perSecond, byAspect: Object.fromEntries(Object.keys(ASP).map(a => [a, { alive: rate(s => s[a]), dead: rate(s => !s[a]) }])),
  spearByTimeWindow: [[0, 15], [15, 30], [30, 45], [45, 60], [60, 200]].map(([a, b]) => ({ fromS: a, toS: b, alive: rate(s => s.dt >= a && s.dt < b && s.Spear), dead: rate(s => s.dt >= a && s.dt < b && !s.Spear) })),
  spearWithAllPlayersUp: { alive: rate(s => s.up === 10 && s.Spear), dead: rate(s => s.up === 10 && !s.Spear) }, thousandStrikesHits: { spearAlive: tsHitsAlive, spearDead: tsHitsDead } };
fs.writeFileSync(path.join(ROOT, 'data', 'raging_storm_last_phase.json'), JSON.stringify(summary, null, 1));
console.log(`${logs} logs, ${sec.length} s of last phase, ${summary.impactsPerSecond} Raging Storm impacts per second`); for (const [a, v] of Object.entries(summary.byAspect)) console.log(`  ${a}: alive ${v.alive.perSecond}/s (${v.alive.seconds} s) | dead ${v.dead.perSecond}/s (${v.dead.seconds} s)`);
for (const w of summary.spearByTimeWindow) console.log(`  ${w.fromS}-${w.toS} s: Spear alive ${w.alive.perSecond}/s (${w.alive.seconds} s) | dead ${w.dead.perSecond}/s (${w.dead.seconds} s)`); for (const [a, v] of Object.entries(summary.waves.byAspect)) console.log(`  waves, ${a}: alive ${v.alive.spearsPerWave} per wave (${v.alive.waves}, ${v.alive.singleSetsOf2Pct} % of single sets are 2) | dead ${v.dead.spearsPerWave} (${v.dead.waves}, ${v.dead.singleSetsOf2Pct} %)`); console.log('  wave sizes:', JSON.stringify(summary.waves.all.sizes));
console.log('  sequence:', sequence.map(r => `${r.atS}s:${r.usual}${r.kind === 'double' ? 'D' : ''}(${r.usualLogs}/${r.logs})`).join(' ')); console.log('  single wave size by players up:', JSON.stringify(byUp));
console.log('  Thousand Strikes hits:', JSON.stringify(summary.thousandStrikesHits));
