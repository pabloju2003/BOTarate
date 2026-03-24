import { LabConfigTabStateStorageManager } from "../../util/storage/LabConfigTabStateStorageManager";
import { ContextGenerationStatus, LabConfig, LabContextState, PendingChanges, ReasoningEffort, VerbosityLevel } from "./types";

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

export const createHandlers = (
    labConfig: Map<string, LabConfig>,
    setLabConfig: React.Dispatch<React.SetStateAction<Map<string, LabConfig>>>,
    pendingChanges: Map<string, PendingChanges>,
    setPendingChanges: React.Dispatch<React.SetStateAction<Map<string, PendingChanges>>>,
    setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>,
    labContextState: Map<string, LabContextState>,
    setLabContextState: React.Dispatch<React.SetStateAction<Map<string, LabContextState>>>,
    expandedLab: string | null,
    setExpandedLab: React.Dispatch<React.SetStateAction<string | null>>,
    contentRef: React.RefObject<HTMLDivElement | null>,
    courseId: string,
    onConfigUpdate?: () => void,
    contextGenerationStatus?: Map<string, ContextGenerationStatus>,
    setContextGenerationStatus?: React.Dispatch<React.SetStateAction<Map<string, ContextGenerationStatus>>>
) => {
    const handleToggleGenerateContext = (labId: string) => {
        setLabContextState(prev => {
            const newState = new Map(prev);
            const current = newState.get(labId);
            if (current) {
                newState.set(labId, {
                    ...current,
                    generateContext: !current.generateContext,
                });
            }
            return newState;
        });
        setHasUnsavedChanges(true);
    };

    const handleVerbosityChange = (labId: string, verbosity: VerbosityLevel) => {
        setLabConfig(prev => {
            const newConfig = new Map(prev);
            const current = newConfig.get(labId);
            if (current) {
                newConfig.set(labId, { ...current, verbosity });
            }
            return newConfig;
        });

        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            const current = newChanges.get(labId) || {};
            newChanges.set(labId, { ...current, verbosity });
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const handleReasoningChange = (labId: string, reasoningEffort: ReasoningEffort) => {
        setLabConfig(prev => {
            const newConfig = new Map(prev);
            const current = newConfig.get(labId);
            if (current) {
                newConfig.set(labId, { ...current, reasoningEffort });
            }
            return newConfig;
        });

        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            const current = newChanges.get(labId) || {};
            newChanges.set(labId, { ...current, reasoningEffort });
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const toggleExpand = (labId: string) => {
        setExpandedLab(prev => {
            const newExpanded = prev === labId ? null : labId;
            // Guardar el estado del accordion y scroll
            LabConfigTabStateStorageManager.saveState({
                expandedLab: newExpanded,
                scrollTop: contentRef.current?.scrollTop || 0,
            });
            if (newExpanded && contentRef.current) {
                const element = document.getElementById(`lab-${labId}`);
                if (element) {
                    const offsetTop = element.offsetTop;
                    contentRef.current.scrollTo({ top: offsetTop, behavior: "smooth" });
                }
            }
            return newExpanded;
        });
    };

    const handleRegenerateContext = async (labId: string) => {
        if (!setContextGenerationStatus) return;

        // Set generating status
        setContextGenerationStatus(prev => {
            const newStatus = new Map(prev);
            newStatus.set(labId, "generating");
            return newStatus;
        });

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
                // Notify parent if needed
                if (onConfigUpdate) {
                    onConfigUpdate();
                }
            } else {
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
                    if (onConfigUpdate) {
                        onConfigUpdate();
                    }
                    return;
                }

                setContextGenerationStatus(prev => {
                    const newStatus = new Map(prev);
                    newStatus.set(labId, "error");
                    return newStatus;
                });
            }
        } catch {
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
                if (onConfigUpdate) {
                    onConfigUpdate();
                }
                return;
            }

            setContextGenerationStatus(prev => {
                const newStatus = new Map(prev);
                newStatus.set(labId, "error");
                return newStatus;
            });
        }

        // Reset status after a delay
        setTimeout(() => {
            setContextGenerationStatus(prev => {
                const newStatus = new Map(prev);
                const currentStatus = newStatus.get(labId);
                if (currentStatus === "completed") {
                    newStatus.set(labId, "idle");
                }
                return newStatus;
            });
        }, 3000);
    };

    return {
        handleToggleGenerateContext,
        handleVerbosityChange,
        handleReasoningChange,
        toggleExpand,
        handleRegenerateContext,
    };
};