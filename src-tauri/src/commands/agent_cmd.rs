use crate::agent::agent_loop::{run_agent_loop, AgentContext};
use crate::agent::providers::ProviderConfig;
use crate::commands::settings::AppSettings;
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
pub async fn ai_chat(
    message: String,
    left_content: Option<String>,
    right_content: Option<String>,
    left_path: Option<String>,
    right_path: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let path = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json");
    let settings: AppSettings = if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    } else {
        AppSettings::default()
    };

    let config = ProviderConfig {
        provider: crate::agent::providers::Provider::from_str(&settings.ai_provider),
        api_key: settings.api_key,
        base_url: settings.base_url,
        model: settings.model,
    };

    let mut context = AgentContext {
        working_directory: std::env::current_dir()
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
        left_content: None,
        right_content: None,
        left_path: None,
        right_path: None,
    };

    if left_content.is_some() && right_content.is_some() {
        context.left_content = left_content;
        context.right_content = right_content;
        context.left_path = left_path;
        context.right_path = right_path;
    }

    let app_handle = app.clone();
    tokio::spawn(async move {
        let _ = run_agent_loop(config, message, context, app_handle).await;
    });

    Ok(())
}
