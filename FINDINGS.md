# Findings — Vloxx CM (Nexus of Eternity)

Confidence tags: **[solid]** many cases, no counter-example · **[likely]** consistent but small sample · **[open]** unresolved ·
**[REJECTED]** tested and disproved (kept so nobody re-tests it blindly).
Current sample (2026-10-03): **175 CM logs** — 162 raw from our squad + 13 EI from other squads — of which **26 reached the last phase**
(12 raw); 1,121 green rounds; 961 Fixated applications; 1,771 Ascension Orbs; plus 13 NM logs. History: first written on 49 CM logs
(35 raw + 14 EI, 24 last phase); 141 after 2026-10-02; 175 after adding the 2026-10-02 afternoon/evening session (34 CM logs, 2 last phases).

---
## 1. Green rounds — the basics
* **When:** early phases → with each *Judgment of Eternity* cast (skill 80629, ~4.4 s cast; markers appear ~1.36 s into it).
  Last phase → at **+3 s, +33 s, +63 s** (then +93 s…) after the 81071 channel starts. **[solid]**
* Markers are placed **one by one, 80 ms apart** ("slots"). **[solid]**
* **Slot 1 = the Fixated player**, at any distance. If nobody holds Fixated, slot 1 stays empty and the first marker lands
  ~80 ms late. **[solid]** (165/165 rounds with a fixated player had them first.)
* **Count = min(3, floor(players up / 3))**, downed/dead players don't count. **[solid]** — 338/338 rounds with a fixated
  player (excluding the fight-start round) match (141 CM logs: 757/758; **175 CM logs: 873/875** — both exceptions are rounds
  2–3 s before a wipe ended the log: 20260930-225808 and 20261002-223258, 6 up → 1 green instead of 2). Every short round in our squad's own logs is explained by downs/deaths.
* **Fight start (first round, ~3 s / ~6 s raw):** always only the fixated player (48/49 logs). The others are still at the
  entrance ~4,400 units away. The exception (224233) had 6 players already hitting the boss and got 3. In CM players standing at
  the boss's feet at that moment (EI showed 4 units — actually unloaded positions) were not picked. **[solid]**
* **Who gets the non-fixated greens:** players near Vloxx are strongly favoured, but it is not strictly the closest. It looks like a distance-weighted pick.
  Each player is ranked by distance to Vloxx, among up players who are not fixated and not a PD target (raw logs):
  * **Early phases, 1,485 picks:** rank 1 = 46 %, rank 2 = 37 %, rank 3 = 11 %, rank 4 = 3 %, 5+ = 2 %. In practice "the two closest, usually".
  * **Last phase, 59 picks:** rank 1 = 34 %, rank 2 = 25 %, rank 3 = 19 %, rank 4 = 14 %, 5+ = 8 %. Flatter, but the sample is small.
  **[likely]** (the exact weighting is still open)
* **At +63 s, the Probability Distribution (PD) targets of that same instant don't get greens** (except the fixated player, who
  **always** gets both: 9/9, see §3b). Seen in every +63 s round (16). This is about *who*, it does not explain the *count*. **[solid]**
* Failed green (not enough players stacked in the 240-radius circle) → "Judgment of Eternity" damage + 23296 (4,000 fixed) on
  everyone in it, and **−3 Ascension stacks** each. **[solid]**
* **Early-phase and last-phase greens are different skills with the same markers.** Raw logs of the 12 fights that reached the last phase:

  | | early phases (116 rounds) | last phase (29 rounds) |
  |---|---|---|
  | trigger | Vloxx casts **80629** Judgment of Eternity (116/116) | **no cast**; it fires on a timer during the 81071 channel (+3/+33/+63 s) |
  | markers | effect **10269** (green circle, GUID BC9F7038…) + **12014** (GUID BA183F42…), once per round | same 10269 + 12014 |
  | failed-green damage | skill **80629** | skill **80378** (also named "Judgment of Eternity") |

  The target rules measured for both are the same: slot 1 = fixated, count = players up / 3, the others favour players near Vloxx.
  Every last-phase round that came up short is explained by the Fixated state (§3, §3b) or by downs. So the separate skill ID is
  real, but it doesn't by itself explain the missing greens. **[solid]** (IDs) / **[likely]** (same targeting code)

