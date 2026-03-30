import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  changes: DiffChange[];
}

export interface DiffChange {
  change_type: "equal" | "delete" | "insert";
  old_line_index: number | null;
  new_line_index: number | null;
  content: string;
}

export interface FileDiff {
  hunks: DiffHunk[];
  stats: { insertions: number; deletions: number; unchanged: number };
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
  fileDiff: FileDiff | null;
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
  setLeftContent: (content: string) => void;
  setRightContent: (content: string) => void;
  saveContent: (side: "left" | "right", content: string) => Promise<void>;
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

export function computeHunks(leftLines: string[], rightLines: string[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let li = 0, ri = 0;

  while (li < leftLines.length || ri < rightLines.length) {
    const changes: DiffChange[] = [];
    const hunkOldStart = li;
    const hunkNewStart = ri;

    while (li < leftLines.length && ri < rightLines.length && leftLines[li] === rightLines[ri]) {
      changes.push({ change_type: "equal", old_line_index: li, new_line_index: ri, content: leftLines[li] + "\n" });
      li++; ri++;
    }

    while (li < leftLines.length && (ri >= rightLines.length || leftLines[li] !== rightLines[ri])) {
      let found = false;
      for (let k = ri; k < rightLines.length; k++) {
        if (leftLines[li] === rightLines[k]) { found = true; break; }
      }
      if (found) break;
      changes.push({ change_type: "delete", old_line_index: li, new_line_index: null, content: leftLines[li] + "\n" });
      li++;
    }

    while (ri < rightLines.length && (li >= leftLines.length || leftLines[li] !== rightLines[ri])) {
      let found = false;
      for (let k = li; k < leftLines.length; k++) {
        if (leftLines[k] === rightLines[ri]) { found = true; break; }
      }
      if (found) break;
      changes.push({ change_type: "insert", old_line_index: null, new_line_index: ri, content: rightLines[ri] + "\n" });
      ri++;
    }

    if (changes.length === 0) {
      if (li < leftLines.length) { changes.push({ change_type: "delete", old_line_index: li, new_line_index: null, content: leftLines[li] + "\n" }); li++; }
      else if (ri < rightLines.length) { changes.push({ change_type: "insert", old_line_index: null, new_line_index: ri, content: rightLines[ri] + "\n" }); ri++; }
    }

    let oldCount = 0, newCount = 0;
    for (const c of changes) {
      if (c.change_type === "equal" || c.change_type === "delete") oldCount++;
      if (c.change_type === "equal" || c.change_type === "insert") newCount++;
    }

    hunks.push({
      old_start: hunkOldStart,
      old_lines: oldCount,
      new_start: hunkNewStart,
      new_lines: newCount,
      changes,
    });
  }

  return hunks;
}

export const useAppState = create<AppState>((set, get) => ({
  view: "empty",
  leftPath: "",
  rightPath: "",
  leftContent: "",
  rightContent: "",
  fileDiff: null,
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
      const hunks = computeHunks(leftContent.split("\n"), rightContent.split("\n"));
      set({
        view: "file",
        leftPath: left,
        rightPath: right,
        leftContent,
        rightContent,
        fileDiff: { hunks, stats: { insertions: 0, deletions: 0, unchanged: 0 } },
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

  setLeftContent: (content) => set({ leftContent: content }),
  setRightContent: (content) => set({ rightContent: content }),

  saveContent: async (side, content) => {
    const path = side === "left" ? get().leftPath : get().rightPath;
    await invoke("write_file_content", { path, content });
  },

  sendAiMessage: (msg) => {
    set((state) => ({
      aiMessages: [...state.aiMessages, { role: "user", content: msg }],
      aiLoading: true,
    }));

    const state = get();
    const isFileView = state.view === "file" && state.leftContent && state.rightContent;

    let unlisten: (() => void) | null = null;

    listen<any>("ai-event", (event) => {
      const payload = event.payload;
      if (payload.type === "final_response") {
        set((s) => ({
          aiMessages: [...s.aiMessages, { role: "assistant", content: payload.content }],
          aiLoading: false,
        }));
        unlisten?.();
      } else if (payload.type === "thought" && payload.content) {
        set((s) => {
          const msgs = [...s.aiMessages];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, content: last.content + payload.content };
          } else {
            msgs.push({ role: "assistant", content: payload.content });
          }
          return { aiMessages: msgs };
        });
      }
    }).then((fn) => { unlisten = fn; });

    invoke("ai_chat", {
      message: msg,
      ...(isFileView ? {
        leftContent: state.leftContent,
        rightContent: state.rightContent,
        leftPath: state.leftPath,
        rightPath: state.rightPath,
      } : {}),
    }).catch((e: any) => {
      set((s) => ({
        aiLoading: false,
        aiMessages: [...s.aiMessages, { role: "assistant", content: `Error: ${String(e)}` }],
      }));
       unlisten?.();
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
