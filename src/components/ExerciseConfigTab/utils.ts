import { Exercise, ExerciseRoleConfig } from './types';
import type { AIRole } from '../../types/shared';

export const getDefaultFlags = (): ExerciseRoleConfig => ({ role: 'tutor' });

export const createFlagsFromExercise = (exercise: Exercise): ExerciseRoleConfig => ({
    role: exercise.role ?? 'tutor',
});

export const buildConfigMap = (list: Exercise[]): Map<string, ExerciseRoleConfig> => {
    const config = new Map<string, ExerciseRoleConfig>();
    for (const exercise of list) {
        config.set(exercise.name, createFlagsFromExercise(exercise));
    }
    return config;
};

export const configsAreEqual = (a: Map<string, ExerciseRoleConfig>, b: Map<string, ExerciseRoleConfig>): boolean => {
    if (a.size !== b.size) return false;
    for (const [name, config] of a) {
        const reference = b.get(name);
        if (!reference) return false;
        if (config.role !== reference.role) {
            return false;
        }
    }
    return true;
};

export const computePendingChanges = (
    exerciseConfig: Map<string, ExerciseRoleConfig>,
    originalConfig: Map<string, ExerciseRoleConfig>
): Array<{ name: string; role: AIRole }> => {
    const changes: Array<{ name: string; role: AIRole }> = [];

    for (const [name, config] of exerciseConfig.entries()) {
        const original = originalConfig.get(name) ?? getDefaultFlags();
        const role = config.role;
        const originalRole = original.role;

        if (role !== originalRole) {
            changes.push({ name, role });
        }
    }
    return changes;
};