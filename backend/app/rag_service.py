import os
import subprocess
import chromadb
from pathlib import Path


_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None

SUPPORTED_EXTENSIONS = {
    ".md", ".txt", ".rst", ".adoc",
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".java", ".cpp", ".c", ".h", ".hpp",
    ".go", ".rs", ".rb", ".php", ".swift", ".kt",
    ".yaml", ".yml", ".toml", ".json", ".xml",
    ".sql", ".sh", ".bash",
    ".env.example", ".gitignore", ".dockerfile",
}

SKIP_DIRS = {
    "node_modules", ".git", ".next", "__pycache__",
    ".venv", "venv", "dist", "build", ".cache",
    ".turbo", "coverage", "chroma_data", ".tox",
}


def get_chroma_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
        _client = chromadb.PersistentClient(path=persist_dir)
    return _client


def get_collection() -> chromadb.Collection:
    global _collection
    if _collection is None:
        client = get_chroma_client()
        _collection = client.get_or_create_collection(
            name="cognicode_knowledge",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks


def classify_source(file_path: str) -> str:
    path_lower = file_path.lower()
    name = Path(file_path).stem.lower()

    if any(tag in path_lower for tag in ["adr", "decision", "architecture-decision"]):
        return "architecture_decision_record"
    if any(tag in path_lower for tag in ["postmortem", "post-mortem", "incident"]):
        return "incident_postmortem"
    if any(tag in path_lower for tag in ["wiki", "confluence", "docs/", "documentation/"]):
        return "internal_documentation"
    if any(tag in path_lower for tag in ["changelog", "release", "migration"]):
        return "changelog"
    if name in ("readme", "contributing", "code_of_conduct", "security"):
        return "project_documentation"
    if file_path.endswith((".yaml", ".yml", ".toml", ".json", ".xml")):
        return "configuration"
    if file_path.endswith((".py", ".js", ".ts", ".java", ".cpp", ".go", ".rs")):
        return "source_code"
    return "general_documentation"


def ingest_markdown_directory(directory: str) -> int:
    collection = get_collection()
    doc_path = Path(directory)
    ingested = 0

    if not doc_path.exists():
        return 0

    for md_file in doc_path.glob("**/*.md"):
        content = md_file.read_text(encoding="utf-8", errors="ignore")
        chunks = chunk_text(content)
        for i, chunk in enumerate(chunks):
            doc_id = f"{md_file.stem}_{i}"
            collection.upsert(
                ids=[doc_id],
                documents=[chunk],
                metadatas=[{"source": str(md_file), "chunk_index": i}],
            )
            ingested += 1

    return ingested


def ingest_repository(repo_path: str) -> dict:
    collection = get_collection()
    root = Path(repo_path)
    stats = {
        "source_code": 0,
        "documentation": 0,
        "adrs": 0,
        "configs": 0,
        "commit_messages": 0,
        "total_chunks": 0,
    }

    if not root.exists():
        return stats

    for file_path in root.rglob("*"):
        if file_path.is_dir():
            continue
        if any(skip in file_path.parts for skip in SKIP_DIRS):
            continue
        if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        if not content.strip() or len(content) > 500_000:
            continue

        source_type = classify_source(str(file_path))
        rel_path = str(file_path.relative_to(root))

        prefix = f"[FILE: {rel_path}]\n[TYPE: {source_type}]\n\n"
        chunks = chunk_text(prefix + content)

        for i, chunk in enumerate(chunks):
            doc_id = f"repo_{rel_path.replace(os.sep, '_')}_{i}"
            collection.upsert(
                ids=[doc_id],
                documents=[chunk],
                metadatas=[{
                    "source": rel_path,
                    "source_type": source_type,
                    "chunk_index": i,
                    "repo_path": repo_path,
                }],
            )
            stats["total_chunks"] += 1

        if source_type == "source_code":
            stats["source_code"] += 1
        elif source_type == "architecture_decision_record":
            stats["adrs"] += 1
        elif source_type == "configuration":
            stats["configs"] += 1
        else:
            stats["documentation"] += 1

    try:
        git_log = subprocess.run(
            ["git", "log", "--oneline", "--no-merges", "-50", "--format=%s|||%b"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if git_log.returncode == 0 and git_log.stdout.strip():
            commit_text = f"[SOURCE: git_commit_history]\n[TYPE: commit_messages]\n\n{git_log.stdout}"
            commit_chunks = chunk_text(commit_text, chunk_size=600, overlap=50)
            for i, chunk in enumerate(commit_chunks):
                collection.upsert(
                    ids=[f"git_commits_{i}"],
                    documents=[chunk],
                    metadatas=[{
                        "source": "git_log",
                        "source_type": "commit_history",
                        "chunk_index": i,
                        "repo_path": repo_path,
                    }],
                )
                stats["commit_messages"] += 1
                stats["total_chunks"] += 1
    except Exception:
        pass

    return stats


def query_documents(query: str, top_k: int = 5) -> list[dict]:
    collection = get_collection()

    if collection.count() == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(top_k, collection.count()),
    )

    documents = []
    for i in range(len(results["ids"][0])):
        doc = {
            "content": results["documents"][0][i],
            "source": results["metadatas"][0][i].get("source", "unknown"),
            "source_type": results["metadatas"][0][i].get("source_type", "general"),
            "relevance_score": 1.0 - (results["distances"][0][i] if results["distances"] else 0),
        }
        documents.append(doc)

    return documents


def ingest_files(folder_name: str, files: list[dict]) -> dict:
    """Ingest file contents sent inline from the browser."""
    collection = get_collection()

    # Clear previous data for this folder to avoid stale results
    try:
        existing = collection.get(where={"folder": folder_name})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    stats = {
        "source_code": 0,
        "documentation": 0,
        "configs": 0,
        "total_chunks": 0,
    }

    for file_info in files:
        path = file_info["path"]
        content = file_info["content"]

        if not content.strip() or len(content) > 500_000:
            continue

        source_type = classify_source(path)
        prefix = f"[FILE: {path}]\n[TYPE: {source_type}]\n\n"
        chunks = chunk_text(prefix + content)

        for i, chunk in enumerate(chunks):
            doc_id = f"folder_{folder_name}_{path.replace(os.sep, '_').replace('/', '_')}_{i}"
            collection.upsert(
                ids=[doc_id],
                documents=[chunk],
                metadatas=[{
                    "source": path,
                    "source_type": source_type,
                    "chunk_index": i,
                    "folder": folder_name,
                }],
            )
            stats["total_chunks"] += 1

        if source_type == "source_code":
            stats["source_code"] += 1
        elif source_type == "configuration":
            stats["configs"] += 1
        else:
            stats["documentation"] += 1

    return stats
