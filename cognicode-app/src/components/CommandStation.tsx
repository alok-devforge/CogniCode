"use client";

import { useState, useCallback } from "react";
import type { GatekeeperResponse, GitHubSyncResponse } from "@/lib/api";
import { syncGitHubCommit } from "@/lib/api";

interface FileHealthResult {
  path: string;
  score: number;
  verdict: string;
  violations: string[];
  violation_count: number;
}

interface CodebaseHealthResult {
  overall_score: number;
  overall_verdict: string;
  total_files: number;
  total_functions: number;
  total_violations: number;
  file_results: FileHealthResult[];
  hotspots: { path: string; score: number; reason: string }[];
}

interface CommandStationProps {
  onSubmitPR?: (code: string) => Promise<GatekeeperResponse>;
  currentCode?: string;
  fileName?: string;
  hasCodebase?: boolean;
  onEvaluateCodebase?: () => Promise<CodebaseHealthResult>;
}

export default function CommandStation({
  onSubmitPR,
  currentCode,
  fileName,
  hasCodebase,
  onEvaluateCodebase,
}: CommandStationProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [singleResult, setSingleResult] = useState<GatekeeperResponse | null>(null);
  const [codebaseResult, setCodebaseResult] = useState<CodebaseHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GitHub sync state
  const [showGitSync, setShowGitSync] = useState(false);
  const [gitOwner, setGitOwner] = useState("");
  const [gitRepo, setGitRepo] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [gitToken, setGitToken] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<GitHubSyncResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const hasFile = !!currentCode?.trim();

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setSingleResult(null);
    setCodebaseResult(null);
    try {
      if (hasCodebase && onEvaluateCodebase) {
        const result = await onEvaluateCodebase();
        setCodebaseResult(result);
      } else if (hasFile && onSubmitPR && currentCode) {
        const result = await onSubmitPR(currentCode);
        setSingleResult(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setIsRunning(false);
    }
  }, [hasCodebase, onEvaluateCodebase, hasFile, onSubmitPR, currentCode]);

  const handleGitSync = useCallback(async () => {
    if (!gitOwner || !gitRepo) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await syncGitHubCommit({
        owner: gitOwner,
        repo: gitRepo,
        branch: gitBranch || "main",
        token: gitToken || undefined,
      });
      setSyncResult(result);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }, [gitOwner, gitRepo, gitBranch, gitToken]);

  const activeResult = codebaseResult || singleResult;
  const overallScore = codebaseResult
    ? codebaseResult.overall_score
    : singleResult
    ? singleResult.overall_score
    : null;
  const overallPass = codebaseResult
    ? codebaseResult.overall_verdict === "PASS"
    : singleResult
    ? singleResult.verdict === "PASS"
    : null;

  const allViolations: { file: string; issue: string; severity: "critical" | "warning" | "info" }[] = [];
  if (codebaseResult) {
    for (const f of codebaseResult.file_results) {
      for (const v of f.violations) {
        const severity = v.includes("cyclomatic") || v.includes("God Module") ? "critical" as const
          : v.includes("cognitive") || v.includes("Large file") ? "warning" as const
          : "info" as const;
        allViolations.push({ file: f.path.split("/").pop() || f.path, issue: v, severity });
      }
    }
  } else if (singleResult) {
    for (const v of singleResult.violations) {
      allViolations.push({ file: fileName || "current file", issue: v, severity: "warning" });
    }
  }

  const sevColors = {
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  return (
    <div className="shrink-0 border-t border-border bg-surface-alt">
      {/* GitHub Sync Result */}
      {syncResult && (
        <div className="border-b border-border max-h-[260px] overflow-y-auto">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 sticky top-0 bg-surface-alt z-10">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg text-sm font-bold bg-emerald-500/15 text-emerald-400">
              ✓
            </div>
            <div className="flex-1">
              <span className="text-xs font-semibold text-emerald-400">Commit Synced to Knowledge Base</span>
              <span className="text-[10px] text-text-muted ml-2">
                {syncResult.commit.short_sha} · {syncResult.chunks_ingested} chunks ingested
              </span>
            </div>
            <button onClick={() => setSyncResult(null)} className="text-text-muted hover:text-text-primary cursor-pointer p-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-text-muted">Commit:</span>
              <code className="font-mono text-accent-bright bg-accent/10 px-1.5 py-0.5 rounded">{syncResult.commit.short_sha}</code>
              <span className="text-text-muted">by</span>
              <span className="text-text-primary font-medium">{syncResult.commit.author}</span>
            </div>
            <div className="text-[11px] text-text-primary bg-surface/50 rounded-lg px-3 py-2 border border-border/30">
              <span className="font-semibold text-text-muted block mb-1">Message:</span>
              {syncResult.commit.message}
            </div>
            <div className="flex gap-3 text-[10px] text-text-muted">
              <span className="text-emerald-400">+{syncResult.commit.stats.additions}</span>
              <span className="text-red-400">-{syncResult.commit.stats.deletions}</span>
              <span>{syncResult.commit.files_changed} files</span>
            </div>
            {syncResult.commit.file_names.length > 0 && (
              <div className="text-[10px] text-text-muted">
                <span className="font-semibold">Files:</span>{" "}
                {syncResult.commit.file_names.slice(0, 5).join(", ")}
                {syncResult.commit.file_names.length > 5 && ` +${syncResult.commit.file_names.length - 5} more`}
              </div>
            )}
            <div className="text-[11px] text-text-primary bg-accent/5 rounded-lg px-3 py-2 border border-accent/10">
              <span className="font-semibold text-accent-bright block mb-1">AI Summary:</span>
              {syncResult.summary}
            </div>
          </div>
        </div>
      )}

      {syncError && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-red-500/5">
          <span className="text-xs text-red-400">{syncError}</span>
          <button onClick={() => setSyncError(null)} className="ml-auto text-text-muted hover:text-text-primary cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* GitHub Sync Panel */}
      {showGitSync && (
        <div className="border-b border-border px-4 py-3 bg-surface/50 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <span className="text-[11px] font-semibold text-text-primary">Sync GitHub Commit</span>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={gitOwner}
              onChange={(e) => {
                const v = e.target.value;
                setGitOwner(v);
                // Auto-parse if user pastes a full GitHub URL
                const m = v.match(/github\.com[/:]([^/]+)\/([^/\s]+)/);
                if (m) {
                  setGitOwner(m[1]);
                  setGitRepo(m[2].replace(/\.git$/, ''));
                }
              }}
              placeholder="Paste GitHub URL or enter owner (e.g. vercel)"
              className="w-full bg-surface border border-border/50 rounded-md px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
            />
            <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={gitRepo}
              onChange={(e) => setGitRepo(e.target.value)}
              placeholder="Repo name (e.g. next.js)"
              className="bg-surface border border-border/50 rounded-md px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
            />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
              placeholder="Branch (default: main)"
              className="bg-surface border border-border/50 rounded-md px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
            />
            <input
              type="password"
              value={gitToken}
              onChange={(e) => setGitToken(e.target.value)}
              placeholder="Token (optional, for private)"
              className="bg-surface border border-border/50 rounded-md px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
            />
          </div>
          <button
            onClick={handleGitSync}
            disabled={isSyncing || !gitOwner || !gitRepo}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#238636]/20 px-4 py-2 text-xs font-semibold text-[#3fb950] hover:bg-[#238636]/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                </svg>
                Syncing commit...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7-7 7 7" />
                </svg>
                Sync Latest Commit
              </>
            )}
          </button>
        </div>
      )}

      {/* Quality Gate Results panel */}
      {activeResult && (
        <div className="border-b border-border max-h-[280px] overflow-y-auto">
          {/* Score header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 sticky top-0 bg-surface-alt z-10">
            <div className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm font-bold ${
              overallPass ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}>
              {overallScore !== null ? Math.round(overallScore * 100) : "—"}
            </div>
            <div className="flex-1">
              <span className={`text-xs font-semibold ${overallPass ? "text-emerald-400" : "text-red-400"}`}>
                {overallPass ? "Quality Gate Passed" : "Quality Gate Failed"}
              </span>
              <span className="text-[10px] text-text-muted ml-2">
                {codebaseResult
                  ? `${codebaseResult.total_files} files · ${codebaseResult.total_violations} issues`
                  : singleResult
                  ? `${singleResult.metrics.length} functions analyzed`
                  : ""}
              </span>
            </div>
            <button
              onClick={() => { setSingleResult(null); setCodebaseResult(null); }}
              className="text-text-muted hover:text-text-primary cursor-pointer p-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Violations list */}
          {allViolations.length > 0 ? (
            <div className="divide-y divide-border/30">
              {allViolations.map((v, i) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-2 ${sevColors[v.severity].split(" ")[0]}`}>
                  <span className={`shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full ${
                    v.severity === "critical" ? "bg-red-400" : v.severity === "warning" ? "bg-amber-400" : "bg-blue-400"
                  }`}></span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-text-primary">{v.issue}</span>
                    <span className="text-[10px] text-text-muted ml-2">in {v.file}</span>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${sevColors[v.severity]}`}>
                    {v.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-emerald-400">No issues found — code quality looks good.</p>
            </div>
          )}

          {/* Per-file breakdown for codebase */}
          {codebaseResult && codebaseResult.hotspots.length > 0 && (
            <div className="px-4 py-2 border-t border-border/50">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Risk Hotspots</span>
              <div className="mt-1.5 space-y-1">
                {codebaseResult.hotspots.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-text-primary">{h.path.split("/").pop()}</span>
                    <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${h.score >= 0.7 ? "bg-emerald-500" : h.score >= 0.5 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${h.score * 100}%` }}
                      ></div>
                    </div>
                    <span className="font-mono text-text-muted text-[10px]">{Math.round(h.score * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-red-500/5">
          <span className="text-xs text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-text-muted hover:text-text-primary cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 text-xs text-text-muted">
            {hasCodebase
              ? "Scans all files for complexity, coupling, and code smells"
              : hasFile
              ? `${fileName || "File"} · ${currentCode?.split("\n").length || 0} lines`
              : "Open a folder or file to scan"
            }
          </div>

          {/* GitHub Sync toggle */}
          <button
            onClick={() => setShowGitSync(!showGitSync)}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer ${
              showGitSync
                ? "bg-[#238636]/20 text-[#3fb950]"
                : "bg-zinc-800/50 text-text-muted hover:text-text-primary hover:bg-zinc-700/50"
            }`}
            title="Sync Latest GitHub Commit"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            Git Sync
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning || (!hasFile && !hasCodebase)}
            className="shrink-0 flex items-center gap-2 rounded-lg bg-accent/15 px-5 py-2 text-xs font-semibold text-accent-bright hover:bg-accent/25 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Run Quality Gate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
