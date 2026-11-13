import { useMemo, useState } from "react";
import {
  Activity,
  Filter,
  Search,
  Sparkles,
  Swords,
  Target,
  Wand2,
} from "lucide-react";
import { augmentIcon, championIcon } from "@/lib/assets";
import { filterAugments, findActiveAugments, recommendAugments } from "@/lib/arena";
import { cn, tierTone } from "@/lib/format";
import type { ArenaAugment } from "@/lib/types";
import { useApp } from "@/state/store";
import { ChampionPicker } from "@/components/pickers";
import { EmptyState, Panel, SmartImage, TierBadge } from "@/components/shared";

const RARITY_TONE: Record<string, string> = {
  Silver: "border-paper/25 text-mist",
  Gold: "border-gold-500/50 text-gold-300",
  Prismatic: "border-paper/60 bg-paper/[0.08] text-paper",
  Special: "border-paper/40 text-paper",
};

function tagTone(tag: string): string {
  switch (tag) {
    case "AP":
      return "border-arcane-500/40 text-arcane-400";
    case "AD":
      return "border-gold-500/40 text-gold-300";
    case "Tank":
    case "Sustain":
      return "border-emerald-600/40 text-emerald-300";
    case "Crit":
    case "Mobility":
      return "border-paper/40 text-paper";
    default:
      return "border-paper/20 text-mist";
  }
}

