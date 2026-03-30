use crate::agent::providers::{create_provider, Message, ProviderConfig};
use crate::agent::tools::{execute_tool, get_all_tools};
use serde::Serialize;
use tauri::Emitter;

#[derive(Serialize, Clone)]
#[serde(tag = "type")]
pub enum AgentEvent {
    #[serde(rename = "thought")]
    Thought { content: String },
    #[serde(rename = "tool_call")]
    ToolCall { id: String, name: String, arguments: String },
    #[serde(rename = "tool_result")]
    ToolResult { id: String, name: String, result: serde_json::Value },
    #[serde(rename = "apply_suggestion")]
    ApplySuggestion { side: String, content: String },
    #[serde(rename = "final_response")]
    FinalResponse { content: String },
}

pub struct AgentContext {
    pub working_directory: Option<String>,
    pub left_content: Option<String>,
    pub right_content: Option<String>,
    pub left_path: Option<String>,
    pub right_path: Option<String>,
}

pub async fn run_agent_loop(
    config: ProviderConfig,
    user_message: String,
    context: AgentContext,
    app_handle: tauri::AppHandle,
) -> Result<Vec<AgentEvent>, String> {
    let provider = create_provider(config);
    let tools = get_all_tools();
    let tool_defs: Vec<crate::agent::providers::ToolDef> =
        tools.into_iter().map(Into::into).collect();

    let file_context = match (&context.left_content, &context.right_content) {
        (Some(lc), Some(rc)) => {
            let lp = context.left_path.as_deref().unwrap_or("unknown");
            let rp = context.right_path.as_deref().unwrap_or("unknown");
            format!(
                "\n\nThe user is currently comparing two files:\n\
                 Left file ({}):\n```\n{}\n```\n\
                 Right file ({}):\n```\n{}\n```\n\n\
                 You can use the `apply_suggestion` tool to modify the left or right file content. \
                 The diff view will update automatically. \
                 When asked to merge changes, use apply_suggestion to replace the content of either side.",
                lp, truncate(lc, 3000), rp, truncate(rc, 3000)
            )
        }
        _ => String::new(),
    };

    let system_msg = Message {
        role: "system".to_string(),
        content: format!(
            "You are an AI assistant for AiCmp, a file comparison tool. You can compare files, directories, and git commits using the tools available. Help users understand differences between files and code.{}{}",
            context.working_directory
                .as_ref()
                .map(|d| format!(" Working directory: {}", d))
                .unwrap_or_default(),
            file_context
        ),
        tool_calls: None,
    };

    let user_msg = Message {
        role: "user".to_string(),
        content: user_message,
        tool_calls: None,
    };

    let mut messages = vec![system_msg, user_msg];
    let mut events = Vec::new();
    let max_iterations = 20;

    for _ in 0..max_iterations {
        let response = provider
            .chat(messages.clone(), tool_defs.clone())
            .await
            .map_err(|e| e.to_string())?;

        if !response.message.content.is_empty() {
            events.push(AgentEvent::Thought {
                content: response.message.content.clone(),
            });
            let _ = app_handle.emit("ai-event", AgentEvent::Thought {
                content: response.message.content.clone(),
            });
        }

        let assistant_msg = Message {
            role: "assistant".to_string(),
            content: response.message.content.clone(),
            tool_calls: response.message.tool_calls.clone(),
        };
        messages.push(assistant_msg);

        match response.message.tool_calls {
            Some(calls) if !calls.is_empty() => {
                for call in calls {
                    events.push(AgentEvent::ToolCall {
                        id: call.id.clone(),
                        name: call.name.clone(),
                        arguments: call.arguments.clone(),
                    });
                    let _ = app_handle.emit("ai-event", AgentEvent::ToolCall {
                        id: call.id.clone(),
                        name: call.name.clone(),
                        arguments: call.arguments.clone(),
                    });

                    let args: serde_json::Value =
                        serde_json::from_str(&call.arguments).unwrap_or(serde_json::json!({}));

                    if call.name == "apply_suggestion" {
                        let side = args["side"].as_str().unwrap_or("right").to_string();
                        let content = args["content"].as_str().unwrap_or("").to_string();
                        events.push(AgentEvent::ApplySuggestion {
                            side: side.clone(),
                            content: content.clone(),
                        });
                        let _ = app_handle.emit("ai-event", AgentEvent::ApplySuggestion {
                            side,
                            content,
                        });
                        messages.push(Message {
                            role: "tool".to_string(),
                            content: "{\"applied\": true}".to_string(),
                            tool_calls: None,
                        });
                    } else {
                        let result = execute_tool(&call.name, &args);
                        events.push(AgentEvent::ToolResult {
                            id: call.id.clone(),
                            name: call.name.clone(),
                            result: result.clone(),
                        });
                        let _ = app_handle.emit("ai-event", AgentEvent::ToolResult {
                            id: call.id.clone(),
                            name: call.name.clone(),
                            result: result.clone(),
                        });
                        messages.push(Message {
                            role: "tool".to_string(),
                            content: serde_json::to_string(&result).unwrap_or_default(),
                            tool_calls: None,
                        });
                    }
                }
            }
            _ => {
                let final_content = response.message.content.clone();
                events.push(AgentEvent::FinalResponse {
                    content: final_content.clone(),
                });
                let _ = app_handle.emit("ai-event", AgentEvent::FinalResponse {
                    content: final_content,
                });
                return Ok(events);
            }
        }
    }

    events.push(AgentEvent::FinalResponse {
        content: "Agent loop reached maximum iterations.".to_string(),
    });
    let _ = app_handle.emit("ai-event", AgentEvent::FinalResponse {
        content: "Agent loop reached maximum iterations.".to_string(),
    });

    Ok(events)
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() > max {
        format!("{}... (truncated)", &s[..max])
    } else {
        s.to_string()
    }
}
