use crate::git::{BranchInfo, CommitInfo, FileDiffEntry, RepoInfo};

#[tauri::command]
pub async fn get_repo_info(path: String) -> Result<RepoInfo, String> {
    tokio::task::spawn_blocking(move || crate::git::get_repo_info(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn compare_commits(
    repo_path: String,
    commit_a: String,
    commit_b: String,
) -> Result<Vec<FileDiffEntry>, String> {
    tokio::task::spawn_blocking(move || crate::git::diff_commits(&repo_path, &commit_a, &commit_b))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn compare_working_tree(repo_path: String) -> Result<Vec<FileDiffEntry>, String> {
    tokio::task::spawn_blocking(move || crate::git::diff_working_tree(&repo_path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    tokio::task::spawn_blocking(move || crate::git::list_branches(&repo_path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_recent_commits(
    repo_path: String,
    branch: Option<String>,
    count: Option<usize>,
) -> Result<Vec<CommitInfo>, String> {
    tokio::task::spawn_blocking(move || {
        crate::git::list_recent_commits(
            &repo_path,
            branch.as_deref(),
            count.unwrap_or(20),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
