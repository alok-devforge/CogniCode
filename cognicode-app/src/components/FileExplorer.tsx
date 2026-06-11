"use client";

import { useState, useCallback } from "react";

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  handle?: FileSystemFileHandle;
}

interface FileExplorerProps {
  onFileSelect: (path: string, content: string) => void;
  onFolderOpen?: (folderName: string, files: { path: string; content: string }[], dirHandle: FileSystemDirectoryHandle) => void;
}

const LANGUAGE_ICONS: Record<string, string> = {
  ts: "TS",
  tsx: "TX",
  js: "JS",
  jsx: "JX",
  py: "PY",
  json: "{}",
  css: "CS",
  html: "HT",
  md: "MD",
  yaml: "YA",
  yml: "YA",
  toml: "TM",
  sql: "SQ",
  sh: "SH",
  bash: "SH",
  go: "GO",
  rs: "RS",
  java: "JA",
  cpp: "C+",
  c: "C",
  rb: "RB",
  php: "PH",
  swift: "SW",
  kt: "KT",
  dart: "DT",
  vue: "VU",
  svelte: "SV",
  lock: "LK",
  env: "EN",
  gitignore: "GI",
  dockerfile: "DK",
  xml: "XM",
  svg: "SG",
  txt: "TX",
};

const ICON_COLORS: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f7df1e",
  jsx: "#f7df1e",
  py: "#3572a5",
  json: "#a1a1aa",
  css: "#563d7c",
  html: "#e34c26",
  md: "#083fa1",
  go: "#00add8",
  rs: "#dea584",
  java: "#b07219",
  rb: "#cc342d",
  php: "#4F5D95",
  swift: "#ffac45",
  vue: "#41b883",
  svelte: "#ff3e00",
};

function getFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return name.toLowerCase();
  return name.slice(dotIndex + 1).toLowerCase();
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

async function buildFileTree(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string = ""
): Promise<FileNode[]> {
  const entries: FileNode[] = [];
  const skipDirs = new Set([
    "node_modules",
    ".git",
    ".next",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".cache",
    ".turbo",
    "coverage",
    ".cognicode",
  ]);

  for await (const entry of dirHandle.values()) {
    const entryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      if (skipDirs.has(entry.name)) continue;
      const subHandle = await dirHandle.getDirectoryHandle(entry.name);
      const children = await buildFileTree(subHandle, entryPath);
      entries.push({
        name: entry.name,
        path: entryPath,
        isDirectory: true,
        children,
      });
    } else {
      const fileHandle = await dirHandle.getFileHandle(entry.name);
      entries.push({
        name: entry.name,
        path: entryPath,
        isDirectory: false,
        handle: fileHandle,
      });
    }
  }

  return sortNodes(entries);
}

const SUPPORTED_RAG_EXTENSIONS = new Set([
  "md", "txt", "rst", "py", "js", "ts", "jsx", "tsx",
  "java", "cpp", "c", "h", "hpp", "go", "rs", "rb", "php",
  "swift", "kt", "yaml", "yml", "toml", "json", "xml",
  "sql", "sh", "bash", "css", "html", "vue", "svelte",
]);

async function collectFileContents(
  nodes: FileNode[]
): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];

  for (const node of nodes) {
    if (node.isDirectory && node.children) {
      const childFiles = await collectFileContents(node.children);
      files.push(...childFiles);
    } else if (!node.isDirectory && node.handle) {
      const ext = getFileExtension(node.name);
      if (!SUPPORTED_RAG_EXTENSIONS.has(ext)) continue;
      try {
        const file = await node.handle.getFile();
        // Skip files larger than 200KB to avoid huge payloads
        if (file.size > 200_000) continue;
        const content = await file.text();
        if (content.trim()) {
          files.push({ path: node.path, content });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return files;
}

function TreeItem({
  node,
  depth,
  expandedPaths,
  selectedPath,
  onToggle,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string;
  onToggle: (path: string) => void;
  onSelect: (node: FileNode) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const ext = getFileExtension(node.name);
  const iconLabel = LANGUAGE_ICONS[ext] || "··";
  const iconColor = ICON_COLORS[ext] || "#71717a";

  return (
    <>
      <button
        onClick={() => {
          if (node.isDirectory) {
            onToggle(node.path);
          } else {
            onSelect(node);
          }
        }}
        className={`group flex w-full items-center gap-1 py-[3px] pr-3 text-left transition-colors duration-100 cursor-pointer ${
          isSelected
            ? "bg-accent/15 text-text-primary"
            : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {node.isDirectory ? (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 transition-transform duration-150 ${
                isExpanded ? "rotate-90" : ""
              }`}
              style={{ color: "#71717a" }}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isExpanded ? "#6366f1" : "#52525b"}
              stroke="none"
              className="shrink-0"
            >
              {isExpanded ? (
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              ) : (
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              )}
            </svg>
          </>
        ) : (
          <>
            <span className="w-4 shrink-0"></span>
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold leading-none"
              style={{
                backgroundColor: `${iconColor}20`,
                color: iconColor,
              }}
            >
              {iconLabel}
            </span>
          </>
        )}
        <span className="truncate text-[13px] ml-1">{node.name}</span>
      </button>
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function FileExplorer({ onFileSelect, onFolderOpen }: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [rootName, setRootName] = useState<string>("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenFolder = useCallback(async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      setIsLoading(true);
      setRootName(dirHandle.name);
      const tree = await buildFileTree(dirHandle);
      setFileTree(tree);
      setExpandedPaths(new Set());
      setSelectedPath("");
      setIsLoading(false);
      if (onFolderOpen) {
        // Collect all file contents for RAG ingestion
        const files = await collectFileContents(tree);
        onFolderOpen(dirHandle.name, files, dirHandle);
      }
    } catch {
      setIsLoading(false);
    }
  }, [onFolderOpen]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    async (node: FileNode) => {
      if (node.isDirectory || !node.handle) return;
      setSelectedPath(node.path);
      try {
        const file = await node.handle.getFile();
        const text = await file.text();
        onFileSelect(node.name, text);
      } catch {
        onFileSelect(node.name, "");
      }
    },
    [onFileSelect]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-border bg-surface">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Explorer
        </span>
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary cursor-pointer"
          title="Open Folder"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            <line x1="12" y1="10" x2="12" y2="16" />
            <line x1="9" y1="13" x2="15" y2="13" />
          </svg>
          Open
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
            <span className="ml-2 text-xs text-text-muted">Scanning...</span>
          </div>
        )}

        {!isLoading && fileTree.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-muted/50"
            >
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </svg>
            <p className="text-xs text-text-muted">No folder opened</p>
            <button
              onClick={handleOpenFolder}
              className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent-bright transition-colors hover:bg-accent/25 cursor-pointer"
            >
              Open a Folder
            </button>
          </div>
        )}

        {!isLoading && fileTree.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#6366f1"
                stroke="none"
              >
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">
                {rootName}
              </span>
            </div>
            {fileTree.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                onToggle={handleToggle}
                onSelect={handleSelect}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
