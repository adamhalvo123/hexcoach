import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  Database,
  Eye,
  EyeOff,
  Github,
  Info,
  KeyRound,
  Keyboard,
  Monitor,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DEFAULT_SETTINGS, REGIONS } from "@/lib/defaults";
import { cn, shortPatch } from "@/lib/format";
import type { Hotkeys, Settings } from "@/lib/types";
import { useApp } from "@/state/store";
import { Panel, Spinner } from "@/components/shared";

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 border border-line bg-abyss px-3 py-2.5 text-left transition-colors hover:border-paper/30 hover:bg-panel-3/40"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-fog">{description}</p>
      </div>
      <span
        className={cn(
          "relative h-5 w-10 shrink-0 border transition-colors",
          checked ? "border-paper/70 bg-abyss" : "border-paper/25 bg-abyss",
        )}
      >
        <span
          className={cn(
            "absolute top-[1px] h-[16px] w-[16px] transition-transform",
            checked ? "translate-x-[21px] bg-paper" : "translate-x-[1px] bg-fog",
          )}
        />
      </span>
    </button>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="hud-label">{label}</span>
        {hint ? <span className="text-[9px] text-fog/80">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export default function SettingsPage() {
  const { settings, saveSettings, ddragon, bootstrap, perf, appInfo, refreshData, pushToast } = useApp();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const dataState = bootstrap ? "ready" : ddragon.state;

  const update = (patch: Partial<Settings>) => setDraft((current) => ({ ...current, ...patch }));
  const updateHotkey = (key: keyof Hotkeys, value: string) =>
    setDraft((current) => ({ ...current, hotkeys: { ...current.hotkeys, [key]: value } }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
    } catch {
      // The store already surfaced the error toast.
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft({
      ...DEFAULT_SETTINGS,
      hotkeys: { ...DEFAULT_SETTINGS.hotkeys },
      riotApiKey: draft.riotApiKey,
      riotId: draft.riotId,
      region: draft.region,
    });
    pushToast("info", "Defaults restored", "Review the values, then save to apply.");
  };

  return (
    <div className="space-y-3.5 pb-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wide text-slate-100">Settings</h1>
          <p className="mt-0.5 text-[11px] text-fog">
            Local-only configuration · stored in your app config directory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset defaults
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <div className="space-y-3.5">
          <Panel icon={KeyRound} title="Riot account" subtitle="Optional · used for future profile features" bodyClassName="space-y-3 p-3">
            <FieldRow label="Riot ID" hint="Name#Tag">
              <input
                className="field"
                value={draft.riotId}
                onChange={(event) => update({ riotId: event.target.value })}
                placeholder="Faker#KR1"
                spellCheck={false}
              />
            </FieldRow>
            <FieldRow label="Riot API key" hint="Stored locally">
              <div className="relative">
                <input
                  className="field pr-10"
                  type={showKey ? "text" : "password"}
                  value={draft.riotApiKey}
                  onChange={(event) => update({ riotApiKey: event.target.value })}
                  placeholder="RGAPI-…"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </FieldRow>
            <FieldRow label="Region">
              <select
                className="field appearance-none"
                value={draft.region}
                onChange={(event) => update({ region: event.target.value })}
              >
                {REGIONS.map((region) => (
                  <option key={region.value} value={region.value}>
                    {region.label} ({region.value})
                  </option>
                ))}
              </select>
            </FieldRow>
            <p className="flex items-start gap-1.5 rounded-md border border-white/[0.05] bg-abyss/40 px-2 py-1.5 text-[10px] leading-relaxed text-fog">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
              The key never leaves your machine. Live builds, rune import and Data Dragon use public or local
              endpoints and do not require it.
            </p>
          </Panel>

          <Panel icon={Monitor} title="Overlay" subtitle="Window behaviour and transparency" bodyClassName="space-y-2.5 p-3">
            <Toggle
              checked={draft.alwaysOnTop}
              onChange={(value) => update({ alwaysOnTop: value })}
              label="Always on top"
              description="Keeps HexCoach above the League client while you play."
            />
            <div className="border border-line bg-abyss px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Overlay opacity</span>
                <span className="font-mono text-[11px] text-paper">{Math.round(draft.overlayOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.55}
                max={1}
                step={0.01}
                value={draft.overlayOpacity}
                onChange={(event) => update({ overlayOpacity: Number(event.target.value) })}
                className="range-paper mt-2 w-full cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[9px] text-fog">
                <span>See-through</span>
                <span>Solid</span>
              </div>
            </div>
            <Toggle
              checked={draft.performanceHud}
              onChange={(value) => update({ performanceHud: value })}
              label="Performance HUD"
              description="Shows RAM, local API latency and cache progress in the status bar."
            />
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-abyss/30 px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-slate-200">Compact mode</p>
                <p className="mt-0.5 text-[10px] text-fog">Toggle from the title bar or Ctrl+Shift+C.</p>
              </div>
              <span className="chip">432 × 590</span>
            </div>
          </Panel>

          <Panel icon={Sparkles} title="Behaviour" subtitle="Demo data and rune automation" bodyClassName="space-y-2.5 p-3">
            <Toggle
              checked={draft.demoMode}
              onChange={(value) => update({ demoMode: value })}
              label="Demo mode"
              description="Shows a realistic fake live game and champ select. Turn off to read the real local clients."
            />
            <Toggle
              checked={draft.autoImport}
              onChange={(value) => update({ autoImport: value })}
              label="Auto-import runes"
              description="When the League client is detected in a real game, apply the recommended page once."
            />
            <div className="flex items-start gap-2 rounded-lg border border-gold-500/15 bg-gold-500/[0.04] px-3 py-2 text-[10px] leading-relaxed text-gold-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Auto-import writes to your active rune page. Use it only when you are comfortable with HexCoach
              editing rune pages through the local client API.
            </div>
          </Panel>
        </div>

        <div className="space-y-3.5">
          <Panel icon={Keyboard} title="Global hotkeys" subtitle="Applied to the desktop window" bodyClassName="space-y-2.5 p-3">
            <FieldRow label="Compact overlay" hint="Ctrl+Shift+C default">
              <input
                className="field font-mono text-xs"
                value={draft.hotkeys.toggleCompact}
                onChange={(event) => updateHotkey("toggleCompact", event.target.value)}
                spellCheck={false}
              />
            </FieldRow>
            <FieldRow label="Click-through" hint="Ctrl+Shift+X default">
              <input
                className="field font-mono text-xs"
                value={draft.hotkeys.toggleClickThrough}
                onChange={(event) => updateHotkey("toggleClickThrough", event.target.value)}
                spellCheck={false}
              />
            </FieldRow>
            <FieldRow label="Show / hide overlay" hint="Ctrl+Shift+H default">
              <input
                className="field font-mono text-xs"
                value={draft.hotkeys.toggleVisibility}
                onChange={(event) => updateHotkey("toggleVisibility", event.target.value)}
                spellCheck={false}
              />
            </FieldRow>
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-fog">
              <MousePointerClick className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
              Use Tauri accelerator syntax: <span className="font-mono text-slate-300">CommandOrControl+Shift+C</span>.
              Shortcuts are registered globally by the desktop app.
            </p>
          </Panel>

          <Panel
            icon={Database}
            title="Data & cache"
            subtitle="Data Dragon, CommunityDragon and local images"
            action={<span className={cn("chip", dataState === "ready" ? "text-emerald-300" : "text-gold-400")}>{dataState}</span>}
            bodyClassName="space-y-3 p-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">Patch</p>
                <p className="mt-0.5 font-mono text-sm text-slate-100">{bootstrap ? bootstrap.version : "—"}</p>
                <p className="text-[9px] text-fog">{bootstrap ? bootstrap.source : ddragon.source ?? "checking"}</p>
              </div>
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">Cached images</p>
                <p className="mt-0.5 font-mono text-sm text-slate-100">
                  {ddragon.cachedImages}/{ddragon.totalImages || perf.totalImages || "—"}
                </p>
                <p className="text-[9px] text-fog">{(perf.cacheMb || 0).toFixed(1)} MB on disk</p>
              </div>
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">Champions</p>
                <p className="mt-0.5 font-mono text-sm text-slate-100">{bootstrap?.champions.length ?? "—"}</p>
                <p className="text-[9px] text-fog">{bootstrap?.items.length ?? 0} items indexed</p>
              </div>
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">Arena augments</p>
                <p className="mt-0.5 font-mono text-sm text-slate-100">{bootstrap?.arena.length ?? "—"}</p>
                <p className="text-[9px] text-fog">
                  {bootstrap?.arenaSource === "curated" ? "Curated offline set" : "CommunityDragon"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border border-line bg-abyss px-3 py-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-200">Refresh static data</p>
                <p className="truncate text-[10px] text-fog">
                  Re-check Data Dragon {shortPatch(bootstrap?.version)} and image cache.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost shrink-0"
                onClick={() => void refreshData()}
                disabled={dataState === "loading"}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", dataState === "loading" && "animate-spin")} />
                Refresh
              </button>
            </div>
            <p className="text-[10px] leading-relaxed text-fog">
              Data Dragon is Riot's public static data CDN. Arena augments come from CommunityDragon. Images are
              cached per patch, so later launches load from disk.
            </p>
          </Panel>

          <Panel icon={Info} title="About HexCoach" subtitle="Tauri v2 · Rust · React" bodyClassName="space-y-2 p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-fog">Version</span>
              <span className="font-mono text-slate-200">{appInfo?.version ?? "0.1.0"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-fog">Build</span>
              <span className="font-mono text-slate-200">{appInfo?.buildProfile ?? "web-preview"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-fog">Uptime</span>
              <span className="font-mono text-slate-200">{Math.floor(perf.uptimeSec / 60)}m {perf.uptimeSec % 60}s</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-fog">RAM</span>
              <span className="font-mono text-slate-200">{perf.ramMb ? perf.ramMb.toFixed(1) : "—"} MB</span>
            </div>
            <div className="divider my-1" />
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-fog">
              <Github className="mt-0.5 h-3 w-3 shrink-0" />
              Source, releases and issue tracking live in the project repository. HexCoach is not endorsed by Riot
              Games. League of Legends is a registered trademark of Riot Games, Inc.
            </p>
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-fog">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
              No telemetry. No cloud sync. Settings and cache stay on this PC.
            </p>
          </Panel>
        </div>
      </div>

      {dirty ? (
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-lg border border-hextech-500/20 bg-void/95 px-3 py-2 shadow-panel backdrop-blur">
          <p className="text-[11px] text-mist">You have unsaved changes.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(settings)}>
              Discard
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              Save changes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
