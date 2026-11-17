import {
  Activity,
  AlertTriangle,
  Crosshair,
  Flame,
  Hammer,
  Info,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  Target,
} from "lucide-react";
import { championIcon, championSplash } from "@/lib/assets";
import { cn, roleLabel, tierTone, winRateTone } from "@/lib/format";
import { useApp } from "@/state/store";
import { ChampionPicker, RoleTabs } from "@/components/pickers";
import {
  BuildScore,
  CopyBuildButton,
  DataSourceNote,
  ImportRunesButton,
  ItemTimeline,
  MatchupList,
  MetaScore,
  RunePagePanel,
  SkillPanel,
  SummonerSpellList,
  TipList,
} from "@/components/build";
import { EmptyState, Panel, SmartImage, Spinner, TierBadge } from "@/components/shared";

function StatLine({ label, value, suffix }: { label: string; value: number | undefined; suffix?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-1 last:border-0">
      <span className="text-[10px] text-fog">{label}</span>
      <span className="font-mono text-[11px] text-slate-200">
        {value === undefined || !Number.isFinite(value)
          ? "—"
          : Number.isInteger(value)
            ? value
            : value.toFixed(2)}
        {suffix ?? ""}
      </span>
    </div>
  );
}

function MetaStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="border-b border-line py-1 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] text-fog">{label}</span>
        <span className={cn("font-mono text-[11px] text-slate-200", tone)}>{value}</span>
      </div>
      {hint ? <p className="text-[9px] text-fog/70">{hint}</p> : null}
    </div>
  );
}

