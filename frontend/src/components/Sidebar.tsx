'use client';

import React, { useState } from 'react';
import { ChevronDown, CheckCircle, PanelLeftClose, ChevronRight } from 'lucide-react';
import { mockLesson } from '../data/mockLessonData';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    completedSections: string[];
    onSectionClick: (sectionId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onToggle,
    completedSections,
    onSectionClick,
}) => {
    const [isTopicsExpanded, setIsTopicsExpanded] = useState(true);

    if (!isOpen) {
        return (
            <div className="w-12 border-r bg-white flex flex-col items-center py-4">
                <button
                    onClick={onToggle}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Expand sidebar"
                >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
            </div>
        );
    }

    return (
        <div className="w-64 border-r bg-white flex flex-col min-h-0">
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="font-medium text-gray-900 text-sm">Lesson Plan</h2>
                <button
                    onClick={onToggle}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Collapse sidebar"
                >
                    <PanelLeftClose className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Topics Section - flex-1 keeps height consistent */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-3">
                    {/* Topics Header */}
                    <button
                        onClick={() => setIsTopicsExpanded(!isTopicsExpanded)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronDown
                            className={`w-3 h-3 transition-transform ${isTopicsExpanded ? '' : '-rotate-90'}`}
                        />
                        <span>Topics</span>
                    </button>

                    {/* Topics List - Clean style like Image 2 */}
                    {isTopicsExpanded && (
                        <div className="mt-3 space-y-1">
                            {mockLesson.sections.map((section, index) => {
                                const isCompleted = completedSections.includes(section.id);

                                return (
                                    <button
                                        key={section.id}
                                        onClick={() => onSectionClick(section.id)}
                                        className={`w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors hover:bg-gray-50
                                            ${isCompleted ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                                    >
                                        {/* Number/Check Circle */}
                                        {isCompleted ? (
                                            <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#22c55e' }} />
                                        ) : (
                                            <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs text-gray-400 border border-gray-300">
                                                {index + 1}
                                            </span>
                                        )}

                                        {/* Title with emoji */}
                                        <span className="text-left flex-1">
                                            {section.title} {section.emoji}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
