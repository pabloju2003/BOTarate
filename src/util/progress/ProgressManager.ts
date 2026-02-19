import type { Exercise, Lab, SavedEvaluation } from "../../types/shared";
export type { SavedEvaluation } from "../../types/shared";

/**
 * Summary of a student's progress in a lab.
 * Shows exercises attempted and scores — no blocking or unlock logic.
 */
export interface LabProgress {
    lab: Lab;
    allExercises: Exercise[];
    evaluatedExercises: Map<string, SavedEvaluation[]>;
    stats: {
        totalExercises: number;
        exercisesAttempted: number;
        averageScore: number;
    };
}

export interface CourseProgressData {
    labs: LabProgress[];
}

/**
 * ProgressManager provides a read-only summary of all labs and the student's
 * exercise attempts / scores. It does NOT enforce any blocking or unlock logic.
 */
export class ProgressManager {

    /**
     * Fetches exercises for a lab
     */
    private static async fetchExercisesForLab(labId: string): Promise<Exercise[]> {
        const response = await chrome.runtime.sendMessage({
            action: "getExerciseData",
            pageId: labId,
        });

        if (response?.success && response.data) {
            return response.data.exercises || [];
        }
        return [];
    }

    /**
     * Fetches evaluations for all exercises of a lab
     */
    private static async fetchEvaluationsForLab(
        labId: string,
        exercises: Exercise[]
    ): Promise<{
        evaluatedExercises: Map<string, SavedEvaluation[]>;
        totalScore: number;
        evaluatedCount: number;
    }> {
        const evaluatedExercises = new Map<string, SavedEvaluation[]>();
        let totalScore = 0;
        let evaluatedCount = 0;

        for (const exercise of exercises) {
            const evalResponse = await chrome.runtime.sendMessage({
                action: "getEvaluations",
                pageId: labId,
                exerciseName: exercise.name,
            });

            if (evalResponse?.success && evalResponse.evaluations && evalResponse.evaluations.length > 0) {
                evaluatedExercises.set(exercise.name, evalResponse.evaluations);
                const bestScore = Math.max(...evalResponse.evaluations.map((e: SavedEvaluation) => e.score));
                totalScore += bestScore;
                evaluatedCount++;
            }
        }

        return { evaluatedExercises, totalScore, evaluatedCount };
    }

    /**
     * Loads a summary of all included labs and the student's exercise progress.
     * All labs with context are shown — there is no filtering by "required".
     */
    static async loadProgressData(courseId: string): Promise<CourseProgressData> {
        try {
            const labResponse = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (!labResponse?.success || !labResponse?.data?.labs) {
                return { labs: [] };
            }

            const labList: Lab[] = labResponse.data.labs;

            const progressData: LabProgress[] = [];

            for (const lab of labList) {
                const allExercises = await this.fetchExercisesForLab(lab.id);

                // Only include labs that have exercises (i.e. have been configured/included)
                if (allExercises.length === 0) continue;

                const { evaluatedExercises, totalScore, evaluatedCount } =
                    await this.fetchEvaluationsForLab(lab.id, allExercises);

                progressData.push({
                    lab,
                    allExercises,
                    evaluatedExercises,
                    stats: {
                        totalExercises: allExercises.length,
                        exercisesAttempted: evaluatedCount,
                        averageScore: evaluatedCount > 0 ? totalScore / evaluatedCount : 0,
                    },
                });
            }

            return { labs: progressData };
        } catch (error) {
            console.error("[ProgressManager] Error loading progress data:", error);
            return { labs: [] };
        }
    }
}
