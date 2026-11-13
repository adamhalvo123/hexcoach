// Validates the curated meta snapshot against the live Data Dragon / CommunityDragon data.
// Run: node scripts/validate-data.mjs [patch]
import fs from "node:fs";

const meta = JSON.parse(fs.readFileSync(new URL("../src/data/meta.json", import.meta.url), "utf8"));
const patch = process.argv[2] ?? (await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json())[0];
const base = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US`;
const [champions, items, runes] = await Promise.all([
  fetch(`${base}/champion.json`).then((r) => r.json()),
  fetch(`${base}/item.json`).then((r) => r.json()),
  fetch(`${base}/runesReforged.json`).then((r) => r.json()),
]);
const arena = await fetch("https://raw.communitydragon.org/latest/cdragon/arena/en_us.json").then((r) => r.json());

const championNames = new Set(Object.values(champions.data).map((c) => c.name));
const itemNames = new Set(
  Object.values(items.data)
    .filter((i) => i.maps?.["11"] && i.gold?.purchasable)
    .map((i) => i.name),
);
const runeNames = new Set(runes.flatMap((t) => t.slots.flatMap((s) => s.runes.map((r) => r.name))));
const treeNames = new Set(runes.map((t) => t.name));
const arenaNames = new Set(arena.augments.map((a) => a.name));

const errors = [];
for (const [name, profile] of Object.entries(meta.buildProfiles)) {
  for (const key of ["starter", "core", "situational"]) {
    for (const item of profile[key] ?? []) {
      if (!itemNames.has(item)) errors.push(`buildProfiles.${name}.${key}: missing item "${item}"`);
    }
  }
}
for (const [name, profile] of Object.entries(meta.runeProfiles)) {
  if (!treeNames.has(profile.primary)) errors.push(`runeProfiles.${name}: missing tree "${profile.primary}"`);
  if (!treeNames.has(profile.secondary)) errors.push(`runeProfiles.${name}: missing tree "${profile.secondary}"`);
  for (const rune of [profile.keystone, ...(profile.primaryPerks ?? []), ...(profile.secondaryPerks ?? [])]) {
    if (!runeNames.has(rune)) errors.push(`runeProfiles.${name}: missing rune "${rune}"`);
  }
  if (profile.shards?.length !== 3) errors.push(`runeProfiles.${name}: needs 3 shards`);
}
for (const [name, champion] of Object.entries(meta.champions)) {
  if (!championNames.has(name)) {
    errors.push(`champions: missing champion "${name}"`);
    continue;
  }
  for (const [role, entry] of Object.entries(champion.roles)) {
    if (entry.build && !meta.buildProfiles[entry.build]) errors.push(`${name}.${role}: missing build profile "${entry.build}"`);
    if (entry.rune && !meta.runeProfiles[entry.rune]) errors.push(`${name}.${role}: missing rune profile "${entry.rune}"`);
    for (const key of ["starter", "core", "situational"]) {
      for (const item of entry[key] ?? []) {
        if (!itemNames.has(item)) errors.push(`${name}.${role}.${key}: missing item "${item}"`);
      }
    }
    for (const key of ["counters", "synergies"]) {
      for (const matchup of entry[key] ?? []) {
        if (!championNames.has(matchup.champion)) {
          errors.push(`${name}.${role}.${key}: missing champion "${matchup.champion}"`);
        }
      }
    }
    if (entry.skillOrder && entry.skillOrder.length !== 3) errors.push(`${name}.${role}: skillOrder needs 3 letters`);
  }
}
for (const [tier, names] of Object.entries(meta.arena ?? {})) {
  for (const name of names) {
    if (!arenaNames.has(name)) errors.push(`arena.${tier}: missing augment "${name}"`);
  }
}

if (errors.length) {
  console.error(`✖ ${errors.length} data issue(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`✓ Meta data valid for patch ${patch}`);
console.log(`  champions: ${Object.keys(meta.champions).length}`);
console.log(`  build profiles: ${Object.keys(meta.buildProfiles).length}`);
console.log(`  rune profiles: ${Object.keys(meta.runeProfiles).length}`);
console.log(`  arena augments checked: ${Object.values(meta.arena ?? {}).flat().length}`);
