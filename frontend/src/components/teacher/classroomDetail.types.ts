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
    avg_time_per_task_hours: number;
    most_popular_vm: string;
  };
  students_needing_help: Array<{
    student_name: string;
    days_inactive: number;
    stuck_on_task: string;
    reason?: string;
  }>;
}

export type SortColumn = 'name' | 'xp' | 'completion_rate' | 'last_active' | 'tasks_completed';
export type SortDirection = 'asc' | 'desc';
export type StatusFilter = 'all' | 'active' | 'inactive';
