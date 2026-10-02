# Findings — Vloxx CM (Nexus of Eternity)

Confidence tags: **[solid]** many cases, no counter-example · **[likely]** consistent but small sample · **[open]** unresolved ·
**[REJECTED]** tested and disproved (kept so nobody re-tests it blindly).
Sample at time of writing: 49 CM logs (later 141 CM logs — 128 raw + 13 EI — after adding the rest of the user's folder on 2026-10-02; the extra raw logs are mostly early wipes, so last-phase counts are unchanged) (35 raw from the user's squad, 14 EI from other squads), 24 of them reached the last phase;
414 green rounds; 326 Fixated applications; 593 Ascension Orbs.

---
## 1. Green rounds — the basics
* **When:** early phases → with each *Judgment of Eternity* cast (skill 80629, ~4.4 s cast; markers appear ~1.36 s into it).
  Last phase → at **+3 s, +33 s, +63 s** (then +93 s…) after the 81071 channel starts. **[solid]**
* Markers are placed **one by one, 80 ms apart** ("slots"). **[solid]**
* **Slot 1 = the Fixated player**, at any distance. If nobody holds Fixated, slot 1 stays empty and the first marker lands
  ~80 ms late. **[solid]** (165/165 rounds with a fixated player had them first.)
* **Count = min(3, floor(players up / 3))**, downed/dead players don't count. **[solid]** — 338/338 rounds with a fixated
  player (excluding the fight-start round) match (2026-10-02 full set of 141 CM logs: **757/758**; the 1 exception is a round 2.6 s before a wipe ended the log). Every short round in the user's own logs is explained by downs/deaths.
* **Fight start (first round, ~3 s / ~6 s raw):** always only the fixated player (48/49 logs). The others are still at the
  entrance ~4,400 units away. The exception (224233) had 6 players already hitting the boss and got 3. In CM players standing at
  the boss's feet at that moment (EI showed 4 units — actually unloaded positions) were not picked. **[solid]**
* **Who gets the non-fixated greens:** players near Vloxx are strongly favoured (in 76 picks: rank 1 = 24, rank 2 = 22,
  rank 3 = 14, rank 4 = 11, 5–7 = 5) but not strictly the closest — looks like a distance-weighted pick. **[likely]**
* **At +63 s, the Probability Distribution (PD) targets of that same instant don't get greens** (except the fixated player, who
  can get both). Seen in every +63 s round. This is about *who*, it does not explain the *count*. **[solid]**
* Failed green (not enough players stacked in the 240-radius circle) → skill **80378** "Judgment of Eternity (3-people green
  failed)" damage + 23296 (4,000 fixed) on everyone in it, and **−3 Ascension stacks** each. **[solid]**

## 2. Fixated
* Buff 34508, lasts **60 s**. Removed early by **stealth** (every non-down/non-death early removal coincided to the ms with a
  stealth start, 16+ cases), **down**, **death**. **[solid]**
* **Never applied during a split**; a Fixated applied before a split carries through it. **[solid]**
* **Boss phases:** after Fixated ends, a new one is applied usually **~7.6–8.1 s later** (EI logs, gaps not spanning a split:
  expiry median 7.6 s, 40/46 within 3–10 s). The second Fixated of every fight is at ~67–68 s (EI) / ~71 s (raw). **[solid]**
* **After stealth the boss often misses a cycle:** EI Spear phase — 8 of 14 stealth losses were re-applied >12 s later vs 1 of 9
  after expiry. Overall stealth ≈ 50 % late, expiry ≈ 10 % late. **[likely]** (re-application trigger itself not identified:
  boss cast ends explain only 43/84 applications — **[REJECTED]** as the trigger.)
* **Last phase:** Fixated is only applied on ticks at **+2.5, +22.5, +42.5, +62.5 s** (0.5 s before green round +3 s and before each
  PD tick), only if nobody holds it:
  * **+2.5 s tick never skipped:** 13/13 applied when nobody held it (11 after expiry, 2 after a down, 0 after stealth = untested).
  * +22.5 / +42.5 / +62.5 ticks skip sometimes (≈ 40 %), no rule found (not time since loss, not cause, not holder state,
    not stealth at the tick). After a +22.5 skip, +42.5 applied 6/6. **[open]**
  * The previous holder can be re-fixated immediately (233450, 230802, 220703).

## 3. ★ The way to get fewer greens: the "+2.5 s Fixated" timing bug  **[likely → strong]**
If nobody holds Fixated when the last phase starts, the **+2.5 s tick** gives it to someone. It lasts exactly 60 s, so it ends
**10–30 ms after the +62.5 s tick**. That tick still sees a holder → gives Fixated to nobody → the **+63 s green round has no
fixated player and comes out 2 greens short**:

