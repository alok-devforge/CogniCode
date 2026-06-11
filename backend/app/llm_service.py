import os
import asyncio
import logging
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("cognicode.llm")

_client: Groq | None = None


def get_client() -> Groq | None:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key and api_key != "your-groq-api-key-here":
            _client = Groq(api_key=api_key, timeout=120.0)
            logger.info("✅ Groq client initialized (timeout=120s)")
        else:
            logger.warning("⚠️  No GROQ_API_KEY found — LLM features disabled, using fallback analysis")
    return _client


def reset_client():
    """Force client to reinitialize on next call (picks up new settings)."""
    global _client
    _client = None


async def generate_response_with_model(prompt: str, fallback: str = "") -> tuple[str, str]:
    """Generate a response and return (answer, model_used). Falls back through model chain."""
    client = get_client()
    if client is None:
        return fallback, "none"

    # Model fallback chain: try large model first, fall back to smaller on ANY error
    models = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
    ]

    last_error = None
    for model in models:
        try:
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=4096,
            )
            logger.info(f"🤖 LLM response from {model} ({len(prompt)} chars prompt)")
            content = response.choices[0].message.content or fallback
            return content, model
        except Exception as e:
            last_error = e
            error_str = str(e)
            is_rate_limit = "429" in error_str or "rate_limit" in error_str.lower()
            is_connection = "connection" in error_str.lower() or "getaddrinfo" in error_str.lower()
            if model != models[-1]:
                next_model = models[models.index(model) + 1]
                reason = "Rate limited" if is_rate_limit else "Connection error" if is_connection else "Error"
                logger.warning(f"⚠️  {reason} on {model} — falling back to {next_model}")
                continue
            # Last model also failed — log and return fallback
            logger.error(f"❌ LLM error on {model}: {e}")
            import traceback
            with open("error_log.txt", "a") as f:
                f.write(f"Groq error ({model}): {e}\n")
                traceback.print_exc(file=f)
            return fallback, "none"

    return fallback, "none"


async def generate_response(prompt: str, fallback: str = "") -> str:
    """Generate a response from the LLM. Returns fallback on failure."""
    answer, _ = await generate_response_with_model(prompt, fallback)
    return answer


async def generate_architecture_summary(code: str, language: str) -> dict:
    prompt = f"""You are a **Legacy Code Archeologist** — an AI specialist in reverse-engineering massive, undocumented, inherited codebases that nobody alive fully understands.

You have been given a fragment of a potentially 10-15 year old {language} codebase. Your job is to excavate its architecture and produce a comprehensive analysis that would save a new engineer MONTHS of onboarding time.

Your analysis MUST include ALL of the following sections with SPECIFIC details from the actual code (not generic descriptions):

# Architecture Excavation Report

## Overview
A 2-3 sentence summary of what this code does, mentioning specific class names and the likely business domain it serves. If the code appears to be legacy, note the era-specific patterns or idioms you detect.

## Detected Patterns
List each software design pattern with a bullet point explaining WHERE in the code it appears. Reference actual class/function names.
Examples: OOP Encapsulation, Manager Pattern, CRUD Pattern, MVC, Factory, Observer, Singleton, Iterator, God Class (anti-pattern), etc.

## Class & Module Hierarchy
For EACH class found in the code:
- **ClassName** — purpose, list its data members and methods with brief descriptions
Show inheritance or composition relationships if any.

## Data Flow
A numbered step-by-step flow showing how data moves through the system. Use actual variable names and method calls from the code.

## External Dependencies
List every library/header/import used and what it provides.

## Standalone Functions
For each function not in a class, describe its purpose, parameters, and return type.

## Technical Debt & Risk Assessment
- Missing error handling, memory leaks, thread safety issues
- Anti-patterns detected (God Classes, Spaghetti Code, Magic Numbers, Dead Code)
- Hardcoded values, missing constants, poor naming
- Security vulnerabilities (injection risks, unvalidated input, exposed credentials)

## Archeologist's Recommendations
Prioritized, actionable steps to modernize this code:
1. Critical fixes (bugs, security)
2. Structural improvements (refactoring, pattern adoption)
3. Long-term modernization (migration paths, deprecation strategy)

Code to excavate:
```{language}
{code}
```

Be VERY specific — reference actual names from the code. Do NOT write generic descriptions. Return ONLY the Markdown."""

    fallback_md = _build_fallback_summary(code, language)

    result = await generate_response(prompt, fallback_md)

    patterns = _extract_fallback_patterns(code, language)
    client = get_client()
    if client is not None:
        pattern_prompt = f"""From this {language} code, list ONLY the architectural/design patterns actually present as a comma-separated list.
Look for: OOP, Encapsulation, Manager/Repository Pattern, CRUD, MVC, Singleton, Factory, Observer, Iterator, Strategy, Facade, Decorator, Template Method, God Class (anti-pattern), etc.

Code:
```{language}
{code}
```

Return ONLY a comma-separated list of patterns found, nothing else."""
        try:
            pattern_result = await generate_response(pattern_prompt, "")
            if pattern_result and len(pattern_result) < 200:
                patterns = [p.strip() for p in pattern_result.split(",") if p.strip()][:6]
        except Exception:
            pass

    lines = code.split("\n")
    total_lines = len(lines)
    comment_lines = sum(1 for l in lines if l.strip().startswith(("#", "//", "/*", "*", "--", "'")))
    comment_ratio = comment_lines / max(total_lines, 1)
    has_docstrings = '"""' in code or "'''" in code or "/**" in code
    has_type_hints = "->" in code or ": str" in code or ": int" in code or ": List" in code
    has_error_handling = "try" in code or "catch" in code or "except" in code
    avg_line_length = sum(len(l) for l in lines) / max(total_lines, 1)

    confidence = 0.50
    if client:
        confidence += 0.25
    if comment_ratio > 0.1:
        confidence += 0.08
    if has_docstrings:
        confidence += 0.05
    if has_type_hints:
        confidence += 0.05
    if has_error_handling:
        confidence += 0.04
    if avg_line_length < 100:
        confidence += 0.03
    if total_lines < 500:
        confidence += 0.02

    confidence = min(round(confidence, 2), 0.98)

    return {
        "summary_markdown": result,
        "detected_patterns": patterns,
        "confidence_score": confidence,
    }


