import { useEffect, useState } from "react";

export const useSolutionModal = (
    isOpen: boolean,
    exerciseName: string,
    onClose: () => void,
    onEvaluationGenerated?: () => void
) => {
    const [solution, setSolution] = useState<string>("");
    const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
    const [evaluationError, setEvaluationError] = useState<string | null>(null);

    // Resetear el estado al abrir el modal
    useEffect(() => {
        if (isOpen) {
            setSolution("");
            setEvaluationError(null);
        }
    }, [isOpen, exerciseName]);

    const handleSubmit = async (
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        learningObjectives?: string,
        pageId?: string,
        courseId?: string
    ) => {
        if (!solution.trim()) {
            setEvaluationError("Please enter a solution before submitting");
            return;
        }

        setIsEvaluating(true);
        setEvaluationError(null);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "evaluateSolution",
                exerciseName,
                exerciseStatement,
                studentSolution: solution,
                exercise_context: exerciseContext || undefined,
                learning_objectives: learningObjectives || undefined,
                pageId: pageId || undefined,
                courseId: courseId || undefined,
            });

            if (response.success) {
                console.log("Solution evaluated successfully");
                // Cerrar el modal
                onClose();
                // Notificar que se generó una nueva evaluación para abrir el modal de lista
                if (onEvaluationGenerated) {
                    onEvaluationGenerated();
                }
            } else {
                const errorMessage = response.error || "Unknown error evaluating solution";
                console.error("Error evaluating solution:", errorMessage);
                setEvaluationError(errorMessage);
            }
        } catch (error) {
            console.error("Error evaluating solution:", error);
            const errorMessage =
                error instanceof Error
                    ? `Communication error: ${error.message}`
                    : "Communication error with AI agent";
            setEvaluationError(errorMessage);
        } finally {
            setIsEvaluating(false);
        }
    };

    return {
        solution,
        setSolution,
        isEvaluating,
        evaluationError,
        handleSubmit,
    };
};