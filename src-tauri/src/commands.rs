use crate::{
    ddragon::DdragonState,
    live_client::LiveState,
    settings::SettingsState,
    util::cache_size_mb,
};
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Instant,
};
use sysinfo::{Pid, ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewWindow};
use tauri::LogicalSize;

pub struct CompactState(pub AtomicBool);

impl Default for CompactState {
    fn default() -> Self {
        Self(AtomicBool::new(false))
    }
}

pub struct PerfState {
    system: Mutex<System>,
    started: Instant,
    cache_dir: PathBuf,
}

impl PerfState {
    pub fn new(app: &AppHandle) -> Self {
        Self {
            system: Mutex::new(System::new()),
            started: Instant::now(),
            cache_dir: app
                .path()
                .app_cache_dir()
                .map(|dir| dir.join("ddragon"))
                .unwrap_or_else(|_| PathBuf::from(".")),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Performance {
    pub ram_mb: f64,
    pub live_latency_ms: u64,
    pub cache_mb: f64,
    pub patch: String,
    pub uptime_sec: u64,
    pub cached_images: usize,
    pub total_images: usize,
}

#[tauri::command]
pub async fn get_performance(
    state: State<'_, PerfState>,
    live: State<'_, LiveState>,
    ddragon: State<'_, DdragonState>,
) -> Result<Performance, String> {
    let ram_mb = {
        let mut system = state
            .system
            .lock()
            .map_err(|_| "Performance monitor is unavailable".to_string())?;
        let pid = Pid::from_u32(std::process::id());
        system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
        system
            .process(pid)
            .map(|process| process.memory() as f64 / 1024.0 / 1024.0)
            .unwrap_or(0.0)
    };

    let cache_dir = state.cache_dir.clone();
    let cache_mb = tokio::task::spawn_blocking(move || cache_size_mb(&cache_dir))
        .await
        .unwrap_or(0.0);
    let status = ddragon.status().await;

    Ok(Performance {
        ram_mb: (ram_mb * 10.0).round() / 10.0,
        live_latency_ms: live.latency_ms.load(Ordering::Relaxed),
        cache_mb: (cache_mb * 10.0).round() / 10.0,
        patch: status.version.unwrap_or_else(|| "—".into()),
        uptime_sec: state.started.elapsed().as_secs(),
        cached_images: status.cached_images,
        total_images: status.total_images,
    })
}

#[tauri::command]
pub async fn set_compact_mode(
    app: AppHandle,
    state: State<'_, CompactState>,
    compact: bool,
) -> Result<(), String> {
    apply_compact(&app, compact).await?;
    state.0.store(compact, Ordering::Relaxed);
    Ok(())
}

pub async fn apply_compact(app: &AppHandle, compact: bool) -> Result<(), String> {
    let window: WebviewWindow = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is not available".to_string())?;

    if compact {
        window
            .set_size(LogicalSize::new(432.0, 590.0))
            .map_err(|e| e.to_string())?;
        window
            .set_always_on_top(true)
            .map_err(|e| e.to_string())?;
        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale = monitor.scale_factor();
            let position = monitor.position();
            let size = monitor.size();
            let width = size.width as f64 / scale;
            let x = position.x as f64 / scale + width - 432.0 - 18.0;
            let y = position.y as f64 / scale + 18.0;
            let _ = window.set_position(PhysicalPosition::new(
                (x * scale) as i32,
                (y * scale) as i32,
            ));
        }
    } else {
        window
            .set_size(LogicalSize::new(1320.0, 840.0))
            .map_err(|e| e.to_string())?;
        let _ = window.center();
        let always_on_top = app.state::<SettingsState>().get().always_on_top;
        window
            .set_always_on_top(always_on_top)
            .map_err(|e| e.to_string())?;
    }

    if let Some(state) = app.try_state::<CompactState>() {
        state.0.store(compact, Ordering::Relaxed);
    }
    let _ = app.emit("compact-mode-changed", compact);
    Ok(())
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub build_profile: String,
}

#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").into(),
        build_profile: if cfg!(debug_assertions) {
            "debug".into()
        } else {
            "release".into()
        },
    })
}
