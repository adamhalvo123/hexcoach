import metaJson from "@/data/meta.json";
import { FALLBACK_ARAM_BALANCE } from "./aram";
import { DEFAULT_SETTINGS } from "./defaults";
import { normalizeRole, roleLabel } from "./format";
import type {
  ArenaAugment,
  Bootstrap,
  Champion,
  Item,
  ItemRef,
  Matchup,
  Performance,
  Recommendation,
  RolePick,
  Rune,
  RunePage,
  RuneRef,
  Settings,
  SkillPlan,
  SummonerSpell,
} from "./types";

const meta = metaJson as any;
const DDRAGON = "https://ddragon.leagueoflegends.com";
const CDRAGON = "https://raw.communitydragon.org/latest";
const SETTINGS_KEY = "hexcoach.settings.v1";
const startedAt = Date.now();

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

let bootstrapPromise: Promise<Bootstrap> | null = null;

export function loadBrowserBootstrap(): Promise<Bootstrap> {
  if (!bootstrapPromise) {
    bootstrapPromise = loadBrowserBootstrapInner().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}

async function loadBrowserBootstrapInner(): Promise<Bootstrap> {
  const versions = await fetchJson<string[]>(`${DDRAGON}/api/versions.json`);
  const version = versions[0];
  const base = `${DDRAGON}/cdn/${version}/data/en_US`;
  const [championsRaw, itemsRaw, runesRaw, spellsRaw, arenaRaw] = await Promise.all([
    fetchJson<any>(`${base}/champion.json`),
    fetchJson<any>(`${base}/item.json`),
    fetchJson<any[]>(`${base}/runesReforged.json`),
    fetchJson<any>(`${base}/summoner.json`),
    fetchJson<any>(`${CDRAGON}/cdragon/arena/en_us.json`, 8000).catch(() => ({ augments: [] })),
  ]);

  const champions: Champion[] = Object.values(championsRaw.data).map((raw: any) => ({
    ...raw,
    spells: (raw.spells ?? []).map((spell: any) => ({
      ...spell,
      description: stripHtml(spell.description ?? ""),
    })),
    passive: {
      ...raw.passive,
      description: stripHtml(raw.passive?.description ?? ""),
    },
  }));

  const items: Item[] = Object.entries(itemsRaw.data)
    .filter(([, raw]: [string, any]) => raw.maps?.["11"] && raw.gold?.purchasable)
    .map(([id, raw]: [string, any]) => ({
      id: Number(id),
      name: raw.name,
      description: stripHtml(raw.description ?? ""),
      plaintext: raw.plaintext ?? "",
      gold: raw.gold,
      tags: raw.tags ?? [],
      image: raw.image,
      into: raw.into ?? [],
      from: raw.from ?? [],
      depth: raw.depth ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const runes = runesRaw.map((tree: any) => ({
    ...tree,
    slots: tree.slots.map((slot: any) => ({
      runes: slot.runes.map((rune: any) => ({
        ...rune,
        shortDesc: stripHtml(rune.shortDesc ?? ""),
        longDesc: stripHtml(rune.longDesc ?? ""),
      })),
    })),
  }));

  const spells: SummonerSpell[] = Object.entries(spellsRaw.data).map(([id, raw]: [string, any]) => ({
    id,
    name: raw.name,
    description: stripHtml(raw.description ?? ""),
    image: raw.image,
    cooldown: raw.cooldown ?? [],
    range: raw.range ?? [],
    maxrank: raw.maxrank ?? 1,
  }));

  const tierMap = new Map<string, string>();
  for (const [tier, names] of Object.entries(meta.arena ?? {})) {
    for (const name of names as string[]) tierMap.set(name, tier);
  }

  const augmentTags = (desc: string): string[] => {
    const text = desc.toLowerCase();
    const checks: Array<[string, string[]]> = [
      ["AP", ["ability power", "magic damage", "ap "]],
      ["AD", ["attack damage", "physical damage", "ad "]],
      ["Crit", ["critical", "crit "]],
      ["Tank", ["health", "armor", "magic resist", "damage reduction"]],
      ["Sustain", ["heal", "shield", "omnivamp", "life steal"]],
      ["Haste", ["ability haste", "cooldown"]],
      ["Mobility", ["movement speed", "dash", "blink"]],
      ["Economy", ["gold", "anvil", "stat", "item"]],
      ["Ultimate", ["ultimate"]],
      ["Utility", ["summoner spell", "ward", "vision", "slow"]],
    ];
    return checks
      .filter(([, needles]) => needles.some((needle) => text.includes(needle)))
      .map(([tag]) => tag)
      .slice(0, 5);
  };

  const arena: ArenaAugment[] = (arenaRaw.augments ?? [])
    .map((raw: any) => {
      const desc = stripHtml(raw.desc ?? raw.tooltip ?? "");
      const tier = tierMap.get(raw.name) ?? (raw.rarity === 2 ? "A" : raw.rarity === 1 ? "B" : "C");
      const tags = augmentTags(desc);
      return {
        id: raw.id ?? 0,
        apiName: raw.apiName ?? "",
        name: raw.name ?? "",
        desc,
        iconSmall: raw.iconSmall ?? "",
        iconLarge: raw.iconLarge ?? "",
        rarity: raw.rarity ?? 0,
        rarityLabel:
          raw.rarity === 0
            ? "Silver"
            : raw.rarity === 1
              ? "Gold"
              : raw.rarity === 2
                ? "Prismatic"
                : "Special",
        tier,
        score: tier === "S" ? 95 : tier === "A" ? 86 : tier === "B" ? 74 : 62,
        tags: tags.length ? tags : ["Utility"],
        synergy: `Synergy profile: ${(tags.length ? tags : ["Utility"]).slice(0, 3).join(" / ")}`,
      };
    })
    .filter((augment: ArenaAugment) => Boolean(augment.name))
    .sort((a: ArenaAugment, b: ArenaAugment) => b.score - a.score || a.name.localeCompare(b.name));

  return {
    version,
    cacheDir: "",
    source: "web-preview",
    champions: champions.sort((a, b) => a.name.localeCompare(b.name)),
    items,
    runes,
    spells: spells.sort((a, b) => a.name.localeCompare(b.name)),
    arena,
    aram: FALLBACK_ARAM_BALANCE,
    aramSource: "curated",
  };
}

function classFor(champion: Champion, role: string): string {
  const has = (tag: string) => champion.tags.some((value) => value.toLowerCase() === tag.toLowerCase());
  if (role === "UTILITY") return has("Tank") || has("Fighter") ? "tank_support" : "enchanter";
  if (role === "JUNGLE") {
    if (has("Tank")) return "tank";
    if (has("Assassin")) return "assassin";
    return "fighter";
  }
  if (has("Marksman")) return "marksman";
  if (has("Mage")) return "mage";
  if (has("Assassin")) return "assassin";
  if (has("Tank")) return "tank";
  return "fighter";
}

function defaultProfiles(classId: string): [string, string] {
  switch (classId) {
    case "mage":
      return ["mage_burst", "electrocute_mage"];
    case "marksman":
      return ["marksman", "lethal_tempo"];
    case "assassin":
      return ["assassin", "electrocute"];
    case "tank":
      return ["tank", "grasp"];
    case "enchanter":
      return ["enchanter", "aery"];
    case "tank_support":
      return ["tank_support", "aftershock"];
    default:
      return ["fighter", "conqueror"];
  }
}

function roleEntry(championName: string, role: string): any {
  const roles = meta.champions?.[championName]?.roles;
  if (!roles) return null;
  return roles[role] ?? Object.values(roles)[0] ?? null;
}

function resolveItem(bootstrap: Bootstrap, name: string): Item | undefined {
  return bootstrap.items.find((item) => item.name.toLowerCase() === name.toLowerCase());
}

function toItemRef(item: Item): ItemRef {
  return {
    id: item.id,
    name: item.name,
    icon: item.image.full,
    price: item.gold.total,
    tags: item.tags,
    description: item.plaintext || item.description.slice(0, 220),
  };
}

function isBoots(item: Item): boolean {
  const name = item.name.toLowerCase();
  return (
    item.tags.some((tag) => tag.toLowerCase() === "boots") ||
    name.includes("boots") ||
    name.includes("greaves") ||
    name.includes("shoes") ||
    name.includes("treads")
  );
}

function buildItems(
  bootstrap: Bootstrap,
  profile: any,
  entry: any,
  champion: Champion,
  role: string,
  classId: string,
  warnings: string[],
) {
  const resolve = (names: string[]): ItemRef[] => {
    const output: ItemRef[] = [];
    for (const name of names) {
      const item = resolveItem(bootstrap, name);
      if (!item) {
        warnings.push(`Item '${name}' is not in the current patch.`);
      } else if (!output.some((existing) => existing.id === item.id)) {
        output.push(toItemRef(item));
      }
    }
    return output;
  };

  const starterNames = entry?.starter?.length
    ? entry.starter
    : role === "JUNGLE"
      ? ["Gustwalker Hatchling", "Health Potion"]
      : (profile?.starter ?? []);
  const coreNames = entry?.core?.length
    ? entry.core
    : (profile?.core ?? meta.buildProfiles?.[defaultProfiles(classId)[0]]?.core ?? []);
  const situationalNames = entry?.situational?.length
    ? entry.situational
    : (profile?.situational ?? []);

  const coreResolved = resolve(coreNames);
  const boots: ItemRef[] = [];
  const core: ItemRef[] = [];
  for (const item of coreResolved) {
    if (!boots.length && isBoots(resolveItem(bootstrap, item.name)!)) boots.push(item);
    else core.push(item);
  }

  return {
    starter: resolve(starterNames),
    boots,
    core,
    situational: resolve(situationalNames),
  };
}

function findTree(bootstrap: Bootstrap, name: string) {
  return (
    bootstrap.runes.find((tree) => tree.name.toLowerCase() === name.toLowerCase()) ??
    bootstrap.runes[0]
  );
}

function findRune(tree: any, name: string): Rune | undefined {
  return tree.slots
    .flatMap((slot: any) => slot.runes)
    .find((rune: Rune) => rune.name.toLowerCase() === name.toLowerCase());
}

function runeRef(rune: Rune): RuneRef {
  return { id: rune.id, name: rune.name, icon: rune.icon };
}

function makeRunePage(
  bootstrap: Bootstrap,
  profileName: string,
  championName: string,
  role: string,
  warnings: string[],
): RunePage {
  const profile = meta.runeProfiles?.[profileName] ?? meta.runeProfiles?.electrocute_mage ?? {};
  const primary = findTree(bootstrap, profile.primary ?? "Domination");
  const secondary =
    bootstrap.runes.find(
      (tree) => tree.id !== primary.id && tree.name.toLowerCase() === (profile.secondary ?? "").toLowerCase(),
    ) ?? bootstrap.runes.find((tree) => tree.id !== primary.id)!;
  const keystone =
    primary.slots[0].runes.find(
      (rune) => rune.name.toLowerCase() === (profile.keystone ?? "").toLowerCase(),
    ) ?? primary.slots[0].runes[0];

  const primaryPerks: RuneRef[] = [];
  for (const name of profile.primaryPerks ?? []) {
    const rune = findRune(primary, name);
    if (rune && rune.id !== keystone.id && !primaryPerks.some((r) => r.id === rune.id)) {
      primaryPerks.push(runeRef(rune));
    } else if (!rune) {
      warnings.push(`Rune '${name}' was not found in ${primary.name}.`);
    }
  }
  for (const slot of primary.slots.slice(1)) {
    if (primaryPerks.length >= 3) break;
    const rune = slot.runes.find((candidate: Rune) => !primaryPerks.some((r) => r.id === candidate.id));
    if (rune) primaryPerks.push(runeRef(rune));
  }
  primaryPerks.length = Math.min(primaryPerks.length, 3);

  const subPerks: RuneRef[] = [];
  for (const name of profile.secondaryPerks ?? []) {
    const rune = findRune(secondary, name);
    if (rune && rune.id !== keystone.id && !subPerks.some((r) => r.id === rune.id)) {
      subPerks.push(runeRef(rune));
    } else if (!rune) {
      warnings.push(`Rune '${name}' was not found in ${secondary.name}.`);
    }
  }
  for (const slot of secondary.slots.slice(1)) {
    if (subPerks.length >= 2) break;
    const rune = slot.runes.find((candidate: Rune) => !subPerks.some((r) => r.id === candidate.id));
    if (rune) subPerks.push(runeRef(rune));
  }
  subPerks.length = Math.min(subPerks.length, 2);

  const shards: number[] = profile.shards?.length === 3 ? profile.shards : [5008, 5008, 5001];
  const selectedPerkIds = [
    keystone.id,
    ...primaryPerks.map((rune) => rune.id),
    ...subPerks.map((rune) => rune.id),
    ...shards,
  ];

  return {
    primaryStyleId: primary.id,
    subStyleId: secondary.id,
    primaryStyleName: primary.name,
    subStyleName: secondary.name,
    keystone: runeRef(keystone),
    primaryPerks,
    subPerks,
    shards,
    selectedPerkIds,
    pageName: `HexCoach | ${championName} ${roleLabel(role)}`,
  };
}

function makeSkillPlan(entry: any, classId: string): SkillPlan {
  let priority: string[] = entry?.skillOrder ?? [];
  if (!priority.length) {
    priority =
      classId === "fighter" || classId === "assassin"
        ? ["Q", "E", "W"]
        : classId === "enchanter"
          ? ["E", "W", "Q"]
          : ["Q", "W", "E"];
  }
  for (const skill of ["Q", "W", "E"]) {
    if (!priority.includes(skill)) priority.push(skill);
  }
  priority = priority.slice(0, 3);

  const counts: Record<string, number> = { Q: 0, W: 0, E: 0 };
  const order: string[] = [];
  for (let level = 1; level <= 18; level += 1) {
    if (level === 1) {
      order.push(priority[0]);
      counts[priority[0]] += 1;
    } else if (level === 2) {
      order.push(priority[1]);
      counts[priority[1]] += 1;
    } else if (level === 3) {
      order.push(priority[2]);
      counts[priority[2]] += 1;
    } else if (level === 6 || level === 11 || level === 16) {
      order.push("R");
    } else {
      const next = ["Q", "W", "E"].find((skill) => counts[skill] < 5) ?? priority[0];
      counts[next] += 1;
      order.push(next);
    }
  }

  return {
    order,
    max: priority,
    note: entry?.skillNote ?? `Max ${priority[0]} first, then ${priority[1]} into ${priority[2]}.`,
  };
}

function matchupList(bootstrap: Bootstrap, entry: any, key: string): Matchup[] {
  return (entry?.[key] ?? [])
    .map((matchup: any) => {
      const champion = bootstrap.champions.find(
        (candidate) => candidate.name.toLowerCase() === matchup.champion.toLowerCase(),
      );
      if (!champion) return null;
      return {
        champion: champion.name,
        championId: champion.id,
        reason: matchup.reason ?? "Favourable matchup",
        score: matchup.score ?? 72,
      };
    })
    .filter(Boolean) as Matchup[];
}

function estimatedWinRate(score: number): number {
  return Math.round(Math.min(58, Math.max(44, 50 + (score - 70) * 0.18)) * 10) / 10;
}

export function browserRecommendation(
  bootstrap: Bootstrap,
  championQuery: string,
  requestedRole?: string,
): Recommendation {
  const champion =
    bootstrap.champions.find(
      (candidate) =>
        candidate.name.toLowerCase() === championQuery.toLowerCase() ||
        candidate.id.toLowerCase() === championQuery.toLowerCase(),
    ) ?? bootstrap.champions[0];

  const initialRole = normalizeRole(requestedRole);
  const entry = roleEntry(champion.name, initialRole);
  const role =
    initialRole === "NONE"
      ? (Object.keys(meta.champions?.[champion.name]?.roles ?? {})[0] ?? "MIDDLE")
      : initialRole;
  const classId = classFor(champion, role);
  const [defaultBuild, defaultRunes] = defaultProfiles(classId);
  const profile = meta.buildProfiles?.[entry?.build ?? defaultBuild] ?? {};
  const warnings: string[] = [];
  const score = entry?.score ?? 70;
  const tier = entry?.tier ?? "B";

  return {
    champion: champion.name,
    championId: champion.id,
    championTitle: champion.title,
    tags: champion.tags,
    role,
    roleLabel: roleLabel(role),
    buildSource: entry ? "curated" : "class-default",
    runeSource: entry ? "curated" : "class-default",
    meta: {
      tier,
      score,
      estimatedWinRate: estimatedWinRate(score),
      label: "EST. WR",
      note: entry?.note ?? "Offline heuristic score. Not Riot match data.",
    },
    items: buildItems(bootstrap, profile, entry, champion, role, classId, warnings),
    runes: makeRunePage(
      bootstrap,
      entry?.rune ?? defaultRunes,
      champion.name,
      role,
      warnings,
    ),
    skills: makeSkillPlan(entry, classId),
    counters: matchupList(bootstrap, entry, "counters"),
    synergies: matchupList(bootstrap, entry, "synergies"),
    tips: entry?.tips?.length
      ? entry.tips
      : [
          "Ward before pushing and track the enemy jungler's first clear.",
          "Trade around your power spikes rather than forcing every wave.",
          "Ping timers for objectives 30 seconds before they spawn.",
        ],
    warnings,
  };
}

export function browserDraftRecommendations(
  bootstrap: Bootstrap,
  role: string,
  enemies: string[],
): RolePick[] {
  const normalized = normalizeRole(role);
  const picks: RolePick[] = [];
  for (const [name, championValue] of Object.entries(meta.champions ?? {}) as Array<[string, any]>) {
    const entry = championValue.roles?.[normalized];
    if (!entry) continue;
    const champion = bootstrap.champions.find((candidate) => candidate.name === name);
    if (!champion) continue;

    let score = entry.score ?? 70;
    const counterNames: string[] = (entry.counters ?? []).map((m: any) => m.champion);
    const reasons: string[] = [];
    for (const enemy of enemies) {
      const hit = counterNames.find((counter) => counter.toLowerCase() === enemy.toLowerCase());
      if (hit) {
        score += 8;
        reasons.push(`Counters ${hit}`);
      }
    }
    picks.push({
      champion: champion.name,
      championId: champion.id,
      title: champion.title,
      tags: champion.tags,
      role: normalized,
      tier: entry.tier ?? "B",
      score,
      estimatedWinRate: estimatedWinRate(score),
      counters: counterNames,
      reason:
        reasons[0] ??
        entry.tips?.[0] ??
        `Solid ${roleLabel(normalized)} pick with a ${score} meta score.`,
    });
  }
  return picks.sort((a, b) => b.score - a.score || a.champion.localeCompare(b.champion)).slice(0, 12);
}

export function getBrowserSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, hotkeys: { ...DEFAULT_SETTINGS.hotkeys } };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const configured = Boolean(parsed.riotKeyConfigured);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      riotApiKey: "",
      riotKeyConfigured: configured,
      riotKeySource: configured ? (parsed.riotKeySource ?? "local") : "none",
      hotkeys: { ...DEFAULT_SETTINGS.hotkeys, ...(parsed.hotkeys ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, hotkeys: { ...DEFAULT_SETTINGS.hotkeys } };
  }
}

export function saveBrowserSettings(settings: Settings): Settings {
  const configured = settings.riotKeyConfigured || settings.riotApiKey.trim().length > 0;
  const next: Settings = {
    ...settings,
    // The web preview never persists a real key; only the desktop backend does.
    riotApiKey: "",
    riotKeyConfigured: configured,
    riotKeySource: configured ? "local" : "none",
    overlayOpacity: Math.min(1, Math.max(0.55, settings.overlayOpacity)),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function getBrowserPerformance(): Performance {
  return {
    ramMb: 58.6,
    liveLatencyMs: 4,
    cacheMb: 0,
    patch: "web-preview",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    cachedImages: 0,
    totalImages: 0,
  };
}
