// Downloads the small white profession / elite-specialisation icons (32 px, the ones the squad panel shows) from the official
// Guild Wars 2 API and stores them as data URIs in docs-src/spec_icons.json. The Green groups tab uses them to read a screenshot of
// the squad panel (it compares each player's icon with these) and to show the icons next to the players.
// Usage: node fetch_spec_icons.js      (only needed when a new specialisation is released; not part of build_all)
const fs = require('fs'), path = require('path');
(async () => {
  const get = async u => { const r = await fetch(u, { signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(u + ' → ' + r.status); return r; };
  const profs = await (await get('https://api.guildwars2.com/v2/professions?ids=all')).json(), specs = (await (await get('https://api.guildwars2.com/v2/specializations?ids=all')).json()).filter(s => s.elite);
  const out = {}; for (const [name, url] of [...profs.map(p => [p.name, p.icon]), ...specs.map(s => [s.name, s.profession_icon])]) out[name] = 'data:image/png;base64,' + Buffer.from(await (await get(url)).arrayBuffer()).toString('base64');
  fs.writeFileSync(path.join(__dirname, '..', 'docs-src', 'spec_icons.json'), JSON.stringify(out, null, 0) + '\n'); console.log('wrote docs-src/spec_icons.json:', Object.keys(out).length, 'icons');
})();
