import { ContextGenerationStatus, LabContextState, PendingChanges } from "./types";

async function hasGeneratedContext(labId: string): Promise<boolean> {
    try {
        const response = await chrome.runtime.sendMessage({
            action: "getExerciseData",
            pageId: labId,
        });

        if (!response?.success || !response?.data) {
            return false;
        }

        return Array.isArray(response.data.exercises) && response.data.exercises.length > 0;
    } catch {
        return false;
    }
}

export const handleSaveChanges = async (
    hasUnsavedChanges: boolean,
    hasContextChanges: boolean,
    labContextState: Map<string, LabContextState>,
    setLabContextState: React.Dispatch<React.SetStateAction<Map<string, LabContextState>>>,
    contextGenerationStatus: Map<string, ContextGenerationStatus>,
    setContextGenerationStatus: React.Dispatch<React.SetStateAction<Map<string, ContextGenerationStatus>>>,
    pendingChanges: Map<string, PendingChanges>,
    setPendingChanges: React.Dispatch<React.SetStateAction<Map<string, PendingChanges>>>,
    setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>,
    setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
    courseId: string,
    onConfigUpdate?: () => void,
    onError?: (message: string) => void
) => {
    if (!hasUnsavedChanges && !hasContextChanges) return;

    setIsSaving(true);
    try {
        // First, handle context generation changes
        const labsToGenerate: string[] = [];
        const labsToRemove: string[] = [];

        for (const [labId, state] of labContextState) {
            if (state.generateContext !== state.originalGenerateContext) {
                if (state.generateContext) {
                    labsToGenerate.push(labId);
                } else {
                    labsToRemove.push(labId);
                }
            }
        }

        // Generate context for labs that need it (in parallel)
        if (labsToGenerate.length > 0) {
            // Set all to generating status
            setContextGenerationStatus(prev => {
                const newStatus = new Map(prev);
                for (const labId of labsToGenerate) {
                    newStatus.set(labId, "generating");
                }
                return newStatus;
            });

            // Create promises for parallel generation
            const generationPromises = labsToGenerate.map(async labId => {
                try {
                    const response = await chrome.runtime.sendMessage({
                        action: "generateLabContext",
                        pageId: labId,
                        courseId: courseId,
                    });

                    const hasExercises = Array.isArray(response?.exercises) && response.exercises.length > 0;
                    const generationSucceeded = response?.success === true && hasExercises;

                    if (generationSucceeded) {
                        setContextGenerationStatus(prev => {
                            const newStatus = new Map(prev);
                            newStatus.set(labId, "completed");
                            return newStatus;
                        });
                        setLabContextState(prev => {
                            const newState = new Map(prev);
                            const current = newState.get(labId);
                            if (current) {
                                newState.set(labId, {
                                    ...current,
                                    hasContext: true,
                                    originalGenerateContext: true,
                                });
                            }
                            return newState;
                        });
                        return { labId, success: true };
                    } else {
                        // If transport succeeded but payload is empty/invalid, verify persisted state once.
                        const persisted = await hasGeneratedContext(labId);
                        if (persisted) {
                            setContextGenerationStatus(prev => {
                                const newStatus = new Map(prev);
                                newStatus.set(labId, "completed");
                                return newStatus;
                            });
                            setLabContextState(prev => {
                                const newState = new Map(prev);
                                const current = newState.get(labId);
                                if (current) {
                                    newState.set(labId, {
                                        ...current,
                                        hasContext: true,
                                        originalGenerateContext: true,
                                    });
                                }
                                return newState;
                            });
                            return { labId, success: true };
                        }

                        setContextGenerationStatus(prev => {
                            const newStatus = new Map(prev);
                            newStatus.set(labId, "error");
                            return newStatus;
                        });
                        return { labId, success: false, error: response?.error || "No exercises detected" };
                    }
                } catch (error) {
                    // In some cases the message channel fails but background has already persisted data.
                    const persisted = await hasGeneratedContext(labId);
                    if (persisted) {
                        setContextGenerationStatus(prev => {
                            const newStatus = new Map(prev);
                            newStatus.set(labId, "completed");
                            return newStatus;
                        });
                        setLabContextState(prev => {
                            const newState = new Map(prev);
                            const current = newState.get(labId);
                            if (current) {
                                newState.set(labId, {
                                    ...current,
                                    hasContext: true,
                                    originalGenerateContext: true,
                                });
                            }
                            return newState;
                        });
                        return { labId, success: true };
                    }

                    setContextGenerationStatus(prev => {
                        const newStatus = new Map(prev);
                        newStatus.set(labId, "error");
                        return newStatus;
                    });
                    return { labId, success: false, error };
                }
            });

            // Wait for all to complete
            const generationResults = await Promise.all(generationPromises);
            const failedLabs = generationResults.filter(result => !result.success).map(result => result.labId);

            if (failedLabs.length > 0 && onError) {
                onError(`No se pudo generar el contexto para ${failedLabs.length} laboratorio(s).`);
            }
        }

        // Remove context for labs that were unchecked
        for (const labId of labsToRemove) {
            const removeResponse = await chrome.runtime.sendMessage({
                action: "removeExerciseData",
                pageId: labId,
            });

            if (!removeResponse?.success) {
                throw new Error(removeResponse?.error || "No se pudo eliminar el contexto del laboratorio");
            }

            setLabContextState(prev => {
                const newState = new Map(prev);
                const current = newState.get(labId);
                if (current) {
                    newState.set(labId, {
                        ...current,
                        hasContext: false,
                        originalGenerateContext: false,
                    });
                }
                return newState;
            });
        }

        // Save other configuration changes
        for (const [labId, changes] of pendingChanges) {
            if (changes.verbosity !== undefined) {
                const verbosityResponse = await chrome.runtime.sendMessage({
                    action: "updateLabVerbosity",
                    courseId: courseId,
                    labId: labId,
                    verbosity: changes.verbosity,
                });

                if (!verbosityResponse?.success) {
                    throw new Error(verbosityResponse?.error || "No se pudo actualizar la verbosidad");
                }
            }
            if (changes.reasoningEffort !== undefined) {
                const reasoningResponse = await chrome.runtime.sendMessage({
                    action: "updateLabReasoningEffort",
                    courseId: courseId,
                    labId: labId,
                    reasoningEffort: changes.reasoningEffort,
                });

                if (!reasoningResponse?.success) {
                    throw new Error(reasoningResponse?.error || "No se pudo actualizar el razonamiento");
                }
            }
        }

        // Clear pending changes
        setPendingChanges(new Map());
        setHasUnsavedChanges(false);

        // Notify parent if needed
        if (onConfigUpdate) {
            onConfigUpdate();
        }

        // Reset generation status after a delay
        setTimeout(() => {
            setContextGenerationStatus(prev => {
                const newStatus = new Map(prev);
                for (const [labId] of newStatus) {
                    if (newStatus.get(labId) === "completed") {
                        newStatus.set(labId, "idle");
                    }
                }
                return newStatus;
            });
        }, 3000);
    } catch (error) {
        console.error("Error saving lab config:", error);
        if (onError) {
            onError("Error saving configuration. Please try again.");
        } else {
            alert("Error saving configuration. Please try again.");
        }
    } finally {
        setIsSaving(false);
    }
};