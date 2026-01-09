'use client';

import React from 'react';
import { CheckCircle } from 'lucide-react';
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
    console.log(`LessonSection ${section.id}: isCompleted =`, isCompleted);
    return (
        <div id={`section-${section.id}`} className="space-y-6 pb-8 pt-6 px-4 rounded-lg">
            {/* Section Header */}
            <div className="flex items-start gap-3">
                {/* Number/Check Circle - Uses CheckCircle when completed */}
                {isCompleted ? (
                    <CheckCircle className="w-7 h-7 flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
                ) : (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium bg-green-100 text-green-600 border border-green-300 mt-0.5">
                        {section.number}
                    </div>
                )}

                {/* Title - With emoji */}
                <h2 className="text-xl font-semibold text-gray-900">
                    {section.title} {section.emoji}
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
                            onComplete={() => {
                                console.log(`LessonSection: onComplete called for section ${section.id}`);
                                onSectionComplete(section.id);
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
