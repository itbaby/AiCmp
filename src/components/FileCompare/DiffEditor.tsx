import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useAppState, getLanguageFromPath, computeHunks } from "../../stores/appStore";

loader.config({ monaco });

type MergeBlock = {
  type: "equal" | "change";
  leftStart: number;
  leftEnd: number;
  rightStart: number;
  rightEnd: number;
};

type Connector = {
  lt: number; lb: number;
  rt: number; rb: number;
  fill: string; stroke: string;
  block: MergeBlock;
};

function buildMergeBlocks(leftLines: string[], rightLines: string[]): MergeBlock[] {
  const hunks = computeHunks(leftLines, rightLines);
  const blocks: MergeBlock[] = [];
  let li = 0, ri = 0;

  for (const hunk of hunks) {
    const eqStart = Math.max(li, ri);
    if (hunk.old_start > li || hunk.new_start > ri) {
      const eqEnd = Math.min(hunk.old_start, hunk.new_start);
      if (eqEnd > eqStart) {
        blocks.push({ type: "equal", leftStart: li, leftEnd: eqEnd, rightStart: ri, rightEnd: eqEnd });
      }
      li = eqEnd; ri = eqEnd;
    }

    const dels = hunk.changes.filter(c => c.change_type === "delete");
    const ins = hunk.changes.filter(c => c.change_type === "insert");
    if (dels.length > 0 || ins.length > 0) {
      const lStart = dels.length > 0 ? (dels[0].old_line_index ?? li) : li;
      const rStart = ins.length > 0 ? (ins[0].new_line_index ?? ri) : ri;
      const lEnd = dels.length > 0 ? (dels[dels.length - 1].old_line_index ?? li) + 1 : li;
      const rEnd = ins.length > 0 ? (ins[ins.length - 1].new_line_index ?? ri) + 1 : ri;
      blocks.push({ type: "change", leftStart: lStart, leftEnd: lEnd, rightStart: rStart, rightEnd: rEnd });
      li = Math.max(li, lEnd); ri = Math.max(ri, rEnd);
    }
  }
  return blocks;
}

const EDITOR_OPTS: editor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  lineNumbers: "on",
  renderLineHighlight: "all",
  folding: false,
  wordWrap: "off",
  automaticLayout: true,
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  contextmenu: false,
};

function injectStyles() {
  if (document.getElementById("meld-diff-css")) return;
  const s = document.createElement("style");
  s.id = "meld-diff-css";
  s.textContent = `
    .md-del { background: #ffebe9 !important; }
    .md-ins { background: #e6ffec !important; }
    .md-del-bar { background: #e22a48; width: 4px !important; margin-left: 3px; }
    .md-ins-bar { background: #1a85ff; width: 4px !important; margin-left: 3px; }
  `;
  document.head.appendChild(s);
}

const GUTTER = 48;
const MIN_B = 6;