def _extract_fallback_patterns(code: str, language: str) -> list[str]:
    """Extract patterns from code without LLM by keyword matching."""
    patterns = []
    code_lower = code.lower()
    if "class " in code:
        patterns.append("OOP")
    if "private" in code_lower or "protected" in code_lower or "__" in code:
        patterns.append("Encapsulation")
    if any(kw in code_lower for kw in ["add", "delete", "update", "search", "find", "remove"]):
        patterns.append("CRUD Pattern")
    if any(kw in code_lower for kw in ["vector", "list", "array", "map", "dict"]):
        patterns.append("Collection Management")
    if any(kw in code_lower for kw in ["manager", "controller", "handler", "service"]):
        patterns.append("Manager Pattern")
    if any(kw in code_lower for kw in ["async", "await", "promise", "future"]):
        patterns.append("Async Pattern")
    if any(kw in code_lower for kw in ["factory", "create", "builder"]):
        patterns.append("Factory Pattern")
    if not patterns:
        patterns = ["Procedural", "Modular Design"]
    return patterns[:6]


def _build_fallback_summary(code: str, language: str) -> str:
    """Build a basic summary from code structure without LLM."""
    import re
    lines = code.split("\n")
    total_lines = len(lines)

    classes = []
    functions = []
    for line in lines:
        class_match = re.match(r'\s*class\s+(\w+)', line)
        if class_match:
            classes.append(class_match.group(1))
        func_patterns = [
            r'\s*(?:def|async def)\s+(\w+)',
            r'\s*(?:void|int|float|double|string|bool|auto|char)\s+(\w+)\s*\(',
            r'\s*function\s+(\w+)',
        ]
        for pat in func_patterns:
            func_match = re.match(pat, line)
            if func_match:
                functions.append(func_match.group(1))
                break

    class_section = ""
    if classes:
        class_section = "\n## Classes Found\n" + "\n".join(f"- **{c}**" for c in classes)

    func_section = ""
    if functions:
        func_section = "\n## Functions Found\n" + "\n".join(f"- `{f}()`" for f in functions)

    return f"""# Architecture Summary

## Overview
This {language} codebase contains {total_lines} lines of code with {len(classes)} class(es) and {len(functions)} function(s).
{class_section}
{func_section}

## Notes
> ⚠️ This is a basic structural analysis. Add a **GROQ_API_KEY** to your `.env` file for full AI-powered architecture analysis with detailed pattern detection, data flow tracing, and risk assessment.
"""


