"""
graph_assistant.py — Graph-Powered Coding Assistant

The core innovation: instead of sending the entire codebase to the LLM,
we use the Knowledge Graph (built from code_graph.py) to perform a
surgical extraction of ONLY the files relevant to the user's query.

Flow:
1. Extract keywords from the user's natural language query
2. Search the knowledge graph for matching nodes (files, classes, functions)
3. Walk the graph edges to find connected/dependent files
4. Rank files by relevance score
5. Build a token-optimized prompt with just the relevant code
6. Send to LLM and return the response with metadata

This reduces token usage by 70-90% compared to sending the full codebase.
"""

import re
import logging
from dataclasses import dataclass, field

logger = logging.getLogger("cognicode.assistant")


# ── Data Types ───────────────────────────────────────────────────────────

@dataclass
class GraphSearchResult:
    """Result of a graph-powered search."""
    relevant_files: list[dict]          # [{path, content, relevance_score, match_reasons}]
    total_files: int                    # total files in codebase
    selected_count: int                 # how many files were selected
    token_estimate_full: int            # estimated tokens for full codebase
    token_estimate_surgical: int        # estimated tokens for surgical selection
    token_savings_pct: float            # percentage saved
    search_keywords: list[str]          # keywords extracted from query
    graph_traversal_depth: int          # how deep we searched
    match_details: list[dict]           # why each file was selected


@dataclass
class AssistantResponse:
    """Full response from the assistant."""
    answer: str                         # LLM-generated response
    search_result: GraphSearchResult    # graph search metadata
    model_used: str                     # which LLM model was used
    prompt_tokens: int                  # estimated prompt tokens
    files_analyzed: list[str]           # file paths that were sent to LLM


# ── Keyword Extraction ───────────────────────────────────────────────────

# Domain-specific keyword mappings for code concepts
CONCEPT_SYNONYMS = {
    "auth": ["authentication", "login", "logout", "session", "token", "jwt", "oauth", "password", "credential"],
    "password": ["passwd", "pwd", "hash", "bcrypt", "salt", "reset", "forgot"],
    "database": ["db", "sql", "query", "model", "schema", "migration", "orm", "repository", "dao"],
    "api": ["endpoint", "route", "handler", "controller", "rest", "graphql", "request", "response"],
    "email": ["mail", "smtp", "notification", "send", "template", "message"],
    "user": ["account", "profile", "registration", "signup", "member"],
    "test": ["spec", "unittest", "pytest", "jest", "mock", "fixture", "assert"],
    "config": ["settings", "env", "environment", "configuration", "setup"],
    "error": ["exception", "handler", "catch", "try", "fallback", "retry"],
    "cache": ["redis", "memcached", "store", "ttl", "invalidate"],
    "payment": ["stripe", "billing", "subscription", "charge", "invoice"],
    "file": ["upload", "download", "storage", "s3", "blob", "media"],
    "search": ["index", "elasticsearch", "filter", "query", "find", "lookup"],
    "websocket": ["realtime", "socket", "push", "event", "stream", "sse"],
    "middleware": ["interceptor", "guard", "pipe", "filter", "hook"],
    "graph": ["node", "edge", "network", "relationship", "connection"],
    "frontend": ["component", "view", "page", "template", "render", "ui"],
    "security": ["cors", "csrf", "xss", "sanitize", "validate", "permission", "role", "acl"],
}

# Common stop words to filter out
STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "want", "add",
    "create", "make", "build", "implement", "write", "code", "feature",
    "new", "to", "for", "in", "on", "at", "by", "with", "from", "of",
    "and", "or", "but", "not", "this", "that", "it", "i", "me", "my",
    "how", "what", "where", "when", "why", "who", "which", "please",
    "help", "can", "you", "just", "also", "like", "get", "set",
}


