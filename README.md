<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Version-3.1-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/License-MIT-purple?style=for-the-badge" alt="License" />
</div>

<h1 align="center">CogniCode — The Architectural Sentinel</h1>
<p align="center">AI-Powered Codebase Intelligence for Enterprise Engineering Teams</p>

---

## Problem Statement

Engineering teams inherit massive codebases with zero documentation, make "safe" changes that cascade into outages, and lose institutional knowledge every time someone leaves. CogniCode addresses this by combining real-time AST analysis, LLM-powered reasoning, vector-embedded institutional knowledge (ChromaDB), ephemeral GitOps sandboxing, and real stress testing into a single developer dashboard.

---

## Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Groq_API-0466C8?style=for-the-badge&logo=meta&logoColor=white" alt="Groq API" />
  <img src="https://img.shields.io/badge/ChromaDB-FF6F00?style=for-the-badge" alt="ChromaDB" />
  <img src="https://img.shields.io/badge/GitPython-F05032?style=for-the-badge&logo=git&logoColor=white" alt="GitPython" />
  <img src="https://img.shields.io/badge/React_Flow-ff0072?style=for-the-badge" alt="React Flow" />
</p>

---

## Screenshots

### 1. Main Dashboard & Code Editor
<img src="./assets/images/dashboard.png" width="100%" alt="Main Dashboard" />

### 2. The Legacy Archeologist
<img src="./assets/images/archeologist.png" width="100%" alt="Archeologist" />

### 3. Blast Radius Dependency Graph
<img src="./assets/images/blast-radius.png" width="100%" alt="Dependency Graph" />

### 4. Traffic Simulator & GitOps Sandbox
<img src="./assets/images/sandbox.png" width="100%" alt="Sandbox" />

### 5. Bidirectional Sync
<img src="./assets/images/bidirectional-sync.png" width="100%" alt="Bidirectional Sync" />


