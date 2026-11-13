import { convertFileSrc } from "@tauri-apps/api/core";
import { isDesktop } from "./env";
import type { ArenaAugment, Bootstrap, Champion, Item, Rune, SummonerSpell } from "./types";

const DDRAGON = "https://ddragon.leagueoflegends.com/cdn";
const CDRAGON = "https://raw.communitydragon.org/latest";
const CDRAGON_PLUGIN = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";

function communityAsset(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return clean.startsWith("assets/") ? `${CDRAGON_PLUGIN}/${clean}` : `${CDRAGON}/${clean}`;
}

export interface AssetSources {
  src: string;
  fallback?: string;
}

function join(dir: string, rel: string): string {
  return `${dir.replaceAll("\\", "/").replace(/\/$/, "")}/${rel.replace(/^\/+/, "")}`;
}

export function localAsset(bootstrap: Bootstrap, rel: string): string | undefined {
  if (!isDesktop() || !bootstrap.cacheDir) return undefined;
  try {
    return convertFileSrc(join(bootstrap.cacheDir, rel));
  } catch {
    return undefined;
  }
}

function localOr(bootstrap: Bootstrap, rel: string, remote: string): AssetSources {
  const local = localAsset(bootstrap, rel);
  return local ? { src: local, fallback: remote } : { src: remote };
}

export function championIcon(bootstrap: Bootstrap, champion: Champion): AssetSources {
  return localOr(
    bootstrap,
    `img/champion/${champion.image.full}`,
    `${DDRAGON}/${bootstrap.version}/img/champion/${champion.image.full}`,
  );
}

export function championSplash(bootstrap: Bootstrap, champion: Champion): AssetSources {
  return {
    src: `${DDRAGON}/${bootstrap.version}/img/champion/splash/${champion.id}_0.jpg`,
    fallback: `${DDRAGON}/${bootstrap.version}/img/champion/loading/${champion.id}_0.jpg`,
  };
}

export function itemIcon(bootstrap: Bootstrap, item: Item | { image: { full: string } }): AssetSources {
  return localOr(
    bootstrap,
    `img/item/${item.image.full}`,
    `${DDRAGON}/${bootstrap.version}/img/item/${item.image.full}`,
  );
}

export function itemRefIcon(bootstrap: Bootstrap, icon: string): AssetSources {
  return localOr(bootstrap, `img/item/${icon}`, `${DDRAGON}/${bootstrap.version}/img/item/${icon}`);
}

export function runeIcon(bootstrap: Bootstrap, rune: Rune | { icon: string }): AssetSources {
  return localOr(bootstrap, `img/rune/${rune.icon}`, `${DDRAGON}/img/${rune.icon}`);
}

export function runeRefIcon(bootstrap: Bootstrap, icon: string): AssetSources {
  return localOr(bootstrap, `img/rune/${icon}`, `${DDRAGON}/img/${icon}`);
}

export function spellIcon(bootstrap: Bootstrap, spell: SummonerSpell): AssetSources {
  return localOr(
    bootstrap,
    `img/spell/${spell.image.full}`,
    `${DDRAGON}/${bootstrap.version}/img/spell/${spell.image.full}`,
  );
}

export function augmentIcon(bootstrap: Bootstrap, augment: ArenaAugment): AssetSources {
  return localOr(
    bootstrap,
    `img/augment/${augment.apiName}.png`,
    `${communityAsset(augment.iconSmall)}`,
  );
}

export function abilityIcon(bootstrap: Bootstrap, image: { full: string }): AssetSources {
  return {
    src: `${DDRAGON}/${bootstrap.version}/img/spell/${image.full}`,
    fallback: `${DDRAGON}/${bootstrap.version}/img/spell/${image.full}`,
  };
}

export function itemIconByName(bootstrap: Bootstrap, name: string): AssetSources | undefined {
  const item = bootstrap.items.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  return item ? itemIcon(bootstrap, item) : undefined;
}
