// Relic analyzer logic, from the TypeScript original with only the types removed. Inlined into docs/index.html by scripts/build_docs.js
import parseEvtc, { EVTC_BUILD_STATE_CHANGE_REWORK } from './parse-evtc.mjs';
import relics, { conditions } from './relics.mjs';
import { BUNDLE_WEAPON_STRENGTH, PROFESSION_WEAPON_STRENGTH, UNEQUIPPED_WEAPON_STRENGTH, weaponStrengths, } from './weapon-strengths.mjs';
import { conditionDurationDefaults } from './condition-duration-defaults.mjs';
export const BUFF_REMOVE_ALL = 1;
export const BUFF_REMOVE_SINGLE = 2;
export const PROFESSIONS = ['', 'Guardian', 'Warrior', 'Engineer', 'Ranger', 'Thief', 'Elementalist', 'Mesmer', 'Necromancer', 'Revenant'];
export const STATE_CHANGE_BUFF_APPLY = 69;
export const STATE_CHANGE_BUFF_REMOVE_SINGLE = 71;
export const STATE_CHANGE_BUFF_REMOVE_ALL = 72;
export const STATE_CHANGE_DEAD = 4;
export const STATE_CHANGE_DESPAWN = 7;
export const STATE_CHANGE_POSITION = 19;
export const TIMELINE_STEP = 500;
// Base durations are multiples of this, so applied durations divided by the right multiplier land on it
export const BASE_DURATION_UNIT = 250;
// A stack removed this long before its expiry was cut short, not expiring
export const CUT_TOLERANCE = 100;
// A foe can take damage at a time if a player damaged it this close to it, in ms, a bit more than a condition tick
export const DAMAGEABLE_WINDOW = 2000;
// Same timings as Elite Insights' instant cast finders
export const INSTANT_CAST_ICD = 50;
export const SERVER_DELAY = 10;
// Condition Damage range the estimate is kept in, from none to about the most a PvE build reaches with full might
export const MAX_CONDITION_DAMAGE = 3000;
// Condition duration bonuses are capped at +100%
export const MAX_DURATION_MULTIPLIER = 2;
// Interrupt, killing blow, downed, breakbar, activation, crowd control
export const NON_DAMAGE_RESULTS = new Set([5, 8, 9, 10, 11, 12]);
export const apiSkills = new Map();
export let specializationsPromise = null;
export const countProcs = ({ finder, procConditions }, player, { buffApplies, buffRemoveAlls, damages }) => {
    switch (finder.type) {
        case 'buff-burst': {
            const triggers = buffApplies.get(finder.triggerBuffId)?.get(player) ?? [];
            const procs = keepWithCooldown(triggers.filter(trigger => procConditions.every(procCondition => getProcDuration((buffApplies.get(procCondition.buffId)?.get(player) ?? [])
                .filter(apply => isSameHit(apply, trigger))
                .map(({ value }) => value), procCondition) !== undefined)), finder.cooldown);
            return {
                applies: procs.flatMap(({ target, time }) => procConditions.map(({ buffId, stacks }) => ({ buffId, stacks, target, time }))),
                procs,
            };
        }
        case 'damage': {
            const hits = damages.get(finder.skillId)?.get(player) ?? [];
            const { whenBuffRemoved } = finder;
            const removals = whenBuffRemoved
                ? (buffRemoveAlls.get(whenBuffRemoved.buffId)?.get(player) ?? [])
                    .filter(({ value }) => value === whenBuffRemoved.stacks)
                : [];
            return {
                // Buffs applied by the hit are logged under the buff, not under the relic
                applies: [],
                procs: keepWithIcd(hits
                    // The hit lands up to a few ticks after the buff is removed, 15 ms seen in logs, where Elite Insights only allows 10 ms
                    .filter(hit => !whenBuffRemoved || removals.some(removal => hit.time - removal.time > -SERVER_DELAY && hit.time - removal.time < INSTANT_CAST_ICD))),
            };
        }
    }
};
export const estimateProcs = (estimator, recharge, player, { buffApplies, buffTimelines }, ownApplies, getAreaFoes, isTarget) => {
    switch (estimator.type) {
        case 'stacks': {
            // Stacks applied per hit, without those the player's current relic applied itself
            const ownStacks = ownApplies
                .filter(({ buffId }) => buffId === estimator.buffId)
                .map(apply => ({ ...apply }));
            const hits = groupByHit(buffApplies.get(estimator.buffId)?.get(player) ?? [])
                .sort((a, b) => a.time - b.time);
            for (const hit of hits) {
                for (const own of ownStacks.filter(own => own.stacks && isSameHit(own, hit))) {
                    const removed = Math.min(own.stacks, hit.stacks);
                    own.stacks -= removed;
                    hit.stacks -= removed;
                }
            }
            let cooldownEnd = -Infinity;
            let lastStack = -Infinity;
            const procs = [];
            let stacks = 0;
            const proc = (hit) => {
                const { time } = hit;
                // One hit applying the condition to several foes triggers it on one of them, the log does not tell which: the fight's target if among them
                const target = estimator.area
                    ? hits.find(other => other.stacks > 0 && Math.abs(other.time - time) < SERVER_DELAY && isTarget(other.target))?.target ?? hit.target
                    : hit.target;
                procs.push({ target, targets: estimator.area ? getAreaFoes(target, time, estimator.area) : [target], time });
                stacks = 0;
                cooldownEnd = time + recharge;
            };
            for (const hit of hits.filter(({ stacks }) => stacks > 0)) {
                if (hit.time < cooldownEnd)
                    continue;
                if (stacks === estimator.maxStacks) {
                    proc(hit);
                    continue;
                }
                if (hit.time - lastStack < estimator.stackIcd)
                    continue;
                stacks++;
                lastStack = hit.time;
                if (stacks === estimator.maxStacks && hit.stacks > 1)
                    proc(hit);
            }
            return procs;
        }
        case 'target-stacks': {
            const stacks = new Map();
            const triggers = [];
            for (const event of buffTimelines.get(estimator.buffId) ?? []) {
                const current = stacks.get(event.target) ?? 0;
                switch (event.kind) {
                    case 'apply':
                        if (event.source === player && current >= estimator.minStacks)
                            triggers.push({ target: event.target, time: event.time });
                        stacks.set(event.target, current + 1);
                        break;
                    case 'clear':
                        stacks.delete(event.target);
                        break;
                    case 'remove':
                        stacks.set(event.target, Math.max(0, current - 1));
                        break;
                }
            }
            return keepWithCooldown(triggers, recharge);
        }
    }
};
// The duration multiplier turning the most applied durations back into round base durations.
// Durations that are already round fit several multipliers, e.g. ×1 and ×2 for 8s and 16s,
// the largest is kept since a round duration is more likely a capped one
export const fitDurationMultiplier = (durations) => {
    if (durations.length < 10 || new Set(durations).size < 3)
        return null;
    const scores = Array.from({ length: 1000 * (MAX_DURATION_MULTIPLIER - 1) + 1 }, (_, i) => {
        const multiplier = 1 + i / 1000;
        const fitting = durations.filter(duration => {
            const base = duration / multiplier;
            const units = Math.round(base / BASE_DURATION_UNIT);
            return units > 0 && Math.abs(base - units * BASE_DURATION_UNIT) <= 2;
        }).length;
        return { multiplier, score: fitting / durations.length };
    });
    const best = Math.max(...scores.map(({ score }) => score));
    if (best < 0.8)
        return null;
    return Math.max(...scores.filter(({ score }) => score >= best - 0.05).map(({ multiplier }) => multiplier));
};
// Average damage of one proc's stacks of a condition, on the target and on other foes
export const getConditionPartValue = (part, multiplier) => {
    if (part.rate === null)
        return null;
    // Without procs, one proc on the target lasting its full duration
    if (!part.foes.length)
        return { cleave: 0, target: getFoeConditionDamage(part, multiplier, { available: Infinity, isTarget: true }) };
    const total = { cleave: 0, target: 0 };
    for (const foe of part.foes.flat())
        total[foe.isTarget ? 'target' : 'cleave'] += getFoeConditionDamage(part, multiplier, foe);
    return { cleave: total.cleave / part.foes.length, target: total.target / part.foes.length };
};
// Condition Damage and damage multiplier fitting the player's two most used conditions to the wiki formulas,
// assuming their damage multipliers apply to every condition alike
export const getConditionProfile = (rates) => {
    const [a, b] = [...rates]
        .sort(([, x], [, y]) => y.uptime - x.uptime)
        .map(([buffId, { rate }]) => ({ formula: conditions.find(condition => condition.buffId === buffId).formula, rate }));
    if (!a || !b)
        return null;
    // a.rate / b.rate = (a.base + a.factor × cd) / (b.base + b.factor × cd)
    const ratio = a.rate / b.rate;
    const conditionDamage = Math.min(MAX_CONDITION_DAMAGE, Math.max(0, (a.formula.base - ratio * b.formula.base) / (ratio * b.formula.factor - a.formula.factor))) || 0;
    return {
        conditionDamage,
        // Rates are per ms, formulas per second
        multiplier: 1000 * a.rate / (a.formula.base + a.formula.factor * conditionDamage),
    };
};
export const getDamage = (event, isReworked) => {
    if (event.isStateChange !== 0 || NON_DAMAGE_RESULTS.has(event.result))
        return null;
    if (!isReworked && (event.isActivation || event.isBuffRemove))
        return null;
    if (event.buff === 0)
        return event.value;
    // Before the rework, buff applications shared the combat state change with a non-zero value
    if (!isReworked && event.value !== 0)
        return null;
    return event.buffDmg;
};
// How much longer than their base duration the player's conditions last:
// read from the relic stacks of their procs, else from their applications matched to the skill applying them,
// else fitted to their applications of that condition, else their specialization's hardcoded default,
// else the smallest of their other conditions, since specific duration bonuses only add to the general one
export const getDurationMultipliers = (detected, player, profession, { buffApplies }, hits) => {
    const fromProcs = new Map();
    for (const { procs, relic } of detected) {
        for (const procCondition of relic.procConditions) {
            const { baseDuration, buffId } = procCondition;
            const applies = buffApplies.get(buffId)?.get(player) ?? [];
            for (const proc of procs) {
                const duration = getProcDuration(applies.filter(apply => isSameHit(apply, proc)).map(({ value }) => value), procCondition);
                if (duration)
                    fromProcs.set(buffId, [...fromProcs.get(buffId) ?? [], duration / baseDuration]);
            }
        }
    }
    const multipliers = new Map();
    for (const { buffId, name, status = name } of conditions) {
        const applies = buffApplies.get(buffId)?.get(player) ?? [];
        const procValues = fromProcs.get(buffId);
        const fromSkills = procValues
            ? null
            : getSkillDurationMultiplier(applies, hits, status);
        const fitted = procValues || fromSkills
            ? null
            : fitDurationMultiplier(applies.map(({ value }) => value));
        if (procValues)
            multipliers.set(buffId, { multiplier: Math.min(MAX_DURATION_MULTIPLIER, median(procValues)), source: 'procs' });
        else if (fromSkills)
            multipliers.set(buffId, { multiplier: fromSkills, source: 'skills' });
        else if (fitted)
            multipliers.set(buffId, { multiplier: fitted, source: 'fit' });
    }
    // Only durations from the log bound the others
    const known = [...multipliers.values()].map(({ multiplier }) => multiplier);
    for (const [buffId, multiplier] of Object.entries(conditionDurationDefaults[profession] ?? {})) {
        if (!multipliers.has(Number(buffId)))
            multipliers.set(Number(buffId), { multiplier, source: 'default' });
    }
    if (known.length) {
        for (const { buffId } of conditions) {
            if (!multipliers.has(buffId))
                multipliers.set(buffId, { multiplier: Math.min(...known), source: 'other' });
        }
    }
    return multipliers;
};
export const getEstimatorIds = (estimator) => {
    switch (estimator.type) {
        case 'stacks':
        case 'target-stacks':
            return [estimator.buffId];
    }
};
export const getFinderIds = ({ finder, procConditions }) => {
    switch (finder.type) {
        case 'buff-burst':
            return [finder.triggerBuffId, ...procConditions.map(({ buffId }) => buffId)];
        case 'damage':
            return [finder.skillId, ...finder.whenBuffRemoved ? [finder.whenBuffRemoved.buffId] : []];
    }
};
// Damage of one proc's stacks of a condition on one foe: they last their duration, or until cut short there
export const getFoeConditionDamage = ({ baseDuration, rate, stacks }, multiplier, { available }) => Math.min(available, baseDuration * multiplier) * rate * stacks;
// Damage per ms of one stack actually on a foe, so stacks cut short do not dilute it
export const getMeasuredRates = (player, conditionStats) => new Map(conditions.flatMap(({ buffId }) => {
    const stats = conditionStats.get(buffId)?.get(player);
    return stats?.uptime
        ? [[buffId, { rate: stats.damage / stats.uptime, uptime: stats.uptime }]]
        : [];
}));
// Damage per point of coefficient × weapon strength, the rest of the strike formula
// (power, damage multipliers, crits, the foes' armor), as the hit-weighted median over the player's skills
// with a single damage coefficient in the API
export const getPowerProfile = (player, strikeStats) => {
    const samples = [...strikeStats.get(player) ?? []].flatMap(([id, { damage, hits }]) => {
        const skill = apiSkills.get(id);
        const coefficients = skill?.facts?.filter(fact => fact.type === 'Damage' && fact.dmg_multiplier) ?? [];
        const weaponStrength = skill && getWeaponStrength(skill);
        return coefficients.length === 1 && weaponStrength
            ? [{ hits, ratio: damage / hits / (coefficients[0].dmg_multiplier * weaponStrength) }]
            : [];
    });
    const hits = samples.reduce((total, sample) => total + sample.hits, 0);
    if (samples.length < 2 || hits < 10)
        return null;
    let counted = 0;
    const ratio = samples
        .sort((a, b) => a.ratio - b.ratio)
        .find(sample => (counted += sample.hits) >= hits / 2).ratio;
    return { ratio, skills: samples.length };
};
// Procs are the player's actual ones for a relic they used, with its strike damage, else the estimated ones
export const getProcDamage = (relic, player, procs, own, conditionStats, powerProfile, getAvailableDuration, isTarget) => {
    const rates = getMeasuredRates(player, conditionStats);
    const profile = getConditionProfile(rates);
    const conditionParts = relic.procConditions.map(({ baseDuration, buffId, stacks }) => {
        const condition = conditions.find(condition => condition.buffId === buffId);
        const measured = rates.get(buffId)?.rate;
        const rate = measured ?? (profile
            ? profile.multiplier * (condition.formula.base + condition.formula.factor * profile.conditionDamage) / 1000
            : undefined);
        return {
            buffId,
            kind: 'condition',
            name: condition.name,
            ...measured === undefined && {
                note: rate === undefined
                    ? `the player applied no ${condition.name.toLowerCase()} and not enough other conditions to fit the wiki formulas to`
                    : `damage per stack from the wiki formula, with ~${Math.round(profile.conditionDamage).toLocaleString()} Condition Damage and ×${profile.multiplier.toFixed(2)} damage fitted to the player's other conditions`,
            },
            baseDuration,
            foes: procs.map(({ target, targets = [target], time }) => targets.map(foe => ({
                available: getAvailableDuration(foe, time, buffId),
                isTarget: isTarget(foe),
            }))),
            rate: rate ?? null,
            stacks,
        };
    });
    // The player's own strikes go to the proc they belong to, the last one starting before them
    const ownPerProc = procs.map(() => ({ cleave: 0, target: 0 }));
    for (const { target, time, value } of own?.strikeHits ?? []) {
        const proc = procs.findLastIndex(proc => proc.time <= time + SERVER_DELAY);
        if (proc !== -1)
            ownPerProc[proc][isTarget(target) ? 'target' : 'cleave'] += value;
    }
    // Estimated strikes hit every foe the proc landed on, one hit each
    const strikeHit = relic.strikeCoefficient && powerProfile
        ? relic.strikeCoefficient * UNEQUIPPED_WEAPON_STRENGTH * powerProfile.ratio
        : 0;
    const estimatedPerProc = procs.map(({ target, targets = [target] }) => ({
        cleave: targets.filter(foe => !isTarget(foe)).length * strikeHit,
        target: targets.filter(isTarget).length * strikeHit,
    }));
    const average = (perProc) => ({
        cleave: perProc.reduce((total, { cleave }) => total + cleave, 0) / perProc.length,
        target: perProc.reduce((total, { target }) => total + target, 0) / perProc.length,
    });
    return {
        parts: [
            // Measured from the player's own procs, else estimated for one hit on each foe
            ...relic.strikeSkillIds.length
                ? [own && procs.length
                        ? {
                            kind: 'power',
                            perProc: ownPerProc,
                            value: { cleave: own.strikeDamage.cleave / procs.length, target: own.strikeDamage.target / procs.length },
                        }
                        : relic.strikeCoefficient && powerProfile
                            ? {
                                kind: 'power',
                                note: `one hit on each foe the proc landed on: the wiki's ${relic.strikeCoefficient} coefficient × ${UNEQUIPPED_WEAPON_STRENGTH} unequipped weapon strength × ${powerProfile.ratio.toFixed(2)} damage per coefficient and weapon strength point, fitted to ${powerProfile.skills} of the player's skills assuming ascended weapons`,
                                perProc: estimatedPerProc,
                                // Without procs, one hit on the target
                                value: procs.length
                                    ? average(estimatedPerProc)
                                    : { cleave: 0, target: strikeHit },
                            }
                            : {
                                kind: 'power',
                                note: 'the player has not enough strike hits of skills with a known coefficient to fit the strike formula to',
                                value: null,
                            }]
                : [],
            ...conditionParts,
        ],
        relic,
    };
};
// The duration of a relic's stacks among the player's applications on one hit, the longest when several fit:
// stacks from one application share their duration, which is the base duration times the player's condition duration
export const getProcDuration = (durations, { baseDuration, stacks }) => [...new Set(durations)]
    .filter(duration => duration >= baseDuration - SERVER_DELAY && duration <= MAX_DURATION_MULTIPLIER * baseDuration + SERVER_DELAY)
    .filter(duration => durations.filter(other => other === duration).length >= stacks)
    .sort((a, b) => b - a)[0];