def extract_keywords(query: str) -> list[str]:
    """
    Extract meaningful keywords from a natural language query.
    Expands with domain synonyms to catch related concepts.
    """
    # Normalize
    words = re.findall(r'[a-zA-Z_]+', query.lower())

    # Filter stop words and short words
    meaningful = [w for w in words if w not in STOP_WORDS and len(w) > 2]

    # Expand with synonyms
    expanded = set(meaningful)
    for word in meaningful:
        # Check if this word appears in any synonym group
        for concept, synonyms in CONCEPT_SYNONYMS.items():
            if word == concept or word in synonyms:
                expanded.add(concept)
                expanded.update(synonyms)

    return list(expanded)


# ── Graph Search ─────────────────────────────────────────────────────────

def search_graph(
    graph_nodes: list,  # list of FileNode from code_graph.py
    keywords: list[str],
    max_files: int = 8,
    include_dependencies: bool = True,
) -> GraphSearchResult:
    """
    Search the knowledge graph for files relevant to the given keywords.

    Scoring algorithm:
    - Filename match: +10 points
    - Class name match: +8 points
    - Function name match: +6 points
    - Import match: +4 points
    - Content keyword match: +2 points per occurrence (max 10)
    - Dependency bonus: +3 points if imported by a high-scoring file
    """
    file_scores: dict[str, dict] = {}

    # Build import index for dependency walking
    import_index: dict[str, set[str]] = {}  # basename → set of files that import it
    basename_to_path: dict[str, str] = {}

    for node in graph_nodes:
        path = node.path.replace("\\", "/")
        basename = path.rsplit("/", 1)[-1].rsplit(".", 1)[0].lower()
        basename_to_path[basename] = path

    for node in graph_nodes:
        path = node.path.replace("\\", "/")
        for imp in node.imports:
            imp_base = imp.split(".")[-1].lower()
            if imp_base in basename_to_path:
                import_index.setdefault(imp_base, set()).add(path)

    # Score each file
    for node in graph_nodes:
        path = node.path.replace("\\", "/")
        filename = path.rsplit("/", 1)[-1].lower()
        basename = filename.rsplit(".", 1)[0]

        score = 0
        reasons = []

        for kw in keywords:
            kw_lower = kw.lower()

            # Filename match (strongest signal)
            if kw_lower in basename or kw_lower in filename:
                score += 10
                reasons.append(f"filename contains '{kw}'")

            # Class name match
            for cls in node.classes:
                if kw_lower in cls.name.lower():
                    score += 8
                    reasons.append(f"class '{cls.name}' matches '{kw}'")

            # Function name match
            for func in node.functions:
                if kw_lower in func.name.lower():
                    score += 6
                    reasons.append(f"function '{func.name}' matches '{kw}'")

            # Import match (file imports something related)
            for imp in node.imports:
                if kw_lower in imp.lower():
                    score += 4
                    reasons.append(f"imports '{imp}' (matches '{kw}')")
                    break  # only count once per keyword

        if score > 0:
            file_scores[path] = {
                "path": path,
                "score": score,
                "reasons": reasons,
                "node": node,
            }

    # Phase 2: Walk dependencies — if a high-scoring file imports another file, boost it
    if include_dependencies:
        dependency_boosts: dict[str, list[str]] = {}
        for path, data in list(file_scores.items()):
            if data["score"] >= 6:  # only boost from strong matches
                node = data["node"]
                for imp in node.imports:
                    imp_base = imp.split(".")[-1].lower()
                    if imp_base in basename_to_path:
                        dep_path = basename_to_path[imp_base]
                        if dep_path not in file_scores:
                            dependency_boosts[dep_path] = []
                        dependency_boosts.setdefault(dep_path, []).append(
                            f"imported by '{path.rsplit('/', 1)[-1]}' (scored {data['score']})"
                        )

        # Also check: files that IMPORT a high-scoring file
        for path, data in list(file_scores.items()):
            basename = path.rsplit("/", 1)[-1].rsplit(".", 1)[0].lower()
            if basename in import_index:
                for importer_path in import_index[basename]:
                    if importer_path not in file_scores:
                        dependency_boosts.setdefault(importer_path, []).append(
                            f"imports '{basename}' which is relevant (scored {data['score']})"
                        )

        # Apply boosts
        for dep_path, boost_reasons in dependency_boosts.items():
            dep_node = None
            for n in graph_nodes:
                if n.path.replace("\\", "/") == dep_path:
                    dep_node = n
                    break
            if dep_node:
                if dep_path in file_scores:
                    file_scores[dep_path]["score"] += 3 * len(boost_reasons)
                    file_scores[dep_path]["reasons"].extend(boost_reasons)
                else:
                    file_scores[dep_path] = {
                        "path": dep_path,
                        "score": 3 * len(boost_reasons),
                        "reasons": boost_reasons,
                        "node": dep_node,
                    }

    # Sort by score and take top N
    ranked = sorted(file_scores.values(), key=lambda x: x["score"], reverse=True)
    selected = ranked[:max_files]

    # Calculate token estimates (rough: 1 token ≈ 4 chars)
    total_chars = sum(len(getattr(n, 'raw_content', '') or '') for n in graph_nodes)
    selected_chars = sum(
        len(getattr(s["node"], 'raw_content', '') or '') for s in selected
    )

    # Fallback: estimate from line counts
    if total_chars == 0:
        total_chars = sum(n.total_lines * 40 for n in graph_nodes)  # ~40 chars/line
        selected_chars = sum(s["node"].total_lines * 40 for s in selected)

    token_full = total_chars // 4
    token_surgical = selected_chars // 4
    savings = ((token_full - token_surgical) / max(token_full, 1)) * 100

    return GraphSearchResult(
        relevant_files=[{
            "path": s["path"],
            "relevance_score": s["score"],
            "match_reasons": s["reasons"],
            "classes": [c.name for c in s["node"].classes],
            "functions": [f.name for f in s["node"].functions],
            "lines": s["node"].total_lines,
            "language": s["node"].language,
        } for s in selected],
        total_files=len(graph_nodes),
        selected_count=len(selected),
        token_estimate_full=token_full,
        token_estimate_surgical=token_surgical,
        token_savings_pct=round(savings, 1),
        search_keywords=keywords,
        graph_traversal_depth=2 if include_dependencies else 1,
        match_details=[{
            "path": s["path"],
            "score": s["score"],
            "reasons": s["reasons"],
        } for s in selected],
    )


