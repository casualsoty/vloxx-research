// Installs the local git pre-push hook: before every push, refuse it if a real player name would be published
// (node scripts/anonymise.js --check — needs the local logs/). Run once per clone: node scripts/install_hooks.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const hook = path.join(ROOT, '.git', 'hooks', 'pre-push');
fs.writeFileSync(hook, `#!/bin/sh
# installed by scripts/install_hooks.js — blocks pushes that would publish a real player name
node "scripts/anonymise.js" --check || { echo "push refused: run node scripts/build_all.js (or node scripts/anonymise.js) first"; exit 1; }
`);
try { fs.chmodSync(hook, 0o755); } catch (e) { }
console.log('installed', path.relative(ROOT, hook));
