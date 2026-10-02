// Shared fight-plan templates for the raid planner tab: every docs-src/plans/*.json file becomes a template on the page.
// A template is simply a plan exported from the planner ("Save as template → Download for repo", or "Export JSON").
// Optional extras for hand-written files — positions may be references resolved against data/arena.json, so they follow
// the measured geometry:  "at": "centre" | "entrance" | "spawn:Staff|Spear|Sword" | "cosmic:0..7"  (+ "atR"/"atDeg" polar
// or "dx"/"dy" offset); lines/arrows/beams: "from"/"to" (same format, or {"at","r","deg"}); "attach": 0..9 = player n+1.
// Invalid files make the build fail (so CI catches them). Used in-process by build_docs.js; run directly to check the folder.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'docs-src', 'plans');
const TYPES = new Set(['player', 'marker', 'unit', 'circle', 'cone', 'beam', 'line', 'arrow', 'text', 'path']);

function resolver(A) {
  return (ref, where) => {
    if (ref == null) throw new Error(`${where}: missing position`);
    if (Array.isArray(ref)) return { x: ref[0], y: ref[1] };
    if (typeof ref === 'object' && !ref.at) return { x: ref.x, y: ref.y };
    const r = typeof ref === 'string' ? { at: ref } : ref; const [kind, arg] = String(r.at).split(':'); let b;
    if (kind === 'centre' || kind === 'center') b = A.centre;
    else if (kind === 'entrance') b = A.entrance;
    else if (kind === 'spawn') b = (A.spawns || {})['Aspect of the ' + arg];
    else if (kind === 'cosmic') b = (A.cosmicPoints || [])[+arg];
    if (!b) throw new Error(`${where}: unknown position reference "${r.at}"`);
    let x = b.x, y = b.y; if (r.r != null) { const a = (r.deg || 0) * Math.PI / 180; x += r.r * Math.cos(a); y += r.r * Math.sin(a); }
    return { x: Math.round((x + (r.dx || 0)) * 10) / 10, y: Math.round((y + (r.dy || 0)) * 10) / 10 };
  };
}

function resolvePlan(p, A, file) {
  const resolve = resolver(A); const err = m => { throw new Error(`${file}: ${m}`); };
  if (!p || typeof p !== 'object') err('not a JSON object');
  if (!Array.isArray(p.steps) || !p.steps.length) err('needs a non-empty "steps" array');
  const players = Array.from({ length: 10 }, (_, i) => Object.assign({ name: 'Player ' + (i + 1), prof: '', role: '', sub: i < 5 ? 1 : 2 }, (p.players || [])[i] || {}));
  const steps = p.steps.map((s, si) => ({ id: s.id || 'step' + si, name: s.name || 'Step ' + (si + 1), time: s.time || '', note: s.note || '',
    objects: (s.objects || []).map((o, oi) => {
      const w = `step ${si + 1} object ${oi + 1}`; if (!TYPES.has(o.type)) err(`${w}: unknown type "${o.type}"`);
      const c = Object.assign({}, o); ['at', 'atR', 'atDeg', 'dx', 'dy', 'from', 'to'].forEach(k => delete c[k]);
      if (o.at) Object.assign(c, resolve({ at: o.at, r: o.atR, deg: o.atDeg, dx: o.dx, dy: o.dy }, w));
      if (o.from || o.to) { const a = resolve(o.from, w + ' from'), b = resolve(o.to, w + ' to'); Object.assign(c, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }); }
      if (o.pts) c.pts = o.pts.map(q => { const r = resolve(q, w + ' pts'); return [r.x, r.y]; });
      if (c.attach != null && /^\d$/.test(String(c.attach))) c.attach = 'p' + c.attach;
      if (c.attach != null) { c.x = c.x || 0; c.y = c.y || 0; }
      if (c.type === 'player') { if (!(c.pid >= 0 && c.pid < 10)) err(`${w}: player needs "pid" 0..9`); c.id = c.id || 'p' + c.pid; }
      if (!('x' in c) && !('x1' in c) && !c.pts) err(`${w}: no position (use "x"/"y", "at", "from"/"to" or "attach")`);
      c.id = c.id || `s${si}o${oi}`; return c;
    }) }));
  const out = { format: 'vloxx-raid-plan', version: 1, title: p.title || path.basename(file, '.json'), notes: p.notes || '', players, snap: p.snap || 0, steps };
  if (p.layers) out.layers = p.layers;
  return out;
}

function buildPlans() {
  const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'arena.json'), 'utf8')); const plans = [];
  if (fs.existsSync(DIR)) for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
    const rel = 'docs-src/plans/' + f; let p;
    try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { throw new Error(`${rel}: invalid JSON (${e.message})`); }
    const plan = resolvePlan(p, A, rel);
    plans.push({ id: f.replace(/\.json$/, ''), title: plan.title, description: p.description || '', file: rel, plan });
  }
  return { built: new Date().toISOString(), plans };
}
module.exports = { buildPlans };
if (require.main === module) {
  const out = buildPlans();
  console.log(out.plans.length ? 'templates: ' + out.plans.map(p => `${p.id} (${p.plan.steps.length} steps)`).join(', ') : 'no templates in docs-src/plans/ (add exported plan .json files there)');
}
