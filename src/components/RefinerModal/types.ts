import type { Exercise } from "../../types/shared";
export type { Exercise } from "../../types/shared";

export interface RefinerChatMessage {
    role: "user" | "assistant";
    content: string;
    id: string;
    /** True for user messages that represent a draft submission (rendered collapsed). */
    isDraft?: boolean;
}

export interface RefinerModalProps {
    exercise: Exercise;
    isOpen: boolean;
    onClose: () => void;
    pageId?: string;
    courseId?: string;
    exerciseContext?: string;
}
