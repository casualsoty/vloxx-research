// Recomputes the headline conclusions from data/*.csv.  Run after build_dataset.js:  node scripts/key_checks.js
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', 'data');
function read(name) { const [h, ...rows] = fs.readFileSync(path.join(D, name), 'utf8').trim().split('\n'); const H = h.split(','); return rows.map(r => { const v = []; let cur = '', q = false; for (const c of r) { if (c === '"') q = !q; else if (c === ',' && !q) { v.push(cur); cur = ''; } else cur += c; } v.push(cur); return Object.fromEntries(H.map((k, i) => [k, v[i]])); }); }
const G = read('green_rounds.csv'), F = read('fixation_applications.csv'), T = read('fixation_last_phase_ticks.csv'), O = read('ascension_orbs.csv'), A = read('aspect_events.csv'), PD = read('probability_distribution_last_phase.csv');

console.log('1) Green count = min(3, floor(players_up/3)) when someone is fixated');
const fixRounds = G.filter(r => r.fixated_player && !(r.phase === 'early' && +r.time_s < 10));
console.log('   rounds with a fixated player (excluding fight start):', fixRounds.length, ' matching:', fixRounds.filter(r => +r.greens === Math.max(1, +r.expected_floor_up_div3)).length);

console.log('2) Fight-start green round = only the fixated player (others far away):');
const start = G.filter(r => r.phase === 'early' && +r.time_s < 10); console.log('   ', start.map(r => r.log_id.slice(-12) + ':' + r.greens).join('  '));

console.log('3) Last-phase rounds with NOBODY fixated:');
for (const r of G.filter(r => r.phase === 'last' && !r.fixated_player)) console.log(`   ${r.log_id.padEnd(45)} +${r.last_phase_tick_s}s up=${r.players_up} expected=${r.expected_floor_up_div3} greens=${r.greens}  PD=${r.probability_distribution_targets_same_instant}`);

console.log('4) "Timing bug": Fixated applied at the +2.5s tick and held the full 60s  ->  +63s round');
for (const t of T.filter(t => t.tick_s === '2.5' && t.result === 'APPLIED')) {
  const span = F.find(f => f.log_id === t.log_id && f.phase.startsWith('last+2.') && f.player === t.new_holder);
  const r63 = G.find(r => r.log_id === t.log_id && r.phase === 'last' && r.last_phase_tick_s === '63');
  const full = span && span.end_cause === 'expired';
  console.log(`   ${t.log_id.padEnd(45)} holder ${t.new_holder.padEnd(22)} held ${span ? span.held_s : '?'}s (${span ? span.end_cause : '?'}) -> +63s greens: ${r63 ? r63.greens + ' (normal ' + r63.expected_floor_up_div3 + ')' : 'fight ended'} ${full && r63 ? '  <== BUG CASE' : ''}`);
}

console.log('5) Last-phase Fixated ticks with nobody holding it:');
const tk = {}; for (const t of T.filter(t => t.result !== 'held')) { const k = '+' + t.tick_s + 's after ' + (t.previous_end_cause || 'none'); tk[k] = tk[k] || { APPLIED: 0, SKIPPED: 0 }; tk[k][t.result]++; }
for (const [k, v] of Object.entries(tk).sort()) console.log('   ', k.padEnd(24), JSON.stringify(v));

console.log('6) Boss-phase re-application gap after Fixated ends (s), by cause (gap>12s = skipped a cycle):');
for (const c of ['expired', 'stealth', 'down']) { const g = F.filter(f => f.previous_end_cause === c && f.gap_since_previous_end_s && !f.phase.startsWith('last') && !f.phase.startsWith('Split')).map(f => +f.gap_since_previous_end_s).filter(x => x < 30); g.sort((a, b) => a - b); console.log('   ', c.padEnd(8), 'n=' + g.length, 'median', g[Math.floor(g.length / 2)], ' >12s:', g.filter(x => x > 12).length); }

console.log('7) Probability Distribution count = max(1,floor(up/3)):', PD.filter(p => +p.targets === +p.expected).length + '/' + PD.length);

console.log('8) Ascension orbs:', O.filter(o => o.outcome.startsWith('EXPIRED')).length, 'expired at 120s;', O.filter(o => o.outcome === 'picked up').length, 'picked up;', O.filter(o => o.outcome.startsWith('no end')).length, 'unresolved');
const br = A.filter(a => a.event === 'breakbar_broken'); console.log('   Aspect breakbar breaks followed by orbs ~2s later:', br.filter(a => a['respawn_after_s (death) / first_orb_after_s (breakbar_broken)'] !== 'no orbs').length + '/' + br.length);
const de = A.filter(a => a.event === 'death' && a['respawn_after_s (death) / first_orb_after_s (breakbar_broken)']);
const rs = {}; de.forEach(a => { const k = a.aspect; rs[k] = rs[k] || []; rs[k].push(+a['respawn_after_s (death) / first_orb_after_s (breakbar_broken)']); });
console.log('9) Aspect respawn after death:', Object.entries(rs).map(([k, v]) => k + ' n=' + v.length + ' ' + Math.min(...v) + '-' + Math.max(...v) + 's').join(' | '));
// 10) orb throws (data/orb_throws.csv from scripts/orb_throws.js): the Aspect throws 3 missiles (skill 80520) at the CC
if (fs.existsSync(path.join(D, 'orb_throws.csv'))) {
  const OT = read('orb_throws.csv'); const nt = OT.filter(r => r.throw_missiles_80520 === '0');
  console.log('10) Orb throws on Aspect CC:', (OT.length - nt.length) + '/' + OT.length, 'thrown; not thrown:', nt.map(r => `${r.log_id}@${r.break_s} ${r.aspect}`).join(', ') || '-');
}
// 11) +63 s overlap: green + PD on the same player, by whether someone is fixated at +63 s
{
  const t = {}; for (const p of PD) { if (p.last_phase_tick_s !== '63') continue; const g = G.find(r => r.log_id === p.log_id && r.phase === 'last' && Math.abs(+r.time_s - +p.time_s) < 1); if (!g) continue;
    const both = g.green_targets_in_order.split(' > ').filter(x => x && p.target_names.split(' | ').includes(x)); const k = g.fixated_player ? 'fixated' : 'nobody fixated';
    t[k] = t[k] || { n: 0, overlap: 0, overlapIsFixated: 0 }; t[k].n++; if (both.length) { t[k].overlap++; if (both.every(x => x === g.fixated_player)) t[k].overlapIsFixated++; } }
  console.log('11) +63 s green+PD overlap:', Object.entries(t).map(([k, v]) => `${k}: ${v.overlap}/${v.n} rounds (overlap player = fixated ${v.overlapIsFixated}/${v.overlap})`).join(' | '));
}
