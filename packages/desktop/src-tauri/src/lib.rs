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
