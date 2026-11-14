use crate::Clients;
use serde::Serialize;
use serde_json::Value;
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewWindow};
use tokio::{sync::RwLock, time::MissedTickBehavior};

const LIVE_HTTPS: &str = "https://127.0.0.1:2999/liveclientdata/allgamedata";
const LIVE_HTTP: &str = "http://127.0.0.1:2999/liveclientdata/allgamedata";

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LiveItem {
    pub item_id: i64,
    pub display_name: String,
    pub count: i64,
    pub price: i64,
    pub slot: i64,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LivePlayer {
    pub champion: String,
    pub summoner_name: String,
    pub team: String,
    pub position: String,
    pub level: i64,
    pub is_dead: bool,
    pub respawn_timer: f64,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub creep_score: f64,
    pub ward_score: f64,
    pub items: Vec<LiveItem>,
    pub summoner_spells: Vec<String>,
    pub augments: Vec<String>,
    pub is_local: bool,
    pub is_bot: bool,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LiveEvent {
    pub event_id: i64,
    pub name: String,
    pub time: f64,
    pub killer: String,
    pub victim: String,
    pub team: String,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LiveGame {
    pub active: bool,
    pub game_mode: String,
    pub map_name: String,
    pub game_time: f64,
    pub my_champion: String,
    pub my_role: String,
    pub my_level: i64,
    pub my_team: Vec<LivePlayer>,
    pub enemy_team: Vec<LivePlayer>,
    pub events: Vec<LiveEvent>,
    pub augments: Vec<String>,
    pub is_aram: bool,
    pub is_mayhem: bool,
    pub my_gold: f64,
    pub latency_ms: u64,
    pub updated_at: u64,
}

pub struct LiveState {
    pub game: RwLock<LiveGame>,
    pub latency_ms: AtomicU64,
}

impl Default for LiveState {
    fn default() -> Self {
        Self {
            game: RwLock::new(LiveGame::default()),
            latency_ms: AtomicU64::new(0),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default()
}

fn str_at<'a>(value: &'a Value, path: &[&str]) -> &'a str {
    let mut cursor = value;
    for key in path {
        cursor = match cursor.get(*key) {
            Some(next) => next,
            None => return "",
        };
    }
    cursor.as_str().unwrap_or_default()
}

fn f64_at(value: &Value, path: &[&str]) -> f64 {
    let mut cursor = value;
    for key in path {
        cursor = match cursor.get(*key) {
            Some(next) => next,
            None => return 0.0,
        };
    }
    cursor.as_f64().unwrap_or_default()
}

fn i64_at(value: &Value, path: &[&str]) -> i64 {
    let mut cursor = value;
    for key in path {
        cursor = match cursor.get(*key) {
            Some(next) => next,
            None => return 0,
        };
    }
    cursor
        .as_i64()
        .or_else(|| cursor.as_f64().map(|n| n as i64))
        .unwrap_or_default()
}

fn bool_at(value: &Value, path: &[&str]) -> bool {
    let mut cursor = value;
    for key in path {
        cursor = match cursor.get(*key) {
            Some(next) => next,
            None => return false,
        };
    }
    cursor.as_bool().unwrap_or_default()
}

fn base_name(name: &str) -> &str {
    name.split('#').next().unwrap_or(name).trim()
}

fn parse_augments(value: &Value) -> Vec<String> {
    let mut out = Vec::new();
    for key in ["augments", "playerAugments", "augmentList", "augmentNames"] {
        let Some(list) = value.get(key).and_then(|v| v.as_array()) else {
            continue;
        };
        for augment in list {
            if let Some(name) = augment.as_str() {
                out.push(name.to_string());
            } else if let Some(name) = augment
                .get("augmentName")
                .or_else(|| augment.get("name"))
                .and_then(|v| v.as_str())
            {
                out.push(name.to_string());
            } else if let Some(id) = augment
                .get("augmentId")
                .or_else(|| augment.get("id"))
                .and_then(|v| v.as_i64())
            {
                out.push(format!("id:{id}"));
            }
        }
    }
    out.dedup();
    out
}

fn parse_player(raw: &Value, local_names: &[String]) -> LivePlayer {
    let summoner_name = str_at(raw, &["summonerName"]).to_string();
    let champion = str_at(raw, &["championName"]).to_string();
    let is_local = !summoner_name.is_empty()
        && local_names
            .iter()
            .any(|name| base_name(name).eq_ignore_ascii_case(base_name(&summoner_name)));

    let mut spells = Vec::new();
    for slot in ["summonerSpellOne", "summonerSpellTwo"] {
        let name = str_at(raw, &["summonerSpells", slot, "displayName"]);
        if !name.is_empty() {
            spells.push(name.to_string());
        }
    }

    let items = raw
        .get("items")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .map(|item| LiveItem {
                    item_id: i64_at(item, &["itemID"]),
                    display_name: str_at(item, &["displayName"]).to_string(),
                    count: i64_at(item, &["count"]),
                    price: i64_at(item, &["price"]),
                    slot: i64_at(item, &["slot"]),
                })
                .collect()
        })
        .unwrap_or_default();

    LivePlayer {
        champion,
        summoner_name,
        team: str_at(raw, &["team"]).to_string(),
        position: {
            let direct = str_at(raw, &["position"]);
            if direct.is_empty() {
                str_at(raw, &["assignedPosition"]).to_string()
            } else {
                direct.to_string()
            }
        },
        level: i64_at(raw, &["level"]),
        is_dead: bool_at(raw, &["isDead"]),
        respawn_timer: f64_at(raw, &["respawnTimer"]),
        kills: i64_at(raw, &["scores", "kills"]),
        deaths: i64_at(raw, &["scores", "deaths"]),
        assists: i64_at(raw, &["scores", "assists"]),
        creep_score: f64_at(raw, &["scores", "creepScore"]),
        ward_score: f64_at(raw, &["scores", "wardScore"]),
        items,
        summoner_spells: spells,
        augments: parse_augments(raw),
        is_local,
        is_bot: bool_at(raw, &["isBot"]),
    }
}

fn parse_events(value: &Value) -> Vec<LiveEvent> {
    let mut events: Vec<LiveEvent> = value
        .get("events")
        .and_then(|v| v.get("Events"))
        .and_then(|v| v.as_array())
        .map(|list| {
            list.iter()
                .map(|event| LiveEvent {
                    event_id: i64_at(event, &["EventID"]),
                    name: str_at(event, &["EventName"]).to_string(),
                    time: f64_at(event, &["EventTime"]),
                    killer: str_at(event, &["KillerName"]).to_string(),
                    victim: str_at(event, &["VictimName"]).to_string(),
                    team: str_at(event, &["Team"]).to_string(),
                })
                .filter(|event| !event.name.is_empty())
                .collect()
        })
        .unwrap_or_default();
    events.sort_by(|a, b| b.time.partial_cmp(&a.time).unwrap_or(std::cmp::Ordering::Equal));
    events.truncate(12);
    events
}

fn parse_game(value: &Value, latency_ms: u64) -> LiveGame {
    let player_name = str_at(value, &["playerName"]);
    let active_name = str_at(value, &["activePlayer", "summonerName"]);
    let local_names: Vec<String> = [player_name, active_name]
        .into_iter()
        .filter(|name| !name.is_empty())
        .map(|name| name.to_string())
        .collect();

    let mut players: Vec<LivePlayer> = value
        .get("allPlayers")
        .and_then(|v| v.as_array())
        .map(|list| {
            list.iter()
                .filter(|player| !str_at(player, &["championName"]).is_empty())
                .map(|player| parse_player(player, &local_names))
                .collect()
        })
        .unwrap_or_default();

    // Some Arena patches expose the local player's augments outside allPlayers.
    let active_augments = parse_augments(value.get("activePlayer").unwrap_or(&Value::Null));
    if !active_augments.is_empty() {
        if let Some(me) = players.iter_mut().find(|p| p.is_local) {
            for augment in active_augments {
                if !me.augments.contains(&augment) {
                    me.augments.push(augment);
                }
            }
        }
    }

    let my_team: Vec<LivePlayer> = players
        .iter()
        .filter(|p| p.team.eq_ignore_ascii_case("ORDER"))
        .cloned()
        .collect();
    let enemy_team: Vec<LivePlayer> = players
        .iter()
        .filter(|p| p.team.eq_ignore_ascii_case("CHAOS"))
        .cloned()
        .collect();

    let local = players.iter().find(|p| p.is_local).cloned().unwrap_or_else(|| {
        // Fallback: the live API sometimes omits playerName on first load.
        players
            .iter()
            .find(|p| p.position.eq_ignore_ascii_case("MIDDLE"))
            .cloned()
            .or_else(|| players.first().cloned())
            .unwrap_or_default()
    });

    let augments = local.augments.clone();
    let raw_mode = str_at(value, &["gameData", "gameMode"]);
    let map_name = str_at(value, &["gameData", "mapName"]).to_string();
    let map_number = i64_at(value, &["gameData", "mapNumber"]);
    let raw_mode_upper = raw_mode.to_uppercase();

    let is_howling_abyss = map_name.to_lowercase().contains("howling")
        || map_name.eq_ignore_ascii_case("Map12")
        || map_number == 12;
    let any_augments = players.iter().any(|player| !player.augments.is_empty());
    let is_aram = raw_mode_upper == "ARAM" || is_howling_abyss;
    let is_mayhem = is_aram
        && (raw_mode_upper.contains("MAYHEM")
            || raw_mode_upper.contains("KIWI")
            || any_augments);
    let game_mode = if is_mayhem {
        "ARAM_MAYHEM".to_string()
    } else if is_aram && raw_mode.is_empty() {
        "ARAM".to_string()
    } else {
        raw_mode.to_string()
    };

    LiveGame {
        active: !players.is_empty(),
        game_mode,
        map_name,
        game_time: f64_at(value, &["gameData", "gameTime"]),
        my_champion: local.champion.clone(),
        my_role: local.position.clone(),
        my_level: if local.level > 0 {
            local.level
        } else {
            i64_at(value, &["activePlayer", "level"])
        },
        my_team,
        enemy_team,
        events: parse_events(value),
        augments,
        is_aram,
        is_mayhem,
        my_gold: f64_at(value, &["activePlayer", "currentGold"]),
        latency_ms,
        updated_at: now_ms(),
    }
}

async fn fetch_live(client: &reqwest::Client) -> Result<(Value, u64), String> {
    let started = Instant::now();
    let response = match client.get(LIVE_HTTPS).send().await {
        Ok(response) => response,
        Err(_) => client
            .get(LIVE_HTTP)
            .send()
            .await
            .map_err(|e| e.to_string())?,
    };
    let latency = started.elapsed().as_millis() as u64;
    if !response.status().is_success() {
        return Err(format!("Live Client API HTTP {}", response.status()));
    }
    let value = response.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok((value, latency))
}

fn position_hud(window: &WebviewWindow) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let scale = monitor.scale_factor();
        let position = monitor.position();
        let size = monitor.size();
        let width = size.width as f64 / scale;
        let x = position.x as f64 / scale + width - 484.0 - 24.0;
        let y = position.y as f64 / scale + 24.0;
        let _ = window.set_position(PhysicalPosition::new(
            (x * scale) as i32,
            (y * scale) as i32,
        ));
    }
}