| log | Fixated ended | +63 s greens | normal |
|---|---|---|---|
| 220703 (dps.report qVZX) | +62.51 s | 1 | 3 |
| 3273c (Wingman) | +62.53 s | 0 | 2 |
| 20261002-005256 (b.dps.report ST7h) | +62.52 s | 1 | 3 |
| 20261002-010435 (b.dps.report rKIr) | +62.52 s | 1 | 3 |

4 of 4, no counter-example. Every other log where +2.5 s applied had the holder go down before +62.5 s (normal +63 s round).
The group in 005256 / 010435 / 3273c (Player-582B, Player-BC75, Player-700E, …) appears to do it on purpose.
**Recipe:** (1) nobody fixated at last-phase +2.5 s; (2) that Fixated holder doesn't stealth or go down for 60 s; (3) +63 s → 1 green.
For (1) the last pre-last-phase Fixated must be applied ≥ ~58 s before the last phase starts, or be removed (stealth during
Split 3 — **untested**, and stealth makes the boss skip its next chance ~half the time in boss phases).
In the user's 10 raw last-phase fights, 9 still had the pre-last-phase Fixated at +2.5 s (applied only 30–45 s before).

Related "stale fixation" cases (one green lost at +33 s): 050224 (Fixated stealthed off at +15 s, +22.5 tick skipped → 2 greens);
210120 +63 s (holder downed, +62.5 skipped, 0 instead of 1). Not consistent: other no-fixated rounds were full (214712, 234618,
213946, 223543 at +33 s). **[open]**

## 4. Probability Distribution (spread + puddle)
* Fires at last-phase **+23, +43, +63 s** (every 20 s); same count rule (max(1, floor(up/3))); fixated player first.
  63/65 rounds match. Never came up short with everyone up. **[solid]**

## 5. Ascension Orbs & Aspects
* Orbs are agents (max HP 14,940). They spawn in **groups of 3, 0.2 s apart, 200–450 units around an Aspect**,
  **~2.0 s (1.5–2.6 s) after that Aspect's breakbar is broken** — 86/86 confirmed breaks dropped orbs (full set: **250/251**, the miss = break 2.1 s before the log ended); deaths without a CC
  dropped orbs 4/91 times (probably a simultaneous CC elsewhere). **CC drops orbs, death doesn't.** **[solid]**
  Bigger groups (6/11) = overlapping breaks or Vloxx's own breakbar.
* **Unpicked orbs disappear 120.1 s after spawning** (10/10; full set 14/14 that nobody picked; team-change event 5 s after vs 2 s for picked
  ones). Picked orbs: median ~4 s after spawn. Picking one gives the player Ascension. **[solid]**
* **Aspects (Staff, Spear, Sword) respawn exactly 40.0 s after dying**, each on its own timer, in every phase incl. last phase
  (Staff 64, Spear 58, Sword 22 deaths; full set Staff 199, Spear 156, Sword 36 — all 39.97–40.01 s). **[solid]**

