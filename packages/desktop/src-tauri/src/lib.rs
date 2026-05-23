use std::sync::{Arc, Mutex};
use tauri::{
    AppHandle, Manager, Runtime,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

mod sidecar;
use sidecar::SidecarManager;

// Shared state accessible from commands
pub struct AppState {
    pub sidecar: Arc<Mutex<SidecarManager>>,
    pub rpc_counter: Arc<Mutex<u64>>,
    pub daemon_token: Arc<Mutex<Option<String>>>,
}

// ─── IPC Commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn send_message(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    message: String,
    session_id: Option<String>,
    working_directory: String,
) -> Result<serde_json::Value, String> {
    let id = {
        let mut counter = state.rpc_counter.lock().unwrap();
        *counter += 1;
        *counter
    };

    let params = serde_json::json!({
        "message": message,
        "sessionId": session_id,
        "workingDirectory": working_directory,
    });

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "agent.run",
        "params": params,
    });

    let sidecar = state.sidecar.lock().unwrap();
    sidecar
        .send_request(request)
        .map_err(|e| format!("Failed to send message: {}", e))?;

    app.emit("agent.running", serde_json::json!({ "id": id })).ok();
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
async fn cancel_agent(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let id = {
        let mut counter = state.rpc_counter.lock().unwrap();
        *counter += 1;
        *counter
    };
    let request = serde_json::json!({
        "jsonrpc": "2.0", "id": id,
        "method": "agent.cancel",
        "params": { "sessionId": session_id },
    });
    let sidecar = state.sidecar.lock().unwrap();
    sidecar.send_request(request).map_err(|e| format!("Failed to cancel agent: {}", e))
}

#[tauri::command]
async fn get_config(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let id = { let mut c = state.rpc_counter.lock().unwrap(); *c += 1; *c };
    let request = serde_json::json!({ "jsonrpc": "2.0", "id": id, "method": "config.get", "params": null });
    let sidecar = state.sidecar.lock().unwrap();
    sidecar.send_request(request).map_err(|e| format!("Failed to get config: {}", e))?;
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
async fn set_config(
    state: tauri::State<'_, AppState>,
    provider: Option<serde_json::Value>,
    agent: Option<serde_json::Value>,
) -> Result<(), String> {
    let id = { let mut c = state.rpc_counter.lock().unwrap(); *c += 1; *c };
    let request = serde_json::json!({
        "jsonrpc": "2.0", "id": id, "method": "config.set",
        "params": { "provider": provider, "agent": agent },
    });
    let sidecar = state.sidecar.lock().unwrap();
    sidecar.send_request(request).map_err(|e| format!("Failed to set config: {}", e))
}

#[tauri::command]
async fn test_provider(
    state: tauri::State<'_, AppState>,
    base_url: String,
    api_key: String,
    model: String,
) -> Result<serde_json::Value, String> {
    let id = { let mut c = state.rpc_counter.lock().unwrap(); *c += 1; *c };
    let request = serde_json::json!({
        "jsonrpc": "2.0", "id": id, "method": "config.testProvider",
        "params": { "baseUrl": base_url, "apiKey": api_key, "model": model },
    });
    let sidecar = state.sidecar.lock().unwrap();
    sidecar.send_request(request).map_err(|e| format!("Failed to test provider: {}", e))?;
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
async fn respond_approval(
    state: tauri::State<'_, AppState>,
    id: String,
    approved: bool,
    remember: Option<bool>,
) -> Result<(), String> {
    let rpc_id = { let mut c = state.rpc_counter.lock().unwrap(); *c += 1; *c };
    let request = serde_json::json!({
        "jsonrpc": "2.0", "id": rpc_id, "method": "approval.respond",
        "params": { "id": id, "approved": approved, "remember": remember },
    });
    let sidecar = state.sidecar.lock().unwrap();
    sidecar.send_request(request).map_err(|e| format!("Failed to respond to approval: {}", e))
}

/// Returns the daemon connection info as JSON for QR code display.
/// The mobile app scans this QR code to connect.
#[tauri::command]
async fn get_remote_pairing_info(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let token = state.daemon_token.lock().unwrap().clone();
    Ok(serde_json::json!({
        "relayUrl": "ws://localhost:7433",
        "token": token,
        "version": "0.1.0",
    }))
}

/// Start the background daemon (WebSocket server) so agents keep running
/// even when the Tauri window is closed.
#[tauri::command]
async fn start_daemon(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let id = { let mut c = state.rpc_counter.lock().unwrap(); *c += 1; *c };
    let request = serde_json::json!({
        "jsonrpc": "2.0", "id": id, "method": "daemon.start", "params": {},
    });
    let sidecar = state.sidecar.lock().unwrap();
    sidecar.send_request(request).map_err(|e| format!("Failed to start daemon: {}", e))?;
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
async fn get_daemon_status(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let id = { let mut c = state.rpc_counter.lock().unwrap(); *c += 1; *c };
    let request = serde_json::json!({
        "jsonrpc": "2.0", "id": id, "method": "daemon.status", "params": {},
    });
    let sidecar = state.sidecar.lock().unwrap();
    sidecar.send_request(request).map_err(|e| format!("Failed to get daemon status: {}", e))?;
    Ok(serde_json::json!({ "id": id }))
}

// ─── System Tray ─────────────────────────────────────────────────────────────

fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show AiDE", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide AiDE", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit AiDE", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &hide_item, &separator, &quit_item])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("AiDE — running in background")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    window.show().ok();
                    window.set_focus().ok();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide().ok();
                }
            }
            "quit" => {
                // Quit kills the sidecar too
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        window.hide().ok();
                    } else {
                        window.show().ok();
                        window.set_focus().ok();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let sidecar_manager = SidecarManager::new();
            let sidecar_arc = Arc::new(Mutex::new(sidecar_manager));

            {
                let sidecar_clone = Arc::clone(&sidecar_arc);
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    let mut mgr = sidecar_clone.lock().unwrap();
                    if let Err(e) = mgr.start(&app_handle) {
                        log::error!("Failed to start sidecar: {}", e);
                    }
                });
            }

            // Generate a random daemon auth token
            let token = uuid::Uuid::new_v4().to_string();

            app.manage(AppState {
                sidecar: sidecar_arc,
                rpc_counter: Arc::new(Mutex::new(0)),
                daemon_token: Arc::new(Mutex::new(Some(token))),
            });

            setup_tray(app)?;

            // Intercept window close → hide to tray instead of quitting
            // The daemon (Node.js sidecar) keeps running in the background.
            let window = app.get_webview_window("main").unwrap();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    // Hide the window; the sidecar keeps running
                    if let Some(win) = app.get_webview_window("main") {
                        win.hide().ok();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_message,
            cancel_agent,
            get_config,
            set_config,
            test_provider,
            respond_approval,
            get_remote_pairing_info,
            start_daemon,
            get_daemon_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


// ─── IPC Commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn send_message(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    message: String,
    session_id: Option<String>,
    working_directory: String,
) -> Result<serde_json::Value, String> {
    let id = {
        let mut counter = state.rpc_counter.lock().unwrap();
        *counter += 1;
        *counter
    };

    let params = serde_json::json!({
        "message": message,
        "sessionId": session_id,
        "workingDirectory": working_directory,
    });

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "agent.run",
        "params": params,
    });

    let sidecar = state.sidecar.lock().unwrap();
    sidecar
        .send_request(request)
        .map_err(|e| format!("Failed to send message: {}", e))?;

    // Emit a local event so the frontend knows the request was dispatched
    app.emit("agent.running", serde_json::json!({ "id": id }))
        .ok();

    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
