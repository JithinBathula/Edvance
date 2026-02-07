-- =============================================================================
-- Edvance Database Schema
-- Run this in the Supabase SQL Editor to create all required tables.
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- PROJECTS TABLE
-- Stores both Custom Projects and future Course content
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    brief TEXT,
    content_type TEXT NOT NULL DEFAULT 'custom_project' CHECK (content_type IN ('custom_project', 'course')),
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
-- CODE_VERSIONS TABLE
-- Stores versioned code snapshots for each user-task pair
-- =============================================================================
CREATE TABLE IF NOT EXISTS code_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, task_id, version_number)
);

-- Indexes for code version queries
CREATE INDEX IF NOT EXISTS idx_code_versions_user_task ON code_versions(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_code_versions_version ON code_versions(user_id, task_id, version_number DESC);

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
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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
-- COURSES TABLE
-- Stores course metadata (e.g., Python Fundamentals)
-- =============================================================================
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    theme TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_theme ON courses(theme);

-- =============================================================================
-- COURSE_LESSONS TABLE
-- Individual lessons within a course
-- =============================================================================
CREATE TABLE IF NOT EXISTS course_lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    challenge_description TEXT,
    starter_code TEXT,
    hints TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_course_id ON course_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_position ON course_lessons(course_id, position);

-- =============================================================================
-- COURSE_LESSON_TASKS TABLE
-- Practice tasks within a lesson
-- =============================================================================
CREATE TABLE IF NOT EXISTS course_lesson_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    task_description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_lesson_tasks_lesson_id ON course_lesson_tasks(lesson_id);

-- =============================================================================
-- COURSE_LESSON_HIGHLIGHTS TABLE
-- Teaching highlights/tips for each lesson
-- =============================================================================
CREATE TABLE IF NOT EXISTS course_lesson_highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    heading TEXT NOT NULL,
    detail TEXT,
    icon_name TEXT DEFAULT 'BookOpen',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_lesson_highlights_lesson_id ON course_lesson_highlights(lesson_id);

-- =============================================================================
-- USER_COURSE_PROGRESS TABLE
-- Tracks user progress through courses
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_course_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    completed_lessons TEXT[] DEFAULT '{}',
    current_lesson_id UUID REFERENCES course_lessons(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_user_course_progress_user_id ON user_course_progress(user_id);

-- Trigger for user_course_progress updated_at
CREATE TRIGGER update_user_course_progress_updated_at
    BEFORE UPDATE ON user_course_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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
CREATE TRIGGER update_repo_files_updated_at
    BEFORE UPDATE ON repo_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
