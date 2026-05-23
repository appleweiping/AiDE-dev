use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

/// Manages the lifecycle of the Node.js aide-core sidecar process.
/// Communication is JSON-RPC over stdio:
///   - Requests go to sidecar stdin (one JSON object per line)
///   - Events come from sidecar stdout (one JSON object per line)
pub struct SidecarManager {
    child: Option<Child>,
    stdin: Option<Arc<Mutex<ChildStdin>>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        SidecarManager {
            child: None,
            stdin: None,
        }
    }

    /// Spawn the sidecar and begin reading its stdout.
    /// Events emitted by the sidecar are forwarded to the Tauri frontend.
    pub fn start(&mut self, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        // Resolve the sidecar binary path via Tauri's resource resolver.
        // The binary is registered as an externalBin in tauri.conf.json.
        let sidecar_path = app_handle
            .path()
            .resource_dir()
            .map(|p| p.join("binaries").join(sidecar_binary_name()))
            .unwrap_or_else(|_| std::path::PathBuf::from(sidecar_binary_name()));

        log::info!("Spawning sidecar at: {:?}", sidecar_path);

        let mut child = Command::new(&sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar {:?}: {}", sidecar_path, e))?;

        let stdin = child.stdin.take().expect("Failed to open sidecar stdin");
        let stdout = child.stdout.take().expect("Failed to open sidecar stdout");
        let stderr = child.stderr.take().expect("Failed to open sidecar stderr");

        self.stdin = Some(Arc::new(Mutex::new(stdin)));
        self.child = Some(child);

        // Spawn a thread to read stdout and forward events to the frontend
        let app_stdout = app_handle.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(text) if !text.trim().is_empty() => {
                        log::debug!("Sidecar stdout: {}", text);
                        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                            forward_event(&app_stdout, &value);
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        log::error!("Error reading sidecar stdout: {}", e);
                        break;
                    }
                }
            }
            log::info!("Sidecar stdout reader exited");
            // Notify frontend that the sidecar has stopped
            app_stdout.emit("sidecar.stopped", ()).ok();
        });

        // Spawn a thread to log stderr
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(text) => log::warn!("Sidecar stderr: {}", text),
                    Err(_) => break,
                }
            }
        });

        log::info!("Sidecar started successfully");
        Ok(())
    }

    /// Send a JSON-RPC request to the sidecar via stdin.
    pub fn send_request(&self, request: serde_json::Value) -> Result<(), String> {
        let stdin_arc = self
            .stdin
            .as_ref()
            .ok_or_else(|| "Sidecar not running".to_string())?;

        let mut stdin = stdin_arc.lock().unwrap();
        let mut line = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;
        line.push('\n');

        stdin
            .write_all(line.as_bytes())
            .map_err(|e| format!("Failed to write to sidecar stdin: {}", e))?;

        stdin
            .flush()
            .map_err(|e| format!("Failed to flush sidecar stdin: {}", e))?;

        Ok(())
    }

    /// Kill the sidecar process.
    pub fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            log::info!("Stopping sidecar process");
            child.kill().ok();
            child.wait().ok();
        }
        self.stdin = None;
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Forward a JSON-RPC event from the sidecar to the Tauri frontend.
/// The event's "method" field becomes the Tauri event name.
fn forward_event(app: &AppHandle, value: &serde_json::Value) {
    // JSON-RPC notifications have a "method" field but no "id"
    if value.get("id").is_none() {
        if let Some(method) = value.get("method").and_then(|m| m.as_str()) {
            let params = value.get("params").cloned().unwrap_or(serde_json::Value::Null);
            if let Err(e) = app.emit(method, params) {
                log::error!("Failed to emit event '{}': {}", method, e);
            }
            return;
        }
    }

    // JSON-RPC responses (have "id") — emit as "rpc.response"
    if value.get("id").is_some() {
        app.emit("rpc.response", value.clone()).ok();
    }
}

/// Returns the platform-appropriate sidecar binary name.
fn sidecar_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "aide-core.exe"
    } else {
        "aide-core"
    }
}
