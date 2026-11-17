import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Crosshair,
  Info,
  RefreshCw,
  Settings2,
  Shield,
  Swords,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { errorMessage, getPlayerProfile } from "@/lib/api";
import { championIcon, profileIcon } from "@/lib/assets";
import { isDesktop } from "@/lib/env";
import {
  cn,
  formatGameTime,
  formatNumber,
  gameModeLabel,
  roleLabel,
  roleShort,
  winRateTone,
} from "@/lib/format";
import type {
  Bootstrap,
  Champion,
  FrequentTeammate,
  PlayerProfile,
  ProfileMatch,
  ProfileRank,
} from "@/lib/types";
import { useApp } from "@/state/store";
import { EmptyState, Panel, SmartImage, Spinner } from "@/components/shared";

const CREST_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests";

function crestUrl(tier: string): string {
  const key = (tier || "unranked").toLowerCase();
  // CommunityDragon currently ships Emerald only as an SVG crest.
  const extension = key === "emerald" ? "svg" : "png";
  return `${CREST_BASE}/${key}.${extension}`;
}

function tierLabel(tier: string): string {
  if (!tier) return "Unranked";
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}

function tierTone(tier: string): string {
  switch ((tier || "").toUpperCase()) {
    case "IRON":
      return "text-slate-400 border-slate-500/40 bg-slate-500/10";
    case "BRONZE":
      return "text-amber-500 border-amber-600/40 bg-amber-600/10";
    case "SILVER":
      return "text-slate-300 border-slate-300/30 bg-slate-300/10";
    case "GOLD":
      return "text-gold-300 border-gold-500/40 bg-gold-500/10";
    case "PLATINUM":
      return "text-teal-300 border-teal-500/40 bg-teal-500/10";
    case "EMERALD":
      return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
    case "DIAMOND":
      return "text-sky-300 border-sky-500/40 bg-sky-500/10";
    case "MASTER":
      return "text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10";
    case "GRANDMASTER":
      return "text-red-300 border-red-500/40 bg-red-500/10";
    case "CHALLENGER":
      return "text-cyan-200 border-cyan-400/50 bg-cyan-400/10";
    default:
      return "text-mist border-line bg-transparent";
  }
}

function rateColor(rate: number): string {
  if (rate >= 52.5) return "#5eead4";
  if (rate >= 50) return "#6ee7b7";
  if (rate >= 48) return "#fbbf24";
  return "#f87171";
}

function rateBar(rate: number): string {
  if (rate >= 52.5) return "bg-hextech-400";
  if (rate >= 50) return "bg-emerald-400";
  if (rate >= 48) return "bg-gold-400";
  return "bg-enemy-400";
}

