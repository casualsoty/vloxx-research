# Vloxx (Nexus of Eternity) CM — mechanics research

Research into how the Guild Wars 2 raid boss **Vloxx** (encounter "Nexus of Eternity", arcdps boss id **28106**) picks
targets for its **3-people greens** (*Judgment of Eternity*), how **Fixated** works, and the **Ascension orbs / Aspect** adds.
Done from arcdps logs between 2026-10-01 and 2026-10-02 with Claude Code. Owner: Tanguy (account plays in the
"Chosey / Player-1B8E / Player-FBAD …" squad, whose raw logs are in `logs/raw`).

**Start here as a new session:** read this file, then [FINDINGS.md](FINDINGS.md), then run
`node scripts/build_dataset.js && node scripts/key_checks.js` to see every headline number recomputed from the logs.

## The goal behind the research
The user wanted to understand why green rounds sometimes have fewer than 3 targets, and ultimately **how to
consistently get fewer than 3 greens** (so the group doesn't have to deal with them). Current best answer — see FINDINGS §3:
**the "+2.5s Fixated" timing bug makes the last-phase +63s green round come out 2 greens short (3 → 1), 4 of 4 cases.**

## Folder layout
```
README.md            this file (context + how to continue)
docs/index.html      static documentation page (categories, search) GENERATED from FINDINGS.md + README.md + data/ —
                     rebuild with `node scripts/build_docs.js` after every change to the notes
FINDINGS.md          every conclusion, its evidence, and hypotheses that were tested and REJECTED
logs/raw/            the user's own raw arcdps logs (.zevtc), CM, 2026-09-30 (5 that reached last phase) + all of 2026-10-01
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
| `aspect_events.csv` | Aspect of the Staff/Spear/Sword spawns, deaths (+respawn time), breakbar breaks (+orb delay) |

Times are seconds from log start. **Raw logs start ~3 s later than EI** (EI shows the first Fixated at 0 s, raw at 3.0 s).
"Last phase" = from the start of Vloxx's channel skill **81071**; its rounds are at **+3, +33, +63 s** (greens),
**+23, +43, +63 s** (Probability Distribution) and Fixated ticks at **+2.5, +22.5, +42.5, +62.5 s**.

## How to run
```
cd vloxx-research
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
    (all in `logs/`), 1 CM kill.
* **Raw logs are always better** than EI JSON: exact positions, every effect/buff event, agent effects (EI doesn't export).
  New raw logs: the user's folder `C:\Users\Sanqu\Documents\Guild Wars 2\addons\arcdps\arcdps.cbtlogs\Vloxx (28106)`.

## Important IDs (arcdps build EVTC20260929, game build 207890/207970)
| what | id |
|---|---|
| boss Vloxx species | 28106 (Aspects: Staff 28017, Spear 28033, Sword 28107) |
| 3-people green marker (agent effect, raw) | effect id **10269** (EI mechanic `3Green.Slct`) |
| Probability Distribution marker (agent effect, raw) | effect id **6188** (EI `Pddl.Drp`) |
| 2-people green "shackles" marker (Ascension's Sacrifice, skill 81076) | effect id **37976** (EI `2Green.Slct`) |
| effect GUID → raw id | statechange 46: GUID bytes = src(8, LE) + dst(8, LE) as hex, `skill` = content id. GUIDs listed in EI `ParserHelpers/GUIDs/EffectGUIDs.cs` |
| Judgment of Eternity cast (early phases) / failed-green damage | skill 80629 / 80378 (+ fixed 4,000 dmg skill 23296) |
| Fixated (Timed) buff | 34508 (60 s) |
| Stealth buff | 13017 |
| Ascension buff (10 stacks at start, −3 per failed green hit) | 80368 |
| last-phase channel | skill 81071 |
| Ascension Orb agents | max HP 14,940, hitbox 16 (EI renames them "Ascension Orb") |
| Vloxx hitbox | width 300 (raw 150 in agent struct) |
| Aspect spawn points (world) | Staff 11850.4, 16084.5 · Spear 12562.2, 14596.9 · Sword 13036.2, 15699.1 (FINDINGS §5c) |
| world → map/marker-tool coords | × 0.0254 (inches → meters) |
| squad markers | statechange 53, skill = marker index, src = float x,y, value = float z |

**Working rule (from the user): whenever something new is learned, save it here** (FINDINGS.md / README / data / scripts)
in the same turn, **then rebuild the doc page**: `node scripts/build_docs.js`. New FINDINGS sections (`## N. Title`) appear
automatically; to give one its own sidebar category, add an entry to `CATS` in `scripts/build_docs.js`.

## Status / open questions (see FINDINGS §7)
1. **Untested:** does stealthing off Fixated *during Split 3* (before the last phase starts) let the +2.5 s tick apply a fresh
   Fixated? Boss-phase data says stealth makes the boss skip its next re-application ~half the time.
2. Why later last-phase ticks (+22.5/+42.5/+62.5) sometimes skip with nobody fixated — no rule found.
3. 1 unexplained short round: 050224 +33 s (Fixated stealthed off at +15 s, +22.5 s tick skipped, 2 greens instead of 3).
4. Which players get the non-fixated greens — biased to near the boss, not strictly nearest; exact rule unknown.