## 2. Fixated
* Buff 34508, lasts **60 s**. Removed early by **stealth** (every non-down/non-death early removal coincided to the ms with a
  stealth start, 16+ cases), **down**, **death**. **[solid]**
* **Never applied during a split**; a Fixated applied before a split carries through it. **[solid]**
* **Boss phases:** after Fixated ends, a new one is applied usually **~7.6–8.1 s later** (EI logs, gaps not spanning a split:
  expiry median 7.6 s, 40/46 within 3–10 s). The second Fixated of every fight is at ~67–68 s (EI) / ~71 s (raw). **[solid]**
* **After stealth the boss often misses a cycle:** EI Spear phase — 8 of 14 stealth losses were re-applied >12 s later vs 1 of 9
  after expiry. Overall stealth ≈ 50 % late, expiry ≈ 10 % late. **[likely]** (re-application trigger itself not identified:
  boss cast ends explain only 43/84 applications — **[REJECTED]** as the trigger.)
  175-log raw set (gaps that may span a split, so inflated): gap > 12 s after expiry 126/463 (27 %), after stealth 51/124 (41 %),
  after a down 52/113 (46 %); medians 8.2 / 10.5 / 10.9 s. Stealth and downs are still clearly worse than a natural expiry.
* **Last phase:** Fixated is only applied on ticks at **+2.5, +22.5, +42.5, +62.5 s** (0.5 s before green round +3 s and before each
  PD tick), only if nobody holds it:
  * **+2.5 s tick never skipped:** 14/14 applied when nobody held it (11 after expiry, 3 after a down, 0 after stealth = untested).
  * +22.5 / +42.5 / +62.5 ticks skip sometimes (175-log set: 17 skipped / 40 = 43 %; +22.5 8/15, +42.5 5/17, +62.5 3/7), no rule
    found (not time since loss, not cause, not holder state, not stealth at the tick). After a +22.5 skip, +42.5 applied **7/7**. **[open]**
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

4 of 4, no counter-example (175-log set). Every other log where +2.5 s applied had the holder go down or die before +62.5 s (normal
+63 s round, or the fight ended).
**Nobody being fixated is not enough on its own:** in 20261002-225404 the +42.5 s Fixated holder went down at +59.5 s and the +62.5 s
tick skipped. +63 s had no fixated player yet came out **full (3 greens, slots 2–4)**, and +33 s with nobody fixated was full too.
The 1-green outcome so far only happens when a holder exists at the +62.5 s tick and expires milliseconds after it.
The group in 005256 / 010435 / 3273c (Player-582B, Player-BC75, Player-700E, …) appears to do it on purpose.
**Recipe:** (1) nobody fixated at last-phase +2.5 s; (2) that Fixated holder doesn't stealth or go down for 60 s; (3) +63 s → 1 green.
For (1) the last pre-last-phase Fixated must be applied ≥ ~58 s before the last phase starts, or be removed (stealth during
Split 3 — **untested**, and stealth makes the boss skip its next chance ~half the time in boss phases).
In our squad's 12 raw last-phase fights, 10 still had the pre-last-phase Fixated at +2.5 s (applied only 30–45 s before).

Related "stale fixation" cases (one green lost at +33 s): 050224 (Fixated stealthed off at +15 s, +22.5 tick skipped → 2 greens);
210120 +63 s (holder downed, +62.5 skipped, 0 instead of 1). Not consistent: other no-fixated rounds were full (214712, 234618,
213946, 223543, 20261002-225404 at +33 s; 20261002-225404 at +63 s after the holder went down and +62.5 skipped). **[open]**

## 3b. Green + spread on the same player at +63 s (the "overlap")  **[solid]**
At last-phase **+63 s** the green round and a Probability Distribution (PD) tick fire at the same instant. Both put **the fixated
player first**: green slot 1 = fixated, and PD's first target = fixated. So **whoever holds Fixated at +63 s gets a green and a spread
at the same time**. Non-fixated players never get both, because the other greens skip that instant's PD targets (§1).

