// Builds docs/index.html — a static, self-contained documentation page generated from FINDINGS.md + README.md + data/.
// Re-run after every change to the research notes:   node scripts/build_docs.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
// DOCS_BASE = prefix for links to repo files (default '../' when the page sits in docs/), DOCS_OUT = output folder
const BASE = process.env.DOCS_BASE ?? '../';
const CONTACT_DISCORD = 'soty'; // shown by the Feedback / Report a bug buttons
const OUTDIR = path.join(ROOT, process.env.DOCS_OUT || 'docs');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---------- tiny markdown renderer (headings, lists, tables, code, emphasis, links) ----------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TAGS = { solid: 'solid', likely: 'likely', 'likely → strong': 'likely', open: 'open', rejected: 'rejected' };
function inline(s) {
  const codes = []; s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/\[(solid|likely(?: → strong)?|open|REJECTED)\]/gi, (m, t) => `<span class="tag tag-${TAGS[t.toLowerCase()] || 'open'}">${t}</span>`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${/^https?:/.test(u) ? u : BASE + u}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/★/g, '<span class="star">★</span>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}
function md(text) {
  const lines = text.replace(/\r/g, '').split('\n'); let html = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { let b = []; i++; while (i < lines.length && !/^```/.test(lines[i])) b.push(lines[i++]); i++; html += `<pre><code>${esc(b.join('\n'))}</code></pre>`; continue; }
    if (/^### /.test(l)) { html += `<h4>${inline(l.slice(4))}</h4>`; i++; continue; }
    if (/^\|/.test(l.trim())) { const rows = []; while (i < lines.length && /^\|/.test(lines[i].trim())) rows.push(lines[i++].trim()); const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const body = rows.filter((r, k) => k !== 1 || !/^\|[\s:|-]+\|$/.test(r));
      html += '<div class="tw"><table><thead><tr>' + cells(body[0]).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' + body.slice(1).map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>'; continue; }
    if (/^\s*[*-] /.test(l)) { // nested list by indentation
      let out = '', stack = [];
      while (i < lines.length && (/^\s*[*-] /.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && stack.length))) {
        const m = lines[i].match(/^(\s*)[*-] (.*)$/);
        if (!m) { out = out.replace(/<\/li>$/, ' ' + inline(lines[i].trim()) + '</li>'); i++; continue; }
        const ind = m[1].length;
        while (stack.length && ind < stack[stack.length - 1]) { out += '</ul></li>'; stack.pop(); }
        if (!stack.length || ind > stack[stack.length - 1]) { if (stack.length) out = out.replace(/<\/li>$/, ''); out += '<ul>'; stack.push(ind); }
        out += `<li>${inline(m[2])}</li>`; i++;
      }
      while (stack.length) { out += stack.length > 1 ? '</ul></li>' : '</ul>'; stack.pop(); }
      html += out; continue;
    }
    if (/^\d+\. /.test(l)) { let out = '<ol>'; while (i < lines.length && /^\d+\. /.test(lines[i])) { let item = lines[i++].replace(/^\d+\. /, ''); while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[*-] /.test(lines[i])) item += ' ' + lines[i++].trim(); out += `<li>${inline(item)}</li>`; } html += out + '</ol>'; continue; }
    if (!l.trim() || /^---\s*$/.test(l)) { i++; continue; }
    let p = [l]; i++; while (i < lines.length && lines[i].trim() && !/^(#|\||```|\s*[*-] |\d+\. )/.test(lines[i])) p.push(lines[i++]);
    html += `<p>${inline(p.join(' '))}</p>`;
  }
  return html;
}
// split a markdown doc into ## sections
function sections(text) { const out = []; let cur = null; for (const l of text.replace(/\r/g, '').split('\n')) { const m = l.match(/^## (.*)$/); if (m) { cur = { title: m[1], body: [] }; out.push(cur); } else if (cur) cur.body.push(l); } return out.map(s => ({ ...s, body: s.body.join('\n') })); }

// ---------- categorise ----------
const CATS = [ // matching: by FINDINGS section number (first match wins)
  { id: 'greens', name: 'Judgment of Eternity — 3-people greens', icon: '◉', match: /^1\./ },
  { id: 'order', name: 'Attack order per phase', icon: '☰', match: /^5[lq]\./ },
  { id: 'ragingstorm', name: 'Raging Storm (falling spears)', icon: '☄', match: /^5q\./ },
  { id: 'fixated', name: 'Fixated', icon: '◎', match: /^2\./ },
  { id: 'annorb', name: 'Annihilating Orb', icon: '◉', match: /^5p\./ },
  { id: 'bug', name: 'Last phase: fewer greens (timing bug)', icon: '★', match: /^3\./ },
  { id: 'overlap', name: 'Last phase: green + spread overlap', icon: '⊗', match: /^3b\./ },
  { id: 'pd', name: 'Probability Distribution — spread', icon: '◌', match: /^4\./ },
  { id: 'orbs', name: 'Ascension orbs & Aspects', icon: '✦', match: /^5\./ },
  { id: 'shackles', name: "Ascension's Sacrifice — 2-people shackles", icon: '⛓', match: /^5b\./ },
  { id: 'arena', name: 'Arena coordinates', icon: '⌖', match: /^5c\./ },
  { id: 'shapes', name: 'All attack shapes (table)', icon: '◇', match: /^5d\./ },
  { id: 'excision', name: 'Excision Extremis', icon: '◗', match: /^5[ek]\./ },
  { id: 'echoing', name: 'Echoing Blade', icon: '◔', match: /^5f\./ },
  { id: 'worldpiercer', name: 'Worldpiercer', icon: '✳', match: /^5g\./ },
  { id: 'cosmiccharge', name: 'Cosmic Charge', icon: '➤', match: /^5h\./ },
  { id: 'slice', name: 'Slice Through Reality', icon: '✂', match: /^5m\./ },
  { id: 'swordadd', name: 'Aspect of the Sword — Division Eternal', icon: '⚔', match: /^5j\./ },
  { id: 'breakbars', name: 'Breakbars', icon: '▰', match: /^5i\./ },
  { id: 'immunity', name: 'Damage Immunity', icon: '⛨', match: /^5n\./ },
  { id: 'phasetimes', name: 'Phase times', icon: '⏱', match: /^5r\./ },
  { id: 'empowered', name: 'Empowered stacks', icon: '▲', match: /^5s\./ },
  { id: 'conditions', name: 'Conditions per attack', icon: '☣', match: /^5t\./ },
  { id: 'dps', name: 'DPS per build', icon: '⚑', match: /^5o\./ },
  { id: 'rejected', name: 'Rejected hypotheses', icon: '✕', match: /^6\./ },
  { id: 'open', name: 'Open questions', icon: '?', match: /^7\./ },
];
const findings = sections(read('FINDINGS.md'));
const readme = sections(read('README.md'));
const intro = read('FINDINGS.md').split(/\n## /)[0].replace(/^# .*\n/, '');
const used = new Set(); const catSecs = CATS.map(c => { const s = findings.filter(f => !used.has(f) && c.match.test(f.title)); s.forEach(x => used.add(x)); return { ...c, secs: s }; });
// Sidebar / page order: one category per attack, in the order the attacks happen in the fight (pull → Staff → Spear → Sword →
// last phase), then the table of all other attack shapes; then adds / arena / planner; then research notes.
// (CATS above is the MATCHING order — first match wins — so it is kept as is.)
const ORDER = [
  ['Attacks & mechanics, in fight order', ['order', 'fixated', 'greens', 'annorb', 'shackles', 'cosmiccharge', 'worldpiercer', 'ragingstorm', 'echoing', 'slice', 'excision', 'swordadd', 'pd', 'bug', 'overlap', 'shapes', 'conditions']],
  ['Adds, breakbars, arena & planner', ['orbs', 'breakbars', 'immunity', 'phasetimes', 'empowered', 'dps', 'arena', 'plannerdata']],
  ['Research notes', ['rejected', 'open']]];
findings.filter(f => !used.has(f)).forEach(f => catSecs.push({ id: 'misc-' + catSecs.length, name: f.title.replace(/^\d+[a-z]?\.\s*/, ''), icon: '•', secs: [f] }));
const refTitles = ['The goal behind the research', 'Important IDs', 'Datasets', 'Getting more logs', 'How to run', 'Folder layout', 'Status'];
const ref = refTitles.map(t => readme.find(s => s.title.startsWith(t))).filter(Boolean);

// ---------- data panel ----------
const dataDir = path.join(ROOT, 'data');
const dataFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(f => f.endsWith('.csv')).map(f => { const t = fs.readFileSync(path.join(dataDir, f), 'utf8').trim().split('\n'); return { f, rows: t.length - 1, cols: t[0].split(',').length, kb: (fs.statSync(path.join(dataDir, f)).size / 1024).toFixed(0) }; }) : [];
// log counts: from logs/ when it exists (analysis machine) — saved to data/log_counts.json, which CI (no logs) reads instead
const countsFile = path.join(ROOT, 'data', 'log_counts.json');
const LOGC = (() => { if (fs.existsSync(path.join(ROOT, 'logs'))) { const c = Object.fromEntries(['logs/raw', 'logs/ei', 'logs/raw_nm'].map(d => [d, fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).length : 0])); fs.writeFileSync(countsFile, JSON.stringify(c, null, 1)); return c; } try { return JSON.parse(fs.readFileSync(countsFile, 'utf8')); } catch (e) { return {}; } })();
const count = d => LOGC[d] || 0;
const tagCounts = {}; for (const m of read('FINDINGS.md').matchAll(/\[(solid|likely|open|REJECTED)/gi)) tagCounts[m[1].toLowerCase()] = (tagCounts[m[1].toLowerCase()] || 0) + 1;
const scripts = fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.js')).map(f => { const first = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8').split('\n').find(l => l.startsWith('//')) || ''; return { f, d: first.replace(/^\/\/\s*/, '') }; });
const built = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

// ---------- "Raid planner data": generated from exactly the files the planner uses, so docs and planner can't diverge ----------
const pj = p => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch (e) { return null; } };
const BBS = pj('data/breakbars_summary.json') || {};
const AR = pj('data/arena.json'), PRE = pj('docs-src/presets.json'), WPS = pj('data/worldpiercer_summary.json'), CCS = pj('data/cosmic_charge_summary.json');
const mk = v => (v * 0.0254).toFixed(3); const n0 = v => Math.round(v).toLocaleString('en-US');
const tbl = (head, rows) => `<div class="tw"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const compass = a => ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][((Math.round(a / 45) % 8) + 8) % 8];
let plannerCards = [];
if (AR) {
  const C = AR.centre; const sp = Object.entries(AR.spawns || {}).filter(([k]) => /Aspect/.test(k));
  plannerCards.push(['Arena', `<p>Map / squad-marker tool coordinates = arcdps world × 0.0254. North = up (world y increases upward).</p>` + tbl(['', 'map (marker tool)', 'arcdps world', 'notes'], [
    ['Vloxx / arena centre', `<b>${mk(C.x)}, ${mk(C.y)}</b>`, `${C.x}, ${C.y}`, `last-phase position, ${C.samples} logs`],
    ['Platform', '—', '—', `radius ≈ ${n0(AR.platformRadius)}; 99 % of player positions within ${n0(AR.radius.p99)} (${n0(AR.positions)} samples)`],
    ['Entrance (start)', AR.entrance ? `<b>${mk(AR.entrance.x)}, ${mk(AR.entrance.y)}</b>` : '—', AR.entrance ? `${AR.entrance.x}, ${AR.entrance.y}` : '—', AR.entrance ? `${n0(AR.entrance.dist)} west of the centre (average start position)` : '']])]);
  plannerCards.push(['Aspect spawn points', `<p>Each Aspect always spawns at exactly the same point (respawn 40 s after death).</p>` + tbl(['Aspect', 'map (marker tool)', 'arcdps world', 'from centre', 'spawns seen'],
    sp.map(([k, p]) => [k, `<b>${mk(p.x)}, ${mk(p.y)}</b>`, `${p.x}, ${p.y}`, n0(Math.hypot(p.x - C.x, p.y - C.y)), `${p.n}${p.variants > 1 ? ` (${p.variants} variants)` : ''}`]))]);
  plannerCards.push(['Cosmic add spawn points (Piercer / Bulwark / Sunderer)', `<p>The purple circles on the planner map. 8 fixed points every ~45° around the centre; all three Cosmic add types use them.</p>` +
    tbl(['#', 'direction', 'map (marker tool)', 'arcdps world', 'from centre', 'Piercer / Bulwark / Sunderer seen'], (AR.cosmicPoints || []).map((p, i) => [i + 1, `${compass(p.angle)} (${p.angle}°)`, `<b>${mk(p.x)}, ${mk(p.y)}</b>`, `${p.x}, ${p.y}`, n0(p.dist),
      ['Cosmic Piercer', 'Cosmic Bulwark', 'Cosmic Sunderer'].map(k => (p.types || {})[k] || 0).join(' / ')]))]);
}
if (PRE && PRE.units) plannerCards.push(['Units: hitbox radius and breakbar', tbl(['unit', 'hitbox radius', 'breakbar size', 'bar drains by itself', 'median time to break', 'source'], PRE.units.filter(u => u.key !== 'npc').map(u => { const b = BBS[u.label];
    return [u.label, u.r, b && b.size ? `<b>${n0(b.size.median)}</b> (${n0(b.size.p10)}–${n0(b.size.p90)})` : '—', b && b.selfDrainPerS ? b.selfDrainPerS + ' / s' : '—', b && b.timeToBreakS ? b.timeToBreakS.median + ' s' : '—', esc(u.source || '') + (b ? '; breakbar measured (data/breakbars_summary.json)' : '')]; }))]);
if (PRE) plannerCards.push(['Attack presets', `<p>Every attack the planner can draw, with the size it uses. "§5d" = measured from raw logs (see Attack shapes).</p>` +
  tbl(['attack', 'shape', 'size', 'caster', 'skill id', 'notes', 'source'], [
    ...(CCS ? [['<b>Cosmic Charge</b>', 'dash + knockdown band + trail', `dash ${n0(CCS.dashLength)} toward the fixated player; start knockdown r ${CCS.startRadius}; band ±${CCS.dashSideReach || 600} (front ~${CCS.dashFrontReach || 650}); trail ${2 * CCS.trailHalfWidth} wide until ~${CCS.trailEndS} s`, 'Vloxx', '80512', `cast ${CCS.castS} s; knockdown pulses at ${(CCS.knockPulsesS || []).join(', ')} s; Stability prevents it`, `measured, ${CCS.casts} casts (data/cosmic_charge_summary.json)`]] : []),
    ...(WPS ? [['<b>Worldpiercer</b>', `${Object.keys(WPS.perCast || { 6: 1 })[0]}-spoke star`, `${(WPS.gapDeg || [60])[0]}° apart, ${WPS.width} wide, to the arena edge (~${n0(WPS.endFromCentre)} from centre)`, 'Vloxx', '80916', `projectiles ~${n0(WPS.speed)} units/s, launched ~${WPS.launchDelayS} s after the cast; Spear phase only`, `measured, ${WPS.casts} casts (data/worldpiercer_summary.json)`]] : []),
    ...(PRE.orbs || []).map(c => ['<b>' + esc(c.label) + '</b>', 'path band + landing zone + expanding ring', `path ${c.pathW} wide along Vloxx's facing, ${n0(c.distance)} long; landing zone radius ${c.fieldR}; ring expanding at ~${c.waveSpeed} units/s to ~${n0(c.waveReach)}`, esc(c.caster || ''), esc(c.skill || ''), esc(c.note || ''), esc(c.source || '')]),
    ...(PRE.portals || []).map(c => ['<b>' + esc(c.label) + '</b>', 'hit + portal (entrance and exit)', `hit radius ${c.hitR} at ${c.hitAtS} s; portal entrance radius ${c.portalR} on the same spot from ${c.portalFromS} s for ~${c.portalOpenS} s; exit radius ${c.portalR}, ${n0(c.distance)} away`, esc(c.caster || ''), esc(c.skill || ''), esc(c.note || ''), esc(c.source || '')]),
    ...PRE.circles.filter(c => c.label !== 'Custom').map(c => [esc(c.label), 'circle', `radius ${c.r}`, esc(c.caster || ''), esc(c.skill || ''), esc(c.note || ''), esc(c.source || '')]),
    ...PRE.cones.filter(c => c.label !== 'Custom').map(c => [esc(c.label), 'cone', `${c.spread}°, radius ${c.r}`, esc(c.caster || ''), esc(c.skill || ''), esc(c.note || ''), esc(c.source || '')]),
    ...PRE.beams.filter(c => c.label !== 'Custom').map(c => [esc(c.label), 'line / band', `${c.w} wide${c.len ? `, ~${n0(c.len)} long` : ''}`, esc(c.caster || ''), esc(c.skill || ''), esc(c.note || ''), esc(c.source || '')])])]);
