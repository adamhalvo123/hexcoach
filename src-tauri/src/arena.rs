use crate::{meta, util::strip_html};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::PathBuf, time::Duration};
use tokio::time::sleep;

const ARENA_URL: &str = "https://raw.communitydragon.org/latest/cdragon/arena/en_us.json";
const CDRAGON: &str = "https://raw.communitydragon.org/latest";

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ArenaAugment {
    pub id: i64,
    pub api_name: String,
    pub name: String,
    pub desc: String,
    pub icon_small: String,
    pub icon_large: String,
    pub rarity: i64,
    pub rarity_label: String,
    pub tier: String,
    pub score: i64,
    pub tags: Vec<String>,
    pub synergy: String,
}

impl ArenaAugment {
    pub fn local_icon(&self) -> String {
        format!("img/augment/{}.png", sanitize(&self.api_name))
    }

    pub fn icon_url(&self) -> String {
        let path = self.icon_small.trim_start_matches('/');
        if path.starts_with("assets/") {
            format!("{CDRAGON}/plugins/rcp-be-lol-game-data/global/default/{path}")
        } else {
            format!("{CDRAGON}/{path}")
        }
    }
}

fn sanitize(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn rarity_label(rarity: i64) -> &'static str {
    match rarity {
        0 => "Silver",
        1 => "Gold",
        2 => "Prismatic",
        4 => "Special",
        _ => "Augment",
    }
}

fn tags_for(desc: &str) -> Vec<String> {
    let d = desc.to_lowercase();
    let mut tags = Vec::new();
    let checks: &[(&str, &[&str])] = &[
        ("AP", &["ability power", "magic damage", "ap "]),
        ("AD", &["attack damage", "physical damage", "ad "]),
        ("Crit", &["critical", "crit "]),
        ("Tank", &["health", "armor", "magic resist", "damage reduction"]),
        ("Sustain", &["heal", "shield", "omnivamp", "life steal"]),
        ("Haste", &["ability haste", "cooldown"]),
        ("Mobility", &["movement speed", "dash", "blink"]),
        ("Economy", &["gold", "anvil", "stat", "item"]),
        ("Ultimate", &["ultimate"]),
        ("Utility", &["summoner spell", "ward", "vision", "slow"]),
    ];
    for (tag, needles) in checks {
        if needles.iter().any(|needle| d.contains(needle)) {
            tags.push((*tag).to_string());
        }
    }
    if tags.is_empty() {
        tags.push("Utility".into());
    }
    tags
}

fn score_for(tier: &str, rarity: i64) -> i64 {
    match tier {
        "S" => 95,
        "A" => 86,
        "B" => 74,
        "C" => 62,
        _ => match rarity {
            2 => 84,
            1 => 72,
            0 => 60,
            _ => 70,
        },
    }
}

fn parse(raw: &str) -> Vec<ArenaAugment> {
    let value: Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let Some(items) = value.get("augments").and_then(|v| v.as_array()) else {
        return Vec::new();
    };

    let mut augments = Vec::with_capacity(items.len());
    for item in items {
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if name.is_empty() {
            continue;
        }
        let desc = item
            .get("desc")
            .or_else(|| item.get("tooltip"))
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let tags = tags_for(desc);
        let tier = meta::arena_tier(&name).unwrap_or_else(|| match item.get("rarity").and_then(|v| v.as_i64()).unwrap_or(0) {
            2 => "A".into(),
            1 => "B".into(),
            _ => "C".into(),
        });
        let rarity = item.get("rarity").and_then(|v| v.as_i64()).unwrap_or(0);
        let synergy = format!(
            "Synergy profile: {}",
            tags.iter().take(3).cloned().collect::<Vec<_>>().join(" / ")
        );
        augments.push(ArenaAugment {
            id: item.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
            api_name: item
                .get("apiName")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            name,
            desc: strip_html(desc),
            icon_small: item
                .get("iconSmall")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            icon_large: item
                .get("iconLarge")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            rarity,
            rarity_label: rarity_label(rarity).into(),
            score: score_for(&tier, rarity),
            tier,
            tags,
            synergy,
        });
    }
    augments.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.name.cmp(&b.name)));
    augments
}

/// Loads the Arena augment catalogue. A cached copy keeps the app useful if
/// CommunityDragon is slow or offline.
pub async fn load(
    client: &reqwest::Client,
    cache_dir: &PathBuf,
) -> Result<Vec<ArenaAugment>, String> {
    let cache_file = cache_dir.join("arena.json");
    if let Ok(raw) = tokio::fs::read_to_string(&cache_file).await {
        if let Ok(age) = tokio::fs::metadata(&cache_file).await {
            let fresh = age
                .modified()
                .ok()
                .and_then(|m| m.elapsed().ok())
                .is_some_and(|elapsed| elapsed < Duration::from_secs(60 * 60 * 12));
            if fresh {
                let parsed = parse(&raw);
                if !parsed.is_empty() {
                    return Ok(parsed);
                }
            }
        }
    }

    let mut last_error = String::new();
    for attempt in 0..2 {
        match client.get(ARENA_URL).send().await {
            Ok(response) if response.status().is_success() => {
                match response.text().await {
                    Ok(raw) => {
                        let parsed = parse(&raw);
                        if !parsed.is_empty() {
                            let _ = tokio::fs::create_dir_all(cache_dir).await;
                            let _ = tokio::fs::write(&cache_file, raw).await;
                            return Ok(parsed);
                        }
                        last_error = "CommunityDragon returned an unexpected payload".into();
                    }
                    Err(err) => last_error = err.to_string(),
                }
            }
            Ok(response) => last_error = format!("CommunityDragon HTTP {}", response.status()),
            Err(err) => last_error = err.to_string(),
        }
        if attempt == 0 {
            sleep(Duration::from_millis(600)).await;
        }
    }

    if let Ok(raw) = tokio::fs::read_to_string(&cache_file).await {
        let parsed = parse(&raw);
        if !parsed.is_empty() {
            return Ok(parsed);
        }
    }
    Err(last_error)
}

pub fn image_jobs(augments: &[ArenaAugment], cache_dir: &PathBuf) -> Vec<(String, PathBuf)> {
    augments
        .iter()
        .filter(|a| !a.icon_small.is_empty())
        .map(|a| {
            (
                a.icon_url(),
                cache_dir.join(a.local_icon().replace('/', std::path::MAIN_SEPARATOR_STR)),
            )
        })
        .collect()
}
