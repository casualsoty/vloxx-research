// Green groups tool: sorts a squad into three groups of 3 for the 3-people greens (Judgment of Eternity) + 1 joker.
// Data: window.GREENS = docs-src/green_groups.json + data/spec_weapons.json (merged by scripts/build_docs.js). No dependencies.
(function () {
  const G = window.GREENS || {}, LOGS = (G.logs && G.logs.specs) || {}, MINP = G.minPlayersForLogs || 5, KEY = 'vloxx-greens-v1';
  const SPECS = Object.values(G.professions || {}).flat(), profOf = sp => Object.keys(G.professions).find(k => G.professions[k].includes(sp));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // ---- what a specialisation brings (from the logs when it was seen often enough, else the default table) ----
  function rangeOf(sp) { const l = LOGS[sp]; if (l && l.players >= MINP && l.hasMeleeWeaponPct != null) return { v: l.hasMeleeWeaponPct >= 60 ? 'melee' : l.hasMeleeWeaponPct <= 20 ? 'ranged' : 'mixed', why: `${l.hasMeleeWeaponPct} % of ${l.players} ${sp}s in the logs carry a melee weapon (${Object.keys(l.weaponSets)[0]})` };
    return { v: (G.defaultRange || {})[sp] || 'mixed', why: `assumed from the usual builds (${l ? 'only ' + l.players : 'not'} seen in the logs)` }; }
  function hateOf(sp) { const p = profOf(sp), l = LOGS[sp]; return (G.hate || []).filter(h => h.prof === p && (!h.spec || h.spec === sp)).map(h => { const n = l ? (l.castProjectileHate || {})[h.skill] || 0 : 0, seen = l && l.players >= MINP;
    return { ...h, level: seen && n * 2 >= l.players ? 2 : 1, why: seen ? `cast by ${n} of ${l.players} in the logs` : 'not measured' }; }).sort((a, b) => b.level - a.level || (a.weapon ? 1 : 0) - (b.weapon ? 1 : 0)); }
  const BAIT = { melee: 2, mixed: 1, ranged: 0 };
  function facts(p) { const r = rangeOf(p.spec), h = hateOf(p.spec), autoHate = h.length ? h[0].level : 0;
    const range = p.bait === 'auto' ? r.v : p.bait, hate = p.hate === 'auto' ? autoHate : p.hate === 'yes' ? Math.max(2, autoHate) : 0;
    return { bait: BAIT[range], range, rangeWhy: p.bait === 'auto' ? r.why : 'set by hand', hate, skills: h, hateWhy: p.hate === 'auto' ? (h.length ? h.map(x => x.skill).join(', ') : 'no circular ground-area projectile block / reflect') : 'set by hand' }; }
  // ---- the sort: every way to split the squad is scored, best one wins ----
  // Priorities, in order: groups with a circular ground-area projectile block / reflect, how usual those skills are, how melee the baiters are (every
  // group gets a baiter: a melee player first, otherwise a ranged one), players sharing a green group with someone of their subgroup,
  // groups where the two jobs are on two players, a versatile joker.
  function solve(P, fixed) { const pool = P.map((_, i) => i).filter(i => i !== fixed), n = pool.length, g = Math.min(3, Math.floor(n / 3)), F = P.map(facts); let best = null;   // fixed: index of the player chosen as joker, if any
    const score = (groups, jokers) => { let A = 0, B = 0, C = 0, D = 0, E = 0, S = 0; for (const gr of groups) { const b = Math.max(...gr.map(i => F[i].bait)), h = Math.max(...gr.map(i => F[i].hate)); A += b > 0; B += h > 0; C += b; D += h;
        for (let x = 0; x < 3; x++) for (let y = x + 1; y < 3; y++) E += P[gr[x]].sub === P[gr[y]].sub;
        S += gr.some(i => F[i].bait > 0 && gr.some(k => k !== i && F[k].hate > 0)); }
      return [B, D, C, E, S, A, jokers.reduce((t, i) => t + F[i].bait + F[i].hate, 0)]; };
    const better = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
    (function rec(rest, groups, jokers) { if (groups.length === g) { const J = jokers.concat(rest), s = score(groups, J); if (!best || better(s, best.s)) best = { s, groups: groups.map(x => x.slice()), jokers: J }; return; }
      const budget = n - 3 * g - jokers.length;
      for (let a = 0; a < rest.length && a <= budget; a++) for (let b = a + 1; b < rest.length; b++) for (let c = b + 1; c < rest.length; c++)
        rec(rest.filter((_, k) => k > a && k !== b && k !== c), groups.concat([[rest[a], rest[b], rest[c]]]), jokers.concat(rest.slice(0, a))); })(pool, [], []);
    if (!best) return null; if (fixed != null && fixed >= 0) best.jokers.unshift(fixed);
    // inside each group: the baiter is the most melee player, the projectile player the one with the most usual skill (at equal skill, not the baiter)
    const groups = best.groups.map(gr => { const baiter = gr.slice().sort((x, y) => F[y].bait - F[x].bait || F[x].hate - F[y].hate)[0], hp = gr.filter(i => F[i].hate > 0).sort((x, y) => F[y].hate - F[x].hate || (x === baiter) - (y === baiter))[0];
      return { members: gr, baiter, hater: hp == null ? null : hp, warn: hp == null ? ['no circular projectile block / reflect in this group'] : [] }; })
      .sort((a, b) => Math.min(...a.members.map(i => P[i].sub)) - Math.min(...b.members.map(i => P[i].sub)));
    return { groups, jokers: best.jokers, F, score: best.s, expected: g }; }
  // ---- state ----
  const blank = i => ({ name: '', spec: '', sub: i < 5 ? 1 : 2, bait: 'auto', hate: 'auto' });
  let st = Array.from({ length: 10 }, (_, i) => blank(i)), booted = false, root, shots = {};   // shots: tile cut out of the screenshot, per row (not saved)
  const clean = a => Array.from({ length: 10 }, (_, i) => { const p = (a || [])[i] || {}; return { name: String(p.name || '').slice(0, 40), spec: SPECS.includes(p.spec) ? p.spec : '', sub: +p.sub >= 1 && +p.sub <= 5 ? +p.sub : (i < 5 ? 1 : 2), bait: ['melee', 'ranged', 'mixed'].includes(p.bait) ? p.bait : 'auto', hate: ['yes', 'no'].includes(p.hate) ? p.hate : 'auto', joker: !!p.joker && !(a || []).slice(0, i).some(q => q && q.joker) }; });
  const pack = () => btoa(unescape(encodeURIComponent(JSON.stringify(st.map(p => [p.name, p.spec, p.sub, p.bait, p.hate, p.joker ? 1 : 0])))));
  const unpack = s => clean(JSON.parse(decodeURIComponent(escape(atob(s)))).map(a => ({ name: a[0], spec: a[1], sub: a[2], bait: a[3], hate: a[4], joker: a[5] })));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } };
  function load() { const m = /^#greens=(.+)$/.exec(location.hash); if (m) try { st = unpack(m[1]); return; } catch (e) { } try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) st = clean(s); } catch (e) { } }
  // "Name, Specialisation, subgroup" per line (any order, any separator): the specialisation is the word that matches one, the subgroup the lone digit
  function parseList(txt) { let sub = 1; const out = []; for (const raw of txt.split(/\r?\n/)) { const line = raw.trim(); if (!line) continue; const sg = /^(?:sub\s*group|subgroup|group|sub)\s*(\d)\s*:?$/i.exec(line); if (sg) { sub = +sg[1]; continue; }
      const spec = SPECS.slice().sort((a, b) => b.length - a.length).find(s => new RegExp('(^|[^a-z])' + s + '([^a-z]|$)', 'i').test(line)); let rest = spec ? line.replace(new RegExp(spec, 'i'), ' ') : line;
      const d = /(?:^|[\s,;|\t])([1-5])(?:$|[\s,;|\t])/.exec(rest); if (d) rest = rest.replace(d[0], ' '); out.push({ name: rest.replace(/[,;|\t]+/g, ' ').replace(/\s+/g, ' ').trim(), spec: spec || '', sub: d ? +d[1] : sub }); }
    return out.slice(0, 10); }
  // ---- rendering ----
  const chip = sp => sp ? `<span class="gg-ic" style="background:${G.colors[profOf(sp)]}">${(G.icons || {})[sp] ? `<img src="${G.icons[sp]}" alt="">` : ''}</span>` : '<span class="gg-ic"></span>';
  const specOptions = sel => '<option value="">— specialisation —</option>' + Object.entries(G.professions).map(([p, l]) => `<optgroup label="${p}">${l.map(s => `<option${s === sel ? ' selected' : ''}>${s}</option>`).join('')}</optgroup>`).join('');
  const opt = (v, cur, label) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
  function rowHtml(p, i) { const f = p.spec ? facts(p) : null, auto = p.spec ? rangeOf(p.spec).v : '', ah = p.spec ? hateOf(p.spec) : [];
    return `<tr data-i="${i}"><td class="gg-n">${shots[i] ? `<img class="gg-shot${shots[i].unsure ? ' gg-unsure' : ''}" src="${shots[i].crop}" title="${esc(shots[i].note)}" alt="">` : i + 1}</td><td><input class="gg-name" data-k="name" value="${esc(p.name)}" placeholder="name (optional)" maxlength="40"></td>
<td>${chip(p.spec)}<select data-k="spec">${specOptions(p.spec)}</select></td>
<td><select data-k="sub">${[1, 2, 3, 4, 5].map(n => opt(n, p.sub, n)).join('')}</select></td>
<td><select data-k="bait" title="${f ? esc(f.rangeWhy) : ''}">${opt('auto', p.bait, 'auto' + (auto ? ': ' + auto : ''))}${opt('melee', p.bait, 'melee')}${opt('mixed', p.bait, 'mixed')}${opt('ranged', p.bait, 'ranged')}</select></td>
<td><select data-k="hate" title="${esc(ah.map(h => h.skill + ' (' + h.why + ')').join(' · '))}">${opt('auto', p.hate, 'auto' + (p.spec ? ': ' + (ah.length ? (ah[0].level === 2 ? 'yes' : 'possible') : 'no') : ''))}${opt('yes', p.hate, 'yes')}${opt('no', p.hate, 'no')}</select></td>
<td class="gg-jk"><input type="radio" name="gg-joker" data-k="joker"${p.joker ? ' checked' : ''} title="Make this player the joker"></td><td class="gg-info">${f ? esc(ah.length ? ah.map(h => h.skill).slice(0, 3).join(', ') : '—') : ''}</td></tr>`; }
  const label = (p, i) => esc(p.name || 'Player ' + (i + 1));
  function playerLine(R, P, i, role) { const p = P[i], f = R.F[i], sk = f.skills[0];
    return `<li>${chip(p.spec)}<b>${label(p, st.indexOf(p))}</b> <span class="gg-spec">${p.spec}</span> <span class="gg-sub">sub ${p.sub}</span>${role.bait ? `<span class="gg-tag gg-bait" title="${esc(f.rangeWhy)}">baiter · ${f.range}</span>` : ''}${role.hate ? `<span class="gg-tag gg-hate" title="${esc(sk ? sk.why : 'set by hand')}">${esc(sk && p.hate !== 'yes' ? sk.skill : sk ? sk.skill : 'projectile block / reflect')}${sk && sk.level < 2 && p.hate === 'auto' ? ' (to slot)' : ''}</span>` : ''}</li>`; }
  let last = null;
  function result() { const P = st.filter(p => p.spec), box = root.querySelector('.gg-out'); last = null;
    if (P.length < 3) { box.innerHTML = `<p class="gg-hint">Pick a specialisation for at least 3 players (${P.length} so far). With all 10 you get three groups of 3 and a joker.</p>`; return; }
    const R = solve(P, P.findIndex(p => p.joker)); last = { R, P };
    const cards = R.groups.map((g, k) => `<div class="gg-card${g.warn.length ? ' gg-warn' : ''}"><h4>Green ${k + 1}</h4><ul>${g.members.slice().sort((a, b) => (b === g.baiter) - (a === g.baiter) || (b === g.hater) - (a === g.hater)).map(i => playerLine(R, P, i, { bait: i === g.baiter, hate: i === g.hater })).join('')}</ul>${g.warn.map(w => `<p class="gg-w">⚠ ${w}</p>`).join('')}</div>`).join('');
    const jk = R.jokers.length ? `<div class="gg-card gg-joker"><h4>Joker${R.jokers.length > 1 ? 's' : ''}</h4><ul>${R.jokers.map(i => { const f = R.F[i]; return playerLine(R, P, i, {}).replace('</li>', `<span class="gg-tag">${[f.bait > 0 ? 'melee, can bait' : '', f.hate > 0 ? 'has a projectile block / reflect' : ''].filter(Boolean).join(' · ') || 'fills a spot'}</span></li>`); }).join('')}</ul><p class="gg-hint">${P.some(p => p.joker) ? 'Chosen by you. <button class="pl-btn" data-a="autojoker">Let the tool choose</button>' : 'Chosen by the tool. Use the Joker column to pick someone else.'} Backs up a group that is short (someone down, or a green on a player far from their group).</p></div>` : '';
    const pairs = R.score[3], melee = R.groups.filter(g => R.F[g.baiter].bait > 0).length, note = P.length < 10 ? `<p class="gg-hint">${P.length} players: ${R.expected} green${R.expected > 1 ? 's' : ''} (the game gives one green per 3 players up, 3 at most).</p>` : '';
    box.innerHTML = `${note}<div class="gg-cards">${cards}${jk}</div><p class="gg-hint">${R.score[0]} of ${R.groups.length} groups have a projectile block / reflect, ${melee} a melee baiter · ${pairs} same-subgroup pair${pairs === 1 ? '' : 's'} kept together. Hover a tag to see where it comes from.</p>`; }
  function text() { if (!last) return ''; const { R, P } = last, nm = i => (P[i].name || 'Player ' + (st.indexOf(P[i]) + 1)) + ' (' + P[i].spec + ')';
    return R.groups.map((g, k) => `Green ${k + 1}: ` + g.members.map(i => nm(i) + (i === g.baiter ? ' [baiter]' : '') + (i === g.hater ? ' [' + ((R.F[i].skills[0] || {}).skill || 'projectile block') + ']' : '')).join(', ')).concat(R.jokers.length ? ['Joker: ' + R.jokers.map(nm).join(', ')] : []).join('\n'); }
  function dataHtml() { const t = (h, rows) => `<div class="tw"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const seen = Object.entries(LOGS).filter(([, l]) => l.players >= MINP);
    return `<details class="gg-data"><summary>How it sorts, and the data behind it</summary>
<p>Every possible split of the squad is scored and the best one is kept. In order of importance: (1) each group has a player with a <b>skill that blocks or reflects projectiles in a circular area on the ground</b> (walls and lines do not count), the more usual on the build the better; (2) each group's <b>baiter</b> is a melee player when there is one, otherwise a ranged player, because the greens go to players close to Vloxx; (3) players of the same <b>subgroup</b> stay together; (4) the baiter and the projectile player are two different players when possible. The joker is whoever is left once the groups are at their best. The fixated player always gets one of the greens, whatever their group.</p>
<p>"auto" comes from the data below; change a player to melee / ranged or yes / no when their build differs.</p>
<h5>Melee or ranged: weapons carried on Vloxx CM (${(G.logs || {}).logs || 0} logs that reached the last phase)</h5>
${t(['specialisation', 'players', 'with a melee weapon', 'counted as', 'most common weapons'], seen.map(([s, l]) => [s, l.players, l.hasMeleeWeaponPct + ' %', rangeOf(s).v, esc(Object.entries(l.weaponSets).slice(0, 2).map(([w, n]) => w + ' ×' + n).join(' · '))]))}
<p>Ranged weapon types: ${G.rangedMainHands.join(', ')}. A player counts as melee when one of their two weapon sets has another main hand. Specialisations with fewer than ${MINP} players in the logs use an assumed value: ${SPECS.filter(s => !(LOGS[s] && LOGS[s].players >= MINP)).map(s => s + ' ' + G.defaultRange[s]).join(', ')}.</p>
<h5>Projectile block / reflect skills that count (circular area on the ground)</h5>
${t(['skill', 'who', 'effect', 'slot', 'area', 'in the logs'], G.hate.map(h => { const sp = h.spec ? [h.spec] : G.professions[h.prof], u = sp.filter(s => LOGS[s] && LOGS[s].players >= MINP).map(s => `${(LOGS[s].castProjectileHate || {})[h.skill] || 0} / ${LOGS[s].players} ${s}`).join(', '); return ['<b>' + esc(h.skill) + '</b>', h.spec || h.prof, h.kind === 'reflect' ? 'reflects' : 'blocks', esc(h.slot), esc(h.area), u || 'not seen']; }).concat(G.anyProfession.map(h => ['<b>' + h.skill + '</b>', 'any', 'blocks', h.slot, esc(h.area), esc(h.note)])))}
<p>"auto: yes" = cast by at least half of the players of that specialisation in the logs. "auto: possible" = the skill exists but has to be slotted.</p>
<h5>Listed by the wiki but not counted</h5>
${t(['skill', 'profession', 'why not'], G.notCounted.map(h => [esc(h.skill), h.prof, esc(h.why)]))}
<p>Source: Guild Wars 2 Wiki, pages Reflect and Block (Projectile destruction).</p>
<h5>Reading a screenshot</h5><p>Works on the squad panel in grid view (green tiles, name on top, white icon below). Each row of tiles is a subgroup, from top to bottom. The icon of each tile is compared with the ${Object.keys(G.icons || {}).length} official profession and specialisation icons; a tile that does not match well is left empty with its picture in the row. The name on each tile is read with a text reader (Tesseract.js, downloaded when you first import a screenshot); the panel cuts long names, so some come out shortened, and accents can be missed. A squad-role symbol before a name (lieutenant, commander) is left out. The image itself stays in your browser.</p></details>`; }
  function render() { root.innerHTML = `<div class="gg-wrap"><div class="gg-head"><h2>Green groups <span class="gg-exp">experimental</span></h2><p class="gg-expnote">This tool is new and little tested: the sorting rules, the skill list and the screenshot reader can be wrong. Check the result before using it in a raid.</p><p>Enter the squad by hand, or give it a screenshot of the squad panel (button, Ctrl+V or drop); the tool makes three groups of 3 for the 3-people greens, each with a circular ground-area projectile block / reflect skill and a baiter (a melee player first, otherwise a ranged one), and keeps subgroups together where it can. The tenth player is the joker.</p>
<div class="gg-btns"><button class="pl-btn" data-a="shot" title="Squad panel in grid view: green tiles with the name and the specialisation icon. You can also paste (Ctrl+V) or drop the image on this page.">Read a screenshot</button><input type="file" accept="image/*" class="gg-file" hidden><button class="pl-btn" data-a="paste">Paste a list</button><button class="pl-btn" data-a="copy">Copy groups as text</button><button class="pl-btn" data-a="share">Copy share link</button><button class="pl-btn" data-a="reset">Reset</button><span class="gg-msg"></span></div></div>
<div class="gg-grid"><div class="gg-in"><div class="tw"><table class="gg-table"><thead><tr><th></th><th>Player</th><th>Specialisation</th><th title="Squad subgroup">Sub</th><th title="Melee players are picked first to bait a green">Range</th><th title="Has a skill that blocks or reflects projectiles in a circular area on the ground (no walls)">Projectile block / reflect</th><th title="The player kept out of the three groups. Leave it to the tool, or pick one.">Joker</th><th>Skills that count</th></tr></thead><tbody>${st.map(rowHtml).join('')}</tbody></table></div></div>
<div class="gg-out"></div></div>${dataHtml()}</div>`; result(); }
  const msg = t => { const m = root.querySelector('.gg-msg'); m.textContent = t; clearTimeout(msg.t); msg.t = setTimeout(() => { m.textContent = ''; }, 6000); };
  const copy = (t, ok) => navigator.clipboard.writeText(t).then(() => msg(ok), () => { prompt('Copy:', t); });
  // screenshot of the squad panel → specialisation, subgroup and name of each tile (greens_scan.js). A tile whose icon is not
  // recognised with confidence is left without a specialisation, with its picture in the row so it can be set by hand.
  // A reading is accepted when the best icon is clearly ahead of the next one (margin) and matches at all (score).
  async function importShot(file) { if (!file || !/^image\//.test(file.type)) return; msg('Reading the screenshot…');
    try { const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); }), R = await window.VloxxGreenScan.read(url);
      if (!R.length) { msg('No green player tiles found in this image'); return; }
      const T = R.slice(0, 10); shots = {}; st = clean(T.map((t, i) => { const unsure = !t.spec || t.score < 0.45 || t.margin < 0.06; shots[i] = { crop: t.crop, unsure, note: unsure ? 'icon not recognised' + (t.spec ? ' (closest: ' + t.spec + ', ' + t.second + ')' : '') : 'read as ' + t.spec + ' (match ' + Math.round(t.score * 100) + ' %)' }; return { name: '', spec: unsure ? '' : t.spec, sub: t.sub }; }));
      save(); render(); askJoker(); const u = Object.values(shots).filter(x => x.unsure).length;
      // names come a moment later (the text reader is downloaded on first use); a name typed meanwhile is kept
      const mine = st; window.VloxxGreenScan.readNames(T).then(N => { if (st !== mine) return; let n = 0; N.forEach((nm, i) => { if (nm && !st[i].name) { st[i].name = nm; n++; const inp = root.querySelector(`tr[data-i="${i}"] .gg-name`); if (inp) inp.value = nm; } }); save(); result();
        root.querySelectorAll('.gg-pickb').forEach(b => { const nm = st[+b.dataset.i].name; if (nm) b.querySelector('span').textContent = nm + ' · ' + (st[+b.dataset.i].spec || 'not recognised'); }); msg(`${n} of ${T.length} names read — the panel cuts long names, complete them if needed`); },
        e => msg('Names not read (' + e.message + '); specialisations and subgroups are in'));
      msg(`${T.length} players read, reading the names…` + (R.length > 10 ? ` (first 10 of ${R.length})` : '') + (u ? `, ${u} to set by hand` : '') + ' — check them against the pictures'); }
    catch (e) { msg('Could not read this image: ' + e.message); } }
  // asked right after a screenshot is read: the tiles as buttons, or let the tool choose
  function askJoker() { const n = Object.keys(shots).length; if (n < 4) return; const box = document.createElement('div'); box.className = 'gg-pick';
    box.innerHTML = `<h4>Who is the joker?</h4><p class="gg-hint">The joker stays out of the three groups and backs up one that is short. You can change it later in the Joker column.</p><div class="gg-picks">${Object.keys(shots).map(i => `<button class="gg-pickb" data-a="pick" data-i="${i}"><img src="${shots[i].crop}" alt=""><span>${esc(st[i].spec || 'not recognised')} · sub ${st[i].sub}</span></button>`).join('')}</div><button class="pl-btn" data-a="autojoker">Let the tool choose</button>`;
    const out = root.querySelector('.gg-out'); out.parentNode.insertBefore(box, out); }
  function boot() { if (!root) root = document.getElementById('greens-root'); if (!booted) { load(); booted = true;
      root.addEventListener('change', e => { const tr = e.target.closest('tr[data-i]'), k = e.target.dataset.k; if (!tr || !k) return; const p = st[+tr.dataset.i]; if (k === 'joker') { st.forEach(q => { q.joker = q === p; }); save(); render(); return; }
        p[k] = k === 'sub' ? +e.target.value : e.target.value; save(); if (k === 'spec' && shots[+tr.dataset.i]) shots[+tr.dataset.i].unsure = false;
        if (k === 'name') result(); else { tr.outerHTML = rowHtml(p, +tr.dataset.i); result(); } });
      root.addEventListener('change', e => { if (e.target.classList.contains('gg-file')) { importShot(e.target.files[0]); e.target.value = ''; } });
      document.addEventListener('paste', e => { if (!root.classList.contains('on')) return; const f = [...(e.clipboardData || {}).files || []].find(f => /^image\//.test(f.type)); if (f) { e.preventDefault(); importShot(f); } });
      root.addEventListener('dragover', e => e.preventDefault()); root.addEventListener('drop', e => { const f = [...e.dataTransfer.files].find(f => /^image\//.test(f.type)); if (f) { e.preventDefault(); importShot(f); } });
      root.addEventListener('click', e => { const a = (e.target.closest('[data-a]') || {}).dataset; if (!a) return;
        if (a.a === 'reset') { if (confirm('Clear the squad?')) { st = Array.from({ length: 10 }, (_, i) => blank(i)); shots = {}; save(); render(); } }
        else if (a.a === 'shot') root.querySelector('.gg-file').click();
        else if (a.a === 'autojoker') { st.forEach(q => { q.joker = false; }); save(); render(); }
        else if (a.a === 'pick') { st.forEach((q, i) => { q.joker = i === +a.i; }); save(); render(); }
        else if (a.a === 'copy') { const t = text(); if (t) copy(t, 'Groups copied'); else msg('Nothing to copy yet'); }
        else if (a.a === 'share') copy(location.href.split('#')[0] + '#greens=' + pack(), 'Link copied');
        else if (a.a === 'paste') { const t = prompt('One player per line: name, specialisation, subgroup (1-5).\nExample: Aria, Troubadour, 1\nA line "Subgroup 2" sets the subgroup for the lines after it.'); if (t) { const L = parseList(t.replace(/\s{2,}|;\s*(?=\S+\s*,)/g, '\n')); if (L.length) { st = clean(L); shots = {}; save(); render(); msg(L.length + ' players read, ' + L.filter(p => !p.spec).length + ' without a specialisation'); } } } }); }
    render(); }
  window.VloxxGreens = { boot, solve, parseList, facts, importShot };
})();
