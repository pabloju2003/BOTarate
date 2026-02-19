import { ContextGenerationStatus, LabContextState, PendingChanges } from "./types";

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

                    if (response.success) {
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
                        setContextGenerationStatus(prev => {
                            const newStatus = new Map(prev);
                            newStatus.set(labId, "error");
                            return newStatus;
                        });
                        return { labId, success: false, error: response.error };
                    }
                } catch (error) {
                    setContextGenerationStatus(prev => {
                        const newStatus = new Map(prev);
                        newStatus.set(labId, "error");
                        return newStatus;
                    });
                    return { labId, success: false, error };
                }
            });

            // Wait for all to complete
            await Promise.all(generationPromises);
        }

        // Remove context for labs that were unchecked
        for (const labId of labsToRemove) {
            await chrome.runtime.sendMessage({
                action: "removeExerciseData",
                pageId: labId,
            });
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
                await chrome.runtime.sendMessage({
                    action: "updateLabVerbosity",
                    courseId: courseId,
                    labId: labId,
                    verbosity: changes.verbosity,
                });
            }
            if (changes.reasoningEffort !== undefined) {
                await chrome.runtime.sendMessage({
                    action: "updateLabReasoningEffort",
                    courseId: courseId,
                    labId: labId,
                    reasoningEffort: changes.reasoningEffort,
                });
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
                    newStatus.set(labId, "idle");
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