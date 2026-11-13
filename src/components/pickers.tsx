import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, ShieldQuestion, X } from "lucide-react";
import { useApp } from "@/state/store";
import { championIcon } from "@/lib/assets";
import { cn, roleLabel, roleShort } from "@/lib/format";
import { ROLES, type Champion, type Role } from "@/lib/types";
import { SmartImage } from "./shared";

const TAGS = ["ALL", "Fighter", "Tank", "Mage", "Marksman", "Assassin", "Support"];

export function ChampionPicker({ compact }: { compact?: boolean }) {
  const { bootstrap, champion, setChampion } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("ALL");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = bootstrap?.champions.find((entry) => entry.name === champion);
  const champions = bootstrap?.champions ?? [];

  useEffect(() => {
    if (!open) return;
    const focus = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focus);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return champions.filter((entry) => {
      if (tag !== "ALL" && !entry.tags.some((value) => value === tag)) return false;
      if (!needle) return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.id.toLowerCase().includes(needle) ||
        entry.title.toLowerCase().includes(needle)
      );
    });
  }, [champions, query, tag]);

  const pick = (entry: Champion) => {
    setChampion(entry.name);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-abyss/60 p-2 text-left transition-colors hover:border-hextech-500/40 hover:bg-panel-2/70",
          compact && "p-1.5",
        )}
      >
        {selected ? (
          <SmartImage
            sources={championIcon(bootstrap!, selected)}
            alt={selected.name}
            className={cn("shrink-0 rounded-md ring-1 ring-hextech-500/30", compact ? "h-9 w-9" : "h-11 w-11")}
          />
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md border border-dashed border-white/15 bg-panel-2 text-fog",
              compact ? "h-9 w-9" : "h-11 w-11",
            )}
          >
            <ShieldQuestion className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-display font-semibold text-slate-100", compact ? "text-xs" : "text-sm")}>
            {selected?.name ?? "Select champion"}
          </p>
          <p className="truncate text-[10px] text-fog">
            {selected ? `${selected.title} · ${selected.tags.join(" / ")}` : "Search the full roster"}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-fog transition-colors group-hover:text-hextech-300" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-hextech-500/20 bg-void/95 shadow-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search champions…"
                  className="field pl-9"
                />
              </div>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-white/[0.05] px-4 py-2">
              {TAGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTag(value)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    tag === value
                      ? "border-hextech-500/40 bg-hextech-500/15 text-hextech-200"
                      : "border-white/10 bg-white/[0.02] text-fog hover:border-white/20 hover:text-slate-200",
                  )}
                >
                  {value === "ALL" ? "All" : value}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
                {filtered.map((entry) => {
                  const active = entry.name === champion;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => pick(entry)}
                      className={cn(
                        "group relative overflow-hidden rounded-lg border p-1 text-left transition-all",
                        active
                          ? "border-hextech-500/60 bg-hextech-500/10 shadow-glow-sm"
                          : "border-white/[0.05] bg-panel-2/40 hover:border-hextech-500/30 hover:bg-panel-3/60",
                      )}
                    >
                      <div className="relative">
                        <SmartImage
                          sources={bootstrap ? championIcon(bootstrap, entry) : undefined}
                          alt={entry.name}
                          className="aspect-square w-full rounded-md ring-1 ring-black/30"
                        />
                        {active ? (
                          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-hextech-500 text-void">
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate px-0.5 text-[10px] font-semibold text-slate-200">{entry.name}</p>
                    </button>
                  );
                })}
              </div>
              {!filtered.length ? (
                <p className="py-12 text-center text-xs text-fog">No champion matches “{query}”.</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-[10px] text-fog">
              <span>{filtered.length} champions</span>
              <span>Data Dragon · current patch</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function RoleTabs({ compact }: { compact?: boolean }) {
  const { role, setRole } = useApp();
  const options: Role[] = [...ROLES, "NONE"];
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.06] bg-abyss/50 p-1">
      {options.map((value) => {
        const active = role === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setRole(value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
              active
                ? "bg-hextech-500/15 text-hextech-200 shadow-inner-line"
                : "text-fog hover:bg-white/[0.05] hover:text-slate-200",
            )}
            title={value === "NONE" ? "Auto-detect role" : roleLabel(value)}
          >
            {value === "NONE" ? "AUTO" : compact ? roleShort(value) : roleLabel(value)}
          </button>
        );
      })}
    </div>
  );
}

export function EnemySelects({
  enemies,
  onChange,
}: {
  enemies: string[];
  onChange: (index: number, value: string) => void;
}) {
  const { bootstrap } = useApp();
  const champions = bootstrap?.champions ?? [];

  return (
    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
      {enemies.map((enemy, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-enemy-500/20 bg-enemy-500/[0.06] font-mono text-[10px] text-enemy-400">
            {index + 1}
          </span>
          <select
            value={enemy}
            onChange={(event) => onChange(index, event.target.value)}
            className="field appearance-none py-1.5 text-xs"
          >
            <option value="">Enemy champion…</option>
            {champions.map((entry) => (
              <option key={entry.id} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
          {enemy ? (
            <button
              type="button"
              className="icon-btn h-6 w-6 shrink-0"
              onClick={() => onChange(index, "")}
              aria-label={`Clear enemy ${index + 1}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
