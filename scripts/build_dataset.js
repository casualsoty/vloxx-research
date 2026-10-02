// Builds every CSV in ../data from the logs in ../logs.  Run:  node scripts/build_dataset.js
// Only the CM version of Vloxx (max HP 84,939,840; EI calls >70M "CM") is analysed for greens/fixation.
const fs = require('fs');
const path = require('path');
const { loadRaw, loadEI, holderAt, isUp, inStealth, fixSpans } = require('./load');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data'); fs.mkdirSync(OUT, { recursive: true });
const csv = (name, header, rows) => fs.writeFileSync(path.join(OUT, name), [header.join(','), ...rows.map(r => r.map(v => v == null ? '' : (typeof v === 'string' && /[,"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(','))].join('\n') + '\n');
const s = ms => ms == null ? null : +(ms / 1000).toFixed(3);

const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs', 'sources.json'), 'utf8'));
const logs = [];
for (const f of fs.readdirSync(path.join(ROOT, 'logs', 'raw')).sort()) { const L = loadRaw(path.join(ROOT, 'logs', 'raw', f)); if (L) { L.id = f.replace('.zevtc', ''); logs.push(L); } }
for (const f of fs.readdirSync(path.join(ROOT, 'logs', 'ei')).sort()) { const L = loadEI(path.join(ROOT, 'logs', 'ei', f)); if (L) { L.id = f.replace('.json.gz', ''); logs.push(L); } }
const CM = L => L.bossMaxHP > 70e6;

// ---------- logs_index.csv ----------
csv('logs_index.csv', ['log_id', 'source', 'url', 'recorded_by', 'boss_max_hp', 'difficulty', 'success', 'duration_s', 'last_phase_start_s', 'reached_last_phase', 'players'],
  logs.map(L => [L.id, L.source, URLS[L.id] || '', L.recordedBy, L.bossMaxHP, CM(L) ? 'CM' : 'NM', L.success, s(L.durationMs), s(L.p3), L.p3 != null, L.players.join(' | ')]));

// ---------- green rounds ----------
// early-phase rounds = clusters of green effects before the last phase; last-phase rounds = every tick at P3+3s, +33s, +63s ... (incl. 0-green ticks)
const greenRounds = [], greenPlayers = [];
for (const L of logs.filter(CM)) {
  const rounds = [];
  const early = L.greens.filter(g => L.p3 == null || g.t < L.p3);
  for (const g of early) { const r = rounds[rounds.length - 1]; if (r && g.t - r.t < 1000) r.w.push(g); else rounds.push({ t: g.t, w: [g], phase: 'early' }); }
  if (L.p3 != null) for (let k = 0; L.p3 + 3000 + 30000 * k < L.durationMs - 500; k++) { const T = L.p3 + 3000 + 30000 * k; rounds.push({ t: T, w: L.greens.filter(g => Math.abs(g.t - T) < 600), phase: 'last', tick: 3 + 30 * k }); }
  for (const r of rounds) {
    const fx = holderAt(L, r.t - 50); const up = L.players.filter(p => isUp(L, p, r.t - 50));
    const pd = L.pd.filter(x => Math.abs(x.t - r.t) < 300).map(x => x.p);
    const bp = L.bossPos(r.t); let hp = null; for (const [t, v] of L.bossHP || []) { if (t > r.t) break; hp = v; }
    const slots = r.phase === 'last' ? r.w.map(g => Math.round((g.t - r.t) / 80) + 1) : null;
    greenRounds.push([L.id, L.source, r.phase, r.tick ?? '', s(r.t), fx || '', up.length, Math.min(3, Math.floor(up.length / 3)), r.w.length, r.w.map(g => g.p).join(' > '), slots ? slots.join(' ') : '', pd.join(' | '), hp != null ? +hp.toFixed(2) : '']);
    for (const p of L.players) { const q = L.pos(p, r.t); greenPlayers.push([L.id, r.phase, r.tick ?? '', s(r.t), p, isUp(L, p, r.t - 50) ? 1 : 0, p === fx ? 1 : 0, r.w.some(g => g.p === p) ? 1 : 0, pd.includes(p) ? 1 : 0, q && bp ? Math.round(Math.hypot(q[0] - bp[0], q[1] - bp[1])) : '', inStealth(L, p, r.t) ? 1 : 0]); }
  }
}
csv('green_rounds.csv', ['log_id', 'source', 'phase', 'last_phase_tick_s', 'time_s', 'fixated_player', 'players_up', 'expected_floor_up_div3', 'greens', 'green_targets_in_order', 'last_phase_slots_80ms', 'probability_distribution_targets_same_instant', 'boss_hp_pct'], greenRounds);
csv('green_round_players.csv', ['log_id', 'phase', 'last_phase_tick_s', 'time_s', 'player', 'up', 'fixated', 'got_green', 'pd_target_same_instant', 'dist_to_boss_center', 'in_stealth'], greenPlayers);

// ---------- probability distribution rounds (last phase) ----------
const pdRows = [];
for (const L of logs.filter(l => CM(l) && l.p3 != null)) {
  for (let k = 0; L.p3 + 23000 + 20000 * k < L.durationMs - 200; k++) { const T = L.p3 + 23000 + 20000 * k; const t = L.pd.filter(x => Math.abs(x.t - T) < 300);
    const up = L.players.filter(p => isUp(L, p, T - 50)).length; pdRows.push([L.id, 23 + 20 * k, s(T), holderAt(L, T - 50) || '', up, Math.min(3, Math.max(1, Math.floor(up / 3))), t.length, t.map(x => x.p).join(' | ')]); }
}
csv('probability_distribution_last_phase.csv', ['log_id', 'last_phase_tick_s', 'time_s', 'fixated_player', 'players_up', 'expected', 'targets', 'target_names'], pdRows);

// ---------- fixation applications ----------
const fixRows = [], tickRows = [];
for (const L of logs.filter(CM)) {
  const spans = fixSpans(L);
  const phaseOf = t => { if (L.p3 != null && t >= L.p3 - 50) return 'last+' + ((t - L.p3) / 1000).toFixed(1); if (!L.phases) return t < 1000 ? 'start' : ''; const p = L.phases.find(q => t >= q.start && t < q.end); return p ? p.name : (t < 1000 ? 'start' : ''); };
  spans.forEach((x, i) => { const prev = spans[i - 1]; fixRows.push([L.id, s(x.on), phaseOf(x.on), x.p, x.off != null ? s(x.off - x.on) : '', x.cause, prev && prev.off != null && prev.off < x.on ? s(x.on - prev.off) : '', prev ? prev.cause : '', prev && prev.p === x.p ? 1 : 0]); });
  if (L.p3 != null) for (const k of [2500, 22500, 42500, 62500, 82500]) { const T = L.p3 + k; if (T > L.durationMs - 200) break;
    const h = holderAt(L, T - 30); const app = L.fix.find(e => e.on && Math.abs(e.t - T) < 300); const last = spans.filter(x => x.off != null && x.off < T).pop();
    tickRows.push([L.id, k / 1000, h || '', h ? 'held' : app ? 'APPLIED' : 'SKIPPED', app ? app.p : '', last ? last.p : '', last ? last.cause : '', last ? s(T - last.off) : '', L.players.filter(p => isUp(L, p, T)).length]); }
}
csv('fixation_applications.csv', ['log_id', 'time_s', 'phase', 'player', 'held_s', 'end_cause', 'gap_since_previous_end_s', 'previous_end_cause', 'same_player_as_previous'], fixRows);
csv('fixation_last_phase_ticks.csv', ['log_id', 'tick_s', 'holder_at_tick', 'result', 'new_holder', 'previous_holder', 'previous_end_cause', 'seconds_since_previous_end', 'players_up'], tickRows);

// ---------- Ascension orbs & aspects (raw logs only) ----------
const orbRows = [], aspRows = [];
for (const L of logs.filter(l => CM(l) && l.source === 'raw')) {
  for (const o of L.orbs) { const life = o.end != null ? o.end - o.spawn : null; const gap = o.end != null && o.teamChange != null ? o.teamChange - o.end : null;
    orbRows.push([L.id, s(o.spawn), life != null ? s(life) : '', gap != null ? s(gap) : '', life == null ? 'no end (fight ended)' : Math.abs(life - 120100) < 300 ? 'EXPIRED (120s)' : 'picked up']); }
  const ev = L.aspects.slice().sort((a, b) => a.t - b.t);
  for (const e of ev) { let extra = '';
    if (e.kind === 'death') { const nx = ev.find(x => x.kind === 'spawn' && x.type === e.type && x.t > e.t); extra = nx ? s(nx.t - e.t) : ''; }
    if (e.kind === 'breakbar_broken') { const o = L.orbs.filter(x => x.spawn - e.t >= 1500 && x.spawn - e.t <= 2600); extra = o.length ? s(Math.min(...o.map(x => x.spawn - e.t))) : 'no orbs'; }
    aspRows.push([L.id, s(e.t), e.type, e.kind, e.id, extra]); }
}
csv('ascension_orbs.csv', ['log_id', 'spawn_s', 'lifetime_s', 'end_to_teamchange_s', 'outcome'], orbRows);
csv('aspect_events.csv', ['log_id', 'time_s', 'aspect', 'event', 'agent', 'respawn_after_s (death) / first_orb_after_s (breakbar_broken)'], aspRows);
console.log('logs', logs.length, '| CM', logs.filter(CM).length, '| green rounds', greenRounds.length, '| fixations', fixRows.length, '| orbs', orbRows.length, '| aspect events', aspRows.length);