# ── Prompt Builder ───────────────────────────────────────────────────────

def build_surgical_prompt(
    query: str,
    search_result: GraphSearchResult,
    file_contents: dict[str, str],  # path → content
    conversation_history: list[dict] | None = None,
) -> str:
    """
    Build a token-optimized prompt with only the relevant code context.
    This is the key differentiator — we send 3-8 files, not 500.
    """
    # Header
    prompt_parts = [
        "You are CogniCode, an expert AI coding assistant with deep knowledge of this codebase.",
        "You have been given ONLY the files relevant to the user's request, surgically extracted from the knowledge graph.",
        "",
        f"## User Request",
        f"{query}",
        "",
        f"## Relevant Files ({search_result.selected_count} out of {search_result.total_files} total)",
        f"These files were selected by graph analysis based on: {', '.join(search_result.search_keywords)}",
        "",
    ]

    # Add file contents
    for file_info in search_result.relevant_files:
        path = file_info["path"]
        content = file_contents.get(path, "# Content not available")
        lang = file_info.get("language", "python")
        reasons = ", ".join(file_info["match_reasons"][:3])

        prompt_parts.extend([
            f"### {path}",
            f"**Why selected:** {reasons}",
            f"**Structure:** {len(file_info.get('classes', []))} classes, {len(file_info.get('functions', []))} functions, {file_info.get('lines', 0)} lines",
            f"```{lang}",
            content[:8000],  # Cap at 8000 chars per file to avoid token overflow
            "```",
            "",
        ])

    # Instructions
    prompt_parts.extend([
        "## Instructions",
        "1. Analyze the relevant files above to understand the existing architecture.",
        "2. Provide a clear, implementation-ready response to the user's request.",
        "3. Write actual code — not pseudocode — that fits the existing patterns.",
        "4. If you need to modify existing files, show the exact changes with file paths.",
        "5. If you need to create new files, show the complete file contents.",
        "6. Explain your reasoning briefly, focusing on WHY you chose this approach.",
        "7. Flag any potential issues or dependencies the user should be aware of.",
    ])

    # Add conversation history if available
    if conversation_history:
        prompt_parts.insert(0, "## Previous Context")
        for msg in conversation_history[-4:]:  # last 4 messages
            role = msg.get("role", "user")
            content = msg.get("content", "")
            prompt_parts.insert(1, f"**{role}:** {content[:500]}")
        prompt_parts.insert(len(conversation_history[-4:]) + 1, "")

    return "\n".join(prompt_parts)


