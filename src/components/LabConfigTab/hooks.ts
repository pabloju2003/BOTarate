import { useEffect, useRef, useState } from "react";
import { LabConfigTabStateStorageManager } from "../../util/storage/LabConfigTabStateStorageManager";
import {
    ContextGenerationStatus,
    Lab,
    LabConfig,
    LabContextState,
    PendingChanges
} from "./types";

export const useLabConfigState = (courseId: string, isActive: boolean) => {
    const [labs, setLabs] = useState<Lab[]>([]);
    const [labConfig, setLabConfig] = useState<Map<string, LabConfig>>(new Map());
    const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChanges>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedLab, setExpandedLab] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Context generation states
    const [labContextState, setLabContextState] = useState<Map<string, LabContextState>>(new Map());
    const [contextGenerationStatus, setContextGenerationStatus] = useState<Map<string, ContextGenerationStatus>>(
        new Map()
    );
    const [hasContextChanges, setHasContextChanges] = useState(false);

    // Modal state
    const [contextModalLabId, setContextModalLabId] = useState<string | null>(null);

    // Restaurar estado guardado (scroll y accordion) al montar
    useEffect(() => {
        if (isActive && courseId) {
            const savedState = LabConfigTabStateStorageManager.getState();
            if (savedState) {
                setExpandedLab(savedState.expandedLab);
                setTimeout(() => {
                    if (contentRef.current) {
                        contentRef.current.scrollTop = savedState.scrollTop;
                    }
                }, 0);
            }
            loadConfigFromStorage();
        }
    }, [isActive, courseId]);

    // Detect if there are context changes
    useEffect(() => {
        let hasChanges = false;
        for (const [, state] of labContextState) {
            if (state.generateContext !== state.originalGenerateContext) {
                hasChanges = true;
                break;
            }
        }
        setHasContextChanges(hasChanges);
    }, [labContextState]);

    const loadConfigFromStorage = async () => {
        setIsLoading(true);
        try {
            // Obtener datos de labs
            const response = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (response.success && response.data?.labs) {
                setLabs(response.data.labs);

                const config = new Map<string, LabConfig>();
                const contextState = new Map<string, LabContextState>();
                const generationStatus = new Map<string, ContextGenerationStatus>();

                // Check context status for each lab
                for (const lab of response.data.labs) {
                    config.set(lab.id, {
                        verbosity: lab.verbosity ?? "medium",
                        reasoningEffort: lab.reasoningEffort ?? "medium",
                    });

                    // Check if lab has exercise data (context)
                    const exerciseDataResponse = await chrome.runtime.sendMessage({
                        action: "getExerciseData",
                        pageId: lab.id,
                    });

                    const hasContext =
                        exerciseDataResponse.success &&
                        exerciseDataResponse.data &&
                        exerciseDataResponse.data.exercises !== undefined;

                    contextState.set(lab.id, {
                        hasContext,
                        generateContext: hasContext,
                        originalGenerateContext: hasContext,
                    });
                    generationStatus.set(lab.id, "idle");
                }

                setLabConfig(config);
                setLabContextState(contextState);
                setContextGenerationStatus(generationStatus);
                setPendingChanges(new Map());
                setHasUnsavedChanges(false);
            }
        } catch (error) {
            console.error("Error loading lab config from storage:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleScroll = () => {
        LabConfigTabStateStorageManager.saveState({
            expandedLab,
            scrollTop: contentRef.current?.scrollTop || 0,
        });
    };

    return {
        labs,
        labConfig,
        setLabConfig,
        pendingChanges,
        setPendingChanges,
        isSaving,
        setIsSaving,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        isLoading,
        expandedLab,
        setExpandedLab,
        contentRef,
        labContextState,
        setLabContextState,
        contextGenerationStatus,
        setContextGenerationStatus,
        hasContextChanges,
        loadConfigFromStorage,
        handleScroll,
        contextModalLabId,
        setContextModalLabId,
    };
};