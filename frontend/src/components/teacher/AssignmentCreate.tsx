import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '../../App';
import { authFetch } from '../../utils/authFetch';
import { CustomProjectChat } from '../CustomProjectChat';
import { ProjectPlanning } from '../ProjectPlanning';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { ArrowLeft, CheckCircle, Loader2, BookOpen, ChevronDown, Lightbulb, ClipboardCheck, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface AssignmentCreateProps {
  user: User;
  onLogout: () => void;
}

type Phase = 'chat' | 'planning' | 'assign';

interface Classroom {
  id: string;
  name: string;
  student_count: number;
}

export function AssignmentCreate({ user, onLogout }: AssignmentCreateProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClassroom = searchParams.get('classroom');

  const [phase, setPhase] = useState<Phase>('chat');
  const [requirements, setRequirements] = useState<any>(null);
  const [templateProject, setTemplateProject] = useState<any>(null);

  // Assign phase state
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState(preselectedClassroom || '');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      const response = await authFetch('/teacher/dashboard');
      const data = await response.json();
      if (data.success && data.classrooms) {
        setClassrooms(data.classrooms.map((c: any) => ({
          id: c.id,
          name: c.name,
          student_count: c.student_count,
        })));
      }
    } catch (err) {
      console.error('Error fetching classrooms:', err);
    }
  };

  const handleRequirementsReady = (data: any) => {
    const outlineVmType = data?.outline?.vm_type || data?.outline?.vmType;
    const reqs = {
      session: data.session || data.session_data,
      outline: data.outline,
      experienceLevel: data.experienceLevel || user.onboarding?.pythonLevel || 'beginner',
      vmType: data.vm_type || data.vmType || outlineVmType || 'python',
    };
    setRequirements(reqs);
    setPhase('planning');
  };

  const handleProjectReady = (project: any) => {
    setTemplateProject(project);
    setPhase('assign');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedClassroomId) {
      toast.error('Please select a classroom');
      return;
    }
    if (!templateProject?.id) {
      toast.error('Template project is missing');
      return;
    }

    setAssigning(true);
    try {
      const response = await authFetch('/assignments/', {
        method: 'POST',
        body: JSON.stringify({
          template_project_id: templateProject.id,
          classroom_id: selectedClassroomId,
          title: templateProject.title || 'Untitled Assignment',
          description: description.trim() || templateProject.brief || null,
          due_date: dueDate || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Assignment created successfully!');
        navigate(`/teacher/classroom/${selectedClassroomId}`);
      } else {
        toast.error(data.error || 'Failed to create assignment');
      }
    } catch (err) {
      console.error('Error creating assignment:', err);
      toast.error('Failed to create assignment');
    } finally {
      setAssigning(false);
    }
  };

  // Phase 1: Chat
  if (phase === 'chat') {
    return (
      <CustomProjectChat
        user={user}
        onProjectCreated={handleRequirementsReady}
        onBack={() => navigate('/teacher/dashboard')}
      />
    );
  }

  // Phase 2: Planning
  if (phase === 'planning' && requirements) {
    return (
      <ProjectPlanning
        user={user}
        requirements={requirements}
        onProjectReady={handleProjectReady}
        onBack={() => setPhase('chat')}
        contentType="assignment_template"
      />
    );
  }

  // Phase 3: Review project + Assign
  // Group tasks by milestone (title format is "Milestone: task_slug")
  const tasksByMilestone: Record<string, any[]> = {};
  for (const task of templateProject?.tasks || []) {
    const [milestone] = (task.title as string).split(': ', 1);
    const key = milestone || 'Tasks';
    if (!tasksByMilestone[key]) tasksByMilestone[key] = [];
    tasksByMilestone[key].push(task);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setPhase('planning')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Review Project</h1>
          </div>
          <Button
            onClick={() => setAssignDialogOpen(true)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            Assign to Classroom
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Project overview */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{templateProject?.title}</h2>
              <p className="text-gray-600 text-sm">{templateProject?.brief}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            {templateProject?.tasks?.length || 0} tasks across {Object.keys(tasksByMilestone).length} milestones
          </p>
        </Card>

        {/* Milestones + tasks */}
        {Object.entries(tasksByMilestone).map(([milestone, tasks], mIdx) => (
          <Card key={mIdx} className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold">
                {mIdx + 1}
              </div>
              <h3 className="text-lg font-semibold">{milestone}</h3>
            </div>
            <div className="space-y-2 ml-11">
              {tasks.map((task: any, tIdx: number) => {
                const taskName = (task.title as string).includes(': ')
                  ? (task.title as string).split(': ').slice(1).join(': ')
                  : task.title;
                const codingReqs: string[] = task.testSpec?.coding_requirements || task.codingRequirements || [];
                return (
                  <details key={tIdx} className="border rounded-lg bg-white group shadow-sm">
                    <summary className="flex items-center gap-3 p-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 rounded-lg transition-colors">
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform group-open:rotate-180" />
                      <div className="w-6 h-6 rounded bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {tIdx + 1}
                      </div>
                      <span className="font-medium text-sm text-gray-900">{taskName}</span>
                    </summary>
                    <div className="px-5 pb-5 space-y-4 border-t pt-4 mx-1">
                      {/* Instructions */}
                      <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="w-4 h-4 text-teal-600" />
                          <h5 className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Instructions</h5>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-700 [&_p]:mb-2 [&_ul]:ml-4 [&_ol]:ml-4 [&_li]:mb-1 [&_code]:bg-teal-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-teal-800 [&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:rounded-md [&_pre]:p-3">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.description || ''}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Coding Requirements */}
                      {codingReqs.length > 0 && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Code className="w-4 h-4 text-blue-600" />
                            <h5 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Coding Requirements</h5>
                          </div>
                          <ul className="space-y-1.5">
                            {codingReqs.map((req: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Hints */}
                      {task.hints?.length > 0 && (
                        <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-4 h-4 text-amber-600" />
                            <h5 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Hints</h5>
                          </div>
                          <div className="space-y-2">
                            {task.hints.map((hint: string, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="bg-amber-200 text-amber-800 text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <span>{hint}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grading / Test Specification */}
                      {task.testSpec && Object.keys(task.testSpec).length > 0 && (
                        <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <ClipboardCheck className="w-4 h-4 text-purple-600" />
                            <h5 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Grading Criteria</h5>
                          </div>
                          {task.testSpec.criteria ? (
                            <ul className="space-y-1.5">
                              {(Array.isArray(task.testSpec.criteria) ? task.testSpec.criteria : [task.testSpec.criteria]).map((c: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <pre className="text-xs text-gray-700 bg-white rounded-md p-3 border border-purple-100 overflow-x-auto font-mono">
                              {JSON.stringify(task.testSpec, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Classroom</DialogTitle>
            <DialogDescription>
              Choose a classroom and optional due date for "{templateProject?.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Classroom <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a classroom...</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.student_count} students)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional instructions for students..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Due Date (optional)
              </label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || !selectedClassroomId}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
