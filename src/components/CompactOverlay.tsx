import {
  Maximize2,
  Minimize2,
  Radio,
  RefreshCw,
  Skull,
  Swords,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { championIcon, itemRefIcon } from "@/lib/assets";
import { isDesktop } from "@/lib/env";
import { cn, formatGameTime, gameModeLabel, roleLabel } from "@/lib/format";
import { useApp } from "@/state/store";
import { ImportRunesButton, SkillPanel } from "@/components/build";
import { RuneSummary, SmartImage, Spinner } from "@/components/shared";

async function closeWindow() {
  if (!isDesktop()) return;
  try {
    await getCurrentWindow().close();
  } catch {
    // Ignore in browser preview.
  }
}

export default function CompactOverlay() {
  const {
    bootstrap,
    live,
    recommendation,
    recLoading,
    settings,
    setCompact,
    perf,
    lcu,
    refreshRecommendation,
  } = useApp();

  if (!bootstrap) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent p-2">
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 border border-paper/30 bg-void">
          <Spinner />
          <p className="text-xs text-fog">Loading match data…</p>
        </div>
      </div>
    );
  }

  const loading = recLoading;
  const local = live.myTeam.find((player) => player.isLocal);
  const myChampion =
    bootstrap.champions.find((entry) => entry.name === (live.myChampion || recommendation?.champion)) ??
    bootstrap.champions.find((entry) => entry.name === recommendation?.champion);
  const core = recommendation ? [...recommendation.items.boots, ...recommendation.items.core] : [];
  const fedEnemies = [...live.enemyTeam].sort((a, b) => b.kills - a.kills);

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent p-1.5 font-sans">
      <div
        className="relative flex h-full w-full flex-col overflow-hidden border border-paper/30 bg-void shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        style={{ opacity: settings.overlayOpacity }}
      >
        <header
          data-tauri-drag-region
          className="drag-region relative z-10 flex h-9 shrink-0 items-center justify-between gap-2 border-b border-ink bg-paper px-2 text-ink"
        >
          <div className="flex min-w-0 items-center gap-1.5" data-tauri-drag-region>
            <div className="flex h-5 w-5 items-center justify-center border border-ink bg-ink">
              <Swords className="h-3 w-3 text-paper" strokeWidth={2.2} />
            </div>
            <span className="font-display text-[10px] font-bold tracking-[0.2em] text-ink">
              HEXCOACH
            </span>
            {settings.demoMode ? (
              <span className="border border-ink/40 px-1 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wider text-ink/70">
                Demo
              </span>
            ) : null}
          </div>
          <div className="no-drag flex items-center gap-0.5">
            <button
              type="button"
              className="icon-btn h-6 w-6 text-ink/60 hover:bg-ink hover:text-paper"
              onClick={() => setCompact(false)}
              title="Open dashboard"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="icon-btn h-6 w-6 text-ink/60 hover:bg-ink hover:text-paper"
              onClick={() => void closeWindow()}
              title="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </header>

        <div className="relative z-10 min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
          <section className="relative overflow-hidden border border-line bg-panel p-2">
            <div className="flex items-center gap-2">
              {myChampion ? (
                <SmartImage
                  sources={championIcon(bootstrap, myChampion)}
                  alt={myChampion.name}
                  className="h-10 w-10 shrink-0 rounded-md ring-1 ring-hextech-500/40"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-md bg-panel-3" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-display text-sm font-bold text-slate-50">
                    {myChampion?.name ?? "Waiting for game"}
                  </p>
                  {recommendation ? (
                    <span className="border border-paper/30 px-1 font-mono text-[8px] font-bold text-paper">
                      {recommendation.meta.tier}
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[9px] text-fog">
                  {live.active
                    ? `${roleLabel(live.myRole || recommendation?.role)} · Level ${local?.level ?? live.myLevel} · ${gameModeLabel(live.gameMode)}`
                    : `${roleLabel(recommendation?.role)} · Pre-game plan`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[11px] text-slate-100">
                  <span className="text-emerald-300">{local?.kills ?? 0}</span>
                  <span className="text-fog">/</span>
                  <span className="text-enemy-400">{local?.deaths ?? 0}</span>
                  <span className="text-fog">/</span>
                  <span className="text-hextech-300">{local?.assists ?? 0}</span>
                </p>
                <p className="font-mono text-[9px] text-fog">
                  {local ? `${local.creepScore} CS` : live.active ? "live" : "idle"}
                </p>
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
              <span className="flex items-center gap-1 text-[9px] text-fog">
                <Radio
                  className={cn("h-2.5 w-2.5", live.active ? "text-emerald-400" : "text-fog")}
                />
                {live.active ? formatGameTime(live.gameTime) : "No active game"}
              </span>
              <span className="flex items-center gap-1 text-[9px] text-fog">
                <span className={cn("h-1.5 w-1.5 rounded-full", lcu.connected ? "bg-emerald-400" : "bg-fog")} />
                LCU {lcu.connected ? "linked" : "offline"}
              </span>
            </div>
          </section>

          {loading && !recommendation ? (
            <div className="flex items-center justify-center gap-2 border border-line bg-panel py-8 text-[10px] text-fog">
              <Spinner className="h-3 w-3" /> Building recommendation…
            </div>
          ) : recommendation ? (
            <>
              <section className="border border-line bg-panel p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="hud-label">Core build</p>
                  <span className="font-mono text-[8px] text-gold-400">
                    {core.reduce((sum, item) => sum + item.price, 0)}g
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {core.map((item) => (
                    <div
                      key={item.id}
                      className="relative border border-line bg-abyss p-0.5"
                      title={`${item.name} — ${item.price}g`}
                    >
                      <SmartImage
                        sources={itemRefIcon(bootstrap, item.icon)}
                        alt={item.name}
                        className="h-8 w-8 rounded"
                      />
                    </div>
                  ))}
                  {recommendation.items.starter.slice(0, 2).map((item) => (
                    <div
                      key={`starter-${item.id}`}
                      className="relative border border-line/70 bg-abyss p-0.5 opacity-70"
                      title={`Starter: ${item.name}`}
                    >
                      <SmartImage
                        sources={itemRefIcon(bootstrap, item.icon)}
                        alt={item.name}
                        className="h-8 w-8 rounded"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-line bg-panel p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="hud-label">Runes</p>
                  <ImportRunesButton compact />
                </div>
                <RuneSummary bootstrap={bootstrap} runes={recommendation.runes} />
              </section>

              <section className="border border-line bg-panel p-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="hud-label">Skill order</p>
                  <span className="font-mono text-[8px] text-fog">{recommendation.skills.max.join(" > ")}</span>
                </div>
                <SkillPanel plan={recommendation.skills} />
              </section>

              <section className="border border-line bg-panel p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="hud-label flex items-center gap-1">
                    <Skull className="h-2.5 w-2.5 text-enemy-400" />
                    Enemy team
                  </p>
                  <span className="font-mono text-[8px] text-fog">
                    {live.enemyTeam.reduce((sum, player) => sum + player.kills, 0)} kills
                  </span>
                </div>
                {fedEnemies.length ? (
                  <div className="space-y-0.5">
                    {fedEnemies.map((player) => {
                      const enemyChampion = bootstrap.champions.find((entry) => entry.name === player.champion);
                      const fed = player.kills - player.deaths >= 3;
                      return (
                        <div
                          key={`${player.summonerName}-${player.champion}`}
                          className="flex items-center gap-1.5 border border-transparent px-1 py-0.5 hover:border-line"
                        >
                          {enemyChampion ? (
                            <SmartImage
                              sources={championIcon(bootstrap, enemyChampion)}
                              alt={player.champion}
                              className="h-6 w-6 shrink-0 rounded ring-1 ring-white/10"
                            />
                          ) : null}
                          <p className="min-w-0 flex-1 truncate text-[10px] text-slate-200">
                            {player.champion}
                            {fed ? <span className="ml-1 text-[8px] font-bold text-enemy-400">FED</span> : null}
                          </p>
                          <p className="font-mono text-[9px] text-fog">
                            <span className={fed ? "text-enemy-400" : "text-slate-300"}>{player.kills}</span>/
                            {player.deaths}/{player.assists}
                          </p>
                          <span className="w-8 text-right font-mono text-[8px] text-fog">
                            {player.creepScore}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-2 text-center text-[10px] text-fog">No enemy data yet.</p>
                )}
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 border border-dashed border-paper/20 bg-panel px-3 py-8 text-center">
              <Swords className="h-6 w-6 text-hextech-400" />
              <p className="text-[11px] font-semibold text-slate-200">No build loaded</p>
              <p className="text-[10px] text-fog">Pick a champion in the dashboard.</p>
              <button type="button" className="btn btn-ghost" onClick={refreshRecommendation}>
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}
        </div>

        <footer className="relative z-10 flex h-7 shrink-0 items-center justify-between border-t border-ink bg-paper px-2 text-[8px] text-ink/65">
          <span className="flex items-center gap-2">
            <span>PATCH {bootstrap.version}</span>
            <span>{settings.performanceHud ? `${perf.ramMb ? perf.ramMb.toFixed(0) : "—"} MB` : ""}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-ink">{perf.liveLatencyMs || live.latencyMs} ms</span>
            <button
              type="button"
              className="flex items-center gap-1 text-[8px] text-ink/60 hover:text-ink"
              onClick={() => setCompact(false)}
            >
              <Minimize2 className="h-2.5 w-2.5 rotate-180" />
              Dashboard
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
