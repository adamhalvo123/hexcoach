import type { Role } from "./types";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function formatGameTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function roleLabel(role?: string): string {
  switch (role) {
    case "TOP":
      return "Top";
    case "JUNGLE":
      return "Jungle";
    case "MIDDLE":
      return "Mid";
    case "BOTTOM":
      return "Bot";
    case "UTILITY":
      return "Support";
    default:
      return "Flex";
  }
}

export function roleShort(role?: string): string {
  switch (role) {
    case "TOP":
      return "TOP";
    case "JUNGLE":
      return "JNG";
    case "MIDDLE":
      return "MID";
    case "BOTTOM":
      return "BOT";
    case "UTILITY":
      return "SUP";
    default:
      return "—";
  }
}

export function normalizeRole(role?: string): Role {
  switch ((role ?? "").toUpperCase()) {
    case "TOP":
    case "TOPLANE":
      return "TOP";
    case "JUNGLE":
    case "JUNGLER":
      return "JUNGLE";
    case "MID":
    case "MIDDLE":
    case "MIDLANE":
      return "MIDDLE";
    case "ADC":
    case "BOT":
    case "BOTTOM":
    case "BOTLANE":
      return "BOTTOM";
    case "SUPPORT":
    case "SUP":
    case "UTILITY":
      return "UTILITY";
    default:
      return "NONE";
  }
}

export function tierTone(tier: string): string {
  switch (tier.toUpperCase()) {
    case "S":
      return "text-hextech-300 border-hextech-500/40 bg-hextech-500/10";
    case "A":
      return "text-gold-300 border-gold-500/40 bg-gold-500/10";
    case "B":
      return "text-arcane-400 border-arcane-500/40 bg-arcane-500/10";
    default:
      return "text-mist border-paper/15 bg-transparent";
  }
}

export function tierGlow(tier: string): string {
  switch (tier.toUpperCase()) {
    case "S":
      return "ring-1 ring-paper/25";
    default:
      return "";
  }
}

export function winRateTone(winRate: number): string {
  if (winRate >= 52.5) return "text-hextech-300";
  if (winRate >= 50) return "text-emerald-300";
  if (winRate >= 48) return "text-gold-300";
  return "text-enemy-400";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function gameModeLabel(mode?: string): string {
  switch ((mode ?? "").toUpperCase()) {
    case "CLASSIC":
      return "Summoner's Rift";
    case "ARAM":
      return "ARAM";
    case "ARAM_MAYHEM":
      return "ARAM Mayhem";
    case "CHERRY":
      return "Arena";
    case "URF":
      return "URF";
    case "NEXUSBLITZ":
      return "Nexus Blitz";
    case "ONEFORALL":
      return "One for All";
    case "TUTORIAL":
      return "Tutorial";
    default:
      return mode ? mode.replaceAll("_", " ") : "Live game";
  }
}

export function eventLabel(name: string): string {
  const map: Record<string, string> = {
    GameStart: "Game start",
    ChampionKill: "Champion kill",
    DragonKill: "Dragon slain",
    BaronKill: "Baron slain",
    HeraldKill: "Rift Herald",
    TurretKilled: "Turret destroyed",
    InhibKilled: "Inhibitor destroyed",
    FirstBlood: "First blood",
    Ace: "Ace",
  };
  return map[name] ?? name.replaceAll("_", " ");
}

export function shortPatch(version?: string): string {
  if (!version) return "—";
  const parts = version.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : version;
}

export function relativeTime(ms: number): string {
  if (!ms) return "waiting";
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}