| Fixated holder at +63 s | rounds | overlap | +63 s greens |
|---|---|---|---|
| someone (Fixated from +22.5 / +42.5 still active, or newly applied by the +62.5 s tick) | 9 | **9/9** | normal for players up |
| nobody: timing bug (§3), the +2.5 s Fixated expires ms after the +62.5 s tick | 4 | 0/4 | 1 (or 0) instead of 3 |
| nobody: the +42.5 s holder lost Fixated (down) and the +62.5 s tick **skipped** | 3 | 0/3 | **full** in the 10-up case (20261002-225404: 3 greens, 3 PD, no overlap); the other two had 3–4 up |

16 +63 s rounds (8 raw + 8 EI). Where the +63 s holder came from in the 9 overlap rounds:
* Fixated applied at +42.5 s: 3 rounds (234618, 213946, 223543).
* Applied at +22.5 s: 2 rounds (211921, 224233).
* Applied by the +62.5 s tick itself: 4 rounds (201030, 014037, 050224, 4f111).
Recomputed on every build: `key_checks.js` check 11.

Because Fixated lasts 60 s, a Fixated from +22.5 or +42.5 s is always still active at +63 s unless it's removed. And if nobody holds it, the +62.5 s tick
applies one (3 of 7 skipped in the 175-log set) and that new holder gets the overlap.

**How to avoid the overlap:** reach +63 s with **nobody fixated**. Two ways seen so far:
1. **The §3 timing bug:** nobody fixated at +2.5 s, and the +2.5 s holder keeps it the full 60 s. No overlap, and 3 greens become 1.
2. **Lose the +22.5/+42.5 s Fixated before +62.5 s** (seen with a down; stealth removes Fixated the same way) **and hope the +62.5 s tick skips**.
   It skipped in all 3 such cases here, but tick skips have no known rule (§2, ≈ 43 %). If it doesn't skip, the newly fixated player gets both.

## 4. Probability Distribution (spread + puddle)
* Fires at last-phase **+23, +43, +63 s** (every 20 s); same count rule (max(1, floor(up/3))); fixated player first.
  63/65 rounds match (175-log set: **68/70**). Never came up short with everyone up. **[solid]**

## 5. Ascension Orbs & Aspects
* Orbs are agents (max HP 14,940). They spawn in **groups of 3, 0.2 s apart, 200–450 units around an Aspect**,
  **~2.0 s (1.5–2.6 s) after that Aspect's breakbar is broken** — 86/86 confirmed breaks dropped orbs (full set: **250/251**, the miss = break 2.1 s before the log ended); deaths without a CC
  dropped orbs 4/91 times (probably a simultaneous CC elsewhere). **CC drops orbs, death doesn't.** **[solid]**
  Bigger groups (6/11) = overlapping breaks or Vloxx's own breakbar.
  175-log set: **299/302** breaks dropped orbs (delay 1.51–2.20 s, median 2.00 s). Misses: the end-of-log one above (thrown, but the log ended before they landed) plus 2 unexplained
  mid-fight Staff breaks with no orb agent at all (20261002-152053 @109.5 s, 20261003-001430 @129.2 s). Killing the Aspect right
  after the CC does **not** cancel the orbs (died < 1 s after: 18/19 dropped; 1–2 s: 29/29). **[open]** for the 2 misses.
* **How orbs are dropped:** at the moment of the CC the Aspect throws **3 missiles (skill 80520), 0.2 s apart**, at points
  ~300–700 units away. Each lands ~1.9–2.0 s later and an orb agent appears at the landing point. That is the ~2 s "orb delay". **[solid]**
