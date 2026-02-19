import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImportExportManager } from "../../util/storage/ImportExportManager";
import { ImportExportTabProps } from "./types";

export const useImportExport = ({ courseId, onDataChange }: ImportExportTabProps) => {
    const { t } = useTranslation();
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Exporta la configuración a un archivo JSON
     */
    const handleExport = async () => {
        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.exportToFile(courseId);
            let text = "";
            if (result.success) {
                text = t('options.importExport.messages.exportSuccess', 'Configuration exported successfully');
            } else {
                text = t('options.importExport.messages.exportError', 'Unexpected error exporting: {{error}}', { error: result.message });
            }

            setMessage({
                text,
                type: result.success ? "success" : "error",
            });
        } catch (error) {
            console.error("Error exporting configuration:", error);
            setMessage({
                text: t('options.importExport.messages.exportError', 'Unexpected error exporting: {{error}}', { error: error instanceof Error ? error.message : "Unknown error" }),
                type: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Importa la configuración desde un archivo JSON
     */
    const handleImport = async (file: File) => {
        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.importFromFile(file, courseId);

            let text = "";
            if (result.success) {
                text = t('options.importExport.messages.importSuccess', 'Configuration imported successfully');
            } else {
                // Map complex errors
                switch (result.message) {
                    case "invalid_format":
                        text = t('options.importExport.messages.importFormatError');
                        break;
                    case "invalid_signature":
                        text = t('options.importExport.messages.importSignatureError');
                        break;
                    case "invalid_json":
                        text = t('options.importExport.messages.importJsonError');
                        break;
                    default:
                        text = t('options.importExport.messages.importError', 'Unexpected error importing: {{error}}', { error: result.message });
                }
            }

            setMessage({
                text,
                type: result.success ? "success" : "error",
            });
            if (result.success && onDataChange) {
                onDataChange();
            }
        } catch (error) {
            console.error("Error importing configuration:", error);
            setMessage({
                text: t('options.importExport.messages.importError', 'Unexpected error importing: {{error}}', { error: error instanceof Error ? error.message : "Unknown error" }),
                type: "error",
            });
        } finally {
            setIsProcessing(false);
            // Limpiar el input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    /**
     * Limpia todos los datos del storage
     */
    const handleClearAll = async () => {
        const confirmed = confirm(
            t('options.importExport.confirmClear', "⚠️ WARNING: This action will delete ALL saved configuration, including:\n\n- Agent configuration\n- Identified exercise data\n- Configured lab data\n\nThis action CANNOT be undone. Are you sure you want to continue?")
        );

        if (!confirmed) return;

        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.clearAllData(courseId);
            let text = "";
            if (result.success) {
                text = t('options.importExport.messages.clearSuccess', 'All data has been deleted successfully');
            } else {
                text = t('options.importExport.messages.clearError', 'Unexpected error clearing: {{error}}', { error: result.message });
            }

            setMessage({
                text,
                type: result.success ? "info" : "error",
            });
            if (result.success && onDataChange) {
                onDataChange();
            }
        } catch (error) {
            console.error("Error clearing data:", error);
            setMessage({
                text: t('options.importExport.messages.clearError', 'Unexpected error clearing: {{error}}', { error: error instanceof Error ? error.message : "Unknown error" }),
                type: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.name.endsWith(".json")) {
                setMessage({
                    text: t('options.importExport.messages.invalidFile', 'Please select a valid JSON file.'),
                    type: "error",
                });
                return;
            }
            handleImport(file);
        }
    };

    /**
     * Limpia solo el contexto de laboratorios
     */
    const handleClearLabContext = async () => {
        const confirmed = confirm(
            t('options.importExport.confirmClearContext', "⚠️ WARNING: This action will delete ONLY the lab context (exercises and identified information):\n\n- Identified exercise data\n- Configured lab data\n\nAgent prompts and other settings will be preserved.\n\nThis action CANNOT be undone. Are you sure you want to continue?")
        );

        if (!confirmed) return;

        setIsProcessing(true);
        setMessage(null);

        try {
            const result = await ImportExportManager.clearLabContextOnly(courseId);
            let text = "";
            if (result.success) {
                text = t('options.importExport.messages.clearContextSuccess', 'Lab context has been deleted successfully');
            } else {
                text = t('options.importExport.messages.clearContextError', 'Unexpected error clearing context: {{error}}', { error: result.message });
            }

            setMessage({
                text,
                type: result.success ? "info" : "error",
            });
            if (result.success && onDataChange) {
                onDataChange();
            }
        } catch (error) {
            console.error("Error clearing lab context:", error);
            setMessage({
                text: t('options.importExport.messages.clearContextError', 'Unexpected error clearing context: {{error}}', { error: error instanceof Error ? error.message : "Unknown error" }),
                type: "error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        message,
        isProcessing,
        fileInputRef,
        handleExport,
        handleImport,
        handleClearAll,
        handleClearLabContext,
        handleFileSelect,
        setMessage,
    };
};