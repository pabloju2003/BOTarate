import { useEffect, useState } from "react";
import { RefinerChatMessage, RefinerModalProps } from "./types";

type Args = Pick<RefinerModalProps, "exercise" | "isOpen" | "pageId" | "courseId">;

export const useRefinerModal = ({ exercise, isOpen, pageId, courseId }: Args) => {
    const [draft, setDraft] = useState<string>("");
    const [messages, setMessages] = useState<RefinerChatMessage[]>([]);
    const [isSubmittingDraft, setIsSubmittingDraft] = useState<boolean>(false);
    const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
    const [chatInput, setChatInput] = useState<string>("");
    const [errorBanner, setErrorBanner] = useState<string | null>(null);
    const [isRestoringSession, setIsRestoringSession] = useState<boolean>(false);

    /** True until the student has submitted at least one draft for this exercise. */
    const isFirstDraft = !messages.some(m => m.role === "user" && m.isDraft);

    useEffect(() => {
        if (!isOpen) return;

        // Reset on open
        setDraft("");
        setMessages([]);
        setChatInput("");
        setErrorBanner(null);

        if (!pageId) return;

        let cancelled = false;
        setIsRestoringSession(true);
        (async () => {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: "getRefinerHistory",
                    pageId,
                    exerciseName: exercise.name,
                });
                if (cancelled) return;
                if (response?.success && response.session) {
                    setMessages(response.session.chatHistory ?? []);
                    setDraft(response.session.latestDraft ?? "");
                }
            } catch (error) {
                console.error("[RefinerModal] Error restoring session:", error);
            } finally {
                if (!cancelled) setIsRestoringSession(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, exercise.name, pageId]);

    const persistSession = async (
        nextMessages: RefinerChatMessage[],
        nextDraft: string
    ): Promise<void> => {
        if (!pageId) return;
        try {
            await chrome.runtime.sendMessage({
                action: "saveRefinerHistory",
                pageId,
                exerciseName: exercise.name,
                chatHistory: nextMessages,
                latestDraft: nextDraft,
            });
        } catch (error) {
            console.error("[RefinerModal] Error persisting session:", error);
        }
    };

    const handleSubmitDraft = async () => {
        if (!draft.trim() || isSubmittingDraft || isSendingMessage) return;

        const draftMessage: RefinerChatMessage = {
            role: "user",
            content: draft,
            id: `draft-${Date.now()}`,
            isDraft: true,
        };

        const messagesWithDraft = [...messages, draftMessage];
        setMessages(messagesWithDraft);
        setIsSubmittingDraft(true);
        setErrorBanner(null);

        const action = isFirstDraft ? "startRefinerSession" : "refinerDraft";

        try {
            const response = await chrome.runtime.sendMessage({
                action,
                exerciseName: exercise.name,
                pageId,
                courseId,
                studentDraft: draft,
                chatHistory: messages,
            });

            if (response?.success) {
                const feedbackMessage: RefinerChatMessage = {
                    role: "assistant",
                    content: response.feedback,
                    id: `feedback-${Date.now()}`,
                };
                const finalMessages = [...messagesWithDraft, feedbackMessage];
                setMessages(finalMessages);
                await persistSession(finalMessages, draft);
            } else {
                const errorMsg = response?.error || "Unknown error evaluating draft";
                setErrorBanner(errorMsg);
                setMessages(messages);
            }
        } catch (error) {
            console.error("[RefinerModal] Error submitting draft:", error);
            setErrorBanner(error instanceof Error ? error.message : "Communication error");
            setMessages(messages);
        } finally {
            setIsSubmittingDraft(false);
        }
    };

    const handleSendFollowUp = async () => {
        if (!chatInput.trim() || isSendingMessage || isSubmittingDraft) return;

        const userMessage: RefinerChatMessage = {
            role: "user",
            content: chatInput,
            id: `user-${Date.now()}`,
        };

        const messagesWithUser = [...messages, userMessage];
        const sentInput = chatInput;
        setMessages(messagesWithUser);
        setChatInput("");
        setIsSendingMessage(true);
        setErrorBanner(null);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "refinerFollowUp",
                message: sentInput,
                exerciseName: exercise.name,
                pageId,
                courseId,
                chatHistory: messages,
            });

            if (response?.success) {
                const agentMessage: RefinerChatMessage = {
                    role: "assistant",
                    content: response.response,
                    id: `agent-${Date.now()}`,
                };
                const finalMessages = [...messagesWithUser, agentMessage];
                setMessages(finalMessages);
                await persistSession(finalMessages, draft);
            } else {
                const errorMsg = response?.error || "Unknown error answering follow-up";
                setErrorBanner(errorMsg);
                setMessages(messages);
                setChatInput(sentInput);
            }
        } catch (error) {
            console.error("[RefinerModal] Error sending follow-up:", error);
            setErrorBanner(error instanceof Error ? error.message : "Communication error");
            setMessages(messages);
            setChatInput(sentInput);
        } finally {
            setIsSendingMessage(false);
        }
    };

    return {
        draft,
        setDraft,
        messages,
        isSubmittingDraft,
        isSendingMessage,
        chatInput,
        setChatInput,
        isFirstDraft,
        errorBanner,
        isRestoringSession,
        handleSubmitDraft,
        handleSendFollowUp,
    };
};