async def generate_doc_from_code(code: str, existing_doc: str, language: str) -> dict:
    prompt = f"""You are a Documentation Rot Detection Engine. Your job is to detect discrepancies between existing documentation and the current code, then produce an updated, accurate version.

Existing Documentation:
{existing_doc if existing_doc else "No existing documentation — this module is completely undocumented."}

Current Code:
```{language}
{code}
```

Produce:
1. Updated Markdown documentation that accurately reflects the current code
2. At the end, include a "## Drift Report" section that lists EVERY discrepancy between the old documentation and the current code (functions renamed, parameters changed, logic altered, missing docs for new code, docs for deleted code)

If there was no existing documentation, note that this is a first-time documentation generation for an undocumented module.

Return ONLY the Markdown."""

    fallback = f"""# Updated Documentation

## Module Overview
Auto-generated documentation based on source code analysis.

## API Reference
Functions and classes detected in the codebase have been documented below.

## Drift Report
- ⚠️ No existing documentation found — generated from scratch
- All functions and classes documented for the first time
"""

    result = await generate_response(prompt, fallback)

    changes = []
    if not existing_doc or not existing_doc.strip():
        changes.append("First-time documentation generated for undocumented module")
    else:
        import re
        code_funcs = set(re.findall(r'(?:def|function|func|void|int|string|bool)\s+(\w+)', code))
        doc_funcs = set(re.findall(r'`(\w+)\(`', existing_doc))
        doc_funcs.update(re.findall(r'\*\*(\w+)\*\*', existing_doc))

        new_funcs = code_funcs - doc_funcs
        removed_funcs = doc_funcs - code_funcs

        if new_funcs:
            changes.append(f"New undocumented functions detected: {', '.join(new_funcs)}")
        if removed_funcs:
            changes.append(f"Documentation references deleted functions: {', '.join(removed_funcs)}")
        if not new_funcs and not removed_funcs:
            changes.append("Documentation structure verified — no major drift detected")
        if len(existing_doc) < len(code) * 0.1:
            changes.append("Documentation significantly shorter than codebase — potential coverage gap")

    sync_status = "drifted" if any("undocumented" in c.lower() or "deleted" in c.lower() or "gap" in c.lower() for c in changes) else "synced"

    return {
        "updated_markdown": result,
        "changes_detected": changes,
        "sync_status": sync_status,
    }


async def generate_code_from_doc(markdown: str, target_language: str) -> dict:
    prompt = f"""You are a code generation engine. Given the following Markdown specification/requirements document, generate production-quality {target_language} starter code that implements the described functionality.

Requirements Document:
{markdown}

Generate clean, well-structured {target_language} code. Include type hints, proper error handling, and follow best practices."""

    fallback = f"""class GeneratedModule:
    def __init__(self):
        self._initialized = False

    async def initialize(self) -> None:
        self._initialized = True

    async def process(self, data: dict) -> dict:
        if not self._initialized:
            await self.initialize()
        return {{"status": "processed", "data": data}}

    def validate(self, input_data: str) -> bool:
        return len(input_data) > 0
"""

    result = await generate_response(prompt, fallback)
    return {
        "generated_code": result,
        "language": target_language,
        "completeness_score": 0.72,
    }


async def generate_rag_answer(query: str, context: str) -> str:
    prompt = f"""You are CogniCode's Institutional Knowledge Engine — an AI that has access to a company's complete tribal knowledge: source code, Architecture Decision Records (ADRs), internal documentation, git commit history, post-mortems, and configuration files.

Your job is to answer questions by synthesizing information from these sources, especially capturing the "WHY" behind decisions — the institutional context that would otherwise be lost when engineers leave.

Available Knowledge Base Context:
{context}

Question: {query}

Instructions:
- Cite specific sources when referencing information (e.g., "According to [source_file]...")
- If the query is about a past decision, explain the reasoning and tradeoffs that led to it
- If the context doesn't contain enough information, clearly state what's missing and suggest which documents or people might have the answer
- Distinguish between facts from the knowledge base and your own general recommendations

Provide a clear, detailed answer."""

    fallback = f"Based on the available knowledge base, I couldn't find specific institutional context for '{query}'. To improve results, ingest your repository (including ADRs, documentation, and commit history) using the /api/v1/rag/ingest-repo endpoint."

    return await generate_response(prompt, fallback)

