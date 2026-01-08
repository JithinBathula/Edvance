'use client';

import React, { useState } from 'react';
import { Check, CheckCircle } from 'lucide-react';

interface PracticeCardProps {
    id: string;
    instruction: string;
    starterCode: string;
    expectedOutputRegex: string;
    successMessage: string;
    userCode: string;
    output: string[];
    onCheck: () => void;
    onComplete: () => void;
}

export const PracticeCard: React.FC<PracticeCardProps> = ({
    instruction,
    starterCode,
    expectedOutputRegex,
    successMessage,
    userCode,
    output,
    onCheck,
    onComplete,
}) => {
    const [isCompleted, setIsCompleted] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleCheck = () => {
        // Check if output matches expected pattern
        const outputText = output.join('\n');
        const regex = new RegExp(expectedOutputRegex, 'i');

        if (regex.test(outputText)) {
            setShowSuccess(true);
        } else {
            // Could show error feedback here
            onCheck();
        }
    };

    const handleDone = () => {
        setIsCompleted(true);
        onComplete();
    };

    // COMPLETED STATE
    if (isCompleted) {
        return (
            <div className="rounded-xl border-2 border-green-400 bg-white overflow-hidden shadow-sm">
                {/* Header */}
                <div className="px-4 py-3 border-b border-green-200 bg-green-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            <span className="w-3 h-3 rounded-full bg-red-400"></span>
                            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                            <span className="w-3 h-3 rounded-full bg-green-400"></span>
                        </div>
                        <span className="text-xs font-semibold tracking-wide text-gray-600">COMPLETED</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Success</span>
                    </div>
                </div>

                {/* Code Preview */}
                <div className="bg-gray-800 p-4">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                        {starterCode}
                    </pre>
                </div>

                {/* Success Message */}
                <div className="px-4 py-4 bg-white flex items-center justify-between">
                    <p className="text-sm text-gray-700">{successMessage}</p>
                    <button
                        onClick={handleDone}
                        className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-green-600 transition-colors"
                    >
                        <Check className="w-4 h-4" />
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // SUCCESS STATE (before clicking Done)
    if (showSuccess) {
        return (
            <div className="rounded-xl border-2 border-green-400 bg-white overflow-hidden shadow-sm">
                {/* Header */}
                <div className="px-4 py-3 border-b border-green-200 bg-green-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            <span className="w-3 h-3 rounded-full bg-red-400"></span>
                            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                            <span className="w-3 h-3 rounded-full bg-green-400"></span>
                        </div>
                        <span className="text-xs font-semibold tracking-wide text-gray-600">COMPLETED</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Success</span>
                    </div>
                </div>

                {/* Code Preview */}
                <div className="bg-gray-800 p-4">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                        {starterCode}
                    </pre>
                </div>

                {/* Success Message + Done Button */}
                <div className="px-4 py-4 bg-white flex items-center justify-between">
                    <p className="text-sm text-gray-700">{successMessage}</p>
                    <button
                        onClick={handleDone}
                        className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-green-600 transition-colors"
                    >
                        <Check className="w-4 h-4" />
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // EXERCISE STATE (initial)
    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF5F57' }}></span>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFBD2E' }}></span>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28CA42' }}></span>
                </div>
                <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">PRACTICE EXERCISE</span>
            </div>

            {/* Code Preview - White background */}
            <div className="bg-white p-4 border-b border-gray-100">
                <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    <code>
                        {starterCode.split('\n').map((line, i) => (
                            <div key={i}>
                                {line.includes('#') ? (
                                    <span className="text-gray-500">{line}</span>
                                ) : line.includes('print') || line.includes('for') || line.includes('while') || line.includes('in') || line.includes('range') ? (
                                    <span>
                                        {line.split(/(\b(?:print|for|while|in|range)\b)/).map((part, j) => (
                                            <span key={j} className={['print', 'for', 'while', 'in', 'range'].includes(part) ? 'text-purple-600' : 'text-gray-800'}>
                                                {part}
                                            </span>
                                        ))}
                                    </span>
                                ) : (
                                    <span className="text-gray-800">{line}</span>
                                )}
                            </div>
                        ))}
                    </code>
                </pre>
            </div>

            {/* Instructions + Check Button */}
            <div className="px-4 py-4 bg-gray-50 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                    Type this code in the editor on the right, run it, then check your work.
                </p>
                <button
                    onClick={handleCheck}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    style={{ backgroundColor: '#3b82f6', color: 'white' }}
                >
                    Check My Code
                </button>
            </div>
        </div>
    );
};
