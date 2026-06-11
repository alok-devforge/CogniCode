"use client";

import { useState, useCallback } from "react";
import { generateDesignDocs } from "@/lib/api";

interface DesignDocsPanelProps {
  hasCodebase?: boolean;
  codebaseFiles?: { path: string; content: string }[];
  folderName?: string;
}

export default function DesignDocsPanel({
  hasCodebase,
  codebaseFiles,
  folderName,
}: DesignDocsPanelProps) {
  const [activeDoc, setActiveDoc] = useState<"hld" | "lld">("hld");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hldContent, setHldContent] = useState<string | null>(null);
  const [lldContent, setLldContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    generation_time_ms: number;
    files_analyzed: number;
    total_classes: number;
    total_functions: number;
  } | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!codebaseFiles?.length) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateDesignDocs({
        folder_name: folderName || "project",
        files: codebaseFiles,
      });
      setHldContent(res.hld);
      setLldContent(res.lld);
      setStats({
        generation_time_ms: res.generation_time_ms,
        files_analyzed: res.files_analyzed,
        total_classes: res.total_classes,
        total_functions: res.total_functions,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate design docs");
    } finally {
      setIsGenerating(false);
    }
  }, [codebaseFiles, folderName]);

  const currentContent = activeDoc === "hld" ? hldContent : lldContent;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-accent-bright"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="text-sm font-semibold text-text-primary">
            Design Documents
          </span>
          {stats && (
            <span className="text-[10px] text-text-muted ml-auto font-mono">
              {stats.files_analyzed} files · {stats.total_classes} classes ·{" "}
              {stats.total_functions} functions · {stats.generation_time_ms.toFixed(0)}ms
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5">
          Auto-generate HLD &amp; LLD from your code graph — 100% local, no LLM
          needed
        </p>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 border-b border-border px-5 py-2.5 flex items-center gap-3">
        {/* HLD / LLD toggle */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setActiveDoc("hld")}
            className={`px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              activeDoc === "hld"
                ? "bg-accent/15 text-accent-bright"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            HLD
          </button>
          <button
            onClick={() => setActiveDoc("lld")}
            className={`px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              activeDoc === "lld"
                ? "bg-accent/15 text-accent-bright"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            LLD
          </button>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !hasCodebase}
          className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent-bright hover:bg-accent/25 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <svg
                className="h-3 w-3 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  fill="currentColor"
                  className="opacity-75"
                />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {hldContent ? "Regenerate" : "Generate"}
            </>
          )}
        </button>

        {!hasCodebase && (
          <span className="text-[10px] text-text-muted">
            Open a codebase first
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 rounded-lg bg-danger/10 px-4 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {currentContent ? (
          <div className="px-6 py-5">
            <div className="prose prose-invert prose-sm max-w-none">
              <MarkdownRenderer content={currentContent} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-text-muted/30"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <div className="text-center max-w-xs">
              <p className="text-sm text-text-muted">
                Generate design documents
              </p>
              <p className="mt-1 text-xs text-text-muted/60">
                <strong>HLD</strong> — System overview, module architecture,
                data flow diagrams, external dependencies, coupling hotspots.
                <br />
                <strong>LLD</strong> — Class diagrams (Mermaid), function
                signatures, dependency matrix, sequence flows, complexity
                ranking.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Simple markdown renderer — renders headings, tables, code blocks, lists, bold */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Mermaid / code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      if (lang === "mermaid") {
        elements.push(
          <div
            key={elements.length}
            className="my-3 rounded-lg bg-zinc-900/50 border border-border px-4 py-3 overflow-x-auto"
          >
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
              Mermaid Diagram
            </div>
            <pre className="text-xs text-accent-bright font-mono whitespace-pre leading-relaxed">
              {codeLines.join("\n")}
            </pre>
          </div>
        );
      } else {
        elements.push(
          <pre
            key={elements.length}
            className="my-3 rounded-lg bg-zinc-900/50 border border-border px-4 py-3 text-xs font-mono text-text-secondary overflow-x-auto"
          >
            {codeLines.join("\n")}
          </pre>
        );
      }
      continue;
    }

    // Table
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].includes("|") &&
        lines[i].trim().startsWith("|")
      ) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter((l) => !l.match(/^\|[\s-|]+\|$/))
        .map((l) =>
          l
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        );
      if (rows.length > 0) {
        const header = rows[0];
        const body = rows.slice(1);
        elements.push(
          <div
            key={elements.length}
            className="my-3 overflow-x-auto rounded-lg border border-border"
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-alt/50">
                  {header.map((h, j) => (
                    <th
                      key={j}
                      className="px-3 py-2 text-left font-semibold text-text-secondary"
                    >
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-border/30 last:border-0"
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 text-text-muted"
                      >
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={elements.length}
          className="text-xl font-bold text-text-primary mt-6 mb-2"
        >
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={elements.length}
          className="text-lg font-bold text-text-primary mt-5 mb-2 border-b border-border/30 pb-1"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={elements.length}
          className="text-sm font-bold text-text-primary mt-4 mb-1"
        >
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("---")) {
      elements.push(
        <hr key={elements.length} className="my-4 border-border/30" />
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div
          key={elements.length}
          className="flex items-start gap-2 text-xs text-text-muted ml-2"
        >
          <span className="mt-1.5 h-1 w-1 rounded-full bg-text-muted/40 shrink-0" />
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.startsWith("  - ")) {
      elements.push(
        <div
          key={elements.length}
          className="flex items-start gap-2 text-xs text-text-muted ml-6"
        >
          <span className="mt-1.5 h-1 w-1 rounded-full bg-text-muted/30 shrink-0" />
          <span>{renderInline(line.slice(4))}</span>
        </div>
      );
    } else if (line.startsWith("*") && line.endsWith("*")) {
      elements.push(
        <p
          key={elements.length}
          className="text-xs text-text-muted/60 italic my-1"
        >
          {line.replace(/^\*+/, "").replace(/\*+$/, "")}
        </p>
      );
    } else if (line.trim()) {
      elements.push(
        <p key={elements.length} className="text-xs text-text-muted my-0.5">
          {renderInline(line)}
        </p>
      );
    } else {
      elements.push(<div key={elements.length} className="h-1" />);
    }

    i++;
  }

  return <>{elements}</>;
}

/* Inline rendering: `code`, **bold**, emojis */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-zinc-800/60 px-1 py-0.5 text-[10px] font-mono text-accent-bright"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
