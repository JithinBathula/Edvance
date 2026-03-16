import { useState, useEffect, useMemo, useRef } from 'react';
import { User } from '../App';
import { BACKEND_URL } from '../utils/constants';
import { authFetch } from '../utils/authFetch';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, BookOpen, CheckCircle } from 'lucide-react';
import { MilestonePlannerList } from './MilestonePath';
import { cn } from './ui/utils';

type UserProfile = {
    educationLevel: string;
    schoolExperience: string;
    pythonLevel: string;
    biggestChallenges: string[];
    learningMode: string;
};

type Props = {
    user: User;
    requirements: {
        session: any;
        outline?: Outline | null;
        userProfile?: UserProfile;
        vmType?: string;
    };
    onProjectReady: (project: any) => void;
    onBack: () => void;
    contentType?: string;
};

type Outline = {
    project_title: string;
    project_brief: string;
    vm_type?: string;
    milestones: { subheading_title: string; description: string }[];
};

type Phase = 'generating-outline' | 'show-outline' | 'generating-curriculum' | 'awaiting-milestones' | 'ready';

export function ProjectPlanning({ user, requirements, onProjectReady, onBack, contentType }: Props) {
    const [phase, setPhase] = useState<Phase>('generating-outline');
    const [outline, setOutline] = useState<Outline | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [milestoneStatuses, setMilestoneStatuses] = useState<{ title: string; ready: boolean }[]>([]);
    const [pollingError, setPollingError] = useState<string | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollStartTimeRef = useRef<number>(0);

    useEffect(() => {
    // reset when outline changes
    setActiveStep(0);
    }, [outline]);

    const count = outline?.milestones?.length ?? 0;
    const allDone = count > 0 && activeStep === count - 1; // reached last step

    // Generate outline on mount or use provided one
    useEffect(() => {
        if (requirements.outline) {
            setOutline(requirements.outline);
            setPhase('show-outline');
        } else {
            generateOutline();
        }
    }, []);

    const userProfile: UserProfile = requirements.userProfile || {
        educationLevel: user.onboarding?.educationLevel || 'primary',
        schoolExperience: user.onboarding?.schoolExperience || 'none',
        pythonLevel: user.onboarding?.pythonLevel || 'level-1',
        biggestChallenges: user.onboarding?.biggestChallenges || [],
        learningMode: user.onboarding?.learningMode || 'guided',
    };
    const vmType = requirements.vmType || 'python';
    const serializedSession = JSON.stringify(requirements.session ?? {}, null, 2);

    const generateOutline = async () => {
        if (!requirements.session) {
            setError('Missing session data for outline generation.');
            return;
        }

        setPhase('generating-outline');
        setError(null);

        try {
            const response = await fetch(`${BACKEND_URL}/planning/outline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session: requirements.session,
                    user_profile: userProfile,
                }),
            });

            if (!response.ok) throw new Error('Failed to generate outline');

            const data = await response.json();
            setOutline(data);
            setPhase('show-outline');
        } catch (err) {
            console.error('Outline error:', err);
            setError('Failed to generate project outline. Please try again.');
        }
    };

    const isTeacher = contentType === 'assignment_template';

    const generateCurriculum = async () => {
        if (!outline) return;
        setPhase('generating-curriculum');
        setError(null);

        try {
            const response = await authFetch('/planning/curriculum', {
                method: 'POST',
                body: JSON.stringify({
                    requirements: serializedSession,
                    user_profile: userProfile,
                    outline: outline,
                    vm_type: vmType,
                    content_type: contentType || 'custom_project',
                    estimated_duration: requirements.session.timeline || '',
                }),
            });

            if (!response.ok) throw new Error('Failed to generate curriculum');

            const curriculum = await response.json();

            if (isTeacher) {
                // Teacher flow: first milestone returned, rest generating in background
                setProjectId(curriculum.project_id);
                const statuses = curriculum.milestones.map((m: any, idx: number) => ({
                    title: m.subheading_title,
                    ready: idx === 0 && m.tasks && m.tasks.length > 0,
                }));
                setMilestoneStatuses(statuses);
                setPhase('awaiting-milestones');
            } else {
                // Student flow: transform and hand off immediately
                const project = {
                    id: curriculum.project_id,
                    title: curriculum.project_title,
                    brief: curriculum.project_brief,
                    vm_type: curriculum.vm_type || vmType,
                    tasks: curriculum.milestones.flatMap((milestone: any, mIdx: number) =>
                        milestone.tasks.map((task: any, tIdx: number) => ({
                            id: task.id || `${mIdx}-${tIdx}`,
                            title: `${milestone.subheading_title}: ${task.task_id}`,
                            description: task.instruction_theory,
                            codingRequirements: task.coding_requirements || [],
                            hints: task.hints,
                            starterCode: '# Write your code here\n',
                            testSpec: task.test_specification,
                        }))
                    ),
                };
                onProjectReady(project);
            }
        } catch (err) {
            console.error('Curriculum error:', err);
            setError('Failed to generate curriculum. Please try again.');
            setPhase('show-outline');
        }
    };

    // Poll for milestone completion (teacher flow)
    useEffect(() => {
        if (phase !== 'awaiting-milestones' || !projectId) return;

        pollStartTimeRef.current = Date.now();
        const POLL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

        pollIntervalRef.current = setInterval(async () => {
            // Timeout check
            if (Date.now() - pollStartTimeRef.current > POLL_TIMEOUT) {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                setError('Generation timed out. Some milestones may not have completed. Please try again.');
                setPhase('show-outline');
                return;
            }

            try {
                const response = await authFetch(`/progress/projects/${projectId}/full`);
                const data = await response.json();

                if (!data.success || !data.project) {
                    setPollingError('Temporary issue checking progress...');
                    return;
                }

                setPollingError(null);

                // Update milestone statuses from polled data
                const updatedStatuses = data.project.milestones.map((m: any) => ({
                    title: m.title,
                    ready: m.tasks && m.tasks.length > 0,
                }));
                setMilestoneStatuses(updatedStatuses);

                // Check if all milestones have tasks
                const allReady = data.project.milestones.every(
                    (m: any) => m.tasks && m.tasks.length > 0
                );

                if (allReady) {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

                    // Transform /full response into project format for AssignmentCreate
                    const project = {
                        id: data.project.id,
                        title: data.project.title,
                        brief: data.project.brief,
                        vm_type: data.project.vm_type || vmType,
                        tasks: data.project.tasks.map((task: any) => ({
                            id: task.id,
                            title: task.title,
                            description: task.description,
                            codingRequirements: task.codingRequirements || [],
                            hints: task.hints || [],
                            starterCode: task.starterCode || '# Write your code here\n',
                            testSpec: task.testSpec || {},
                        })),
                    };

                    onProjectReady(project);
                }
            } catch (err) {
                console.error('Poll error:', err);
                setPollingError('Temporary issue checking progress...');
            }
        }, 3000);

        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [phase, projectId]);

    // Loading screen for outline generation
    if (phase === 'generating-outline') {
        return (
            <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                <Card className="max-w-lg w-full p-12 text-center bg-white border-slate-100">
                    <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Creating Your Project Outline</h2>
                    <p className="text-gray-600 mb-6">
                        Analyzing your requirements and designing the perfect learning path...
                    </p>
                    <Progress value={66} className="h-2" />
                </Card>
            </div>
        );
    }

    // Loading screen for curriculum generation
    if (phase === 'generating-curriculum') {
        return (
            <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                <Card className="max-w-lg w-full p-12 text-center bg-white border-slate-100">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Building Your Curriculum</h2>
                    <p className="text-gray-600 mb-6">
                        Creating detailed tasks, hints, and tests for each milestone...
                    </p>
                    <Progress value={66} className="h-2" />
                </Card>
            </div>
        );
    }

    // Progress screen for teacher incremental generation
    if (phase === 'awaiting-milestones') {
        const readyCount = milestoneStatuses.filter(m => m.ready).length;
        const totalCount = milestoneStatuses.length;
        const progressPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

        return (
            <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                <Card className="max-w-lg w-full p-12 bg-white border-slate-100">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Building Your Curriculum</h2>
                        <p className="text-gray-500">Generating detailed tasks for each milestone...</p>
                    </div>

                    <div className="space-y-3 mb-8">
                        {milestoneStatuses.map((ms, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                {ms.ready ? (
                                    <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0" />
                                ) : (
                                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
                                )}
                                <span className={cn(
                                    "text-sm",
                                    ms.ready ? "text-slate-700" : "text-slate-400"
                                )}>
                                    {ms.title}
                                </span>
                            </div>
                        ))}
                    </div>

                    <Progress value={progressPct} className="h-2 mb-3" />
                    <p className="text-center text-sm text-slate-500">
                        {readyCount} of {totalCount} milestones ready
                    </p>

                    {pollingError && (
                        <p className="text-center text-xs text-amber-600 mt-3">{pollingError}</p>
                    )}
                </Card>
            </div>
        );
    }

    // Show outline for user review
    if (phase === "show-outline" && outline) {
        return (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="max-w-4xl mx-auto px-6 py-6">
            {error && (
                <Card className="p-4 mb-6 bg-red-50 border-red-200">
                <p className="text-red-600">{error}</p>
                <Button onClick={generateOutline} variant="outline" className="mt-2">
                    Retry
                </Button>
                </Card>
            )}

            <Card className="p-8 bg-white border-slate-100 mb-6">
                <div className="mb-6">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-bold text-slate-800">{outline.project_title}</h2>
                        <Sparkles className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-slate-500 mt-2 leading-relaxed">{outline.project_brief}</p>
                </div>

                <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-700">
                    <BookOpen className="w-5 h-5 text-teal-600" />
                    Learning Milestones
                </h3>

                <MilestonePlannerList
                    milestones={outline.milestones}
                    active={activeStep}
                    onActiveChange={setActiveStep}
                    />
                </div>
            </Card>

            <div className="flex justify-between">
                <Button variant="outline" className="cursor-pointer" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
                </Button>

                <Button
                    onClick={generateCurriculum}
                    disabled={!allDone}
                    className={cn(
                        "bg-teal-600 hover:bg-teal-700 cursor-pointer",
                        !allDone && "opacity-50 cursor-not-allowed"
                    )}
                    >
                    Generate Full Curriculum
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

            </div>
            </div>
        </div>
        );
    }

    return null;
    }