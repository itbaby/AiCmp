import { open } from "@tauri-apps/plugin-dialog";
import { useAppState } from "../../stores/appStore";

export function Toolbar() {
  const compareFiles = useAppState((s) => s.compareFiles);
  const compareDirs = useAppState((s) => s.compareDirs);
  const toggleSettings = useAppState((s) => s.toggleSettings);
  const isComparing = useAppState((s) => s.isComparing);

  const handleOpenFiles = async () => {
    const left = await open({ multiple: false, directory: false, title: "Select left file" });
    if (!left) return;
    const right = await open({ multiple: false, directory: false, title: "Select right file" });
    if (!right) return;
    compareFiles(left as string, right as string);
  };

  const handleOpenDirs = async () => {
    const left = await open({ multiple: false, directory: true, title: "Select left directory" });
    if (!left) return;
    const right = await open({ multiple: false, directory: true, title: "Select right directory" });
    if (!right) return;
    compareDirs(left as string, right as string);
  };

  const handleGitCompare = async () => {
    const repoPath = await open({ multiple: false, directory: true, title: "Select Git repository" });
    if (!repoPath) return;
    // TODO: Implement git compare UI - select commits/branches
  };

  return (
    <div className="h-9 flex items-center justify-between px-2 bg-[--bg-secondary] border-b border-gray-200 select-none shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[--text-secondary] tracking-wide">AiCmp</span>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={handleOpenFiles}
          disabled={isComparing}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-surface] rounded transition-colors disabled:opacity-50"
          title="Compare files"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Files
        </button>

        <button
          onClick={handleOpenDirs}
          disabled={isComparing}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-surface] rounded transition-colors disabled:opacity-50"
          title="Compare directories"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Dirs
        </button>

        <button
          onClick={handleGitCompare}
          disabled={isComparing}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-surface] rounded transition-colors disabled:opacity-50"
          title="Git compare"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <line x1="3" y1="12" x2="9" y2="12" />
            <line x1="15" y1="12" x2="21" y2="12" />
            <line x1="12" y1="3" x2="12" y2="9" />
            <line x1="12" y1="15" x2="12" y2="21" />
          </svg>
          Git
        </button>
      </div>

      <button
        onClick={toggleSettings}
        className="flex items-center justify-center w-7 h-7 text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-surface] rounded transition-colors"
        title="Settings"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
