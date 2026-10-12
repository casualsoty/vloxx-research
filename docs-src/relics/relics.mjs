// Relic analyzer logic, from the TypeScript original with only the types removed. Inlined into docs/index.html by scripts/build_docs.js
export const conditions = [
    { buffId: 736, color: '#9467bd', formula: { base: 22, factor: 0.06 }, name: 'Bleeding' },
    { buffId: 737, color: '#d62728', formula: { base: 131, factor: 0.155 }, name: 'Burning' },
    // Damage over time only, it also hits for 16.34 + 0.0325 × Condition Damage per stack each time the foe uses a skill
    { buffId: 861, color: '#2ca02c', formula: { base: 18.25, factor: 0.05 }, name: 'Confusion' },
    { buffId: 723, color: '#ff7f0e', formula: { base: 33.5, factor: 0.06 }, name: 'Poison', status: 'Poisoned' },
    // Damage while stationary, bosses mostly are
    { buffId: 19426, color: '#1f77b4', formula: { base: 31.8, factor: 0.09 }, name: 'Torment' },
];
export default [
    {
        description: 'When you inflict bleeding on an enemy with 6 or more stacks of bleeding, also inflict burning and torment.',
        estimator: {
            // Bleeding
            buffId: 736,
            minStacks: 6,
            type: 'target-stacks',
        },
        finder: {
            cooldown: 19500,
            // Bleeding
            triggerBuffId: 736,
            type: 'buff-burst',
        },
        icon: 'https://render.guildwars2.com/file/B2D409644147BF18935A95A52505ABCB9EECE142/3122351.png',
        name: 'Relic of the Fractal',
        // https://wiki.guildwars2.com/wiki/Relic_of_the_Fractal
        procConditions: [
            // Burning
            { baseDuration: 8000, buffId: 737, stacks: 2 },
            // Torment
            { baseDuration: 8000, buffId: 19426, stacks: 3 },
        ],
        recharge: 20000,
        strikeSkillIds: [],
    },
    {
        description: "Gain stacks of Tyrant's Fury when you inflict burning on a foe. After reaching the maximum number of stacks, the next time you inflict burning causes an explosion that burns nearby foes.",
        estimator: {
            // The explosion's range and number of targets, from the wiki
            area: {
                maxTargets: 5,
                radius: 240,
            },
            // Burning
            buffId: 737,
            maxStacks: 5,
            stackIcd: 280,
            type: 'stacks',
        },
        finder: {
            skillId: 81068,
            type: 'damage',
            whenBuffRemoved: {
                buffId: 81192,
                name: "Tyrant's Fury",
                stacks: 5,
            },
        },
        icon: 'https://render.guildwars2.com/file/DC0E5B235AA36102E0A9A9D32AAB24169B2CAE59/3806032.png',
        name: 'Relic of the Last Tyrant',
        procConditions: [
            // Burning
            { baseDuration: 8000, buffId: 737, stacks: 2 },
        ],
        recharge: 12000,
        // https://wiki.guildwars2.com/wiki/Relic_of_the_Last_Tyrant
        strikeCoefficient: 3,
        strikeSkillIds: [81068],
    },
];
