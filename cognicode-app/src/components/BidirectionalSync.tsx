"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  syncCodebaseToDoc,
  type CodebaseFileItem,
} from "@/lib/api";

interface BidirectionalSyncProps {
  allFiles: CodebaseFileItem[];
  folderName: string;
  hasCodebase: boolean;
  // Current editor state — to detect changes
  editingFileName?: string;
  editingCode?: string;
  // Pre-populate from .cognicode/ cache
  initialDoc?: string;
  // Callback when sync completes — so parent can save to .cognicode/
  onSyncComplete?: (data: { markdown: string; changes: string[]; isStable: boolean }) => void;
}

type SyncStatus = "idle" | "syncing" | "synced" | "drift" | "error";

export default function BidirectionalSync({
  allFiles,
  folderName,
  hasCodebase,
  editingFileName,
  editingCode,
  initialDoc,
  onSyncComplete,
}: BidirectionalSyncProps) {
  const [doc, setDoc] = useState<string>(initialDoc || "");
  const [prevDoc, setPrevDoc] = useState<string>("");
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [changedSections, setChangedSections] = useState<string[]>([]);
  const [isStable, setIsStable] = useState<boolean | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const lastSyncedCodeRef = useRef<string>("");

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Restore from cache: initialDoc arrives after mount
  useEffect(() => {
    if (initialDoc && !doc) {
      setDoc(initialDoc);
      setStatus("synced");
    }
  }, [initialDoc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the current file list with editor overrides
  const getCurrentFiles = useCallback((): CodebaseFileItem[] => {
    if (!editingFileName || !editingCode) return allFiles;
    return allFiles.map(f =>
      f.path === editingFileName ? { ...f, content: editingCode } : f
    );
  }, [allFiles, editingFileName, editingCode]);

  // Detect what sections changed between old and new docs
  const detectChanges = useCallback((oldDoc: string, newDoc: string) => {
    if (!oldDoc || !newDoc) return { sections: [], stable: true };

    const getHeadings = (md: string) => {
      const lines = md.split("\n");
      const headings: { title: string; content: string }[] = [];
      let current = "";
      let currentContent = "";
      for (const line of lines) {
        const match = line.match(/^#{1,3}\s+(.+)/);
        if (match) {
          if (current) headings.push({ title: current, content: currentContent });
          current = match[1];
          currentContent = "";
        } else {
          currentContent += line + "\n";
        }
      }
      if (current) headings.push({ title: current, content: currentContent });
      return headings;
    };

    const oldHeadings = getHeadings(oldDoc);
    const newHeadings = getHeadings(newDoc);
    const changed: string[] = [];
    let stable = true;

    for (const nh of newHeadings) {
      const oh = oldHeadings.find(h => h.title === nh.title);
      if (!oh) {
        changed.push(`+ ${nh.title}`);
      } else if (oh.content.trim() !== nh.content.trim()) {
        changed.push(`~ ${nh.title}`);
      }
    }
    for (const oh of oldHeadings) {
      if (!newHeadings.find(h => h.title === oh.title)) {
        changed.push(`- ${oh.title}`);
        stable = false; // Removed section = potential instability
      }
    }

    // Check for breaking indicators in new doc
    const breakingKeywords = ["breaking", "removed", "deprecated", "incompatible", "error", "fail"];
    const newLower = newDoc.toLowerCase();
    if (breakingKeywords.some(k => newLower.includes(k) && !oldDoc.toLowerCase().includes(k))) {
      stable = false;
    }

    return { sections: changed, stable };
  }, []);

  // Core sync function
  const performSync = useCallback(async (files: CodebaseFileItem[], isAutoSync = false) => {
    if (files.length === 0) return;
    setStatus("syncing");
    setError(null);
    try {
      const result = await syncCodebaseToDoc({
        folder_name: folderName,
        files,
        existing_doc: doc || "",
      });
      if (!isMountedRef.current) return;

      const newDoc = result.updated_markdown;

      if (doc && isAutoSync) {
        const { sections, stable } = detectChanges(doc, newDoc);
        setChangedSections(sections);
        setIsStable(stable);
        setStatus(stable ? "synced" : "drift");
      } else {
        setChangedSections([]);
        setIsStable(null);
        setStatus("synced");
      }

      setPrevDoc(doc);
      setDoc(newDoc);
      setLastSyncTime(new Date().toLocaleTimeString());
      lastSyncedCodeRef.current = editingCode || "";

      // Notify parent so it can persist to .cognicode/
      onSyncComplete?.({
        markdown: newDoc,
        changes: isAutoSync ? (doc ? detectChanges(doc, newDoc).sections : []) : [],
        isStable: isAutoSync ? (doc ? detectChanges(doc, newDoc).stable : true) : true,
      });
    } catch (e) {
      if (!isMountedRef.current) return;
      setError(e instanceof Error ? e.message : "Sync failed");
      setStatus("error");
    }
  }, [folderName, doc, editingCode, detectChanges]);

  // Auto-sync on folder open (initial generation) — skip if cached doc available
  useEffect(() => {
    if (hasCodebase && allFiles.length > 0 && !doc && status === "idle" && !initialDoc) {
      performSync(allFiles, false);
    }
  }, [hasCodebase, allFiles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync on code changes (debounced)
  useEffect(() => {
    if (!doc || !editingCode || !editingFileName || !hasCodebase) return;
    if (editingCode === lastSyncedCodeRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        const files = getCurrentFiles();
        performSync(files, true);
      }
    }, 3000); // 3s debounce for auto-resync

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [editingCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualSync = useCallback(() => {
    const files = getCurrentFiles();
    performSync(files, !!doc);
  }, [getCurrentFiles, performSync, doc]);

  const handleSave = useCallback(async () => {
    if (!doc) return;
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: `${folderName || "codebase"}_documentation.md`,
        types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(doc);
      await writable.close();
    } catch { /* cancelled */ }
  }, [doc, folderName]);

  const statusConfig = {
    idle: { color: "text-text-muted", icon: "○", label: "Not synced" },
    syncing: { color: "text-accent-bright", icon: "◌", label: "Syncing..." },
    synced: { color: "text-emerald-400", icon: "●", label: "Synced" },
    drift: { color: "text-amber-400", icon: "◐", label: "Drift detected" },
    error: { color: "text-red-400", icon: "✕", label: "Error" },
  };
  const sc = statusConfig[status];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Codebase Documentation
        </span>

        <div className="ml-auto flex items-center gap-3">
          {/* Status indicator */}
          <span className={`flex items-center gap-1.5 text-[10px] font-medium ${sc.color}`}>
            <span className={status === "syncing" ? "animate-spin" : ""}>{sc.icon}</span>
            {sc.label}
          </span>

          {lastSyncTime && (
            <span className="text-[10px] text-text-muted/50">{lastSyncTime}</span>
          )}

          {doc && (
            <button
              onClick={handleSave}
              className="text-[10px] font-medium text-text-muted hover:text-text-primary cursor-pointer"
              title="Export documentation"
            >
              Export
            </button>
          )}

          {hasCodebase && (
            <button
              onClick={handleManualSync}
              disabled={status === "syncing"}
              className="text-[10px] font-semibold text-accent-bright hover:underline cursor-pointer disabled:opacity-50"
            >
              {status === "syncing" ? "Syncing..." : doc ? "Re-sync" : "Generate"}
            </button>
          )}
        </div>
      </div>

      {/* Stability banner */}
      {isStable !== null && changedSections.length > 0 && (
        <div className={`shrink-0 px-4 py-2 border-b ${
          isStable
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-amber-500/5 border-amber-500/20"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${isStable ? "text-emerald-400" : "text-amber-400"}`}>
              {isStable ? "✓ Changes look stable" : "⚠ Potential drift detected"}
            </span>
            {editingFileName && (
              <span className="text-[10px] text-text-muted">
                after editing {editingFileName.split("/").pop()}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {changedSections.map((s, i) => (
              <span
                key={i}
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                  s.startsWith("+") ? "bg-emerald-500/10 text-emerald-400"
                    : s.startsWith("-") ? "bg-red-500/10 text-red-400"
                    : "bg-amber-500/10 text-amber-400"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Document content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
        )}

        {status === "syncing" && !doc ? (
          <div className="flex items-center gap-3 py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
            <span className="text-sm text-text-muted">Generating codebase documentation...</span>
          </div>
        ) : doc ? (
          <article className={`markdown-body ${status === "syncing" ? "opacity-50" : ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc}</ReactMarkdown>
          </article>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm text-text-muted">
              {hasCodebase
                ? "Generating documentation for your codebase..."
                : "Open a folder to auto-generate codebase documentation"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
