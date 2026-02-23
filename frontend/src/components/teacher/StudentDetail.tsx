import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { authFetch } from '../../utils/authFetch';
import { formatDuration, vmTypeToLanguage } from '../../utils/formatTime';
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
  TrendingUp,
  Send,
  Loader2,
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
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  passed?: boolean;
  submitted_code?: string;
  feedback?: {
    message?: string;
    teacher_feedback?: string;
    teacher_feedback_at?: string;
    teacher_name?: string;
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

interface PerProjectUsage {
  project_id: string;
  project_title: string;
  student_messages: number;
  assistant_messages: number;
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

interface ClassroomAverages {
  avg_xp: number;
  avg_completion_rate: number;
  avg_tasks_completed: number;
  avg_ai_messages: number;
}

interface StudentData {
  student: Student;
  projects: Project[];
  ai_tutor_usage: {
    total_messages: number;
    student_messages: number;
    assistant_messages: number;
    avg_per_project: number;
    per_project: PerProjectUsage[];
  };
  classroom_averages: ClassroomAverages;
}

interface StudentDetailProps {
  user: User;
}

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

function ComparisonBar({
  label,
  studentValue,
  classAvg,
  suffix = '',
}: {
  label: string;
  studentValue: number;
  classAvg: number;
  suffix?: string;
}) {
  const maxVal = Math.max(studentValue, classAvg, 1);
  const studentPct = (studentValue / maxVal) * 100;
  const classPct = (classAvg / maxVal) * 100;
  const diff = studentValue - classAvg;
  const diffLabel = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  const isAbove = diff >= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`text-xs font-medium ${isAbove ? 'text-green-600' : 'text-amber-600'}`}>
          {diffLabel}{suffix} vs avg
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-14">Student</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all"
              style={{ width: `${studentPct}%` }}
            />
          </div>
          <span className="text-xs font-medium w-16 text-right">{studentValue.toFixed(1)}{suffix}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-14">Class</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-400 rounded-full transition-all"
              style={{ width: `${classPct}%` }}
            />
          </div>
          <span className="text-xs font-medium w-16 text-right">{classAvg.toFixed(1)}{suffix}</span>
        </div>
      </div>
    </div>
  );
}

