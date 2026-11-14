import { useEffect, type ComponentType } from "react";
import { AlertTriangle, Database, Loader2, Swords } from "lucide-react";
import { useApp } from "@/state/store";
import type { Page } from "@/lib/types";
import { isDesktop } from "@/lib/env";
import TitleBar from "@/components/TitleBar";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import StatusBar from "@/components/StatusBar";
import Toasts from "@/components/Toasts";
import CompactOverlay from "@/components/CompactOverlay";
import InGameHud from "@/components/InGameHud";
import LiveGamePage from "@/pages/LiveGame";
import DraftPage from "@/pages/Draft";
import BuildsPage from "@/pages/Builds";
import ArenaPage from "@/pages/Arena";
import AramMayhemPage from "@/pages/AramMayhem";
import SettingsPage from "@/pages/Settings";

const PAGES: Record<Page, ComponentType> = {
  live: LiveGamePage,
  draft: DraftPage,
  builds: BuildsPage,
  arena: ArenaPage,
  aram: AramMayhemPage,
  settings: SettingsPage,
};

const IS_HUD_ROUTE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("hud") === "1";

function LoadingPanel({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md border border-paper/25 bg-panel p-6 text-center shadow-panel">
        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-paper/50">
          {error ? (
            <AlertTriangle className="h-5 w-5 text-gold-400" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-paper" />
          )}
        </div>
        <h2 className="mt-3 font-display text-lg font-bold tracking-[0.12em] text-paper">
          {error ? "Waiting for static data" : "Preparing HexCoach"}
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-fog">
          {isDesktop()
            ? "Fetching the latest Data Dragon patch and warming the local image cache. The first launch can take a moment."
            : "Loading Data Dragon from the public CDN for the web preview."}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 border border-paper/20 px-3 py-2 text-[10px] text-mist">
          <Database className="h-3.5 w-3.5" />
          <span className="truncate">{error ?? "Data Dragon · CommunityDragon · runes · items"}</span>
        </div>
        {error ? (
          <div className="mt-4 space-y-2">
            <p className="border border-enemy-500/40 bg-enemy-500/[0.06] px-2.5 py-2 text-left text-[10px] leading-relaxed text-enemy-400">
              {error}
            </p>
            <button type="button" className="btn btn-primary w-full" onClick={onRetry}>
              <Swords className="h-3.5 w-3.5" />
              Retry now
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const {
    bootstrap,
    bootstrapError,
    retryBootstrap,
    compact,
    setCompact,
    page,
    settings,
  } = useApp();

  // In-app shortcut; the desktop build also registers the global hotkeys in Rust.
  useEffect(() => {
    if (isDesktop()) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setCompact(!compact);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact, setCompact]);

  if (IS_HUD_ROUTE) {
    return (
      <>
        <InGameHud />
        <Toasts />
      </>
    );
  }

  if (compact) {
    return (
      <>
        <CompactOverlay />
        <Toasts />
      </>
    );
  }

  const PageComponent = PAGES[page];

  return (
    <>
      <div className="h-screen w-screen overflow-hidden bg-transparent p-2.5">
        <div
          className="relative flex h-full w-full flex-col overflow-hidden border border-paper/30 bg-void shadow-panel"
          style={{ opacity: settings.overlayOpacity }}
        >
          <div className="pointer-events-none absolute inset-0 bg-hud-grid bg-[length:44px_44px] opacity-40" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-hextech-400/40 to-transparent" />

          <TitleBar />

          {!bootstrap ? (
            <LoadingPanel error={bootstrapError} onRetry={retryBootstrap} />
          ) : (
            <>
              <MobileNav />
              <div className="relative z-10 flex min-h-0 flex-1">
                <Sidebar />
                <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                  <div key={page} className="mx-auto max-w-[1540px] animate-rise px-3 py-3.5 sm:px-4">
                    <PageComponent />
                  </div>
                </main>
              </div>
              <StatusBar />
            </>
          )}
        </div>
      </div>
      <Toasts />
    </>
  );
}
