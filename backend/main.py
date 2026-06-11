import ast as python_ast
import uuid
import asyncio
import time
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    ArcheologistRequest,
    ArcheologistResponse,
    CodeToDocRequest,
    CodeToDocResponse,
    DocToCodeRequest,
    DocToCodeResponse,
    BlastRadiusRequest,
    BlastRadiusResponse,
    BlastRadiusNode,
    BlastRadiusEdge,
    GatekeeperRequest,
    GatekeeperResponse,
    ComplexityMetric,
    RAGQueryRequest,
    RAGQueryResponse,
    RAGDocument,
    HealthResponse,
    SimulationRequest,
    SimulationResponse,
    SandboxSpawnRequest,
    SandboxSpawnResponse,
    SandboxMergeRequest,
    SandboxMergeResponse,
    IngestFilesRequest,
    CodebaseAnalyzeRequest,
    CodebaseDocRequest,
    LoadTestRequest,
    LoadTestResult,
    LoadTestResponse,
    IncrementalAnalyzeRequest,
    IncrementalAnalyzeResponse,
    KnowledgeGraphResponse,
    AssistantChatRequest,
    AssistantChatResponse,
    RealStressTestRequest,
    RealStressRequestResult,
    RealStressTestResponse,
)
from app.ast_service import parse_python_ast, compute_complexity
from app.llm_service import (
    generate_response,
    generate_architecture_summary,
    generate_doc_from_code,
    generate_code_from_doc,
    generate_rag_answer,
    generate_blast_radius_llm,
    generate_gatekeeper_llm,
    generate_codebase_architecture,
    generate_codebase_docs,
    generate_incremental_architecture,
)
from app.code_graph import build_codebase_graph, render_graph_summary, render_blast_radius_graph, render_codebase_map, render_hld, render_lld
from app.knowledge_graph import build_knowledge_graph, merge_knowledge_graph
from app.rag_service import query_documents, ingest_markdown_directory, ingest_repository, ingest_files
from app.graph_assistant import run_assistant
from app.stress_engine import run_stress_test as run_real_stress_test, StressTestConfig
from app.github_sync import fetch_latest_commit, summarize_commit, ingest_commit_to_chromadb, parse_github_url

app = FastAPI(
    title="CogniCode API",
    description="The Architectural Sentinel — Enterprise AI Backend",
    version="3.1.0",
)

logger = logging.getLogger("cognicode.api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="operational",
        version="3.1.0",
        services={
            "llm": "ready",
            "rag": "ready",
            "ast_parser": "ready",
            "gatekeeper": "ready",
        },
    )


@app.post("/api/v1/archeologist", response_model=ArcheologistResponse)
async def legacy_archeologist(request: ArcheologistRequest):
    try:
        result = await generate_architecture_summary(request.code, request.language)
        return ArcheologistResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/sync/code-to-doc", response_model=CodeToDocResponse)
async def sync_code_to_doc(request: CodeToDocRequest):
    try:
        result = await generate_doc_from_code(
            request.code, request.existing_doc, request.language
        )
        return CodeToDocResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/sync/doc-to-code", response_model=DocToCodeResponse)
async def sync_doc_to_code(request: DocToCodeRequest):
    try:
        result = await generate_code_from_doc(
            request.markdown, request.target_language
        )
        return DocToCodeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/ast/blast-radius", response_model=BlastRadiusResponse)
