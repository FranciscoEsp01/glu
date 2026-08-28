// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod db;

use std::sync::Mutex;
use tauri::{Manager, State};

struct AppState {
    audio_recorder: Mutex<audio::AudioRecorder>,
}

#[tauri::command]
fn start_audio_capture(state: State<AppState>, file_path: String) -> Result<String, String> {
    let mut recorder = state.audio_recorder.lock().map_err(|e| e.to_string())?;
    recorder
        .start_recording(&file_path)
        .map_err(|e| e.to_string())?;
    Ok("Grabación iniciada correctamente".into())
}

#[tauri::command]
fn stop_audio_capture(state: State<AppState>) -> Result<String, String> {
    let mut recorder = state.audio_recorder.lock().map_err(|e| e.to_string())?;
    recorder.stop_recording().map_err(|e| e.to_string())?;
    Ok("Grabación finalizada correctamente".into())
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            audio_recorder: Mutex::new(audio::AudioRecorder::new()),
        })
        .invoke_handler(tauri::generate_handler![
            start_audio_capture,
            stop_audio_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
