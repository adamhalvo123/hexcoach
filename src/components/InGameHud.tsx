import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Crosshair,
  Flame,
  Lock,
  MousePointerClick,
  Skull,
  Sparkles,
  Swords,
  Unlock,
  Zap,
} from "lucide-react";
import { setOverlayClickthrough } from "@/lib/api";
import { augmentIcon, championIcon, itemRefIcon, spellIcon } from "@/lib/assets";
import { findActiveAugments } from "@/lib/arena";
import { isAramGame, isMayhemGame } from "@/lib/aram";
import { cn, formatGameTime, gameModeLabel } from "@/lib/format";
import type { ArenaAugment, Champion, LivePlayer } from "@/lib/types";
import { useApp } from "@/state/store";
import { SmartImage, TierBadge } from "@/components/shared";

/** Base Flash cooldown, and the value with Cosmic Insight's summoner haste. */
const FLASH_BASE = 300;
const FLASH_COSMIC = 255;

const SPELL_COOLDOWNS: Record<string, number> = {
  Flash: FLASH_BASE,
  Ignite: 180,
  Exhaust: 210,
  Heal: 240,
  Barrier: 180,
  Cleanse: 210,
  Teleport: 360,
  Ghost: 210,
  Snowball: 80,
  Smite: 15,
};

function findChampion(champions: Champion[], name: string): Champion | undefined {
  return champions.find((entry) => entry.name === name || entry.id === name);
}

function remaining(expiresAt: number | undefined, now: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

function EnemyFlashRow({
  player,
  champion,
  expiresAt,
  cosmic,
  now,
  onTrack,
}: {
  player: LivePlayer;
  champion?: Champion;
  expiresAt?: number;
  cosmic: boolean;
  now: number;
  onTrack: (spell: string, base: number) => void;
}) {
  const { bootstrap } = useApp();
  if (!bootstrap) return null;

  const spellName = player.summonerSpells.find((spell) => spell === "Flash") ?? player.summonerSpells[0];
  const spell = bootstrap.spells.find((entry) => entry.name === spellName);
  const base = spellName === "Flash" ? (cosmic ? FLASH_COSMIC : FLASH_BASE) : (SPELL_COOLDOWNS[spellName] ?? 0);
  const left = remaining(expiresAt, now);
  const ready = left === 0;

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        {champion ? (
          <SmartImage
            sources={championIcon(bootstrap, champion)}
            alt={player.champion}
            className="h-7 w-7 border border-paper/25"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center border border-paper/25 bg-abyss text-[9px] text-mist">
            {player.champion.slice(0, 2).toUpperCase()}
          </span>
        )}
        {player.isDead ? (
          <span className="absolute inset-0 flex items-center justify-center bg-void/80">
            <Skull className="h-3.5 w-3.5 text-enemy-400" />
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onTrack(spellName, base)}
        title={`Start or reset the ${spellName} cooldown timer (${base}s${spellName === "Flash" && cosmic ? " with Cosmic Insight" : ""}).`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 border px-1.5 py-1 text-left transition-colors",
          ready
            ? "border-emerald-500/30 bg-emerald-500/[0.06] hover:border-emerald-400/60"
            : "border-enemy-500/40 bg-enemy-500/[0.08] hover:border-enemy-400/70",
        )}
      >
        {spell ? (
          <SmartImage sources={spellIcon(bootstrap, spell)} alt={spell.name} className="h-5 w-5 shrink-0 border border-line" />
        ) : (
          <Zap className="h-3.5 w-3.5 shrink-0 text-fog" />
        )}
        <span className="min-w-0 flex-1 truncate text-[9px] uppercase tracking-[0.08em] text-mist">
          {spellName}
        </span>
        <span
          className={cn(
            "font-mono text-[10px] font-semibold tabular-nums",
            ready ? "text-emerald-300" : "text-enemy-400",
          )}
        >
          {ready ? "UP" : `${left}s`}
        </span>
      </button>
    </div>
  );
}

