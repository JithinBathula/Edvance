import { useEffect, useState } from 'react';
import { User } from '../App';
import { BACKEND_URL } from '../utils/constants';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ArrowLeft, Plus, FolderOpen, Clock, Loader2 } from 'lucide-react';

type Project = {
    id: string;
    title: string;
    brief: string;
    status: 'draft' | 'in_progress' | 'completed';
    created_at: string;
};

type Props = {
    user: User;
    onSelectProject: (project: any) => void;
    onCreateNew: () => void;
    onBack: () => void;
};

export function ProjectList({ user, onSelectProject, onCreateNew, onBack }: Props) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingProject, setLoadingProject] = useState<string | null>(null);

    useEffect(() => {
        fetchProjects();
    }, [user.id]);

    const fetchProjects = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/progress/projects/user/${user.id}`, {
                credentials: 'include',
            });
            const data = await response.json();
            if (data.success) {
                setProjects(data.projects);
            }
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProject = async (projectId: string) => {
        setLoadingProject(projectId);
        try {
            const response = await fetch(`${BACKEND_URL}/progress/projects/${projectId}/full`, {
                credentials: 'include',
            });
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50">
            <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-semibold">My Projects</h1>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#7622e5]" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Create New Project Card */}
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

                        {/* Existing Projects */}
                        {projects.map((project) => (
                            <Card
                                key={project.id}
                                className="p-6 hover:shadow-lg cursor-pointer transition-shadow bg-white"
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
                        ))}
                    </div>
                )}

                {!loading && projects.length === 0 && (
                    <p className="text-center text-gray-500 mt-4">
                        No projects yet. Create your first one!
                    </p>
                )}
            </div>
        </div>
    );
}
