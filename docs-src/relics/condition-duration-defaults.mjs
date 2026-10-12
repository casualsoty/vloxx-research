// Relic analyzer logic, from the TypeScript original with only the types removed. Inlined into docs/index.html by scripts/build_docs.js
// Condition duration multipliers of common builds, by elite specialization and condition buff id,
// used when the log does not show the player's own: they never applied the condition, or too rarely to fit it
export const conditionDurationDefaults = {
    // Condition Berserker, who applies no torment when playing Relic of the Last Tyrant
    Berserker: {
        // Torment
        19426: 1.6746,
    },
};
