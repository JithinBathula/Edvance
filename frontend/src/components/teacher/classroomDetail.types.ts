export interface Classroom {
  id: string;
  name: string;
  description: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  xp: number;
  projects_count: number;
  completed_projects: number;
  completion_rate: number;
  tasks_completed: number;
  tasks_total: number;
  last_active: string | null;
  joined_at: string;
}

export interface Analytics {
  progress_distribution: {
    '0-25': number;
    '25-50': number;
    '50-75': number;
    '75-100': number;
  };
  xp_leaderboard: Array<{
    student_name: string;
    xp: number;
    projects_completed: number;
  }>;
  activity_timeline: Array<{
    date: string;
    tasks_completed: number;
    active_students: number;
  }>;
  project_stats: {
    total_started: number;
    total_completed: number;
    avg_xp_per_student: number;
    most_popular_vm: string;
  };
  assignment_analytics: Array<{
    id: string;
    title: string;
    due_date: string | null;
    total: number;
    completed: number;
    in_progress: number;
    not_started: number;
    avg_completion_hours: number | null;
    on_time_count: number;
  }>;
  class_struggles: {
  concept: string;
  student_count: number;
  students: string[];
  student_summaries: Record<string, string>;
  student_task_numbers: Record<string, string>;
  }[];
  ai_usage: {
    total_questions: number;
    total_responses: number;
    avg_per_student: number;
    recent_questions: Array<{
      student_name: string;
      project_title: string;
      content: string;
      created_at: string | null;
      task_number: string | null;
    }>;
  };
  total_tasks_completed: number;
  active_students_7d: number;
}

export type SortColumn = 'name' | 'xp' | 'completion_rate' | 'last_active' | 'tasks_completed';
export type SortDirection = 'asc' | 'desc';
export type StatusFilter = 'all' | 'active' | 'inactive';