export default function BuildsPage() {
  const {
    bootstrap,
    champion,
    recommendation,
    championBuild,
    buildLoading,
    buildError,
    refreshBuild,
    recLoading,
    recError,
    refreshRecommendation,
    role,
    settings,
    lcu,
    importRunes,
  } = useApp();

  if (!bootstrap) return null;

  const myChampion = bootstrap.champions.find((entry) => entry.name === champion);
  const stats = (myChampion?.stats ?? {}) as Record<string, number>;
  const build = championBuild;
  const loading = (buildLoading || recLoading) && !build;
  const error = buildError ?? recError;
  const tier = build?.tier ?? recommendation?.meta.tier;
  const winRate = build?.winRate ?? recommendation?.meta.estimatedWinRate;
  const winRateLabel = build?.winRateLabel ?? recommendation?.meta.label;
  const coachNotes = build
    ? Array.from(new Set([...(build.tips ?? []), ...(build.notes ?? [])]))
    : (recommendation?.tips ?? []);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-wide text-slate-100">Builds & Runes</h1>
            <span className="chip border-hextech-500/25 bg-hextech-500/[0.06] text-hextech-300">
              Patch {build?.patch ?? bootstrap.version}
            </span>
            {build?.cached ? (
              <span className="chip border-gold-500/25 bg-gold-500/[0.06] text-gold-400">Cached</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-fog">
            Item timeline, rune tree, skill order and counters · {build?.roleLabel ?? roleLabel(recommendation?.role ?? role)}
            {build ? ` · ${build.gameModeLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[230px]">
            <ChampionPicker compact />
          </div>
          <RoleTabs compact />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={refreshBuild}
            disabled={buildLoading}
            title="Refresh live meta data (bypasses the 12-hour cache)"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", buildLoading && "animate-spin")} />
            Refresh
          </button>
          <ImportRunesButton compact />
          <CopyBuildButton compact />
        </div>
      </div>

      <section className="hud-panel overflow-hidden">
        <div className="relative min-h-[156px]">
          {myChampion ? (
            <SmartImage
              sources={championSplash(bootstrap, myChampion)}
              alt={myChampion.name}
              className="absolute inset-0 h-full w-full opacity-40"
              imgClassName="object-cover object-[center_20%]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-void/85 via-transparent to-transparent" />

          <div className="relative flex flex-wrap items-center gap-4 p-4">
            {myChampion ? (
              <SmartImage
                sources={championIcon(bootstrap, myChampion)}
                alt={myChampion.name}
                className="h-[76px] w-[76px] shrink-0 rounded-xl ring-2 ring-hextech-500/40 shadow-glow"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-bold tracking-wide text-slate-50">{myChampion?.name}</h2>
                {tier ? <TierBadge tier={tier} /> : null}
                {winRate !== undefined ? (
                  <span className={cn("font-mono text-[11px]", winRateTone(winRate))}>
                    {winRate.toFixed(1)}% {winRateLabel}
                  </span>
                ) : null}
                {build?.rank ? (
                  <span className="chip">
                    #{build.rank}
                    {build.totalChampions ? ` of ${build.totalChampions}` : ""}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-mist">
                {myChampion ? `${myChampion.title} · ${myChampion.partype}` : "Select a champion"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {myChampion?.tags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
                {build ? (
                  <>
                    <span className="chip border-hextech-500/20 text-hextech-300">Source: {build.source}</span>
                    <span className="chip border-gold-500/20 text-gold-400">
                      {build.gameModeLabel}
                    </span>
                  </>
                ) : recommendation ? (
                  <>
                    <span className="chip border-hextech-500/20 text-hextech-300">
                      Build: {recommendation.buildSource}
                    </span>
                    <span className="chip border-gold-500/20 text-gold-400">
                      Runes: {recommendation.runeSource}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="w-full max-w-[300px] space-y-1.5">
              {build ? (
                <BuildScore build={build} />
              ) : recommendation ? (
                <MetaScore recommendation={recommendation} />
              ) : null}
              {build ? (
                <p className="rounded-md border border-line px-2 py-1 text-[9px] leading-relaxed text-fog">
                  {build.sourceDetail}
                </p>
              ) : recommendation ? (
                <p className={cn("rounded-md border px-2 py-1 text-[9px] leading-relaxed", tierTone(recommendation.meta.tier))}>
                  {recommendation.meta.note}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {error && !build ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load this champion"
          message={error}
          action={
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                refreshBuild();
                refreshRecommendation();
              }}
            >
              Try again
            </button>
          }
        />
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-panel/50 py-16 text-xs text-fog">
          <Spinner /> Building {champion}…
        </div>
      ) : build ? (
        <>
          <Panel
            icon={Hammer}
            title="Item timeline"
            subtitle="Start → core → situational"
            action={
              <div className="flex items-center gap-1.5">
                <span className="hidden font-mono text-[9px] text-fog sm:inline">
                  core {build.coreItems.reduce((sum, item) => sum + item.price, 0)}g
                </span>
                <CopyBuildButton />
              </div>
            }
            bodyClassName="p-3"
          >
            <ItemTimeline
              bootstrap={bootstrap}
              start={build.startingItems}
              core={build.coreItems}
              situational={build.situationalItems}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
              <DataSourceNote build={build} />
              <span className="text-[10px] text-fog">
                {build.coreItems.length + build.situationalItems.length} purchase slots
              </span>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3.5">
              <Panel
                icon={Sparkles}
                title="Rune page"
                subtitle={build.runes.pageName}
                action={<span className="chip">9 perks</span>}
                bodyClassName="p-3"
              >
                <RunePagePanel
                  bootstrap={bootstrap}
                  runes={build.runes}
                  onImport={() => void importRunes()}
                  importDisabled={!lcu.connected || settings.demoMode}
                  importHint={
                    settings.demoMode
                      ? "Disable demo mode and open the League client to import."
                      : !lcu.connected
                        ? "League client not detected."
                        : "Writes the page through the local LCU API."
                  }
                />
              </Panel>

              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                <Panel
                  icon={Flame}
                  title="Summoner spells"
                  subtitle="Mode-aware defaults"
                  bodyClassName="p-3"
                >
                  <SummonerSpellList bootstrap={bootstrap} spells={build.summonerSpells} />
                </Panel>
                <Panel icon={Crosshair} title="Skill order" subtitle={build.skillOrder.note} bodyClassName="p-3">
                  <SkillPanel plan={build.skillOrder} />
                </Panel>
              </div>

              <Panel
                icon={Shield}
                title="Matchups & counter picks"
                subtitle={`${build.roleLabel} · ${build.gameModeLabel}`}
                bodyClassName="p-3"
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="hud-label mb-1.5 flex items-center gap-1">
                      <Swords className="h-3 w-3 text-emerald-400" />
                      Strong against
                    </p>
                    <MatchupList
                      bootstrap={bootstrap}
                      entries={build.counters}
                      tone="strong"
                      empty="No favourable matchups found."
                    />
                  </div>
                  <div>
                    <p className="hud-label mb-1.5 flex items-center gap-1">
                      <Target className="h-3 w-3 text-enemy-400" />
                      Countered by
                    </p>
                    <MatchupList
                      bootstrap={bootstrap}
                      entries={build.threats}
                      tone="threat"
                      empty="No counter notes for this champion."
                    />
                  </div>
                  <div>
                    <p className="hud-label mb-1.5 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-arcane-400" />
                      Good with
                    </p>
                    <MatchupList
                      bootstrap={bootstrap}
                      entries={build.synergies}
                      tone="synergy"
                      empty="No synergy notes for this champion."
                    />
                  </div>
                </div>
              </Panel>
            </div>

            <div className="space-y-3.5">
              <Panel
                icon={Activity}
                title="Live meta"
                subtitle={`Patch ${build.patch} · ${build.winRateLabel}`}
                bodyClassName="px-3 py-2"
              >
                <MetaStat
                  label="Win rate"
                  value={`${build.winRate.toFixed(1)}%`}
                  tone={winRateTone(build.winRate)}
                  hint={build.winRateLabel === "EST. WR" ? "Offline heuristic, not Riot data" : "Emerald+ sample"}
                />
                <MetaStat label="Pick rate" value={`${build.pickRate.toFixed(1)}%`} />
                <MetaStat
                  label="Ban rate"
                  value={build.banRate > 0 ? `${build.banRate.toFixed(1)}%` : "—"}
                />
                <MetaStat
                  label="Games"
                  value={build.games > 0 ? build.games.toLocaleString() : "—"}
                />
                <MetaStat
                  label="Tier"
                  value={build.tier}
                  tone={tierTone(build.tier)}
                  hint={build.rank ? `Rank #${build.rank}${build.totalChampions ? ` of ${build.totalChampions}` : ""}` : undefined}
                />
                <MetaStat label="Provider" value={build.source} />
                <p className="mt-2 border-t border-line pt-2 text-[9px] leading-relaxed text-fog">
                  {build.sourceDetail}
                </p>
                <p className="mt-1 text-[9px] text-fog/80">
                  Fetched {new Date(build.fetchedAtMs).toLocaleString()} ·{" "}
                  {build.cached ? "cache hit (12h TTL)" : "fresh fetch"}
                </p>
              </Panel>

              <Panel icon={Info} title="Coach notes" subtitle="How to pilot this plan" bodyClassName="p-3">
                {coachNotes.length ? (
                  <TipList tips={coachNotes} />
                ) : (
                  <p className="text-[11px] text-fog">No notes for this champion yet.</p>
                )}
              </Panel>

              {myChampion ? (
                <Panel icon={Activity} title="Base stats" subtitle="Data Dragon champion stats" bodyClassName="px-3 py-2">
                  <StatLine label="Health" value={stats.hp} />
                  <StatLine label="Armor" value={stats.armor} />
                  <StatLine label="Magic resist" value={stats.spellblock} />
                  <StatLine label="Attack damage" value={stats.attackdamage} />
                  <StatLine label="Attack speed" value={stats.attackspeed} />
                  <StatLine label="Move speed" value={stats.movespeed} />
                </Panel>
              ) : null}

              {build.warnings.length ? (
                <Panel
                  icon={AlertTriangle}
                  title="Patch warnings"
                  subtitle="Names missing from the current Data Dragon patch"
                  accent="bg-gold-500/30"
                  bodyClassName="space-y-1 p-3"
                >
                  {build.warnings.map((warning) => (
                    <p key={warning} className="text-[10px] leading-relaxed text-gold-400">
                      {warning}
                    </p>
                  ))}
                </Panel>
              ) : null}

              <div className="rounded-lg border border-line bg-abyss/30 px-3 py-2 text-[10px] leading-relaxed text-fog">
                <p className="flex items-center gap-1.5 text-hextech-300">
                  <Info className="h-3 w-3" />
                  One-click rune import
                </p>
                <p className="mt-1">
                  HexCoach talks to the local League Client API on <span className="font-mono">127.0.0.1</span>. Your
                  Riot API key is only stored locally and is never required for rune import.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : recommendation ? (
        <EmptyState
          icon={AlertTriangle}
          title="Full meta build unavailable"
          message="The curated recommendation is still available. Refresh to retry the live provider."
          action={
            <button type="button" className="btn btn-ghost" onClick={refreshBuild}>
              Retry build
            </button>
          }
        />
      ) : null}
    </div>
  );
}
