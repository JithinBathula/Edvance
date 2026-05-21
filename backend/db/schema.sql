-- =============================================================================
-- Edvance Database Schema
-- Run this in the Supabase SQL Editor to create all required tables.
-- Safe to re-run. Also create two Storage buckets: code-repos (private) and avatars (public).
-- =============================================================================

-- Enable UUID extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE
-- After Supabase Auth migration: users.id = auth.users.id (same UUID).
-- password_hash removed (Supabase Auth handles passwords).
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    onboarding JSONB DEFAULT NULL,
    xp INTEGER DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- AUTO-CREATE PROFILE ON SUPABASE AUTH SIGNUP
-- Run this in the Supabase SQL Editor (requires access to auth.users)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, name, email, xp, onboarding)
    VALUES (
        NEW.id,  -- same UUID as auth.users.id
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
        NEW.email,
        0,
        NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- PROJECTS TABLE
-- Stores Custom Projects and Assignments
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    brief TEXT,
    content_type TEXT NOT NULL DEFAULT 'custom_project',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
    requirements JSONB DEFAULT '[]'::jsonb,
    tech_stack JSONB DEFAULT '[]'::jsonb,
    experience_level TEXT,
    vm_type TEXT NOT NULL DEFAULT 'python' CHECK (vm_type IN ('python', 'javascript')),
    repo_path TEXT,
    repo_default_branch TEXT DEFAULT 'main',
    codesandbox_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- =============================================================================
-- MILESTONES TABLE
-- High-level groupings of tasks within a project
-- =============================================================================
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ordering milestones within a project
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_position ON milestones(project_id, position);

-- =============================================================================
-- TASKS TABLE
-- Individual coding steps within a milestone
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    task_id_slug TEXT NOT NULL,
    instruction_theory TEXT,
    coding_requirements TEXT[] DEFAULT '{}',
    hints TEXT[] DEFAULT '{}',
    test_specification JSONB DEFAULT '{}'::jsonb,
    starter_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ordering tasks within a milestone
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(milestone_id, position);

-- =============================================================================
-- USER_PROGRESS TABLE
-- Tracks a user's state on each task
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    submitted_code TEXT,
    passed BOOLEAN DEFAULT FALSE,
    feedback JSONB DEFAULT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one progress record per user per task
    UNIQUE(user_id, task_id)
);

-- Indexes for progress queries
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_task_id ON user_progress(task_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_status ON user_progress(status);

-- =============================================================================
-- HELPER FUNCTION: Update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - Optional, enable if using Supabase Auth
-- =============================================================================
-- Uncomment these if you want to enable RLS with Supabase Auth:
--
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Users can view own data" ON users
--     FOR SELECT USING (auth.uid() = id);
--
-- CREATE POLICY "Users can view own projects" ON projects
--     FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- REPO_FILES TABLE
-- File metadata for cloud storage (actual files stored in Supabase Storage)
-- =============================================================================
CREATE TABLE IF NOT EXISTS repo_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    language TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_repo_files_project ON repo_files(project_id);

-- Add storage_type column to projects table for migration tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS storage_type TEXT DEFAULT 'local';

-- Trigger for repo_files updated_at
DROP TRIGGER IF EXISTS update_repo_files_updated_at ON repo_files;
CREATE TRIGGER update_repo_files_updated_at
    BEFORE UPDATE ON repo_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TEACHER/CLASSROOM TABLES
-- =============================================================================

-- Add role column to users table (defaults to 'student' for existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'teacher'));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Teacher settings (classroom defaults, preferences)
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_settings JSONB DEFAULT '{}'::jsonb;
-- Public URL of the avatar uploaded via POST /api/users/profile-picture (Storage bucket: avatars, public)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- =============================================================================
-- CLASSROOMS TABLE
-- A teacher can create classrooms; students join via a 6-char code.
-- =============================================================================
CREATE TABLE IF NOT EXISTS classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    join_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_join_code ON classrooms(join_code);

DROP TRIGGER IF EXISTS update_classrooms_updated_at ON classrooms;
CREATE TRIGGER update_classrooms_updated_at
    BEFORE UPDATE ON classrooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CLASSROOM_MEMBERS TABLE
-- Junction table linking students to classrooms.
-- =============================================================================
CREATE TABLE IF NOT EXISTS classroom_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(classroom_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_student ON classroom_members(student_id);

-- =============================================================================
-- ATOMIC XP INCREMENT FUNCTION
-- Used by submission endpoint to avoid race conditions on concurrent XP updates.
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_xp(uid UUID, amount INT)
RETURNS void AS $$
  UPDATE users SET xp = xp + amount WHERE id = uid;
$$ LANGUAGE sql;

-- =============================================================================
-- ASSIGNMENTS TABLES
-- Teachers assign template projects to classrooms; students get cloned copies.
-- =============================================================================

-- Add source_assignment_id to projects (links cloned student project back to assignment)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_assignment_id UUID;
-- Add assignment_template to content_type check
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_content_type_check;
ALTER TABLE projects ADD CONSTRAINT projects_content_type_check
    CHECK (content_type IN ('custom_project', 'assignment_template', 'assignment'));

CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_project_id, classroom_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_classroom ON assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);

-- Add FK constraint for source_assignment_id after assignments table exists
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_source_assignment_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_source_assignment_id_fkey
    FOREIGN KEY (source_assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS student_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_assignments_student ON student_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_assignment ON student_assignments(assignment_id);

-- =============================================================================
-- WAITLIST TABLE
-- Collects email + phone from the waitlist landing page (waitlist.edvance.fun)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Prevent duplicate email signups
ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_email_unique;
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_email_unique UNIQUE (email);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist (created_at DESC);

-- Enable RLS: allow anonymous inserts only (frontend uses anon key)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.waitlist;
CREATE POLICY "Allow anonymous inserts" ON public.waitlist
    FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read all" ON public.waitlist;
CREATE POLICY "Service role can read all" ON public.waitlist
    FOR SELECT TO service_role USING (true);

-- =============================================================================
-- CHAT_MESSAGES TABLE
-- Conversation history between a student and the assistant (Cody) per project.
-- =============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    task_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_project
    ON chat_messages(user_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project ON chat_messages(project_id);

-- =============================================================================
-- REQUIREMENT_SESSIONS TABLE
-- Persisted state for the requirement-gathering chat (one row per session).
-- =============================================================================
CREATE TABLE IF NOT EXISTS requirement_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_idea TEXT,
    ready_to_plan BOOLEAN NOT NULL DEFAULT FALSE,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    decision_log JSONB NOT NULL DEFAULT '[]'::jsonb,
    tool_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    turn_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requirement_sessions_user ON requirement_sessions(user_id);

-- =============================================================================
-- STUDENT_CONCEPTS TABLE
-- Per-student concept mastery/struggle signals written by the concept tracker.
-- =============================================================================
CREATE TABLE IF NOT EXISTS student_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    latest_signal TEXT NOT NULL CHECK (latest_signal IN ('struggle', 'mastery')),
    struggle_count INTEGER NOT NULL DEFAULT 0,
    mastery_count INTEGER NOT NULL DEFAULT 0,
    last_source TEXT,
    last_task_number TEXT,
    last_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    summary TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, concept)
);

CREATE INDEX IF NOT EXISTS idx_student_concepts_user ON student_concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_student_concepts_weak
    ON student_concepts(user_id, latest_signal, struggle_count DESC);