---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Legacy Archeologist** | Auto-generates architecture blueprints from undocumented code using AST parsing and LLM inference. Detects design patterns (OOP, Factory, Singleton, etc.), flags anti-patterns (God Class, tight coupling), and computes confidence scores. Works at both single-file and full-codebase level. |
| 2 | **Blast Radius Graph** | Interactive React Flow visualization mapping every cross-file dependency. Click any module to see exactly what breaks if you change it — color-coded by severity (Healthy / Warning / Critical) with in-canvas status legend. |
| 3 | **Risk Map (Codebase Map)** | Every file scored by risk — coupling, complexity, and size. Visualizes imports, exports, classes, and functions per file with coupling percentages. Identifies the ticking time bombs before they explode in production. |
| 4 | **Quality Gate (PR Gatekeeper)** | One-click codebase-wide quality scan. Evaluates cyclomatic complexity, cognitive complexity, estimated Big-O, lines of code per function. Surfaces violations with severity levels (Critical / Warning / Info) and risk hotspots. |
| 5 | **Bidirectional Sync** | Live drift detection between code and documentation. Edit code → docs auto-regenerate (2s debounce). Edit docs → generate starter code. Detects undocumented functions, deleted references, and documentation coverage gaps. |
| 6 | **RAG Knowledge Engine** | ChromaDB-powered vector search over your codebase. Ingest entire repos, ask questions in natural language, and get answers with file-level citations. Captures *why* decisions were made, not just *what* the code does. |
| 7 | **Stress Testing** | Fire N concurrent analysis workers (1–50) on your loaded codebase. Each worker performs the full pipeline — dependency graph build, AST parsing, complexity analysis, blast radius layout, codebase map. Returns **real measured latency** (avg/p50/p95/max), throughput (analyses/sec), per-worker timeline, and pipeline breakdown. Verdict: PASS / DEGRADED / FAIL. |
| 8 | **GitOps Sandbox** | One-click ephemeral branch spawning via GitPython. Toggle between Production and Sandbox mode. Experiment in isolation, then merge or auto-abort on conflicts. |
| 9 | **Traffic Simulator** | Slider-driven load simulation (up to 50k RPS) that predicts cascading bottlenecks by cross-correlating code complexity with traffic patterns on the blast radius graph. |
| 10 | **`.cognicode/` Persistence** | Project-level state file (like `.git/` or `.vscode/`). Saves knowledge graph, archeologist report, blast radius, synced docs, file hashes. Instant restore on next open — no re-analysis needed. |
| 11 | **Incremental Delta Analysis** | When files change, only the delta is sent to the LLM with full previous context. LLM patches the report surgically instead of regenerating. 62% token savings. Falls back to full re-analysis if >50% files changed. |
| 12 | **Knowledge Graph** | Enriched graph with inheritance edges, composition detection, module clusters, and PageRank-style centrality scoring. Fully serializable, persisted in `.cognicode/`. |
| 13 | **Parallel Graph Parsing** | Multi-threaded file parsing via ThreadPoolExecutor (8 workers). 3-5x speedup on large codebases. Each file parsed independently with no shared state. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │Code     │ │Dependency│ │Bidirec-  │ │  Stress     │  │
│  │Editor   │ │Graph     │ │tional    │ │  Tester     │  │
│  │(Monaco) │ │(ReactFlow)│ │Sync      │ │  (Workers)  │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
│       │           │            │               │         │
│  ┌────┴────┐ ┌────┴─────┐ ┌───┴──────┐ ┌──────┴──────┐  │
│  │Quality  │ │Codebase  │ │RAG       │ │Command      │  │
│  │Gate     │ │Map       │ │Panel     │ │Station      │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
│       └───────────┴────────────┴───────────────┘         │
│                        api.ts                            │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTP (localhost:8000)
┌───────────────────────────┴──────────────────────────────┐
│                   BACKEND (FastAPI)                       │
│  ┌──────────────────────────────────────────────────────┐│
│  │                    main.py — API Routes              ││
│  └──┬───────┬──────────┬───────────┬────────────┬───────┘│
│     │       │          │           │            │        │
│  ┌──┴──┐ ┌──┴───┐ ┌───┴────┐ ┌───┴─────┐ ┌───┴──────┐ │
│  │LLM  │ │AST   │ │Code    │ │RAG      │ │Models    │ │
│  │Svc  │ │Parser│ │Graph   │ │Service  │ │(Pydantic)│ │
│  └──┬──┘ └──────┘ └────────┘ └───┬─────┘ └──────────┘ │
│     │                             │                     │
│  ┌──┴──────────┐           ┌──────┴─────┐               │
│  │Groq API     │           │ChromaDB    │               │
│  │(3-model     │           │(Vector     │               │
│  │ fallback)   │           │ Store)     │               │
│  └─────────────┘           └────────────┘               │
└──────────────────────────────────────────────────────────┘
```

---

## LLM Model Fallback Chain

The backend uses Groq-hosted LLMs with an automatic 3-model fallback chain to handle rate limits gracefully:

| Priority | Model | Use Case |
|----------|-------|----------|
| 1st | `llama-3.3-70b-versatile` | Best quality — tried first |
| 2nd | `llama-3.1-8b-instant` | Faster, higher rate limits — auto-fallback on 429 |
| 3rd | `gemma2-9b-it` | Last resort if both Llama models are rate-limited |

If a model returns a 429 rate limit error, the system **instantly** switches to the next model (no retries). If all three fail, the app gracefully falls back to regex-based structural analysis. All transitions are logged in the terminal:

```
✅ Groq client initialized
🤖 LLM response from llama-3.3-70b-versatile (2340 chars prompt)
⚠️  Rate limited on llama-3.3-70b-versatile — falling back to llama-3.1-8b-instant
🤖 LLM response from llama-3.1-8b-instant (2340 chars prompt)
```

---

## Installation

**Prerequisites:** Python 3.11+, Node.js 18+, npm

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/CogniCode.git
cd CogniCode
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
cp .env.example .env         # Add your Groq API key
python -m uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd cognicode-app
npm install
npm run dev
```

