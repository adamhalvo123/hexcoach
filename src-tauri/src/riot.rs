use crate::{settings::SettingsState, Clients};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

#[derive(Clone, Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RiotApiRequest {
    /// "account" | "matches" | "match" | "summoner"
    pub kind: String,
    pub region: Option<String>,
    pub game_name: Option<String>,
    pub tag_line: Option<String>,
    pub puuid: Option<String>,
    pub match_id: Option<String>,
    pub start: Option<u32>,
    pub count: Option<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RiotApiResponse {
    pub status: u16,
    pub data: Value,
}

const PLATFORM_REGIONS: &[&str] = &[
    "euw1", "eun1", "tr1", "ru", "na1", "br1", "la1", "la2", "oc1", "kr", "jp1", "sg2", "th2",
    "vn2", "tw2", "ph2",
];

fn normalise_region(value: &str) -> Result<String, String> {
    let region = value.trim().to_lowercase();
    match region.as_str() {
        "europe" | "americas" | "asia" | "sea" => Ok(region),
        other if PLATFORM_REGIONS.contains(&other) => Ok(region),
        _ => Err(format!(
            "Unsupported Riot region '{value}'. Use a platform shard such as euw1 or na1."
        )),
    }
}

fn regional_route(region: &str) -> &'static str {
    match region {
        "euw1" | "eun1" | "tr1" | "ru" | "europe" => "europe",
        "na1" | "br1" | "la1" | "la2" | "oc1" | "americas" => "americas",
        "kr" | "jp1" | "asia" => "asia",
        "sg2" | "th2" | "vn2" | "tw2" | "ph2" | "sea" => "sea",
        _ => "europe",
    }
}

fn platform_host(region: &str) -> Result<String, String> {
    if PLATFORM_REGIONS.contains(&region) {
        Ok(format!("https://{region}.api.riotgames.com"))
    } else {
        Err("Summoner-v4 needs a platform shard such as euw1 or na1.".into())
    }
}

fn build_url(request: &RiotApiRequest, settings_region: &str) -> Result<String, String> {
    let region = normalise_region(request.region.as_deref().unwrap_or(settings_region))?;
    let kind = request.kind.trim().to_lowercase();
    let base = if kind == "summoner" {
        platform_host(&region)?
    } else {
        format!("https://{}.api.riotgames.com", regional_route(&region))
    };
    let mut url = reqwest::Url::parse(&base)
        .map_err(|error| format!("Could not build the Riot API URL: {error}"))?;

    match kind.as_str() {
        "account" | "account-v1" => {
            let game_name = request.game_name.as_deref().unwrap_or("").trim();
            let tag_line = request.tag_line.as_deref().unwrap_or("").trim();
            if game_name.is_empty() || tag_line.is_empty() {
                return Err("Riot ID must use the Name#Tag form.".into());
            }
            let mut segments = url
                .path_segments_mut()
                .map_err(|_| "Could not build the Riot API URL".to_string())?;
            segments.push("riot");
            segments.push("account");
            segments.push("v1");
            segments.push("accounts");
            segments.push("by-riot-id");
            segments.push(game_name);
            segments.push(tag_line);
        }
        "matches" | "match-ids" => {
            let puuid = request.puuid.as_deref().unwrap_or("").trim();
            if puuid.is_empty() {
                return Err("A PUUID is required to list matches.".into());
            }
            {
                let mut segments = url
                    .path_segments_mut()
                    .map_err(|_| "Could not build the Riot API URL".to_string())?;
                segments.push("lol");
                segments.push("match");
                segments.push("v5");
                segments.push("matches");
                segments.push("by-puuid");
                segments.push(puuid);
                segments.push("ids");
            }
            let count = request.count.unwrap_or(20).clamp(1, 20);
            let start = request.start.unwrap_or(0);
            url.query_pairs_mut()
                .append_pair("start", &start.to_string())
                .append_pair("count", &count.to_string());
        }
        "match" | "match-v5" => {
            let match_id = request.match_id.as_deref().unwrap_or("").trim();
            if match_id.is_empty() {
                return Err("A match ID is required.".into());
            }
            let mut segments = url
                .path_segments_mut()
                .map_err(|_| "Could not build the Riot API URL".to_string())?;
            segments.push("lol");
            segments.push("match");
            segments.push("v5");
            segments.push("matches");
            segments.push(match_id);
        }
        "summoner" => {
            let puuid = request.puuid.as_deref().unwrap_or("").trim();
            if puuid.is_empty() {
                return Err("A PUUID is required for Summoner-v4.".into());
            }
            let mut segments = url
                .path_segments_mut()
                .map_err(|_| "Could not build the Riot API URL".to_string())?;
            segments.push("lol");
            segments.push("summoner");
            segments.push("v4");
            segments.push("summoners");
            segments.push("by-puuid");
            segments.push(puuid);
        }
        _ => {
            return Err(
                "Unsupported Riot API endpoint. Use account, matches, match or summoner.".into(),
            )
        }
    }

    Ok(url.to_string())
}

/// Server-side Riot API proxy. The key is read from the local Settings override
/// or from the build-time `RIOT_API_KEY` environment and only ever attached as
/// the `X-Riot-Token` header here. The frontend receives the response body, not
/// the key or the request headers.
#[tauri::command]
pub async fn fetch_riot_api(
    clients: State<'_, Clients>,
    settings: State<'_, SettingsState>,
    request: RiotApiRequest,
) -> Result<RiotApiResponse, String> {
    let key = settings.effective_riot_key().ok_or_else(|| {
        "No Riot API key configured. Add one in Settings or build with RIOT_API_KEY.".to_string()
    })?;
    let url = build_url(&request, &settings.get().region)?;

    let response = clients
        .http
        .get(url)
        .header("X-Riot-Token", key)
        .send()
        .await
        .map_err(|error| format!("Riot API request failed: {error}"))?;

    let status = response.status().as_u16();
    let data = response.json::<Value>().await.unwrap_or(Value::Null);
    Ok(RiotApiResponse { status, data })
}