function AugmentCard({ augment, matchScore }: { augment: ArenaAugment; matchScore?: number }) {
  const { bootstrap } = useApp();
  const icon = bootstrap ? augmentIcon(bootstrap, augment) : undefined;

  return (
    <article
      className="group relative flex h-full flex-col border border-line bg-panel-2 p-2.5 transition-colors hover:border-paper/40 hover:bg-panel-3"
      title={augment.desc}
    >
      <div className="flex items-start gap-2.5">
        {augment.iconSmall ? (
          <SmartImage
            sources={icon}
            alt={augment.name}
            className="h-10 w-10 shrink-0 border border-line"
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-paper/25 bg-abyss"
            title="Curated offline entry"
            aria-hidden
          >
            <span className="h-2.5 w-2.5 rotate-45 border border-paper/70" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-[11px] font-bold uppercase tracking-[0.06em] text-slate-100">
              {augment.name}
            </h3>
            <TierBadge tier={augment.tier} size="sm" />
          </div>
          <span
            className={cn(
              "mt-1 inline-flex border px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.14em]",
              RARITY_TONE[augment.rarityLabel] ?? RARITY_TONE.Special,
            )}
          >
            {augment.rarityLabel}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-base font-bold leading-none text-paper">{matchScore ?? augment.score}</p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-fog">score</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 flex-1 text-[10px] leading-relaxed text-fog">{augment.desc}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {augment.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className={cn("border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase", tagTone(tag))}
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

export default function ArenaPage() {
  const { bootstrap, champion, live } = useApp();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("ALL");
  const [rarity, setRarity] = useState("ALL");

  const myChampion = bootstrap?.champions.find((entry) => entry.name === champion);

  const picks = useMemo(
    () => (bootstrap ? recommendAugments(bootstrap.arena, myChampion, 6) : []),
    [bootstrap, myChampion],
  );

  const filtered = useMemo(
    () => (bootstrap ? filterAugments(bootstrap.arena, query, tier, rarity) : []),
    [bootstrap, query, tier, rarity],
  );

  const active = useMemo(
    () => (bootstrap ? findActiveAugments(bootstrap.arena, live.augments) : []),
    [bootstrap, live.augments],
  );

  const synergyTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pick of picks) {
      for (const tag of pick.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [picks]);

  if (!bootstrap) return null;

  const visible = filtered.slice(0, 80);
  const curated = bootstrap.arenaSource === "curated";

  return (
    <div className="space-y-3.5" data-arena-source={bootstrap.arenaSource ?? "unknown"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-slate-100">Arena Lab</h1>
            <span className="chip border-paper/40 bg-paper/[0.06] text-paper">
              <Sparkles className="h-2.5 w-2.5" />
              CHERRY
            </span>
            {curated ? (
              <span
                className="chip border-gold-500/50 bg-gold-500/[0.08] text-gold-300"
                title="CommunityDragon could not be reached. HexCoach is showing its curated offline augment set."
              >
                OFFLINE SET
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-fog">
            {bootstrap.arena.length} augments ·{" "}
            {curated ? "curated offline library" : "CommunityDragon icons"} · tier list + class synergies
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[230px]">
            <ChampionPicker compact />
          </div>
          <span className="chip border-gold-500/40 text-gold-300">Tier list is curated</span>
        </div>
      </div>

      {curated ? (
        <div className="flex flex-wrap items-center gap-2 border border-paper/20 bg-paper/[0.03] px-3 py-2 text-[10px] leading-relaxed text-mist">
          <span className="h-1.5 w-1.5 shrink-0 bg-paper" />
          CommunityDragon is unreachable, so HexCoach loaded a bundled {bootstrap.arena.length}-augment library with
          curated tiers and summaries. Effects and icons refresh automatically the next time the feed is available.
        </div>
      ) : null}

      <Panel
        icon={Wand2}
        title={`Best augments for ${myChampion?.name ?? "your champion"}`}
        subtitle="Blends augment tier with your champion class profile"
        bodyClassName="p-3"
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {picks.map((pick, index) => (
            <div key={pick.id} className="relative">
              <span className="absolute -left-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center border border-ink bg-paper px-1 font-mono text-[9px] font-bold text-ink">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="border border-paper/15 bg-paper/[0.02] p-1.5">
                <AugmentCard augment={pick} matchScore={pick.matchScore} />
                <p className="mt-1 border-t border-paper/10 px-1 pt-1 text-[9px] leading-relaxed text-fog">
                  {pick.reason}
                </p>
              </div>
            </div>
          ))}
          {!picks.length ? (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState
                icon={Sparkles}
                title="Arena augment data is not available"
                message="HexCoach could not load the CommunityDragon Arena file. Refresh data in Settings."
              />
            </div>
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Panel
          icon={Sparkles}
          title="Augment library"
          subtitle="Filter by tier, rarity or effect"
          action={<span className="chip">{filtered.length} results</span>}
          bodyClassName="p-3"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fog" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search augments, tags or effects…"
                className="field py-1.5 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-0.5 border border-line bg-abyss p-0.5">
              {["ALL", "S", "A", "B", "C"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTier(value)}
                  className={cn(
                    "flex h-6 min-w-[26px] items-center justify-center px-1.5 font-mono text-[10px] font-bold transition-colors",
                    tier === value
                      ? "bg-paper text-ink"
                      : "text-fog hover:bg-paper/10 hover:text-paper",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="h-3 w-3 text-fog" />
              <select
                value={rarity}
                onChange={(event) => setRarity(event.target.value)}
                className="field w-[128px] appearance-none py-1.5 text-xs"
              >
                <option value="ALL">All rarities</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Prismatic">Prismatic</option>
                <option value="Special">Special</option>
              </select>
            </div>
            {query || tier !== "ALL" || rarity !== "ALL" ? (
              <button
                type="button"
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog underline-offset-2 hover:text-paper hover:underline"
                onClick={() => {
                  setQuery("");
                  setTier("ALL");
                  setRarity("ALL");
                }}
              >
                Reset
              </button>
            ) : null}
          </div>

          {visible.length ? (
            <>
              <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {visible.map((augment) => (
                  <AugmentCard key={augment.id} augment={augment} />
                ))}
              </div>
              {filtered.length > visible.length ? (
                <p className="mt-3 text-center text-[10px] text-fog">
                  Showing {visible.length} of {filtered.length}. Narrow the filters to see the rest.
                </p>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={Search}
              title="No augments match"
              message="Try clearing the search or picking another rarity and tier."
            />
          )}
        </Panel>

        <div className="space-y-3.5">
          {active.length ? (
            <Panel
              icon={Activity}
              title="Your active augments"
              subtitle="Detected from the live Arena game"
              accent="bg-paper/40"
              bodyClassName="space-y-1.5 p-3"
            >
              {active.map((augment) => (
                <div
                  key={augment.id}
                  className="flex items-center gap-2 border border-paper/25 bg-paper/[0.04] p-1.5"
                >
                  <SmartImage
                    sources={augmentIcon(bootstrap, augment)}
                    alt={augment.name}
                    className="h-8 w-8 border border-line"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-slate-100">{augment.name}</p>
                    <p className="text-[9px] text-fog">{augment.rarityLabel}</p>
                  </div>
                  <TierBadge tier={augment.tier} size="sm" />
                </div>
              ))}
            </Panel>
          ) : null}

          <Panel
            icon={myChampion ? Swords : Target}
            title="Synergy read"
            subtitle={myChampion ? `${myChampion.name} · ${myChampion.tags.join(" / ")}` : "Pick a champion"}
            bodyClassName="space-y-3 p-3"
          >
            {myChampion ? (
              <div className="flex items-center gap-2.5 border border-line bg-abyss p-2">
                <SmartImage
                  sources={championIcon(bootstrap, myChampion)}
                  alt={myChampion.name}
                  className="h-11 w-11 border border-paper/30"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">{myChampion.name}</p>
                  <p className="truncate text-[10px] text-fog">
                    {myChampion.tags.join(" / ")} · {myChampion.partype}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              {synergyTags.map(([tag, count]) => (
                <div key={tag}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={cn("border px-1.5 py-0.5 font-mono font-semibold uppercase", tagTone(tag))}>
                      {tag}
                    </span>
                    <span className="font-mono text-fog">{count} picks</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden bg-paper/10">
                    <div
                      className="h-full bg-paper"
                      style={{ width: `${Math.min(100, (count / Math.max(1, picks.length)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 border border-line bg-abyss p-2.5 text-[10px] leading-relaxed text-fog">
              <p className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-paper">
                <Sparkles className="h-3 w-3" />
                How the score works
              </p>
              <p>
                Tier score (S = 95, A = 86, B = 74, C = 62) plus a class bonus from the augment's tags. It is a
                drafting heuristic, not a win-rate statistic.
              </p>
            </div>
          </Panel>

          <Panel icon={Target} title="Arena tips" subtitle="Curated quick reference" bodyClassName="p-3">
            <div className="space-y-2 text-[10px] leading-relaxed text-mist">
              <p>
                <span className={cn("mr-1 border px-1 py-0.5 font-mono text-[8px] font-bold", tierTone("S"))}>S</span>
                Prismatic augments define the round. Take them when they match your damage profile.
              </p>
              <p>
                <span className={cn("mr-1 border px-1 py-0.5 font-mono text-[8px] font-bold", tierTone("A"))}>A</span>
                Gold augments are the consistency layer — economy and haste keep your combo online.
              </p>
              <p>
                <span className={cn("mr-1 border px-1 py-0.5 font-mono text-[8px] font-bold", tierTone("B"))}>B</span>
                Silver augments are situational. Take defensive stats against burst drafts.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
