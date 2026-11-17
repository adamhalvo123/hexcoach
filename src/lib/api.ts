import { invoke } from "@tauri-apps/api/core";
import {
  browserChampionBuild,
  browserDraftRecommendations,
  browserRecommendation,
  getBrowserPerformance,
  getBrowserSettings,
  loadBrowserBootstrap,
  saveBrowserSettings,
} from "./browser";
import { isDesktop } from "./env";
import { FALLBACK_AUGMENTS } from "./arena";
import { FALLBACK_ARAM_BALANCE } from "./aram";
import { createDemoProfile } from "./demo";
import type {
  AppInfo,
  Bootstrap,
  ChampSelect,
  ChampionBuild,
  DdragonStatus,
  HotkeyStatus,
  Hotkeys,
  HudOverlayState,
  LiveGame,
  LcuStatus,
  Performance,
  PlayerProfile,
  ProfileRequest,
  Recommendation,
  RiotApiRequest,
  RiotApiResponse,
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
  isAram: false,
  isMayhem: false,
  myGold: 0,
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
  const arena = !data.arena.length ? FALLBACK_AUGMENTS : data.arena;
  const aram = data.aram?.length ? data.aram : FALLBACK_ARAM_BALANCE;
  return {
    ...data,
    arena,
    arenaSource: data.arena.length ? "live" : "curated",
    aram,
    aramSource: data.aram?.length ? (data.aramSource ?? "live") : "curated",
  };
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

function browserHotkeyStatus(hotkeys: Hotkeys): HotkeyStatus {
  const bindings: Array<[string, string, string]> = [
    ["toggle-compact", "Compact / full overlay", hotkeys.toggleCompact],
    ["toggle-click-through", "Dashboard click-through", hotkeys.toggleClickThrough],
    ["toggle-visibility", "Show / hide HexCoach", hotkeys.toggleVisibility],
    ["toggle-hud", "In-game HUD interaction", hotkeys.toggleHud],
  ];
  return {
    bindings: bindings.map(([action, label, accelerator]) => ({
      action,
      label,
      accelerator,
      registered: Boolean(accelerator.trim()),
      error: accelerator.trim() ? null : "Shortcut is empty.",
    })),
  };
}

export async function registerHotkeys(hotkeys: Hotkeys): Promise<HotkeyStatus> {
  if (isDesktop()) return invoke<HotkeyStatus>("register_hotkeys", { hotkeys });
  return browserHotkeyStatus(hotkeys);
}

export async function getHotkeyStatus(): Promise<HotkeyStatus> {
  if (isDesktop()) return invoke<HotkeyStatus>("get_hotkey_status");
  const settings = getBrowserSettings();
  return browserHotkeyStatus(settings.hotkeys);
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

export async function getChampionBuild(
  championKey: string,
  role?: string,
  gameMode?: string,
  refresh = false,
): Promise<ChampionBuild> {
  if (isDesktop()) {
    return invoke<ChampionBuild>("get_champion_build", {
      championKey,
      role,
      gameMode,
      refresh,
    });
  }
  const bootstrap = await loadBrowserBootstrap();
  return browserChampionBuild(bootstrap, championKey, role, gameMode);
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

export async function getOverlayState(): Promise<HudOverlayState> {
  if (isDesktop()) return invoke<HudOverlayState>("get_overlay_state");
  return { visible: true, clickThrough: true, interactive: false };
}

export async function setOverlayClickthrough(ignore: boolean): Promise<HudOverlayState> {
  if (isDesktop()) return invoke<HudOverlayState>("set_overlay_clickthrough", { ignore });
  return { visible: true, clickThrough: ignore, interactive: !ignore };
}

export async function setHudVisible(visible: boolean): Promise<HudOverlayState> {
  if (isDesktop()) return invoke<HudOverlayState>("set_hud_visible", { visible });
  return { visible, clickThrough: true, interactive: false };
}

export async function fetchRiotApi(request: RiotApiRequest): Promise<RiotApiResponse> {
  if (!isDesktop()) {
    throw new Error("Riot API requests run in the desktop app.");
  }
  return invoke<RiotApiResponse>("fetch_riot_api", { request });
}

export async function getPlayerProfile(request: ProfileRequest = {}): Promise<PlayerProfile> {
  if (isDesktop()) {
    return invoke<PlayerProfile>("get_player_profile", { request });
  }
  return createDemoProfile(request.riotId);
}

export async function clearRiotApiKey(): Promise<Settings> {
  if (isDesktop()) return invoke<Settings>("clear_riot_api_key");
  return getBrowserSettings();
}

export async function refreshDdragon(): Promise<void> {
  if (isDesktop()) await invoke("refresh_ddragon");
}

export async function getAppInfo(): Promise<AppInfo> {
  if (isDesktop()) return invoke<AppInfo>("get_app_info");
  return { version: "0.1.0", buildProfile: "web-preview" };
}

export { EMPTY_LIVE, EMPTY_SELECT };
