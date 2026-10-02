// Runs every data-producing script, then rebuilds the documentation page. Used locally and by the GitHub Actions workflow.
//   node scripts/build_all.js            -> regenerates data/*.csv and docs/index.html
//   DOCS_OUT=_site DOCS_BASE=./ node scripts/build_all.js   -> what CI runs (page written to _site/ for GitHub Pages)
const { execFileSync } = require('child_process');
const path = require('path');
const steps = [
  'build_dataset.js',        // data/*.csv for greens, fixation, PD, orbs, aspects
  'asc_sacrifice.js',        // data/ascension_sacrifice_2green.csv
  'asc_sacrifice_los.js',    // data/ascension_sacrifice_positions.csv
  'build_arena.js',          // data/arena.json (centre, spawns, Cosmic ring, heatmap) for the raid planner
  'worldpiercer.js',         // data/worldpiercer.csv + worldpiercer_summary.json (6-spoke star, width, range) → planner preset
  'build_plans.js',          // validates docs-src/plans/*.json (shared planner templates); fails the build if one is invalid
  'key_checks.js',          // prints headline conclusions (sanity check in the CI log)
  'build_docs.js',           // docs/index.html (or $DOCS_OUT/index.html)
];
for (const s of steps) {
  const t = Date.now();
  console.log(`\n=== ${s} ===`);
  execFileSync(process.execPath, [path.join(__dirname, s)], { stdio: 'inherit', env: process.env });
  console.log(`--- ${s} done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
