import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { User } from '../App';
import { authFetch } from '../utils/authFetch';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Plus, FolderOpen, Clock, Loader2, Calendar, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

type Project = {
    id: string;
    title: string;
    brief: string;
    status: 'draft' | 'in_progress' | 'completed';
    created_at: string;
    vm_type?: string;
};

type AssignedProject = {
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
};

type Props = {
    user: User;
    onSelectProject: (project: any) => void;
    onCreateNew: () => void;
    onBack: () => void;
    embedded?: boolean;
    animationKey?: number;
};

const staggerItem = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
    }),
};

export function ProjectList({ user, onSelectProject, onCreateNew, onBack, embedded, animationKey }: Props) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingProject, setLoadingProject] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'my' | 'assigned'>('my');
    const [assignedProjects, setAssignedProjects] = useState<AssignedProject[]>([]);
    const [assignedLoading, setAssignedLoading] = useState(false);
    const [startingAssignment, setStartingAssignment] = useState<string | null>(null);
    const projectsFetchInFlightRef = useRef(false);
    const assignmentsFetchInFlightRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        fetchProjects();
        fetchAssignedProjects();
        return () => {
            isMountedRef.current = false;
        };
    }, [user.id]);

    const fetchProjects = async () => {
        if (projectsFetchInFlightRef.current) return;
        projectsFetchInFlightRef.current = true;
        try {
            const response = await authFetch('/progress/projects');
            const data = await response.json();
            if (data.success) {
                if (isMountedRef.current) setProjects(data.projects);
            }
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            projectsFetchInFlightRef.current = false;
            if (isMountedRef.current) setLoading(false);
        }
    };

    const fetchAssignedProjects = async () => {
        if (assignmentsFetchInFlightRef.current) return;
        assignmentsFetchInFlightRef.current = true;
        try {
            if (isMountedRef.current) setAssignedLoading(true);
            const response = await authFetch('/assignments/my');
            const data = await response.json();
            if (data.success) {
                if (isMountedRef.current) setAssignedProjects(data.assignments);
            }
        } catch (err) {
            console.error('Error fetching assignments:', err);
        } finally {
            assignmentsFetchInFlightRef.current = false;
            if (isMountedRef.current) setAssignedLoading(false);
        }
    };

    const handleSelectProject = async (projectId: string) => {
        setLoadingProject(projectId);
        try {
            const response = await authFetch(`/progress/projects/${projectId}/full`);
            const data = await response.json();
            if (data.success) {
                onSelectProject(data.project);
            }
        } catch (err) {
            console.error('Error loading project:', err);
        } finally {
            setLoadingProject(null);
        }
    };

    const handleStartAssignment = async (assignmentId: string) => {
        setStartingAssignment(assignmentId);
        try {
            const response = await authFetch(`/assignments/${assignmentId}/start`, {
                method: 'POST',
            });
            const data = await response.json();
            if (data.success && data.project) {
                // Transform the full project detail into the workspace format
                const project = data.project;
                const transformed = {
                    id: project.id,
                    title: project.title,
                    brief: project.brief,
                    vm_type: project.vm_type,
                    tasks: (project.milestones || []).flatMap((milestone: any, mIdx: number) =>
                        (milestone.tasks || []).map((task: any, tIdx: number) => ({
                            id: task.id || `${mIdx}-${tIdx}`,
                            title: `${milestone.title}: ${task.task_id_slug}`,
                            description: task.instruction_theory,
                            hints: task.hints,
                            starterCode: task.starter_code || '# Write your code here\n',
                            testSpec: task.test_specification,
                        }))
                    ),
                };
                onSelectProject(transformed);
                toast.success('Assignment started!');
            } else {
                toast.error(data.error || 'Failed to start assignment');
            }
        } catch (err) {
            console.error('Error starting assignment:', err);
            toast.error('Failed to start assignment');
        } finally {
            setStartingAssignment(null);
        }
    };

    const handleContinueAssignment = async (projectId: string) => {
        setLoadingProject(projectId);
        try {
            const response = await authFetch(`/progress/projects/${projectId}/full`);
            const data = await response.json();
            if (data.success) {
                onSelectProject(data.project);
            }
        } catch (err) {
            console.error('Error loading project:', err);
        } finally {
            setLoadingProject(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-700';
            case 'in_progress': return 'bg-blue-100 text-blue-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getDueDateStyle = (dueDate: string | null) => {
        if (!dueDate) return '';
        const now = new Date();
        const due = new Date(dueDate);
        const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilDue < 0) return 'text-red-600 font-medium';
        if (daysUntilDue <= 3) return 'text-amber-600 font-medium';
        return 'text-gray-500';
    };

    const content = (
        <div key={animationKey}>
            {/* Tabs */}
            <motion.div variants={staggerItem} initial="hidden" animate="visible" custom={0} className={embedded ? "" : "max-w-6xl mx-auto px-4 pt-6"}>
                <div className="flex gap-1 bg-white rounded-lg p-1 w-fit border">
                    <button
                        onClick={() => setActiveTab('my')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'my'
                                ? 'bg-[#7622e5] text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        My Projects
                    </button>
                    <button
                        onClick={() => setActiveTab('assigned')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                            activeTab === 'assigned'
                                ? 'bg-[#7622e5] text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        Assigned
                        {assignedProjects.length > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                activeTab === 'assigned'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-[#7622e5]/10 text-[#7622e5]'
                            }`}>
                                {assignedProjects.length}
                            </span>
                        )}
                    </button>
                </div>
            </motion.div>

            <motion.div variants={staggerItem} initial="hidden" animate="visible" custom={1} className={embedded ? "py-4" : "max-w-6xl mx-auto px-4 py-6"}>
                {activeTab === 'my' ? (
                    /* My Projects Tab */
                    <>
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-[#7622e5]" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Create New Project Card */}
                                <motion.div variants={staggerItem} initial="hidden" animate="visible" custom={2}>
                                <Card
                                    className="p-6 border-2 border-dashed border-gray-300 hover:border-[#7622e5] cursor-pointer transition-colors group flex flex-col items-center justify-center min-h-[200px]"
                                    onClick={onCreateNew}
                                >
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Plus className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-700">Create New Project</h3>
                                    <p className="text-sm text-gray-500 text-center mt-2">
                                        Start a new custom learning project
                                    </p>
                                </Card>
                                </motion.div>

                                {/* Existing Projects */}
                                {projects.map((project, i) => (
                                    <motion.div key={project.id} variants={staggerItem} initial="hidden" animate="visible" custom={3 + i}>
                                    <Card
                                        className="p-6 hover:shadow-lg cursor-pointer transition-shadow bg-white h-full"
                                        onClick={() => handleSelectProject(project.id)}
                                    >
                                        {loadingProject === project.id ? (
                                            <div className="flex items-center justify-center h-full min-h-[150px]">
                                                <Loader2 className="w-6 h-6 animate-spin text-[#7622e5]" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ffa200] to-[#ff8800] flex items-center justify-center">
                                                        <FolderOpen className="w-5 h-5 text-white" />
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(project.status)}`}>
                                                        {project.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <h3 className="font-semibold text-lg mb-2 line-clamp-2">{project.title}</h3>
                                                <p className="text-gray-600 text-sm line-clamp-2 mb-4">{project.brief}</p>
                                                <div className="flex items-center text-xs text-gray-400">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {formatDate(project.created_at)}
                                                </div>
                                            </>
                                        )}
                                    </Card>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {!loading && projects.length === 0 && (
                            <p className="text-center text-gray-500 mt-4">
                                No projects yet. Create your first one!
                            </p>
                        )}
                    </>
                ) : (
                    /* Assigned Tab */
                    <>
                        {assignedLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-[#7622e5]" />
                            </div>
                        ) : assignedProjects.length === 0 ? (
                            <div className="text-center py-16">
                                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 text-lg mb-2">No assigned projects yet</p>
                                <p className="text-gray-400 text-sm">
                                    When your teacher assigns projects, they'll appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {assignedProjects.map((ap, i) => (
                                    <motion.div key={ap.id} variants={staggerItem} initial="hidden" animate="visible" custom={2 + i}>
                                    <Card className="p-6 bg-white hover:shadow-lg transition-shadow h-full">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
                                                <BookOpen className="w-5 h-5 text-white" />
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(ap.status)}`}>
                                                {ap.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{ap.title}</h3>

                                        <p className="text-sm text-[#7622e5] mb-2">{ap.classroom_name}</p>

                                        {ap.description && (
                                            <p className="text-gray-600 text-sm line-clamp-2 mb-3">{ap.description}</p>
                                        )}

                                        {ap.due_date && (
                                            <div className={`flex items-center text-xs mb-4 ${getDueDateStyle(ap.due_date)}`}>
                                                <Calendar className="w-3 h-3 mr-1" />
                                                Due: {formatDate(ap.due_date)}
                                            </div>
                                        )}

                                        <div className="mt-auto pt-2">
                                            {ap.status === 'not_started' ? (
                                                <Button
                                                    className="w-full bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
                                                    onClick={() => handleStartAssignment(ap.assignment_id)}
                                                    disabled={startingAssignment === ap.assignment_id}
                                                >
                                                    {startingAssignment === ap.assignment_id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    ) : null}
                                                    Start
                                                </Button>
                                            ) : ap.status === 'in_progress' && ap.project_id ? (
                                                <Button
                                                    className="w-full bg-gradient-to-r from-[#ffa200] to-[#ff8800]"
                                                    onClick={() => handleContinueAssignment(ap.project_id!)}
                                                    disabled={loadingProject === ap.project_id}
                                                >
                                                    {loadingProject === ap.project_id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    ) : null}
                                                    Continue
                                                </Button>
                                            ) : ap.status === 'completed' ? (
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => ap.project_id && handleContinueAssignment(ap.project_id)}
                                                    disabled={!ap.project_id}
                                                >
                                                    View
                                                </Button>
                                            ) : null}
                                        </div>
                                    </Card>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </div>
    );

    if (embedded) return content;

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50">
            <header className="border-b bg-white/95 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-semibold">Projects</h1>
                    </div>
                </div>
            </header>
            {content}
        </div>
    );
}
