import type { Exercise } from "../../types/shared";
export type { AIRole, Exercise, ReasoningEffort, VerbosityLevel } from "../../types/shared";

export interface ExerciseRoleConfig {
    role: import("../../types/shared").AIRole;
}

export interface ExerciseConfigTabProps {
    exercises: Exercise[];
    pageId: string;
    courseId?: string;
    pageName?: string;
    onConfigUpdate?: () => void;
    isActive: boolean;
}