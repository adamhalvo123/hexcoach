import {
  Activity,
  AlertTriangle,
  Crosshair,
  Hammer,
  Info,
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
  BuildGroups,
  CopyBuildButton,
  DataSourceNote,
  ImportRunesButton,
  MatchupList,
  MetaScore,
  RunePagePanel,
  SkillPanel,
  TipList,
} from "@/components/build";
import { EmptyState, Panel, SmartImage, Spinner, TierBadge } from "@/components/shared";

function StatLine({ label, value, suffix }: { label: string; value: number | undefined; suffix?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-1 last:border-0">
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

export default function BuildsPage() {
  const {
    bootstrap,
    champion,
    recommendation,
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

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-wide text-slate-100">Builds & Runes</h1>
            <span className="chip border-hextech-500/25 bg-hextech-500/[0.06] text-hextech-300">
              Patch {bootstrap.version}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-fog">
            Item paths, rune pages and skill order · {roleLabel(recommendation?.role ?? role)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[230px]">
            <ChampionPicker compact />
          </div>
          <RoleTabs compact />
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
                {recommendation ? <TierBadge tier={recommendation.meta.tier} /> : null}
                {recommendation ? (
                  <span className={cn("font-mono text-[11px]", winRateTone(recommendation.meta.estimatedWinRate))}>
                    {recommendation.meta.estimatedWinRate.toFixed(1)}% {recommendation.meta.label}
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
                {recommendation ? (
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
            {recommendation ? (
              <div className="w-full max-w-[290px] space-y-1.5">
                <MetaScore recommendation={recommendation} />
                <p className={cn("rounded-md border px-2 py-1 text-[9px] leading-relaxed", tierTone(recommendation.meta.tier))}>
                  {recommendation.meta.note}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {recError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load this champion"
          message={recError}
          action={
            <button type="button" className="btn btn-ghost" onClick={refreshRecommendation}>
              Try again
            </button>
          }
        />
      ) : recLoading && !recommendation ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-panel/50 py-16 text-xs text-fog">
          <Spinner /> Building {champion}…
        </div>
      ) : recommendation ? (
        <>
          <Panel
            icon={Hammer}
            title="Item build"
            subtitle="Starter → boots → core → situational"
            action={
              <div className="flex items-center gap-1.5">
                <span className="hidden font-mono text-[9px] text-fog sm:inline">
                  core {recommendation.items.core.reduce((sum, item) => sum + item.price, 0)}g
                </span>
                <CopyBuildButton />
              </div>
            }
            bodyClassName="p-3"
          >
            <BuildGroups bootstrap={bootstrap} items={recommendation.items} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-2.5">
              <DataSourceNote />
              <span className="text-[10px] text-fog">
                {recommendation.items.core.length + recommendation.items.boots.length} core slots
              </span>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3.5">
              <Panel
                icon={Sparkles}
                title="Rune page"
                subtitle={recommendation.runes.pageName}
                action={<span className="chip">9 perks</span>}
                bodyClassName="p-3"
              >
                <RunePagePanel
                  bootstrap={bootstrap}
                  runes={recommendation.runes}
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

              <Panel icon={Crosshair} title="Skill order" subtitle={recommendation.skills.note} bodyClassName="p-3">
                <SkillPanel plan={recommendation.skills} />
              </Panel>

              <Panel icon={Shield} title="Matchups" subtitle="Curated counters and synergies" bodyClassName="p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="hud-label mb-1.5 flex items-center gap-1">
                      <Swords className="h-3 w-3 text-enemy-400" />
                      Strong against
                    </p>
                    <MatchupList
                      bootstrap={bootstrap}
                      entries={recommendation.counters}
                      tone="counter"
                      empty="No counter notes for this champion."
                    />
                  </div>
                  <div>
                    <p className="hud-label mb-1.5 flex items-center gap-1">
                      <Target className="h-3 w-3 text-emerald-400" />
                      Good with
                    </p>
                    <MatchupList
                      bootstrap={bootstrap}
                      entries={recommendation.synergies}
                      tone="synergy"
                      empty="No synergy notes for this champion."
                    />
                  </div>
                </div>
              </Panel>
            </div>

            <div className="space-y-3.5">
              <Panel icon={Info} title="Coach notes" subtitle="How to pilot this plan" bodyClassName="p-3">
                <TipList tips={recommendation.tips} />
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

              {recommendation.warnings.length ? (
                <Panel
                  icon={AlertTriangle}
                  title="Patch warnings"
                  subtitle="Names missing from the current Data Dragon patch"
                  accent="bg-gold-500/30"
                  bodyClassName="space-y-1 p-3"
                >
                  {recommendation.warnings.map((warning) => (
                    <p key={warning} className="text-[10px] leading-relaxed text-gold-400">
                      {warning}
                    </p>
                  ))}
                </Panel>
              ) : null}

              <div className="rounded-lg border border-white/[0.05] bg-abyss/30 px-3 py-2 text-[10px] leading-relaxed text-fog">
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
      ) : null}
    </div>
  );
}
