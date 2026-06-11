"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Node, Edge } from "@xyflow/react";
import FileExplorer from "@/components/FileExplorer";
import DocumentViewer from "@/components/DocumentViewer";
import GitSyncPanel from "@/components/GitSyncPanel";
import BidirectionalSync from "@/components/BidirectionalSync";
import RAGPanel from "@/components/RAGPanel";
import GraphAssistant from "@/components/GraphAssistant";
import StressTester from "@/components/LoadTester";
import DesignDocsPanel from "@/components/DesignDocsPanel";
import {
  analyzeArchitecture,
  getBlastRadius,
  evaluateGatekeeper,
  simulateSandbox,
  spawnSandbox,
  mergeAndDestroySandbox,
  ingestFiles,
  analyzeCodebaseArchitecture,
  getCodebaseBlastRadius,
  getCodebaseMap,
  evaluateCodebaseHealth,
  generateDesignDocs,
  incrementalAnalyze,
  getKnowledgeGraph,
  type GatekeeperResponse,
  type ComplexityMetric,
  type CodebaseFileItem,
} from "@/lib/api";
import {
  saveCogniCodeState,
  loadCogniCodeState,
  computeAllHashes,
  detectChanges,
  buildState,
  shouldUseIncremental,
  type CogniCodeState,
} from "@/lib/cognicode-store";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-surface">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
        <span className="text-sm text-text-muted">Loading Editor...</span>
      </div>
    </div>
  ),
});

const DependencyGraph = dynamic(() => import("@/components/DependencyGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
        <span className="text-sm text-text-muted">Loading Graph...</span>
      </div>
    </div>
  ),
});

type RightTab = "archeologist" | "sync" | "graph" | "rag" | "assistant" | "stresstest" | "designdocs" | "gitsync";

