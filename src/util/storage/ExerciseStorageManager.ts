import type { AIRole, ExerciseDataForStorage, Lab } from "../../types/shared";
import { BaseStorageManager } from "./BaseStorageManager";
import { LabStorageManager } from "./LabStorageManager";

/**
 * Storage manager for exercise lists
 * Saves and retrieves exercise lists identified by ExerciseAgent
 */
export class ExerciseStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'exercise_data_';

    private static resolveRole(exercise: { role?: AIRole } & Record<string, any>): AIRole {
        if (exercise.role) {
            return exercise.role;
        }

        if (exercise.allowed === false) {
            return 'challenger';
        }

        if (exercise.isPicky === true) {
            return 'proofreader';
        }

        return 'tutor';
    }

    /**
     * Saves exercise data for a page to storage
     * @param pageId Page ID
     * @param exercises List of exercises
     * @param exerciseContext Optional exercise context (e.g., DB schema, specifications)
     * @param concepts Concepts worked on in the exercises
     * @param learningObjectives Optional learning objectives
     */
    static async saveExerciseData(
        pageId: string,
        exercises: Array<{ name: string; statement: string; role?: AIRole } & Record<string, any>> | import("../../types/shared").Exercise[],
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string
    ): Promise<void> {
        const normalizedExercises = exercises.map(ex => ({
            name: ex.name,
            statement: ex.statement,
            role: this.resolveRole(ex as { role?: AIRole } & Record<string, any>),
        }));

        const data: ExerciseDataForStorage = {
            pageId,
            exercises: normalizedExercises,
            exerciseContext,
            concepts,
            learningObjectives
        };

        await this.saveData(this.STORAGE_KEY_PREFIX, pageId, data);
    }

    /**
     * Retrieves exercise data for a page from storage
     * @param pageId Page ID
     * @returns Exercise data or null if not exists
     */
    static async getExerciseData(pageId: string): Promise<(ExerciseDataForStorage & { timestamp: number }) | null> {
        return await this.getData<ExerciseDataForStorage>(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Deletes exercise data for a page from storage
     * @param pageId Page ID
     */
    static async removeExerciseData(pageId: string): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Clears all stored exercise data
     */
    static async clearAllExerciseData(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
    }

    /**
     * Checks if saved data exists for a page
     * @param pageId Page ID
     * @returns true if data exists, false otherwise
     */
    static async hasExerciseData(pageId: string): Promise<boolean> {
        return await this.hasData(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Gets the number of days since data was saved
     * @param pageId Page ID
     * @returns Days elapsed or null if no data
     */
    static async getExerciseDataAge(pageId: string): Promise<number | null> {
        return await this.getDaysSinceLastUpdate(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Updates the role of a specific exercise
     * @param pageId Page ID
     * @param exerciseName Exercise name
     * @param role New role
     */
    static async updateExerciseRole(pageId: string, exerciseName: string, role: AIRole): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) {
            throw new Error(`No exercise data found for page ${pageId}`);
        }

        const exercise = data.exercises.find(ex => ex.name === exerciseName);
        if (!exercise) {
            throw new Error(`No se encontró el ejercicio ${exerciseName}`);
        }

        exercise.role = role;

        await this.saveExerciseData(
            pageId,
            data.exercises,
            data.exerciseContext,
            data.concepts,
            data.learningObjectives
        );
    }

    /**
     * Updates an existing exercise identified by oldName
     */
    static async updateExercise(
        pageId: string,
        oldName: string,
        exercise: { name: string; statement: string }
    ): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) {
            throw new Error(`No exercise data found for page ${pageId}`);
        }

        const index = data.exercises.findIndex(ex => ex.name === oldName);
        if (index === -1) {
            throw new Error(`No exercise found with name "${oldName}"`);
        }

        const trimmedName = exercise.name.trim();
        const trimmedStatement = exercise.statement.trim();

        if (!trimmedName) {
            throw new Error("Exercise name is required");
        }

        const duplicate = data.exercises.some((ex, exIndex) => ex.name === trimmedName && exIndex !== index);
        if (duplicate) {
            throw new Error(`An exercise named "${trimmedName}" already exists`);
        }

        const current = data.exercises[index];
        data.exercises[index] = {
            ...current,
            name: trimmedName,
            statement: trimmedStatement,
        };

        await this.saveExerciseData(
            pageId,
            data.exercises,
            data.exerciseContext,
            data.concepts,
            data.learningObjectives
        );
    }

    /**
     * Gets accumulated concepts from current lab and all previous required labs
     * This combines concepts from all labs up to and including the specified pageId,
     * removing duplicates while preserving the order of first occurrence.
     *
     * @param courseId Course ID
     * @param pageId Current page/lab ID
     * @returns Array of unique concepts from current and previous labs
     */
    static async getAccumulatedConcepts(courseId: string, pageId: string): Promise<string[]> {
        const labData = await LabStorageManager.getLabData(courseId);
        if (!labData) {
            // If no lab data, just return concepts from current page
            const currentData = await this.getExerciseData(pageId);
            return currentData?.concepts || [];
        }

        const allLabs = labData.labs;

        // Find index of current lab
        const currentLabIndex = allLabs.findIndex((lab: Lab) => lab.id === pageId);

        // Get labs up to and including the current one
        const labsToInclude = currentLabIndex >= 0
            ? allLabs.slice(0, currentLabIndex + 1)
            : allLabs;

        // Collect concepts from all previous labs, maintaining order
        const conceptsSet = new Set<string>();
        const orderedConcepts: string[] = [];

        for (const lab of labsToInclude) {
            const exerciseData = await this.getExerciseData(lab.id);
            if (exerciseData?.concepts) {
                for (const concept of exerciseData.concepts) {
                    if (!conceptsSet.has(concept)) {
                        conceptsSet.add(concept);
                        orderedConcepts.push(concept);
                    }
                }
            }
        }

        // Also add concepts from the current page if not already included
        const currentData = await this.getExerciseData(pageId);
        if (currentData?.concepts) {
            for (const concept of currentData.concepts) {
                if (!conceptsSet.has(concept)) {
                    conceptsSet.add(concept);
                    orderedConcepts.push(concept);
                }
            }
        }

        return orderedConcepts;
    }

    /**
     * Updates the learning objectives for a page
     */
    static async updateLearningObjectives(pageId: string, learningObjectives: string): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) throw new Error(`No exercise data found for page ${pageId}`);
        await this.saveExerciseData(pageId, data.exercises, data.exerciseContext, data.concepts, learningObjectives);
    }

    /**
     * Updates the exercise context for a page
     */
    static async updateExerciseContext(pageId: string, exerciseContext: string): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) throw new Error(`No exercise data found for page ${pageId}`);
        await this.saveExerciseData(pageId, data.exercises, exerciseContext, data.concepts, data.learningObjectives);
    }

    /**
     * Updates the concepts list for a page
     */
    static async updateConcepts(pageId: string, concepts: string[]): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) throw new Error(`No exercise data found for page ${pageId}`);
        await this.saveExerciseData(pageId, data.exercises, data.exerciseContext, concepts, data.learningObjectives);
    }


}