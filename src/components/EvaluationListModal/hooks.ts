import { useEffect, useState } from "react";
import { SavedEvaluation } from "./types";

export const useEvaluations = (isOpen: boolean, exerciseName: string, pageId?: string) => {
    const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedEvaluation, setSelectedEvaluation] = useState<SavedEvaluation | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadEvaluations();
        }
    }, [isOpen, exerciseName, pageId]);

    const loadEvaluations = async () => {
        setIsLoading(true);
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getEvaluations",
                exerciseName: exerciseName,
                pageId: pageId,
            });

            if (response.success && response.evaluations) {
                const sortedEvaluations = [...response.evaluations].sort((a, b) => b.timestamp - a.timestamp);
                setEvaluations(sortedEvaluations);
                if (sortedEvaluations.length > 0) {
                    setSelectedEvaluation(sortedEvaluations[0]);
                } else {
                    setSelectedEvaluation(null);
                }
            } else {
                setEvaluations([]);
                setSelectedEvaluation(null);
            }
        } catch (error) {
            console.error("[EvaluationListModal] Error loading evaluations:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        evaluations,
        isLoading,
        selectedEvaluation,
        setSelectedEvaluation,
    };
};