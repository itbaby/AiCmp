use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AiResponse {
    pub message: Message,
    pub done: bool,
}

#[derive(Clone)]
pub enum Provider {
    OpenAI,
    Anthropic,
    Ollama,
}

impl Provider {
    pub fn from_str(s: &str) -> Self {
        match s {
            "anthropic" => Provider::Anthropic,
            "ollama" => Provider::Ollama,
            _ => Provider::OpenAI,
        }
    }
}

#[derive(Clone)]
pub struct ProviderConfig {
    pub provider: Provider,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
}

pub trait AiProvider: Send + Sync {
    fn chat(
        &self,
        messages: Vec<Message>,
        tools: Vec<ToolDef>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<AiResponse, String>> + Send + '_>>;
}

pub struct OpenAiProvider {
    config: ProviderConfig,
    client: Client,
}

impl OpenAiProvider {
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

impl AiProvider for OpenAiProvider {
    fn chat(
        &self,
        messages: Vec<Message>,
        tools: Vec<ToolDef>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<AiResponse, String>> + Send + '_>> {
        let config = self.config.clone();
        let client = self.client.clone();
        Box::pin(async move {
            let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));

            let tool_defs: Vec<serde_json::Value> = tools
                .into_iter()
                .map(|t| {
                    serde_json::json!({
                        "type": "function",
                        "function": {
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.parameters,
                        }
                    })
                })
                .collect();

            let mut body = serde_json::json!({
                "model": config.model,
                "messages": messages,
            });

            if !tool_defs.is_empty() {
                body["tools"] = serde_json::json!(tool_defs);
            }

            let mut req = client.post(&url);
            if !config.api_key.is_empty() {
                req = req.bearer_auth(&config.api_key);
            }

            let resp = req
                .json(&body)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                return Err(format!("API error {}: {}", status, text));
            }

            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let choice = &data["choices"][0];
            let msg = &choice["message"];

            let content = msg["content"].as_str().unwrap_or("").to_string();
            let tool_calls: Option<Vec<ToolCall>> = msg
                .get("tool_calls")
                .and_then(|tc| {
                    tc.as_array().map(|arr| {
                        arr.iter()
                            .filter_map(|tc| {
                                Some(ToolCall {
                                    id: tc["id"].as_str()?.to_string(),
                                    name: tc["function"]["name"].as_str()?.to_string(),
                                    arguments: tc["function"]["arguments"].as_str()?.to_string(),
                                })
                            })
                            .collect()
                    })
                });

            let finish_reason = choice["finish_reason"].as_str().unwrap_or("");
            let done = finish_reason != "tool_calls";

            Ok(AiResponse {
                message: Message {
                    role: "assistant".to_string(),
                    content,
                    tool_calls,
                },
                done,
            })
        })
    }
}

pub struct AnthropicProvider {
    config: ProviderConfig,
    client: Client,
}

