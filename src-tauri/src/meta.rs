use serde_json::Value;
use std::sync::OnceLock;

/// Curated, offline meta snapshot shared with the frontend (`src/data/meta.json`).
/// It intentionally contains *relative* scores rather than pretending to have
/// Riot's private match data. The UI labels derived numbers as estimates.
pub fn data() -> &'static Value {
    static META: OnceLock<Value> = OnceLock::new();
    META.get_or_init(|| {
        serde_json::from_str(include_str!("../../src/data/meta.json")).unwrap_or(Value::Null)
    })
}

pub fn champion_roles(champion: &str) -> Option<&'static Value> {
    data().get("champions")?.get(champion)?.get("roles")
}

pub fn role_entry(champion: &str, role: &str) -> Option<&'static Value> {
    let roles = champion_roles(champion)?;
    roles
        .get(role)
        .or_else(|| roles.as_object()?.values().next())
}

pub fn profile(name: &str) -> Option<&'static Value> {
    data().get("buildProfiles")?.get(name)
}

pub fn rune_profile(name: &str) -> Option<&'static Value> {
    data().get("runeProfiles")?.get(name)
}

pub fn arena_tier(name: &str) -> Option<String> {
    let arena = data().get("arena")?.as_object()?;
    for (tier, names) in arena {
        if names
            .as_array()
            .is_some_and(|list| list.iter().any(|n| n.as_str() == Some(name)))
        {
            return Some(tier.clone());
        }
    }
    None
}
