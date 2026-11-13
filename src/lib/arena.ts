import type { ArenaAugment, Champion } from "./types";
import fallbackData from "@/data/arena-fallback.json";

export interface AugmentPick extends ArenaAugment {
  matchScore: number;
  reason: string;
}

type FallbackAugment = {
  id: number;
  apiName: string;
  name: string;
  desc: string;
  rarity: number;
  rarityLabel: string;
  tier: string;
  tags: string[];
  synergy: string;
};

const FALLBACK_RAW: FallbackAugment[] = fallbackData as FallbackAugment[];

/** Curated offline Arena set used when CommunityDragon is unreachable. */
export const FALLBACK_AUGMENTS: ArenaAugment[] = FALLBACK_RAW.map((augment) => ({
  ...augment,
  iconSmall: "",
  iconLarge: "",
  score: tierScore(augment.tier),
  synergy: augment.synergy,
})).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

function tierScore(tier: string): number {
  switch (tier.toUpperCase()) {
    case "S":
      return 95;
    case "A":
      return 86;
    case "B":
      return 74;
    default:
      return 62;
  }
}

const TAG_LABELS: Record<string, string> = {
  AP: "ability power",
  AD: "attack damage",
  Crit: "critical strike",
  Tank: "durability",
  Sustain: "sustain",
  Haste: "ability haste",
  Mobility: "mobility",
  Economy: "gold economy",
  Ultimate: "ultimate power",
  Utility: "utility",
};

function profileFor(champion?: Champion): Record<string, number> {
  const tags = champion?.tags ?? [];
  if (tags.includes("Mage")) {
    return { AP: 10, Haste: 5, Ultimate: 7, Sustain: 2, Tank: 1, Mobility: 2 };
  }
  if (tags.includes("Marksman")) {
    return { AD: 7, Crit: 10, Haste: 4, Mobility: 4, Ultimate: 2, Tank: 1 };
  }
  if (tags.includes("Assassin")) {
    return { AD: 8, Mobility: 8, Crit: 5, Haste: 4, Ultimate: 3 };
  }
  if (tags.includes("Tank")) {
    return { Tank: 11, Sustain: 6, Haste: 4, Utility: 4, AP: 1, AD: 1 };
  }
  if (tags.includes("Support")) {
    return { Utility: 10, Sustain: 7, Haste: 5, Tank: 3, AP: 2 };
  }
  return { AD: 5, Tank: 5, Sustain: 5, Haste: 3, Mobility: 3, Ultimate: 2 };
}

export function recommendAugments(
  augments: ArenaAugment[],
  champion?: Champion,
  limit = 10,
): AugmentPick[] {
  const profile = profileFor(champion);
  return augments
    .map((augment) => {
      let bonus = 0;
      let strongest = "";
      let strongestValue = 0;
      for (const tag of augment.tags) {
        const value = profile[tag] ?? 0;
        bonus += value;
        if (value > strongestValue) {
          strongestValue = value;
          strongest = tag;
        }
      }
      const reason = strongest
        ? `Strong fit for your ${TAG_LABELS[strongest] ?? strongest.toLowerCase()} profile.`
        : "Flexible augment that fits most Arena drafts.";
      return {
        ...augment,
        matchScore: Math.round(augment.score + bonus),
        reason,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function findActiveAugments(
  augments: ArenaAugment[],
  activeNames: string[],
): ArenaAugment[] {
  if (!activeNames.length) return [];
  return activeNames
    .map((raw) => {
      const idMatch = raw.match(/^id:(\d+)$/);
      if (idMatch) {
        return augments.find((augment) => augment.id === Number(idMatch[1]));
      }
      return augments.find(
        (augment) =>
          augment.name.toLowerCase() === raw.toLowerCase() ||
          augment.apiName.toLowerCase() === raw.toLowerCase(),
      );
    })
    .filter((augment): augment is ArenaAugment => Boolean(augment));
}

export function filterAugments(
  augments: ArenaAugment[],
  query: string,
  tier: string,
  rarity: string,
): ArenaAugment[] {
  const normalized = query.trim().toLowerCase();
  return augments.filter((augment) => {
    if (tier !== "ALL" && augment.tier !== tier) return false;
    if (rarity !== "ALL" && augment.rarityLabel !== rarity) return false;
    if (!normalized) return true;
    return (
      augment.name.toLowerCase().includes(normalized) ||
      augment.desc.toLowerCase().includes(normalized) ||
      augment.tags.some((tag) => tag.toLowerCase().includes(normalized))
    );
  });
}
