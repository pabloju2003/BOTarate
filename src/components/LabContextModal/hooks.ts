import { useEffect, useRef, useState } from "react";
import { LabContextData } from "./types";

const EMPTY_CONTEXT_DATA: LabContextData = {
    learningObjectives: "",
    exerciseContext: "",
    concepts: [],
};

export const useLabContextModal = (isOpen: boolean, labId: string, onContextUpdate?: () => void) => {
    const [data, setData] = useState<LabContextData>(EMPTY_CONTEXT_DATA);
    const [originalData, setOriginalData] = useState<LabContextData>(EMPTY_CONTEXT_DATA);
    const [activeTab, setActiveTab] = useState<string>("learningObjectives");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [newConcept, setNewConcept] = useState("");
    const loadRequestIdRef = useRef(0);

    useEffect(() => {
        if (isOpen && labId) {
            const requestId = ++loadRequestIdRef.current;
            setData(EMPTY_CONTEXT_DATA);
            setOriginalData(EMPTY_CONTEXT_DATA);
            setHasChanges(false);
            loadData(labId, requestId);
            setActiveTab("learningObjectives");
            setSaveMessage(null);
            setNewConcept("");
        }
    }, [isOpen, labId]);

    useEffect(() => {
        const changed =
            data.learningObjectives !== originalData.learningObjectives ||
            data.exerciseContext !== originalData.exerciseContext ||
            JSON.stringify(data.concepts) !== JSON.stringify(originalData.concepts);
        setHasChanges(changed);
    }, [data, originalData]);

    useEffect(() => {
        if (saveMessage) {
            const timer = setTimeout(() => setSaveMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [saveMessage]);

    const loadData = async (targetLabId: string, requestId: number) => {
        setIsLoading(true);
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getExerciseData",
                pageId: targetLabId,
            });
            if (requestId !== loadRequestIdRef.current) {
                return;
            }
            if (response.success && response.data) {
                const loaded: LabContextData = {
                    learningObjectives: response.data.learningObjectives || "",
                    exerciseContext: response.data.exerciseContext || "",
                    concepts: response.data.concepts || [],
                };
                setData(loaded);
                setOriginalData({
                    ...loaded,
                    concepts: [...loaded.concepts],
                });
            }
        } catch (error) {
            console.error("Error loading lab context:", error);
        } finally {
            if (requestId === loadRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            if (data.learningObjectives !== originalData.learningObjectives) {
                await chrome.runtime.sendMessage({
                    action: "updateLearningObjectives",
                    pageId: labId,
                    learningObjectives: data.learningObjectives,
                });
            }
            if (data.exerciseContext !== originalData.exerciseContext) {
                await chrome.runtime.sendMessage({
                    action: "updateExerciseContext",
                    pageId: labId,
                    exerciseContext: data.exerciseContext,
                });
            }
            if (JSON.stringify(data.concepts) !== JSON.stringify(originalData.concepts)) {
                await chrome.runtime.sendMessage({
                    action: "updateConcepts",
                    pageId: labId,
                    concepts: data.concepts,
                });
            }
            setOriginalData({
                ...data,
                concepts: [...data.concepts],
            });
            setHasChanges(false);
            setSaveMessage({ type: "success", text: "saved" });
            if (onContextUpdate) onContextUpdate();
        } catch (error) {
            console.error("Error saving lab context:", error);
            setSaveMessage({ type: "error", text: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const updateLearningObjectives = (value: string) => {
        setData(prev => ({ ...prev, learningObjectives: value }));
    };

    const updateExerciseContext = (value: string) => {
        setData(prev => ({ ...prev, exerciseContext: value }));
    };

    const addConcept = () => {
        if (newConcept.trim()) {
            setData(prev => ({ ...prev, concepts: [...prev.concepts, newConcept.trim()] }));
            setNewConcept("");
        }
    };

    const removeConcept = (index: number) => {
        setData(prev => ({
            ...prev,
            concepts: prev.concepts.filter((_, i) => i !== index),
        }));
    };

    const updateConcept = (index: number, value: string) => {
        setData(prev => ({
            ...prev,
            concepts: prev.concepts.map((c, i) => (i === index ? value : c)),
        }));
    };

    return {
        data,
        activeTab,
        setActiveTab,
        isLoading,
        isSaving,
        hasChanges,
        saveMessage,
        newConcept,
        setNewConcept,
        handleSave,
        updateLearningObjectives,
        updateExerciseContext,
        addConcept,
        removeConcept,
        updateConcept,
    };
};