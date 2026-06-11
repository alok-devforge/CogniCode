"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { queryRAG, type RAGQueryResponse } from "@/lib/api";

interface RAGPanelProps {
  ragStatus?: string;
}

export default function RAGPanel({ ragStatus }: RAGPanelProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RAGQueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await queryRAG({ query, top_k: 5 });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleQuery();
      }
    },
    [handleQuery]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <p className="text-sm font-medium text-text-primary">Context-Aware RAG Engine</p>
        <p className="text-xs text-text-muted mt-0.5">
          {ragStatus ? (
            <span className="text-accent-bright">{ragStatus}</span>
          ) : (
            "Ask questions about your codebase \u2014 answers use ingested project files"
          )}
        </p>
      </div>

      {/* Query Input */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about architecture, patterns, best practices..."
              className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <button
            onClick={handleQuery}
            disabled={isLoading || !query.trim()}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-accent/15 px-4 py-2 text-xs font-semibold text-accent-bright transition-all hover:bg-accent/25 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" x2="11" y1="2" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
            Query
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <div className="mb-3 rounded-lg bg-danger/10 px-4 py-2 text-xs text-danger">{error}</div>
        )}

        {result ? (
          <div className="space-y-5">
            {/* Answer */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-bright">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span className="text-xs font-semibold text-text-primary">AI Answer</span>
              </div>
              <div className="markdown-body rounded-lg bg-accent/5 border border-accent/10 px-4 py-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.answer}
                </ReactMarkdown>
              </div>
            </div>

            {/* Retrieved Documents */}
            {result.retrieved_documents.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="text-xs font-semibold text-text-secondary">
                    Retrieved Documents ({result.retrieved_documents.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {result.retrieved_documents.map((doc, i) => (
                    <div key={i} className="rounded-lg border border-border bg-surface-alt px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-text-muted">{doc.source}</span>
                        <span className="rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-medium text-purple-400">
                          {Math.round(doc.relevance_score * 100)}% match
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary line-clamp-3">{doc.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-muted/30">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <div className="text-center max-w-xs">
              <p className="text-sm text-text-muted">Ask a question about your codebase</p>
              <p className="mt-1 text-xs text-text-muted/60">
                Try: &quot;What design patterns does this project use?&quot; or &quot;How is error handling implemented?&quot;
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
