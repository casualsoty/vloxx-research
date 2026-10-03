// Stress test of the Excision Extremis strip lockout (FINDINGS §5e): "a hit strips boons + applies Crippled unless the player
// was hit by Excision less than 1.0 s earlier; every hit that lands restarts that 1.0 s".
// Independent of excision_strip.js: works on every single damage event, no csv. Checks:
//  A. the discriminating case: ≥ 1 s since the last STRIP but < 1 s since the last HIT (fixed-cooldown theory says strip, lockout theory says no)
//  B. uninterrupted chains of hits (every gap < 0.95 s): how many strips after the first one, by chain length / duration
//  C. the threshold: strip rate by gap since the previous landed hit, in 0.1 s bins
//  D. the exceptions on both sides, with what else was going on (other Excision skill, Echoing Blade, avoided hits, no boons)
//  E. per skill, per log and per player consistency; and whether hits of another skill restart the lockout
// "strip" is measured two ways: Crippled applied by the caster (721), and a boon stack removed by the caster (players with a boon only).
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw');
const EE = new Set([81053, 81326, 80901]); const NAME = { 81053: 'Vloxx 81053', 81326: 'Sword 81326', 80901: 'Vloxx last phase 80901' };
const BOONS = new Set([740, 725, 717, 718, 719, 873, 1122, 30328, 1187, 726, 743, 26980]);
const H = []; // every landed-hit group: {log, p, t, skill, crip, strip, hadBoon, gapHit, gapStrip, gapAvoid, gapOtherSkill, gapEB, chainIdx, chainStart}
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, ev } = parseEvtc(path.join(dir, f)); const isP = a => (agents.get(a) || {}).isPlayer;
  const all = ev.filter(e => EE.has(e.skill) && e.sc === 0 && e.buff === 0 && isP(e.dst) && !isP(e.src)); if (!all.length) continue;
  const casters = new Set(all.map(e => e.src));
  const crip = new Map(), rem = new Map(), boonEv = new Map(), eb = new Map();
  for (const e of ev) {
    if (e.sc === 69 && e.skill === 721 && isP(e.dst) && casters.has(e.src)) (crip.get(e.dst) || crip.set(e.dst, []).get(e.dst)).push(e.t);
    else if (e.sc === 69 && BOONS.has(e.skill) && isP(e.dst)) (boonEv.get(e.dst) || boonEv.set(e.dst, []).get(e.dst)).push(e);
    else if ((e.sc === 71 || e.sc === 72) && BOONS.has(e.skill) && isP(e.src)) { (boonEv.get(e.src) || boonEv.set(e.src, []).get(e.src)).push(e); if (casters.has(e.dst)) (rem.get(e.src) || rem.set(e.src, []).get(e.src)).push(e.t); }
    else if (e.sc === 0 && e.buff === 0 && e.skill === 81271 && isP(e.dst) && e.value > 0 && e.result <= 2) (eb.get(e.dst) || eb.set(e.dst, []).get(e.dst)).push(e.t);
  }
  const hadBoon = (p, t) => { const st = {}; for (const e of boonEv.get(p) || []) { if (e.t >= t - 30) break; if (e.sc === 69) (st[e.skill] = st[e.skill] || []).push(e.t + e.value); else if (e.sc === 71) { if (st[e.skill]) st[e.skill].shift(); } else st[e.skill] = []; } return Object.values(st).some(a => a.some(x => x > t)); };
  const per = new Map(); // player → groups of events within 100 ms (landed = any damaging normal/crit/glance event; else avoided)
  for (const e of all) { const a = per.get(e.dst) || per.set(e.dst, []).get(e.dst); const landed = e.value > 0 && e.result <= 2; let g = a.find(x => Math.abs(x.t - e.t) <= 100);
    if (!g) { g = { t: e.t, landed: false, skills: new Set(), n: 0 }; a.push(g); } g.landed = g.landed || landed; if (landed) { g.skills.add(e.skill); g.n++; } }
  for (const [p, a] of per) { a.sort((x, y) => x.t - y.t); let lastHit = null, lastStrip = null, lastAvoid = null, chainIdx = 0, chainStart = null; const lastBySkill = {};
    for (const g of a) { if (!g.landed) { lastAvoid = g.t; continue; }
      const near = arr => (arr || []).some(t => t >= g.t - 30 && t <= g.t + 130); const c = near(crip.get(p)), s = near(rem.get(p)); const skill = [...g.skills][0];
      const gapHit = lastHit == null ? null : (g.t - lastHit) / 1000; if (gapHit == null || gapHit >= 0.95) { chainIdx = 0; chainStart = g.t; } else chainIdx++;
      const other = Object.entries(lastBySkill).filter(([k]) => +k !== skill).map(([, t]) => (g.t - t) / 1000); const same = lastBySkill[skill] == null ? null : (g.t - lastBySkill[skill]) / 1000;
      const ebPrev = (eb.get(p) || []).filter(t => t < g.t - 30).pop();
      H.push({ log: f.replace('.zevtc', ''), p: p.toString(16), t: g.t, skill, crip: c, strip: s, hadBoon: hadBoon(p, g.t), gapHit, gapSame: same, gapOther: other.length ? Math.min(...other) : null,
        gapStrip: lastStrip == null ? null : (g.t - lastStrip) / 1000, gapAvoid: lastAvoid == null ? null : (g.t - lastAvoid) / 1000, gapEB: ebPrev == null ? null : (g.t - ebPrev) / 1000, chainIdx, chainLen: 0, chainDur: (g.t - chainStart) / 1000 });
      lastHit = g.t; lastBySkill[skill] = g.t; if (c || s) lastStrip = g.t; } }
}
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '—'; const line = (label, rows) => console.log('  ' + label.padEnd(66) + 'n ' + String(rows.length).padStart(5) + '   Crippled ' + pct(rows.filter(r => r.crip).length, rows.length).padStart(7) + '   boon stripped (had a boon) ' + pct(rows.filter(r => r.hadBoon && r.strip).length, rows.filter(r => r.hadBoon).length).padStart(7));
console.log(`landed Excision hits: ${H.length} in ${new Set(H.map(r => r.log)).size} logs, ${new Set(H.map(r => r.log + r.p)).size} player × log`);
console.log('\nA. Which clock matters? (hits with a previous strip on that player)');
line('≥ 1.0 s since last STRIP, but < 0.95 s since last HIT', H.filter(r => r.gapStrip != null && r.gapStrip >= 1.0 && r.gapHit != null && r.gapHit < 0.95));
line('≥ 1.0 s since last STRIP and ≥ 0.95 s since last HIT', H.filter(r => r.gapStrip != null && r.gapStrip >= 1.0 && r.gapHit != null && r.gapHit >= 0.95));
line('same, split: 1.0–2 s since last strip, hit < 0.95 s ago', H.filter(r => r.gapStrip >= 1.0 && r.gapStrip < 2 && r.gapHit < 0.95));
line('            2–4 s since last strip, hit < 0.95 s ago', H.filter(r => r.gapStrip >= 2 && r.gapStrip < 4 && r.gapHit != null && r.gapHit < 0.95));
line('            4+ s since last strip, hit < 0.95 s ago', H.filter(r => r.gapStrip >= 4 && r.gapHit != null && r.gapHit < 0.95));
console.log('\nB. Uninterrupted chains (every gap between hits < 0.95 s): position in the chain');
for (let i = 0; i <= 7; i++) line(`hit #${i + 1} of a chain${i === 0 ? ' (first hit after a gap ≥ 0.95 s, or first ever)' : ''}`, H.filter(r => r.chainIdx === i));
line('hit #9+ of a chain', H.filter(r => r.chainIdx >= 8));
const longest = Math.max(...H.map(r => r.chainDur)); const late = H.filter(r => r.chainIdx > 0 && r.chainDur >= 2);
console.log(`  longest chain: ${longest.toFixed(1)} s. Hits ≥ 2 s into a chain: ${late.length}, Crippled ${late.filter(r => r.crip).length}; ≥ 3 s: ${H.filter(r => r.chainIdx > 0 && r.chainDur >= 3).length}, Crippled ${H.filter(r => r.chainIdx > 0 && r.chainDur >= 3 && r.crip).length}`);
console.log('\nC. Threshold: gap since the previous landed hit (0.1 s bins)');
const bins = {}; H.filter(r => r.gapHit != null && r.gapHit < 3).forEach(r => { const k = (Math.floor(r.gapHit * 10) / 10).toFixed(1); (bins[k] = bins[k] || []).push(r); });
Object.keys(bins).sort((a, b) => a - b).forEach(k => { if (bins[k].length >= 8) line(k + '–' + (+k + 0.1).toFixed(1) + ' s', bins[k]); });
line('3 s or more', H.filter(r => r.gapHit != null && r.gapHit >= 3)); line('first hit of the fight', H.filter(r => r.gapHit == null));
console.log('\nD. Exceptions');
const viol = H.filter(r => r.gapHit != null && r.gapHit < 0.95 && r.crip); console.log(`  Crippled although hit < 0.95 s earlier: ${viol.length} of ${H.filter(r => r.gapHit != null && r.gapHit < 0.95).length}` + (viol.length ? ' → ' + viol.slice(0, 8).map(r => `${r.log} gap ${r.gapHit.toFixed(2)} s (${NAME[r.skill]})`).join('; ') : ''));
const miss = H.filter(r => r.gapHit != null && r.gapHit >= 0.95 && !r.crip); const tot = H.filter(r => r.gapHit != null && r.gapHit >= 0.95);
console.log(`  NOT Crippled although the last hit was ≥ 0.95 s earlier: ${miss.length} of ${tot.length} (${pct(miss.length, tot.length)})`);
const why = r => r.gapEB != null && r.gapEB < 0.95 ? 'Echoing Blade hit < 0.95 s before' : r.gapHit < 1.05 ? 'gap 0.95–1.05 s (borderline)' : 'unexplained';
const w = {}; miss.forEach(r => { const k = why(r); w[k] = (w[k] || 0) + 1; }); console.log('    ', JSON.stringify(w));
line('  for comparison — hits ≥ 0.95 s after the last Excision hit, Echoing Blade hit < 0.95 s before', tot.filter(r => r.gapEB != null && r.gapEB < 0.95));
line('  gap ≥ 1.05 s and no Echoing Blade hit in the last 0.95 s', tot.filter(r => r.gapHit >= 1.05 && !(r.gapEB != null && r.gapEB < 0.95)));
console.log('\nE. Consistency');
for (const sk of [81053, 81326, 80901]) { line(`${NAME[sk]}: hit < 0.95 s after the previous one`, H.filter(r => r.skill === sk && r.gapHit != null && r.gapHit < 0.95)); line(`${NAME[sk]}: hit ≥ 0.95 s after the previous one`, H.filter(r => r.skill === sk && r.gapHit != null && r.gapHit >= 0.95)); }
line('previous hit < 0.95 s ago was from the OTHER caster only (same skill ≥ 0.95 s or never)', H.filter(r => r.gapOther != null && r.gapOther < 0.95 && (r.gapSame == null || r.gapSame >= 0.95)));
const logs = [...new Set(H.map(r => r.log))]; let okLogs = 0; const badLogs = []; for (const l of logs) { const r = H.filter(x => x.log === l && x.gapHit != null); const a = r.filter(x => x.gapHit < 0.95), b = r.filter(x => x.gapHit >= 1.05);
  const fa = a.filter(x => x.crip).length / Math.max(1, a.length), fb = b.filter(x => x.crip).length / Math.max(1, b.length); if (fa <= 0.03 && (b.length < 5 || fb >= 0.7)) okLogs++; else badLogs.push(`${l} (<0.95 s: ${a.filter(x => x.crip).length}/${a.length}, ≥1.05 s: ${b.filter(x => x.crip).length}/${b.length})`); }
console.log(`  logs where the rule holds (≤ 3 % Crippled under 0.95 s and ≥ 70 % at ≥ 1.05 s): ${okLogs} of ${logs.length}` + (badLogs.length ? '\n    others: ' + badLogs.join('; ') : ''));
const players = {}; H.filter(r => r.gapHit != null).forEach(r => { const k = r.log.slice(0, 8) + r.p; const o = (players[k] = players[k] || [0, 0, 0, 0]); if (r.gapHit < 0.95) { o[0]++; if (r.crip) o[1]++; } else if (r.gapHit >= 1.05) { o[2]++; if (r.crip) o[3]++; } });
const pv = Object.values(players); console.log(`  player × day: ${pv.length}; with any Crippled under 0.95 s: ${pv.filter(o => o[1] > 0).length}; with ≥ 5 hits at ≥ 1.05 s and < 70 % Crippled: ${pv.filter(o => o[2] >= 5 && o[3] / o[2] < 0.7).length}`);
