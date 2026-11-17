import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  EMPTY_LIVE,
  EMPTY_SELECT,
  applyRunes,
  errorMessage,
  getAppInfo,
  getBootstrap,
  getChampSelect,
  getChampionBuild,
  getDdragonStatus,
  getHotkeyStatus,
  getLiveState,
  getLcuStatus,
  getPerformance,
  getRecommendation,
  getSettings,
  refreshDdragon,
  registerHotkeys as requestHotkeys,
  saveSettings as persistSettings,
  setCompactMode as applyCompactMode,
  clearRiotApiKey as clearRiotKeyRequest,
} from "@/lib/api";
import { createDemoAram, createDemoChampSelect, createDemoLive } from "@/lib/demo";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { isDesktop } from "@/lib/env";
import { normalizeRole } from "@/lib/format";
import {
  applyTheme,
  hasStoredTheme,
  normalizeTheme,
  persistTheme,
  readStoredTheme,
} from "@/lib/theme";
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
  Page,
  Performance,
  Recommendation,
  Role,
  RunePageInput,
  Settings,
  ShortcutTrigger,
  Theme,
  Toast,
  ToastKind,
} from "@/lib/types";

const EMPTY_PERF: Performance = {
  ramMb: 0,
  liveLatencyMs: 0,
  cacheMb: 0,
  patch: "—",
  uptimeSec: 0,
  cachedImages: 0,
  totalImages: 0,
};

const SELECTION_KEY = "hexcoach.selection.v1";

function initialPage(): Page {
  if (typeof window === "undefined") return "live";
  const value = new URLSearchParams(window.location.search).get("page");
  return value === "profile" ||
    value === "draft" ||
    value === "builds" ||
    value === "arena" ||
    value === "aram" ||
    value === "settings"
    ? value
    : "live";
}

function initialDemoVariant(): "classic" | "aram" | "mayhem" {
  if (typeof window === "undefined") return "classic";
  const value = new URLSearchParams(window.location.search).get("mode");
  return value === "aram" || value === "mayhem" ? value : "classic";
}

function initialCompact(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("compact") === "1";
}

function initialSelection(): { champion: string; role: Role } {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { champion?: string; role?: string };
      const role = normalizeRole(parsed.role);
      return {
        champion: parsed.champion ?? "",
        role: role === "NONE" ? "MIDDLE" : role,
      };
    }
  } catch {
    // Ignore malformed local state.
  }
  return { champion: "", role: "MIDDLE" };
}

const savedSelection = initialSelection();
const demoVariant = initialDemoVariant();

