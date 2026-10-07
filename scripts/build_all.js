// Runs every data-producing script, then rebuilds the documentation page. Used locally and by the GitHub Actions workflow.
//   node scripts/build_all.js            -> regenerates data/*.csv and docs/index.html
//   DOCS_OUT=_site DOCS_BASE=./ node scripts/build_all.js   -> what CI runs (page written to _site/ for GitHub Pages)
const { execFileSync } = require('child_process');
const path = require('path');
const steps = [
  'build_dataset.js',        // data/*.csv for greens, fixation, PD, orbs, aspects
  'asc_sacrifice.js',        // data/ascension_sacrifice_2green.csv
  'asc_sacrifice_los.js',    // data/ascension_sacrifice_positions.csv
  'orb_throws.js',           // data/orb_throws.csv: orb-throw missiles per Aspect CC (needs aspect_events + ascension_orbs)
  'build_arena.js',          // data/arena.json (centre, spawns, Cosmic ring, heatmap) for the raid planner
  'worldpiercer.js',         // data/worldpiercer.csv + worldpiercer_summary.json (6-spoke star, width, range) → planner preset
  'cosmic_charge_shape.js',  // data/cosmic_charge_summary.json: dash length, knockdown pulses/reach, trail → planner preset
  'cosmic_charge_knocks.js', // data/cosmic_charge_knocks.csv: knockdowns per player × cast (Stability-aware)
  'excision_geometry.js',    // data/excision_slashes.csv + excision_summary.json: slashes vs telegraphs, semicircle radius
  'excision_strip.js',       // data/excision_strip.csv + excision_strip_summary.json: boon strip / Crippled and the 1.0 s lockout
  'excision_lockout_check.js', // prints the stress test of the 1.0 s strip lockout (FINDINGS §5e)
  'cast_order.js',           // data/cast_order.csv + cast_order_summary.json: usual order of Vloxx's attacks per phase
  'slice_through_reality.js', // data/slice_through_reality_summary.json: the two hits (525 then ~300) and the teleport
  'damage_immunity.js',      // data/damage_immunity.csv + damage_immunity_summary.json: what still damages Vloxx during Damage Immunity
  'phase_times.js',          // data/phase_times.csv + phase_times.json: fastest / average time per phase, with the link of the fastest
  'empowered_stacks.js',     // data/empowered_stacks.csv + .json: Empowered stacks on Vloxx at kill time and at each threshold
  'fixated_selection.js',    // data/fixated_selection.csv + fixated_selection_summary.json: who Fixated picks, tested against distance, stats, damage, squad order, history (EI JSON from Wingman, cached in private/ei_fixated/)
  'attack_conditions.js',    // data/attack_conditions.csv + attack_conditions_summary.json: conditions applied by each attack (EI JSON from Wingman, cached in private/ei_conditions/)
  'dps_table.js',            // data/dps_samples.csv + dps_table.json: target and cleave DPS per specialisation / build
  'annihilating_orb.js',     // data/annihilating_orb_summary.json: Vloxx's orb path, landing zone and expanding ring
  'raging_storm_last_phase.js', // data/raging_storm_last_phase.json: falling spears per second with each Aspect alive or dead
  'raging_storm_targets.js', // data/raging_storm_targets.csv + .json: who the last-phase spears target (sets of 2 + the fixated player)
  'raging_storm_last_phase.js', // data/raging_storm_last_phase.json: falling spears per second with each Aspect alive or dead
  'raging_storm_target_rule.js', // data/raging_storm_target_rule.json: tested rules for the two non-fixated spear targets (none found)
  'raging_storm_last_phase.js', // data/raging_storm_last_phase.json: falling spears per second with each Aspect alive or dead
  'excision_safespot.js',    // data/excision_melee.csv + excision_safespot_summary.json: melee safety vs distance of the fixated player
  'excision_flowers.js',     // data/excision_flowers.csv + excision_flowers_summary.json: the four "flowers" per cast, their targets, inward / outward (needs excision_slashes + excision_melee)
  'echoing_blade.js',        // data/echoing_blade_summary.json: spinning half-circle on Vloxx, radius, projectiles
  'breakbars.js',            // data/breakbars.csv + breakbars_summary.json: bar size, when it opens, drain, time to break
  'phase_entry_fixated.js',  // data/phase_entry_fixated.csv: P2 / P3 entry with a fresh vs carried Fixated
  'sword_sweetspot.js',      // data/sword_casts.csv + sword_division_summary.json: Sword's Division Eternal shape, target, stack safety
  'build_plans.js',          // validates docs-src/plans/*.json (shared planner templates); fails the build if one is invalid
  'anonymise.js',            // player names → stable pseudonyms in data/, FINDINGS.md, README.md (before anything is printed or published)
  'key_checks.js',          // prints headline conclusions (sanity check in the CI log)
  'build_docs.js',           // docs/index.html (or $DOCS_OUT/index.html)
  ['anonymise.js', '--check'], // fails the build if a real player name would be published
];
const { load } = require('./anonymise'); const A = load(); const anon = t => A.apply(t);
for (const st of steps) { const [s, ...args] = [].concat(st);
  const t = Date.now();
  console.log(`\n=== ${s} ===`);
  // output is piped through the anonymiser too: the CI log of a public repository is public
  const out = execFileSync(process.execPath, ['--max-old-space-size=8192', path.join(__dirname, s), ...args], // build_dataset keeps every log in memory: more than the default heap once there are ~300 logs
 { stdio: ['ignore', 'pipe', 'inherit'], env: process.env, maxBuffer: 64 * 1024 * 1024 }).toString();
  process.stdout.write(anon(out));
  console.log(`--- ${s} done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
