use crate::agent::agent_loop::{run_agent_loop, AgentContext};
use crate::agent::providers::ProviderConfig;
use crate::commands::settings::AppSettings;
use std::path::PathBuf;
use tauri::Manager;

fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json")
}

fn load_settings_from_file(app: &tauri::AppHandle) -> AppSettings {
    let path = settings_path(app);
    if path.exists() {
        let content = std::fs::read_to_string(&path).ok();
        content.and_then(|c| serde_json::from_str(&c).ok()).unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

#[tauri::command]
pub async fn ai_chat(message: String, app: tauri::AppHandle) -> Result<(), String> {
    let settings = load_settings_from_file(&app);

    let config = ProviderConfig {
        provider: crate::agent::providers::Provider::from_str(&settings.ai_provider),
        api_key: settings.api_key,
        base_url: settings.base_url,
        model: settings.model,
    };

    let context = AgentContext {
        working_directory: std::env::current_dir()
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
    };

    let app_handle = app.clone();
    tokio::spawn(async move {
        let _ = run_agent_loop(config, message, context, app_handle).await;
    });

    Ok(())
}
