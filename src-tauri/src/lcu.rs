use crate::{ddragon::DdragonState, util::normalize_role, Clients};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use sysinfo::{ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::RwLock;

#[derive(Clone, Debug)]
pub struct Lockfile {
    pub port: u16,
    pub password: String,
    pub protocol: String,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DraftPlayer {
    pub cell_id: i64,
    pub champion_id: i64,
    pub champion: String,
    pub summoner_name: String,
    pub position: String,
    pub is_local: bool,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChampSelect {
    pub active: bool,
    pub phase: String,
    pub time_left: f64,
    pub my_cell: i64,
    pub my_champion: String,
    pub my_role: String,
    pub my_team: Vec<DraftPlayer>,
    pub enemy_team: Vec<DraftPlayer>,
    pub my_bans: Vec<String>,
    pub enemy_bans: Vec<String>,
    pub is_my_turn: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LcuStatus {
    pub connected: bool,
    pub summoner: Option<String>,
    pub champ_select: bool,
    pub port: Option<u16>,
    pub message: Option<String>,
}

pub struct LcuState {
    pub lockfile: RwLock<Option<Lockfile>>,
    pub session: RwLock<ChampSelect>,
    pub connected: AtomicBool,
    pub summoner: RwLock<Option<String>>,
    pub message: RwLock<Option<String>>,
}

impl Default for LcuState {
    fn default() -> Self {
        Self {
            lockfile: RwLock::new(None),
            session: RwLock::new(ChampSelect::default()),
            connected: AtomicBool::new(false),
            summoner: RwLock::new(None),
            message: RwLock::new(Some("League client not detected".into())),
        }
    }
}

fn candidate_lockfiles() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    for env in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Ok(base) = std::env::var(env) {
            roots.push(PathBuf::from(base).join("Riot Games/League of Legends"));
        }
    }
    for drive in ["C", "D", "E", "F"] {
        roots.push(PathBuf::from(format!(
            "{drive}:\\Riot Games\\League of Legends"
        )));
        roots.push(PathBuf::from(format!(
            "{drive}:\\Games\\Riot Games\\League of Legends"
        )));
    }
    roots.into_iter().map(|root| root.join("lockfile")).collect()
}

fn process_lockfiles() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All, true);
    for process in system.processes().values() {
        let name = process.name().to_string_lossy().to_lowercase();
        if !name.contains("leagueclient") {
            continue;
        }
        if let Some(exe) = process.exe() {
            if let Some(parent) = exe.parent() {
                paths.push(parent.join("lockfile"));
            }
        }
    }
    paths
}

fn read_lockfile(path: &Path) -> Option<Lockfile> {
    let raw = std::fs::read_to_string(path).ok()?;
    let mut parts = raw.trim().split(':');
    let _name = parts.next()?;
    let _pid = parts.next()?;
    let port = parts.next()?.parse::<u16>().ok()?;
    let password = parts.next()?.to_string();
    let protocol = parts.next().unwrap_or("https").to_string();
    Some(Lockfile {
        port,
        password,
        protocol,
    })
}

fn lcu_url(lockfile: &Lockfile, path: &str) -> String {
    format!(
        "{}://127.0.0.1:{}{}",
        lockfile.protocol, lockfile.port, path
    )
}

async fn lcu_get(
    client: &reqwest::Client,
    lockfile: &Lockfile,
    path: &str,
) -> Result<Value, String> {
    let response = client
        .get(lcu_url(lockfile, path))
        .basic_auth("riot", Some(&lockfile.password))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("LCU HTTP {}", response.status()));
    }
    response.json::<Value>().await.map_err(|e| e.to_string())
}

