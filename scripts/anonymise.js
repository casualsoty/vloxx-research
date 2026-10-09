// Replaces every player character / account name with a stable pseudonym in everything that gets published:
// data/*.csv, data/*.json, FINDINGS.md, README.md (in place) — and, via require(), the docs page and the build log.
//   characters → "Player-XXXX", accounts (incl. "name.1234", ":name.1234", "name1234" and the bare name, e.g. inside
//   Wingman / dps.report log ids) → "Account-XXXX". XXXX = HMAC-SHA256(salt, name) — not reversible without the salt.
// Salt: env ANON_SALT, else the local file .anon-salt (gitignored; created on first run; back it up — losing it changes every pseudonym).
// The logs are not in the repository, so the anonymisation only ever runs on the machine that has them; CI just publishes the data.
// Name list: every player agent in logs/raw*, every player / recorder in logs/ei/*.json.gz. The real ↔ pseudonym table is written
// to private/name_map.json (gitignored) for local use only.
// usage: node scripts/anonymise.js            (rewrite the files)      require('./anonymise').load() → { apply(text) }
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
// names that are deliberately public (the site's contact) are never replaced
const ALLOW = new Set([...(process.env.ANON_ALLOW || '').split(',').filter(Boolean), (fs.readFileSync(path.join(ROOT, 'scripts', 'build_docs.js'), 'utf8').match(/CONTACT_DISCORD = '([^']+)'/) || [])[1]].filter(Boolean).map(s => s.toLowerCase()));
const NOT_NAMES = new Set(['vloxx', 'staff', 'spear', 'sword', 'player', 'account', 'cosmic', 'aspect', 'raw', 'ei', 'fail', 'noe', 'fixed', 'last', 'early', 'blank']);

function salt() {
  if (process.env.ANON_SALT) return process.env.ANON_SALT;
  if (process.env.CI) throw new Error('ANON_SALT secret is missing: add it in GitHub → Settings → Secrets and variables → Actions (value = the content of the local .anon-salt file)');
  const f = path.join(ROOT, '.anon-salt'); if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(24).toString('hex'));
  return fs.readFileSync(f, 'utf8').trim();
}
function collectNames() {
  // cache keyed by the list of log files (parsing every log takes ~15 s); private/ is gitignored
  const logFiles = ['logs/raw', 'logs/raw_nm', 'logs/ei'].flatMap(d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).map(f => d + '/' + f) : []).sort();
  const key = crypto.createHash('sha1').update(logFiles.join('|')).digest('hex'); const cacheF = path.join(ROOT, 'private', 'names_cache.json');
  try { const c = JSON.parse(fs.readFileSync(cacheF, 'utf8')); if (c.key === key) return { chars: new Set(c.chars), accounts: new Set(c.accounts) }; } catch (e) { }
  const r = collectNamesUncached(); fs.mkdirSync(path.dirname(cacheF), { recursive: true });
  fs.writeFileSync(cacheF, JSON.stringify({ key, chars: [...r.chars], accounts: [...r.accounts] })); return r;
}
function collectNamesUncached() {
  const chars = new Set(), accounts = new Set();
  const { parseEvtc } = require('./evtc');
  for (const d of ['logs/raw', 'logs/raw_nm']) { const dir = path.join(ROOT, d); if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) { let agents; try { ({ agents } = parseEvtc(path.join(dir, f))); } catch (e) { continue; }
      for (const a of agents.values()) { if (!a.isPlayer || a.elite === 0xffffffff) continue; const [c, acc] = a.name.split('\0'); if (c) chars.add(c.trim()); if (acc) accounts.add(acc.replace(/^:/, '').trim()); } } }
  const ei = path.join(ROOT, 'logs', 'ei'); if (fs.existsSync(ei)) for (const f of fs.readdirSync(ei)) { if (!f.endsWith('.gz')) continue;
    let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ei, f))).toString('utf8')); } catch (e) { continue; }
    for (const p of j.players || []) { if (p.name) chars.add(p.name.trim()); if (p.account) accounts.add(p.account.replace(/^:/, '').trim()); }
    if (j.recordedBy) chars.add(j.recordedBy.trim()); if (j.recordedAccountBy) accounts.add(j.recordedAccountBy.replace(/^:/, '').trim()); }
  // account names also appear inside log ids / file names (e.g. "Name1234" or "_Name_" inside Wingman / dps.report ids): add those spellings for every account
  const extraIdRx = /(?:^|[_-])([A-Za-z][A-Za-z]{2,}\d{4})(?=[_-])/g; // "Name1234" fragments in ids from logs/sources.json
  try { const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs', 'sources.json'), 'utf8')); for (const k of Object.keys(src)) for (const m of k.matchAll(extraIdRx)) accounts.add(m[1].replace(/(\d{4})$/, '.$1')); } catch (e) { }
  return { chars, accounts };
}
function load() {
  const haveLogs = ['logs/raw', 'logs/ei'].some(d => fs.existsSync(path.join(ROOT, d)));
  if (!haveLogs) return { apply: t => String(t), map: new Map(), count: { characters: 0, accounts: 0, spellings: 0 }, noLogs: true }; // CI: data is committed already anonymised
  const S = salt(); const h = s => crypto.createHmac('sha256', S).update(s.toLowerCase()).digest('hex').slice(0, 4).toUpperCase();
  const { chars, accounts } = collectNames(); const map = new Map(); // spelling → pseudonym
  for (const acc of accounts) { const base = acc.replace(/\.\d{4}$/, ''); const digits = (acc.match(/\.(\d{4})$/) || [])[1] || ''; const ps = 'Account-' + h(base + digits);
    for (const v of [acc, ':' + acc, base + digits]) if (v.length >= 3) map.set(v, ps);
    if (base.length >= 4 && !NOT_NAMES.has(base.toLowerCase())) map.set(base, ps); }
  for (const c of chars) if (c.length >= 3 && !NOT_NAMES.has(c.toLowerCase()) && !map.has(c)) map.set(c, 'Player-' + h('char:' + c));
  // pseudonym collisions (4 hex digits) → extend
  const used = new Map(); for (const [k, v] of map) { const real = v.startsWith('Account') ? k.replace(/^:/, '').replace(/\.?\d{4}$/, '').toLowerCase() : 'c:' + k; const o = used.get(v); if (o && o !== real) map.set(k, v + '-' + h(k).slice(0, 2)); else used.set(v, real); }
  for (const k of [...map.keys()]) if (ALLOW.has(k.toLowerCase())) map.delete(k);
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const lower = new Map([...map].map(([k, v]) => [k.toLowerCase(), v]));
  const rx = keys.length ? new RegExp('(?<![\\p{L}\\p{N}])(' + keys.join('|') + ')(?![\\p{L}\\p{N}])', 'giu') : null;
  // GW2 Wingman log links and GitHub Pages links are kept as they are (their URL can contain an account name, anonymising would break the link)
  const KEEP = /https?:\/\/(?:gw2wingman\.nevermindcreations\.de|[A-Za-z0-9-]+\.github\.io)\/[^\s,"'<>)]*/g;
  const sub = t => t.replace(rx, m => map.get(m) || lower.get(m.toLowerCase()) || m);
  const apply = t => { t = String(t); if (!rx) return t; let out = '', last = 0; for (const m of t.matchAll(KEEP)) { out += sub(t.slice(last, m.index)) + m[0]; last = m.index + m[0].length; } return out + sub(t.slice(last)); };
  return { apply, map, count: { characters: chars.size, accounts: accounts.size, spellings: map.size } };
}
module.exports = { load };

if (require.main === module && !process.argv.includes('--check')) {
  const A = load(); const targets = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'data'))) if (/\.(csv|json)$/.test(f)) targets.push(path.join('data', f));
  targets.push('FINDINGS.md', 'README.md');
  let changed = 0;
  for (const rel of targets) { const p = path.join(ROOT, rel); if (!fs.existsSync(p)) continue; const before = fs.readFileSync(p, 'utf8');
    const after = A.apply(before); if (after !== before) { fs.writeFileSync(p, after); changed++; } }
  fs.mkdirSync(path.join(ROOT, 'private'), { recursive: true });
  const table = {}; for (const [k, v] of A.map) (table[v] = table[v] || []).push(k);
  fs.writeFileSync(path.join(ROOT, 'private', 'name_map.json'), JSON.stringify(table, null, 1));
  console.log(`anonymised ${changed} files · ${A.count.characters} characters, ${A.count.accounts} accounts (${A.count.spellings} spellings) · local table: private/name_map.json`);
}

