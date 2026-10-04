# Findings — Vloxx CM (Nexus of Eternity)

Confidence tags: **[solid]** many cases, no counter-example · **[likely]** consistent but small sample · **[open]** unresolved ·
**[REJECTED]** tested and disproved (kept so nobody re-tests it blindly).
Current sample (2026-10-04): **268 CM logs** — 236 raw from our squad + 32 EI from other squads (18 of them CM kills from GW2 Wingman) — of which
**58 reached the last phase** (26 raw, 4 of them kills); 1,822 green rounds; 1,500 Fixated applications; 2,753 Ascension Orbs; plus NM logs.
Numbers quoted as "175-log set" below are from the previous sample; headline rules re-checked on the 268-log set: green count rule **1,434/1,436**,
Probability Distribution count 171/175, orb throws 423/425 (same 2 Staff misses), +63 s overlap 19/19 with a fixated player and 0/22 without. History: first written on 49 CM logs
(35 raw + 14 EI, 24 last phase); 141 after 2026-10-02; 175 after adding the 2026-10-02 afternoon/evening session (34 CM logs, 2 last phases);
240 after adding the 2026-10-03 sessions (47 raw logs) and 18 CM kills from Wingman;
268 after adding the 2026-10-04 session (28 raw logs).

---
## 1. Green rounds — the basics
* **When:** early phases → with each *Judgment of Eternity* cast (skill 80629, ~4.4 s cast; markers appear ~1.36 s into it).
  Last phase → at **+3 s, +33 s, +63 s** (then +93 s…) after the 81071 channel starts. **[solid]**
* Markers are placed **one by one, 80 ms apart** ("slots"). **[solid]**
* **Slot 1 = the Fixated player**, at any distance. If nobody holds Fixated, slot 1 stays empty and the first marker lands
  ~80 ms late. **[solid]** (165/165 rounds with a fixated player had them first.)
* **Count = min(3, floor(players up / 3))**, downed/dead players don't count. **[solid]** — 338/338 rounds with a fixated
  player (excluding the fight-start round) match (141 CM logs: 757/758; 175 CM logs: 873/875; **268 CM logs: 1,434/1,436** — both exceptions are rounds
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

* **Entering P2 (Spear) and P3 (Sword): with or without a Fixated carried through the split** (`scripts/phase_entry_fixated.js` →
  `data/phase_entry_fixated.csv`; 120 P2 entries, 47 P3 entries, raw logs). A phase change goes: split starts → Vloxx returns channelling
  *Visions of Eternity* with its breakbar (§5i) → the bar is broken → the boss phase resumes ("entry" = end of that cast).
  * **Fixated is checked when the bar breaks, ~1.4 s before the entry.** If nobody holds it, a new one is applied right there
    ("fresh": 91 of 120 P2 entries, 29 of 47 P3 entries). If someone still holds one from before the split, nothing is applied and that
    player simply keeps it ("carried": 27 P2, 16 P3). Truly entering with nobody fixated almost never happens (2 fights each, and Fixated
    was applied at the entry itself).
  * **Vloxx's behaviour does not change.** Cast order and timing are identical in both cases, to the tenth of a second.
    P2: Judgment of Eternity 0 s, Cosmic Charge 4.5 s, Worldpiercer 12.4 s, Raging Storm 18.5 s, Thousand Strikes 27.4 s, Probability
    Distribution 33.5 s. P3: Judgment of Eternity 0 s, Echoing Blade 4.5 s, Slice Through Reality 9.9 s, Excision Extremis 15.4 s,
    Probability Distribution 23.2 s, Division Eternal 25.2 s. The first green round (1.4 s after entry) has 3 greens in every case.
  * **What changes is who is fixated and for how long.**
    * *Fresh:* the new holder looks random: any distance from Vloxx (ranks 1–10 about equally often), and it is the previous holder in
      only 5 of 91 (P2) and 3 of 29 (P3). The Fixated lasts until ~58.6 s after the entry unless it is lost (median 46 s in P2, 35 s in P3).
    * *Carried:* the old Fixated runs out early in the phase (P2: median 17 s after the entry, P3: 11 s), then nobody is fixated for
      ~9–11 s (3–20 s), and the next one is applied a median 26 s (P2) / 21.6 s (P3) after the entry.
  * **Side effect of carrying:** attacks early in the phase can land with nobody fixated. First Cosmic Charge (4.5 s): a fixated player
    existed in 91/91 fresh entries and 24/27 carried ones; the 3 unfixated charges went at a player who was neither fixated nor the closest.
    First P3 green round: fixated present 17/18 fresh, 6/8 carried (the green count stays 3 either way).
  **[solid]** (timings, no change in casts) / **[likely]** (random pick of the fresh holder).

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

  So **300/302 CCs threw the orbs** (268-log set: **423/425**, the same 2 misses). In the 2 Staff misses there is **no 80520 missile at all**. Per-CC data: `data/orb_throws.csv`
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

## 5c. Arena coordinates — Aspect and Cosmic spawn points  [solid]
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
* Worldpiercer and Cosmic Charge have their own sections now: §5g and §5h.
* arcdps squad markers: statechange **53**, `skill` = marker index (0 arrow, 1 circle, 2 heart, 3 square, 4 star, 5 spiral,
  6 triangle, 7 x), position = `src` as two floats (x, y) + `value` as float z; (Infinity, Infinity) = marker removed.

## 5d. All attack shapes verified from raw logs (table)  [solid unless marked]
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
| Slice Through Reality (80585) | Vloxx | circle **~525 around Vloxx** at 1.2 s, then a **portal of ~300 radius** where Vloxx stood (hits and teleports players to an identical exit ~2,000 away, open ~9 s); see §5m | "port 220" | **wrong** |
| Excision Extremis (81053; 80901 in the last phase) | Vloxx | **semicircles of radius ~525**, 16 (sometimes 23–24) per cast, each telegraphed 2.0 s before; see §5e | 400 half-circle | bigger (radius), shape ✔ |
| Excision Extremis (81326) | Sword | diffuse, forward ±450 out to ~2,000; no clean shape | 400 half-circle | **[open]** |
| Thousand Strikes (80709) | Spear | **forward cone, half-angle ~55° (~110°), radius ~1,100–1,200**; nothing behind | 135°, 1,000 | corrected |
| Thousand Strikes (80555) | Vloxx | same cone, radius ~1,200–1,500 | — | new |
| Division Eternal (80483) | Vloxx | **forward band ~900 wide (±450)**, ≥ 1,350 long, nothing behind | "staff sweep" 2,400 × 1,200 | **narrower** |
| Division Eternal (81330) | Sword | first hit ~500 around the Sword, then a **line of 6 half-circle slashes: ~1,050 wide (±500–550), ~1,800 long**; see §5j | — | corrected |
| Worldpiercer (81015), "Bulwark arrow" | Cosmic Bulwark | Bulwark stands still for a 4 s cast. Hits 3.9–5.9 s, on **one straight line** (all hits on one bearing): within ~150 of the line → **~300 wide**, out to ≥ 1,500. The line doesn't travel. | 1,850 × 100 | **wider** |
| Annihilating Orb (81273) | Cosmic Piercer | circle **~375** around the landing spot (ground effect ~1,200 from the Piercer) | 180 + ring 240 | **bigger** |
| Annihilating Orb (80323 / 81238) | Vloxx | orb thrown along Vloxx's facing: **path ~500 wide, lands 1,500 away**, damage zone ~300 there, then a **ring expanding** from that point to ~1,200; see §5p | 240 | **wrong** |
| Echoing Blade (81271) | Vloxx | **half-circle of radius ~625 centred on Vloxx**, 8 pulses 0.6 s apart, each rotated 40° from the previous; 1 projectile per pulse; see §5f | — | new |
| Ancora Strike (80940 Staff/Spear, 81327 Sword) | Aspects | short frontal swing ~200–300 ahead, ±150 (the tank hit) | — | new |
| 80717 | Cosmic Bulwark | short frontal ~250 ahead | — | new |
| Ascension's Sacrifice (81076) | Vloxx | its damage only lands on the marked player (r ≈ 0); the 2-person circle (150) has no separate failure hit to measure | 150 | not verifiable |
| Cosmic Charge (80512), Worldpiercer (80916) | Vloxx | measured separately: §5h and §5g | | ✔ |

Names of skills that are unnamed in raw logs come from Elite Insights' skill map (80484/81230 Surrounding Curse, 80585 Slice Through Reality,
80483 Division Eternal, 81273/81238 Annihilating Orb). The planner presets now use the measured sizes.

## 5e. Excision Extremis — slashes vs telegraphs, boon strip and its lockout  [solid]
Scripts `scripts/excision_geometry.js` (→ `data/excision_slashes.csv`, `excision_summary.json`) and `scripts/excision_strip.js`
(→ `data/excision_strip.csv`, `excision_strip_summary.json`). 50 logs with the attack, 7,742 slashes, 7,475 hits that landed.

**How the attack is built (Vloxx, skill 81053; 80901 in the last phase).**
* Cast **6.2 s**. Vloxx lays semicircle **telegraphs** (ground effect GUID A5962B65…, 2.5 s) in pairs every ~0.5 s, in four directions 90° apart,
  marching outward from Vloxx.
