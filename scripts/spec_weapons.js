// What does each specialisation bring to Vloxx CM? Weapons (melee or ranged) and the skills actually cast, per player of the logs that
// reached the last phase. Feeds the "Green groups" tool (docs-src/green_groups.json is checked against this).
// Source: Elite Insights JSON from GW2 Wingman (URLs in data/logs_index.csv); a slim copy without player names is cached in
// private/ei_weapons/ (local only, gitignored).
// Usage: node spec_weapons.js [--no-fetch]
// Writes data/spec_weapons.json: per specialisation the players seen, weapon sets with counts, melee share, and how many of them cast
// each ground-area projectile skill listed in docs-src/green_groups.json. Melee = at least one land weapon set whose main hand is not a ranged type.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), CACHE = path.join(ROOT, 'private', 'ei_weapons');
const csv = f => { const [h, ...L] = fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n'); const H = h.split(','); return L.map(l => { const v = l.split(','); return Object.fromEntries(H.map((k, i) => [k, v[i]])); }); };
const slim = j => ({ success: !!j.success, players: j.players.filter(p => !p.isFake && !p.notInSquad).map(p => ({ prof: p.profession, group: p.group, weapons: p.weapons, heal: p.healing, conc: p.concentration, condi: p.condition, tough: p.toughness,
  casts: Object.fromEntries((p.rotation || []).filter(r => r.id > 0).map(r => [(j.skillMap['s' + r.id] || {}).name || ('id' + r.id), r.skills.length])) })) });
async function fetchOne(log, url) { const f = path.join(CACHE, log + '.json'); if (fs.existsSync(f)) return true; if (process.argv.includes('--no-fetch')) return false;
  for (let k = 0; k < 2; k++) try { const r = await fetch('https://gw2wingman.nevermindcreations.de/api/getFullJson/' + url.split('/').pop(), { signal: AbortSignal.timeout(300000) }); if (!r.ok) continue;
    fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, JSON.stringify(slim(await r.json()))); return true; } catch (e) { console.log('  could not fetch', log, e.message); }
  return false; }
(async () => {
  const idx = csv('logs_index.csv').filter(l => /gw2wingman/.test(l.url) && l.difficulty === 'CM' && l.reached_last_phase === 'true');
  const q = idx.slice(); await Promise.all([0, 1, 2, 3, 4, 5].map(async () => { while (q.length) { const l = q.shift(); await fetchOne(l.log_id, l.url); } }));
  const logs = idx.filter(l => fs.existsSync(path.join(CACHE, l.log_id + '.json'))).map(l => JSON.parse(fs.readFileSync(path.join(CACHE, l.log_id + '.json'), 'utf8')));
  if (!logs.length) { console.log('no EI JSON available (cache empty and Wingman not reachable): data/spec_weapons.json left as it is'); return; }
  const GG = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs-src', 'green_groups.json'), 'utf8')), S = {};
  const profOf = sp => Object.keys(GG.professions).find(k => GG.professions[k].includes(sp)), hateOf = sp => GG.hate.filter(h => h.prof === profOf(sp) && (!h.spec || h.spec === sp));
  const RANGED = new Set(GG.rangedMainHands);   // main-hand / two-hand weapon types that fight from range; everything else counts as melee
  for (const l of logs) for (const p of l.players) { const s = S[p.prof] = S[p.prof] || { players: 0, weaponSets: {}, mainHands: {}, cast: {}, roles: {} }; s.players++;
    const w = (p.weapons || []).map(x => x || '').slice(0, 4), sets = [[w[0], w[1]], [w[2], w[3]]].map(([a, b]) => a === '2Hand' ? b : [a, b].filter(x => x && x !== 'Unknown').join('/')).filter(Boolean);   // land sets only
    const mains = [...new Set([[w[0], w[1]], [w[2], w[3]]].map(([a, b]) => a === '2Hand' ? b : a).filter(x => x && x !== 'Unknown'))];
    const key = sets.join(' + ') || '?'; s.weaponSets[key] = (s.weaponSets[key] || 0) + 1; for (const m of mains) s.mainHands[m] = (s.mainHands[m] || 0) + 1;
    p._melee = mains.length ? mains.some(m => !RANGED.has(m)) : null; s.melee = (s.melee || 0) + (p._melee ? 1 : 0); s.known = (s.known || 0) + (p._melee == null ? 0 : 1);
    for (const sk of hateOf(p.prof)) if (p.casts[sk.skill]) s.cast[sk.skill] = (s.cast[sk.skill] || 0) + 1;
    const role = p.heal >= 5 ? 'heal' : p.conc >= 5 ? 'boon' : p.condi >= 5 ? 'condition' : 'power'; s.roles[role] = (s.roles[role] || 0) + 1; }
  const top = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6));
  const out = { logs: logs.length, rangedMainHands: [...RANGED], specs: Object.fromEntries(Object.entries(S).sort((a, b) => b[1].players - a[1].players).map(([k, s]) => [k, { players: s.players, hasMeleeWeaponPct: s.known ? Math.round(100 * s.melee / s.known) : null, roles: s.roles, mainHands: top(s.mainHands), weaponSets: top(s.weaponSets), castProjectileHate: s.cast }])) };
  fs.writeFileSync(path.join(DATA, 'spec_weapons.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`spec weapons: ${logs.length} logs, ${Object.keys(S).length} specialisations`);
  for (const [k, s] of Object.entries(out.specs)) console.log(' ', k.padEnd(14), String(s.players).padStart(3), 'melee weapon', String(s.hasMeleeWeaponPct).padStart(3) + '%', '|', Object.entries(s.weaponSets).slice(0, 3).map(([a, n]) => a + ' ×' + n).join(', '), '|', JSON.stringify(s.castProjectileHate));
})();
