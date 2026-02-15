import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  Users,
  Download,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import type { Classroom, Student, Analytics } from './classroomDetail.types';
import { AnalyticsTab } from './AnalyticsTab';
import { StudentsTab } from './StudentsTab';
import { AssignmentsTab } from './AssignmentsTab';

interface ClassroomDetailProps {
  user: User;
  onLogout: () => void;
}

export function ClassroomDetail({ user, onLogout }: ClassroomDetailProps) {
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activeTab, setActiveTab] = useState('analytics');
  const [regenerating, setRegenerating] = useState(false);

  // Edit classroom dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Assignments state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  useEffect(() => {
    fetchClassroomData();
  }, [classroomId]);

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      fetchAnalytics();
    }
    if (activeTab === 'assignments' && assignments.length === 0) {
      fetchAssignments();
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

  const fetchAssignments = async () => {
    try {
      setAssignmentsLoading(true);
      const response = await authFetch(`/assignments/classroom/${classroomId}`);
      const data = await response.json();

      if (data.success) {
        setAssignments(data.assignments);
      } else {
        toast.error('Failed to load assignments');
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load assignments');
    } finally {
      setAssignmentsLoading(false);
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

  const handleStudentRemoved = (studentId: string) => {
    setStudents(prev => prev.filter(s => s.id !== studentId));
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
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsTab analytics={analytics} />
          </TabsContent>

          <TabsContent value="students">
            <StudentsTab
              students={students}
              classroomId={classroomId!}
              onStudentRemoved={handleStudentRemoved}
            />
          </TabsContent>

          <TabsContent value="assignments">
            <AssignmentsTab
              classroomId={classroomId!}
              assignments={assignments}
              assignmentsLoading={assignmentsLoading}
            />
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
    </div>
  );
}