* Exactly **2.0 s** after each telegraph the **slash** (ground effect GUID B4868841…) appears at the same spot. That is the damage pulse.
  Pulses land at 4.8, 5.3, 5.8, 6.2/6.3, 6.7/6.8, 7.2/7.3, 7.8 and 8.4 s after the cast starts; a cast has 16 slashes (142 casts), sometimes 17 or 23–24.
* Each slash is a **semicircle of radius ~525** around its origin: 100 % of players hit out to 500, 46 % at 500–550, 0 % beyond 550
  (Elite Insights draws 400). On the hit side 99.4 % are hit, on the other side 0.7 %.
* Effect rotation = int16 at byte 26 of the event, in mrad, **clockwise**: a player at bearing b from the origin is hit when
  norm(b + rotation) is negative. The slash effect is stored 180° from its telegraph when they agree, so only the slash effect gives the real hit side.
* The Aspect of the Sword's version (81326) uses the same slash effect but no A5962B65 telegraph; not analysed for mismatch. **[open]**
* **All of these slashes are Excision Extremis (damage skill 81053), the ones on Vloxx and the ones further out, and it fires no projectiles.**
  The half-circle on the boss that throws projectiles is a different skill, **Echoing Blade (81271)**, see §5f. Both skills draw the same
  telegraph effect (A5962B65), which is why they look alike.

**Claim: "the slashes don't match the semicircles ~25 % of the time". Confirmed, with a cause.**
* **Position never differs:** all 3,914 telegraphed slashes sit at exactly their telegraph's position (0 with an offset over 20 units).
  The "400–800 units offset" part is **not** in the data. **[REJECTED]**
* **Rotation differs for 28.3 % of Vloxx's slashes** (970 / 3426), by any angle, not just 90° or 180°.
* **Cause: Vloxx turning.** In 836 / 970 mismatched slashes the extra rotation equals how much Vloxx's facing changed
  between the telegraph and the slash. The telegraph is drawn with the facing at that moment; the slash uses the facing 2 s later.
* **Only after the cast ends.** Mismatch rate by pulse: 4.8 s 0 % · 5.3 s 0 % · 5.8 s 1 % · 6.2 s 0 % · 6.3 s 28 % · 6.7 s 46 % · 6.8 s 47 % · 7.2 s 46 % · 7.3 s 47 % · 7.8 s 65 % · 8.4 s 39 %. While Vloxx is still casting (≤ 6.2 s) it can't turn, so the first
  four pulses always match; from 6.3 s on it turns freely (toward its target) and about half the slashes rotate with it.
* **Both the half-circles on Vloxx and the ones further out are affected; it depends on when they land, not where.** Share of slashes / rotated,
  by distance of the slash origin from Vloxx: on Vloxx (< 150) 14 % / 10 % · 150–450 19 % / 27 % · 450–800 54 % / 35 % · 800–1,200 9 % / 27 % · 1,200+ 4 % / 15 %.
  The on-Vloxx half-circles land at 4.8, 5.3, 6.2 and 6.8 s: the first three are during the cast and always match, only the 6.8 s one can be
  rotated (roughly 4 in 10). The outer ones (86 % of slashes, 5.3–8.4 s) mostly land after the cast ends, so they carry most of the mismatches.
* **The damage follows the slash, not the telegraph.** For mismatched slashes: slash frame 99.4 % / 0.7 % (hit side / other side);
  telegraph frame 53.2 % / 55.4 %, i.e. a coin flip.
* **In practice:** the telegraphs of the first four pulses are reliable. For the later ones, only the 525 circle around each telegraph
  origin is reliably dangerous or safe: leave the circle, don't pick a side.

**Claim: "hits strip, with an internal cooldown around 1–2 s". Confirmed and made precise.**
* A hit that lands removes **one stack of a boon** (often more: 2+ boons in ~30 % of strips) and applies **Crippled** (10 s from Vloxx, 5 s from the Sword).
  Strip and Crippled always go together. **Bleeding** is applied on every hit (98 %), with no lockout.
* **The rule is a 1.0 s lockout that every landed hit restarts**, not a timer from the last strip:

  | time since the player's previous Excision hit that landed | hits | Crippled | boons stripped |
  |---|---|---|---|
  | under 1.0 s | 3804 | 0.4 % | 3 % |
  | 1.0–3 s | 833 | 85.5 % | 84.3 % |
  | 3–8 s | 176 | 94.9 % | 94.3 % |
  | 8 s or more | 2192 | 94.6 % | 94.1 % |
  | first hit of the fight | 470 | 94.7 % | |

* Pulses are 0.5 s apart, so a player who stays inside the slashes keeps the lockout running and is stripped **once** (the typical sequence
  in one cast is strip, then 4–6 hits without). Missing one pulse (a 1.0 s gap) makes the next hit strip again.
* **Blocked, evaded and invulnerable hits don't restart the lockout** (a landed hit right after one still strips 91–99 %).
* Measured from the *last strip* instead, the picture is blurry (no strips under 1.0 s, then 20–60 % up to 4 s, ~95 % after 5 s). That is why
  it looks like "a 1–2 s cooldown"; the "all non-strips within 2.04 s of a strip" observation doesn't hold on this data (non-strips occur up to several seconds after a strip, as long as the player keeps getting hit).
* **Double-checked** (`scripts/excision_lockout_check.js`, every single damage event, 7,478 landed hits, 49 logs):
  * *Which clock matters:* hits ≥ 1.0 s after the player's last strip but < 0.95 s after their last hit → Crippled **0 / 1,644**
    (boons stripped 2.4 %). Hits ≥ 0.95 s after their last hit → Crippled 92.8 % of 3,157. Still 0 when the strip was 2–4 s (0 / 308) or 4+ s (0 / 61) earlier.
  * *Chains of back-to-back hits* (every gap < 0.95 s): hit #1 Crippled 92.7 % (3,664); hits #2 to #9+ 0–0.6 %. Longest chain 4.6 s;
    315 hits came ≥ 2 s into a chain and none applied Crippled.
  * *Threshold:* gap 0.9–1.0 s → 0 / 245; 1.0–1.1 s → 85 %; above 1.1 s → 93–100 %.
  * *Shared between casters:* a hit from Vloxx blocks the Sword's strip and the reverse (0 / 96).
  * ***Echoing Blade* shares it too:** when an Echoing Blade hit landed < 0.95 s before, Excision strips only 31 % (131 hits). With a gap
    ≥ 1.05 s and no Echoing Blade hit in the last 0.95 s, Excision strips **97.6 %** (2,748 hits).
  * *Consistency:* holds in 46 of 49 logs (the other 3 have few hits); no player with ≥ 5 hits at ≥ 1.05 s is under 70 %.
  * *Exceptions:* 15 of 3,814 lockout hits still applied Crippled (0.4 %). The last-phase version (80901) is weaker: 10 of 100 lockout hits
    applied Crippled. **[likely]** for the last phase.
* Not the cause (tested): whether the player still has Crippled; which of the four slash directions hit; the damage of the hit.

## 5f. Echoing Blade — the spinning half-circle on Vloxx, with projectiles  [solid]
Skill **81271**, Vloxx only, 205 casts in 49 logs. A different attack from Excision Extremis (§5e), with the same telegraph effect.
Script `scripts/echoing_blade.js` → `data/echoing_blade_summary.json` (part of the full build).
* **Cast 5.4 s.** It often follows Judgment of Eternity (~4.5 s after its cast start) or Excision Extremis (~6.2 s after).
* **8 half-circles, all centred on Vloxx** (slash origin within ~5 units of the boss; 1,591 slashes). Telegraph (GUID A5962B65…) at
  0.2, 0.8, … 4.4 s; the slash (GUID 40EF37BF…) and its damage land **0.8 s** later, at 1.0, 1.6, 2.2, 2.8, 3.4, 4.0, 4.6 and 5.2 s.
* **It spins:** each half-circle is rotated **40°** from the previous one, always the same way, so the 8 pulses sweep 280° around Vloxx
  (160 of 195 full casts). In 35 casts the first step is 90°, then 40° steps.
  The first half-circle usually points 90° to one side of Vloxx's facing (131 of 195).
* **Radius ~625:** on the hit side 93–98 % of players are hit out to 600, 68 % at 600–650, 11 % at 650–700, none beyond 750. On the other side 1–2 %.
* **Telegraphs:** pulses 1–7 always match their telegraph (0 % rotated). The **8th and last pulse (5.2 s) is rotated in 66 %** of casts;
  as with Excision, the damage follows the slash.
* **Projectiles:** one missile is launched with every pulse, from a point ~500 units from Vloxx (p50 499, p90 504), plus a few extra
  between pulses: 8–15 per cast. They fly 200–840 units further out. Hits between pulses (2.0, 2.6, 3.2, 3.8 s) are these projectiles.
  Excision Extremis launches none.
* **Reflecting them:** not verifiable from the logs. A reflected projectile would show as 81271 damage on Vloxx from a player, and there is
  none in 205 casts, which only means nobody reflected one onto the boss in these logs. **[open]**

## 5g. Worldpiercer — the 6-spoke projectile star (Spear phase)  [solid]
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
  * Account-F4C4 (Player-89AD): hit 2 / 278 (0.7 %), knocked 1 (0.4 %). That knock was the one hit that downed and killed them
    (170k damage, 20260930-014701 @ 299.1 s raw); the other hit (20260930-221626) moved him only 67 units.
