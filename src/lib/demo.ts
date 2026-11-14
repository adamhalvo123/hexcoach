import type {
  Bootstrap,
  ChampSelect,
  LiveEvent,
  LiveGame,
  LiveItem,
  LivePlayer,
  Role,
} from "./types";
import { normalizeRole } from "./format";

const demoStarted = Date.now();

function itemList(bootstrap: Bootstrap, names: string[]): LiveItem[] {
  return names
    .map((name, slot) => {
      const item = bootstrap.items.find((entry) => entry.name === name);
      if (!item) return null;
      return {
        itemId: item.id,
        displayName: item.name,
        count: 1,
        price: item.gold.total,
        slot,
      };
    })
    .filter(Boolean) as LiveItem[];
}

function player(
  bootstrap: Bootstrap,
  config: {
    champion: string;
    summoner: string;
    position: Role | string;
    team: "ORDER" | "CHAOS";
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    level: number;
    items: string[];
    spells: string[];
    isLocal?: boolean;
  },
): LivePlayer | null {
  const champion =
    bootstrap.champions.find((entry) => entry.name === config.champion) ??
    bootstrap.champions.find((entry) => entry.tags.includes("Mage"));
  if (!champion) return null;
  return {
    champion: champion.name,
    summonerName: config.summoner,
    team: config.team,
    position: config.position,
    level: config.level,
    isDead: false,
    respawnTimer: 0,
    kills: config.kills,
    deaths: config.deaths,
    assists: config.assists,
    creepScore: config.cs,
    wardScore: 12,
    items: itemList(bootstrap, config.items),
    summonerSpells: config.spells,
    augments: [],
    isLocal: config.isLocal ?? false,
    isBot: false,
  };
}

export function createDemoLive(
  bootstrap: Bootstrap,
  championName: string,
  role: string,
): LiveGame {
  const roleValue = normalizeRole(role) === "NONE" ? "MIDDLE" : normalizeRole(role);
  const myTeamConfigs = [
    {
      champion: "Darius",
      summoner: "IronRevenant",
      position: "TOP" as const,
      kills: 4,
      deaths: 3,
      assists: 5,
      cs: 196,
      level: 12,
      items: ["Trinity Force", "Plated Steelcaps", "Sundered Sky", "Sterak's Gage", "Control Ward"],
      spells: ["Flash", "Teleport"],
    },
    {
      champion: "Vi",
      summoner: "PunchFirst",
      position: "JUNGLE" as const,
      kills: 6,
      deaths: 2,
      assists: 9,
      cs: 142,
      level: 12,
      items: ["Eclipse", "Plated Steelcaps", "Sundered Sky", "Black Cleaver"],
      spells: ["Flash", "Smite"],
    },
    {
      champion: "Ahri",
      summoner: "HexCoach#EUW",
      position: "MIDDLE" as const,
      kills: 7,
      deaths: 1,
      assists: 8,
      cs: 214,
      level: 13,
      items: ["Luden's Echo", "Sorcerer's Shoes", "Rabadon's Deathcap", "Zhonya's Hourglass"],
      spells: ["Flash", "Ignite"],
      isLocal: true,
    },
    {
      champion: "Jinx",
      summoner: "RocketGirl",
      position: "BOTTOM" as const,
      kills: 9,
      deaths: 2,
      assists: 6,
      cs: 238,
      level: 12,
      items: ["Kraken Slayer", "Berserker's Greaves", "Infinity Edge", "Phantom Dancer"],
      spells: ["Flash", "Heal"],
    },
    {
      champion: "Thresh",
      summoner: "LanternKing",
      position: "UTILITY" as const,
      kills: 1,
      deaths: 4,
      assists: 17,
      cs: 32,
      level: 10,
      items: ["Locket of the Iron Solari", "Ionian Boots of Lucidity", "Knight's Vow", "Control Ward"],
      spells: ["Flash", "Ignite"],
    },
  ];

  const enemyConfigs = [
    {
      champion: "Malphite",
      summoner: "RockSolid",
      position: "TOP" as const,
      team: "CHAOS" as const,
      kills: 3,
      deaths: 5,
      assists: 7,
      cs: 181,
      level: 12,
      items: ["Sunfire Aegis", "Plated Steelcaps", "Jak'Sho, The Protean", "Thornmail"],
      spells: ["Flash", "Teleport"],
    },
    {
      champion: "Lee Sin",
      summoner: "BlindMonk",
      position: "JUNGLE" as const,
      team: "CHAOS" as const,
      kills: 5,
      deaths: 4,
      assists: 8,
      cs: 128,
      level: 12,
      items: ["Eclipse", "Plated Steelcaps", "Black Cleaver", "Death's Dance"],
      spells: ["Flash", "Smite"],
    },
    {
      champion: "Syndra",
      summoner: "DarkSpheres",
      position: "MIDDLE" as const,
      team: "CHAOS" as const,
      kills: 4,
      deaths: 6,
      assists: 5,
      cs: 202,
      level: 12,
      items: ["Luden's Echo", "Sorcerer's Shoes", "Shadowflame", "Rabadon's Deathcap"],
      spells: ["Flash", "Ignite"],
    },
    {
      champion: "Caitlyn",
      summoner: "Sheriff",
      position: "BOTTOM" as const,
      team: "CHAOS" as const,
      kills: 6,
      deaths: 7,
      assists: 6,
      cs: 226,
      level: 11,
      items: ["Kraken Slayer", "Berserker's Greaves", "Infinity Edge", "Lord Dominik's Regards"],
      spells: ["Flash", "Heal"],
    },
    {
      champion: "Leona",
      summoner: "SunTemplar",
      position: "UTILITY" as const,
      team: "CHAOS" as const,
      kills: 2,
      deaths: 8,
      assists: 13,
      cs: 41,
      level: 10,
      items: ["Locket of the Iron Solari", "Plated Steelcaps", "Zeke's Convergence", "Control Ward"],
      spells: ["Flash", "Exhaust"],
    },
  ];

  const adjustedMyTeam = myTeamConfigs.map((config) => {
    if (config.position === roleValue) {
      return { ...config, champion: championName, isLocal: true, summoner: "HexCoach#EUW" };
    }
    return { ...config, isLocal: false };
  });

  const myTeam = adjustedMyTeam
    .map((config) => player(bootstrap, { ...config, team: "ORDER" }))
    .filter(Boolean) as LivePlayer[];
  const enemyTeam = enemyConfigs
    .map((config) => player(bootstrap, config))
    .filter(Boolean) as LivePlayer[];

  const events: LiveEvent[] = [
    {
      eventId: 4,
      name: "BaronKill",
      time: 1085,
      killer: "HexCoach#EUW",
      victim: "",
      team: "ORDER",
    },
    {
      eventId: 3,
      name: "ChampionKill",
      time: 932,
      killer: "HexCoach#EUW",
      victim: "Syndra",
      team: "ORDER",
    },
    {
      eventId: 2,
      name: "TurretKilled",
      time: 754,
      killer: "",
      victim: "",
      team: "ORDER",
    },
    {
      eventId: 1,
      name: "DragonKill",
      time: 432,
      killer: "PunchFirst",
      victim: "",
      team: "CHAOS",
    },
  ];

  return {
    active: true,
    gameMode: "CLASSIC",
    mapName: "Map11",
    gameTime: 1168 + (Date.now() - demoStarted) / 1000,
    myChampion: championName,
    myRole: roleValue,
    myLevel: 13,
    myTeam,
    enemyTeam,
    events,
    augments: [],
    isAram: false,
    isMayhem: false,
    myGold: 2150,
    latencyMs: 4,
    updatedAt: Date.now(),
  };
}

