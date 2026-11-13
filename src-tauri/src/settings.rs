use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Hotkeys {
    pub toggle_compact: String,
    pub toggle_click_through: String,
    pub toggle_visibility: String,
}

impl Default for Hotkeys {
    fn default() -> Self {
        Self {
            toggle_compact: "CommandOrControl+Shift+C".into(),
            toggle_click_through: "CommandOrControl+Shift+X".into(),
            toggle_visibility: "CommandOrControl+Shift+H".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub riot_api_key: String,
    pub riot_id: String,
    pub region: String,
    pub always_on_top: bool,
    pub demo_mode: bool,
    pub overlay_opacity: f64,
    pub performance_hud: bool,
    pub auto_import: bool,
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
            hotkeys: Hotkeys::default(),
        }
    }
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
pub async fn get_settings(state: tauri::State<'_, SettingsState>) -> Result<Settings, String> {
    Ok(state.get())
}

#[tauri::command]
pub async fn save_settings(
    app: AppHandle,
    state: tauri::State<'_, SettingsState>,
    settings: Settings,
) -> Result<Settings, String> {
    let mut next = settings;
    next.overlay_opacity = next.overlay_opacity.clamp(0.55, 1.0);
    crate::shortcuts::validate(&next)?;
    state.save(&next)?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(next.always_on_top);
    }
    if let Err(error) = crate::shortcuts::register(&app) {
        eprintln!("HexCoach: global hotkeys were not re-registered: {error}");
    }
    Ok(next)
}
