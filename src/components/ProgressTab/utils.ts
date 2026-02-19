import type {
    SavedEvaluation,
} from "../../util/progress/ProgressManager";

export const getBestScore = (evaluations: SavedEvaluation[] | undefined): number | null => {
    if (!evaluations || evaluations.length === 0) return null;
    return Math.max(...evaluations.map(e => e.score));
};

export const getScoreBadgeClass = (score: number | null): string => {
    if (score === null) return "bg-secondary";
    if (score >= 5) return "bg-success";
    return "bg-danger";
};