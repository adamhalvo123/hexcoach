use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};

/// Build-time community key. Never hardcode a key here: CI injects the
/// repository secret into the build environment, and local builds can omit it.
const ENV_RIOT_API_KEY: Option<&str> = option_env!("RIOT_API_KEY");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Hotkeys {
    pub toggle_compact: String,
    pub toggle_click_through: String,
    pub toggle_visibility: String,
    pub toggle_hud: String,
}

impl Default for Hotkeys {
    fn default() -> Self {
        Self {
            toggle_compact: "CommandOrControl+Shift+C".into(),
            toggle_click_through: "CommandOrControl+Shift+X".into(),
            toggle_visibility: "CommandOrControl+Shift+H".into(),
            toggle_hud: "Alt+X".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Stored locally only. This field is never serialised to the frontend.
    pub riot_api_key: String,
    pub riot_id: String,
    pub region: String,
    pub always_on_top: bool,
    pub demo_mode: bool,
    pub overlay_opacity: f64,
    pub performance_hud: bool,
    pub auto_import: bool,
    pub hud_overlay: bool,
    pub hotkeys: Hotkeys,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            riot_api_key: String::new(),
            riot_id: String::new(),
            region: "euw1".into(),
            always_on_top: true,
            demo_mode: true,
            overlay_opacity: 0.97,
            performance_hud: true,
            auto_import: false,
            hud_overlay: true,
            hotkeys: Hotkeys::default(),
        }
    }
}

/// Response shape sent to the frontend. The key itself is always blank; only
/// a configured flag and its source are exposed.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    pub riot_api_key: String,
    pub riot_key_configured: bool,
    pub riot_key_source: String,
    pub riot_id: String,
    pub region: String,
    pub always_on_top: bool,
    pub demo_mode: bool,
    pub overlay_opacity: f64,
    pub performance_hud: bool,
    pub auto_import: bool,
    pub hud_overlay: bool,
    pub hotkeys: Hotkeys,
}

fn env_riot_key_configured() -> bool {
    ENV_RIOT_API_KEY
        .map(str::trim)
        .is_some_and(|key| !key.is_empty())
}

pub struct SettingsState {
    path: PathBuf,
    inner: Mutex<Settings>,
}

impl SettingsState {
    pub fn load(app: &AppHandle) -> Self {
        let dir = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("settings.json");
        let settings = fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Settings>(&raw).ok())
            .unwrap_or_default();
        Self {
            path,
            inner: Mutex::new(settings),
        }
    }

    pub fn get(&self) -> Settings {
        self.inner
            .lock()
            .map(|s| s.clone())
            .unwrap_or_default()
    }

    pub fn view(&self) -> SettingsView {
        let settings = self.get();
        let local_configured = !settings.riot_api_key.trim().is_empty();
        let source = if local_configured {
            "local"
        } else if env_riot_key_configured() {
            "environment"
        } else {
            "none"
        };
        SettingsView {
            riot_api_key: String::new(),
            riot_key_configured: local_configured || env_riot_key_configured(),
            riot_key_source: source.into(),
            riot_id: settings.riot_id,
            region: settings.region,
            always_on_top: settings.always_on_top,
            demo_mode: settings.demo_mode,
            overlay_opacity: settings.overlay_opacity,
            performance_hud: settings.performance_hud,
            auto_import: settings.auto_import,
            hud_overlay: settings.hud_overlay,
            hotkeys: settings.hotkeys,
        }
    }

    /// Local override first, then the build-time environment key.
    pub fn effective_riot_key(&self) -> Option<String> {
        let local = self.get().riot_api_key.trim().to_string();
        if !local.is_empty() {
            return Some(local);
        }
        ENV_RIOT_API_KEY
            .map(str::trim)
            .filter(|key| !key.is_empty())
            .map(str::to_string)
    }

    pub fn save(&self, next: &Settings) -> Result<(), String> {
        let raw = serde_json::to_string_pretty(next).map_err(|e| e.to_string())?;
        fs::write(&self.path, raw).map_err(|e| format!("Could not save settings: {e}"))?;
        if let Ok(mut guard) = self.inner.lock() {
            *guard = next.clone();
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn get_settings(state: tauri::State<'_, SettingsState>) -> Result<SettingsView, String> {
    Ok(state.view())
}

#[tauri::command]
pub async fn save_settings(
    app: AppHandle,
    state: tauri::State<'_, SettingsState>,
    mut settings: Settings,
) -> Result<SettingsView, String> {
    let current = state.get();
    settings.riot_api_key = settings.riot_api_key.trim().to_string();
    // An empty input means "keep the current key". The UI never pre-fills it.
    if settings.riot_api_key.is_empty() {
        settings.riot_api_key = current.riot_api_key;
    }
    settings.overlay_opacity = settings.overlay_opacity.clamp(0.55, 1.0);
    crate::shortcuts::validate(&settings)?;
    state.save(&settings)?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(settings.always_on_top);
    }
    if let Some(window) = app.get_webview_window("hud-overlay") {
        if !settings.hud_overlay {
            let _ = window.hide();
        }
    }
    if let Err(error) = crate::shortcuts::register(&app) {
        eprintln!("HexCoach: global hotkeys were not re-registered: {error}");
    }
    Ok(state.view())
}

#[tauri::command]
pub async fn clear_riot_api_key(
    state: tauri::State<'_, SettingsState>,
) -> Result<SettingsView, String> {
    let mut current = state.get();
    current.riot_api_key.clear();
    state.save(&current)?;
    Ok(state.view())
}