function matchAge(timestamp: number): string {
  if (!timestamp) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function findChampion(
  bootstrap: Bootstrap,
  name: string,
  championId: number,
): Champion | undefined {
  const needle = name.toLowerCase();
  return (
    bootstrap.champions.find((entry) => entry.name.toLowerCase() === needle) ??
    bootstrap.champions.find((entry) => entry.id.toLowerCase() === needle) ??
    bootstrap.champions.find((entry) => Number(entry.key) === championId)
  );
}

function RankCrest({ tier, size = 40 }: { tier: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [tier]);

  if (failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center border",
          tierTone(tier),
        )}
        style={{ width: size, height: size }}
      >
        <Shield className="h-1/2 w-1/2" strokeWidth={1.6} />
      </span>
    );
  }

  return (
    <img
      src={crestUrl(tier)}
      alt={tierLabel(tier)}
      draggable={false}
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function WinRateDial({
  rate,
  wins,
  losses,
  label,
}: {
  rate: number;
  wins: number;
  losses: number;
  label: string;
}) {
  const value = Math.min(100, Math.max(0, rate));
  const color = rateColor(value);
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${value * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
      >
        <div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-panel">
          <span className={cn("font-display text-lg font-bold leading-none", winRateTone(value))}>
            {formatNumber(value, 1)}%
          </span>
          <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-fog">winrate</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="hud-label">{label}</p>
        <p className="mt-1 font-mono text-sm tabular-nums text-slate-100">
          {wins}W <span className="text-fog">/</span> {losses}L
        </p>
        <p className="mt-0.5 text-[10px] text-fog">
          {wins + losses} games tracked
        </p>
      </div>
    </div>
  );
}

function RankCard({ rank, queueLabel }: { rank?: ProfileRank; queueLabel: string }) {
  if (!rank) {
    return (
      <div className="flex items-center gap-2.5 border border-line bg-abyss px-3 py-2.5">
        <RankCrest tier="UNRANKED" size={42} />
        <div className="min-w-0">
          <p className="hud-label">{queueLabel}</p>
          <p className="mt-0.5 text-sm font-semibold text-mist">Unranked</p>
          <p className="text-[10px] text-fog">Play placement games to get a rank.</p>
        </div>
      </div>
    );
  }

  const rankedHigh = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(rank.tier.toUpperCase());
  return (
    <div className={cn("border px-3 py-2.5", tierTone(rank.tier))}>
      <div className="flex items-center gap-2.5">
        <RankCrest tier={rank.tier} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="hud-label">{queueLabel}</p>
            {rank.hotStreak ? (
              <span className="inline-flex items-center gap-0.5 border border-gold-500/50 px-1 py-px font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-gold-300">
                <TrendingUp className="h-2.5 w-2.5" />
                hot
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate font-display text-base font-bold leading-tight text-slate-100">
            {tierLabel(rank.tier)}
            {rankedHigh ? "" : ` ${rank.rank}`}
            <span className="ml-1.5 font-mono text-[10px] font-normal text-fog">
              {rank.leaguePoints} LP
            </span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden bg-slate-700/60">
              <div
                className={cn("h-full", rateBar(rank.winRate))}
                style={{ width: `${Math.min(100, Math.max(0, rank.winRate))}%` }}
              />
            </div>
            <span className={cn("font-mono text-[9px] tabular-nums", winRateTone(rank.winRate))}>
              {formatNumber(rank.winRate, 1)}%
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[9px] text-fog">
            {rank.wins}W / {rank.losses}L
          </p>
        </div>
      </div>
    </div>
  );
}

function MatchRow({
  bootstrap,
  match,
}: {
  bootstrap: Bootstrap;
  match: ProfileMatch;
}) {
  const champion = findChampion(bootstrap, match.champion, match.championId);
  const teammateDetails = match.teammates
    .map(
      (teammate) =>
        `${teammate.name.split("#")[0] || "Unknown"} (${teammate.champion || "—"}) ${teammate.kills}/${teammate.deaths}/${teammate.assists}`,
    )
    .filter(Boolean);

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-l-2 border-y border-r border-line px-2.5 py-2 transition-colors",
        match.win
          ? "border-l-emerald-500/80 bg-emerald-500/[0.035] hover:bg-emerald-500/[0.06]"
          : "border-l-enemy-500/80 bg-enemy-500/[0.035] hover:bg-enemy-500/[0.06]",
      )}
    >
      <div className="relative shrink-0">
        <SmartImage
          sources={champion ? championIcon(bootstrap, champion) : undefined}
          alt={match.champion || "Champion"}
          className="h-10 w-10 border border-line-strong"
        />
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center border px-0.5 font-mono text-[8px] font-bold uppercase",
            match.win
              ? "border-emerald-400/60 bg-void text-emerald-300"
              : "border-enemy-400/60 bg-void text-enemy-300",
          )}
        >
          {match.win ? "W" : "L"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-slate-100">
            {(champion?.name ?? match.champion) || "Unknown champion"}
          </p>
          <span className="chip shrink-0 px-1 py-px text-[8px]">
            {roleShort(match.role)}
          </span>
          <span className="hidden shrink-0 text-[9px] text-fog sm:inline">
            {gameModeLabel(match.gameMode)}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-mist">
          {match.kills} / <span className="text-enemy-400">{match.deaths}</span> / {match.assists}
          <span className="ml-1.5 text-fog">({formatNumber(match.kda, 2)} KDA)</span>
        </p>
        {teammateDetails.length ? (
          <p className="mt-0.5 truncate text-[9px] text-fog" title={teammateDetails.join(", ")}>
            with {teammateDetails.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="font-mono text-[10px] tabular-nums text-slate-200">
          {formatGameTime(match.durationSec)}
        </p>
        <p className="mt-0.5 text-[9px] text-fog">{matchAge(match.playedAtMs)}</p>
      </div>
    </div>
  );
}

function TeammateRow({
  teammate,
  index,
}: {
  teammate: FrequentTeammate;
  index: number;
}) {
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_34px_26px_26px_46px] items-center gap-1.5 border-b border-line px-1.5 py-2 last:border-b-0">
      <span className="font-mono text-[9px] text-fog">{index + 1}</span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-slate-200" title={teammate.name}>
          {teammate.name || "Unknown"}
        </p>
        <div className="mt-1 h-1 w-full overflow-hidden bg-slate-700/60">
          <div
            className={cn("h-full", rateBar(teammate.winRate))}
            style={{ width: `${Math.min(100, Math.max(0, teammate.winRate))}%` }}
          />
        </div>
      </div>
      <span className="text-right font-mono text-[10px] tabular-nums text-mist">{teammate.games}</span>
      <span className="text-right font-mono text-[10px] tabular-nums text-emerald-300">{teammate.wins}</span>
      <span className="text-right font-mono text-[10px] tabular-nums text-enemy-400">{teammate.losses}</span>
      <span
        className={cn(
          "text-right font-mono text-[10px] tabular-nums",
          winRateTone(teammate.winRate),
        )}
      >
        {formatNumber(teammate.winRate, 1)}%
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { settings, bootstrap, setPage } = useApp();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const riotId = settings.riotId.trim();
  const desktop = isDesktop();
  const ready = !desktop || (Boolean(riotId) && settings.riotKeyConfigured);

  useEffect(() => {
    if (!ready) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getPlayerProfile({ riotId: riotId || undefined, region: settings.region, count: 10 })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((reason) => {
        if (cancelled) return;
        setProfile(null);
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, riotId, settings.region, reloadToken]);

  const solo = useMemo(
    () => profile?.ranks.find((rank) => rank.queue === "RANKED_SOLO_5x5"),
    [profile],
  );
  const flex = useMemo(
    () => profile?.ranks.find((rank) => rank.queue === "RANKED_FLEX_SR"),
    [profile],
  );
  const topDuo = profile?.teammates.find((teammate) => teammate.games >= 2);

  if (!bootstrap) return null;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-bold tracking-wide text-slate-100">Profile</h1>
          <span className="chip border-hextech-500/40 bg-hextech-500/10 text-hextech-300">
            <UserRound className="h-2.5 w-2.5" />
            RIOT ACCOUNT
          </span>
          {!desktop ? (
            <span className="chip border-gold-500/50 bg-gold-500/[0.08] text-gold-300">
              DEMO PREVIEW
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] text-fog">
          Ranked standing, the last ten games and the teammates you queue with most.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setPage("settings")}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Account settings
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setReloadToken((value) => value + 1)}
          disabled={loading || !ready}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>
    </div>
  );

  let content;

  if (!ready) {
    content = (
      <Panel icon={UserRound} title="Riot account required" subtitle="Profile statistics via Riot APIs">
        <EmptyState
          icon={Shield}
          title="Connect your Riot account"
          message={
            desktop
              ? "Add your Riot ID (Name#Tag) and a Riot API key in Settings. Rust resolves your PUUID, ranked entries and match history; the key never reaches React."
              : "Open Settings to set a Riot ID."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-primary" onClick={() => setPage("settings")}>
                <Settings2 className="h-3.5 w-3.5" />
                Open Settings
              </button>
            </div>
          }
        />
      </Panel>
    );
  } else if (loading && !profile) {
    content = (
      <Panel icon={UserRound} title="Loading profile" subtitle="Account-v1 · League-v4 · Match-v5">
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
          <Spinner className="h-6 w-6" />
          <div>
            <p className="font-display text-sm font-semibold text-slate-200">
              Resolving PUUID and recent matches
            </p>
            <p className="mt-1 text-[11px] text-fog">
              Fetching up to ten match details and aggregating teammates.
            </p>
          </div>
        </div>
      </Panel>
    );
  } else if (error) {
    content = (
      <Panel icon={AlertTriangle} title="Profile unavailable" subtitle="Riot API request failed">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load the profile"
          message={error}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setReloadToken((value) => value + 1)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPage("settings")}>
                <Settings2 className="h-3.5 w-3.5" />
                Account settings
              </button>
            </div>
          }
        />
      </Panel>
    );
  } else if (profile) {
    content = (
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0 space-y-3.5">
          <Panel
            icon={UserRound}
            title="Player card"
            subtitle={`${profile.region.toUpperCase()} · level ${profile.summonerLevel}`}
            action={
              <span className="chip" title={`Fetched ${new Date(profile.fetchedAtMs).toLocaleString()}`}>
                <CalendarClock className="h-2.5 w-2.5" />
                {matchAge(profile.fetchedAtMs)}
              </span>
            }
            bodyClassName="space-y-3 p-3"
          >
            <div className="flex flex-wrap items-center gap-3 border border-line bg-abyss p-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <SmartImage
                  sources={profileIcon(bootstrap, profile.profileIconId)}
                  alt={profile.riotId}
                  className="h-[76px] w-[76px] shrink-0 border border-line-strong"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl font-bold text-slate-100">
                    {profile.gameName}
                    <span className="text-fog">#{profile.tagLine}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-fog">
                    Summoner level {profile.summonerLevel} · {profile.region.toUpperCase()}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="chip">
                      <Swords className="h-2.5 w-2.5" />
                      {profile.matches.length} recent games
                    </span>
                    <span
                      className={cn(
                        "chip",
                        profile.overallSource === "ranked"
                          ? "border-emerald-500/40 text-emerald-300"
                          : "border-gold-500/40 text-gold-300",
                      )}
                    >
                      {profile.overallSource === "ranked" ? "RANKED TOTALS" : "RECENT FORM"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <WinRateDial
                  rate={profile.overallWinRate}
                  wins={profile.overallWins}
                  losses={profile.overallLosses}
                  label={profile.overallSource === "ranked" ? "Overall ranked" : "Last 10 games"}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <RankCard rank={solo} queueLabel="Solo/Duo" />
              <RankCard rank={flex} queueLabel="Flex" />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">Recent W/L</p>
                <p className="mt-0.5 font-display text-lg font-semibold leading-none text-slate-100">
                  <span className="text-emerald-300">{profile.recentWins}</span>
                  <span className="text-fog"> / </span>
                  <span className="text-enemy-400">{profile.recentLosses}</span>
                </p>
                <p className="mt-0.5 text-[9px] text-fog">last {profile.matches.length} games</p>
              </div>
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">Recent winrate</p>
                <p className={cn("mt-0.5 font-display text-lg font-semibold leading-none", winRateTone(profile.recentWinRate))}>
                  {formatNumber(profile.recentWinRate, 1)}%
                </p>
                <p className="mt-0.5 text-[9px] text-fog">rolling sample</p>
              </div>
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">Solo queue</p>
                <p className="mt-0.5 font-display text-lg font-semibold leading-none text-slate-100">
                  {solo ? `${tierLabel(solo.tier)} ${solo.rank}` : "—"}
                </p>
                <p className="mt-0.5 text-[9px] text-fog">
                  {solo ? `${solo.leaguePoints} LP · ${formatNumber(solo.winRate, 1)}% WR` : "unranked"}
                </p>
              </div>
              <div className="border border-line bg-abyss px-3 py-2">
                <p className="hud-label">Main duo</p>
                <p className="mt-0.5 truncate font-display text-sm font-semibold leading-none text-slate-100">
                  {topDuo ? topDuo.name.split("#")[0] : "—"}
                </p>
                <p className="mt-0.5 text-[9px] text-fog">
                  {topDuo
                    ? `${topDuo.games} shared · ${formatNumber(topDuo.winRate, 1)}% WR`
                    : "no repeat teammates"}
                </p>
              </div>
            </div>
          </Panel>

          <Panel
            icon={Swords}
            title="Recent matches"
            subtitle="Last ten games · newest first"
            action={<span className="chip">{profile.matches.length} games</span>}
            bodyClassName="space-y-1.5 p-3"
          >
            {profile.matches.length ? (
              profile.matches.map((match) => (
                <MatchRow key={match.matchId} bootstrap={bootstrap} match={match} />
              ))
            ) : (
              <EmptyState
                icon={Swords}
                title="No recent matches"
                message="Riot returned no Match-v5 games for this account. Play a game and refresh."
              />
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-3.5">
          <Panel
            icon={Users}
            title="Frequent teammates"
            subtitle="Who you queue with most"
            action={<span className="chip">{profile.teammates.length} players</span>}
            bodyClassName="p-3"
          >
            {topDuo ? (
              <div className="mb-2.5 flex items-start gap-2 border border-line bg-abyss px-2.5 py-2">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
                <p className="text-[10px] leading-relaxed text-fog">
                  <span className="font-semibold text-slate-200">{topDuo.name.split("#")[0]}</span>{" "}
                  is your most frequent partner:{" "}
                  <span className={winRateTone(topDuo.winRate)}>
                    {topDuo.wins}W / {topDuo.losses}L
                  </span>{" "}
                  across {topDuo.games} shared games.{" "}
                  {topDuo.winRate >= 55
                    ? "This duo is carrying your queue."
                    : topDuo.winRate < 45
                      ? "This duo might be dragging you down."
                      : "A steady partner so far."}
                </p>
              </div>
            ) : null}

            {profile.teammates.length ? (
              <div>
                <div className="grid grid-cols-[18px_minmax(0,1fr)_34px_26px_26px_46px] gap-1.5 border-b border-line px-1.5 pb-1.5">
                  <span />
                  <span className="hud-label">Player</span>
                  <span className="hud-label text-right">G</span>
                  <span className="hud-label text-right">W</span>
                  <span className="hud-label text-right">L</span>
                  <span className="hud-label text-right">WR</span>
                </div>
                <div className="max-h-[560px] overflow-y-auto">
                  {profile.teammates.map((teammate, index) => (
                    <TeammateRow key={teammate.puuid} teammate={teammate} index={index} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No repeat teammates"
                message="The last ten matches had no teammates in common. Queue with a duo to build this table."
              />
            )}
          </Panel>

          <Panel icon={Crosshair} title="How it works" subtitle="Rust-side Riot API calls" bodyClassName="space-y-2 p-3">
            <ul className="space-y-2 text-[10px] leading-relaxed text-fog">
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                <span>
                  <span className="font-mono text-slate-300">X-Riot-Token</span> is attached only by the Rust
                  backend. React never receives the key.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <UserRound className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
                <span>
                  Account-v1 resolves <span className="font-mono text-slate-300">Name#Tag</span> to a PUUID, then
                  Summoner-v4 and League-v4 provide the icon, level and ranked entries.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Swords className="mt-0.5 h-3 w-3 shrink-0 text-hextech-400" />
                <span>
                  Match-v5 loads the last ten games. Teammate totals are aggregated in Rust, so only the summary
                  reaches the UI.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" />
                <span>
                  Development keys expire every 24 hours. Refresh the key in Settings when Riot returns HTTP
                  401/403.
                </span>
              </li>
            </ul>
            <p className="border-t border-line pt-2 font-mono text-[9px] text-fog/70">
              {profile.riotId} · {profile.puuid.slice(0, 18)}…
            </p>
          </Panel>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="flex min-h-[260px] items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {header}
      {content}
    </div>
  );
}
