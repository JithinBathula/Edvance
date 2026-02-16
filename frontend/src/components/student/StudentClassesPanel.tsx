import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { User } from '../../App';
import { authFetch } from '../../utils/authFetch';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { JoinClassroom } from './JoinClassroom';
import {
  BookOpen,
  Calendar,
  Loader2,
  MessageSquare,
  RefreshCw,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

interface Classroom {
  id: string;
  name: string;
  description: string;
  teacher_name: string;
  joined_at: string;
}

interface AssignedProject {
  id: string;
  assignment_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  classroom_name: string;
  classroom_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  project_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  template_project_id: string;
}

interface TaskFeedback {
  teacher_feedback?: string;
  teacher_feedback_at?: string;
  teacher_name?: string;
}

interface ProjectTask {
  id: string;
  title: string;
  feedback?: TaskFeedback | null;
}

interface ProjectDetail {
  id: string;
  title: string;
  tasks?: ProjectTask[];
}

interface FeedbackSnippet {
  task_id: string;
  project_id: string;
  project_title: string;
  teacher_feedback: string;
  teacher_feedback_at: string | null;
  teacher_name: string;
}

type Props = {
  user: User;
  onSelectProject: (project: any) => void;
  animationKey?: number;
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export function StudentClassesPanel({ user, onSelectProject, animationKey }: Props) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<AssignedProject[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectActionLoading, setProjectActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [projectCache, setProjectCache] = useState<Record<string, ProjectDetail>>({});

  const fetchClassesData = useCallback(async (isRefresh = false, refreshClassroomId?: string | null) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [classroomsRes, assignmentsRes] = await Promise.all([
        authFetch('/classrooms/my'),
        authFetch('/assignments/my'),
      ]);

      const classroomsData = await classroomsRes.json();
      const assignmentsData = await assignmentsRes.json();

      if (classroomsData.success) {
        const nextClassrooms = classroomsData.classrooms || [];
        setClassrooms(nextClassrooms);
        setSelectedClassroomId((prev) => {
          if (prev && nextClassrooms.some((c: Classroom) => c.id === prev)) return prev;
          return nextClassrooms[0]?.id || null;
        });
      } else {
        toast.error(classroomsData.error || 'Failed to load classrooms');
      }

      if (assignmentsData.success) {
        const nextAssignments = assignmentsData.assignments || [];
        setAssignments(nextAssignments);

        if (isRefresh && refreshClassroomId) {
          const projectIdsToRefetch = nextAssignments
            .filter((a: AssignedProject) => a.classroom_id === refreshClassroomId)
            .map((a: AssignedProject) => a.project_id)
            .filter((id: string | null): id is string => Boolean(id));

          if (projectIdsToRefetch.length > 0) {
            setProjectCache((prev) => {
              const next = { ...prev };
              for (const projectId of projectIdsToRefetch) {
                delete next[projectId];
              }
              return next;
            });
          }
        }
      } else {
        toast.error(assignmentsData.error || 'Failed to load class projects');
      }
    } catch (error) {
      console.error('Failed to fetch classes data:', error);
      toast.error('Failed to load classes data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchClassesData();
  }, [fetchClassesData, user.id]);

  const selectedClassroom = useMemo(
    () => classrooms.find((c) => c.id === selectedClassroomId) || null,
    [classrooms, selectedClassroomId]
  );

  const classAssignments = useMemo(
    () => assignments.filter((a) => a.classroom_id === selectedClassroomId),
    [assignments, selectedClassroomId]
  );

  useEffect(() => {
    const hydrateFeedbackProjects = async () => {
      if (!selectedClassroomId) return;

      const projectIds = classAssignments
        .map((a) => a.project_id)
        .filter((id): id is string => Boolean(id))
        .filter((projectId) => !projectCache[projectId]);

      if (projectIds.length === 0) {
        setFeedbackLoading(false);
        return;
      }

      try {
        setFeedbackLoading(true);
        const details = await Promise.all(
          projectIds.map(async (projectId) => {
            const response = await authFetch(`/progress/projects/${projectId}/full`);
            const data = await response.json();
            if (!data.success || !data.project) return null;
            return data.project as ProjectDetail;
          })
        );

        setProjectCache((prev) => {
          const next = { ...prev };
          for (const detail of details) {
            if (detail?.id) next[detail.id] = detail;
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to load class feedback details:', error);
      } finally {
        setFeedbackLoading(false);
      }
    };

    void hydrateFeedbackProjects();
  }, [classAssignments, selectedClassroomId, projectCache]);

  const latestFeedback = useMemo(() => {
    const snippets: FeedbackSnippet[] = [];

    for (const assignment of classAssignments) {
      const projectId = assignment.project_id;
      if (!projectId) continue;

      const project = projectCache[projectId];
      if (!project?.tasks?.length) continue;

      for (const task of project.tasks) {
        const feedback = task.feedback;
        if (!feedback?.teacher_feedback) continue;

        snippets.push({
          task_id: task.id,
          project_id: projectId,
          project_title: assignment.title || project.title || 'Class Project',
          teacher_feedback: feedback.teacher_feedback,
          teacher_feedback_at: feedback.teacher_feedback_at || null,
          teacher_name: feedback.teacher_name || 'Teacher',
        });
      }
    }

    snippets.sort((a, b) => {
      if (!a.teacher_feedback_at && !b.teacher_feedback_at) return 0;
      if (!a.teacher_feedback_at) return 1;
      if (!b.teacher_feedback_at) return -1;
      return new Date(b.teacher_feedback_at).getTime() - new Date(a.teacher_feedback_at).getTime();
    });

    return snippets.slice(0, 5);
  }, [classAssignments, projectCache]);

  const handleOpenProject = async (projectId: string, loadingKey: string) => {
    setProjectActionLoading(loadingKey);
    try {
      const response = await authFetch(`/progress/projects/${projectId}/full`);
      const data = await response.json();
      if (data.success && data.project) {
        onSelectProject(data.project);
      } else {
        toast.error(data.error || 'Failed to open project');
      }
    } catch (error) {
      console.error('Failed to open class project:', error);
      toast.error('Failed to open project');
    } finally {
      setProjectActionLoading(null);
    }
  };

  const handleStartAssignment = async (assignmentId: string, loadingKey: string) => {
    setProjectActionLoading(loadingKey);
    try {
      const response = await authFetch(`/assignments/${assignmentId}/start`, { method: 'POST' });
      const data = await response.json();
      if (!data.success || !data.project?.id) {
        toast.error(data.error || 'Failed to start assignment');
        return;
      }

      const fullProjectRes = await authFetch(`/progress/projects/${data.project.id}/full`);
      const fullProjectData = await fullProjectRes.json();
      if (fullProjectData.success && fullProjectData.project) {
        onSelectProject(fullProjectData.project);
        toast.success('Assignment started');
      } else {
        toast.error(fullProjectData.error || 'Failed to load assignment project');
      }
    } catch (error) {
      console.error('Failed to start class assignment:', error);
      toast.error('Failed to start assignment');
    } finally {
      setProjectActionLoading(null);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const dueStyle = (dueDate?: string | null) => {
    if (!dueDate) return 'text-slate-400';
    const now = new Date();
    const due = new Date(dueDate);
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'text-red-600';
    if (daysLeft <= 3) return 'text-amber-600';
    return 'text-slate-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (classrooms.length === 0) {
    return (
      <Card className="p-8 border-slate-100 text-center">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-800 mb-1">No classes yet</h3>
        <p className="text-sm text-slate-500 mb-5">Join a classroom to see class projects and feedback here.</p>
        <JoinClassroom
          trigger={
            <Button className="bg-teal-600 hover:bg-teal-700">
              Join Classroom
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div key={animationKey} className="space-y-4">
      <motion.div variants={staggerItem} initial="hidden" animate="visible" custom={0}>
      <Card className="p-4 border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">My Classes</h2>
            <p className="text-sm text-slate-500">
              Open class projects and review your latest teacher feedback.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchClassesData(true, selectedClassroomId)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Refresh
            </Button>
            <JoinClassroom
              trigger={
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                  Join Class
                </Button>
              }
            />
          </div>
        </div>
      </Card>
      </motion.div>

      <motion.div variants={staggerItem} initial="hidden" animate="visible" custom={1}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <Card className="p-3 border-slate-100">
            <div className="space-y-2">
              {classrooms.map((classroom) => {
                const active = classroom.id === selectedClassroomId;
                const assignmentCount = assignments.filter((a) => a.classroom_id === classroom.id).length;
                return (
                  <button
                    key={classroom.id}
                    onClick={() => setSelectedClassroomId(classroom.id)}
                    className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                      active
                        ? 'border-teal-200 bg-teal-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-slate-800">{classroom.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{classroom.teacher_name}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Joined {formatDate(classroom.joined_at)}</span>
                      <span>{assignmentCount} project{assignmentCount === 1 ? '' : 's'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="col-span-8 space-y-4">
          <Card className="p-4 border-slate-100">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-slate-800">
                {selectedClassroom?.name || 'Class'}
              </h3>
              <p className="text-sm text-slate-500">
                {selectedClassroom?.description || 'Class projects assigned by your teacher'}
              </p>
            </div>

            {classAssignments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No class projects yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classAssignments.map((assignment) => {
                  const loadingKey = assignment.assignment_id;
                  const isLoading = projectActionLoading === loadingKey;
                  const isStarted = Boolean(assignment.project_id);
                  return (
                    <Card key={assignment.id} className="p-4 border-slate-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-800">{assignment.title}</h4>
                            <Badge
                              className={
                                assignment.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : assignment.status === 'in_progress'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                              }
                            >
                              {assignment.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {assignment.description && (
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{assignment.description}</p>
                          )}
                          <div className={`mt-2 text-xs flex items-center gap-1 ${dueStyle(assignment.due_date)}`}>
                            <Calendar className="w-3 h-3" />
                            Due {formatDate(assignment.due_date)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (isStarted && assignment.project_id) {
                              void handleOpenProject(assignment.project_id, loadingKey);
                            } else {
                              void handleStartAssignment(assignment.assignment_id, loadingKey);
                            }
                          }}
                          disabled={isLoading}
                          className="bg-teal-600 hover:bg-teal-700"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isStarted ? 'Open' : 'Start'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>

          <motion.div variants={staggerItem} initial="hidden" animate="visible" custom={2}>
          <Card className="p-4 border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-teal-600" />
              <h3 className="text-base font-semibold text-slate-800">Latest Teacher Feedback</h3>
            </div>
            {feedbackLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                Loading feedback...
              </div>
            ) : latestFeedback.length === 0 ? (
              <p className="text-sm text-slate-500">No teacher feedback yet for this class.</p>
            ) : (
              <div className="space-y-3">
                {latestFeedback.map((item) => (
                  <div key={`${item.project_id}:${item.task_id}`} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">{item.project_title}</p>
                      <p className="text-xs text-slate-400">{formatDate(item.teacher_feedback_at)}</p>
                    </div>
                    <p className="text-sm text-slate-700 mt-1 line-clamp-2">{item.teacher_feedback}</p>
                    <p className="text-xs text-slate-400 mt-1">From {item.teacher_name}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
          </motion.div>
        </div>
      </div>
      </motion.div>
    </div>
  );
}
