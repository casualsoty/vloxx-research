// Builds docs/index.html — a static, self-contained documentation page generated from FINDINGS.md + README.md + data/.
// Re-run after every change to the research notes:   node scripts/build_docs.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
// DOCS_BASE = prefix for links to repo files (default '../' when the page sits in docs/), DOCS_OUT = output folder
const BASE = process.env.DOCS_BASE ?? '../';
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
const CATS = [
  { id: 'greens', name: '3-people greens', icon: '◉', match: /^1\.|green rounds/i },
  { id: 'fixated', name: 'Fixated', icon: '◎', match: /^2\.|^Fixated/i },
  { id: 'bug', name: 'Fewer greens (timing bug)', icon: '★', match: /^3\.|timing bug/i },
  { id: 'pd', name: 'Probability Distribution', icon: '◌', match: /^4\.|Probability/i },
  { id: 'shackles', name: '2-people green shackles', icon: '⛓', match: /^5b\.|Sacrifice/i },
  { id: 'orbs', name: 'Ascension orbs & Aspects', icon: '✦', match: /^5\.|orbs/i },
  { id: 'arena', name: 'Arena coordinates', icon: '⌖', match: /^5c\.|coordinates/i },
  { id: 'rejected', name: 'Rejected hypotheses', icon: '✕', match: /^6\.|REJECTED/i },
  { id: 'open', name: 'Open questions', icon: '?', match: /^7\.|Open questions/i },
];
const findings = sections(read('FINDINGS.md'));
const readme = sections(read('README.md'));
const intro = read('FINDINGS.md').split(/\n## /)[0].replace(/^# .*\n/, '');
const used = new Set(); const catSecs = CATS.map(c => { const s = findings.filter(f => !used.has(f) && c.match.test(f.title)); s.forEach(x => used.add(x)); return { ...c, secs: s }; });
findings.filter(f => !used.has(f)).forEach(f => catSecs.push({ id: 'misc-' + catSecs.length, name: f.title.replace(/^\d+[a-z]?\.\s*/, ''), icon: '•', secs: [f] }));
const refTitles = ['The goal behind the research', 'Important IDs', 'Datasets', 'Getting more logs', 'How to run', 'Folder layout', 'Status'];
const ref = refTitles.map(t => readme.find(s => s.title.startsWith(t))).filter(Boolean);

// ---------- data panel ----------
const dataDir = path.join(ROOT, 'data');
const dataFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(f => f.endsWith('.csv')).map(f => { const t = fs.readFileSync(path.join(dataDir, f), 'utf8').trim().split('\n'); return { f, rows: t.length - 1, cols: t[0].split(',').length, kb: (fs.statSync(path.join(dataDir, f)).size / 1024).toFixed(0) }; }) : [];
const count = d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).length : 0;
const tagCounts = {}; for (const m of read('FINDINGS.md').matchAll(/\[(solid|likely|open|REJECTED)/gi)) tagCounts[m[1].toLowerCase()] = (tagCounts[m[1].toLowerCase()] || 0) + 1;
const scripts = fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.js')).map(f => { const first = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8').split('\n').find(l => l.startsWith('//')) || ''; return { f, d: first.replace(/^\/\/\s*/, '') }; });
const built = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

// ---------- page ----------
const nav = catSecs.map(c => `<a href="#${c.id}" data-cat="${c.id}"><span class="ic">${c.icon}</span>${esc(c.name)}</a>`).join('') +
  '<div class="navh">Reference</div>' + ref.map((s, k) => `<a href="#ref${k}"><span class="ic">§</span>${esc(s.title)}</a>`).join('') + '<a href="#files"><span class="ic">▤</span>Data & scripts</a>';
const body = catSecs.map(c => `<section class="cat" id="${c.id}"><h2><span class="ic">${c.icon}</span>${esc(c.name)}</h2>${c.secs.map(s => `<article class="card"><h3>${inline(s.title)}</h3>${md(s.body)}</article>`).join('')}</section>`).join('') +
  `<section class="cat" id="reference"><h2><span class="ic">§</span>Reference</h2>${ref.map((s, k) => `<article class="card" id="ref${k}"><h3>${inline(s.title)}</h3>${md(s.body)}</article>`).join('')}</section>` +
  `<section class="cat" id="files"><h2><span class="ic">▤</span>Data & scripts</h2><article class="card"><h3>Datasets (data/)</h3><div class="tw"><table><thead><tr><th>file</th><th>rows</th><th>columns</th><th>size</th></tr></thead><tbody>${dataFiles.map(d => `<tr><td><a href="${BASE}data/${d.f}"><code>${d.f}</code></a></td><td>${d.rows}</td><td>${d.cols}</td><td>${d.kb} KB</td></tr>`).join('')}</tbody></table></div>
   <p>Logs: <strong>${count('logs/raw')}</strong> raw CM .zevtc · <strong>${count('logs/ei')}</strong> EI JSON · <strong>${count('logs/raw_nm')}</strong> raw NM.</p></article>
   <article class="card"><h3>Scripts (scripts/)</h3><div class="tw"><table><thead><tr><th>script</th><th>what it does</th></tr></thead><tbody>${scripts.map(s => `<tr><td><a href="${BASE}scripts/${s.f}"><code>${s.f}</code></a></td><td>${esc(s.d)}</td></tr>`).join('')}</tbody></table></div></article></section>`;

