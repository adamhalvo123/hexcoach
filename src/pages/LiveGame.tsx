import {
  Activity,
  ChevronRight,
  Clock3,
  Copy,
  Crosshair,
  Eye,
  Flame,
  Gamepad2,
  Radio,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Target,
  Users,
} from "lucide-react";
import { championIcon, championSplash, itemIcon, spellIcon, augmentIcon } from "@/lib/assets";
import { findActiveAugments, recommendAugments } from "@/lib/arena";
import { cn, formatGameTime, gameModeLabel, roleShort } from "@/lib/format";
import type { Bootstrap, LivePlayer } from "@/lib/types";
import { useApp } from "@/state/store";
import { BuildGroups, CopyBuildButton, DataSourceNote, ImportRunesButton, MatchupList, RunePagePanel, SkillPanel } from "@/components/build";
import { ChampionPicker, RoleTabs } from "@/components/pickers";
import {
  EmptyState,
  Panel,
  SmartImage,
  Spinner,
  StatTile,
  TierBadge,
} from "@/components/shared";

function PlayerRow({ bootstrap, player }: { bootstrap: Bootstrap; player: LivePlayer }) {
  const champion = bootstrap.champions.find((entry) => entry.name === player.champion);
  const items = Array.from({ length: 6 }, (_, slot) =>
    player.items.find((item) => item.slot === slot) ?? player.items[slot],
  ).filter(Boolean);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-1.5 py-1.5 transition-colors",
        player.isLocal
          ? "border-hextech-500/30 bg-hextech-500/[0.06]"
          : "border-transparent hover:border-line hover:bg-slate-500/10",
      )}
    >
      <div className="relative shrink-0">
        {champion ? (
          <SmartImage
            sources={championIcon(bootstrap, champion)}
            alt={player.champion}
            className={cn("h-8 w-8 rounded ring-1", player.isLocal ? "ring-hextech-500/50" : "ring-line-strong")}
          />
        ) : (
          <div className="h-8 w-8 rounded bg-panel-3" />
        )}
        <span className="absolute -bottom-1 -right-1 rounded border border-void bg-abyss px-1 font-mono text-[8px] text-slate-200">
          {player.level}
        </span>
        {player.isDead ? (
          <span className="absolute inset-0 flex items-center justify-center rounded bg-black/70 font-mono text-[9px] text-enemy-400">
            {Math.ceil(player.respawnTimer)}s
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[11px] font-semibold", player.isLocal ? "text-hextech-200" : "text-slate-200")}>
          {player.summonerName || player.champion}
          {player.isBot ? <span className="ml-1 text-[8px] text-fog">BOT</span> : null}
        </p>
        <p className="truncate text-[9px] text-fog">
          {roleShort(player.position)} · {player.champion}
        </p>
      </div>

      <div className="w-14 shrink-0 text-right">
        <p className="font-mono text-[11px] text-slate-200">
          <span className="text-emerald-300">{player.kills}</span>
          <span className="text-fog">/</span>
          <span className="text-enemy-400">{player.deaths}</span>
          <span className="text-fog">/</span>
          <span className="text-hextech-300">{player.assists}</span>
        </p>
        <p className="font-mono text-[9px] text-fog">{player.creepScore} CS</p>
      </div>

      <div className="hidden shrink-0 items-center gap-[2px] 2xl:flex">
        {Array.from({ length: 6 }).map((_, index) => {
          const liveItem = items[index];
          const item = liveItem ? bootstrap.items.find((entry) => entry.id === liveItem.itemId) : undefined;
          return item ? (
            <SmartImage
              key={index}
              sources={itemIcon(bootstrap, item)}
              alt={item.name}
              className="h-4 w-4 ring-1 ring-line-strong"
            />
          ) : (
            <span key={index} className="h-4 w-4 border border-line bg-black/20" />
          );
        })}
      </div>
    </div>
  );
}

