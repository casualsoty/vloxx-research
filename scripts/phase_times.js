// How long each phase of Vloxx CM takes: fastest and average over all logs, with the link of the fastest when the log is online.
// Phases (same cut as Elite Insights): Staff Phase (pull → 70 %), Split 1 (Visions of Eternity + breakbar), Spear Phase (→ 40 %),
// Split 2, Sword Phase (→ 10 %), Split 3 (until the Damage Immunity of the last phase ends), Final Form Phase (→ kill), Full fight (kills).
// A phase only counts when it was finished in that log (a wipe during a phase gives no time for it).
//  * Elite Insights JSON (logs/ei): the phases array, by name.
//  * raw logs (logs/raw): Vloxx's Visions of Eternity casts (80420 / 81017 / 80591) start and end, the last-phase channel 81071
//    (+ 15 s of Damage Immunity), Vloxx's death.
// Writes data/phase_times.csv (one row per log × finished phase) and data/phase_times.json.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs', 'sources.json'), 'utf8'));
const ORDER = ['Staff Phase', 'Split 1', 'Spear Phase', 'Split 2', 'Sword Phase', 'Split 3', 'Final Form Phase', 'Full fight (kill)'];
const WHAT = { 'Staff Phase': 'pull → 70 %', 'Split 1': 'Visions of Eternity + breakbar at 70 %', 'Spear Phase': '70 → 40 %', 'Split 2': 'Visions of Eternity + breakbar at 40 %', 'Sword Phase': '40 → 10 %', 'Split 3': 'Visions of Eternity + breakbar at 10 %, until the Damage Immunity ends', 'Final Form Phase': 'last phase → kill', 'Full fight (kill)': 'pull → kill' };
const offsets = []; const rows = []; const push = (log, source, phase, ms) => { if (ms > 1000) rows.push({ log, source, url: URLS[log] || '', phase, seconds: +(ms / 1000).toFixed(1) }); };
for (const f of fs.readdirSync(path.join(ROOT, 'logs', 'ei')).sort()) { let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'logs', 'ei', f)))); } catch (e) { continue; }
  if (!j.targets || !j.targets[0] || !(j.targets[0].totalHealth > 70e6) || !j.phases) continue; const id = f.replace('.json.gz', ''); const ph = j.phases.filter(p => ORDER.includes(p.name));
  ph.forEach((p, i) => { const finished = i < ph.length - 1 || (p.name === 'Final Form Phase' && j.success); if (finished) push(id, 'EI', p.name, p.end - p.start); }); if (j.success) push(id, 'EI', 'Full fight (kill)', j.durationMS); }
for (const f of fs.readdirSync(path.join(ROOT, 'logs', 'raw')).sort()) {
  const { agents, ev } = parseEvtc(path.join(ROOT, 'logs', 'raw', f)); const boss = [...agents.values()].find(a => a.species === 28106); const s9 = ev.find(e => e.sc === 9); if (!boss || !s9) continue; const id = f.replace('.zevtc', '');
  const cast = sk => ev.find(e => e.sc === 67 && e.src === boss.addr && e.skill === sk); const endOf = c => c && ev.find(e => e.sc === 68 && e.src === boss.addr && e.skill === c.skill && e.t > c.t);
  const v1 = cast(80420), v2 = cast(81017), v3 = cast(80591), lc = cast(81071), e1 = endOf(v1), e2 = endOf(v2); const dead = ev.find(e => e.sc === 4 && e.src === boss.addr);
  // fight start as Elite Insights counts it: 3.0 s after the raw log starts (checked on two kills that exist in both forms: raw 552.5 / 531.9 s
  // from the log start, Elite Insights 550.0 / 529.0 s). It is the moment the first Fixated is applied.
  const first = ev.find(e => e.sc === 69 && e.skill === 34508 && e.t >= s9.t && e.t < s9.t + 6000); const t0 = first ? first.t : s9.t + 3000; offsets.push((t0 - s9.t) / 1000); const last = ev[ev.length - 1].t; const ffStart = lc ? lc.t + 15000 : null;
  if (v1) push(id, 'raw', 'Staff Phase', v1.t - t0); if (v1 && e1) push(id, 'raw', 'Split 1', e1.t - v1.t); if (e1 && v2) push(id, 'raw', 'Spear Phase', v2.t - e1.t); if (v2 && e2) push(id, 'raw', 'Split 2', e2.t - v2.t); if (e2 && v3) push(id, 'raw', 'Sword Phase', v3.t - e2.t);
  if (v3 && ffStart && ffStart <= last) push(id, 'raw', 'Split 3', ffStart - v3.t); if (ffStart && dead) push(id, 'raw', 'Final Form Phase', dead.t - ffStart); if (dead) push(id, 'raw', 'Full fight (kill)', dead.t - t0); }
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'phase_times.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const table = ORDER.map(p => { const x = rows.filter(r => r.phase === p).sort((a, b) => a.seconds - b.seconds); if (!x.length) return null; const linked = x.find(r => r.url);
  return { phase: p, what: WHAT[p], logs: x.length, fastestS: x[0].seconds, fastestLog: x[0].log, fastestUrl: x[0].url, fastestWithLinkS: linked ? linked.seconds : null, fastestWithLinkUrl: linked ? linked.url : '', averageS: +(x.reduce((s, r) => s + r.seconds, 0) / x.length).toFixed(1), medianS: x[Math.floor((x.length - 1) / 2)].seconds, slowestS: x[x.length - 1].seconds }; }).filter(Boolean); // rows in fight order
fs.writeFileSync(path.join(ROOT, 'data', 'phase_times.json'), JSON.stringify({ logs: new Set(rows.map(r => r.log)).size, rows: rows.length, table }, null, 1));
console.log(new Set(rows.map(r => r.log)).size, 'logs,', rows.length, 'finished phases | raw fight start after log start: median', offsets.sort((a, b) => a - b)[Math.floor(offsets.length / 2)], 's'); for (const t of table) console.log(t.phase.padEnd(20), 'fastest', String(t.fastestS).padStart(6), t.fastestUrl ? 'link' : 'no link', '| avg', String(t.averageS).padStart(6), '| median', String(t.medianS).padStart(6), '| slowest', String(t.slowestS).padStart(6), '| logs', t.logs, t.fastestUrl ? '' : '| fastest with link ' + t.fastestWithLinkS);
