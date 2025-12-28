"""
Supabase Client for Edvance Backend
Provides helper functions for database operations.
"""
import os
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

def create_user(name: str, email: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new user in the database.
    Returns the created user record.
    """
    user_data = {
        "name": name.strip(),
        "email": email,
        "xp": 0,
        "onboarding": None
    }
    
    result = supabase.table("users").insert(user_data).execute()
    
    if result.data:
        return result.data[0]
    raise Exception("Failed to create user")


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


def update_user_xp(user_id: str, xp_to_add: int) -> Dict[str, Any]:
    """
    Add XP to a user's total.
    """
    # First get current XP
    user = get_user_by_id(user_id)
    if not user:
        raise Exception(f"User {user_id} not found")
    
    new_xp = user.get("xp", 0) + xp_to_add
    
    result = supabase.table("users").update({
        "xp": new_xp
    }).eq("id", user_id).execute()
    
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update XP for user {user_id}")


# =============================================================================
# PROJECT OPERATIONS
# =============================================================================

def create_project(
    user_id: str,
    title: str,
    brief: str,
    requirements: List[str],
    tech_stack: List[str],
    experience_level: str,
    content_type: str = "custom_project"
) -> Dict[str, Any]:
    """
    Create a new project record.
    """
    project_data = {
        "user_id": user_id,
        "title": title,
        "brief": brief,
        "content_type": content_type,
        "status": "draft",
        "requirements": requirements,
        "tech_stack": tech_stack,
        "experience_level": experience_level
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


def get_user_projects(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all projects for a user.
    """
    result = supabase.table("projects").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return result.data or []


def update_project_status(project_id: str, status: str) -> Dict[str, Any]:
    """
    Update a project's status.
    """
    if status not in ("draft", "in_progress", "completed"):
        raise ValueError(f"Invalid status: {status}")
    
    result = supabase.table("projects").update({
        "status": status
    }).eq("id", project_id).execute()
    
    if result.data:
        return result.data[0]
    raise Exception(f"Failed to update project {project_id}")


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

def get_or_create_progress(user_id: str, task_id: str) -> Dict[str, Any]:
    """
    Get existing progress or create a new record for a user-task pair.
    """
    # Try to find existing progress
    result = supabase.table("user_progress").select("*").eq("user_id", user_id).eq("task_id", task_id).execute()
    
    if result.data:
        return result.data[0]
    
    # Create new progress record
    progress_data = {
        "user_id": user_id,
        "task_id": task_id,
        "status": "not_started",
        "passed": False
    }
    
    result = supabase.table("user_progress").insert(progress_data).execute()
    
    if result.data:
        return result.data[0]
    raise Exception("Failed to create progress record")


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
    """
    update_data = {}
    
    if status is not None:
        if status not in ("not_started", "in_progress", "completed"):
            raise ValueError(f"Invalid status: {status}")
        update_data["status"] = status
        
        if status == "in_progress" and "started_at" not in update_data:
            update_data["started_at"] = datetime.utcnow().isoformat()
        elif status == "completed":
            update_data["completed_at"] = datetime.utcnow().isoformat()
    
    if submitted_code is not None:
        update_data["submitted_code"] = submitted_code
    
    if passed is not None:
        update_data["passed"] = passed
    
    if feedback is not None:
        update_data["feedback"] = feedback
    
    if not update_data:
        return get_or_create_progress(user_id, task_id)
    
    result = supabase.table("user_progress").update(update_data).eq("user_id", user_id).eq("task_id", task_id).execute()
    
    if result.data:
        return result.data[0]
    raise Exception("Failed to update progress")


def get_user_progress_for_project(user_id: str, project_id: str) -> List[Dict[str, Any]]:
    """
    Get all progress records for a user within a specific project.
    Joins through milestones and tasks.
    """
    # Get all milestones for the project
    milestones = get_project_milestones(project_id)
    milestone_ids = [m["id"] for m in milestones]
    
    if not milestone_ids:
        return []
    
    # Get all tasks for these milestones
    all_tasks = []
    for mid in milestone_ids:
        tasks = get_milestone_tasks(mid)
        all_tasks.extend(tasks)
    
    task_ids = [t["id"] for t in all_tasks]
    
    if not task_ids:
        return []
    
    # Get progress for these tasks
    result = supabase.table("user_progress").select("*").eq("user_id", user_id).in_("task_id", task_ids).execute()
    
    return result.data or []
