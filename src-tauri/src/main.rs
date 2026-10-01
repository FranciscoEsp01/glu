#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{io::{BufRead, BufReader, Write}, path::PathBuf, process::{Child, Command, Stdio}, sync::Mutex, time::Duration};
use tauri::{Manager, State, Emitter};
use serde_json::{Value, json};
struct AppState { root: PathBuf, child: Mutex<Option<Child>>, http: reqwest::Client }
fn account_root(state: &AppState, account: &str) -> Result<PathBuf, String> {
    if account.is_empty() || account.len() > 100 || !account.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') {
        return Err("Cuenta inválida".into());
    }
    let root = state.root.join("accounts").join(account);
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}
#[tauri::command]
fn auth_session_get() -> Result<Option<String>, String> {
    let key = keyring::Entry::new("com.glu.meetingai", "auth-session").map_err(|e| e.to_string())?;
    match key.get_password() { Ok(v) => Ok(Some(v)), Err(keyring::Error::NoEntry) => Ok(None), Err(e) => Err(e.to_string()) }
}
#[tauri::command]
fn auth_session_set(value: Option<String>) -> Result<(), String> {
    let key = keyring::Entry::new("com.glu.meetingai", "auth-session").map_err(|e| e.to_string())?;
    match value {
        Some(value) => key.set_password(&value).map_err(|e| e.to_string()),
        None => match key.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(e.to_string()) }
    }
}
fn audio_dir(state: &AppState, account: &str, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || id.len() > 100 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') { return Err("Identificador inválido".into()); }
    Ok(account_root(state, account)?.join("recordings").join(id))
}
fn db(state: &AppState, account: &str) -> Result<rusqlite::Connection, String> {
    let conn = rusqlite::Connection::open(account_root(state, account)?.join("glu.sqlite")).map_err(|e| e.to_string())?;
    conn.busy_timeout(Duration::from_secs(5)).map_err(|e| e.to_string())?;
    conn.execute("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)", []).map_err(|e| e.to_string())?;
    Ok(conn)
}
#[tauri::command]
fn load_meetings(state: State<AppState>, account: String) -> Result<Option<String>, String> {
    use rusqlite::OptionalExtension;
    db(&state, &account)?.query_row("SELECT data FROM state WHERE id=1", [], |r| r.get(0)).optional().map_err(|e| e.to_string())
}
#[tauri::command]
fn save_meetings(state: State<AppState>, account: String, data: String) -> Result<(), String> {
    let parsed: Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    if !parsed.is_array() { return Err("Historial inválido".into()); }
    db(&state, &account)?.execute("INSERT INTO state(id,data) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data", [data]).map_err(|e| e.to_string())?;
    Ok(())
}
fn entry(account: &str, name: &str) -> Result<keyring::Entry, String> {
    if !["gemini", "deepgram", "slack", "notion"].contains(&name) { return Err("Proveedor inválido".into()); }
    keyring::Entry::new("com.glu.meetingai", &format!("{account}:{name}")).map_err(|e| e.to_string())
}
#[tauri::command]
fn secret_get(account: String, name: String) -> Result<String, String> { match entry(&account, &name)?.get_password() { Ok(v) => Ok(v), Err(keyring::Error::NoEntry) => Ok(String::new()), Err(e) => Err(e.to_string()) } }
#[tauri::command]
fn secret_set(account: String, name: String, value: String) -> Result<(), String> {
    let key = entry(&account, &name)?;
    if value.is_empty() { match key.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(e.to_string()) } }
    else { key.set_password(value.trim()).map_err(|e| e.to_string()) }
}
fn helper(state: &AppState) -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")] {
        let path = state.root.join("glu-capture");
        let binary = include_bytes!(concat!(env!("OUT_DIR"), "/glu-capture"));
        if std::fs::read(&path).ok().as_deref() != Some(binary.as_slice()) { std::fs::write(&path, binary).map_err(|e| e.to_string())?; }
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;
        Ok(path)
    }
    #[cfg(not(target_os = "macos"))] { let _ = state; Err("Captura nativa disponible en macOS 15+. Usa la versión web para grabar en este sistema.".into()) }
}
#[tauri::command]
async fn start_audio_capture(state: State<'_, AppState>, account: String, id: String, dual: bool) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    if guard.is_some() { return Err("Ya hay una grabación activa".into()); }
    let directory = audio_dir(&state, &account, &id)?;
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let mut command = Command::new(helper(&state)?); command.arg(&directory);
    if dual { command.arg("--dual"); }
    let log = std::fs::File::create(directory.join("capture.log")).map_err(|e| e.to_string())?;
    let mut child = command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(log).spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("No se pudo iniciar la captura")?;
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || { let mut line = String::new(); let _ = BufReader::new(stdout).read_line(&mut line); let _ = sender.send(line); });
    if receiver.recv_timeout(Duration::from_secs(90)).unwrap_or_default().trim() != "READY" {
        let _ = child.kill(); let _ = child.wait();
        let details = std::fs::read_to_string(directory.join("capture.log")).unwrap_or_default();
        return Err(format!("No se pudo iniciar captura. Revisa permisos de micrófono y grabación de pantalla en Ajustes del Sistema. {details}"));
    }
    *guard = Some(child); Ok(())
}
#[tauri::command]
fn pause_audio_capture(state: State<AppState>, paused: bool) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    let child = guard.as_mut().ok_or("No hay grabación activa")?;
    writeln!(child.stdin.as_mut().ok_or("Grabador desconectado")?, "{}", if paused { "pause" } else { "resume" }).map_err(|e| e.to_string())
}
#[tauri::command]
async fn stop_audio_capture(state: State<'_, AppState>) -> Result<(), String> {
    let mut child = state.child.lock().map_err(|e| e.to_string())?.take().ok_or("No hay grabación activa")?;
    if let Some(mut stdin) = child.stdin.take() { let _ = writeln!(stdin, "stop"); }
    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() { return Err("La captura se interrumpió. Conservamos los fragmentos locales para recuperación.".into()); }
    Ok(())
}
fn audio_path(state: &AppState, account: &str, id: &str) -> Result<PathBuf, String> {
    let directory = audio_dir(state, account, id)?;
    if directory.join("audio.bin").exists() { return Ok(directory.join("audio.bin")); }
    let path = directory.join("audio.wav");
    if !path.exists() && directory.exists() {
        let status = Command::new(helper(state)?).arg(&directory).arg("--recover").status().map_err(|e| e.to_string())?;
        if !status.success() { return Err("No se pudo recuperar el audio. Conservamos los archivos originales.".into()); }
    }
    Ok(path)
}
#[tauri::command]
fn write_audio(state: State<AppState>, account: String, id: String, bytes: Vec<u8>, mime: String) -> Result<(), String> {
    let dir = audio_dir(&state, &account, &id)?; std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("audio.tmp"), bytes).map_err(|e| e.to_string())?;
    std::fs::rename(dir.join("audio.tmp"), dir.join("audio.bin")).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("mime"), mime).map_err(|e| e.to_string())
}
#[tauri::command]
async fn playback_path(state: State<'_, AppState>, account: String, id: String) -> Result<Option<String>, String> {
    let path = audio_path(&state, &account, &id)?;
    Ok(if path.exists() { Some(path.to_string_lossy().into_owned()) } else { None })
}
#[tauri::command]
async fn read_audio(state: State<'_, AppState>, account: String, id: String) -> Result<Option<Value>, String> {
    let path = audio_path(&state, &account, &id)?;
    if !path.exists() { return Ok(None); }
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let mime = std::fs::read_to_string(audio_dir(&state, &account, &id)?.join("mime")).unwrap_or("audio/wav".into());
    Ok(Some(json!({ "bytes": bytes, "mime": mime })))
}
#[tauri::command]
fn delete_audio(state: State<AppState>, account: String, id: String) -> Result<(), String> {
    let dir = audio_dir(&state, &account, &id)?; if dir.exists() { std::fs::remove_dir_all(dir).map_err(|e| e.to_string())?; } Ok(())
}
async fn response(response: reqwest::Response) -> Result<Value, String> {
    if !response.status().is_success() { return Err(format!("El proveedor respondió con error {}. Revisa la clave, el modelo y el saldo.", response.status().as_u16())); }
    response.json().await.map_err(|e| e.to_string())
}
#[tauri::command]
async fn transcribe(state: State<'_, AppState>, account: String, id: String, language: String) -> Result<Value, String> {
    if !["es", "en"].contains(&language.as_str()) { return Err("Idioma inválido".into()); }
    let file = tokio::fs::File::open(audio_path(&state, &account, &id)?).await.map_err(|e| e.to_string())?;
    let length = file.metadata().await.map_err(|e| e.to_string())?.len();
    let body = reqwest::Body::wrap_stream(tokio_util::io::ReaderStream::new(file));
    let request = state.http.post("https://api.deepgram.com/v1/listen")
        .query(&[("model", "nova-3"), ("language", &language), ("smart_format", "true"), ("diarize", "true"), ("utterances", "true")])
        .header("Authorization", format!("Token {}", secret_get(account, "deepgram".into())?)).header("Content-Type", "application/octet-stream").header("Content-Length", length).body(body).send().await.map_err(|_| "No se pudo conectar a Deepgram. Revisa tu conexión.")?;
    response(request).await
}
#[tauri::command]
async fn summarize(state: State<'_, AppState>, account: String, model: String, body: Value) -> Result<Value, String> {
    if !model.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.') || model.is_empty() { return Err("Modelo inválido".into()); }
    let request = state.http.post(format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"))
        .header("x-goog-api-key", secret_get(account, "gemini".into())?).json(&body).send().await.map_err(|_| "No se pudo conectar a Gemini. Revisa tu conexión.")?;
    response(request).await
}
#[tauri::command]
async fn send_integration(state: State<'_, AppState>, account: String, provider: String, body: Value) -> Result<Value, String> {
    let url = match provider.as_str() { "slack" => "https://slack.com/api/chat.postMessage", "notion" => "https://api.notion.com/v1/pages", _ => return Err("Integración no admitida".into()) };
    if body.to_string().len() > 450_000 { return Err("El contenido es demasiado grande para enviarlo.".into()); }
    let token = secret_get(account, provider.clone())?;
    if token.is_empty() { return Err(format!("Configura la conexión de {provider} antes de enviar.")); }
    let mut request = state.http.post(url).bearer_auth(token).json(&body).timeout(Duration::from_secs(45));
    if provider == "notion" { request = request.header("Notion-Version", "2025-09-03"); }
    // Never retry writes automatically: an uncertain response may already have created a message/page.
    let response = request.send().await.map_err(|_| "No se pudo confirmar el envío. Revisa el destino antes de repetirlo para evitar duplicados.")?;
    let status = response.status();
    let data: Value = response.json().await.map_err(|_| "Respuesta no reconocida. Revisa el destino antes de repetir el envío.")?;
    if !status.is_success() {
        return Err(format!("{} respondió con error {}. Revisa credenciales y acceso al destino. Si hubo un error 5xx, comprueba si el contenido llegó antes de reenviar.", provider, status.as_u16()));
    }
    if provider == "slack" {
        if data.get("ok").and_then(Value::as_bool) != Some(true) {
            let code = data.get("error").and_then(Value::as_str).unwrap_or("unknown_error");
            return Err(format!("Slack no aceptó el envío ({code}). Comprueba chat:write y que el bot esté en el canal."));
        }
        let reference = data.get("ts").and_then(Value::as_str).ok_or("Slack no devolvió una confirmación. Comprueba el canal antes de repetir.")?;
        Ok(json!({"reference": reference}))
    } else {
        let reference = data.get("id").and_then(Value::as_str).ok_or("Notion no devolvió una página. Revisa el destino antes de repetir.")?;
        Ok(json!({"reference": reference}))
    }
}
#[tauri::command]
fn set_compact(window: tauri::WebviewWindow, compact: bool) -> Result<(), String> {
    window.set_min_size(Some(tauri::LogicalSize::new(if compact { 600. } else { 860. }, if compact { 240. } else { 540. }))).map_err(|e| e.to_string())?;
    window.set_size(tauri::LogicalSize::new(if compact { 640. } else { 1180. }, if compact { 300. } else { 780. })).map_err(|e| e.to_string())?;
    window.set_always_on_top(compact).map_err(|e| e.to_string())
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(|app, shortcut, event| {
            use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
            if event.state() == ShortcutState::Pressed {
                let action = if shortcut.matches(Modifiers::SUPER | Modifiers::SHIFT, Code::KeyR) { "record" } else if shortcut.matches(Modifiers::SUPER | Modifiers::SHIFT, Code::KeyN) { "notes" } else { "pause" };
                let _ = app.emit("glu-shortcut", action);
            }
        }).build())
        .setup(|app| {
            let root = app.path().app_data_dir()?; std::fs::create_dir_all(&root)?;
            app.manage(AppState { root, child: Mutex::new(None), http: reqwest::Client::builder().timeout(Duration::from_secs(180)).build()? });
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            for shortcut in ["Super+Shift+R", "Super+Shift+N", "Super+Shift+M"] { if let Err(e) = app.global_shortcut().register(shortcut) { eprintln!("No se pudo registrar atajo: {e}"); } }
            Ok(())
        })
        .on_window_event(|window, event| { if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if window.state::<AppState>().child.lock().map(|c| c.is_some()).unwrap_or(false) { api.prevent_close(); let _ = window.emit("glu-close-blocked", ()); }
        } })
        .invoke_handler(tauri::generate_handler![auth_session_get, auth_session_set, load_meetings, save_meetings, secret_get, secret_set, start_audio_capture, stop_audio_capture, pause_audio_capture, read_audio, playback_path, write_audio, delete_audio, transcribe, summarize, set_compact, send_integration])
        .run(tauri::generate_context!()).expect("No se pudo iniciar Glu");
}