Open **http://localhost:3000**, click "Open a Folder", select a codebase, and hit **Analyze**.

> **Landing Page:** Visit **http://localhost:3000/landing** to see the marketing/product page.

---

## Environment Variables

```env
# backend/.env
GROQ_API_KEY=your_groq_api_key_here
```

Get a free API key at [console.groq.com](https://console.groq.com). Without a valid key, the app falls back to regex-based structural analysis (no AI features).

---

## Project Structure

```
CogniCode/
├── backend/
│   ├── main.py                  # All API endpoints (25+ routes)
│   ├── app/
│   │   ├── llm_service.py       # LLM integration with 3-model fallback + incremental analysis
│   │   ├── ast_service.py       # Python AST parser (complexity metrics)
│   │   ├── code_graph.py        # Multi-language dependency graph builder (13+ langs, parallel)
│   │   ├── knowledge_graph.py   # Enriched graph with inheritance, composition, centrality
│   │   ├── rag_service.py       # ChromaDB vectorization & search pipeline
│   │   └── models.py            # Pydantic request/response schemas
│   ├── requirements.txt
│   └── .env.example
│
├── cognicode-app/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Main IDE dashboard (with .cognicode/ persistence)
│   │   │   └── landing/page.tsx     # Marketing landing page
│   │   ├── components/
│   │   │   ├── CodeEditor.tsx       # Monaco-style code editor
│   │   │   ├── FileExplorer.tsx     # File browser with folder open (readwrite mode)
│   │   │   ├── DependencyGraph.tsx  # React Flow blast radius + risk map
│   │   │   ├── CodebaseMap.tsx      # File-level coupling visualization
│   │   │   ├── BidirectionalSync.tsx # Code ↔ Doc live sync with drift detection
│   │   │   ├── DocumentViewer.tsx   # Markdown renderer with patterns
│   │   │   ├── CommandStation.tsx   # Quality gate / PR gatekeeper panel
│   │   │   ├── RAGPanel.tsx         # Knowledge engine Q&A interface
│   │   │   └── LoadTester.tsx       # Stress testing UI (concurrent workers)
│   │   └── lib/
│   │       ├── api.ts               # Typed API client (all endpoints)
│   │       └── cognicode-store.ts   # .cognicode/ persistence layer (hash diffing, state save/load)
│   └── package.json
│
├── CogniCode_LLM_Architecture.md    # Detailed LLM pipeline documentation
├── assets/images/                    # Screenshots for README
└── README.md
```

---

## API Endpoints

### Core Analysis (Single File)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` | Health check |
| `POST` | `/api/v1/archeologist` | Analyze code architecture (single file) |
| `POST` | `/api/v1/ast/blast-radius` | Generate dependency graph (single file) |
| `POST` | `/api/v1/gatekeeper/evaluate` | Evaluate code complexity |
| `POST` | `/api/v1/sync/code-to-doc` | Generate docs from code |
| `POST` | `/api/v1/sync/doc-to-code` | Generate code from docs |

### Codebase Analysis (Multi-File, Graph-Based)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/codebase/archeologist` | Architecture analysis via dependency graph (token-efficient) |
| `POST` | `/api/v1/codebase/blast-radius` | Blast radius graph from codebase graph |
| `POST` | `/api/v1/codebase/code-to-doc` | Documentation from codebase graph |
| `POST` | `/api/v1/codebase/map` | Codebase map — files, functions, coupling metrics |
| `POST` | `/api/v1/codebase/health` | Codebase-wide quality gate evaluation |

### RAG Knowledge Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/rag/query` | Query knowledge base in natural language |
| `POST` | `/api/v1/rag/ingest` | Ingest a single document |
| `POST` | `/api/v1/rag/ingest-repo` | Ingest entire repository |
| `POST` | `/api/v1/rag/ingest-files` | Ingest multiple files from browser |

### Sandbox & Simulation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/sandbox/simulate` | Traffic simulation on blast radius graph |
| `POST` | `/api/v1/git/spawn-sandbox` | Create ephemeral Git branch |
| `POST` | `/api/v1/git/merge-and-destroy` | Merge sandbox branch and cleanup |

### Stress Testing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/stress-test` | Fire N concurrent analysis workers on loaded codebase |

### Persistence & Incremental Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/codebase/knowledge-graph` | Build enriched knowledge graph (inheritance, composition, centrality) |
| `POST` | `/api/v1/codebase/incremental-analyze` | Delta-based re-analysis (previous context + changed files only) |

> 📄 **For a deep dive into how data flows through the LLM pipeline**, see [`CogniCode_LLM_Architecture.md`](./CogniCode_LLM_Architecture.md).

---

## How It Works

### 1. Load Your Codebase
Open a folder from the file explorer. All files are sent to the backend for graph construction.

### 2. Dependency Graph Construction
`code_graph.py` uses regex-based multi-language parsing (Python, TypeScript, JavaScript, Go, Rust, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin, Dart) to build a dependency graph — extracting imports, classes, functions, and cross-file relationships.

### 3. Token-Efficient Analysis
Instead of sending raw source code to the LLM (expensive), CogniCode extracts a **structural graph summary** (20-30× token reduction) and sends that for AI analysis. The LLM sees the architecture without reading every line.

### 4. Real-Time Analysis
Click **Analyze** to trigger parallel analysis:
- Architecture excavation (Legacy Archeologist)
- Blast radius graph layout
- Codebase map with coupling metrics
All results render simultaneously.

### 5. Stress Test Your Codebase
The stress tester fires N concurrent workers (1-50) that each perform the **full analysis pipeline** on your codebase. Measures real wall-clock latency — not simulated predictions.

---

## Supported Languages

The code graph builder (`code_graph.py`) supports 13+ languages:

| Language | Imports | Classes | Functions | Tested |
|----------|---------|---------|-----------|--------|
| Python | ✅ | ✅ | ✅ | ✅ |
| TypeScript / TSX | ✅ | ✅ | ✅ | ✅ |
| JavaScript / JSX | ✅ | ✅ | ✅ | ✅ |
| Go | ✅ | ✅ | ✅ | ✅ |
| Rust | ✅ | ✅ | ✅ | ✅ |
| Java | ✅ | ✅ | ✅ | ✅ |
| C / C++ | ✅ | ✅ | ✅ | ✅ |
| C# | ✅ | ✅ | ✅ | ✅ |
| Ruby | ✅ | ✅ | ✅ | ✅ |
| PHP | ✅ | ✅ | ✅ | ✅ |
| Swift | ✅ | ✅ | ✅ | ✅ |
| Kotlin | ✅ | ✅ | ✅ | ✅ |
| Dart | ✅ | ✅ | ✅ | ✅ |

---

## Team

| Name | Role | Contributions |
|------|------|---------------|
| **Alok** | Project Lead & AI/RAG Core | Project setup, configuration, LLM service (`llm_service.py`), RAG engine (`rag_service.py`), data models, RAG panel, documentation |
| **Sabnur** | Frontend Foundation & Editor | App layout, styling (`globals.css`, `layout.tsx`, `page.tsx`), code editor, command station, API client layer |
| **Oheli** | Visualizations & Blueprints | Dependency graph (React Flow), document viewer, architecture visualization components |
| **Kalkita** | Systems Parsing & Syncing | Backend API routes (`main.py`), AST parser, file explorer, bidirectional sync, type definitions |

---

<div align="center">
  <strong>CogniCode</strong> — Built for engineering teams that refuse to let complexity win.
</div>
