from pydantic import BaseModel, Field


class ArcheologistRequest(BaseModel):
    code: str = Field(..., min_length=1)
    language: str = Field(default="python")


class ArcheologistResponse(BaseModel):
    summary_markdown: str
    detected_patterns: list[str]
    confidence_score: float


class CodeToDocRequest(BaseModel):
    code: str = Field(..., min_length=1)
    existing_doc: str = Field(default="")
    language: str = Field(default="python")


class CodeToDocResponse(BaseModel):
    updated_markdown: str
    changes_detected: list[str]
    sync_status: str


class DocToCodeRequest(BaseModel):
    markdown: str = Field(..., min_length=1)
    target_language: str = Field(default="python")


class DocToCodeResponse(BaseModel):
    generated_code: str
    language: str
    completeness_score: float


class BlastRadiusRequest(BaseModel):
    code: str = Field(..., min_length=1)
    language: str = Field(default="python")


class BlastRadiusNode(BaseModel):
    id: str
    type: str = Field(default="serviceNode")
    position: dict[str, float]
    data: dict[str, str]
    parentId: str | None = Field(default=None)
    style: dict[str, float] | None = Field(default=None)


class BlastRadiusEdge(BaseModel):
    id: str
    source: str
    target: str
    animated: bool = Field(default=True)
    label: str | None = Field(default=None)
    style: dict[str, str | float] = Field(default_factory=dict)
    type: str = Field(default="smoothstep")
    labelStyle: dict[str, str | float | int] = Field(default_factory=dict)
    sourceHandle: str | None = Field(default=None)
    targetHandle: str | None = Field(default=None)


class BlastRadiusResponse(BaseModel):
    nodes: list[BlastRadiusNode]
    edges: list[BlastRadiusEdge]
    analysis_summary: str
    total_functions: int
    total_dependencies: int


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)


class RAGDocument(BaseModel):
    content: str
    source: str
    relevance_score: float


class RAGQueryResponse(BaseModel):
    answer: str
    retrieved_documents: list[RAGDocument]
    context_used: str


class GatekeeperRequest(BaseModel):
    code: str = Field(..., min_length=1)
    language: str = Field(default="python")
    max_cyclomatic_complexity: int = Field(default=10)
    max_cognitive_complexity: int = Field(default=15)


class ComplexityMetric(BaseModel):
    function_name: str
    cyclomatic_complexity: int
    cognitive_complexity: int
    estimated_big_o: str
    lines_of_code: int


class GatekeeperResponse(BaseModel):
    verdict: str
    overall_score: float
    metrics: list[ComplexityMetric]
    violations: list[str]
    recommendation: str


class HealthResponse(BaseModel):
    status: str
    version: str
    services: dict[str, str]


class SimulationRequest(BaseModel):
    nodes: list[BlastRadiusNode]
    edges: list[BlastRadiusEdge]
    requests_per_second: int = Field(default=1000, ge=1, le=1000000)
    metrics: list[ComplexityMetric] = Field(default_factory=list)


class SimulationResponse(BaseModel):
    nodes: list[BlastRadiusNode]
    edges: list[BlastRadiusEdge]
    simulation_summary: str
    failed: bool
    bottleneck_nodes: list[str]
    warnings: list[str]


class SandboxSpawnRequest(BaseModel):
    repo_path: str = Field(..., min_length=1)
    branch_prefix: str = Field(default="sandbox")


class SandboxSpawnResponse(BaseModel):
    branch_name: str
    original_branch: str
    status: str


class SandboxMergeRequest(BaseModel):
    repo_path: str = Field(..., min_length=1)
    sandbox_branch: str = Field(..., min_length=1)
    target_branch: str = Field(default="main")


class SandboxMergeResponse(BaseModel):
    status: str
    merged_branch: str
    target_branch: str
    deleted: bool
    message: str


class IngestFileItem(BaseModel):
    path: str
    content: str


class IngestFilesRequest(BaseModel):
    folder_name: str
    files: list[IngestFileItem]


class CodebaseFileItem(BaseModel):
    path: str
    content: str


class CodebaseAnalyzeRequest(BaseModel):
    """Request body for codebase-level analysis (Archeologist, Blast Radius)."""
    folder_name: str = Field(default="project")
    files: list[CodebaseFileItem] = Field(..., min_length=1)


class CodebaseDocRequest(BaseModel):
    """Request body for codebase-level Code→Doc generation."""
    folder_name: str = Field(default="project")
    files: list[CodebaseFileItem] = Field(..., min_length=1)
    existing_doc: str = Field(default="")


