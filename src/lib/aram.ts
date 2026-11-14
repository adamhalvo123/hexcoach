import balanceJson from "@/data/aram-balance.json";
import mayhemJson from "@/data/aram-mayhem.json";
import type {
  AramBalance,
  ArenaAugment,
  Bootstrap,
  BuildSet,
  Champion,
  ItemRef,
  LiveGame,
  Recommendation,
} from "./types";

type BalanceFile = { champions: AramBalance[] };
type MayhemFile = { note: string; tiers: Record<string, string[]> };

const BALANCE_FILE = balanceJson as BalanceFile;
const MAYHEM_FILE = mayhemJson as MayhemFile;

/** Curated offline Howling Abyss balance snapshot. */
export const FALLBACK_ARAM_BALANCE: AramBalance[] = [...BALANCE_FILE.champions].sort((a, b) =>
  a.champion.localeCompare(b.champion),
);

export const ARAM_MAYHEM_NOTE = MAYHEM_FILE.note;
export const ARAM_MAYHEM_TIERS = MAYHEM_FILE.tiers;

export interface MayhemEntry {
  tier: string;
  name: string;
  augment?: ArenaAugment;
}

export function isAramGame(live: LiveGame): boolean {
  return (
    live.isAram ||
    live.gameMode === "ARAM" ||
    live.gameMode === "ARAM_MAYHEM" ||
    live.mapName.toLowerCase().includes("howling") ||
    live.mapName === "Map12"
  );
}

export function isMayhemGame(live: LiveGame): boolean {
  return (
    live.isMayhem ||
    live.gameMode === "ARAM_MAYHEM" ||
    live.gameMode.toUpperCase().includes("MAYHEM") ||
    (isAramGame(live) && live.augments.length > 0)
  );
}

export function findAramBalance(
  bootstrap: Bootstrap | null,
  champion: string,
): AramBalance {
  const found = (bootstrap?.aram ?? FALLBACK_ARAM_BALANCE).find(
    (entry) => entry.champion.toLowerCase() === champion.toLowerCase(),
  );
  return (
    found ?? {
      champion,
      damageDealt: 0,
      damageTaken: 0,
      healing: 0,
      shielding: 0,
      tenacity: 0,
      abilityHaste: 0,
      manaRegen: 0,
      energyRegen: 0,
      note: "No curated balance entry for this champion. Modifiers default to neutral.",
    }
  );
}

function itemRef(bootstrap: Bootstrap, name: string): ItemRef | undefined {
  const item = bootstrap.items.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  if (!item) return undefined;
  return {
    id: item.id,
    name: item.name,
    icon: item.image.full,
    price: item.gold.total,
    tags: item.tags,
    description: item.plaintext || item.description.slice(0, 220),
  };
}

function starterName(champion?: Champion): string {
  const tags = champion?.tags ?? [];
  if (tags.includes("Mage") || tags.includes("Support")) return "Guardian's Orb";
  if (tags.includes("Marksman")) return "Guardian's Blade";
  if (tags.includes("Tank") || tags.includes("Fighter")) return "Guardian's Horn";
  if (tags.includes("Assassin")) return "Guardian's Hammer";
  return "Guardian's Orb";
}

/** Swaps the Rift starter for the correct Guardian item while keeping the
 * champion's recommended core, boots and situational picks. */
export function aramBuild(
  bootstrap: Bootstrap,
  recommendation: Recommendation,
  champion?: Champion,
): BuildSet {
  const guardian = itemRef(bootstrap, starterName(champion));
  const potion = itemRef(bootstrap, "Health Potion");
  const starter = [guardian, potion].filter((item): item is ItemRef => Boolean(item));
  return {
    starter: starter.length ? starter : recommendation.items.starter,
    boots: recommendation.items.boots,
    core: recommendation.items.core,
    situational: recommendation.items.situational,
  };
}

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

export function mayhemTierList(bootstrap: Bootstrap): MayhemEntry[][] {
  const byName = new Map<string, ArenaAugment>();
  for (const augment of bootstrap.arena) {
    byName.set(normalise(augment.name), augment);
  }
  return Object.entries(ARAM_MAYHEM_TIERS).map(([tier, names]) =>
    names.map((name) => ({
      tier,
      name,
      augment: byName.get(normalise(name)),
    })),
  );
}

export function mayhemPicksFor(
  bootstrap: Bootstrap,
  champion?: Champion,
  limit = 8,
): MayhemEntry[] {
  const tiers = mayhemTierList(bootstrap).flat();
  const tags = new Set(champion?.tags ?? []);
  const score = (entry: MayhemEntry): number => {
    const tierScore = entry.tier === "S" ? 40 : entry.tier === "A" ? 28 : entry.tier === "B" ? 16 : 8;
    let bonus = 0;
    for (const tag of entry.augment?.tags ?? []) {
      if (tag === "AP" && tags.has("Mage")) bonus += 4;
      if (tag === "AD" && (tags.has("Marksman") || tags.has("Fighter"))) bonus += 4;
      if (tag === "Crit" && tags.has("Marksman")) bonus += 5;
      if (tag === "Tank" && tags.has("Tank")) bonus += 5;
      if (tag === "Sustain" && (tags.has("Tank") || tags.has("Support"))) bonus += 3;
      if (tag === "Haste" && tags.has("Mage")) bonus += 3;
    }
    return tierScore + bonus;
  };
  return [...tiers].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export const ARAM_TIPS = [
  "Buy a Guardian item at spawn — it is the strongest early stat package on Howling Abyss.",
  "Health relics spawn on the side brushes. Hold them for a reset rather than topping off at full HP.",
  "Snowball (Mark/Dash) is the default second summoner for melee champions; it opens engage and escape lines.",
  "If your champion has a damage-taken nerf, build resistances before raw HP to stack the modifier.",
];
