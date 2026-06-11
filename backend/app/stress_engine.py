"""
stress_engine.py — Real HTTP Stress Test Engine

Uses Python asyncio + aiohttp to fire concurrent HTTP requests
against a user-specified endpoint and collect real performance metrics.

Key stats collected:
- Per-request: latency, status code, response size, error type
- Aggregate: percentiles (p50/p90/p95/p99), throughput, error breakdown
- Verdict: PASS / DEGRADED / FAIL / CRASH
"""

import asyncio
import time
import logging
import statistics
from dataclasses import dataclass, field
from enum import Enum

import aiohttp

logger = logging.getLogger("cognicode.stress")


# ── Types ────────────────────────────────────────────────────────────────


class ErrorCategory(str, Enum):
    NONE = "none"
    CLIENT_ERROR = "4xx"
    SERVER_ERROR = "5xx"
    TIMEOUT = "timeout"
    CONNECTION = "connection"
    CRASH = "crash"


@dataclass
class RequestResult:
    """Metrics for a single HTTP request."""
    request_id: int
    status_code: int | None = None
    latency_ms: float = 0.0
    response_size_bytes: int = 0
    error: str | None = None
    error_category: str = "none"


@dataclass
class StressTestConfig:
    """Configuration for a stress test run."""
    url: str
    method: str = "GET"
    headers: dict[str, str] = field(default_factory=dict)
    body: str | None = None
    auth_type: str = "none"       # none, bearer, basic, api_key
    auth_value: str = ""          # token, user:pass, key value
    auth_header_name: str = ""    # for api_key type
    num_requests: int = 50
    concurrency: int = 10
    timeout_seconds: float = 10.0


@dataclass
class StressTestResult:
    """Full results from a stress test run."""
    # Verdict
    verdict: str                  # PASS, DEGRADED, FAIL, CRASH
    summary: str

    # Counts
    total_requests: int
    successful: int
    failed: int
    success_rate: float           # 0-100

    # Latency (ms)
    latency_min: float
    latency_avg: float
    latency_p50: float
    latency_p90: float
    latency_p95: float
    latency_p99: float
    latency_max: float

    # Throughput
    throughput_rps: float         # requests per second
    total_time_ms: float          # wall-clock time
    total_data_bytes: int         # total response bytes

    # Error breakdown
    error_counts: dict[str, int]  # category → count

    # Per-request results
    results: list[RequestResult]

    # Config echo
    target_url: str
    method: str
    concurrency: int


# ── Engine ───────────────────────────────────────────────────────────────


def _build_auth_headers(config: StressTestConfig) -> dict[str, str]:
    """Build auth headers from config."""
    headers = dict(config.headers)

    if config.auth_type == "bearer" and config.auth_value:
        headers["Authorization"] = f"Bearer {config.auth_value}"
    elif config.auth_type == "basic" and config.auth_value:
        import base64
        encoded = base64.b64encode(config.auth_value.encode()).decode()
        headers["Authorization"] = f"Basic {encoded}"
    elif config.auth_type == "api_key" and config.auth_value:
        header_name = config.auth_header_name or "X-API-Key"
        headers[header_name] = config.auth_value

    return headers


