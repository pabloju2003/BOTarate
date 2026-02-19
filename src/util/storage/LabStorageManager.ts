import type { Lab, ReasoningEffort, VerbosityLevel } from "../../types/shared";
import { BaseStorageManager } from "./BaseStorageManager";

/**
 * Lab data structure for the course
 */
export interface LabData {
    courseId: string;
    labs: Lab[];
}

/**
 * Storage manager for course labs
 * Saves and retrieves the list of labs configured for the "levels" system
 */
export class LabStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'lab_data_';

    /**
     * Saves the list of labs for a course to storage
     * @param courseId Course ID
     * @param labs List of labs
     */
    static async saveLabData(courseId: string, labs: Lab[]): Promise<void> {
        const data: LabData = {
            courseId,
            labs
        };

        await this.saveData(this.STORAGE_KEY_PREFIX, courseId, data);
    }

    /**
     * Retrieves the list of labs for a course from storage
     * @param courseId Course ID
     * @returns Lab data or null if not exists
     */
    static async getLabData(courseId: string): Promise<(LabData & { timestamp: number }) | null> {
        return await this.getData<LabData>(this.STORAGE_KEY_PREFIX, courseId);
    }

    /**
     * Deletes lab data for a course from storage
     * @param courseId Course ID
     */
    static async removeLabData(courseId: string): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, courseId);
    }

    /**
     * Clears all stored lab data
     */
    static async clearAllLabData(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
    }

    /**
     * Checks if saved lab data exists for a course
     * @param courseId Course ID
     * @returns true if data exists, false otherwise
     */
    static async hasLabData(courseId: string): Promise<boolean> {
        return await this.hasData(this.STORAGE_KEY_PREFIX, courseId);
    }

    /**
     * Actualiza el nivel de verbosidad de un laboratorio específico
     * @param courseId ID del curso
     * @param labId ID del laboratorio
     * @param verbosity Nivel de verbosidad
     */
    static async updateLabVerbosity(courseId: string, labId: string, verbosity: VerbosityLevel): Promise<void> {
        const data = await this.getLabData(courseId);
        if (!data) {
            throw new Error(`No se encontraron datos de laboratorios para el curso ${courseId}`);
        }

        const lab = data.labs.find(l => l.id === labId);
        if (!lab) {
            throw new Error(`No se encontró el laboratorio ${labId}`);
        }

        lab.verbosity = verbosity;

        await this.saveLabData(courseId, data.labs);
    }

    /**
     * Actualiza el esfuerzo de razonamiento de un laboratorio específico
     * @param courseId ID del curso
     * @param labId ID del laboratorio
     * @param reasoningEffort Nivel de esfuerzo de razonamiento
     */
    static async updateLabReasoningEffort(courseId: string, labId: string, reasoningEffort: ReasoningEffort): Promise<void> {
        const data = await this.getLabData(courseId);
        if (!data) {
            throw new Error(`No se encontraron datos de laboratorios para el curso ${courseId}`);
        }

        const lab = data.labs.find(l => l.id === labId);
        if (!lab) {
            throw new Error(`No se encontró el laboratorio ${labId}`);
        }

        lab.reasoningEffort = reasoningEffort;

        await this.saveLabData(courseId, data.labs);
    }

    /**
     * Obtiene la configuración de un laboratorio específico
     * @param courseId ID del curso
     * @param labId ID del laboratorio
     * @returns Configuración del laboratorio o null si no existe
     */
    static async getLabConfig(courseId: string, labId: string): Promise<Lab | null> {
        const data = await this.getLabData(courseId);
        if (!data) {
            return null;
        }

        return data.labs.find(l => l.id === labId) || null;
    }
}
