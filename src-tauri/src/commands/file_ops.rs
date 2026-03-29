use crate::diff::FileDiff;

#[tauri::command]
pub async fn compare_files(left_path: String, right_path: String) -> Result<FileDiff, String> {
    tokio::task::spawn_blocking(move || {
        let old = std::fs::read_to_string(&left_path).map_err(|e| e.to_string())?;
        let new = std::fs::read_to_string(&right_path).map_err(|e| e.to_string())?;
        Ok(crate::diff::diff_texts(&old, &new))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || std::fs::read_to_string(&path).map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}