* The other "Worldpiercer" (skill **81015**) is cast by the **Cosmic Bulwark** (Splits), with no missiles. Its shape has not been re-measured
  (EI: Bulwark arrow 1,850 × 100).

## 5h. Cosmic Charge — the dash toward the fixated player (Spear phase)  [solid]
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
    * **Account-F4C4 (Player-89AD): knocked in 31.1 % of casts (76 / 244)**, average for the squad. Stability saved 63 % of their big hits.
    * Range among regular accounts: 18 % to 46 %.
  * The planner's Cosmic Charge preset (beam tool) draws exactly this from the measured numbers. **[solid]** (shape, timing, stability) / **[likely]** (reach ±50)

## 5i. Breakbars — size, when they open, how they drain  [solid]
Script `scripts/breakbars.js` → `data/breakbars.csv` (one row per bar window) and `data/breakbars_summary.json` (part of the full build).
Units: "breakbar damage" as in the game's skill facts (a 1 s Daze = 100, a 2 s Stun = 200, …). arcdps logs it in tenths.

| unit | bar size | when the bar opens | own drain | time to break (median) | share done by player CC | after the break |
|---|---|---|---|---|---|---|
| Vloxx | **6,000** (5,984–6,199, 175 breaks) | at **70 %, 40 % and 10 %** of its health, 10–15 s into a *Visions of Eternity* cast | 86 / s | 9 s (p90 13.5 s) | 85 % | bar closed until the next threshold (~157 s later) |
| Aspect of the Staff | **1,000** (972–1,196, 206 breaks) | when the Aspect drops to **25 % health** | 46 / s | 5.1 s (p90 13.2 s) | 49 % | 3 Ascension orbs are thrown (§5); the bar does not come back for that Aspect |
| Aspect of the Spear | **1,000** (974–1,134, 170 breaks) | at 25 % health | 46 / s | 5.4 s (p90 12.3 s) | 42 % | same |
| Aspect of the Sword | **1,000** (967–1,161, 46 breaks) | at 25 % health | 46 / s | 5.4 s (p90 12 s) | 41 % | same |
| Cosmic Piercer | **700** (601–814, 136 breaks) | open from the moment it spawns | 44 / s | 7.2 s (p90 11.4 s) | 85 % | closed for **15 s**, then open again; repeats |
| Cosmic Bulwark | **700** (614–839, 50 breaks) | open from spawn | 28 / s | 9.6 s (p90 15.9 s) | 83 % | closed 15 s, then open again |
| Cosmic Sunderer | **700** (588–718, 12 breaks) | open from spawn | 70 / s | 7.2 s (p90 9.9 s) | 78 % | closed 15 s, then open again |

* **How the size was measured.** Every bar window ends with the bar emptied, and the sum *player CC + soft CC + the bar's own drain* is a
  constant per unit (Vloxx 5,984–6,199 over 175 breaks; Aspects 967–1,196 over 422; Cosmic adds ~600–840 over 198). Rounded: **Vloxx 6,000,
  Aspects 1,000, Cosmic adds ~700**.
* **All of these bars stay up until they are broken.** There is no "failed" window in the data: Vloxx's bar window is as long as the squad
  takes (typically 6–14 s, once 31 s).
* **The bars drain on their own while open**, one tick per 0.3 s (the unattributed negative breakbar events in the log): Vloxx 86 / s
  (1.4 % of its bar per second), Aspects 46 / s (4.6 % per second), Piercer 44 / s, Bulwark 28 / s, Sunderer 70 / s.
  * An **Aspect's bar empties by itself in at most ~22 s**; 17 Aspect bars broke with no player CC hit at all. Players supply 41–49 % of an Aspect break.
  * On Vloxx and the Cosmic adds, players supply ~80–85 %: without CC, Vloxx's bar would take ~70 s to drain.
* **Aspect bar = the orb trigger.** The bar opens at 25 % health and its break is what throws the 3 Ascension orbs (§5). In the data every
  Aspect life has exactly one bar window, which is why all 302 logged breaks were "the first" of that Aspect.
* **Vloxx's bar and its health thresholds.** Opens at 68.9–70 % (133 windows), 39–40 % (49) and 9–10 % (12): these look like the thresholds that lead
  into the splits and the last phase, which was not checked separately **[likely]**. *Visions of Eternity* (cast ~19–25 s) is being channelled while the bar is up.
* Soft CC from conditions is logged as small positive unattributed ticks (median 6–10 per tick) and counts toward the bar like player CC.

## 5j. Aspect of the Sword — Division Eternal: shape, who it targets, when the stack is safe  [solid / likely]
Script `scripts/sword_sweetspot.js` → `data/sword_casts.csv`, `data/sword_division_summary.json` (part of the full build). 350 casts in 49 logs.

**The attack (skill 81330).** The Sword picks a direction at the start of the cast and keeps it.
* **~0.4 s: a hit around the Sword**, radius ~500–550 (80 % of players within 400 are hit, 48 % at 500–600, 14 % at 600–700).
* **0.8 → 1.8 s: six half-circle slashes march outward along that direction**, one every 0.2 s, at 75, 325, 575, 825, 1,075 and 1,325 units
  from the Sword. They use the same slash effect as Excision Extremis (GUID B4868841…, radius ~525).
* **Danger zone of the line:** ≥ 95 % hit within 400 of the line, ~20–45 % at 500–600, none at 600+ to the side. Ahead: ~97 % out to 1,600,
  23 % at 1,800–2,000. Behind the Sword: ~25 % within 200, ~5 % at 200–400. So: **~1,050 wide, from ~200 behind the Sword to ~1,800 ahead**.
  **[solid]**

**Who it is aimed at.** The line points at one specific player (someone is within 3° of it in 88 % of casts). That player is:
* **the farthest player from the Sword: 56 %** (one of the two farthest: 68 %);
* the fixated player: 17 %; the closest player: 2 %; the farthest from Vloxx: 30 %; pure chance would be 11 %.

So **Fixated does not steer the Sword**: Fixated is Vloxx's mechanic. The Sword favours the player farthest from itself, but only a
bit over half the time; the rest is not explained (not timing, not a range cap, not downed players). **[likely]**
* The Sword's melee (*Ancora Strike*) hits the **closest** player 75 % of the time, and the fixated player only when they are close.
  The Staff and Spear Aspects behave the same (86 % / 81 %). The Aspects walk around: the Sword is 185–1,158 from Vloxx (median 506).

**When the squad stacked on Vloxx (within 400) is hit by the line** (casts with ≥ 4 players stacked):
| where Vloxx is, relative to the Sword's line | result |
|---|---|
| ahead of the Sword, < 300 beside the line | 152 casts, 87 % of the stacked players hit, 6 casts with nobody hit |
| ahead, 300–600 beside the line | 28 casts, 70 % of the stacked players hit, 0 casts with nobody hit |
| ahead, 600+ beside the line | 4 casts, 36 % of the stacked players hit, 1 casts with nobody hit |
| behind the Sword by 0–300 (the line points away) | 28 casts, 53 % of the stacked players hit, 7 casts with nobody hit |
| behind the Sword by 300+ | 4 casts, 5 % of the stacked players hit, 3 casts with nobody hit |

**The "sweet spot".** There is no distance for the *fixated* player that protects the squad: with the fixated player 1,000 from the Sword
but on the same side as Vloxx, the line went through the stack and hit 9 of 9 (20261003-165843, ~518 s). What protects the stack is the
**direction** of the line:
* the player the Sword targets must be **on the far side of the Sword from Vloxx** (the line then points away from the stack), and
* the Sword must be **at least ~300–400 from the stack** along that line (closer, the first slash and the 0.4 s hit still reach it; to
  also avoid the 0.4 s hit the Sword must be ~600 away).
* To be the target that player has to be the **farthest from the Sword**: farther than the Sword–stack distance plus the stack's spread,
  i.e. roughly **1,000+ from the Sword** when the Sword is ~500–600 from Vloxx. Even then it is aimed at them only a bit over half the time.
* Alternative: the stack ≥ 600 to the side of the line, or beyond ~1,900 from the Sword (Sword kited far away: 3 casts at 2,000–2,500, nobody hit).
Sample for the safe cases is small (4 casts with Vloxx 300+ behind the Sword). **[likely]**

## 5k. Excision Extremis — is there a safe spot in melee, depending on where the fixated player stands?  [solid / likely]
Script `scripts/excision_safespot.js` → `data/excision_melee.csv` (one row per non-fixated player per cast) and
`data/excision_safespot_summary.json` (part of the full build). 345 casts in 72 logs, 271 with a fixated player.
"Melee" = stayed within **300 of the edge of Vloxx's hitbox** (hitbox radius 150, so within 450 of its centre) for all eight pulses.
A blocked or evaded hit counts as a hit. Distances Vloxx ↔ fixated are centre to centre.

**Short answer: no distance within normal play gives a reliable safe spot in melee.** The side of Vloxx **away from the fixated player**
gets safer the further the fixated player stands, slowly: at 500–1,000 it is still covered in most casts. Only with the fixated player
**~1,000+ from Vloxx** does the back of Vloxx stay mostly clean.