async fn valid_lockfile(client: &reqwest::Client, lockfile: &Lockfile) -> bool {
    client
        .get(lcu_url(lockfile, "/lol-login/v1/session"))
        .basic_auth("riot", Some(&lockfile.password))
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

async fn discover_lockfile(client: &reqwest::Client) -> Option<Lockfile> {
    let mut paths = candidate_lockfiles();
    paths.extend(process_lockfiles());
    paths.sort();
    paths.dedup();

    for path in paths {
        if let Some(lockfile) = read_lockfile(&path) {
            if valid_lockfile(client, &lockfile).await {
                return Some(lockfile);
            }
        }
    }
    None
}

async fn fetch_summoner(client: &reqwest::Client, lockfile: &Lockfile) -> Option<String> {
    let summoner = lcu_get(client, lockfile, "/lol-summoner/v1/current-summoner")
        .await
        .ok()?;
    let game_name = summoner.get("gameName").and_then(|v| v.as_str());
    let tag = summoner.get("tagLine").and_then(|v| v.as_str());
    match (game_name, tag) {
        (Some(name), Some(tag)) if !name.is_empty() => Some(format!("{name}#{tag}")),
        _ => summoner
            .get("displayName")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    }
}

async fn champion_name(app: &AppHandle, id: i64) -> String {
    if id <= 0 {
        return String::new();
    }
    let state = app.state::<DdragonState>();
    let guard = state.data.read().await;
    guard
        .as_ref()
        .and_then(|data| {
            data.champions
                .iter()
                .find(|champion| champion.key == id.to_string())
                .map(|champion| champion.name.clone())
        })
        .unwrap_or_default()
}

fn parse_team(raw: &Value, local_cell: i64, app_names: &[String]) -> Vec<DraftPlayer> {
    raw.as_array()
        .map(|list| {
            list.iter()
                .map(|player| DraftPlayer {
                    cell_id: player.get("cellId").and_then(|v| v.as_i64()).unwrap_or(0),
                    champion_id: player
                        .get("championId")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0),
                    champion: String::new(),
                    summoner_name: player
                        .get("summonerName")
                        .or_else(|| player.get("displayName"))
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string(),
                    position: normalize_role(
                        player
                            .get("assignedPosition")
                            .and_then(|v| v.as_str())
                            .unwrap_or_default(),
                    ),
                    is_local: player.get("cellId").and_then(|v| v.as_i64()) == Some(local_cell),
                })
                .collect()
        })
        .map(|mut players: Vec<DraftPlayer>| {
            for (index, player) in players.iter_mut().enumerate() {
                if let Some(name) = app_names.get(index) {
                    player.champion = name.clone();
                }
            }
            players
        })
        .unwrap_or_default()
}