// --check: fail if any real name (≥ 4 chars) is still present in what gets published. Run as the last step of build_all.
if (require.main === module && process.argv.includes('--check')) {
  const A = load(); const out = process.env.DOCS_OUT || 'docs';
  if (A.noLogs) { console.log('anonymisation check skipped: no logs here (the check runs locally, before every push)'); process.exit(0); }
  const files = [...fs.readdirSync(path.join(ROOT, 'data')).map(f => path.join('data', f)), 'FINDINGS.md', 'README.md', path.join(out, 'index.html'),
    ...fs.readdirSync(path.join(ROOT, 'scripts')).map(f => path.join('scripts', f)), ...fs.readdirSync(path.join(ROOT, 'docs-src')).filter(f => /\.(js|json|md|css)$/.test(f)).map(f => path.join('docs-src', f))];
  const leaks = [];
  for (const rel of files) { const p = path.join(ROOT, rel); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue; const s = fs.readFileSync(p, 'utf8');
    const anon = A.apply(s); if (anon !== s) { const a = s.split('\n'), b = anon.split('\n'); const ln = a.findIndex((l, i) => l !== b[i]); leaks.push(`${rel}:${ln + 1}`); } }
  if (leaks.length) { console.error('real player names found in published files (run node scripts/anonymise.js):\n  ' + leaks.join('\n  ')); process.exit(1); }
  console.log('anonymisation check: no real player names in', files.length, 'published files');
}
