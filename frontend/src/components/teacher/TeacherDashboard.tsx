import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Users,
  Activity,
  Target,
  CheckCircle,
  Plus,
  Copy,
  LogOut,
  GraduationCap,
  Play,
  FolderPlus,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { authFetch } from '../../utils/authFetch';
import { timeAgo } from '../../utils/formatTime';
import { User } from '../../App';

interface TeacherDashboardProps {
  user: User;
  onLogout: () => void;
}

interface DashboardStats {
  total_classrooms: number;
  total_students: number;
  active_students_7d: number;
  avg_completion_rate: number;
  total_tasks_completed: number;
}

interface Classroom {
  id: string;
  name: string;
  join_code: string;
  student_count: number;
  avg_xp: number;
  created_at: string;
}

interface RecentActivity {
  student_name: string;
  action: string;
  task_slug: string;
  timestamp: string;
}

export function TeacherDashboard({ user, onLogout }: TeacherDashboardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total_classrooms: 0,
    total_students: 0,
    active_students_7d: 0,
    avg_completion_rate: 0,
    total_tasks_completed: 0,
  });
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClassroomName, setNewClassroomName] = useState('');
  const [newClassroomDescription, setNewClassroomDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/teacher/dashboard');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setClassrooms(data.classrooms);
        setRecentActivity(data.recent_activity);
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJoinCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Join code copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Failed to copy join code');
    }
  };

  const handleCreateClassroom = async () => {
    if (!newClassroomName.trim()) {
      toast.error('Please enter a classroom name');
      return;
    }

    try {
      setCreating(true);
      const response = await authFetch('/teacher/classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClassroomName.trim(),
          description: newClassroomDescription.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Classroom created successfully');
        setCreateDialogOpen(false);
        setNewClassroomName('');
        setNewClassroomDescription('');
        fetchDashboardData();
      } else {
        toast.error(data.error || 'Failed to create classroom');
      }
    } catch (error) {
      console.error('Error creating classroom:', error);
      toast.error('Failed to create classroom');
    } finally {
      setCreating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getInitialColor = (name: string) => {
    const colors = [
      'bg-teal-500',
      'bg-amber-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-blue-500',
      'bg-pink-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'completed_task':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'started_task':
        return <Play className="h-4 w-4 text-amber-600" />;
      case 'started_project':
        return <FolderPlus className="h-4 w-4 text-teal-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getActivityLabel = (action: string) => {
    switch (action) {
      case 'completed_task':
        return 'completed';
      case 'started_task':
        return 'started working on';
      case 'started_project':
        return 'created project';
      default:
        return action;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <GraduationCap className="mr-2 h-6 w-6 text-teal-600" />
          <span className="bg-gradient-to-r from-teal-600 to-amber-500 bg-clip-text text-xl font-bold text-transparent">
            Edvance
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <button className="flex w-full items-center rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-600">
            <Activity className="mr-3 h-5 w-5" />
            Dashboard
          </button>
          <button
            className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
            disabled
          >
            <Target className="mr-3 h-5 w-5" />
            Settings
          </button>
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-200 p-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user.name}
            </h1>
            <p className="mt-1 text-gray-600">
              Here's what's happening with your classrooms today
            </p>
          </div>

          {/* Section 1: Overview Stats */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Students */}
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
                  <Users className="h-6 w-6 text-teal-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total_students}
                  </p>
                  <p className="text-sm text-gray-600">Total Students</p>
                </div>
              </CardContent>
            </Card>

            {/* Active Students */}
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.active_students_7d}
                  </p>
                  <p className="text-sm text-gray-600">Active Students (7d)</p>
                </div>
              </CardContent>
            </Card>

            {/* Avg Completion Rate */}
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                  <Target className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.avg_completion_rate.toFixed(0)}%
                  </p>
                  <p className="text-sm text-gray-600">Avg Completion Rate</p>
                </div>
              </CardContent>
            </Card>

            {/* Tasks Completed */}
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                  <CheckCircle className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total_tasks_completed}
                  </p>
                  <p className="text-sm text-gray-600">Tasks Completed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 2: Classroom Cards */}
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Your Classrooms
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {classrooms.map((classroom) => (
                <Card
                  key={classroom.id}
                  className="cursor-pointer transition-shadow hover:shadow-lg"
                  onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{classroom.name}</span>
                      <Badge variant="secondary">
                        {classroom.student_count} students
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <code className="rounded bg-gray-100 px-2 py-1 text-sm font-mono">
                          {classroom.join_code}
                        </code>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyJoinCode(classroom.join_code);
                          }}
                          className="rounded p-1 hover:bg-gray-100"
                        >
                          <Copy className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg XP: <span className="font-semibold">{classroom.avg_xp}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Create Classroom Card */}
              <Card
                className="cursor-pointer border-2 border-dashed border-gray-300 transition-all hover:border-teal-500 hover:bg-teal-50"
                onClick={() => setCreateDialogOpen(true)}
              >
                <CardContent className="flex h-full min-h-[140px] flex-col items-center justify-center p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 mb-2">
                    <Plus className="h-6 w-6 text-teal-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    Create Classroom
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Section 3: Recent Activity Feed */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Recent Activity
            </h2>
            <Card>
              <CardContent className="p-0">
                {recentActivity.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No recent activity
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {recentActivity.slice(0, 10).map((activity, index) => (
                      <div key={index} className="flex items-center p-4">
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white ${getInitialColor(
                            activity.student_name
                          )}`}
                        >
                          {getInitials(activity.student_name)}
                        </div>
                        <div className="ml-4 flex-1">
                          <p className="text-sm text-gray-900 flex items-center gap-1.5">
                            {getActivityIcon(activity.action)}
                            <span className="font-medium">
                              {activity.student_name}
                            </span>{' '}
                            {getActivityLabel(activity.action)}{' '}
                            <span className="font-medium">
                              {activity.task_slug}
                            </span>
                          </p>
                        </div>
                        <div className="ml-4 text-sm text-gray-500">
                          {timeAgo(activity.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Create Classroom Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Classroom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label
                htmlFor="classroom-name"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Classroom Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="classroom-name"
                placeholder="e.g., Computer Science 101"
                value={newClassroomName}
                onChange={(e) => setNewClassroomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating) {
                    handleCreateClassroom();
                  }
                }}
              />
            </div>
            <div>
              <label
                htmlFor="classroom-description"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Description (optional)
              </label>
              <Input
                id="classroom-description"
                placeholder="e.g., Introduction to programming with Python"
                value={newClassroomDescription}
                onChange={(e) => setNewClassroomDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating) {
                    handleCreateClassroom();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewClassroomName('');
                setNewClassroomDescription('');
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClassroom}
              disabled={creating || !newClassroomName.trim()}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
