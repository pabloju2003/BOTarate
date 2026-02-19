export interface SavedEvaluation {
    exerciseName: string;
    statement: string;
    solution: string;
    score: number;
    feedback: string;
    timestamp: number;
}

export interface EvaluationListModalProps {
    exerciseName: string;
    isOpen: boolean;
    onClose: () => void;
    pageId?: string;
}