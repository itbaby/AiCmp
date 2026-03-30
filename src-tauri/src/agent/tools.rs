use serde_json::{json, Value};

#[derive(Clone)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

impl ToolDef {
    fn new(name: &str, description: &str, properties: Value, required: Vec<&str>) -> Self {
        Self {
            name: name.to_string(),
            description: description.to_string(),
            parameters: json!({
                "type": "object",
                "properties": properties,
                "required": required,
            }),
        }
    }
}

impl From<ToolDef> for crate::agent::providers::ToolDef {
    fn from(t: ToolDef) -> Self {
        Self {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        }
    }
}

fn compare_files_tool() -> ToolDef {
    ToolDef::new(
        "compare_files",
        "Compare two files and return a structured diff",
        json!({
            "left_path": { "type": "string", "description": "Path to the left (old) file" },
            "right_path": { "type": "string", "description": "Path to the right (new) file" },
        }),
        vec!["left_path", "right_path"],
    )
}

fn compare_directories_tool() -> ToolDef {
    ToolDef::new(
        "compare_directories",
        "Compare two directories and return matching/differing files",
        json!({
            "left_dir": { "type": "string", "description": "Path to the left directory" },
            "right_dir": { "type": "string", "description": "Path to the right directory" },
        }),
        vec!["left_dir", "right_dir"],
    )
}

fn compare_git_commits_tool() -> ToolDef {
    ToolDef::new(
        "compare_git_commits",
        "Compare two git commits and return file diffs",
        json!({
            "repo_path": { "type": "string", "description": "Path to the git repository" },
            "commit_a": { "type": "string", "description": "First commit hash or reference" },
            "commit_b": { "type": "string", "description": "Second commit hash or reference" },
        }),
        vec!["repo_path", "commit_a", "commit_b"],
    )
}

fn compare_git_working_tree_tool() -> ToolDef {
    ToolDef::new(
        "compare_git_working_tree",
        "Compare the working tree against HEAD in a git repository",
        json!({
            "repo_path": { "type": "string", "description": "Path to the git repository" },
        }),
        vec!["repo_path"],
    )
}

fn list_directory_tool() -> ToolDef {
    ToolDef::new(
        "list_directory",
        "List files and directories at the given path",
        json!({
            "path": { "type": "string", "description": "Directory path to list" },
        }),
        vec!["path"],
    )
}

fn read_file_tool() -> ToolDef {
    ToolDef::new(
        "read_file",
        "Read the contents of a file",
        json!({
            "path": { "type": "string", "description": "Path to the file to read" },
        }),
        vec!["path"],
    )
}

fn list_branches_tool() -> ToolDef {
    ToolDef::new(
        "list_branches",
        "List git branches in a repository",
        json!({
            "repo_path": { "type": "string", "description": "Path to the git repository" },
        }),
        vec!["repo_path"],
    )
}

fn list_commits_tool() -> ToolDef {
    ToolDef::new(
        "list_commits",
        "List recent commits in a git repository",
        json!({
            "repo_path": { "type": "string", "description": "Path to the git repository" },
            "count": { "type": "integer", "description": "Number of commits to list (default 20)" },
        }),
        vec!["repo_path"],
    )
}

fn apply_suggestion_tool() -> ToolDef {
    ToolDef::new(
        "apply_suggestion",
        "Apply a suggestion by replacing the entire content of the left or right file in the diff view",
        json!({
            "side": { "type": "string", "enum": ["left", "right"], "description": "Which side to apply the change to" },
            "content": { "type": "string", "description": "The full new content for that side" },
        }),
        vec!["side", "content"],
    )
}

pub fn get_all_tools() -> Vec<ToolDef> {
    vec![
        compare_files_tool(),
        compare_directories_tool(),
        compare_git_commits_tool(),
        compare_git_working_tree_tool(),
        list_directory_tool(),
        read_file_tool(),
        list_branches_tool(),
        list_commits_tool(),
        apply_suggestion_tool(),
    ]
}

pub fn execute_tool(name: &str, args: &Value) -> Value {
    match name {
        "compare_files" => {
            let left = args["left_path"].as_str().unwrap_or("");
            let right = args["right_path"].as_str().unwrap_or("");
            let old = match std::fs::read_to_string(left) {
                Ok(c) => c,
                Err(e) => return json!({"error": e.to_string()}),
            };
            let new = match std::fs::read_to_string(right) {
                Ok(c) => c,
                Err(e) => return json!({"error": e.to_string()}),
            };
            let diff = crate::diff::diff_texts(&old, &new);
            serde_json::to_value(diff).unwrap_or(json!({"error": "serialization failed"}))
        }
        "compare_directories" => {
            let left = args["left_dir"].as_str().unwrap_or("");
            let right = args["right_dir"].as_str().unwrap_or("");
            match crate::scanner::scan_directories(
                std::path::Path::new(left),
                std::path::Path::new(right),
            ) {
                Ok(diff) => {
                    serde_json::to_value(diff).unwrap_or(json!({"error": "serialization failed"}))
                }
                Err(e) => json!({"error": e}),
            }
        }
        "compare_git_commits" => {
            let repo = args["repo_path"].as_str().unwrap_or("");
            let a = args["commit_a"].as_str().unwrap_or("");
            let b = args["commit_b"].as_str().unwrap_or("");
            match crate::git::diff_commits(repo, a, b) {
                Ok(entries) => serde_json::to_value(entries)
                    .unwrap_or(json!({"error": "serialization failed"})),
                Err(e) => json!({"error": e}),
            }
        }
        "compare_git_working_tree" => {
            let repo = args["repo_path"].as_str().unwrap_or("");
            match crate::git::diff_working_tree(repo) {
                Ok(entries) => serde_json::to_value(entries)
                    .unwrap_or(json!({"error": "serialization failed"})),
                Err(e) => json!({"error": e}),
            }
        }
        "list_directory" => {
            let path = args["path"].as_str().unwrap_or("");
            match std::fs::read_dir(path) {
                Ok(entries) => {
                    let items: Vec<Value> = entries
                        .filter_map(|e| e.ok())
                        .map(|e| {
                            let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
                            json!({
                                "name": e.file_name().to_string_lossy(),
                                "is_dir": is_dir,
                                "path": e.path().to_string_lossy(),
                            })
                        })
                        .collect();
                    json!(items)
                }
                Err(e) => json!({"error": e.to_string()}),
            }
        }
        "read_file" => {
            let path = args["path"].as_str().unwrap_or("");
            match std::fs::read_to_string(path) {
                Ok(content) => json!({"content": content}),
                Err(e) => json!({"error": e.to_string()}),
            }
        }
        "list_branches" => {
            let repo = args["repo_path"].as_str().unwrap_or("");
            match crate::git::list_branches(repo) {
                Ok(branches) => serde_json::to_value(branches)
                    .unwrap_or(json!({"error": "serialization failed"})),
                Err(e) => json!({"error": e}),
            }
        }
        "list_commits" => {
            let repo = args["repo_path"].as_str().unwrap_or("");
            let count = args["count"].as_u64().unwrap_or(20) as usize;
            match crate::git::list_recent_commits(repo, None, count) {
                Ok(commits) => serde_json::to_value(commits)
                    .unwrap_or(json!({"error": "serialization failed"})),
                Err(e) => json!({"error": e}),
            }
        }
        "apply_suggestion" => {
            json!({"status": "applied"})
        }
        _ => json!({"error": format!("Unknown tool: {}", name)}),
    }
}
