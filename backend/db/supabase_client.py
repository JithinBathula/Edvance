"""
Supabase Client for Edvance Backend
Provides helper functions for database operations.
"""
import os
import hashlib
from typing import Any, Dict, List, Optional
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key for backend

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# =============================================================================
# USER OPERATIONS
# =============================================================================

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a user by their email address.
    """
    result = supabase.table("users").select("*").eq("email", email).execute()
    
    if result.data:
        return result.data[0]
    return None


def create_user_with_password(name: str, email: str, password_hash: str) -> Dict[str, Any]:
    """
    Create a new user with password hash for authentication.
    """
    user_data = {
        "name": name.strip(),
        "email": email.lower().strip(),
        "password_hash": password_hash,
        "xp": 0,
        "onboarding": None
    }
    
    result = supabase.table("users").insert(user_data).execute()
    
    if result.data:
        return result.data[0]
    raise Exception("Failed to create user")


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a user by their ID.
    """
    result = supabase.table("users").select("*").eq("id", user_id).execute()
    
    if result.data:
        return result.data[0]
    return None


def update_user_onboarding(user_id: str, onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a user's onboarding data.
    """
    result = supabase.table("users").update({
        "onboarding": onboarding_data
    }).eq("id", user_id).execute()
    
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update onboarding for user {user_id}")


# =============================================================================
# PROJECT OPERATIONS
# =============================================================================

def _normalize_vm_type(vm_type: Optional[str]) -> str:
    if not vm_type:
        return "python"
    normalized = vm_type.strip().lower()
    aliases = {
        "py": "python",
        "python": "python",
        "python3": "python",
        "js": "javascript",
        "javascript": "javascript",
        "node": "javascript",
        "nodejs": "javascript",
        "web": "javascript",
    }
    if normalized in aliases:
        return aliases[normalized]
    raise ValueError(f"Invalid vm_type: {vm_type}")


def create_project(
    user_id: str,
    title: str,
    brief: str,
    requirements: List[str],
    tech_stack: List[str],
    experience_level: str,
    vm_type: Optional[str] = None,
    content_type: str = "custom_project"
) -> Dict[str, Any]:
    """
    Create a new project record.
    """
    normalized_vm_type = _normalize_vm_type(vm_type)
    project_data = {
        "user_id": user_id,
        "title": title,
        "brief": brief,
        "content_type": content_type,
        "status": "draft",
        "requirements": requirements,
        "tech_stack": tech_stack,
        "experience_level": experience_level,
        "vm_type": normalized_vm_type,
    }
    
    result = supabase.table("projects").insert(project_data).execute()
    
    if result.data:
        return result.data[0]
    raise Exception("Failed to create project")


def get_project_by_id(project_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a project by ID with its milestones and tasks.
    """
    result = supabase.table("projects").select("*").eq("id", project_id).execute()
    
    if result.data:
        return result.data[0]
    return None


def update_project_repo_info(project_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update repo-related metadata for a project.
    """
    if not updates:
        raise ValueError("Updates required")
    result = supabase.table("projects").update(updates).eq("id", project_id).execute()
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update repo info for project {project_id}")


# =============================================================================
# MILESTONE OPERATIONS
# =============================================================================

def create_milestone(
    project_id: str,
    position: int,
    title: str,
    description: str
) -> Dict[str, Any]:
    """
    Create a new milestone within a project.
    """
    milestone_data = {
        "project_id": project_id,
        "position": position,
        "title": title,
        "description": description
    }
    
    result = supabase.table("milestones").insert(milestone_data).execute()
    
    if result.data:
        return result.data[0]
    raise Exception("Failed to create milestone")


def get_project_milestones(project_id: str) -> List[Dict[str, Any]]:
    """
    Get all milestones for a project, ordered by position.
    """
    result = supabase.table("milestones").select("*").eq("project_id", project_id).order("position").execute()
    return result.data or []


# =============================================================================
# TASK OPERATIONS
# =============================================================================

def create_task(
    milestone_id: str,
    position: int,
    task_id_slug: str,
    instruction_theory: str,
    coding_requirements: List[str],
    hints: List[str],
    test_specification: Dict[str, Any],
    starter_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new task within a milestone.
    """
    task_data = {
        "milestone_id": milestone_id,
        "position": position,
        "task_id_slug": task_id_slug,
        "instruction_theory": instruction_theory,
        "coding_requirements": coding_requirements,
        "hints": hints,
        "test_specification": test_specification,
        "starter_code": starter_code
    }
    
    result = supabase.table("tasks").insert(task_data).execute()
    
    if result.data:
        return result.data[0]
    raise Exception("Failed to create task")


def get_milestone_tasks(milestone_id: str) -> List[Dict[str, Any]]:
    """
    Get all tasks for a milestone, ordered by position.
    """
    result = supabase.table("tasks").select("*").eq("milestone_id", milestone_id).order("position").execute()
    return result.data or []


def get_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a single task by ID.
    """
    result = supabase.table("tasks").select("*").eq("id", task_id).execute()
    
    if result.data:
        return result.data[0]
    return None


# =============================================================================
# USER PROGRESS OPERATIONS
# =============================================================================

def update_progress(
    user_id: str,
    task_id: str,
    status: Optional[str] = None,
    submitted_code: Optional[str] = None,
    passed: Optional[bool] = None,
    feedback: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Update progress for a user-task pair.
    Uses upsert to create the record if it doesn't exist.
    """
    # Build the data to upsert
    upsert_data = {
        "user_id": user_id,
        "task_id": task_id,
    }

    if status is not None:
        if status not in ("not_started", "in_progress", "completed"):
            raise ValueError(f"Invalid status: {status}")
        upsert_data["status"] = status

        if status == "in_progress":
            upsert_data["started_at"] = datetime.utcnow().isoformat()
        elif status == "completed":
            upsert_data["completed_at"] = datetime.utcnow().isoformat()
    else:
        # Default status if not provided
        upsert_data["status"] = "in_progress"

    if submitted_code is not None:
        upsert_data["submitted_code"] = submitted_code

    if passed is not None:
        upsert_data["passed"] = passed
    else:
        # Default to False if not provided
        upsert_data["passed"] = False

    if feedback is not None:
        upsert_data["feedback"] = feedback

    # Use upsert to insert or update
    # on_conflict specifies which columns make a record unique
    result = supabase.table("user_progress").upsert(
        upsert_data,
        on_conflict="user_id,task_id"
    ).execute()

    if result.data:
        return result.data[0]
    raise Exception("Failed to update progress record")


def get_user_projects_list(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all projects for a user with basic info for listing.
    """
    result = supabase.table("projects").select("id, title, brief, status, vm_type, created_at, updated_at").eq("user_id", user_id).order("created_at", desc=True).execute()
    return result.data or []


# =============================================================================
# COURSE OPERATIONS
# =============================================================================

def get_course_by_theme(theme: str) -> Optional[Dict[str, Any]]:
    """
    Get a course by theme with all lessons, tasks, and highlights.
    """
    # Get the course
    result = supabase.table("courses").select("*").eq("theme", theme).limit(1).execute()
    
    if not result.data:
        return None
    
    course = result.data[0]
    
    # Get lessons for the course
    lessons_result = supabase.table("course_lessons").select("*").eq("course_id", course["id"]).order("position").execute()
    lessons = lessons_result.data or []
    
    # Get tasks and highlights for each lesson
    for lesson in lessons:
        # Get tasks
        tasks_result = supabase.table("course_lesson_tasks").select("*").eq("lesson_id", lesson["id"]).order("position").execute()
        lesson["tasks"] = tasks_result.data or []
        
        # Get highlights
        highlights_result = supabase.table("course_lesson_highlights").select("*").eq("lesson_id", lesson["id"]).order("position").execute()
        lesson["highlights"] = highlights_result.data or []
    
    course["lessons"] = lessons
    return course


def get_user_course_progress(user_id: str, course_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user's progress in a course.
    """
    result = supabase.table("user_course_progress").select("*").eq("user_id", user_id).eq("course_id", course_id).execute()
    
    if result.data:
        return result.data[0]
    return None


def update_user_course_progress(
    user_id: str,
    course_id: str,
    completed_lessons: List[str],
    current_lesson_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update or create user's course progress.
    """
    # Check if progress exists
    existing = get_user_course_progress(user_id, course_id)

    if existing:
        # Update existing
        update_data = {
            "completed_lessons": completed_lessons
        }
        if current_lesson_id:
            update_data["current_lesson_id"] = current_lesson_id

        result = supabase.table("user_course_progress").update(update_data).eq("user_id", user_id).eq("course_id", course_id).execute()
    else:
        # Create new
        progress_data = {
            "user_id": user_id,
            "course_id": course_id,
            "completed_lessons": completed_lessons,
            "current_lesson_id": current_lesson_id
        }
        result = supabase.table("user_course_progress").insert(progress_data).execute()

    if result.data:
        return result.data[0]
    raise Exception("Failed to update course progress")


# =============================================================================
# CLOUD STORAGE OPERATIONS (Supabase Storage + repo_files table)
# =============================================================================

STORAGE_BUCKET = "code-repos"


def _compute_content_hash(content: str) -> str:
    """Compute SHA256 hash of file content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _detect_language(filename: str) -> str:
    """Detect programming language from file extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return {
        "py": "python",
        "js": "javascript",
        "ts": "typescript",
        "jsx": "javascript",
        "tsx": "typescript",
        "html": "html",
        "css": "css",
        "json": "json",
        "md": "markdown",
    }.get(ext, "text")


def get_repo_files_metadata(project_id: str) -> List[Dict[str, Any]]:
    """
    Get all file metadata for a project from repo_files table.
    """
    result = supabase.table("repo_files").select("*").eq("project_id", project_id).execute()
    return result.data or []


def upload_file_to_storage(project_id: str, file_path: str, content: str) -> str:
    """
    Upload a file to Supabase Storage.
    Returns the storage path.
    """
    storage_path = f"{project_id}/{file_path}"
    content_bytes = content.encode("utf-8")

    # Upload to Supabase Storage (upsert mode)
    supabase.storage.from_(STORAGE_BUCKET).upload(
        storage_path,
        content_bytes,
        {"content-type": "text/plain", "upsert": "true"}
    )

    return storage_path


def download_file_from_storage(storage_path: str) -> Optional[str]:
    """
    Download a file from Supabase Storage.
    Returns the file content as string.
    """
    try:
        response = supabase.storage.from_(STORAGE_BUCKET).download(storage_path)
        return response.decode("utf-8")
    except Exception:
        return None


def delete_file_from_storage(storage_path: str) -> bool:
    """
    Delete a file from Supabase Storage.
    """
    try:
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        return True
    except Exception:
        return False


def upsert_repo_file_metadata(
    project_id: str,
    file_path: str,
    storage_path: str,
    content: str
) -> Dict[str, Any]:
    """
    Insert or update file metadata in repo_files table.
    """
    content_hash = _compute_content_hash(content)
    size_bytes = len(content.encode("utf-8"))
    language = _detect_language(file_path)

    file_data = {
        "project_id": project_id,
        "file_path": file_path,
        "storage_path": storage_path,
        "content_hash": content_hash,
        "size_bytes": size_bytes,
        "language": language,
    }

    result = supabase.table("repo_files").upsert(
        file_data,
        on_conflict="project_id,file_path"
    ).execute()

    if result.data:
        return result.data[0]
    raise Exception(f"Failed to upsert repo file metadata for {file_path}")


def delete_repo_file_metadata(project_id: str, file_path: str) -> bool:
    """
    Delete file metadata from repo_files table.
    """
    try:
        supabase.table("repo_files").delete().eq(
            "project_id", project_id
        ).eq("file_path", file_path).execute()
        return True
    except Exception:
        return False


def delete_all_repo_files(project_id: str) -> bool:
    """
    Delete all file metadata for a project.
    """
    try:
        supabase.table("repo_files").delete().eq("project_id", project_id).execute()
        return True
    except Exception:
        return False


def update_project_storage_type(project_id: str, storage_type: str) -> Dict[str, Any]:
    """
    Update the storage_type field for a project.
    """
    result = supabase.table("projects").update({
        "storage_type": storage_type
    }).eq("id", project_id).execute()

    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update storage type for project {project_id}")
