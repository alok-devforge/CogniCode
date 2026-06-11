"use client";

import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Handle,
  Position,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { memo, useState, useCallback, useMemo } from "react";
import CodebaseMap from "./CodebaseMap";

// ── Status Colors ───────────────────────────────────────────────────────

const statusColors: Record<string, { bg: string; border: string; dot: string; text: string; glow: string }> = {
  healthy: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.3)", dot: "#22c55e", text: "#4ade80", glow: "0 0 12px rgba(34,197,94,0.2)" },
  warning: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", dot: "#f59e0b", text: "#fbbf24", glow: "0 0 12px rgba(245,158,11,0.2)" },
  critical: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)", dot: "#ef4444", text: "#f87171", glow: "0 0 16px rgba(239,68,68,0.3)" },
};

// ── Group Node (directory container) ────────────────────────────────────

const GroupNode = memo(({ data }: { data: Record<string, string> }) => {
  return (
    <div
      className="rounded-xl border border-zinc-700/40 h-full w-full"
      style={{
        background: "rgba(24,24,27,0.4)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-700/30">
        <span className="text-[11px] font-semibold text-zinc-300 font-mono truncate">
          📁 {data.label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-zinc-500">{data.fileCount} files</span>
          <span className="text-[9px] text-zinc-500">{data.totalLines} lines</span>
        </div>
      </div>
    </div>
  );
});
GroupNode.displayName = "GroupNode";

// ── Service Node (file card) ────────────────────────────────────────────

const ServiceNode = memo(({ data }: { data: Record<string, string> }) => {
  const status = statusColors[data.status] || statusColors.healthy;
  const isDimmed = data.dimmed === "true";
  const isHighlighted = data.highlighted === "true";
  const riskScore = parseInt(data.riskScore || "0");

  return (
    <div
      className={`group relative rounded-xl border px-3 py-2.5 backdrop-blur-sm transition-all duration-300 ${isDimmed ? "opacity-15" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${status.bg}, rgba(24,24,27,0.95))`,
        borderColor: isHighlighted ? "#6366f1" : status.border,
        minWidth: 180,
        boxShadow: isHighlighted ? "0 0 24px rgba(99,102,241,0.5)" : status.glow,
      }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !bg-zinc-700 !border-zinc-500" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !bg-zinc-700 !border-zinc-500" />
      <Handle type="source" position={Position.Right} id="right" className="!h-2 !w-2 !border-2 !bg-zinc-700 !border-zinc-500" />
      <Handle type="target" position={Position.Left} id="left" className="!h-2 !w-2 !border-2 !bg-zinc-700 !border-zinc-500" />

      {/* Header: icon + name */}
      <div className="flex items-center gap-2">
        <span className="text-sm">{data.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-zinc-100 truncate">{data.label}</div>
          <div className="text-[10px] mt-0.5" style={{ color: status.text }}>{data.statusLabel}</div>
        </div>
      </div>

      {/* Coupling bar */}
      {(data.couplingIn || data.couplingOut) && (
        <div className="mt-2 flex items-center gap-1">
          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden flex">
            <div
              className="h-full rounded-l-full"
              style={{
                width: `${Math.min(parseInt(data.couplingIn || "0") * 15, 50)}%`,
                background: "#6366f1",
              }}
            />
            <div
              className="h-full rounded-r-full"
              style={{
                width: `${Math.min(parseInt(data.couplingOut || "0") * 15, 50)}%`,
                background: "#f59e0b",
              }}
            />
          </div>
          <span className="text-[9px] text-zinc-500 shrink-0">
            ↓{data.couplingIn} ↑{data.couplingOut}
          </span>
        </div>
      )}

      {/* Metrics row */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{data.metricLabel}</span>
        <span className="font-mono text-[10px] font-semibold text-zinc-300">{data.metric}</span>
      </div>

      {/* Risk indicator */}
      {riskScore >= 4 && (
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
      )}

      {/* Hover tooltip */}
      {(data.classNames || data.funcNames) && (
        <div className="hidden group-hover:block absolute left-0 top-full mt-1 z-50 w-56 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 shadow-xl">
          {data.classNames && (
            <div className="text-[10px] text-zinc-400">
              <span className="text-purple-400 font-semibold">Classes:</span> {data.classNames}
            </div>
          )}
          {data.funcNames && (
            <div className="text-[10px] text-zinc-400 mt-0.5">
              <span className="text-blue-400 font-semibold">Functions:</span> {data.funcNames}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
ServiceNode.displayName = "ServiceNode";

const nodeTypes = { serviceNode: ServiceNode, group: GroupNode };

// ── Knowledge Graph Tab ─────────────────────────────────────────────────

interface KnowledgeGraphData {
  nodes: { id: string; label: string; type: string; metadata: Record<string, unknown> }[];
  edges: { source: string; target: string; type: string; label: string; relationship?: string; weight?: number }[];
  clusters: { name: string; files: string[] }[];
  statistics: Record<string, unknown>;
}

function KnowledgeGraphView({ data, onFileClick }: { data: KnowledgeGraphData | null; onFileClick?: (filePath: string) => void }) {
  const { kgNodes, kgEdges, keyNodeCount } = useMemo(() => {
    if (!data || !data.nodes?.length) return { kgNodes: [] as Node[], kgEdges: [] as Edge[], keyNodeCount: 0 };

    const fileNodes = data.nodes.filter(n => n.type === "file");
    const classNodes = data.nodes.filter(n => n.type === "class");
    const getEdgeType = (e: { type?: string; relationship?: string; label?: string }) => 
      e.type || (e as Record<string, unknown>).relationship as string || e.label || "";
    const importEdges = data.edges.filter(e => {
      const t = getEdgeType(e);
      return t === "imports" || t === "inheritance" || t === "inherits";
    });
    const containsEdges = data.edges.filter(e => {
      const t = getEdgeType(e);
      return t === "contains";
    });

    // fileId → classes
    const fileClasses: Record<string, typeof classNodes> = {};
    for (const ce of containsEdges) {
      const cls = classNodes.find(n => n.id === ce.target);
      if (cls) (fileClasses[ce.source] ||= []).push(cls);
    }

    // Weight scoring
    const fileWeights: Record<string, number> = {};
    for (const node of fileNodes) {
      const inDeg = importEdges.filter(e => e.target === node.id).length;
      const outDeg = importEdges.filter(e => e.source === node.id).length;
      const clsCount = (fileClasses[node.id] || []).length;
      const funcCount = (node.metadata?.function_count as number) || 0;
      fileWeights[node.id] = (inDeg + outDeg) * 3 + clsCount * 2 + (funcCount > 5 ? 1 : 0);
    }

    // Only show significant files
    const significant = fileNodes.filter(n => fileWeights[n.id] >= 1)
      .sort((a, b) => fileWeights[b.id] - fileWeights[a.id]);

    // Language colors
    const langColors: Record<string, { bg: string; border: string; text: string }> = {
      python: { bg: "rgba(250,204,21,0.10)", border: "rgba(250,204,21,0.5)", text: "#facc15" },
      javascript: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.5)", text: "#f59e0b" },
      typescript: { bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.5)", text: "#3b82f6" },
      java: { bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.5)", text: "#f97316" },
      go: { bg: "rgba(14,165,233,0.10)", border: "rgba(14,165,233,0.5)", text: "#0ea5e9" },
      rust: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.5)", text: "#ef4444" },
      cpp: { bg: "rgba(6,182,212,0.10)", border: "rgba(6,182,212,0.5)", text: "#06b6d4" },
      default: { bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.5)", text: "#6366f1" },
    };

    // ── Multi-Center Hierarchical Layout ──
    // Each top-level folder becomes its own center node

    // Group files by their top-level directory
    const topLevelGroups: Record<string, typeof significant> = {};
    const rootFiles: typeof significant = [];
    for (const node of significant) {
      const parts = node.label.replace(/\\/g, "/").split("/");
      if (parts.length > 1) {
        const topDir = parts[0];
        (topLevelGroups[topDir] ||= []).push(node);
      } else {
        rootFiles.push(node);
      }
    }

    // If everything is under one folder, split by second level instead
    const topDirs = Object.keys(topLevelGroups);
    let centers: { id: string; label: string; files: typeof significant }[] = [];
    if (topDirs.length === 1 && rootFiles.length === 0) {
      // Single top-level: use second-level dirs as centers
      const onlyDir = topDirs[0];
      const subGroups: Record<string, typeof significant> = {};
      const subRootFiles: typeof significant = [];
      for (const node of topLevelGroups[onlyDir]) {
        const parts = node.label.replace(/\\/g, "/").split("/");
        if (parts.length > 2) {
          const subDir = parts[1];
          (subGroups[subDir] ||= []).push(node);
        } else {
          subRootFiles.push(node);
        }
      }
      for (const [dir, files] of Object.entries(subGroups)) {
        centers.push({ id: `center_${dir}`, label: dir, files });
      }
      if (subRootFiles.length > 0) {
        centers.push({ id: `center_${onlyDir}`, label: onlyDir, files: subRootFiles });
      }
    } else {
      // Multiple top-level dirs: each is a center
      for (const [dir, files] of Object.entries(topLevelGroups)) {
        centers.push({ id: `center_${dir}`, label: dir, files });
      }
      if (rootFiles.length > 0) {
        centers.push({ id: "center_root", label: "root", files: rootFiles });
      }
    }
    if (centers.length === 0) {
      centers = [{ id: "center_all", label: "project", files: significant }];
    }

    const positioned: Node[] = [];
    const allEdges: Edge[] = [];

    // 2. Place each center with its files radiating outward
    const centerSpacing = 900;
    let fileIdx = 0;

    centers.forEach((center, ci) => {
      // Center position: arrange centers horizontally
      const cx = ci * centerSpacing + 500;
      const cy = 500;

      // Center node
      positioned.push({
        id: center.id, type: "default",
        position: { x: cx - 50, y: cy - 18 },
        data: { label: `📁 ${center.label}` },
        style: {
          background: "rgba(99,102,241,0.15)", border: "2px solid rgba(99,102,241,0.6)",
          borderRadius: "50px", padding: "12px 24px", fontSize: "14px",
          fontFamily: "'Inter', system-ui, sans-serif", color: "#a5b4fc",
          fontWeight: 700, textAlign: "center" as const,
          boxShadow: "0 0 30px rgba(99,102,241,0.25), 0 0 60px rgba(99,102,241,0.1)",
        },
      });

      // Group files within this center by sub-directory
      const subGroups: Record<string, typeof significant> = {};
      const directFiles: typeof significant = [];
      for (const node of center.files) {
        const parts = node.label.replace(/\\/g, "/").split("/");
        // Remove the top-level dir(s) already represented by the center
        const remaining = parts.slice(1); // skip first segment
        if (remaining.length > 1) {
          const subDir = remaining[0];
          (subGroups[subDir] ||= []).push(node);
        } else {
          directFiles.push(node);
        }
      }

      // Place sub-directory nodes on inner ring
      const subDirs = Object.entries(subGroups);
      const allGroups = [
        ...subDirs.map(([name, files]) => ({ name, files, isDirect: false })),
        ...(directFiles.length ? [{ name: "root", files: directFiles, isDirect: true }] : []),
      ];

      const innerRadius = 200;
      const outerRadius = 380;

      allGroups.forEach((group, gi) => {
        const angle = (2 * Math.PI * gi) / Math.max(allGroups.length, 1) - Math.PI / 2;
        const subId = `${center.id}_sub_${group.name}`;

        if (!group.isDirect) {
          // Sub-folder node on inner ring
          const sx = cx + innerRadius * Math.cos(angle);
          const sy = cy + innerRadius * Math.sin(angle);

          positioned.push({
            id: subId, type: "default",
            position: { x: sx - 30, y: sy - 10 },
            data: { label: `📂 ${group.name}` },
            style: {
              background: "rgba(39,39,42,0.9)", border: "1.5px solid rgba(113,113,122,0.5)",
              borderRadius: "20px", padding: "6px 14px", fontSize: "11px",
              fontFamily: "monospace", color: "#d4d4d8", fontWeight: 600,
              textAlign: "center" as const,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            },
          });

          // Edge: center → sub-folder
          allEdges.push({
            id: `sub_${subId}`, source: center.id, target: subId,
            type: "smoothstep",
            style: { stroke: "#52525b", strokeWidth: 1.5 },
          });
        }

        // Place files on outer ring clustered around this sub-folder's angle
        const arcSpan = Math.min(Math.PI * 0.5, group.files.length * 0.18);
        const arcStart = angle - arcSpan / 2;

        group.files.forEach((node, fi) => {
          const fileAngle = group.files.length === 1
            ? angle
            : arcStart + (arcSpan * fi) / Math.max(group.files.length - 1, 1);
          const fx = cx + outerRadius * Math.cos(fileAngle);
          const fy = cy + outerRadius * Math.sin(fileAngle);
          const displayName = node.label.split("/").pop() || node.label;
          const lang = (node.metadata?.language as string) || "default";
          const lc = langColors[lang] || langColors.default;
          const weight = fileWeights[node.id];
          const isHub = weight >= 9;
          const classes = fileClasses[node.id] || [];
          const funcCount = (node.metadata?.function_count as number) || 0;

          const subtitle = [
            classes.length ? `${classes.length} cls` : "",
            funcCount ? `${funcCount} fn` : "",
          ].filter(Boolean).join(" · ");

          positioned.push({
            id: node.id, type: "default",
            position: { x: fx - 55, y: fy - 15 },
            data: { label: subtitle ? `${displayName}\n${subtitle}` : displayName },
            style: {
              background: lc.bg, border: `1.5px solid ${lc.border}`,
              borderRadius: isHub ? "16px" : "12px",
              padding: isHub ? "10px 20px" : "8px 14px",
              fontSize: isHub ? "12px" : "11px",
              fontFamily: "'Inter', system-ui, monospace",
              color: lc.text, fontWeight: isHub ? 700 : 500,
              textAlign: "center" as const, cursor: "pointer",
              whiteSpace: "pre-line" as const, lineHeight: "1.3",
              boxShadow: isHub
                ? `0 0 24px ${lc.border}, 0 0 48px ${lc.bg}`
                : "0 2px 8px rgba(0,0,0,0.3)",
            },
          });

          // Edge: sub-folder or center → file
          const parentId = group.isDirect ? center.id : subId;
          allEdges.push({
            id: `file_edge_${fileIdx}`, source: parentId, target: node.id,
            type: "smoothstep",
            style: { stroke: lc.border, strokeWidth: 1 },
          });
          fileIdx++;
        });
      });
    });

    // Import edges = the web cross-connections
    const nodeIdSet = new Set(positioned.map(n => n.id));
    const importEdgesOut: Edge[] = importEdges
      .filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map((e, i) => {
        const edgeType = getEdgeType(e);
        const isInherit = edgeType === "inheritance" || edgeType === "inherits";
        return {
          id: `kg_imp_${i}`, source: e.source, target: e.target,
          type: "smoothstep" as const,
          animated: isInherit,
          style: {
            stroke: isInherit ? "#a855f7" : "#4f46e5",
            strokeWidth: isInherit ? 2.5 : 1.8,
            strokeDasharray: isInherit ? "6 3" : undefined,
          },
          markerEnd: {
            type: "arrowclosed" as const,
            color: isInherit ? "#a855f7" : "#4f46e5",
            width: 14, height: 14,
          },
        };
      });

    return { kgNodes: positioned, kgEdges: [...allEdges, ...importEdgesOut], keyNodeCount: significant.length };
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-muted">Knowledge graph will be built after analysis</p>
      </div>
    );
  }

  const stats = data.statistics || {};

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border bg-surface/50 flex items-center gap-4 flex-wrap">
        <span className="text-[11px] font-semibold text-text-primary">Knowledge Graph</span>
        <span className="text-[10px] text-text-muted">•</span>
        <span className="text-[11px] text-blue-400">{String(stats.total_files || 0)} files</span>
        <span className="text-[11px] text-purple-400">{String(stats.total_classes || 0)} classes</span>
        <span className="text-[11px] text-indigo-400">📥 {String(stats.import_edges || 0)} imports</span>
        <span className="text-[11px] text-purple-400">🧬 {String(stats.inheritance_edges || 0)} inherits</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-semibold ml-auto">
          {keyNodeCount} key nodes shown
        </span>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative">
        {kgNodes.length > 0 ? (
          <>
            {/* Legend */}
            <div className="absolute bottom-3 right-3 z-10 rounded-xl bg-zinc-900/90 border border-zinc-700/50 px-4 py-2.5 backdrop-blur-md shadow-2xl">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-5 rounded bg-indigo-500" />
                  <span className="text-[10px] text-zinc-300">imports</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-5 rounded bg-purple-500" style={{ borderTop: "2px dashed #a855f7" }} />
                  <span className="text-[10px] text-zinc-300">inherits</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-md bg-indigo-500/15 border border-indigo-500/50 shadow-[0_0_6px_rgba(99,102,241,0.3)]" />
                  <span className="text-[10px] text-zinc-300">hub node</span>
                </div>
              </div>
            </div>

            <ReactFlow
              nodes={kgNodes} edges={kgEdges}
              defaultEdgeOptions={{ type: "smoothstep", style: { stroke: "#4f46e5", strokeWidth: 1.5 } }}
              fitView fitViewOptions={{ padding: 0.4 }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable nodesConnectable={false}
              minZoom={0.1} maxZoom={2}
              onNodeClick={(_: unknown, node: Node) => {
                // If it's a file node (not a folder/center), trigger open
                if (onFileClick && !node.id.startsWith("center_") && !node.id.startsWith("folder_") && !node.id.startsWith("kg_")) {
                  // node.id is the original file node id from KG data, find its label (path)
                  const fileNode = data?.nodes.find(n => n.id === node.id);
                  if (fileNode) onFileClick(fileNode.label);
                }
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e1e2e" />
              <Controls showInteractive={false} className="!bg-zinc-900 !border-zinc-700 !shadow-2xl [&>button]:!bg-zinc-900 [&>button]:!border-zinc-700 [&>button]:!fill-zinc-400 [&>button:hover]:!bg-zinc-800" />
            </ReactFlow>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-text-muted">No graph data — analyze a codebase first</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

interface DependencyGraphProps {
  nodes?: Node[];
  edges?: Edge[];
  isLoading?: boolean;
  summary?: string;
  simulationSummary?: string;
  simulationFailed?: boolean;
  simulationWarnings?: string[];
  onSimulate?: (rps: number) => void;
  isSimulating?: boolean;
  hasGatekeeperMetrics?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  codebaseMapData?: any;
  isMapLoading?: boolean;
  knowledgeGraphData?: KnowledgeGraphData | null;
  onFileClick?: (filePath: string) => void;
}

export default function DependencyGraph({
  nodes: propNodes,
  edges: propEdges,
  isLoading,
  summary,
  codebaseMapData,
  isMapLoading,
  knowledgeGraphData,
  onFileClick,
}: DependencyGraphProps) {
  const hasData = propNodes && propNodes.length > 0;
  const [viewMode, setViewMode] = useState<"impact" | "map" | "knowledge">("impact");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Impact analysis: when a node is clicked, highlight its dependents
  const { displayNodes, displayEdges, impactInfo } = useMemo(() => {
    if (!propNodes || !propEdges || !selectedNode) {
      return { displayNodes: propNodes, displayEdges: propEdges, impactInfo: null };
    }

    // Find all nodes affected by changing the selected node (skip group nodes)
    const affectedIds = new Set<string>();
    affectedIds.add(selectedNode);

    // BFS to find downstream dependents
    const queue = [selectedNode];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of propEdges) {
        if (edge.target === current && !affectedIds.has(edge.source)) {
          affectedIds.add(edge.source);
          queue.push(edge.source);
        }
        if (edge.source === current && !affectedIds.has(edge.target)) {
          affectedIds.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    const selectedLabel = String(propNodes.find(n => n.id === selectedNode)?.data?.label || "unknown");
    const affectedCount = affectedIds.size - 1;

    const nodes = propNodes.map(node => {
      if (node.type === "group") return node;
      return {
        ...node,
        data: {
          ...node.data,
          dimmed: affectedIds.has(node.id) ? "false" : "true",
          highlighted: node.id === selectedNode ? "true" : "false",
        },
      };
    });

    const edges = propEdges.map(edge => ({
      ...edge,
      style: affectedIds.has(edge.source) && affectedIds.has(edge.target)
        ? { stroke: "#6366f1", strokeWidth: 3 }
        : { stroke: "#333", strokeWidth: 1 },
      animated: affectedIds.has(edge.source) && affectedIds.has(edge.target),
    }));

    return {
      displayNodes: nodes,
      displayEdges: edges,
      impactInfo: { file: selectedLabel, affected: affectedCount },
    };
  }, [propNodes, propEdges, selectedNode]);

  const handleNodeClick = useCallback((_: unknown, node: Node) => {
    if (node.type === "group") return;
    setSelectedNode(prev => prev === node.id ? null : node.id);
  }, []);

  return (
    <div className="h-full w-full relative flex flex-col">
      {/* Header with tabs */}
      <div className="shrink-0 border-b border-border px-4 py-2 flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {([
            { key: "impact", label: "Impact Graph" },
            { key: "knowledge", label: "Knowledge Graph" },
            { key: "map", label: "Risk Map" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                viewMode === tab.key ? "bg-accent/15 text-accent-bright" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {viewMode === "impact" && hasData && (
          <span className="text-[10px] text-text-muted ml-2">
            Click a module to see its blast radius
          </span>
        )}

        {viewMode === "impact" && selectedNode && (
          <button
            onClick={() => setSelectedNode(null)}
            className="ml-auto text-[10px] text-accent-bright hover:underline cursor-pointer"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Impact banner */}
      {viewMode === "impact" && impactInfo && (
        <div className="shrink-0 px-4 py-2 border-b border-accent/20 bg-accent/5">
          <p className="text-xs text-text-primary">
            Changing <span className="font-semibold text-accent-bright">{impactInfo.file}</span> could affect{" "}
            <span className={`font-bold ${impactInfo.affected > 3 ? "text-red-400" : impactInfo.affected > 1 ? "text-amber-400" : "text-emerald-400"}`}>
              {impactInfo.affected} other module{impactInfo.affected !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 relative">
        {viewMode === "map" && (
          <div className="absolute inset-0 overflow-hidden">
            <CodebaseMap data={codebaseMapData} isLoading={isMapLoading} />
          </div>
        )}

        {viewMode === "knowledge" && (
          <div className="absolute inset-0 overflow-hidden">
            <KnowledgeGraphView data={knowledgeGraphData || null} onFileClick={onFileClick} />
          </div>
        )}

        {viewMode === "impact" && (
          <>
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center gap-3 justify-center bg-surface/80 backdrop-blur-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
                <span className="text-sm text-text-muted">Building dependency graph...</span>
              </div>
            )}

            {!hasData && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-text-muted">Open a folder and click Analyze to build the impact graph</p>
              </div>
            )}

            {hasData && (
              <>
                {summary && !selectedNode && (
                  <div className="absolute top-3 left-14 z-10 rounded-lg bg-surface/90 border border-border px-3 py-1.5 backdrop-blur-sm max-w-md">
                    <span className="text-[10px] text-text-muted">{summary}</span>
                  </div>
                )}
                {/* Legend */}
                <div className="absolute bottom-3 right-3 z-10 flex items-center gap-3 rounded-lg bg-surface/90 border border-border px-3 py-1.5 backdrop-blur-sm">
                  {[
                    { label: "Low Risk", color: "#22c55e" },
                    { label: "Medium", color: "#f59e0b" },
                    { label: "High Risk", color: "#ef4444" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-[10px] text-zinc-400">{s.label}</span>
                    </div>
                  ))}
                </div>
                <ReactFlow
                  nodes={displayNodes || []}
                  edges={displayEdges || []}
                  nodeTypes={nodeTypes}
                  defaultEdgeOptions={{
                    type: "smoothstep",
                    style: { stroke: "#6366f1", strokeWidth: 1.5 },
                    animated: false,
                  }}
                  fitView
                  fitViewOptions={{ padding: 0.3 }}
                  proOptions={{ hideAttribution: true }}
                  nodesDraggable={true}
                  nodesConnectable={false}
                  elementsSelectable={true}
                  onNodeClick={handleNodeClick}
                  minZoom={0.1}
                  maxZoom={2}
                >
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#27272a" />
                  <Controls
                    showInteractive={false}
                    className="!bg-surface !border-border !shadow-xl [&>button]:!bg-surface [&>button]:!border-border [&>button]:!fill-zinc-400 [&>button:hover]:!bg-surface-alt"
                  />
                </ReactFlow>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
