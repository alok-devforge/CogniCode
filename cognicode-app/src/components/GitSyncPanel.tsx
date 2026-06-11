"use client";

import { useState, useCallback } from "react";
import { syncGitHubCommit, type GitHubSyncResponse } from "@/lib/api";

export default function GitSyncPanel() {
  const [gitOwner, setGitOwner] = useState("");
  const [gitRepo, setGitRepo] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [gitToken, setGitToken] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<GitHubSyncResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleGitSync = useCallback(async () => {
    if (!gitOwner && !gitRepo) return;
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#238636]/15">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Git Commit Sync</h3>
            <p className="text-[10px] text-text-muted">Fetch latest commit → LLM summarize → Ingest to RAG</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="shrink-0 px-5 py-4 space-y-3 border-b border-border/50">
        <div>
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
            Repository URL or Owner
          </label>
          <input
            type="text"
            value={gitOwner}
            onChange={(e) => {
              const v = e.target.value;
              setGitOwner(v);
              const m = v.match(/github\.com[/:]([^/]+)\/([^/\s]+)/);
              if (m) {
                setGitOwner(m[1]);
                setGitRepo(m[2].replace(/\.git$/, ""));
              }
            }}
            placeholder="Paste GitHub URL or enter owner (e.g. vercel)"
            className="w-full bg-surface border border-border/50 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
              Repository
            </label>
            <input
              type="text"
              value={gitRepo}
              onChange={(e) => setGitRepo(e.target.value)}
              placeholder="e.g. next.js"
              className="w-full bg-surface border border-border/50 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
              Branch
            </label>
            <input
              type="text"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
              placeholder="main"
              className="w-full bg-surface border border-border/50 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
            Token <span className="text-text-muted/50 normal-case">(optional, for private repos)</span>
          </label>
          <input
            type="password"
            value={gitToken}
            onChange={(e) => setGitToken(e.target.value)}
            placeholder="ghp_..."
            className="w-full bg-surface border border-border/50 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>
        <button
          onClick={handleGitSync}
          disabled={isSyncing || (!gitOwner && !gitRepo)}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#238636]/20 px-4 py-2.5 text-xs font-semibold text-[#3fb950] hover:bg-[#238636]/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-[#238636]/20"
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

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {syncError && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <div className="flex-1">
              <span className="text-xs text-red-400 font-medium">Sync Failed</span>
              <p className="text-[11px] text-red-300/70 mt-0.5">{syncError}</p>
            </div>
            <button onClick={() => setSyncError(null)} className="text-red-400/50 hover:text-red-400 cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {syncResult && (
          <div className="p-5 space-y-4">
            {/* Success header */}
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/20">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-xs font-semibold text-emerald-400">Commit Synced to Knowledge Base</span>
                <p className="text-[10px] text-emerald-300/60 mt-0.5">
                  {syncResult.chunks_ingested} chunks ingested into ChromaDB
                </p>
              </div>
            </div>

            {/* Commit details */}
            <div className="rounded-lg bg-surface border border-border/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                <code className="font-mono text-xs text-accent-bright bg-accent/10 px-2 py-0.5 rounded">
                  {syncResult.commit.short_sha}
                </code>
                <span className="text-[11px] text-text-muted">by</span>
                <span className="text-[11px] text-text-primary font-medium">{syncResult.commit.author}</span>
                <span className="ml-auto text-[10px] text-text-muted">
                  {new Date(syncResult.commit.date).toLocaleDateString()}
                </span>
              </div>
              <div className="px-4 py-3 text-xs text-text-primary">
                {syncResult.commit.message}
              </div>
              <div className="px-4 py-2.5 bg-surface-alt/50 border-t border-border/30 flex items-center gap-4 text-[10px]">
                <span className="text-emerald-400 font-mono">+{syncResult.commit.stats.additions}</span>
                <span className="text-red-400 font-mono">-{syncResult.commit.stats.deletions}</span>
                <span className="text-text-muted">{syncResult.commit.files_changed} file(s) changed</span>
              </div>
            </div>

            {/* Files changed */}
            {syncResult.commit.file_names.length > 0 && (
              <div className="rounded-lg bg-surface border border-border/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/30">
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Files Changed</span>
                </div>
                <div className="divide-y divide-border/20">
                  {syncResult.commit.file_names.map((f, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-2 text-[11px]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-text-primary font-mono truncate">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary */}
            <div className="rounded-lg bg-accent/5 border border-accent/15 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-accent/10 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-bright">
                  <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
                </svg>
                <span className="text-[10px] font-semibold text-accent-bright uppercase tracking-wider">AI Summary</span>
              </div>
              <div className="px-4 py-3 text-[11px] text-text-primary leading-relaxed">
                {syncResult.summary}
              </div>
            </div>
          </div>
        )}

        {!syncResult && !syncError && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
            <div className="h-12 w-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </div>
            <h4 className="text-sm font-medium text-text-primary mb-1">Git Hash as a Time Machine</h4>
            <p className="text-[11px] text-text-muted leading-relaxed max-w-xs">
              Enter a GitHub repository above and sync the latest commit.
              The diff will be summarized by AI and ingested into ChromaDB
              for instant RAG retrieval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
