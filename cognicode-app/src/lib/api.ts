const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ArcheologistRequest {
  code: string;
  language?: string;
}

interface ArcheologistResponse {
  summary_markdown: string;
  detected_patterns: string[];
  confidence_score: number;
}

interface CodeToDocRequest {
  code: string;
  existing_doc?: string;
  language?: string;
}

interface CodeToDocResponse {
  updated_markdown: string;
  changes_detected: string[];
  sync_status: string;
}

interface DocToCodeRequest {
  markdown: string;
  target_language?: string;
}

interface DocToCodeResponse {
  generated_code: string;
  language: string;
  completeness_score: number;
}

interface BlastRadiusRequest {
  code: string;
  language?: string;
}

interface BlastRadiusNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, string>;
}

interface BlastRadiusEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  style: Record<string, string | number>;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface BlastRadiusResponse {
  nodes: BlastRadiusNode[];
  edges: BlastRadiusEdge[];
  analysis_summary: string;
  total_functions: number;
  total_dependencies: number;
}

interface RAGQueryRequest {
  query: string;
  top_k?: number;
}

interface RAGDocument {
  content: string;
  source: string;
  relevance_score: number;
}

interface RAGQueryResponse {
  answer: string;
  retrieved_documents: RAGDocument[];
  context_used: string;
}

interface IngestFileItem {
  path: string;
  content: string;
}

interface IngestFilesRequest {
  folder_name: string;
  files: IngestFileItem[];
}

interface IngestFilesResponse {
  status: string;
  folder_name: string;
  ingestion_stats: {
    source_code: number;
    documentation: number;
    configs: number;
    total_chunks: number;
  };
  message: string;
}

interface CodebaseFileItem {
  path: string;
  content: string;
}

interface CodebaseAnalyzeRequest {
  folder_name: string;
  files: CodebaseFileItem[];
}

interface CodebaseDocRequest {
  folder_name: string;
  files: CodebaseFileItem[];
  existing_doc?: string;
}

interface GatekeeperRequest {
  code: string;
  language?: string;
  max_cyclomatic_complexity?: number;
  max_cognitive_complexity?: number;
}

interface ComplexityMetric {
  function_name: string;
  cyclomatic_complexity: number;
  cognitive_complexity: number;
  estimated_big_o: string;
  lines_of_code: number;
}

interface GatekeeperResponse {
  verdict: "PASS" | "FAIL";
  overall_score: number;
  metrics: ComplexityMetric[];
  violations: string[];
  recommendation: string;
}

interface HealthResponse {
  status: string;
  version: string;
  services: Record<string, string>;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(error.detail || response.statusText, response.status);
  }

  return response.json();
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new ApiError("Backend unreachable", response.status);
  }
  return response.json();
}

export async function analyzeArchitecture(
  params: ArcheologistRequest
): Promise<ArcheologistResponse> {
  return request<ArcheologistResponse>("/api/v1/archeologist", {
    code: params.code,
    language: params.language || "python",
  });
}

export async function syncCodeToDoc(
  params: CodeToDocRequest
): Promise<CodeToDocResponse> {
  return request<CodeToDocResponse>("/api/v1/sync/code-to-doc", {
    code: params.code,
    existing_doc: params.existing_doc || "",
    language: params.language || "python",
  });
}

export async function syncDocToCode(
  params: DocToCodeRequest
): Promise<DocToCodeResponse> {
  return request<DocToCodeResponse>("/api/v1/sync/doc-to-code", {
    markdown: params.markdown,
    target_language: params.target_language || "python",
  });
}

export async function getBlastRadius(
  params: BlastRadiusRequest
): Promise<BlastRadiusResponse> {
  return request<BlastRadiusResponse>("/api/v1/ast/blast-radius", {
    code: params.code,
    language: params.language || "python",
  });
}

export async function queryRAG(
  params: RAGQueryRequest
): Promise<RAGQueryResponse> {
  return request<RAGQueryResponse>("/api/v1/rag/query", {
    query: params.query,
    top_k: params.top_k || 5,
  });
}

export async function ingestFiles(
  params: IngestFilesRequest
): Promise<IngestFilesResponse> {
  return request<IngestFilesResponse>("/api/v1/rag/ingest-files", {
    folder_name: params.folder_name,
    files: params.files,
  });
}

// ── Codebase-level APIs (graph-based, token-efficient) ──

export async function analyzeCodebaseArchitecture(
  params: CodebaseAnalyzeRequest
): Promise<ArcheologistResponse> {
  return request<ArcheologistResponse>("/api/v1/codebase/archeologist", {
    folder_name: params.folder_name,
    files: params.files,
  });
}

export async function getCodebaseBlastRadius(
  params: CodebaseAnalyzeRequest
): Promise<BlastRadiusResponse> {
  return request<BlastRadiusResponse>("/api/v1/codebase/blast-radius", {
    folder_name: params.folder_name,
    files: params.files,
  });
}