**How the 16 slashes are laid out.**
* **4 slashes on Vloxx** (20 % of slashes; origin ~110 from its centre, at 4.8, 5.3, 6.2 and 6.8 s). They face **forward**: the half-circle
  covers the side Vloxx is looking at, i.e. toward the fixated player, out to ~525 + the offset. Directly behind Vloxx they don't reach.
* **12 slashes further out**, origins 425–951 from Vloxx (median 564), in three groups: from the left, from the right and from beyond.
  In casts where the fixated player stands still they sit roughly 400 around that player and face back toward them; no exact placement
  rule was found. **42 % of these origins are within 525 of Vloxx's centre**, so they sweep over the melee area from the sides, including behind Vloxx. **[likely]**
* All half-circles are aligned on Vloxx's facing (0° off), which is the direction of the fixated player at that moment.
* The fixated player moved a median of 241 units during the pulses (p90 622).

**What happened to players in melee of Vloxx**, by distance between Vloxx and the fixated player (mean over the pulses).
Cells: % of players hit at least once (players, mean number of hits).
| Vloxx ↔ fixated | all melee players | on the fixated player's side | on the far side of Vloxx | casts with ≥ 3 in melee / nobody hit |
|---|---|---|---|---|
| 0–200 | 86 % (694, 4.1 hits) | 97 % (240, 5.6 hits) | 72 % (230, 2.2 hits) | 88 / 6 |
| 200–300 | 94 % (423, 3.9 hits) | 98 % (184, 5 hits) | 87 % (141, 2.4 hits) | 55 / 0 |
| 300–400 | 91 % (293, 5 hits) | 100 % (128, 7.3 hits) | 70 % (84, 1.8 hits) | 39 / 0 |
| 400–500 | 86 % (98, 3.7 hits) | 96 % (28, 5.2 hits) | 71 % (41, 2 hits) | 15 / 1 |
| 500–700 | 65 % (77, 2.5 hits) | 81 % (21, 4.4 hits) | 45 % (38, 1.1 hits) | 13 / 0 |
| 700+ | 81 % (64, 2.6 hits) | 75 % (4, 2.5 hits) | 74 % (39, 1.2 hits) | 9 / 1 |

**From the slash effects alone** (no player needed, so every cast counts): the part of Vloxx's melee area (hitbox edge to 300 beyond it)
that none of the cast's slashes covers. "Back sector" = the 120° directly opposite the fixated player. A "standing spot" = a point with
a free radius of 75 around it inside the melee area. The slash effect is used, not the telegraph: the telegraph has the same position, but
its orientation is wrong for about half of the late slashes (§5e).
| Vloxx ↔ fixated | casts | melee area never covered | back sector never covered | casts with the back sector fully clean | casts with a standing spot (behind Vloxx) | where the spot is, degrees off "directly behind" (p25 / median / p75) |
|---|---|---|---|---|---|---|
| 0–200 | 88 | 6 % | 8 % | 0 | 22 (11) | 40 / 80 / 140 |
| 200–300 | 66 | 10 % | 14 % | 0 | 17 (14) | 30 / 50 / 90 |
| 300–400 | 46 | 11 % | 22 % | 2 | 22 (20) | 20 / 40 / 70 |
| 400–500 | 23 | 18 % | 24 % | 2 | 10 (8) | 30 / 70 / 120 |
| 500–600 | 12 | 23 % | 37 % | 1 | 8 (7) | 20 / 50 / 80 |
| 600–700 | 7 | 32 % | 47 % | 2 | 5 (5) | 30 / 60 / 80 |
| 700–850 | 5 | 30 % | 42 % | 1 | 3 (3) | 20 / 50 / 80 |
| 850–1000 | 7 | 17 % | 31 % | 0 | 4 (4) | 20 / 40 / 60 |
| 1000+ | 10 | 59 % | 73 % | 5 | 8 (8) | 40 / 80 / 130 |

* **The safe area grows slowly up to ~1,000 and then jumps.** Below 1,000 the back sector is on average about half clean at best and was fully
  clean in 8 of 254 casts. **At 1,000+ it is 73 % clean, fully clean in 5 of 10 casts.** [likely: 10 casts]
* **From ~300 on there usually is a small safe pocket behind Vloxx** (a standing spot in 43–71 % of casts), but it is not in the same
  place from cast to cast: anywhere from directly behind to ~80° off. It cannot be pre-positioned on.
* **A fixated player who stands still does not help.** Back sector clean, fixated player moved < 200 vs ≥ 200 during the pulses:
  Vloxx ↔ fixated under 500: 9 % (109 casts) vs 19 % (114); 500–1,000: 30 % (10) vs 43 % (21).

**By distance from the fixated player** (any position): 0–250: 94 % hit, 5.4 hits · 250–450: 89 % hit, 3.9 hits · 450–650: 84 % hit, 2.9 hits · 650–1000: 75 % hit, 2.6 hits · 1000+: 66 % hit, 1.9 hits.
Without a fixated player the attack still happens around Vloxx's current target: 93 % of 419 melee players hit.

**What to take from it.**
* **Fixated player within ~300 of Vloxx's centre (the usual case; median 259): everybody in melee is hit**, wherever they stand
  (87–98 %). There is no gap to stand in. Standing behind Vloxx only lowers the **number** of hits (about 2–3 instead of 5).
* **Fixated player 300–500 away, stack behind Vloxx** (opposite the fixated player): 70 % hit at 300–400, 71 % at 400–500, 1–2 hits.
* **Fixated player 500–700 away, stack behind Vloxx:** 45 % hit (38 players), 1.1 hits on average. 
* **700–1,000:** still not safe. Players behind Vloxx were hit 74 % of the time at 700+ (39 players), and the slash geometry leaves the back sector only 31–42 % clean.
* **1,000+:** the first range where the back is mostly clean (table above). Small sample. **[likely]**
* The side between Vloxx and the fixated player is hit at every distance (75–100 %).
* One slash is enough to strip a boon and apply Crippled (§5e), so "fewer hits" does not save the strip; it only lowers the damage.

## 5l. Usual order of Vloxx's attacks in each phase  [solid for the first cycle, likely later]
Script `scripts/cast_order.js` → `data/cast_order.csv` (one row per phase × position) and `data/cast_order_summary.json` (part of the
full build). 237 logs. Phases are cut on Vloxx's *Visions of Eternity* casts (70 %, 40 %, 10 % health). Times: P1 from the start of
the fight, P2 and P3 from the moment the breakbar of *Visions of Eternity* is broken.

**How it works.** Each phase has a fixed **main rotation**, and on top of it a few attacks that run on **their own timers** (the greens
*Judgment of Eternity*, *Probability Distribution*, in P1 also *Eternal Reflection*). The timer attacks slot in between the rotation
attacks. The first cycle is the same in almost every log (start times within about a second); after ~100 s in P2 and ~50 s in P3 the
logs start to differ, both in where the timer attacks land and in the rotation itself (in P2 the first 12 rotation attacks are identical in 63 of the 109 logs that got that far). The cause of those differences was not looked into. **[open]**

**Fixated swaps (last column).** Fixated lasts 60 s and the next one comes ~7.7 s after it ends (§2), so a swap happens every ~68 s
counted from the previous application, not from the start of the phase.
* **P1 is fixed:** first Fixated at 3 s, second at 70.7 s (94 % of logs within 2 s), third at ~132 s if the phase lasts that long.
* **P2 and P3 are not fixed:** 94 % / 94 % of these phases start with a Fixated already running (applied during the split or the breakbar), so the
  first swap of the phase comes ~68 s after *that* application. The column shows the most common times with how many logs had them;
  a time shared by fewer than 15 % of the logs is left out. A Fixated that ends early (holder downed, stealth) moves everything after it.

### P1 (Staff, 100 → 70 %)
Reached in 237 logs, finished in 192; a full phase lasts about 126 s (23 casts). Times are from the start of the fight.
* **Main rotation** (same start in 173 of 175 logs that got that far): Surrounding Curse → Annihilating Orb → Ascension's Sacrifice → Annihilating Orb → Surrounding Curse → Annihilating Orb → Ascension's Sacrifice → Annihilating Orb → Surrounding Curse.
* **On their own timers:** *Judgment of Eternity* first at 4.4 s, then about every 47 s (44–65); *Probability Distribution* first at 20 s, then about every 45 s (32–55); *Eternal Reflection* first at 22.1 s, then about every 10 s (9–26).