async fn parse_session(app: &AppHandle, value: &Value) -> ChampSelect {
    let local_cell = value
        .get("localPlayerCellId")
        .and_then(|v| v.as_i64())
        .unwrap_or(-1);
    let timer = value.get("timer").cloned().unwrap_or(Value::Null);
    let phase = timer
        .get("phase")
        .and_then(|v| v.as_str())
        .unwrap_or("PLANNING")
        .to_string();
    let time_left = timer
        .get("adjustedTimeLeftInPhase")
        .or_else(|| timer.get("timeLeftInPhase"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
        / 1000.0;

    let mut my_team = Vec::new();
    if let Some(team) = value.get("myTeam") {
        let ids: Vec<i64> = team
            .as_array()
            .map(|list| {
                list.iter()
                    .map(|player| {
                        player
                            .get("championId")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0)
                    })
                    .collect()
            })
            .unwrap_or_default();
        let mut names = Vec::with_capacity(ids.len());
        for id in ids {
            names.push(champion_name(app, id).await);
        }
        my_team = parse_team(team, local_cell, &names);
    }

    let mut enemy_team = Vec::new();
    if let Some(team) = value.get("theirTeam") {
        let ids: Vec<i64> = team
            .as_array()
            .map(|list| {
                list.iter()
                    .map(|player| {
                        player
                            .get("championId")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0)
                    })
                    .collect()
            })
            .unwrap_or_default();
        let mut names = Vec::with_capacity(ids.len());
        for id in ids {
            names.push(champion_name(app, id).await);
        }
        enemy_team = parse_team(team, local_cell, &names);
    }

    let bans = value.get("bans").cloned().unwrap_or(Value::Null);
    let mut my_bans = Vec::new();
    let mut enemy_bans = Vec::new();
    for (key, output) in [
        ("myTeamBans", &mut my_bans),
        ("theirTeamBans", &mut enemy_bans),
    ] {
        if let Some(list) = bans.get(key).and_then(|v| v.as_array()) {
            for id in list.iter().filter_map(|v| v.as_i64()) {
                let name = champion_name(app, id).await;
                if !name.is_empty() {
                    output.push(name);
                }
            }
        }
    }

    let is_my_turn = value
        .get("actions")
        .and_then(|v| v.as_array())
        .map(|groups| {
            groups.iter().any(|group| {
                group
                    .as_array()
                    .map(|actions| {
                        actions.iter().any(|action| {
                            action.get("actorCellId").and_then(|v| v.as_i64())
                                == Some(local_cell)
                                && action
                                    .get("isInProgress")
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false)
                                && !action
                                    .get("completed")
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false)
                        })
                    })
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);

    let local = my_team.iter().find(|player| player.is_local);
    ChampSelect {
        active: true,
        phase,
        time_left,
        my_cell: local_cell,
        my_champion: local.map(|p| p.champion.clone()).unwrap_or_default(),
        my_role: local.map(|p| p.position.clone()).unwrap_or_default(),
        my_team,
        enemy_team,
        my_bans,
        enemy_bans,
        is_my_turn,
    }
}

async fn refresh_session(app: &AppHandle, client: &reqwest::Client, lockfile: &Lockfile) -> Option<ChampSelect> {
    match lcu_get(client, lockfile, "/lol-champ-select/v1/session").await {
        Ok(value) => Some(parse_session(app, &value).await),
        Err(_) => None,
    }
}

async fn update_connection(app: &AppHandle, client: &reqwest::Client) -> bool {
    let state = app.state::<LcuState>();
    let current = state.lockfile.read().await.clone();

    let lockfile = match current {
        Some(lockfile) if valid_lockfile(client, &lockfile).await => Some(lockfile),
        _ => discover_lockfile(client).await,
    };

    let connected = lockfile.is_some();
    state.connected.store(connected, Ordering::Relaxed);
    if let Some(ref lockfile) = lockfile {
        *state.lockfile.write().await = Some(lockfile.clone());
        *state.message.write().await = None;
        if state.summoner.read().await.is_none() {
            if let Some(summoner) = fetch_summoner(client, lockfile).await {
                *state.summoner.write().await = Some(summoner);
            }
        }
    } else {
        *state.lockfile.write().await = None;
        *state.message.write().await = Some("League client not detected".into());
        *state.summoner.write().await = None;
    }
    connected
}

pub async fn poll_loop(app: AppHandle) {
    let client = app.state::<Clients>().local.clone();
    let mut tick: u64 = 0;
    let mut previous_active = false;

    loop {
        if tick % 8 == 0 || !app.state::<LcuState>().connected.load(Ordering::Relaxed) {
            update_connection(&app, &client).await;
        }
        tick = tick.wrapping_add(1);

        let lockfile = app.state::<LcuState>().lockfile.read().await.clone();
        let session = match lockfile {
            Some(lockfile) => refresh_session(&app, &client, &lockfile).await,
            None => None,
        };
        let state = app.state::<LcuState>();
        let next = session.unwrap_or_default();
        let emit = next.active || previous_active;
        previous_active = next.active;
        *state.session.write().await = next.clone();
        if emit {
            let _ = app.emit("champ-select-update", next);
        }

        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

#[tauri::command]
pub async fn get_lcu_status(state: State<'_, LcuState>) -> Result<LcuStatus, String> {
    let lockfile = state.lockfile.read().await.clone();
    let session = state.session.read().await.clone();
    Ok(LcuStatus {
        connected: state.connected.load(Ordering::Relaxed),
        summoner: state.summoner.read().await.clone(),
        champ_select: session.active,
        port: lockfile.map(|l| l.port),
        message: state.message.read().await.clone(),
    })
}

#[tauri::command]
pub async fn get_champ_select(state: State<'_, LcuState>) -> Result<ChampSelect, String> {
    Ok(state.session.read().await.clone())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunePageInput {
    pub name: String,
    pub primary_style_id: i64,
    pub sub_style_id: i64,
    pub selected_perk_ids: Vec<i64>,
    #[serde(default)]
    pub current: bool,
}

#[tauri::command]
pub async fn apply_runes(
    app: AppHandle,
    page: RunePageInput,
) -> Result<String, String> {
    let client = app.state::<Clients>().local.clone();
    let lockfile = discover_lockfile(&client)
        .await
        .ok_or_else(|| "League client not detected. Start League of Legends first.".to_string())?;

    // Remove previous HexCoach pages so the client's page limit never blocks us.
    if let Ok(pages) = lcu_get(&client, &lockfile, "/lol-perks/v1/pages").await {
        if let Some(pages) = pages.as_array() {
            for existing in pages {
                let name = existing
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default();
                let deletable = existing
                    .get("isDeletable")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                if deletable && name.to_lowercase().starts_with("hexcoach") {
                    if let Some(id) = existing.get("id").and_then(|v| v.as_i64()) {
                        let _ = client
                            .delete(lcu_url(&lockfile, &format!("/lol-perks/v1/pages/{id}")))
                            .basic_auth("riot", Some(&lockfile.password))
                            .send()
                            .await;
                    }
                }
            }
        }
    }

    if page.selected_perk_ids.len() != 9 {
        return Err("A rune page needs exactly 9 selected perks.".into());
    }

    let payload = json!({
        "name": page.name,
        "primaryStyleId": page.primary_style_id,
        "subStyleId": page.sub_style_id,
        "selectedPerkIds": page.selected_perk_ids,
        "current": page.current,
    });

    let response = client
        .post(lcu_url(&lockfile, "/lol-perks/v1/pages"))
        .basic_auth("riot", Some(&lockfile.password))
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Could not reach the League client: {e}"))?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if status.is_success() {
        Ok("Rune page applied to League of Legends".into())
    } else if status.as_u16() == 400 && body.to_lowercase().contains("maximum") {
        Err("Rune page limit reached. Delete a page in the League client and try again.".into())
    } else {
        Err(format!(
            "League client rejected the page ({status}): {}",
            body.chars().take(180).collect::<String>()
        ))
    }
}
