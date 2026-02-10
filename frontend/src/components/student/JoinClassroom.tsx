import { useState, useEffect } from 'react';
import { authFetch } from '../../utils/authFetch';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Users, LogOut, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface JoinClassroomProps {
  trigger: React.ReactNode;
}

interface Classroom {
  id: string;
  name: string;
  description: string;
  teacher_name: string;
  joined_at: string;
}

export function JoinClassroom({ trigger }: JoinClassroomProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);

  const fetchClassrooms = async () => {
    setLoadingClassrooms(true);
    try {
      const response = await authFetch('/classrooms/my');
      const data = await response.json();
      if (data.success) {
        setClassrooms(data.classrooms);
      }
    } catch (error) {
      console.error('Failed to fetch classrooms:', error);
    } finally {
      setLoadingClassrooms(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchClassrooms();
    }
  }, [open]);

  const handleJoin = async () => {
    if (code.length !== 6) {
      toast.error('Please enter a 6-character code');
      return;
    }

    setJoining(true);
    try {
      const response = await authFetch('/classrooms/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(`Joined ${data.classroom.name}!`);
        setCode('');
        setOpen(false);
        fetchClassrooms();
      } else {
        toast.error(data.error || 'Failed to join classroom');
      }
    } catch (error) {
      toast.error('Failed to join classroom');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async (classroomId: string, classroomName: string) => {
    try {
      const response = await authFetch(`/classrooms/${classroomId}/leave`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        toast.success(`Left ${classroomName}`);
        fetchClassrooms();
      } else {
        toast.error(data.error || 'Failed to leave classroom');
      }
    } catch (error) {
      toast.error('Failed to leave classroom');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Join Classroom</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Enter Classroom Code</label>
            <div className="flex gap-2">
              <Input
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                className="uppercase font-mono"
              />
              <Button onClick={handleJoin} disabled={joining || code.length !== 6}>
                {joining ? 'Joining...' : 'Join'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">My Classrooms</h3>
            {loadingClassrooms ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : classrooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't joined any classrooms yet</p>
            ) : (
              <div className="space-y-2">
                {classrooms.map((classroom) => (
                  <Card key={classroom.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <h4 className="font-medium">{classroom.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{classroom.teacher_name}</span>
                          <Calendar className="h-3 w-3 ml-2" />
                          <span>Joined {new Date(classroom.joined_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLeave(classroom.id, classroom.name)}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
