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
  success: "border-emerald-500/60",
  error: "border-enemy-500/60",
  info: "border-hextech-500/50",
};

const ICON_TONES: Record<ToastKind, string> = {
  success: "text-emerald-400",
  error: "text-enemy-400",
  info: "text-hextech-300",
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
              "pointer-events-auto flex animate-rise items-start gap-2.5 border-2 bg-panel px-3 py-2.5 text-slate-200 shadow-panel",
              TONES[toast.kind],
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_TONES[toast.kind])} strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-100">{toast.title}</p>
              {toast.message ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{toast.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="icon-btn h-5 w-5 shrink-0"
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
