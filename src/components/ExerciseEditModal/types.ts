import type { Exercise } from "../../types/shared";
export type { Exercise } from "../../types/shared";

export interface ExerciseEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    exercise?: Exercise;
    labId: string;
    onExerciseUpdate?: () => void;
}