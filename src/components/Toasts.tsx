import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useApp } from "@/state/store";
import { cn } from "@/lib/format";
import type { ToastKind } from "@/lib/types";

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const TONES: Record<ToastKind, string> = {
  success: "border-emerald-700",
  error: "border-enemy-500",
  info: "border-paper/50",
};

const ICON_TONES: Record<ToastKind, string> = {
  success: "text-emerald-700",
  error: "text-enemy-600",
  info: "text-ink",
};

export default function Toasts() {
  const { toasts, dismissToast } = useApp();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[80] flex w-[330px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex animate-rise items-start gap-2.5 border-2 bg-paper px-3 py-2.5 text-ink shadow-panel",
              TONES[toast.kind],
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_TONES[toast.kind])} strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink">{toast.title}</p>
              {toast.message ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink/65">{toast.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="icon-btn h-5 w-5 shrink-0 text-ink/50 hover:bg-ink hover:text-paper"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