interface AppStore {
  bootstrap: Bootstrap | null;
  bootstrapLoading: boolean;
  bootstrapError: string | null;
  ddragon: DdragonStatus;
  settings: Settings;
  live: LiveGame;
  champSelect: ChampSelect;
  lcu: LcuStatus;
  perf: Performance;
  appInfo: AppInfo | null;
  page: Page;
  setPage: (page: Page) => void;
  compact: boolean;
  setCompact: (compact: boolean) => void;
  hudClickThrough: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  hotkeyStatus: HotkeyStatus | null;
  applyHotkeys: (hotkeys: Hotkeys) => Promise<HotkeyStatus>;
  champion: string;
  setChampion: (champion: string) => void;
  role: Role;
  setRole: (role: Role) => void;
  recommendation: Recommendation | null;
  championBuild: ChampionBuild | null;
  buildLoading: boolean;
  buildError: string | null;
  buildMode: string;
  refreshBuild: () => void;
  recLoading: boolean;
  recError: string | null;
  refreshRecommendation: () => void;
  refreshData: () => Promise<void>;
  retryBootstrap: () => void;
  saveSettings: (next: Settings) => Promise<void>;
  clearRiotKey: () => Promise<void>;
  importRunes: () => Promise<void>;
  toasts: Toast[];
  pushToast: (kind: ToastKind, title: string, message?: string) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [ddragon, setDdragon] = useState<DdragonStatus>({
    state: "loading",
    cachedImages: 0,
    totalImages: 0,
  });
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    hotkeys: { ...DEFAULT_SETTINGS.hotkeys },
  }));
  const [rawLive, setRawLive] = useState<LiveGame>(EMPTY_LIVE);
  const [rawSelect, setRawSelect] = useState<ChampSelect>(EMPTY_SELECT);
  const [rawLcu, setRawLcu] = useState<LcuStatus>({
    connected: false,
    champSelect: false,
  });
  const [perf, setPerf] = useState<Performance>(EMPTY_PERF);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [page, setPage] = useState<Page>(initialPage);
  const [compact, setCompactState] = useState(initialCompact);
  const [hudClickThrough, setHudClickThrough] = useState(true);
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [hotkeyStatus, setHotkeyStatus] = useState<HotkeyStatus | null>(null);
  const [champion, setChampion] = useState(savedSelection.champion);
  const [role, setRole] = useState<Role>(savedSelection.role);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [championBuild, setChampionBuild] = useState<ChampionBuild | null>(null);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildTick, setBuildTick] = useState(0);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [demoClock, setDemoClock] = useState(0);

  const toastId = useRef(0);
  const reqId = useRef(0);
  const buildReqId = useRef(0);
  const autoImportKey = useRef("");
  const trackedGame = useRef("");
  const trackedSelect = useRef("");

  const pushToast = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-3), { id, kind, title, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4800);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // Load persisted settings once.
  useEffect(() => {
    let cancelled = false;
    void getSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        // localStorage is the fast path that prevents a theme flash. When it is
        // empty, adopt the theme stored in settings.json.
        if (!hasStoredTheme()) {
          const stored = normalizeTheme(loaded.theme);
          setThemeState(stored);
          applyTheme(stored);
          persistTheme(stored);
        }
      })
      .catch(() => {
        // Defaults are already in place.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply and mirror the active theme. Dark is the default on every launch.
  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  // Read the shortcut registration result once so Settings can show failures.
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    void getHotkeyStatus()
      .then((status) => {
        if (!cancelled) setHotkeyStatus(status);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Bootstrap Data Dragon, retrying while the Rust backend is still warming the cache.
  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const attempt = async () => {
      setBootstrapLoading(true);
      try {
        const data = await getBootstrap();
        if (cancelled) return;
        setBootstrap(data);
        setBootstrapError(null);
        setBootstrapLoading(false);
      } catch (error) {
        if (cancelled) return;
        setBootstrapError(errorMessage(error));
        if (isDesktop()) {
          timer = window.setTimeout(attempt, 1200);
        } else {
          setBootstrapLoading(false);
        }
      }
    };

    void attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reloadToken]);

  // Keep the selected champion valid for the current patch.
  useEffect(() => {
    if (!bootstrap?.champions.length) return;
    setChampion((current) => {
      if (current && bootstrap.champions.some((entry) => entry.name === current)) return current;
      const preferred = bootstrap.champions.find((entry) => entry.name === "Ahri");
      return preferred?.name ?? bootstrap.champions[0].name;
    });
  }, [bootstrap]);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify({ champion, role }));
    } catch {
      // Selection persistence is optional.
    }
  }, [champion, role]);

  // Poll the local clients (events usually arrive faster, polling is the safety net).
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;

    const tick = async () => {
      const [liveResult, selectResult, lcuResult] = await Promise.allSettled([
        getLiveState(),
        getChampSelect(),
        getLcuStatus(),
      ]);
      if (cancelled) return;
      if (liveResult.status === "fulfilled") setRawLive(liveResult.value);
      if (selectResult.status === "fulfilled") setRawSelect(selectResult.value);
      if (lcuResult.status === "fulfilled") setRawLcu(lcuResult.value);
    };

    const perfTick = async () => {
      try {
        const value = await getPerformance();
        if (!cancelled) setPerf(value);
      } catch {
        // Performance HUD stays on the last known values.
      }
    };

    void tick();
    void perfTick();
    void getAppInfo()
      .then((info) => {
        if (!cancelled) setAppInfo(info);
      })
      .catch(() => undefined);
    void getDdragonStatus()
      .then((status) => {
        if (!cancelled) setDdragon(status);
      })
      .catch(() => undefined);

    const stateTimer = window.setInterval(tick, 2000);
    const perfTimer = window.setInterval(perfTick, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(stateTimer);
      window.clearInterval(perfTimer);
    };
  }, []);

  // Rust pushes updates as soon as the local APIs respond.
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    let unlisteners: UnlistenFn[] = [];

    const setup = async () => {
      const listeners = await Promise.all([
        listen<LiveGame>("live-update", (event) => setRawLive(event.payload)),
        listen<ChampSelect>("champ-select-update", (event) => setRawSelect(event.payload)),
        listen<DdragonStatus>("ddragon-status", (event) => setDdragon(event.payload)),
        listen<DdragonStatus>("cache-progress", (event) => setDdragon(event.payload)),
        listen<string>("ddragon-ready", () => {
          setReloadToken((value) => value + 1);
        }),
        listen<string>("ddragon-error", (event) => {
          setBootstrapError(event.payload);
        }),
        listen<boolean>("compact-mode-changed", (event) => setCompactState(event.payload)),
        listen<ShortcutTrigger>("shortcut-triggered", (event) => {
          const { action, active } = event.payload;
          if (action === "toggle-compact" && typeof active === "boolean") {
            setCompactState(active);
          }
          if (action === "toggle-visibility" && active === false) {
            pushToast("info", "Overlay hidden", "Use the visibility hotkey to bring HexCoach back.");
          }
        }),
        listen<HotkeyStatus>("hotkeys-changed", (event) => setHotkeyStatus(event.payload)),
        listen<boolean>("click-through-changed", (event) => {
          pushToast(
            "info",
            event.payload ? "Click-through enabled" : "Click-through disabled",
            event.payload
              ? "Mouse input now passes through the overlay. Press the hotkey again to restore it."
              : "The overlay accepts mouse input again.",
          );
        }),
        listen<boolean>("overlay-visibility-changed", (event) => {
          if (!event.payload) {
            pushToast("info", "Overlay hidden", "Use the visibility hotkey to bring HexCoach back.");
          }
        }),
        listen<HudOverlayState>("hud-clickthrough-changed", (event) => {
          setHudClickThrough(event.payload.clickThrough);
          if (event.payload.visible) {
            pushToast(
              "info",
              event.payload.interactive ? "HUD interactive" : "HUD click-through",
              event.payload.interactive
                ? "You can now click the in-game HUD. Press Alt+C to pass clicks through again."
                : "Mouse clicks pass straight through to League. Press Alt+C to interact.",
            );
          }
        }),
      ]);
      if (cancelled) {
        listeners.forEach((unlisten) => unlisten());
      } else {
        unlisteners = listeners;
      }
    };

    void setup().catch(() => undefined);
    return () => {
      cancelled = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  // Demo clock keeps the fake game timer ticking.
  useEffect(() => {
    if (!settings.demoMode) return;
    const timer = window.setInterval(() => setDemoClock((value) => value + 1), 5000);
    return () => window.clearInterval(timer);
  }, [settings.demoMode]);

  const live = useMemo<LiveGame>(() => {
    if (settings.demoMode && bootstrap) {
      const demoChampion = champion || bootstrap.champions[0]?.name || "Ahri";
      return demoVariant === "classic"
        ? createDemoLive(bootstrap, demoChampion, role)
        : createDemoAram(bootstrap, demoChampion, demoVariant);
    }
    return rawLive;
  }, [settings.demoMode, bootstrap, champion, role, rawLive, demoClock]);

  const champSelect = useMemo<ChampSelect>(() => {
    if (settings.demoMode && bootstrap) {
      const demoChampion = champion || bootstrap.champions[0]?.name || "Ahri";
      return createDemoChampSelect(bootstrap, demoChampion, role);
    }
    return rawSelect;
  }, [settings.demoMode, bootstrap, champion, role, rawSelect]);

  // Follow the champion picked in a real game so the overlay automatically shows the right plan.
  useEffect(() => {
    if (settings.demoMode || !live.active || !live.myChampion) return;
    const key = `${live.myChampion}:${live.myRole}`;
    if (trackedGame.current === key) return;
    trackedGame.current = key;
    setChampion(live.myChampion);
    const nextRole = normalizeRole(live.myRole);
    if (nextRole !== "NONE") setRole(nextRole);
  }, [settings.demoMode, live.active, live.myChampion, live.myRole]);

  // Mirror champ select as soon as the local client announces a pick.
  useEffect(() => {
    if (settings.demoMode || !champSelect.active || !champSelect.myChampion) return;
    const key = `${champSelect.myChampion}:${champSelect.myRole}`;
    if (trackedSelect.current === key) return;
    trackedSelect.current = key;
    setChampion(champSelect.myChampion);
    const nextRole = normalizeRole(champSelect.myRole);
    if (nextRole !== "NONE") setRole(nextRole);
  }, [settings.demoMode, champSelect.active, champSelect.myChampion, champSelect.myRole]);

  const buildMode = useMemo(() => {
    if (live.active) {
      if (live.isAram || live.isMayhem) return "ARAM";
      if (live.gameMode.toUpperCase() === "CHERRY") return "CHERRY";
    }
    return "CLASSIC";
  }, [live.active, live.isAram, live.isMayhem, live.gameMode]);

  const lcu = useMemo<LcuStatus>(() => {
    if (settings.demoMode) {
      return {
        connected: true,
        summoner: "HexCoach#EUW",
        champSelect: true,
        port: 2999,
        message: "Demo data",
      };
    }
    return rawLcu;
  }, [settings.demoMode, rawLcu]);

  // Fetch recommendations whenever the selection or patch changes.
  useEffect(() => {
    if (!bootstrap || !champion) {
      setRecommendation(null);
      return;
    }
    let cancelled = false;
    const current = ++reqId.current;
    setRecLoading(true);
    setRecError(null);

    void getRecommendation(champion, role)
      .then((next) => {
        if (cancelled || current !== reqId.current) return;
        setRecommendation(next);
      })
      .catch((error) => {
        if (cancelled || current !== reqId.current) return;
        setRecError(errorMessage(error));
      })
      .finally(() => {
        if (cancelled || current !== reqId.current) return;
        setRecLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bootstrap, champion, role, refreshTick]);

  // Fetch the full meta build (live provider -> curated -> cache).
  useEffect(() => {
    if (!bootstrap || !champion) {
      setChampionBuild(null);
      setBuildLoading(false);
      return;
    }
    let cancelled = false;
    const current = ++buildReqId.current;
    setBuildLoading(true);
    setBuildError(null);

    void getChampionBuild(champion, role, buildMode, buildTick > 0)
      .then((next) => {
        if (cancelled || current !== buildReqId.current) return;
        setChampionBuild(next);
      })
      .catch((error) => {
        if (cancelled || current !== buildReqId.current) return;
        setBuildError(errorMessage(error));
      })
      .finally(() => {
        if (cancelled || current !== buildReqId.current) return;
        setBuildLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bootstrap, champion, role, buildMode, buildTick]);

  const setCompact = useCallback((value: boolean) => {
    setCompactState(value);
    void applyCompactMode(value).catch(() => undefined);
  }, []);

  const saveSettings = useCallback(
    async (next: Settings) => {
      const clamped: Settings = {
        ...next,
        theme,
        overlayOpacity: Math.min(1, Math.max(0.55, next.overlayOpacity)),
        hotkeys: { ...next.hotkeys },
      };
      try {
        const saved = await persistSettings(clamped);
        setSettings(saved);
        const savedTheme = normalizeTheme(saved.theme);
        setThemeState(savedTheme);
        applyTheme(savedTheme);
        persistTheme(savedTheme);
        pushToast("success", "Settings saved", "Overlay preferences were written to disk.");
      } catch (error) {
        pushToast("error", "Could not save settings", errorMessage(error));
        throw error;
      }
    },
    [pushToast, theme],
  );

  const setTheme = useCallback((next: Theme) => {
    const resolved = normalizeTheme(next);
    setThemeState(resolved);
    applyTheme(resolved);
    persistTheme(resolved);
  }, []);

  const applyHotkeys = useCallback(
    async (hotkeys: Hotkeys) => {
      try {
        const status = await requestHotkeys(hotkeys);
        setHotkeyStatus(status);
        const failed = status.bindings.filter((binding) => !binding.registered);
        if (failed.length) {
          pushToast(
            "error",
            "Some shortcuts were not registered",
            failed
              .map(
                (binding) =>
                  `${binding.accelerator || binding.label}: ${binding.error ?? "unavailable"}`,
              )
              .join(" · "),
          );
        } else {
          pushToast(
            "success",
            "Global shortcuts active",
            "They now fire even while League of Legends has keyboard focus.",
          );
        }
        return status;
      } catch (error) {
        pushToast("error", "Could not register shortcuts", errorMessage(error));
        throw error;
      }
    },
    [pushToast],
  );

  const clearRiotKey = useCallback(async () => {
    try {
      const saved = await clearRiotKeyRequest();
      setSettings(saved);
      pushToast("success", "Local Riot key removed", "HexCoach will use the build-time key if one was provided.");
    } catch (error) {
      pushToast("error", "Could not clear the Riot key", errorMessage(error));
      throw error;
    }
  }, [pushToast]);

  const refreshData = useCallback(async () => {
    if (!isDesktop()) {
      pushToast("info", "Web preview", "Data Dragon refresh is available in the desktop app.");
      return;
    }
    try {
      pushToast("info", "Refreshing data", "Checking for the latest Data Dragon and CommunityDragon files.");
      await refreshDdragon();
      setReloadToken((value) => value + 1);
    } catch (error) {
      pushToast("error", "Refresh failed", errorMessage(error));
    }
  }, [pushToast]);

  const refreshRecommendation = useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []);

  const refreshBuild = useCallback(() => {
    setBuildTick((value) => value + 1);
  }, []);

  const retryBootstrap = useCallback(() => {
    setBootstrapError(null);
    setReloadToken((value) => value + 1);
  }, []);

  const importRunes = useCallback(async () => {
    const runes = championBuild?.runes ?? recommendation?.runes;
    if (!runes) {
      pushToast("info", "No rune page yet", "Pick a champion before importing runes.");
      return;
    }
    const page: RunePageInput = {
      name: runes.pageName,
      primaryStyleId: runes.primaryStyleId,
      subStyleId: runes.subStyleId,
      selectedPerkIds: runes.selectedPerkIds,
      current: true,
    };
    try {
      const message = await applyRunes(page);
      pushToast("success", "Runes imported", message);
    } catch (error) {
      pushToast("error", "Rune import failed", errorMessage(error));
    }
  }, [championBuild, recommendation, pushToast]);

  // Optionally auto-apply the recommended page once per game/champion combination.
  useEffect(() => {
    if (!settings.autoImport || settings.demoMode) return;
    const plan = championBuild ?? recommendation;
    if (!live.active || !plan || !lcu.connected) return;
    const key = `${live.myChampion}:${live.myRole}:${plan.champion}:${plan.role}:${plan.runes.pageName}`;
    if (autoImportKey.current === key) return;
    autoImportKey.current = key;
    void importRunes();
  }, [
    settings.autoImport,
    settings.demoMode,
    live.active,
    live.myChampion,
    live.myRole,
    lcu.connected,
    championBuild,
    recommendation,
    importRunes,
  ]);

  const value: AppStore = {
    bootstrap,
    bootstrapLoading,
    bootstrapError,
    ddragon,
    settings,
    live,
    champSelect,
    lcu,
    perf,
    appInfo,
    page,
    setPage,
    compact,
    setCompact,
    hudClickThrough,
    theme,
    setTheme,
    hotkeyStatus,
    applyHotkeys,
    champion,
    setChampion,
    role,
    setRole,
    recommendation,
    championBuild,
    buildLoading,
    buildError,
    buildMode,
    refreshBuild,
    recLoading,
    recError,
    refreshRecommendation,
    refreshData,
    retryBootstrap,
    saveSettings,
    clearRiotKey,
    importRunes,
    toasts,
    pushToast,
    dismissToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppStore {
  const store = useContext(AppContext);
  if (!store) throw new Error("useApp must be used inside AppProvider.");
  return store;
}