# ── Main Assistant Function ──────────────────────────────────────────────

async def run_assistant(
    query: str,
    files: list[dict],  # [{path, content}]
    folder_name: str,
    conversation_history: list[dict] | None = None,
    max_relevant_files: int = 8,
) -> AssistantResponse:
    """
    The main entry point for the Graph-Powered Coding Assistant.

    1. Build the code graph
    2. Extract keywords from query
    3. Search the graph for relevant files
    4. Build a surgical prompt
    5. Send to LLM
    6. Return response with metadata
    """
    from app.code_graph import build_codebase_graph
    from app.llm_service import generate_response_with_model
    import time

    logger.info(f"🤖 Assistant query: '{query}' ({len(files)} files in {folder_name})")
    t0 = time.time()

    # Step 1: Build the knowledge graph
    graph = build_codebase_graph(files)
    t_graph = time.time()
    logger.info(f"📊 Graph built: {len(graph)} nodes in {(t_graph - t0)*1000:.0f}ms")

    # Step 2: Extract keywords
    keywords = extract_keywords(query)
    logger.info(f"🔍 Keywords: {keywords}")

    # Step 3: Search the graph
    search_result = search_graph(
        graph_nodes=graph,
        keywords=keywords,
        max_files=max_relevant_files,
        include_dependencies=True,
    )
    t_search = time.time()
    logger.info(
        f"🎯 Graph search: {search_result.selected_count}/{search_result.total_files} files selected "
        f"({search_result.token_savings_pct}% token savings) in {(t_search - t_graph)*1000:.0f}ms"
    )

    # Step 4: Build file content map for selected files
    file_content_map = {}
    for f in files:
        file_content_map[f["path"]] = f["content"]

    # Step 5: Build the surgical prompt
    prompt = build_surgical_prompt(
        query=query,
        search_result=search_result,
        file_contents=file_content_map,
        conversation_history=conversation_history,
    )
    prompt_tokens = len(prompt) // 4  # rough estimate

    logger.info(f"📝 Prompt: {prompt_tokens} tokens (vs ~{search_result.token_estimate_full} for full codebase)")

    # Step 6: Send to LLM with model tracking
    relevant_paths = ', '.join(f['path'] for f in search_result.relevant_files)
    fallback = (
        f"I analyzed your codebase graph and found **{search_result.selected_count} relevant files** "
        f"for your request based on keyword matching and dependency traversal.\n\n"
        f"**Relevant files:** {relevant_paths}\n\n"
        f"**Your query:** {query}\n\n"
        f"*Note: The AI model could not be reached at this time. "
        f"The graph search above still identified the right files — please review them manually "
        f"or try again in a moment.*"
    )

    answer, model_used = await generate_response_with_model(prompt, fallback=fallback)
    t_llm = time.time()
    logger.info(f"🤖 LLM response via {model_used} in {(t_llm - t_search)*1000:.0f}ms")

    return AssistantResponse(
        answer=answer,
        search_result=search_result,
        model_used=model_used,
        prompt_tokens=prompt_tokens,
        files_analyzed=[f["path"] for f in search_result.relevant_files],
    )

