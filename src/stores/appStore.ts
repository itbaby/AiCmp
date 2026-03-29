import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  relative_path: string;
  status: string;
  left_path?: string;
  right_path?: string;
  is_dir: boolean;
  size_left?: number;
  size_right?: number;
}

export interface DirDiff {
  entries: DirEntry[];
  stats: {
    total_left: number;
    total_right: number;
    same: number;
    modified: number;
    added: number;
    deleted: number;
  };
}

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AppSettings {
  ai_provider: string;
  api_key: string;
  base_url: string;
  model: string;
}

interface AppState {
  view: "empty" | "file" | "dir";
  leftPath: string;
  rightPath: string;
  leftContent: string;
  rightContent: string;
  dirDiff: DirDiff | null;
  isComparing: boolean;
  error: string | null;
  aiMessages: AiMessage[];
  aiLoading: boolean;
  settings: AppSettings;
  settingsOpen: boolean;

  setView: (view: AppState["view"]) => void;
  compareFiles: (left: string, right: string) => Promise<void>;
  compareDirs: (left: string, right: string) => Promise<void>;
  sendAiMessage: (msg: string) => void;
  setSettings: (s: Partial<AppSettings>) => void;
  toggleSettings: () => void;
}

export function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go",
    java: "java", kt: "kotlin",
    json: "json", yaml: "yaml", yml: "yaml",
    xml: "xml", html: "html", css: "css",
    sql: "sql", sh: "shell", md: "markdown",
    c: "c", h: "c", cpp: "cpp", cs: "csharp",
    rb: "ruby", php: "php", swift: "swift",
    toml: "toml", ini: "ini",
  };
  return map[ext] || "plaintext";
}

export const useAppState = create<AppState>((set) => ({
  view: "empty",
  leftPath: "",
  rightPath: "",
  leftContent: "",
  rightContent: "",
  dirDiff: null,
  isComparing: false,
  error: null,
  aiMessages: [],
  aiLoading: false,
  settings: {
    ai_provider: "openai",
    api_key: "",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
  settingsOpen: false,

  setView: (view) => set({ view }),

  compareFiles: async (left, right) => {
    set({ isComparing: true, error: null });
    try {
      const [leftContent, rightContent] = await Promise.all([
        invoke<string>("read_file_content", { path: left }),
        invoke<string>("read_file_content", { path: right }),
      ]);
      set({
        view: "file",
        leftPath: left,
        rightPath: right,
        leftContent,
        rightContent,
        isComparing: false,
      });
    } catch (e: any) {
      set({ error: String(e), isComparing: false });
    }
  },

  compareDirs: async (left, right) => {
    set({ isComparing: true, error: null });
    try {
      const diff = await invoke<DirDiff>("compare_directories", {
        leftDir: left,
        rightDir: right,
      });
      set({
        view: "dir",
        leftPath: left,
        rightPath: right,
        dirDiff: diff,
        isComparing: false,
      });
    } catch (e: any) {
      set({ error: String(e), isComparing: false });
    }
  },

  sendAiMessage: (msg) => {
    set((state) => ({
      aiMessages: [...state.aiMessages, { role: "user", content: msg }],
      aiLoading: true,
    }));
    invoke("ai_chat", { message: msg })
      .then(() => {
        set({ aiLoading: false });
      })
      .catch((e: any) => {
        set((s) => ({
          aiLoading: false,
          aiMessages: [...s.aiMessages, { role: "assistant", content: `Error: ${String(e)}` }],
        }));
      });
  },

  setSettings: (s) => {
    set((state) => {
      const newSettings = { ...state.settings, ...s };
      invoke("save_settings", { settings: newSettings }).catch(() => {});
      return { settings: newSettings };
    });
  },

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
}));
