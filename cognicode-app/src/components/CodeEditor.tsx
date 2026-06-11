"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useRef, useCallback } from "react";

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", json: "json", css: "css", scss: "scss", less: "less",
  html: "html", xml: "xml", md: "markdown", yaml: "yaml", yml: "yaml",
  toml: "ini", sql: "sql", sh: "shell", bash: "shell", go: "go",
  rs: "rust", java: "java", cpp: "cpp", c: "c", cs: "csharp",
  rb: "ruby", php: "php", swift: "swift", kt: "kotlin", dart: "dart",
  svelte: "html", vue: "html", graphql: "graphql", dockerfile: "dockerfile",
  makefile: "makefile", env: "ini", gitignore: "ini", txt: "plaintext",
  log: "plaintext", csv: "plaintext",
};

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: "TypeScript", javascript: "JavaScript", python: "Python",
  json: "JSON", css: "CSS", html: "HTML", markdown: "Markdown",
  yaml: "YAML", sql: "SQL", shell: "Shell", go: "Go", rust: "Rust",
  java: "Java", cpp: "C++", c: "C", ruby: "Ruby", php: "PHP",
  swift: "Swift", kotlin: "Kotlin", dart: "Dart", graphql: "GraphQL",
  ini: "Config", plaintext: "Text",
};

function getLanguageFromFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return EXT_TO_LANGUAGE[filename.toLowerCase()] || "plaintext";
  return EXT_TO_LANGUAGE[filename.slice(dotIndex + 1).toLowerCase()] || "plaintext";
}

interface CodeEditorProps {
  fileName?: string;
  fileContent?: string;
  onCodeChange?: (code: string) => void;
  onAnalyze?: (code: string) => void;
  isAnalyzing?: boolean;
  hasCodebase?: boolean;
}

export default function CodeEditor({
  fileName,
  fileContent,
  onCodeChange,
  onAnalyze,
  isAnalyzing,
  hasCodebase,
}: CodeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const hasFile = fileName !== undefined && fileContent !== undefined;
  const displayName = fileName || "No file open";
  const content = fileContent || "";
  const language = hasFile ? getLanguageFromFilename(displayName) : "plaintext";
  const languageLabel = hasFile ? (LANGUAGE_LABELS[language] || language) : "";

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      onCodeChange?.(value);
    });
  }, [onCodeChange]);

  const handleAnalyze = useCallback(() => {
    const code = editorRef.current?.getValue() || content;
    onAnalyze?.(code);
  }, [content, onAnalyze]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-danger/60"></div>
          <div className="h-3 w-3 rounded-full bg-warning/60"></div>
          <div className="h-3 w-3 rounded-full bg-success/60"></div>
        </div>
        <div className="h-4 w-px bg-border"></div>
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-bright">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="font-mono text-sm font-medium text-text-secondary">
            {displayName}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (!hasFile && !hasCodebase)}
            className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-bright transition-all hover:bg-accent/25 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            )}
            {isAnalyzing ? "Analyzing..." : hasCodebase ? "Analyze Codebase" : "Analyze"}
          </button>
          {hasFile && languageLabel && (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-mono text-xs font-medium text-accent-bright">
              {languageLabel}
            </span>
          )}
        </div>
      </div>
      <div className="relative flex-1">
        {!hasFile ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted/30">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div className="text-center max-w-xs">
              <p className="text-sm font-medium text-text-secondary">No file open</p>
              <p className="mt-1 text-xs text-text-muted">
                Open a folder from the explorer to start analyzing code
              </p>
            </div>
          </div>
        ) : (
          <Editor
            language={language}
            value={content}
            theme="vs-dark"
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13.5,
              fontFamily: "var(--font-geist-mono), 'Fira Code', monospace",
              lineHeight: 22,
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              renderLineHighlight: "gutter",
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              smoothScrolling: true,
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, verticalSliderSize: 6 },
              contextmenu: false,
              folding: true,
              lineNumbers: "on",
              wordWrap: "off",
              automaticLayout: true,
              readOnly: false,
            }}
          />
        )}
      </div>
    </div>
  );
}