const plannerSection = plannerCards.length ? `<section class="cat" id="plannerdata"><h2><span class="ic">⌗</span>Raid planner data</h2><p class="sub">Generated from data/arena.json, docs-src/presets.json and the measured mechanic summaries — the same files the planner reads.</p>${plannerCards.map(([t, h], k) => `<article class="card" id="plannerdata${k}"><h3>${esc(t)}</h3>${h}</article>`).join('')}</section>` : '';

// legal / disclaimer (docs-src/legal.md): footer of the knowledge base + "About & legal" dialog (both views)
const legalMd = (() => { try { return fs.readFileSync(path.join(ROOT, 'docs-src', 'legal.md'), 'utf8'); } catch (e) { return ''; } })().replace(/\{\{CONTACT\}\}/g, CONTACT_DISCORD);
const legalBody = md(legalMd.replace(/^## .*\n/, ''));
const legalShort = `Unofficial fan project — not affiliated with or endorsed by ArenaNet or NCSOFT. © ArenaNet, LLC. All rights reserved. NCSOFT, ArenaNet, Guild Wars, Guild Wars 2 and all associated logos and designs are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the property of their respective owners. Data provided as is, without warranty.`;

// ---------- page ----------
const catById = Object.fromEntries(catSecs.map(c => [c.id, c]));
const navLink = c => `<a href="#${c.id}" data-cat="${c.id}"><span class="ic">${c.icon}</span>${esc(c.name)}</a>`;
const pdCat = { id: 'plannerdata', name: 'Raid planner data', icon: '⌗' };
const orderedIds = ORDER.flatMap(([, ids]) => ids);
const leftovers = catSecs.filter(c => !orderedIds.includes(c.id)); // FINDINGS sections without a category go at the end of the fight list
const nav = ORDER.map(([title, ids], gi) => `<div class="navh">${esc(title)}</div>` + ids.map(id => id === 'plannerdata' ? (plannerSection ? navLink(pdCat) : '') : catById[id] ? navLink(catById[id]) : '').join('') + (gi === 0 ? leftovers.map(navLink).join('') : '')).join('') +
  '<div class="navh">Reference</div>' + ref.map((s, k) => `<a href="#ref${k}"><span class="ic">§</span>${esc(s.title)}</a>`).join('') + '<a href="#files"><span class="ic">▤</span>Data & scripts</a>';
const secNum = t => (t.match(/^(\d+[a-z]?)\.\s/) || [])[1]; const noNum = t => t.replace(/^\d+[a-z]?\.\s*/, '');
// short name of a section for cross-references: the title without its number, tags and subtitle
const secName = Object.fromEntries(findings.filter(s => secNum(s.title)).map(s => [secNum(s.title), noNum(s.title).replace(/\s*\*{0,2}\[[^\]]*\]\*{0,2}\s*$/, '').replace(/^★\s*/, '').split(/ — | \(|: /)[0].trim()]));
const xref = html => html.replace(/§\s?(\d+[a-z]?)(?![\w])/g, (m, n) => secName[n] ? `<a href="#sec-${n}">${esc(secName[n])}</a>` : m);
const secHtml = c => xref(`<section class="cat" id="${c.id}"><h2><span class="ic">${c.icon}</span>${esc(c.name)}</h2>${c.secs.map(s => `<article class="card"${secNum(s.title) ? ` id="sec-${secNum(s.title)}"` : ''}><h3>${inline(noNum(s.title))}</h3>${md(s.body)}</article>`).join('')}</section>`);
const body = ORDER.map(([, ids], gi) => ids.map(id => id === 'plannerdata' ? xref(plannerSection) : catById[id] ? secHtml(catById[id]) : '').join('') + (gi === 0 ? leftovers.map(secHtml).join('') : '')).join('') +
  `<section class="cat" id="reference"><h2><span class="ic">§</span>Reference</h2>${ref.map((s, k) => `<article class="card" id="ref${k}"><h3>${inline(s.title)}</h3>${xref(md(s.body))}</article>`).join('')}</section>` +
  `<section class="cat" id="files"><h2><span class="ic">▤</span>Data & scripts</h2><article class="card"><h3>Datasets (data/)</h3><div class="tw"><table><thead><tr><th>file</th><th>rows</th><th>columns</th><th>size</th></tr></thead><tbody>${dataFiles.map(d => `<tr><td><a href="${BASE}data/${d.f}"><code>${d.f}</code></a></td><td>${d.rows}</td><td>${d.cols}</td><td>${d.kb} KB</td></tr>`).join('')}</tbody></table></div>
   <p>Logs: <strong>${count('logs/raw')}</strong> raw CM .zevtc · <strong>${count('logs/ei')}</strong> EI JSON · <strong>${count('logs/raw_nm')}</strong> raw NM.</p></article>
   <article class="card"><h3>Scripts (scripts/)</h3><div class="tw"><table><thead><tr><th>script</th><th>what it does</th></tr></thead><tbody>${scripts.map(s => `<tr><td><a href="${BASE}scripts/${s.f}"><code>${s.f}</code></a></td><td>${xref(esc(s.d))}</td></tr>`).join('')}</tbody></table></div></article></section>`;

// Raid planner tab: CSS/JS from docs-src/, arena geometry from data/arena.json (scripts/build_arena.js)
const rd = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return ''; } };
const feedbackJs = rd('docs-src/feedback.js').replace(/<\/script/gi, '<\\/script');
const plannerCss = rd('docs-src/planner.css'), plannerJs = rd('docs-src/planner.js').replace(/<\/script/gi, '<\\/script'), arenaJson = rd('data/arena.json') || 'null';
// shared fight-plan templates (docs-src/plans/*.json, validated by build_plans.js) + measured mechanics for planner presets
const safeJson = o => JSON.stringify(o).replace(/</g, '\\u003c');
const plansJson = safeJson(require('./build_plans').buildPlans());
const rdJson = p => { try { return JSON.parse(rd(p)); } catch (e) { return null; } };
const presets = rdJson('docs-src/presets.json') || { circles: [], cones: [], beams: [] }; const presetsJson = safeJson(presets);
// Green groups tab: docs-src/greens.js + greens.css, data = docs-src/green_groups.json + what each specialisation plays in the logs (scripts/spec_weapons.js)
const greensCss = rd('docs-src/greens.css'), greensJs = rd('docs-src/greens.js').replace(/<\/script/gi, '<\\/script'), greensScanJs = rd('docs-src/greens_scan.js').replace(/<\/script/gi, '<\\/script'), greensJson = safeJson({ ...(rdJson('docs-src/green_groups.json') || {}), logs: rdJson('data/spec_weapons.json'), icons: rdJson('docs-src/spec_icons.json') || {} });
const mechJson = safeJson({ worldpiercer: rdJson('data/worldpiercer_summary.json'), cosmicCharge: rdJson('data/cosmic_charge_summary.json') });

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vloxx CM Research</title><style>
:root{--bg:#f6f5f2;--panel:#fff;--ink:#1f2328;--mute:#5b6370;--line:#e3e1dc;--acc:#2f6f5e;--accbg:#e6f1ed;--code:#f0eee9;
--solid:#1f7a4d;--solidbg:#e3f3ea;--likely:#8a6200;--likelybg:#fbf1d6;--open:#4459a8;--openbg:#e7ebf8;--rej:#a33a3a;--rejbg:#f8e5e5}
@media (prefers-color-scheme:dark){:root{--bg:#15171a;--panel:#1d2024;--ink:#e6e6e3;--mute:#9aa1ab;--line:#30343a;--acc:#6cc3a8;--accbg:#1f3530;--code:#272b31;
--solid:#6fd09c;--solidbg:#1d3528;--likely:#e0b54a;--likelybg:#3a3220;--open:#93a6ee;--openbg:#262c45;--rej:#f08a8a;--rejbg:#3d2526}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:16px}
/* scrollbars follow the page palette (light / dark) everywhere: page, sidebar, tables, planner panels, dialogs */
:root{color-scheme:light dark;--sb-thumb:color-mix(in srgb,var(--mute) 45%,transparent);--sb-thumb-hover:var(--acc)}
*{scrollbar-width:thin;scrollbar-color:var(--sb-thumb) transparent}
::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--sb-thumb);border-radius:8px;border:2px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background:var(--sb-thumb-hover);background-clip:padding-box;border:2px solid transparent}
::-webkit-scrollbar-corner{background:transparent}
html{scrollbar-color:var(--sb-thumb) var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{display:grid;grid-template-columns:270px minmax(0,1fr);min-height:calc(100vh - 46px)}
.topbar{position:sticky;top:0;z-index:20;height:46px;display:flex;align-items:center;gap:4px;padding:0 14px;background:var(--panel);border-bottom:1px solid var(--line)}
.topbar b{margin-right:14px;font-size:14px}.topbar a{padding:7px 12px;border-radius:8px;color:var(--mute);text-decoration:none;font-weight:600;font-size:14px}
.topbar a.on{background:var(--accbg);color:var(--acc)}.topbar a.ext:hover{color:var(--acc)}body .topbar a.brand{padding:7px 0;color:var(--ink)}.topbar a.brand:hover{color:var(--acc)}
/* the bar never wraps: items keep one line, the bar tightens as the window narrows, and scrolls sideways as a last resort */
.topbar{overflow-x:auto;scrollbar-width:none}.topbar::-webkit-scrollbar{display:none}.topbar>*,.topbar .fb>*{flex:0 0 auto;white-space:nowrap}
@media (max-width:1180px){.topbar{gap:2px;padding:0 10px}body .topbar b{margin-right:6px}body .topbar a{padding:7px 8px;font-size:13.5px}.topbar .fb button{padding:6px 8px;font-size:12.5px}.topbar .fb{gap:4px;padding-left:8px}}
@media (max-width:980px){body .topbar b{display:none}.topbar .gg-exp{font-size:0;padding:0;margin-left:3px;width:8px;height:8px;display:inline-block;border-radius:50%;background:var(--likely)}}
@media (max-width:820px){body .topbar a{padding:7px 6px;font-size:13px}.topbar .fb button{padding:5px 6px;font-size:12px}}
@media (max-width:780px){.topbar .fb button{font-size:0}.topbar .fb button::before{font-size:12px}.topbar .fb [data-fb=feedback]::before{content:"Feedback"}.topbar .fb [data-legal]::before{content:"About"}.topbar .fb [data-fb=bug]::before{content:"Bug"}}
@media (max-width:600px){body .topbar a{padding:7px 5px;font-size:12.5px}body .topbar a.ext{font-size:0}body .topbar a.ext::before{content:"Thumbnails ↗";font-size:12.5px}.topbar .fb [data-fb=feedback]{display:none}}
.topbar .fb{margin-left:auto;display:flex;gap:6px}.topbar button{font:600 13px system-ui,sans-serif;padding:6px 11px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}
.topbar button:hover{border-color:var(--acc);color:var(--acc)}
.legal{margin-top:40px;padding:16px 18px;border-top:1px solid var(--line);color:var(--mute);font-size:12px;line-height:1.55}
.legal a,.legal button{color:var(--mute)}.legal button{background:none;border:0;padding:0;font:inherit;text-decoration:underline;cursor:pointer}
.legal-box{font-size:13.5px}.legal-box p{margin:8px 0}
.fb-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:80;padding:16px}
.fb-box{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:18px 20px;width:min(560px,100%);max-height:90vh;overflow:auto}
.fb-box h4{margin:0 0 8px;font-size:17px}.fb-box p{margin:8px 0}.fb-name{display:flex;gap:8px;align-items:center;margin:10px 0;flex-wrap:wrap}
.fb-name code{font-size:16px;padding:4px 10px}.fb-box textarea{width:100%;min-height:150px;font:12.5px ui-monospace,Consolas,monospace;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px;box-sizing:border-box}
.fb-box button{font:600 13px system-ui,sans-serif;padding:6px 11px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}.fb-box button:hover{border-color:var(--acc);color:var(--acc)}
.fb-row{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap}.fb-ok{color:var(--solid);font-size:12px;min-width:60px}
@media (max-width:640px){.topbar b{display:none}.topbar a{padding:7px 8px}.topbar button{padding:6px 8px}}body.planner .wrap{display:none}html{scroll-padding-top:62px}
aside{position:sticky;top:46px;height:calc(100vh - 46px);overflow:auto;border-right:1px solid var(--line);background:var(--panel);padding:20px 14px}
aside h1{font-size:17px;margin:0 0 2px}aside .sub{color:var(--mute);font-size:12px;margin-bottom:14px}
#q{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;margin-bottom:12px}
nav a{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:7px;color:var(--ink);text-decoration:none;font-size:14px}
nav a:hover,nav a.on{background:var(--accbg);color:var(--acc)}.ic{width:18px;text-align:center;color:var(--acc);flex:none}
.navh{margin:14px 8px 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mute)}
.legend{margin-top:16px;font-size:12px;color:var(--mute);display:flex;flex-wrap:wrap;gap:6px}
main{min-width:0;overflow-wrap:anywhere;padding:28px clamp(16px,4vw,48px) 80px;max-width:1100px}
.hero{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px 22px;margin-bottom:22px}
.hero h2{margin:0 0 6px;font-size:22px}.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.stat{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:8px 12px;font-size:13px}.stat b{display:block;font-size:18px}
.cat{margin-top:30px}.cat>h2{display:flex;gap:10px;align-items:center;font-size:20px;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid var(--line)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin:0 0 14px}
.card h3{margin:0 0 8px;font-size:16px}.card h4{margin:14px 0 6px;font-size:14px}
ul,ol{padding-left:22px;margin:6px 0}li{margin:3px 0}p{margin:8px 0}
code{background:var(--code);padding:1px 5px;border-radius:5px;font:12.5px ui-monospace,Consolas,monospace;overflow-wrap:anywhere;word-break:break-word}
pre{background:var(--code);padding:10px 12px;border-radius:8px;overflow:auto}pre code{padding:0;background:none;overflow-wrap:normal;word-break:normal}
.tw{overflow-x:auto;margin:8px 0}table{border-collapse:collapse;font-size:13.5px;min-width:60%}
th,td{border:1px solid var(--line);padding:5px 9px;text-align:left;vertical-align:top;overflow-wrap:normal}th{background:var(--bg)}
a{color:var(--acc)}.tag{display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;margin:0 2px;white-space:nowrap}
.tag-solid{color:var(--solid);background:var(--solidbg)}.tag-likely{color:var(--likely);background:var(--likelybg)}
.tag-open{color:var(--open);background:var(--openbg)}.tag-rejected{color:var(--rej);background:var(--rejbg)}
.star{color:var(--likely)}mark{background:var(--likelybg);color:inherit;border-radius:3px}
.hide{display:none}#none{display:none;color:var(--mute);padding:20px}
@media (max-width:820px){.wrap{grid-template-columns:1fr}aside{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}}
${plannerCss}
${greensCss}</style></head><body><div class="topbar"><a href="#top" class="brand" title="Back to the home page (knowledge base)"><b>Vloxx CM</b></a><a href="#top" data-view="kb" class="on">Knowledge base</a><a href="#planner" data-view="planner">Raid planner</a><a href="#greens" data-view="greens">Green groups <span class="gg-exp">experimental</span></a><a href="https://chocciee.github.io/thumbnail-maker-for-the-uncs/" target="_blank" rel="noopener" class="ext" title="A small thumbnail tool made by a friend (opens in a new tab)">Thumbnail maker ↗</a><span class="fb"><button type="button" data-fb="feedback" title="Send feedback to ${CONTACT_DISCORD} on Discord">Feedback</button><button type="button" data-legal title="Disclaimer, trademarks and copyright">About & legal</button><button type="button" data-fb="bug" title="Report a bug to ${CONTACT_DISCORD} on Discord">Report a bug</button></span></div><div class="wrap" id="top"><aside><h1>Vloxx CM Research</h1><div class="sub">Nexus of Eternity · boss 28106 · built ${built}</div>
<input id="q" type="search" placeholder="Search findings… (e.g. fixated, 120s, orbs)"><nav>${nav}</nav>
<div class="legend"><span class="tag tag-solid">solid</span><span class="tag tag-likely">likely</span><span class="tag tag-open">open</span><span class="tag tag-rejected">REJECTED</span></div></aside>
<main><div class="hero"><h2>What we know about Vloxx CM</h2>${md(intro)}<div class="stats">
<div class="stat"><b>${count('logs/raw') + count('logs/ei')}</b>logs analysed</div>
${dataFiles.map(d => d.f === 'green_rounds.csv' ? `<div class="stat"><b>${d.rows}</b>green rounds</div>` : d.f === 'ascension_sacrifice_2green.csv' ? `<div class="stat"><b>${d.rows}</b>shackle picks</div>` : d.f === 'ascension_orbs.csv' ? `<div class="stat"><b>${d.rows}</b>orbs tracked</div>` : '').join('')}
${Object.entries(tagCounts).map(([k, v]) => `<div class="stat"><b>${v}</b>${k} findings</div>`).join('')}</div></div>
${body}<div id="none">No matching findings.</div>
<footer class="legal"><p>${esc(legalShort)}</p><p>Contact: <b>${esc(CONTACT_DISCORD)}</b> on Discord · <button type="button" data-legal>Full disclaimer & legal</button> · page built ${built}</p></footer></main></div><div id="planner-root"></div><div id="greens-root"></div>
<script>
const q=document.getElementById('q'),cards=[...document.querySelectorAll('.card')],cats=[...document.querySelectorAll('.cat')];
cards.forEach(c=>c.dataset.html=c.innerHTML);
q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();let any=false;
 cards.forEach(c=>{c.innerHTML=c.dataset.html;const hit=!t||c.textContent.toLowerCase().includes(t);c.classList.toggle('hide',!hit);
  if(hit&&t){any=true;const w=document.createTreeWalker(c,NodeFilter.SHOW_TEXT);const ns=[];while(w.nextNode())ns.push(w.currentNode);
   ns.forEach(n=>{const i=n.data.toLowerCase().indexOf(t);if(i<0||n.parentNode.closest('mark'))return;const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+t.length);const m=document.createElement('mark');r.surroundContents(m);});}
  else if(hit)any=true;});
 cats.forEach(s=>s.classList.toggle('hide',![...s.querySelectorAll('.card')].some(c=>!c.classList.contains('hide'))));
 document.getElementById('none').style.display=any?'none':'block';});
