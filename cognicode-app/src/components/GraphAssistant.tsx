"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assistantChat, type CodebaseFileItem } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    files_analyzed: string[];
    selected_count: number;
    total_files: number;
    token_savings_pct: number;
    token_estimate_full: number;
    token_estimate_surgical: number;
    search_keywords: string[];
    relevant_files: {
      path: string;
      relevance_score: number;
      match_reasons: string[];
      classes: string[];
      functions: string[];
      lines: number;
      language: string;
    }[];
    model_used: string;
    prompt_tokens: number;
  };
}

interface GraphAssistantProps {
  allFiles: CodebaseFileItem[];
  folderName: string;
  hasCodebase: boolean;
}

// ── Graph Context Panel ─────────────────────────────────────────────────

function GraphContextPanel({ metadata }: { metadata: Message["metadata"] }) {
  const [expanded, setExpanded] = useState(true);
  if (!metadata) return null;

  const tokensSaved = metadata.token_estimate_full - metadata.token_estimate_surgical;

  return (
    <div className="mt-2 rounded-xl border border-border bg-surface/50 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs">🎯</span>
          <span className="text-[11px] font-semibold text-accent-bright">
            Graph Search: {metadata.selected_count}/{metadata.total_files} files
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
            {metadata.token_savings_pct}% tokens saved
          </span>
        </div>
        <span className="text-text-muted text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 py-2.5 space-y-2.5">
          {/* Token savings bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-text-muted">Token Usage</span>
              <span className="text-emerald-400 font-semibold">
                {tokensSaved.toLocaleString()} tokens saved
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${100 - metadata.token_savings_pct}%`,
                    background: "linear-gradient(90deg, #6366f1, #22c55e)",
                  }}
                />
              </div>
              <span className="text-[10px] text-text-muted font-mono shrink-0">
                {metadata.token_estimate_surgical.toLocaleString()} / {metadata.token_estimate_full.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Search keywords */}
          <div>
            <span className="text-[10px] text-text-muted">Keywords: </span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {metadata.search_keywords.slice(0, 10).map(kw => (
                <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono">
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* Relevant files */}
          <div>
            <span className="text-[10px] text-text-muted mb-1 block">
              Files extracted from Knowledge Graph:
            </span>
            <div className="space-y-1">
              {metadata.relevant_files.map(file => {
                const name = file.path.split("/").pop() || file.path;
                const scoreColor = file.relevance_score >= 10 ? "text-red-400" : file.relevance_score >= 6 ? "text-amber-400" : "text-emerald-400";
                return (
                  <div key={file.path} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-zinc-900/50">
                    <span className={`text-[10px] font-bold font-mono w-5 text-right ${scoreColor}`}>
                      {file.relevance_score}
                    </span>
                    <div className="h-3 w-px bg-border" />
                    <span className="text-[11px] font-mono text-text-primary truncate flex-1">{name}</span>
                    <span className="text-[9px] text-text-muted shrink-0">
                      {file.lines}L · {file.functions.length}fn · {file.classes.length}cls
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Match reasons for top file */}
          {metadata.relevant_files[0]?.match_reasons?.length > 0 && (
            <div className="text-[10px] text-text-muted">
              <span className="text-text-secondary font-semibold">Why: </span>
              {metadata.relevant_files[0].match_reasons.slice(0, 3).join(" · ")}
            </div>
          )}

          <div className="text-[9px] text-text-muted/50 pt-0.5 border-t border-border/30">
            Model: {metadata.model_used} · Prompt: {metadata.prompt_tokens.toLocaleString()} tokens
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function GraphAssistant({ allFiles, folderName, hasCodebase }: GraphAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Build context-aware suggestions from the actual codebase
  const suggestions = useMemo(() => {
    if (!allFiles.length) return [];

    const result: string[] = [];
    const classNames: string[] = [];
    const funcNames: string[] = [];
    const fileNames: string[] = [];
    const importNames: Set<string> = new Set();

    // Parse file contents to extract names
    for (const file of allFiles) {
      const basename = file.path.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
      if (basename) fileNames.push(basename);

      const lines = file.content.split("\n");
      for (const line of lines) {
        const classMatch = line.match(/^\s*class\s+(\w+)/);
        if (classMatch) classNames.push(classMatch[1]);

        const funcMatch = line.match(/^\s*(?:def|function|async\s+function|export\s+(?:default\s+)?function|const\s+\w+\s*=\s*(?:async\s+)?)\s*(\w+)/);
        if (funcMatch && funcMatch[1].length > 3) funcNames.push(funcMatch[1]);

        const importMatch = line.match(/(?:from|import)\s+['".]*([\w.]+)/);
        if (importMatch) importNames.add(importMatch[1].split(".").pop() || "");
      }
    }

    // Generate context-aware suggestions
    if (classNames.length > 0) {
      result.push(`Explain how ${classNames[0]} works and its dependencies`);
      if (classNames.length > 1) result.push(`What is the relationship between ${classNames[0]} and ${classNames[1]}?`);
    }

    // Find the largest file
    const sortedBySize = [...allFiles].sort((a, b) => b.content.length - a.content.length);
    if (sortedBySize[0]) {
      const bigFile = sortedBySize[0].path.split("/").pop() || "";
      result.push(`Refactor ${bigFile} — it's the largest file`);
    }

    // Module-specific questions
    const hasAuth = fileNames.some(n => /auth|login|session|user/i.test(n));
    const hasDB = fileNames.some(n => /db|database|model|schema|repo/i.test(n));
    const hasAPI = fileNames.some(n => /route|endpoint|controller|handler|api|main/i.test(n));
    const hasTest = fileNames.some(n => /test|spec/i.test(n));

    if (hasAuth) result.push("How does authentication work in this codebase?");
    if (hasDB) result.push("Explain the database schema and data flow");
    if (hasAPI) result.push("List all API endpoints and their purposes");
    if (!hasTest) result.push("Add unit tests for the core business logic");
    if (hasTest) result.push("What test coverage gaps exist?");

    // Generic but useful
    result.push("Find potential security vulnerabilities");
    result.push(`What is the architecture of ${folderName || "this project"}?`);

    if (funcNames.length > 3) {
      const randomFunc = funcNames[Math.floor(funcNames.length / 2)];
      result.push(`What does the function ${randomFunc} do?`);
    }

    return result.slice(0, 6);
  }, [allFiles, folderName]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }, []);

  const handleSend = useCallback(async (query?: string) => {
    const text = query || input.trim();
    if (!text || isLoading || !hasCodebase) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const result = await assistantChat({
        query: text,
        folder_name: folderName,
        files: allFiles.map(f => ({ path: f.path, content: f.content })),
        conversation_history: messages.slice(-6).map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMsg: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: result.answer,
        timestamp: new Date(),
        metadata: {
          files_analyzed: result.files_analyzed,
          selected_count: result.selected_count,
          total_files: result.total_files,
          token_savings_pct: result.token_savings_pct,
          token_estimate_full: result.token_estimate_full,
          token_estimate_surgical: result.token_estimate_surgical,
          search_keywords: result.search_keywords,
          relevant_files: result.relevant_files,
          model_used: result.model_used,
          prompt_tokens: result.prompt_tokens,
        },
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: `❌ Error: ${err instanceof Error ? err.message : "Failed to get response"}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, hasCodebase, folderName, allFiles, messages]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ── Render ──────────────────────────────────────────────────────────

  if (!hasCodebase) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-3xl">🤖</div>
          <p className="text-sm text-text-muted">Open a folder to start using the Graph-Powered Assistant</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty state with suggestions */
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="text-center space-y-3 mb-6 max-w-md">
              <div className="text-4xl mb-2">🧠</div>
              <h3 className="text-sm font-semibold text-text-primary">Graph-Powered Assistant</h3>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Ask anything about your codebase. I use the Knowledge Graph to find{" "}
                <span className="text-accent-bright font-semibold">only the relevant files</span>{" "}
                instead of sending everything to the LLM — saving 70-90% of tokens.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {suggestions.slice(0, 6).map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left px-3 py-2 rounded-lg border border-border hover:border-accent/30 hover:bg-accent/5 transition-all text-[11px] text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="px-4 py-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${msg.role === "user" ? "" : "w-full"}`}>
                  {/* Message bubble */}
                  <div
                    className={`rounded-xl px-3.5 py-2.5 ${
                      msg.role === "user"
                        ? "bg-accent/15 border border-accent/20 text-text-primary"
                        : "bg-surface/50 border border-border text-text-primary"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <article className="markdown-body text-xs">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </article>
                    )}
                  </div>

                  {/* Graph context panel (only for assistant messages) */}
                  {msg.role === "assistant" && msg.metadata && (
                    <GraphContextPanel metadata={msg.metadata} />
                  )}

                  {/* Timestamp */}
                  <div className={`mt-1 text-[9px] text-text-muted/40 ${msg.role === "user" ? "text-right" : ""}`}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-3 bg-surface/50 border border-border">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                      <div className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                      <div className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-[10px] text-text-muted">Searching knowledge graph...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-4 py-3 bg-surface/30">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your codebase... (e.g. 'Add a password reset feature')"
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/50 disabled:opacity-50"
              style={{ maxHeight: 120 }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-9 w-9 rounded-xl bg-accent/80 hover:bg-accent flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-text-muted/40">
          <span>⏎ Send</span>
          <span>⇧⏎ New line</span>
          <span className="ml-auto">{allFiles.length} files indexed in graph</span>
        </div>
      </div>
    </div>
  );
}