// Raid planner tab: CSS/JS from docs-src/, arena geometry from data/arena.json (scripts/build_arena.js)
const rd = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return ''; } };
const plannerCss = rd('docs-src/planner.css'), plannerJs = rd('docs-src/planner.js').replace(/<\/script/gi, '<\\/script'), arenaJson = rd('data/arena.json') || 'null';
// shared fight-plan templates (docs-src/plans/*.json, validated by build_plans.js) + measured mechanics for planner presets
const safeJson = o => JSON.stringify(o).replace(/</g, '\\u003c');
const plansJson = safeJson(require('./build_plans').buildPlans());
const mechJson = safeJson({ worldpiercer: (() => { try { return JSON.parse(rd('data/worldpiercer_summary.json')); } catch (e) { return null; } })() });

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vloxx CM Research</title><style>
:root{--bg:#f6f5f2;--panel:#fff;--ink:#1f2328;--mute:#5b6370;--line:#e3e1dc;--acc:#2f6f5e;--accbg:#e6f1ed;--code:#f0eee9;
--solid:#1f7a4d;--solidbg:#e3f3ea;--likely:#8a6200;--likelybg:#fbf1d6;--open:#4459a8;--openbg:#e7ebf8;--rej:#a33a3a;--rejbg:#f8e5e5}
@media (prefers-color-scheme:dark){:root{--bg:#15171a;--panel:#1d2024;--ink:#e6e6e3;--mute:#9aa1ab;--line:#30343a;--acc:#6cc3a8;--accbg:#1f3530;--code:#272b31;
--solid:#6fd09c;--solidbg:#1d3528;--likely:#e0b54a;--likelybg:#3a3220;--open:#93a6ee;--openbg:#262c45;--rej:#f08a8a;--rejbg:#3d2526}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:16px}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{display:grid;grid-template-columns:270px minmax(0,1fr);min-height:calc(100vh - 46px)}
.topbar{position:sticky;top:0;z-index:20;height:46px;display:flex;align-items:center;gap:4px;padding:0 14px;background:var(--panel);border-bottom:1px solid var(--line)}
.topbar b{margin-right:14px;font-size:14px}.topbar a{padding:7px 12px;border-radius:8px;color:var(--mute);text-decoration:none;font-weight:600;font-size:14px}
.topbar a.on{background:var(--accbg);color:var(--acc)}body.planner .wrap{display:none}html{scroll-padding-top:62px}
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
${plannerCss}</style></head><body><div class="topbar"><b>Vloxx CM</b><a href="#top" data-view="kb" class="on">Knowledge base</a><a href="#planner" data-view="planner">Raid planner</a></div><div class="wrap" id="top"><aside><h1>Vloxx CM Research</h1><div class="sub">Nexus of Eternity · boss 28106 · built ${built}</div>
<input id="q" type="search" placeholder="Search findings… (e.g. fixated, 120s, orbs)"><nav>${nav}</nav>
<div class="legend"><span class="tag tag-solid">solid</span><span class="tag tag-likely">likely</span><span class="tag tag-open">open</span><span class="tag tag-rejected">REJECTED</span></div></aside>
<main><div class="hero"><h2>What we know about Vloxx CM</h2>${md(intro)}<div class="stats">
<div class="stat"><b>${count('logs/raw') + count('logs/ei')}</b>logs analysed</div>
${dataFiles.map(d => d.f === 'green_rounds.csv' ? `<div class="stat"><b>${d.rows}</b>green rounds</div>` : d.f === 'ascension_sacrifice_2green.csv' ? `<div class="stat"><b>${d.rows}</b>shackle picks</div>` : d.f === 'ascension_orbs.csv' ? `<div class="stat"><b>${d.rows}</b>orbs tracked</div>` : '').join('')}
${Object.entries(tagCounts).map(([k, v]) => `<div class="stat"><b>${v}</b>${k} findings</div>`).join('')}</div></div>
${body}<div id="none">No matching findings.</div></main></div><div id="planner-root"></div>
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
const links=[...document.querySelectorAll('nav a')];const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){links.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id));}}),{rootMargin:'-20% 0px -70% 0px'});
document.querySelectorAll('.cat,.card[id]').forEach(s=>io.observe(s));
</script><script>window.ARENA=${arenaJson};window.PLANS=${plansJson};window.MECH=${mechJson};</script><script>${plannerJs}</script>
<script>
function view(){const pl=/^#planner/.test(location.hash);document.body.classList.toggle('planner',pl);document.getElementById('planner-root').classList.toggle('on',pl);
 document.querySelectorAll('.topbar a').forEach(a=>a.classList.toggle('on',(a.dataset.view==='planner')===pl));if(pl)window.VloxxPlanner.boot();else document.querySelectorAll('.pl-modal').forEach(m=>m.remove());}
window.addEventListener('hashchange',view);view();
</script></body></html>`;
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, 'index.html'), html);
console.log('wrote', path.relative(ROOT, path.join(OUTDIR, 'index.html')), '—', catSecs.length, 'categories,', ref.length, 'reference sections,', dataFiles.length, 'datasets');
