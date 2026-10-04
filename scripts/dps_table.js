// DPS per specialisation / build on Vloxx CM KILLS: average and highest, on the target (Vloxx) and cleave (every enemy).
// Only kills count, so every sample covers the same fight from start to end. One sample = one player in one kill.
// Sources:
//  * Elite Insights JSON in logs/ei (dps.report / GW2 Wingman) with success = true and the CM health pool: the player's
//    dpsTargets[0] (Vloxx) and dpsAll of the full-fight phase, profession name and stat flags as EI gives them.
//  * our own raw kills in logs/raw (Vloxx dies in the log): damage dealt (direct hits + condition/buff ticks, minions included)
//    ÷ length of the log. Specialisation from the elite id in the log.
// Build label: "Condition" when at least half of the player's damage on all enemies was condition damage, otherwise "Power";
// from the stat flags (0 or 10): healing → "Heal"; concentration without healing → "Boon".
// The link of a kill comes from logs/sources.json (dps.report / Wingman); the highest values keep the link of the log they come from.
// Writes data/dps_samples.csv (one row per player per kill, no names) and data/dps_table.json.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { parseEvtc } = require('./evtc');
const ROOT = path.join(__dirname, '..'); const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs', 'sources.json'), 'utf8'));
const PROF = { 1: 'Guardian', 2: 'Warrior', 3: 'Engineer', 4: 'Ranger', 5: 'Thief', 6: 'Elementalist', 7: 'Mesmer', 8: 'Necromancer', 9: 'Revenant' };
const ELITE = { 5: 'Druid', 7: 'Daredevil', 18: 'Berserker', 27: 'Dragonhunter', 34: 'Reaper', 40: 'Chronomancer', 43: 'Scrapper', 48: 'Tempest', 52: 'Herald', 55: 'Soulbeast', 56: 'Weaver', 57: 'Holosmith', 58: 'Deadeye', 59: 'Mirage',
  60: 'Scourge', 61: 'Spellbreaker', 62: 'Firebrand', 63: 'Renegade', 64: 'Harbinger', 65: 'Willbender', 66: 'Virtuoso', 67: 'Catalyst', 68: 'Bladesworn', 69: 'Vindicator', 70: 'Mechanist', 71: 'Specter', 72: 'Untamed',
  73: 'Troubadour', 74: 'Paragon', 75: 'Amalgam', 76: 'Ritualist', 77: 'Antiquary', 78: 'Galeshot', 79: 'Conduit', 80: 'Evoker', 81: 'Luminary' };
const rows = []; const kills = []; const label = (heal, conc, condShare) => { const role = heal >= 5 ? 'Heal' : conc >= 5 ? 'Boon' : ''; return [role, role === 'Heal' ? '' : condShare >= 0.5 ? 'Condition' : 'Power'].filter(Boolean).join(' '); };
// Elite Insights kills
for (const f of fs.readdirSync(path.join(ROOT, 'logs', 'ei')).sort()) { let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'logs', 'ei', f)))); } catch (e) { continue; }
  if (!j.success || !j.targets || !j.targets[0] || !(j.targets[0].totalHealth > 70e6)) continue; const id = f.replace('.json.gz', ''); const dur = Math.round(j.durationMS / 1000); kills.push({ log: id, source: 'EI', length_s: dur, url: URLS[id] || '' });
  for (const p of j.players) { if (p.isFake || p.notInSquad || p.friendlyNPC) continue; const t = p.dpsTargets[0][0], a = p.dpsAll[0]; if (!a || !a.damage) continue;
    rows.push({ log: id, source: 'EI', url: URLS[id] || '', length_s: dur, spec: p.profession, build: label(p.healing, p.concentration, a.condiDamage / a.damage), target_dps: t.dps, cleave_dps: a.dps, condition_share_pct: Math.round(100 * a.condiDamage / a.damage) }); } }
