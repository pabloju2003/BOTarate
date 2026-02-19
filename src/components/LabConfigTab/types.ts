import type { ReasoningEffort, VerbosityLevel } from "../../types/shared";
export type { Exercise, Lab, ReasoningEffort, VerbosityLevel } from "../../types/shared";

export type ContextGenerationStatus = "idle" | "generating" | "completed" | "error";

export interface LabConfigTabProps {
    courseId: string;
    sectionLabIds?: string[];
    onConfigUpdate?: () => void;
    isActive: boolean;
}

export interface PendingChanges {
    verbosity?: VerbosityLevel;
    reasoningEffort?: ReasoningEffort;
}

export interface LabContextState {
    hasContext: boolean;
    generateContext: boolean; // Current checkbox state
    originalGenerateContext: boolean; // Original state to detect changes
}

export interface LabConfig {
    verbosity: VerbosityLevel;
    reasoningEffort: ReasoningEffort;
}