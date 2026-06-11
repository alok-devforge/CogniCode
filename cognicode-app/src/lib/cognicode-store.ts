/**
 * cognicode-store.ts — Persistence layer for .cognicode/ directory.
 *
 * Handles saving/loading analysis state to the user's project folder
 * using the File System Access API. Includes SHA-256 file hashing
 * for incremental change detection.
 *
 * Like .git/ or .vscode/, the .cognicode/ directory stores:
 * - Knowledge graph
 * - Archeologist report
 * - Blast radius data
 * - Last synced documentation
 * - Codebase map
 * - RAG pipeline stats
 * - File hashes for incremental re-analysis
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface CogniCodeState {
  version: string;
  folder_name: string;
  created_at: string;
  updated_at: string;
  file_hashes: Record<string, string>;
  knowledge_graph: {
    nodes: unknown[];
    edges: unknown[];
    clusters: unknown[];
    statistics: Record<string, unknown>;
  } | null;
  archeologist_report: {
    summary_markdown: string;
    detected_patterns: string[];
    confidence_score: number;
  } | null;
  blast_radius: {
    nodes: unknown[];
    edges: unknown[];
    analysis_summary: string;
  } | null;
  last_synced_doc: {
    updated_markdown: string;
    changes_detected: string[];
    sync_status: string;
  } | null;
  codebase_map: unknown | null;
  graph_summary: string;
  rag_pipeline: {
    total_chunks: number;
    last_ingested_at: string;
  } | null;
}

export interface FileChange {
  path: string;
  type: "added" | "modified" | "deleted";
}

export interface ChangeSummary {
  added: string[];
  modified: string[];
  deleted: string[];
  total_changed: number;
  change_ratio: number; // 0-1, percentage of files that changed
}

// ── Constants ───────────────────────────────────────────────────────────

const COGNICODE_DIR = ".cognicode";
const STATE_FILE = "cognicode_state.json";
const CURRENT_VERSION = "1.0";

// ── File Hashing ────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of file content using Web Crypto API.
 * Returns hex string like "sha256:abc123..."
 */