async def _send_request(
    session: aiohttp.ClientSession,
    config: StressTestConfig,
    request_id: int,
    semaphore: asyncio.Semaphore,
    headers: dict[str, str],
) -> RequestResult:
    """Send a single HTTP request and capture metrics."""
    result = RequestResult(request_id=request_id)

    async with semaphore:
        t0 = time.perf_counter()
        try:
            timeout = aiohttp.ClientTimeout(total=config.timeout_seconds)

            method = config.method.upper()
            kwargs: dict = {
                "url": config.url,
                "headers": headers,
                "timeout": timeout,
                "ssl": False,  # skip SSL verification for testing
            }

            # Add body for methods that support it
            if method in ("POST", "PUT", "PATCH") and config.body:
                # Try to detect if body is JSON
                content_type = headers.get("Content-Type", headers.get("content-type", ""))
                if "json" in content_type.lower() or config.body.strip().startswith(("{", "[")):
                    kwargs["data"] = config.body
                    if "Content-Type" not in headers and "content-type" not in headers:
                        kwargs["headers"] = {**headers, "Content-Type": "application/json"}
                else:
                    kwargs["data"] = config.body

            async with session.request(method, **kwargs) as response:
                body = await response.read()
                t1 = time.perf_counter()

                result.status_code = response.status
                result.latency_ms = round((t1 - t0) * 1000, 2)
                result.response_size_bytes = len(body)

                if 200 <= response.status < 300:
                    result.error_category = "none"
                elif 400 <= response.status < 500:
                    result.error = f"HTTP {response.status}"
                    result.error_category = "4xx"
                elif 500 <= response.status < 600:
                    result.error = f"HTTP {response.status}"
                    result.error_category = "5xx"
                else:
                    result.error = f"HTTP {response.status}"
                    result.error_category = "crash"

        except asyncio.TimeoutError:
            t1 = time.perf_counter()
            result.latency_ms = round((t1 - t0) * 1000, 2)
            result.error = "Request timed out"
            result.error_category = "timeout"

        except aiohttp.ClientConnectorError as e:
            t1 = time.perf_counter()
            result.latency_ms = round((t1 - t0) * 1000, 2)
            result.error = f"Connection failed: {str(e)[:100]}"
            result.error_category = "connection"

        except aiohttp.ClientError as e:
            t1 = time.perf_counter()
            result.latency_ms = round((t1 - t0) * 1000, 2)
            result.error = f"Client error: {str(e)[:100]}"
            result.error_category = "crash"

        except Exception as e:
            t1 = time.perf_counter()
            result.latency_ms = round((t1 - t0) * 1000, 2)
            result.error = f"Unexpected: {str(e)[:100]}"
            result.error_category = "crash"

    return result


def _compute_percentile(sorted_values: list[float], pct: float) -> float:
    """Compute a percentile from a sorted list."""
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * (pct / 100.0)
    f = int(k)
    c = f + 1
    if c >= len(sorted_values):
        return sorted_values[-1]
    d = k - f
    return round(sorted_values[f] + d * (sorted_values[c] - sorted_values[f]), 2)


def _determine_verdict(
    success_rate: float,
    p95: float,
    error_counts: dict[str, int],
    total: int,
) -> tuple[str, str]:
    """Determine test verdict and summary."""
    connection_errors = error_counts.get("connection", 0)
    server_errors = error_counts.get("5xx", 0)
    crash_errors = error_counts.get("crash", 0)
    timeout_errors = error_counts.get("timeout", 0)

    total_hard_failures = connection_errors + crash_errors

    # CRASH — catastrophic failure
    if total_hard_failures > total * 0.5 or (total > 0 and success_rate == 0):
        summary = (
            f"CRASH — {total_hard_failures} out of {total} requests experienced hard failures "
            f"(connection errors, crashes). The target endpoint appears to be down or unreachable."
        )
        return "CRASH", summary

    # FAIL — significant errors or very high latency
    failure_rate = 100 - success_rate
    if failure_rate > 5 or p95 > 2000:
        issues = []
        if server_errors > 0:
            issues.append(f"{server_errors} internal server errors (5xx)")
        if timeout_errors > 0:
            issues.append(f"{timeout_errors} timeouts")
        if connection_errors > 0:
            issues.append(f"{connection_errors} connection errors")
        if crash_errors > 0:
            issues.append(f"{crash_errors} crashes")
        if p95 > 2000:
            issues.append(f"p95 latency {p95:.0f}ms exceeds 2000ms threshold")

        summary = f"FAIL — {'; '.join(issues)}. The endpoint cannot reliably handle this load."
        return "FAIL", summary

    # DEGRADED — some issues but mostly works
    if failure_rate > 0 or p95 > 500:
        issues = []
        if failure_rate > 0:
            issues.append(f"{failure_rate:.1f}% failure rate")
        if p95 > 500:
            issues.append(f"p95 latency {p95:.0f}ms is elevated")
        if timeout_errors > 0:
            issues.append(f"{timeout_errors} timeouts")

        summary = f"DEGRADED — {'; '.join(issues)}. Performance is degraded under this load."
        return "DEGRADED", summary

    # PASS
    summary = (
        f"PASS — All {total} requests succeeded with p95 latency of {p95:.0f}ms. "
        f"The endpoint handles this load level reliably."
    )
    return "PASS", summary


