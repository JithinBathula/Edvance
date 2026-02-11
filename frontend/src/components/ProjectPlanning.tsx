import { useState, useEffect, useMemo } from 'react';
import { User } from '../App';
import { BACKEND_URL } from '../utils/constants';
import { authFetch } from '../utils/authFetch';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, BookOpen } from 'lucide-react';
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
};

type Outline = {
    project_title: string;
    project_brief: string;
    vm_type?: string;
    milestones: { subheading_title: string; description: string }[];
};

type Phase = 'generating-outline' | 'show-outline' | 'generating-curriculum' | 'ready';

export function ProjectPlanning({ user, requirements, onProjectReady, onBack }: Props) {
    const [phase, setPhase] = useState<Phase>('generating-outline');
    const [outline, setOutline] = useState<Outline | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(0);

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
                }),
            });

            if (!response.ok) throw new Error('Failed to generate curriculum');

            const curriculum = await response.json();

            // Transform curriculum to project workspace format
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
                        hints: task.hints,
                        starterCode: '# Write your code here\n',
                        testSpec: task.test_specification,
                    }))
                ),
            };

            onProjectReady(project);
        } catch (err) {
            console.error('Curriculum error:', err);
            setError('Failed to generate curriculum. Please try again.');
            setPhase('show-outline');
        }
    };

    // Loading screen for outline generation
    if (phase === 'generating-outline') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
                <Card className="max-w-lg w-full p-12 text-center bg-white">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#7622e5] to-[#b480f8] rounded-full flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <h2 className="text-2xl mb-4">Creating Your Project Outline</h2>
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
            <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
                <Card className="max-w-lg w-full p-12 text-center bg-white">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#ffa200] to-[#ff8800] rounded-full flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <h2 className="text-2xl mb-4">Building Your Curriculum</h2>
                    <p className="text-gray-600 mb-6">
                        Creating detailed tasks, hints, and tests for each milestone...
                    </p>
                    <Progress value={66} className="h-2" />
                </Card>
            </div>
        );
    }

    // Show outline for user review
    if (phase === "show-outline" && outline) {
        return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50">
            <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl">Project Outline</h1>
                </div>
            </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8">
            {error && (
                <Card className="p-4 mb-6 bg-red-50 border-red-200">
                <p className="text-red-600">{error}</p>
                <Button onClick={generateOutline} variant="outline" className="mt-2">
                    Retry
                </Button>
                </Card>
            )}

            <Card className="p-12 bg-white mb-6">
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                    <h2 className="text-2xl-strong">{outline.project_title}</h2>

                    <Sparkles className="w-10 h-20 text-cyan-700 fill-current" />
                </div>
                    <p className="text-gray-600 mt-1">{outline.project_brief}</p>
                </div>

                <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#ffa200]" />
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
                <Button variant="outline" className={cn( "pointer-events-auto cursor-pointer")} onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
                </Button>

                <Button
                    onClick={generateCurriculum}
                    disabled={!allDone}
                    className={cn(
                        "bg-cyan-700 hover:bg-cyan-800 cursor-pointer pointer-events-auto",
                        !allDone && "opacity-50 cursor-not-allowed hover:from-cyan-700 hover:to-cyan-300"
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