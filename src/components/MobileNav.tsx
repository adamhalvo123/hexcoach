import { Activity, Flame, Hammer, Settings2, Sparkles, Swords, UserRound } from "lucide-react";
import { useApp } from "@/state/store";
import { cn } from "@/lib/format";
import type { Page } from "@/lib/types";

const ITEMS: Array<{ id: Page; label: string; icon: typeof Activity }> = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "live", label: "Live", icon: Activity },
  { id: "draft", label: "Draft", icon: Swords },
  { id: "builds", label: "Builds", icon: Hammer },
  { id: "arena", label: "Arena", icon: Sparkles },
  { id: "aram", label: "ARAM", icon: Flame },
  { id: "settings", label: "Config", icon: Settings2 },
];

export default function MobileNav() {
  const { page, setPage } = useApp();

  return (
    <nav className="relative z-10 flex shrink-0 items-stretch overflow-x-auto border-b border-ink bg-paper md:hidden">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = page === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setPage(item.id)}
            className={cn(
              "flex flex-1 shrink-0 items-center justify-center gap-1.5 px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors",
              active ? "bg-ink text-paper" : "text-ink/60 hover:bg-ink/[0.07] hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
