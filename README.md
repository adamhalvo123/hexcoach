# HexCoach

A fast, lightweight League of Legends overlay coach built with **Tauri v2**, **Rust**, **React**, **TypeScript** and **Tailwind CSS**.

HexCoach reads the local Riot Live Client API and League Client API, then shows a compact always-on-top HUD with the things you actually need during a game: builds, runes, skill order, enemy threats, Arena augments and ARAM / ARAM Mayhem modifiers.

> HexCoach isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

## Screenshots

| Live game | Draft helper |
| --- | --- |
| ![Live game](docs/live.png) | ![Draft helper](docs/draft.png) |

| Builds & runes | Arena Lab |
| --- | --- |
| ![Builds and runes](docs/builds.png) | ![Arena Lab](docs/arena.png) |

| Settings | Compact overlay |
| --- | --- |
| ![Settings](docs/settings.png) | ![Compact overlay](docs/compact.png) |

## Design

The interface is a monochrome, industrial hazard-label system: warm black paper stock (`#0a0a08`), cream label bands (`#e9e2ce`), heavy condensed uppercase type, 2px corners, diagonal hazard stripes and barcode accents. Cream surfaces carry black type; data panels stay dark so champion art and item icons do the talking.

All colours come from the Tailwind theme in `tailwind.config.js` and the component classes in `src/styles.css`, so the whole app can be re-skinned from two files.

## Features

- **Live game HUD** — polls `https://127.0.0.1:2999/liveclientdata/allgamedata` every ~2 seconds, tolerates the self-signed local certificate, and detects champion, role, game mode, scoreboard, items, events, Arena augments and ARAM / ARAM Mayhem state.
- **ARAM / Mayhem** — Howling Abyss balance modifiers (damage dealt/taken, healing, shielding, tenacity, ability haste, regen), Guardian starter builds, ARAM rune pages and a curated ARAM Mayhem augment tier list when Mayhem is detected.
- **Click-through in-game HUD** — a separate transparent `hud-overlay` window shows enemy respawn timers, enemy Flash cooldowns (300s, or 255s with Cosmic Insight), the next recommended item against your gold and inventory, skill max order and active augments. It starts click-through; `Alt+X` toggles interactive mode.
- **Profile** — resolves your Riot ID to a PUUID, shows Solo/Duo and Flex rank, LP, total win rate, the last ten Match-v5 games and a **Frequent teammates** table with shared wins, losses and win rate. The Rust backend aggregates everything; React only receives the summary.
- **Draft helper** — counters, synergies and estimated win-rate heuristics, plus a live champ-select mirror from the local League Client API.
- **Builds & runes** — current patch builds for Summoner's Rift, ARAM and Arena. The build card shows the live Emerald+ win/pick/ban rate and tier when the provider is reachable, curated items and runes otherwise, a start → core → situational purchase timeline, full rune tree with Data Dragon icons, mode-aware summoner spells, an 18-level skill order, and strong/weak matchups. A role switcher exposes off-meta builds.
- **Arena Lab** — searchable augment library with tier list, rarity filters, champion-class synergy scoring and active-game augment detection. If CommunityDragon is unreachable, a bundled 34-augment curated library keeps the page useful offline.
- **One-click rune import** — writes the recommended page into the League client through the local LCU API (`127.0.0.1:<lockfile port>`). No Riot API key needed.
- **Compact overlay** — `432 × 590` always-on-top HUD with core items, runes, skill order and fed enemies.
- **Local-first data** — Data Dragon and CommunityDragon files plus images are cached per patch in the app cache directory.
- **Performance HUD** — RAM, local API latency, patch, cache size and cached image progress.
- **Global hotkeys** — compact mode, click-through, show/hide and the in-game HUD toggle, registered by Rust.
- **Server-side Riot API proxy** — Account-v1, League-v4, Match-v5 and Summoner-v4 calls are made by Rust. The key is read from local Settings or the build-time `RIOT_API_KEY` and only ever attached as `X-Riot-Token` on the backend.

## Stack

| Layer | Technology |
| --- | --- |
| Shell | Tauri v2 (Rust) |
| UI | React 19 + TypeScript + Tailwind CSS |
| Icons | Lucide React |
| HTTP | `reqwest` (Rust) with a separate client that accepts the local self-signed certificate |
| Static data | Data Dragon + CommunityDragon |
| Build | Vite 6 + Cargo |

## Requirements

