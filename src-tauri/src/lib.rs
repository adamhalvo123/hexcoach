mod aram;
mod arena;
mod commands;
mod ddragon;
mod live_client;
mod lcu;
mod meta;
mod meta_builds;
mod profile;
mod recommend;
mod riot;
mod settings;
mod shortcuts;
mod util;

use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

/// Brings the main dashboard back from the tray, restoring it from a minimized
/// or hidden state and giving it keyboard focus.
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Creates the notification-area icon and its context menu. The menu is the
/// only place that fully quits the app; closing the window merely hides it.
fn init_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Otvoriť HexCoach", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Ukončiť aplikáciu", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::with_id("hexcoach-tray")
        .icon(
            app.default_window_icon()
                .expect("HexCoach bundle is missing its window icon")
                .clone(),
        )
        .tooltip("HexCoach")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            }
            | TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => show_main_window(tray.app_handle()),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub struct Clients {
    pub http: reqwest::Client,
    pub local: reqwest::Client,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let http = reqwest::Client::builder()
                .user_agent("HexCoach/0.1 (Tauri overlay)")
                .timeout(Duration::from_secs(25))
                .build()?;
            let local = reqwest::Client::builder()
                .user_agent("HexCoach/0.1 (local client)")
                .danger_accept_invalid_certs(true)
                .timeout(Duration::from_millis(2500))
                .build()?;

            app.manage(Clients { http, local });
            app.manage(settings::SettingsState::load(app.handle()));
            app.manage(ddragon::DdragonState::default());
            app.manage(live_client::LiveState::default());
            app.manage(lcu::LcuState::default());
            app.manage(meta_builds::MetaBuildsState::new(app.handle()));
            app.manage(commands::PerfState::new(app.handle()));
            app.manage(commands::CompactState::default());
            app.manage(shortcuts::ClickThroughState::default());
            app.manage(shortcuts::HotkeyRegistry::default());
            app.manage(commands::HudState::default());

            init_tray(app.handle())?;

            let status = shortcuts::register(app.handle());
            if !status.all_registered() {
                for binding in status.bindings.iter().filter(|binding| !binding.registered) {
                    eprintln!(
                        "HexCoach: {} hotkey '{}' unavailable: {}",
                        binding.label,
                        binding.accelerator,
                        binding.error.as_deref().unwrap_or("unknown error")
                    );
                }
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                ddragon::init(handle).await;
            });

            let live_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                live_client::poll_loop(live_handle).await;
            });

            let lcu_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                lcu::poll_loop(lcu_handle).await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // The X button closes to the notification area instead of exiting.
            // The tray menu and Settings still expose an explicit quit.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            ddragon::get_bootstrap,
            ddragon::get_ddragon_status,
            ddragon::refresh_ddragon,
            live_client::get_live_state,
            lcu::get_lcu_status,
            lcu::get_champ_select,
            lcu::apply_runes,
            recommend::get_recommendation,
            recommend::get_draft_recommendations,
            meta_builds::get_champion_build,
            settings::get_settings,
            settings::save_settings,
            settings::clear_riot_api_key,
            shortcuts::register_hotkeys,
            shortcuts::get_hotkey_status,
            riot::fetch_riot_api,
            profile::get_player_profile,
            commands::get_performance,
            commands::get_app_info,
            commands::set_compact_mode,
            commands::set_overlay_clickthrough,
            commands::get_overlay_state,
            commands::set_hud_visible,
            commands::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running HexCoach");
}