// The duration multiplier read from the player's applications of a condition whose skill is known:
// the one skill of theirs hitting that foe at the same time, whose base duration of the condition is in the API.
// Conditions from traits, sigils and runes have no such hit and are left out, as are skills with several base durations.
// Applications beyond the +100% cap come from outdated API facts, and the multiplier two thirds of the applications agree on is kept
export const getSkillDurationMultiplier = (applies, hits, status) => {
    const ratios = applies.flatMap(apply => {
        // Hits are sorted by time, the first one that could be the same hit
        let low = 0;
        let high = hits.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (hits[middle].time <= apply.time - SERVER_DELAY)
                low = middle + 1;
            else
                high = middle;
        }
        const skillIds = new Set();
        for (let i = low; i < hits.length && hits[i].time < apply.time + SERVER_DELAY; i++) {
            if (hits[i].target === apply.target)
                skillIds.add(hits[i].skillId);
        }
        if (skillIds.size !== 1)
            return [];
        const [skillId] = skillIds;
        const durations = new Set(apiSkills.get(skillId)?.facts
            ?.filter(fact => fact.type === 'Buff' && fact.status === status && fact.duration)
            .map(({ duration }) => duration));
        if (durations.size !== 1)
            return [];
        const [duration] = durations;
        const ratio = apply.value / (1000 * duration);
        return ratio >= 1 - 0.01 && ratio <= MAX_DURATION_MULTIPLIER + 0.01
            ? [ratio]
            : [];
    });
    if (ratios.length < 10)
        return null;
    // Ratios within 0.01 of each other are the same multiplier, a few ms of server delay apart
    const groups = new Map();
    for (const ratio of ratios) {
        const key = Math.round(100 * ratio);
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(ratio);
    }
    const agreeing = [...groups.values()].sort((a, b) => b.length - a.length)[0];
    // Split applications, e.g. a bonus only under some condition, do not tell the player's bonus
    if (agreeing.length < 2 * ratios.length / 3)
        return null;
    return Math.min(MAX_DURATION_MULTIPLIER, Math.max(1, median(agreeing)));
};
// Skills cached across logs, fetched 200 at a time as the API allows
export const getSkills = async (ids) => {
    const missing = ids.filter(id => !apiSkills.has(id));
    for (let i = 0; i < missing.length; i += 200) {
        const chunk = missing.slice(i, i + 200);
        try {
            const response = await fetch(`https://api.guildwars2.com/v2/skills?ids=${chunk.join(',')}`);
            const skills = await response.json();
            if (Array.isArray(skills))
                skills.forEach(skill => apiSkills.set(skill.id, skill));
            // Ids the API does not know, e.g. trait or gear effects
            chunk.filter(id => !apiSkills.has(id)).forEach(id => apiSkills.set(id, null));
        }
        catch {
            // Retried with the next log
        }
    }
};
// Elite specialization ids are GW2 API specialization ids
export const getSpecializations = () => specializationsPromise ??= fetch('https://api.guildwars2.com/v2/specializations?ids=all')
    .then(response => response.json())
    .then((specializations) => Object.fromEntries(specializations.map(({ id, name }) => [id, name])))
    .catch(() => {
    specializationsPromise = null;
    return {};
});
// Stacks the player has on all foes at every step of the fight
export const getTimeline = (player, conditionStats, firstTime, lastTime) => {
    const steps = Math.ceil((lastTime - firstTime) / TIMELINE_STEP) + 1;
    const points = Array.from({ length: steps }, (_, i) => ({ time: i * TIMELINE_STEP / 1000 }));
    for (const { buffId, name } of conditions) {
        // Stack count changes, applied on the step containing them
        const deltas = new Array(steps + 1).fill(0);
        const getStep = (time) => Math.min(steps, Math.max(0, Math.ceil((time - firstTime) / TIMELINE_STEP)));
        for (const [start, end] of conditionStats.get(buffId)?.get(player)?.lifetimes ?? []) {
            deltas[getStep(start)] += 1;
            deltas[getStep(end)] -= 1;
        }
        let stacks = 0;
        points.forEach((point, i) => {
            stacks += deltas[i];
            point[name] = stacks;
        });
    }
    return points;
};
// Weapon strength the skill's damage uses, null for skills it cannot be told for
export const getWeaponStrength = ({ slot, weapon_type }) => {
    if (slot === 'Heal' || slot === 'Utility' || slot === 'Elite')
        return UNEQUIPPED_WEAPON_STRENGTH;
    if (slot?.startsWith('Profession'))
        return PROFESSION_WEAPON_STRENGTH;
    if (slot?.startsWith('Weapon'))
        return weapon_type && weapon_type !== 'None'
            ? weaponStrengths[weapon_type] ?? null
            : BUNDLE_WEAPON_STRENGTH;
    return null;
};
// Stacks applied to each foe, grouped per tick
export const groupByHit = (applies) => [...applies.reduce((acc, { target, time }) => {
        const key = `${target}|${time}`;
        acc.set(key, { stacks: (acc.get(key)?.stacks ?? 0) + 1, target, time });
        return acc;
    }, new Map()).values()];
