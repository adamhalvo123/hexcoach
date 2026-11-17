import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Circle,
  Database,
  Eye,
  EyeOff,
  Github,
  Info,
  KeyRound,
  Keyboard,
  Monitor,
  Moon,
  MousePointerClick,
  Palette,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { DEFAULT_SETTINGS, REGIONS } from "@/lib/defaults";
import { errorMessage, fetchRiotApi, quitApp } from "@/lib/api";
import { isDesktop } from "@/lib/env";
import { cn, shortPatch } from "@/lib/format";
import { THEME_OPTIONS } from "@/lib/theme";
import type { Hotkeys, Settings, Theme } from "@/lib/types";
import { useApp } from "@/state/store";
import { Panel, Spinner } from "@/components/shared";

const THEME_ICONS: Record<Theme, typeof Moon> = {
  dark: Moon,
  light: Sun,
  oled: Circle,
};

function keySourceLabel(source: string): string {
  return source === "local" ? "local key" : "not configured";
}

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
      className="flex w-full items-center gap-3 border border-line bg-abyss px-3 py-2.5 text-left transition-colors hover:border-hextech-500/40 hover:bg-panel-3/40"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-fog">{description}</p>
      </div>
      <span
        className={cn(
          "relative h-5 w-10 shrink-0 border transition-colors",
          checked ? "border-hextech-500/70 bg-hextech-500/10" : "border-line-strong bg-abyss",
        )}
      >
        <span
          className={cn(
            "absolute top-[1px] h-[16px] w-[16px] transition-transform",
            checked ? "translate-x-[21px] bg-hextech-400" : "translate-x-[1px] bg-fog",
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
  const {
    settings,
    saveSettings,
    clearRiotKey,
    ddragon,
    bootstrap,
    perf,
    appInfo,
    refreshData,
    pushToast,
    theme,
    setTheme,
    hotkeyStatus,
    applyHotkeys,
  } = useApp();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [applyingHotkeys, setApplyingHotkeys] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);

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
      riotKeyConfigured: settings.riotKeyConfigured,
      riotKeySource: settings.riotKeySource,
      riotId: draft.riotId,
      region: draft.region,
    });
    pushToast("info", "Defaults restored", "Review the values, then save to apply.");
  };

  const quitHexCoach = async () => {
    try {
      await quitApp();
    } catch (error) {
      pushToast("error", "Could not quit HexCoach", errorMessage(error));
    }
  };

  const applyHotkeyChanges = async () => {
    setApplyingHotkeys(true);
    try {
      await applyHotkeys(draft.hotkeys);
    } catch {
      // The store already surfaced the error toast.
    } finally {
      setApplyingHotkeys(false);
    }
  };

  const verifyRiotKey = async () => {
    if (!isDesktop()) {
      pushToast("info", "Web preview", "Riot API verification runs in the desktop app.");
      return;
    }
    if (draft.riotApiKey.trim()) {
      pushToast("info", "Save the key first", "HexCoach verifies the key stored by the Rust backend, not the unsaved field.");
      return;
    }
    const [gameName, tagLine] = draft.riotId.split("#");
    if (!gameName?.trim() || !tagLine?.trim()) {
      pushToast("error", "Riot ID needed", "Enter your Riot ID in the Name#Tag form before verifying.");
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const response = await fetchRiotApi({
        kind: "account",
        region: draft.region,
        gameName: gameName.trim(),
        tagLine: tagLine.trim(),
      });
      if (response.status === 200) {
        const data = response.data as { puuid?: string; gameName?: string; tagLine?: string } | null;
        setVerifyResult({
          ok: true,
          message: data?.puuid
            ? `Verified ${data.gameName ?? gameName}#${data.tagLine ?? tagLine}`
            : `Verified ${gameName}#${tagLine}`,
        });
        pushToast("success", "Riot key verified", "Account-v1 answered with HTTP 200.");
      } else {
        setVerifyResult({ ok: false, message: `Riot API returned HTTP ${response.status}` });
        pushToast("error", "Riot key check failed", `The Riot API returned HTTP ${response.status}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setVerifyResult({ ok: false, message });
      pushToast("error", "Riot key check failed", message);
    } finally {
      setVerifying(false);
    }
  };

  const removeLocalKey = async () => {
    try {
      await clearRiotKey();
      setVerifyResult(null);
    } catch {
      // The store already surfaced the error toast.
    }
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
          <Panel
            icon={Palette}
            title="Appearance"
            subtitle="Applies instantly and persists across launches"
            bodyClassName="space-y-3 p-3"
          >
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = THEME_ICONS[option.id];
                const active = theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    aria-pressed={active}
                    className={cn(
                      "group relative flex flex-col gap-1.5 border p-2 text-left transition-colors",
                      active
                        ? "border-hextech-500/70 bg-hextech-500/10"
                        : "border-line bg-abyss hover:border-hextech-500/40 hover:bg-panel-3/40",
                    )}
                  >
                    <span className="flex h-8 w-full overflow-hidden border border-line">
                      {option.swatches.map((swatch) => (
                        <span key={swatch} className="h-full flex-1" style={{ background: swatch }} />
                      ))}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Icon className={cn("h-3 w-3", active ? "text-hextech-300" : "text-fog")} />
                      <span
                        className={cn(
                          "font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
                          active ? "text-hextech-300" : "text-slate-300",
                        )}
                      >
                        {option.label}
                      </span>
                      {active ? <Check className="ml-auto h-3 w-3 text-hextech-300" /> : null}
                    </span>
                    <span className="text-[9px] leading-relaxed text-fog">{option.description}</span>
                  </button>
                );
              })}
            </div>
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-fog">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
              <span>
                Dark is the default on every launch. Your choice is stored in both{" "}
                <span className="font-mono text-slate-300">localStorage</span> and{" "}
                <span className="font-mono text-slate-300">settings.json</span>, so there is no flash of a light
                shell while HexCoach starts.
              </span>
            </p>
          </Panel>

          <Panel
            icon={KeyRound}
            title="Riot account"
            subtitle="Optional · the key never reaches the frontend"
            action={
              <span
                className={cn(
                  "chip",
                  draft.riotKeyConfigured ? "border-emerald-500/40 text-emerald-300" : "border-line-strong text-fog",
                )}
              >
                {draft.riotKeyConfigured ? keySourceLabel(draft.riotKeySource) : "no key"}
              </span>
            }
            bodyClassName="space-y-3 p-3"
          >
            <FieldRow label="Riot ID" hint="Name#Tag">
              <input
                className="field"
                value={draft.riotId}
                onChange={(event) => update({ riotId: event.target.value })}
                placeholder="Faker#KR1"
                spellCheck={false}
              />
            </FieldRow>
            <FieldRow label="Riot API key" hint={keySourceLabel(draft.riotKeySource)}>
              <div className="relative">
                <input
                  className="field pr-10"
                  type={showKey ? "text" : "password"}
                  value={draft.riotApiKey}
                  onChange={(event) => update({ riotApiKey: event.target.value })}
                  placeholder={draft.riotKeyConfigured ? "•••••••• configured — type to replace" : "RGAPI-…"}
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void verifyRiotKey()}
                disabled={verifying || !draft.riotKeyConfigured}
              >
                {verifying ? <Spinner className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                Verify with Account-v1
              </button>
              {draft.riotKeySource === "local" ? (
                <button type="button" className="btn btn-ghost text-enemy-400" onClick={() => void removeLocalKey()}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove local key
                </button>
              ) : null}
            </div>
            {verifyResult ? (
              <p
                className={cn(
                  "border px-2 py-1.5 text-[10px] leading-relaxed",
                  verifyResult.ok
                    ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"
                    : "border-enemy-500/30 bg-enemy-500/[0.06] text-enemy-400",
                )}
              >
                {verifyResult.message}
              </p>
            ) : null}
            <p className="flex items-start gap-1.5 rounded-md border border-line bg-abyss/40 px-2 py-1.5 text-[10px] leading-relaxed text-fog">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
              <span>
                HexCoach never ships a Riot API key. The key you enter is stored only in this app's local
                settings, masked in the UI, and attached as{" "}
                <span className="font-mono text-slate-300">X-Riot-Token</span> by the Rust backend. Leave the field
                blank to keep the existing key.
              </span>
            </p>
            <div className="flex items-start gap-1.5 rounded-md border border-line bg-abyss/40 px-2 py-1.5 text-[10px] leading-relaxed text-fog">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
              <span>
                The <span className="font-semibold text-slate-200">Profile</span> page uses this Riot ID, region and
                key to load ranked entries, the last ten matches and your most frequent teammates.
              </span>
            </div>
          </Panel>

          <Panel icon={Monitor} title="Overlay" subtitle="Window behaviour and transparency" bodyClassName="space-y-2.5 p-3">
            <Toggle
              checked={draft.alwaysOnTop}
              onChange={(value) => update({ alwaysOnTop: value })}
              label="Always on top"
              description="Keeps HexCoach above the League client while you play."
            />
            <Toggle
              checked={draft.hudOverlay}
              onChange={(value) => update({ hudOverlay: value })}
              label="In-game HUD"
              description="Click-through top-right overlay with enemy respawns, Flash timers, next item and skill order."
            />
            <div className="flex items-start gap-2 rounded-md border border-line bg-abyss/40 px-2 py-1.5 text-[10px] leading-relaxed text-fog">
              <MousePointerClick className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
              <span>
                The HUD starts click-through so fights keep mouse focus. Press{" "}
                <span className="font-mono text-slate-300">{draft.hotkeys.toggleHud}</span> to make it interactive,
                then again to pass clicks straight back into League.
              </span>
            </div>
            <div className="border border-line bg-abyss px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Overlay opacity</span>
                <span className="font-mono text-[11px] text-slate-100">{Math.round(draft.overlayOpacity * 100)}%</span>
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
            <div className="flex items-center justify-between rounded-lg border border-line bg-abyss/30 px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-slate-200">Compact mode</p>
                <p className="mt-0.5 text-[10px] text-fog">
                  Toggle from the title bar or press {draft.hotkeys.toggleCompact}.
                </p>
              </div>
              <span className="chip">432 × 590</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-abyss/30 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200">Close to tray</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-fog">
                  The title bar X hides HexCoach next to the clock. Reopen it from the tray icon or press{" "}
                  {draft.hotkeys.toggleVisibility}.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost shrink-0"
                onClick={() => void quitHexCoach()}
                disabled={!isDesktop()}
                title="Stop HexCoach completely (the X only hides it to the tray)"
              >
                <Power className="h-3.5 w-3.5" />
                Quit
              </button>
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
          <Panel
            icon={Keyboard}
            title="Global hotkeys"
            subtitle="Registered by Rust · they fire even while League has focus"
            action={
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void applyHotkeyChanges()}
                disabled={applyingHotkeys}
              >
                {applyingHotkeys ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                Apply &amp; test
              </button>
            }
            bodyClassName="space-y-2.5 p-3"
          >
            <FieldRow label="Compact overlay" hint="Alt+X default">
              <input
                className="field font-mono text-xs"
                value={draft.hotkeys.toggleCompact}
                onChange={(event) => updateHotkey("toggleCompact", event.target.value)}
                spellCheck={false}
              />
            </FieldRow>
            <FieldRow label="Dashboard click-through" hint="Alt+Z default">
              <input
                className="field font-mono text-xs"
                value={draft.hotkeys.toggleClickThrough}
                onChange={(event) => updateHotkey("toggleClickThrough", event.target.value)}
                spellCheck={false}
              />
            </FieldRow>
            <FieldRow label="Show / hide overlay" hint="Alt+H default">
              <input
                className="field font-mono text-xs"
                value={draft.hotkeys.toggleVisibility}
                onChange={(event) => updateHotkey("toggleVisibility", event.target.value)}
                spellCheck={false}
              />
            </FieldRow>
            <FieldRow label="In-game HUD interaction" hint="Alt+C default">
              <input
                className="field font-mono text-xs"
                value={draft.hotkeys.toggleHud}
                onChange={(event) => updateHotkey("toggleHud", event.target.value)}
                spellCheck={false}
              />
            </FieldRow>

            {hotkeyStatus?.bindings.length ? (
              <div className="space-y-1 border border-line bg-abyss/50 p-2">
                <p className="hud-label">Registration status</p>
                {hotkeyStatus.bindings.map((binding) => (
                  <div key={binding.action} className="flex items-start gap-1.5 text-[10px] leading-relaxed">
                    {binding.registered ? (
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-enemy-400" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="text-slate-300">{binding.label}</span>{" "}
                      <span className="font-mono text-slate-400">{binding.accelerator || "—"}</span>
                      {binding.registered ? null : (
                        <span className="block text-[9px] text-enemy-400">
                          {binding.error ?? "Not registered. Pick another combination."}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-fog">
              <MousePointerClick className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
              <span>
                Use Tauri accelerator syntax, e.g.{" "}
                <span className="font-mono text-slate-300">Alt+X</span> or{" "}
                <span className="font-mono text-slate-300">CommandOrControl+Shift+C</span>. Press{" "}
                <span className="font-semibold text-slate-300">Apply &amp; test</span> to re-register immediately;
                no restart is needed.
              </span>
            </p>
            <div className="flex items-start gap-2 border border-gold-500/30 bg-gold-500/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-gold-300">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                <span className="font-semibold">Windows / Riot Vanguard:</span> Windows cannot deliver a global
                hotkey to a game running at a higher integrity level. If shortcuts do nothing while League is
                focused, close HexCoach and run it as Administrator.
              </span>
            </div>
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
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">ARAM balance</p>
                <p className="mt-0.5 font-mono text-sm text-slate-100">{bootstrap?.aram.length ?? "—"}</p>
                <p className="text-[9px] text-fog">
                  {bootstrap?.aramSource === "curated" || !bootstrap?.aramSource
                    ? "Curated offline set"
                    : bootstrap.aramSource === "cache"
                      ? "Cached CommunityDragon"
                      : "CommunityDragon"}
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
              <span className="font-mono text-slate-200">{appInfo?.version ?? "0.1.3"}</span>
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
