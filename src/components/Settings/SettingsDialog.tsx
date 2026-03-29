import { useAppState } from "../../stores/appStore";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  { id: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "zhipu", label: "智谱", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-plus" },
  { id: "moonshot", label: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { id: "qwen", label: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo" },
  { id: "ollama", label: "Ollama", baseUrl: "http://localhost:11434", model: "llama3" },
];

export function SettingsDialog() {
  const settings = useAppState((s) => s.settings);
  const setSettings = useAppState((s) => s.setSettings);
  const toggleSettings = useAppState((s) => s.toggleSettings);

  const handleProviderChange = (id: string) => {
    const provider = PROVIDERS.find((p) => p.id === id);
    if (provider) {
      setSettings({
        ai_provider: provider.id,
        base_url: provider.baseUrl,
        model: provider.model,
      });
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-[--bg-surface] border border-gray-200 rounded-md text-sm text-[--text-primary] font-mono outline-none focus:border-[--accent] transition-colors placeholder:text-[--text-secondary]/40";
  const labelClass =
    "block text-xs text-[--text-secondary] mb-1.5 font-medium tracking-wide";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={toggleSettings}
    >
      <div
        className="w-[460px] bg-white border border-gray-200 rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <span className="text-base font-semibold text-[--text-primary]">Settings</span>
          <button
            onClick={toggleSettings}
            className="w-7 h-7 flex items-center justify-center text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-surface] rounded-md transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className={labelClass}>Provider</label>
            <div className="grid grid-cols-4 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    settings.ai_provider === p.id
                      ? "border-[--accent] bg-[--accent]/10 text-[--accent]"
                      : "border-gray-200 bg-[--bg-surface] text-[--text-secondary] hover:border-gray-300 hover:text-[--text-primary]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>API Key</label>
            <input
              type="password"
              value={settings.api_key}
              onChange={(e) => setSettings({ api_key: e.target.value })}
              placeholder={settings.ai_provider === "ollama" ? "Not required" : "sk-..."}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Base URL</label>
            <input
              type="text"
              value={settings.base_url}
              onChange={(e) => setSettings({ base_url: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Model</label>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => setSettings({ model: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-gray-200">
          <button
            onClick={toggleSettings}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
