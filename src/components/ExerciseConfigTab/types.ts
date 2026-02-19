import type { Exercise } from "../../types/shared";
export type { Exercise, ReasoningEffort, VerbosityLevel } from "../../types/shared";

export interface ExerciseFlags {
    allowed: boolean;
    isPicky: boolean;
}

export interface ExerciseConfigTabProps {
    exercises: Exercise[];
    pageId: string;
    courseId?: string;
    pageName?: string;
    onConfigUpdate?: () => void;
    isActive: boolean;
}