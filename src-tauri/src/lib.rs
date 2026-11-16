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
use tauri::Manager;

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
            app.manage(commands::HudState::default());

            if let Err(error) = shortcuts::register(app.handle()) {
                eprintln!("HexCoach: global hotkeys unavailable: {error}");
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
            riot::fetch_riot_api,
            profile::get_player_profile,
            commands::get_performance,
            commands::get_app_info,
            commands::set_compact_mode,
            commands::set_overlay_clickthrough,
            commands::get_overlay_state,
            commands::set_hud_visible,
        ])
        .run(tauri::generate_context!())
        .expect("error while running HexCoach");
}
