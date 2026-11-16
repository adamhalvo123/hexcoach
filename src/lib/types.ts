export type Page = "profile" | "live" | "draft" | "builds" | "arena" | "aram" | "settings";
export type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "NONE";
export type ToastKind = "success" | "error" | "info";

export interface ImageData {
  full: string;
  sprite: string;
  group: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChampionInfo {
  attack: number;
  defense: number;
  magic: number;
  difficulty: number;
}

export interface ChampionSpell {
  id: string;
  name: string;
  description: string;
  image: ImageData;
  cooldown: number[];
  range: number[];
  maxrank: number;
}

export interface ChampionPassive {
  name: string;
  description: string;
  image: ImageData;
}

export interface Champion {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  partype: string;
  info: ChampionInfo;
  stats: Record<string, number>;
  image: ImageData;
  spells: ChampionSpell[];
  passive: ChampionPassive;
}

export interface Gold {
  base: number;
  total: number;
  sell: number;
  purchasable: boolean;
}

export interface Item {
  id: number;
  name: string;
  description: string;
  plaintext: string;
  gold: Gold;
  tags: string[];
  image: ImageData;
  into: string[];
  from: string[];
  depth: number;
}

export interface Rune {
  id: number;
  key: string;
  name: string;
  icon: string;
  shortDesc: string;
  longDesc: string;
}

export interface RuneSlot {
  runes: Rune[];
}

export interface RuneTree {
  id: number;
  key: string;
  name: string;
  icon: string;
  slots: RuneSlot[];
}

export interface SummonerSpell {
  id: string;
  name: string;
  description: string;
  image: ImageData;
  cooldown: number[];
  range: number[];
  maxrank: number;
}

export interface ArenaAugment {
  id: number;
  apiName: string;
  name: string;
  desc: string;
  iconSmall: string;
  iconLarge: string;
  rarity: number;
  rarityLabel: string;
  tier: string;
  score: number;
  tags: string[];
  synergy: string;
}

export interface AramBalance {
  champion: string;
  damageDealt: number;
  damageTaken: number;
  healing: number;
  shielding: number;
  tenacity: number;
  abilityHaste: number;
  manaRegen: number;
  energyRegen: number;
  note: string;
}

export interface Bootstrap {
  version: string;
  cacheDir: string;
  source: string;
  /** "curated" when the CommunityDragon Arena file could not be reached. */
  arenaSource?: "live" | "curated";
  champions: Champion[];
  items: Item[];
  runes: RuneTree[];
  spells: SummonerSpell[];
  arena: ArenaAugment[];
  aram: AramBalance[];
  /** "curated" when the Howling Abyss balance feed was not reachable. */
  aramSource?: "live" | "cache" | "curated";
}

export interface DdragonStatus {
  state: "idle" | "loading" | "ready" | "error";
  version?: string;
  source?: string;
  message?: string;
  cachedImages: number;
  totalImages: number;
}

export interface LiveItem {
  itemId: number;
  displayName: string;
  count: number;
  price: number;
  slot: number;
}

export interface LivePlayer {
  champion: string;
  summonerName: string;
  team: string;
  position: string;
  level: number;
  isDead: boolean;
  respawnTimer: number;
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
  wardScore: number;
  items: LiveItem[];
  summonerSpells: string[];
  augments: string[];
  isLocal: boolean;
  isBot: boolean;
}

export interface LiveEvent {
  eventId: number;
  name: string;
  time: number;
  killer: string;
  victim: string;
  team: string;
}

export interface LiveGame {
  active: boolean;
  gameMode: string;
  mapName: string;
  gameTime: number;
  myChampion: string;
  myRole: string;
  myLevel: number;
  myTeam: LivePlayer[];
  enemyTeam: LivePlayer[];
  events: LiveEvent[];
  augments: string[];
  isAram: boolean;
  isMayhem: boolean;
  myGold: number;
  latencyMs: number;
  updatedAt: number;
}

export interface DraftPlayer {
  cellId: number;
  championId: number;
  champion: string;
  summonerName: string;
  position: string;
  isLocal: boolean;
}

export interface ChampSelect {
  active: boolean;
  phase: string;
  timeLeft: number;
  myCell: number;
  myChampion: string;
  myRole: string;
  myTeam: DraftPlayer[];
  enemyTeam: DraftPlayer[];
  myBans: string[];
  enemyBans: string[];
  isMyTurn: boolean;
}

export interface LcuStatus {
  connected: boolean;
  summoner?: string;
  champSelect: boolean;
  port?: number;
  message?: string;
}

export interface Hotkeys {
  toggleCompact: string;
  toggleClickThrough: string;
  toggleVisibility: string;
  toggleHud: string;
}

export interface Settings {
  /** Write-only in the UI: the backend always responds with an empty string. */
  riotApiKey: string;
  riotKeyConfigured: boolean;
  riotKeySource: "local" | "environment" | "none" | string;
  riotId: string;
  region: string;
  alwaysOnTop: boolean;
  demoMode: boolean;
  overlayOpacity: number;
  performanceHud: boolean;
  autoImport: boolean;
  hudOverlay: boolean;
  hotkeys: Hotkeys;
}

export interface HudOverlayState {
  visible: boolean;
  clickThrough: boolean;
  interactive: boolean;
}

export interface RiotApiRequest {
  kind: "account" | "matches" | "match" | "summoner" | string;
  region?: string;
  gameName?: string;
  tagLine?: string;
  puuid?: string;
  matchId?: string;
  start?: number;
  count?: number;
}

export interface RiotApiResponse {
  status: number;
  data: unknown;
}

export interface ProfileRequest {
  riotId?: string;
  region?: string;
  count?: number;
}

export interface ProfileRank {
  queue: string;
  queueLabel: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winRate: number;
  hotStreak: boolean;
}

export interface MatchTeammate {
  puuid: string;
  name: string;
  champion: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
}

export interface ProfileMatch {
  matchId: string;
  champion: string;
  championId: number;
  role: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  durationSec: number;
  gameMode: string;
  queueId: number;
  playedAtMs: number;
  teammates: MatchTeammate[];
}

export interface FrequentTeammate {
  puuid: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PlayerProfile {
  riotId: string;
  gameName: string;
  tagLine: string;
  puuid: string;
  summonerLevel: number;
  profileIconId: number;
  region: string;
  ranks: ProfileRank[];
  matches: ProfileMatch[];
  teammates: FrequentTeammate[];
  overallWins: number;
  overallLosses: number;
  overallWinRate: number;
  overallSource: "ranked" | "recent" | string;
  recentWins: number;
  recentLosses: number;
  recentWinRate: number;
  fetchedAtMs: number;
}

export interface ItemRef {
  id: number;
  name: string;
  icon: string;
  price: number;
  tags: string[];
  description: string;
}

export interface BuildSet {
  starter: ItemRef[];
  boots: ItemRef[];
  core: ItemRef[];
  situational: ItemRef[];
}

export interface RuneRef {
  id: number;
  name: string;
  icon: string;
}

export interface RunePage {
  primaryStyleId: number;
  subStyleId: number;
  primaryStyleName: string;
  subStyleName: string;
  keystone: RuneRef;
  primaryPerks: RuneRef[];
  subPerks: RuneRef[];
  shards: number[];
  selectedPerkIds: number[];
  pageName: string;
}

export interface SkillPlan {
  order: string[];
  max: string[];
  note: string;
}

export interface MetaView {
  tier: string;
  score: number;
  estimatedWinRate: number;
  label: string;
  note: string;
}

export interface Matchup {
  champion: string;
  championId: string;
  reason: string;
  score: number;
}

export interface Recommendation {
  champion: string;
  championId: string;
  championTitle: string;
  tags: string[];
  role: Role | string;
  roleLabel: string;
  buildSource: "curated" | "class-default" | string;
  runeSource: string;
  meta: MetaView;
  items: BuildSet;
  runes: RunePage;
  skills: SkillPlan;
  counters: Matchup[];
  synergies: Matchup[];
  tips: string[];
  warnings: string[];
}

export interface SpellRef {
  id: string;
  name: string;
  icon: string;
}

export interface ChampionBuild {
  champion: string;
  championId: string;
  championKey: string;
  championTitle: string;
  tags: string[];
  role: Role | string;
  roleLabel: string;
  gameMode: string;
  gameModeLabel: string;
  patch: string;
  tier: string;
  score: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  games: number;
  winRateLabel: string;
  rank: number;
  totalChampions: number;
  source: string;
  sourceDetail: string;
  cached: boolean;
  fetchedAtMs: number;
  runes: RunePage;
  summonerSpells: SpellRef[];
  startingItems: ItemRef[];
  coreItems: ItemRef[];
  situationalItems: ItemRef[];
  items: BuildSet;
  skillOrder: SkillPlan;
  /** Champions this champion beats. */
  counters: Matchup[];
  /** Champions that beat this champion. */
  threats: Matchup[];
  synergies: Matchup[];
  tips: string[];
  notes: string[];
  warnings: string[];
}

export interface RolePick {
  champion: string;
  championId: string;
  title: string;
  tags: string[];
  role: string;
  tier: string;
  score: number;
  estimatedWinRate: number;
  counters: string[];
  reason: string;
}

export interface Performance {
  ramMb: number;
  liveLatencyMs: number;
  cacheMb: number;
  patch: string;
  uptimeSec: number;
  cachedImages: number;
  totalImages: number;
}

export interface AppInfo {
  version: string;
  buildProfile: string;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

export interface RunePageInput {
  name: string;
  primaryStyleId: number;
  subStyleId: number;
  selectedPerkIds: number[];
  current: boolean;
}

export const ROLES: Role[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
