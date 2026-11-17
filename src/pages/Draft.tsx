import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  ChevronRight,
  RefreshCw,
  Scale,
  Sparkles,
  Swords,
  Target,
  Users,
} from "lucide-react";
import { championIcon } from "@/lib/assets";
import { getDraftRecommendations, errorMessage } from "@/lib/api";
import { cn, normalizeRole, roleLabel, roleShort, tierTone, winRateTone } from "@/lib/format";
import type { RolePick } from "@/lib/types";
import { useApp } from "@/state/store";
import { ChampionPicker, EnemySelects, RoleTabs } from "@/components/pickers";
import { MatchupList, TipList } from "@/components/build";
import { EmptyState, Panel, ScoreBar, SmartImage, Spinner, TierBadge } from "@/components/shared";

function DraftRow({ champion, name, position, local }: { champion: any; name: string; position: string; local?: boolean }) {
  const { bootstrap } = useApp();
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5",
        local ? "border-hextech-500/30 bg-hextech-500/[0.06]" : "border-line bg-abyss/30",
      )}
    >
      {champion && bootstrap ? (
        <SmartImage
          sources={championIcon(bootstrap, champion)}
          alt={champion.name}
          className="h-7 w-7 shrink-0 rounded ring-1 ring-line-strong"
        />
      ) : (
        <span className="h-7 w-7 shrink-0 rounded border border-dashed border-line-strong bg-panel-2" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[11px] font-semibold", local ? "text-hextech-200" : "text-slate-200")}>
          {champion?.name ?? name ?? "—"}
        </p>
        <p className="truncate text-[9px] text-fog">{name || roleShort(position)}</p>
      </div>
      <span className="font-mono text-[9px] text-fog">{roleShort(position)}</span>
    </div>
  );
}