export function createDemoAram(
  bootstrap: Bootstrap,
  championName: string,
  variant: "aram" | "mayhem",
): LiveGame {
  const base = createDemoLive(bootstrap, championName, "MIDDLE");
  const mayhem = variant === "mayhem";
  const augments = mayhem ? ["Jeweled Gauntlet", "Goliath", "Dual Wield"] : [];
  const myTeam = base.myTeam.map((player) => ({
    ...player,
    position: "NONE",
    augments: player.isLocal ? augments : player.augments,
  }));
  const enemyTeam = base.enemyTeam.map((player, index) => ({
    ...player,
    position: "NONE",
    isDead: index < 2,
    respawnTimer: index === 0 ? 9.4 : 22.1,
    summonerSpells: index % 2 === 0 ? ["Flash", "Ignite"] : ["Flash", "Snowball"],
    augments: mayhem && index === 0 ? ["Goliath"] : [],
  }));

  return {
    ...base,
    gameMode: mayhem ? "ARAM_MAYHEM" : "ARAM",
    mapName: "Map12",
    myTeam,
    enemyTeam,
    augments,
    isAram: true,
    isMayhem: mayhem,
    myGold: 2475,
    gameTime: 742 + (Date.now() - demoStarted) / 1000,
    updatedAt: Date.now(),
  };
}

export function createDemoChampSelect(
  bootstrap: Bootstrap,
  championName: string,
  role: string,
): ChampSelect {
  const roleValue = normalizeRole(role) === "NONE" ? "MIDDLE" : normalizeRole(role);
  const teamConfigs: Array<{ champion: string; summoner: string; position: Role }> = [
    { champion: "Darius", summoner: "IronRevenant", position: "TOP" },
    { champion: "Vi", summoner: "PunchFirst", position: "JUNGLE" },
    { champion: championName, summoner: "HexCoach#EUW", position: roleValue as Role },
    { champion: "Jinx", summoner: "RocketGirl", position: "BOTTOM" },
    { champion: "Thresh", summoner: "LanternKing", position: "UTILITY" },
  ];
  const enemies: Array<{ champion: string; summoner: string; position: Role }> = [
    { champion: "Malphite", summoner: "RockSolid", position: "TOP" },
    { champion: "Lee Sin", summoner: "BlindMonk", position: "JUNGLE" },
    { champion: "Syndra", summoner: "DarkSpheres", position: "MIDDLE" },
    { champion: "Caitlyn", summoner: "Sheriff", position: "BOTTOM" },
    { champion: "Leona", summoner: "SunTemplar", position: "UTILITY" },
  ];

  let cell = 0;
  const toDraft = (config: (typeof teamConfigs)[number], local: boolean) => {
    const champion =
      bootstrap.champions.find((entry) => entry.name === config.champion) ??
      bootstrap.champions[0];
    cell += 1;
    return {
      cellId: cell,
      championId: Number(champion?.key ?? 0),
      champion: champion?.name ?? config.champion,
      summonerName: config.summoner,
      position: config.position,
      isLocal: local,
    };
  };

  const myTeam = teamConfigs.map((config, index) => toDraft(config, index === 2));
  const enemyTeam = enemies.map((config) => toDraft(config, false));

  return {
    active: true,
    phase: "BAN_PICK",
    timeLeft: 27,
    myCell: 3,
    myChampion: championName,
    myRole: roleValue,
    myTeam,
    enemyTeam,
    myBans: ["Yuumi", "Teemo", "Shaco"],
    enemyBans: ["Blitzcrank", "Kassadin", "Fiora"],
    isMyTurn: true,
  };
}
