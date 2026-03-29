use serde::Serialize;
use similar::{ChangeTag, TextDiff};

#[derive(Serialize, Clone)]
pub struct FileDiff {
    pub hunks: Vec<Hunk>,
    pub stats: DiffStats,
}

#[derive(Serialize, Clone)]
pub struct Hunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub changes: Vec<Change>,
}

#[derive(Serialize, Clone)]
pub struct Change {
    pub change_type: String,
    pub old_line_index: Option<u32>,
    pub new_line_index: Option<u32>,
    pub content: String,
    pub char_changes: Vec<CharChange>,
}

#[derive(Serialize, Clone)]
pub struct CharChange {
    pub change_type: String,
    pub value: String,
}

#[derive(Serialize, Clone)]
pub struct DiffStats {
    pub insertions: u32,
    pub deletions: u32,
    pub unchanged: u32,
}

fn tag_to_str(tag: ChangeTag) -> &'static str {
    match tag {
        ChangeTag::Equal => "equal",
        ChangeTag::Delete => "delete",
        ChangeTag::Insert => "insert",
    }
}

fn char_diff(old_line: &str, new_line: &str) -> Vec<CharChange> {
    let diff = TextDiff::from_chars(old_line, new_line);
    diff.iter_all_changes()
        .map(|change| CharChange {
            change_type: tag_to_str(change.tag()).to_string(),
            value: change.to_string(),
        })
        .collect()
}

pub fn diff_texts(old: &str, new: &str) -> FileDiff {
    let diff = TextDiff::from_lines(old, new);

    let mut hunks = Vec::new();
    let mut total_insertions = 0u32;
    let mut total_deletions = 0u32;
    let mut total_unchanged = 0u32;

    for ops in diff.grouped_ops(3) {
        let mut changes = Vec::new();
        let old_line = 0u32;
        let new_line = 0u32;

        let mut old_start = 0u32;
        let mut new_start = 0u32;
        let mut old_count = 0u32;
        let mut new_count = 0u32;

        for (op_idx, op) in ops.iter().enumerate() {
            let op_changes: Vec<_> = diff.iter_changes(op).collect();

            if op_idx == 0 {
                for c in &op_changes {
                    match c.tag() {
                        ChangeTag::Equal => {
                            old_start = c.old_index().unwrap_or(0) as u32;
                            new_start = c.new_index().unwrap_or(0) as u32;
                            break;
                        }
                        ChangeTag::Delete => {
                            old_start = c.old_index().unwrap_or(0) as u32;
                            new_start = new_line;
                        }
                        ChangeTag::Insert => {
                            old_start = old_line;
                            new_start = c.new_index().unwrap_or(0) as u32;
                        }
                    }
                }
            }

            let paired = pair_adjacent_deletions_insertions(&op_changes);

            for (i, change) in op_changes.iter().enumerate() {
                let tag = change.tag();
                let content = change.to_string();

                match tag {
                    ChangeTag::Equal => {
                        old_count += 1;
                        new_count += 1;
                        total_unchanged += 1;
                        changes.push(Change {
                            change_type: "equal".to_string(),
                            old_line_index: change.old_index().map(|i| i as u32),
                            new_line_index: change.new_index().map(|i| i as u32),
                            content,
                            char_changes: Vec::new(),
                        });
                    }
                    ChangeTag::Delete => {
                        old_count += 1;
                        total_deletions += 1;
                        let char_changes = if let Some(insert_idx) = paired.get(&i) {
                            let insert_content = op_changes[*insert_idx].to_string();
                            char_diff(&content, &insert_content)
                        } else {
                            Vec::new()
                        };
                        changes.push(Change {
                            change_type: "delete".to_string(),
                            old_line_index: change.old_index().map(|i| i as u32),
                            new_line_index: None,
                            content,
                            char_changes,
                        });
                    }
                    ChangeTag::Insert => {
                        new_count += 1;
                        total_insertions += 1;
                        let char_changes = if paired.values().any(|&v| v == i) {
                            vec![CharChange {
                                change_type: "insert".to_string(),
                                value: content.clone(),
                            }]
                        } else {
                            Vec::new()
                        };
                        changes.push(Change {
                            change_type: "insert".to_string(),
                            old_line_index: None,
                            new_line_index: change.new_index().map(|i| i as u32),
                            content,
                            char_changes,
                        });
                    }
                }
            }
        }

        if !changes.is_empty() {
            hunks.push(Hunk {
                old_start: old_start + 1,
                old_lines: old_count,
                new_start: new_start + 1,
                new_lines: new_count,
                changes,
            });
        }
    }

    FileDiff {
        hunks,
        stats: DiffStats {
            insertions: total_insertions,
            deletions: total_deletions,
            unchanged: total_unchanged,
        },
    }
}

fn pair_adjacent_deletions_insertions(
    changes: &[similar::Change<&str>],
) -> std::collections::HashMap<usize, usize> {
    let mut pairs = std::collections::HashMap::new();
    let mut i = 0;
    while i < changes.len() {
        if changes[i].tag() == ChangeTag::Delete {
            let mut del_end = i + 1;
            while del_end < changes.len() && changes[del_end].tag() == ChangeTag::Delete {
                del_end += 1;
            }
            let del_count = del_end - i;
            let ins_start = del_end;
            if ins_start < changes.len() && changes[ins_start].tag() == ChangeTag::Insert {
                let mut ins_end = ins_start + 1;
                while ins_end < changes.len() && changes[ins_end].tag() == ChangeTag::Insert {
                    ins_end += 1;
                }
                let ins_count = ins_end - ins_start;
                let pair_count = del_count.min(ins_count);
                for k in 0..pair_count {
                    pairs.insert(i + k, ins_start + k);
                }
            }
            i = del_end;
        } else {
            i += 1;
        }
    }
    pairs
}
