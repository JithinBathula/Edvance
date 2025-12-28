import { useState, useEffect } from 'react';
import { User } from '../App';
import { BACKEND_URL } from '../utils/constants';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, BookOpen } from 'lucide-react';

type Props = {
    user: User;
    requirements: {
        idea: string;
        techStack: string[];
        experienceLevel: string;
    };
    onProjectReady: (project: any) => void;
    onBack: () => void;
};

type Outline = {
    project_title: string;
    project_brief: string;
    milestones: { subheading_title: string; description: string }[];
};

type Phase = 'generating-outline' | 'show-outline' | 'generating-curriculum' | 'ready';

export function ProjectPlanning({ user, requirements, onProjectReady, onBack }: Props) {
    const [phase, setPhase] = useState<Phase>('generating-outline');
    const [outline, setOutline] = useState<Outline | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Generate outline on mount
    useEffect(() => {
        generateOutline();
    }, []);

    const generateOutline = async () => {
        setPhase('generating-outline');
        setError(null);

        try {
            const response = await fetch(`${BACKEND_URL}/planning/outline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requirements: requirements.idea,
                    tech_stack: requirements.techStack || ['Python'],
                    experience_level: requirements.experienceLevel || user.onboarding?.experienceLevel || 'beginner',
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
            const response = await fetch(`${BACKEND_URL}/planning/curriculum`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    requirements: requirements.idea,
                    tech_stack: requirements.techStack || ['Python'],
                    experience_level: requirements.experienceLevel || user.onboarding?.experienceLevel || 'beginner',
                    outline: outline,
                }),
            });

            if (!response.ok) throw new Error('Failed to generate curriculum');

            const curriculum = await response.json();

            // Transform curriculum to project workspace format
            const project = {
                id: curriculum.project_id,
                title: curriculum.project_title,
                brief: curriculum.project_brief,
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
                    <Progress value={33} className="h-2" />
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
    if (phase === 'show-outline' && outline) {
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

                    <Card className="p-8 bg-white mb-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl">{outline.project_title}</h2>
                                <p className="text-gray-600">{outline.project_brief}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-[#ffa200]" />
                                Learning Milestones
                            </h3>

                            {outline.milestones.map((milestone, idx) => (
                                <div key={idx} className="flex gap-4 p-4 rounded-lg border bg-gray-50">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffa200] to-[#ff8800] flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-sm font-bold">{idx + 1}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold">{milestone.subheading_title}</h4>
                                        <p className="text-gray-600 text-sm">{milestone.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="flex justify-between">
                        <Button variant="outline" onClick={onBack}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                        <Button
                            onClick={generateCurriculum}
                            className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
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
