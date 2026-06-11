"use client";

import { useState, useMemo } from "react";

interface CodebaseMapProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  isLoading?: boolean;
}

const LANG_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  python: { bg: "rgba(250,204,21,0.08)", text: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-400" },
  javascript: { bg: "rgba(245,158,11,0.08)", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-400" },
  typescript: { bg: "rgba(59,130,246,0.08)", text: "text-blue-400", badge: "bg-blue-500/20 text-blue-400" },
  java: { bg: "rgba(249,115,22,0.08)", text: "text-orange-400", badge: "bg-orange-500/20 text-orange-400" },
  cpp: { bg: "rgba(6,182,212,0.08)", text: "text-cyan-400", badge: "bg-cyan-500/20 text-cyan-400" },
  c: { bg: "rgba(6,182,212,0.08)", text: "text-cyan-400", badge: "bg-cyan-500/20 text-cyan-400" },
  go: { bg: "rgba(14,165,233,0.08)", text: "text-sky-400", badge: "bg-sky-500/20 text-sky-400" },
  rust: { bg: "rgba(239,68,68,0.08)", text: "text-red-400", badge: "bg-red-500/20 text-red-400" },
  ruby: { bg: "rgba(244,63,94,0.08)", text: "text-rose-400", badge: "bg-rose-500/20 text-rose-400" },
  php: { bg: "rgba(99,102,241,0.08)", text: "text-indigo-400", badge: "bg-indigo-500/20 text-indigo-400" },
  csharp: { bg: "rgba(139,92,246,0.08)", text: "text-violet-400", badge: "bg-violet-500/20 text-violet-400" },
};

function getRiskLevel(coupling: number, lines: number, funcs: number): { label: string; color: string; bgColor: string; score: number; borderColor: string } {
  let score = 0;
  if (coupling >= 6) score += 3;
  else if (coupling >= 3) score += 1;
  if (lines > 500) score += 2;
  else if (lines > 200) score += 1;
  if (funcs > 15) score += 2;
  else if (funcs > 8) score += 1;

  if (score >= 4) return { label: "High Risk", color: "text-red-400", bgColor: "rgba(239,68,68,0.12)", score, borderColor: "rgba(239,68,68,0.4)" };
  if (score >= 2) return { label: "Medium", color: "text-amber-400", bgColor: "rgba(245,158,11,0.10)", score, borderColor: "rgba(245,158,11,0.35)" };
  return { label: "Low Risk", color: "text-emerald-400", bgColor: "rgba(34,197,94,0.08)", score, borderColor: "rgba(34,197,94,0.3)" };
}

// File tile component for the treemap
function FileTile({ file, isExpanded, onToggle }: {
  file: {
    path: string; language: string; lines: number; class_count: number; function_count: number;
    import_count: number; coupling: { inbound: number; outbound: number; score: number };
    classes: { name: string; base_class: string | null; methods: string[]; method_count: number }[];
    functions: { name: string; params: string; return_type: string | null }[];
    imports: string[];
  };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const displayName = file.path.split("/").pop() || file.path;
  const risk = getRiskLevel(file.coupling.score, file.lines, file.function_count);
  const langStyle = LANG_COLORS[file.language] || { bg: "rgba(161,161,170,0.08)", text: "text-zinc-400", badge: "bg-zinc-500/20 text-zinc-400" };

  // Calculate size: larger files get more visual weight
  const sizeClass = file.lines > 500 ? "col-span-2" : "";

  return (
    <div className={`${sizeClass}`}>
      <button
        onClick={onToggle}
        className="w-full text-left rounded-xl border transition-all duration-200 hover:scale-[1.01] cursor-pointer group"
        style={{
          background: risk.bgColor,
          borderColor: isExpanded ? "#6366f1" : risk.borderColor,
          boxShadow: isExpanded ? "0 0 16px rgba(99,102,241,0.2)" : undefined,
        }}
      >
        {/* Header */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${langStyle.badge}`}>
              {file.language.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-xs font-semibold text-text-primary truncate flex-1">{displayName}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${risk.color} bg-black/20`}>
              {risk.label}
            </span>
          </div>

          {/* Metrics strip */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-text-muted">Lines</span>
              <span className={`text-[10px] font-mono font-semibold ${file.lines > 300 ? 'text-amber-400' : 'text-text-secondary'}`}>
                {file.lines}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-text-muted">Funcs</span>
              <span className="text-[10px] font-mono font-semibold text-text-secondary">{file.function_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-text-muted">Classes</span>
              <span className="text-[10px] font-mono font-semibold text-text-secondary">{file.class_count}</span>
            </div>

            {/* Coupling indicator */}
            <div className="ml-auto flex items-center gap-1">
              <span className={`text-[10px] font-mono ${file.coupling.score >= 6 ? 'text-red-400' : file.coupling.score >= 3 ? 'text-amber-400' : 'text-zinc-500'}`}>
                ↓{file.coupling.inbound} ↑{file.coupling.outbound}
              </span>
            </div>
          </div>

          {/* Risk bar */}
          <div className="mt-2 h-1 rounded-full bg-zinc-800/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(risk.score * 14, 100)}%`,
                background: risk.score >= 4 ? '#ef4444' : risk.score >= 2 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-1 rounded-lg border border-border bg-surface/80 px-3 py-2 space-y-1.5 backdrop-blur-sm">
          <div className="text-[10px] text-text-muted font-mono truncate">{file.path}</div>

          {file.classes.length > 0 && (
            <div className="space-y-0.5">
              {file.classes.map(cls => (
                <div key={cls.name} className="text-[11px] text-text-secondary">
                  <span className="text-purple-400 font-mono font-semibold">class</span>{" "}
                  <span className="text-text-primary">{cls.name}</span>
                  {cls.base_class && <span className="text-text-muted"> : {cls.base_class}</span>}
                  <span className="text-text-muted"> — {cls.method_count} methods</span>
                </div>
              ))}
            </div>
          )}

          {file.functions.length > 0 && (
            <div className="space-y-0.5">
              {file.functions.slice(0, 8).map(fn => (
                <div key={fn.name} className="text-[11px] font-mono">
                  <span className="text-blue-400">{fn.name}</span>
                  <span className="text-text-muted">({fn.params})</span>
                  {fn.return_type && <span className="text-emerald-400"> → {fn.return_type}</span>}
                </div>
              ))}
              {file.functions.length > 8 && (
                <div className="text-[10px] text-text-muted">+ {file.functions.length - 8} more functions</div>
              )}
            </div>
          )}

          {file.imports.length > 0 && (
            <div className="pt-1 border-t border-border/30">
              <span className="text-[9px] text-text-muted uppercase tracking-wider">Imports: </span>
              <span className="text-[10px] text-text-muted font-mono">{file.imports.slice(0, 6).join(", ")}</span>
              {file.imports.length > 6 && <span className="text-[10px] text-text-muted"> +{file.imports.length - 6}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CodebaseMap({ data, isLoading }: CodebaseMapProps) {
  const [search, setSearch] = useState("");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"risk" | "lines" | "coupling" | "name">("risk");

  const { files, groups, stats } = useMemo(() => {
    if (!data?.files) return { files: [], groups: {} as Record<string, typeof data.files>, stats: { total: 0, high: 0, medium: 0, low: 0, avgLines: 0 } };

    let filtered = data.files;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((f: { path: string; classes: { name: string }[]; functions: { name: string }[] }) =>
        f.path.toLowerCase().includes(q) ||
        f.classes.some((c: { name: string }) => c.name.toLowerCase().includes(q)) ||
        f.functions.some((fn: { name: string }) => fn.name.toLowerCase().includes(q))
      );
    }

    // Sort
    const sorted = [...filtered].sort((a: { coupling: { score: number }; lines: number; path: string }, b: { coupling: { score: number }; lines: number; path: string }) => {
      if (sortBy === "risk") return getRiskLevel(b.coupling.score, b.lines, 0).score - getRiskLevel(a.coupling.score, a.lines, 0).score;
      if (sortBy === "lines") return b.lines - a.lines;
      if (sortBy === "coupling") return b.coupling.score - a.coupling.score;
      return a.path.localeCompare(b.path);
    });

    // Group by directory
    const groups: Record<string, typeof sorted> = {};
    for (const file of sorted) {
      const parts = (file.path as string).split("/");
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
      if (!groups[dir]) groups[dir] = [];
      groups[dir].push(file);
    }

    // Stats
    let high = 0, medium = 0, low = 0, totalLines = 0;
    for (const f of sorted) {
      const r = getRiskLevel(f.coupling.score, f.lines, f.function_count);
      if (r.score >= 4) high++;
      else if (r.score >= 2) medium++;
      else low++;
      totalLines += f.lines;
    }

    return {
      files: sorted,
      groups,
      stats: { total: sorted.length, high, medium, low, avgLines: Math.round(totalLines / Math.max(sorted.length, 1)) },
    };
  }, [data, search, sortBy]);

  const toggleFile = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
        <span className="text-sm text-text-muted">Building risk map...</span>
      </div>
    );
  }

  if (!data || !files.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-muted">Open a folder and click Analyze to view the risk map</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary strip */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border bg-surface/50">
        <div className="flex items-center gap-4 mb-2">
          <span className="text-[11px] text-text-muted">{stats.total} files</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[11px] font-semibold text-red-400">{stats.high} high risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-[11px] text-amber-400">{stats.medium} medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-emerald-400">{stats.low} low</span>
          </div>
          <span className="text-[10px] text-text-muted">avg {stats.avgLines} lines/file</span>
        </div>
        {/* Risk distribution bar */}
        <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
          {stats.high > 0 && (
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-500"
              style={{ width: `${(stats.high / Math.max(stats.total, 1)) * 100}%` }}
            />
          )}
          {stats.medium > 0 && (
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-500"
              style={{ width: `${(stats.medium / Math.max(stats.total, 1)) * 100}%` }}
            />
          )}
          {stats.low > 0 && (
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${(stats.low / Math.max(stats.total, 1)) * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Search + Sort */}
      <div className="shrink-0 px-4 py-2 border-b border-border flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter files, classes, functions..."
          className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/50"
        />
        <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
          {(["risk", "lines", "coupling", "name"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer capitalize ${
                sortBy === s ? "bg-accent/15 text-accent-bright" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Visual grid by directory */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groups).map(([dir, dirFiles]) => (
          <div key={dir}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold text-accent-bright font-mono">📁 {dir}</span>
              <span className="text-[10px] text-text-muted">{dirFiles.length} files</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dirFiles.map((file: { path: string; language: string; lines: number; class_count: number; function_count: number; import_count: number; coupling: { inbound: number; outbound: number; score: number }; classes: { name: string; base_class: string | null; methods: string[]; method_count: number }[]; functions: { name: string; params: string; return_type: string | null }[]; imports: string[] }) => (
                <FileTile
                  key={file.path}
                  file={file}
                  isExpanded={expandedFiles.has(file.path)}
                  onToggle={() => toggleFile(file.path)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
