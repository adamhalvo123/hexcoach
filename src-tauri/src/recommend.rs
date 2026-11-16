use crate::{
    ddragon::{Champion, DdragonData, DdragonState, Item, Rune, RuneTree},
    meta,
    util::{normalize_role, role_label},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ItemRef {
    pub id: u32,
    pub name: String,
    pub icon: String,
    pub price: i64,
    pub tags: Vec<String>,
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct BuildSet {
    pub starter: Vec<ItemRef>,
    pub boots: Vec<ItemRef>,
    pub core: Vec<ItemRef>,
    pub situational: Vec<ItemRef>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RuneRef {
    pub id: u32,
    pub name: String,
    pub icon: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RunePage {
    pub primary_style_id: u32,
    pub sub_style_id: u32,
    pub primary_style_name: String,
    pub sub_style_name: String,
    pub keystone: RuneRef,
    pub primary_perks: Vec<RuneRef>,
    pub sub_perks: Vec<RuneRef>,
    pub shards: Vec<u32>,
    pub selected_perk_ids: Vec<u32>,
    pub page_name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SkillPlan {
    pub order: Vec<String>,
    pub max: Vec<String>,
    pub note: String,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MetaView {
    pub tier: String,
    pub score: i64,
    pub estimated_win_rate: f64,
    pub label: String,
    pub note: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Matchup {
    pub champion: String,
    pub champion_id: String,
    pub reason: String,
    pub score: i64,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub champion: String,
    pub champion_id: String,
    pub champion_title: String,
    pub tags: Vec<String>,
    pub role: String,
    pub role_label: String,
    pub build_source: String,
    pub rune_source: String,
    pub meta: MetaView,
    pub items: BuildSet,
    pub runes: RunePage,
    pub skills: SkillPlan,
    pub counters: Vec<Matchup>,
    pub synergies: Vec<Matchup>,
    pub tips: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RolePick {
    pub champion: String,
    pub champion_id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub role: String,
    pub tier: String,
    pub score: i64,
    pub estimated_win_rate: f64,
    pub counters: Vec<String>,
    pub reason: String,
}

pub(crate) fn strings(value: &Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(|v| v.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn integer(value: &Value, key: &str, fallback: i64) -> i64 {
    value.get(key).and_then(|v| v.as_i64()).unwrap_or(fallback)
}

pub(crate) fn estimated_win_rate(score: i64) -> f64 {
    ((50.0 + (score as f64 - 70.0) * 0.18).clamp(44.0, 58.0) * 10.0).round() / 10.0
}

pub(crate) fn class_for(champion: &Champion, role: &str) -> &'static str {
    let has = |tag: &str| {
        champion
            .tags
            .iter()
            .any(|value| value.eq_ignore_ascii_case(tag))
    };
    if role == "UTILITY" {
        return if has("Tank") || has("Fighter") {
            "tank_support"
        } else {
            "enchanter"
        };
    }
    if role == "JUNGLE" {
        if has("Tank") {
            return "tank";
        }
        if has("Assassin") {
            return "assassin";
        }
        return "fighter";
    }
    if has("Marksman") {
        "marksman"
    } else if has("Mage") {
        "mage"
    } else if has("Assassin") {
        "assassin"
    } else if has("Tank") {
        "tank"
    } else {
        "fighter"
    }
}

pub(crate) fn default_profiles(class: &str) -> (&'static str, &'static str) {
    match class {
        "mage" => ("mage_burst", "electrocute_mage"),
        "marksman" => ("marksman", "lethal_tempo"),
        "assassin" => ("assassin", "electrocute"),
        "tank" => ("tank", "grasp"),
        "enchanter" => ("enchanter", "aery"),
        "tank_support" => ("tank_support", "aftershock"),
        _ => ("fighter", "conqueror"),
    }
}

fn find_item<'a>(items: &'a [Item], name: &str) -> Option<&'a Item> {
    items
        .iter()
        .find(|item| item.name.eq_ignore_ascii_case(name))
        .or_else(|| {
            items.iter().find(|item| {
                item.name
                    .to_lowercase()
                    .contains(&name.to_lowercase())
            })
        })
}

fn item_ref(item: &Item) -> ItemRef {
    let description = if item.plaintext.is_empty() {
        item.description.chars().take(220).collect()
    } else {
        item.plaintext.clone()
    };
    ItemRef {
        id: item.id,
        name: item.name.clone(),
        icon: item.image.full.clone(),
        price: item.gold.total,
        tags: item.tags.clone(),
        description,
    }
}

fn resolve_items(items: &[Item], names: &[String], warnings: &mut Vec<String>) -> Vec<ItemRef> {
    let mut resolved = Vec::new();
    for name in names {
        if let Some(item) = find_item(items, name) {
            if !resolved.iter().any(|existing: &ItemRef| existing.id == item.id) {
                resolved.push(item_ref(item));
            }
        } else {
            warnings.push(format!("Item '{name}' is not in the current patch."));
        }
    }
    resolved
}

pub(crate) fn build_items(
    data: &DdragonData,
    profile: &Value,
    entry: &Value,
    champion: &Champion,
    role: &str,
    class: &str,
    warnings: &mut Vec<String>,
) -> BuildSet {
    let _ = champion;
    let starter_names = if entry
        .get("starter")
        .and_then(|v| v.as_array())
        .is_some_and(|v| !v.is_empty())
    {
        strings(entry, "starter")
    } else if role == "JUNGLE" {
        vec!["Gustwalker Hatchling".into(), "Health Potion".into()]
    } else {
        strings(profile, "starter")
    };

    let mut core_names = if entry
        .get("core")
        .and_then(|v| v.as_array())
        .is_some_and(|v| !v.is_empty())
    {
        strings(entry, "core")
    } else {
        strings(profile, "core")
    };
    if core_names.is_empty() {
        core_names = strings(
            meta::profile(default_profiles(class).0).unwrap_or(&Value::Null),
            "core",
        );
    }

    let situational_names = if entry
        .get("situational")
        .and_then(|v| v.as_array())
        .is_some_and(|v| !v.is_empty())
    {
        strings(entry, "situational")
    } else {
        strings(profile, "situational")
    };

    let starter = resolve_items(&data.items, &starter_names, warnings);
    let resolved_core = resolve_items(&data.items, &core_names, warnings);
    let mut boots: Vec<ItemRef> = Vec::new();
    let mut core: Vec<ItemRef> = Vec::new();
    for item in resolved_core {
        if boots.is_empty()
            && (item.tags.iter().any(|t| t.eq_ignore_ascii_case("Boots"))
                || item.name.to_lowercase().contains("greaves")
                || item.name.to_lowercase().contains("shoes")
                || item.name.to_lowercase().contains("treads")
                || item.name.to_lowercase().contains("boots"))
        {
            boots.push(item);
        } else {
            core.push(item);
        }
    }

    BuildSet {
        starter,
        boots,
        core,
        situational: resolve_items(&data.items, &situational_names, warnings),
    }
}

fn find_tree<'a>(trees: &'a [RuneTree], name: &str) -> Option<&'a RuneTree> {
    trees
        .iter()
        .find(|tree| tree.name.eq_ignore_ascii_case(name))
}

fn find_rune_in_tree<'a>(tree: &'a RuneTree, name: &str) -> Option<&'a Rune> {
    tree.slots
        .iter()
        .flat_map(|slot| slot.runes.iter())
        .find(|rune| rune.name.eq_ignore_ascii_case(name))
}

fn rune_ref(rune: &Rune) -> RuneRef {
    RuneRef {
        id: rune.id,
        name: rune.name.clone(),
        icon: rune.icon.clone(),
    }
}

fn shards_from(value: &Value) -> Vec<u32> {
    let shards: Vec<u32> = value
        .get("shards")
        .and_then(|v| v.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|v| v.as_u64().map(|n| n as u32))
                .collect()
        })
        .unwrap_or_default();
    if shards.len() == 3 {
        shards
    } else {
        vec![5008, 5008, 5001]
    }
}

pub(crate) fn make_rune_page(
    data: &DdragonData,
    profile_name: &str,
    champion_name: &str,
    role: &str,
    warnings: &mut Vec<String>,
) -> RunePage {
    let fallback = meta::rune_profile("electrocute_mage").unwrap_or(&Value::Null);
    let profile = meta::rune_profile(profile_name).unwrap_or(fallback);

    let primary_name = profile
        .get("primary")
        .and_then(|v| v.as_str())
        .unwrap_or("Domination");
    let secondary_name = profile
        .get("secondary")
        .and_then(|v| v.as_str())
        .unwrap_or("Sorcery");

    let primary = find_tree(&data.runes, primary_name)
        .or_else(|| data.runes.first())
        .expect("Data Dragon always ships rune trees");
    let secondary = find_tree(&data.runes, secondary_name)
        .filter(|tree| tree.id != primary.id)
        .or_else(|| data.runes.iter().find(|tree| tree.id != primary.id))
        .unwrap_or(primary);

    let keystone_name = profile
        .get("keystone")
        .and_then(|v| v.as_str())
        .unwrap_or("Electrocute");
    let keystone = primary
        .slots
        .first()
        .and_then(|slot| {
            slot.runes
                .iter()
                .find(|rune| rune.name.eq_ignore_ascii_case(keystone_name))
                .or_else(|| slot.runes.first())
        })
        .expect("keystones exist");

    let primary_requested = strings(profile, "primaryPerks");
    let mut primary_perks: Vec<RuneRef> = Vec::new();
    for name in &primary_requested {
        if let Some(rune) = find_rune_in_tree(primary, name) {
            if rune.id != keystone.id
                && !primary_perks.iter().any(|existing| existing.id == rune.id)
            {
                primary_perks.push(rune_ref(rune));
            }
        } else {
            warnings.push(format!("Rune '{name}' was not found in {}.", primary.name));
        }
    }
    for slot in primary.slots.iter().skip(1) {
        if primary_perks.len() >= 3 {
            break;
        }
        if let Some(rune) = slot
            .runes
            .iter()
            .find(|rune| !primary_perks.iter().any(|existing| existing.id == rune.id))
        {
            primary_perks.push(rune_ref(rune));
        }
    }
    primary_perks.truncate(3);

    let secondary_requested = strings(profile, "secondaryPerks");
    let mut sub_perks: Vec<RuneRef> = Vec::new();
    for name in &secondary_requested {
        if let Some(rune) = find_rune_in_tree(secondary, name) {
            if rune.id != keystone.id && !sub_perks.iter().any(|existing| existing.id == rune.id) {
                sub_perks.push(rune_ref(rune));
            }
        } else {
            warnings.push(format!(
                "Rune '{name}' was not found in {}.",
                secondary.name
            ));
        }
    }
    for slot in secondary.slots.iter().skip(1) {
        if sub_perks.len() >= 2 {
            break;
        }
        if let Some(rune) = slot
            .runes
            .iter()
            .find(|rune| !sub_perks.iter().any(|existing| existing.id == rune.id))
        {
            sub_perks.push(rune_ref(rune));
        }
    }
    sub_perks.truncate(2);

    let mut shards = shards_from(profile);
    let mut selected_perk_ids: Vec<u32> = vec![keystone.id];
    selected_perk_ids.extend(primary_perks.iter().map(|rune| rune.id));
    selected_perk_ids.extend(sub_perks.iter().map(|rune| rune.id));
    selected_perk_ids.extend(shards.iter().copied());
    if selected_perk_ids.len() != 9 {
        shards = vec![5008, 5008, 5001];
        selected_perk_ids.truncate(6);
        selected_perk_ids.extend(shards.iter().copied());
    }

    RunePage {
        primary_style_id: primary.id,
        sub_style_id: secondary.id,
        primary_style_name: primary.name.clone(),
        sub_style_name: secondary.name.clone(),
        keystone: rune_ref(keystone),
        primary_perks,
        sub_perks,
        shards,
        selected_perk_ids,
        page_name: format!(
            "HexCoach | {} {}",
            champion_name,
            role_label(role)
        ),
    }
}

pub(crate) fn skill_plan(entry: &Value, class: &str) -> SkillPlan {
    let mut priority = strings(entry, "skillOrder");
    if priority.is_empty() {
        priority = match class {
            "fighter" | "assassin" => vec!["Q".into(), "E".into(), "W".into()],
            "enchanter" => vec!["E".into(), "W".into(), "Q".into()],
            _ => vec!["Q".into(), "W".into(), "E".into()],
        };
    }
    if priority.len() < 3 {
        for skill in ["Q", "W", "E"] {
            if !priority.iter().any(|value| value == skill) {
                priority.push(skill.into());
            }
        }
    }
    priority.truncate(3);

    let mut counters: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    counters.insert(priority[0].clone(), 0);
    counters.insert(priority[1].clone(), 0);
    counters.insert(priority[2].clone(), 0);

    let mut order: Vec<String> = Vec::with_capacity(18);
    for level in 1..=18 {
        if level == 1 {
            order.push(priority[0].clone());
            *counters.get_mut(&priority[0]).unwrap() += 1;
        } else if level == 2 {
            order.push(priority[1].clone());
            *counters.get_mut(&priority[1]).unwrap() += 1;
        } else if level == 3 {
            order.push(priority[2].clone());
            *counters.get_mut(&priority[2]).unwrap() += 1;
        } else if level == 6 || level == 11 || level == 16 {
            order.push("R".into());
        } else {
            let next = ["Q", "W", "E"]
                .iter()
                .find(|skill| {
                    counters
                        .get::<str>(*skill)
                        .map(|count| *count < 5)
                        .unwrap_or(false)
                })
                .map(|skill| skill.to_string())
                .unwrap_or_else(|| priority[0].clone());
            *counters.entry(next.clone()).or_insert(0) += 1;
            order.push(next);
        }
    }

    SkillPlan {
        order,
        max: priority.clone(),
        note: entry
            .get("skillNote")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                format!(
                    "Max {} first, then {} into {}.",
                    priority[0], priority[1], priority[2]
                )
            }),
    }
}