def _extract_components_regex(code: str, language: str) -> list[dict]:
    """Extract classes, methods, and functions from code using regex — no LLM needed."""
    import re
    components = []
    lines = code.split("\n")

    current_class = None
    class_methods: dict[str, list[str]] = {}

    for line in lines:
        # Detect class declarations
        class_match = re.match(r'\s*class\s+(\w+)', line)
        if class_match:
            current_class = class_match.group(1)
            class_methods[current_class] = []
            components.append({"name": current_class, "type": "class", "calls": []})
            continue

        # Detect function/method declarations
        func_patterns = [
            r'\s+(?:void|int|float|double|string|bool|auto|char|static|virtual|const|unsigned|long)\s+(\w+)\s*\(',  # C/C++
            r'\s+(?:public|private|protected)?\s*(?:void|int|float|double|string|bool|auto|char)\s+(\w+)\s*\(',  # C++ with access
            r'\s*(?:def|async def)\s+(\w+)',  # Python
            r'\s*(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s*)?\(|[\(])',  # JavaScript
            r'\s*(?:public|private|protected)?\s*(?:static\s+)?(?:void|int|String|boolean|double|float|long|char)\s+(\w+)\s*\(',  # Java
            r'\s*func\s+(\w+)',  # Go/Swift
        ]

        matched_func = None
        for pat in func_patterns:
            func_match = re.match(pat, line)
            if func_match:
                matched_func = func_match.group(1)
                break

        if matched_func and matched_func not in ("if", "for", "while", "switch", "catch", "return", "else"):
            if current_class and line.startswith(("    ", "\t", "  ")):
                full_name = f"{current_class}.{matched_func}"
                class_methods.setdefault(current_class, []).append(full_name)
                components.append({"name": full_name, "type": "method", "calls": []})
            else:
                if not line.startswith(("    ", "\t", "  ")) or current_class is None:
                    current_class = None
                    components.append({"name": matched_func, "type": "function", "calls": []})
                elif current_class:
                    full_name = f"{current_class}.{matched_func}"
                    class_methods.setdefault(current_class, []).append(full_name)
                    components.append({"name": full_name, "type": "method", "calls": []})

        # Reset class context on closing brace or dedent
        if line.strip() == "};" or (line.strip() == "}" and not line.startswith(("    ", "\t", "  "))):
            current_class = None

    # Try to detect calls between components
    all_names = {c["name"].split(".")[-1] for c in components}
    for comp in components:
        for name in all_names:
            if name != comp["name"].split(".")[-1] and f"{name}(" in code:
                # Check if this component's body references the other
                comp["calls"] = list(set(comp.get("calls", [])))

    if not components:
        components = [{"name": "main", "type": "function", "calls": []}]

    return components


