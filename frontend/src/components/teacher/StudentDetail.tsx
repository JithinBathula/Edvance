import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import { User } from '../../App';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  ArrowLeft,
  Code,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Calendar,
  Award,
  GraduationCap,
  MessageSquare,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Task {
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  passed?: boolean;
  submitted_code?: string;
  feedback?: {
    summary?: string;
    [key: string]: any;
  };
  started_at?: string;
  completed_at?: string;
}

interface Milestone {
  title: string;
  tasks: Task[];
}

interface Project {
  id: string;
  title: string;
  status: 'draft' | 'in_progress' | 'completed';
  progress: number;
  tasks_completed: number;
  tasks_total: number;
  vm_type: string;
  created_at: string;
  milestones: Milestone[];
}

interface Student {
  id: string;
  name: string;
  email: string;
  xp: number;
  joined_at: string;
  onboarding?: {
    educationLevel?: string;
    pythonLevel?: string;
  };
  created_at: string;
}

interface StudentData {
  student: Student;
  projects: Project[];
  ai_tutor_usage: {
    total_messages: number;
    avg_per_project: number;
  };
}

interface StudentDetailProps {
  user: User;
}

const formatDuration = (start?: string, end?: string): string => {
  if (!start || !end) return 'N/A';

  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
};

const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'outline' => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'in_progress':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'in_progress':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'not_started':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    case 'draft':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const formatEducationLevel = (level?: string): string => {
  if (!level) return 'N/A';
  const levels: Record<string, string> = {
    'upper-sec': 'Upper Secondary',
    'lower-sec': 'Lower Secondary',
    'primary': 'Primary',
    'tertiary': 'Tertiary',
  };
  return levels[level] || level;
};

const formatPythonLevel = (level?: string): string => {
  if (!level) return 'N/A';
  const levels: Record<string, string> = {
    'level-1': 'Beginner',
    'level-2': 'Intermediate',
    'level-3': 'Advanced',
  };
  return levels[level] || level;
};

