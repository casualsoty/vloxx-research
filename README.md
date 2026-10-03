# Vloxx (Nexus of Eternity) CM — mechanics research

A knowledge base on the Guild Wars 2 raid boss **Vloxx** (encounter "Nexus of Eternity", arcdps boss id **28106**),
Challenge Mode, built from arcdps logs since 2026-10-01. The logs themselves are **not in this repository** (they contain real
player names): they live in `logs/` on the analysis machine only (gitignored). Everything published here is built from them and anonymised.

**Start here as a new session:** read this file, then [FINDINGS.md](FINDINGS.md), then run
`node scripts/build_all.js` to see every headline number recomputed from the logs.

## The goal behind the research
Gather **general, evidence-backed knowledge about how Vloxx CM works** — how each mechanic picks its targets, its timers,
what adds do and when they respawn, where things spawn — so the group can plan the fight from facts instead of guesses.
Every claim is tied to log evidence and a confidence tag, and disproved ideas are kept so they aren't re-tested.

Topics so far: 3-people greens (*Judgment of Eternity*), Fixated, Probability Distribution, 2-people green shackles
(*Ascension's Sacrifice*), Ascension orbs, the Aspect adds (respawn, CC, spawn points), arena coordinates. A notable
practical result: the "+2.5 s Fixated" timing bug that makes the last-phase +63 s green round come out 2 greens short
(FINDINGS §3).

## Folder layout
```
README.md            this file (context + how to continue)
docs/index.html      static documentation page (categories, search) GENERATED from FINDINGS.md + README.md + data/ —
                     rebuild with `node scripts/build_docs.js` after every change to the notes.
                     Two tabs: Knowledge base, and Raid planner (open with `#planner`)
docs-src/planner.js  raid planner (SVG arena editor; plan JSON import/export) — inlined into docs/index.html by build_docs.js
docs-src/planner.css planner styles (also inlined)
docs-src/presets.json attack presets + unit sizes. The planner AND the docs "Raid planner data" section read it (single source)
docs-src/legal.md    disclaimer / trademark / copyright notice (page footer + "About & legal" dialog)
docs-src/feedback.js "Feedback" / "Report a bug" buttons (top bar); contact name = CONTACT_DISCORD in scripts/build_docs.js
docs-src/plans/      shared planner templates (*.json, any exported plan); see the README there
FINDINGS.md          every conclusion, its evidence, and hypotheses that were tested and REJECTED
logs/                LOCAL ONLY (gitignored, not in the repository — back it up separately):
logs/raw/            our squad's raw arcdps logs (.zevtc), CM: 162 logs from 2026-09-29 to 2026-10-03 (12 reached the last phase)
logs/raw_nm/         raw NM logs (13; not analysed)
logs/ei/             Elite Insights JSON of other squads' logs (gzipped). dps.report links + Wingman imports
logs/sources.json    log id -> URL (dps.report / Wingman)
logs/wingman_vloxx_all_attempts_metadata.json.gz   Wingman summary of all 3,398 Vloxx attempts (as of 2026-10-01)
data/*.csv           datasets extracted from all logs (see below)
scripts/             parser + loaders + dataset builder + checks (Node.js, no dependencies)
```

## Datasets (`data/`)
| file | one row per |
|---|---|
| `logs_index.csv` | log (source, URL, HP, CM/NM, duration, last-phase start, players) |
| `green_rounds.csv` | green round (early phase + every last-phase tick incl. 0-green ticks): fixated player, players up, expected count, actual targets in order, 80 ms slot numbers, Probability Distribution targets at the same instant, boss HP |
| `green_round_players.csv` | player × green round: up, fixated, got green, PD target, distance to boss centre, in stealth |
| `fixation_applications.csv` | every Fixated application: time, phase, holder, held time, how it ended, gap since previous |
| `fixation_last_phase_ticks.csv` | each last-phase Fixated tick (+2.5/+22.5/+42.5/+62.5/+82.5s): held / APPLIED / SKIPPED |
| `probability_distribution_last_phase.csv` | each last-phase PD tick (+23/+43/+63…) |
| `ascension_orbs.csv` | each Ascension Orb (raw logs): spawn, lifetime, picked up vs expired |
| `ascension_sacrifice_2green.csv` | each 2-people green pick (Ascension's Sacrifice): order, timing, distance rank, fixated (built by `scripts/asc_sacrifice.js`) |
| `arena.json` | not a table: arena geometry for the planner (centre, platform radius, Aspect spawns, 8-point Cosmic ring, entrance, player heatmap); built by `scripts/build_arena.js` |
| `worldpiercer.csv` / `worldpiercer_summary.json` | Worldpiercer projectile (origin, aim, end, speed) / measured shape for the planner (`scripts/worldpiercer.js`) |
| `orb_throws.csv` | Aspect CC: orb-throw missiles (skill 80520), orbs seen, projectile-hate skills nearby (`scripts/orb_throws.js`) |
| `aspect_events.csv` | Aspect of the Staff/Spear/Sword spawns, deaths (+respawn time), breakbar breaks (+orb delay) |

Times are seconds from log start. **Raw logs start ~3 s later than EI** (EI shows the first Fixated at 0 s, raw at 3.0 s).
"Last phase" = from the start of Vloxx's channel skill **81071**; its rounds are at **+3, +33, +63 s** (greens),
**+23, +43, +63 s** (Probability Distribution) and Fixated ticks at **+2.5, +22.5, +42.5, +62.5 s**.

## Raid planner (docs page, "Raid planner" tab)
A fight planner in the style of raidplan.io, built for Vloxx CM. The map is drawn in real game coordinates from `data/arena.json`;
the cursor readout shows world, map (×0.0254) and distance from centre. Features:
- Players: 10, each with name, profession colour, role and subgroup. Squad markers: one of each per step.
- Units: Vloxx, Aspects, Cosmic adds, orbs, custom NPCs.
- Shapes: AoE circles with EI-sized presets (they can be attached to a token), cones, beams, lines and arrows, text, freehand drawing, a ruler and an eraser.
- Steps (phases) with name, time and notes. Play animates the tokens between steps.
- **Templates** tab with two lists:
  - Shared templates: every `docs-src/plans/*.json`. They are validated and embedded by `scripts/build_plans.js` and open with `#planner=t.<id>`. See `docs-src/plans/README.md`.
  - My templates: saved in the browser with "Save current plan as template". "Download for repo" turns one into a shared template.
  No templates ship by default; add your own.
- Worldpiercer preset: a 6-spoke star, 60° apart and 220 wide, ending at the arena edge. It uses the measured numbers from `data/worldpiercer_summary.json`.
- Map layers: platform, heatmap of where players stood, grid, range rings, spawn points, Cosmic ring, entrance.
- Editing: undo/redo, copy/paste, Alt+drag to duplicate, snapping, keyboard shortcuts (press ?).
- Saving and sharing: plans autosave to localStorage. Export/Import JSON (`format: "vloxx-raid-plan", version: 1`), or paste JSON.
  Share link puts the deflate-compressed plan in `#planner=…`. Each step can also be exported as PNG or SVG.

Plan JSON: `{format, version, title, notes, players[10]{name,prof,role,sub}, layers{…}, snap, steps[{id,name,time,note,objects[]}]}`.
Object types: `player{pid,x,y}`, `marker{m,x,y}`, `unit{u,x,y}`, `circle{x,y,r,attach?,inner?,fill,dash}`, `cone{x,y,r,angle,spread}`,
`beam{x1,y1,x2,y2,w}`, `line/arrow{x1,y1,x2,y2,width,dash}`, `text{x,y,text,size,attach?}`, `path{pts[[x,y]]}`. All of them also take `color, label, note`.
Coordinates are arcdps world units. Objects keep the same `id` across steps, which is what Play uses to animate them.

**Rule:** everything the planner shows must also be in the documentation. The "Raid planner data" section of the page is generated by
`build_docs.js` from the same files the planner reads: data/arena.json, docs-src/presets.json, data/worldpiercer_summary.json and
data/cosmic_charge_summary.json. New planner data goes into one of those files, never only into planner.js.

## Anonymisation (player names)
Every published file uses pseudonyms instead of player names: `Player-XXXX` for characters, `Account-XXXX` for accounts. That covers
data/*.csv and *.json, FINDINGS.md, README.md, the page and the build log. `scripts/anonymise.js` builds the name list from all logs,
including name fragments inside Wingman / dps.report log ids. XXXX = HMAC-SHA256 with a private salt, stable between builds.
* The salt is the local file `.anon-salt` (gitignored). The real ↔ pseudonym table is `private/name_map.json` (gitignored), for local lookups only.
* Back up `.anon-salt` with the logs: a new salt changes every pseudonym on the next build.
* `build_all.js` runs `anonymise.js` after the data scripts. It filters the build log, makes a final pass over the page,
  and ends with `anonymise.js --check`, which fails the build if a real name (≥ 4 characters) is left anywhere that gets published.
* The site's contact name (`CONTACT_DISCORD` in build_docs.js) is allowlisted and never replaced.
* **GW2 Wingman log links are left untouched** so they keep working; their path contains the uploader's account name (already public on Wingman). Everything else, including the log ids, stays pseudonymised.
* The raw logs in `logs/` contain real names, so they are gitignored and were removed from the git history on 2026-10-03.
* A local **pre-push hook** (`.git/hooks/pre-push`, installed by `node scripts/install_hooks.js`) runs `anonymise.js --check` and refuses the push if a real name is left in a published file.

## Automation (GitHub Actions → GitHub Pages)
Every push to `main` runs `.github/workflows/build-docs.yml`: Node 22 runs `scripts/build_docs.js` on the **committed** data/ and notes
and publishes the page with FINDINGS/README/data/scripts to GitHub Pages. The analysis is not re-run there, because the logs aren't in the repository.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
**Workflow after new logs:** copy them into `logs/raw` locally, run `node scripts/build_all.js` (all analysis + anonymisation + page +
name check), then commit and push `data/`, `docs/` and the notes. Editing only FINDINGS / README / planner? Just push: CI rebuilds the page.

## How to run
```
# from the repository root
node scripts/build_dataset.js      # ~15 s, rebuilds data/*.csv from logs/
node scripts/key_checks.js         # prints the headline conclusions recomputed from the CSVs
```
`scripts/evtc.js` parses .zevtc directly (zip + EVTC rev 1). `scripts/load.js` turns raw EVTC and EI JSON into one
common structure (greens, PD, fixation, stealth, downs, deaths, positions, orbs, aspects).

## Getting more logs
* **dps.report**: `https://dps.report/getJson?permalink=<id>` → EI JSON (positions every 300 ms, buffs, mechanics). No raw .zevtc download.
* **GW2 Wingman** (`https://gw2wingman.nevermindcreations.de`), API documented inside the site bundle:
  * `/api/getRndLogs?bossID=28106&sampleSize=-1&onlyKills=AllTries&IncludeEnglishLogs=on&IncludeFrenchLogs=on&IncludeGermanLogs=on&IncludeSpanishLogs=on&returnFullLogs=true` → all attempts with summaries (~140 MB)
  * `/api/getFullJson/<log id>` → full EI JSON; `/api/getMetadata/<log id>` → summary.
  * Wingman does **not** flag CM for Vloxx. Use HP: CM = 84,939,840 (EI's own rule: >70 M CM, >85 M Legendary CM); NM = 42,469,920.
    Estimate from summaries: `squadDmg / (1 - hpLeft/100)` ≈ 85 M (CM) or ≈ 42.4 M (NM).
  * CM released Tuesday 2026-09-29 23:00 CEST. On 2026-10-01 Wingman had 14 CM attempts that reached the last phase
    (all in the local `logs/`), 1 CM kill.
* **Raw logs are always better** than EI JSON: exact positions, every effect/buff event, agent effects (EI doesn't export).
  New raw logs: arcdps saves them in `Documents\Guild Wars 2\addons\arcdps\arcdps.cbtlogs\Vloxx (28106)`.

## Important IDs (arcdps build EVTC20260929, game build 207890/207970)
| what | id |
|---|---|
| boss Vloxx species | 28106 (Aspects: Staff 28017, Spear 28033, Sword 28107) |
| 3-people green marker (agent effect, raw) | effect id **10269** (EI mechanic `3Green.Slct`) |
| Probability Distribution marker (agent effect, raw) | effect id **6188** (EI `Pddl.Drp`) |
| 2-people green "shackles" marker (Ascension's Sacrifice, skill 81076) | effect id **37976** (EI `2Green.Slct`) |
| effect GUID → raw id | statechange 46: GUID bytes = src(8, LE) + dst(8, LE) as hex, `skill` = content id. GUIDs listed in EI `ParserHelpers/GUIDs/EffectGUIDs.cs` |
| Judgment of Eternity: early phases = cast **and** failed-green damage | skill 80629 (+ fixed 4,000 dmg skill 23296) |
| Last-phase greens (no cast, timer during channel 81071): failed-green damage | skill 80378 (+ 23296) |
| Green markers (both phases) | effects 10269 (circle) + 12014 |
| Fixated (Timed) buff | 34508 (60 s) |
| Stealth buff | 13017 |
| Ascension buff (10 stacks at start, −3 per failed green hit) | 80368 |
| last-phase channel | skill 81071 |
| Ascension Orb agents | max HP 14,940, hitbox 16 (EI renames them "Ascension Orb") |
| Vloxx hitbox | width 300 (raw 150 in agent struct) |
| Aspect spawn points (world) | Staff 11850.4, 16084.5 · Spear 12562.2, 14596.9 · Sword 13036.2, 15699.1 (FINDINGS §5c) |
| world → map/marker-tool coords | × 0.0254 (inches → meters) |
| squad markers | statechange 53, skill = marker index, src = float x,y, value = float z |

**Working rule: whenever something new is learned, save it here** (FINDINGS.md / README / data / scripts)
in the same turn, **then rebuild the doc page**: `node scripts/build_docs.js`. New FINDINGS sections (`## N. Title`) appear
automatically; to give one its own sidebar category, add an entry to `CATS` in `scripts/build_docs.js`.

## Status / open questions (see FINDINGS §7)
1. **Untested:** does stealthing off Fixated *during Split 3* (before the last phase starts) let the +2.5 s tick apply a fresh
   Fixated? Boss-phase data says stealth makes the boss skip its next re-application ~half the time.
2. Why later last-phase ticks (+22.5/+42.5/+62.5) sometimes skip with nobody fixated — no rule found.
3. 1 unexplained short round: 050224 +33 s (Fixated stealthed off at +15 s, +22.5 s tick skipped, 2 greens instead of 3).
4. Which players get the non-fixated greens — biased to near the boss, not strictly nearest; exact rule unknown.
5. Why the Aspect sometimes doesn't throw its orbs on a CC (2/302, both Staff; projectile hate and early pickups ruled out).
6. Whoever holds Fixated at last-phase +63 s gets a green and a spread together (9/9). It is avoided only when nobody is fixated
   at +63 s. Open: a reliable way to get that without the 1-green timing bug.
