use crate::{
    aram::{self, AramBalance},
    arena::{self, ArenaAugment},
    util::strip_html,
    Clients,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::Arc,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::RwLock;

const DDRAGON: &str = "https://ddragon.leagueoflegends.com";
const LANG: &str = "en_US";

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DdragonStatus {
    /// "idle" | "loading" | "ready" | "error"
    pub state: String,
    pub version: Option<String>,
    pub source: Option<String>,
    pub message: Option<String>,
    pub cached_images: usize,
    pub total_images: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Image {
    pub full: String,
    pub sprite: String,
    pub group: String,
    pub x: i64,
    pub y: i64,
    pub w: i64,
    pub h: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct ChampionInfo {
    pub attack: i64,
    pub defense: i64,
    pub magic: i64,
    pub difficulty: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ChampionSpell {
    pub id: String,
    pub name: String,
    pub description: String,
    pub image: Image,
    pub cooldown: Vec<f64>,
    pub range: Vec<f64>,
    pub maxrank: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ChampionPassive {
    pub name: String,
    pub description: String,
    pub image: Image,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Champion {
    pub id: String,
    pub key: String,
    pub name: String,
    pub title: String,
    pub tags: Vec<String>,
    pub partype: String,
    pub info: ChampionInfo,
    pub stats: Value,
    pub image: Image,
    pub spells: Vec<ChampionSpell>,
    pub passive: ChampionPassive,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct Gold {
    pub base: i64,
    pub total: i64,
    pub sell: i64,
    pub purchasable: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Item {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub plaintext: String,
    pub gold: Gold,
    pub tags: Vec<String>,
    pub image: Image,
    pub into: Vec<String>,
    pub from: Vec<String>,
    pub depth: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Rune {
    pub id: u32,
    pub key: String,
    pub name: String,
    pub icon: String,
    pub short_desc: String,
    pub long_desc: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct RuneSlot {
    pub runes: Vec<Rune>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RuneTree {
    pub id: u32,
    pub key: String,
    pub name: String,
    pub icon: String,
    pub slots: Vec<RuneSlot>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Spell {
    pub id: String,
    pub name: String,
    pub description: String,
    pub image: Image,
    pub cooldown: Vec<f64>,
    pub range: Vec<f64>,
    pub maxrank: i64,
}

#[derive(Clone, Debug)]
pub struct DdragonData {
    pub version: String,
    pub cache_dir: PathBuf,
    pub source: String,
    pub champions: Vec<Champion>,
    pub items: Vec<Item>,
    pub runes: Vec<RuneTree>,
    pub spells: Vec<Spell>,
    pub arena: Vec<ArenaAugment>,
    pub aram: Vec<AramBalance>,
    pub aram_source: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    pub version: String,
    pub cache_dir: String,
    pub source: String,
    pub champions: Vec<Champion>,
    pub items: Vec<Item>,
    pub runes: Vec<RuneTree>,
    pub spells: Vec<Spell>,
    pub arena: Vec<ArenaAugment>,
    pub aram: Vec<AramBalance>,
    pub aram_source: String,
}

pub struct DdragonState {
    pub status: RwLock<DdragonStatus>,
    pub data: RwLock<Option<Arc<DdragonData>>>,
}

impl Default for DdragonState {
    fn default() -> Self {
        Self {
            status: RwLock::new(DdragonStatus {
                state: "idle".into(),
                ..Default::default()
            }),
            data: RwLock::new(None),
        }
    }
}

impl DdragonState {
    pub async fn set_status(&self, status: DdragonStatus) {
        *self.status.write().await = status;
    }

    pub async fn status(&self) -> DdragonStatus {
        self.status.read().await.clone()
    }
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct RawItem {
    name: String,
    description: String,
    plaintext: String,
    gold: Gold,
    tags: Vec<String>,
    image: Image,
    maps: HashMap<String, bool>,
    into: Option<Vec<String>>,
    from: Option<Vec<String>>,
    depth: i32,
}

fn emit_status(app: &AppHandle, status: &DdragonStatus) {
    let _ = app.emit("ddragon-status", status);
}

fn cache_base(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_cache_dir()
        .map(|dir| dir.join("ddragon"))
        .map_err(|e| format!("Could not resolve cache directory: {e}"))
}

async fn fetch_json(client: &reqwest::Client, url: &str) -> Result<Value, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("HTTP {} for {url}", response.status()));
    }
    response
        .json::<Value>()
        .await
        .map_err(|e| format!("Invalid JSON from {url}: {e}"))
}

fn version_key(version: &str) -> Vec<u32> {
    version
        .split('.')
        .filter_map(|part| part.parse::<u32>().ok())
        .collect()
}

async fn resolve_version(
    client: &reqwest::Client,
    base: &Path,
) -> Result<(String, String), String> {
    match fetch_json(client, &format!("{DDRAGON}/api/versions.json")).await {
        Ok(value) => {
            if let Some(version) = value
                .as_array()
                .and_then(|list| list.first())
                .and_then(|v| v.as_str())
            {
                let _ = tokio::fs::create_dir_all(base).await;
                let _ = tokio::fs::write(base.join("latest.txt"), version).await;
                return Ok((version.to_string(), "network".into()));
            }
        }
        Err(_) => {}
    }

    let mut cached: Option<String> = tokio::fs::read_to_string(base.join("latest.txt"))
        .await
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    if cached.is_none() {
        let mut dirs: Vec<String> = Vec::new();
        if let Ok(mut entries) = tokio::fs::read_dir(base).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                if entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false)
                    && entry.path().join("champion.json").exists()
                {
                    dirs.push(entry.file_name().to_string_lossy().to_string());
                }
            }
        }
        dirs.sort_by(|a, b| version_key(a).cmp(&version_key(b)));
        cached = dirs.pop();
    }

    cached
        .map(|version| (version, "cache".into()))
        .ok_or_else(|| "No internet connection and no cached Data Dragon patch found.".to_string())
}

async fn load_json_file(
    client: &reqwest::Client,
    version_dir: &Path,
    version: &str,
    file: &str,
) -> Result<Value, String> {
    let path = version_dir.join(format!("{file}.json"));
    if let Ok(raw) = tokio::fs::read_to_string(&path).await {
        if let Ok(value) = serde_json::from_str::<Value>(&raw) {
            return Ok(value);
        }
    }

    let url = format!("{DDRAGON}/cdn/{version}/data/{LANG}/{file}.json");
    let value = fetch_json(client, &url).await?;
    if let Ok(raw) = serde_json::to_string(&value) {
        let _ = tokio::fs::write(&path, raw).await;
    }
    Ok(value)
}

fn parse_champions(value: &Value) -> Result<Vec<Champion>, String> {
    let mut champions: Vec<Champion> = value
        .get("data")
        .and_then(|v| v.as_object())
        .ok_or("champion.json has no data object")?
        .values()
        .filter_map(|raw| serde_json::from_value::<Champion>(raw.clone()).ok())
        .collect();

    if champions.is_empty() {
        return Err("Could not parse any champions".into());
    }

    for champion in &mut champions {
        for spell in &mut champion.spells {
            spell.description = strip_html(&spell.description);
        }
        champion.passive.description = strip_html(&champion.passive.description);
    }
    champions.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(champions)
}

fn parse_items(value: &Value) -> Result<Vec<Item>, String> {
    let mut items = Vec::new();
    let Some(map) = value.get("data").and_then(|v| v.as_object()) else {
        return Err("item.json has no data object".into());
    };
    for (id, raw) in map {
        let Ok(parsed) = serde_json::from_value::<RawItem>(raw.clone()) else {
            continue;
        };
        let on_summoners_rift = parsed.maps.get("11").copied().unwrap_or(false);
        if !on_summoners_rift || !parsed.gold.purchasable || parsed.image.full.is_empty() {
            continue;
        }
        let Ok(id) = id.parse::<u32>() else {
            continue;
        };
        items.push(Item {
            id,
            name: parsed.name,
            description: strip_html(&parsed.description),
            plaintext: parsed.plaintext,
            gold: parsed.gold,
            tags: parsed.tags,
            image: parsed.image,
            into: parsed.into.unwrap_or_default(),
            from: parsed.from.unwrap_or_default(),
            depth: parsed.depth,
        });
    }
    if items.is_empty() {
        return Err("Could not parse any items".into());
    }
    items.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(items)
}

fn parse_runes(value: &Value) -> Result<Vec<RuneTree>, String> {
    let mut trees: Vec<RuneTree> = serde_json::from_value(value.clone())
        .map_err(|e| format!("Could not parse runesReforged.json: {e}"))?;
    for tree in &mut trees {
        for slot in &mut tree.slots {
            for rune in &mut slot.runes {
                rune.short_desc = strip_html(&rune.short_desc);
                rune.long_desc = strip_html(&rune.long_desc);
            }
        }
    }
    if trees.is_empty() {
        return Err("No rune trees found".into());
    }
    Ok(trees)
}

fn parse_spells(value: &Value) -> Result<Vec<Spell>, String> {
    let mut spells = Vec::new();
    let Some(map) = value.get("data").and_then(|v| v.as_object()) else {
        return Err("summoner.json has no data object".into());
    };
    for (id, raw) in map {
        if let Ok(mut spell) = serde_json::from_value::<Spell>(raw.clone()) {
            spell.id = id.clone();
            spell.description = strip_html(&spell.description);
            spells.push(spell);
        }
    }
    if spells.is_empty() {
        return Err("Could not parse summoner spells".into());
    }
    spells.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(spells)
}

async fn load_data(
    app: &AppHandle,
    client: &reqwest::Client,
) -> Result<(DdragonData, Option<String>), String> {
    let base = cache_base(app)?;
    let (version, source) = resolve_version(client, &base).await?;
    let version_dir = base.join(&version);
    tokio::fs::create_dir_all(&version_dir)
        .await
        .map_err(|e| format!("Could not create cache folder: {e}"))?;

    let champions_value = load_json_file(client, &version_dir, &version, "champion").await?;
    let items_value = load_json_file(client, &version_dir, &version, "item").await?;
    let runes_value = load_json_file(client, &version_dir, &version, "runesReforged").await?;
    let spells_value = load_json_file(client, &version_dir, &version, "summoner").await?;

    let champions = parse_champions(&champions_value)?;
    let items = parse_items(&items_value)?;
    let runes = parse_runes(&runes_value)?;
    let spells = parse_spells(&spells_value)?;

    let (arena, arena_error) = match arena::load(client, &version_dir).await {
        Ok(augments) => (augments, None),
        Err(err) => (Vec::new(), Some(err)),
    };
    let (aram, aram_source) = aram::load(client, &version_dir).await;

    Ok((
        DdragonData {
            version,
            cache_dir: version_dir,
            source,
            champions,
            items,
            runes,
            spells,
            arena,
            aram,
            aram_source,
        },
        arena_error,
    ))
}

fn image_jobs(data: &DdragonData) -> Vec<(String, PathBuf)> {
    let dir = &data.cache_dir;
    let mut jobs: Vec<(String, PathBuf)> = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();

    let mut push = |url: String, path: PathBuf| {
        if seen.insert(path.clone()) {
            jobs.push((url, path));
        }
    };

    for champion in &data.champions {
        if champion.image.full.is_empty() {
            continue;
        }
        push(
            format!(
                "{DDRAGON}/cdn/{}/img/champion/{}",
                data.version, champion.image.full
            ),
            dir.join("img/champion").join(&champion.image.full),
        );
    }
    for item in &data.items {
        push(
            format!(
                "{DDRAGON}/cdn/{}/img/item/{}",
                data.version, item.image.full
            ),
            dir.join("img/item").join(&item.image.full),
        );
    }
    for spell in &data.spells {
        push(
            format!(
                "{DDRAGON}/cdn/{}/img/spell/{}",
                data.version, spell.image.full
            ),
            dir.join("img/spell").join(&spell.image.full),
        );
    }
    for tree in &data.runes {
        for slot in &tree.slots {
            for rune in &slot.runes {
                if rune.icon.is_empty() {
                    continue;
                }
                push(
                    format!("{DDRAGON}/cdn/img/{}", rune.icon),
                    dir.join("img/rune").join(&rune.icon),
                );
            }
        }
    }
    for (url, path) in arena::image_jobs(&data.arena, dir) {
        push(url, path);
    }
    jobs
}

async fn warm_images(app: AppHandle, client: reqwest::Client, data: Arc<DdragonData>) {
    let jobs = image_jobs(&data);
    let total = jobs.len();
    if total == 0 {
        return;
    }
    let mut cached = 0usize;
    let state = app.state::<DdragonState>();

    for chunk in jobs.chunks(12) {
        let futures = chunk.iter().cloned().map(|(url, path)| {
            let client = client.clone();
            async move {
                if tokio::fs::metadata(&path).await.is_ok() {
                    return true;
                }
                let Ok(response) = client.get(&url).send().await else {
                    return false;
                };
                if !response.status().is_success() {
                    return false;
                }
                let Ok(bytes) = response.bytes().await else {
                    return false;
                };
                if let Some(parent) = path.parent() {
                    let _ = tokio::fs::create_dir_all(parent).await;
                }
                tokio::fs::write(&path, bytes).await.is_ok()
            }
        });
        let results = futures_util::future::join_all(futures).await;
        cached += results.into_iter().filter(|ok| *ok).count();

        let mut status = state.status.write().await;
        status.cached_images = cached;
        status.total_images = total;
        let _ = app.emit("cache-progress", status.clone());
    }
}

pub async fn init(app: AppHandle) {
    let state = app.state::<DdragonState>();
    let loading = DdragonStatus {
        state: "loading".into(),
        ..Default::default()
    };
    state.set_status(loading.clone()).await;
    emit_status(&app, &loading);

    let http = app.state::<Clients>().http.clone();
    match load_data(&app, &http).await {
        Ok((data, arena_error)) => {
            let version = data.version.clone();
            let source = data.source.clone();
            let data = Arc::new(data);

            *state.data.write().await = Some(data.clone());
            let status = DdragonStatus {
                state: "ready".into(),
                version: Some(version.clone()),
                source: Some(source.clone()),
                message: arena_error.map(|e| format!("Arena augments unavailable: {e}")),
                cached_images: 0,
                total_images: 0,
            };
            state.set_status(status.clone()).await;
            emit_status(&app, &status);
            let _ = app.emit("ddragon-ready", &version);

            let warm_app = app.clone();
            let warm_client = http.clone();
            tauri::async_runtime::spawn(async move {
                warm_images(warm_app, warm_client, data).await;
            });
        }
        Err(err) => {
            let status = DdragonStatus {
                state: "error".into(),
                message: Some(err.clone()),
                ..Default::default()
            };
            state.set_status(status.clone()).await;
            emit_status(&app, &status);
            let _ = app.emit("ddragon-error", err);
        }
    }
}

#[tauri::command]
pub async fn get_bootstrap(state: State<'_, DdragonState>) -> Result<Bootstrap, String> {
    let guard = state.data.read().await;
    let data = guard
        .as_ref()
        .ok_or_else(|| "Data Dragon is still loading".to_string())?;
    Ok(Bootstrap {
        version: data.version.clone(),
        cache_dir: data.cache_dir.to_string_lossy().to_string(),
        source: data.source.clone(),
        champions: data.champions.clone(),
        items: data.items.clone(),
        runes: data.runes.clone(),
        spells: data.spells.clone(),
        arena: data.arena.clone(),
        aram: data.aram.clone(),
        aram_source: data.aram_source.clone(),
    })
}

#[tauri::command]
pub async fn get_ddragon_status(state: State<'_, DdragonState>) -> Result<DdragonStatus, String> {
    Ok(state.status().await)
}

#[tauri::command]
pub async fn refresh_ddragon(app: AppHandle) -> Result<(), String> {
    init(app).await;
    Ok(())
}
