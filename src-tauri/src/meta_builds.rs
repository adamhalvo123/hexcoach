//! Meta build aggregation for Summoner's Rift, ARAM and Arena.
//!
//! The module is deliberately built as a provider chain:
//!
//! 1. `lolalytics` (live, Summoner's Rift only) — live Emerald+ win rate, pick
//!    rate, ban rate, tier and counter names from the server-rendered page.
//! 2. `curated` — the offline `src/data/meta.json` snapshot plus Data Dragon
//!    item, rune, spell and champion data. Always available.
//! 3. `cache` — the last successful build on disk, served for up to 12 hours.
//!
//! Any provider failure is non-fatal: the next provider is used and the reason
//! is surfaced as a note. The command never panics on a layout change, timeout
//! or rate limit.

use crate::{
    ddragon::{Champion, DdragonData, DdragonState, Spell},
    meta,
    recommend::{
        self, build_items, class_for, default_profiles, estimated_win_rate, make_rune_page,
        matchup_list, skill_plan, BuildSet, ItemRef, Matchup, RunePage, SkillPlan,
    },
    util::{normalize_role, role_label},
    Clients,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

/// Cached builds are considered fresh for twelve hours.
const TTL_MS: i64 = 12 * 60 * 60 * 1000;
const CACHE_VERSION: u32 = 1;
const MAX_CACHE_ENTRIES: usize = 300;

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
    AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SpellRef {
    pub id: String,
    pub name: String,
    pub icon: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ChampionBuild {
    pub champion: String,
    pub champion_id: String,
    pub champion_key: String,
    pub champion_title: String,
    pub tags: Vec<String>,
    pub role: String,
    pub role_label: String,
    pub game_mode: String,
    pub game_mode_label: String,
    pub patch: String,
    pub tier: String,
    pub score: i64,
    pub win_rate: f64,
    pub pick_rate: f64,
    pub ban_rate: f64,
    pub games: i64,
    /// "EST. WR" for curated data, "Emerald+" for live LoLalytics data.
    pub win_rate_label: String,
    pub rank: i64,
    pub total_champions: i64,
    /// Provider label, e.g. "lolalytics+curated" or "curated".
    pub source: String,
    pub source_detail: String,
    pub cached: bool,
    pub fetched_at_ms: i64,
    pub runes: RunePage,
    pub summoner_spells: Vec<SpellRef>,
    pub starting_items: Vec<ItemRef>,
    pub core_items: Vec<ItemRef>,
    pub situational_items: Vec<ItemRef>,
    /// Same data as the three item lists, grouped for components that already
    /// understand `BuildSet`.
    pub items: BuildSet,
    pub skill_order: SkillPlan,
    /// Champions this champion beats.
    pub counters: Vec<Matchup>,
    /// Champions that beat this champion.
    pub threats: Vec<Matchup>,
    pub synergies: Vec<Matchup>,
    pub tips: Vec<String>,
    pub notes: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Default, Clone, Debug)]
struct MetaSummary {
    patch: Option<String>,
    tier: Option<String>,
    win_rate: Option<f64>,
    pick_rate: Option<f64>,
    ban_rate: Option<f64>,
    games: Option<i64>,
    rank: Option<i64>,
    total_champions: Option<i64>,
    strong_against: Vec<String>,
    weak_against: Vec<String>,
}

#[derive(Serialize, Deserialize, Default)]
struct CacheFile {
    version: u32,
    entries: HashMap<String, ChampionBuild>,
}

pub struct MetaBuildsState {
    path: PathBuf,
    entries: RwLock<HashMap<String, ChampionBuild>>,
    loaded: AtomicBool,
}

impl MetaBuildsState {
    pub fn new(app: &AppHandle) -> Self {
        let path = app
            .path()
            .app_data_dir()
            .map(|dir| dir.join("builds_cache.json"))
            .unwrap_or_else(|_| PathBuf::from("builds_cache.json"));
        Self {
            path,
            entries: RwLock::new(HashMap::new()),
            loaded: AtomicBool::new(false),
        }
    }

    async fn ensure_loaded(&self) {
        if self.loaded.swap(true, Ordering::SeqCst) {
            return;
        }
        let Ok(raw) = tokio::fs::read_to_string(&self.path).await else {
            return;
        };
        let Ok(file) = serde_json::from_str::<CacheFile>(&raw) else {
            return;
        };
        if file.version != CACHE_VERSION {
            return;
        }
        *self.entries.write().await = file.entries;
    }

    async fn get(&self, key: &str, patch: &str) -> Option<ChampionBuild> {
        self.ensure_loaded().await;
        let entries = self.entries.read().await;
        entries
            .get(key)
            .filter(|build| build.patch == patch && is_fresh(build))
            .cloned()
    }

    async fn put(&self, key: String, build: ChampionBuild) {
        {
            let mut entries = self.entries.write().await;
            entries.insert(key, build);
            if entries.len() > MAX_CACHE_ENTRIES {
                let mut ages: Vec<(i64, String)> = entries
                    .iter()
                    .map(|(key, value)| (value.fetched_at_ms, key.clone()))
                    .collect();
                ages.sort_by_key(|(age, _)| *age);
                let remove = entries.len() - MAX_CACHE_ENTRIES;
                for (_, key) in ages.into_iter().take(remove) {
                    entries.remove(&key);
                }
            }
        }
        self.persist().await;
    }

    async fn persist(&self) {
        let entries = self.entries.read().await.clone();
        let Ok(raw) = serde_json::to_string(&CacheFile {
            version: CACHE_VERSION,
            entries,
        }) else {
            return;
        };
        if let Some(parent) = self.path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        let _ = tokio::fs::write(&self.path, raw).await;
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn is_fresh(build: &ChampionBuild) -> bool {
    build.fetched_at_ms > 0 && now_ms().saturating_sub(build.fetched_at_ms) < TTL_MS
}

fn normalized_mode(value: &str) -> &'static str {
    match value.trim().to_ascii_uppercase().as_str() {
        "ARAM" | "ARAM_MAYHEM" | "MAYHEM" | "HA" => "ARAM",
        "CHERRY" | "ARENA" | "ARENA_2V2" => "CHERRY",
        _ => "CLASSIC",
    }
}

fn mode_label(mode: &str) -> &'static str {
    match mode {
        "ARAM" => "ARAM",
        "CHERRY" => "Arena",
        _ => "Summoner's Rift",
    }
}

fn role_for(champion: &Champion, requested: &str) -> String {
    let normalized = normalize_role(requested);
    if normalized != "NONE" {
        return normalized;
    }
    meta::champion_roles(&champion.name)
        .and_then(|roles| roles.as_object())
        .and_then(|roles| roles.keys().next())
        .cloned()
        .unwrap_or_else(|| "MIDDLE".into())
}

fn lane_for(role: &str) -> &'static str {
    match role {
        "TOP" => "top",
        "JUNGLE" => "jungle",
        "MIDDLE" => "middle",
        "BOTTOM" => "bottom",
        "UTILITY" => "support",
        _ => "middle",
    }
}