| # | starts at | attack | cast time | logs that agree | otherwise | new Fixated during this attack |
|---|---|---|---|---|---|---|
| 1 | 4.4 s | Judgment of Eternity | 4.4 s | 100 % of 237 |  | Fixated #1 at ~3 s (235 of 237 logs) |
| 2 | 8.9 s | Surrounding Curse | 4 s | 100 % of 237 |  |  |
| 3 | 13 s | Annihilating Orb | 6.9 s | 100 % of 237 |  |  |
| 4 | 20 s | Probability Distribution | 2 s | 100 % of 235 |  |  |
| 5 | 22.1 s | Eternal Reflection | 3.8 s | 100 % of 233 |  |  |
| 6 | 31.2 s | Eternal Reflection | 3.8 s | 100 % of 232 |  |  |
| 7 | 37.3 s | Ascension's Sacrifice | 6 s | 100 % of 230 |  |  |
| 8 | 43.4 s | Annihilating Orb | 6.9 s | 100 % of 229 |  |  |
| 9 | 51.8 s | Judgment of Eternity | 4.4 s | 100 % of 226 |  |  |
| 10 | 56.3 s | Eternal Reflection | 3.8 s | 100 % of 225 |  |  |
| 11 | 60.2 s | Surrounding Curse | 4 s | 100 % of 223 |  |  |
| 12 | 64.2 s | Probability Distribution | 2 s | 100 % of 222 |  |  |
| 13 | 66.3 s | Eternal Reflection | 3.8 s | 100 % of 220 |  | Fixated #2 at ~70.7 s (199 of 213 logs) |
| 14 | 73.8 s | Annihilating Orb | 6.9 s | 100 % of 208 |  |  |
| 15 | 80.8 s | Eternal Reflection | 3.8 s | 100 % of 207 |  |  |
| 16 | 84.6 s | Ascension's Sacrifice | 6 s | 100 % of 206 |  |  |
| 17 | 91 s | Eternal Reflection | 3.8 s | 100 % of 206 |  |  |
| 18 | 96.6 s | Judgment of Eternity | 4.4 s | 97 % of 206 | Probability Distribution x7 |  |
| 19 | 101.2 s | Eternal Reflection | 3.8 s | 100 % of 202 |  |  |
| 20 | 105.1 s | Annihilating Orb | 6.9 s | 99 % of 201 | Probability Distribution x1 / Surrounding Curse x1 |  |
| 21 | 112.3 s | Surrounding Curse | 4 s | 98 % of 175 | Judgment of Eternity x2 / Probability Distribution x1 |  |
| 22 | 117.6 s | Probability Distribution | 2 s | 96 % of 148 | Annihilating Orb x2 / Surrounding Curse x2 |  |
| 23 | 119.6 s | Eternal Reflection | 3.8 s | 100 % of 128 |  |  |
| 24 | 128.8 s | Eternal Reflection | 3.8 s | 100 % of 65 |  |  |

### P2 (Spear, 70 → 40 %)
Reached in 191 logs, finished in 78; a full phase lasts about 129 s (19 casts). The first cast starts the moment the breakbar is broken.
* **Main rotation** (same start in 63 of 109 logs that got that far): Cosmic Charge → Worldpiercer → Raging Storm → Thousand Strikes → Thousand Strikes → Worldpiercer → Cosmic Charge → Raging Storm → Thousand Strikes → Worldpiercer → Thousand Strikes → Cosmic Charge.
* **On their own timers:** *Judgment of Eternity* first at 0 s, then about every 55 s (44–61); *Probability Distribution* first at 33.5 s, then about every 49 s (45–55).

| # | starts at | attack | cast time | logs that agree | otherwise | new Fixated during this attack |
|---|---|---|---|---|---|---|
| 1 | 0 s | Judgment of Eternity | 4.4 s | 96 % of 191 | Cosmic Charge x8 |  |
| 2 | 4.5 s | Cosmic Charge | 7.8 s | 96 % of 191 | Judgment of Eternity x7 / Worldpiercer x1 |  |
| 3 | 12.4 s | Worldpiercer | 6 s | 99 % of 191 | Judgment of Eternity x1 |  |
| 4 | 18.5 s | Raging Storm | 7.4 s | 99 % of 182 | Thousand Strikes x1 |  |
| 5 | 27.4 s | Thousand Strikes | 6 s | 99 % of 170 | Raging Storm x1 |  |
| 6 | 33.5 s | Probability Distribution | 2 s | 99 % of 168 | Thousand Strikes x1 |  |
| 7 | 38.9 s | Thousand Strikes | 6 s | 99 % of 165 | Probability Distribution x1 |  |
| 8 | 48.7 s | Worldpiercer | 6 s | 95 % of 157 | Cosmic Charge x8 | Fixated #1 at ~48 s (31 of 163 logs) |
| 9 | 54.8 s | Judgment of Eternity | 4.4 s | 99 % of 154 | Cosmic Charge x1 |  |
| 10 | 59.6 s | Cosmic Charge | 7.8 s | 94 % of 148 | Worldpiercer x8 / Judgment of Eternity x1 | Fixated #1 at ~60 s (26 of 163 logs) |
| 11 | 68.6 s | Raging Storm | 7.4 s | 99 % of 144 | Thousand Strikes x1 | Fixated #1 at ~68 s (37 of 163 logs) |
| 12 | 76.1 s | Thousand Strikes | 6 s | 99 % of 133 | Raging Storm x1 |  |
| 13 | 82.4 s | Probability Distribution | 2 s | 99 % of 128 | Thousand Strikes x1 |  |
| 14 | 85.3 s | Worldpiercer | 6 s | 94 % of 126 | Thousand Strikes x7 |  |
| 15 | 92.6 s | Thousand Strikes | 6 s | 94 % of 118 | Cosmic Charge x6 / Probability Distribution x1 | Fixated #2 at ~92 s (24 of 99 logs) |
| 16 | 100.1 s | Judgment of Eternity | 4.4 s | 83 % of 112 | Raging Storm x13 / Worldpiercer x5 |  |
| 17 | 106.3 s | Cosmic Charge | 7.8 s | 71 % of 109 | Thousand Strikes x26 / Judgment of Eternity x5 |  |

After ~100 s the order starts to differ between logs (the later rows above are less certain).

### P3 (Sword, 40 → 10 %)
Reached in 77 logs, finished in 26; a full phase lasts about 155 s (29 casts). The first cast starts the moment the breakbar is broken.
* **Main rotation** (same start in 35 of 47 logs that got that far): Echoing Blade → Slice Through Reality → Excision Extremis → Division Eternal → Echoing Blade → Excision Extremis → Division Eternal → Excision Extremis → Echoing Blade → Division Eternal → Excision Extremis → Division Eternal.
* **On their own timers:** *Judgment of Eternity* first at 0 s, then about every 47 s (44–56); *Probability Distribution* first at 23.2 s, then about every 42 s (34–63).

| # | starts at | attack | cast time | logs that agree | otherwise | new Fixated during this attack |
|---|---|---|---|---|---|---|
| 1 | 0 s | Judgment of Eternity | 4.4 s | 95 % of 77 | Echoing Blade x4 |  |
| 2 | 4.5 s | Echoing Blade | 5.4 s | 95 % of 77 | Judgment of Eternity x3 / Slice Through Reality x1 |  |
| 3 | 9.9 s | Slice Through Reality | 5.4 s | 95 % of 77 | Excision Extremis x4 |  |
| 4 | 15.4 s | Excision Extremis | 6.2 s | 95 % of 77 | Slice Through Reality x3 / Judgment of Eternity x1 | Fixated #1 at ~20 s (26 of 66 logs) |
| 5 | 23.2 s | Probability Distribution | 2 s | 95 % of 74 | Division Eternal x4 |  |
| 6 | 25.2 s | Division Eternal | 3.7 s | 95 % of 74 | Echoing Blade x4 |  |
| 7 | 30.2 s | Echoing Blade | 5.4 s | 94 % of 70 | Excision Extremis x4 |  |
| 8 | 35.6 s | Excision Extremis | 6.2 s | 94 % of 70 | Probability Distribution x4 |  |
| 9 | 43.3 s | Division Eternal | 3.7 s | 100 % of 67 |  |  |
| 10 | 47.1 s | Judgment of Eternity | 4.4 s | 95 % of 61 | Excision Extremis x3 |  |
| 11 | 52.3 s | Excision Extremis | 6.2 s | 74 % of 57 | Division Eternal x12 / Echoing Blade x3 |  |
| 12 | 58.6 s | Echoing Blade | 5.4 s | 74 % of 54 | Excision Extremis x11 / Judgment of Eternity x3 | Fixated #1 at ~64 s (19 of 66 logs) |
| 13 | 65.4 s | Probability Distribution | 2 s | 74 % of 53 | Echoing Blade x11 / Excision Extremis x3 |  |
| 14 | 67.5 s | Division Eternal | 3.7 s | 75 % of 51 | Probability Distribution x13 |  |
| 15 | 71.2 s | Excision Extremis | 6.2 s | 74 % of 50 | Division Eternal x13 |  |
| 16 | 77.6 s | Division Eternal | 3.7 s | 74 % of 47 | Excision Extremis x10 / Echoing Blade x2 |  |
| 17 | 82.8 s | Slice Through Reality | 5.4 s | 74 % of 47 | Division Eternal x9 / Excision Extremis x2 | Fixated #2 at ~88 s (10 of 49 logs) |
| 18 | 89.6 s | Echoing Blade | 5.4 s | 66 % of 47 | Slice Through Reality x12 / Excision Extremis x4 |  |
| 19 | 95.3 s | Judgment of Eternity | 4.4 s | 74 % of 46 | Echoing Blade x9 / Division Eternal x2 |  |
| 20 | 99.6 s | Excision Extremis | 6.2 s | 70 % of 46 | Judgment of Eternity x10 / Echoing Blade x4 |  |
| 21 | 106 s | Probability Distribution | 2 s | 72 % of 46 | Excision Extremis x10 / Judgment of Eternity x2 |  |
| 22 | 108.1 s | Division Eternal | 3.7 s | 65 % of 46 | Probability Distribution x10 / Excision Extremis x3 | Fixated #3 at ~112 s (5 of 26 logs) |
| 23 | 115.3 s | Echoing Blade | 5.4 s | 64 % of 45 | Division Eternal x13 / Excision Extremis x3 | Fixated #3 at ~116 s (5 of 26 logs) |
| 24 | 120.7 s | Excision Extremis | 6.2 s | 76 % of 42 | Echoing Blade x8 / Probability Distribution x2 |  |
| 25 | 127 s | Division Eternal | 3.7 s | 73 % of 41 | Excision Extremis x8 / Echoing Blade x3 | Fixated #2 at ~132 s (9 of 49 logs); Fixated #3 at ~132 s (7 of 26 logs) |
| 26 | 135.8 s | Division Eternal | 3.7 s | 94 % of 35 | Excision Extremis x2 |  |
| 27 | 140 s | Judgment of Eternity | 4.4 s | 64 % of 33 | Division Eternal x8 / Excision Extremis x2 |  |
| 29 | 149.6 s | Slice Through Reality | 5.4 s | 64 % of 22 | Echoing Blade x7 / Division Eternal x1 |  |

