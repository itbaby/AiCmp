import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "./components/Layout/Toolbar";
import { DiffEditorView } from "./components/FileCompare/DiffEditor";
import { DirTree } from "./components/DirCompare/DirTree";
import { AiBar } from "./components/AiBar/AiBar";
import { SettingsDialog } from "./components/Settings/SettingsDialog";
import { useAppState } from "./stores/appStore";

export default function App() {
  const view = useAppState((s) => s.view);
  const leftContent = useAppState((s) => s.leftContent);
  const rightContent = useAppState((s) => s.rightContent);
  const leftPath = useAppState((s) => s.leftPath);
  const rightPath = useAppState((s) => s.rightPath);
  const dirDiff = useAppState((s) => s.dirDiff);
  const isComparing = useAppState((s) => s.isComparing);
  const error = useAppState((s) => s.error);
  const settingsOpen = useAppState((s) => s.settingsOpen);
  const compareFiles = useAppState((s) => s.compareFiles);

  useEffect(() => {
    invoke<any>("load_settings").then((s) => {
      if (s) useAppState.getState().setSettings(s);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <Toolbar />
      <main className="flex-1 overflow-hidden relative">
        {isComparing && (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-secondary)" }}>
            Comparing...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-sm font-mono p-4" style={{ color: "var(--red)" }}>
            {error}
          </div>
        )}
        {!isComparing && !error && view === "empty" && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "var(--text-secondary)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.4}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-sm">Open files or directories to compare</span>
          </div>
        )}
        {!isComparing && !error && view === "file" && (
          <DiffEditorView
            leftContent={leftContent}
            rightContent={rightContent}
            leftPath={leftPath}
            rightPath={rightPath}
          />
        )}
        {!isComparing && !error && view === "dir" && dirDiff && (
          <DirTree
            dirDiff={dirDiff}
            onSelectFile={(l, r) => compareFiles(l, r)}
          />
        )}
      </main>
      <AiBar />
      {settingsOpen && <SettingsDialog />}
    </div>
  );
}
