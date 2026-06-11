"use client";

import { useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocumentViewerProps {
  markdown?: string;
  isLoading?: boolean;
  patterns?: string[];
  confidence?: number;
  fileName?: string;
}

export default function DocumentViewer({
  markdown,
  isLoading,
  patterns,
  confidence,
  fileName,
}: DocumentViewerProps) {
  const hasContent = !!markdown;

  const handleSave = useCallback(async () => {
    if (!markdown) return;
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: fileName ? `${fileName.replace(/\.[^.]+$/, "")}_architecture.md` : "architecture_report.md",
        types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(markdown);
      await writable.close();
    } catch { /* cancelled */ }
  }, [markdown, fileName]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      {(hasContent || isLoading) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Architecture Report
          </span>

          {patterns && patterns.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {patterns.map((p) => (
                <span key={p} className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-bright">{p}</span>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {confidence !== undefined && (
              <span className="text-[10px] font-mono text-text-muted">
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
            {hasContent && (
              <button
                onClick={handleSave}
                className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <path d="M17 21v-8H7v8" /><path d="M7 3v5h8" />
                </svg>
                Export
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-3 px-6 py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
            <span className="text-sm text-text-muted">Analyzing codebase architecture...</span>
          </div>
        ) : hasContent ? (
          <div className="px-6 py-5">
            <article className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
            <p className="text-sm text-text-muted text-center">
              Open a folder and click <span className="font-semibold text-text-secondary">Analyze</span> to generate an architecture report.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
