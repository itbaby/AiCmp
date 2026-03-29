use crate::scanner::DirDiff;
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[tauri::command]
pub async fn compare_directories(left_dir: String, right_dir: String) -> Result<DirDiff, String> {
    tokio::task::spawn_blocking(move || {
        let left = Path::new(&left_dir);
        let right = Path::new(&right_dir);
        crate::scanner::scan_directories(left, right)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let dir = Path::new(&path);
        let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            result.push(FileInfo {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                is_dir: metadata.is_dir(),
                size: if metadata.is_file() {
                    Some(metadata.len())
                } else {
                    None
                },
            });
        }
        result.sort_by(|a, b| {
            b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