export function StudentDetail({ user }: StudentDetailProps) {
  const { classroomId, studentId } = useParams<{ classroomId: string; studentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusProjectId = searchParams.get('project');
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [savingFeedback, setSavingFeedback] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!classroomId || !studentId) return;

      try {
        setLoading(true);
        const response = await authFetch(
          `/teacher/classrooms/${classroomId}/students/${studentId}/progress`
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

  // Auto-expand project if linked from assignment page
  useEffect(() => {
    if (focusProjectId && studentData) {
      setExpandedProjects(new Set([focusProjectId]));
    }
  }, [focusProjectId, studentData]);

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

  const handleSaveFeedback = async (task: Task) => {
    const text = feedbackText[task.id]?.trim();
    if (!text || !studentId) return;

    setSavingFeedback(task.id);
    try {
      const response = await authFetch('/teacher/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          task_id: task.id,
          feedback: text,
        }),
      });
      const data = await response.json();
      if (data.success) {
        // Update local state so UI reflects immediately
        setStudentData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            projects: prev.projects.map((p) => ({
              ...p,
              milestones: p.milestones.map((m) => ({
                ...m,
                tasks: m.tasks.map((t) =>
                  t.id === task.id ? { ...t, feedback: data.feedback } : t
                ),
              })),
            })),
          };
        });
        setFeedbackText((prev) => ({ ...prev, [task.id]: '' }));
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
    } finally {
      setSavingFeedback(null);
    }
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

  const { student, projects, ai_tutor_usage, classroom_averages } = studentData;

  // Compute student-level completion rate for comparison
  const totalTasks = projects.reduce((sum, p) => sum + p.tasks_total, 0);
  const completedTasks = projects.reduce((sum, p) => sum + p.tasks_completed, 0);
  const studentCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Per-project AI usage chart data
  const aiUsageChartData = (ai_tutor_usage.per_project || []).map(p => ({
    name: p.project_title.length > 20 ? p.project_title.slice(0, 18) + '...' : p.project_title,
    questions: p.student_messages,
    responses: p.assistant_messages,
  }));

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
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
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
                const lang = vmTypeToLanguage(project.vm_type);
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
                                            {task.feedback?.message && (
                                              <p className="text-sm text-gray-700 mt-2 italic">
                                                AI Feedback: {task.feedback.message}
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
                                          <div className="mt-3 rounded-md overflow-hidden text-sm">
                                            <SyntaxHighlighter
                                              language={lang}
                                              style={oneDark}
                                              showLineNumbers
                                              customStyle={{ margin: 0, borderRadius: '0.375rem' }}
                                            >
                                              {task.submitted_code}
                                            </SyntaxHighlighter>
                                          </div>
                                        )}

                                        {/* Existing teacher feedback */}
                                        {task.feedback?.teacher_feedback && (
                                          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                              <GraduationCap className="h-4 w-4 text-blue-600" />
                                              <span className="text-sm font-medium text-blue-800">
                                                {task.feedback.teacher_name || 'Teacher'} Feedback
                                              </span>
                                              {task.feedback.teacher_feedback_at && (
                                                <span className="text-xs text-blue-500">
                                                  {new Date(task.feedback.teacher_feedback_at).toLocaleDateString()}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-sm text-blue-900">{task.feedback.teacher_feedback}</p>
                                          </div>
                                        )}

                                        {/* Teacher feedback form */}
                                        {task.submitted_code && (
                                          <div className="mt-3">
                                            <textarea
                                              value={feedbackText[task.id] || ''}
                                              onChange={(e) =>
                                                setFeedbackText((prev) => ({ ...prev, [task.id]: e.target.value }))
                                              }
                                              placeholder="Write feedback for this student..."
                                              className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                              rows={2}
                                            />
                                            <Button
                                              size="sm"
                                              onClick={() => handleSaveFeedback(task)}
                                              disabled={!feedbackText[task.id]?.trim() || savingFeedback === task.id}
                                              className="mt-1 bg-blue-600 hover:bg-blue-700 text-white"
                                            >
                                              {savingFeedback === task.id ? (
                                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                              ) : (
                                                <Send className="h-4 w-4 mr-1" />
                                              )}
                                              {task.feedback?.teacher_feedback ? 'Update Feedback' : 'Send Feedback'}
                                            </Button>
                                          </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-teal-50 rounded-lg p-6 border border-teal-200">
                  <div className="text-4xl font-bold text-teal-600 mb-2">
                    {ai_tutor_usage.student_messages}
                  </div>
                  <div className="text-gray-700">Questions Asked</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {ai_tutor_usage.assistant_messages}
                  </div>
                  <div className="text-gray-700">AI Responses</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
                  <div className="text-4xl font-bold text-amber-600 mb-2">
                    {ai_tutor_usage.avg_per_project.toFixed(1)}
                  </div>
                  <div className="text-gray-700">Avg per Project</div>
                </div>
              </div>

              {/* Per-project usage chart */}
              {aiUsageChartData.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Messages per Project</h4>
                  <ResponsiveContainer width="100%" height={Math.max(200, aiUsageChartData.length * 50)}>
                    <BarChart data={aiUsageChartData} layout="vertical" margin={{ left: 120 }}>
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="questions" fill="#14b8a6" name="Questions" stackId="a" />
                      <Bar dataKey="responses" fill="#93c5fd" name="Responses" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700">
                  {student.name} has asked the AI tutor{' '}
                  <strong>{ai_tutor_usage.student_messages}</strong> questions across their
                  projects, receiving{' '}
                  <strong>{ai_tutor_usage.assistant_messages}</strong> responses. This indicates{' '}
                  {ai_tutor_usage.student_messages > 15
                    ? 'high engagement with AI-assisted learning'
                    : ai_tutor_usage.student_messages > 5
                    ? 'moderate use of AI support'
                    : 'some use of AI support'}.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-600" />
                Student vs Class Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <ComparisonBar
                  label="XP"
                  studentValue={student.xp}
                  classAvg={classroom_averages.avg_xp}
                />
                <ComparisonBar
                  label="Completion Rate"
                  studentValue={studentCompletionRate}
                  classAvg={classroom_averages.avg_completion_rate}
                  suffix="%"
                />
                <ComparisonBar
                  label="Tasks Completed"
                  studentValue={completedTasks}
                  classAvg={classroom_averages.avg_tasks_completed}
                />
                <ComparisonBar
                  label="AI Questions Asked"
                  studentValue={ai_tutor_usage.student_messages}
                  classAvg={classroom_averages.avg_ai_messages}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
