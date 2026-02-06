"""
Git repo helpers for project workspaces.
Internal repo is the source of truth; GitHub is a publish target.
"""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

DEFAULT_BRANCH = "main"
DEFAULT_AUTHOR_NAME = os.getenv("GIT_AUTHOR_NAME", "Edvance Bot")
DEFAULT_AUTHOR_EMAIL = os.getenv("GIT_AUTHOR_EMAIL", "bot@edvance.local")


def _repo_root() -> Path:
    repo_root = os.getenv("REPO_ROOT")
    if repo_root:
        return Path(repo_root).resolve()
    return (Path(__file__).resolve().parents[1] / "repos").resolve()


def _safe_segment(value: str) -> str:
    if not value:
        raise ValueError("Invalid empty path segment")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", value):
        raise ValueError("Invalid path segment")
    return value


def get_repo_path(user_id: str, project_id: str) -> Path:
    safe_user = _safe_segment(str(user_id))
    safe_project = _safe_segment(str(project_id))
    return _repo_root() / safe_user / safe_project


def _run_git(repo_path: Path, args: List[str], check: bool = True) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=str(repo_path),
        capture_output=True,
        text=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def ensure_repo_initialized(repo_path: Path, default_branch: str = DEFAULT_BRANCH) -> None:
    repo_path.mkdir(parents=True, exist_ok=True)
    if (repo_path / ".git").exists():
        return
    _run_git(repo_path, ["init"], check=True)
    # Set default branch to main if possible
    _run_git(repo_path, ["symbolic-ref", "HEAD", f"refs/heads/{default_branch}"], check=False)
    _run_git(repo_path, ["config", "user.name", DEFAULT_AUTHOR_NAME], check=False)
    _run_git(repo_path, ["config", "user.email", DEFAULT_AUTHOR_EMAIL], check=False)


def _normalize_rel_path(path: str) -> str:
    if not path:
        raise ValueError("File path is required")
    clean = path.replace("\\", "/").lstrip("/")
    if clean.startswith("..") or "/.." in clean:
        raise ValueError("Invalid file path")
    return clean


def _detect_language(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".jsx": "javascript",
        ".tsx": "typescript",
        ".html": "html",
        ".css": "css",
        ".json": "json",
        ".md": "markdown",
    }.get(ext, "text")


def read_repo_files(repo_path: Path) -> List[Dict[str, str]]:
    if not (repo_path / ".git").exists():
        return []
    tracked = _run_git(repo_path, ["ls-files"], check=True).splitlines()
    files: List[Dict[str, str]] = []
    for rel_path in tracked:
        abs_path = repo_path / rel_path
        if not abs_path.exists() or abs_path.is_dir():
            continue
        try:
            content = abs_path.read_text(encoding="utf-8")
        except Exception:
            # Skip binary or unreadable files
            continue
        files.append({
            "name": rel_path,
            "content": content,
            "language": _detect_language(rel_path),
        })
    return files


def write_repo_files(repo_path: Path, files: List[Dict[str, str]]) -> None:
    keep: set[str] = set()
    for file in files:
        rel_path = _normalize_rel_path(file.get("name", ""))
        keep.add(rel_path)
        abs_path = repo_path / rel_path
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        content = file.get("content", "")
        abs_path.write_text(content, encoding="utf-8")

    if not (repo_path / ".git").exists():
        return

    tracked = _run_git(repo_path, ["ls-files"], check=True).splitlines()
    for rel_path in tracked:
        if rel_path not in keep:
            abs_path = repo_path / rel_path
            if abs_path.exists() and abs_path.is_file():
                abs_path.unlink()

    # Clean empty directories (ignore .git)
    for root, dirs, files in os.walk(repo_path, topdown=False):
        if ".git" in dirs:
            dirs.remove(".git")
        if files or dirs:
            continue
        try:
            Path(root).rmdir()
        except OSError:
            pass


def get_head_commit(repo_path: Path) -> Optional[str]:
    try:
        commit = _run_git(repo_path, ["rev-parse", "HEAD"], check=True).strip()
        return commit or None
    except Exception:
        return None


def commit_repo(repo_path: Path, message: str, author: Optional[Dict[str, str]] = None) -> Optional[str]:
    _run_git(repo_path, ["add", "-A"], check=True)
    status = _run_git(repo_path, ["status", "--porcelain"], check=True).strip()
    if not status:
        return get_head_commit(repo_path)

    env = os.environ.copy()
    if author:
        name = author.get("name")
        email = author.get("email")
        if name:
            env["GIT_AUTHOR_NAME"] = name
            env["GIT_COMMITTER_NAME"] = name
        if email:
            env["GIT_AUTHOR_EMAIL"] = email
            env["GIT_COMMITTER_EMAIL"] = email

    subprocess.run(
        ["git", "commit", "-m", message],
        cwd=str(repo_path),
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    return get_head_commit(repo_path)


def push_repo(repo_path: Path, remote_url: str, branch: str = DEFAULT_BRANCH) -> None:
    _run_git(repo_path, ["push", remote_url, f"HEAD:{branch}"], check=True)


def list_commits(repo_path: Path, limit: int = 50) -> List[Dict[str, str]]:
    if not (repo_path / ".git").exists():
        return []
    raw = _run_git(repo_path, ["log", f"--pretty=format:%H|%an|%ad|%s", f"-n", str(limit)], check=False)
    commits: List[Dict[str, str]] = []
    for line in raw.splitlines():
        parts = line.split("|", 3)
        if len(parts) != 4:
            continue
        commits.append({
            "hash": parts[0],
            "author": parts[1],
            "date": parts[2],
            "message": parts[3],
        })
    return commits
