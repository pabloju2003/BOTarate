export type VerbosityLevel = "low" | "medium" | "high";
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface Lab {
    id: string;
    name: string;
    sectionId?: string;
    verbosity?: VerbosityLevel;
    reasoningEffort?: ReasoningEffort;
}

export interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isPicky?: boolean;
}

export interface Step {
    content: string;
    title?: string;
}

export interface Explanation {
    steps: Step[];
}

export interface Evaluation {
    score: number;
    feedback: string;
    solution?: string;
    timestamp?: number;
}

export interface SavedEvaluation extends Evaluation {
    exerciseName: string;
}

export interface ExerciseDataForStorage {
    pageId: string;
    exercises: Exercise[];
    exerciseContext?: string;
    concepts?: string[];
    learningObjectives?: string;
}

export interface ToolCallInfo {
    name: string;
    arguments: string;
    displayName?: string; // User-friendly name for the resource/section being accessed
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    id?: string;
    tool_calls?: ToolCallInfo[];
}

export { };