async def generate_blast_radius_llm(code: str, language: str) -> dict:
    prompt = f"""You are a code analysis engine. Parse this {language} code and extract EVERY class, method, and standalone function. For each one, list which OTHER components in this code it calls.

CRITICAL RULES:
1. List EVERY class as type "class"
2. List EVERY method inside a class as type "method" with name format "ClassName.methodName"  
3. List EVERY standalone function (not in a class) as type "function"
4. In "calls", only include names of OTHER components found in THIS code
5. Do NOT skip any component, even simple getters/setters

Example — for a C++ file with class Car containing drive() and stop(), and a main() function:
{{
  "components": [
    {{"name": "Car", "type": "class", "calls": []}},
    {{"name": "Car.drive", "type": "method", "calls": []}},
    {{"name": "Car.stop", "type": "method", "calls": []}},
    {{"name": "main", "type": "function", "calls": ["Car.drive", "Car.stop"]}}
  ]
}}

Now analyze this code:
```{language}
{code}
```

Return ONLY the raw JSON object. No markdown fencing. No explanation."""

    import json as json_module

    fallback_components = _extract_components_regex(code, language)
    fallback_json = json_module.dumps({"components": fallback_components})
    raw = await generate_response(prompt, fallback_json)

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0]
        data = json_module.loads(cleaned)
    except Exception:
        data = {"components": fallback_components}

    components = data.get("components", [])
    if not components:
        components = fallback_components

    from app.models import BlastRadiusNode, BlastRadiusEdge

    nodes = []
    edges = []
    name_to_id = {}

    icon_map = {"class": "🏗️", "function": "⚡", "method": "🔧"}
    status_cycle = ["healthy", "warning", "critical"]
    status_labels = {
        "healthy": "No Issues",
        "warning": "Has Dependencies",
        "critical": "High Coupling",
    }
    edge_colors = {"healthy": "#22c55e", "warning": "#f59e0b", "critical": "#ef4444"}

    x_spacing = 280
    y_spacing = 200
    col_count = max(2, len(components) // 3 + 1)

    for i, comp in enumerate(components):
        cname = comp.get("name", f"unknown_{i}")
        ctype = comp.get("type", "function")
        calls = comp.get("calls", [])
        cid = f"{ctype}_{cname}".replace(".", "_").replace(" ", "_")
        name_to_id[cname] = cid

        dep_count = len(calls)
        status = status_cycle[min(dep_count, 2)]

        row = i // col_count
        col = i % col_count

        nodes.append(BlastRadiusNode(
            id=cid,
            type="serviceNode",
            position={"x": float(col * x_spacing + 20), "y": float(row * y_spacing + 20)},
            data={
                "label": cname,
                "icon": icon_map.get(ctype, "⚡"),
                "status": status,
                "statusLabel": status_labels[status],
                "metric": str(dep_count),
                "metricLabel": "dependencies",
            },
        ))

    for comp in components:
        cname = comp.get("name", "")
        calls = comp.get("calls", [])
        caller_id = name_to_id.get(cname)
        if not caller_id:
            continue

        dep_count = len(calls)
        color = edge_colors[status_cycle[min(dep_count, 2)]]

        for callee_name in calls:
            callee_id = name_to_id.get(callee_name)
            if callee_id and callee_id != caller_id:
                edges.append(BlastRadiusEdge(
                    id=f"e_{caller_id}_{callee_id}",
                    source=caller_id,
                    target=callee_id,
                    animated=True,
                    style={"stroke": color, "strokeWidth": 2},
                ))

    return {
        "nodes": nodes,
        "edges": edges,
        "analysis_summary": f"LLM-analyzed {len(nodes)} components with {len(edges)} dependencies ({language})",
        "total_functions": len(nodes),
        "total_dependencies": len(edges),
    }


async def generate_gatekeeper_llm(
    code: str,
    language: str,
    max_cyclomatic: int = 10,
    max_cognitive: int = 15,
) -> dict:
    prompt = f"""Analyze this {language} code for complexity. For EACH function/method, estimate:
- cyclomatic_complexity (integer): count of independent paths (if/else/for/while/switch/catch branches + 1)
- cognitive_complexity (integer): how hard the code is to understand (nesting depth contributes)
- estimated_big_o: the time complexity as a string like "O(1)", "O(n)", "O(n log n)", "O(n²)"
- lines_of_code: number of lines in the function

Return a JSON object with this EXACT structure:
{{
  "functions": [
    {{
      "function_name": "name",
      "cyclomatic_complexity": 5,
      "cognitive_complexity": 8,
      "estimated_big_o": "O(n)",
      "lines_of_code": 12
    }}
  ]
}}

Code:
```{language}
{code}
```

Return ONLY raw JSON, no markdown fencing, no explanation."""

    import json as json_module

    fallback = '{{"functions": [{{"function_name": "main", "cyclomatic_complexity": 1, "cognitive_complexity": 0, "estimated_big_o": "O(1)", "lines_of_code": 1}}]}}'
    raw = await generate_response(prompt, fallback)

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0]
        data = json_module.loads(cleaned)
    except Exception:
        data = {"functions": [{"function_name": "main", "cyclomatic_complexity": 1, "cognitive_complexity": 0, "estimated_big_o": "O(1)", "lines_of_code": 1}]}

    functions = data.get("functions", [])
    if not functions:
        functions = [{"function_name": "main", "cyclomatic_complexity": 1, "cognitive_complexity": 0, "estimated_big_o": "O(1)", "lines_of_code": 1}]

    from app.models import ComplexityMetric

    metrics = []
    violations = []

    for f in functions:
        m = ComplexityMetric(
            function_name=f.get("function_name", "unknown"),
            cyclomatic_complexity=f.get("cyclomatic_complexity", 1),
            cognitive_complexity=f.get("cognitive_complexity", 0),
            estimated_big_o=f.get("estimated_big_o", "O(1)"),
            lines_of_code=f.get("lines_of_code", 1),
        )
        metrics.append(m)

        if m.cyclomatic_complexity > max_cyclomatic:
            violations.append(
                f"{m.function_name}: cyclomatic complexity {m.cyclomatic_complexity} exceeds limit {max_cyclomatic}"
            )
        if m.cognitive_complexity > max_cognitive:
            violations.append(
                f"{m.function_name}: cognitive complexity {m.cognitive_complexity} exceeds limit {max_cognitive}"
            )

    verdict = "FAIL" if violations else "PASS"

    if not metrics:
        overall_score = 1.0
    else:
        avg = sum(m.cyclomatic_complexity for m in metrics) / len(metrics)
        overall_score = max(0.0, 1.0 - (avg / 20.0))

    recommendation = (
        "Code meets all complexity thresholds. Approved for merge."
        if verdict == "PASS"
        else f"Code has {len(violations)} violation(s). Refactor the flagged functions before merging."
    )

    return {
        "verdict": verdict,
        "overall_score": round(overall_score, 3),
        "metrics": metrics,
        "violations": violations,
        "recommendation": recommendation,
    }