function TeamRoster({
  bootstrap,
  title,
  subtitle,
  players,
  tone,
  icon: Icon,
}: {
  bootstrap: Bootstrap;
  title: string;
  subtitle: string;
  players: LivePlayer[];
  tone: "ally" | "enemy";
  icon: typeof Users;
}) {
  const kills = players.reduce((sum, player) => sum + player.kills, 0);
  return (
    <Panel
      icon={Icon}
      title={title}
      subtitle={subtitle}
      action={
        <span className={cn("font-mono text-[11px]", tone === "ally" ? "text-hextech-300" : "text-enemy-400")}>
          {kills} kills
        </span>
      }
      className={tone === "enemy" ? "border-enemy-500/[0.10]" : undefined}
      accent={tone === "enemy" ? "bg-enemy-500/20" : "bg-hextech-500/20"}
      bodyClassName="space-y-0.5 p-1.5"
    >
      {players.length ? (
        players.map((player) => (
          <PlayerRow key={`${player.team}-${player.summonerName}-${player.champion}`} bootstrap={bootstrap} player={player} />
        ))
      ) : (
        <p className="px-3 py-5 text-center text-[11px] text-fog">No players detected.</p>
      )}
    </Panel>
  );
}

function EventRow({ event }: { event: { name: string; time: number; killer: string; victim: string; team: string } }) {
  const isKill = event.name === "ChampionKill";
  const isObjective = ["DragonKill", "BaronKill", "HeraldKill", "TurretKilled", "InhibKilled"].includes(event.name);
  const Icon = isKill ? Swords : isObjective ? Flame : Activity;
  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-abyss/30 px-2 py-1.5">
      <span className="w-9 shrink-0 font-mono text-[9px] text-fog">{formatGameTime(event.time)}</span>
      <Icon className={cn("h-3 w-3 shrink-0", isKill ? "text-enemy-400" : "text-gold-400")} />
      <p className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
        {isKill ? `${event.killer || "Someone"} eliminated ${event.victim || "an enemy"}` : event.name.replaceAll("_", " ")}
      </p>
      <span
        className={cn(
          "rounded px-1 py-0.5 text-[8px] font-semibold uppercase",
          event.team === "ORDER" ? "bg-hextech-500/10 text-hextech-300" : "bg-enemy-500/10 text-enemy-400",
        )}
      >
        {event.team === "ORDER" ? "Ally" : "Enemy"}
      </span>
    </div>
  );
}