function ArrowIcon({ dir }: { dir: "L" | "R" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {dir === "R"
        ? <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>
        : <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 5 5 12 12 19" /></>}
    </svg>
  );
}

interface Props {
  leftContent: string;
  rightContent: string;
  leftPath: string;
  rightPath: string;
}

export function DiffEditorView({ leftContent, rightContent, leftPath, rightPath }: Props) {
  const lang = getLanguageFromPath(leftPath || rightPath);
  const leftEd = useRef<editor.IStandaloneCodeEditor | null>(null);
  const rightEd = useRef<editor.IStandaloneCodeEditor | null>(null);
  const leftDec = useRef<editor.IEditorDecorationsCollection | null>(null);
  const rightDec = useRef<editor.IEditorDecorationsCollection | null>(null);
  const raf = useRef(0);
  const setLeft = useAppState(s => s.setLeftContent);
  const setRight = useAppState(s => s.setRightContent);

  const [ready, setReady] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);

  const blocks = useMemo(
    () => buildMergeBlocks(leftContent.split("\n"), rightContent.split("\n")),
    [leftContent, rightContent],
  );
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  useEffect(() => { injectStyles(); }, []);

  const onLeft: OnMount = useCallback(ed => { leftEd.current = ed; if (rightEd.current) setReady(true); }, []);
  const onRight: OnMount = useCallback(ed => { rightEd.current = ed; if (leftEd.current) setReady(true); }, []);

  const refresh = useCallback(() => {
    const le = leftEd.current, re = rightEd.current;
    if (!le || !re) return;
    const st = le.getScrollTop();
    const bl = blocksRef.current;
    const out: Connector[] = [];

    for (const b of bl) {
      if (b.type !== "change") continue;
      const hL = b.leftEnd > b.leftStart;
      const hR = b.rightEnd > b.rightStart;

      let lt = le.getTopForLineNumber(b.leftStart + 1) - st;
      let lb = hL ? le.getTopForLineNumber(b.leftEnd + 1) - st : lt;
      let rt = re.getTopForLineNumber(b.rightStart + 1) - st;
      let rb = hR ? re.getTopForLineNumber(b.rightEnd + 1) - st : rt;

      if (lb - lt < MIN_B) { const m = (lt + lb) / 2; lt = m - MIN_B / 2; lb = m + MIN_B / 2; }
      if (rb - rt < MIN_B) { const m = (rt + rb) / 2; rt = m - MIN_B / 2; rb = m + MIN_B / 2; }

      const mod = hL && hR;
      out.push({
        lt, lb, rt, rb, block: b,
        fill: mod ? "rgba(255,166,0,0.16)" : hL ? "rgba(255,68,68,0.14)" : "rgba(68,180,68,0.14)",
        stroke: mod ? "rgba(255,166,0,0.45)" : hL ? "rgba(255,68,68,0.35)" : "rgba(68,180,68,0.35)",
      });
    }
    setConnectors(out);
  }, []);

  // scroll sync + connector refresh
  useEffect(() => {
    if (!ready) return;
    const le = leftEd.current!, re = rightEd.current!;
    const sched = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(refresh); };
    const d1 = le.onDidScrollChange(e => {
      if (e.scrollTopChanged) re.setScrollTop(e.scrollTop);
      if (e.scrollLeftChanged) re.setScrollLeft(e.scrollLeft);
      sched();
    });
    const d2 = re.onDidScrollChange(e => {
      if (e.scrollTopChanged) le.setScrollTop(e.scrollTop);
      if (e.scrollLeftChanged) le.setScrollLeft(e.scrollLeft);
      sched();
    });
    refresh();
    return () => { d1.dispose(); d2.dispose(); cancelAnimationFrame(raf.current); };
  }, [ready, refresh]);

  // refresh on content change
  useEffect(() => { if (ready) refresh(); }, [ready, blocks, refresh]);

  // decorations
  useEffect(() => {
    if (!ready) return;
    const le = leftEd.current!, re = rightEd.current!;
    leftDec.current?.clear(); rightDec.current?.clear();
    const ld: editor.IModelDeltaDecoration[] = [];
    const rd: editor.IModelDeltaDecoration[] = [];
    for (const b of blocks) {
      if (b.type !== "change") continue;
      if (b.leftEnd > b.leftStart) ld.push({
        range: new monaco.Range(b.leftStart + 1, 1, b.leftEnd, 1),
        options: { isWholeLine: true, className: "md-del", linesDecorationsClassName: "md-del-bar" },
      });
      if (b.rightEnd > b.rightStart) rd.push({
        range: new monaco.Range(b.rightStart + 1, 1, b.rightEnd, 1),
        options: { isWholeLine: true, className: "md-ins", linesDecorationsClassName: "md-ins-bar" },
      });
    }
    leftDec.current = le.createDecorationsCollection(ld);
    rightDec.current = re.createDecorationsCollection(rd);
  }, [ready, blocks]);

  const merge = (b: MergeBlock, dir: "L" | "R") => {
    const ll = leftContent.split("\n"), rl = rightContent.split("\n");
    if (dir === "R") {
      rl.splice(b.rightStart, b.rightEnd - b.rightStart, ...ll.slice(b.leftStart, b.leftEnd));
      setRight(rl.join("\n"));
    } else {
      ll.splice(b.leftStart, b.leftEnd - b.leftStart, ...rl.slice(b.rightStart, b.rightEnd));
      setLeft(ll.join("\n"));
    }
  };

  const svgPath = (c: Connector) => {
    const mx = GUTTER / 2;
    return `M0,${c.lt} C${mx},${c.lt} ${mx},${c.rt} ${GUTTER},${c.rt} L${GUTTER},${c.rb} C${mx},${c.rb} ${mx},${c.lb} 0,${c.lb} Z`;
  };

  return (
    <div className="h-full w-full flex">
      <div className="flex-1 min-w-0">
        <Editor language={lang} value={leftContent} theme="vs" onMount={onLeft} options={EDITOR_OPTS} />
      </div>
      <div className="shrink-0 relative border-l border-r border-gray-200 bg-white" style={{ width: GUTTER }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {connectors.map((c, i) => (
            <path key={i} d={svgPath(c)} fill={c.fill} stroke={c.stroke} strokeWidth={1} />
          ))}
        </svg>
        {connectors.map((c, i) => {
          const cy = (c.lt + c.lb + c.rt + c.rb) / 4;
          const hL = c.block.leftEnd > c.block.leftStart;
          const hR = c.block.rightEnd > c.block.rightStart;
          return (
            <div key={i} className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ top: cy - (hL && hR ? 14 : 8) }}>
              {hL && (
                <button onClick={() => merge(c.block, "R")} className="w-6 h-5 flex items-center justify-center rounded bg-white/90 shadow-sm text-[#e22a48] hover:bg-red-50 border border-gray-200 transition-colors" title="Copy to right">
                  <ArrowIcon dir="R" />
                </button>
              )}
              {hR && (
                <button onClick={() => merge(c.block, "L")} className="w-6 h-5 flex items-center justify-center rounded bg-white/90 shadow-sm text-[#1a85ff] hover:bg-blue-50 border border-gray-200 transition-colors" title="Copy to left">
                  <ArrowIcon dir="L" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex-1 min-w-0">
        <Editor language={lang} value={rightContent} theme="vs" onMount={onRight} options={EDITOR_OPTS} />
      </div>
    </div>
  );
}
