import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import { timeAgo, isInactiveForDays } from '../../utils/formatTime';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
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
import { Search, ArrowUpDown, Trophy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Student, SortColumn, SortDirection, StatusFilter } from './classroomDetail.types';

interface StudentsTabProps {
  students: Student[];
  classroomId: string;
  onStudentRemoved: (studentId: string) => void;
}

export function StudentsTab({ students, classroomId, onStudentRemoved }: StudentsTabProps) {
  const navigate = useNavigate();

  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);
  const [removing, setRemoving] = useState(false);

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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        s => s.name.toLowerCase().includes(q) || (s.email && s.email.toLowerCase().includes(q))
      );
    }

    if (statusFilter === 'active') {
      result = result.filter(s => !isInactiveForDays(s.last_active));
    } else if (statusFilter === 'inactive') {
      result = result.filter(s => isInactiveForDays(s.last_active));
    }

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
        onStudentRemoved(studentToRemove.id);
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

  return (
    <>
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
                <SortHeader column="completion_rate">Completion</SortHeader>
                <SortHeader column="last_active">Last Active</SortHeader>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
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
    </>
  );
}
