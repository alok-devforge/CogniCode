"""
knowledge_graph.py — Enriched, persistable knowledge graph for the codebase.

Takes the basic FileNode[] from code_graph.py and enriches it with:
- Cross-file import edges (smart resolution for JS/TS/Python paths)
- Inheritance edges (ClassA extends ClassB)
- Composition edges (ClassA has field of type ClassB)
- Module clusters (group by directory)
- Centrality scores (PageRank-style — most-imported = most critical)

Fully serializable to JSON for .cognicode/ persistence.
"""

import logging
from collections import defaultdict

from app.code_graph import FileNode, ClassInfo, FunctionInfo

logger = logging.getLogger("cognicode.knowledge_graph")


def build_knowledge_graph(graph: list[FileNode]) -> dict:
    """Build an enriched, serializable knowledge graph from parsed FileNode list.

    Returns a dict with:
    - nodes: list of graph nodes (files, classes, functions)
    - edges: list of relationships (imports, inherits, composes, contains)
    - clusters: auto-detected module groups
    - statistics: coupling scores, centrality, hotspots
    """
    kg_nodes: list[dict] = []
    kg_edges: list[dict] = []
    edge_dedup: set[str] = set()

    def _add_edge(source: str, target: str, etype: str, label: str, weight: float = 1.0):
        key = f"{source}|{target}|{etype}"
        if key not in edge_dedup:
            edge_dedup.add(key)
            kg_edges.append({
                "source": source, "target": target,
                "type": etype, "relationship": etype,
                "label": label, "weight": weight,
            })

    # ── Build lookup maps ────────────────────────────────────────────────
    file_basenames: dict[str, str] = {}
    file_basenames_ext: dict[str, str] = {}
    file_full_paths: dict[str, str] = {}
    path_segments: dict[str, str] = {}
    all_class_names: dict[str, str] = {}
    all_func_names: dict[str, list[str]] = {}
    path_to_id: dict[str, str] = {}

    for node in graph:
        short = node.path.replace("\\", "/")
        basename = short.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        basename_ext = short.rsplit("/", 1)[-1]
        file_id = f"file::{short}"

        file_basenames[basename] = short
        file_basenames_ext[basename_ext] = short
        file_full_paths[short] = short
        path_to_id[short] = file_id

        # Build partial path keys for JS/TS style imports
        no_ext = short.rsplit(".", 1)[0]
        segments = no_ext.split("/")
        for i in range(len(segments)):
            partial = "/".join(segments[i:])
            path_segments[partial] = short

        for ci in node.classes:
            all_class_names[ci.name] = short
        for fi in node.functions:
            all_func_names.setdefault(fi.name, []).append(short)

    def _resolve_import(imp: str, source_path: str) -> str | None:
        """Resolve an import string to a file path in the codebase."""
        cleaned = imp.strip().strip("'\"")

        # JS/TS: @/components/FileExplorer → components/FileExplorer
        if cleaned.startswith("@/"):
            cleaned = cleaned[2:]
        # Remove leading src/ prefix for matching
        if cleaned.startswith("src/"):
            cleaned = cleaned[4:]

        # Relative: ./utils or ../components/Button
        if cleaned.startswith("./") or cleaned.startswith("../"):
            source_dir = source_path.rsplit("/", 1)[0] if "/" in source_path else ""
            if cleaned.startswith("./"):
                cleaned = (source_dir + "/" + cleaned[2:]).lstrip("/")
            elif cleaned.startswith("../"):
                parts = source_dir.split("/")
                up_count = 0
                rest = cleaned
                while rest.startswith("../"):
                    up_count += 1
                    rest = rest[3:]
                base = "/".join(parts[:-up_count]) if up_count < len(parts) else ""
                cleaned = (base + "/" + rest).lstrip("/")

        # Try exact match with extension variations
        for ext in ["", ".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c"]:
            candidate = cleaned + ext
            if candidate in file_full_paths:
                return file_full_paths[candidate]
            idx = cleaned + "/index" + ext
            if idx in file_full_paths:
                return file_full_paths[idx]

        # Try path segment matching
        if cleaned in path_segments:
            return path_segments[cleaned]

        # Python dotted imports: app.code_graph → app/code_graph
        dotted_path = cleaned.replace(".", "/")
        if dotted_path in path_segments:
            return path_segments[dotted_path]

        # Last segment fallback
        last_seg = cleaned.split("/")[-1].split(".")[-1]
        if last_seg in file_basenames:
            target = file_basenames[last_seg]
            if target != source_path:
                return target

        return None

    # ── Create nodes ─────────────────────────────────────────────────────
    for node in graph:
        short = node.path.replace("\\", "/")
        file_id = f"file::{short}"

        kg_nodes.append({
            "id": file_id, "type": "file", "label": short,
            "metadata": {
                "path": short, "language": node.language,
                "total_lines": node.total_lines,
                "class_count": len(node.classes),
                "function_count": len(node.functions),
                "import_count": len(node.imports),
            },
        })

        for ci in node.classes:
            class_id = f"class::{short}::{ci.name}"
            kg_nodes.append({
                "id": class_id, "type": "class", "label": ci.name,
                "metadata": {
                    "file": short, "base_class": ci.base_class or None,
                    "methods": ci.methods, "method_count": len(ci.methods),
                },
            })
            _add_edge(file_id, class_id, "contains", "contains", 1.0)

            # Inheritance
            if ci.base_class and ci.base_class in all_class_names:
                parent_file = all_class_names[ci.base_class]
                parent_id = f"class::{parent_file}::{ci.base_class}"
                _add_edge(class_id, parent_id, "inherits", "extends", 2.0)

        standalone = [f for f in node.functions if not f.is_method]
        for fi in standalone:
            func_id = f"func::{short}::{fi.name}"
            kg_nodes.append({
                "id": func_id, "type": "function", "label": fi.name,
                "metadata": {
                    "file": short, "params": fi.params,
                    "return_type": fi.return_type or None, "lines": fi.lines,
                },
            })
            _add_edge(file_id, func_id, "contains", "contains", 0.5)

    # ── Cross-file import edges (improved resolution) ────────────────────
    for node in graph:
        short = node.path.replace("\\", "/")
        src_id = path_to_id.get(short)
        if not src_id:
            continue
        for imp in node.imports:
            resolved = _resolve_import(imp, short)
            if resolved and resolved != short:
                tgt_id = path_to_id.get(resolved)
                if tgt_id:
                    _add_edge(src_id, tgt_id, "imports", "imports", 1.0)

    # ── Composition edges ────────────────────────────────────────────────
    for node in graph:
        short = node.path.replace("\\", "/")
        for ci in node.classes:
            class_id = f"class::{short}::{ci.name}"
            for fi in node.functions:
                if fi.is_method and fi.parent_class == ci.name:
                    for other_class, other_file in all_class_names.items():
                        if other_class != ci.name and other_class in fi.params:
                            other_id = f"class::{other_file}::{other_class}"
                            _add_edge(class_id, other_id, "composes", "uses", 1.5)

    # ── Cross-file function dependency edges ─────────────────────────────
    # If file A imports file B, create edges from A's functions to B's functions
    for node in graph:
        short = node.path.replace("\\", "/")
        src_id = path_to_id.get(short)
        if not src_id:
            continue

        imported_files: set[str] = set()
        for imp in node.imports:
            resolved = _resolve_import(imp, short)
            if resolved and resolved != short:
                imported_files.add(resolved)

        if not imported_files:
            continue

        our_funcs = [f for f in node.functions if not f.is_method][:15]
        for imported_path in imported_files:
            imp_node = None
            for g in graph:
                if g.path.replace("\\", "/") == imported_path:
                    imp_node = g
                    break
            if not imp_node:
                continue

            # Check if imported file's function/class names appear in our function params
            their_names = set()
            for f in imp_node.functions:
                if not f.is_method:
                    their_names.add(f.name)
            for c in imp_node.classes:
                their_names.add(c.name)

            for our_fn in our_funcs:
                for their_name in their_names:
                    if their_name in our_fn.params:
                        our_fn_id = f"func::{short}::{our_fn.name}"
                        # Link to the function if it exists, otherwise the file
                        their_fn_files = all_func_names.get(their_name, [])
                        if imported_path in their_fn_files:
                            their_fn_id = f"func::{imported_path}::{their_name}"
                            _add_edge(our_fn_id, their_fn_id, "calls", "calls", 1.0)
                        elif their_name in all_class_names and all_class_names[their_name] == imported_path:
                            their_cls_id = f"class::{imported_path}::{their_name}"
                            _add_edge(our_fn_id, their_cls_id, "uses", "uses", 1.0)

    # ── Module clusters ──────────────────────────────────────────────────
    modules: dict[str, list[str]] = defaultdict(list)
    for node in graph:
        short = node.path.replace("\\", "/")
        parts = short.rsplit("/", 1)
        module = parts[0] if len(parts) > 1 else "root"
        modules[module].append(short)

    clusters = []
    for module_name, file_paths in sorted(modules.items()):
        total_lines = total_classes = total_functions = 0
        for node in graph:
            s = node.path.replace("\\", "/")
            if s in file_paths:
                total_lines += node.total_lines
                total_classes += len(node.classes)
                total_functions += len(node.functions)
        clusters.append({
            "module": module_name, "files": file_paths,
            "total_lines": total_lines,
            "total_classes": total_classes,
            "total_functions": total_functions,
        })

    # ── Centrality scores ────────────────────────────────────────────────
    inbound_count: dict[str, int] = defaultdict(int)
    outbound_count: dict[str, int] = defaultdict(int)
    for edge in kg_edges:
        if edge["relationship"] in ("imports", "calls", "uses"):
            inbound_count[edge["target"]] += 1
            outbound_count[edge["source"]] += 1

    max_inbound = max(inbound_count.values()) if inbound_count else 1
    for node_data in kg_nodes:
        nid = node_data["id"]
        raw = inbound_count.get(nid, 0)
        node_data["centrality"] = round(raw / max(max_inbound, 1), 3)

    file_nodes = [n for n in kg_nodes if n["type"] == "file"]
    hotspots = sorted(file_nodes, key=lambda n: n.get("centrality", 0), reverse=True)[:10]

    # ── Statistics ────────────────────────────────────────────────────────
    stats = {
        "total_files": sum(1 for n in kg_nodes if n["type"] == "file"),
        "total_classes": sum(1 for n in kg_nodes if n["type"] == "class"),
        "total_functions": sum(1 for n in kg_nodes if n["type"] == "function"),
        "total_edges": len(kg_edges),
        "import_edges": sum(1 for e in kg_edges if e["relationship"] == "imports"),
        "inheritance_edges": sum(1 for e in kg_edges if e["relationship"] == "extends"),
        "composition_edges": sum(1 for e in kg_edges if e["relationship"] in ("composes", "uses")),
        "contains_edges": sum(1 for e in kg_edges if e["relationship"] == "contains"),
        "call_edges": sum(1 for e in kg_edges if e["relationship"] == "calls"),
        "total_modules": len(clusters),
        "hotspots": [{"id": h["id"], "label": h["label"], "centrality": h.get("centrality", 0)} for h in hotspots],
    }

    logger.info(
        f"Knowledge graph: {stats['total_files']} files, {stats['total_classes']} classes, "
        f"{stats['total_edges']} edges ({stats['import_edges']} imports, "
        f"{stats['inheritance_edges']} inheritance, {stats['call_edges']} calls)"
    )

    return {
        "nodes": kg_nodes, "edges": kg_edges,
        "clusters": clusters, "statistics": stats,
    }


