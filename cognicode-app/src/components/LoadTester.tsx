"use client";

import { useState, useCallback } from "react";
import { runRealStressTest, type RealStressTestResponse } from "@/lib/api";

interface HeaderPair { key: string; value: string }

export default function StressTester() {
  // Config state
  const [url, setUrl] = useState("http://localhost:8000/health");
  const [method, setMethod] = useState("GET");
  const [numRequests, setNumRequests] = useState(50);
  const [concurrency, setConcurrency] = useState(10);
  const [timeout, setTimeout_] = useState(10);
  const [body, setBody] = useState("");
  const [headers, setHeaders] = useState<HeaderPair[]>([]);
  const [authType, setAuthType] = useState("none");
  const [authValue, setAuthValue] = useState("");
  const [authHeaderName, setAuthHeaderName] = useState("X-API-Key");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Results state
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RealStressTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<"overview" | "requests" | "errors">("overview");

  const handleRun = useCallback(async () => {
    if (!url.trim()) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const hdrs: Record<string, string> = {};
      headers.forEach(h => { if (h.key.trim()) hdrs[h.key.trim()] = h.value; });
      const res = await runRealStressTest({
        url, method, num_requests: numRequests, concurrency, timeout_seconds: timeout,
        headers: hdrs,
        body: ["POST", "PUT", "PATCH"].includes(method) && body ? body : null,
        auth_type: authType, auth_value: authValue, auth_header_name: authHeaderName,
      });
      setResult(res);
    } catch (e) { setError(e instanceof Error ? e.message : "Stress test failed"); }
    finally { setIsRunning(false); }
  }, [url, method, numRequests, concurrency, timeout, body, headers, authType, authValue, authHeaderName]);

  const addHeader = () => setHeaders(h => [...h, { key: "", value: "" }]);
  const removeHeader = (i: number) => setHeaders(h => h.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: "key" | "value", val: string) =>
    setHeaders(h => h.map((p, idx) => idx === i ? { ...p, [field]: val } : p));

  const verdictConfig: Record<string, { color: string; label: string }> = {
    PASS: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "PASS — System Stable" },
    DEGRADED: { color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "DEGRADED — Performance Risk" },
    FAIL: { color: "text-red-400 bg-red-500/10 border-red-500/20", label: "FAIL — Errors Detected" },
    CRASH: { color: "text-rose-400 bg-rose-500/10 border-rose-500/20", label: "CRASH — Endpoint Down" },
  };

  const VerdictIcon = ({ v }: { v: string }) => {
    if (v === "PASS") return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
    if (v === "DEGRADED") return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
  };

  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent-bright"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          <span className="text-sm font-semibold text-text-primary">Real Stress Test</span>
          <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent-bright uppercase tracking-wider">Live HTTP</span>
        </div>
        <p className="text-xs text-text-muted mt-0.5">Send real concurrent HTTP requests to any endpoint and measure performance</p>
      </div>

      {/* Config */}
      <div className="shrink-0 border-b border-border px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
        {/* URL + Method */}
        <div className="flex gap-2">
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="shrink-0 w-24 rounded-lg border border-border bg-zinc-900 px-2 py-2 text-xs font-semibold text-text-primary focus:border-accent/50 focus:outline-none cursor-pointer">
            {["GET", "POST", "PUT", "DELETE", "PATCH"].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.example.com/endpoint"
            className="flex-1 rounded-lg border border-border bg-zinc-900 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/40 focus:border-accent/50 focus:outline-none font-mono" />
        </div>

        {/* Sliders: Requests + Concurrency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Total Requests</label>
              <span className="text-sm font-bold text-accent-bright font-mono">{numRequests}</span>
            </div>
            <input type="range" min={1} max={1000} value={numRequests} onChange={e => setNumRequests(+e.target.value)}
              className="w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer accent-accent" />
            <div className="flex justify-between text-[9px] text-text-muted mt-0.5"><span>1</span><span>250</span><span>500</span><span>750</span><span>1000</span></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Concurrency</label>
              <span className="text-sm font-bold text-accent-bright font-mono">{concurrency}</span>
            </div>
            <input type="range" min={1} max={100} value={concurrency} onChange={e => setConcurrency(+e.target.value)}
              className="w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer accent-accent" />
            <div className="flex justify-between text-[9px] text-text-muted mt-0.5"><span>1</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
          </div>
        </div>

        {/* Advanced toggle */}
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors cursor-pointer">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}><path d="M9 18l6-6-6-6" /></svg>
          Advanced Configuration
        </button>

        {showAdvanced && (
          <div className="space-y-3 pl-3 border-l-2 border-border">
            {/* Timeout */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Timeout (sec)</label>
                <span className="text-xs font-bold text-text-primary font-mono">{timeout}s</span>
              </div>
              <input type="range" min={1} max={60} value={timeout} onChange={e => setTimeout_(+e.target.value)}
                className="w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer accent-accent" />
            </div>

            {/* Body (for POST/PUT/PATCH) */}
            {["POST", "PUT", "PATCH"].includes(method) && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-1">Request Body</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder='{"key": "value"}'
                  className="w-full rounded-lg border border-border bg-zinc-900 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/40 focus:border-accent/50 focus:outline-none font-mono resize-none" />
              </div>
            )}

            {/* Headers */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Headers</label>
                <button onClick={addHeader} className="text-[10px] text-accent-bright hover:text-accent transition-colors cursor-pointer">+ Add</button>
              </div>
              {headers.map((h, i) => (
                <div key={i} className="flex gap-1.5 mb-1.5">
                  <input value={h.key} onChange={e => updateHeader(i, "key", e.target.value)} placeholder="Key"
                    className="flex-1 rounded border border-border bg-zinc-900 px-2 py-1 text-[10px] text-text-primary font-mono focus:border-accent/50 focus:outline-none" />
                  <input value={h.value} onChange={e => updateHeader(i, "value", e.target.value)} placeholder="Value"
                    className="flex-1 rounded border border-border bg-zinc-900 px-2 py-1 text-[10px] text-text-primary font-mono focus:border-accent/50 focus:outline-none" />
                  <button onClick={() => removeHeader(i)} className="text-red-400 hover:text-red-300 text-xs px-1 cursor-pointer">✕</button>
                </div>
              ))}
            </div>

            {/* Auth */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-1">Authentication</label>
              <select value={authType} onChange={e => setAuthType(e.target.value)}
                className="w-full rounded-lg border border-border bg-zinc-900 px-2 py-1.5 text-xs text-text-primary focus:border-accent/50 focus:outline-none cursor-pointer mb-1.5">
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth (user:pass)</option>
                <option value="api_key">API Key Header</option>
              </select>
              {authType !== "none" && (
                <div className="space-y-1.5">
                  <input value={authValue} onChange={e => setAuthValue(e.target.value)}
                    placeholder={authType === "basic" ? "username:password" : authType === "bearer" ? "token..." : "key value..."}
                    className="w-full rounded border border-border bg-zinc-900 px-2 py-1.5 text-[10px] text-text-primary font-mono focus:border-accent/50 focus:outline-none" />
                  {authType === "api_key" && (
                    <input value={authHeaderName} onChange={e => setAuthHeaderName(e.target.value)} placeholder="X-API-Key"
                      className="w-full rounded border border-border bg-zinc-900 px-2 py-1.5 text-[10px] text-text-primary font-mono focus:border-accent/50 focus:outline-none" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Run button */}
        <button onClick={handleRun} disabled={isRunning || !url.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent/15 px-4 py-2.5 text-xs font-semibold text-accent-bright hover:bg-accent/25 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          {isRunning ? (
            <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" /></svg>
              Sending {numRequests} requests @ {concurrency} concurrency...</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              Run Stress Test</>
          )}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error && <div className="mb-3 rounded-lg bg-danger/10 px-4 py-2 text-xs text-danger">{error}</div>}

        {result ? (
          <div className="space-y-4 animate-fade-in-up">
            {/* Verdict */}
            <div className={`rounded-xl border px-4 py-3 ${verdictConfig[result.verdict]?.color || verdictConfig.FAIL.color}`}>
              <div className="flex items-center gap-2"><VerdictIcon v={result.verdict} /><span className="text-sm font-bold">{verdictConfig[result.verdict]?.label}</span></div>
              <p className="text-xs mt-1.5 opacity-80">{result.summary}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Success Rate", value: `${result.success_rate}%`, color: result.success_rate >= 95 ? "text-emerald-400" : result.success_rate >= 80 ? "text-amber-400" : "text-red-400" },
                { label: "Throughput", value: `${result.throughput_rps}`, color: "text-blue-400", sub: "req/s" },
                { label: "Avg Latency", value: `${result.latency_avg.toFixed(0)}`, color: "text-purple-400", sub: "ms" },
                { label: "Total Time", value: `${(result.total_time_ms / 1000).toFixed(1)}`, color: "text-text-primary", sub: "sec" },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border bg-surface px-2.5 py-2 text-center">
                  <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}{s.sub && <span className="text-[9px] ml-0.5 opacity-60">{s.sub}</span>}</div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Detailed stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Requests", value: `${result.successful}/${result.total_requests}` },
                { label: "Data Transferred", value: formatBytes(result.total_data_bytes) },
                { label: "Concurrency", value: `${result.concurrency} threads` },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-center">
                  <div className="text-xs font-bold font-mono text-text-primary">{s.value}</div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tabs for detailed views */}
            <div className="flex gap-1 border-b border-border">
              {(["overview", "requests", "errors"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveResultTab(tab)}
                  className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                    activeResultTab === tab ? "text-accent-bright border-accent" : "text-text-muted border-transparent hover:text-text-primary"
                  }`}>{tab === "errors" ? `Errors (${result.failed})` : tab}</button>
              ))}
            </div>

            {/* Tab: Overview — Latency Percentiles */}
            {activeResultTab === "overview" && (
              <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Latency Distribution</span>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    { label: "Min", value: result.latency_min },
                    { label: "p50", value: result.latency_p50 },
                    { label: "p90", value: result.latency_p90 },
                    { label: "p95", value: result.latency_p95 },
                    { label: "p99", value: result.latency_p99 },
                    { label: "Max", value: result.latency_max },
                  ].map(p => {
                    const maxVal = result.latency_max || 1;
                    const pct = Math.min((p.value / maxVal) * 100, 100);
                    const barColor = p.value < 100 ? "bg-emerald-500" : p.value < 500 ? "bg-blue-500" : p.value < 2000 ? "bg-amber-500" : "bg-red-500";
                    return (
                      <div key={p.label} className="flex items-center gap-3">
                        <span className="w-8 text-[10px] font-mono font-semibold text-text-muted text-right">{p.label}</span>
                        <div className="flex-1 h-4 rounded bg-zinc-800/50 overflow-hidden relative">
                          <div className={`h-full rounded ${barColor} transition-all duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
                        </div>
                        <span className="w-16 text-right text-[10px] font-mono font-semibold text-text-primary">{p.value.toFixed(1)}ms</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab: Requests — Per-request table */}
            {activeResultTab === "requests" && (
              <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Per-Request Results</span>
                  <span className="text-[10px] text-text-muted font-mono">{result.results.length} requests</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border/30">
                  {result.results.slice(0, 100).map((r) => {
                    const statusColor = r.error_category === "none" ? "text-emerald-400" : r.error_category === "4xx" ? "text-amber-400" : "text-red-400";
                    return (
                      <div key={r.request_id} className="flex items-center gap-3 px-4 py-1.5 hover:bg-white/[0.02] transition-colors text-[10px]">
                        <span className="w-8 text-text-muted font-mono">#{r.request_id + 1}</span>
                        <span className={`w-10 font-mono font-semibold ${statusColor}`}>{r.status_code ?? "ERR"}</span>
                        <span className="w-16 text-right font-mono text-text-primary">{r.latency_ms.toFixed(1)}ms</span>
                        <span className="w-14 text-right font-mono text-text-muted">{formatBytes(r.response_size_bytes)}</span>
                        <span className="flex-1 truncate text-text-muted">{r.error || "OK"}</span>
                      </div>
                    );
                  })}
                  {result.results.length > 100 && (
                    <div className="px-4 py-2 text-center text-[10px] text-text-muted">+{result.results.length - 100} more requests</div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Errors */}
            {activeResultTab === "errors" && (
              <div className="space-y-3">
                {Object.keys(result.error_counts).length > 0 ? (
                  <>
                    <div className="rounded-lg border border-border bg-surface overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border/50">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Error Breakdown</span>
                      </div>
                      <div className="p-4 space-y-2">
                        {Object.entries(result.error_counts).map(([cat, count]) => {
                          const catConfig: Record<string, { color: string; label: string }> = {
                            "5xx": { color: "text-red-400 bg-red-500/10 border-red-500/20", label: "Internal Server Error (5xx)" },
                            "4xx": { color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Client Error (4xx)" },
                            "timeout": { color: "text-orange-400 bg-orange-500/10 border-orange-500/20", label: "Timeout" },
                            "connection": { color: "text-rose-400 bg-rose-500/10 border-rose-500/20", label: "Connection Failed" },
                            "crash": { color: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20", label: "Crash / Unexpected" },
                          };
                          const cfg = catConfig[cat] || catConfig.crash;
                          return (
                            <div key={cat} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${cfg.color}`}>
                              <span className="text-xs font-medium">{cfg.label}</span>
                              <span className="text-sm font-bold font-mono">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Failed requests detail */}
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-2">Failed Request Details</div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {result.results.filter(r => r.error_category !== "none").slice(0, 20).map((r, i) => (
                          <p key={i} className="text-[10px] text-red-300/80 leading-relaxed font-mono">
                            #{r.request_id + 1} — [{r.error_category}] {r.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    <p className="text-xs text-emerald-400 font-semibold">No Errors</p>
                    <p className="text-[10px] text-text-muted">All {result.total_requests} requests completed successfully</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-muted/30"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            <div className="text-center max-w-xs">
              <p className="text-sm text-text-muted">Test any endpoint under load</p>
              <p className="mt-1 text-xs text-text-muted/60">Enter a URL, configure concurrency, and send real HTTP requests to measure latency, throughput, and error rates.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