impl AnthropicProvider {
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

impl AiProvider for AnthropicProvider {
    fn chat(
        &self,
        messages: Vec<Message>,
        tools: Vec<ToolDef>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<AiResponse, String>> + Send + '_>> {
        let config = self.config.clone();
        let client = self.client.clone();
        Box::pin(async move {
            let url = format!("{}/messages", config.base_url.trim_end_matches('/'));

            let mut system_msg = String::new();
            let mut api_messages = Vec::new();

            for msg in &messages {
                if msg.role == "system" {
                    system_msg = msg.content.clone();
                } else {
                    api_messages.push(serde_json::json!({
                        "role": msg.role,
                        "content": msg.content,
                    }));
                }
            }

            let mut body = serde_json::json!({
                "model": config.model,
                "messages": api_messages,
                "max_tokens": 4096,
            });

            if !system_msg.is_empty() {
                body["system"] = serde_json::json!(system_msg);
            }

            if !tools.is_empty() {
                let tool_defs: Vec<serde_json::Value> = tools
                    .into_iter()
                    .map(|t| {
                        serde_json::json!({
                            "name": t.name,
                            "description": t.description,
                            "input_schema": t.parameters,
                        })
                    })
                    .collect();
                body["tools"] = serde_json::json!(tool_defs);
            }

            let resp = client
                .post(&url)
                .header("x-api-key", &config.api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                return Err(format!("API error {}: {}", status, text));
            }

            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

            let mut content = String::new();
            let mut tool_calls = Vec::new();

            if let Some(blocks) = data["content"].as_array() {
                for block in blocks {
                    match block["type"].as_str() {
                        Some("text") => {
                            content.push_str(block["text"].as_str().unwrap_or(""));
                        }
                        Some("tool_use") => {
                            tool_calls.push(ToolCall {
                                id: block["id"].as_str().unwrap_or("").to_string(),
                                name: block["name"].as_str().unwrap_or("").to_string(),
                                arguments: serde_json::to_string(&block["input"])
                                    .unwrap_or_default(),
                            });
                        }
                        _ => {}
                    }
                }
            }

            let stop_reason = data["stop_reason"].as_str().unwrap_or("");
            let done = stop_reason != "tool_use";

            Ok(AiResponse {
                message: Message {
                    role: "assistant".to_string(),
                    content,
                    tool_calls: if tool_calls.is_empty() {
                        None
                    } else {
                        Some(tool_calls)
                    },
                },
                done,
            })
        })
    }
}

pub struct OllamaProvider {
    config: ProviderConfig,
    client: Client,
}

impl OllamaProvider {
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

impl AiProvider for OllamaProvider {
    fn chat(
        &self,
        messages: Vec<Message>,
        tools: Vec<ToolDef>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<AiResponse, String>> + Send + '_>> {
        let config = self.config.clone();
        let client = self.client.clone();
        Box::pin(async move {
            let url = format!("{}/api/chat", config.base_url.trim_end_matches('/'));

            let api_messages: Vec<serde_json::Value> = messages
                .iter()
                .map(|m| {
                    serde_json::json!({
                        "role": m.role,
                        "content": m.content,
                    })
                })
                .collect();

            let mut body = serde_json::json!({
                "model": config.model,
                "messages": api_messages,
                "stream": false,
            });

            if !tools.is_empty() {
                let tool_defs: Vec<serde_json::Value> = tools
                    .into_iter()
                    .map(|t| {
                        serde_json::json!({
                            "type": "function",
                            "function": {
                                "name": t.name,
                                "description": t.description,
                                "parameters": t.parameters,
                            }
                        })
                    })
                    .collect();
                body["tools"] = serde_json::json!(tool_defs);
            }

            let resp = client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                return Err(format!("API error {}: {}", status, text));
            }

            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

            let msg = &data["message"];
            let content = msg["content"].as_str().unwrap_or("").to_string();

            let tool_calls: Option<Vec<ToolCall>> = msg.get("tool_calls").and_then(|tc| {
                tc.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|tc| {
                            let func = tc.get("function")?;
                            Some(ToolCall {
                                id: uuid::Uuid::new_v4().to_string(),
                                name: func["name"].as_str()?.to_string(),
                                arguments: serde_json::to_string(&func["arguments"])
                                    .unwrap_or_default(),
                            })
                        })
                        .collect()
                })
            });

            let done = tool_calls.is_none();

            Ok(AiResponse {
                message: Message {
                    role: "assistant".to_string(),
                    content,
                    tool_calls,
                },
                done,
            })
        })
    }
}

pub fn create_provider(config: ProviderConfig) -> Box<dyn AiProvider> {
    match config.provider {
        Provider::OpenAI => Box::new(OpenAiProvider::new(config)),
        Provider::Anthropic => Box::new(AnthropicProvider::new(config)),
        Provider::Ollama => Box::new(OllamaProvider::new(config)),
    }
}
