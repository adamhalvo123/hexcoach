import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import {
  itemRefIcon,
  runeRefIcon,
  type AssetSources,
} from "@/lib/assets";
import type {
  Bootstrap,
  ItemRef,
  RunePage,
  SkillPlan,
} from "@/lib/types";
import { clamp, cn, tierTone } from "@/lib/format";

export function SmartImage({
  sources,
  alt,
  className,
  imgClassName,
}: {
  sources?: AssetSources;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [sources?.src, sources?.fallback]);

  if (!sources) {
    return <div className={cn("bg-checker bg-panel-2", className)} aria-hidden />;
  }

  const src = failed && sources.fallback ? sources.fallback : sources.src;

  return (
    <div className={cn("relative overflow-hidden bg-panel-2", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        onError={() => {
          if (!failed && sources.fallback && sources.fallback !== sources.src) setFailed(true);
        }}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}

export function Panel({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  accent,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: string;
}) {
  return (
    <section className={cn("hud-panel", className)}>
      {accent ? <div className={cn("absolute inset-x-0 top-0 h-px", accent)} /> : null}
      <header className="relative flex min-h-[42px] items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-hextech-400" strokeWidth={1.8} /> : null}
          <div className="min-w-0">
            <h2 className="truncate font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-100">
              {title}
            </h2>
            {subtitle ? <p className="truncate text-[11px] text-fog">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function TierBadge({ tier, size = "md" }: { tier: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border font-display font-bold uppercase",
        tierTone(tier),
        size === "sm" && "h-5 min-w-[20px] px-1 text-[10px]",
        size === "md" && "h-6 min-w-[26px] px-1.5 text-xs",
        size === "lg" && "h-9 min-w-[38px] px-2 text-lg",
      )}
    >
      {tier || "—"}
    </span>
  );
}

export function ScoreBar({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden bg-slate-700/60", className)}>
      <div
        className="h-full bg-hextech-500 transition-all duration-500"
        style={{ width: `${clamp(score, 0, 100)}%` }}
      />
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="border border-line bg-abyss px-3 py-2">
      <p className="hud-label">{label}</p>
      <p className={cn("mt-0.5 font-display text-lg font-semibold leading-tight text-slate-100", tone)}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-fog">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 border border-dashed border-line-strong bg-abyss px-6 py-9 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center border border-hextech-500/40 bg-hextech-500/10">
        <Icon className="h-5 w-5 text-hextech-300" strokeWidth={1.7} />
      </div>
      <div>
        <p className="font-display text-sm font-semibold text-slate-200">{title}</p>
        {message ? <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-fog">{message}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-hextech-400", className)} strokeWidth={2} />;
}

export function ItemTile({
  bootstrap,
  item,
  showText = true,
  size = "md",
}: {
  bootstrap: Bootstrap;
  item: ItemRef;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <div
      className={cn(
        "group flex min-w-0 items-center gap-2 border border-line bg-panel-2 p-1.5 transition-colors hover:border-hextech-500/40 hover:bg-panel-3",
        !showText && "justify-center border-transparent bg-transparent p-0 hover:bg-transparent",
      )}
      title={`${item.name} — ${item.price}g\n${item.description}`}
    >
      <SmartImage
        sources={itemRefIcon(bootstrap, item.icon)}
        alt={item.name}
        className={cn("shrink-0 rounded-md ring-1 ring-line-strong", box)}
      />
      {showText ? (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-200">{item.name}</p>
          <p className="font-mono text-[10px] text-gold-400">{item.price}g</p>
        </div>
      ) : null}
    </div>
  );
}

export function RuneOrb({
  bootstrap,
  icon,
  name,
  size = "md",
  ring,
}: {
  bootstrap: Bootstrap;
  icon: string;
  name: string;
  size?: "sm" | "md" | "lg";
  ring?: boolean;
}) {
  const box = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  return (
    <SmartImage
      sources={runeRefIcon(bootstrap, icon)}
      alt={name}
      className={cn("rounded-full bg-abyss", box, ring ? "ring-2 ring-hextech-400/60" : "ring-1 ring-line-strong")}
      imgClassName="object-contain p-0.5"
    />
  );
}

export function SkillOrderStrip({ plan, compact }: { plan: SkillPlan; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {plan.order.map((skill, index) => (
        <div
          key={`${skill}-${index}`}
          className={cn(
            "skill-chip",
            skill === "R"
              ? "border-gold-500/50 bg-gold-500/[0.08] text-gold-300"
              : skill === "Q"
                ? "border-hextech-500/60 bg-hextech-500/15 text-hextech-300"
                : skill === "W"
                  ? "border-line-strong bg-slate-500/[0.06] text-mist"
                  : "border-emerald-600/40 bg-emerald-600/[0.08] text-emerald-300",
            compact && "h-6 w-6 text-[10px]",
          )}
          title={`Level ${index + 1}: ${skill}`}
        >
          {skill}
          {!compact ? <span className="ml-0.5 text-[8px] font-normal text-fog">{index + 1}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function RuneSummary({ bootstrap, runes }: { bootstrap: Bootstrap; runes: RunePage }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 border border-line bg-abyss px-2 py-1.5">
        <RuneOrb bootstrap={bootstrap} icon={runes.keystone.icon} name={runes.keystone.name} ring />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-slate-100">{runes.keystone.name}</p>
          <p className="text-[10px] text-fog">{runes.primaryStyleName}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {runes.primaryPerks.map((rune) => (
          <RuneOrb key={rune.id} bootstrap={bootstrap} icon={rune.icon} name={rune.name} size="sm" />
        ))}
        <span className="mx-1 h-4 w-px bg-slate-600" />
        {runes.subPerks.map((rune) => (
          <RuneOrb key={rune.id} bootstrap={bootstrap} icon={rune.icon} name={rune.name} size="sm" />
        ))}
      </div>
    </div>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}