fn champion_slug(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

/// Parses the first number that ends right before an occurrence of `marker`.
/// Scans every occurrence so unrelated page text such as navigation labels does
/// not hide the stat block.
fn number_before(text: &str, marker: &str) -> Option<f64> {
    let mut search = 0;
    while let Some(relative) = text[search..].find(marker) {
        let index = search + relative;
        let prefix = &text[..index];
        let mut raw = String::new();
        for ch in prefix.chars().rev() {
            if ch.is_ascii_digit() || ch == '.' || ch == ',' {
                raw.push(ch);
            } else if (ch.is_whitespace() || ch == '%') && raw.is_empty() {
                continue;
            } else {
                break;
            }
        }
        let normalized: String = raw.chars().rev().collect();
        if let Ok(value) = normalized.replace(',', "").parse::<f64>() {
            return Some(value);
        }
        search = index + marker.len();
    }
    None
}

/// Parses the first number after `text[index..]`, skipping whitespace.
fn number_after(text: &str, index: usize) -> Option<f64> {
    let rest = text.get(index..)?;
    let mut raw = String::new();
    for ch in rest.chars() {
        if ch.is_ascii_digit() || ch == '.' || ch == ',' {
            raw.push(ch);
        } else if ch.is_whitespace() && raw.is_empty() {
            continue;
        } else if raw.is_empty() {
            continue;
        } else {
            break;
        }
    }
    raw.replace(',', "").parse().ok()
}

fn number_between(text: &str, start: &str, end: &str) -> Option<f64> {
    let index = text.find(start)? + start.len();
    let rest = text.get(index..)?;
    let stop = rest.find(end)?;
    number_after(rest, 0).filter(|_| {
        let raw = &rest[..stop];
        raw.chars()
            .any(|ch| ch.is_ascii_digit())
    })
}

fn word_after(text: &str, start: &str) -> Option<String> {
    let index = text.find(start)? + start.len();
    let word: String = text[index..]
        .trim_start()
        .chars()
        .take_while(|ch| ch.is_ascii_alphanumeric() || *ch == '+' || *ch == '-' || *ch == '.')
        .collect();
    if word.is_empty() {
        None
    } else {
        Some(word)
    }
}

fn list_after(text: &str, start: &str, end: &str) -> Vec<String> {
    let Some(index) = text.find(start) else {
        return Vec::new();
    };
    let rest = &text[index + start.len()..];
    let chunk = match rest.find(end) {
        Some(stop) => &rest[..stop],
        None => &rest[..rest.len().min(140)],
    };
    chunk
        .split(',')
        .flat_map(|part| part.split(" & "))
        .map(|part| {
            part.trim()
                .trim_matches(|ch: char| !ch.is_alphanumeric() && ch != '\'' && ch != '.')
                .to_string()
        })
        .filter(|name| {
            !name.is_empty()
                && name.chars().count() <= 24
                && name.chars().next().is_some_and(|ch| ch.is_alphabetic())
        })
        .collect()
}

/// Best-effort parser for the server-rendered LoLalytics champion page.
fn parse_summary(html: &str) -> Option<MetaSummary> {
    let text = crate::util::strip_html(html);
    let win_rate = number_before(&text, "% win rate in");
    let tier = word_after(&text, "graded ");
    if win_rate.is_none() && tier.is_none() {
        return None;
    }

    let rank = number_between(&text, "at rank ", " of ");
    let total_champions = rank.and_then(|_| {
        let index = text.find("at rank ")?;
        let rest = &text[index..];
        let of = rest.find(" of ")? + 4;
        number_after(rest, of)
    });

    let strong_against = list_after(&text, "strong counter to ", " while ");
    let weak_against = list_after(&text, "countered most by ", ". ");

    Some(MetaSummary {
        patch: word_after(&text, "on Patch "),
        tier,
        win_rate,
        pick_rate: number_before(&text, "Pick Rate"),
        ban_rate: number_before(&text, "Ban Rate"),
        games: number_before(&text, "Games").map(|value| value as i64),
        rank: rank.map(|value| value as i64),
        total_champions: total_champions.map(|value| value as i64),
        strong_against,
        weak_against,
    })
}

fn short_champion_slug(name: &str) -> String {
    name.split(|ch: char| ch == ' ' || ch == '&' || ch == '\'' || ch == '.')
        .next()
        .map(champion_slug)
        .unwrap_or_default()
}

async fn fetch_lolalytics(
    clients: &Clients,
    champion: &str,
    role: &str,
) -> Result<MetaSummary, String> {
    let mut candidates = vec![champion_slug(champion)];
    let short = short_champion_slug(champion);
    if !short.is_empty() && !candidates.contains(&short) {
        candidates.push(short);
    }

    let mut last_error = "page layout not recognized".to_string();
    for slug in candidates {
        let url = format!("https://lolalytics.com/lol/{slug}/build/?lane={}", lane_for(role));
        let response = clients
            .http
            .get(&url)
            .header(reqwest::header::USER_AGENT, BROWSER_UA)
            .header(
                reqwest::header::ACCEPT,
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            )
            .header(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.9")
            .timeout(Duration::from_secs(8))
            .send()
            .await
            .map_err(|error| format!("network error: {error}"))?;
        if !response.status().is_success() {
            last_error = format!("HTTP {}", response.status());
            if response.status() == reqwest::StatusCode::NOT_FOUND {
                continue;
            }
            return Err(last_error);
        }
        let html = response
            .text()
            .await
            .map_err(|error| format!("unreadable response: {error}"))?;
        match parse_summary(&html) {
            Some(summary) => return Ok(summary),
            None => last_error = "page layout not recognized".to_string(),
        }
    }
    Err(last_error)
}

fn spell_names(mode: &str, role: &str) -> [&'static str; 2] {
    match mode {
        "ARAM" => ["Flash", "Mark"],
        "CHERRY" => ["Flash", "Ignite"],
        _ => match role {
            "JUNGLE" => ["Flash", "Smite"],
            "TOP" => ["Flash", "Teleport"],
            "MIDDLE" => ["Flash", "Ignite"],
            "BOTTOM" => ["Flash", "Heal"],
            "UTILITY" => ["Flash", "Ignite"],
            _ => ["Flash", "Ignite"],
        },
    }
}

fn find_spell<'a>(spells: &'a [Spell], name: &str) -> Option<&'a Spell> {
    spells
        .iter()
        .find(|spell| {
            spell.name.eq_ignore_ascii_case(name) || spell.id.eq_ignore_ascii_case(name)
        })
        .or_else(|| {
            if name.eq_ignore_ascii_case("Mark") {
                spells
                    .iter()
                    .find(|spell| spell.id.eq_ignore_ascii_case("SummonerSnowball"))
            } else {
                None
            }
        })
}

