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
import { ArrowLeft, CheckCircle, Loader2, BookOpen, ChevronDown, Lightbulb, Code, Pencil, Save, Plus, X } from 'lucide-react';
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

  // Editable tasks state
  const [editedTasks, setEditedTasks] = useState<any[]>([]);
  const [savingTasks, setSavingTasks] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);

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
    setEditedTasks(JSON.parse(JSON.stringify(project.tasks || [])));
    setHasEdits(false);
    setPhase('assign');
  };

  const updateTask = (taskIdx: number, field: string, value: any) => {
    setEditedTasks((prev) => {
      const next = [...prev];
      next[taskIdx] = { ...next[taskIdx], [field]: value };
      return next;
    });
    setHasEdits(true);
  };

  const updateCodingReq = (taskIdx: number, reqIdx: number, value: string) => {
    setEditedTasks((prev) => {
      const next = [...prev];
      const reqs = [...(next[taskIdx].codingRequirements || [])];
      reqs[reqIdx] = value;
      next[taskIdx] = { ...next[taskIdx], codingRequirements: reqs };
      return next;
    });
    setHasEdits(true);
  };

  const addCodingReq = (taskIdx: number) => {
    setEditedTasks((prev) => {
      const next = [...prev];
      const reqs = [...(next[taskIdx].codingRequirements || []), ''];
      next[taskIdx] = { ...next[taskIdx], codingRequirements: reqs };
      return next;
    });
    setHasEdits(true);
  };

  const removeCodingReq = (taskIdx: number, reqIdx: number) => {
    setEditedTasks((prev) => {
      const next = [...prev];
      const reqs = [...(next[taskIdx].codingRequirements || [])];
      reqs.splice(reqIdx, 1);
      next[taskIdx] = { ...next[taskIdx], codingRequirements: reqs };
      return next;
    });
    setHasEdits(true);
  };

  const updateHint = (taskIdx: number, hintIdx: number, value: string) => {
    setEditedTasks((prev) => {
      const next = [...prev];
      const hints = [...(next[taskIdx].hints || [])];
      hints[hintIdx] = value;
      next[taskIdx] = { ...next[taskIdx], hints };
      return next;
    });
    setHasEdits(true);
  };

  const addHint = (taskIdx: number) => {
    setEditedTasks((prev) => {
      const next = [...prev];
      next[taskIdx] = { ...next[taskIdx], hints: [...(next[taskIdx].hints || []), ''] };
      return next;
    });
    setHasEdits(true);
  };

  const removeHint = (taskIdx: number, hintIdx: number) => {
    setEditedTasks((prev) => {
      const next = [...prev];
      const hints = [...(next[taskIdx].hints || [])];
      hints.splice(hintIdx, 1);
      next[taskIdx] = { ...next[taskIdx], hints };
      return next;
    });
    setHasEdits(true);
  };

  const handleSaveTasks = async () => {
    if (!templateProject?.id) return;
    setSavingTasks(true);
    try {
      const payload = editedTasks.map((t) => ({
        id: t.id,
        instruction_theory: t.description,
        coding_requirements: t.codingRequirements || [],
        hints: t.hints || [],
      }));
      const response = await authFetch(`/teacher/projects/${templateProject.id}/tasks`, {
        method: 'PUT',
        body: JSON.stringify({ tasks: payload }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Tasks saved');
        setHasEdits(false);
      } else {
        toast.error(data.error || 'Failed to save tasks');
      }
    } catch (err) {
      console.error('Error saving tasks:', err);
      toast.error('Failed to save tasks');
    } finally {
      setSavingTasks(false);
    }
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
      // Save any pending task edits first
      if (hasEdits) {
        const savePayload = editedTasks.map((t) => ({
          id: t.id,
          instruction_theory: t.description,
          coding_requirements: t.codingRequirements || [],
          hints: t.hints || [],
        }));
        await authFetch(`/teacher/projects/${templateProject.id}/tasks`, {
          method: 'PUT',
          body: JSON.stringify({ tasks: savePayload }),
        });
      }

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
  // Use editedTasks so edits are reflected
  const tasksByMilestone: Record<string, { task: any; globalIdx: number }[]> = {};
  for (let i = 0; i < editedTasks.length; i++) {
    const task = editedTasks[i];
    const [milestone] = (task.title as string).split(': ', 1);
    const key = milestone || 'Tasks';
    if (!tasksByMilestone[key]) tasksByMilestone[key] = [];
    tasksByMilestone[key].push({ task, globalIdx: i });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setPhase('planning')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Review & Edit Project</h1>
              <p className="text-xs text-gray-500">Edit tasks before assigning to a classroom</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasEdits && (
              <Button
                variant="outline"
                onClick={handleSaveTasks}
                disabled={savingTasks}
                className="border-teal-300 text-teal-700 hover:bg-teal-50"
              >
                {savingTasks ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Save Changes</>
                )}
              </Button>
            )}
            <Button
              onClick={() => setAssignDialogOpen(true)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Assign to Classroom
            </Button>
          </div>
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
          <div className="flex items-center gap-2 mt-3">
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-sm text-gray-500">
              {editedTasks.length} tasks across {Object.keys(tasksByMilestone).length} milestones — click any task to edit
            </p>
          </div>
        </Card>

        {/* Milestones + tasks */}
        {Object.entries(tasksByMilestone).map(([milestone, entries], mIdx) => (
          <Card key={mIdx} className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold">
                {mIdx + 1}
              </div>
              <h3 className="text-lg font-semibold">{milestone}</h3>
            </div>
            <div className="space-y-2 ml-11">
              {entries.map(({ task, globalIdx }, tIdx) => {
                const taskName = (task.title as string).includes(': ')
                  ? (task.title as string).split(': ').slice(1).join(': ')
                  : task.title;
                const codingReqs: string[] = task.codingRequirements || task.testSpec?.coding_requirements || [];
                return (
                  <details key={tIdx} className="border rounded-lg bg-white group shadow-sm">
                    <summary className="flex items-center gap-3 p-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 rounded-lg transition-colors">
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform group-open:rotate-180" />
                      <div className="w-6 h-6 rounded bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {tIdx + 1}
                      </div>
                      <span className="font-medium text-sm text-gray-900">{taskName}</span>
                      <Pencil className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                    </summary>
                    <div className="px-5 pb-5 space-y-4 border-t pt-4 mx-1">
                      {/* Instructions (editable) */}
                      <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="w-4 h-4 text-teal-600" />
                          <h5 className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Instructions</h5>
                        </div>
                        <textarea
                          value={task.description || ''}
                          onChange={(e) => updateTask(globalIdx, 'description', e.target.value)}
                          rows={6}
                          className="w-full rounded-md border border-teal-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-y font-mono"
                          placeholder="Task instructions (supports Markdown)..."
                        />
                      </div>

                      {/* Coding Requirements (editable) */}
                      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Code className="w-4 h-4 text-blue-600" />
                            <h5 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Coding Requirements</h5>
                          </div>
                          <button
                            onClick={() => addCodingReq(globalIdx)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {codingReqs.map((req: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              <input
                                type="text"
                                value={req}
                                onChange={(e) => updateCodingReq(globalIdx, i, e.target.value)}
                                className="flex-1 rounded border border-blue-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                              />
                              <button
                                onClick={() => removeCodingReq(globalIdx, i)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {codingReqs.length === 0 && (
                            <p className="text-xs text-gray-400 italic">No coding requirements. Click "Add" to create one.</p>
                          )}
                        </div>
                      </div>

                      {/* Hints (editable) */}
                      <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-600" />
                            <h5 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Hints</h5>
                          </div>
                          <button
                            onClick={() => addHint(globalIdx)}
                            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(task.hints || []).map((hint: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="bg-amber-200 text-amber-800 text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0">
                                {i + 1}
                              </span>
                              <input
                                type="text"
                                value={hint}
                                onChange={(e) => updateHint(globalIdx, i, e.target.value)}
                                className="flex-1 rounded border border-amber-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                              />
                              <button
                                onClick={() => removeHint(globalIdx, i)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {(!task.hints || task.hints.length === 0) && (
                            <p className="text-xs text-gray-400 italic">No hints. Click "Add" to create one.</p>
                          )}
                        </div>
                      </div>
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