// our own raw kills
for (const f of fs.readdirSync(path.join(ROOT, 'logs', 'raw')).sort()) {
  const { agents, ev } = parseEvtc(path.join(ROOT, 'logs', 'raw', f)); const boss = [...agents.values()].find(a => a.species === 28106); const s9 = ev.find(e => e.sc === 9); if (!boss || !s9 || !ev.some(e => e.sc === 4 && e.src === boss.addr)) continue;
  const id = f.replace('.zevtc', ''); const dur = (ev[ev.length - 1].t - s9.t) / 1000; kills.push({ log: id, source: 'raw', length_s: Math.round(dur), url: URLS[id] || '' });
  const isP = a => (agents.get(a) || {}).isPlayer; const instOf = new Map(); for (const e of ev) if (e.srcInst && isP(e.src) && !instOf.has(e.srcInst)) instOf.set(e.srcInst, e.src); const tgt = new Map(), all = new Map(), cond = new Map();
  for (const e of ev) { if (e.sc !== 0 || e.result === 10 || isP(e.dst)) continue; const owner = isP(e.src) ? e.src : (e.srcMaster ? instOf.get(e.srcMaster) : null); if (owner == null) continue; const d = e.buff ? e.buffDmg : e.value; if (!(d > 0)) continue;
    const dst = agents.get(e.dst); if (!dst || dst.isPlayer || dst.species == null) continue; all.set(owner, (all.get(owner) || 0) + d); if (e.buff) cond.set(owner, (cond.get(owner) || 0) + d); if (e.dst === boss.addr) tgt.set(owner, (tgt.get(owner) || 0) + d); }
  for (const a of agents.values()) { if (!a.isPlayer || !all.get(a.addr)) continue; const share = (cond.get(a.addr) || 0) / all.get(a.addr);
    rows.push({ log: id, source: 'raw', url: URLS[id] || '', length_s: Math.round(dur), spec: a.elite ? (ELITE[a.elite] || 'Elite ' + a.elite) : (PROF[a.prof] || 'Profession ' + a.prof), build: label(a.healing, a.concentration, share), target_dps: Math.round((tgt.get(a.addr) || 0) / dur), cleave_dps: Math.round(all.get(a.addr) / dur), condition_share_pct: Math.round(100 * share) }); } }
const H = Object.keys(rows[0]); fs.writeFileSync(path.join(ROOT, 'data', 'dps_samples.csv'), [H.join(','), ...rows.map(r => H.map(k => r[k]).join(','))].join('\n'));
const avg = a => Math.round(a.reduce((s, x) => s + x, 0) / a.length); const best = (g, k) => g.reduce((m, r) => (r[k] > m[k] ? r : m), g[0]);
const groups = new Map(); for (const r of rows) { const k = r.build + ' ' + r.spec; (groups.get(k) || groups.set(k, []).get(k)).push(r); }
const table = [...groups].map(([k, g]) => { const bt = best(g, 'target_dps'), bc = best(g, 'cleave_dps'); return { build: k, samples: g.length, kills: new Set(g.map(r => r.log)).size, targetAvg: avg(g.map(r => r.target_dps)), targetMax: bt.target_dps, targetMaxLog: bt.log, targetMaxUrl: bt.url,
  cleaveAvg: avg(g.map(r => r.cleave_dps)), cleaveMax: bc.cleave_dps, cleaveMaxLog: bc.log, cleaveMaxUrl: bc.url, conditionSharePct: avg(g.map(r => r.condition_share_pct)) }; }).sort((a, b) => b.targetMax - a.targetMax); // rows ordered by the highest target DPS
const squad = new Map(); for (const r of rows) { const o = squad.get(r.log) || squad.set(r.log, { log: r.log, url: r.url, t: 0, c: 0 }).get(r.log); o.t += r.target_dps; o.c += r.cleave_dps; } const sq = [...squad.values()]; const st = sq.reduce((m, o) => (o.t > m.t ? o : m)), sc = sq.reduce((m, o) => (o.c > m.c ? o : m));
const summary = { kills: kills.length, killsFromEI: kills.filter(k => k.source === 'EI').length, killsFromRaw: kills.filter(k => k.source === 'raw').length, killsWithLink: kills.filter(k => k.url).length, samples: rows.length,
  killLengthS: { fastest: Math.min(...kills.map(k => k.length_s)), average: avg(kills.map(k => k.length_s)), slowest: Math.max(...kills.map(k => k.length_s)) },
  squad: { targetAvg: avg(sq.map(o => o.t)), targetMax: st.t, targetMaxUrl: st.url, cleaveAvg: avg(sq.map(o => o.c)), cleaveMax: sc.c, cleaveMaxUrl: sc.url }, table };
fs.writeFileSync(path.join(ROOT, 'data', 'dps_table.json'), JSON.stringify(summary, null, 1));
console.log(`${kills.length} kills (${summary.killsFromEI} EI, ${summary.killsFromRaw} raw; ${summary.killsWithLink} with a link), ${rows.length} samples | kill time ${summary.killLengthS.fastest}–${summary.killLengthS.slowest} s | squad target avg ${summary.squad.targetAvg} max ${summary.squad.targetMax} | cleave avg ${summary.squad.cleaveAvg} max ${summary.squad.cleaveMax}`);
console.log('build'.padEnd(30) + 'samples  target avg / max      cleave avg / max    condition %  link'); for (const t of table) console.log(t.build.padEnd(30) + String(t.samples).padStart(5) + String(t.targetAvg).padStart(11) + ' / ' + String(t.targetMax).padEnd(8) + String(t.cleaveAvg).padStart(9) + ' / ' + String(t.cleaveMax).padEnd(8) + String(t.conditionSharePct).padStart(6) + '   ' + (t.targetMaxUrl ? 'yes' : 'no'));
