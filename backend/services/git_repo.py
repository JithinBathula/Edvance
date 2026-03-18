"""
Cloud storage helpers for project workspaces.
Uses Supabase Storage for file storage with PostgreSQL metadata.
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from db.supabase_client import (
    get_repo_files_metadata,
    upload_file_to_storage,
    download_file_from_storage,
    delete_file_from_storage,
    upsert_repo_file_metadata,
    delete_repo_file_metadata,
    update_project_storage_type,
)


def _detect_language(filename: str) -> str:
    """Detect programming language from file extension."""
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
        ".csv": "text",
        ".md": "markdown",
    }.get(ext, "text")


def _normalize_rel_path(path: str) -> str:
    """Normalize and validate a relative file path."""
    if not path:
        raise ValueError("File path is required")
    clean = path.replace("\\", "/").lstrip("/")
    if clean.startswith("..") or "/.." in clean:
        raise ValueError("Invalid file path")
    return clean


def read_repo_files(project_id: str) -> List[Dict[str, str]]:
    """
    Read all files for a project from cloud storage.

    Args:
        project_id: The project UUID

    Returns:
        List of file dicts with 'name', 'content', and 'language' keys
    """
    files_metadata = get_repo_files_metadata(project_id)

    files: List[Dict[str, str]] = []
    for meta in files_metadata:
        storage_path = meta.get("storage_path")
        if not storage_path:
            continue

        content = download_file_from_storage(storage_path)
        if content is None:
            continue

        files.append({
            "name": meta["file_path"],
            "content": content,
            "language": meta.get("language", "text"),
        })

    return files


def write_repo_files(project_id: str, files: List[Dict[str, str]]) -> None:
    """
    Write files for a project to cloud storage.
    Handles file additions, updates, and deletions.

    Args:
        project_id: The project UUID
        files: List of file dicts with 'name' and 'content' keys
    """
    existing_files = get_repo_files_metadata(project_id)
    existing_paths = {f["file_path"]: f for f in existing_files}

    keep_paths: set[str] = set()

    for file in files:
        file_path = _normalize_rel_path(file.get("name", ""))
        content = file.get("content", "")
        keep_paths.add(file_path)

        storage_path = upload_file_to_storage(project_id, file_path, content)
        upsert_repo_file_metadata(project_id, file_path, storage_path, content)

    for existing_path, existing_meta in existing_paths.items():
        if existing_path not in keep_paths:
            delete_file_from_storage(existing_meta["storage_path"])
            delete_repo_file_metadata(project_id, existing_path)

    update_project_storage_type(project_id, "cloud")
