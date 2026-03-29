import { DiffEditor } from "@monaco-editor/react";
import { getLanguageFromPath } from "../../stores/appStore";

interface DiffEditorViewProps {
  leftContent: string;
  rightContent: string;
  leftPath: string;
  rightPath: string;
}

export function DiffEditorView({ leftContent, rightContent, leftPath, rightPath }: DiffEditorViewProps) {
  const language = getLanguageFromPath(leftPath || rightPath);

  return (
    <div className="h-full w-full">
      <DiffEditor
        original={leftContent}
        modified={rightContent}
        originalLanguage={language}
        modifiedLanguage={language}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          lineNumbers: "on",
          renderLineHighlight: "all",
          folding: true,
          wordWrap: "off",
          automaticLayout: true,
        }}
        originalModelPath={leftPath}
        modifiedModelPath={rightPath}
      />
    </div>
  );
}