const links=[...document.querySelectorAll('nav a')];const targets=links.map(a=>document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
let pinned=null,pinT=0;const setOn=id=>links.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+id));
function spy(){if(pinned&&Date.now()-pinT<1200)return;pinned=null;const line=90;let cur=null;for(const s of targets){if(s.offsetParent===null)continue;if(s.getBoundingClientRect().top-line<=0)cur=s;}
 if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4){const vis=targets.filter(s=>s.offsetParent!==null);cur=vis[vis.length-1]||cur;}if(cur)setOn(cur.id);}
links.forEach(a=>a.addEventListener('click',()=>{pinned=a.getAttribute('href').slice(1);pinT=Date.now();setOn(pinned);}));
['wheel','touchstart','keydown'].forEach(t=>window.addEventListener(t,()=>{pinT=0;},{passive:true}));window.addEventListener('scroll',spy,{passive:true});spy();
</script><script>window.ARENA=${arenaJson};window.PLANS=${plansJson};window.MECH=${mechJson};window.PRESETS=${presetsJson};</script><script>${plannerJs}</script><script>window.GREENS=${greensJson};</script><script>${greensScanJs}</script><script>${greensJs}</script>
<script>
function view(){const pl=/^#planner($|=)/.test(location.hash),gg=/^#greens($|=)/.test(location.hash),cur=pl?'planner':gg?'greens':'kb';document.body.classList.toggle('planner',pl);document.getElementById('planner-root').classList.toggle('on',pl);
 document.body.classList.toggle('greens',gg);document.getElementById('greens-root').classList.toggle('on',gg);
 document.querySelectorAll('.topbar a').forEach(a=>a.classList.toggle('on',a.dataset.view===cur));if(pl)window.VloxxPlanner.boot();else document.querySelectorAll('.pl-modal').forEach(m=>m.remove());if(gg)window.VloxxGreens.boot();}
