import type {
  Bootstrap,
  ChampSelect,
  FrequentTeammate,
  LiveEvent,
  LiveGame,
  LiveItem,
  LivePlayer,
  PlayerProfile,
  ProfileMatch,
  ProfileRank,
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

const DEMO_ROSTER: Record<string, string> = {
  "DuoKing#EUW": "Lulu",
  "PunchFirst#EUW": "Vi",
  "RocketGirl#EUW": "Jinx",
  "LanternKing#EUW": "Thresh",
  "IronRevenant#EUW": "Darius",
};

const DEMO_TEAMMATE_STATS: Record<string, [number, number, number]> = {
  "DuoKing#EUW": [2, 3, 18],
  "PunchFirst#EUW": [6, 4, 9],
  "RocketGirl#EUW": [8, 3, 7],
  "LanternKing#EUW": [1, 6, 16],
  "IronRevenant#EUW": [4, 5, 6],
};

const DEMO_MATCHES: Array<{
  champion: string;
  championId: number;
  role: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  durationSec: number;
  gameMode: string;
  queueId: number;
  hoursAgo: number;
  team: string[];
}> = [
  {
    champion: "Ahri",
    championId: 103,
    role: "MIDDLE",
    win: true,
    kills: 12,
    deaths: 3,
    assists: 9,
    durationSec: 1884,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 3,
    team: ["DuoKing#EUW", "PunchFirst#EUW", "RocketGirl#EUW", "LanternKing#EUW"],
  },
  {
    champion: "Ahri",
    championId: 103,
    role: "MIDDLE",
    win: false,
    kills: 4,
    deaths: 6,
    assists: 5,
    durationSec: 1620,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 6,
    team: ["DuoKing#EUW", "PunchFirst#EUW", "RocketGirl#EUW", "LanternKing#EUW"],
  },
  {
    champion: "Sylas",
    championId: 517,
    role: "MIDDLE",
    win: true,
    kills: 9,
    deaths: 2,
    assists: 7,
    durationSec: 1440,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 10,
    team: ["DuoKing#EUW", "PunchFirst#EUW", "IronRevenant#EUW", "LanternKing#EUW"],
  },
  {
    champion: "Kai'Sa",
    championId: 145,
    role: "BOTTOM",
    win: false,
    kills: 5,
    deaths: 8,
    assists: 3,
    durationSec: 2040,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 26,
    team: ["DuoKing#EUW", "LanternKing#EUW", "IronRevenant#EUW", "PunchFirst#EUW"],
  },
  {
    champion: "Ahri",
    championId: 103,
    role: "MIDDLE",
    win: true,
    kills: 10,
    deaths: 4,
    assists: 11,
    durationSec: 1755,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 29,
    team: ["DuoKing#EUW", "PunchFirst#EUW", "RocketGirl#EUW", "LanternKing#EUW"],
  },
  {
    champion: "Ezreal",
    championId: 81,
    role: "BOTTOM",
    win: false,
    kills: 3,
    deaths: 7,
    assists: 6,
    durationSec: 1590,
    gameMode: "CLASSIC",
    queueId: 440,
    hoursAgo: 33,
    team: ["PunchFirst#EUW", "RocketGirl#EUW", "LanternKing#EUW", "IronRevenant#EUW"],
  },
  {
    champion: "Ahri",
    championId: 103,
    role: "MIDDLE",
    win: true,
    kills: 8,
    deaths: 1,
    assists: 14,
    durationSec: 1500,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 52,
    team: ["DuoKing#EUW", "PunchFirst#EUW", "RocketGirl#EUW", "LanternKing#EUW"],
  },
  {
    champion: "Sylas",
    championId: 517,
    role: "MIDDLE",
    win: true,
    kills: 11,
    deaths: 5,
    assists: 8,
    durationSec: 2175,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 55,
    team: ["DuoKing#EUW", "RocketGirl#EUW", "LanternKing#EUW", "IronRevenant#EUW"],
  },
  {
    champion: "Kai'Sa",
    championId: 145,
    role: "BOTTOM",
    win: false,
    kills: 6,
    deaths: 9,
    assists: 4,
    durationSec: 1860,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 75,
    team: ["PunchFirst#EUW", "RocketGirl#EUW", "LanternKing#EUW", "IronRevenant#EUW"],
  },
  {
    champion: "Ahri",
    championId: 103,
    role: "MIDDLE",
    win: true,
    kills: 13,
    deaths: 2,
    assists: 10,
    durationSec: 1725,
    gameMode: "CLASSIC",
    queueId: 420,
    hoursAgo: 98,
    team: ["DuoKing#EUW", "PunchFirst#EUW", "RocketGirl#EUW", "LanternKing#EUW"],
  },
];

export function createDemoProfile(riotId?: string): PlayerProfile {
  const raw = riotId?.trim() || "HexCoach#EUW";
  const [gameName, tagLine] = raw.includes("#") ? raw.split("#") : ["HexCoach", "EUW"];
  const now = Date.now();

  const matches: ProfileMatch[] = DEMO_MATCHES.map((spec, index) => ({
    matchId: `EUN1_DEMO_${String(index + 1).padStart(6, "0")}`,
    champion: spec.champion,
    championId: spec.championId,
    role: spec.role,
    win: spec.win,
    kills: spec.kills,
    deaths: spec.deaths,
    assists: spec.assists,
    kda:
      Math.round(
        ((spec.kills + spec.assists) / Math.max(1, spec.deaths)) * 100,
      ) / 100,
    durationSec: spec.durationSec,
    gameMode: spec.gameMode,
    queueId: spec.queueId,
    playedAtMs: now - spec.hoursAgo * 3_600_000,
    teammates: spec.team.map((name) => {
      const [kills, deaths, assists] = DEMO_TEAMMATE_STATS[name] ?? [2, 4, 8];
      return {
        puuid: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        name,
        champion: DEMO_ROSTER[name] ?? "Lulu",
        win: spec.win,
        kills,
        deaths,
        assists,
        kda: Math.round(((kills + assists) / Math.max(1, deaths)) * 100) / 100,
      };
    }),
  }));

  const totals = new Map<string, FrequentTeammate>();
  for (const game of matches) {
    const seen = new Set<string>();
    for (const teammate of game.teammates) {
      if (seen.has(teammate.puuid)) continue;
      seen.add(teammate.puuid);
      const entry =
        totals.get(teammate.puuid) ??
        ({
          puuid: teammate.puuid,
          name: teammate.name,
          games: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
        } satisfies FrequentTeammate);
      entry.games += 1;
      if (game.win) entry.wins += 1;
      else entry.losses += 1;
      entry.winRate = Math.round((entry.wins / entry.games) * 1000) / 10;
      totals.set(teammate.puuid, entry);
    }
  }
  const teammates = [...totals.values()].sort(
    (a, b) => b.games - a.games || b.winRate - a.winRate || a.name.localeCompare(b.name),
  );

  const ranks: ProfileRank[] = [
    {
      queue: "RANKED_SOLO_5x5",
      queueLabel: "Solo/Duo",
      tier: "EMERALD",
      rank: "II",
      leaguePoints: 43,
      wins: 68,
      losses: 54,
      winRate: 55.7,
      hotStreak: true,
    },
    {
      queue: "RANKED_FLEX_SR",
      queueLabel: "Flex",
      tier: "PLATINUM",
      rank: "I",
      leaguePoints: 12,
      wins: 22,
      losses: 19,
      winRate: 53.7,
      hotStreak: false,
    },
  ];

  const overallWins = ranks.reduce((sum, rank) => sum + rank.wins, 0);
  const overallLosses = ranks.reduce((sum, rank) => sum + rank.losses, 0);
  const recentWins = matches.filter((game) => game.win).length;
  const recentLosses = matches.length - recentWins;

  return {
    riotId: `${gameName}#${tagLine}`,
    gameName,
    tagLine,
    puuid: "demo-puuid-hexcoach",
    summonerLevel: 412,
    profileIconId: 29,
    region: "euw1",
    ranks,
    matches,
    teammates,
    overallWins,
    overallLosses,
    overallWinRate: Math.round((overallWins / (overallWins + overallLosses)) * 1000) / 10,
    overallSource: "ranked",
    recentWins,
    recentLosses,
    recentWinRate: Math.round((recentWins / Math.max(1, matches.length)) * 1000) / 10,
    fetchedAtMs: now,
  };
}
