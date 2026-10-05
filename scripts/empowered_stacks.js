// "Empowered" (buff 81002) on Vloxx: how many stacks it has when it dies, on every CM kill, and at the 70 / 40 / 10 % thresholds.
// Elite Insights JSON (logs/ei): the buff's state list on the target (time, stacks); the value just before the kill.
// Raw kills (logs/raw): stacks counted from the buff events on Vloxx: +1 per application (statechange 69), −1 per single removal (71),
// 0 on "all stacks removed" (72); the value 0.3 s before Vloxx dies. Raw times are given as Elite Insights counts them (log time − 3 s).
// Writes data/empowered_stacks.csv (one row per kill) and data/empowered_stacks.json.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs', 'sources.json'), 'utf8')); const EMP = 81002; const rows = [];
for (const f of fs.readdirSync(path.join(ROOT, 'logs', 'ei')).sort()) { let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'logs', 'ei', f)))); } catch (e) { continue; }
  if (!j.success || !j.targets || !(j.targets[0].totalHealth > 70e6)) continue; const id = f.replace('.json.gz', ''); const st = ((j.targets[0].buffs || []).find(b => b.id === EMP) || { states: [] }).states;
  const at = t => { let v = 0; for (const s of st) { if (s[0] > t) break; v = s[1]; } return v; }; const ph = n => (j.phases.find(p => p.name === n) || {}).start;
  rows.push({ log: id, source: 'EI', url: URLS[id] || '', kill_time_s: Math.round(j.durationMS / 1000), stacks_at_kill: at(j.durationMS - 300), highest: Math.max(0, ...st.map(s => s[1])), at_70: ph('Split 1') != null ? at(ph('Split 1')) : '', at_40: ph('Split 2') != null ? at(ph('Split 2')) : '', at_10: ph('Split 3') != null ? at(ph('Split 3')) : '', at_last_phase_start: ph('Final Form Phase') != null ? at(ph('Final Form Phase')) : '' }); }
for (const f of fs.readdirSync(path.join(ROOT, 'logs', 'raw')).sort()) {
  const { agents, ev } = parseEvtc(path.join(ROOT, 'logs', 'raw', f)); const boss = [...agents.values()].find(a => a.species === 28106); const s9 = ev.find(e => e.sc === 9); if (!boss || !s9) continue; const dead = ev.find(e => e.sc === 4 && e.src === boss.addr); if (!dead) continue; const id = f.replace('.zevtc', '');
  const tl = []; let n = 0; for (const e of ev) { if (e.skill !== EMP) continue; if (e.sc === 69 && e.dst === boss.addr) n++; else if (e.sc === 71 && e.src === boss.addr) n = Math.max(0, n - 1); else if (e.sc === 72 && e.src === boss.addr) n = 0; else continue; tl.push([e.t, n]); }
  const at = t => { let v = 0; for (const s of tl) { if (s[0] > t) break; v = s[1]; } return v; }; const cast = sk => (ev.find(e => e.sc === 67 && e.src === boss.addr && e.skill === sk) || {}).t; const lc = cast(81071);
  rows.push({ log: id, source: 'raw', url: URLS[id] || '', kill_time_s: Math.round((dead.t - s9.t) / 1000 - 3), stacks_at_kill: at(dead.t - 300), highest: Math.max(0, ...tl.map(s => s[1])), at_70: cast(80420) ? at(cast(80420)) : '', at_40: cast(81017) ? at(cast(81017)) : '', at_10: cast(80591) ? at(cast(80591)) : '', at_last_phase_start: lc ? at(lc + 15000) : '' }); }
rows.sort((a, b) => a.stacks_at_kill - b.stacks_at_kill || a.kill_time_s - b.kill_time_s);
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'empowered_stacks.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const v = k => rows.map(r => r[k]).filter(x => x !== '').sort((a, b) => a - b); const q = k => { const a = v(k); return { lowest: a[0], median: a[Math.floor((a.length - 1) / 2)], highest: a[a.length - 1] }; };
// do faster kills end with fewer stacks?
const n = rows.length, mx = rows.reduce((s, r) => s + r.kill_time_s, 0) / n, my = rows.reduce((s, r) => s + r.stacks_at_kill, 0) / n; const corr = rows.reduce((s, r) => s + (r.kill_time_s - mx) * (r.stacks_at_kill - my), 0) / Math.sqrt(rows.reduce((s, r) => s + (r.kill_time_s - mx) ** 2, 0) * rows.reduce((s, r) => s + (r.stacks_at_kill - my) ** 2, 0));
const summary = { kills: n, atKill: q('stacks_at_kill'), at70: q('at_70'), at40: q('at_40'), at10: q('at_10'), atLastPhaseStart: q('at_last_phase_start'), correlationKillTimeVsStacks: +corr.toFixed(2), kills_sorted: rows };
fs.writeFileSync(path.join(ROOT, 'data', 'empowered_stacks.json'), JSON.stringify(summary, null, 1));
console.log(n, 'kills | stacks at kill', JSON.stringify(summary.atKill), '| at 70 %', JSON.stringify(summary.at70), '| at 40 %', JSON.stringify(summary.at40), '| at 10 %', JSON.stringify(summary.at10), '| correlation with kill time', summary.correlationKillTimeVsStacks);
for (const r of rows) console.log(String(r.stacks_at_kill).padStart(4), 'stacks | kill', r.kill_time_s + ' s', '|', r.source, r.url ? 'link' : 'no link', '| 70/40/10 %:', r.at_70, r.at_40, r.at_10);