async def run_stress_test(config: StressTestConfig) -> StressTestResult:
    """
    Execute a real HTTP stress test.

    Spawns `config.num_requests` async tasks, limited by `config.concurrency`
    via a semaphore. Collects per-request metrics and aggregates them.
    """
    logger.info(
        f"⚡ Starting stress test: {config.num_requests} requests @ "
        f"{config.concurrency} concurrency → {config.method} {config.url}"
    )

    # Build auth headers once
    headers = _build_auth_headers(config)

    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(config.concurrency)

    # Create connector with connection limit
    connector = aiohttp.TCPConnector(
        limit=config.concurrency,
        limit_per_host=config.concurrency,
        enable_cleanup_closed=True,
    )

    wall_start = time.perf_counter()

    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [
            _send_request(session, config, i, semaphore, headers)
            for i in range(config.num_requests)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=False)

    wall_end = time.perf_counter()
    total_time_ms = round((wall_end - wall_start) * 1000, 2)

    # ── Aggregate metrics ────────────────────────────────────────────

    successful = sum(1 for r in results if r.error_category == "none")
    failed = len(results) - successful
    success_rate = round((successful / max(len(results), 1)) * 100, 1)

    # Latency stats (all requests, including failed ones that had latency)
    all_latencies = sorted([r.latency_ms for r in results if r.latency_ms > 0])
    success_latencies = sorted([r.latency_ms for r in results if r.error_category == "none"])

    # Use success latencies for percentiles if available, otherwise all
    lat_source = success_latencies if success_latencies else all_latencies

    latency_min = round(min(lat_source), 2) if lat_source else 0.0
    latency_avg = round(statistics.mean(lat_source), 2) if lat_source else 0.0
    latency_max = round(max(lat_source), 2) if lat_source else 0.0
    latency_p50 = _compute_percentile(lat_source, 50)
    latency_p90 = _compute_percentile(lat_source, 90)
    latency_p95 = _compute_percentile(lat_source, 95)
    latency_p99 = _compute_percentile(lat_source, 99)

    # Throughput
    throughput_rps = round(len(results) / max(total_time_ms / 1000, 0.001), 2)

    # Data transferred
    total_data = sum(r.response_size_bytes for r in results)

    # Error breakdown
    error_counts: dict[str, int] = {}
    for r in results:
        if r.error_category != "none":
            error_counts[r.error_category] = error_counts.get(r.error_category, 0) + 1

    # Verdict
    verdict, summary = _determine_verdict(
        success_rate, latency_p95, error_counts, len(results)
    )

    logger.info(
        f"⚡ Stress test complete: {verdict} — {successful}/{len(results)} succeeded, "
        f"p95={latency_p95:.0f}ms, {throughput_rps:.1f} req/s in {total_time_ms:.0f}ms"
    )

    return StressTestResult(
        verdict=verdict,
        summary=summary,
        total_requests=len(results),
        successful=successful,
        failed=failed,
        success_rate=success_rate,
        latency_min=latency_min,
        latency_avg=latency_avg,
        latency_p50=latency_p50,
        latency_p90=latency_p90,
        latency_p95=latency_p95,
        latency_p99=latency_p99,
        latency_max=latency_max,
        throughput_rps=throughput_rps,
        total_time_ms=total_time_ms,
        total_data_bytes=total_data,
        error_counts=error_counts,
        results=results,
        target_url=config.url,
        method=config.method.upper(),
        concurrency=config.concurrency,
    )
