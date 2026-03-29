import { useAppState } from "../../stores/appStore";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com/v1" },
  { id: "ollama", label: "Ollama", baseUrl: "http://localhost:11434" },
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
        model: provider.id === "openai" ? "gpt-4"
          : provider.id === "anthropic" ? "claude-sonnet-4-20250514"
          : "llama3",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={toggleSettings}
    >
      <div
        className="w-96 bg-[--bg-secondary] border border-[--border] rounded shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[--border]">
          <span className="text-sm font-medium text-[--text-primary]">Settings</span>
          <button
            onClick={toggleSettings}
            className="w-6 h-6 flex items-center justify-center text-[--text-secondary] hover:text-[--text-primary] rounded transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Provider */}
          <div>
            <label className="block text-[11px] text-[--text-secondary] mb-1 font-mono uppercase tracking-wider">
              Provider
            </label>
            <select
              value={settings.ai_provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-2 py-1.5 bg-[--bg-surface] border border-[--border] rounded text-xs text-[--text-primary] outline-none focus:border-[--accent]"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[11px] text-[--text-secondary] mb-1 font-mono uppercase tracking-wider">
              API Key
            </label>
            <input
              type="password"
              value={settings.api_key}
              onChange={(e) => setSettings({ api_key: e.target.value })}
              placeholder={settings.ai_provider === "ollama" ? "Not required" : "sk-..."}
              className="w-full px-2 py-1.5 bg-[--bg-surface] border border-[--border] rounded text-xs text-[--text-primary] font-mono outline-none focus:border-[--accent] placeholder:text-[--text-secondary]/40"
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-[11px] text-[--text-secondary] mb-1 font-mono uppercase tracking-wider">
              Base URL
            </label>
            <input
              type="text"
              value={settings.base_url}
              onChange={(e) => setSettings({ base_url: e.target.value })}
              className="w-full px-2 py-1.5 bg-[--bg-surface] border border-[--border] rounded text-xs text-[--text-primary] font-mono outline-none focus:border-[--accent]"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-[11px] text-[--text-secondary] mb-1 font-mono uppercase tracking-wider">
              Model
            </label>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => setSettings({ model: e.target.value })}
              className="w-full px-2 py-1.5 bg-[--bg-surface] border border-[--border] rounded text-xs text-[--text-primary] font-mono outline-none focus:border-[--accent]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-2.5 border-t border-[--border]">
          <button
            onClick={toggleSettings}
            className="px-3 py-1 text-xs text-[--text-primary] bg-[--bg-surface] hover:bg-[--border] rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
