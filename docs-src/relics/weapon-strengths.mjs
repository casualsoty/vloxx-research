// Relic analyzer logic, from the TypeScript original with only the types removed. Inlined into docs/index.html by scripts/build_docs.js
// Level 80 weapon strength midpoints, https://wiki.guildwars2.com/wiki/Weapon_Strength
// Weapons, bundles and profession mechanics scale with the weapon's rarity, the log does not show it so ascended is used
// Kits, conjures and most other bundles
export const BUNDLE_WEAPON_STRENGTH = 968.5;
// Profession mechanics use a hammer's
export const PROFESSION_WEAPON_STRENGTH = 1100;
// Heal, utility and elite skills, trait skills and equipment skills like relics
export const UNEQUIPPED_WEAPON_STRENGTH = 690.5;
// Keyed by GW2 API weapon_type
export const weaponStrengths = {
    Axe: 1000,
    Dagger: 1000,
    Focus: 900,
    Greatsword: 1100,
    Hammer: 1100,
    // Underwater spear
    Harpoon: 1000,
    Longbow: 1050,
    Mace: 1000,
    Pistol: 1000,
    Rifle: 1150,
    Scepter: 1000,
    Shield: 900,
    Shortbow: 1000,
    // Land spear
    Spear: 1000,
    Speargun: 1000,
    Staff: 1100,
    Sword: 1000,
    Torch: 900,
    Trident: 1000,
    Warhorn: 900,
};
