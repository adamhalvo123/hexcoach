use crate::{commands, settings::SettingsState};
use std::{
    str::FromStr,
    sync::atomic::{AtomicBool, Ordering},
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub struct ClickThroughState(pub AtomicBool);

impl Default for ClickThroughState {
    fn default() -> Self {
        Self(AtomicBool::new(false))
    }
}

pub fn validate(settings: &crate::settings::Settings) -> Result<(), String> {
    let shortcuts = [
        ("compact overlay", &settings.hotkeys.toggle_compact),
        ("click-through", &settings.hotkeys.toggle_click_through),
        ("visibility", &settings.hotkeys.toggle_visibility),
    ];
    for (label, value) in shortcuts {
        Shortcut::from_str(value)
            .map_err(|error| format!("Invalid {label} hotkey '{value}': {error}"))?;
    }
    Ok(())
}

pub fn register(app: &AppHandle) -> Result<(), String> {
    let settings = app.state::<SettingsState>().get();
    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister_all();

    shortcuts
        .on_shortcut(
            settings.hotkeys.toggle_compact.as_str(),
            |app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }
                let state = app.state::<commands::CompactState>();
                let next = !state.0.load(Ordering::Relaxed);
                state.0.store(next, Ordering::Relaxed);
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = commands::apply_compact(&handle, next).await {
                        eprintln!("HexCoach: compact hotkey failed: {error}");
                    }
                });
            },
        )
        .map_err(|error| format!("Could not register the compact hotkey: {error}"))?;

    shortcuts
        .on_shortcut(
            settings.hotkeys.toggle_visibility.as_str(),
            |app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }
                if let Some(window) = app.get_webview_window("main") {
                    let visible = window.is_visible().unwrap_or(true);
                    if visible {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    let _ = app.emit("overlay-visibility-changed", !visible);
                }
            },
        )
        .map_err(|error| format!("Could not register the visibility hotkey: {error}"))?;

    shortcuts
        .on_shortcut(
            settings.hotkeys.toggle_click_through.as_str(),
            |app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }
                let state = app.state::<ClickThroughState>();
                let next = !state.0.load(Ordering::Relaxed);
                state.0.store(next, Ordering::Relaxed);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_ignore_cursor_events(next);
                }
                let _ = app.emit("click-through-changed", next);
            },
        )
        .map_err(|error| format!("Could not register the click-through hotkey: {error}"))?;

    Ok(())
}
