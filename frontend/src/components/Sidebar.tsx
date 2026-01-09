'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, PanelLeftClose } from 'lucide-react';
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
        <div className="w-64 border-r bg-white flex flex-col">
            {/* Header */}
            <div className="px-4 py-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Lesson Plan</h2>
                <button
                    onClick={onToggle}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Collapse sidebar"
                >
                    <PanelLeftClose className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            {/* Topics Section */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-3">
                    {/* Topics Header */}
                    <button
                        onClick={() => setIsTopicsExpanded(!isTopicsExpanded)}
                        className="w-full flex items-center gap-2 px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <ChevronDown
                            className={`w-4 h-4 transition-transform ${isTopicsExpanded ? '' : '-rotate-90'}`}
                        />
                        <span>Topics</span>
                    </button>

                    {/* Topics List */}
                    {isTopicsExpanded && (
                        <div className="mt-2 ml-2 space-y-1">
                            {mockLesson.sections.map((section, index) => {
                                const isCompleted = completedSections.includes(section.id);

                                return (
                                    <button
                                        key={section.id}
                                        onClick={() => onSectionClick(section.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-gray-50 group"
                                    >
                                        {/* Number/Check Circle */}
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                                            ${isCompleted
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                                            }`}
                                        >
                                            {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                                        </div>

                                        {/* Title */}
                                        <span className={`text-left flex-1 ${isCompleted ? 'text-green-600' : 'text-gray-700 group-hover:text-gray-900'}`}>
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