fn summoner_spells(data: &DdragonData, mode: &str, role: &str) -> Vec<SpellRef> {
    spell_names(mode, role)
        .iter()
        .map(|name| {
            find_spell(&data.spells, name)
                .map(|spell| SpellRef {
                    id: spell.id.clone(),
                    name: spell.name.clone(),
                    icon: spell.image.full.clone(),
                })
                .unwrap_or_else(|| SpellRef {
                    id: name.to_string(),
                    name: name.to_string(),
                    icon: String::new(),
                })
        })
        .collect()
}

/// Reverse-scans the curated snapshot: a champion is a good counter when the
/// other champion's curated counter list mentions this champion.
fn curated_strong_against(data: &DdragonData, champion: &Champion) -> Vec<Matchup> {
    let Some(champions) = meta::data()
        .get("champions")
        .and_then(|value| value.as_object())
    else {
        return Vec::new();
    };

    let mut found: Vec<Matchup> = Vec::new();
    for (name, value) in champions {
        if name.eq_ignore_ascii_case(&champion.name) {
            continue;
        }
        let Some(roles) = value.get("roles").and_then(|value| value.as_object()) else {
            continue;
        };
        for entry in roles.values() {
            let Some(counters) = entry.get("counters").and_then(|value| value.as_array()) else {
                continue;
            };
            let hit = counters.iter().find(|counter| {
                counter
                    .get("champion")
                    .and_then(|value| value.as_str())
                    .is_some_and(|value| value.eq_ignore_ascii_case(&champion.name))
            });
            if let Some(hit) = hit {
                if let Some(other) = data
                    .champions
                    .iter()
                    .find(|candidate| candidate.name.eq_ignore_ascii_case(name))
                {
                    found.push(Matchup {
                        champion: other.name.clone(),
                        champion_id: other.id.clone(),
                        reason: hit
                            .get("reason")
                            .and_then(|value| value.as_str())
                            .unwrap_or("You have the tools to punish this pick.")
                            .to_string(),
                        score: 74,
                    });
                }
                break;
            }
        }
    }
    found.sort_by(|left, right| left.champion.cmp(&right.champion));
    found.truncate(5);
    found
}