export default function InGameHud() {
  const { bootstrap, live, recommendation, championBuild, settings, hudClickThrough } = useApp();
  const [now, setNow] = useState(Date.now());
  const [cosmic, setCosmic] = useState(false);
  const [clickThrough, setClickThrough] = useState(hudClickThrough);
  const [flashTimers, setFlashTimers] = useState<Record<string, number>>({});

  useEffect(() => {
    setClickThrough(hudClickThrough);
  }, [hudClickThrough]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const localPlayer = useMemo(
    () => live.myTeam.find((player) => player.isLocal) ?? live.myTeam[0],
    [live.myTeam],
  );

  const deadEnemies = live.enemyTeam.filter((player) => player.isDead && player.respawnTimer > 0);

  const activeAugments = useMemo<ArenaAugment[]>(
    () => (bootstrap ? findActiveAugments(bootstrap.arena, live.augments) : []),
    [bootstrap, live.augments],
  );

  const plannedItems = useMemo(
    () =>
      championBuild
        ? [...championBuild.coreItems, ...championBuild.situationalItems]
        : recommendation
          ? [...recommendation.items.core, ...recommendation.items.boots, ...recommendation.items.situational]
          : [],
    [championBuild, recommendation],
  );

  const plannedSkills = championBuild?.skillOrder ?? recommendation?.skills;

  const nextItem = useMemo(() => {
    if (!plannedItems.length) return null;
    const owned = new Set((localPlayer?.items ?? []).map((item) => item.displayName.toLowerCase()));
    return plannedItems.find((item) => !owned.has(item.name.toLowerCase())) ?? null;
  }, [plannedItems, localPlayer]);

  const isAram = isAramGame(live);
  const mayhem = isMayhemGame(live);
  const showAugments = mayhem || live.gameMode.toUpperCase() === "CHERRY" || activeAugments.length > 0;

  const trackFlash = (key: string, spellName: string, base: number) => {
    const cooldown = spellName === "Flash" ? (cosmic ? FLASH_COSMIC : FLASH_BASE) : base;
    setFlashTimers((current) => ({
      ...current,
      [key]: Date.now() + cooldown * 1000,
    }));
  };

  const unlock = async () => {
    const next = !clickThrough;
    setClickThrough(next);
    try {
      await setOverlayClickthrough(next);
    } catch {
      setClickThrough(!next);
    }
  };

  if (!bootstrap) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent p-3">
        <div className="border border-paper/30 bg-void/95 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-paper">
          Loading live game…
        </div>
      </div>
    );
  }

  if (!live.active) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent p-3">
        <div className="border border-paper/30 bg-void/95 px-4 py-3 text-center">
          <p className="hud-label">HexCoach HUD</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-paper">Standby</p>
          <p className="mt-1 text-[10px] text-fog">Starts automatically with a live game.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none flex h-screen w-screen items-start justify-end overflow-hidden bg-transparent p-2">
      <div className="pointer-events-auto w-full max-w-[440px] space-y-1.5">
        <header className="flex items-center justify-between gap-2 border border-paper/40 bg-void/95 px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center border border-paper/40 bg-paper text-void">
              <Crosshair className="h-3 w-3" />
            </span>
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-paper">HexCoach</span>
            <span className="chip border-paper/25 text-[8px] text-mist">
              {isAram ? (mayhem ? "MAYHEM" : "ARAM") : gameModeLabel(live.gameMode)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 font-mono text-[10px] text-mist">
              <Clock className="h-3 w-3 text-fog" />
              {formatGameTime(live.gameTime)}
            </span>
            <button
              type="button"
              onClick={() => void unlock()}
              className={cn(
                "flex h-5 items-center gap-1 border px-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] transition-colors",
                clickThrough
                  ? "border-paper/25 text-fog hover:border-paper/50 hover:text-paper"
                  : "border-gold-500/60 bg-gold-500/10 text-gold-300",
              )}
              title="Toggle click-through. The Alt+X global hotkey does the same from inside the game."
            >
              {clickThrough ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
              {clickThrough ? "Alt+X" : "Interactive"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-[1fr_1fr] gap-1.5">
          <section className="border border-paper/30 bg-void/90 p-1.5">
            <div className="mb-1 flex items-center justify-between">
              <p className="hud-label flex items-center gap-1">
                <Skull className="h-2.5 w-2.5 text-enemy-400" />
                Enemy respawns
              </p>
              <span className="font-mono text-[9px] text-fog">{deadEnemies.length}/5</span>
            </div>
            {deadEnemies.length ? (
              <div className="space-y-1">
                {deadEnemies.map((player, index) => {
                  const champion = findChampion(bootstrap.champions, player.champion);
                  return (
                    <div key={`${player.champion}-${index}`} className="flex items-center gap-1.5">
                      {champion ? (
                        <SmartImage
                          sources={championIcon(bootstrap, champion)}
                          alt={player.champion}
                          className="h-6 w-6 border border-paper/25 grayscale"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-[10px] text-mist">{player.champion}</span>
                      <span className="font-mono text-[11px] font-semibold text-enemy-400 tabular-nums">
                        {Math.ceil(player.respawnTimer)}s
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-1 text-[9px] uppercase tracking-[0.1em] text-fog/80">All enemies alive</p>
            )}
          </section>

          <section className="border border-paper/30 bg-void/90 p-1.5">
            <div className="mb-1 flex items-center justify-between">
              <p className="hud-label flex items-center gap-1">
                <Zap className="h-2.5 w-2.5 text-gold-400" />
                Enemy spells
              </p>
              <button
                type="button"
                onClick={() => setCosmic((value) => !value)}
                title="Cosmic Insight reduces Flash to 255s. Toggle if the enemy team runs it."
                className={cn(
                  "border px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors",
                  cosmic
                    ? "border-gold-500/60 bg-gold-500/10 text-gold-300"
                    : "border-paper/20 text-fog hover:border-paper/40 hover:text-paper",
                )}
              >
                CI {cosmic ? "255" : "300"}
              </button>
            </div>
            <div className="space-y-1">
              {live.enemyTeam.map((player, index) => {
                const key = `${player.summonerName || player.champion}-${index}`;
                const champion = findChampion(bootstrap.champions, player.champion);
                return (
                  <EnemyFlashRow
                    key={key}
                    player={player}
                    champion={champion}
                    expiresAt={flashTimers[key]}
                    cosmic={cosmic}
                    now={now}
                    onTrack={(spell, base) => trackFlash(key, spell, base)}
                  />
                );
              })}
            </div>
          </section>
        </div>

        <section className="border border-paper/30 bg-void/90 p-1.5">
          <div className="mb-1 flex items-center justify-between">
            <p className="hud-label flex items-center gap-1">
              <Swords className="h-2.5 w-2.5 text-hextech-400" />
              Next item
            </p>
            <span className="font-mono text-[9px] text-gold-300">{Math.floor(live.myGold)}g</span>
          </div>
          {nextItem ? (
            <div className="flex items-center gap-2">
              <SmartImage
                sources={itemRefIcon(bootstrap, nextItem.icon)}
                alt={nextItem.name}
                className="h-8 w-8 border border-paper/30"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-slate-100">{nextItem.name}</p>
                <p className="font-mono text-[9px] text-fog">
                  {nextItem.price}g ·{" "}
                  {live.myGold >= nextItem.price
                    ? "READY TO BUY"
                    : `${Math.ceil(nextItem.price - live.myGold)}g short`}
                </p>
              </div>
              <div className="w-14">
                <div className="h-1 w-full bg-paper/15">
                  <div
                    className={cn("h-full", live.myGold >= nextItem.price ? "bg-emerald-400" : "bg-gold-400")}
                    style={{ width: `${Math.min(100, (live.myGold / Math.max(1, nextItem.price)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="py-1 text-[9px] uppercase tracking-[0.1em] text-fog/80">Build complete</p>
          )}
        </section>

        <div className="grid grid-cols-[1fr_1fr] gap-1.5">
          <section className="border border-paper/30 bg-void/90 p-1.5">
            <p className="hud-label mb-1 flex items-center gap-1">
              <Crosshair className="h-2.5 w-2.5 text-paper" />
              Skill max
            </p>
            <div className="flex items-center gap-1">
              {(plannedSkills?.max ?? []).map((skill, index) => (
                <span
                  key={`${skill}-${index}`}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center border font-display text-[11px] font-bold",
                    index === 0
                      ? "border-paper/70 bg-paper text-void"
                      : "border-paper/30 bg-abyss text-mist",
                  )}
                >
                  {skill}
                </span>
              ))}
              {!plannedSkills ? <span className="text-[9px] text-fog">No recommendation</span> : null}
            </div>
          </section>

          <section className="border border-paper/30 bg-void/90 p-1.5">
            <p className="hud-label mb-1 flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-gold-400" />
              Augments
            </p>
            {showAugments && activeAugments.length ? (
              <div className="flex items-center gap-1">
                {activeAugments.slice(0, 4).map((augment) => (
                  <div key={augment.id} className="flex items-center gap-0.5">
                    <SmartImage
                      sources={augmentIcon(bootstrap, augment)}
                      alt={augment.name}
                      className="h-6 w-6 border border-paper/30"
                    />
                    <TierBadge tier={augment.tier} size="sm" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-1 text-[9px] uppercase tracking-[0.1em] text-fog/80">
                {showAugments ? "Waiting for picks" : "Standard mode"}
              </p>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-between border border-paper/20 bg-void/80 px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-fog/80">
          <span className="flex items-center gap-1">
            <MousePointerClick className="h-2.5 w-2.5" />
            {clickThrough ? "Click-through · Alt+X to interact" : "Interactive · Alt+X to pass through"}
          </span>
          <span className="flex items-center gap-1">
            <Flame className="h-2.5 w-2.5" />
            {settings.demoMode ? "DEMO" : "LIVE"}
          </span>
        </footer>
      </div>
    </div>
  );
}