window.addEventListener('hashchange',view);view();
</script><template id="legal-tpl"><div class="fb-box legal-box" role="dialog" aria-modal="true"><h4>About & legal</h4>${legalBody}<div class="fb-row"><button type="button" data-c="close">Close</button></div></div></template>
<script>document.querySelectorAll('[data-legal]').forEach(b=>b.addEventListener('click',()=>{const m=document.createElement('div');m.className='fb-modal';m.appendChild(document.getElementById('legal-tpl').content.cloneNode(true));document.body.appendChild(m);
 const close=()=>{m.remove();document.removeEventListener('keydown',k)};const k=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',k);
 m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-c=close]'))close()});m.querySelector('[data-c=close]').focus()}));</script>
<script>window.FEEDBACK=${JSON.stringify({ name: CONTACT_DISCORD, built })};</script><script>${feedbackJs}
</script></body></html>`;
fs.mkdirSync(OUTDIR, { recursive: true });
// last safety net: no real player name may reach the published page (scripts/anonymise.js)
const pageHtml = (() => { try { return require('./anonymise').load().apply(html); } catch (e) { if (process.env.CI) throw e; console.warn('anonymiser unavailable:', e.message); return html; } })();
fs.writeFileSync(path.join(OUTDIR, 'index.html'), pageHtml);
console.log('wrote', path.relative(ROOT, path.join(OUTDIR, 'index.html')), '—', catSecs.length, 'categories,', ref.length, 'reference sections,', dataFiles.length, 'datasets');
