import { useState } from "react";
import type { DirDiff } from "../../stores/appStore";

interface DirTreeProps {
  dirDiff: DirDiff;
  onSelectFile: (leftPath: string, rightPath: string) => void;
}

function statusIcon(status: string) {
  switch (status) {
    case "added":
      return <span className="text-[--green] text-[10px] font-mono">A</span>;
    case "deleted":
      return <span className="text-[--red] text-[10px] font-mono">D</span>;
    case "modified":
      return <span className="text-[--yellow] text-[10px] font-mono">M</span>;
    default:
      return <span className="text-[--text-secondary] text-[10px] font-mono"> </span>;
  }
}

function statusBg(status: string) {
  switch (status) {
    case "added":
      return "hover:bg-[--green]/10";
    case "deleted":
      return "hover:bg-[--red]/10";
    case "modified":
      return "hover:bg-[--yellow]/10";
    default:
      return "hover:bg-[--bg-surface]/50";
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DirTree({ dirDiff, onSelectFile }: DirTreeProps) {
  const [filter, setFilter] = useState<string>("");
  const { entries, stats } = dirDiff;

  const filtered = filter
    ? entries.filter((e) =>
        e.relative_path.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  const sorted = [...filtered].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.relative_path.localeCompare(b.relative_path);
  });

  const handleRowClick = (entry: typeof entries[0]) => {
    if (entry.is_dir) return;
    if (entry.status === "same") return;
    const left = entry.left_path || "";
    const right = entry.right_path || "";
    if (left && right) {
      onSelectFile(left, right);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 bg-[--bg-secondary] border-b border-[--border] text-[11px] font-mono text-[--text-secondary] shrink-0">
        <span>{stats.total_left} left</span>
        <span>{stats.total_right} right</span>
        <span className="text-[--green]">{stats.added} added</span>
        <span className="text-[--red]">{stats.deleted} deleted</span>
        <span className="text-[--yellow]">{stats.modified} modified</span>
        <span>{stats.same} same</span>
        <div className="flex-1" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="w-40 px-2 py-0.5 bg-[--bg-surface] border border-[--border] rounded text-[--text-primary] text-[11px] font-mono outline-none focus:border-[--accent]"
        />
      </div>

      {/* Header */}
      <div className="grid grid-cols-[32px_1fr_80px_80px] gap-0 px-3 py-1 bg-[--bg-secondary] border-b border-[--border] text-[10px] font-mono text-[--text-secondary] uppercase tracking-wider shrink-0">
        <span></span>
        <span>Path</span>
        <span className="text-right">Left</span>
        <span className="text-right">Right</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {sorted.map((entry, i) => {
          const depth = entry.relative_path.split("/").length - 1;
          const clickable = !entry.is_dir && entry.status !== "same" && (entry.left_path || entry.right_path);

          return (
            <div
              key={i}
              onClick={() => clickable && handleRowClick(entry)}
              className={`grid grid-cols-[32px_1fr_80px_80px] gap-0 px-3 py-0.5 border-b border-[--border]/30 text-xs font-mono ${statusBg(entry.status)} ${clickable ? "cursor-pointer" : ""}`}
            >
              <span className="flex items-center justify-center">
                {entry.is_dir ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[--text-secondary]">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                ) : (
                  statusIcon(entry.status)
                )}
              </span>
              <span
                className={`truncate text-[--text-primary] ${entry.is_dir ? "font-medium" : ""}`}
                style={{ paddingLeft: depth * 12 }}
              >
                {entry.relative_path.split("/").pop()}
              </span>
              <span className="text-right text-[--text-secondary] text-[11px]">
                {formatSize(entry.size_left)}
              </span>
              <span className="text-right text-[--text-secondary] text-[11px]">
                {formatSize(entry.size_right)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
