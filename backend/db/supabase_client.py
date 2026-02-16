"""
Supabase Client for Edvance Backend
Provides helper functions for database operations.
"""
import os
import string
import random
import hashlib
import logging
import time
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
from supabase.lib.client_options import SyncClientOptions
import httpx
import httpcore

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key for backend

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables")

logger = logging.getLogger(__name__)

_MAX_RETRY_ATTEMPTS = 3
_RETRY_BASE_DELAY_SECONDS = 0.2
_RETRY_JITTER_SECONDS = 0.1

_TRANSIENT_EXCEPTION_TYPES = (
    httpx.RemoteProtocolError,
    httpx.ReadTimeout,
    httpx.ConnectError,
    httpx.TransportError,
    httpcore.RemoteProtocolError,
    httpcore.ReadTimeout,
    httpcore.ConnectError,
    httpcore.NetworkError,
)

supabase_options = SyncClientOptions(
    postgrest_client_timeout=20,
    storage_client_timeout=20,
    function_client_timeout=10,
)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=supabase_options)


def is_transient_supabase_error(exc: BaseException) -> bool:
    """
    Return True when an exception chain contains transient transport failures.
    """
    current: Optional[BaseException] = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if isinstance(current, _TRANSIENT_EXCEPTION_TYPES):
            return True
        current = current.__cause__ or current.__context__
    return False


def execute_with_retry(operation_name: str, fn):
    """
    Execute a Supabase/PostgREST operation with retries for transient transport errors.
    """
    for attempt in range(1, _MAX_RETRY_ATTEMPTS + 1):
        try:
            return fn()
        except Exception as exc:
            is_transient = is_transient_supabase_error(exc)
            if (not is_transient) or attempt >= _MAX_RETRY_ATTEMPTS:
                if is_transient:
                    logger.error(
                        "supabase_operation_failed operation=%s attempt=%d error_type=%s",
                        operation_name,
                        attempt,
                        type(exc).__name__,
                    )
                raise

            delay = (_RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1))) + random.uniform(0, _RETRY_JITTER_SECONDS)
            logger.warning(
                "supabase_retry operation=%s attempt=%d delay_seconds=%.3f error_type=%s",
                operation_name,
                attempt,
                delay,
                type(exc).__name__,
            )
            time.sleep(delay)


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


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a user by their ID.
    """
    result = execute_with_retry(
        "get_user_by_id",
        lambda: supabase.table("users").select("*").eq("id", user_id).execute(),
    )

    if result.data:
        return result.data[0]
    return None


# Alias: users.id = auth.users.id after Supabase Auth migration
get_user_by_auth_id = get_user_by_id


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


def get_user_progress_for_project(user_id: str, project_id: str) -> List[Dict[str, Any]]:
    """
    Get user progress records for all tasks in a project.
    """
    milestones = get_project_milestones(project_id)
    if not milestones:
        return []

    task_ids: List[str] = []
    for milestone in milestones:
        tasks = get_milestone_tasks(milestone["id"])
        task_ids.extend(str(task["id"]) for task in tasks if task.get("id"))

    if not task_ids:
        return []

    result = execute_with_retry(
        "get_user_progress_for_project",
        lambda: supabase.table("user_progress").select("*").eq(
            "user_id", user_id
        ).in_(
            "task_id", task_ids
        ).execute(),
    )
    return result.data or []


def get_user_projects_list(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all projects for a user with basic info for listing.
    """
    result = execute_with_retry(
        "get_user_projects_list",
        lambda: supabase.table("projects").select("id, title, brief, status, vm_type, created_at, updated_at").eq("user_id", user_id).neq("content_type", "assignment").order("created_at", desc=True).execute(),
    )
    return result.data or []