In a few logs the phase starts with *Echoing Blade* before the greens. From the third greens round (~95 s) on, the order differs more.

### Last phase (10 → 0 %)
Reached in 26 logs. Vloxx casts a single 65 s channel (skill 81071); its attacks are not logged as casts, so this list comes from the
damage they deal (seconds after the channel starts, median and range over the logs). All three Aspects are up as well and keep their own attacks.
| at | attack of Vloxx | range | logs |
|---|---|---|---|
| 16.2 s | Surrounding Curse (80484), burst 1 | 15–36.1 s | 26 |
| 20 s | Excision Extremis (80901), burst 1 | 20–21.6 s | 26 |
| 20.5 s | Raging Storm (81176), burst 1 | 17.5–41.5 s | 26 |
| 30 s | Raging Storm (81176), burst 2 | 20.5–68.5 s | 25 |
| 35 s | Excision Extremis (80901), burst 2 | 35–36.6 s | 26 |
| 35.5 s | Raging Storm (81176), burst 3 | 26.5–89.8 s | 23 |
| 35.9 s | Surrounding Curse (80484), burst 2 | 20–86.4 s | 25 |
| 41 s | Judgment of Eternity (80378), burst 1 | 11–71.1 s | 18 |
| 44.7 s | Surrounding Curse (80484), burst 3 | 35.9–76.2 s | 22 |
| 46.2 s | Surrounding Curse (80484), burst 4 | 39.4–86.3 s | 14 |
| 47.5 s | Raging Storm (81176), burst 4 | 29.5–83.5 s | 20 |
| 50 s | Excision Extremis (80901), burst 3 | 50–51.5 s | 21 |
| 54.4 s | Probability Distribution (81318), burst 1 | 31–71 s | 19 |
| 56.5 s | Raging Storm (81176), burst 5 | 35.5–74.5 s | 16 |
| 65 s | Excision Extremis (80901), burst 4 | 65–66.6 s | 16 |

* **Excision Extremis is on a strict 15 s timer here: 20, 35, 50, 65 s.** The other times depend on players being hit, so they are looser.
* The greens of the last phase and their timing are in §1 and §3.

## 5m. Slice Through Reality — a 525 hit, then a portal (entrance and exit ~300)  [solid]
Script `scripts/slice_through_reality.js` → `data/slice_through_reality_summary.json` (part of the full build). 139 casts in 77 logs. Cast 5.4 s.
Vloxx's logged position only updates ~4.2 s into the cast, so everything here is measured from the ground effects of the skill.

**Sequence.**
1. **1.24 s: a hit around Vloxx, circle of radius ~525** (0–500: 100 % (535) hit · 500–550: 32 % (19) · 550+: 0 % (90)).
2. **2.2 s: a portal opens where Vloxx stands** (effect GUID D33CD046…, lasts 9 s). **2.6 s: Vloxx teleports 2,000 units away**
   (996–2,009), and at 3.6 s the same portal effect appears on the arrival point.
3. **From 2.6 s on, the entrance portal hits whoever is inside it and teleports them to the exit.** 95 % of the 883 hits
   were followed by the player standing at the exit about a second later.

**Size of the portal: ~300 radius, the same at both ends.**
* **Entrance:** players were 226 from its centre when hit (median), 90 % within 282. Hit rate by distance from the centre:
  0–300: 99 % (586) · 300–400: 55 % (53) · 400–550: 21 % (62) · 550+: 0 % (116). Beside the teleport line it stops at ~300
  (200–300: 94 % (66), 300–400: 11 % (9)).
* **Exit:** players land 171 from its centre (median), 90 % within 291: the same spread as at the entrance, so a player keeps
  their offset from the centre and the exit area is the same size.
* **It stays open.** 104 of the hits came 4–10 s into the cast (players walking into the entrance later), all 81–272 from its centre, and they were teleported too.
* **Standing at the exit is safe**: 0 of 447 players who were already there were hit in the first 1.6 s. Whether the exit sends players back was not
  measurable (only 2 players walked onto it). **[open]**

So the big circle (525) is only the first hit. What stays on the ground afterwards, at both ends, is the ~300 portal.
The distance between entrance and exit is fixed (2,000 ± 50 in 129 of 139 casts; shorter in the others, down to ~1000), so the planner has a single "Slice Through Reality" attack: click on Vloxx, drag toward
the teleport direction, and it places the 525 hit, the entrance and the exit.

## 5n. Vloxx's Damage Immunity (70 / 40 / 10 %) — what still damages it  [solid]
Script `scripts/damage_immunity.js` → `data/damage_immunity.csv`, `data/damage_immunity_summary.json` (part of the full build). 297 immunity windows in 193 logs.

**When.** Vloxx gets the buff **Damage Immunity (80608)** at each health threshold, for the whole *Visions of Eternity* breakbar, not only at 10 %:
| threshold | windows | lasts (median, range) | windows where some damage went through | damage through (median / max) | health lost (median / max) |
|---|---|---|---|---|---|
| 70 % | 193 | 24.8 s (1–51.7) | 132 | 612 / 73,430 | 0.01 % / 0.12 % |
| 40 % | 78 | 29.8 s (6.1–66.2) | 51 | 1,180 / 86,321 | 0.01 % / 0.11 % |
| 10 % | 26 | 41.4 s (31–53) | 26 | 11,718 / 113,545 | 0.02 % / 0.14 % |

At 10 % the immunity continues for 15 s into the last phase (a second, 15 s application when the channel starts).

**What is blocked.**
* **Direct hits: all of them** (66,094 hits of 137 skills did 0). 23 hits in total did damage (Symbol of Luminance, Piercing Stance, Oppressive Collapse, Mind the Gap, …); they are isolated events
  (the same skills did 0 on every other hit), not a skill that works; why those few got through was not looked into.
* **The five damaging conditions tick for 0**: Bleeding (47,934 ticks), Torment (42,590 ticks), Burning (41,479 ticks), Poisoned (27,216 ticks), Confusion (12,207 ticks). They stay on Vloxx and keep ticking, each tick does 0.

**What goes through: damage from effects that are not one of those five conditions.** Every tick did its normal damage:
| effect | skill id | windows seen | ticks | ticks with damage | total | per tick |
|---|---|---|---|---|---|---|
| Painful Bond | 77128 | 17 | 326 | 100 % | 564,123 | 1,736 |
| Binding Blade | 9148 | 112 | 538 | 99 % | 563,197 | 1,061 |
| Nightmare Weapon | 76923 | 9 | 67 | 100 % | 98,438 | 1,469 |
| Soul Shards | 72975 | 7 | 36 | 100 % | 88,838 | 2,468 |
| Nightmare Weapon | 79077 | 11 | 36 | 100 % | 55,577 | 1,544 |
| Nourishment | 57409 | 15 | 48 | 100 % | 15,600 | 325 |
| Vampiric Strikes | 13814 | 3 | 80 | 100 % | 2,720 | 34 |
| Nourishment | 57244 | 1 | 1 | 100 % | 325 | 325 |
| Nourishment | 57356 | 1 | 1 | 100 % | 325 | 325 |

* **Confirmed from the list that was circulating:** *Binding Blade* (Guardian greatsword 5) and *Painful Bond*. Not in these logs, so neither confirmed
  nor denied: Fulgor, Fear with Terror, Relic of Agony. **[open]**
* **Also going through, not on that list:** *Nightmare Weapon*, *Soul Shards*, and life steal (*Vampiric Strikes*, food).
* The rule fits what the logs show: the immunity zeroes direct hits and the five damaging conditions, and nothing else.
* **It is too small to matter.** The best window let 113,545 damage through; Vloxx lost at most 0.14 % of its health during an immunity window
  (median 0.01–0.02 %). It does not shorten the fight in any useful way.

## 5o. DPS per specialisation and build on kills — target and cleave, average and highest  [solid for builds with many samples]
Script `scripts/dps_table.js` → `data/dps_samples.csv` (one row per player per kill, no names) and `data/dps_table.json` (part of the full build).
**Kills only:** 26 CM kills (22 Elite Insights logs from dps.report / GW2 Wingman, 4 raw logs), 260 samples (one player in one kill).
Kill times 511–596 s (average 562 s).