## 5b. Ascension's Sacrifice — 2-people green "shackles" (Staff phase)  [solid]
Skill **81076**, cast twice in the Staff phase (~38 s and ~85 s raw time). Marker = agent effect **37976**
(EI GUID A47987D0864223429B261683B6452826, mechanic `2Green.Slct`). Data: `data/ascension_sacrifice_2green.csv`
(script `scripts/asc_sacrifice.js`, 62 casts / 186 picks from the user's raw CM logs).
* **3 markers per cast, 0.68 s apart**, at **+2.03, +2.72, +3.40 s** after the cast starts.
* **Marker 1 = the Fixated player: 59/59** casts where someone was fixated (3 casts with nobody fixated → someone else).
* **Markers 2 and 3 are not proximity-based**: rank by distance to Vloxx is uniform (mean 4.7 vs 4.75 random, ranks 1–10
  all common); same for distance to the previous target and to the fixated player. Looks random among players up
  (excluding those already marked).
* **Not baitable by positioning.** Only "bait": whoever holds Fixated at that moment gets the first shackle.
* Deeper search for picks 2/3 (124 picks, chance of "picked player is the top candidate" = 11.8 %), all at chance level
  (scripts `asc_sacrifice_features.js`, `asc_sacrifice_links.js`): distance to boss (at pick, at cast start, 2 s before),
  angle to boss facing, distance to previous target / fixated target / nearest Aspect / arena centre, crowding,
  HP %, Ascension stacks, toughness/healing/concentration/condition ranks, subgroup (all-same-subgroup 16 % = random),
  squad order, instance id, profession, damage on boss (5/15/60 s/total), damage taken, time since last boss hit,
  times previously targeted by 3-greens / PD / shackles / Fixated, being hit/targeted by any boss or Aspect skill or effect
  in the 11 s before. Per-player rates 0.8–1.3× expected. Best single feature 17.7 % (noise among ~50 tests).
  Buff 80951 (5 s) + skill 23296 (5,000 dmg) + 81076 hit land on the target at the same ms as the marker = consequences.
  **Conclusion: indistinguishable from uniform random among up players (excluding already-marked) in logged data. [likely]**
* **Re-run on the full raw set (2026-10-02, 128 CM raw logs: 264 casts / 127 fights / 519 picks 2–3):**
  marker 1 = fixated **242/242** (22 casts with nobody fixated). Best feature 14.1 % vs 11.8 % random (≈ +1.6 SE, noise among
  ~50 tests); the earlier "damage on boss 5 s" 17.7 % regressed to 12.3 %. Monte-Carlo randomness tests
  (`scripts/asc_sacrifice_randomness.js`, 5,000 sims): every statistic p = 0.25–0.80; the small-sample "too even across players"
  hint (p = 0.02 on 62 casts) vanished (p = 0.36). A per-player bias of ≳1.3× would now be detectable — none found. **[solid]**
* 12 NM logs with 33 shackle casts are in `logs/raw_nm/` (not analysed).
* **Line of sight [REJECTED]** (`scripts/asc_sacrifice_los.js`, positions in `data/ascension_sacrifice_positions.csv`):
  pick rate vs expected by absolute 300×300 map cell (25 cells, chi-square 8.7, random ≈ 25), by direction × distance from
  Vloxx (16 bins, chi-square 5.3, random ≈ 15) — every area 0.76–1.32× expected, no dead zone. All candidates are within
  ±30 height of Vloxx (flat arena), so nothing to hide behind.

## 5c. Arena coordinates — Aspect spawn points  [solid]
* Each Aspect **always spawns at the exact same spot** (670 spawns in 128 raw logs, zero variation; all at z = −12395):

| Aspect | arcdps world (inches) | map / squad-marker tool format (meters) | dist. from arena centre |
|---|---|---|---|
| Staff | 11850.40, 16084.50 | **301.000, 408.546** | 843 |
| Spear | 12562.20, 14596.90 | **319.080, 370.761** | 805 |
| Sword | 13036.20, 15699.10 | **331.119, 398.757** | 895 |
| Vloxx (arena centre, last phase) | ≈ 12222, 15327 | **≈ 310.44, 389.31** | — |

* Spawn spacing: Staff↔Spear 1,649 · Staff↔Sword 1,247 · Spear↔Sword 1,200 (world units).
* **Conversion: map coordinate = arcdps world position × 0.0254** (inches → meters, no offset; second value increases
  upward on the map). Derived from the user's marker tool screenshot (arrow 292.731, 408.926; circle 267.190, 389.968) whose
  layout around the boss only fits this mapping; not yet confirmed in game by placing a marker on a spawn **[likely]**.
* arcdps squad markers: statechange **53**, `skill` = marker index (0 arrow, 1 circle, 2 heart, 3 square, 4 star, 5 spiral,
  6 triangle, 7 x), position = `src` as two floats (x, y) + `value` as float z; (Infinity, Infinity) = marker removed.

## 6. Hypotheses that were tested and REJECTED (don't redo)
* **Range limit ~600 (last phase) / ~775 (early, = 600 + boss hitbox 150 + player 24).** Looked perfect on EI data (211/211),
  **broken by the user's raw 2026-10-01 logs** (201030 +33 s: 3 greens with everyone 714–898 away; 213946/223543 +33 s: 3
  greens with only 2–4 players within 600). The fit was an artifact of EI's 300 ms positions. Greens in the last phase are not
  range-limited in any way found. (Fight-start 1-green is due to everyone being 4,000+ away / not engaged, not a 600 range.)
* "Random draw, stop at first out-of-range/invalid pick" model.
* Reservation of soakers around each green; minimum spacing between greens; distance to arena centre or any other point.
* Boss HP threshold (~6.5 %) — looked monotonic on 8 rounds, nothing happens at that HP in game; superseded by §3.
* Stealth / dodge / any player cast at the green moment (dodging players still get greens; nobody dodged in 220703).
* Threat via damage on Vloxx (direct or condition); being in combat (everyone enters at log start).
* Greens on clones/minions (raw logs: greens only ever on players); EI hiding duplicate greens (EI mechanic has 0 ICD).
* Ascension stacks, Empowered stacks, adds alive, Probability Distribution targets as a cause of the *count*.

## 7. Open questions / suggested next tests
1. Have the fixated player **stealth during Split 3** (before the 81071 channel starts) → check in the log whether the +2.5 s
   tick still applied (`fixation_last_phase_ticks.csv`, tick 2.5) and whether +63 s had 1 green.
2. Rule behind skipped +22.5/+42.5/+62.5 s ticks.
3. The 050224-type one-green-short +33 s rounds.
4. Exact weighting for non-fixated green targets.
Anything new should be checked on **raw .zevtc** (exact positions, every effect) — EI JSON misled us once (range).
