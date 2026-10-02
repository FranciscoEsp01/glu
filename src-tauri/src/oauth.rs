use std::{io::{Read, Write}, net::{TcpListener, TcpStream}, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, time::{Duration, Instant}};
use tauri::State;

#[derive(Default)]
pub struct OAuthState(Mutex<Option<Arc<AtomicBool>>>);
const CALLBACK: &str = "http://127.0.0.1:42813/auth/callback";

fn validate(url: &str, state: &str) -> Result<reqwest::Url, String> {
    if state.len() != 36 || !state.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-') { return Err("Intento de acceso inválido".into()); }
    let parsed = reqwest::Url::parse(url).map_err(|_| "Enlace de acceso inválido")?;
    let query: Vec<_> = parsed.query_pairs().collect();
    let mut redirect = reqwest::Url::parse(CALLBACK).unwrap();
    redirect.query_pairs_mut().append_pair("glu_oauth_state", state);
    if parsed.scheme() != "https" || !parsed.host_str().is_some_and(|h| h.ends_with(".supabase.co")) ||
        !parsed.username().is_empty() || parsed.password().is_some() || parsed.port().is_some() ||
        parsed.path() != "/auth/v1/authorize" || parsed.fragment().is_some() ||
        query.iter().filter(|(k, _)| k == "provider").count() != 1 ||
        !query.iter().any(|(k,v)| k == "provider" && v == "google") ||
        query.iter().filter(|(k, _)| k == "redirect_to").count() != 1 ||
        !query.iter().any(|(k,v)| k == "redirect_to" && v == redirect.as_str()) ||
        !query.iter().any(|(k,v)| k == "code_challenge_method" && v == "s256") {
        return Err("Enlace de acceso no permitido".into());
    }
    Ok(parsed)
}
fn callback_target(request: &str, state: &str) -> Option<String> {
    let mut parts = request.lines().next()?.split_whitespace();
    if parts.next()? != "GET" { return None; }
    let target = parts.next()?;
    if !target.starts_with("/auth/callback?") { return None; }
    let parsed = reqwest::Url::parse(&format!("http://127.0.0.1:42813{target}")).ok()?;
    let query: Vec<_> = parsed.query_pairs().collect();
    if parsed.path() != "/auth/callback" ||
        query.iter().filter(|(k,_)| k == "glu_oauth_state").count() != 1 ||
        !query.iter().any(|(k,v)| k == "glu_oauth_state" && v == state) ||
        !(query.iter().filter(|(k,v)| k == "code" && !v.is_empty()).count() == 1 || query.iter().any(|(k,_)| k == "error")) {
        return None;
    }
    Some(parsed.to_string())
}
fn reply(stream: &mut TcpStream, ok: bool) {
    let body = if ok { "<!doctype html><meta charset=utf-8><title>Glu</title><h1>Vuelve a Glu</h1><p>La app verificará el resultado del acceso. Puedes cerrar esta pestaña.</p>" } else { "Solicitud no válida." };
    let status = if ok { "200 OK" } else { "400 Bad Request" };
    let _ = write!(stream, "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; frame-ancestors 'none'\r\nConnection: close\r\n\r\n{body}", body.len());
}
fn run(url: reqwest::Url, state: String, cancel: Arc<AtomicBool>) -> Result<String, String> {
    // Bind before opening the browser: the callback is always available for this attempt.
    let listener = TcpListener::bind("127.0.0.1:42813").map_err(|_| "No se pudo iniciar el acceso local. Cierra otros intentos de Glu y reintenta.")?;
    listener.set_nonblocking(true).map_err(|_| "No se pudo preparar el acceso local")?;
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url.as_str()).spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32.exe").arg("url.dll,FileProtocolHandler").arg(url.as_str()).spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let result = std::process::Command::new("xdg-open").arg(url.as_str()).spawn();
    result.map_err(|_| "No se pudo abrir el navegador")?;
    let deadline = Instant::now() + Duration::from_secs(180);
    while Instant::now() < deadline {
        if cancel.load(Ordering::Relaxed) { return Err("Acceso con Google cancelado.".into()); }
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
                let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
                let mut data = Vec::new();
                let read_deadline = Instant::now() + Duration::from_secs(2);
                let mut buf = [0; 1024];
                while data.len() < 8192 && Instant::now() < read_deadline && !cancel.load(Ordering::Relaxed) {
                    match stream.read(&mut buf) { Ok(0) | Err(_) => break, Ok(n) => data.extend_from_slice(&buf[..n]) }
                    if data.windows(4).any(|w| w == b"\r\n\r\n") { break; }
                }
                let target = if data.len() < 8192 { std::str::from_utf8(&data).ok().and_then(|r| callback_target(r, &state)) } else { None };
                reply(&mut stream, target.is_some());
                if let Some(target) = target { return Ok(target); }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(50)),
            Err(_) => return Err("No se pudo recibir la respuesta de Google.".into()),
        }
    }
    Err("El acceso con Google venció. Vuelve a intentarlo.".into())
}
#[tauri::command]
pub async fn auth_oauth_sign_in(url: String, state: String, pending: State<'_, OAuthState>) -> Result<String, String> {
    let url = validate(&url, &state)?;
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut slot = pending.0.lock().map_err(|_| "No se pudo iniciar el acceso")?;
        if slot.is_some() { return Err("Ya hay un acceso con Google en curso.".into()); }
        *slot = Some(cancel.clone());
    }
    let result = tauri::async_runtime::spawn_blocking(move || run(url, state, cancel)).await;
    if let Ok(mut slot) = pending.0.lock() { *slot = None; }
    result.map_err(|_| "No se pudo completar el acceso con Google".to_string())?
}
#[tauri::command]
pub fn auth_oauth_cancel(pending: State<'_, OAuthState>) {
    if let Ok(slot) = pending.0.lock() {
        if let Some(cancel) = slot.as_ref() { cancel.store(true, Ordering::Relaxed); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const STATE: &str = "11111111-1111-4111-8111-111111111111";
    #[test]
    fn rejects_unrelated_callbacks() {
        let good = format!("GET /auth/callback?glu_oauth_state={STATE}&code=one-time-code HTTP/1.1\r\n\r\n");
        assert!(callback_target(&good, STATE).is_some());
        assert!(callback_target(&good.replace("one-time-code", ""), STATE).is_none());
        assert!(callback_target(&good.replace(STATE, "different"), STATE).is_none());
        assert!(callback_target(&good.replace("GET", "POST"), STATE).is_none());
        assert!(callback_target(&good.replace("/auth/callback", "/other"), STATE).is_none());
    }
    #[test]
    fn restricts_browser_destination() {
        let mut url = reqwest::Url::parse("https://project.supabase.co/auth/v1/authorize").unwrap();
        url.query_pairs_mut().append_pair("provider", "google").append_pair("redirect_to", &format!("{CALLBACK}?glu_oauth_state={STATE}")).append_pair("code_challenge_method", "s256");
        assert!(validate(url.as_str(), STATE).is_ok());
        assert!(validate(&url.as_str().replace("project.supabase.co", "attacker.example"), STATE).is_err());
        assert!(validate(&url.as_str().replace("provider=google", "provider=github"), STATE).is_err());
        assert!(validate(&url.as_str().replace("42813", "3000"), STATE).is_err());
    }
}