pub(crate) fn matchup_list(
    data: &DdragonData,
    entry: &Value,
    key: &str,
) -> Vec<Matchup> {
    entry
        .get(key)
        .and_then(|v| v.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|matchup| {
                    let name = matchup.get("champion").and_then(|v| v.as_str())?;
                    let champion = data
                        .champions
                        .iter()
                        .find(|champion| champion.name.eq_ignore_ascii_case(name))?;
                    Some(Matchup {
                        champion: champion.name.clone(),
                        champion_id: champion.id.clone(),
                        reason: matchup
                            .get("reason")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Favourable matchup")
                            .to_string(),
                        score: matchup
                            .get("score")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(72),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub async fn get_recommendation(
    state: State<'_, DdragonState>,
    champion: Option<String>,
    role: Option<String>,
) -> Result<Recommendation, String> {
    let guard = state.data.read().await;
    let data = guard
        .as_ref()
        .ok_or_else(|| "Data Dragon is still loading".to_string())?;

    let champion_query = champion.unwrap_or_else(|| "Ahri".into());
    let champion = data
        .champions
        .iter()
        .find(|c| {
            c.name.eq_ignore_ascii_case(&champion_query) || c.id.eq_ignore_ascii_case(&champion_query)
        })
        .ok_or_else(|| format!("Champion '{champion_query}' was not found"))?;

    let role = normalize_role(&role.unwrap_or_default());
    let entry = meta::role_entry(&champion.name, &role).cloned().unwrap_or(Value::Null);
    let role = if role == "NONE" {
        meta::champion_roles(&champion.name)
            .and_then(|roles| roles.as_object())
            .and_then(|roles| roles.keys().next())
            .cloned()
            .unwrap_or_else(|| "MIDDLE".into())
    } else {
        role
    };
    let class = class_for(champion, &role);
    let (default_build, default_runes) = default_profiles(class);

    let profile_name = entry
        .get("build")
        .and_then(|v| v.as_str())
        .unwrap_or(default_build);
    let profile = meta::profile(profile_name).unwrap_or(&Value::Null);
    let build_source = if entry.is_null() {
        "class-default"
    } else {
        "curated"
    }
    .to_string();

    let rune_profile_name = entry
        .get("rune")
        .and_then(|v| v.as_str())
        .unwrap_or(default_runes);
    let rune_source = if entry.is_null() {
        "class-default"
    } else {
        "curated"
    }
    .to_string();

    let mut warnings = Vec::new();
    let items = build_items(
        data,
        profile,
        &entry,
        champion,
        &role,
        class,
        &mut warnings,
    );
    let runes = make_rune_page(
        data,
        rune_profile_name,
        &champion.name,
        &role,
        &mut warnings,
    );
    let skills = skill_plan(&entry, class);

    let score = integer(&entry, "score", 70);
    let tier = entry
        .get("tier")
        .and_then(|v| v.as_str())
        .unwrap_or("B")
        .to_string();
    let meta_view = MetaView {
        tier,
        score,
        estimated_win_rate: estimated_win_rate(score),
        label: "EST. WR".into(),
        note: entry
            .get("note")
            .and_then(|v| v.as_str())
            .unwrap_or("Offline heuristic score. Not Riot match data.")
            .to_string(),
    };

    let tips = {
        let value = strings(&entry, "tips");
        if value.is_empty() {
            vec![
                "Ward before pushing and track the enemy jungler's first clear.".into(),
                "Trade around your power spikes rather than forcing every wave.".into(),
                "Ping timers for objectives 30 seconds before they spawn.".into(),
            ]
        } else {
            value
        }
    };

    Ok(Recommendation {
        champion: champion.name.clone(),
        champion_id: champion.id.clone(),
        champion_title: champion.title.clone(),
        tags: champion.tags.clone(),
        role_label: role_label(&role).to_string(),
        role,
        build_source,
        rune_source,
        meta: meta_view,
        items,
        runes,
        skills,
        counters: matchup_list(data, &entry, "counters"),
        synergies: matchup_list(data, &entry, "synergies"),
        tips,
        warnings,
    })
}

#[tauri::command]
pub async fn get_draft_recommendations(
    state: State<'_, DdragonState>,
    role: String,
    enemies: Option<Vec<String>>,
) -> Result<Vec<RolePick>, String> {
    let guard = state.data.read().await;
    let data = guard
        .as_ref()
        .ok_or_else(|| "Data Dragon is still loading".to_string())?;
    let role = normalize_role(&role);
    let enemies = enemies.unwrap_or_default();
    let Some(champions) = meta::data().get("champions").and_then(|v| v.as_object()) else {
        return Ok(Vec::new());
    };

    let mut picks: Vec<RolePick> = Vec::new();
    for (name, champion_value) in champions {
        let Some(role_entry) = champion_value
            .get("roles")
            .and_then(|roles| roles.get(&role))
        else {
            continue;
        };
        let Some(champion) = data
            .champions
            .iter()
            .find(|champion| champion.name.eq_ignore_ascii_case(name))
        else {
            continue;
        };

        let mut score = integer(role_entry, "score", 70);
        let counters = role_entry
            .get("counters")
            .and_then(|v| v.as_array())
            .map(|list| {
                list.iter()
                    .filter_map(|m| m.get("champion").and_then(|v| v.as_str()))
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let mut reasons: Vec<String> = Vec::new();
        for enemy in &enemies {
            if let Some(hit) = counters
                .iter()
                .find(|counter| counter.eq_ignore_ascii_case(enemy))
            {
                score += 8;
                reasons.push(format!("Counters {hit}"));
            }
        }

        let tier = role_entry
            .get("tier")
            .and_then(|v| v.as_str())
            .unwrap_or("B")
            .to_string();
        let reason = reasons
            .first()
            .cloned()
            .or_else(|| {
                role_entry
                    .get("tips")
                    .and_then(|v| v.as_array())
                    .and_then(|tips| tips.first())
                    .and_then(|tip| tip.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| {
                format!(
                    "Solid {} pick with a {} meta score.",
                    role_label(&role),
                    score
                )
            });

        picks.push(RolePick {
            champion: champion.name.clone(),
            champion_id: champion.id.clone(),
            title: champion.title.clone(),
            tags: champion.tags.clone(),
            role: role.clone(),
            tier,
            score,
            estimated_win_rate: estimated_win_rate(score),
            counters,
            reason,
        });
    }

    picks.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.champion.cmp(&b.champion)));
    picks.truncate(12);
    Ok(picks)
}
