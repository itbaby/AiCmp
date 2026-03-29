mod diff;
mod scanner;
mod git;
mod agent;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::file_ops::compare_files,
            commands::file_ops::read_file_content,
            commands::dir_ops::compare_directories,
            commands::dir_ops::list_directory,
            commands::git_ops::get_repo_info,
            commands::git_ops::compare_commits,
            commands::git_ops::compare_working_tree,
            commands::git_ops::list_branches,
            commands::git_ops::list_recent_commits,
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::agent_cmd::ai_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
