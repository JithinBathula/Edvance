import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Plus, FileText, Calendar } from 'lucide-react';

interface AssignmentsTabProps {
  classroomId: string;
  assignments: any[];
  assignmentsLoading: boolean;
}

export function AssignmentsTab({ classroomId, assignments, assignmentsLoading }: AssignmentsTabProps) {
  const navigate = useNavigate();

  if (assignmentsLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading assignments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Classroom Assignments</h3>
        <Button
          onClick={() => navigate(`/teacher/create-assignment?classroom=${classroomId}`)}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Assignment
        </Button>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No assignments yet</p>
            <Button
              onClick={() => navigate(`/teacher/create-assignment?classroom=${classroomId}`)}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Assignment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((assignment) => {
            const stats = assignment.stats || {};
            const total = stats.total || 0;
            const completedCount = stats.completed || 0;
            const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

            return (
              <Card
                key={assignment.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/teacher/classroom/${classroomId}/assignment/${assignment.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-lg line-clamp-1">{assignment.title}</h4>
                    {assignment.due_date && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 ml-2">
                        <Calendar className="h-3 w-3" />
                        {new Date(assignment.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>

                  {assignment.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">{assignment.description}</p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {completedCount}/{total} completed
                      </span>
                      <span className="font-medium text-teal-600">{progressPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{stats.not_started || 0} not started</span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{stats.in_progress || 0} in progress</span>
                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">{completedCount} completed</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