class LoadTestFileItem(BaseModel):
    path: str
    content: str


class LoadTestRequest(BaseModel):
    """Request body for the built-in load tester."""
    num_requests: int = Field(default=10, ge=1, le=100)
    endpoint: str = Field(default="health")  # health, blast_radius, codebase_map, quality_gate
    folder_name: str = Field(default="project")
    files: list[LoadTestFileItem] = Field(default_factory=list)


class LoadTestResult(BaseModel):
    """Per-request result from the load test."""
    request_id: int
    status: str  # "success" or "error"
    latency_ms: float
    error: str | None = None


class LoadTestResponse(BaseModel):
    """Aggregate load test results."""
    total_requests: int
    successful: int
    failed: int
    total_time_ms: float
    avg_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    throughput_rps: float
    results: list[LoadTestResult]
    verdict: str
    summary: str


# ── Incremental Analysis ─────────────────────────────────────────────────


class IncrementalAnalyzeRequest(BaseModel):
    """Request for delta-based incremental codebase re-analysis.

    Instead of sending all files, the client sends:
    - Only files that changed (added + modified)
    - Paths of deleted files
    - The previous analysis report (so the LLM can patch it)
    """
    folder_name: str = Field(default="project")
    changed_files: list[CodebaseFileItem] = Field(default_factory=list)
    deleted_paths: list[str] = Field(default_factory=list)
    previous_report: str = Field(default="")
    previous_patterns: list[str] = Field(default_factory=list)
    previous_graph_summary: str = Field(default="")


class IncrementalAnalyzeResponse(BaseModel):
    """Response from incremental analysis — same shape as ArcheologistResponse."""
    summary_markdown: str
    detected_patterns: list[str]
    confidence_score: float
    files_reanalyzed: int = 0
    incremental: bool = True


# ── Knowledge Graph ──────────────────────────────────────────────────────


class KnowledgeGraphResponse(BaseModel):
    """Full knowledge graph with nodes, edges, clusters, and statistics."""
    nodes: list[dict]
    edges: list[dict]
    clusters: list[dict]
    statistics: dict


# ── Graph-Powered Assistant ──────────────────────────────────────────────


class AssistantMessage(BaseModel):
    role: str = Field(default="user")
    content: str


class AssistantChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    folder_name: str
    files: list[dict]
    conversation_history: list[AssistantMessage] = Field(default_factory=list)
    max_relevant_files: int = Field(default=8)


class AssistantChatResponse(BaseModel):
    answer: str
    files_analyzed: list[str]
    selected_count: int
    total_files: int
    token_savings_pct: float
    token_estimate_full: int
    token_estimate_surgical: int
    search_keywords: list[str]
    relevant_files: list[dict]
    model_used: str
    prompt_tokens: int


# ── Real HTTP Stress Test ────────────────────────────────────────────────


class RealStressTestRequest(BaseModel):
    """Configuration for a real HTTP stress test."""
    url: str = Field(..., min_length=1)
    method: str = Field(default="GET")
    headers: dict[str, str] = Field(default_factory=dict)
    body: str | None = Field(default=None)
    auth_type: str = Field(default="none")         # none, bearer, basic, api_key
    auth_value: str = Field(default="")
    auth_header_name: str = Field(default="")       # for api_key type
    num_requests: int = Field(default=50, ge=1, le=1000)
    concurrency: int = Field(default=10, ge=1, le=100)
    timeout_seconds: float = Field(default=10.0, ge=1.0, le=60.0)


class RealStressRequestResult(BaseModel):
    """Metrics for a single HTTP request."""
    request_id: int
    status_code: int | None = None
    latency_ms: float = 0.0
    response_size_bytes: int = 0
    error: str | None = None
    error_category: str = "none"


class RealStressTestResponse(BaseModel):
    """Full results from a real HTTP stress test."""
    verdict: str                  # PASS, DEGRADED, FAIL, CRASH
    summary: str

    total_requests: int
    successful: int
    failed: int
    success_rate: float

    latency_min: float
    latency_avg: float
    latency_p50: float
    latency_p90: float
    latency_p95: float
    latency_p99: float
    latency_max: float

    throughput_rps: float
    total_time_ms: float
    total_data_bytes: int

    error_counts: dict[str, int]

    results: list[RealStressRequestResult]

    target_url: str
    method: str
    concurrency: int

