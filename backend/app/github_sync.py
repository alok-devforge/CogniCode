"""
github_sync.py — GitHub Commit Sync Service

Fetches the latest commit from a GitHub repository via the REST API,
extracts the diff, summarizes it via LLM, and ingests it into ChromaDB.

This is the "Git Hash as a Time Machine" feature — every push becomes
searchable institutional knowledge.
"""

import logging
import re
import aiohttp

logger = logging.getLogger("cognicode.github_sync")


def parse_github_url(owner_or_url: str, repo: str = "") -> tuple[str, str]:
    """Parse owner/repo from various GitHub URL formats.

    Supports:
      - "owner", "repo"  (already split)
      - "https://github.com/owner/repo"
      - "https://github.com/owner/repo.git"
      - "git@github.com:owner/repo.git"
      - "github.com/owner/repo"
      - "owner/repo"
    """
    url = owner_or_url.strip()

    # If repo is already provided and owner looks like a plain name, return as-is
    if repo and "/" not in url and "github" not in url.lower():
        return url, repo.strip().rstrip(".git").strip("/")

    # Try to extract from full URL
    # Match patterns: github.com/owner/repo or github.com:owner/repo
    m = re.search(r'github\.com[/:]([^/]+)/([^/\s]+)', url)
    if m:
        owner = m.group(1)
        repo_name = m.group(2).rstrip(".git").strip("/")
        return owner, repo_name

    # Try "owner/repo" format
    if "/" in url and "." not in url.split("/")[0]:
        parts = url.strip("/").split("/")
        if len(parts) >= 2:
            return parts[0], parts[1].rstrip(".git")

    # If repo was provided separately, try to parse it as URL too
    if repo:
        m2 = re.search(r'github\.com[/:]([^/]+)/([^/\s]+)', repo)
        if m2:
            return m2.group(1), m2.group(2).rstrip(".git")
        return url, repo.strip().rstrip(".git")

    raise ValueError(
        f"Could not parse GitHub owner/repo from: '{owner_or_url}'. "
        "Use format: 'owner/repo' or a full GitHub URL."
    )


async def fetch_latest_commit(owner: str, repo: str, branch: str = "main", token: str = "") -> dict:
    """Fetch the latest commit from a GitHub repository.

    Returns dict with: sha, message, author, date, files_changed, diff_text
    """
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    base_url = f"https://api.github.com/repos/{owner}/{repo}"

    async with aiohttp.ClientSession() as session:
        # 1. Get latest commit on branch
        commits_url = f"{base_url}/commits?sha={branch}&per_page=1"
        async with session.get(commits_url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise ValueError(f"GitHub API error ({resp.status}): {error_text[:200]}")
            commits = await resp.json()

        if not commits:
            raise ValueError(f"No commits found on branch '{branch}'")

        commit_data = commits[0]
        sha = commit_data["sha"]
        message = commit_data["commit"]["message"]
        author = commit_data["commit"]["author"]["name"]
        date = commit_data["commit"]["author"]["date"]

        # 2. Get full commit details with diff
        commit_url = f"{base_url}/commits/{sha}"
        async with session.get(commit_url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise ValueError(f"GitHub API error ({resp.status}): {error_text[:200]}")
            detail = await resp.json()

        # Extract changed files and their patches
        files_changed = []
        diff_parts = []
        stats = detail.get("stats", {})

        for f in detail.get("files", []):
            file_info = {
                "filename": f["filename"],
                "status": f["status"],  # added, removed, modified, renamed
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "patch": f.get("patch", ""),
            }
            files_changed.append(file_info)

            # Build readable diff text
            status_label = {"added": "+", "removed": "-", "modified": "~", "renamed": "→"}.get(f["status"], "?")
            diff_parts.append(f"[{status_label}] {f['filename']} (+{f.get('additions', 0)} -{f.get('deletions', 0)})")
            if f.get("patch"):
                # Limit patch size to avoid token explosion
                patch = f["patch"][:2000]
                diff_parts.append(f"```diff\n{patch}\n```")

        diff_text = "\n".join(diff_parts)

        logger.info(f"Fetched commit {sha[:8]} by {author}: {message[:60]}")

        return {
            "sha": sha,
            "short_sha": sha[:8],
            "message": message,
            "author": author,
            "date": date,
            "stats": {
                "total": stats.get("total", 0),
                "additions": stats.get("additions", 0),
                "deletions": stats.get("deletions", 0),
            },
            "files_changed": files_changed,
            "diff_text": diff_text,
        }


async def summarize_commit(commit: dict, llm_fn) -> str:
    """Use LLM to summarize WHY the commit happened and its architectural impact."""
    prompt = f"""You are a code change analyst. Summarize this Git commit concisely, focusing on:
1. WHAT changed (files, functions, features)
2. WHY it likely changed (bug fix, feature, refactor, optimization)
3. IMPACT on the system architecture

Commit: {commit['short_sha']}
Author: {commit['author']}
Date: {commit['date']}
Message: {commit['message']}

Changes ({commit['stats']['additions']} additions, {commit['stats']['deletions']} deletions):
{commit['diff_text'][:3000]}

Write a 3-5 sentence technical summary. Be specific about file names and function changes."""

    fallback = (
        f"Commit {commit['short_sha']} by {commit['author']}: {commit['message']}. "
        f"Changed {len(commit['files_changed'])} file(s) with "
        f"{commit['stats']['additions']} additions and {commit['stats']['deletions']} deletions."
    )

    summary = await llm_fn(prompt, fallback)
    return summary


def ingest_commit_to_chromadb(commit: dict, summary: str):
    """Store the commit diff and summary in ChromaDB for RAG retrieval."""
    from app.rag_service import get_collection, chunk_text

    collection = get_collection()

    # Build a rich document combining commit metadata + summary + diff
    document = f"""[SOURCE: github_commit]
[COMMIT: {commit['sha']}]
[AUTHOR: {commit['author']}]
[DATE: {commit['date']}]
[MESSAGE: {commit['message']}]

## AI Summary
{summary}

## Files Changed
{chr(10).join(f"- {f['filename']} ({f['status']}: +{f['additions']} -{f['deletions']})" for f in commit['files_changed'])}

## Diff
{commit['diff_text'][:5000]}
"""

    chunks = chunk_text(document, chunk_size=600, overlap=100)

    for i, chunk in enumerate(chunks):
        doc_id = f"commit_{commit['short_sha']}_{i}"
        collection.upsert(
            ids=[doc_id],
            documents=[chunk],
            metadatas=[{
                "source": f"github_commit_{commit['short_sha']}",
                "source_type": "git_commit",
                "commit_sha": commit['sha'],
                "commit_author": commit['author'],
                "commit_date": commit['date'],
                "commit_message": commit['message'][:200],
                "chunk_index": i,
            }],
        )

    logger.info(f"Ingested commit {commit['short_sha']} into ChromaDB ({len(chunks)} chunks)")
    return len(chunks)