def get_user_projects(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all projects for a user with fields needed by dashboard.
    """
    result = execute_with_retry(
        "get_user_projects",
        lambda: supabase.table("projects").select(
            "id, title, brief, status, vm_type, tech_stack, source_assignment_id, created_at, updated_at"
        ).eq("user_id", user_id).order("created_at", desc=True).execute(),
    )
    return result.data or []


# =============================================================================
# CHAT MESSAGE OPERATIONS
# =============================================================================

def save_chat_message(
    user_id: str,
    project_id: str,
    role: str,
    content: str
) -> Dict[str, Any]:
    """
    Save a chat message for a user-project pair.
    """
    if role not in ("user", "assistant"):
        raise ValueError(f"Invalid role: {role}")

    message_data = {
        "user_id": user_id,
        "project_id": project_id,
        "role": role,
        "content": content
    }

    result = supabase.table("chat_messages").insert(message_data).execute()

    if result.data:
        return result.data[0]
    raise Exception("Failed to save chat message")


def get_chat_history(user_id: str, project_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get chat history for a user-project pair, ordered by creation time.
    """
    result = supabase.table("chat_messages").select("*").eq("user_id", user_id).eq("project_id", project_id).order("created_at", desc=False).limit(limit).execute()
    return result.data or []


def clear_chat_history(user_id: str, project_id: str) -> bool:
    """
    Clear all chat messages for a user-project pair.
    """
    result = supabase.table("chat_messages").delete().eq("user_id", user_id).eq("project_id", project_id).execute()
    return True


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


# =============================================================================
# ROLE & CLASSROOM OPERATIONS
# =============================================================================

def _generate_join_code(length: int = 6) -> str:
    """Generate a random alphanumeric uppercase join code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


def update_user_role(user_id: str, role: str) -> Dict[str, Any]:
    """Update a user's role ('student' or 'teacher')."""
    if role not in ('student', 'teacher'):
        raise ValueError(f"Invalid role: {role}")
    result = supabase.table("users").update({"role": role}).eq("id", user_id).execute()
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update role for user {user_id}")


def create_classroom(teacher_id: str, name: str, description: Optional[str] = None) -> Dict[str, Any]:
    """Create a new classroom with a unique join code."""
    # Try up to 5 times to generate a unique code
    for _ in range(5):
        code = _generate_join_code()
        try:
            data = {
                "teacher_id": teacher_id,
                "name": name,
                "description": description,
                "join_code": code,
            }
            result = supabase.table("classrooms").insert(data).execute()
            if result.data:
                return result.data[0]
        except Exception:
            continue
    raise Exception("Failed to create classroom after multiple attempts")


def get_teacher_classrooms(teacher_id: str) -> List[Dict[str, Any]]:
    """List all active classrooms for a teacher."""
    result = supabase.table("classrooms").select("*").eq(
        "teacher_id", teacher_id
    ).eq("is_active", True).order("created_at", desc=True).execute()
    return result.data or []


def get_classroom_by_id(classroom_id: str) -> Optional[Dict[str, Any]]:
    """Get a single classroom by ID."""
    result = supabase.table("classrooms").select("*").eq("id", classroom_id).execute()
    if result.data:
        return result.data[0]
    return None


def get_classroom_by_join_code(code: str) -> Optional[Dict[str, Any]]:
    """Look up an active classroom by its join code."""
    result = supabase.table("classrooms").select("*").eq(
        "join_code", code.upper()
    ).eq("is_active", True).execute()
    if result.data:
        return result.data[0]
    return None


def add_student_to_classroom(classroom_id: str, student_id: str) -> Dict[str, Any]:
    """Add a student to a classroom (upsert to handle duplicates)."""
    data = {"classroom_id": classroom_id, "student_id": student_id}
    result = supabase.table("classroom_members").upsert(
        data, on_conflict="classroom_id,student_id"
    ).execute()
    if result.data:
        return result.data[0]
    raise Exception("Failed to add student to classroom")


def remove_student_from_classroom(classroom_id: str, student_id: str) -> bool:
    """Remove a student from a classroom."""
    supabase.table("classroom_members").delete().eq(
        "classroom_id", classroom_id
    ).eq("student_id", student_id).execute()
    return True


def get_classroom_students(classroom_id: str) -> List[Dict[str, Any]]:
    """Get all students in a classroom with their user info."""
    result = supabase.table("classroom_members").select(
        "*, users:student_id(id, name, email, xp, onboarding, created_at)"
    ).eq("classroom_id", classroom_id).execute()
    return result.data or []


def get_classroom_student_count(classroom_id: str) -> int:
    """Get student count for a classroom."""
    result = supabase.table("classroom_members").select(
        "id", count="exact"
    ).eq("classroom_id", classroom_id).execute()
    return result.count or 0


def get_student_classrooms(student_id: str) -> List[Dict[str, Any]]:
    """Get all classrooms a student belongs to."""
    result = execute_with_retry(
        "get_student_classrooms",
        lambda: supabase.table("classroom_members").select(
            "*, classrooms:classroom_id(id, name, description, join_code, teacher_id, created_at)"
        ).eq("student_id", student_id).execute(),
    )
    return result.data or []


def get_users_by_ids(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Fetch users by IDs in one query and return an id->user mapping."""
    if not user_ids:
        return {}
    unique_ids = list({str(uid) for uid in user_ids if uid})
    if not unique_ids:
        return {}
    result = execute_with_retry(
        "get_users_by_ids",
        lambda: supabase.table("users").select("id, name").in_("id", unique_ids).execute(),
    )
    rows = result.data or []
    return {str(row.get("id")): row for row in rows if row.get("id")}


def deactivate_classroom(classroom_id: str) -> Dict[str, Any]:
    """Soft-delete a classroom by setting is_active=false."""
    result = supabase.table("classrooms").update(
        {"is_active": False}
    ).eq("id", classroom_id).execute()
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to deactivate classroom {classroom_id}")


def regenerate_classroom_join_code(classroom_id: str) -> Dict[str, Any]:
    """Generate and set a new join code for a classroom."""
    new_code = _generate_join_code()
    result = supabase.table("classrooms").update(
        {"join_code": new_code}
    ).eq("id", classroom_id).execute()
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to regenerate join code for classroom {classroom_id}")


def get_student_progress_for_projects(user_id: str) -> List[Dict[str, Any]]:
    """Get all progress records for a student across all their projects."""
    result = supabase.table("user_progress").select(
        "*, tasks:task_id(id, task_id_slug, instruction_theory, milestone_id)"
    ).eq("user_id", user_id).execute()
    return result.data or []


def get_student_projects(user_id: str) -> List[Dict[str, Any]]:
    """Get all projects for a student with milestone and task counts."""
    projects = supabase.table("projects").select("*").eq(
        "user_id", user_id
    ).order("created_at", desc=True).execute()
    return projects.data or []


def get_project_full_detail(project_id: str) -> Optional[Dict[str, Any]]:
    """Get project with milestones and tasks nested."""
    project = get_project_by_id(project_id)
    if not project:
        return None

    milestones = get_project_milestones(project_id)
    for ms in milestones:
        ms['tasks'] = get_milestone_tasks(ms['id'])

    project['milestones'] = milestones
    return project


def get_students_recent_activity(student_ids: List[str], limit: int = 10) -> List[Dict[str, Any]]:
    """Get recent task completions from a list of students."""
    if not student_ids:
        return []
    result = supabase.table("user_progress").select(
        "*, users:user_id(name), tasks:task_id(task_id_slug, milestone_id)"
    ).in_("user_id", student_ids).eq(
        "status", "completed"
    ).order("completed_at", desc=True).limit(limit).execute()
    return result.data or []


def get_students_recent_activity_all(student_ids: List[str], limit: int = 10) -> List[Dict[str, Any]]:
    """Get recent activity including task starts and completions."""
    if not student_ids:
        return []
    result = supabase.table("user_progress").select(
        "*, users:user_id(name), tasks:task_id(task_id_slug, milestone_id)"
    ).in_("user_id", student_ids).in_(
        "status", ["in_progress", "completed"]
    ).order("completed_at", desc=True).limit(limit * 3).execute()
    return result.data or []


def get_students_recent_projects(student_ids: List[str], limit: int = 10) -> List[Dict[str, Any]]:
    """Get recently created projects from a list of students."""
    if not student_ids:
        return []
    result = supabase.table("projects").select(
        "id, title, user_id, created_at, users:user_id(name)"
    ).in_("user_id", student_ids).order(
        "created_at", desc=True
    ).limit(limit).execute()
    return result.data or []


# =============================================================================
# BULK QUERY OPERATIONS (for teacher dashboard performance)
# =============================================================================

def get_bulk_student_progress(student_ids: List[str]) -> List[Dict[str, Any]]:
    """Get all progress records for multiple students in a single query."""
    if not student_ids:
        return []
    result = supabase.table("user_progress").select(
        "*, tasks:task_id(id, task_id_slug, milestone_id)"
    ).in_("user_id", student_ids).execute()
    return result.data or []


def get_bulk_student_projects(student_ids: List[str]) -> List[Dict[str, Any]]:
    """Get all projects for multiple students in a single query."""
    if not student_ids:
        return []
    result = supabase.table("projects").select("*").in_(
        "user_id", student_ids
    ).order("created_at", desc=True).execute()
    return result.data or []


def get_total_tasks_for_projects(project_ids: List[str]) -> Dict[str, int]:
    """
    Get the true total task count for each project by joining
    projects → milestones → tasks.  Returns {project_id: task_count}.
    """
    if not project_ids:
        return {}
    milestones_result = supabase.table("milestones").select(
        "id, project_id"
    ).in_("project_id", project_ids).execute()
    milestones = milestones_result.data or []
    if not milestones:
        return {}

    milestone_to_project = {m['id']: m['project_id'] for m in milestones}
    milestone_ids = list(milestone_to_project.keys())

    tasks_result = supabase.table("tasks").select(
        "id, milestone_id"
    ).in_("milestone_id", milestone_ids).execute()
    tasks = tasks_result.data or []

    counts: Dict[str, int] = {}
    for t in tasks:
        pid = milestone_to_project.get(t['milestone_id'])
        if pid:
            counts[pid] = counts.get(pid, 0) + 1
    return counts


def get_bulk_chat_message_counts(student_ids: List[str], project_ids: List[str]) -> Dict[str, Dict[str, int]]:
    """
    Get chat message counts grouped by user_id and role.
    Returns {user_id: {'user': N, 'assistant': N}}.
    """
    if not student_ids or not project_ids:
        return {}
    result = supabase.table("chat_messages").select(
        "user_id, project_id, role"
    ).in_("user_id", student_ids).in_(
        "project_id", project_ids
    ).execute()
    messages = result.data or []

    counts: Dict[str, Dict[str, int]] = {}
    for m in messages:
        uid = m['user_id']
        role = m.get('role', 'user')
        if uid not in counts:
            counts[uid] = {'user': 0, 'assistant': 0}
        counts[uid][role] = counts[uid].get(role, 0) + 1
    return counts


def get_chat_message_counts_for_student(user_id: str, project_ids: List[str]) -> Dict[str, Dict[str, int]]:
    """
    Get chat message counts per project for a single student, split by role.
    Returns {project_id: {'user': N, 'assistant': N}}.
    """
    if not project_ids:
        return {}
    result = supabase.table("chat_messages").select(
        "project_id, role"
    ).eq("user_id", user_id).in_(
        "project_id", project_ids
    ).execute()
    messages = result.data or []

    counts: Dict[str, Dict[str, int]] = {}
    for m in messages:
        pid = m['project_id']
        role = m.get('role', 'user')
        if pid not in counts:
            counts[pid] = {'user': 0, 'assistant': 0}
        counts[pid][role] = counts[pid].get(role, 0) + 1
    return counts


def get_recent_chat_questions(student_ids: List[str], project_ids: List[str], limit: int = 8) -> List[Dict[str, Any]]:
    """
    Get most recent student chat questions for a classroom's projects.
    """
    if not student_ids or not project_ids:
        return []
    result = execute_with_retry(
        "get_recent_chat_questions",
        lambda: supabase.table("chat_messages").select(
            "user_id, project_id, content, created_at"
        ).in_("user_id", student_ids).in_(
            "project_id", project_ids
        ).eq("role", "user").order("created_at", desc=True).limit(limit).execute(),
    )
    return result.data or []


def update_classroom(classroom_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update classroom name and/or description."""
    allowed = {k: v for k, v in data.items() if k in ('name', 'description')}
    if not allowed:
        raise ValueError("No valid fields to update")
    result = supabase.table("classrooms").update(allowed).eq("id", classroom_id).execute()
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update classroom {classroom_id}")


# =============================================================================
# ASSIGNMENT OPERATIONS
# =============================================================================

def create_assignment(
    template_project_id: str,
    classroom_id: str,
    teacher_id: str,
    title: str,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new assignment linking a template project to a classroom."""
    data = {
        "template_project_id": template_project_id,
        "classroom_id": classroom_id,
        "teacher_id": teacher_id,
        "title": title,
        "description": description,
        "due_date": due_date,
    }
    result = supabase.table("assignments").insert(data).execute()
    if result.data:
        return result.data[0]
    raise Exception("Failed to create assignment")


def get_assignments_for_classroom(classroom_id: str) -> List[Dict[str, Any]]:
    """Get all active assignments for a classroom."""
    result = execute_with_retry(
        "get_assignments_for_classroom",
        lambda: supabase.table("assignments").select("*").eq(
            "classroom_id", classroom_id
        ).eq("is_active", True).order("created_at", desc=True).execute(),
    )
    return result.data or []


def get_assignment_by_id(assignment_id: str) -> Optional[Dict[str, Any]]:
    """Get a single assignment by ID."""
    result = supabase.table("assignments").select("*").eq("id", assignment_id).execute()
    if result.data:
        return result.data[0]
    return None


def get_assignments_with_classrooms(assignment_ids: List[str]) -> List[Dict[str, Any]]:
    """Bulk fetch assignments with classroom name."""
    if not assignment_ids:
        return []
    result = execute_with_retry(
        "get_assignments_with_classrooms",
        lambda: supabase.table("assignments").select(
            "id, classroom_id, classrooms:classroom_id(name)"
        ).in_("id", assignment_ids).execute(),
    )
    return result.data or []


def update_assignment(assignment_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update assignment fields (due_date, description, is_active)."""
    allowed = {k: v for k, v in data.items() if k in ('due_date', 'description', 'is_active')}
    if not allowed:
        raise ValueError("No valid fields to update")
    result = supabase.table("assignments").update(allowed).eq("id", assignment_id).execute()
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update assignment {assignment_id}")


def create_student_assignment(assignment_id: str, student_id: str) -> Dict[str, Any]:
    """Create a student_assignment row with status='not_started'."""
    data = {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": "not_started",
    }
    result = supabase.table("student_assignments").upsert(
        data, on_conflict="assignment_id,student_id"
    ).execute()
    if result.data:
        return result.data[0]
    raise Exception("Failed to create student assignment")


def get_student_assignments_for_user(student_id: str) -> List[Dict[str, Any]]:
    """Get all assignments for a student with assignment and classroom details."""
    result = execute_with_retry(
        "get_student_assignments_for_user",
        lambda: supabase.table("student_assignments").select(
            "*, assignments:assignment_id(id, title, description, due_date, is_active, template_project_id, classroom_id, classrooms:classroom_id(id, name))"
        ).eq("student_id", student_id).execute(),
    )
    rows = result.data or []
    # Filter to only active assignments
    return [r for r in rows if r.get("assignments", {}).get("is_active", False)]


def get_milestones_for_projects(project_ids: List[str]) -> List[Dict[str, Any]]:
    """Bulk-fetch milestones for a set of project IDs."""
    if not project_ids:
        return []
    result = execute_with_retry(
        "get_milestones_for_projects",
        lambda: supabase.table("milestones").select("id, project_id").in_("project_id", project_ids).execute(),
    )
    return result.data or []


def get_tasks_for_milestones(milestone_ids: List[str]) -> List[Dict[str, Any]]:
    """Bulk-fetch tasks for a set of milestone IDs."""
    if not milestone_ids:
        return []
    result = execute_with_retry(
        "get_tasks_for_milestones",
        lambda: supabase.table("tasks").select("id, milestone_id").in_("milestone_id", milestone_ids).execute(),
    )
    return result.data or []


def get_user_progress_for_task_ids(user_id: str, task_ids: List[str]) -> List[Dict[str, Any]]:
    """Bulk-fetch user progress rows for a task ID list."""
    if not task_ids:
        return []
    result = execute_with_retry(
        "get_user_progress_for_task_ids",
        lambda: supabase.table("user_progress").select("task_id, status, completed_at").eq("user_id", user_id).in_("task_id", task_ids).execute(),
    )
    return result.data or []


def get_student_assignments_for_assignment(assignment_id: str) -> List[Dict[str, Any]]:
    """Get all student assignments for an assignment with user names."""
    result = supabase.table("student_assignments").select(
        "*, users:student_id(id, name, email)"
    ).eq("assignment_id", assignment_id).execute()
    return result.data or []


def update_student_assignment(student_assignment_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update a student_assignment row."""
    result = supabase.table("student_assignments").update(data).eq(
        "id", student_assignment_id
    ).execute()
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update student assignment {student_assignment_id}")


def clone_project_for_student(
    template_project_id: str,
    student_id: str,
    assignment_id: str,
) -> Dict[str, Any]:
    """Clone a template project for a student working on an assignment."""
    template = get_project_by_id(template_project_id)
    if not template:
        raise Exception(f"Template project {template_project_id} not found")

    # Create the new project for the student
    project_data = {
        "user_id": student_id,
        "title": template["title"],
        "brief": template.get("brief"),
        "content_type": "assignment",
        "status": "in_progress",
        "requirements": template.get("requirements", []),
        "tech_stack": template.get("tech_stack", []),
        "experience_level": template.get("experience_level"),
        "vm_type": template.get("vm_type", "python"),
        "source_assignment_id": assignment_id,
    }
    result = supabase.table("projects").insert(project_data).execute()
    if not result.data:
        raise Exception("Failed to clone project")
    new_project = result.data[0]

    # Clone milestones and tasks
    milestones = get_project_milestones(template_project_id)
    for ms in milestones:
        new_ms = create_milestone(
            project_id=new_project["id"],
            position=ms["position"],
            title=ms["title"],
            description=ms.get("description", ""),
        )
        tasks = get_milestone_tasks(ms["id"])
        for task in tasks:
            create_task(
                milestone_id=new_ms["id"],
                position=task["position"],
                task_id_slug=task["task_id_slug"],
                instruction_theory=task.get("instruction_theory", ""),
                coding_requirements=task.get("coding_requirements", []),
                hints=task.get("hints", []),
                test_specification=task.get("test_specification", {}),
                starter_code=task.get("starter_code"),
            )

    return new_project


def increment_xp_atomic(user_id: str, amount: int) -> Optional[int]:
    """Atomically increment a user's XP using an RPC call.
    Falls back to read-update if the RPC function doesn't exist."""
    try:
        result = supabase.rpc('increment_xp', {'uid': user_id, 'amount': amount}).execute()
        if result.data is not None:
            return result.data
        # RPC returned void — read back the new value
        user = supabase.table('users').select('xp').eq('id', user_id).single().execute()
        return user.data.get('xp', 0) if user.data else 0
    except Exception:
        # Fallback: non-atomic but functional if RPC not set up yet
        user = supabase.table('users').select('xp').eq('id', user_id).single().execute()
        current_xp = user.data.get('xp', 0) if user.data else 0
        new_xp = current_xp + amount
        supabase.table('users').update({'xp': new_xp}).eq('id', user_id).execute()
        return new_xp