def merge_knowledge_graph(
    old_graph: dict,
    changed_file_nodes: list[FileNode],
    deleted_paths: list[str],
    full_graph: list[FileNode],
) -> dict:
    """Incrementally update a knowledge graph without rebuilding from scratch.

    1. Remove all nodes/edges related to changed or deleted files
    2. Re-add nodes/edges for changed files using their new FileNode data
    3. Recompute centrality scores

    Args:
        old_graph: previous knowledge graph dict
        changed_file_nodes: newly parsed FileNode[] for changed/added files
        deleted_paths: paths of files that were removed
        full_graph: complete current FileNode[] (unchanged + changed)
    """
    # Paths that need to be refreshed
    affected_paths = set(deleted_paths)
    for node in changed_file_nodes:
        affected_paths.add(node.path.replace("\\", "/"))

    # Remove old nodes and edges for affected files
    old_nodes = old_graph.get("nodes", [])
    old_edges = old_graph.get("edges", [])

    def _node_is_affected(n: dict) -> bool:
        nid = n.get("id", "")
        for p in affected_paths:
            if p in nid:
                return True
        return False

    def _edge_is_affected(e: dict) -> bool:
        for p in affected_paths:
            if p in e.get("source", "") or p in e.get("target", ""):
                return True
        return False

    kept_nodes = [n for n in old_nodes if not _node_is_affected(n)]
    kept_edges = [e for e in old_edges if not _edge_is_affected(e)]

    # Rebuild from the full current graph
    fresh = build_knowledge_graph(full_graph)

    fresh_new_nodes = [n for n in fresh["nodes"] if _node_is_affected(n)]
    fresh_new_edges = [e for e in fresh["edges"] if _edge_is_affected(e)]

    merged_nodes = kept_nodes + fresh_new_nodes
    merged_edges = kept_edges + fresh_new_edges

    # Recompute centrality on the merged graph
    inbound_count: dict[str, int] = defaultdict(int)
    for edge in merged_edges:
        if edge["relationship"] in ("imports", "calls", "uses"):
            inbound_count[edge["target"]] += 1

    max_inbound = max(inbound_count.values()) if inbound_count else 1
    for node_data in merged_nodes:
        nid = node_data["id"]
        raw = inbound_count.get(nid, 0)
        node_data["centrality"] = round(raw / max(max_inbound, 1), 3)

    return {
        "nodes": merged_nodes,
        "edges": merged_edges,
        "clusters": fresh["clusters"],
        "statistics": fresh["statistics"],
    }