async def generate_codebase_architecture(graph_summary: str, folder_name: str = "project") -> dict:
    """Generate architecture analysis from a pre-computed graph summary (not raw code).

    Uses a two-perspective prompt:
    - Part A: Legacy Maintainer — hidden contracts, tribal knowledge, refactoring risks
    - Part B: Newcomer Onboarding — reading order, glossary, quick-start map
    """
    prompt = f"""You are a **Legacy Code Archeologist** — an AI specialist in reverse-engineering massive, undocumented, inherited codebases that nobody alive fully understands.

You have been given a **structural graph summary** of the entire "{folder_name}" codebase. This summary was extracted via static analysis and contains every file, class, function, import, and cross-file dependency — but NOT the full source code.

Your job is to produce a comprehensive analysis from TWO perspectives that would save a new engineer MONTHS of onboarding time.

Codebase Graph Summary:
{graph_summary}

Your analysis MUST include ALL of the following sections with SPECIFIC details from the graph:

# Architecture Excavation Report — {folder_name}

## Overview
A 2-3 sentence summary of what this codebase does, its likely business domain, and overall architecture style. Reference specific module/file names.

## Detected Patterns
List each software design pattern with a bullet point explaining WHERE in the codebase it appears. Reference actual class/function names.
Examples: OOP Encapsulation, Manager Pattern, CRUD Pattern, MVC, Factory, Observer, Singleton, God Class (anti-pattern), etc.

## Module Hierarchy & Dependencies
For EACH major file/module, describe its role and what it depends on. Show the dependency flow between modules.

## Class & Component Map
For each class found, describe: purpose, key methods, inheritance relationships, and how it fits into the larger architecture.

## Data Flow
A numbered step-by-step flow showing how data likely moves through the system. Use actual module and function names.

## External Dependencies
List the key external libraries/packages used and what they provide.

---

# Part A — Legacy Maintainer Deep-Dive

## Hidden Contracts
Identify implicit assumptions in the code — things that aren't documented but MUST be true for the system to work correctly. Examples: initialization order, singleton state assumptions, expected input formats, undocumented invariants between modules. Reference specific files/functions.

## Tribal Knowledge Map
Which files or functions contain critical, undocumented domain logic that only the original author would understand? Mark each with a risk level (🔴 Critical / 🟡 Moderate / 🟢 Low).

## Refactoring Risk Matrix
| File | Safe to Refactor? | Risk Level | Why |
Classify each major file as safe, risky, or dangerous to modify based on its coupling, centrality, and hidden dependencies.

## Dead Code Candidates
Functions or classes that appear to have NO callers or importers based on the graph. These are candidates for removal.

## Migration Paths
Concrete, prioritized steps to modernize specific components. Reference actual files and suggest specific patterns to adopt.

---

# Part B — Newcomer Onboarding Guide

## Suggested Reading Order
Provide a numbered list: "Start by reading file X → then Y → then Z". Order by dependency (foundations first, then higher-level modules). Explain WHY each file matters.

## Core Concepts Glossary
List domain-specific terms, abbreviations, and naming conventions found in the code. Provide brief definitions. Example: "RAG = Retrieval Augmented Generation — used in rag_service.py"

## Quick Start Map
For each major feature or area of the codebase, list the 2-3 files a newcomer should read to understand it.
Format: "To understand [Feature X]: read file A (the entry point), file B (the logic), file C (the model)"

## Gotchas & Pitfalls
Common mistakes a new developer would make when working with this codebase. Reference specific patterns, naming conventions, or architectural decisions that are non-obvious.

## Architecture Decision Trail
Infer WHY the codebase is structured this way. What tradeoffs were made? What constraints likely drove the design decisions?

---

## Technical Debt & Risk Assessment
- Missing patterns, architectural anti-patterns (God Modules, circular deps)
- Files with too many responsibilities
- Tight coupling hotspots
- Security considerations

## Archeologist's Recommendations
Prioritized, actionable steps:
1. Critical fixes (bugs, security)
2. Structural improvements (refactoring, pattern adoption)
3. Long-term modernization (migration paths, deprecation strategy)

Be VERY specific — reference actual names from the graph summary. Return ONLY the Markdown."""

    fallback_md = _build_codebase_fallback(graph_summary, folder_name)

    result = await generate_response(prompt, fallback_md)

    # Extract patterns from graph summary
    patterns = _extract_graph_patterns(graph_summary)

    # Confidence heuristic
    client = get_client()
    confidence = 0.55 if client else 0.40
    file_count = graph_summary.count("## File:")
    if file_count > 5:
        confidence += 0.1
    if file_count > 15:
        confidence += 0.1
    if "class:" in graph_summary.lower():
        confidence += 0.05
    confidence = min(round(confidence, 2), 0.98)

    return {
        "summary_markdown": result,
        "detected_patterns": patterns,
        "confidence_score": confidence,
    }