fn matchups_from_names(
    data: &DdragonData,
    names: &[String],
    reason: &str,
    score: i64,
) -> Vec<Matchup> {
    let mut found: Vec<Matchup> = Vec::new();
    for name in names {
        let resolved = data
            .champions
            .iter()
            .find(|champion| champion.name.eq_ignore_ascii_case(name));
        let (champion_name, champion_id) = match resolved {
            Some(champion) => (champion.name.clone(), champion.id.clone()),
            None => (name.clone(), String::new()),
        };
        if found
            .iter()
            .any(|entry| entry.champion.eq_ignore_ascii_case(&champion_name))
        {
            continue;
        }
        found.push(Matchup {
            champion: champion_name,
            champion_id,
            reason: reason.to_string(),
            score,
        });
    }
    found.truncate(5);
    found
}

fn score_from_win_rate(win_rate: f64) -> i64 {
    (70.0 + (win_rate - 50.0) * 6.0).round().clamp(40.0, 99.0) as i64
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn mode_notes(mode: &str) -> Vec<String> {
    match mode {
        "ARAM" => vec![
            "ARAM uses curated items and runes because live build sites only cover Summoner's Rift."
                .into(),
            "Flash + Mark (Snowball) are the default summoner spells; adapt to your team's engage."
                .into(),
        ],
        "CHERRY" => vec![
            "Arena uses curated items and runes. Pair this plan with the augments on the Arena page."
                .into(),
            "Flash + Ignite are the default Arena summoner spells; swap Ignite for Exhaust or Ghost if needed."
                .into(),
        ],
        _ => Vec::new(),
    }
}

async fn assemble(
    data: &DdragonData,
    champion: &Champion,
    role: &str,
    mode: &str,
    clients: &Clients,
    allow_live: bool,
) -> ChampionBuild {
    let entry = meta::role_entry(&champion.name, role)
        .cloned()
        .unwrap_or(Value::Null);
    let class = class_for(champion, role);
    let (default_build, default_runes) = default_profiles(class);

    let profile_name = entry
        .get("build")
        .and_then(|value| value.as_str())
        .unwrap_or(default_build);
    let profile = meta::profile(profile_name).unwrap_or(&Value::Null);
    let rune_profile_name = entry
        .get("rune")
        .and_then(|value| value.as_str())
        .unwrap_or(default_runes);

    let mut warnings = Vec::new();
    let items = build_items(
        data,
        profile,
        &entry,
        champion,
        role,
        class,
        &mut warnings,
    );
    let runes = make_rune_page(
        data,
        rune_profile_name,
        &champion.name,
        role,
        &mut warnings,
    );
    let skills = skill_plan(&entry, class);
    let threats = matchup_list(data, &entry, "counters");
    let synergies = matchup_list(data, &entry, "synergies");
    let counters = curated_strong_against(data, champion);

    let mut score = recommend::integer(&entry, "score", 70);
    let mut tier = entry
        .get("tier")
        .and_then(|value| value.as_str())
        .unwrap_or("B")
        .to_string();
    let mut win_rate = estimated_win_rate(score);
    let mut win_rate_label = "EST. WR".to_string();
    let mut pick_rate = round1((2.0 + (score as f64 - 65.0) * 0.3).max(0.2));
    let mut ban_rate: f64 = 0.0;
    let mut games: i64 = 0;
    let mut rank: i64 = 0;
    let mut total_champions: i64 = 0;
    let mut source = "curated".to_string();
    let mut source_detail =
        "Curated patch snapshot + Data Dragon item, rune and champion data.".to_string();
    let mut counters = counters;
    let mut threats = threats;
    let mut notes = mode_notes(mode);

    if allow_live {
        match fetch_lolalytics(clients, &champion.name, role).await {
            Ok(summary) => {
                if let Some(value) = summary.win_rate {
                    win_rate = round1(value);
                    win_rate_label = "Emerald+".into();
                }
                if let Some(value) = summary.pick_rate {
                    pick_rate = round1(value);
                }
                if let Some(value) = summary.ban_rate {
                    ban_rate = round1(value);
                }
                if let Some(value) = summary.games {
                    games = value;
                }
                if let Some(value) = summary.rank {
                    rank = value;
                }
                if let Some(value) = summary.total_champions {
                    total_champions = value;
                }
                if let Some(value) = summary.tier {
                    tier = value;
                }
                if summary.win_rate.is_some() {
                    score = score_from_win_rate(win_rate);
                }
                if !summary.strong_against.is_empty() {
                    counters = matchups_from_names(
                        data,
                        &summary.strong_against,
                        "LoLalytics lists this as a favourable matchup.",
                        76,
                    );
                }
                if !summary.weak_against.is_empty() {
                    threats = matchups_from_names(
                        data,
                        &summary.weak_against,
                        "LoLalytics lists this as a difficult matchup.",
                        38,
                    );
                }
                let patch = summary.patch.unwrap_or_else(|| data.version.clone());
                source = "lolalytics+curated".into();
                source_detail = if summary.win_rate.is_some() {
                    format!(
                        "Live Emerald+ stats from LoLalytics (patch {patch}). Items, runes and skill order come from the curated snapshot."
                    )
                } else {
                    format!(
                        "Live tier from LoLalytics (patch {patch}). Win rate remains a curated estimate; items, runes and skill order come from the curated snapshot."
                    )
                };
            }
            Err(error) => {
                notes.push(format!(
                    "Live meta provider unavailable ({error}); using the curated snapshot."
                ));
            }
        }
    }

    let starting_items = items.starter.clone();
    let mut core_items: Vec<ItemRef> = items.boots.clone();
    core_items.extend(items.core.clone());
    core_items.truncate(3);
    let mut situational_items: Vec<ItemRef> = Vec::new();
    for item in items.core.iter().chain(items.situational.iter()) {
        if core_items.iter().any(|core| core.id == item.id) {
            continue;
        }
        if situational_items.iter().any(|existing| existing.id == item.id) {
            continue;
        }
        situational_items.push(item.clone());
    }

    let mut tips = recommend::strings(&entry, "tips");
    if tips.is_empty() {
        tips = vec![
            "Ward before pushing and track the enemy jungler's first clear.".into(),
            "Trade around your power spikes rather than forcing every wave.".into(),
            "Ping timers for objectives 30 seconds before they spawn.".into(),
        ];
    }

    ChampionBuild {
        champion: champion.name.clone(),
        champion_id: champion.id.clone(),
        champion_key: champion.key.clone(),
        champion_title: champion.title.clone(),
        tags: champion.tags.clone(),
        role: role.to_string(),
        role_label: role_label(role).to_string(),
        game_mode: mode.to_string(),
        game_mode_label: mode_label(mode).to_string(),
        patch: data.version.clone(),
        tier,
        score,
        win_rate,
        pick_rate,
        ban_rate,
        games,
        win_rate_label,
        rank,
        total_champions,
        source,
        source_detail,
        cached: false,
        fetched_at_ms: now_ms(),
        runes,
        summoner_spells: summoner_spells(data, mode, role),
        starting_items,
        core_items,
        situational_items,
        items,
        skill_order: skills,
        counters,
        threats,
        synergies,
        tips,
        notes,
        warnings,
    }
}

/// Returns a complete build for the requested champion, role and game mode.
///
/// `refresh` bypasses the 12-hour cache check but still falls back to curated
/// data when the live provider is unavailable.
#[tauri::command]
pub async fn get_champion_build(
    ddragon: State<'_, DdragonState>,
    builds: State<'_, MetaBuildsState>,
    clients: State<'_, Clients>,
    champion_key: String,
    role: Option<String>,
    game_mode: Option<String>,
    refresh: Option<bool>,
) -> Result<ChampionBuild, String> {
    let data = {
        let guard = ddragon.data.read().await;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| "Data Dragon is still loading".to_string())?
    };

    let query = champion_key.trim();
    let query = if query.is_empty() { "Ahri" } else { query };
    let champion = data
        .champions
        .iter()
        .find(|champion| {
            champion.name.eq_ignore_ascii_case(query)
                || champion.id.eq_ignore_ascii_case(query)
                || champion.key.eq_ignore_ascii_case(query)
        })
        .ok_or_else(|| format!("Champion '{query}' was not found"))?;

    let role = role_for(champion, role.as_deref().unwrap_or_default());
    let mode = normalized_mode(game_mode.as_deref().unwrap_or_default());
    let key = format!("{}|{}|{}|{}", champion.id, role, mode, data.version);

    if !refresh.unwrap_or(false) {
        if let Some(mut cached) = builds.get(&key, &data.version).await {
            cached.cached = true;
            cached.source_detail = format!(
                "{} Served from the local 12-hour build cache.",
                cached.source_detail
            );
            return Ok(cached);
        }
    }

    let build = assemble(
        &data,
        champion,
        &role,
        mode,
        &clients,
        mode == "CLASSIC",
    )
    .await;
    builds.put(key, build.clone()).await;
    Ok(build)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lolalytics_summary() {
        let html = r#"
            <html><body>
            <p>Ahri middle has a 53.07% win rate in Emerald+ on Patch 16.22 coming in at rank 3 of 93 and graded S Tier on the LoL Tierlist.</p>
            <p>Ahri middle is a strong counter to Galio, Orianna &amp; Akali while Ahri is countered most by Vladimir, Katarina &amp; Aurora.</p>
            <span>11.42%Pick Rate</span><span>3.68%Ban Rate</span><span>286,633Games</span>
            </body></html>
        "#;
        let summary = parse_summary(html).expect("parsed");
        assert_eq!(summary.win_rate, Some(53.07));
        assert_eq!(summary.tier.as_deref(), Some("S"));
        assert_eq!(summary.games, Some(286633));
        assert_eq!(summary.pick_rate, Some(11.42));
        assert_eq!(summary.ban_rate, Some(3.68));
        assert_eq!(summary.rank, Some(3));
        assert_eq!(summary.total_champions, Some(93));
        assert_eq!(summary.patch.as_deref(), Some("16.22"));
        assert_eq!(
            summary.strong_against,
            vec!["Galio", "Orianna", "Akali"]
        );
        assert_eq!(
            summary.weak_against,
            vec!["Vladimir", "Katarina", "Aurora"]
        );
    }

    #[test]
    fn rejects_unrelated_pages() {
        assert!(parse_summary("<html><body>Not found</body></html>").is_none());
    }

    #[test]
    fn normalizes_modes() {
        assert_eq!(normalized_mode("aram"), "ARAM");
        assert_eq!(normalized_mode("CHERRY"), "CHERRY");
        assert_eq!(normalized_mode("CLASSIC"), "CLASSIC");
        assert_eq!(normalized_mode(""), "CLASSIC");
    }

    #[test]
    fn builds_lolalytics_slugs() {
        assert_eq!(champion_slug("Dr. Mundo"), "drmundo");
        assert_eq!(champion_slug("Kai'Sa"), "kaisa");
        assert_eq!(short_champion_slug("Nunu & Willump"), "nunu");
        assert_eq!(champion_slug("Lee Sin"), "leesin");
    }
}
