use std::path::Path;

/// Removes Riot's tooltip markup from strings so the UI can render clean text.
pub fn strip_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    let out = out
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");
    collapse_whitespace(&out)
}

fn collapse_whitespace(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut previous_space = false;
    for ch in input.chars() {
        if ch.is_whitespace() {
            if !previous_space {
                out.push(' ');
            }
            previous_space = true;
        } else {
            out.push(ch);
            previous_space = false;
        }
    }
    out.trim().to_string()
}

pub fn normalize_role(role: &str) -> String {
    match role.to_uppercase().as_str() {
        "TOP" | "TOPLANE" => "TOP".into(),
        "JUNGLE" | "JUNGLER" => "JUNGLE".into(),
        "MID" | "MIDDLE" | "MIDLANE" => "MIDDLE".into(),
        "ADC" | "BOT" | "BOTTOM" | "BOTLANE" => "BOTTOM".into(),
        "SUPPORT" | "SUP" | "UTILITY" => "UTILITY".into(),
        "" => "NONE".into(),
        other => other.to_string(),
    }
}

pub fn role_label(role: &str) -> &'static str {
    match role {
        "TOP" => "Top",
        "JUNGLE" => "Jungle",
        "MIDDLE" => "Mid",
        "BOTTOM" => "Bot",
        "UTILITY" => "Support",
        _ => "Flex",
    }
}

/// Human readable byte count used by cache/performance commands.
pub fn cache_size_mb(path: &Path) -> f64 {
    fn walk(path: &Path, total: &mut u64) {
        let Ok(entries) = std::fs::read_dir(path) else {
            return;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_file() {
                *total += meta.len();
            } else if meta.is_dir() {
                walk(&entry.path(), total);
            }
        }
    }

    if !path.exists() {
        return 0.0;
    }
    let mut total = 0u64;
    walk(path, &mut total);
    total as f64 / 1024.0 / 1024.0
}