/// Shows the click-through HUD while a live game is running and hides it as
/// soon as the game ends or the user turns the HUD off in Settings.
fn sync_hud_window(app: &AppHandle, game: &LiveGame) {
    let Some(window) = app.get_webview_window("hud-overlay") else {
        return;
    };
    let enabled = app
        .state::<crate::settings::SettingsState>()
        .get()
        .hud_overlay;
    let should_show = game.active && enabled;

    if should_show {
        if !window.is_visible().unwrap_or(false) {
            position_hud(&window);
            if let Some(state) = app.try_state::<crate::commands::HudState>() {
                state.0.store(true, Ordering::Relaxed);
            }
            // HUD starts in read-only click-through mode; Alt+X makes it interactive.
            let _ = window.set_ignore_cursor_events(true);
            let _ = window.show();
            let _ = app.emit(
                "hud-clickthrough-changed",
                crate::commands::hud_state_view(app),
            );
        }
    } else if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    }
}

async fn poll_once(app: &AppHandle) {
    let clients = app.state::<Clients>().local.clone();
    let state = app.state::<LiveState>();

    let next = match fetch_live(&clients).await {
        Ok((value, latency)) => {
            state.latency_ms.store(latency, Ordering::Relaxed);
            parse_game(&value, latency)
        }
        Err(_) => {
            state.latency_ms.store(0, Ordering::Relaxed);
            LiveGame::default()
        }
    };

    let previous = state.game.read().await.clone();
    let should_emit = next.active
        || previous.active
        || next.game_mode != previous.game_mode
        || next.my_champion != previous.my_champion;

    *state.game.write().await = next.clone();
    if should_emit {
        let _ = app.emit("live-update", next.clone());
    }
    sync_hud_window(app, &next);
}

pub async fn poll_loop(app: AppHandle) {
    let mut interval = tokio::time::interval(Duration::from_secs(2));
    interval.set_missed_tick_behavior(MissedTickBehavior::Delay);
    loop {
        interval.tick().await;
        poll_once(&app).await;
    }
}

#[tauri::command]
pub async fn get_live_state(state: State<'_, LiveState>) -> Result<LiveGame, String> {
    Ok(state.game.read().await.clone())
}