* **CCs that gave no orbs: 3 of 302.** All were the first CC of that Aspect's life. In 2 of them the orbs were **never thrown**; in the
  third they were thrown but the log ended first. Our squad's raw logs, not uploaded.
  Fight time is as shown by Elite Insights / dps.report, about 3 s before raw arcdps time:

  | log file | CC at (fight time) | raw time | log length | notes |
  |---|---|---|---|---|
  | `20261002-152053.zevtc` | 1:46.5 | 109.5 s | 3:15.8 | **Staff, not thrown.** Staff died 0.3 s after the CC |
  | `20261003-001430.zevtc` | 2:06.2 | 129.2 s | 7:24.8 | **Staff, not thrown.** Staff died 2.4 s after; Corrosive Poison Cloud cast 8.4 s before |
  | `20260930-203947.zevtc` | 2:49.7 | 172.7 s | 2:54.8 | Spear: thrown (3 missiles at +0.0/+0.2/+0.4 s); the log ended 2.1 s later, before they landed |

  So **300/302 CCs threw the orbs**. In the 2 Staff misses there is **no 80520 missile at all**. Per-CC data: `data/orb_throws.csv`
  (`scripts/orb_throws.js`, rebuilt every build), with the throw count, the orbs seen and any projectile-hate skill cast nearby.
  Tested and **[REJECTED]** as explanations:
  * **Picking the orbs up before they land** (suggested from the replay): a throw would still be logged, and orbs grabbed the
    instant they land (lifetime 0.04 s) still show up as orb agents.
  * **Orbs already on the ground:** 28 breaks with ≥ 3 orbs lying around dropped normally, and one of the 2 Staff misses had none on the ground.
  * **The Aspect dying right after the CC:** see above.
  * **Not the Aspect's first CC:** all 302 breaks, misses included, were the first one of that Aspect's life.
  * **A phase change:** the misses were at different times relative to Vloxx going untargetable.
  * **A projectile block or reflect on the CC'd Aspect:** no player cast a projectile-defence skill in the 8 s before either Staff miss (except the cloud below), and
    normal CCs had them too (Smoke Screen 28/299, Temporal Curtain 7, Dust Storm 6, Sanctuary 3 …) with orbs dropping normally.
    Also, a destroyed missile would still log its creation.
  * **Necromancer Corrosive Poison Cloud (skill 10689, destroys projectiles) on the Aspect:** only one miss had a cloud. In
    20261003-001430 it was cast 8.4 s before the CC, by a player 204 units from the Staff; the other Staff miss had no cloud cast in the 20 s before. 23 CCs had a cloud cast in the previous 5 s, within 600 units of the Aspect, and all 23 dropped orbs.
  * **Vloxx/Aspect *Eternal Reflection* missiles hitting the Aspect** (seen at both mid-fight misses): 85 normal CCs had them too.
  * **Mesmer Feedback (skills 10302/10356):** not active at any miss. Feedback has no cast events in these logs, only
    ~1 s pulse events (statechange 49) from the mesmer. Feedback was active near the Aspect at 3 normal CCs, and orbs dropped.
  * **Any projectile reflect or destroy skill**, cast by a player within 10 s before the CC and less than 900 units from the Aspect.
    CCs that still dropped orbs: Corrosive Poison Cloud 57, Smoke Screen 31, Temporal Curtain 9, Dust Storm 9, Sanctuary 3.
    Misses: 1 (the Corrosive Poison Cloud above). **Projectile hate doesn't stop the orbs.**
  Remaining idea: a server-side miss, or an internal cooldown on the throw. **[open]**
  Ascension pickups are not logged as buff events (only ~100 statechange-18 snapshots per log), so pickups can't be timed from them.
* **Unpicked orbs disappear 120.1 s after spawning** (10/10; full set 14/14, 175-log set 20/20 that nobody picked; team-change event 5 s after vs 2 s for picked
  ones). Picked orbs: median ~4 s after spawn. Picking one gives the player Ascension. **[solid]**
* **Aspects (Staff, Spear, Sword) respawn exactly 40.0 s after dying**, each on its own timer, in every phase incl. last phase
  (Staff 64, Spear 58, Sword 22 deaths; full set Staff 199, Spear 156, Sword 36; 175-log set Staff 251, Spear 184, Sword 43 —
  all 39.97–40.01 s). **[solid]**

