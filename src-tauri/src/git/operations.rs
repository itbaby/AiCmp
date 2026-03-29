use crate::diff::diff_texts;
use git2::{DiffOptions, Repository};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct RepoInfo {
    pub path: String,
    pub current_branch: String,
    pub is_clean: bool,
}

#[derive(Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub time: i64,
}

#[derive(Serialize)]
pub struct FileDiffEntry {
    pub path: String,
    pub status: String,
    pub diff: Option<crate::diff::FileDiff>,
}

pub fn find_repo(path: &str) -> Result<Repository, String> {
    Repository::discover(path).map_err(|e| e.to_string())
}

pub fn get_repo_info(repo_path: &str) -> Result<RepoInfo, String> {
    let repo = find_repo(repo_path)?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let current_branch = head
        .shorthand()
        .unwrap_or("HEAD (detached)")
        .to_string();

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| e.to_string())?;
    let is_clean = diff.deltas().len() == 0;

    Ok(RepoInfo {
        path: repo.path().to_string_lossy().to_string(),
        current_branch,
        is_clean,
    })
}

pub fn list_branches(repo_path: &str) -> Result<Vec<BranchInfo>, String> {
    let repo = find_repo(repo_path)?;
    let current_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    let mut result = Vec::new();

    let branches = repo.branches(None).map_err(|e| e.to_string())?;
    for branch in branches {
        let (branch, is_remote) = branch.map_err(|e| e.to_string())?;
        let name = branch.name().map_err(|e| e.to_string())?;
        let name = name.unwrap_or("").to_string();
        let is_current = current_name.as_ref() == Some(&name);
        result.push(BranchInfo {
            name,
            is_current,
            is_remote: is_remote == git2::BranchType::Remote,
        });
    }

    Ok(result)
}

pub fn list_recent_commits(
    repo_path: &str,
    branch: Option<&str>,
    count: usize,
) -> Result<Vec<CommitInfo>, String> {
    let repo = find_repo(repo_path)?;
    let revspec = match branch {
        Some(b) => format!("refs/heads/{}", b),
        None => "HEAD".to_string(),
    };
    let oid = repo.revparse_single(&revspec).map_err(|e| e.to_string())?;
    let commit = oid.as_commit().ok_or("Not a commit")?.clone();

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push(commit.id()).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for oid in revwalk.take(count) {
        let oid = oid.map_err(|e| e.to_string())?;
        let c = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let hash = c.id().to_string();
        let short_hash = hash[..7].to_string();
        let message = c.message().unwrap_or("").to_string();
        let author = c.author().name().unwrap_or("").to_string();
        let time = c.time().seconds();
        result.push(CommitInfo {
            hash,
            short_hash,
            message,
            author,
            time,
        });
    }

    Ok(result)
}

pub fn diff_commits(
    repo_path: &str,
    commit_a: &str,
    commit_b: &str,
) -> Result<Vec<FileDiffEntry>, String> {
    let repo = find_repo(repo_path)?;
    let oid_a = repo.revparse_single(commit_a).map_err(|e| e.to_string())?;
    let oid_b = repo.revparse_single(commit_b).map_err(|e| e.to_string())?;
    let commit_a_obj = oid_a.as_commit().ok_or("Invalid commit A")?;
    let commit_b_obj = oid_b.as_commit().ok_or("Invalid commit B")?;

    let tree_a = commit_a_obj.tree().map_err(|e| e.to_string())?;
    let tree_b = commit_b_obj.tree().map_err(|e| e.to_string())?;

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_tree(Some(&tree_a), Some(&tree_b), Some(&mut opts))
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for delta in diff.deltas() {
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "copied",
            _ => "other",
        };

        let old_content = get_blob_content(&repo, delta.old_file().id());
        let new_content = get_blob_content(&repo, delta.new_file().id());

        let file_diff = if status == "modified" || status == "renamed" {
            Some(diff_texts(&old_content, &new_content))
        } else {
            None
        };

        result.push(FileDiffEntry {
            path,
            status: status.to_string(),
            diff: file_diff,
        });
    }

    Ok(result)
}

pub fn diff_working_tree(repo_path: &str) -> Result<Vec<FileDiffEntry>, String> {
    let repo = find_repo(repo_path)?;

    let head = repo.head().map_err(|e| e.to_string())?;
    let head_tree = head
        .peel_to_tree()
        .map_err(|e| e.to_string())?;

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_workdir_with_index(Some(&head_tree), Some(&mut opts))
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for delta in diff.deltas() {
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            _ => "other",
        };

        let workdir = repo.workdir().unwrap_or(Path::new("."));
        let old_content = {
            let blob = repo.find_blob(delta.old_file().id()).ok();
            blob.map(|b| String::from_utf8_lossy(b.content()).to_string())
                .unwrap_or_default()
        };
        let new_content = {
            let full_path = workdir.join(&path);
            std::fs::read_to_string(&full_path).unwrap_or_default()
        };

        let file_diff = if status == "modified" {
            Some(diff_texts(&old_content, &new_content))
        } else {
            None
        };

        result.push(FileDiffEntry {
            path,
            status: status.to_string(),
            diff: file_diff,
        });
    }

    Ok(result)
}

pub fn get_file_at_commit(
    repo_path: &str,
    commit: &str,
    file_path: &str,
) -> Result<String, String> {
    let repo = find_repo(repo_path)?;
    let oid = repo.revparse_single(commit).map_err(|e| e.to_string())?;
    let c = oid.as_commit().ok_or("Not a commit")?;
    let tree = c.tree().map_err(|e| e.to_string())?;
    let entry = tree
        .get_path(Path::new(file_path))
        .map_err(|e| format!("File not found in commit: {}", e))?;
    let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(blob.content()).to_string())
}

fn get_blob_content(repo: &Repository, oid: git2::Oid) -> String {
    if oid.is_zero() {
        return String::new();
    }
    repo.find_blob(oid)
        .map(|b| String::from_utf8_lossy(b.content()).to_string())
        .unwrap_or_default()
}
