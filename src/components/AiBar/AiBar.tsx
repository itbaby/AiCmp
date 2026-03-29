import { useState, useRef, useEffect } from "react";
import { useAppState } from "../../stores/appStore";

export function AiBar() {
  const messages = useAppState((s) => s.aiMessages);
  const aiLoading = useAppState((s) => s.aiLoading);
  const sendAiMessage = useAppState((s) => s.sendAiMessage);
  const view = useAppState((s) => s.view);

  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0 && !expanded) {
      setExpanded(true);
    }
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || aiLoading) return;
    sendAiMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="shrink-0 border-t border-[--border] bg-[--bg-secondary]">
      {/* Messages area */}
      {expanded && hasMessages && (
        <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-1.5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-xs font-mono leading-relaxed ${
                msg.role === "user"
                  ? "text-[--accent]"
                  : "text-[--text-secondary]"
              }`}
            >
              <span className="text-[--text-secondary]/50 mr-1.5">
                {msg.role === "user" ? ">" : "AI"}
              </span>
              <span className="whitespace-pre-wrap break-words">{msg.content}</span>
            </div>
          ))}
          {aiLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="text-xs font-mono text-[--text-secondary] animate-pulse">
              <span className="text-[--text-secondary]/50 mr-1.5">AI</span>
              ...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-1 px-2 py-1">
        <span className="text-[10px] text-[--text-secondary]/50 font-mono shrink-0">AI</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            view === "empty"
              ? "Ask AI about anything..."
              : "Ask AI about the comparison..."
          }
          className="flex-1 px-2 py-1 bg-[--bg-surface] border border-[--border] rounded text-xs font-mono text-[--text-primary] outline-none focus:border-[--accent] placeholder:text-[--text-secondary]/40"
          disabled={aiLoading}
        />
        <button
          onClick={handleSend}
          disabled={aiLoading || !input.trim()}
          className="flex items-center justify-center w-7 h-7 text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-surface] rounded transition-colors disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
        {hasMessages && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center w-7 h-7 text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-surface] rounded transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