## 5b. Ascension's Sacrifice — 2-people green "shackles" (Staff phase)  [solid]
Skill **81076**, cast twice in the Staff phase (~38 s and ~85 s raw time). Marker = agent effect **37976**
(EI GUID A47987D0864223429B261683B6452826, mechanic `2Green.Slct`). Data: `data/ascension_sacrifice_2green.csv`
(script `scripts/asc_sacrifice.js`, 62 casts / 186 picks from our squad's raw CM logs).
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
* **175-log set (162 raw CM): 321 casts / 951 picks — marker 1 = fixated 295/295** (26 casts with nobody fixated); markers 2 and 3
  were never the fixated player (0/610). Distance ranks of all picks stay flat (rank 1–8 each 85–143 of 951).
  Monte-Carlo re-run (313 casts with 3 picks / 161 fights / 626 picks 2–3, 5,000 sims): every statistic p = 0.22–0.97, still
  indistinguishable from random. (Feature search not re-run.)
* 13 NM logs are in `logs/raw_nm/` (not analysed).
* **Line of sight [REJECTED]** (`scripts/asc_sacrifice_los.js`, positions in `data/ascension_sacrifice_positions.csv`):
  pick rate vs expected by absolute 300×300 map cell (25 cells, chi-square 8.7, random ≈ 25), by direction × distance from
  Vloxx (16 bins, chi-square 5.3, random ≈ 15) — every area 0.76–1.32× expected, no dead zone. All candidates are within
  ±30 height of Vloxx (flat arena), so nothing to hide behind.

## 5c. Arena coordinates — Aspect spawn points  [solid]
* Each Aspect **always spawns at the exact same spot** (670 spawns in 128 raw logs; 822 in 162, still zero variation; all at z = −12395):

| Aspect | arcdps world (inches) | map / squad-marker tool format (meters) | dist. from arena centre |
|---|---|---|---|
| Staff | 11850.40, 16084.50 | **301.000, 408.546** | 843 |
| Spear | 12562.20, 14596.90 | **319.080, 370.761** | 805 |
| Sword | 13036.20, 15699.10 | **331.119, 398.757** | 895 |
| Vloxx (arena centre, last phase) | ≈ 12222, 15327 | **≈ 310.44, 389.31** | — |

* Spawn spacing: Staff↔Spear 1,649 · Staff↔Sword 1,247 · Spear↔Sword 1,200 (world units).
* **Conversion: map coordinate = arcdps world position × 0.0254** (inches → meters, no offset; second value increases
  upward on the map). Derived from a marker-tool screenshot (arrow 292.731, 408.926; circle 267.190, 389.968) whose
  layout around the boss only fits this mapping; not yet confirmed in game by placing a marker on a spawn **[likely]**.
* **Platform:** circle of radius **≈ 2,470** around the arena centre (12221.6, 15327.4; 12 last-phase samples, unchanged).
  99 % of player positions (after the first 6 s; 913,101 samples) are within 2,281 of the centre; EI's combat-replay map is a 5,000-unit
  disc (750 px at 0.15 px/unit) centred on it. **[solid]**
* **Entrance:** players start ≈ **3,370 units west** of the centre (mean position in the first 6 s: 8856, 15449 → map 224.9, 392.4;
  was 8958, 15450 on 128 logs — it is an average of where people stand, so it moves a little);
  the first green round therefore only hits the fixated player. **[solid]**
* **Cosmic adds (Piercer / Bulwark / Sunderer) spawn at one of 8 fixed points** on a ring 608–702 units from the centre,
  every ~45° (angles −180, −137, −94, −48, −1, 48, 94, 138°; 486 spawns, 585 in the 175-log set with the same 8 points;
  data in `data/arena.json → cosmicPoints`).
  Piercers spawn mostly 110–170 s, Bulwarks 270–290 s (around Splits 1–2), Sunderer rarely (Split 3). **[solid]**
  World / map coordinates of the 8 points: (11519, 15321) 292.59, 389.17 · (11731, 14878) 297.97, 377.90 ·
  (12172, 14664) 309.18, 372.47 · (12638, 14857) 320.99, 377.37 · (12830, 15313) 325.88, 388.96 ·
  (12645, 15794) 321.18, 401.17 · (12180, 15980) 309.36, 405.88 · (11718, 15783) 297.64, 400.88.
  Arena data for the planner: `scripts/build_arena.js` → `data/arena.json` (centre, radius, spawns, Cosmic ring,
  50-unit player-position heatmap).
* **Mechanic sizes from Elite Insights** (radius in world units, from EI's Nexus of Eternity combat-replay code). **Superseded by the measured sizes in §5d**, which the planner now uses:
  3-people green 240 · 2-people green (shackle) 150 · Probability Distribution spread circle 280, puddle 280 (trail 160) ·
  (EI's Cosmic Charge "trail 160 / puddle 280" is **wrong**, see below) · Annihilating Orb 180 + ring to 240 · post-teleport barrier 240 (ring to 300) ·
  Surrounding Curse 200 · Raging Storm 150 · Slice Through Reality port 220 · Excision Extremis 400 radius half-circle (Sword) ·
  Spear cone 135° · Bulwark arrow 1,850 × 100 · Vloxx staff sweep 2,400 × 1,200 ·
  Visions of Eternity 560. **[likely]** (EI's numbers, not re-measured; EI's "Worldpiercer 3,650 × 100" was **wrong**, see below)
* **Worldpiercer (Vloxx, skill 80916) = 6 projectiles in a star, exactly 60° apart** (330 casts / 1,964 projectiles; 175-log set
  380 casts / 2,264 projectiles — every cast has 6, every gap 60°). It is **not aimed at players** (median 31–35° from the nearest player).
  First cast ~170 s into the fight (median, 132 logs). Timeline: cast start →
  6 ground telegraphs (effect **39208**, one per spoke, orientation = `value` high int16 in mrad, spokes 1,047 mrad apart) →
  projectiles launch ~2.75–3.0 s later from Vloxx's position, aimed **5,000** units out, flying **~3,010 units/s** (p10–p90 3,050–3,100),
  and they disappear at the **arena edge** (median 2,584–2,586 from the centre, p1 2,449). So a spoke covers Vloxx → edge (~1,100–3,900 long
  depending on where Vloxx stands); it crosses the whole platform in ≤ 1.3 s. **Width:** a player is hit when the projectile passes
  within ~**100–110** units of their position (hit rate 61/67 within 100, 10/31 at 100–125, 5/74 at 125–150; 175-log set 70/76,
  12/34, 6/93), so treat each spoke as
  **~220 wide** (that figure includes the player's own hitbox). **[solid]** (shape, count, speed, range) / **[likely]** (width ±20).
  Data: `data/worldpiercer.csv`, script `scripts/worldpiercer.js`. Missile event layout: int16×10 positions packed in the
  value/buffDmg/overstack bytes. Statechange 57 holds the origin. 58 holds the aim point, then the origin. 59 holds the end position at bytes 4–9.
  Ground-effect u16 at byte 48 = duration in ms (green 8000, shackle 5000, Worldpiercer telegraph 5000), *not* a size.
* **Worldpiercer is only cast in the Spear phase** (every cast falls between the first Spear spawn and Split 2). Hit rate per player
  (`scripts/worldpiercer_hits.js` → `data/worldpiercer_hits.csv`):
  * Measured over every cast where the player was alive and present: hit = any damage event; knocked = moved > 150 units within 0.6 s of the hit.
  * Squad-wide, 175-log set: hit **2.6 %**, knocked **1.4 %** of 3,561 player × cast.
  * Account-F4C4 (Player-89AD): hit 2 / 278 (0.7 %), knocked 1 (0.4 %). That knock was the one hit that downed and killed him
    (170k damage, 20260930-014701 @ 299.1 s raw); the other hit (20260930-221626) moved him only 67 units.
* **Cosmic Charge (Vloxx, skill 80512) — the Spear-phase dash toward the fixated player.** 330 casts, 133 logs
  (`scripts/cosmic_charge_shape.js` → `data/cosmic_charge_summary.json`, rebuilt every build):
  * **Cast 7.8 s.** Vloxx dashes exactly **1398** units toward the **fixated player**, aimed at the start of the cast:
    the direction is 1° (median) / 17° (p90) off the fixated player's position at cast start.
    It moves from ~3.0 s to ~6.0 s, about 460 units/s.
  * **Knockdown pulses** (big hits, ~2.3–3.3k dmg) at **3.1, 3.6, 4.0, 4.5, 5.0, 5.5 s**, measured at each pulse's exact ms
    against Vloxx's position. Use the boss's *last logged* position: a standing boss logs no positions, and interpolating lands
    mid-dash. That mistake briefly gave a wrong 500–560 radius.
    * **Start pulse (3.1 s), a sharp circle of ~600–625:** hit rate 98 % inside 600, 80 % at 600–625, 1/45 beyond 625.
    * **Dash pulses (3.6–5.5 s), not a circle:**
      * sides about 600–625 (gradual fade from ~60 % at 300 to ~45 % at 500, none past 625);
      * front about 650–675 (small sample: ~100 % to 625, then nothing past 700);
      * behind, they keep hitting along the path already swept: still ~40–50 % at 1,000 behind.
    * Next to Vloxx, each dash pulse hits only ~65 % of the players in range, even counting evades and blocks. It isn't a per-player
      cooldown (back-to-back 0.5 s hits on the same player are common). **[open]**
    * In practice: a ~1,250-wide band along the whole dash, plus a ~625 circle at the start and ~650 past the end.
    * Dash length: **1,398 in 315/330 casts**. The shorter ones stop at the arena edge (~2,500 from the centre) or were cut off by a wipe.
  * It's a **knockdown, not a knockback**: hit players don't move faster than they did just before.
    **Stability prevents it**: the big hit strips a Stability stack at the same ms (1,638 of 5,033 big hits). Trail ticks almost never do.
  * **Trail:** ~500–700 dmg ticks every ~0.5 s for players within **150** of the dash line (300 wide), until
    **~15.4 s** after the cast start. No knockdown.
  * **Knockdowns per player** (`scripts/cosmic_charge_knocks.js` → `data/cosmic_charge_knocks.csv`):
    * Counts every cast where the player was alive and present. Knocked = a big hit that lands (normal/crit/glance) with no Stability.
    * **Squad-wide, 175-log set: knocked in 30.6 %** of 3,159 player × casts; 85.7 % are hit by a big hit, and Stability saves 64 % of those.
    * **Account-F4C4 (Player-89AD): knocked in 31.1 % of casts (76 / 244)**, average for the squad. Stability saved 63 % of his big hits.
    * Range among regular accounts: 18 % to 46 %.
  * The planner's Cosmic Charge preset (beam tool) draws exactly this from the measured numbers. **[solid]** (shape, timing, stability) / **[likely]** (reach ±50)
* The other "Worldpiercer" (skill **81015**) is cast by the **Cosmic Bulwark** (Splits), with no missiles. Its shape has not been re-measured
  (EI: Bulwark arrow 1,850 × 100).
* arcdps squad markers: statechange **53**, `skill` = marker index (0 arrow, 1 circle, 2 heart, 3 square, 4 star, 5 spiral,
  6 triangle, 7 x), position = `src` as two floats (x, y) + `value` as float z; (Infinity, Infinity) = marker removed.

## 5d. Attack shapes verified from raw logs  [solid unless marked]
Method (`scripts/attack_shapes.js` → `data/attack_shapes.json`, `scripts/attack_grid.js <skill>` for maps): each attack's hits on players are
grouped into impacts (same caster, ≤ 150 ms). At the impact ms every alive player is hit or not hit; evade, block and invulnerable
count as hit. NPC positions are the last logged one; player positions are interpolated. Shapes tested:
* a circle around the caster;
* a cone or rectangle in the caster's facing frame;
* a circle around the effect that telegraphs the attack. Effects are keyed by **GUID**, because effect ids change between logs.
Radius = where the hit rate drops below half of the inner rate. Sizes are measured to the player's centre, so they include the player's own hitbox (radius 24).
Elite Insights (EI) values = what the planner used before.

| attack (skill) | caster | measured shape | EI / old planner | verdict |
|---|---|---|---|---|
| Judgment of Eternity, failed 3-people green (80629) | Vloxx | circle **~240–250** around the green marker (98 % inside, 5 % outside) | 240 | ✔ |
| Probability Distribution spread (80809) | Vloxx | circle **~300** around the PD effect (93 % / 2 %), telegraph ~4 s | 280 | ≈ (slightly bigger) |
| Probability Distribution (81318) | Vloxx | circle **~325** around the same effect | puddle 280 | bigger |
| Surrounding Curse (80484 Vloxx, 81230 Staff) | Vloxx, Staff | circle **~200** around its ground marker (~1 s telegraph) | 200 | ✔ |
| Raging Storm (80810, 81176 Vloxx; 80965 Bulwark) | Vloxx, Bulwark | circle **~150** around its ground marker (~2 s telegraph) | 150 | ✔ |
| Visions of Eternity (80420, 81017) | Vloxx | circle **~600** (100 % / 0 %, 113 impacts) | 560 | bigger |
| Slice Through Reality (80585) | Vloxx | circle **~525 around Vloxx**, ground marker 7 s before | "port 220" | **wrong** |
| Excision Extremis (81053; 80901 in the last phase) | Vloxx | circle **~525** around a ground marker ~0.9 s before (~200 from Vloxx) | 400 half-circle | **wrong** **[likely]** |
| Excision Extremis (81326) | Sword | diffuse, forward ±450 out to ~2,000; no clean shape | 400 half-circle | **[open]** |
| Thousand Strikes (80709) | Spear | **forward cone, half-angle ~55° (~110°), radius ~1,100–1,200**; nothing behind | 135°, 1,000 | corrected |
| Thousand Strikes (80555) | Vloxx | same cone, radius ~1,200–1,500 | — | new |
| Division Eternal (80483) | Vloxx | **forward band ~900 wide (±450)**, ≥ 1,350 long, nothing behind | "staff sweep" 2,400 × 1,200 | **narrower** |
| Division Eternal (81330) | Sword | **forward rectangle ~750–800 wide, ~1,650–1,800 long** | — | new |
| Worldpiercer (81015), "Bulwark arrow" | Cosmic Bulwark | Bulwark stands still for a 4 s cast. Hits 3.9–5.9 s, on **one straight line** (all hits on one bearing): within ~150 of the line → **~300 wide**, out to ≥ 1,500. The line doesn't travel. | 1,850 × 100 | **wider** |
| Annihilating Orb (81273) | Cosmic Piercer | circle **~375** around the landing spot (ground effect ~1,200 from the Piercer) | 180 + ring 240 | **bigger** |
| Annihilating Orb (80323) | Vloxx | a narrow line ahead along Vloxx's facing (±150), hits fade by ~900; a forward projectile, not a circle | 240 | **[open]** |
| Echoing Blade (81271) | Vloxx | circle ~450–500 around Vloxx, ~45 % hit per pulse | — | **[likely]** |
| Ancora Strike (80940 Staff/Spear, 81327 Sword) | Aspects | short frontal swing ~200–300 ahead, ±150 (the tank hit) | — | new |
| 80717 | Cosmic Bulwark | short frontal ~250 ahead | — | new |
| Ascension's Sacrifice (81076) | Vloxx | its damage only lands on the marked player (r ≈ 0); the 2-person circle (150) has no separate failure hit to measure | 150 | not verifiable |
| Cosmic Charge (80512), Worldpiercer (80916) | Vloxx | measured separately (see the sections above) | | ✔ |

Names of skills that are unnamed in raw logs come from Elite Insights' skill map (80484/81230 Surrounding Curse, 80585 Slice Through Reality,
80483 Division Eternal, 81273/81238 Annihilating Orb). The planner presets now use the measured sizes.

## 6. Hypotheses that were tested and REJECTED (don't redo)
* **Range limit ~600 (last phase) / ~775 (early, = 600 + boss hitbox 150 + player 24).** Looked perfect on EI data (211/211),
  **broken by our squad's raw 2026-10-01 logs** (201030 +33 s: 3 greens with everyone 714–898 away; 213946/223543 +33 s: 3
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
5. **Orbs not thrown (2/302 CCs, both Staff, §5).** Why the Aspect sometimes skips the 80520 throw. Projectile hate, pickups, deaths, orbs on the
   ground and phase changes are ruled out. Worth re-checking each new miss in `data/orb_throws.csv` against what was happening in the replay.
6. **Avoiding the +63 s overlap without losing greens (§3b).** Have the +42.5 s Fixated holder stealth before +62.5 s, then check
   whether the +62.5 s tick skipped (`fixation_last_phase_ticks.csv`), whether +63 s had an overlap, and how many greens it had.
   Only 1 clean example so far (20261002-225404, holder downed).
Anything new should be checked on **raw .zevtc** (exact positions, every effect) — EI JSON misled us once (range).
