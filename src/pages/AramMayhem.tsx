import {
  Activity,
  Crosshair,
  Flame,
  HeartPulse,
  Info,
  Shield,
  Snowflake,
  Sparkles,
  Swords,
  Target,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { augmentIcon, championIcon } from "@/lib/assets";
import { findActiveAugments } from "@/lib/arena";
import {
  ARAM_MAYHEM_NOTE,
  ARAM_TIPS,
  aramBuild,
  findAramBalance,
  isAramGame,
  isMayhemGame,
  mayhemPicksFor,
  mayhemTierList,
} from "@/lib/aram";
import type { AramBalance } from "@/lib/types";
import { cn, tierTone } from "@/lib/format";
import { useApp } from "@/state/store";
import { BuildGroups, ImportRunesButton, RunePagePanel, SkillPanel } from "@/components/build";
import { ChampionPicker } from "@/components/pickers";
import { EmptyState, Panel, SmartImage, TierBadge } from "@/components/shared";

type BalanceMetric = {
  key: keyof Pick<
    AramBalance,
    | "damageDealt"
    | "damageTaken"
    | "healing"
    | "shielding"
    | "tenacity"
    | "abilityHaste"
    | "manaRegen"
    | "energyRegen"
  >;
  label: string;
  hint: string;
  invert?: boolean;
  icon: LucideIcon;
};

const METRICS: BalanceMetric[] = [
  { key: "damageDealt", label: "Damage dealt", hint: "outgoing", icon: Swords },
  { key: "damageTaken", label: "Damage taken", hint: "incoming", invert: true, icon: Shield },
  { key: "healing", label: "Healing", hint: "modifier", icon: HeartPulse },
  { key: "shielding", label: "Shielding", hint: "modifier", icon: Snowflake },
  { key: "tenacity", label: "Tenacity", hint: "modifier", icon: Wind },
  { key: "abilityHaste", label: "Ability haste", hint: "modifier", icon: Zap },
  { key: "manaRegen", label: "Mana regen", hint: "modifier", icon: Activity },
  { key: "energyRegen", label: "Energy regen", hint: "modifier", icon: Zap },
];

function signed(value: number): string {
  if (Math.abs(value) < 0.05) return "0%";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function deltaTone(value: number, invert?: boolean): string {
  if (Math.abs(value) < 0.05) return "text-mist";
  const good = invert ? value < 0 : value > 0;
  return good ? "text-emerald-300" : "text-enemy-400";
}

function BalanceTile({ metric, value }: { metric: BalanceMetric; value: number }) {
  const Icon = metric.icon;
  return (
    <div className="border border-line bg-abyss px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="hud-label">{metric.label}</p>
        <Icon className="h-3 w-3 text-fog" strokeWidth={1.8} />
      </div>
      <p className={cn("mt-1 font-display text-lg font-semibold leading-none", deltaTone(value, metric.invert))}>
        {signed(value)}
      </p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-fog/75">{metric.hint}</p>
    </div>
  );
}

export default function AramMayhemPage() {
  const {
    bootstrap,
    champion,
    recommendation,
    live,
    settings,
    lcu,
    importRunes,
  } = useApp();

  if (!bootstrap) return null;

  const myChampion =
    bootstrap.champions.find((entry) => entry.name === champion) ??
    bootstrap.champions.find((entry) => entry.name === live.myChampion);
  const balance = findAramBalance(bootstrap, myChampion?.name ?? champion);
  const inAram = isAramGame(live);
  const mayhemActive = isMayhemGame(live);
  const activeAugments = findActiveAugments(bootstrap.arena, live.augments);
  const tiers = mayhemTierList(bootstrap);
  const topPicks = mayhemPicksFor(bootstrap, myChampion, 6);
  const curated = bootstrap.aramSource === "curated" || !bootstrap.aramSource;

  const build = recommendation ? aramBuild(bootstrap, recommendation, myChampion) : null;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-slate-100">
              ARAM / Mayhem
            </h1>
            <span className="chip border-hextech-500/40 bg-hextech-500/10 text-hextech-300">
              <Flame className="h-2.5 w-2.5" />
              HOWLING ABYSS
            </span>
            {mayhemActive ? (
              <span className="chip border-gold-500/50 bg-gold-500/[0.08] text-gold-300">
                <Sparkles className="h-2.5 w-2.5" />
                MAYHEM ACTIVE
              </span>
            ) : inAram ? (
              <span className="chip border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-300">
                <Activity className="h-2.5 w-2.5" />
                ARAM LIVE
              </span>
            ) : null}
            {curated ? (
              <span
                className="chip border-gold-500/50 bg-gold-500/[0.08] text-gold-300"
                title="The live balance feed was unavailable. HexCoach is using its bundled snapshot."
              >
                CURATED SNAPSHOT
              </span>
            ) : (
              <span className="chip border-emerald-500/40 text-emerald-300">
                {bootstrap.aramSource === "cache" ? "CACHED BALANCE" : "LIVE BALANCE"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-fog">
            Howling Abyss balance modifiers, Guardian starter builds, ARAM runes and Mayhem augment priorities.
          </p>
        </div>
        <div className="w-[230px]">
          <ChampionPicker compact />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3.5">
          <Panel
            icon={Flame}
            title={`${myChampion?.name ?? "Champion"} balance on Howling Abyss`}
            subtitle="Percentage modifiers applied by the ARAM ruleset"
            action={<span className="chip">{bootstrap.aram.length} champions</span>}
            bodyClassName="space-y-3 p-3"
          >
            {myChampion ? (
              <div className="flex items-center gap-2.5 border border-line bg-abyss p-2">
                <SmartImage
                  sources={championIcon(bootstrap, myChampion)}
                  alt={myChampion.name}
                  className="h-12 w-12 shrink-0 border border-line-strong"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{myChampion.name}</p>
                  <p className="truncate text-[10px] text-fog">
                    {myChampion.tags.join(" / ")} · {myChampion.partype}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="hud-label">Source</p>
                  <p className="mt-0.5 font-mono text-[10px] text-mist">
                    {curated ? "CURATED" : bootstrap.aramSource?.toUpperCase()}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-4">
              {METRICS.map((metric) => (
                <BalanceTile key={metric.key} metric={metric} value={Number(balance[metric.key] ?? 0)} />
              ))}
            </div>

            <div className="flex items-start gap-2 border border-line bg-abyss/50 px-3 py-2">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
              <div className="text-[10px] leading-relaxed text-fog">
                <p>{balance.note}</p>
                <p className="mt-1 text-[9px] text-fog/70">
                  Positive damage dealt, healing, shielding, tenacity and haste are buffs. Positive damage taken is a
                  nerf because the champion receives more damage.
                </p>
              </div>
            </div>
          </Panel>

          <Panel
            icon={Swords}
            title="Recommended ARAM build"
            subtitle={
              recommendation
                ? `${recommendation.champion} · Guardian start · ${recommendation.buildSource}`
                : "Pick a champion to load a build"
            }
            action={
              <>
                <ImportRunesButton compact />
              </>
            }
            bodyClassName="space-y-3 p-3"
          >
            {build ? (
              <>
                <BuildGroups bootstrap={bootstrap} items={build} />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[10px] text-fog">
                  <span className="flex items-center gap-1.5">
                    <Target className="h-3 w-3 text-hextech-400" />
                    Guardian starter is applied automatically for ARAM.
                  </span>
                  <span className="font-mono text-[9px]">Skill max: {recommendation?.skills.max.join(" > ")}</span>
                </div>
              </>
            ) : (
              <EmptyState
                icon={Swords}
                title="No build loaded"
                message="Pick a champion above to load the ARAM item plan."
              />
            )}
          </Panel>

          <Panel
            icon={Sparkles}
            title="ARAM Mayhem augment tiers"
            subtitle={ARAM_MAYHEM_NOTE}
            action={
              <span
                className={cn(
                  "chip",
                  mayhemActive ? "border-gold-500/50 text-gold-300" : "border-line-strong text-fog",
                )}
              >
                {mayhemActive ? "ACTIVE GAME" : "STANDBY"}
              </span>
            }
            bodyClassName="space-y-3 p-3"
          >
            {!mayhemActive ? (
              <EmptyState
                icon={Sparkles}
                title="Mayhem tiers arm themselves automatically"
                message="HexCoach detects ARAM Mayhem from the live game mode or augments on Howling Abyss. Start a Mayhem game and this panel switches to the active tier list."
              />
            ) : (
              <>
                {activeAugments.length ? (
                  <div>
                    <p className="hud-label mb-1.5">Your active augments</p>
                    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                      {activeAugments.map((augment) => (
                        <div
                          key={augment.id}
                          className="flex items-center gap-2 border border-line-strong bg-slate-500/[0.06] p-1.5"
                        >
                          <SmartImage
                            sources={augmentIcon(bootstrap, augment)}
                            alt={augment.name}
                            className="h-8 w-8 shrink-0 border border-line"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-semibold text-slate-100">{augment.name}</p>
                            <p className="text-[9px] text-fog">{augment.rarityLabel}</p>
                          </div>
                          <TierBadge tier={augment.tier} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="hud-label mb-1.5">Best for {myChampion?.name ?? "your champion"}</p>
                  <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    {topPicks.map((pick) => (
                      <div
                        key={`${pick.tier}-${pick.name}`}
                        className="flex items-center gap-2 border border-line bg-panel-2 p-1.5"
                        title={pick.augment?.desc}
                      >
                        {pick.augment ? (
                          <SmartImage
                            sources={augmentIcon(bootstrap, pick.augment)}
                            alt={pick.name}
                            className="h-8 w-8 shrink-0 border border-line"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-line-strong bg-abyss">
                            <span className="h-2 w-2 rotate-45 border border-hextech-400/70" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-slate-200">{pick.name}</p>
                          <p className="font-mono text-[9px] text-fog">{pick.augment?.rarityLabel ?? "Mayhem pick"}</p>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 min-w-[20px] items-center justify-center border font-display text-[10px] font-bold",
                            tierTone(pick.tier),
                          )}
                        >
                          {pick.tier}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t border-line pt-2.5">
                  {tiers.map((entries) => {
                    const tier = entries[0]?.tier ?? "C";
                    return (
                      <div key={tier} className="flex gap-2">
                        <TierBadge tier={tier} size="sm" />
                        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                          {entries.map((entry) => (
                            <span
                              key={`${tier}-${entry.name}`}
                              className="inline-flex items-center gap-1 border border-line bg-abyss px-1.5 py-0.5 text-[10px] text-mist"
                              title={entry.augment?.desc}
                            >
                              {entry.augment ? (
                                <SmartImage
                                  sources={augmentIcon(bootstrap, entry.augment)}
                                  alt={entry.name}
                                  className="h-4 w-4 border border-line"
                                />
                              ) : null}
                              {entry.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] leading-relaxed text-fog/70">{ARAM_MAYHEM_NOTE}</p>
              </>
            )}
          </Panel>
        </div>

        <div className="space-y-3.5">
          <Panel
            icon={Crosshair}
            title="ARAM rune page"
            subtitle={recommendation ? recommendation.runes.pageName : "Waiting for champion"}
            action={<span className="chip">LCU</span>}
            bodyClassName="p-3"
          >
            {recommendation ? (
              <RunePagePanel
                bootstrap={bootstrap}
                runes={recommendation.runes}
                onImport={() => void importRunes()}
                importDisabled={!lcu.connected || settings.demoMode}
                importHint={
                  settings.demoMode
                    ? "Disable demo mode to import into a real League client."
                    : !lcu.connected
                      ? "League client is not running."
                      : "Import this ARAM page into your active rune slot."
                }
              />
            ) : (
              <EmptyState icon={Crosshair} title="No rune page" message="Pick a champion to load runes." />
            )}
          </Panel>

          {recommendation ? (
            <Panel icon={Crosshair} title="Skill order" subtitle={recommendation.skills.note} bodyClassName="p-3">
              <SkillPanel plan={recommendation.skills} />
            </Panel>
          ) : null}

          <Panel icon={Info} title="Howling Abyss notes" subtitle="Curated quick reference" bodyClassName="p-3">
            <ul className="space-y-2">
              {ARAM_TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-[10px] leading-relaxed text-mist">
                  <Flame className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" />
                  {tip}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-2 text-[9px] leading-relaxed text-fog/70">
              Balance values are an offline curated snapshot, not Riot match data. Mayhem tiers are drafting
              heuristics; verify the current patch in the client.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
