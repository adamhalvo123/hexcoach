use crate::{
    commands,
    settings::{Hotkeys, Settings, SettingsState},
};
use serde::Serialize;
use std::{
    collections::HashMap,
    str::FromStr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub struct ClickThroughState(pub AtomicBool);

impl Default for ClickThroughState {
    fn default() -> Self {
        Self(AtomicBool::new(false))
    }
}

/// Payload for the `shortcut-triggered` event. The Rust side already performs
/// the window action; this event keeps the React store in sync.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutTrigger {
    pub action: String,
    pub active: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyBinding {
    pub action: String,
    pub label: String,
    pub accelerator: String,
    pub registered: bool,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyStatus {
    pub bindings: Vec<HotkeyBinding>,
}

impl HotkeyStatus {
    pub fn all_registered(&self) -> bool {
        !self.bindings.is_empty() && self.bindings.iter().all(|binding| binding.registered)
    }
}

/// Last registration result, exposed to Settings so the UI can show which
/// accelerator Windows refused (usually because another app already owns it).
#[derive(Default)]
pub struct HotkeyRegistry(pub Mutex<HotkeyStatus>);

fn binding_defs(hotkeys: &Hotkeys) -> Vec<(&'static str, &'static str, String)> {
    vec![
        (
            "toggle-compact",
            "Compact / full overlay",
            hotkeys.toggle_compact.clone(),
        ),
        (
            "toggle-click-through",
            "Dashboard click-through",
            hotkeys.toggle_click_through.clone(),
        ),
        (
            "toggle-visibility",
            "Show / hide HexCoach",
            hotkeys.toggle_visibility.clone(),
        ),
        (
            "toggle-hud",
            "In-game HUD interaction",
            hotkeys.toggle_hud.clone(),
        ),
    ]
}

pub fn validate(settings: &Settings) -> Result<(), String> {
    let mut seen: HashMap<String, &'static str> = HashMap::new();
    for (_, label, accelerator) in binding_defs(&settings.hotkeys) {
        let trimmed = accelerator.trim();
        if trimmed.is_empty() {
            return Err(format!("The {label} shortcut cannot be empty."));
        }
        let shortcut = Shortcut::from_str(trimmed)
            .map_err(|error| format!("Invalid {label} shortcut '{trimmed}': {error}"))?;
        let normalized = shortcut.to_string().to_lowercase();
        if let Some(other) = seen.insert(normalized, label) {
            return Err(format!(
                "{label} and {other} are both bound to '{trimmed}'. Pick a different shortcut."
            ));
        }
    }
    Ok(())
}

fn emit_trigger(app: &AppHandle, action: &str, active: Option<bool>) {
    let _ = app.emit(
        "shortcut-triggered",
        ShortcutTrigger {
            action: action.to_string(),
            active,
        },
    );
}

/// Performs the window action for a shortcut. Runs on the main thread through
/// the global shortcut handler, so it works even while League owns keyboard
/// focus.
fn handle_action(app: &AppHandle, action: &str) {
    match action {
        "toggle-compact" => {
            let state = app.state::<commands::CompactState>();
            let next = !state.0.load(Ordering::Relaxed);
            state.0.store(next, Ordering::Relaxed);
            emit_trigger(app, action, Some(next));
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = commands::apply_compact(&handle, next).await {
                    eprintln!("HexCoach: compact hotkey failed: {error}");
                }
            });
        }
        "toggle-click-through" => {
            let state = app.state::<ClickThroughState>();
            let next = !state.0.load(Ordering::Relaxed);
            state.0.store(next, Ordering::Relaxed);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(next);
            }
            let _ = app.emit("click-through-changed", next);
            emit_trigger(app, action, Some(next));
        }
        "toggle-visibility" => {
            if let Some(window) = app.get_webview_window("main") {
                let visible = window.is_visible().unwrap_or(true);
                if visible {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = app.emit("overlay-visibility-changed", !visible);
                emit_trigger(app, action, Some(!visible));
            }
        }
        "toggle-hud" => {
            let state = app.state::<commands::HudState>();
            let next_ignore = !state.0.load(Ordering::Relaxed);
            state.0.store(next_ignore, Ordering::Relaxed);
            if let Some(window) = app.get_webview_window("hud-overlay") {
                let _ = window.set_ignore_cursor_events(next_ignore);
                if !window.is_visible().unwrap_or(false) {
                    let _ = window.show();
                }
                if !next_ignore {
                    let _ = window.set_focus();
                }
            }
            let _ = app.emit(
                "hud-clickthrough-changed",
                commands::hud_state_view(app),
            );
            // `active` reports the interactive state, which is the opposite of
            // the ignore-cursor flag.
            emit_trigger(app, action, Some(!next_ignore));
        }
        _ => {}
    }
}

/// Registers every configured accelerator and reports the result per binding.
///
/// Registration failures never abort startup: the remaining shortcuts are still
/// registered, and the reason is surfaced in Settings.
pub fn register(app: &AppHandle) -> HotkeyStatus {
    let settings = app.state::<SettingsState>().get();
    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister_all();

    if let Some(window) = app.get_webview_window("hud-overlay") {
        let _ = window.set_ignore_cursor_events(true);
    }
    if let Some(state) = app.try_state::<commands::HudState>() {
        state.0.store(true, Ordering::Relaxed);
    }

    let mut status = HotkeyStatus::default();
    for (action, label, accelerator) in binding_defs(&settings.hotkeys) {
        let trimmed = accelerator.trim().to_string();
        let mut binding = HotkeyBinding {
            action: action.to_string(),
            label: label.to_string(),
            accelerator: trimmed.clone(),
            registered: false,
            error: None,
        };

        if trimmed.is_empty() {
            binding.error = Some("Shortcut is empty.".into());
            status.bindings.push(binding);
            continue;
        }

        match Shortcut::from_str(&trimmed) {
            Err(error) => binding.error = Some(error.to_string()),
            Ok(_) => {
                let result = shortcuts.on_shortcut(trimmed.as_str(), move |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        handle_action(app, action);
                    }
                });
                match result {
                    Ok(()) => binding.registered = true,
                    Err(error) => binding.error = Some(error.to_string()),
                }
            }
        }
        status.bindings.push(binding);
    }

    if let Some(state) = app.try_state::<HotkeyRegistry>() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = status.clone();
        }
    }
    let _ = app.emit("hotkeys-changed", status.clone());
    status
}

pub fn status(app: &AppHandle) -> HotkeyStatus {
    app.try_state::<HotkeyRegistry>()
        .and_then(|state| state.0.lock().ok().map(|guard| guard.clone()))
        .unwrap_or_default()
}

/// Saves new hotkeys, re-registers them immediately and returns the status so
/// Settings can show failures without a restart.
#[tauri::command]
pub fn register_hotkeys(
    app: AppHandle,
    state: tauri::State<'_, SettingsState>,
    hotkeys: Hotkeys,
) -> Result<HotkeyStatus, String> {
    let mut settings = state.get();
    settings.hotkeys = hotkeys;
    validate(&settings)?;
    state.save(&settings)?;
    Ok(register(&app))
}

#[tauri::command]
pub fn get_hotkey_status(app: AppHandle) -> HotkeyStatus {
    status(&app)
}