export async function computeFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hashHex}`;
}

/**
 * Compute hashes for all files in parallel.
 */
export async function computeAllHashes(
  files: { path: string; content: string }[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    files.map(async (f) => {
      const hash = await computeFileHash(f.content);
      return [f.path, hash] as [string, string];
    })
  );
  return Object.fromEntries(entries);
}

/**
 * Compare old and new file hashes to detect changes.
 * Returns which files were added, modified, or deleted.
 */
export function detectChanges(
  oldHashes: Record<string, string>,
  currentFiles: { path: string; content: string }[],
  currentHashes: Record<string, string>
): ChangeSummary {
  const oldPaths = new Set(Object.keys(oldHashes));
  const currentPaths = new Set(currentFiles.map((f) => f.path));

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  // Check for added and modified files
  for (const path of currentPaths) {
    if (!oldPaths.has(path)) {
      added.push(path);
    } else if (oldHashes[path] !== currentHashes[path]) {
      modified.push(path);
    }
  }

  // Check for deleted files
  for (const path of oldPaths) {
    if (!currentPaths.has(path)) {
      deleted.push(path);
    }
  }

  const totalFiles = Math.max(currentPaths.size, oldPaths.size);
  const totalChanged = added.length + modified.length + deleted.length;

  return {
    added,
    modified,
    deleted,
    total_changed: totalChanged,
    change_ratio: totalFiles > 0 ? totalChanged / totalFiles : 0,
  };
}

// ── File System Access API ──────────────────────────────────────────────

/**
 * Save CogniCode state to .cognicode/cognicode_state.json in the user's project folder.
 *
 * Uses the File System Access API to create the directory and file.
 * The dirHandle must be the root of the user's project folder with write permission.
 */
export async function saveCogniCodeState(
  dirHandle: FileSystemDirectoryHandle,
  state: CogniCodeState
): Promise<void> {
  try {
    // Verify write permission (browser may have revoked it)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = dirHandle as any;
    if (handle.queryPermission) {
      const perm = await handle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        const requested = await handle.requestPermission({ mode: "readwrite" });
        if (requested !== "granted") {
          console.warn("[CogniCode] Write permission denied — cannot save .cognicode/");
          return;
        }
      }
    }

    // Create .cognicode directory (or get existing)
    const cognicodeDir = await dirHandle.getDirectoryHandle(COGNICODE_DIR, {
      create: true,
    });

    // Write state file
    const fileHandle = await cognicodeDir.getFileHandle(STATE_FILE, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    const json = JSON.stringify(state, null, 2);
    await writable.write(json);
    await writable.close();

    console.log(
      `[CogniCode] State saved to .cognicode/ (${(json.length / 1024).toFixed(1)}KB)`
    );
  } catch (err) {
    console.error("[CogniCode] Failed to save state:", err);
    throw err; // Re-throw so the caller can show error in UI
  }
}

/**
 * Load CogniCode state from .cognicode/cognicode_state.json.
 * Returns null if no cached state exists or it's corrupted.
 */
export async function loadCogniCodeState(
  dirHandle: FileSystemDirectoryHandle
): Promise<CogniCodeState | null> {
  try {
    const cognicodeDir = await dirHandle.getDirectoryHandle(COGNICODE_DIR);
    const fileHandle = await cognicodeDir.getFileHandle(STATE_FILE);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const state = JSON.parse(text) as CogniCodeState;

    // Validate version
    if (!state.version || !state.file_hashes) {
      console.warn("[CogniCode] Invalid cached state — ignoring");
      return null;
    }

    console.log(
      `[CogniCode] Loaded cached state (${Object.keys(state.file_hashes).length} files, updated ${state.updated_at})`
    );
    return state;
  } catch {
    // No cached state — this is normal for first-time analysis
    return null;
  }
}

// ── State Builder ───────────────────────────────────────────────────────

/**
 * Create a new CogniCodeState object from analysis results.
 */
export function buildState(params: {
  folderName: string;
  fileHashes: Record<string, string>;
  graphSummary: string;
  archeologist?: CogniCodeState["archeologist_report"];
  blastRadius?: CogniCodeState["blast_radius"];
  knowledgeGraph?: CogniCodeState["knowledge_graph"];
  lastSyncedDoc?: CogniCodeState["last_synced_doc"];
  codebaseMap?: CogniCodeState["codebase_map"];
  ragPipeline?: CogniCodeState["rag_pipeline"];
  existingState?: CogniCodeState | null;
}): CogniCodeState {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    folder_name: params.folderName,
    created_at: params.existingState?.created_at || now,
    updated_at: now,
    file_hashes: params.fileHashes,
    knowledge_graph: params.knowledgeGraph || params.existingState?.knowledge_graph || null,
    archeologist_report: params.archeologist || params.existingState?.archeologist_report || null,
    blast_radius: params.blastRadius || params.existingState?.blast_radius || null,
    last_synced_doc: params.lastSyncedDoc || params.existingState?.last_synced_doc || null,
    codebase_map: params.codebaseMap || params.existingState?.codebase_map || null,
    graph_summary: params.graphSummary || params.existingState?.graph_summary || "",
    rag_pipeline: params.ragPipeline || params.existingState?.rag_pipeline || null,
  };
}

/**
 * Check if incremental analysis should be used (< 50% files changed)
 * or if we should fall back to full re-analysis.
 */
export function shouldUseIncremental(changes: ChangeSummary): boolean {
  // If more than 50% of files changed, full re-analysis is more reliable
  if (changes.change_ratio > 0.5) return false;
  // If no previous state exists (all added), must do full analysis
  if (changes.deleted.length === 0 && changes.modified.length === 0) return false;
  // If nothing changed, no re-analysis needed at all
  if (changes.total_changed === 0) return false;
  return true;
}
