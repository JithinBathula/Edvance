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
    const [showError, setShowError] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // Syntax highlighting helper
    const renderHighlightedCode = (code: string) => {
        return code.split('\n').map((line, i) => (
            <div key={i}>
                {line.includes('#') ? (
                    <span className="text-gray-500">{line}</span>
                ) : (
                    <span>
                        {line.split(/(\b(?:print|for|while|in|range|if|else|def|return)\b|"[^"]*"|'[^']*'|\d+)/).map((part, j) => {
                            if (['print', 'for', 'while', 'in', 'range', 'if', 'else', 'def', 'return'].includes(part)) {
                                return <span key={j} className="text-purple-600">{part}</span>;
                            }
                            if (/^["'].*["']$/.test(part)) {
                                return <span key={j} className="text-green-600">{part}</span>;
                            }
                            if (/^\d+$/.test(part)) {
                                return <span key={j} className="text-blue-600">{part}</span>;
                            }
                            return <span key={j} className="text-gray-800">{part}</span>;
                        })}
                    </span>
                )}
            </div>
        ));
    };

    const handleCheck = () => {
        setIsChecking(true);
        setShowError(false);

        // Small delay for visual feedback
        setTimeout(() => {
            // Check if output matches expected pattern
            const outputText = output.join('\n');
            const regex = new RegExp(expectedOutputRegex, 'is');

            if (regex.test(outputText)) {
                setShowSuccess(true);
                setShowError(false);
            } else {
                setShowError(true);
                onCheck();
            }
            setIsChecking(false);
        }, 300);
    };

    const handleDone = () => {
        setIsCompleted(true);
        onComplete();
    };

    // COMPLETED STATE
    if (isCompleted) {
        return (
            <div className="rounded-xl bg-white overflow-hidden" style={{ border: '0.5px solid #4ade80', boxShadow: '1px -1.7px 4px rgba(0,0,0,0.08)' }}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <span style={{ backgroundColor: '#FF5F57', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                            <span style={{ backgroundColor: '#FFBD2E', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                            <span style={{ backgroundColor: '#28CA42', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                        </div>
                        <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">COMPLETED</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Success</span>
                    </div>
                </div>

                {/* Code Preview - With syntax highlighting */}
                <div className="bg-white p-4 border-b border-gray-100 overflow-x-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
                        <code>
                            {renderHighlightedCode(starterCode)}
                        </code>
                    </pre>
                </div>

                {/* Success Message */}
                <div className="px-4 py-4 bg-gray-50 flex items-center justify-between gap-4">
                    <p className="text-sm text-gray-700">{successMessage}</p>
                    <button
                        className="px-5 py-2.5 bg-white border-2 border-green-500 text-green-600 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-green-50 transition-colors whitespace-nowrap"
                        style={{ minWidth: '110px' }}
                    >
                        <CheckCircle className="w-4 h-4" />
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // SUCCESS STATE (before clicking Done)
    if (showSuccess) {
        return (
            <div className="rounded-xl bg-white overflow-hidden" style={{ border: '2px solid #4ade80', boxShadow: '1px -1.7px 4px rgba(0,0,0,0.08)' }}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <span style={{ backgroundColor: '#FF5F57', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                            <span style={{ backgroundColor: '#FFBD2E', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                            <span style={{ backgroundColor: '#28CA42', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                        </div>
                        <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">COMPLETED</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Success</span>
                    </div>
                </div>

                {/* Code Preview - With syntax highlighting */}
                <div className="bg-white p-4 border-b border-gray-100 overflow-x-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
                        <code>
                            {renderHighlightedCode(starterCode)}
                        </code>
                    </pre>
                </div>

                {/* Success Message + Done Button */}
                <div className="px-4 py-4 bg-gray-50 flex items-center justify-between gap-4">
                    <p className="text-sm text-gray-700">{successMessage}</p>
                    <button
                        onClick={handleDone}
                        className="px-5 py-2.5 bg-white border-2 border-green-500 text-green-600 text-sm font-semibold rounded-lg flex items-center gap-2 hover:bg-green-50 transition-colors whitespace-nowrap"
                        style={{ minWidth: '140px' }}
                    >
                        <CheckCircle className="w-4 h-4" />
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // EXERCISE STATE (initial)
    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ boxShadow: '1px -1.7px 4px rgba(0,0,0,0.08)' }}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="flex gap-1.5">
                    <span style={{ backgroundColor: '#FF5F57', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                    <span style={{ backgroundColor: '#FFBD2E', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                    <span style={{ backgroundColor: '#28CA42', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
                </div>
                <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">PRACTICE EXERCISE</span>
            </div>

            {/* Code Preview - With syntax highlighting */}
            <div className="bg-white p-4 border-b border-gray-100 overflow-x-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
                    <code>
                        {renderHighlightedCode(starterCode)}
                    </code>
                </pre>
            </div>

            {/* Instructions + Check Button */}
            <div className="px-4 py-4 bg-gray-50 flex items-center justify-between gap-4">
                <p className="text-sm text-gray-600">
                    Type this code in the editor on the right, run it, then check your work.
                </p>
                <button
                    onClick={handleCheck}
                    disabled={isChecking}
                    className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer border-2
                        ${showError
                            ? 'bg-red-50 border-red-500 text-red-600 hover:bg-red-100'
                            : 'bg-white border-blue-500 active:scale-95'
                        }
                        ${isChecking ? 'opacity-70 cursor-not-allowed' : ''}
                    `}
                    style={{
                        minWidth: '140px',
                        color: showError ? undefined : '#2563eb'
                    }}
                    onMouseEnter={(e) => {
                        if (!showError && !isChecking) {
                            e.currentTarget.style.backgroundColor = '#faf5ff';
                            e.currentTarget.style.color = '#7622e5';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!showError) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.color = '#2563eb';
                        }
                    }}
                >
                    {isChecking ? 'Checking...' : showError ? 'Try Again' : 'Check My Code'}
                </button>
            </div>

            {/* Error Message */}
            {showError && (
                <div className="px-4 py-3 bg-red-50 border-t border-red-100 text-sm text-red-600">
                    ⚠️ Output doesn't match. Make sure you ran the code first!
                </div>
            )}
        </div>
    );
};
