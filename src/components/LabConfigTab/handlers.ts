import { LabConfigTabStateStorageManager } from "../../util/storage/LabConfigTabStateStorageManager";
import { ContextGenerationStatus, LabConfig, LabContextState, PendingChanges, ReasoningEffort, VerbosityLevel } from "./types";

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
                // Notify parent if needed
                if (onConfigUpdate) {
                    onConfigUpdate();
                }
            } else {
                setContextGenerationStatus(prev => {
                    const newStatus = new Map(prev);
                    newStatus.set(labId, "error");
                    return newStatus;
                });
            }
        } catch {
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
                if (currentStatus === "completed" || currentStatus === "error") {
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