async fn cancel_agent(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let id = {
        let mut counter = state.rpc_counter.lock().unwrap();
        *counter += 1;
        *counter
    };

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "agent.cancel",
        "params": { "sessionId": session_id },
    });

    let sidecar = state.sidecar.lock().unwrap();
    sidecar
        .send_request(request)
        .map_err(|e| format!("Failed to cancel agent: {}", e))
}

#[tauri::command]
async fn get_config(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let id = {
        let mut counter = state.rpc_counter.lock().unwrap();
        *counter += 1;
        *counter
    };

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "config.get",
        "params": null,
    });

    let sidecar = state.sidecar.lock().unwrap();
    sidecar
        .send_request(request)
        .map_err(|e| format!("Failed to get config: {}", e))?;

    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
async fn set_config(
    state: tauri::State<'_, AppState>,
    provider: Option<serde_json::Value>,
    agent: Option<serde_json::Value>,
) -> Result<(), String> {
    let id = {
        let mut counter = state.rpc_counter.lock().unwrap();
        *counter += 1;
        *counter
    };

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "config.set",
        "params": { "provider": provider, "agent": agent },
    });

    let sidecar = state.sidecar.lock().unwrap();
    sidecar
        .send_request(request)
        .map_err(|e| format!("Failed to set config: {}", e))
}

#[tauri::command]
async fn test_provider(
    state: tauri::State<'_, AppState>,
    base_url: String,
    api_key: String,
    model: String,
) -> Result<serde_json::Value, String> {
    let id = {
        let mut counter = state.rpc_counter.lock().unwrap();
        *counter += 1;
        *counter
    };

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "config.testProvider",
        "params": { "baseUrl": base_url, "apiKey": api_key, "model": model },
    });

    let sidecar = state.sidecar.lock().unwrap();
    sidecar
        .send_request(request)
        .map_err(|e| format!("Failed to test provider: {}", e))?;

    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
async fn respond_approval(
    state: tauri::State<'_, AppState>,
    id: String,
    approved: bool,
    remember: Option<bool>,
) -> Result<(), String> {
    let rpc_id = {
        let mut counter = state.rpc_counter.lock().unwrap();
        *counter += 1;
        *counter
    };

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": rpc_id,
        "method": "approval.respond",
        "params": { "id": id, "approved": approved, "remember": remember },
    });

    let sidecar = state.sidecar.lock().unwrap();
    sidecar
        .send_request(request)
        .map_err(|e| format!("Failed to respond to approval: {}", e))
}

// ─── System Tray ─────────────────────────────────────────────────────────────

fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show AiDE", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide AiDE", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("AiDE")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    window.show().ok();
                    window.set_focus().ok();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide().ok();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        window.hide().ok();
                    } else {
                        window.show().ok();
                        window.set_focus().ok();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Spawn the Node.js sidecar
            let sidecar_manager = SidecarManager::new();
            let sidecar_arc = Arc::new(Mutex::new(sidecar_manager));

            // Start the sidecar and forward events to the frontend
            {
                let sidecar_clone = Arc::clone(&sidecar_arc);
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    let mut mgr = sidecar_clone.lock().unwrap();
                    if let Err(e) = mgr.start(&app_handle) {
                        log::error!("Failed to start sidecar: {}", e);
                    }
                });
            }

            app.manage(AppState {
                sidecar: sidecar_arc,
                rpc_counter: Arc::new(Mutex::new(0)),
            });

            setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_message,
            cancel_agent,
            get_config,
            set_config,
            test_provider,
            respond_approval,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