- Windows 10/11 (the release workflow targets Windows; the code itself is portable)
- Node.js 20+ and npm
- Rust stable with the MSVC target
- Visual Studio 2022 Build Tools (Desktop development with C++)
- Microsoft Edge WebView2 runtime (preinstalled on Windows 11)

## Development

```powershell
npm install
npm run tauri:dev
```

The first launch fetches the current Data Dragon patch, rune/item/champion data and Arena augments, then warms the image cache. Later launches load from disk.

### Web preview (no Tauri shell)

```powershell
npm run dev
```

The browser preview fetches Data Dragon directly and falls back to demo live-game and demo profile data, so you can iterate on the UI without the desktop shell. Rune import, real local-client polling and live Riot API calls are desktop-only.

Preview deep links are available for screenshots and UI work:

```text
http://127.0.0.1:1420/?page=live|draft|builds|arena|aram|profile|settings
http://127.0.0.1:1420/?compact=1
http://127.0.0.1:1420/?hud=1
http://127.0.0.1:1420/?mode=aram
http://127.0.0.1:1420/?mode=mayhem
http://127.0.0.1:1420/?hud=1&mode=mayhem
```

### Production build

```powershell
npm run tauri:build
```

Installers are written to `src-tauri/target/release/bundle/`.

### Data validation

```powershell
node scripts/validate-data.mjs
```

Validates every champion, item, rune and Arena augment name in `src/data/meta.json` against the live Data Dragon / CommunityDragon files.

## Project layout

```
src/
  components/        HUD shell, in-game HUD, compact overlay, pickers, shared UI
  pages/             Profile, Live Game, Draft, Builds, Arena, ARAM / Mayhem, Settings
  lib/               API wrappers, types, assets, ARAM helpers, browser fallback, demo data
  data/meta.json     curated patch data (builds, rune profiles, matchups, Arena tiers)
  data/arena-fallback.json  bundled Arena augments used when CommunityDragon is offline
  data/aram-balance.json    curated Howling Abyss balance snapshot
  data/aram-mayhem.json     curated ARAM Mayhem augment tiers
src-tauri/src/
  ddragon.rs         Data Dragon patch resolution, JSON + image cache
  arena.rs           CommunityDragon Arena augments
  aram.rs            CommunityDragon ARAM balance with cache + curated fallback
  live_client.rs     Live Client API polling, ARAM/Mayhem detection and HUD window sync
  lcu.rs             League Client lockfile, champ select and rune import
  recommend.rs       Recommendation engine
  profile.rs         Riot ID/PUUID, League-v4 ranks, Match-v5 history and teammate aggregation
  riot.rs            Server-side Riot API proxy (Account-v1, Match-v5, Summoner-v4)
  shortcuts.rs       Global hotkeys and HUD click-through
  settings.rs        Local settings persistence and masked Riot key handling
  commands.rs        Performance, compact mode, HUD overlay commands, app info
scripts/             Data validation and publishing helpers
```

## Riot endpoints used

| Endpoint | Purpose |
| --- | --- |
| `https://127.0.0.1:2999/liveclientdata/allgamedata` | In-game state (self-signed certificate) |
| League lockfile → `/lol-champ-select/v1/session` | Champ select mirror |
| League lockfile → `/lol-perks/v1/pages` | Rune page import |
| `https://ddragon.leagueoflegends.com` | Champions, items, runes, spells and images |
| `https://raw.communitydragon.org` | Arena augment metadata and ARAM balance modifiers |
| `https://<routing>.api.riotgames.com` | Account-v1 and Match-v5 via the Rust backend (Account-v1 also through `fetch_riot_api`) |
| `https://<platform>.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}` | Summoner icon and level via `get_player_profile` (backend only) |
| `https://<platform>.api.riotgames.com/lol/league/v4/entries/by-summoner/{id}` | Solo/Duo and Flex rank, LP, wins and losses via `get_player_profile` (backend only) |

### Riot API key

The key is never hardcoded or sent to the frontend.

- A local key entered in Settings is written to the app config directory and takes priority.
- Release builds can inject a community key at compile time: the workflow passes `${{ secrets.RIOT_API_KEY }}` into the `tauri-action` build environment, and Rust reads it with `option_env!("RIOT_API_KEY")`.
- `get_settings` always returns an empty `riotApiKey` plus `riotKeyConfigured` and `riotKeySource` (`local`, `environment` or `none`). Saving with an empty field keeps the existing key, and **Remove local key** clears only the local override.
- `fetch_riot_api` builds Account-v1, Match-v5 or Summoner-v4 URLs in Rust and adds `X-Riot-Token` server-side.
- `get_player_profile` resolves the Riot ID, loads Summoner-v4, League-v4 and the last ten Match-v5 games, then aggregates frequent teammates entirely in Rust. It returns only the summary to React.
- Live builds, rune import and static data do not require a key.