export default function DraftPage() {
  const {
    bootstrap,
    champion,
    setChampion,
    role,
    setRole,
    champSelect,
    recommendation,
    championBuild,
    buildLoading,
    recLoading,
    settings,
    setPage,
    pushToast,
  } = useApp();

  const [enemies, setEnemies] = useState<string[]>(["", "", "", "", ""]);
  const [picks, setPicks] = useState<RolePick[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const liveRole = normalizeRole(champSelect.myRole);
  const effectiveRole = role !== "NONE" ? role : liveRole !== "NONE" ? liveRole : "MIDDLE";
  const activeEnemies = useMemo(() => enemies.map((entry) => entry.trim()).filter(Boolean), [enemies]);
  const enemyKey = activeEnemies.join("|");

  useEffect(() => {
    if (!bootstrap) return;
    let cancelled = false;
    setLoading(true);
    setDraftError(null);
    void getDraftRecommendations(effectiveRole, activeEnemies)
      .then((result) => {
        if (!cancelled) setPicks(result);
      })
      .catch((error) => {
        if (!cancelled) setDraftError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap, effectiveRole, enemyKey, reloadTick]);

  if (!bootstrap) return null;

  const myChampion = bootstrap.champions.find((entry) => entry.name === champion);
  const enemyChampion = (name: string) => bootstrap.champions.find((entry) => entry.name === name);

  const plan = championBuild ?? recommendation;
  const planTier = championBuild?.tier ?? recommendation?.meta.tier;
  const planScore = championBuild?.score ?? recommendation?.meta.score;
  const planLoading = (buildLoading || recLoading) && !plan;
  const strongAgainst = championBuild?.counters ?? recommendation?.counters ?? [];
  const watchOut = championBuild?.threats ?? [];
  const planTips = championBuild
    ? Array.from(new Set([...championBuild.tips, ...championBuild.notes]))
    : (recommendation?.tips ?? []);
  const planWarnings = championBuild?.warnings ?? recommendation?.warnings ?? [];

  const syncLive = () => {
    if (!champSelect.active) return;
    setChampion(champSelect.myChampion);
    const nextRole = normalizeRole(champSelect.myRole);
    if (nextRole !== "NONE") setRole(nextRole);
    setEnemies(
      Array.from({ length: 5 }, (_, index) => champSelect.enemyTeam[index]?.champion ?? ""),
    );
    pushToast("info", "Live draft synced", "Champion, role and enemy picks were loaded.");
  };

  const setEnemy = (index: number, value: string) => {
    setEnemies((current) => current.map((entry, position) => (position === index ? value : entry)));
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-wide text-slate-100">Draft Helper</h1>
            <span className="chip border-gold-500/25 bg-gold-500/[0.06] text-gold-400">EST. WR</span>
          </div>
          <p className="mt-0.5 text-[11px] text-fog">
            Counter picks and synergy heuristics for {roleLabel(effectiveRole)} · offline meta, not Riot match data
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RoleTabs />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setReloadTick((value) => value + 1)}
            disabled={loading}
            title="Re-run draft analysis"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Analyze
          </button>
          <button type="button" className="btn btn-primary" onClick={syncLive} disabled={!champSelect.active}>
            <Users className="h-3.5 w-3.5" />
            Sync live draft
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="space-y-3.5">
          <Panel icon={Swords} title="Draft setup" subtitle="Your pick and the enemy five" bodyClassName="space-y-3 p-3">
            <div className="space-y-1.5">
              <p className="hud-label">Your champion</p>
              <ChampionPicker />
              {myChampion ? (
                <div className="flex flex-wrap gap-1">
                  {myChampion.tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="hud-label">Enemy picks</p>
                <button
                  type="button"
                  className="text-[10px] text-fog transition-colors hover:text-enemy-400"
                  onClick={() => setEnemies(["", "", "", "", ""])}
                >
                  Clear all
                </button>
              </div>
              <EnemySelects enemies={enemies} onChange={setEnemy} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-line bg-abyss/30 px-2.5 py-2 text-[10px] text-fog">
              <span>
                Analyzing <span className="text-hextech-300">{activeEnemies.length}</span> enemy picks
              </span>
              <span className="flex items-center gap-1">
                <Scale className="h-3 w-3" />
                {activeEnemies.length ? `+8 score per countered pick` : "Add enemies for counter bonuses"}
              </span>
            </div>
          </Panel>

          <Panel
            icon={Users}
            title="Live champ select"
            subtitle={champSelect.active ? `${champSelect.phase.replaceAll("_", " ")} · ${champSelect.timeLeft}s` : "Waiting for champ select"}
            action={
              champSelect.isMyTurn ? (
                <span className="chip border-gold-500/30 bg-gold-500/10 text-gold-300">Your turn</span>
              ) : null
            }
            accent={champSelect.active ? "bg-gold-500/30" : undefined}
            bodyClassName="space-y-2 p-3"
          >
            {champSelect.active ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="hud-label text-hextech-400">Allies</p>
                    {champSelect.myTeam.map((player) => (
                      <DraftRow
                        key={`ally-${player.cellId}-${player.champion}`}
                        champion={enemyChampion(player.champion)}
                        name={player.summonerName}
                        position={player.position}
                        local={player.isLocal}
                      />
                    ))}
                  </div>
                  <div className="space-y-1">
                    <p className="hud-label text-enemy-400">Enemies</p>
                    {champSelect.enemyTeam.map((player) => (
                      <DraftRow
                        key={`enemy-${player.cellId}-${player.champion}`}
                        champion={enemyChampion(player.champion)}
                        name={player.summonerName}
                        position={player.position}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="hud-label flex items-center gap-1">
                    <Ban className="h-3 w-3 text-enemy-400" />
                    Bans
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {champSelect.myBans.map((name) => (
                      <span key={`my-${name}`} className="chip border-hextech-500/20 text-hextech-300">
                        {name}
                      </span>
                    ))}
                    {champSelect.enemyBans.map((name) => (
                      <span key={`enemy-${name}`} className="chip border-enemy-500/20 text-enemy-400">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>

                <button type="button" className="btn btn-ghost w-full" onClick={syncLive}>
                  Load into draft helper
                  <ArrowRight className="h-3 w-3" />
                </button>
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[11px] text-fog">
                Open the League client champ select to mirror picks live.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-3.5">
          <Panel
            icon={Target}
            title="Recommended picks"
            subtitle={`${roleLabel(effectiveRole)} · ranked by curated meta score and enemy counters`}
            action={<span className="chip">{picks.length} picks</span>}
            bodyClassName="space-y-1.5 p-2"
          >
            {draftError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Draft analysis failed"
                message={draftError}
                action={
                  <button type="button" className="btn btn-ghost" onClick={() => setReloadTick((v) => v + 1)}>
                    Try again
                  </button>
                }
              />
            ) : loading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex animate-pulse items-center gap-3 rounded-lg border border-line bg-slate-500/10 p-2.5"
                  >
                    <div className="h-11 w-11 rounded-md bg-slate-500/10" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-1/3 rounded bg-slate-500/10" />
                      <div className="h-2 w-2/3 rounded bg-slate-500/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : picks.length ? (
              picks.map((pick) => {
                const entry = bootstrap.champions.find((champ) => champ.name === pick.champion);
                const selected = pick.champion === plan?.champion;
                return (
                  <button
                    key={pick.champion}
                    type="button"
                    onClick={() => setChampion(pick.champion)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-all",
                      selected
                        ? "border-hextech-500/40 bg-hextech-500/[0.07] shadow-inner-line"
                        : "border-line bg-abyss/20 hover:border-hextech-500/25 hover:bg-panel-3/40",
                    )}
                  >
                    {entry ? (
                      <SmartImage
                        sources={championIcon(bootstrap, entry)}
                        alt={entry.name}
                        className="h-11 w-11 shrink-0 rounded-md ring-1 ring-line-strong"
                      />
                    ) : (
                      <span className="h-11 w-11 shrink-0 rounded-md bg-panel-3" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-slate-100">{pick.champion}</span>
                        <TierBadge tier={pick.tier} size="sm" />
                        <span className={cn("font-mono text-[10px]", winRateTone(pick.estimatedWinRate))}>
                          {pick.estimatedWinRate.toFixed(1)}% EST
                        </span>
                        {selected ? (
                          <span className="chip border-hextech-500/30 text-hextech-300">Selected</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-fog">{pick.reason}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {pick.counters.slice(0, 4).map((counter) => (
                          <span
                            key={counter}
                            className="rounded border border-enemy-500/15 bg-enemy-500/[0.05] px-1.5 py-0.5 text-[9px] text-enemy-400"
                          >
                            vs {counter}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <p className="font-mono text-sm text-slate-100">{pick.score}</p>
                      <p className="text-[9px] text-fog">meta score</p>
                      <ScoreBar score={pick.score} className="mt-1" />
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-fog transition-colors group-hover:text-hextech-300" />
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon={Swords}
                title={`No curated picks for ${roleLabel(effectiveRole)}`}
                message="Try another role or add enemy picks. HexCoach only ranks champions present in the curated patch data."
              />
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Panel
              icon={Swords}
              title="Matchup plan"
              subtitle={plan ? `${plan.champion} · ${plan.roleLabel}` : "Select a pick"}
              action={
                planTier ? (
                  <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", tierTone(planTier))}>
                    {planTier} · {planScore}
                  </span>
                ) : null
              }
              bodyClassName="space-y-3 p-3"
            >
              {planLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-fog">
                  <Spinner /> Loading matchup plan…
                </div>
              ) : plan ? (
                <>
                  <div>
                    <p className="hud-label mb-1.5">Strong against</p>
                    <MatchupList
                      bootstrap={bootstrap}
                      entries={strongAgainst}
                      tone="strong"
                      empty="No counter data."
                    />
                  </div>
                  {watchOut.length ? (
                    <div>
                      <p className="hud-label mb-1.5">Watch out for</p>
                      <MatchupList
                        bootstrap={bootstrap}
                        entries={watchOut}
                        tone="threat"
                        empty="No counter data."
                      />
                    </div>
                  ) : null}
                  <div>
                    <p className="hud-label mb-1.5">Works with</p>
                    <MatchupList
                      bootstrap={bootstrap}
                      entries={plan.synergies}
                      tone="synergy"
                      empty="No synergy data."
                    />
                  </div>
                  <button type="button" className="btn btn-primary w-full" onClick={() => setPage("builds")}>
                    Open full build
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <p className="py-6 text-center text-xs text-fog">Pick a champion to see matchup notes.</p>
              )}
            </Panel>

            <div className="space-y-3.5">
              <Panel icon={Sparkles} title="Draft tips" subtitle="Patch heuristics" bodyClassName="p-3">
                {planTips.length ? (
                  <TipList tips={planTips} />
                ) : (
                  <p className="py-4 text-center text-xs text-fog">Tips appear when a pick is selected.</p>
                )}
              </Panel>

              {planWarnings.length ? (
                <Panel
                  icon={AlertTriangle}
                  title="Data warnings"
                  subtitle="Items or runes missing from this patch"
                  bodyClassName="space-y-1 p-3"
                >
                  {planWarnings.map((warning) => (
                    <p key={warning} className="text-[10px] leading-relaxed text-gold-400">
                      {warning}
                    </p>
                  ))}
                </Panel>
              ) : null}

              <div className="rounded-lg border border-line bg-abyss/30 px-3 py-2 text-[10px] leading-relaxed text-fog">
                <span className="text-gold-400">EST. WR</span> is calculated from curated scores and class
                heuristics. It is not derived from Riot match history or a live win-rate provider.
                {settings.demoMode ? (
                  <span className="mt-1 block text-hextech-300">Demo mode supplies the live champ-select mirror.</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