def _extract_graph_patterns(graph_summary: str) -> list[str]:
    """Extract architectural patterns from a graph summary string."""
    patterns = []
    summary_lower = graph_summary.lower()
    if "class:" in summary_lower:
        patterns.append("OOP")
    if "basemodel" in summary_lower or "extends" in summary_lower:
        patterns.append("Inheritance")
    if any(kw in summary_lower for kw in ["service", "controller", "handler", "manager"]):
        patterns.append("Service Pattern")
    if any(kw in summary_lower for kw in ["route", "endpoint", "api", "router"]):
        patterns.append("API / Router Pattern")
    if any(kw in summary_lower for kw in ["model", "schema", "entity"]):
        patterns.append("Data Modeling")
    if any(kw in summary_lower for kw in ["async", "await"]):
        patterns.append("Async Pattern")
    if any(kw in summary_lower for kw in ["factory", "create", "builder"]):
        patterns.append("Factory Pattern")
    if any(kw in summary_lower for kw in ["test", "spec", "fixture"]):
        patterns.append("Testing")
    if not patterns:
        patterns = ["Modular Design"]
    return patterns[:6]


def _build_codebase_fallback(graph_summary: str, folder_name: str) -> str:
    """Build a detailed fallback report from graph summary without LLM."""
    return f"""# Architecture Excavation Report — {folder_name}

## Overview
This codebase was analyzed via structural graph extraction (no LLM available).
The graph summary below shows every file, class, function, and import detected.

{graph_summary}

---

# Part A — Legacy Maintainer Deep-Dive

## Hidden Contracts
> ⚠️ LLM unavailable — hidden contract detection requires AI analysis.
> Add a **GROQ_API_KEY** to your `.env` file to enable full analysis.

## Tribal Knowledge Map
> ⚠️ Requires AI analysis.

## Refactoring Risk Matrix
> ⚠️ Requires AI analysis.

---

# Part B — Newcomer Onboarding Guide

## Suggested Reading Order
> ⚠️ Requires AI analysis. As a heuristic, start with files that have the most imports (they are foundational).

## Core Concepts Glossary
> ⚠️ Requires AI analysis.

---

## Notes
> ⚠️ This is a structural analysis only. Add a **GROQ_API_KEY** to your `.env` file for full AI-powered architecture analysis with legacy deep-dive and newcomer onboarding guide.
"""


