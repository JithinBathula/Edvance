import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import { timeAgo, isInactiveForDays } from '../../utils/formatTime';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  Users,
  Clock,
  Target,
  AlertCircle,
  Trophy,
  Activity,
  Search,
  ArrowUpDown,
  Download,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { User } from '../../App';

interface ClassroomDetailProps {
  user: User;
  onLogout: () => void;
}

interface Classroom {
  id: string;
  name: string;
  description: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
}

interface Student {
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

interface Analytics {
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

type SortColumn = 'name' | 'xp' | 'completion_rate' | 'last_active' | 'tasks_completed';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export function ClassroomDetail({ user, onLogout }: ClassroomDetailProps) {
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activeTab, setActiveTab] = useState('students');
  const [regenerating, setRegenerating] = useState(false);

  // Sorting & filtering state
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Edit classroom dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Remove student dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    fetchClassroomData();
  }, [classroomId]);

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      fetchAnalytics();
    }
  }, [activeTab]);

  const fetchClassroomData = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`/teacher/classrooms/${classroomId}`);
      const data = await response.json();

      if (data.success) {
        setClassroom(data.classroom);
        setStudents(data.students);
      } else {
        toast.error('Failed to load classroom data');
      }
    } catch (error) {
      console.error('Error fetching classroom:', error);
      toast.error('Failed to load classroom');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await authFetch(`/teacher/classrooms/${classroomId}/analytics`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data);
      } else {
        toast.error('Failed to load analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    }
  };

  const handleRegenerateCode = async () => {
    try {
      setRegenerating(true);
      const response = await authFetch(`/teacher/classrooms/${classroomId}/regenerate-code`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        setClassroom(prev => prev ? { ...prev, join_code: data.join_code } : null);
        toast.success('Join code regenerated successfully');
      } else {
        toast.error('Failed to regenerate join code');
      }
    } catch (error) {
      console.error('Error regenerating code:', error);
      toast.error('Failed to regenerate join code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (classroom?.join_code) {
      navigator.clipboard.writeText(classroom.join_code);
      toast.success('Join code copied to clipboard');
    }
  };

  const handleEditClassroom = async () => {
    if (!editName.trim()) {
      toast.error('Classroom name is required');
      return;
    }
    try {
      setSaving(true);
      const response = await authFetch(`/teacher/classrooms/${classroomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setClassroom(data.classroom);
        setEditDialogOpen(false);
        toast.success('Classroom updated');
      } else {
        toast.error(data.error || 'Failed to update classroom');
      }
    } catch (error) {
      console.error('Error updating classroom:', error);
      toast.error('Failed to update classroom');
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = () => {
    if (classroom) {
      setEditName(classroom.name);
      setEditDescription(classroom.description || '');
      setEditDialogOpen(true);
    }
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;
    try {
      setRemoving(true);
      const response = await authFetch(
        `/teacher/classrooms/${classroomId}/students/${studentToRemove.id}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (data.success) {
        setStudents(prev => prev.filter(s => s.id !== studentToRemove.id));
        setRemoveDialogOpen(false);
        setStudentToRemove(null);
        toast.success('Student removed from classroom');
      } else {
        toast.error(data.error || 'Failed to remove student');
      }
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error('Failed to remove student');
    } finally {
      setRemoving(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await authFetch(`/teacher/classrooms/${classroomId}/export`);
      if (!response.ok) {
        toast.error('Failed to export CSV');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${classroom?.name || 'classroom'}_students.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  // ── Sorting & filtering logic ──
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'name' ? 'asc' : 'desc');
    }
  };

  const filteredAndSortedStudents = useMemo(() => {
    let result = [...students];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        s => s.name.toLowerCase().includes(q) || (s.email && s.email.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(s => !isInactiveForDays(s.last_active));
    } else if (statusFilter === 'inactive') {
      result = result.filter(s => isInactiveForDays(s.last_active));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'xp':
          cmp = a.xp - b.xp;
          break;
        case 'completion_rate':
          cmp = a.completion_rate - b.completion_rate;
          break;
        case 'tasks_completed':
          cmp = a.tasks_completed - b.tasks_completed;
          break;
        case 'last_active': {
          const aTime = a.last_active ? new Date(a.last_active).getTime() : 0;
          const bTime = b.last_active ? new Date(b.last_active).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [students, searchQuery, statusFilter, sortColumn, sortDirection]);

  const SortHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-gray-50"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortColumn === column ? 'text-teal-600' : 'text-gray-400'}`} />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading classroom...</p>
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Classroom not found</p>
          <Button onClick={() => navigate('/teacher/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Transform progress distribution for chart
  const progressDistributionData = [
    { range: '0-25%', count: analytics?.progress_distribution['0-25'] || 0 },
    { range: '25-50%', count: analytics?.progress_distribution['25-50'] || 0 },
    { range: '50-75%', count: analytics?.progress_distribution['50-75'] || 0 },
    { range: '75-100%', count: analytics?.progress_distribution['75-100'] || 0 },
  ];

  // Top 10 XP leaderboard
  const topLeaderboard = analytics?.xp_leaderboard.slice(0, 10) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/teacher/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900">{classroom.name}</h1>
                <button
                  onClick={openEditDialog}
                  className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                  title="Edit classroom"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-gray-600">{classroom.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Badge variant="secondary" className="text-base px-4 py-2">
                <Users className="h-4 w-4 mr-2" />
                {students.length} Students
              </Badge>
            </div>
          </div>

          {/* Join Code */}
          <div className="mt-6 flex items-center gap-3">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-sm text-gray-600">Join Code:</span>
              <code className="text-lg font-mono font-semibold text-teal-600">
                {classroom.join_code}
              </code>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateCode}
              disabled={regenerating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Students Tab */}
          <TabsContent value="students">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Student Roster</CardTitle>
                    <CardDescription>
                      Click on a student to view detailed progress
                    </CardDescription>
                  </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Students</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader column="name">Name</SortHeader>
                      <SortHeader column="xp">XP</SortHeader>
                      <TableHead>Projects</TableHead>
                      <SortHeader column="completion_rate">Completion</SortHeader>
                      <SortHeader column="last_active">Last Active</SortHeader>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                          {students.length === 0
                            ? 'No students in this classroom yet'
                            : 'No students match the filter'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedStudents.map((student) => (
                        <TableRow
                          key={student.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => navigate(`/teacher/classroom/${classroomId}/student/${student.id}`)}
                        >
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Trophy className="h-4 w-4 text-amber-500" />
                              <span className="font-semibold">{student.xp}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {student.completed_projects}/{student.projects_count}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-teal-600 transition-all"
                                  style={{ width: `${student.completion_rate}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">
                                {student.completion_rate}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{timeAgo(student.last_active)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={isInactiveForDays(student.last_active) ? 'secondary' : 'default'}
                              className={
                                isInactiveForDays(student.last_active)
                                  ? 'bg-gray-200 text-gray-700'
                                  : 'bg-green-100 text-green-700'
                              }
                            >
                              {isInactiveForDays(student.last_active) ? 'Inactive' : 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStudentToRemove(student);
                                setRemoveDialogOpen(true);
                              }}
                              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                              title="Remove student"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            {!analytics ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading analytics...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Students Needing Help Alert */}
                {analytics.students_needing_help.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-900">
                        <AlertCircle className="h-5 w-5" />
                        Students Needing Help
                      </CardTitle>
                      <CardDescription className="text-amber-700">
                        These students may be stuck or disengaged
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics.students_needing_help.map((student, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-amber-200 rounded-lg p-4 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-semibold text-gray-900">{student.student_name}</p>
                              <p className="text-sm text-gray-600">
                                Stuck on: {student.stuck_on_task}
                              </p>
                            </div>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                              {student.days_inactive === -1
                                ? 'No activity'
                                : `${student.days_inactive}d inactive`}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Time Per Task</CardTitle>
                      <Clock className="h-4 w-4 text-teal-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analytics.project_stats.avg_time_per_task_hours.toFixed(1)}h
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Average across all tasks</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Project Completion</CardTitle>
                      <Target className="h-4 w-4 text-teal-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analytics.project_stats.total_started > 0
                          ? Math.round((analytics.project_stats.total_completed / analytics.project_stats.total_started) * 100)
                          : 0}%
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {analytics.project_stats.total_completed} of {analytics.project_stats.total_started} started
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Most Popular VM</CardTitle>
                      <Activity className="h-4 w-4 text-teal-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analytics.project_stats.most_popular_vm || 'N/A'}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Preferred environment</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Need Help</CardTitle>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analytics.students_needing_help.length}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Students needing attention</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Progress Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Progress Distribution</CardTitle>
                      <CardDescription>
                        Student distribution across completion ranges
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={progressDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Activity Timeline */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Activity Timeline</CardTitle>
                      <CardDescription>
                        Last 30 days of classroom activity
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={analytics.activity_timeline}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(date) => new Date(date).toLocaleDateString()}
                          />
                          <Area
                            type="monotone"
                            dataKey="tasks_completed"
                            stroke="#14b8a6"
                            fill="#14b8a6"
                            fillOpacity={0.6}
                            name="Tasks Completed"
                          />
                          <Area
                            type="monotone"
                            dataKey="active_students"
                            stroke="#f59e0b"
                            fill="transparent"
                            strokeWidth={2}
                            name="Active Students"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* XP Leaderboard */}
                <Card>
                  <CardHeader>
                    <CardTitle>XP Leaderboard</CardTitle>
                    <CardDescription>
                      Top 10 students by experience points
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={topLeaderboard}
                        layout="vertical"
                        margin={{ left: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          type="category"
                          dataKey="student_name"
                          width={100}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="xp"
                          fill="url(#colorXp)"
                          radius={[0, 8, 8, 0]}
                        />
                        <defs>
                          <linearGradient id="colorXp" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#0d9488" />
                            <stop offset="100%" stopColor="#14b8a6" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Classroom Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Classroom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Classroom Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Classroom name"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>
              <Input
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleEditClassroom} disabled={saving || !editName.trim()} className="bg-teal-600 hover:bg-teal-700">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Student Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{studentToRemove?.name}</strong> from this
              classroom? Their project data will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveDialogOpen(false);
                setStudentToRemove(null);
              }}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveStudent}
              disabled={removing}
              className="bg-red-600 hover:bg-red-700"
            >
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
