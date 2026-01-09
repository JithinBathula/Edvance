'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { PracticeCard } from './PracticeCard';
import { LessonSectionData } from '../data/mockLessonData';

interface LessonSectionProps {
    section: LessonSectionData;
    isCompleted: boolean;
    userCode: string;
    output: string[];
    onSectionComplete: (sectionId: string) => void;
}

export const LessonSection: React.FC<LessonSectionProps> = ({
    section,
    isCompleted,
    userCode,
    output,
    onSectionComplete,
}) => {
    return (
        <div id={`section-${section.id}`} className="space-y-8 first:mt-0 mt-16 pb-8">
            {/* Section Header */}
            <div className="flex items-start gap-4">
                {/* Number Circle */}
                <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-green-100 text-green-600 border border-green-300'
                        }`}
                >
                    {isCompleted ? <Check className="w-4 h-4" /> : section.number}
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-900 pt-1">
                    {section.number}. {section.title} {section.emoji}
                </h2>
            </div>

            {/* Content */}
            <div className="ml-12 space-y-6">
                {section.content.map((paragraph, idx) => (
                    <p
                        key={idx}
                        className="text-gray-700 leading-relaxed text-base"
                        dangerouslySetInnerHTML={{
                            __html: paragraph
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 bg-gray-100 rounded text-purple-600 font-mono text-sm">$1</code>'),
                        }}
                    />
                ))}

                {/* Code Example */}
                {section.codeExample && (
                    <div className="space-y-3">
                        {section.codeExample.explanation && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-gray-900">
                                    The <code className="text-purple-600 bg-gray-100 px-1 py-0.5 rounded">for</code> Loop 🔁
                                </h3>
                                <p className="text-gray-600 text-sm">{section.codeExample.explanation}</p>
                            </div>
                        )}

                        {/* Code Block - Plain black text for examples */}
                        <div className="bg-gray-100 rounded-lg p-4 overflow-x-auto border border-gray-200">
                            <pre className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">
                                <code className="text-gray-800">
                                    {section.codeExample.code}
                                </code>
                            </pre>
                        </div>
                    </div>
                )}

                {/* Try it yourself */}
                {section.practice && (
                    <div className="space-y-4">
                        <div>
                            <p className="font-semibold text-gray-900 mb-2">Try it yourself:</p>
                            <ul className="list-disc list-inside text-gray-600 text-sm">
                                <li>{section.practice.instruction}</li>
                            </ul>
                        </div>

                        {/* Practice Card */}
                        <PracticeCard
                            id={section.practice.id}
                            instruction={section.practice.instruction}
                            starterCode={section.practice.starterCode}
                            expectedOutputRegex={section.practice.expectedOutputRegex}
                            successMessage={section.practice.successMessage}
                            userCode={userCode}
                            output={output}
                            onCheck={() => { }}
                            onComplete={() => onSectionComplete(section.id)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
