use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct DirDiff {
    pub entries: Vec<DirEntry>,
    pub stats: DirStats,
}

#[derive(Serialize, Clone)]
pub struct DirEntry {
    pub relative_path: String,
    pub status: String,
    pub left_path: Option<String>,
    pub right_path: Option<String>,
    pub is_dir: bool,
    pub size_left: Option<u64>,
    pub size_right: Option<u64>,
}

#[derive(Serialize, Clone)]
pub struct DirStats {
    pub total_left: u32,
    pub total_right: u32,
    pub same: u32,
    pub modified: u32,
    pub added: u32,
    pub deleted: u32,
}

fn hash_file(path: &Path) -> Result<blake3::Hash, std::io::Error> {
    let mut hasher = blake3::Hasher::new();
    let mut file = std::fs::File::open(path)?;
    std::io::copy(&mut file, &mut hasher)?;
    Ok(hasher.finalize())
}

fn collect_entries(base: &Path) -> Result<(BTreeMap<String, std::fs::Metadata>, BTreeSet<String>), std::io::Error> {
    let mut files = BTreeMap::new();
    let mut dirs = BTreeSet::new();

    for entry in WalkDir::new(base).follow_links(false) {
        let entry = entry?;
        let metadata = entry.metadata()?.clone();
        let relative = entry
            .path()
            .strip_prefix(base)
            .unwrap()
            .to_string_lossy()
            .to_string();

        if relative.is_empty() {
            continue;
        }

        if metadata.is_dir() {
            dirs.insert(relative);
        } else {
            files.insert(relative, metadata);
        }
    }

    Ok((files, dirs))
}

pub fn scan_directories(left: &Path, right: &Path) -> Result<DirDiff, String> {
    let (left_files, left_dirs) = collect_entries(left).map_err(|e| e.to_string())?;
    let (right_files, right_dirs) = collect_entries(right).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    let mut stats = DirStats {
        total_left: left_files.len() as u32,
        total_right: right_files.len() as u32,
        same: 0,
        modified: 0,
        added: 0,
        deleted: 0,
    };

    let all_paths: BTreeSet<String> = left_files.keys().chain(right_files.keys()).cloned().collect();

    for path in &all_paths {
        let left_meta = left_files.get(path);
        let right_meta = right_files.get(path);

        let (status, is_dir, size_left, size_right) = match (left_meta, right_meta) {
            (Some(lm), Some(rm)) => {
                let lp = left.join(path);
                let rp = right.join(path);
                let lh = hash_file(&lp).ok();
                let rh = hash_file(&rp).ok();
                let same = lh.as_ref().zip(rh.as_ref()).map(|(a, b)| a == b).unwrap_or(false);
                let status = if same { "same" } else { "modified" };
                if same { stats.same += 1; } else { stats.modified += 1; }
                (status.to_string(), false, Some(lm.len()), Some(rm.len()))
            }
            (Some(lm), None) => {
                stats.deleted += 1;
                ("deleted".to_string(), false, Some(lm.len()), None)
            }
            (None, Some(rm)) => {
                stats.added += 1;
                ("added".to_string(), false, None, Some(rm.len()))
            }
            (None, None) => continue,
        };

        entries.push(DirEntry {
            relative_path: path.clone(),
            status,
            left_path: left_files.contains_key(path).then(|| left.join(path).to_string_lossy().to_string()),
            right_path: right_files.contains_key(path).then(|| right.join(path).to_string_lossy().to_string()),
            is_dir,
            size_left,
            size_right,
        });
    }

    let all_dirs: BTreeSet<String> = left_dirs.union(&right_dirs).cloned().collect();
    for dir_path in &all_dirs {
        let in_left = left_dirs.contains(dir_path);
        let in_right = right_dirs.contains(dir_path);
        let status = match (in_left, in_right) {
            (true, true) => "same".to_string(),
            (true, false) => "dir_only_left".to_string(),
            (false, true) => "dir_only_right".to_string(),
            (false, false) => continue,
        };
        entries.push(DirEntry {
            relative_path: dir_path.clone(),
            status,
            left_path: if in_left { Some(left.join(dir_path).to_string_lossy().to_string()) } else { None },
            right_path: if in_right { Some(right.join(dir_path).to_string_lossy().to_string()) } else { None },
            is_dir: true,
            size_left: None,
            size_right: None,
        });
    }

    entries.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    Ok(DirDiff { entries, stats })
}
