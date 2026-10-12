// Relic analyzer tool: per player of an arcdps log, relic procs and their damage, actual for the relic used and estimated for the others.
// Logic: window.RelicLogic = docs-src/relics/*.mjs (inlined by scripts/build_docs.js). Icons: window.GREENS (Green groups data). No dependencies.
(function () {
  const L = window.RelicLogic, { relics, conditions, conditionDurationDefaults } = L;
  const G = window.GREENS || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => n.toLocaleString('en-US');
  // Timeline colour of each condition, by its place in the conditions list (relics.css)
  const condColor = buffId => `var(--ra-c${conditions.findIndex(c => c.buffId === buffId)})`;
  const condName = buffId => conditions.find(condition => condition.buffId === buffId)?.name ?? `buff ${buffId}`;
  const damageRelics = relics.filter(relic => relic.procConditions.length || relic.strikeSkillIds.length);
  // Damage columns of each relic, like Elite Insights' target and cleave damage
  const sides = [
    { label: 'Target', side: 'target', title: 'on the fight’s target, the boss' },
    { label: 'Cleave', side: 'cleave', title: 'on every other foe' },
  ];
  // Actual procs in the measured colour, estimated procs of each other relic in the next ones
  const OWN_COLOR = 'var(--solid)', ESTIMATE_COLORS = ['var(--likely)', 'var(--open)', 'var(--acc)'];
  // Seconds shown on each side of a proc clicked in the proc list
  const PROC_ZOOM = 10;
  // Width of the popup shown when hovering a proc, kept inside the window
  const POPUP_WIDTH = 280;

  // ---------- same computations as the original page ----------
  const formatBonus = multiplier => `+${(100 * (multiplier - 1)).toFixed(1).replace(/\.0$/, '')}%`;
  const formatSeconds = ms => `${ms / 1000}s`;
  const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const getDuration = (player, buffId) => player.conditionDurations.find(duration => duration.buffId === buffId)?.duration ?? null;
  // Actual procs for the player's relic, estimated procs for the others
  const getProcs = (player, relic) => player.relic === relic ? player.procs : player.estimates.find(estimate => estimate.relic === relic)?.procs;
  const getUnknownReason = note => `Unknown: ${note ?? 'not enough data in this log'}`;
  const getDurationSource = (name, duration) => {
    switch (duration?.source) {
      case undefined: return `Unknown: no relic proc of theirs applied ${name.toLowerCase()}, and neither it nor their other conditions have enough varied applications to fit a duration to`;
      case 'fit': return `Estimated: fitted to their ${name.toLowerCase()} applications, whose base durations are multiples of 0.25s`;
      case 'default': return `Estimated: the usual ${name.toLowerCase()} duration of their build, hardcoded, since they applied too little ${name.toLowerCase()} to read it from the log`;
      case 'other': return 'Estimated: the lowest duration of their other conditions, since specific duration bonuses only add up';
      case 'procs': return `Read from the ${name.toLowerCase()} stacks of their relic procs`;
      case 'skills': return `Estimated: read from their ${name.toLowerCase()} applications matched to the skill hit applying them, whose base duration is in the GW2 API`;
    }
  };
  // Damage of one proc part on one side, with the player's duration from the log or typed in
  const resolvePart = (player, part, customDurations, side) => {
    if (part.kind === 'power') return { name: 'Power', note: part.note, value: part.value?.[side] ?? null };
    const custom = customDurations.get(part.buffId);
    const duration = getDuration(player, part.buffId);
    const multiplier = custom ?? duration?.multiplier;
    if (part.rate === null) return { name: part.name, note: part.note, value: null };
    if (multiplier === undefined) return { name: part.name, note: `the player's ${part.name.toLowerCase()} duration is unknown: no relic proc of theirs applied it, and neither it nor their other conditions have enough varied applications to fit a duration to. Type one in the Condition duration column`, value: null };
    const durationNote = custom !== undefined
      ? `${formatBonus(custom)} duration typed in`
      : duration?.source === 'skills'
        ? `${formatBonus(multiplier)} duration read from their ${part.name.toLowerCase()} applications matched to the skill applying them, with its base duration from the GW2 API`
        : duration?.source === 'fit'
          ? `${formatBonus(multiplier)} duration fitted to their ${part.name.toLowerCase()} applications, whose base durations are multiples of 0.25s`
          : duration?.source === 'default'
            ? `${formatBonus(multiplier)} duration, the usual one for a ${player.profession}, since the log does not show theirs`
            : duration?.source === 'other'
              ? `${formatBonus(multiplier)} duration taken from their other conditions, the lowest one since specific duration bonuses only add up`
              : null;
    const notes = [part.note, durationNote].filter(Boolean);
    return { name: part.name, ...notes.length && { note: notes.join(', ') }, value: L.getConditionPartValue(part, multiplier)?.[side] ?? null };
  };
  // Procs times the damage of one proc on one side, measured from the player's own damage in the log
  const getDamage = (player, relic, customDurations, side) => {
    if (!relic) return null;
    const procDamage = player.procDamage.find(procDamage => procDamage.relic === relic);
    const procs = getProcs(player, relic);
    if (!procDamage || procs === undefined) return null;
    // Damage of one proc, rounded for display
    const parts = procDamage.parts.map(part => {
      const { name, note, value } = resolvePart(player, part, customDurations, side);
      return { kind: part.kind, name, note, value: value === null ? null : Math.round(value) };
    });
    if (procs > 0 && parts.every(({ value }) => value === null)) return null;
    const known = procs * parts.reduce((total, { value }) => total + (value ?? 0), 0);
    return {
      // Estimated procs, or a part estimated from formulas, fits or a typed in duration
      isEstimated: player.relic !== relic || parts.some(({ note, value }) => note && value !== null),
      known, parts, procs,
      // No proc is no damage, even when the damage of one proc is partly unknown
      total: procs > 0 && parts.some(({ value }) => value === null) ? null : known,
    };
  };
  // Hover text of a damage total: its power and condition shares, each condition on its own line
  const getDamageSplit = ({ parts, procs }) => {
    const format = value => value === null ? '?' : fmt(procs * value);
    const sum = values => values.includes(null) ? null : values.reduce((total, value) => total + value, 0);
    const power = parts.filter(({ kind }) => kind === 'power'), condition = parts.filter(({ kind }) => kind === 'condition');
    return [
      ...power.length ? [`Power: ${format(sum(power.map(({ value }) => value)))}`] : [],
      ...condition.length ? [`Condition: ${format(sum(condition.map(({ value }) => value)))}`, ...condition.map(({ name, value }) => `  ${name}: ${format(value)}`)] : [],
    ].join('\n');
  };

  // ---------- state ----------
  // results: one per log file; customDurations: typed in duration multipliers, keyed by file name, account and condition
  let results = [], customDurations = {}, isLoaded = true, howTab = 0, howOpen = true, booted = false, root, pop;
  const getCustomDurations = fileName => player => new Map(conditions.flatMap(({ buffId }) => {
    const multiplier = customDurations[`${fileName}|${player.account}|${buffId}`];
    return multiplier === undefined ? [] : [[buffId, multiplier]];
  }));
  const specIcon = (spec, small) => {
    const prof = (G.colors || {})[spec] ? spec : Object.keys(G.professions || {}).find(k => G.professions[k].includes(spec));
    const src = (G.icons || {})[spec];
    return `<span class="ra-ic${small ? ' ra-sm' : ''}" style="background:${(G.colors || {})[prof] || 'var(--mute)'}" title="${esc(spec)}">${src ? `<img src="${src}" alt="">` : ''}</span>`;
  };
  const relicIcon = relic => `<img src="${esc(relic.icon)}" alt="">`;

  // ---------- How it works ----------
  const tyrantArea = relics.flatMap(({ estimator }) => estimator?.type === 'stacks' && estimator.area ? [estimator.area] : [])[0];
  // Detection reads what the game did, so the relic's own rules (stack gains, recharge) are already applied by the game
  const describeDetection = ({ estimator, finder, procConditions, recharge }) => {
    const stackRule = estimator?.type === 'stacks' ? `the ${estimator.stackIcd} ms between ${condName(estimator.buffId)} stack gains and ` : '';
    switch (finder.type) {
      case 'buff-burst':
        return `Not detected by Elite Insights, the log does not name this relic. A proc is recognized by what it applies: the player applying ${condName(finder.triggerBuffId)} to a foe together with, on that same foe less than 10 ms apart, ${procConditions
          .map(({ baseDuration, buffId, stacks }) => `at least ${stacks} ${condName(buffId)} stacks sharing a duration from ${formatSeconds(baseDuration)} to ${formatSeconds(2 * baseDuration)}, its ${formatSeconds(baseDuration)} base with the player's +0% to +100% ${condName(buffId).toLowerCase()} duration`)
          .join(' and ')}. Two such bursts less than ${formatSeconds(finder.cooldown)} apart count once: the relic cannot proc again within its ${formatSeconds(recharge)} recharge, and the ${formatSeconds(recharge - finder.cooldown)} margin keeps a proc logged a few ms early.`;
      case 'damage':
        return `${finder.whenBuffRemoved ? 'Like' : 'Same detection as'} Elite Insights. The game already applied ${stackRule}the ${formatSeconds(recharge)} recharge, so detection only looks for the result: a hit of the relic's skill on any foe${finder.whenBuffRemoved
          ? ` from 10 ms before to less than 50 ms after the player loses all ${finder.whenBuffRemoved.stacks} stacks of ${finder.whenBuffRemoved.name}. Elite Insights only allows less than 10 ms either way and misses hits landing a tick later, up to 15 ms after seen in logs`
          : ''}. A hit less than 50 ms after the previous one belongs to the same proc, since one proc can hit several foes.`;
    }
  };
  const describeEstimator = ({ estimator, recharge }) => {
    switch (estimator?.type) {
      case undefined: return null;
      case 'stacks': return `Replays the player's ${condName(estimator.buffId)} applications. Each one gives a stack if ${estimator.stackIcd} ms passed since the previous stack, up to ${estimator.maxStacks}. At ${estimator.maxStacks} stacks the next application procs right away, without waiting ${estimator.stackIcd} ms, and on the same hit if it applies several stacks. Then the relic recharges for ${formatSeconds(recharge)}, gaining no stacks. ${condName(estimator.buffId)} applied by the player's current relic itself is left out, since it would not exist with this relic.`;
      case 'target-stacks': return `Tracks the ${condName(estimator.buffId)} stacks of every foe, from all players, stack by stack. Each time the player applies ${condName(estimator.buffId)} to a foe that already has ${estimator.minStacks} or more stacks, it procs, then recharges for ${formatSeconds(recharge)}.`;
    }
  };
  const describeProc = ({ procConditions, strikeCoefficient, strikeSkillIds }) => [
    ...strikeSkillIds.length ? [strikeCoefficient ? `a strike with a ${strikeCoefficient} coefficient` : 'a strike'] : [],
    ...procConditions.map(({ baseDuration, buffId, stacks }) => `${stacks} ${condName(buffId)} stacks for ${formatSeconds(baseDuration)} base duration`),
  ].join(', ');
  const li = (label, text) => `<li><b>${label}</b> ${text}</li>`;
  const HOW = [
    ['Condition duration', () => `The Condition duration column: each player's duration bonus for each condition, from +0% to +100%, used by the estimated damage and the condition timeline's procs.<br>It is taken from the first of these that gives one:<ul>
${li('Exact', "read from the relic stacks of the player's own procs, e.g. an 8s base burning lasting 16s is +100%, the median over their procs, capped at +100%.")}
${li('≈ From their skills', "read from the player's applications of that condition whose skill is known: the one skill of theirs hitting that foe at the same time, whose base duration of that condition is in the GW2 API, e.g. an 8s base bleeding lasting 12s is +50%.<br>Conditions from traits, sigils and runes are left out, as are skills with several base durations, and bonuses over +100% from outdated API durations.<br>It needs at least 10 such applications, at least two thirds of them agreeing on the bonus within 1 point, and the median of those is kept.")}
${li('≈ Fitted', "to the player's own applications of that condition.<br>Base durations are multiples of 0.25s, so the bonus turning their applied durations back into round ones is kept, tried from +0% to +100% by steps of 0.1%.<br>At least 80% of the applications must fit, and of the bonuses fitting nearly as many as the best one, within 5 points, the largest is kept, since a round duration is more likely a capped one.<br>It needs at least 10 applications with 3 different durations or more.")}
${li('≈ Default', `of their elite specialization, hardcoded for builds known to apply too little of a condition to read it from the log:<br>${Object.entries(conditionDurationDefaults).map(([profession, multipliers]) => ` ${profession} ${Object.entries(multipliers).map(([buffId, multiplier]) => `${condName(Number(buffId)).toLowerCase()} +${Math.round(10000 * (multiplier - 1)) / 100}%`).join(', ')}`).join(';')}.`)}
${li('≈ From their other conditions:', 'the lowest of their exact, skill or fitted bonuses, since specific duration bonuses only add to the general one.<br>It can be too low when the player has a bonus specific to this condition.')}
${li('?:', 'none of the above.')}
${li('Your own:', "type a bonus from 0 to 100 in the column's input to use it instead, for that player and condition.<br>The damage columns update right away, proc counts do not depend on durations.<br>Clear the input to use the log's value again.<br>The input's placeholder shows the log's value.")}</ul>`],
    ['Procs', () => `Each player's relic is recognized from its procs, or hits of its skill, a player with neither shows "None detected".<br>A player with several relics recognized gets a row for each.<br>Each relic has a procs column and two damage columns, target and cleave: the player's actual procs for the relic they used, without ~, and ~ estimates for the others.<ul>
${relics.map(relic => `<li><h5>${esc(relic.name)}</h5><i>"${esc(relic.description)}"</i> (${formatSeconds(relic.recharge)} recharge)<br>${esc(describeDetection(relic))}</li>`).join('')}</ul>`],
    ['Estimated procs', () => `How many procs a player would have had with another relic, replaying their actual fight, shown with ~ in that relic's procs column.<br>Knock-on effects are ignored, e.g. the extra damage changing phase timings.<ul>
${relics.filter(relic => relic.estimator).map(relic => `<li><h5>${esc(relic.name)}</h5>${esc(describeEstimator(relic))}</li>`).join('')}</ul>`],
    ['Estimated damage', () => `Procs, actual for the player's relic and estimated for the others, times the average damage of one proc of that relic for that player.<br>Split like Elite Insights into "Target", the damage on the fight's target (every agent of the boss's species), and "Cleave", the damage on every other foe:<ul>
${relics.map(relic => `<li><h5>${esc(relic.name)}</h5>One proc is ${esc(describeProc(relic))}.</li>`).join('')}
${li('Condition part:', `stacks × how long they last × the player's damage per second of one stack, averaged over the procs.<br>The stacks are counted on every foe the proc landed on: one for most procs, every foe hit for a relic hitting several at once, like Relic of the Last Tyrant's explosion, each foe's stacks going to the target or cleave column.<br>An estimated proc lands on the foe whose condition would have triggered it.<br>An estimated Relic of the Last Tyrant explodes around that foe: when one hit burned several foes less than 10 ms apart, the log does not tell which one triggered it, so the fight's target is used if among them.<br>It also lands on the nearest foes the players hit, alive then (showed up, not dead nor despawned, and still in the log: arcdps logs nothing more of a foe once it is gone, even one that left without dying, like a geyser the squad broke), whose center is within ${tyrantArea.radius} of that foe's center, up to ${tyrantArea.maxTargets} foes in all, the explosion's range and number of targets from the wiki, each with its own cut.<br>Foes' positions come from the log, logged when they move, in between two positions the foe is taken to move in a straight line.<br>In a log without the triggering foe's position, the explosion lands on that foe only.<br>An estimated proc only lands on foes that could take damage then: a player damaged them within 2s of it.<br>An invulnerable foe's hits are absorbed for 0 damage, and a foe only damageable at times, like an unsharded geyser, logs no damage the rest of the time.<br>A proc that lands on none of its foes still counts, since the relic would still trigger and recharge, but deals nothing.<br>They last base duration × the player's duration (see Condition duration), cut short where the proc landed, actual or estimated: when a stack of that condition on that foe, from anyone, is next removed more than 0.1s before its expiry (a cleanse, the foe dying, a phase), the foe dies or despawns, or the log ends.<br>So an estimated proc on a dying add gets cut like the stacks on it were.<br>Logs without buff instance ids do not show early removals, only deaths, despawns and the log end cut stacks there.<br>Checked against the relic's own stacks in the logs tested.<br>That damage per second is their total damage with that condition divided by the time their stacks actually stayed on foes, each stack followed from its application to its expiry or removal, or counted for its full duration in logs without buff instance ids.<br>Even for the relic a player used, this part is computed this way: the log cannot tell the relic's condition ticks from the player's.`)}
${li('≈ Condition part:', `of a condition the player never applied: its damage per second of one stack comes from the wiki formulas, base + factor × Condition Damage (${conditions.map(({ formula, name }) => `${name.toLowerCase()} ${formula.base} + ${formula.factor}`).join(', ')}, torment while stationary).<br>The player's Condition Damage and damage multiplier are fitted to their two conditions with the most stack uptime, assuming their multipliers apply to every condition alike, with Condition Damage kept between 0 and 3,000.<br>Checked against players whose torment is measured.<br>A part whose duration is estimated is ≈ too.<br>Hover a ≈ part to see how it was estimated.`)}
${li('Power part:', "the player's total strike damage with the relic's skill divided by their procs of it, so a proc hitting several foes counts them all, each strike going to the target or cleave column by the foe it hit.<br>Only strikes: conditions a relic applies are logged under the condition, not the relic.")}
${li('≈ Power part:', `for a player who did not use the relic, for one hit on each foe their estimated proc landed on, in the target column for the hits on the target and in cleave for the others: the wiki strike formula, weapon strength × coefficient × the rest (Power, damage multipliers, crits, the foe's armor).<br>${relics.filter(relic => relic.strikeCoefficient).map(relic => ` ${esc(relic.name)}: ${relic.strikeCoefficient} coefficient, ${L.UNEQUIPPED_WEAPON_STRENGTH} unequipped weapon strength like every equipment skill. `).join('')}<br>The rest is fitted to the player's own strikes, normal, critical and glancing hits: for each of their skills with a single damage coefficient in the GW2 API, its average hit ÷ (coefficient × weapon strength), the hit-weighted median over at least 2 skills and 10 hits.<br>Weapon strength: ${L.UNEQUIPPED_WEAPON_STRENGTH} for heal, utility and elite skills, the weapon's for weapon skills, ${L.BUNDLE_WEAPON_STRENGTH} for kits and bundles, ${L.PROFESSION_WEAPON_STRENGTH} for profession mechanics.<br>Except unequipped, weapon strengths depend on the weapon's rarity, which the log does not show: ascended is used, exotic is about 5% lower.<br>Checked by predicting each skill's average hit from the player's other skills: within 2% to 8% for condition players, around 19% for pure power ones.`)}
${li('Under each total:', 'procs × (the average damage of one proc, part by part).<br>Hover the total to see it split into power and condition damage.<br>0 procs is 0 damage, even when a part is unknown.<br>The total has a ~ when the procs are estimated or any part is ≈, including a part using a duration you typed in.')}
${li('? part:', 'not measurable or estimable from this log.<br>The power part needs the player to have used the relic, or enough strikes of skills with a known coefficient.<br>A condition part needs the player\'s duration for it, and either their own ticks of that condition or two other conditions to fit the formulas to.<br>Hover it to see why.<br>The total then shows the known parts + ?. "—" means no part is known.')}
<li><span class="ra-up">▲</span>/<span class="ra-down">▼</span> more or less damage than the relic the player actually used, in the same column, only when both totals are complete.</li></ul>`],
    ['Condition timeline', () => `Below each log, pick a player to see the ${conditions.map(({ name }) => name.toLowerCase()).join(', ')} stacks they had on all foes over the fight, every 0.5s, built from each stack's lifetime, with their relic procs marked: actual ones dashed, estimated ones of the other relics dotted.<br>Drag over the chart to zoom, the stacks axis fits the zoomed range.<br>Under the chart, every proc time is listed by relic, click one to zoom on 10s around it.<br>Each proc shows its damage, target and cleave together, the same parts as the Estimated damage columns but with its own cuts, hover it for the details and its damage as target + cleave, or which one it all went to, and each relic its average damage per proc.<br>The power part is the proc's own: for an actual proc, the player's strikes of the relic's skill from that proc on until the next one, for an estimated proc, one hit on each foe it landed on.<br>Procs whose condition stacks were cut short (see Estimated damage) are red with scissors, hover one for how much of each condition it kept, and each relic shows how much of its procs' condition duration was wasted and the damage it cost, at the player's duration, typed in or from the log, like the Estimated damage columns.<br>Hovering a proc also shows where everyone stood at that moment, like a frame of Elite Insights' combat replay without the arena: the player, the rest of the squad, and the foes the players hit that were alive then, the same as for Relic of the Last Tyrant's explosion (see Estimated damage), the fight's target bigger, the foes the proc landed on ringed, and grey the foes that could not take damage then, the same as estimated procs skip (see Estimated damage).<br>Positions come from the log's position records, blended between the two around the proc, on one scale fitting everywhere the players and foes went during the fight.<br>The table under it compares how long their stacks were applied for with how long they actually stayed on foes.<br>Its damage per stack-second is the rate the estimated damage uses.`],
  ];

  // ---------- procs table ----------
  function damageCell(cds, player, relic, side) {
    const damage = getDamage(player, relic, cds, side), isOwn = player.relic === relic;
    // Compared to the damage of the relic the player actually used on the same side, when both are complete
    const current = isOwn ? null : getDamage(player, player.relic, cds, side);
    const difference = damage?.total != null && current?.total != null ? damage.total - current.total : 0;
    const cls = `ra-r${isOwn ? '' : ' ra-other'}`;
    if (!damage) return `<td class="${cls}"><span title="${esc(`Not enough data in this log to estimate any part of a ${relic.name} proc for ${player.name}`)}">—</span></td>`;
    const caret = difference !== 0 ? `<span class="${difference > 0 ? 'ra-up' : 'ra-down'}" title="${esc(`${difference > 0 ? '+' : ''}${fmt(difference)} compared to ${player.relic.name}`)}">${difference > 0 ? '▲' : '▼'}</span>` : '';
    const total = damage.total === null ? `~${fmt(damage.known)} + ?` : damage.procs === 0 ? '0' : `${damage.isEstimated ? '~' : ''}${fmt(damage.total)}`;
    const parts = damage.parts.map(({ name, note, value }, i) => (i > 0 ? ' + ' : '') + (value === null
      ? `<span class="ra-q" title="${esc(getUnknownReason(note))}">${esc(name.toLowerCase())} ?</span>`
      : note ? `<span class="ra-est" title="${esc(note.charAt(0).toUpperCase() + note.slice(1))}">${esc(name.toLowerCase())} ≈${fmt(value)}</span>` : `${esc(name.toLowerCase())} ${fmt(value)}`)).join('');
    return `<td class="${cls}">${caret}<span class="ra-tot"${damage.procs === 0 ? '' : ` title="${esc(getDamageSplit(damage))}"`}>${total}</span><div class="ra-parts">${damage.procs} × (${parts})</div></td>`;
  }
  function durationCell(result, player) {
    const cds = getCustomDurations(result.fileName)(player);
    return `<td class="ra-r">${player.conditionDurations.map(({ buffId, duration }) => {
      const custom = cds.get(buffId), logBonus = duration && formatBonus(duration.multiplier).slice(1, -1), name = condName(buffId);
      const title = `${custom !== undefined ? 'Typed in' : getDurationSource(name, duration)}. Type a bonus from 0 to 100 to use your own, clear it to use the log's again`;
      return `<div class="ra-dur${duration || custom !== undefined ? '' : ' ra-unk'}" title="${esc(title)}"><span class="ra-sw" style="background:${condColor(buffId)}"></span>${name} +<input inputmode="decimal" class="${custom !== undefined ? 'ra-own' : ''}" data-k="${esc(`${result.fileName}|${player.account}|${buffId}`)}" placeholder="${duration ? duration.source === 'procs' ? logBonus : `≈${logBonus}` : '?'}" value="${custom === undefined ? '' : Math.round(1000 * (custom - 1)) / 10}">%</div>`;
    }).join('')}</td>`;
  }
  function procsTable(result) {
    const cds = getCustomDurations(result.fileName);
    const head1 = `<th rowspan="2">Player</th><th rowspan="2">Relic</th><th rowspan="2" class="ra-r" title="Condition duration bonus, read from the relic stacks of the player’s procs, else ≈ estimated from the log">Condition duration</th>` +
      relics.map(relic => `<th class="ra-rel ra-l" colspan="${damageRelics.includes(relic) ? 1 + sides.length : 1}"><span class="ra-relic">${relicIcon(relic)}${esc(relic.name)}</span></th>`).join('');
    const head2 = relics.map(relic => `<th class="ra-sub ra-l" title="${esc(`${relic.name} procs: actual for players using it, ~ estimated for the others by replaying their conditions without their current relic`)}">Procs</th>` +
      (damageRelics.includes(relic) ? sides.map(({ label, title }) => `<th class="ra-sub" title="${esc(`Procs × the player's ${relic.name} proc damage ${title} in this log: the proc's condition stacks at their condition duration, times their damage per second of stack on a foe, plus its strike. ~ when any of it is estimated`)}">${label}</th>`).join('') : '')).join('');
    const rows = result.players.map(player => `<tr class="${player.procs ? '' : 'ra-dim'}">
<td><div class="ra-who">${specIcon(player.profession)}<div>${esc(player.name)}<div class="ra-acc">${esc(player.account)}</div></div></div></td>
<td>${player.relic ? `<span class="ra-relic">${relicIcon(player.relic)}${esc(player.relic.name)}</span>` : '<span class="ra-other">None detected</span>'}</td>
${durationCell(result, player)}
${relics.map(relic => { const isOwn = player.relic === relic, procs = getProcs(player, relic);
      return `<td class="ra-r ra-l${isOwn ? '' : ' ra-other'}">${procs === undefined ? '—' : isOwn ? procs : `~${procs}`}</td>` + (damageRelics.includes(relic) ? sides.map(({ side }) => damageCell(cds(player), player, relic, side)).join('') : ''); }).join('')}</tr>`).join('');
    return `<div class="tw"><table class="ra-table"><thead><tr>${head1}</tr><tr>${head2}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- condition timeline ----------
  // Everything the timeline of one log shows for its picked player, as in the original component
  function timelineModel(result) {
    const players = result.players, ui = result.ui;
    // A player has one row per detected relic, their timeline is the same on each
    const uniquePlayers = players.filter((player, i) => players.findIndex(other => other.account === player.account) === i);
    if (ui.account === undefined) ui.account = uniquePlayers.find(player => player.procs)?.account ?? uniquePlayers[0]?.account;
    const player = uniquePlayers.find(player => player.account === ui.account);
    if (!player) return null;
    const rows = players.filter(other => other.account === player.account);
    // Each row estimates every relic but its own, so the estimates of relics the player did not use are taken once
    const estimates = relics.filter(relic => rows.every(row => row.relic !== relic))
      .flatMap(relic => rows[0].estimates.filter(estimate => estimate.relic === relic && estimate.procs))
      .map((estimate, i) => ({ ...estimate, color: ESTIMATE_COLORS[i % ESTIMATE_COLORS.length] }));
    const procTimes = rows.flatMap(other => other.procTimes.map(time => ({ relic: other.relic, time })));
    // Proc times of the relic the player used, then the estimated ones of the others
    const procLists = [
      ...rows.filter(row => row.procs).map(row => ({ color: OWN_COLOR, frames: row.procFrames, isEstimated: false, relic: row.relic, times: row.procTimes })),
      ...estimates.map(({ color, procFrames, procTimes, relic }) => ({ color, frames: procFrames, isEstimated: true, relic, times: procTimes })),
    ];
    const firstTime = player.timeline[0]?.time ?? 0, lastTime = player.timeline.at(-1)?.time ?? 0;
    const shownConditions = conditions.filter(({ buffId }) => player.conditions.find(summary => summary.buffId === buffId)?.stacks);
    const cds = getCustomDurations(result.fileName)(player);
    // Each condition part of a relic's proc on each foe it landed on: full duration at the player's duration, typed in or from the log, and how much the stacks kept
    const getParts = relic => { const { procDamage } = rows.find(row => row.relic === relic) ?? rows[0]; return procDamage.find(damage => damage.relic === relic)?.parts ?? []; };
    const getCuts = (relic, proc) => getParts(relic).flatMap(part => {
      const multiplier = part.kind === 'condition' ? cds.get(part.buffId) ?? player.conditionDurations.find(({ buffId }) => buffId === part.buffId)?.duration?.multiplier : undefined;
      if (part.kind !== 'condition' || multiplier === undefined) return [];
      const full = part.baseDuration * multiplier;
      return (part.foes[proc] ?? []).map(({ available, isTarget }) => ({ full, isTarget, kept: Math.max(0, Math.min(full, available)), name: part.name, rate: part.rate, stacks: part.stacks }));
    });
    // Damage of one proc, part by part and on the target and other foes, null when unknown.
    // The power part is the proc's own strikes, or the average of all procs when they are not known per proc
    const getProcDamage = (relic, proc) => {
      const cuts = getCuts(relic, proc);
      const parts = getParts(relic).map(part => {
        if (part.kind === 'power') return { lost: 0, name: 'Power', value: part.perProc?.[proc] ?? part.value };
        const foes = cuts.filter(({ name }) => name === part.name);
        if (!foes.length || part.rate === null) return { lost: 0, name: part.name, value: null };
        const onSide = isTarget => foes.filter(foe => foe.isTarget === isTarget).reduce((total, { kept, rate, stacks }) => total + stacks * kept * rate, 0);
        return { lost: foes.reduce((total, { full, kept, rate, stacks }) => total + stacks * (full - kept) * rate, 0), name: part.name, value: { cleave: onSide(false), target: onSide(true) } };
      });
      const sum = side => parts.some(({ value }) => value === null) ? null : parts.reduce((total, { value }) => total + value[side], 0);
      const target = sum('target'), cleave = sum('cleave');
      return { cleave, lost: parts.reduce((total, { lost }) => total + lost, 0), parts, target, total: target === null || cleave === null ? null : target + cleave };
    };
    return { cds, estimates, firstTime, getCuts, getProcDamage, lastTime, player, procLists, procTimes, rows, shownConditions, uniquePlayers };
  }
  function procLines(M, list, i) {
    const { color, frames, isEstimated, relic, times } = list, time = times[i];
    const damage = M.getProcDamage(relic, i), procCuts = M.getCuts(relic, i).filter(({ full, kept }) => kept < full);
    const formatDamage = value => value === null ? '?' : `${isEstimated ? '~' : ''}${fmt(Math.round(value))}`;
    return { color, frame: frames[i], lines: [
      `${isEstimated ? 'Estimated proc' : 'Proc'} ${i + 1} at ${formatTime(time)}, click to zoom on it`,
      // Split between the sides the proc landed on, only when it landed on both
      `Damage: ${formatDamage(damage.total)}${damage.target !== 0 && damage.cleave !== 0 ? ` = target ${formatDamage(damage.target)} + cleave ${formatDamage(damage.cleave)}` : damage.target !== 0 ? ', all on the target' : damage.cleave !== 0 ? ', all cleave' : ''}`,
      ...damage.parts.map(({ name, value }) => `  ${name}: ${formatDamage(value && value.target + value.cleave)}`),
      ...procCuts.map(({ full, isTarget, kept, name, stacks }) => `${stacks} ${name.toLowerCase()} on ${isTarget ? 'the target' : 'another foe'} cut short: ${(kept / 1000).toFixed(1)}s of ${(full / 1000).toFixed(1)}s kept, ${((full - kept) / 1000).toFixed(1)}s wasted`),
      ...damage.lost ? [`Damage lost to cuts: ${formatDamage(damage.lost)}`] : [],
    ] };
  }
  function timelineHtml(result, ri) {
    const M = timelineModel(result);
    if (!M) return '';
    const player = M.player, ui = result.ui;
    const players = `<div class="ra-players">${M.uniquePlayers.map(other => `<button class="pl-btn${other.account === ui.account ? ' on' : ''}" data-a="player" data-r="${ri}" data-acc="${esc(other.account)}">${specIcon(other.profession, true)}${esc(other.name)}</button>`).join('')}</div>`;
    if (!M.shownConditions.length) return `<div class="ra-tl"><h4>Condition timeline</h4>${players}<div class="ra-hint">${esc(player.name)} applied none of ${conditions.map(({ name }) => name.toLowerCase()).join(', ')}</div></div>`;
    const legend = `<div class="ra-legend">${M.shownConditions.map(({ buffId, name }) => `<span><span class="ra-ln" style="border-color:${condColor(buffId)}"></span>${name}</span>`).join('')}${M.rows.filter(row => row.procs).map(row => `<span><span class="ra-ln" style="border-top:2px dashed ${OWN_COLOR}"></span>${row.procs} ${esc(row.relic.name)} procs</span>`).join('')}${M.estimates.map(({ color, procs, relic }) => `<span><span class="ra-ln" style="border-top:2px dotted ${color}"></span>~${procs} ${esc(relic.name)} procs, estimated</span>`).join('')}</div>`;
    const lists = M.procLists.map((list, li) => {
      const { color, isEstimated, relic, times } = list;
      const cuts = times.map((_, i) => M.getCuts(relic, i));
      const { full, kept } = cuts.flat().reduce((total, cut) => ({ full: total.full + cut.stacks * cut.full, kept: total.kept + cut.stacks * cut.kept }), { full: 0, kept: 0 });
      const cutProcs = cuts.filter(procCuts => procCuts.some(({ full, kept }) => kept < full)).length;
      const damages = times.map((_, i) => M.getProcDamage(relic, i));
      const average = damages.length && damages.every(({ total }) => total !== null) ? damages.reduce((total, damage) => total + damage.total, 0) / damages.length : null;
      const lost = damages.reduce((total, damage) => total + damage.lost, 0), t = isEstimated ? '~' : '';
      return `<div class="ra-proc"><div class="ra-procsum"><div class="ra-name"><span class="ra-ln" style="display:inline-block;width:18px;border-top:2px ${isEstimated ? 'dotted' : 'dashed'} ${color}"></span>${t}${esc(relic.name)}</div>
<div title="Average damage of one proc, each with its own cut, at the player’s duration, typed in or from the log">avg ${average === null ? '?' : `${t}${fmt(Math.round(average))}`} per proc</div>
${full > 0 ? `<div class="${cutProcs ? 'ra-cut' : 'ra-other'}" title="Share of the condition stack duration of these procs lost to stacks cut short: cleansed, the foe dying or despawning, or the log ending">${cutProcs ? `✂ ${cutProcs} cut short, ${(100 * (1 - kept / full)).toFixed(1)}% condition wasted${lost ? `, ${t}${fmt(Math.round(lost))} damage lost` : ''}` : 'none cut short'}</div>` : ''}</div>
<div class="ra-procbtns">${times.map((time, i) => { const isCut = cuts[i].some(({ full, kept }) => kept < full), total = damages[i].total;
        return `<button class="pl-btn${isCut ? ' ra-pcut' : isEstimated ? ' ra-pest' : ''}" data-a="proc" data-r="${ri}" data-l="${li}" data-i="${i}">${isCut ? '✂ ' : ''}${formatTime(time)}<small>${total === null ? '?' : `${t}${fmt(Math.round(total))}`}</small></button>`; }).join('')}</div></div>`;
    }).join('');
    const condTable = `<div class="tw"><table class="ra-table ra-conds"><thead><tr><th>Condition</th><th class="ra-r">Stacks applied</th><th class="ra-r">Avg applied duration</th><th class="ra-r">Avg time on foe</th><th class="ra-r">Time on foe kept</th><th class="ra-r">Damage</th><th class="ra-r">Damage per stack-second</th></tr></thead><tbody>${M.shownConditions.map(({ buffId, name }) => {
      const { applied, damage, stacks, uptime } = player.conditions.find(summary => summary.buffId === buffId);
      return `<tr><td><span class="ra-sw" style="background:${condColor(buffId)}"></span>${name}</td><td class="ra-r">${fmt(stacks)}</td><td class="ra-r">${(applied / stacks / 1000).toFixed(2)}s</td><td class="ra-r">${(uptime / stacks / 1000).toFixed(2)}s</td><td class="ra-r">${(100 * uptime / applied).toFixed(1)}%</td><td class="ra-r">${fmt(damage)}</td><td class="ra-r">${uptime ? fmt(Math.round(1000 * damage / uptime)) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
    return `<div class="ra-tl"><h4>Condition timeline</h4>${players}
<div class="ra-btns" style="margin:0"><button class="pl-btn" data-a="unzoom" data-r="${ri}"${ui.zoom ? '' : ' disabled'}>Reset zoom</button><span class="ra-hint">Drag over the chart to zoom</span></div>
${legend}<div class="ra-chart" data-r="${ri}"></div>${M.procLists.length ? `<div class="ra-procs">${lists}</div>` : ''}${condTable}</div>`;
  }

  // Step chart of the stacks, drawn in SVG at the chart's width; ui.sel is the range being dragged over to zoom on
  const niceStep = (span, maxTicks, steps) => steps.find(s => span / s <= maxTicks) ?? steps.at(-1);
  function drawChart(el) {
    const result = results[+el.dataset.r], M = timelineModel(result), ui = result.ui;
    const w = Math.max(320, el.clientWidth), h = 320, m = { l: 40, r: 32, t: 12, b: 26 }, pw = w - m.l - m.r, ph = h - m.t - m.b;
    const [x0, x1] = ui.zoom ?? [M.firstTime, M.lastTime];
    // Only the shown points, so the stacks axis fits the zoomed range
    const pts = ui.zoom ? M.player.timeline.filter(({ time }) => time >= x0 && time <= x1) : M.player.timeline;
    const yMaxData = Math.max(1, ...pts.flatMap(p => M.shownConditions.map(({ name }) => p[name])));
    const yStep = niceStep(yMaxData, 5, [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]), yMax = Math.ceil(yMaxData / yStep) * yStep;
    const X = t => m.l + (x1 > x0 ? (t - x0) / (x1 - x0) : 0) * pw, Y = v => m.t + ph - v / yMax * ph;
    const xStep = niceStep(x1 - x0, Math.max(2, Math.floor(pw / 80)), [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800]);
    let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Condition stacks over time"><defs><clipPath id="ra-clip${el.dataset.r}"><rect x="${m.l}" y="0" width="${pw}" height="${h}"/></clipPath></defs>`;
    for (let v = 0; v <= yMax; v += yStep) s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    for (let t = Math.ceil(x0 / xStep) * xStep; t <= x1 + 1e-9; t += xStep) s += `<text x="${X(t)}" y="${h - 8}" text-anchor="middle">${formatTime(t)}</text>`;
    s += `<g clip-path="url(#ra-clip${el.dataset.r})">`;
    M.procTimes.filter(({ time }) => time >= x0 && time <= x1).forEach(({ time }) => { s += `<line x1="${X(time)}" x2="${X(time)}" y1="${m.t}" y2="${m.t + ph}" stroke="${OWN_COLOR}" stroke-dasharray="4 4"/>`; });
    M.estimates.forEach(({ color, procTimes }) => procTimes.filter(time => time >= x0 && time <= x1).forEach(time => { s += `<line x1="${X(time)}" x2="${X(time)}" y1="${m.t}" y2="${m.t + ph}" stroke="${color}" stroke-dasharray="1 3" stroke-width="1.5"/>`; }));
    M.shownConditions.forEach(({ buffId, name }) => { if (!pts.length) return;
      let d = `M${X(pts[0].time).toFixed(1)} ${Y(pts[0][name]).toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) d += `H${X(pts[i].time).toFixed(1)}V${Y(pts[i][name]).toFixed(1)}`;
      s += `<path d="${d}" fill="none" stroke="${condColor(buffId)}" stroke-width="2" stroke-linejoin="round"/>`; });
    if (ui.sel) s += `<rect x="${Math.min(X(ui.sel[0]), X(ui.sel[1]))}" y="${m.t}" width="${Math.abs(X(ui.sel[1]) - X(ui.sel[0]))}" height="${ph}" fill="var(--mute)" fill-opacity=".15"/>`;
    s += `</g><line class="ra-cross" y1="${m.t}" y2="${m.t + ph}" stroke="var(--mute)" visibility="hidden"/><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/></svg><div class="ra-tip" hidden></div>`;
    el.innerHTML = s;
    // Pointer → nearest shown point's time, like the original chart's active label
    const svg = el.querySelector('svg'), cross = el.querySelector('.ra-cross'), tip = el.querySelector('.ra-tip');
    const pointAt = ev => { const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * w / r.width; if (px < m.l || px > m.l + pw || !pts.length) return null;
      const t = x0 + (px - m.l) / pw * (x1 - x0); let lo = 0, hi = pts.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].time < t) lo = mid + 1; else hi = mid; }
      return lo > 0 && t - pts[lo - 1].time < pts[lo].time - t ? pts[lo - 1] : pts[lo]; };
    svg.addEventListener('mousedown', ev => { const p = pointAt(ev); if (p) { ui.sel = [p.time, p.time]; ev.preventDefault(); } });
    svg.addEventListener('mousemove', ev => { const p = pointAt(ev);
      if (!p) { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; return; }
      if (ui.sel && ui.sel[1] !== p.time) { ui.sel = [ui.sel[0], p.time]; drawChart(el); el.querySelector('svg').dispatchEvent(new MouseEvent('mousemove', ev)); return; }
      cross.setAttribute('x1', X(p.time)); cross.setAttribute('x2', X(p.time)); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = `<div><b style="margin:0;padding:0">${formatTime(p.time)}</b></div>` + M.shownConditions.map(({ buffId, name }) => `<div><span class="ra-sw" style="background:${condColor(buffId)}"></span>${name}<b>${p[name]}</b></div>`).join('');
      tip.hidden = false; const r = svg.getBoundingClientRect(), left = X(p.time) * r.width / w;
      tip.style.left = (left + 12 + tip.offsetWidth > r.width ? left - 12 - tip.offsetWidth : left + 12) + 'px'; tip.style.top = (m.t + 4) + 'px'; });
    svg.addEventListener('mouseup', () => { const sel = ui.sel; ui.sel = null;
      if (sel && sel[0] !== sel[1]) { ui.zoom = [Math.min(...sel), Math.max(...sel)]; renderLog(+el.dataset.r); } else drawChart(el); });
    svg.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; if (ui.sel) { ui.sel = null; drawChart(el); } });
  }

  // Where the players and the foes they hit stood at a proc, drawn like a frame of Elite Insights' combat replay, without the arena
  function replayFrame(bounds, color, frame) {
    // Map units of empty space around the fight's area
    const PADDING = 200, SIZE = 240;
    // Square, so distances look the same both ways, centered on the fight's area
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) + 2 * PADDING;
    const centerX = (bounds.minX + bounds.maxX) / 2, centerY = (bounds.minY + bounds.maxY) / 2, scale = SIZE / span;
    const toX = x => SIZE / 2 + (x - centerX) * scale;
    // Map y points north, screen y down
    const toY = y => SIZE / 2 - (y - centerY) * scale;
    const self = frame.players.find(({ isSelf }) => isSelf);
    return `<svg width="${SIZE}" height="${SIZE}">${frame.foes.map(({ isDamageable, isHit, isTarget, x, y }) => `<circle cx="${toX(x)}" cy="${toY(y)}" r="${isTarget ? 7 : 4}" fill="${isDamageable ? 'var(--rej)' : 'var(--mute)'}" stroke="${isHit ? color : 'none'}" stroke-width="3"/>`).join('')}
${frame.players.filter(({ isSelf }) => !isSelf).map(({ x, y }) => `<circle cx="${toX(x)}" cy="${toY(y)}" r="3" fill="var(--open)"/>`).join('')}${self ? `<circle cx="${toX(self.x)}" cy="${toY(self.y)}" r="5" fill="var(--ink)" stroke="var(--bg)" stroke-width="1.5"/>` : ''}</svg>
<div class="ra-key"><span style="color:var(--ink)">●</span> player <span style="color:var(--open)">●</span> squad <span style="color:var(--rej)">●</span> foes, big for the target <span style="color:var(--mute)">●</span> can't take damage <span style="color:${color}">◯</span> hit</div>`;
  }
  function showPop(ev, r, l, i) {
    const result = results[r], M = timelineModel(result), { color, frame, lines } = procLines(M, M.procLists[l], i);
    pop.innerHTML = `<div>${esc(lines.join('\n'))}</div>${frame && result.replayBounds ? replayFrame(result.replayBounds, color, frame) : ''}`;
    pop.hidden = false;
    // Beside the mouse, flipped to its left or above it near the window's right or bottom edge
    pop.style.left = (ev.clientX + 16 + POPUP_WIDTH > window.innerWidth ? Math.max(0, ev.clientX - 16 - POPUP_WIDTH) : ev.clientX + 16) + 'px';
    if (ev.clientY > window.innerHeight / 2) { pop.style.top = ''; pop.style.bottom = (window.innerHeight - ev.clientY + 16) + 'px'; } else { pop.style.bottom = ''; pop.style.top = (ev.clientY + 16) + 'px'; }
  }

  // ---------- page ----------
  const logHtml = (result, ri) => `<article class="ra-log" data-r="${ri}"><header><h3>${esc(result.fightName ?? result.fileName)}</h3><span class="ra-file">${esc(result.fileName)}</span></header>` +
    (result.players ? procsTable(result) + timelineHtml(result, ri) : `<div class="ra-err">${esc(result.error)}</div>`) + '</article>';
  function renderLog(ri) {
    const el = root.querySelector(`.ra-log[data-r="${ri}"]`); if (!el) return;
    // Keep typing in a duration input across the re-render
    const a = document.activeElement, k = a && a.dataset && a.dataset.k, raw = k && a.value, pos = k && a.selectionStart;
    el.outerHTML = logHtml(results[ri], ri);
    root.querySelectorAll(`.ra-log[data-r="${ri}"] .ra-chart`).forEach(drawChart);
    if (k) { const n = [...root.querySelectorAll('.ra-dur input')].find(x => x.dataset.k === k); if (n) { n.value = raw; n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }
  }
  function render() {
    root.innerHTML = `<div class="ra-wrap"><div class="ra-head"><h2>Relic analyzer</h2><p>Relic procs of every player in a log and the damage they dealt, next to the procs and damage the other relics would have had in the same fight. Works on any arcdps log (.evtc / .zevtc), not only Vloxx.</p>
<p>Logs are parsed in your browser and never uploaded, everything comes from the log, with PvE relic values, the wiki damage formulas, GW2 API specialization and skill data, and a few hardcoded condition durations.</p></div>
<details class="ra-how"${howOpen ? ' open' : ''}><summary>How it works</summary><div class="ra-btns">${HOW.map(([title], i) => `<button class="pl-btn${i === howTab ? ' on' : ''}" data-a="how" data-i="${i}">${title}</button>`).join('')}</div><div class="ra-howtxt">${HOW[howTab][1]()}</div></details>
<input type="file" accept=".evtc,.zevtc" multiple class="ra-file-in" hidden>
<div class="ra-btns"><button class="pl-btn" data-a="add"${isLoaded ? '' : ' disabled'}>${isLoaded ? 'Add logs' : 'Parsing…'}</button>${results.length ? `<button class="pl-btn" data-a="clear"${isLoaded ? '' : ' disabled'}>Clear logs</button>` : ''}</div>
<div class="ra-logs">${results.map(logHtml).join('')}</div></div>`;
    root.querySelectorAll('.ra-chart').forEach(drawChart);
  }
  async function addFiles(files) {
    if (!files.length || !isLoaded) return;
    isLoaded = false; render();
    const newResults = await Promise.all(files.map(async file => {
      try { return { ...await L.countRelicProcs(file), fileName: file.name, ui: {} }; }
      catch (e) { return { error: e instanceof Error ? e.message : String(e), fileName: file.name, ui: {} }; }
    }));
    results = [...results.filter(result => !newResults.some(newResult => newResult.fileName === result.fileName)), ...newResults].sort((a, b) => a.fileName.localeCompare(b.fileName));
    isLoaded = true; render();
  }
  function boot() {
    if (!root) root = document.getElementById('relics-root');
    if (booted) { root.querySelectorAll('.ra-chart').forEach(drawChart); return; }
    booted = true;
    pop = document.createElement('div'); pop.className = 'ra-pop'; pop.hidden = true; document.body.appendChild(pop);
    root.addEventListener('click', ev => {
      const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return;
      const r = +b.dataset.r, result = results[r];
      switch (b.dataset.a) {
        case 'add': root.querySelector('.ra-file-in').click(); break;
        case 'clear': customDurations = {}; results = []; render(); break;
        case 'how': howTab = +b.dataset.i; render(); break;
        case 'player': result.ui.account = b.dataset.acc; renderLog(r); break;
        case 'unzoom': result.ui.zoom = null; renderLog(r); break;
        case 'proc': { const M = timelineModel(result), time = M.procLists[+b.dataset.l].times[+b.dataset.i];
          pop.hidden = true; result.ui.zoom = [Math.max(M.firstTime, time - PROC_ZOOM), Math.min(M.lastTime, time + PROC_ZOOM)]; renderLog(r); break; }
      }
    });
    root.addEventListener('toggle', ev => { if (ev.target.classList.contains('ra-how')) howOpen = ev.target.open; }, true);
    root.addEventListener('change', ev => { if (ev.target.classList.contains('ra-file-in')) { const files = [...ev.target.files || []]; ev.target.value = ''; addFiles(files); } });
    root.addEventListener('input', ev => {
      const k = ev.target.dataset && ev.target.dataset.k; if (!k) return;
      const value = ev.target.value.trim(), bonus = value === '' ? null : Math.min(100, Math.max(0, Number(value)));
      const multiplier = bonus === null || Number.isNaN(bonus) ? null : 1 + bonus / 100;
      const { [k]: _, ...others } = customDurations;
      customDurations = multiplier === null ? others : { ...others, [k]: multiplier };
      renderLog(+ev.target.closest('.ra-log').dataset.r);
    });
    const procAt = ev => ev.target.closest && ev.target.closest('[data-a=proc]');
    root.addEventListener('mousemove', ev => { const b = procAt(ev); if (b) showPop(ev, +b.dataset.r, +b.dataset.l, +b.dataset.i); else if (!pop.hidden) pop.hidden = true; });
    // Hidden as soon as the pointer leaves the proc, and when the page scrolls or loses focus, which move the proc from under it
    root.addEventListener('mouseout', ev => { const b = procAt(ev); if (b && !b.contains(ev.relatedTarget)) pop.hidden = true; });
    root.addEventListener('mouseleave', () => { pop.hidden = true; });
    window.addEventListener('scroll', () => { pop.hidden = true; }, { passive: true, capture: true });
    window.addEventListener('blur', () => { pop.hidden = true; });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (root.classList.contains('on')) root.querySelectorAll('.ra-chart').forEach(drawChart); }, 150); });
    render();
  }
  window.VloxxRelics = { boot };
})();