* **Target** = damage on Vloxx ÷ length of the fight. **Cleave** = damage on every enemy (Vloxx, Aspects, Cosmic adds) ÷ length of the fight.
  The whole fight counts as time, including the splits and the Damage Immunity windows (§5n), so these numbers are lower than a
  benchmark and lower than a phase DPS.
* **Build:** "Condition" when at least half of the player's damage was condition damage, otherwise "Power"; "Heal" / "Boon" from the healing
  and concentration stats the log records.
* **The highest values are links** to the log they come from, when the log is online; otherwise the name of the log is written (25 of 26 kills).
* **Whole squad:** target 151,610 on average (best [166,757](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill)), cleave 255,659 (best [283,177](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill)).

| build | samples | target avg | target highest | cleave avg | cleave highest | condition share |
|---|---|---|---|---|---|---|
| Condition Weaver | 10 | 22,650 | [24,414](https://gw2wingman.nevermindcreations.de/log/081e5-Seel6214_20261001-210656_noe_kill) | 35,875 | [38,331](https://gw2wingman.nevermindcreations.de/log/81daf-20261002-154733_noe_kill) | 93 % |
| Condition Scourge | 129 | 19,500 | [23,366](https://gw2wingman.nevermindcreations.de/log/e961b-20261003-211028_noe_kill) | 33,915 | [40,629](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 94 % |
| Condition Evoker | 26 | 18,113 | [21,233](https://gw2wingman.nevermindcreations.de/log/f9dda-20261002-215908_noe_kill) | 29,772 | [36,391](https://gw2wingman.nevermindcreations.de/log/e961b-20261003-211028_noe_kill) | 92 % |
| Power Luminary | 10 | 14,266 | [17,366](https://gw2wingman.nevermindcreations.de/log/85c0f-20261002-215404_noe_kill) | 26,043 | [29,531](https://gw2wingman.nevermindcreations.de/log/f9dda-20261002-215908_noe_kill) | 1 % |
| Boon Condition Specter | 20 | 11,610 | [15,022](https://gw2wingman.nevermindcreations.de/log/47d67-20261004-012811_noe_kill) | 16,036 | [19,425](https://gw2wingman.nevermindcreations.de/log/47d67-20261004-012811_noe_kill) | 89 % |
| Boon Condition Troubadour | 9 | 7,053 | [8,256](https://gw2wingman.nevermindcreations.de/log/081e5-Seel6214_20261001-210656_noe_kill) | 10,763 | [11,862](https://dps.report/MsKX-20260930-014037-fixed_boss) | 72 % |
| Heal Troubadour | 42 | 1,037 | [6,382](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 1,842 | [9,176](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 11 % |

**Fewer than 5 samples (not reliable):**
| build | samples | target avg | target highest | cleave avg | cleave highest | condition share |
|---|---|---|---|---|---|---|
| Condition Harbinger | 4 | 22,838 | [24,067](https://gw2wingman.nevermindcreations.de/log/704cb-20261003-193028_noe_kill) | 34,244 | [37,051](https://gw2wingman.nevermindcreations.de/log/704cb-20261003-193028_noe_kill) | 88 % |
| Condition Chronomancer | 1 | 22,121 | [22,121](https://b.dps.report/rKIr-20261002-010435_boss) | 34,764 | [34,764](https://b.dps.report/rKIr-20261002-010435_boss) | 86 % |
| Boon Condition Evoker | 2 | 18,903 | [19,072](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 30,849 | [31,101](https://gw2wingman.nevermindcreations.de/log/f9dda-20261002-215908_noe_kill) | 94 % |
| Condition Conduit | 1 | 18,146 | [18,146](https://gw2wingman.nevermindcreations.de/log/f9dda-20261002-215908_noe_kill) | 28,880 | [28,880](https://gw2wingman.nevermindcreations.de/log/f9dda-20261002-215908_noe_kill) | 89 % |
| Condition Virtuoso | 1 | 16,989 | [16,989](https://gw2wingman.nevermindcreations.de/log/90921-Sejter9746_20261003-222354_noe_kill) | 27,270 | [27,270](https://gw2wingman.nevermindcreations.de/log/90921-Sejter9746_20261003-222354_noe_kill) | 74 % |
| Condition Willbender | 1 | 16,129 | [16,129](https://gw2wingman.nevermindcreations.de/log/dc6a8-Seel6214_20261002-011054_noe_kill) | 24,748 | [24,748](https://gw2wingman.nevermindcreations.de/log/dc6a8-Seel6214_20261002-011054_noe_kill) | 92 % |
| Boon Condition Scourge | 1 | 15,389 | [15,389](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 22,990 | [22,990](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 90 % |
| Boon Condition Firebrand | 1 | 14,551 | [14,551](https://dps.report/oPU0-20260930-224233_boss) | 25,180 | [25,180](https://dps.report/oPU0-20260930-224233_boss) | 94 % |
| Power Vindicator | 1 | 14,210 | [14,210](https://gw2wingman.nevermindcreations.de/log/704cb-20261003-193028_noe_kill) | 20,856 | [20,856](https://gw2wingman.nevermindcreations.de/log/704cb-20261003-193028_noe_kill) | 1 % |
| Heal Paragon | 1 | 345 | [345](https://dps.report/oPU0-20260930-224233_boss) | 592 | [592](https://dps.report/oPU0-20260930-224233_boss) | 2 % |

Kills come from several squads, but the mix of builds is still narrow (Condition Scourge is 50 % of all samples).

## 5p. Annihilating Orb (Vloxx, P1) — path, landing zone and expanding ring  [solid]
Script `scripts/annihilating_orb.js` → `data/annihilating_orb_summary.json` (part of the full build). 869 casts in 237 logs. Cast 6.9 s.

1. **The orb is thrown straight along Vloxx's facing** (100 % of casts within 10°, median 0°). It does not track a player by itself: the
   landing point is within 10° of the fixated player in 37 % of casts (median 13° off), of the farthest player in 19 %, of the closest in 16 %.
2. **It lands 1,500 from Vloxx** (802 of 869 casts; 1,000 in 52, 500 in 15). The landing point is marked from 1.6 s into the cast
   (ground effect EE7B1787…) and the orb arrives at ~5.6 s.
3. **On the way it hits everything within ~250 of its path** (hits at 2.0–3.0 s): beside the line Vloxx → landing point, 0–200: 95 % (2,871) hit ·
   200–250: 80 % (744) · 250–300: 39 % (484) · 300+: 1 % (478). So a band **~500 wide**, starting on Vloxx.
4. **Where it lands it leaves a damage zone of ~300 radius** for about 4 s (same skill 80323): 85 % of the 1,405 hits after the landing
   were within 350 of the landing point, most of them at 150–300 (few players are ever closer than that).
5. **Then a ring expands from the landing point** (damage skill 81238): its radius is 386 at 0.3 s, 518 at 0.6 s, 641 at 0.9 s, 761 at 1.2 s, 897 at 1.5 s, 1033 at 1.8 s, 1185 at 2.1 s, 1332 at 2.7 s after
   the landing, i.e. **~394 units per second, out to ~1,350**. It crosses most of the arena. 38 % of the 7,609 players in
   its way were hit (one hit per player; how the others avoided it was not looked into).

The earlier entry for this skill ("a narrow line ±150, fading by ~900") is replaced by this. The planner draws it as one attack:
click on Vloxx, drag along its facing.

## 5q. Raging Storm in the last phase — the falling spears: sequence, targets and the Spear Aspect  [solid]
Script `scripts/raging_storm_last_phase.js` → `data/raging_storm_last_phase.json` (part of the full build). 26 logs, 1,968 s of last phase.
Each impact of Vloxx's *Raging Storm* (damage skill 81176) is announced by a 3 s ground effect (GUID D1132020…); those are counted per second.

| Aspect | impacts per second while it is alive | while it is dead |
|---|---|---|
| Staff | 0.95 (1,359 s) | 0.99 (609 s) |
| Spear | 1.01 (1,359 s) | 0.87 (609 s) |
| Sword | 0.99 (1,379 s) | 0.89 (589 s) |

* **About the same rate either way: ~0.96 per second.** The spears come from Vloxx and keep falling with the Spear Aspect dead.
* By time window (Spear alive / dead): 0–15 s: 0.12 / 0.13 · 15–30 s: 1.13 / 1.13 · 30–45 s: 1.43 / 1.12 · 45–60 s: 1.23 / 1.11 · 60–200 s: 1.04 / 1.17. The differences go both ways and
  follow the timing of the bursts, not the Aspect.
* **The sequence.** A wave lands **every 3 s, starting 15 s into the last phase**. The pattern is fixed: **four single waves (15, 18, 21, 24 s), then
  alternating pairs: two double waves, two single waves**, and so on (double at 27/30, 39/42, 51/54, 63/66, 75/78, 87/90 s). A single wave is
  3 spears (sometimes 2), a double wave is two of them at once: 6 (or 5, or 4).

  | at | kind | usual number of spears | logs with that number | all sizes seen |
  |---|---|---|---|---|
  | 15 s | single | 3 | 20 of 26 | 2 × 6, 3 × 20 |
  | 18 s | single | 3 | 20 of 26 | 2 × 6, 3 × 20 |
  | 21 s | single | 3 | 20 of 26 | 2 × 6, 3 × 20 |
  | 24 s | single | 3 | 20 of 26 | 2 × 6, 3 × 20 |
  | 27 s | double | 6 | 14 of 26 | 4 × 3, 5 × 9, 6 × 14 |
  | 30 s | double | 6 | 14 of 26 | 4 × 3, 5 × 9, 6 × 14 |
  | 33 s | single | 3 | 17 of 26 | 2 × 9, 3 × 17 |
  | 36 s | single | 3 | 16 of 25 | 2 × 9, 3 × 16 |
  | 39 s | double | 6 | 13 of 24 | 3 × 1, 4 × 8, 5 × 2, 6 × 13 |
  | 42 s | double | 6 | 13 of 24 | 3 × 1, 4 × 8, 5 × 2, 6 × 13 |
  | 45 s | single | 3 | 13 of 23 | 2 × 10, 3 × 13 |
  | 48 s | single | 3 | 13 of 23 | 2 × 10, 3 × 13 |
  | 51 s | double | 5 | 12 of 22 | 3 × 2, 5 × 12, 6 × 8 |
  | 54 s | double | 5 | 11 of 19 | 5 × 11, 6 × 8 |
  | 57 s | single | 3 | 16 of 19 | 2 × 3, 3 × 16 |
  | 60 s | single | 3 | 15 of 18 | 2 × 3, 3 × 15 |
  | 63 s | double | 5 | 9 of 18 | 4 × 2, 5 × 9, 6 × 7 |
  | 66 s | double | 5 | 8 of 16 | 4 × 2, 5 × 8, 6 × 6 |
  | 69 s | single | 2 | 7 of 14 | 2 × 7, 3 × 7 |
  | 72 s | single | 2 | 7 of 13 | 2 × 7, 3 × 6 |
  | 75 s | double | 4 | 6 of 12 | 3 × 2, 4 × 6, 5 × 1, 6 × 3 |
  | 78 s | double | 4 | 6 of 12 | 3 × 2, 4 × 6, 5 × 1, 6 × 3 |
  | 81 s | single | 2 | 6 of 10 | 1 × 1, 2 × 6, 3 × 3 |
  | 84 s | single | 2 | 6 of 9 | 1 × 1, 2 × 6, 3 × 2 |
  | 87 s | double | 5 | 4 of 9 | 2 × 1, 3 × 1, 4 × 2, 5 × 4, 6 × 1 |
  | 90 s | double | 5 | 4 of 7 | 2 × 1, 4 × 1, 5 × 4, 6 × 1 |
  | 93 s | single | 3 | 3 of 5 | 2 × 2, 3 × 3 |

* The two waves of a pair have the same size in every log seen.
* **How many fall at once.** A wave lands every 3 s from ~15 s into the phase. A set is **2 or 3 spears**, each on a player, and repeats once 3 s later;
  every other pair of waves two sets overlap, giving 4, 5 or 6 (sizes seen: 1 × 5, 2 × 99, 3 × 203, 4 × 45, 5 × 72, 6 × 91).
* **Spears per wave with each Aspect alive / dead:** Staff 3.66 / 3.74 · Spear 3.76 / 3.51 · Sword 3.68 / 3.7. With all ten players up, Spear alive / dead: 3.75 / 3.44.
  The small gap for the Spear most likely comes from the targeting rule below (a set has 3 spears when somebody is fixated, 2 when nobody is) and not from the Aspect; this link was not tested directly.
* What the Spear Aspect adds while alive is **its own attack, *Thousand Strikes*** (80709): 1,991 hits on players with the Spear alive, 0 with it dead.

**Who the spears target** (`scripts/raging_storm_targets.js` → `data/raging_storm_targets.csv`, `raging_storm_targets.json`; 105 sets in 26 logs).
* **Every 12 s (at 15, 27, 39, 51 s, …) Vloxx picks a set of targets, and each target then gets a spear every 3 s for six waves (18 s).** The last two waves
  of a set overlap the first two of the next set: those are the double waves. Checks: the two single waves of a set hit the same players in
  87 of 95 sets; the set is part of the double wave before it in 79 of 92 and of the one after it in 79 of 88
  (a spear is matched to the player within 80 units of where it appears, so some misses may be matching errors).
* **Each spear appears on its target's position** (92 % of 1,898 spears within 80 units of a living player) and its 3 s ground effect stays at that spot.
* **The fixated player is in the set: 63 of 70 sets (90 %).**
* **Set size = 2 players, plus the fixated player.** With a fixated player: 3 targets in 62 sets, 2 in 8. With nobody fixated: 2 targets in 26 sets, 3 in 7, 1 in 2.
  That is why a wave is 3 spears in most logs and 2 in some.
* **The two other targets look random** (details below). By distance from the arena centre among the non-fixated players: closest third 69, middle third 68, farthest third 77.
  A target of the previous set is picked again 28 % of the time (29 % expected by chance). Downed players can be targeted (83 spears).
* **No rule was found for the two other targets** (script raging_storm_target_rule.js, 97 sets). The candidates were ranked by each feature below; a real rule
  would put the two targets among the 2 lowest or the 2 highest almost every time. Every feature is at chance level (~26 %):

  | candidates ranked by | targets among the 2 lowest | among the 2 highest | chance |
  |---|---|---|---|
  | distance from Vloxx | 26 % | 24 % | 26 % |
  | distance from arena centre | 26 % | 24 % | 26 % |
  | health % | 21 % | 27 % | 26 % |
  | squad order in the log | 21 % | 25 % | 26 % |
  | instance id | 23 % | 24 % | 26 % |
  | damage to Vloxx in the last 12 s | 25 % | 27 % | 26 % |
  | damage to Vloxx in the last 30 s | 27 % | 26 % | 26 % |
  | toughness flag | 23 % | 26 % | 26 % |
  | time since last targeted | 27 % | 26 % | 26 % |
  | downed first | 19 % | 27 % | 26 % |
  | distance from the Spear Aspect | 28 % | 26 % | 26 % |
  | distance from the Sword Aspect | 26 % | 25 % | 25 % |
  | distance from the fixated player | 25 % | 25 % | 26 % |
  | distance from the Staff Aspect | 25 % | 23 % | 28 % |

  The two targets are not close to each other either (median 221 apart; any two candidates: 209). So for planning purposes:
  **the fixated player, plus two random players.** [likely: a rule on something not tested here cannot be excluded]
* Over a whole last phase the spread is uneven (the most-hit player gets a median of 20 spears, up to 32), while 20 % of players are never targeted.

## 5r. Phase times — fastest and average per phase  [solid]
Script `scripts/phase_times.js` → `data/phase_times.csv` (one row per log × finished phase) and `data/phase_times.json` (part of the full build).
224 CM logs, 834 finished phases. A phase only counts in a log where it was finished; the last phase and the full fight only on kills.
Phases are cut like Elite Insights does: a split = the *Visions of Eternity* cast with its breakbar; Split 3 runs until the Damage Immunity of the
last phase ends. Raw logs start 3.0 s before the fight (checked on two kills that exist in both forms), which is subtracted.

In fight order. The fastest time is a link to its log when that log is online; when it is not, the name of the log is written and the fastest one that is online is given too.

| phase | what it covers | fastest | average | median | slowest | logs |
|---|---|---|---|---|---|---|
| Staff Phase | pull → 70 % | 1 min 48.2 s (log `20261003-232757`, not uploaded) (fastest online: [1 min 53.7 s](https://gw2wingman.nevermindcreations.de/log/081e5-Seel6214_20261001-210656_noe_kill)) | 2 min 08.1 s | 2 min 06.4 s | 2 min 53.0 s | 224 |
| Split 1 | Visions of Eternity + breakbar at 70 % | 13.6 s (log `20260930-220831`, not uploaded) (fastest online: [15.2 s](https://b.dps.report/ST7h-20261002-005256_boss)) | 25.9 s | 25.0 s | 52.4 s | 223 |
| Spear Phase | 70 → 40 % | [1 min 49.4 s](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 2 min 14.8 s | 2 min 08.3 s | 4 min 05.9 s | 110 |
| Split 2 | Visions of Eternity + breakbar at 40 % | [18.2 s](https://gw2wingman.nevermindcreations.de/log/23f47-Mimslade4271_20261002-004636_noe_kill) | 31.5 s | 29.6 s | 1 min 07.8 s | 109 |
| Sword Phase | 40 → 10 % | 2 min 15.5 s (log `20261003-234425`, not uploaded) (fastest online: [2 min 15.7 s](https://gw2wingman.nevermindcreations.de/log/85c0f-20261002-215404_noe_kill)) | 2 min 49.7 s | 2 min 46.0 s | 3 min 40.9 s | 58 |
| Split 3 | Visions of Eternity + breakbar at 10 %, until the Damage Immunity ends | [29.7 s](https://gw2wingman.nevermindcreations.de/log/6f88a-Clemyyy4217_20261001-213947_noe_kill) | 40.6 s | 40.8 s | 54.4 s | 58 |
| Final Form Phase | last phase → kill | [45.4 s](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 59.3 s | 57.9 s | 1 min 18.6 s | 26 |
| Full fight (kill) | pull → kill | [8 min 31.0 s](https://gw2wingman.nevermindcreations.de/log/14de4-20261004-011214_noe_kill) | 9 min 19.5 s | 9 min 13.0 s | 9 min 55.8 s | 26 |

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