export function StudentDetail({ user }: StudentDetailProps) {
  const { classroomId, studentId } = useParams<{ classroomId: string; studentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!classroomId || !studentId) return;

      try {
        setLoading(true);
        const response = await authFetch(
          `${import.meta.env.VITE_BACKEND_URL}/teacher/classrooms/${classroomId}/students/${studentId}/progress`
        );
        const data = await response.json();

        if (data.success) {
          setStudentData(data);
        } else {
          console.error('Failed to fetch student data');
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [classroomId, studentId]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const toggleTaskCode = (taskId: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading student details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-gray-600">Failed to load student data</p>
          <Button
            onClick={() => navigate(`/teacher/classroom/${classroomId}`)}
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { student, projects, ai_tutor_usage } = studentData;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/teacher/classroom/${classroomId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Classroom
        </Button>

        <div className="bg-white rounded-lg border p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{student.name}</h1>
          <p className="text-gray-600 mb-4">{student.email}</p>

          <div className="flex flex-wrap gap-3">
            <Badge className="bg-teal-100 text-teal-800 border-teal-200 px-3 py-1">
              <Award className="h-4 w-4 mr-1 inline" />
              {student.xp} XP
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <GraduationCap className="h-4 w-4 mr-1 inline" />
              {formatEducationLevel(student.onboarding?.educationLevel)}
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <Code className="h-4 w-4 mr-1 inline" />
              Python: {formatPythonLevel(student.onboarding?.pythonLevel)}
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <Calendar className="h-4 w-4 mr-1 inline" />
              Joined {new Date(student.joined_at || student.created_at).toLocaleDateString()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects" className="mt-6">
          <div className="space-y-4">
            {projects.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-600">
                  No projects yet
                </CardContent>
              </Card>
            ) : (
              projects.map((project) => {
                const isExpanded = expandedProjects.has(project.id);
                return (
                  <Card key={project.id} className="overflow-hidden">
                    <CardHeader className="bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">{project.title}</CardTitle>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge className={getStatusColor(project.status)}>
                              {project.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline">{project.vm_type}</Badge>
                            <Badge variant="outline">
                              {project.tasks_completed}/{project.tasks_total} tasks
                            </Badge>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-teal-600 h-2 rounded-full transition-all"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleProjectExpanded(project.id)}
                          className="ml-4"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="p-6">
                        {project.milestones.length === 0 ? (
                          <p className="text-gray-600 text-sm">No milestones yet</p>
                        ) : (
                          <div className="space-y-6">
                            {project.milestones.map((milestone, mIndex) => (
                              <div key={mIndex} className="border-l-2 border-teal-200 pl-4">
                                <h4 className="font-semibold text-gray-900 mb-3">
                                  {milestone.title}
                                </h4>
                                <div className="space-y-3">
                                  {milestone.tasks.map((task, tIndex) => {
                                    const taskId = `${project.id}-${mIndex}-${tIndex}`;
                                    const isTaskExpanded = expandedTasks.has(taskId);

                                    return (
                                      <div
                                        key={tIndex}
                                        className="bg-gray-50 rounded-lg p-4 border"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                              <h5 className="font-medium text-gray-900">
                                                {task.title}
                                              </h5>
                                              <Badge
                                                className={`${getStatusColor(task.status)} text-xs`}
                                              >
                                                {task.status.replace('_', ' ')}
                                              </Badge>
                                              {task.status === 'completed' &&
                                                task.passed !== undefined && (
                                                  <span className="ml-1">
                                                    {task.passed ? (
                                                      <CheckCircle className="h-4 w-4 text-green-600 inline" />
                                                    ) : (
                                                      <XCircle className="h-4 w-4 text-red-600 inline" />
                                                    )}
                                                  </span>
                                                )}
                                            </div>
                                            {task.started_at && task.completed_at && (
                                              <p className="text-sm text-gray-600">
                                                Time taken:{' '}
                                                {formatDuration(
                                                  task.started_at,
                                                  task.completed_at
                                                )}
                                              </p>
                                            )}
                                            {task.feedback?.summary && (
                                              <p className="text-sm text-gray-700 mt-2 italic">
                                                Feedback: {task.feedback.summary}
                                              </p>
                                            )}
                                          </div>
                                          {task.submitted_code && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => toggleTaskCode(taskId)}
                                              className="ml-2"
                                            >
                                              <Code className="h-4 w-4 mr-1" />
                                              {isTaskExpanded ? 'Hide' : 'View'} Code
                                            </Button>
                                          )}
                                        </div>
                                        {isTaskExpanded && task.submitted_code && (
                                          <pre className="mt-3 bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                                            <code>{task.submitted_code}</code>
                                          </pre>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* AI Usage Tab */}
        <TabsContent value="ai-usage" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-teal-600" />
                AI Tutor Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-teal-50 rounded-lg p-6 border border-teal-200">
                  <div className="text-4xl font-bold text-teal-600 mb-2">
                    {ai_tutor_usage.total_messages}
                  </div>
                  <div className="text-gray-700">Total Messages</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
                  <div className="text-4xl font-bold text-amber-600 mb-2">
                    {ai_tutor_usage.avg_per_project.toFixed(1)}
                  </div>
                  <div className="text-gray-700">Average per Project</div>
                </div>
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700">
                  {student.name} has actively engaged with the AI tutor, sending a total of{' '}
                  <strong>{ai_tutor_usage.total_messages}</strong> messages across their
                  projects. This averages to approximately{' '}
                  <strong>{ai_tutor_usage.avg_per_project.toFixed(1)}</strong> messages per
                  project, indicating{' '}
                  {ai_tutor_usage.avg_per_project > 15
                    ? 'high engagement with AI-assisted learning'
                    : ai_tutor_usage.avg_per_project > 5
                    ? 'moderate use of AI support'
                    : 'some use of AI support'}.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
