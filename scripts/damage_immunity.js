// What still damages Vloxx while it has "Damage Immunity" (buff 80608)? From raw logs.
// Windows = from an application of buff 80608 on Vloxx (statechange 69) to its removal (71/72) or natural end; overlapping
// applications are merged. For every window: Vloxx's health at the start and at the end, and every damage event on Vloxx inside it
// (direct hits: value; buff/condition ticks: buffDmg), grouped by skill, with how many of them did 0.
// Breakbar damage (result 10) is left out.
// Writes data/damage_immunity.csv (one row per window × skill that did damage) and data/damage_immunity_summary.json.
const fs = require('fs'), path = require('path');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const dir = path.join(ROOT, 'logs', 'raw'); const IMM = 80608;
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
const rows = [], wins = [], bySkill = new Map(); let logs = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const { agents, skills, ev } = parseEvtc(path.join(dir, f)); const boss = [...agents.values()].find(a => a.species === 28106); const s9 = ev.find(e => e.sc === 9); if (!boss || !s9) continue;
  const last = ev[ev.length - 1].t; const hp = ev.filter(e => e.sc === 8 && e.src === boss.addr).map(e => [e.t, Number(e.dst) / 100]); const hpAt = t => { let r = 100; for (const x of hp) { if (x[0] > t) break; r = x[1]; } return r; };
  // immunity windows
  const iv = []; let open = null, natural = 0;
  for (const e of ev) { if (e.skill !== IMM) continue; if (e.sc === 69 && e.dst === boss.addr) { if (open == null) open = e.t; natural = Math.max(natural, e.value > 2e9 ? Infinity : e.t + e.value); }
    // 72 = all stacks removed; a 71 at the ms of a re-application is only a stack being replaced
    else if (e.sc === 72 && e.src === boss.addr && open != null) { iv.push([open, Math.min(e.t, natural)]); open = null; natural = 0; } }
  if (open != null) iv.push([open, Math.min(last, natural)]); if (!iv.length) continue; logs++;
  const merged = []; for (const w of iv.sort((a, b) => a[0] - b[0])) { const m = merged[merged.length - 1]; if (m && w[0] - m[1] < 500) m[1] = Math.max(m[1], w[1]); else merged.push(w.slice()); }
  for (const [a, b] of merged) { if (b - a < 1000) continue; const hp0 = hpAt(a), hp1 = hpAt(b); const win = { log: f.replace('.zevtc', ''), start_s: +((a - s9.t) / 1000).toFixed(1), duration_s: +((b - a) / 1000).toFixed(1), hp_start: +hp0.toFixed(2), hp_end: +hp1.toFixed(2), threshold: hp0 > 55 ? '70 %' : hp0 > 25 ? '40 %' : '10 %', through: 0 }; const sk = new Map();
    for (const e of ev) { if (e.sc !== 0 || e.dst !== boss.addr || e.t < a + 100 || e.t >= b || e.result === 10) continue; const dmg = e.buff ? e.buffDmg : e.value; const name = skills.get(e.skill) || String(e.skill); const kind = e.buff ? 'buff tick' : 'direct hit';
      const k = e.skill + '|' + kind; const o = sk.get(k) || sk.set(k, { skill: name, skill_id: e.skill, kind, events: 0, zero: 0, damage: 0 }).get(k); o.events++; if (dmg > 0) o.damage += dmg; else o.zero++; }
    for (const o of sk.values()) { const g = bySkill.get(o.skill_id + '|' + o.kind) || bySkill.set(o.skill_id + '|' + o.kind, { skill: o.skill, skill_id: o.skill_id, kind: o.kind, windows: 0, events: 0, zero: 0, damage: 0 }).get(o.skill_id + '|' + o.kind);
      g.windows++; g.events += o.events; g.zero += o.zero; g.damage += o.damage; if (o.damage > 0) { win.through += o.damage; rows.push({ log: win.log, window_start_s: win.start_s, threshold: win.threshold, skill: o.skill, skill_id: o.skill_id, kind: o.kind, events: o.events, events_with_damage: o.events - o.zero, damage: o.damage }); } }
    wins.push(win); }
}
const all = [...bySkill.values()]; const works = all.filter(g => g.damage > 0).sort((a, b) => b.damage - a.damage); const blocked = all.filter(g => g.damage === 0 && g.events >= 50).sort((a, b) => b.events - a.events);
const summary = { logs, windows: wins.length, byThreshold: {}, worksThrough: works.map(g => ({ ...g, damagePerEvent: Math.round(g.damage / (g.events - g.zero)), passPct: Math.round(100 * (g.events - g.zero) / g.events) })),
  fullyBlocked: { directHits: { events: blocked.filter(g => g.kind === 'direct hit').reduce((s, g) => s + g.events, 0), skills: blocked.filter(g => g.kind === 'direct hit').length }, buffTicks: blocked.filter(g => g.kind === 'buff tick').map(g => ({ skill: g.skill, skill_id: g.skill_id, events: g.events })) } };
for (const th of ['70 %', '40 %', '10 %']) { const w = wins.filter(x => x.threshold === th); if (!w.length) continue; summary.byThreshold[th] = { windows: w.length, durationS: { median: med(w.map(x => x.duration_s)), min: Math.min(...w.map(x => x.duration_s)), max: Math.max(...w.map(x => x.duration_s)) },
  windowsWithDamageThrough: w.filter(x => x.through > 0).length, damageThrough: { median: med(w.filter(x => x.through > 0).map(x => x.through)), max: Math.max(0, ...w.map(x => x.through)) }, healthLostPct: { median: +med(w.map(x => x.hp_start - x.hp_end)).toFixed(2), max: +Math.max(...w.map(x => x.hp_start - x.hp_end)).toFixed(2) } }; }
if (rows.length) { const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'damage_immunity.csv'), [H.join(','), ...rows.map(r => H.map(k => String(r[k]).replace(/,/g, ';')).join(','))].join('\n')); }
fs.writeFileSync(path.join(ROOT, 'data', 'damage_immunity_summary.json'), JSON.stringify(summary, null, 1));
console.log(`${logs} logs, ${wins.length} immunity windows`); for (const [k, v] of Object.entries(summary.byThreshold)) console.log(' ', k, JSON.stringify(v));
console.log('damage that went through:'); for (const g of summary.worksThrough) console.log('  ', `${g.skill} (${g.skill_id}) ${g.kind}`.padEnd(46), `windows ${g.windows}, events ${g.events}, with damage ${g.events - g.zero} (${g.passPct} %), total ${g.damage}, per event ${g.damagePerEvent}`);
console.log('fully blocked: direct hits', JSON.stringify(summary.fullyBlocked.directHits), '| buff ticks:', summary.fullyBlocked.buffTicks.map(g => `${g.skill} ×${g.events}`).join(', '));
