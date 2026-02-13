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
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
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

  // Phase 3: Assign (shown as dialog over a success state)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Project Template Ready</h2>
        <p className="text-gray-600 mb-6">
          "{templateProject?.title}" is ready. Assign it to a classroom.
        </p>
        <Button
          onClick={() => setAssignDialogOpen(true)}
          className="bg-teal-600 hover:bg-teal-700"
        >
          Assign to Classroom
        </Button>
      </Card>

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
