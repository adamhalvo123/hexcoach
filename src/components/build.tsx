import { ClipboardCopy, Download, Info, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { runeIcon, championIcon } from "@/lib/assets";
import { cn, tierTone } from "@/lib/format";
import type { BuildSet, Bootstrap, Matchup, Recommendation, RunePage, SkillPlan } from "@/lib/types";
import { useApp } from "@/state/store";
import { ItemTile, RuneOrb, ScoreBar, SmartImage, TierBadge, copyText } from "./shared";

const BUILD_GROUPS: Array<{ key: keyof BuildSet; label: string; hint: string }> = [
  { key: "starter", label: "Starter", hint: "First recall" },
  { key: "boots", label: "Boots", hint: "Mobility" },
  { key: "core", label: "Core", hint: "Power spikes" },
  { key: "situational", label: "Situational", hint: "Adapt" },
];

export function BuildGroups({ bootstrap, items }: { bootstrap: Bootstrap; items: BuildSet }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {BUILD_GROUPS.map((group) => {
        const entries = items[group.key];
        const total = entries.reduce((sum, item) => sum + item.price, 0);
        return (
          <div key={group.key} className="rounded-lg border border-white/[0.06] bg-abyss/30 p-2.5">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div>
                <p className="hud-label">{group.label}</p>
                <p className="text-[9px] text-fog/80">{group.hint}</p>
              </div>
              <span className="font-mono text-[9px] text-gold-400">{total ? `${total}g` : "—"}</span>
            </div>
            <div className="space-y-1">
              {entries.length ? (
                entries.map((item) => (
                  <ItemTile key={item.id} bootstrap={bootstrap} item={item} size="sm" />
                ))
              ) : (
                <p className="rounded-md border border-dashed border-white/[0.06] px-2 py-3 text-center text-[10px] text-fog">
                  Situational slot
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function treeFor(bootstrap: Bootstrap, id: number) {
  return bootstrap.runes.find((tree) => tree.id === id);
}

export function RunePagePanel({
  bootstrap,
  runes,
  onImport,
  importDisabled,
  importHint,
}: {
  bootstrap: Bootstrap;
  runes: RunePage;
  onImport?: () => void;
  importDisabled?: boolean;
  importHint?: string;
}) {
  const primary = treeFor(bootstrap, runes.primaryStyleId);
  const secondary = treeFor(bootstrap, runes.subStyleId);

  return (
    <div className="space-y-3">
      <div className="rune-paths">
      <div className="rune-paths-grid">
        <div className="border border-line bg-abyss/60 p-3">
          <div className="mb-2.5 flex items-center gap-2">
            {primary ? (
              <SmartImage
                sources={runeIcon(bootstrap, { icon: primary.icon })}
                alt={primary.name}
                className="h-7 w-7 rounded-full bg-abyss ring-1 ring-gold-500/30"
                imgClassName="object-contain p-0.5"
              />
            ) : null}
            <div>
              <p className="font-display text-xs font-semibold text-slate-100">{runes.primaryStyleName}</p>
              <p className="text-[9px] uppercase tracking-wider text-fog">Primary path</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col items-center gap-1">
              <RuneOrb
                bootstrap={bootstrap}
                icon={runes.keystone.icon}
                name={runes.keystone.name}
                size="lg"
                ring
              />
              <span className="max-w-[68px] text-center text-[9px] leading-tight text-gold-300">
                {runes.keystone.name}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {runes.primaryPerks.map((rune) => (
                <div key={rune.id} className="flex items-center gap-2">
                  <RuneOrb bootstrap={bootstrap} icon={rune.icon} name={rune.name} size="sm" />
                  <span className="truncate text-[11px] text-slate-200">{rune.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-line bg-abyss/60 p-3">
          <div className="mb-2.5 flex items-center gap-2">
            {secondary ? (
              <SmartImage
                sources={runeIcon(bootstrap, { icon: secondary.icon })}
                alt={secondary.name}
                className="h-7 w-7 rounded-full bg-abyss ring-1 ring-paper/20"
                imgClassName="object-contain p-0.5"
              />
            ) : null}
            <div>
              <p className="font-display text-xs font-semibold text-slate-100">{runes.subStyleName}</p>
              <p className="text-[9px] uppercase tracking-wider text-fog">Secondary path</p>
            </div>
          </div>
          <div className="space-y-1">
            {runes.subPerks.map((rune) => (
              <div key={rune.id} className="flex items-center gap-2">
                <RuneOrb bootstrap={bootstrap} icon={rune.icon} name={rune.name} size="sm" />
                <span className="truncate text-[11px] text-slate-200">{rune.name}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="hud-label">Shards</span>
            {runes.shards.map((shard, index) => (
              <span
                key={`${shard}-${index}`}
                className="border border-line bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-mist"
              >
                {shardLabel(shard)}
              </span>
            ))}
          </div>
        </div>
      </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-abyss/30 px-3 py-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[10px] text-fog">
          <Info className="h-3 w-3 shrink-0 text-hextech-400" />
          <span className="truncate">
            {importHint ?? "One-click import writes this page into your League client."}
          </span>
        </p>
        {onImport ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onImport}
            disabled={importDisabled}
            title={importDisabled ? importHint : "Import rune page via LCU"}
          >
            <Download className="h-3.5 w-3.5" />
            Import runes
          </button>
        ) : null}
      </div>
    </div>
  );
}

function shardLabel(id: number): string {
  const map: Record<number, string> = {
    5001: "HP scaling",
    5002: "Armor",
    5003: "Magic res",
    5005: "Attack speed",
    5007: "Adaptive",
    5008: "Adaptive",
    5011: "Health",
    5013: "Tenacity",
    5015: "HP scaling",
  };
  return map[id] ?? `#${id}`;
}

export function SkillPanel({ plan }: { plan: SkillPlan }) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="hud-label">Max</span>
          {plan.max.map((skill, index) => (
            <span
              key={skill}
              className={cn(
                "flex h-6 min-w-[24px] items-center justify-center rounded-md border font-display text-[11px] font-bold",
                skill === "R"
                  ? "border-gold-500/40 bg-gold-500/10 text-gold-300"
                  : "border-hextech-500/30 bg-hextech-500/10 text-hextech-300",
              )}
            >
              {skill}
              {index < plan.max.length - 1 ? <span className="ml-0.5 text-[8px] text-fog">›</span> : null}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-fog">{plan.note}</p>
      </div>
      <div className="grid grid-cols-9 gap-1">
        {plan.order.map((skill, index) => (
          <div
            key={`${skill}-${index}`}
            className={cn(
              "flex flex-col items-center rounded border py-1",
              skill === "R"
                ? "border-gold-500/30 bg-gold-500/[0.08]"
                : "border-white/[0.06] bg-abyss/40",
            )}
            title={`Level ${index + 1}: ${skill}`}
          >
            <span className="text-[8px] text-fog">{index + 1}</span>
            <span
              className={cn(
                "font-display text-[11px] font-bold",
                skill === "R" ? "text-gold-300" : "text-slate-200",
              )}
            >
              {skill}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchupList({
  bootstrap,
  entries,
  tone,
  empty,
}: {
  bootstrap: Bootstrap;
  entries: Matchup[];
  tone: "counter" | "synergy";
  empty: string;
}) {
  if (!entries.length) {
    return <p className="rounded-lg border border-dashed border-white/[0.06] px-3 py-4 text-center text-[11px] text-fog">{empty}</p>;
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const champion =
          bootstrap.champions.find((candidate) => candidate.id === entry.championId) ??
          bootstrap.champions.find((candidate) => candidate.name === entry.champion);
        return (
          <div
            key={`${entry.championId}-${entry.champion}`}
            className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-abyss/30 px-2 py-1.5"
            title={entry.reason}
          >
            {champion ? (
              <SmartImage
                sources={championIcon(bootstrap, champion)}
                alt={champion.name}
                className="h-7 w-7 shrink-0 rounded ring-1 ring-white/10"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-slate-200">{entry.champion}</p>
              <p className="truncate text-[9px] text-fog">{entry.reason}</p>
            </div>
            <span
              className={cn(
                "font-mono text-[10px]",
                tone === "counter" ? "text-enemy-400" : "text-emerald-400",
              )}
            >
              {tone === "counter" ? "vs" : "+"} {entry.score}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MetaScore({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-abyss/30 px-3 py-2">
      <TierBadge tier={recommendation.meta.tier} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="hud-label">Meta score</span>
          <span className={cn("font-mono text-[11px]", tierTone(recommendation.meta.tier))}>
            {recommendation.meta.score}/100
          </span>
        </div>
        <ScoreBar score={recommendation.meta.score} className="mt-1" />
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-[9px] text-fog">{recommendation.meta.label}</span>
          <span className="font-mono text-[10px] text-hextech-300">
            {recommendation.meta.estimatedWinRate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function ImportRunesButton({ compact }: { compact?: boolean }) {
  const { importRunes, lcu, settings, recommendation } = useApp();
  const disabled = !recommendation || !lcu.connected || settings.demoMode;
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => void importRunes()}
      disabled={disabled}
      title={
        settings.demoMode
          ? "Disable demo mode and open the League client to import runes."
          : !lcu.connected
            ? "League client not detected."
            : "Import this rune page via the local client API."
      }
    >
      <Download className="h-3.5 w-3.5" />
      {compact ? "Runes" : "Import runes"}
    </button>
  );
}

export function CopyBuildButton({ compact }: { compact?: boolean }) {
  const { recommendation, pushToast } = useApp();

  const copy = async () => {
    if (!recommendation) return;
    const { items, runes, champion, roleLabel } = recommendation;
    const text = [
      `${champion} — ${roleLabel} (HexCoach)`,
      `Starter: ${items.starter.map((item) => item.name).join(", ") || "—"}`,
      `Boots: ${items.boots.map((item) => item.name).join(", ") || "—"}`,
      `Core: ${items.core.map((item) => item.name).join(" → ") || "—"}`,
      `Situational: ${items.situational.map((item) => item.name).join(", ") || "—"}`,
      `Runes: ${runes.primaryStyleName} / ${runes.subStyleName} — ${runes.keystone.name}`,
      `Skill order: ${recommendation.skills.max.join(" > ")}`,
      "Estimates are offline heuristics, not Riot match data.",
    ].join("\n");
    const ok = await copyText(text);
    pushToast(ok ? "success" : "error", ok ? "Build copied" : "Clipboard unavailable", ok ? "Build and runes are on your clipboard." : "Copy the build manually.");
  };

  return (
    <button type="button" className="btn btn-ghost" onClick={() => void copy()} disabled={!recommendation}>
      <ClipboardCopy className="h-3.5 w-3.5" />
      {compact ? "Copy" : "Copy build"}
    </button>
  );
}

export function DataSourceNote({ compact }: { compact?: boolean }) {
  return (
    <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-fog">
      <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
      {compact ? (
        <span>EST. WR = offline heuristic, not Riot data.</span>
      ) : (
        <span>
          Recommendations combine curated patch {`data`}, Data Dragon item stats and class heuristics.{" "}
          <span className="text-gold-400">EST. WR is not Riot match data.</span>
        </span>
      )}
    </p>
  );
}

export function TipList({ tips }: { tips: string[] }) {
  return (
    <ul className="space-y-1.5">
      {tips.map((tip) => (
        <li key={tip} className="flex items-start gap-2 text-[11px] leading-relaxed text-mist">
          <Zap className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
          {tip}
        </li>
      ))}
    </ul>
  );
}

export function SynergyTags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="chip">
          <Sparkles className="h-2.5 w-2.5 text-arcane-400" />
          {tag}
        </span>
      ))}
    </div>
  );
}