To bake a key into a local release build without committing it:

```powershell
$env:RIOT_API_KEY = "RGAPI-…"
npm run tauri:build
```

### Arena data fallback

Arena augments are fetched from CommunityDragon and cached for 12 hours. If the feed is down (it occasionally returns 502/522) or the browser preview cannot reach it because of CORS, HexCoach uses `src/data/arena-fallback.json` and labels the library **OFFLINE SET**. The live feed and icons replace it automatically once it is reachable again.

### ARAM data fallback

Howling Abyss modifiers come from CommunityDragon's ARAM balance feed. The result is cached, and if the feed is unreachable HexCoach falls back to `src/data/aram-balance.json` and labels the page **CURATED SNAPSHOT**. These values are percentage-point estimates, not Riot match data. ARAM Mayhem augment tiers in `src/data/aram-mayhem.json` are drafting heuristics, matched to the Arena augment library for icons and descriptions.

### Meta build providers

`get_champion_build(championKey, role, gameMode)` resolves a build through a provider chain:

1. **LoLalytics live summary** (Summoner's Rift only) — reads the server-rendered champion page and extracts the Emerald+ win rate, pick rate, ban rate, games, tier, rank and counter names. Item and rune sections on that site are client-rendered, so those stay curated.
2. **Curated snapshot** — `src/data/meta.json` supplies items, runes, skill order and tips, enriched with Data Dragon item/rune/spell metadata. This provider always succeeds, including for ARAM (`ARAM`) and Arena (`CHERRY`).
3. **Disk cache** — successful builds are written to `builds_cache.json` in the app data directory, keyed by champion, role, game mode and patch with a **12 hour TTL**. Reopening a champion loads the cached build immediately and labels it **Cached**.

Provider timeouts, rate limits, HTTP errors and layout changes never fail the command: the next provider is used and the reason appears in the build notes. Pass `refresh: true` to bypass the TTL and retry live data.



## In-game overlay

The `hud-overlay` window is a separate Tauri window configured in `src-tauri/tauri.conf.json`:

- transparent, undecorated, always on top and hidden from the taskbar
- loads `index.html?hud=1`
- created hidden and shown only while `liveGame.active` is true and the **In-game HUD** setting is enabled
- starts with `set_ignore_cursor_events(true)` so mouse clicks pass through to League
- `set_overlay_clickthrough(ignore)` calls `window.set_ignore_cursor_events(ignore)`; the default `Alt+X` global shortcut toggles interactive vs click-through and emits `hud-clickthrough-changed`

The HUD intentionally stays minimal: enemy respawn timers, clickable enemy summoner-spell timers, the next affordable build item, skill max order and active Arena / Mayhem augments.

## About win rates

HexCoach labels curated numbers **EST. WR**. They are derived from the meta scores in `src/data/meta.json` plus class heuristics. When the LoLalytics provider responds, the Builds page instead shows the live **Emerald+** win rate, pick rate, ban rate and sample size for Summoner's Rift, labelled with that source. Arena and ARAM always use curated estimates. Treat all values as drafting guidance, not authoritative statistics.

## Releases

`.github/workflows/release.yml` builds the Windows NSIS installer with the official [`tauri-action`](https://github.com/tauri-apps/tauri-action) on every push to `main`, on `v*` tags, and on manual dispatch. The workflow creates a GitHub Release and attaches the generated `.exe` installer (plus `.msi` if you extend the bundle list).

To publish the repository for the first time:

```powershell
gh auth login
powershell -ExecutionPolicy Bypass -File scripts/publish.ps1 -Name hexcoach
```

## Settings

Settings and the Data Dragon cache live in your app config/cache directories. No telemetry, no cloud sync.

- Demo mode (default on) shows a realistic fake game so the UI is explorable without League running.
- Turn demo mode off to read the real Live Client and League Client APIs.
- Global hotkeys use Tauri accelerator syntax, e.g. `CommandOrControl+Shift+C`.
- The in-game HUD toggle defaults to `Alt+X` and works globally, even while League has focus.
- The Riot key field is write-only: it is blank on load, and blank means "keep the saved key".

## License

MIT
