export enum MessageRole {
    User = 'user',
    Model = 'model',
    System = 'system'
}

export interface ChatMessage {
    id: string;
    role: MessageRole;
    text: string;
    timestamp: number;
}

export interface PracticeChallenge {
    id: string;
    label: string;
    initialCode: string; // The code shown in the example
    expectedOutputRegex?: string; // Regex to match output
    expectedCodeRegex?: string; // Regex to match source code
    successMessage: string;
    xp: number;
}

export interface LessonTask {
    id: string;
    label: string;
    completed: boolean;
    xp: number;
    task_description: string;
    hint?: string;
}

export interface LessonSection {
    id: string;
    title: string;
    content: string; // HTML content
    practice?: PracticeChallenge; // Optional embedded practice
    isCompleted?: boolean; // Runtime state
}

export interface Lesson {
    id: string;
    title: string;

    // Phase 1: Learning (Blog + Inline Practice)
    learningSections: LessonSection[];

    // Phase 2: Active Recall Project (Requirements + Tasks)
    projectBrief: {
        title: string;
        content: string;
    };
    projectTasks: LessonTask[];

    initialCode: string;
}