export async function syncCodebaseToDoc(
  params: CodebaseDocRequest
): Promise<CodeToDocResponse> {
  return request<CodeToDocResponse>("/api/v1/codebase/code-to-doc", {
    folder_name: params.folder_name,
    files: params.files,
    existing_doc: params.existing_doc || "",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCodebaseMap(
  params: CodebaseAnalyzeRequest
): Promise<any> {
  return request("/api/v1/codebase/map", {
    folder_name: params.folder_name,
    files: params.files,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function evaluateCodebaseHealth(
  params: CodebaseAnalyzeRequest
): Promise<any> {
  return request("/api/v1/codebase/health", {
    folder_name: params.folder_name,
    files: params.files,
  });
}

export async function evaluateGatekeeper(
  params: GatekeeperRequest
): Promise<GatekeeperResponse> {
  return request<GatekeeperResponse>("/api/v1/gatekeeper/evaluate", {
    code: params.code,
    language: params.language || "python",
    max_cyclomatic_complexity: params.max_cyclomatic_complexity || 10,
    max_cognitive_complexity: params.max_cognitive_complexity || 15,
  });
}

interface SimulationRequest {
  nodes: BlastRadiusNode[];
  edges: BlastRadiusEdge[];
  requests_per_second: number;
  metrics?: ComplexityMetric[];
}

interface SimulationResponse {
  nodes: BlastRadiusNode[];
  edges: BlastRadiusEdge[];
  simulation_summary: string;
  failed: boolean;
  bottleneck_nodes: string[];
  warnings: string[];
}

export async function simulateSandbox(
  params: SimulationRequest
): Promise<SimulationResponse> {
  return request<SimulationResponse>("/api/v1/sandbox/simulate", {
    nodes: params.nodes,
    edges: params.edges,
    requests_per_second: params.requests_per_second,
    metrics: params.metrics || [],
  });
}

interface SandboxSpawnRequest {
  repo_path: string;
  branch_prefix?: string;
}

interface SandboxSpawnResponse {
  branch_name: string;
  original_branch: string;
  status: string;
}

interface SandboxMergeRequest {
  repo_path: string;
  sandbox_branch: string;
  target_branch?: string;
}

interface SandboxMergeResponse {
  status: string;
  merged_branch: string;
  target_branch: string;
  deleted: boolean;
  message: string;
}

export async function spawnSandbox(
  params: SandboxSpawnRequest
): Promise<SandboxSpawnResponse> {
  return request<SandboxSpawnResponse>("/api/v1/git/spawn-sandbox", {
    repo_path: params.repo_path,
    branch_prefix: params.branch_prefix || "sandbox",
  });
}

export async function mergeAndDestroySandbox(
  params: SandboxMergeRequest
): Promise<SandboxMergeResponse> {
  return request<SandboxMergeResponse>("/api/v1/git/merge-and-destroy", {
    repo_path: params.repo_path,
    sandbox_branch: params.sandbox_branch,
    target_branch: params.target_branch || "main",
  });
}

// ── Design Documents (HLD + LLD) ──

interface DesignDocsRequest {
  folder_name?: string;
  files: { path: string; content: string }[];
}

interface DesignDocsResponse {
  hld: string;
  lld: string;
  generation_time_ms: number;
  files_analyzed: number;
  total_classes: number;
  total_functions: number;
}

export async function generateDesignDocs(
  params: DesignDocsRequest
): Promise<DesignDocsResponse> {
  return request<DesignDocsResponse>("/api/v1/codebase/design-docs", {
    folder_name: params.folder_name || "project",
    files: params.files,
  });
}

// ── Stress Testing ──

interface StressTestRequest {
  num_requests: number;
  folder_name?: string;
  files: { path: string; content: string }[];
}

interface StressTestFunctionResult {
  function_name: string;
  file: string;
  file_path: string;
  complexity: string;
  cyclomatic: number;
  estimated_latency_ms: number;
  stress_level: "safe" | "warning" | "critical";
}

interface StressTestResponse {
  verdict: "PASS" | "DEGRADED" | "FAIL";
  summary: string;
  concurrent_users: number;
  total_functions_analyzed: number;
  safe_count: number;
  warning_count: number;
  critical_count: number;
  analysis_time_ms: number;
  function_results: StressTestFunctionResult[];
  bottlenecks: string[];
  warnings: string[];
}

export async function runStressTest(
  params: StressTestRequest
): Promise<StressTestResponse> {
  return request<StressTestResponse>("/api/v1/stress-test", {
    num_requests: params.num_requests,
    folder_name: params.folder_name || "project",
    files: params.files,
  });
}

// ── Real HTTP Stress Test ──

interface RealStressTestRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
  auth_type?: string;
  auth_value?: string;
  auth_header_name?: string;
  num_requests?: number;
  concurrency?: number;
  timeout_seconds?: number;
}

interface RealStressRequestResult {
  request_id: number;
  status_code: number | null;
  latency_ms: number;
  response_size_bytes: number;
  error: string | null;
  error_category: string;
}

interface RealStressTestResponse {
  verdict: "PASS" | "DEGRADED" | "FAIL" | "CRASH";
  summary: string;
  total_requests: number;
  successful: number;
  failed: number;
  success_rate: number;
  latency_min: number;
  latency_avg: number;
  latency_p50: number;
  latency_p90: number;
  latency_p95: number;
  latency_p99: number;
  latency_max: number;
  throughput_rps: number;
  total_time_ms: number;
  total_data_bytes: number;
  error_counts: Record<string, number>;
  results: RealStressRequestResult[];
  target_url: string;
  method: string;
  concurrency: number;
}

export async function runRealStressTest(
  params: RealStressTestRequest
): Promise<RealStressTestResponse> {
  return request<RealStressTestResponse>("/api/v1/stress-test/real", params);
}

// ── Incremental Analysis ──

interface IncrementalAnalyzeRequest {
  folder_name: string;
  changed_files: { path: string; content: string }[];
  deleted_paths: string[];
  previous_report: string;
  previous_patterns: string[];
  previous_graph_summary: string;
}

interface IncrementalAnalyzeResponse {
  summary_markdown: string;
  detected_patterns: string[];
  confidence_score: number;
  files_reanalyzed: number;
  incremental: boolean;
}

export async function incrementalAnalyze(
  params: IncrementalAnalyzeRequest
): Promise<IncrementalAnalyzeResponse> {
  return request<IncrementalAnalyzeResponse>(
    "/api/v1/codebase/incremental-analyze",
    {
      folder_name: params.folder_name,
      changed_files: params.changed_files,
      deleted_paths: params.deleted_paths,
      previous_report: params.previous_report,
      previous_patterns: params.previous_patterns,
      previous_graph_summary: params.previous_graph_summary,
    }
  );
}

// ── Knowledge Graph ──

interface KnowledgeGraphResponse {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  clusters: Record<string, unknown>[];
  statistics: Record<string, unknown>;
}

export async function getKnowledgeGraph(
  params: CodebaseAnalyzeRequest
): Promise<KnowledgeGraphResponse> {
  return request<KnowledgeGraphResponse>("/api/v1/codebase/knowledge-graph", {
    folder_name: params.folder_name,
    files: params.files,
  });
}

export type {
  ArcheologistRequest,
  ArcheologistResponse,
  CodeToDocRequest,
  CodeToDocResponse,
  DocToCodeRequest,
  DocToCodeResponse,
  BlastRadiusRequest,
  BlastRadiusNode,
  BlastRadiusEdge,
  BlastRadiusResponse,
  RAGQueryRequest,
  RAGDocument,
  RAGQueryResponse,
  GatekeeperRequest,
  ComplexityMetric,
  GatekeeperResponse,
  HealthResponse,
  SimulationRequest,
  SimulationResponse,
  SandboxSpawnRequest,
  SandboxSpawnResponse,
  SandboxMergeRequest,
  SandboxMergeResponse,
  ApiError,
  IngestFilesRequest,
  IngestFilesResponse,
  CodebaseFileItem,
  CodebaseAnalyzeRequest,
  CodebaseDocRequest,
  StressTestRequest,
  StressTestFunctionResult,
  StressTestResponse,
  RealStressTestRequest,
  RealStressRequestResult,
  RealStressTestResponse,
  DesignDocsRequest,
  DesignDocsResponse,
  IncrementalAnalyzeRequest,
  IncrementalAnalyzeResponse,
  KnowledgeGraphResponse,
  AssistantChatResponse,
};


// ── Graph-Powered Assistant ──

interface AssistantChatRequest {
  query: string;
  folder_name: string;
  files: { path: string; content: string }[];
  conversation_history?: { role: string; content: string }[];
  max_relevant_files?: number;
}

interface AssistantChatResponse {
  answer: string;
  files_analyzed: string[];
  selected_count: number;
  total_files: number;
  token_savings_pct: number;
  token_estimate_full: number;
  token_estimate_surgical: number;
  search_keywords: string[];
  relevant_files: {
    path: string;
    relevance_score: number;
    match_reasons: string[];
    classes: string[];
    functions: string[];
    lines: number;
    language: string;
  }[];
  model_used: string;
  prompt_tokens: number;
}

export async function assistantChat(
  params: AssistantChatRequest
): Promise<AssistantChatResponse> {
  return request<AssistantChatResponse>("/api/v1/assistant/chat", params);
}

// ── GitHub Commit Sync ──

interface GitHubSyncRequest {
  owner: string;
  repo: string;
  branch?: string;
  token?: string;
}

interface GitHubSyncResponse {
  status: string;
  commit: {
    sha: string;
    short_sha: string;
    message: string;
    author: string;
    date: string;
    stats: { total: number; additions: number; deletions: number };
    files_changed: number;
    file_names: string[];
  };
  summary: string;
  chunks_ingested: number;
}

export async function syncGitHubCommit(
  params: GitHubSyncRequest
): Promise<GitHubSyncResponse> {
  return request<GitHubSyncResponse>("/api/v1/github/sync-latest", params);
}

export type { GitHubSyncRequest, GitHubSyncResponse };
