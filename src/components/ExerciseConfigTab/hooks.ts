import { useEffect, useState } from 'react';
import type { AIRole, Exercise, ReasoningEffort, VerbosityLevel } from '../../types/shared';
import { ExerciseConfigTabProps, ExerciseRoleConfig } from './types';
import { buildConfigMap, computePendingChanges, configsAreEqual, getDefaultFlags } from './utils';

export const useExerciseConfig = ({ exercises, pageId, courseId, onConfigUpdate, isActive }: ExerciseConfigTabProps) => {
    const [exerciseConfig, setExerciseConfig] = useState<Map<string, ExerciseRoleConfig>>(new Map());
    const [originalConfig, setOriginalConfig] = useState<Map<string, ExerciseRoleConfig>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Lab config state (verbosity, reasoning, context)
    const [verbosity, setVerbosity] = useState<VerbosityLevel>("medium");
    const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("medium");
    const [originalVerbosity, setOriginalVerbosity] = useState<VerbosityLevel>("medium");
    const [originalReasoning, setOriginalReasoning] = useState<ReasoningEffort>("medium");
    const [hasContext, setHasContext] = useState(false);
    const [contextModalOpen, setContextModalOpen] = useState(false);

    // Modal states for exercise management
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const [needsRefresh, setNeedsRefresh] = useState(false);

    useEffect(() => {
        const exerciseChanges = !configsAreEqual(exerciseConfig, originalConfig);
        const labConfigChanges = verbosity !== originalVerbosity || reasoningEffort !== originalReasoning;
        setHasUnsavedChanges(exerciseChanges || labConfigChanges);
    }, [exerciseConfig, originalConfig, verbosity, originalVerbosity, reasoningEffort, originalReasoning]);

    // Limpiar mensajes después de 5 segundos
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setErrorMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    useEffect(() => {
        if (isActive && pageId) {
            loadConfigFromStorage();
            loadLabConfig();
        }
    }, [isActive, pageId]);

    // Actualizar la lista cuando se marca como necesario
    useEffect(() => {
        if (needsRefresh && pageId) {
            loadConfigFromStorage();
            setNeedsRefresh(false);
        }
    }, [needsRefresh, pageId]);

    const loadConfigFromStorage = async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getExerciseData",
                pageId: pageId,
            });

            if (response.success && response.data) {
                const config = buildConfigMap(response.data.exercises);
                setExerciseConfig(config);
                setOriginalConfig(new Map(config));

                // Check context status
                setHasContext(response.data.exercises !== undefined);
            }
        } catch (error) {
            console.error("Error loading config from storage:", error);
            loadConfigFromProps();
        }
    };

    const loadLabConfig = async () => {
        if (!courseId) return;
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (response.success && response.data?.labs) {
                const lab = response.data.labs.find((l: any) => l.id === pageId);
                if (lab) {
                    const v = lab.verbosity ?? "medium";
                    const r = lab.reasoningEffort ?? "medium";
                    setVerbosity(v);
                    setReasoningEffort(r);
                    setOriginalVerbosity(v);
                    setOriginalReasoning(r);
                }
            }
        } catch (error) {
            console.error("Error loading lab config:", error);
        }
    };

    const loadConfigFromProps = () => {
        const config = buildConfigMap(exercises);
        setExerciseConfig(config);
        setOriginalConfig(new Map(config));
        setHasUnsavedChanges(false);
    };

    const updateExerciseFlags = (exerciseName: string, updater: (flags: ExerciseRoleConfig) => ExerciseRoleConfig) => {
        setExerciseConfig(prev => {
            const current = prev.get(exerciseName) ?? getDefaultFlags();
            const updated = updater(current);
            const newConfig = new Map(prev);
            newConfig.set(exerciseName, updated);
            return newConfig;
        });
    };

    const handleRoleChange = (exerciseName: string, role: AIRole) => {
        updateExerciseFlags(exerciseName, _flags => ({ role }));
    };

    const handleSaveChanges = async () => {
        const changes = computePendingChanges(exerciseConfig, originalConfig);
        const hasLabConfigChanges = verbosity !== originalVerbosity || reasoningEffort !== originalReasoning;

        if (changes.length === 0 && !hasLabConfigChanges) return;

        setSuccessMessage(null);
        setErrorMessage(null);
        setIsSaving(true);
        try {
            // Save exercise config changes
            for (const change of changes) {
                await chrome.runtime.sendMessage({
                    action: "updateExerciseRole",
                    pageId: pageId,
                    exerciseName: change.name,
                    role: change.role,
                });
            }

            const challengeExercises = changes.filter(change => change.role === 'challenger').map(change => change.name);

            if (challengeExercises.length > 0) {
                await chrome.runtime.sendMessage({
                    action: "removeChallengeExercisesExplanations",
                    pageId: pageId,
                    exerciseNames: challengeExercises,
                });
            }

            // Save lab config changes (verbosity, reasoning)
            if (hasLabConfigChanges && courseId) {
                if (verbosity !== originalVerbosity) {
                    await chrome.runtime.sendMessage({
                        action: "updateLabVerbosity",
                        courseId: courseId,
                        labId: pageId,
                        verbosity: verbosity,
                    });
                }
                if (reasoningEffort !== originalReasoning) {
                    await chrome.runtime.sendMessage({
                        action: "updateLabReasoningEffort",
                        courseId: courseId,
                        labId: pageId,
                        reasoningEffort: reasoningEffort,
                    });
                }
                setOriginalVerbosity(verbosity);
                setOriginalReasoning(reasoningEffort);
            }

            setOriginalConfig(new Map(exerciseConfig));
            setHasUnsavedChanges(false);

            if (onConfigUpdate) {
                onConfigUpdate();
            }

            setSuccessMessage("Configuration saved successfully. The agent has been updated with the new configuration.");
        } catch (error) {
            console.error("Error saving exercise config:", error);
            setErrorMessage("Error saving configuration. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };



    const refreshExercises = async () => {
        setNeedsRefresh(true);
        if (onConfigUpdate) {
            await onConfigUpdate();
        }
    };

    return {
        exerciseConfig,
        isSaving,
        hasUnsavedChanges,
        successMessage,
        errorMessage,
        handleRoleChange,
        handleSaveChanges,
        editingExercise,
        setEditingExercise,
        refreshExercises,
        // Lab config
        verbosity,
        setVerbosity,
        reasoningEffort,
        setReasoningEffort,
        hasContext,
        contextModalOpen,
        setContextModalOpen,
    };
};