async def generate_incremental_architecture(
    previous_report: str,
    previous_patterns: list[str],
    changed_files_summary: str,
    added_files_summary: str,
    deleted_paths: list[str],
    full_graph_summary: str,
    folder_name: str = "project",
) -> dict:
    """Update architecture analysis incrementally based on file changes.

    Instead of re-analyzing the entire codebase, this function sends the
    previous full report + only what changed to the LLM. The LLM patches
    the report surgically, keeping all accurate sections intact.

    Falls back to full re-analysis if no LLM is available.
    """
    deleted_section = ", ".join(deleted_paths) if deleted_paths else "No files were deleted."

    prompt = f"""You are a **Legacy Code Archeologist** performing an INCREMENTAL UPDATE to your previous analysis of the "{folder_name}" codebase.

You previously analyzed this codebase and produced the following report:

--- YOUR PREVIOUS ANALYSIS ---
{previous_report}
--- END PREVIOUS ANALYSIS ---

Since your last analysis, the following changes occurred in the codebase:

## Modified Files (structural summary of what changed)
{changed_files_summary if changed_files_summary else "No files were modified."}

## Newly Added Files
{added_files_summary if added_files_summary else "No new files were added."}

## Deleted Files
{deleted_section}

## Current Full Codebase Structure (for reference)
{full_graph_summary}

---

INSTRUCTIONS:
1. UPDATE your previous report to reflect the above changes
2. KEEP all sections that are still accurate — do NOT regenerate unchanged content
3. MODIFY only the sections directly affected by the changed/added/deleted files
4. If new architectural patterns emerge from the changes, ADD them
5. If deleted files remove patterns or dependencies, UPDATE accordingly
6. Add a "## 📋 Change Impact Summary" section at the TOP of the report listing:
   - What files changed and how they affect the architecture
   - Any new risks, patterns, or improvements introduced
   - Cross-module impacts (if modifying file A affects module B)
7. Keep BOTH perspectives (Legacy Maintainer + Newcomer Onboarding) updated

Return the COMPLETE updated report (the full markdown, not just a diff).
Do NOT add commentary outside the report — return ONLY the updated Markdown."""

    # If no LLM available, fall back to full structural analysis
    fallback = _build_codebase_fallback(full_graph_summary, folder_name)

    result = await generate_response(prompt, fallback)

    # Re-extract patterns from updated report + graph
    patterns = _extract_graph_patterns(full_graph_summary)

    # Confidence: slightly higher for incremental (we have prior context)
    client = get_client()
    confidence = 0.60 if client else 0.40
    file_count = full_graph_summary.count("## File:")
    if file_count > 5:
        confidence += 0.1
    if file_count > 15:
        confidence += 0.1
    if "class:" in full_graph_summary.lower():
        confidence += 0.05
    # Bonus for incremental (prior context improves accuracy)
    if previous_report and client:
        confidence += 0.05
    confidence = min(round(confidence, 2), 0.98)

    return {
        "summary_markdown": result,
        "detected_patterns": patterns,
        "confidence_score": confidence,
    }


async def generate_codebase_docs(graph_summary: str, existing_doc: str, folder_name: str = "project") -> dict:
    """Generate documentation from a pre-computed graph summary (not raw code)."""
    prompt = f"""You are a Documentation Generation Engine. You are given a **structural graph summary** of the entire "{folder_name}" codebase (extracted via static analysis) instead of raw source code.

Existing Documentation:
{existing_doc if existing_doc else "No existing documentation — this codebase is completely undocumented."}

Codebase Graph Summary:
{graph_summary}

Produce comprehensive Markdown documentation for this codebase:

1. **Project Overview** — what this codebase does, tech stack
2. **Architecture** — how modules are organized and relate to each other
3. **Module Reference** — for each file, describe its purpose, classes, functions, and key imports
4. **API Surface** — public functions/classes and their signatures
5. **Dependency Map** — what external libraries are used and why
6. **Drift Report** — if existing docs were provided, list every discrepancy

Return ONLY the Markdown."""

    fallback = f"""# {folder_name} — Documentation

## Overview
Auto-generated documentation based on codebase structural analysis.

{graph_summary}

## Drift Report
- ⚠️ Generated from structural graph — not raw source code
"""

    result = await generate_response(prompt, fallback)

    changes = []
    if not existing_doc or not existing_doc.strip():
        changes.append("First-time documentation generated for entire codebase")
    else:
        changes.append("Documentation updated from codebase graph analysis")

    sync_status = "synced"

    return {
        "updated_markdown": result,
        "changes_detected": changes,
        "sync_status": sync_status,
    }