function ResizeHandle({
  onMouseDown,
  direction = "vertical",
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  direction?: "vertical" | "horizontal";
}) {
  const isVertical = direction === "vertical";
  return (
    <div
      onMouseDown={onMouseDown}
      className={`group relative shrink-0 ${
        isVertical
          ? "w-1 cursor-col-resize hover:w-1"
          : "h-1 cursor-row-resize hover:h-1"
      } flex items-center justify-center`}
    >
      <div
        className={`absolute ${
          isVertical
            ? "inset-y-0 w-[3px] left-[-1px]"
            : "inset-x-0 h-[3px] top-[-1px]"
        } rounded-full bg-transparent transition-colors duration-150 group-hover:bg-accent/60 group-active:bg-accent`}
      ></div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<RightTab>("archeologist");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [fileContent, setFileContent] = useState<string | undefined>(undefined);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [currentCode, setCurrentCode] = useState<string>("");
  const [isNewFile, setIsNewFile] = useState(false);
  const [allCodebaseFiles, setAllCodebaseFiles] = useState<CodebaseFileItem[]>([]);
  const [folderName, setFolderName] = useState<string>("");

  const [blueprintMarkdown, setBlueprintMarkdown] = useState<string | undefined>(undefined);
  const [blueprintPatterns, setBlueprintPatterns] = useState<string[]>([]);
  const [blueprintConfidence, setBlueprintConfidence] = useState<number | undefined>(undefined);
  const [isBlueprintLoading, setIsBlueprintLoading] = useState(false);

  const [graphNodes, setGraphNodes] = useState<Node[]>([]);
  const [graphEdges, setGraphEdges] = useState<Edge[]>([]);
  const [graphSummary, setGraphSummary] = useState<string>("");
  const [isGraphLoading, setIsGraphLoading] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "synced" | "analyzing">("idle");

  const [gatekeeperMetrics, setGatekeeperMetrics] = useState<ComplexityMetric[]>([]);
  const [simulationSummary, setSimulationSummary] = useState<string>("");
  const [simulationFailed, setSimulationFailed] = useState(false);
  const [simulationWarnings, setSimulationWarnings] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [originalGraphNodes, setOriginalGraphNodes] = useState<Node[]>([]);
  const [originalGraphEdges, setOriginalGraphEdges] = useState<Edge[]>([]);

  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxBranch, setSandboxBranch] = useState<string>("");
  const [sandboxOriginalBranch, setSandboxOriginalBranch] = useState<string>("");
  const [sandboxRepoPath, setSandboxRepoPath] = useState<string>("");
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string>("");
  const [isMerging, setIsMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<string>("");
  const [sandboxOriginalCode, setSandboxOriginalCode] = useState<string>("");
  const [sandboxPreviewOpen, setSandboxPreviewOpen] = useState(false);

  const [explorerWidth, setExplorerWidth] = useState(224);
  const [editorFraction, setEditorFraction] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [ragStatus, setRagStatus] = useState<string>("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [codebaseMapData, setCodebaseMapData] = useState<any>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [knowledgeGraphData, setKnowledgeGraphData] = useState<any>(null);

  // Sync doc + RAG persistence
  const [lastSyncedDoc, setLastSyncedDoc] = useState<{ markdown: string; changes: string[]; isStable: boolean } | null>(null);
  const [ragPipelineData, setRagPipelineData] = useState<{ total_chunks: number; last_ingested_at: string } | null>(null);

  // .cognicode/ persistence state — use ref for dirHandle to avoid stale closures
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [cachedState, setCachedState] = useState<CogniCodeState | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string>("");
  const [graphSummaryCache, setGraphSummaryCache] = useState<string>("");

  const mainRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);
  const startXRef = useRef(0);
  const startValueRef = useRef(0);

  const detectLanguage = useCallback((name?: string): string => {
    if (!name) return "python";
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
      py: "python", js: "javascript", ts: "typescript", tsx: "typescript",
      jsx: "javascript", cpp: "cpp", c: "c", cs: "csharp", java: "java",
      go: "go", rs: "rust", rb: "ruby", php: "php", swift: "swift",
      kt: "kotlin", dart: "dart",
    };
    return map[ext] || ext || "python";
  }, []);

  const handleFileSelect = useCallback((name: string, content: string) => {
    setFileName(name);
    setFileContent(content);
    setCurrentCode(content);
    // Signal to BidirectionalSync that a new file was opened
    setIsNewFile(false); // reset first to ensure the effect re-triggers even for sequential file opens
    setTimeout(() => setIsNewFile(true), 50);
  }, []);

  const handleFolderOpen = useCallback(async (
    folderName: string,
    files: { path: string; content: string }[],
    handle: FileSystemDirectoryHandle
  ) => {
    setSandboxRepoPath(folderName);
    setFolderName(folderName);
    const mappedFiles = files.map(f => ({ path: f.path, content: f.content }));
    setAllCodebaseFiles(mappedFiles);
    dirHandleRef.current = handle;

    // Try to load cached state from .cognicode/
    try {
      const cached = await loadCogniCodeState(handle);
      if (cached && cached.folder_name === folderName) {
        // Compute hashes of current files to check for changes
        const currentHashes = await computeAllHashes(files);
        const changes = detectChanges(cached.file_hashes, files, currentHashes);

        if (changes.total_changed === 0) {
          // No changes — restore everything from cache instantly!
          setCachedState(cached);
          if (cached.archeologist_report) {
            setBlueprintMarkdown(cached.archeologist_report.summary_markdown);
            setBlueprintPatterns(cached.archeologist_report.detected_patterns);
            setBlueprintConfidence(cached.archeologist_report.confidence_score);
          }
          if (cached.blast_radius) {
            setGraphNodes(cached.blast_radius.nodes as Node[]);
            setGraphEdges(cached.blast_radius.edges as Edge[]);
            setGraphSummary(cached.blast_radius.analysis_summary);
            setOriginalGraphNodes(cached.blast_radius.nodes as Node[]);
            setOriginalGraphEdges(cached.blast_radius.edges as Edge[]);
          }
          if (cached.codebase_map) {
            setCodebaseMapData(cached.codebase_map);
          }
          if (cached.knowledge_graph) {
            setKnowledgeGraphData(cached.knowledge_graph);
          }
          if (cached.last_synced_doc) {
            setLastSyncedDoc({
              markdown: cached.last_synced_doc.updated_markdown,
              changes: cached.last_synced_doc.changes_detected,
              isStable: cached.last_synced_doc.sync_status === "stable",
            });
          }
          if (cached.rag_pipeline) {
            setRagPipelineData(cached.rag_pipeline);
          }
          if (cached.graph_summary) {
            setGraphSummaryCache(cached.graph_summary);
          }
          setSyncStatus("synced");
          setCacheStatus(`Restored from cache (${Object.keys(cached.file_hashes).length} files, no changes)`);
          setTimeout(() => setCacheStatus(""), 5000);
        } else {
          // Files changed — still restore all cached data so the UI is populated
          setCachedState(cached);
          if (cached.archeologist_report) {
            setBlueprintMarkdown(cached.archeologist_report.summary_markdown);
            setBlueprintPatterns(cached.archeologist_report.detected_patterns);
            setBlueprintConfidence(cached.archeologist_report.confidence_score);
          }
          if (cached.blast_radius) {
            setGraphNodes(cached.blast_radius.nodes as Node[]);
            setGraphEdges(cached.blast_radius.edges as Edge[]);
            setGraphSummary(cached.blast_radius.analysis_summary);
            setOriginalGraphNodes(cached.blast_radius.nodes as Node[]);
            setOriginalGraphEdges(cached.blast_radius.edges as Edge[]);
          }
          if (cached.codebase_map) {
            setCodebaseMapData(cached.codebase_map);
          }
          if (cached.knowledge_graph) {
            setKnowledgeGraphData(cached.knowledge_graph);
          }
          if (cached.last_synced_doc) {
            setLastSyncedDoc({
              markdown: cached.last_synced_doc.updated_markdown,
              changes: cached.last_synced_doc.changes_detected,
              isStable: cached.last_synced_doc.sync_status === "stable",
            });
          }
          if (cached.rag_pipeline) {
            setRagPipelineData(cached.rag_pipeline);
          }
          if (cached.graph_summary) {
            setGraphSummaryCache(cached.graph_summary);
          }
          setSyncStatus("synced");
          setCacheStatus(`Restored from cache · ${changes.total_changed} file(s) changed — re-analyze for updates`);
          setTimeout(() => setCacheStatus(""), 8000);
        }
      }
    } catch {
      // No cache — first time analysis, that's fine
    }

    // Auto-ingest files into RAG engine
    if (files.length > 0) {
      setRagStatus(`Ingesting ${files.length} files...`);
      try {
        const result = await ingestFiles({ folder_name: folderName, files });
        setRagStatus(`Indexed ${result.ingestion_stats.total_chunks} chunks from ${files.length} files`);
        setRagPipelineData({
          total_chunks: result.ingestion_stats.total_chunks,
          last_ingested_at: new Date().toISOString(),
        });
        setTimeout(() => setRagStatus(""), 5000);
      } catch {
        setRagStatus("Ingestion failed");
        setTimeout(() => setRagStatus(""), 3000);
      }
    }
  }, []);

  const handleCodeChange = useCallback((code: string) => {
    setCurrentCode(code);
    if (syncStatus === "synced") setSyncStatus("idle");
  }, [syncStatus]);

  // Auto-save sync doc to .cognicode/ whenever it changes
  useEffect(() => {
    if (!lastSyncedDoc || !dirHandleRef.current || !cachedState) return;

    const saveSync = async () => {
      try {
        const handle = dirHandleRef.current;
        if (!handle) return;

        const updatedState = {
          ...cachedState,
          updated_at: new Date().toISOString(),
          last_synced_doc: {
            updated_markdown: lastSyncedDoc.markdown,
            changes_detected: lastSyncedDoc.changes,
            sync_status: lastSyncedDoc.isStable ? "stable" : "drift",
          },
        };

        await saveCogniCodeState(handle, updatedState);
        setCachedState(updatedState);
        console.log("[CogniCode] Sync doc saved to .cognicode/");
      } catch (err) {
        console.error("[CogniCode] Failed to save sync doc:", err);
      }
    };

    saveSync();
  }, [lastSyncedDoc]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalyze = useCallback(async (code: string) => {
    setIsAnalyzing(true);
    setIsBlueprintLoading(true);
    setIsGraphLoading(true);
    setSyncStatus("analyzing");

    const language = detectLanguage(fileName);
    const hasCodebase = allCodebaseFiles.length > 0;

    try {
      let archPromise;
      let blastPromise;

      if (hasCodebase) {
        // Check if we can do incremental analysis
        let useIncremental = false;
        if (cachedState && cachedState.archeologist_report) {
          const currentHashes = await computeAllHashes(allCodebaseFiles);
          const changes = detectChanges(cachedState.file_hashes, allCodebaseFiles, currentHashes);

          if (shouldUseIncremental(changes)) {
            useIncremental = true;
            setCacheStatus(`Incremental: re-analyzing ${changes.total_changed} changed file(s)...`);

            // Get only the changed + added file contents
            const changedFilePaths = new Set([...changes.added, ...changes.modified]);
            const changedFiles = allCodebaseFiles.filter(f => changedFilePaths.has(f.path));

            archPromise = incrementalAnalyze({
              folder_name: folderName,
              changed_files: changedFiles,
              deleted_paths: changes.deleted,
              previous_report: cachedState.archeologist_report.summary_markdown,
              previous_patterns: cachedState.archeologist_report.detected_patterns,
              previous_graph_summary: graphSummaryCache || cachedState.graph_summary || "",
            });
          }
        }

        if (!useIncremental) {
          // Full analysis (first time or too many changes)
          archPromise = analyzeCodebaseArchitecture({
            folder_name: folderName,
            files: allCodebaseFiles,
          });
        }

        blastPromise = getCodebaseBlastRadius({
          folder_name: folderName,
          files: allCodebaseFiles,
        });
      } else {
        // Fallback: single-file analysis
        if (!code.trim()) {
          setIsAnalyzing(false);
          setIsBlueprintLoading(false);
          setIsGraphLoading(false);
          return;
        }
        archPromise = analyzeArchitecture({ code, language });
        blastPromise = getBlastRadius({ code, language });
      }

      const [archResult, blastResult] = await Promise.allSettled([
        archPromise,
        blastPromise,
      ]);

      let archData: { summary_markdown: string; detected_patterns: string[]; confidence_score: number } | null = null;
      let blastData: { nodes: unknown[]; edges: unknown[]; analysis_summary: string } | null = null;

      if (archResult.status === "fulfilled" && archResult.value) {
        archData = archResult.value;
        setBlueprintMarkdown(archData.summary_markdown);
        setBlueprintPatterns(archData.detected_patterns);
        setBlueprintConfidence(archData.confidence_score);
      }

      if (blastResult.status === "fulfilled" && blastResult.value) {
        blastData = blastResult.value;
        setGraphNodes(blastData.nodes as Node[]);
        setGraphEdges(blastData.edges as Edge[]);
        setGraphSummary(blastData.analysis_summary);
        setOriginalGraphNodes(blastData.nodes as Node[]);
        setOriginalGraphEdges(blastData.edges as Edge[]);
        setSimulationSummary("");
        setSimulationFailed(false);
        setSimulationWarnings([]);
      }

      // Fetch codebase map + knowledge graph in background, then save to .cognicode/
      if (hasCodebase) {
        setIsMapLoading(true);

        // Fire both requests in parallel
        const mapPromise = getCodebaseMap({ folder_name: folderName, files: allCodebaseFiles })
          .then(mapResult => { setCodebaseMapData(mapResult); return mapResult; })
          .catch(() => null);

        const kgPromise = getKnowledgeGraph({ folder_name: folderName, files: allCodebaseFiles })
          .then(kg => { console.log("[CogniCode] KG result:", kg?.nodes?.length, "nodes"); setKnowledgeGraphData(kg); return kg; })
          .catch(err => { console.error("[CogniCode] KG failed:", err); return null; });

        // Wait for both to complete
        const [mapResult, kgResult] = await Promise.all([mapPromise, kgPromise]);
        setIsMapLoading(false);

        // Save state to .cognicode/
        const handle = dirHandleRef.current;
        console.log("[CogniCode] dirHandle available for save:", !!handle);
        if (handle) {
          try {
            console.log("[CogniCode] Computing file hashes for .cognicode/ save...");
            const fileHashes = await computeAllHashes(allCodebaseFiles);
            const graphSummaryForCache = archData
              ? archData.summary_markdown
              : "";

            const state = buildState({
              folderName,
              fileHashes,
              graphSummary: graphSummaryForCache,
              archeologist: archData ? {
                summary_markdown: archData.summary_markdown,
                detected_patterns: archData.detected_patterns,
                confidence_score: archData.confidence_score,
              } : undefined,
              blastRadius: blastData ? {
                nodes: blastData.nodes as unknown[],
                edges: blastData.edges as unknown[],
                analysis_summary: blastData.analysis_summary,
              } : undefined,
              knowledgeGraph: kgResult ? {
                nodes: kgResult.nodes as unknown[],
                edges: kgResult.edges as unknown[],
                clusters: kgResult.clusters as unknown[],
                statistics: kgResult.statistics as Record<string, unknown>,
              } : undefined,
              codebaseMap: mapResult || undefined,
              lastSyncedDoc: lastSyncedDoc ? {
                updated_markdown: lastSyncedDoc.markdown,
                changes_detected: lastSyncedDoc.changes,
                sync_status: lastSyncedDoc.isStable ? "stable" : "drift",
              } : undefined,
              ragPipeline: ragPipelineData || undefined,
              existingState: cachedState,
            });

            await saveCogniCodeState(handle, state);
            setCachedState(state);
            setCacheStatus("✅ Analysis saved to .cognicode/");
            console.log("[CogniCode] State saved successfully!");
            setTimeout(() => setCacheStatus(""), 4000);
          } catch (err) {
            console.error("[CogniCode] Failed to save state:", err);
            setCacheStatus("❌ Failed to save .cognicode/");
            setTimeout(() => setCacheStatus(""), 4000);
          }
        } else {
          console.warn("[CogniCode] No dirHandle — cannot save .cognicode/. Did you open a folder?");
        }
      }

      setSyncStatus("synced");
    } catch {
      setSyncStatus("idle");
    } finally {
      setIsAnalyzing(false);
      setIsBlueprintLoading(false);
      setIsGraphLoading(false);
    }
  }, [fileName, detectLanguage, allCodebaseFiles, folderName, cachedState, graphSummaryCache]);

  const handleSubmitPR = useCallback(async (code: string): Promise<GatekeeperResponse> => {
    const language = detectLanguage(fileName);
    const result = await evaluateGatekeeper({ code, language });
    setGatekeeperMetrics(result.metrics);
    return result;
  }, [fileName, detectLanguage]);

  const handleSimulate = useCallback(async (rps: number) => {
    if (originalGraphNodes.length === 0) return;
    setIsSimulating(true);
    try {
      const result = await simulateSandbox({
        nodes: originalGraphNodes.map(n => ({
          id: n.id,
          type: (n.type as string) || "serviceNode",
          position: n.position as { x: number; y: number },
          data: n.data as Record<string, string>,
        })),
        edges: originalGraphEdges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          animated: (e.animated as boolean) ?? true,
          style: (e.style as Record<string, string | number>) || {},
          sourceHandle: (e.sourceHandle as string) || null,
          targetHandle: (e.targetHandle as string) || null,
        })),
        requests_per_second: rps,
        metrics: gatekeeperMetrics,
      });
      setGraphNodes(result.nodes as unknown as Node[]);
      setGraphEdges(result.edges as unknown as Edge[]);
      setSimulationSummary(result.simulation_summary);
      setSimulationFailed(result.failed);
      setSimulationWarnings(result.warnings);
    } catch {
      setSimulationSummary("Simulation request failed. Ensure the backend is running.");
      setSimulationFailed(true);
    } finally {
      setIsSimulating(false);
    }
  }, [originalGraphNodes, originalGraphEdges, gatekeeperMetrics]);

  const handleExplorerResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = "explorer";
      setIsDragging(true);
      startXRef.current = e.clientX;
      startValueRef.current = explorerWidth;
    },
    [explorerWidth]
  );

  const handleEditorResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = "editor";
      setIsDragging(true);
      startXRef.current = e.clientX;
      startValueRef.current = editorFraction;
    },
    [editorFraction]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !mainRef.current) return;
      const delta = e.clientX - startXRef.current;

      if (draggingRef.current === "explorer") {
        setExplorerWidth(Math.max(140, Math.min(400, startValueRef.current + delta)));
      }

      if (draggingRef.current === "editor") {
        const mainRect = mainRef.current.getBoundingClientRect();
        const availableWidth = mainRect.width - 40 - (explorerOpen ? explorerWidth : 0) - 12;
        if (availableWidth <= 0) return;
        setEditorFraction(
          Math.max(0.2, Math.min(0.8, startValueRef.current + delta / availableWidth))
        );
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [explorerOpen, explorerWidth]);

  const handleSandboxToggle = useCallback(async () => {
    if (sandboxMode) {
      setSandboxMode(false);
      setSandboxBranch("");
      setSandboxError("");
      setMergeMessage("");
      return;
    }

    setSandboxMode(true);
    setSandboxError("");
    // Capture original file content for diff preview
    setSandboxOriginalCode(currentCode);

    let repoPath = sandboxRepoPath;
    if (!repoPath || (!repoPath.includes("/") && !repoPath.includes("\\"))) {
      const userPath = window.prompt(
        "Enter the full filesystem path to your git repository:",
        "C:\\Users\\sarth\\OneDrive\\Desktop\\hackathons\\watch the code 26\\CogniCode"
      );
      if (!userPath) {
        setSandboxBranch("local/sandbox-preview");
        setSandboxOriginalBranch("main");
        return;
      }
      repoPath = userPath;
      setSandboxRepoPath(repoPath);
    }

    setIsSandboxLoading(true);
    try {
      const result = await spawnSandbox({ repo_path: repoPath });
      setSandboxBranch(result.branch_name);
      setSandboxOriginalBranch(result.original_branch);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Git branch creation failed";
      setSandboxError(msg);
      setSandboxBranch("local/sandbox-preview");
      setSandboxOriginalBranch("main");
    } finally {
      setIsSandboxLoading(false);
    }
  }, [sandboxMode, sandboxRepoPath]);

  const handleMergeToProduction = useCallback(async () => {
    if (!sandboxBranch || !sandboxRepoPath) return;
    setIsMerging(true);
    setMergeMessage("");
    try {
      const result = await mergeAndDestroySandbox({
        repo_path: sandboxRepoPath,
        sandbox_branch: sandboxBranch,
        target_branch: sandboxOriginalBranch || "main",
      });
      setMergeMessage(result.message);
      setSandboxMode(false);
      setSandboxBranch("");
      setTimeout(() => setMergeMessage(""), 5000);
    } catch (e) {
      setMergeMessage(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setIsMerging(false);
    }
  }, [sandboxBranch, sandboxRepoPath, sandboxOriginalBranch]);

  const currentLanguage = detectLanguage(fileName);

  const TABS: { id: RightTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "archeologist",
      label: "Archeologist",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      ),
    },
    {
      id: "sync",
      label: "Sync",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      ),
    },
    {
      id: "graph",
      label: "Blast Radius",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      ),
    },
    {
      id: "assistant" as RightTab,
      label: "AI Assistant",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
          <circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" />
        </svg>
      ),
    },
    {
      id: "rag",
      label: "RAG",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      ),
    },
    {
      id: "stresstest",
      label: "Stress Test",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
    },
    {
      id: "designdocs",
      label: "HLD / LLD",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      id: "gitsync",
      label: "Git Sync",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`flex h-screen w-screen flex-col overflow-hidden bg-background transition-all duration-300 ${sandboxMode ? "ring-2 ring-amber-500/40 ring-inset" : ""}`}>
      <header className={`flex h-12 shrink-0 items-center justify-between border-b px-5 backdrop-blur-md transition-colors duration-300 ${sandboxMode ? "border-amber-500/30 bg-amber-950/20" : "border-border bg-surface/80"}`}>
        <div className="flex items-center gap-3">
          <Link href="/landing" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br shadow-md ${sandboxMode ? "from-amber-500 to-orange-600 shadow-amber-500/20" : "from-indigo-500 to-purple-600 shadow-indigo-500/20"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-text-primary">CogniCode</span>
          </Link>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${sandboxMode ? "bg-amber-500/15 text-amber-400" : "bg-accent/10 text-accent-bright"}`}>
            {sandboxMode ? "Sandbox" : "Sentinel v2.1"}
          </span>
          {cacheStatus && (
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400 animate-pulse">
              💾 {cacheStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {sandboxError && (
            <span className="text-xs text-danger">{sandboxError}</span>
          )}
          {mergeMessage && (
            <span className="text-xs text-success">{mergeMessage}</span>
          )}

          {sandboxMode && (
            <button
              onClick={handleMergeToProduction}
              disabled={isMerging}
              className="flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-1 text-xs font-semibold text-success hover:bg-success/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isMerging ? (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="18" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <path d="M6 21V9a9 9 0 0 0 9 9" />
                </svg>
              )}
              Merge to Production
            </button>
          )}

          <div className="h-5 w-px bg-border"></div>

          <Link
            href="/landing"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/30 hover:bg-accent/5 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home
          </Link>

          <div className="h-5 w-px bg-border"></div>

          <button
            onClick={handleSandboxToggle}
            disabled={isSandboxLoading}
            className={`group relative flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
              sandboxMode
                ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                : "bg-zinc-500/10 text-text-muted hover:bg-zinc-500/20 hover:text-text-secondary"
            }`}
          >
            <div className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${
              sandboxMode ? "bg-amber-500" : "bg-zinc-700"
            }`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                sandboxMode ? "translate-x-4" : "translate-x-0.5"
              }`}></div>
            </div>
            {isSandboxLoading ? "Spawning..." : sandboxMode ? "Sandbox" : "Production"}
          </button>

          <div className="h-5 w-px bg-border"></div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${sandboxMode ? "bg-amber-500/10" : "bg-success/10"}`}>
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${sandboxMode ? "bg-amber-500" : "bg-success"}`}></span>
              <span className={`relative inline-flex h-2 w-2 rounded-full ${sandboxMode ? "bg-amber-500" : "bg-success"}`}></span>
            </span>
            <span className={`text-xs font-medium ${sandboxMode ? "text-amber-400" : "text-success"}`}>
              {sandboxMode ? "Isolated Environment" : "All Systems Operational"}
            </span>
          </div>
        </div>
      </header>

      {/* Codebase Stats Bar */}
      {codebaseMapData?.summary && (
        <div className="shrink-0 flex items-center gap-4 px-5 py-1.5 border-b border-border bg-surface/50">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="text-accent-bright font-bold">📄 {codebaseMapData.summary.total_files}</span> files
            </span>
            <span className="text-text-muted/20">•</span>
            <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="text-accent-bright font-bold">🏗️ {codebaseMapData.summary.total_classes}</span> classes
            </span>
            <span className="text-text-muted/20">•</span>
            <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="text-accent-bright font-bold">⚡ {codebaseMapData.summary.total_functions}</span> functions
            </span>
            <span className="text-text-muted/20">•</span>
            <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="text-accent-bright font-bold">{codebaseMapData.summary.total_lines?.toLocaleString()}</span> lines
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {codebaseMapData.summary.languages?.map((lang: string) => (
              <span key={lang} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-bright">
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      {sandboxMode && sandboxBranch && (
        <div className="shrink-0 flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-5 py-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M6 21V9a9 9 0 0 0 9 9" />
          </svg>
          <span className="text-xs font-medium text-amber-300">
            Branch: <span className="font-mono text-amber-400">{sandboxBranch}</span>
          </span>
          <span className="text-xs text-amber-400/50">←</span>
          <span className="text-xs text-amber-400/60 font-mono">{sandboxOriginalBranch}</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSandboxPreviewOpen(!sandboxPreviewOpen)}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/25 transition-all cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {sandboxPreviewOpen ? "Hide Preview" : "Preview Changes"}
            </button>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-[10px] font-medium text-amber-400/70">Changes isolated — merge when ready</span>
          </div>
        </div>
      )}

      {/* Sandbox Preview Diff Panel */}
      {sandboxMode && sandboxPreviewOpen && (
        <div className="shrink-0 border-b border-amber-500/20 bg-zinc-950 max-h-[300px] overflow-y-auto">
          <div className="flex items-center gap-2 px-5 py-2 border-b border-amber-500/10 bg-amber-500/5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-xs font-semibold text-amber-300">Sandbox Changes Preview</span>
            {fileName && (
              <span className="text-[10px] font-mono text-amber-400/70">{fileName}</span>
            )}
            <button
              onClick={() => setSandboxPreviewOpen(false)}
              className="ml-auto text-text-muted hover:text-text-primary cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {currentCode === sandboxOriginalCode ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-text-muted">No changes detected — edit some code in the editor to see the diff</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-amber-500/10">
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-danger"></span>
                  <span className="text-[10px] font-semibold text-danger uppercase tracking-wider">Original</span>
                </div>
                <pre className="font-mono text-[11px] text-text-muted whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">{sandboxOriginalCode || '(empty)'}</pre>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
                  <span className="text-[10px] font-semibold text-success uppercase tracking-wider">Modified</span>
                </div>
                <pre className="font-mono text-[11px] text-text-primary whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">{currentCode}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      <main ref={mainRef} className="flex flex-1 overflow-hidden bg-zinc-950">
        {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}

        {/* Activity Bar */}
        <div className="flex shrink-0 flex-col border-r border-border bg-surface">
          <button
            onClick={() => setExplorerOpen(!explorerOpen)}
            className={`flex h-10 w-10 items-center justify-center transition-colors cursor-pointer ${
              explorerOpen ? "text-text-primary bg-white/5" : "text-text-muted hover:text-text-primary"
            }`}
            title="Toggle Explorer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" x2="8" y1="13" y2="13" />
              <line x1="16" x2="8" y1="17" y2="17" />
              <line x1="10" x2="8" y1="9" y2="9" />
            </svg>
          </button>
          <button className="flex h-10 w-10 items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer" title="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
          <button className="flex h-10 w-10 items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer" title="Source Control">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M6 21V9a9 9 0 0 0 9 9" />
            </svg>
          </button>
        </div>

        {/* Explorer */}
        {explorerOpen && (
          <>
            <div className="shrink-0 overflow-hidden" style={{ width: explorerWidth }}>
              <FileExplorer onFileSelect={handleFileSelect} onFolderOpen={handleFolderOpen} />
            </div>
            <ResizeHandle onMouseDown={handleExplorerResizeStart} />
          </>
        )}

        {/* Main Panes */}
        <div className="flex flex-1 overflow-hidden p-1.5" style={{ gap: 0 }}>
          {/* Editor */}
          <section
            id="pane-codebase"
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface animate-fade-in-up"
            style={{ width: `${editorFraction * 100}%` }}
          >
            <CodeEditor
              fileName={fileName}
              fileContent={fileContent}
              onCodeChange={handleCodeChange}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              hasCodebase={allCodebaseFiles.length > 0}
            />
          </section>

          <ResizeHandle onMouseDown={handleEditorResizeStart} />

          {/* Right Panel — All 5 Features */}
          <section
            id="pane-right"
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface animate-fade-in-up"
            style={{ width: `${(1 - editorFraction) * 100}%`, animationDelay: "100ms" }}
          >
            {/* Tab Bar */}
            <div className="flex shrink-0 items-center border-b border-border overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"></span>
                  )}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 pr-3">
                {activeTab === "archeologist" && (
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      syncStatus === "synced"
                        ? "bg-success/15 text-success"
                        : syncStatus === "analyzing"
                        ? "bg-warning/15 text-warning"
                        : "bg-zinc-500/15 text-text-muted"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        syncStatus === "synced"
                          ? "bg-success animate-pulse"
                          : syncStatus === "analyzing"
                          ? "bg-warning animate-spin"
                          : "bg-zinc-500"
                      }`}
                    ></span>
                    {syncStatus === "synced" ? "Synced" : syncStatus === "analyzing" ? "Analyzing" : "Idle"}
                  </span>
                )}
              </div>
            </div>

            {/* Tab Content */}
            <div className="relative flex-1 overflow-hidden">
              {/* Tab 1: Legacy Archeologist */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  activeTab === "archeologist"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <div className="flex h-full flex-col">
                  <div className="flex-1 overflow-hidden">
                    <DocumentViewer
                      markdown={blueprintMarkdown}
                      isLoading={isBlueprintLoading}
                      patterns={blueprintPatterns.length > 0 ? blueprintPatterns : undefined}
                      confidence={blueprintConfidence}
                      fileName={fileName}
                    />
                  </div>
                </div>
              </div>

              {/* Tab 2: Bidirectional Sync */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  activeTab === "sync"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 pointer-events-none"
                }`}
              >
                <BidirectionalSync
                  allFiles={allCodebaseFiles}
                  folderName={folderName}
                  hasCodebase={allCodebaseFiles.length > 0}
                  editingFileName={fileName}
                  editingCode={currentCode}
                  initialDoc={lastSyncedDoc?.markdown}
                  onSyncComplete={(data) => setLastSyncedDoc(data)}
                />
              </div>

              {/* Tab 3: Blast Radius */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  activeTab === "graph"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 pointer-events-none"
                }`}
              >
                <DependencyGraph
                  nodes={graphNodes}
                  edges={graphEdges}
                  isLoading={isGraphLoading}
                  summary={graphSummary}
                  codebaseMapData={codebaseMapData}
                  isMapLoading={isMapLoading}
                  knowledgeGraphData={knowledgeGraphData}
                  onFileClick={(filePath: string) => {
                    // Find the file in the codebase and open it in the editor
                    const match = allCodebaseFiles.find(f =>
                      f.path === filePath || f.path.endsWith(filePath) || filePath.endsWith(f.path)
                    );
                    if (match) {
                      handleFileSelect(match.path.split("/").pop() || match.path, match.content);
                    }
                  }}
                />
              </div>

              {/* Tab 4: RAG Engine */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  activeTab === "rag"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 pointer-events-none"
                }`}
              >
                <RAGPanel ragStatus={ragStatus} />
              </div>

              {/* Tab 5: Graph-Powered AI Agent */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  activeTab === "assistant"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 pointer-events-none"
                }`}
              >
                <GraphAssistant
                  allFiles={allCodebaseFiles}
                  folderName={folderName}
                  hasCodebase={allCodebaseFiles.length > 0}
                />
              </div>

              {/* Tab 5: Stress Test */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  activeTab === "stresstest"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 pointer-events-none"
                }`}
              >
                <StressTester />
              </div>

              {/* Tab 6: Design Docs (HLD / LLD) */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  activeTab === "designdocs"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 pointer-events-none"
                }`}
              >
                <DesignDocsPanel
                  hasCodebase={allCodebaseFiles.length > 0}
                  codebaseFiles={allCodebaseFiles}
                  folderName={folderName}
                />
              </div>

              {/* Tab 7: Git Sync */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  activeTab === "gitsync"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4 pointer-events-none"
                }`}
              >
                <GitSyncPanel />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
