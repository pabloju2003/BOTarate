import { useEffect, useState } from "react";
import { ChatMessage, ExerciseModalProps, Explanation } from "./types";

export const useExerciseModal = ({
    exercise,
    isOpen,
    pageId,
    courseId,
    loadFromCache = false,
    onExplanationGenerated,
}: Pick<ExerciseModalProps, "exercise" | "isOpen" | "pageId" | "courseId" | "loadFromCache" | "onExplanationGenerated">) => {
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState<boolean>(false);
    const [explanationError, setExplanationError] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState<string>("");
    const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
    const [isChatInitialized, setIsChatInitialized] = useState<boolean>(false);

    // Generar automáticamente la explicación al abrir el modal
    useEffect(() => {
        if (isOpen) {
            // Resetear el estado al abrir
            setExplanation(null);
            setExplanationError(null);
            setChatMessages([]);
            setChatInput("");
            setIsChatInitialized(false);

            // Decidir si cargar del cache o generar nueva
            if (loadFromCache) {
                handleLoadCachedExplanation();
            } else {
                handleGenerateExplanation();
            }
        }
    }, [isOpen, exercise.name, loadFromCache]); // Regenerar si cambia el ejercicio o el modo

    const initializeChatContext = async (fromCache: boolean) => {
        if (!pageId) return;

        try {
            const response = await chrome.runtime.sendMessage({
                action: "initializeExplanationChat",
                pageId: pageId,
                exerciseName: exercise.name,
                courseId: courseId,
                fromCache: fromCache,
            });

            if (response.success) {
                setIsChatInitialized(true);
                console.log("Chat context initialized");
            } else {
                console.error("Error initializing chat:", response.error);
            }
        } catch (error) {
            console.error("Error initializing chat:", error);
        }
    };

    const handleLoadCachedExplanation = async () => {
        if (!pageId) {
            setExplanationError("Cannot load explanation: page ID missing");
            return;
        }

        setIsLoadingExplanation(true);
        setExplanationError(null);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "getCachedExplanation",
                pageId: pageId,
                exerciseName: exercise.name,
            });

            if (response.success) {
                setExplanation(response.explanation);
                console.log("Explanation loaded from cache");

                // Cargar el historial del chat si existe
                if (response.explanation.chatHistory && Array.isArray(response.explanation.chatHistory)) {
                    setChatMessages(response.explanation.chatHistory);
                }

                // Inicializar el contexto del chat para explicaciones cargadas del cache
                await initializeChatContext(true);
            } else {
                const errorMessage = response.error || "No saved explanation found";
                console.error("Error loading explanation from cache:", errorMessage);
                setExplanationError(errorMessage);
            }
        } catch (error) {
            console.error("Error loading explanation from cache:", error);
            setExplanationError("Communication error loading explanation");
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const handleGenerateExplanation = async () => {
        setIsLoadingExplanation(true);
        setExplanationError(null);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "generateExplanation",
                exerciseName: exercise.name,
                pageId: pageId,
                courseId: courseId,
            });

            if (response.success) {
                setExplanation(response.explanation);
                console.log("Explanation generated successfully");

                // El contexto ya está en explanationAgent, no necesitamos inicializar
                setIsChatInitialized(true);

                // Notificar que se generó una nueva explicación
                if (onExplanationGenerated) {
                    onExplanationGenerated();
                }
            } else {
                const errorMessage = response.error || "Unknown error generating explanation";
                console.error("Error generating explanation:", errorMessage);
                setExplanationError(errorMessage);
            }
        } catch (error) {
            console.error("Error generating explanation:", error);
            const errorMessage =
                error instanceof Error
                    ? `Communication error: ${error.message}`
                    : "Communication error with AI agent";
            setExplanationError(errorMessage);
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const handleSendChatMessage = async () => {
        if (!chatInput.trim() || isSendingMessage || !isChatInitialized) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: chatInput,
            id: `user-${Date.now()}`,
        };

        const newMessages = [...chatMessages, userMessage];
        setChatMessages(newMessages);
        setChatInput("");
        setIsSendingMessage(true);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "sendExplanationChatMessage",
                message: chatInput,
                pageId: pageId,
                exerciseName: exercise.name,
                courseId: courseId,
                chatHistory: chatMessages,
            });

            if (response.success) {
                const agentMessage: ChatMessage = {
                    role: "assistant",
                    content: response.response,
                    id: `agent-${Date.now()}`,
                };

                const updatedMessages = [...newMessages, agentMessage];
                setChatMessages(updatedMessages);

                // Guardar el historial actualizado en el storage
                if (pageId) {
                    await chrome.runtime.sendMessage({
                        action: "saveChatHistory",
                        pageId: pageId,
                        exerciseName: exercise.name,
                        chatHistory: updatedMessages,
                    });
                }
            } else {
                const errorMessage: ChatMessage = {
                    role: "assistant",
                    content: `Error: ${response.error || "Unknown error"}`,
                    id: `error-${Date.now()}`,
                };

                setChatMessages([...newMessages, errorMessage]);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "Communication error with AI agent",
                id: `error-${Date.now()}`,
            };

            setChatMessages([...newMessages, errorMessage]);
        } finally {
            setIsSendingMessage(false);
        }
    };

    const handleRegenerateExplanation = () => {
        setExplanation(null);
        setChatMessages([]);
        setIsChatInitialized(false);
        handleGenerateExplanation();
    };

    return {
        explanation,
        isLoadingExplanation,
        explanationError,
        chatMessages,
        chatInput,
        setChatInput,
        isSendingMessage,
        isChatInitialized,
        handleGenerateExplanation,
        handleSendChatMessage,
        handleRegenerateExplanation,
    };
};