export default function LiveGamePage() {
  const {
    bootstrap,
    live,
    recommendation,
    recLoading,
    recError,
    refreshRecommendation,
    champion,
    settings,
    setPage,
    perf,
    importRunes,
    lcu,
  } = useApp();

  if (!bootstrap) return null;

  const local = live.myTeam.find((player) => player.isLocal);
  const myChampion =
    bootstrap.champions.find((entry) => entry.name === (live.myChampion || champion)) ??
    bootstrap.champions.find((entry) => entry.name === champion);
  const teamKills = live.myTeam.reduce((sum, player) => sum + player.kills, 0);
  const enemyKills = live.enemyTeam.reduce((sum, player) => sum + player.kills, 0);
  const isArena = live.gameMode === "CHERRY";
  const isMayhem = live.isMayhem || live.gameMode === "ARAM_MAYHEM";
  const activeAugments = findActiveAugments(bootstrap.arena, live.augments);
  const augmentPicks = recommendAugments(bootstrap.arena, myChampion, 4);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-wide text-slate-100">Live Game</h1>
            <span className="chip border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300">
              <Radio className="h-2.5 w-2.5" />
              {live.active ? "2s polling" : "standby"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-fog">
            Local Live Client API · {live.active ? gameModeLabel(live.gameMode) : "Start a match and HexCoach picks it up automatically"}
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
        <div className="relative min-h-[150px]">
          {myChampion ? (
            <SmartImage
              sources={championSplash(bootstrap, myChampion)}
              alt={myChampion.name}
              className="absolute inset-0 h-full w-full opacity-35"
              imgClassName="object-cover object-[center_22%]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-transparent to-transparent" />

          <div className="relative flex flex-wrap items-center gap-4 p-4">
            {myChampion ? (
              <div className="relative shrink-0">
                <SmartImage
                  sources={championIcon(bootstrap, myChampion)}
                  alt={myChampion.name}
                  className="h-[76px] w-[76px] rounded-xl ring-2 ring-hextech-500/40 shadow-glow"
                />
                <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-void bg-abyss font-mono text-[10px] text-hextech-300">
                  {local?.level ?? live.myLevel ?? "—"}
                </span>
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-bold tracking-wide text-slate-50 text-shadow-sm">
                  {myChampion?.name ?? (live.active ? live.myChampion : "No game detected")}
                </h2>
                {recommendation ? <TierBadge tier={recommendation.meta.tier} size="sm" /> : null}
                {live.active ? (
                  <span className="chip border-gold-500/30 bg-gold-500/[0.08] text-gold-300">
                    <Clock3 className="h-2.5 w-2.5" />
                    {formatGameTime(live.gameTime)}
                  </span>
                ) : null}
                <span className="chip">{live.active ? gameModeLabel(live.gameMode) : "PRE-GAME PLAN"}</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-mist">
                {myChampion ? `${myChampion.title} · ${myChampion.tags.join(" / ")}` : "HexCoach is waiting for the League client."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatTile
                  label="Your KDA"
                  value={
                    local ? (
                      <span>
                        <span className="text-emerald-300">{local.kills}</span>
                        <span className="text-fog"> / </span>
                        <span className="text-enemy-400">{local.deaths}</span>
                        <span className="text-fog"> / </span>
                        <span className="text-hextech-300">{local.assists}</span>
                      </span>
                    ) : (
                      "—"
                    )
                  }
                  hint={local ? `${local.creepScore} CS · ${local.wardScore} vision` : "Waiting for data"}
                />
                <StatTile
                  label="Team kills"
                  value={
                    <span>
                      <span className="text-hextech-300">{teamKills}</span>
                      <span className="text-fog"> : </span>
                      <span className="text-enemy-400">{enemyKills}</span>
                    </span>
                  }
                  hint={`${live.myTeam.length}v${live.enemyTeam.length}`}
                />
                <StatTile
                  label="API latency"
                  value={<span className="text-hextech-300">{live.latencyMs || perf.liveLatencyMs}ms</span>}
                  hint="localhost poll"
                />
                <StatTile
                  label="Rune import"
                  value={settings.demoMode ? "Demo" : lcu.connected ? "Ready" : "Offline"}
                  hint={settings.demoMode ? "Disable demo mode" : lcu.connected ? "LCU linked" : "Open League client"}
                  tone={!settings.demoMode && lcu.connected ? "text-emerald-300" : "text-fog"}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {!live.active ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hextech-500/15 bg-hextech-500/[0.04] px-3 py-2">
          <p className="flex items-center gap-2 text-[11px] text-mist">
            <Gamepad2 className="h-4 w-4 text-hextech-400" />
            No Live Client data. Start a game, or use demo mode in Settings to explore the overlay.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setPage("draft")}>
              Draft helper
              <ChevronRight className="h-3 w-3" />
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setPage("builds")}>
              Full build
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <TeamRoster
              bootstrap={bootstrap}
              title="Allies"
              subtitle="Order team"
              players={live.myTeam}
              tone="ally"
              icon={Users}
            />
            <TeamRoster
              bootstrap={bootstrap}
              title="Enemies"
              subtitle="Chaos team"
              players={live.enemyTeam}
              tone="enemy"
              icon={Skull}
            />
          </div>

          <Panel
            icon={Swords}
            title="Recommended build"
            subtitle={
              recommendation
                ? `${recommendation.champion} · ${recommendation.roleLabel} · ${recommendation.buildSource}`
                : "Pick a champion to load a build"
            }
            action={
              <>
                <ImportRunesButton compact />
                <CopyBuildButton compact />
              </>
            }
            bodyClassName="space-y-3 p-3"
          >
            {recLoading && !recommendation ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-fog">
                <Spinner /> Building recommendation…
              </div>
            ) : recError ? (
              <EmptyState
                icon={Activity}
                title="Could not build a recommendation"
                message={recError}
                action={
                  <button type="button" className="btn btn-ghost" onClick={refreshRecommendation}>
                    Try again
                  </button>
                }
              />
            ) : recommendation ? (
              <>
                <BuildGroups bootstrap={bootstrap} items={recommendation.items} />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                  <DataSourceNote compact />
                  <span className="font-mono text-[9px] text-fog">
                    Skill max: {recommendation.skills.max.join(" > ")}
                  </span>
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-xs text-fog">Select a champion above.</p>
            )}
          </Panel>

          <Panel
            icon={Clock3}
            title="Match timeline"
            subtitle="Recent local game events"
            action={<span className="chip">{live.events.length} events</span>}
            bodyClassName="space-y-1 p-2"
          >
            {live.events.length ? (
              live.events.slice(0, 6).map((event) => <EventRow key={event.eventId} event={event} />)
            ) : (
              <p className="px-2 py-4 text-center text-[11px] text-fog">
                No events yet — kills, dragons and towers will appear here.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-3.5">
          <Panel
            icon={Target}
            title="Rune setup"
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
                      : "Import this page into your active rune page slot."
                }
              />
            ) : (
              <div className="flex items-center gap-2 py-6 text-xs text-fog">
                <Spinner /> Loading runes…
              </div>
            )}
          </Panel>

          {recommendation ? (
            <Panel icon={Crosshair} title="Skill order" subtitle={recommendation.skills.note} bodyClassName="p-3">
              <SkillPanel plan={recommendation.skills} />
            </Panel>
          ) : null}

          {recommendation ? (
            <Panel icon={Shield} title="Matchup notes" subtitle="Counters & synergies" bodyClassName="space-y-3 p-3">
              <div>
                <p className="hud-label mb-1.5">Strong against</p>
                <MatchupList
                  bootstrap={bootstrap}
                  entries={recommendation.counters.slice(0, 3)}
                  tone="counter"
                  empty="No counter notes for this champion."
                />
              </div>
              <div>
                <p className="hud-label mb-1.5">Good with</p>
                <MatchupList
                  bootstrap={bootstrap}
                  entries={recommendation.synergies.slice(0, 3)}
                  tone="synergy"
                  empty="No synergy notes for this champion."
                />
              </div>
            </Panel>
          ) : null}

          {isArena || isMayhem || activeAugments.length ? (
            <Panel
              icon={Sparkles}
              title={isMayhem ? "ARAM Mayhem augments" : "Arena augments"}
              subtitle="Active picks & suggestions"
              action={
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPage(isMayhem ? "aram" : "arena")}
                  title={isMayhem ? "Open ARAM / Mayhem" : "Open Arena Lab"}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              }
              bodyClassName="space-y-2 p-3"
            >
              {activeAugments.length ? (
                <div className="space-y-1">
                  <p className="hud-label">Your augments</p>
                  {activeAugments.map((augment) => (
                    <div
                      key={augment.id}
                      className="flex items-center gap-2 rounded-md border border-arcane-500/20 bg-arcane-500/[0.05] px-2 py-1.5"
                    >
                      <SmartImage
                        sources={augmentIcon(bootstrap, augment)}
                        alt={augment.name}
                        className="h-8 w-8 rounded"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-slate-100">{augment.name}</p>
                        <p className="truncate text-[9px] text-fog">{augment.rarityLabel}</p>
                      </div>
                      <TierBadge tier={augment.tier} size="sm" />
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-1.5">
                {augmentPicks.map((augment) => (
                  <div
                    key={augment.id}
                    className="flex items-center gap-1.5 rounded-md border border-line bg-abyss/30 p-1.5"
                    title={augment.desc}
                  >
                    <SmartImage
                      sources={augmentIcon(bootstrap, augment)}
                      alt={augment.name}
                      className="h-7 w-7 shrink-0 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-semibold text-slate-200">{augment.name}</p>
                      <p className="font-mono text-[9px] text-arcane-400">{augment.matchScore}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost w-full" onClick={() => setPage(isMayhem ? "aram" : "arena")}>
                {isMayhem ? "Open ARAM / Mayhem" : "Open Arena Lab"}
                <ChevronRight className="h-3 w-3" />
              </button>
            </Panel>
          ) : null}

          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-abyss/30 px-3 py-2 text-[10px] text-fog">
            <span className="flex items-center gap-1.5">
              <Eye className="h-3 w-3 text-hextech-400" />
              Overlay stays on top
            </span>
            <span className="flex items-center gap-1.5">
              <Copy className="h-3 w-3 text-hextech-400" />
              Ctrl+Shift+C compact
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
