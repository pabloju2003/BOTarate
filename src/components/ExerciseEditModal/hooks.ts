import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExerciseEditModalProps } from "./types";

export const useExerciseEditModal = ({
    exercise,
    isOpen,
    labId,
    onExerciseUpdate,
}: ExerciseEditModalProps) => {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [statement, setStatement] = useState("");
    const [originalName, setOriginalName] = useState("");
    const [originalStatement, setOriginalStatement] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (isOpen && !isInitialized) {
            if (exercise) {
                setName(exercise.name);
                setStatement(exercise.statement);
                setOriginalName(exercise.name);
                setOriginalStatement(exercise.statement);
            }
            setError(null);
            setSuccessMessage(null);
            setIsInitialized(true);
        } else if (!isOpen) {
            setIsInitialized(false);
        }
    }, [isOpen, exercise, isInitialized]);

    useEffect(() => {
        setSuccessMessage(null);
    }, [name, statement]);

    const hasChanges = name.trim() !== originalName || statement.trim() !== originalStatement;

    const handleSave = async () => {
        if (!name.trim()) {
            setError(t("options.exerciseEdit.errors.nameRequired"));
            return;
        }
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            if (!exercise?.name) {
                throw new Error(t("options.exerciseEdit.errors.saveError"));
            }

            const response: { success?: boolean; error?: string } = await chrome.runtime.sendMessage({
                action: "updateExercise",
                pageId: labId,
                oldName: exercise.name,
                exercise: { name: name.trim(), statement: statement.trim() },
            });

            if (!response?.success) {
                throw new Error(response?.error || t("options.exerciseEdit.errors.saveError"));
            }

            setIsSaving(false);
            setOriginalName(name.trim());
            setOriginalStatement(statement.trim());
            setSuccessMessage(t("options.exerciseEdit.success.updated"));

            if (onExerciseUpdate) {
                onExerciseUpdate();
            }
        } catch (err) {
            console.error("Error saving exercise:", err);
            const errorMessage = err instanceof Error ? err.message : t("options.exerciseEdit.errors.saveError");
            setError(errorMessage);
            setIsSaving(false);
        }
    };

    return {
        name,
        setName,
        statement,
        setStatement,
        isSaving,
        error,
        successMessage,
        hasChanges,
        handleSave,
    };
};