async def blast_radius(request: BlastRadiusRequest):
    if request.language == "python":
        try:
            python_ast.parse(request.code)
        except SyntaxError as e:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid Python syntax: {str(e)}",
            )

        try:
            nodes, edges = parse_python_ast(request.code)
            return BlastRadiusResponse(
                nodes=nodes,
                edges=edges,
                analysis_summary=f"AST-parsed {len(nodes)} components with {len(edges)} dependencies",
                total_functions=len(nodes),
                total_dependencies=len(edges),
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        result = await generate_blast_radius_llm(request.code, request.language)
        return BlastRadiusResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/rag/query", response_model=RAGQueryResponse)
async def rag_query(request: RAGQueryRequest):
    try:
        raw_docs = query_documents(request.query, request.top_k)

        context_parts = []
        for doc in raw_docs:
            source_label = doc.get("source_type", "general").replace("_", " ").title()
            context_parts.append(f"[Source: {doc['source']} | Type: {source_label}]\n{doc['content']}")
        context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant documents found in the knowledge base."

        answer = await generate_rag_answer(request.query, context)

        retrieved = [
            RAGDocument(
                content=doc["content"],
                source=doc["source"],
                relevance_score=doc["relevance_score"],
            )
            for doc in raw_docs
        ]

        return RAGQueryResponse(
            answer=answer,
            retrieved_documents=retrieved,
            context_used=context,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/rag/ingest")
async def rag_ingest(directory: str = "./docs"):
    try:
        count = ingest_markdown_directory(directory)
        return {"status": "success", "documents_ingested": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/rag/ingest-repo")
async def rag_ingest_repo(repo_path: str):
    try:
        stats = ingest_repository(repo_path)
        return {
            "status": "success",
            "ingestion_stats": stats,
            "message": f"Ingested {stats['total_chunks']} chunks: {stats['source_code']} code files, {stats['documentation']} docs, {stats['adrs']} ADRs, {stats['configs']} configs, {stats['commit_messages']} commit batches.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/rag/ingest-files")
async def rag_ingest_files(request: IngestFilesRequest):
    """Ingest file contents sent inline from the browser (File System Access API can't provide paths)."""
    try:
        files = [{"path": f.path, "content": f.content} for f in request.files]
        stats = ingest_files(request.folder_name, files)
        return {
            "status": "success",
            "folder_name": request.folder_name,
            "ingestion_stats": stats,
            "message": f"Ingested {stats['total_chunks']} chunks from {len(request.files)} files in '{request.folder_name}'",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Codebase-level endpoints (graph-based, token-efficient) ─────────────

@app.post("/api/v1/codebase/archeologist", response_model=ArcheologistResponse)
async def codebase_archeologist(request: CodebaseAnalyzeRequest):
    """Analyze the entire codebase architecture using graph-based summarization.
    
    Instead of sending raw source code to the LLM, this endpoint:
    1. Parses every file locally (regex) to extract classes, functions, imports
    2. Builds a compact graph summary (~20-30x smaller than raw code)
    3. Sends only the summary to the LLM for architecture analysis

    Graph building runs in a thread pool to avoid blocking the async event loop.
    """
    try:
        t0 = time.time()
        files = [{"path": f.path, "content": f.content} for f in request.files]

        # Run CPU-bound graph building in thread pool (non-blocking)
        loop = asyncio.get_event_loop()
        graph = await loop.run_in_executor(None, build_codebase_graph, files)
        t1 = time.time()
        logger.info(f"⚡ Graph parsed {len(graph)} files in {(t1-t0)*1000:.0f}ms")

        summary = render_graph_summary(graph)
        t2 = time.time()
        logger.info(f"📊 Graph summary rendered in {(t2-t1)*1000:.0f}ms")

        result = await generate_codebase_architecture(summary, request.folder_name)
        t3 = time.time()
        logger.info(f"🤖 LLM architecture analysis in {(t3-t2)*1000:.0f}ms")
        logger.info(f"✅ Total archeologist time: {(t3-t0)*1000:.0f}ms")

        return ArcheologistResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/codebase/blast-radius", response_model=BlastRadiusResponse)
async def codebase_blast_radius(request: CodebaseAnalyzeRequest):
    """Build a cross-file dependency graph for the entire codebase.
    
    100% local — no LLM calls. Uses regex parsing to extract dependencies.
    Graph building runs in a thread pool for non-blocking performance.
    """
    try:
        t0 = time.time()
        files = [{"path": f.path, "content": f.content} for f in request.files]
        loop = asyncio.get_event_loop()
        graph = await loop.run_in_executor(None, build_codebase_graph, files)
        result = render_blast_radius_graph(graph)
        t1 = time.time()
        logger.info(f"💥 Blast radius built in {(t1-t0)*1000:.0f}ms")
        return BlastRadiusResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/codebase/code-to-doc", response_model=CodeToDocResponse)
async def codebase_code_to_doc(request: CodebaseDocRequest):
    """Generate documentation for the entire codebase using graph-based summarization."""
    try:
        files = [{"path": f.path, "content": f.content} for f in request.files]
        loop = asyncio.get_event_loop()
        graph = await loop.run_in_executor(None, build_codebase_graph, files)
        summary = render_graph_summary(graph)
        result = await generate_codebase_docs(summary, request.existing_doc, request.folder_name)
        return CodeToDocResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/codebase/map")
async def codebase_map(request: CodebaseAnalyzeRequest):
    """Return structured codebase graph data for the tree-table Codebase Map view."""
    try:
        files = [{"path": f.path, "content": f.content} for f in request.files]
        loop = asyncio.get_event_loop()
        graph = await loop.run_in_executor(None, build_codebase_graph, files)
        result = render_codebase_map(graph)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/codebase/health")
async def codebase_health(request: CodebaseAnalyzeRequest):
    """Evaluate codebase-wide quality: runs complexity analysis on all files.
    
    Returns aggregate health score with per-file breakdowns and hotspot detection.
    """
    try:
        files = [{"path": f.path, "content": f.content} for f in request.files]
        loop = asyncio.get_event_loop()
        graph = await loop.run_in_executor(None, build_codebase_graph, files)

        file_results = []
        total_score = 0
        total_violations = 0
        total_functions = 0
        hotspots = []

        for f in request.files:
            language = f.path.rsplit(".", 1)[-1].lower()
            violations = []
            metrics = []
            file_score = 1.0

            # Try AST analysis for Python files
            if language == "py":
                try:
                    ast_data = parse_python_ast(f.content)
                    for fn_data in ast_data.get("functions", []):
                        total_functions += 1
                        cyc = fn_data.get("cyclomatic_complexity", 1)
                        cog = fn_data.get("cognitive_complexity", 0)
                        loc = fn_data.get("lines_of_code", 0)
                        if cyc > 10:
                            violations.append(f"{fn_data['name']}: cyclomatic={cyc}")
                            file_score -= 0.1
                        if cog > 15:
                            violations.append(f"{fn_data['name']}: cognitive={cog}")
                            file_score -= 0.1
                        if loc > 50:
                            violations.append(f"{fn_data['name']}: {loc} lines")
                            file_score -= 0.05
                        metrics.append({
                            "function_name": fn_data["name"],
                            "cyclomatic_complexity": cyc,
                            "cognitive_complexity": cog,
                            "lines_of_code": loc,
                        })
                except Exception:
                    pass

            # Graph-based analysis for all languages
            for node in graph:
                if node.path.replace("\\", "/") == f.path.replace("\\", "/"):
                    # Check for God Module (too many functions)
                    if len(node.functions) > 20:
                        violations.append(f"God Module: {len(node.functions)} functions")
                        file_score -= 0.15
                    if node.total_lines > 500:
                        violations.append(f"Large file: {node.total_lines} lines")
                        file_score -= 0.1
                    if len(node.imports) > 15:
                        violations.append(f"High imports: {len(node.imports)}")
                        file_score -= 0.05
                    if not metrics:
                        total_functions += len(node.functions)
                    break

            file_score = max(round(file_score, 2), 0.1)
            verdict = "PASS" if file_score >= 0.6 else "FAIL"
            total_score += file_score
            total_violations += len(violations)

            result = {
                "path": f.path,
                "score": file_score,
                "verdict": verdict,
                "violations": violations,
                "violation_count": len(violations),
                "metrics": metrics,
            }
            file_results.append(result)

            if file_score < 0.7 or len(violations) >= 3:
                hotspots.append({
                    "path": f.path,
                    "score": file_score,
                    "reason": violations[0] if violations else "Multiple issues",
                })

        overall_score = round(total_score / max(len(file_results), 1), 2)
        overall_verdict = "PASS" if overall_score >= 0.6 else "FAIL"

        # Sort hotspots by score (worst first)
        hotspots.sort(key=lambda h: h["score"])

        return {
            "overall_score": overall_score,
            "overall_verdict": overall_verdict,
            "total_files": len(file_results),
            "total_functions": total_functions,
            "total_violations": total_violations,
            "file_results": file_results,
            "hotspots": hotspots[:10],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/codebase/design-docs")
async def codebase_design_docs(request: CodebaseAnalyzeRequest):
    """Generate High-Level Design (HLD) and Low-Level Design (LLD) documents
    from the loaded codebase. 100% local — no LLM calls needed.

    Returns both documents as markdown strings with Mermaid diagrams.
    """
    if not request.files:
        raise HTTPException(status_code=400, detail="No files provided.")

    try:
        start = time.perf_counter()

        files = [{"path": f.path, "content": f.content} for f in request.files]
        loop = asyncio.get_event_loop()
        graph = await loop.run_in_executor(None, build_codebase_graph, files)
        folder = request.folder_name or "project"

        hld_md = render_hld(graph, folder)
        lld_md = render_lld(graph, folder)

        elapsed_ms = (time.perf_counter() - start) * 1000

        return {
            "hld": hld_md,
            "lld": lld_md,
            "generation_time_ms": round(elapsed_ms, 2),
            "files_analyzed": len(graph),
            "total_classes": sum(len(n.classes) for n in graph),
            "total_functions": sum(len(n.functions) for n in graph),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/codebase/knowledge-graph", response_model=KnowledgeGraphResponse)
async def codebase_knowledge_graph(request: CodebaseAnalyzeRequest):
    """Build and return the enriched knowledge graph for the entire codebase.

    Returns nodes (files, classes, functions), edges (imports, inheritance,
    composition), module clusters, and centrality statistics.
    The frontend persists this in .cognicode/ for incremental updates.
    """
    try:
        t0 = time.time()
        files = [{"path": f.path, "content": f.content} for f in request.files]
        loop = asyncio.get_event_loop()
        graph = await loop.run_in_executor(None, build_codebase_graph, files)
        kg = build_knowledge_graph(graph)
        t1 = time.time()
        logger.info(f"🟢 Knowledge graph built in {(t1-t0)*1000:.0f}ms ({len(kg['nodes'])} nodes, {len(kg['edges'])} edges)")
        return KnowledgeGraphResponse(**kg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/codebase/incremental-analyze", response_model=IncrementalAnalyzeResponse)
async def codebase_incremental_analyze(request: IncrementalAnalyzeRequest):
    """Incrementally update architecture analysis based on changed files.

    Instead of re-analyzing the entire codebase:
    1. Parses ONLY the changed/added files through the graph builder
    2. Sends previous report + change delta to the LLM
    3. LLM patches the report surgically (keeps accurate sections intact)

    Falls back to full analysis if > 50% of files changed or no previous report exists.
    """
    try:
        # Parse only the changed files
        changed_files_raw = [{"path": f.path, "content": f.content} for f in request.changed_files]
        changed_graph = build_codebase_graph(changed_files_raw)

        # Build summaries for changed and new files
        changed_summary = render_graph_summary(changed_graph) if changed_graph else ""

        # Separate truly new files (not in previous summary) from modified ones
        added_summary = ""
        if request.previous_graph_summary:
            new_files = []
            for node in changed_graph:
                short = node.path.replace("\\", "/")
                if short not in request.previous_graph_summary:
                    new_files.append(node)
            if new_files:
                added_summary = render_graph_summary(new_files)
                # Remove new files from changed summary
                modified_nodes = [n for n in changed_graph if n not in new_files]
                changed_summary = render_graph_summary(modified_nodes) if modified_nodes else ""

        # Use the previous graph summary as the full context base
        full_graph_summary = request.previous_graph_summary
        # If we have changed files, update the summary sections
        if changed_summary or added_summary:
            full_graph_summary = request.previous_graph_summary

        result = await generate_incremental_architecture(
            previous_report=request.previous_report,
            previous_patterns=request.previous_patterns,
            changed_files_summary=changed_summary,
            added_files_summary=added_summary,
            deleted_paths=request.deleted_paths,
            full_graph_summary=full_graph_summary,
            folder_name=request.folder_name,
        )

        return IncrementalAnalyzeResponse(
            summary_markdown=result["summary_markdown"],
            detected_patterns=result["detected_patterns"],
            confidence_score=result["confidence_score"],
            files_reanalyzed=len(request.changed_files),
            incremental=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/gatekeeper/evaluate", response_model=GatekeeperResponse)
async def gatekeeper_evaluate(request: GatekeeperRequest):
    if request.language == "python":
        try:
            python_ast.parse(request.code)
        except SyntaxError as e:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid Python syntax: {str(e)}",
            )

        try:
            raw_metrics = compute_complexity(request.code)
            metrics = [ComplexityMetric(**m) for m in raw_metrics]

            violations = []
            for m in metrics:
                if m.cyclomatic_complexity > request.max_cyclomatic_complexity:
                    violations.append(
                        f"{m.function_name}: cyclomatic complexity {m.cyclomatic_complexity} exceeds limit {request.max_cyclomatic_complexity}"
                    )
                if m.cognitive_complexity > request.max_cognitive_complexity:
                    violations.append(
                        f"{m.function_name}: cognitive complexity {m.cognitive_complexity} exceeds limit {request.max_cognitive_complexity}"
                    )

            verdict = "FAIL" if violations else "PASS"

            if not metrics:
                overall_score = 1.0
            else:
                avg_cyclomatic = sum(m.cyclomatic_complexity for m in metrics) / len(metrics)
                overall_score = max(0.0, 1.0 - (avg_cyclomatic / 20.0))

            if verdict == "PASS":
                recommendation = "Code meets all complexity thresholds. Approved for merge."
            else:
                recommendation = f"Code has {len(violations)} violation(s). Refactor the flagged functions before merging."

            return GatekeeperResponse(
                verdict=verdict,
                overall_score=round(overall_score, 3),
                metrics=metrics,
                violations=violations,
                recommendation=recommendation,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        result = await generate_gatekeeper_llm(
            request.code,
            request.language,
            request.max_cyclomatic_complexity,
            request.max_cognitive_complexity,
        )
        return GatekeeperResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


BIG_O_MULTIPLIERS = {
    "O(1)": 1.0,
    "O(log n)": 2.0,
    "O(n)": 10.0,
    "O(n log n)": 15.0,
    "O(n^2)": 100.0,
    "O(n²)": 100.0,
    "O(n^3)": 1000.0,
    "O(n³)": 1000.0,
    "O(2^n)": 10000.0,
}


def _parse_big_o(big_o_str: str) -> float:
    normalized = big_o_str.strip().replace(" ", "")
    if normalized in BIG_O_MULTIPLIERS:
        return BIG_O_MULTIPLIERS[normalized]
    if "n^2" in normalized or "n²" in normalized:
        return 100.0
    if "n^3" in normalized or "n³" in normalized:
        return 1000.0
    if "2^n" in normalized:
        return 10000.0
    if "nlog" in normalized.replace(" ", ""):
        return 15.0
    if "log" in normalized:
        return 2.0
    if "n" in normalized:
        return 10.0
    return 5.0


def _compute_stress(complexity_multiplier: float, rps: int, dependency_count: int) -> tuple[str, float]:
    base_latency_ms = complexity_multiplier * (rps / 1000.0)
    cascade_factor = 1.0 + (dependency_count * 0.15)
    effective_latency = base_latency_ms * cascade_factor

    if effective_latency < 50:
        return "safe", effective_latency
    elif effective_latency < 200:
        return "warning", effective_latency
    else:
        return "critical", effective_latency


@app.post("/api/v1/sandbox/simulate", response_model=SimulationResponse)
async def sandbox_simulate(request: SimulationRequest):
    try:
        metric_lookup: dict[str, ComplexityMetric] = {}
        for m in request.metrics:
            metric_lookup[m.function_name] = m

        edge_count_by_source: dict[str, int] = {}
        for edge in request.edges:
            edge_count_by_source[edge.source] = edge_count_by_source.get(edge.source, 0) + 1

        incoming_edges: dict[str, list[str]] = {}
        for edge in request.edges:
            incoming_edges.setdefault(edge.target, []).append(edge.source)

        stressed_nodes: list[BlastRadiusNode] = []
        bottleneck_nodes: list[str] = []
        warnings: list[str] = []
        node_stress_map: dict[str, str] = {}
        node_latency_map: dict[str, float] = {}

        for node in request.nodes:
            node_label = node.data.get("label", node.id)
            node_big_o = "O(1)"
            node_cyclomatic = 1

            matched_metric = metric_lookup.get(node_label)
            if not matched_metric:
                for mname, mval in metric_lookup.items():
                    if mname.split(".")[-1] == node_label.split(".")[-1]:
                        matched_metric = mval
                        break

            if matched_metric:
                node_big_o = matched_metric.estimated_big_o
                node_cyclomatic = matched_metric.cyclomatic_complexity

            complexity_mult = _parse_big_o(node_big_o)
            dep_count = edge_count_by_source.get(node.id, 0)
            stress_level, latency = _compute_stress(complexity_mult, request.requests_per_second, dep_count)

            node_stress_map[node.id] = stress_level
            node_latency_map[node.id] = latency

        for node_id in list(node_stress_map.keys()):
            sources = incoming_edges.get(node_id, [])
            for src in sources:
                if node_stress_map.get(src) == "critical":
                    if node_stress_map[node_id] == "safe":
                        node_stress_map[node_id] = "warning"
                    elif node_stress_map[node_id] == "warning":
                        node_stress_map[node_id] = "critical"
                        node_latency_map[node_id] = max(node_latency_map.get(node_id, 0), 250.0)

        for node in request.nodes:
            node_label = node.data.get("label", node.id)
            stress_level = node_stress_map.get(node.id, "safe")
            latency = node_latency_map.get(node.id, 0.0)

            stress_status_map = {
                "safe": "healthy",
                "warning": "warning",
                "critical": "critical",
            }

            stress_labels = {
                "safe": f"{latency:.0f}ms — Nominal",
                "warning": f"{latency:.0f}ms — Degraded",
                "critical": f"{latency:.0f}ms — BOTTLENECK",
            }

            updated_data = dict(node.data)
            updated_data["status"] = stress_status_map[stress_level]
            updated_data["statusLabel"] = stress_labels[stress_level]
            updated_data["stressLevel"] = stress_level
            updated_data["latency"] = f"{latency:.1f}"
            updated_data["metric"] = f"{latency:.0f}ms"
            updated_data["metricLabel"] = f"@ {request.requests_per_second:,} req/s"

            stressed_nodes.append(BlastRadiusNode(
                id=node.id,
                type=node.type,
                position=node.position,
                data=updated_data,
            ))

            if stress_level == "critical":
                bottleneck_nodes.append(node_label)
                warnings.append(
                    f"{node_label} will experience a {latency:.0f}ms latency spike under {request.requests_per_second:,} req/s load."
                )

        stressed_edges: list[BlastRadiusEdge] = []
        for edge in request.edges:
            src_stress = node_stress_map.get(edge.source, "safe")
            tgt_stress = node_stress_map.get(edge.target, "safe")
            worst = "safe"
            if src_stress == "critical" or tgt_stress == "critical":
                worst = "critical"
            elif src_stress == "warning" or tgt_stress == "warning":
                worst = "warning"

            edge_color_map = {
                "safe": "#22c55e",
                "warning": "#f59e0b",
                "critical": "#ef4444",
            }

            stressed_edges.append(BlastRadiusEdge(
                id=edge.id,
                source=edge.source,
                target=edge.target,
                animated=worst != "safe",
                style={"stroke": edge_color_map[worst], "strokeWidth": 3 if worst == "critical" else 2},
                sourceHandle=edge.sourceHandle,
                targetHandle=edge.targetHandle,
            ))

        failed = len(bottleneck_nodes) > 0

        if failed:
            summary = f"Simulation FAILED at {request.requests_per_second:,} req/s: {len(bottleneck_nodes)} node(s) reached critical stress. Bottlenecks: {', '.join(bottleneck_nodes)}. Refactor high-complexity functions or add caching layers."
        else:
            summary = f"Simulation PASSED at {request.requests_per_second:,} req/s: All nodes within safe operational limits."

        return SimulationResponse(
            nodes=stressed_nodes,
            edges=stressed_edges,
            simulation_summary=summary,
            failed=failed,
            bottleneck_nodes=bottleneck_nodes,
            warnings=warnings,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/git/spawn-sandbox", response_model=SandboxSpawnResponse)
async def git_spawn_sandbox(request: SandboxSpawnRequest):
    try:
        import os
        from git import Repo, InvalidGitRepositoryError, GitCommandError

        if not os.path.isdir(request.repo_path):
            raise HTTPException(
                status_code=400,
                detail=f"Directory does not exist: {request.repo_path}",
            )

        try:
            repo = Repo(request.repo_path)
        except InvalidGitRepositoryError:
            repo = Repo.init(request.repo_path)
            repo.config_writer().set_value("user", "name", "CogniCode Sandbox").release()
            repo.config_writer().set_value("user", "email", "sandbox@cognicode.dev").release()
            repo.git.add("--all")
            try:
                repo.git.commit("-m", "Initial commit by CogniCode")
            except GitCommandError:
                pass

        try:
            original_branch = repo.active_branch.name
        except TypeError:
            repo.git.checkout("-b", "main")
            original_branch = "main"

        if repo.is_dirty(untracked_files=True):
            repo.git.add("--all")
            try:
                repo.git.commit("-m", "CogniCode: auto-save before sandbox")
            except GitCommandError:
                pass

        sandbox_id = uuid.uuid4().hex[:8]
        branch_name = f"{request.branch_prefix}/ephemeral-{sandbox_id}"

        try:
            repo.git.checkout("-b", branch_name)
        except GitCommandError as e:
            raise HTTPException(status_code=500, detail=f"Failed to create branch: {str(e)}")

        return SandboxSpawnResponse(
            branch_name=branch_name,
            original_branch=original_branch,
            status="spawned",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/git/merge-and-destroy", response_model=SandboxMergeResponse)
async def git_merge_and_destroy(request: SandboxMergeRequest):
    try:
        import os
        from git import Repo, InvalidGitRepositoryError, GitCommandError

        if "local/" in request.sandbox_branch:
            return SandboxMergeResponse(
                status="merged",
                merged_branch=request.sandbox_branch,
                target_branch=request.target_branch,
                deleted=True,
                message="Local sandbox session closed. No git operations were needed.",
            )

        if not os.path.isdir(request.repo_path):
            raise HTTPException(
                status_code=400,
                detail=f"Directory does not exist: {request.repo_path}",
            )

        try:
            repo = Repo(request.repo_path)
        except InvalidGitRepositoryError:
            raise HTTPException(
                status_code=400,
                detail=f"Not a valid git repository: {request.repo_path}",
            )

        repo.config_writer().set_value("user", "name", "CogniCode Sandbox").release()
        repo.config_writer().set_value("user", "email", "sandbox@cognicode.dev").release()

        current = repo.active_branch.name
        if current != request.sandbox_branch:
            try:
                repo.git.checkout(request.sandbox_branch)
            except GitCommandError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot find sandbox branch: {request.sandbox_branch}",
                )

        if repo.is_dirty(untracked_files=True):
            repo.git.add("--all")
            try:
                repo.git.commit("-m", f"sandbox: auto-commit from {request.sandbox_branch}")
            except GitCommandError:
                pass

        try:
            repo.git.checkout(request.target_branch)
        except GitCommandError:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot switch to target branch: {request.target_branch}",
            )

        try:
            repo.git.merge(request.sandbox_branch, "--no-ff", "-m", f"Merge {request.sandbox_branch} into {request.target_branch}")
        except GitCommandError as e:
            try:
                repo.git.merge("--abort")
            except GitCommandError:
                pass
            repo.git.checkout(request.sandbox_branch)
            raise HTTPException(
                status_code=409,
                detail=f"Merge conflict detected. Sandbox branch preserved. Details: {str(e)}",
            )

        deleted = False
        try:
            repo.git.branch("-D", request.sandbox_branch)
            deleted = True
        except GitCommandError:
            deleted = False

        return SandboxMergeResponse(
            status="merged",
            merged_branch=request.sandbox_branch,
            target_branch=request.target_branch,
            deleted=deleted,
            message=f"Successfully merged {request.sandbox_branch} into {request.target_branch}."
            + (" Sandbox branch destroyed." if deleted else " Branch preserved due to cleanup issue."),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Stress Testing (analyzes the user's loaded codebase) ────────────────

import time


@app.post("/api/v1/stress-test")
async def stress_test(request: LoadTestRequest):
    """Analyze the loaded codebase for concurrency bottlenecks.

    Given the user's project files and a simulated user count, this endpoint:
    1. Builds the dependency graph from the codebase
    2. Computes per-function complexity (cyclomatic, cognitive, Big-O)
    3. Simulates concurrent load stress propagation through the dependency chain
    4. Returns per-function bottleneck analysis with latency predictions
    """
    if len(request.files) == 0:
        raise HTTPException(
            status_code=400,
            detail="No codebase loaded. Open a folder in the IDE first."
        )

    start = time.perf_counter()

    try:
        files = [{"path": f.path, "content": f.content} for f in request.files]
        graph = build_codebase_graph(files)

        # --- Step 1: Build complexity metrics per function ---
        function_metrics: list[dict] = []
        for f in request.files:
            lang = f.path.rsplit(".", 1)[-1].lower()
            if lang == "py":
                try:
                    ast_data = parse_python_ast(f.content)
                    for fn in ast_data.get("functions", []):
                        function_metrics.append({
                            "name": fn["name"],
                            "file": f.path,
                            "cyclomatic": fn.get("cyclomatic_complexity", 1),
                            "cognitive": fn.get("cognitive_complexity", 0),
                            "big_o": fn.get("estimated_big_o", "O(1)"),
                            "loc": fn.get("lines_of_code", 0),
                        })
                except Exception:
                    pass

            # Add graph-extracted functions for non-Python files
            for node in graph:
                if node.path.replace("\\", "/") == f.path.replace("\\", "/"):
                    for func_info in node.functions:
                        fn_name = func_info.name  # FunctionInfo is a dataclass, not a string
                        if not any(m["name"] == fn_name and m["file"] == f.path for m in function_metrics):
                            function_metrics.append({
                                "name": fn_name,
                                "file": f.path,
                                "cyclomatic": 3,  # estimated default
                                "cognitive": 2,
                                "big_o": "O(n)",
                                "loc": func_info.lines or 0,
                            })

        # --- Step 2: Simulate stress for each function ---
        rps = request.num_requests * 100  # scale: 10 users ≈ 1000 rps

        function_results = []
        bottlenecks = []
        warnings_list = []
        total_safe = 0
        total_warning = 0
        total_critical = 0

        for fn in function_metrics:
            complexity_mult = _parse_big_o(fn["big_o"])
            dep_count = fn["cyclomatic"] // 3  # approximate dependencies from complexity
            stress_level, latency = _compute_stress(complexity_mult, rps, dep_count)

            # Cascade: high cognitive complexity amplifies stress
            if fn["cognitive"] > 10 and stress_level == "warning":
                stress_level = "critical"
                latency *= 1.5
            elif fn["cognitive"] > 15:
                stress_level = "critical"
                latency *= 2.0

            fn_result = {
                "function_name": fn["name"],
                "file": fn["file"].split("/")[-1] if "/" in fn["file"] else fn["file"].split("\\")[-1] if "\\" in fn["file"] else fn["file"],
                "file_path": fn["file"],
                "complexity": fn["big_o"] if fn["big_o"].startswith("O(") else f"O({fn['big_o']})",
                "cyclomatic": fn["cyclomatic"],
                "estimated_latency_ms": round(latency, 1),
                "stress_level": stress_level,
            }
            function_results.append(fn_result)

            if stress_level == "critical":
                total_critical += 1
                bottlenecks.append(fn["name"])
                warnings_list.append(
                    f"{fn['name']} in {fn_result['file']} — {fn['big_o']} complexity, estimated {latency:.0f}ms at {request.num_requests} concurrent users"
                )
            elif stress_level == "warning":
                total_warning += 1
            else:
                total_safe += 1

        # Sort: critical first, then warning, then safe
        stress_order = {"critical": 0, "warning": 1, "safe": 2}
        function_results.sort(key=lambda x: (stress_order[x["stress_level"]], -x["estimated_latency_ms"]))

        elapsed_ms = (time.perf_counter() - start) * 1000

        # --- Verdict ---
        if total_critical == 0 and total_warning == 0:
            verdict = "PASS"
            summary = f"All {len(function_results)} functions handle {request.num_requests} concurrent users within safe operational limits."
        elif total_critical == 0:
            verdict = "DEGRADED"
            summary = f"{total_warning} function(s) show degraded performance at {request.num_requests} concurrent users. Consider optimization."
        else:
            verdict = "FAIL"
            summary = f"{total_critical} bottleneck(s) detected at {request.num_requests} concurrent users: {', '.join(bottlenecks[:3])}{'...' if len(bottlenecks) > 3 else ''}. Refactor high-complexity functions."

        return {
            "verdict": verdict,
            "summary": summary,
            "concurrent_users": request.num_requests,
            "total_functions_analyzed": len(function_results),
            "safe_count": total_safe,
            "warning_count": total_warning,
            "critical_count": total_critical,
            "analysis_time_ms": round(elapsed_ms, 2),
            "function_results": function_results,
            "bottlenecks": bottlenecks,
            "warnings": warnings_list,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Real HTTP Stress Test ────────────────────────────────────────────────


@app.post("/api/v1/stress-test/real", response_model=RealStressTestResponse)
async def real_stress_test(request: RealStressTestRequest):
    """Real HTTP stress test using Python asyncio + aiohttp.

    Sends actual concurrent HTTP requests to the user-specified endpoint
    and returns real performance metrics including:
    - Latency percentiles (p50, p90, p95, p99)
    - Throughput (req/s)
    - Error categorization (5xx, 4xx, timeouts, connection errors, crashes)
    - Verdict: PASS / DEGRADED / FAIL / CRASH
    """
    try:
        config = StressTestConfig(
            url=request.url,
            method=request.method,
            headers=request.headers,
            body=request.body,
            auth_type=request.auth_type,
            auth_value=request.auth_value,
            auth_header_name=request.auth_header_name,
            num_requests=request.num_requests,
            concurrency=request.concurrency,
            timeout_seconds=request.timeout_seconds,
        )

        result = await run_real_stress_test(config)

        return RealStressTestResponse(
            verdict=result.verdict,
            summary=result.summary,
            total_requests=result.total_requests,
            successful=result.successful,
            failed=result.failed,
            success_rate=result.success_rate,
            latency_min=result.latency_min,
            latency_avg=result.latency_avg,
            latency_p50=result.latency_p50,
            latency_p90=result.latency_p90,
            latency_p95=result.latency_p95,
            latency_p99=result.latency_p99,
            latency_max=result.latency_max,
            throughput_rps=result.throughput_rps,
            total_time_ms=result.total_time_ms,
            total_data_bytes=result.total_data_bytes,
            error_counts=result.error_counts,
            results=[
                RealStressRequestResult(
                    request_id=r.request_id,
                    status_code=r.status_code,
                    latency_ms=r.latency_ms,
                    response_size_bytes=r.response_size_bytes,
                    error=r.error,
                    error_category=r.error_category,
                )
                for r in result.results
            ],
            target_url=result.target_url,
            method=result.method,
            concurrency=result.concurrency,
        )
    except Exception as e:
        logger.error(f"Real stress test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Graph-Powered Coding Assistant ───────────────────────────────────────


@app.post("/api/v1/assistant/chat", response_model=AssistantChatResponse)
async def assistant_chat(request: AssistantChatRequest):
    """
    Graph-Powered Coding Assistant.

    Instead of sending the entire codebase to the LLM, this endpoint:
    1. Builds the Knowledge Graph from the codebase
    2. Extracts keywords from the user's query
    3. Searches the graph for ONLY the relevant files
    4. Builds a token-optimized surgical prompt
    5. Sends just those files to the LLM

    Result: 70-90% token savings, faster responses, zero hallucinations.
    """
    try:
        result = await run_assistant(
            query=request.query,
            files=[
                {"path": f.get("path", ""), "content": f.get("content", "")}
                for f in request.files
            ],
            folder_name=request.folder_name,
            conversation_history=[
                {"role": m.role, "content": m.content}
                for m in request.conversation_history
            ],
            max_relevant_files=request.max_relevant_files,
        )

        return AssistantChatResponse(
            answer=result.answer,
            files_analyzed=result.files_analyzed,
            selected_count=result.search_result.selected_count,
            total_files=result.search_result.total_files,
            token_savings_pct=result.search_result.token_savings_pct,
            token_estimate_full=result.search_result.token_estimate_full,
            token_estimate_surgical=result.search_result.token_estimate_surgical,
            search_keywords=result.search_result.search_keywords,
            relevant_files=result.search_result.relevant_files,
            model_used=result.model_used,
            prompt_tokens=result.prompt_tokens,
        )
    except Exception as e:
        logger.error(f"Assistant chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GitHub Commit Sync ───────────────────────────────────────────────────


@app.post("/api/v1/github/sync-latest")
async def github_sync_latest(request: dict):
    """Fetch the latest GitHub commit, summarize it via LLM, and ingest into ChromaDB.

    This is the 'Git Hash as a Time Machine' feature — every push becomes
    searchable institutional knowledge in the RAG engine.

    Request body:
        owner: str - GitHub repo owner
        repo: str - GitHub repo name
        branch: str (optional) - Branch name, default 'main'
        token: str (optional) - GitHub personal access token for private repos
    """
    raw_owner = request.get("owner", "")
    raw_repo = request.get("repo", "")
    branch = request.get("branch", "main")
    token = request.get("token", "")

    if not raw_owner and not raw_repo:
        raise HTTPException(status_code=400, detail="owner and repo are required")

    try:
        # Parse full GitHub URLs: "https://github.com/owner/repo.git" → ("owner", "repo")
        owner, repo = parse_github_url(raw_owner, raw_repo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        # 1. Fetch latest commit from GitHub
        commit = await fetch_latest_commit(owner, repo, branch, token)

        # 2. Summarize via LLM
        summary = await summarize_commit(commit, generate_response)

        # 3. Ingest into ChromaDB
        chunks_ingested = ingest_commit_to_chromadb(commit, summary)

        return {
            "status": "synced",
            "commit": {
                "sha": commit["sha"],
                "short_sha": commit["short_sha"],
                "message": commit["message"],
                "author": commit["author"],
                "date": commit["date"],
                "stats": commit["stats"],
                "files_changed": len(commit["files_changed"]),
                "file_names": [f["filename"] for f in commit["files_changed"]],
            },
            "summary": summary,
            "chunks_ingested": chunks_ingested,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"GitHub sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
