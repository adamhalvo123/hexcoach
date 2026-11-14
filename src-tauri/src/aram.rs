use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::PathBuf, time::Duration};

const ARAM_URLS: &[&str] = &[
    "https://raw.communitydragon.org/latest/cdragon/arammbalance/en_us.json",
    "https://raw.communitydragon.org/latest/cdragon/aram/en_us.json",
];
const CURATED: &str = include_str!("../../src/data/aram-balance.json");

/// Percentage-point balance modifier for a champion on Howling Abyss.
/// Positive values are buffs, except `damage_taken` where positive means the
/// champion takes more damage (a nerf).
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AramBalance {
    pub champion: String,
    pub damage_dealt: f64,
    pub damage_taken: f64,
    pub healing: f64,
    pub shielding: f64,
    pub tenacity: f64,
    pub ability_haste: f64,
    pub mana_regen: f64,
    pub energy_regen: f64,
    pub note: String,
}

#[derive(Debug, Deserialize, Default)]
#[serde(default)]
struct CuratedFile {
    champions: Vec<AramBalance>,
}

fn curated() -> Vec<AramBalance> {
    let parsed: CuratedFile = serde_json::from_str(CURATED).unwrap_or_default();
    let mut champions = parsed.champions;
    champions.retain(|entry| !entry.champion.is_empty());
    champions.sort_by(|a, b| a.champion.cmp(&b.champion));
    champions
}

fn number(entry: &Value, keys: &[&str]) -> f64 {
    for key in keys {
        if let Some(value) = entry.get(*key).and_then(|v| v.as_f64()) {
            return value;
        }
    }
    0.0
}

/// CommunityDragon can publish either percentage points (5) or fractions
/// (0.05 / 1.05). Normalise everything to percentage points.
fn percent(value: f64) -> f64 {
    let normalised = if value == 0.0 {
        0.0
    } else if value.abs() <= 1.0 {
        value * 100.0
    } else if value > 1.0 && value < 3.0 {
        (value - 1.0) * 100.0
    } else {
        value
    };
    (normalised * 100.0).round() / 100.0
}

fn parse_live(raw: &str) -> Vec<AramBalance> {
    let Ok(value) = serde_json::from_str::<Value>(raw) else {
        return Vec::new();
    };
    let Some(entries) = value
        .get("champions")
        .and_then(|v| v.as_array())
        .or_else(|| value.get("balance").and_then(|v| v.as_array()))
        .or_else(|| value.as_array())
    else {
        return Vec::new();
    };

    let mut champions: Vec<AramBalance> = entries
        .iter()
        .filter_map(|entry| {
            let champion = entry
                .get("champion")
                .or_else(|| entry.get("championName"))
                .or_else(|| entry.get("name"))
                .or_else(|| entry.get("id"))
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            if champion.is_empty() {
                return None;
            }
            Some(AramBalance {
                champion,
                damage_dealt: percent(number(
                    entry,
                    &["damageDealt", "damage_dealt", "dmgDealt", "damageDealtPercent"],
                )),
                damage_taken: percent(number(
                    entry,
                    &["damageTaken", "damage_taken", "dmgTaken", "damageTakenPercent"],
                )),
                healing: percent(number(entry, &["healing", "heal", "healingPercent"])),
                shielding: percent(number(entry, &["shielding", "shield", "shieldingPercent"])),
                tenacity: percent(number(entry, &["tenacity", "tenacityPercent"])),
                ability_haste: percent(number(
                    entry,
                    &["abilityHaste", "ability_haste", "haste", "abilityHastePercent"],
                )),
                mana_regen: percent(number(entry, &["manaRegen", "mana_regen", "manaRegenPercent"])),
                energy_regen: percent(number(
                    entry,
                    &["energyRegen", "energy_regen", "energyRegenPercent"],
                )),
                note: entry
                    .get("note")
                    .or_else(|| entry.get("description"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Live CommunityDragon ARAM balance.")
                    .to_string(),
            })
        })
        .collect();
    champions.sort_by(|a, b| a.champion.cmp(&b.champion));
    champions
}

/// Loads Howling Abyss balance modifiers. Live CommunityDragon data is used
/// when available; otherwise a cached payload or the bundled curated snapshot
/// keeps the page useful offline. Returns `(champions, source)`.
pub async fn load(client: &reqwest::Client, cache_dir: &PathBuf) -> (Vec<AramBalance>, String) {
    let cache_file = cache_dir.join("aram-balance.json");

    for url in ARAM_URLS {
        let request = tokio::time::timeout(Duration::from_secs(8), client.get(*url).send()).await;
        if let Ok(Ok(response)) = request {
            if response.status().is_success() {
                if let Ok(raw) = response.text().await {
                    let parsed = parse_live(&raw);
                    if !parsed.is_empty() {
                        let _ = tokio::fs::create_dir_all(cache_dir).await;
                        let _ = tokio::fs::write(&cache_file, raw).await;
                        return (parsed, "live".into());
                    }
                }
            }
        }
    }

    if let Ok(raw) = tokio::fs::read_to_string(&cache_file).await {
        let parsed = parse_live(&raw);
        if !parsed.is_empty() {
            return (parsed, "cache".into());
        }
    }

    (curated(), "curated".into())
}