// Buff extensions and the buffs already present at log start are not applications
export const isBuffApply = (event, isReworked) => isReworked
    ? event.isStateChange === STATE_CHANGE_BUFF_APPLY
    : event.isStateChange === 0 && event.buff !== 0 && event.buffDmg === 0 && event.value > 0
        && event.isActivation === 0 && event.isBuffRemove === 0 && event.isOffcycle === 0;
export const isBuffRemoveAll = (event, isReworked) => isReworked
    ? event.isStateChange === STATE_CHANGE_BUFF_REMOVE_ALL
    : event.isStateChange === 0 && event.isActivation === 0 && event.isBuffRemove === BUFF_REMOVE_ALL;
// Stacks expiring are logged as single removals too, manual removals only mirror a remove all
export const isBuffRemoveSingle = (event, isReworked) => event.isBuffRemove === BUFF_REMOVE_SINGLE && (isReworked
    ? event.isStateChange === STATE_CHANGE_BUFF_REMOVE_SINGLE
    : event.isStateChange === 0 && event.isActivation === 0);
// Applications on the same foe a few ms apart come from the same hit
export const isSameHit = (a, b) => a.target === b.target && Math.abs(a.time - b.time) < SERVER_DELAY;
export const keepWithCooldown = (items, cooldown) => {
    let lastProc = -Infinity;
    return [...items]
        .sort((a, b) => a.time - b.time)
        .filter(({ time }) => {
        if (time - lastProc < cooldown)
            return false;
        lastProc = time;
        return true;
    });
};
// Keeps one proc per burst, e.g. one explosion hitting several foes, like Elite Insights, with every foe it hit
export const keepWithIcd = (hits) => {
    const procs = [];
    let lastTime = -Infinity;
    for (const { target, time } of hits) {
        if (time - lastTime >= INSTANT_CAST_ICD)
            procs.push({ target, targets: [target], time });
        else if (!procs.at(-1).targets.includes(target))
            procs.at(-1).targets.push(target);
        lastTime = time;
    }
    return procs;
};
export const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
export const push = (eventsByAgent, id, agent, timedValue) => {
    if (!eventsByAgent.has(id))
        eventsByAgent.set(id, new Map());
    const byAgent = eventsByAgent.get(id);
    if (!byAgent.has(agent))
        byAgent.set(agent, []);
    byAgent.get(agent).push(timedValue);
};
export const pushTimeline = (timelines, id, event) => {
    if (!timelines.has(id))
        timelines.set(id, []);
    timelines.get(id).push(event);
};
export default async function countRelicProcs(file) {
    const [evtc, specializations] = await Promise.all([
        parseEvtc(file),
        getSpecializations(),
    ]);
    const isReworked = evtc.build >= EVTC_BUILD_STATE_CHANGE_REWORK;
    // Players have an elite spec, NPCs and gadgets have 0xFFFFFFFF
    const players = evtc.agents.filter(agent => agent.elite !== 0xffffffff);
    const boss = evtc.agents.find(agent => agent.elite === 0xffffffff
        && agent.prof >>> 16 !== 0xffff
        && (agent.prof & 0xffff) === evtc.bossId);
    const conditionIds = new Set(conditions.map(({ buffId }) => buffId));
    const ids = new Set(relics.flatMap(relic => [
        ...relic.strikeSkillIds,
        ...getFinderIds(relic),
        ...relic.estimator ? getEstimatorIds(relic.estimator) : [],
        ...conditionIds,
    ]));
    const events = {
        buffApplies: new Map(),
        buffRemoveAlls: new Map(),
        buffTimelines: new Map(),
        damages: new Map(),
    };
    const strikes = new Map();
    const conditionStats = new Map();
    const getConditionStats = (buffId, source) => {
        if (!conditionStats.has(buffId))
            conditionStats.set(buffId, new Map());
        const bySource = conditionStats.get(buffId);
        if (!bySource.has(source))
            bySource.set(source, { applied: 0, damage: 0, lifetimes: [], stacks: 0, uptime: 0 });
        return bySource.get(source);
    };
    // Stacks on each foe by instance id, closed when removed, expired, or at log end
    const openStacks = new Map();
    const getOpenStacks = (buffId, target) => {
        if (!openStacks.has(buffId))
            openStacks.set(buffId, new Map());
        const byTarget = openStacks.get(buffId);
        if (!byTarget.has(target))
            byTarget.set(target, new Map());
        return byTarget.get(target);
    };
    // Removals can cut a stack short, a stack replaced by a new one or still open at log end only ends
    const closeStack = (buffId, target, pad, time, isRemoval) => {
        const stacks = getOpenStacks(buffId, target);
        const stack = stacks.get(pad);
        if (!stack)
            return;
        if (isRemoval && time < stack.time + stack.duration - CUT_TOLERANCE) {
            if (!stackCuts.has(buffId))
                stackCuts.set(buffId, new Map());
            const byTarget = stackCuts.get(buffId);
            byTarget.set(target, [...byTarget.get(target) ?? [], time]);
        }
        const lifetime = Math.max(0, Math.min(time - stack.time, stack.duration));
        const stats = getConditionStats(buffId, stack.source);
        stats.uptime += lifetime;
        stats.lifetimes.push([stack.time, stack.time + lifetime]);
        stacks.delete(pad);
    };
    // Events are not strictly ordered and metadata times are unrelated, so only combat and buff events bound the fight
    let firstTime = Infinity;
    let lastTime = 0;
    const playerAddresses = new Set(players.map(({ address }) => address));
    const relicSkillIds = new Set(relics.flatMap(({ strikeSkillIds }) => strikeSkillIds));
    const strikeStats = new Map();
    // Every hit of each player, sorted by time after the loop
    const skillHits = new Map();
    // Times a foe's stacks of a condition were cut short, by removal before their expiry
    const stackCuts = new Map();
    // Times an agent died or despawned, cutting all its stacks
    const agentEnds = new Map();
    // Positions of every agent, logged when they move
    const positions = new Map();
    // Foes the players hit, with the first time they showed up, by a position or a player's hit
    const foeStarts = new Map();
    // Time of each agent's last event: arcdps logs nothing more of an agent once it is gone from the game,
    // even when it left without a death or despawn, like a geyser the squad broke. Metadata events with unrelated times come from no agent
    const lastSeen = new Map();
    // Times each foe took damage from a player, to tell when it could be damaged: an invulnerable foe's hits are absorbed for 0,
    // and a foe only damageable at times, like an unsharded geyser, logs nothing the rest of the time
    const damagedTimes = new Map();
    // Every event is read, the player's strikes of all skills calibrate the power estimate
    for (const event of evtc.events(() => true)) {
        lastSeen.set(event.srcAgent, Math.max(lastSeen.get(event.srcAgent) ?? -Infinity, event.time));
        if (event.isStateChange === STATE_CHANGE_POSITION) {
            if (!positions.has(event.srcAgent))
                positions.set(event.srcAgent, []);
            positions.get(event.srcAgent).push({ time: event.time, x: event.x, y: event.y });
            continue;
        }
        const damage = getDamage(event, isReworked);
        // Normal, critical and glancing hits of the players' own skills
        if (damage !== null && damage > 0 && event.buff === 0 && event.result <= 2 && playerAddresses.has(event.srcAgent) && !relicSkillIds.has(event.skillId)) {
            if (!strikeStats.has(event.srcAgent))
                strikeStats.set(event.srcAgent, new Map());
            const bySkill = strikeStats.get(event.srcAgent);
            const stats = bySkill.get(event.skillId) ?? { damage: 0, hits: 0 };
            stats.damage += damage;
            stats.hits++;
            bySkill.set(event.skillId, stats);
        }
        if (damage !== null && playerAddresses.has(event.srcAgent) && !playerAddresses.has(event.dstAgent)) {
            foeStarts.set(event.dstAgent, Math.min(foeStarts.get(event.dstAgent) ?? Infinity, event.time));
            if (damage > 0) {
                if (!damagedTimes.has(event.dstAgent))
                    damagedTimes.set(event.dstAgent, []);
                damagedTimes.get(event.dstAgent).push(event.time);
            }
        }
        if (damage !== null && event.buff === 0 && playerAddresses.has(event.srcAgent)) {
            if (!skillHits.has(event.srcAgent))
                skillHits.set(event.srcAgent, []);
            skillHits.get(event.srcAgent).push({ skillId: event.skillId, target: event.dstAgent, time: event.time });
        }
        if (event.isStateChange === STATE_CHANGE_DEAD || event.isStateChange === STATE_CHANGE_DESPAWN) {
            agentEnds.set(event.srcAgent, [...agentEnds.get(event.srcAgent) ?? [], event.time]);
        }
        // Only the players' damage bounds the fight, so it does not depend on the tracked buffs,
        // nor stretch to boons given or the foes' conditions on players expiring after the fight
        if (damage !== null && playerAddresses.has(event.srcAgent)) {
            firstTime = Math.min(firstTime, event.time);
            lastTime = Math.max(lastTime, event.time);
        }
        if (!ids.has(event.skillId))
            continue;
        const isCondition = conditionIds.has(event.skillId);
        if (isCondition) {
            if (damage !== null && event.buff !== 0) {
                getConditionStats(event.skillId, event.srcAgent).damage += damage;
            }
            else if (isBuffApply(event, isReworked)) {
                const stats = getConditionStats(event.skillId, event.srcAgent);
                stats.applied += event.value;
                stats.stacks++;
                // Logs without instance ids count every stack for its full duration
                if (!event.pad) {
                    stats.uptime += event.value;
                    stats.lifetimes.push([event.time, event.time + event.value]);
                }
                else {
                    closeStack(event.skillId, event.dstAgent, event.pad, event.time, false);
                    getOpenStacks(event.skillId, event.dstAgent).set(event.pad, { duration: event.value, source: event.srcAgent, time: event.time });
                }
            }
            else if (isBuffRemoveSingle(event, isReworked)) {
                closeStack(event.skillId, event.srcAgent, event.pad, event.time, true);
            }
            else if (isBuffRemoveAll(event, isReworked)) {
                for (const pad of [...getOpenStacks(event.skillId, event.srcAgent).keys()]) {
                    closeStack(event.skillId, event.srcAgent, pad, event.time, true);
                }
            }
        }
        if (damage !== null) {
            const hit = { target: event.dstAgent, time: event.time, value: damage };
            push(events.damages, event.skillId, event.srcAgent, hit);
            // Condition damage is buff damage, strikes are the rest
            if (event.buff === 0)
                push(strikes, event.skillId, event.srcAgent, hit);
        }
        else if (isBuffApply(event, isReworked)) {
            // Value holds the applied duration
            push(events.buffApplies, event.skillId, event.srcAgent, { target: event.dstAgent, time: event.time, value: event.value });
            pushTimeline(events.buffTimelines, event.skillId, { kind: 'apply', source: event.srcAgent, target: event.dstAgent, time: event.time });
        }
        else if (isBuffRemoveSingle(event, isReworked)) {
            // The agent losing the buff is the source of a removal
            pushTimeline(events.buffTimelines, event.skillId, { kind: 'remove', source: event.dstAgent, target: event.srcAgent, time: event.time });
        }
        else if (isBuffRemoveAll(event, isReworked)) {
            // Result holds the removed stack count
            push(events.buffRemoveAlls, event.skillId, event.srcAgent, { target: event.srcAgent, time: event.time, value: event.result });
            pushTimeline(events.buffTimelines, event.skillId, { kind: 'clear', source: event.dstAgent, target: event.srcAgent, time: event.time });
        }
    }
    for (const [buffId, byTarget] of openStacks) {
        for (const [target, stacks] of byTarget) {
            for (const pad of [...stacks.keys()])
                closeStack(buffId, target, pad, lastTime, false);
        }
    }
    // Events are not strictly ordered
    for (const byTarget of stackCuts.values())
        byTarget.forEach(times => times.sort((a, b) => a - b));
    agentEnds.forEach(times => times.sort((a, b) => a - b));
    skillHits.forEach(hits => hits.sort((a, b) => a.time - b.time));
    positions.forEach(samples => samples.sort((a, b) => a.time - b.time));
    damagedTimes.forEach(times => times.sort((a, b) => a - b));
    for (const [foe, samples] of positions) {
        if (foeStarts.has(foe) && samples[0])
            foeStarts.set(foe, Math.min(foeStarts.get(foe), samples[0].time));
    }
    // An agent's position at a time, between the samples around it, or the nearest one before its first or after its last
    const getPosition = (agent, time) => {
        const samples = positions.get(agent);
        if (!samples?.length)
            return null;
        // Binary search of the first sample after the time, every proc looks up every agent
        let low = 0;
        let high = samples.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (samples[middle].time > time)
                high = middle;
            else
                low = middle + 1;
        }
        const next = low;
        if (next === samples.length)
            return samples.at(-1);
        if (next === 0)
            return samples[0];
        const before = samples[next - 1];
        const after = samples[next];
        const ratio = (time - before.time) / (after.time - before.time);
        return { x: before.x + ratio * (after.x - before.x), y: before.y + ratio * (after.y - before.y) };
    };
    // Foes an area proc centered on a foe lands on: that foe, then the nearest foes the players hit, alive then,
    // whose center is within the radius of its center, up to the proc's number of targets.
    // Without the center's position, only that foe
    // Whether a player damaged the foe within DAMAGEABLE_WINDOW of the time, binary searching its first damage from the window's start
    const canTakeDamage = (foe, time) => {
        const times = damagedTimes.get(foe);
        if (!times)
            return false;
        let low = 0;
        let high = times.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (times[middle] < time - DAMAGEABLE_WINDOW)
                low = middle + 1;
            else
                high = middle;
        }
        return low < times.length && times[low] <= time + DAMAGEABLE_WINDOW;
    };
    // Showed up, not dead nor despawned, and still in the log
    const isAlive = (foe, time) => foeStarts.get(foe) <= time
        && !agentEnds.get(foe)?.some(end => end <= time)
        && (lastSeen.get(foe) ?? Infinity) >= time;
    const getAreaFoes = (center, time, { maxTargets, radius }) => {
        const origin = getPosition(center, time);
        if (!origin)
            return [center];
        const nearby = [...foeStarts.keys()]
            .filter(foe => foe !== center && isAlive(foe, time) && canTakeDamage(foe, time))
            .flatMap(foe => {
            const position = getPosition(foe, time);
            const distance = position && Math.hypot(position.x - origin.x, position.y - origin.y);
            return distance !== null && distance <= radius
                ? [{ distance, foe }]
                : [];
        })
            .sort((a, b) => a.distance - b.distance);
        return [center, ...nearby.slice(0, maxTargets - 1).map(({ foe }) => foe)];
    };
    // How long a proc's stacks of a condition could stay on a foe: until the foe's stacks of that condition
    // are next cut short, by a cleanse or its death, the foe dies or despawns, or the log ends
    const getAvailableDuration = (foe, time, buffId) => Math.min(stackCuts.get(buffId)?.get(foe)?.find(cut => cut > time) ?? Infinity, agentEnds.get(foe)?.find(end => end > time) ?? Infinity, lastTime) - time;
    // The fight's target: every agent of the boss's species
    const targetAddresses = new Set(evtc.agents
        .filter(agent => agent.elite === 0xffffffff && agent.prof >>> 16 !== 0xffff && (agent.prof & 0xffff) === evtc.bossId)
        .map(({ address }) => address));
    const isTarget = (foe) => targetAddresses.has(foe);
    // Where the players and the living foes they hit stood at a proc, the player and the foes it landed on marked
    const getFrame = (player, { target, targets = [target], time }) => ({
        foes: [...foeStarts.keys()]
            .filter(foe => isAlive(foe, time))
            .flatMap(foe => {
            const position = getPosition(foe, time);
            return position
                ? [{ isDamageable: canTakeDamage(foe, time), isHit: targets.includes(foe), isTarget: isTarget(foe), x: position.x, y: position.y }]
                : [];
        }),
        players: players.flatMap(({ address }) => {
            const position = getPosition(address, time);
            return position
                ? [{ isSelf: address === player, x: position.x, y: position.y }]
                : [];
        }),
    });
    // Every position of the players and the foes they hit during the fight, so frames share one scale
    const fightPositions = [...playerAddresses, ...foeStarts.keys()]
        .flatMap(agent => positions.get(agent) ?? [])
        .filter(({ time }) => time >= firstTime && time <= lastTime);
    const replayBounds = fightPositions.length
        ? fightPositions.reduce((bounds, { x, y }) => ({
            maxX: Math.max(bounds.maxX, x),
            maxY: Math.max(bounds.maxY, y),
            minX: Math.min(bounds.minX, x),
            minY: Math.min(bounds.minY, y),
        }), { maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity })
        : null;
    await getSkills([...new Set([...skillHits.values()].flatMap(hits => hits.map(({ skillId }) => skillId)))]);
    return {
        duration: evtc.duration,
        fightName: boss?.name.split('\0')[0] ?? `Unknown (${evtc.bossId})`,
        players: players
            .flatMap((player) => {
            // Player names are "character\0:account\0subgroup\0"
            const [name = '', account = ''] = player.name.split('\0');
            const base = {
                account: account.replace(/^:/, ''),
                name,
                profession: specializations[player.elite] ?? PROFESSIONS[player.prof] ?? 'Unknown',
            };
            const detected = relics
                .map(relic => {
                const hits = relic.strikeSkillIds.flatMap(skillId => strikes.get(skillId)?.get(player.address) ?? []);
                const sum = (foeHits) => foeHits.reduce((total, { value }) => total + value, 0);
                return {
                    ...countProcs(relic, player.address, events),
                    relic,
                    strikeDamage: sum(hits),
                    strikeHits: hits,
                    strikeSplit: {
                        cleave: sum(hits.filter(({ target }) => !isTarget(target))),
                        target: sum(hits.filter(({ target }) => isTarget(target))),
                    },
                };
            })
                .filter(({ procs, strikeDamage }) => procs.length || strikeDamage);
            const durationMultipliers = getDurationMultipliers(detected, player.address, base.profession, events, skillHits.get(player.address) ?? []);
            const powerProfile = getPowerProfile(player.address, strikeStats);
            const shared = {
                conditionDurations: conditions.map(({ buffId }) => ({ buffId, duration: durationMultipliers.get(buffId) ?? null })),
                conditions: conditions.map(({ buffId }) => {
                    const { applied = 0, damage = 0, stacks = 0, uptime = 0 } = conditionStats.get(buffId)?.get(player.address) ?? {};
                    return { applied, buffId, damage, stacks, uptime };
                }),
                timeline: getTimeline(player.address, conditionStats, firstTime, lastTime),
            };
            // Estimated procs of the relics the player did not use as their row's relic, and the damage of every relic's procs:
            // their stacks last until cut short where the actual or estimated proc landed
            const getEstimates = (ownRelic, ownApplies) => {
                const estimated = relics
                    .filter(relic => relic.estimator && relic !== ownRelic)
                    .map(relic => ({
                    // Estimated procs land only on foes that could take damage then, one landing on none still counts, dealing nothing
                    hits: estimateProcs(relic.estimator, relic.recharge, player.address, events, ownApplies, getAreaFoes, isTarget)
                        .map(({ target, targets = [target], time }) => ({ target, targets: targets.filter(foe => canTakeDamage(foe, time)), time })),
                    relic,
                }));
                return {
                    estimates: estimated.map(({ hits, relic }) => ({
                        procFrames: hits.map(hit => getFrame(player.address, hit)),
                        procTimes: hits.map(({ time }) => (time - firstTime) / 1000),
                        procs: hits.length,
                        relic,
                    })),
                    procDamage: relics.map(relic => {
                        const own = detected.find(detected => detected.relic === relic);
                        const procs = own?.procs ?? estimated.find(estimate => estimate.relic === relic)?.hits ?? [];
                        return getProcDamage(relic, player.address, procs, own ? { strikeDamage: own.strikeSplit, strikeHits: own.strikeHits } : null, conditionStats, powerProfile, getAvailableDuration, isTarget);
                    }),
                };
            };
            return detected.length
                ? detected.map(({ applies, procs, relic, strikeDamage }) => ({
                    ...base,
                    ...shared,
                    ...getEstimates(relic, applies),
                    procFrames: procs.map(hit => getFrame(player.address, hit)),
                    procTimes: procs.map(({ time }) => (time - firstTime) / 1000),
                    procs: procs.length,
                    relic,
                    strikeDamage,
                }))
                : [{ ...base, ...shared, ...getEstimates(null, []), procFrames: [], procTimes: [], procs: 0, relic: null, strikeDamage: 0 }];
        })
            .sort((a, b) => b.procs - a.procs || b.strikeDamage - a.strikeDamage),
        replayBounds,
    };
}
