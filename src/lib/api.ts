import { invoke } from "@tauri-apps/api/core";
import {
  browserDraftRecommendations,
  browserRecommendation,
  getBrowserPerformance,
  getBrowserSettings,
  loadBrowserBootstrap,
  saveBrowserSettings,
} from "./browser";
import { isDesktop } from "./env";
import { FALLBACK_AUGMENTS } from "./arena";
import type {
  AppInfo,
  Bootstrap,
  ChampSelect,
  DdragonStatus,
  LiveGame,
  LcuStatus,
  Performance,
  Recommendation,
  RolePick,
  RunePageInput,
  Settings,
} from "./types";

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

const EMPTY_LIVE: LiveGame = {
  active: false,
  gameMode: "",
  mapName: "",
  gameTime: 0,
  myChampion: "",
  myRole: "",
  myLevel: 0,
  myTeam: [],
  enemyTeam: [],
  events: [],
  augments: [],
  latencyMs: 0,
  updatedAt: 0,
};

const EMPTY_SELECT: ChampSelect = {
  active: false,
  phase: "",
  timeLeft: 0,
  myCell: -1,
  myChampion: "",
  myRole: "",
  myTeam: [],
  enemyTeam: [],
  myBans: [],
  enemyBans: [],
  isMyTurn: false,
};

export async function getBootstrap(): Promise<Bootstrap> {
  const data = isDesktop() ? await invoke<Bootstrap>("get_bootstrap") : await loadBrowserBootstrap();
  if (!data.arena.length) {
    return { ...data, arena: FALLBACK_AUGMENTS, arenaSource: "curated" };
  }
  return { ...data, arenaSource: "live" };
}

export async function getDdragonStatus(): Promise<DdragonStatus> {
  if (isDesktop()) return invoke<DdragonStatus>("get_ddragon_status");
  return { state: "ready", version: "preview", source: "web-preview", cachedImages: 0, totalImages: 0 };
}

export async function getLiveState(): Promise<LiveGame> {
  if (isDesktop()) return invoke<LiveGame>("get_live_state");
  return EMPTY_LIVE;
}

export async function getLcuStatus(): Promise<LcuStatus> {
  if (isDesktop()) return invoke<LcuStatus>("get_lcu_status");
  return { connected: false, champSelect: false, message: "Web preview" };
}

export async function getChampSelect(): Promise<ChampSelect> {
  if (isDesktop()) return invoke<ChampSelect>("get_champ_select");
  return EMPTY_SELECT;
}

export async function getSettings(): Promise<Settings> {
  if (isDesktop()) return invoke<Settings>("get_settings");
  return getBrowserSettings();
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  if (isDesktop()) return invoke<Settings>("save_settings", { settings });
  return saveBrowserSettings(settings);
}

export async function getRecommendation(
  champion: string,
  role?: string,
): Promise<Recommendation> {
  if (isDesktop()) {
    return invoke<Recommendation>("get_recommendation", { champion, role });
  }
  const bootstrap = await loadBrowserBootstrap();
  return browserRecommendation(bootstrap, champion, role);
}

export async function getDraftRecommendations(
  role: string,
  enemies: string[],
): Promise<RolePick[]> {
  if (isDesktop()) {
    return invoke<RolePick[]>("get_draft_recommendations", { role, enemies });
  }
  const bootstrap = await loadBrowserBootstrap();
  return browserDraftRecommendations(bootstrap, role, enemies);
}

export async function getPerformance(): Promise<Performance> {
  if (isDesktop()) return invoke<Performance>("get_performance");
  return getBrowserPerformance();
}

export async function applyRunes(page: RunePageInput): Promise<string> {
  if (!isDesktop()) {
    throw new Error("Rune import is available in the desktop app.");
  }
  return invoke<string>("apply_runes", { page });
}

export async function setCompactMode(compact: boolean): Promise<void> {
  if (isDesktop()) await invoke("set_compact_mode", { compact });
}

export async function refreshDdragon(): Promise<void> {
  if (isDesktop()) await invoke("refresh_ddragon");
}

export async function getAppInfo(): Promise<AppInfo> {
  if (isDesktop()) return invoke<AppInfo>("get_app_info");
  return { version: "0.1.0", buildProfile: "web-preview" };
}

export { EMPTY_LIVE, EMPTY_SELECT };
