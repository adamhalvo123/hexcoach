use crate::{
    riot::{normalise_region, platform_host, regional_route},
    settings::SettingsState,
    Clients,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    cmp::Ordering,
    collections::{HashMap, HashSet},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;

#[derive(Clone, Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ProfileRequest {
    pub riot_id: Option<String>,
    pub region: Option<String>,
    pub count: Option<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRank {
    pub queue: String,
    pub queue_label: String,
    pub tier: String,
    pub rank: String,
    pub league_points: i32,
    pub wins: i32,
    pub losses: i32,
    pub win_rate: f64,
    pub hot_streak: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchTeammate {
    pub puuid: String,
    pub name: String,
    pub champion: String,
    pub win: bool,
    pub kills: i32,
    pub deaths: i32,
    pub assists: i32,
    pub kda: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileMatch {
    pub match_id: String,
    pub champion: String,
    pub champion_id: i64,
    pub role: String,
    pub win: bool,
    pub kills: i32,
    pub deaths: i32,
    pub assists: i32,
    pub kda: f64,
    pub duration_sec: i64,
    pub game_mode: String,
    pub queue_id: i64,
    pub played_at_ms: i64,
    pub teammates: Vec<MatchTeammate>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrequentTeammate {
    pub puuid: String,
    pub name: String,
    pub games: i32,
    pub wins: i32,
    pub losses: i32,
    pub win_rate: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProfile {
    pub riot_id: String,
    pub game_name: String,
    pub tag_line: String,
    pub puuid: String,
    pub summoner_level: i64,
    pub profile_icon_id: i64,
    pub region: String,
    pub ranks: Vec<ProfileRank>,
    pub matches: Vec<ProfileMatch>,
    pub teammates: Vec<FrequentTeammate>,
    pub overall_wins: i32,
    pub overall_losses: i32,
    pub overall_win_rate: f64,
    pub overall_source: String,
    pub recent_wins: i32,
    pub recent_losses: i32,
    pub recent_win_rate: f64,
    pub fetched_at_ms: i64,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn number(value: Option<&Value>) -> i64 {
    value.and_then(Value::as_i64).unwrap_or(0)
}

fn text(value: Option<&Value>) -> String {
    value.and_then(Value::as_str).unwrap_or("").trim().to_string()
}

fn win_rate(wins: i32, losses: i32) -> f64 {
    let total = wins + losses;
    if total <= 0 {
        return 0.0;
    }
    ((wins as f64 / total as f64) * 1000.0).round() / 10.0
}

fn ratio(numerator: f64, denominator: f64) -> f64 {
    ((numerator / denominator.max(1.0)) * 100.0).round() / 100.0
}

fn split_riot_id(raw: &str) -> Result<(String, String), String> {
    let trimmed = raw.trim();
    let (name, tag) = trimmed.split_once('#').ok_or_else(|| {
        "Riot ID must use the Name#Tag form (for example Faker#KR1).".to_string()
    })?;
    let name = name.trim();
    let tag = tag.trim();
    if name.is_empty() || tag.is_empty() {
        return Err("Riot ID must use the Name#Tag form (for example Faker#KR1).".into());
    }
    Ok((name.to_string(), tag.to_string()))
}

fn host_url(host: &str, segments: &[&str]) -> Result<String, String> {
    let mut url = reqwest::Url::parse(host)
        .map_err(|error| format!("Could not build the Riot API URL: {error}"))?;
    {
        let mut path = url
            .path_segments_mut()
            .map_err(|_| "Could not build the Riot API URL".to_string())?;
        path.pop_if_empty();
        for segment in segments {
            path.push(segment);
        }
    }
    Ok(url.to_string())
}

fn status_error(status: u16, what: &str) -> String {
    match status {
        401 => "Riot API rejected the key (HTTP 401). Add a valid key in Settings.".into(),
        403 => {
            "The Riot API key is expired or forbidden (HTTP 403). Generate a new development key."
                .into()
        }
        404 => format!("{what} was not found (HTTP 404). Check the Riot ID and region."),
        429 => "Riot API rate limit reached (HTTP 429). Wait a minute and try again.".into(),
        _ => format!("Riot API returned HTTP {status} while loading {what}."),
    }
}

async fn riot_get_status(
    http: &reqwest::Client,
    key: &str,
    url: &str,
) -> Result<(u16, Value), String> {
    let response = http
        .get(url)
        .header("X-Riot-Token", key)
        .send()
        .await
        .map_err(|error| format!("Riot API request failed: {error}"))?;
    let status = response.status().as_u16();
    let data = response.json::<Value>().await.unwrap_or(Value::Null);
    Ok((status, data))
}

async fn riot_get(
    http: &reqwest::Client,
    key: &str,
    url: &str,
    what: &str,
) -> Result<Value, String> {
    let (status, data) = riot_get_status(http, key, url).await?;
    if (200..300).contains(&status) {
        Ok(data)
    } else {
        Err(status_error(status, what))
    }
}

fn parse_ranks(entries: &Value) -> Vec<ProfileRank> {
    let empty = Vec::new();
    let list = entries.as_array().unwrap_or(&empty);
    let mut ranks = Vec::new();

    for (queue, label) in [
        ("RANKED_SOLO_5x5", "Solo/Duo"),
        ("RANKED_FLEX_SR", "Flex"),
    ] {
        let Some(entry) = list
            .iter()
            .find(|entry| text(entry.get("queueType")) == queue)
        else {
            continue;
        };
        let wins = number(entry.get("wins")) as i32;
        let losses = number(entry.get("losses")) as i32;
        ranks.push(ProfileRank {
            queue: queue.into(),
            queue_label: label.into(),
            tier: text(entry.get("tier")),
            rank: text(entry.get("rank")),
            league_points: number(entry.get("leaguePoints")) as i32,
            wins,
            losses,
            win_rate: win_rate(wins, losses),
            hot_streak: entry
                .get("hotStreak")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        });
    }

    ranks
}

fn participant_name(participant: &Value) -> String {
    let game_name = text(participant.get("riotIdGameName"));
    let tag_line = text(participant.get("riotIdTagline"));
    if !game_name.is_empty() {
        return if tag_line.is_empty() {
            game_name
        } else {
            format!("{game_name}#{tag_line}")
        };
    }

    let legacy = text(participant.get("summonerName"));
    if !legacy.is_empty() {
        return legacy;
    }

    text(participant.get("championName"))
}

fn parse_match(data: &Value, puuid: &str, match_id: &str) -> Option<ProfileMatch> {
    let info = data.get("info")?;
    let participants = info.get("participants")?.as_array()?;
    let me = participants
        .iter()
        .find(|participant| text(participant.get("puuid")) == puuid)?;

    let team_id = number(me.get("teamId"));
    let win = me.get("win").and_then(Value::as_bool).unwrap_or(false);
    let kills = number(me.get("kills")) as i32;
    let deaths = number(me.get("deaths")) as i32;
    let assists = number(me.get("assists")) as i32;
    let role = {
        let team_position = text(me.get("teamPosition"));
        if team_position.is_empty() {
            text(me.get("individualPosition"))
        } else {
            team_position
        }
    };
    let played_at_ms = info
        .get("gameEndTimestamp")
        .and_then(Value::as_i64)
        .or_else(|| info.get("gameCreation").and_then(Value::as_i64))
        .unwrap_or(0);

    let teammates = participants
        .iter()
        .filter(|participant| {
            number(participant.get("teamId")) == team_id
                && text(participant.get("puuid")) != puuid
        })
        .map(|participant| {
            let kills = number(participant.get("kills")) as i32;
            let deaths = number(participant.get("deaths")) as i32;
            let assists = number(participant.get("assists")) as i32;
            MatchTeammate {
                puuid: text(participant.get("puuid")),
                name: participant_name(participant),
                champion: text(participant.get("championName")),
                win,
                kills,
                deaths,
                assists,
                kda: ratio((kills + assists) as f64, deaths as f64),
            }
        })
        .collect();

    Some(ProfileMatch {
        match_id: {
            let id = text(data.get("metadata").and_then(|meta| meta.get("matchId")));
            if id.is_empty() {
                match_id.to_string()
            } else {
                id
            }
        },
        champion: text(me.get("championName")),
        champion_id: number(me.get("championId")),
        role,
        win,
        kills,
        deaths,
        assists,
        kda: ratio((kills + assists) as f64, deaths as f64),
        duration_sec: number(info.get("gameDuration")),
        game_mode: text(info.get("gameMode")),
        queue_id: number(info.get("queueId")),
        played_at_ms,
        teammates,
    })
}

fn aggregate_teammates(matches: &[ProfileMatch]) -> Vec<FrequentTeammate> {
    let mut totals: HashMap<String, (String, i32, i32)> = HashMap::new();

    for game in matches {
        let mut seen = HashSet::new();
        for teammate in &game.teammates {
            if teammate.puuid.is_empty() || !seen.insert(teammate.puuid.clone()) {
                continue;
            }
            let entry = totals
                .entry(teammate.puuid.clone())
                .or_insert_with(|| (teammate.name.clone(), 0, 0));
            if !teammate.name.is_empty() {
                entry.0 = teammate.name.clone();
            }
            if game.win {
                entry.1 += 1;
            } else {
                entry.2 += 1;
            }
        }
    }

    let mut list: Vec<FrequentTeammate> = totals
        .into_iter()
        .map(|(puuid, (name, wins, losses))| FrequentTeammate {
            puuid,
            name,
            games: wins + losses,
            wins,
            losses,
            win_rate: win_rate(wins, losses),
        })
        .collect();

    list.sort_by(|a, b| {
        b.games
            .cmp(&a.games)
            .then_with(|| {
                b.win_rate
                    .partial_cmp(&a.win_rate)
                    .unwrap_or(Ordering::Equal)
            })
            .then_with(|| a.name.cmp(&b.name))
    });
    list.truncate(15);
    list
}

/// Loads the player card, ranked entries, the last ten matches and the
/// frequent-teammate aggregation. All Riot calls happen in Rust so the API key
/// is only ever attached here as `X-Riot-Token`.
#[tauri::command]
pub async fn get_player_profile(
    clients: State<'_, Clients>,
    settings: State<'_, SettingsState>,
    request: Option<ProfileRequest>,
) -> Result<PlayerProfile, String> {
    let request = request.unwrap_or_default();
    let stored = settings.get();

    let riot_id_raw = request
        .riot_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            let value = stored.riot_id.trim();
            if value.is_empty() {
                None
            } else {
                Some(value)
            }
        })
        .ok_or_else(|| "Add your Riot ID in Settings first (for example Name#EUNE).".to_string())?;

    let region_value = request
        .region
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(stored.region.as_str());
    let count = request.count.unwrap_or(10).clamp(1, 20);

    let key = settings.effective_riot_key().ok_or_else(|| {
        "No Riot API key configured. Add one in Settings or build with RIOT_API_KEY.".to_string()
    })?;
    let (game_name, tag_line) = split_riot_id(riot_id_raw)?;
    let region = normalise_region(region_value)?;
    let platform = platform_host(&region)?;
    let regional = format!("https://{}.api.riotgames.com", regional_route(&region));

    let account_url = host_url(
        &regional,
        &[
            "riot",
            "account",
            "v1",
            "accounts",
            "by-riot-id",
            &game_name,
            &tag_line,
        ],
    )?;
    let account = riot_get(&clients.http, &key, &account_url, "Riot account").await?;
    let puuid = text(account.get("puuid"));
    if puuid.is_empty() {
        return Err("Riot Account-v1 returned no PUUID for that Riot ID.".into());
    }
    let resolved_name = {
        let name = text(account.get("gameName"));
        if name.is_empty() {
            game_name.clone()
        } else {
            name
        }
    };
    let resolved_tag = {
        let tag = text(account.get("tagLine"));
        if tag.is_empty() {
            tag_line.clone()
        } else {
            tag
        }
    };

    let summoner_url = host_url(
        &platform,
        &["lol", "summoner", "v4", "summoners", "by-puuid", &puuid],
    )?;
    let summoner = riot_get(&clients.http, &key, &summoner_url, "summoner profile").await?;
    let summoner_level = number(summoner.get("summonerLevel"));
    let profile_icon_id = number(summoner.get("profileIconId"));
    let encrypted_summoner_id = text(summoner.get("id"));

    let mut entries = Value::Array(Vec::new());
    if !encrypted_summoner_id.is_empty() && encrypted_summoner_id != "DEPRECATED" {
        let url = host_url(
            &platform,
            &[
                "lol",
                "league",
                "v4",
                "entries",
                "by-summoner",
                &encrypted_summoner_id,
            ],
        )?;
        let (status, data) = riot_get_status(&clients.http, &key, &url).await?;
        if (200..300).contains(&status) {
            entries = data;
        } else if status != 404 {
            return Err(status_error(status, "ranked entries"));
        }
    }
    if !entries.as_array().is_some_and(|list| !list.is_empty()) {
        // Fallback for accounts where Summoner-v4 no longer returns an encrypted
        // summoner ID. League-v4 exposes the same entries by PUUID on new keys.
        let url = host_url(
            &platform,
            &["lol", "league", "v4", "entries", "by-puuid", &puuid],
        )?;
        match riot_get_status(&clients.http, &key, &url).await {
            Ok((status, data)) if (200..300).contains(&status) => entries = data,
            Ok((404, _)) => {
                if entries.as_array().map_or(true, Vec::is_empty) {
                    entries = Value::Array(Vec::new());
                }
            }
            Ok((status, _)) if status == 429 || status == 401 => {
                return Err(status_error(status, "ranked entries"));
            }
            Ok((_status, _)) => {
                // Leave the by-summoner result (which may already be empty).
            }
            Err(error) => return Err(error),
        }
    }
    let ranks = parse_ranks(&entries);

    let match_ids_url = host_url(
        &regional,
        &[
            "lol",
            "match",
            "v5",
            "matches",
            "by-puuid",
            &puuid,
            "ids",
        ],
    )?;
    let mut match_ids_url = reqwest::Url::parse(&match_ids_url)
        .map_err(|error| format!("Could not build the Riot API URL: {error}"))?;
    match_ids_url
        .query_pairs_mut()
        .append_pair("count", &count.to_string());

    let ids = riot_get(
        &clients.http,
        &key,
        match_ids_url.as_str(),
        "recent matches",
    )
    .await?;
    let match_ids: Vec<String> = ids
        .as_array()
        .map(|list| list.iter().filter_map(Value::as_str).map(str::to_string).collect())
        .unwrap_or_default();

    let mut matches = Vec::new();
    for match_id in match_ids {
        let url = host_url(
            &regional,
            &["lol", "match", "v5", "matches", &match_id],
        )?;
        match riot_get_status(&clients.http, &key, &url).await {
            Ok((status, data)) if (200..300).contains(&status) => {
                if let Some(parsed) = parse_match(&data, &puuid, &match_id) {
                    matches.push(parsed);
                }
            }
            Ok((status, _)) => {
                if matches!(status, 401 | 403 | 429) {
                    return Err(status_error(status, "match details"));
                }
                // Skip a single unavailable match instead of failing the profile.
            }
            Err(error) => return Err(error),
        }
    }

    let teammates = aggregate_teammates(&matches);
    let recent_wins = matches.iter().filter(|game| game.win).count() as i32;
    let recent_losses = matches.len() as i32 - recent_wins;
    let ranked_wins: i32 = ranks.iter().map(|rank| rank.wins).sum();
    let ranked_losses: i32 = ranks.iter().map(|rank| rank.losses).sum();

    let (overall_wins, overall_losses, overall_source) = if ranked_wins + ranked_losses > 0 {
        (ranked_wins, ranked_losses, "ranked")
    } else {
        (recent_wins, recent_losses, "recent")
    };

    Ok(PlayerProfile {
        riot_id: format!("{resolved_name}#{resolved_tag}"),
        game_name: resolved_name,
        tag_line: resolved_tag,
        puuid,
        summoner_level,
        profile_icon_id,
        region,
        ranks,
        matches,
        teammates,
        overall_wins,
        overall_losses,
        overall_win_rate: win_rate(overall_wins, overall_losses),
        overall_source: overall_source.into(),
        recent_wins,
        recent_losses,
        recent_win_rate: win_rate(recent_wins, recent_losses),
        fetched_at_ms: now_ms(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_match_and_teammates() {
        let data = json!({
            "metadata": { "matchId": "EUN1_1" },
            "info": {
                "gameDuration": 1800,
                "gameMode": "CLASSIC",
                "queueId": 420,
                "gameCreation": 1_700_000_000_000_i64,
                "participants": [
                    {
                        "puuid": "me",
                        "teamId": 100,
                        "win": true,
                        "kills": 10,
                        "deaths": 2,
                        "assists": 8,
                        "championName": "Ahri",
                        "championId": 103,
                        "teamPosition": "MIDDLE",
                        "riotIdGameName": "Me",
                        "riotIdTagline": "EUW"
                    },
                    {
                        "puuid": "duo",
                        "teamId": 100,
                        "win": true,
                        "kills": 2,
                        "deaths": 3,
                        "assists": 18,
                        "championName": "Lulu",
                        "championId": 117,
                        "teamPosition": "UTILITY",
                        "riotIdGameName": "Duo",
                        "riotIdTagline": "EUW"
                    },
                    {
                        "puuid": "enemy",
                        "teamId": 200,
                        "win": false,
                        "kills": 0,
                        "deaths": 5,
                        "assists": 1,
                        "championName": "Zed",
                        "championId": 238,
                        "teamPosition": "MIDDLE"
                    }
                ]
            }
        });

        let parsed = parse_match(&data, "me", "fallback").expect("match should parse");
        assert_eq!(parsed.match_id, "EUN1_1");
        assert_eq!(parsed.champion, "Ahri");
        assert_eq!(parsed.kda, 9.0);
        assert_eq!(parsed.teammates.len(), 1);
        assert_eq!(parsed.teammates[0].name, "Duo#EUW");
        assert_eq!(parsed.teammates[0].champion, "Lulu");
        assert_eq!(parsed.teammates[0].kda, 6.67);
    }

    #[test]
    fn aggregates_shared_teammates() {
        let teammate = |win| MatchTeammate {
            puuid: "duo".into(),
            name: "Duo#EUW".into(),
            champion: "Lulu".into(),
            win,
            kills: 2,
            deaths: 3,
            assists: 18,
            kda: 6.67,
        };
        let game = |win| ProfileMatch {
            match_id: "EUN1_1".into(),
            champion: "Ahri".into(),
            champion_id: 103,
            role: "MIDDLE".into(),
            win,
            kills: 10,
            deaths: 2,
            assists: 8,
            kda: 9.0,
            duration_sec: 1800,
            game_mode: "CLASSIC".into(),
            queue_id: 420,
            played_at_ms: 0,
            teammates: vec![teammate(win)],
        };

        let list = aggregate_teammates(&[game(true), game(true), game(false)]);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].games, 3);
        assert_eq!(list[0].wins, 2);
        assert_eq!(list[0].losses, 1);
        assert_eq!(list[0].win_rate, 66.7);
    }

    #[test]
    fn parses_solo_and_flex_entries() {
        let entries = json!([
            {
                "queueType": "RANKED_SOLO_5x5",
                "tier": "EMERALD",
                "rank": "II",
                "leaguePoints": 43,
                "wins": 68,
                "losses": 54,
                "hotStreak": true
            },
            {
                "queueType": "RANKED_FLEX_SR",
                "tier": "PLATINUM",
                "rank": "I",
                "leaguePoints": 12,
                "wins": 22,
                "losses": 19,
                "hotStreak": false
            },
            {
                "queueType": "RANKED_TFT",
                "tier": "GOLD",
                "rank": "IV",
                "leaguePoints": 1,
                "wins": 5,
                "losses": 5
            }
        ]);

        let ranks = parse_ranks(&entries);
        assert_eq!(ranks.len(), 2);
        assert_eq!(ranks[0].queue_label, "Solo/Duo");
        assert_eq!(ranks[0].win_rate, 55.7);
        assert_eq!(ranks[1].queue_label, "Flex");
    }
}
