import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isPicky?: boolean;
}

// Formato de tool call del historial (viene de OpenAI)
interface ToolCallFromHistory {
    function: {
        name: string;
        arguments: string;
    };
    id: string;
    type: string;
}

// Formato simplificado que enviamos desde el backend
interface ToolCallSimple {
    name: string;
    arguments: string;
}

type ToolCall = ToolCallFromHistory | ToolCallSimple;

interface ChatMessage {
    role: "user" | "assistant" | "tool";
    content: string | null;
    id: string;
    tool_calls?: ToolCall[];
    name?: string;
}

interface ChatTabProps {
    messages: ChatMessage[];
    inputValue: string;
    isGenerating: boolean;
    isChatDisabled: boolean;
    isLoadingExercises: boolean;
    pageId?: string;
    hasExercisesLoaded?: boolean;
    exercises: Exercise[];
    isAnyModalOpen: boolean;
    isTeacherMode: boolean;
    onSendMessage: () => void;
    onResetChat: () => void;
    onInputChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

// Helper para traducir mensajes de herramientas
const useToolMessageTranslator = (exercises?: Exercise[]) => {
    const { t } = useTranslation();

    const getToolFriendlyMessage = (toolCall: ToolCall): string | null => {
        const info = getToolCallInfo(toolCall);
        if (!info) return null;

        const { name, args, displayName } = info;

        switch (name) {
            case "getSectionContent":
                return displayName
                    ? t("tools.getSection.withName", {
                          name: displayName,
                          defaultValue: `📂 Consulting section "${displayName}"...`,
                      })
                    : t("tools.getSection.generic", { defaultValue: "📂 Consulting section..." });
            case "getPageContent":
                return displayName
                    ? t("tools.getPage.withName", {
                          name: displayName,
                          defaultValue: `📄 Reading page "${displayName}"...`,
                      })
                    : t("tools.getPage.generic", { defaultValue: "📄 Reading page..." });
            case "getResourceContent":
                return displayName
                    ? t("tools.getResource.withName", {
                          name: displayName,
                          defaultValue: `📦 Reading resource "${displayName}"...`,
                      })
                    : t("tools.getResource.generic", { defaultValue: "📦 Reading resource..." });
            case "explainExercise": {
                const index = args.index || args.exerciseIndex;
                // Preferir mostrar el nombre del ejercicio si está disponible
                if (index && exercises) {
                    const idx0 = Number(index) - 1;
                    const ex = exercises[idx0];
                    if (ex && ex.name) {
                        return t("tools.explainExercise.withName", {
                            name: ex.name,
                            defaultValue: `💡 Explaining exercise "${ex.name}"...`,
                        });
                    }
                }

                return t("tools.explainExercise.default", {
                    index: index,
                    defaultValue: `💡 Explaining exercise ${index}...`,
                });
            }
            case "solveExercise": {
                const index = args.index || args.exerciseIndex;
                if (index && exercises) {
                    const idx0 = Number(index) - 1;
                    const ex = exercises[idx0];
                    if (ex && ex.name) {
                        return t("tools.solveExercise.withName", {
                            name: ex.name,
                            defaultValue: `📝 Opening solution form for exercise "${ex.name}"...`,
                        });
                    }
                }

                return t("tools.solveExercise.default", {
                    index: index,
                    defaultValue: `📝 Opening solution form for exercise ${index}...`,
                });
            }
            case "getFilteredFileContent":
                return t("tools.getFilteredFileContent", { defaultValue: "🔍 Searching in file..." });
            case "analyzeImage":
                return displayName
                    ? t("tools.analyzeImage.withName", {
                          name: displayName,
                          defaultValue: `🖼️ Analyzing image "${displayName}"...`,
                      })
                    : t("tools.analyzeImage.generic", { defaultValue: "🖼️ Analyzing image..." });
            default:
                return t("tools.default", { name, defaultValue: `🔧 Executing tool: ${name}...` });
        }
    };

    return { getToolFriendlyMessage };
};

/**
 * Helper para obtener nombre y argumentos de un ToolCall (soporta ambos formatos)
 */
const getToolCallInfo = (toolCall: ToolCall): { name: string; args: any; displayName?: string } | null => {
    try {
        // Formato del historial de OpenAI: { function: { name, arguments } }
        if ("function" in toolCall && toolCall.function) {
            return {
                name: toolCall.function.name,
                args: JSON.parse(toolCall.function.arguments),
                displayName: (toolCall as any).displayName,
            };
        }
        // Formato simplificado del backend: { name, arguments, displayName }
        if ("name" in toolCall) {
            return {
                name: toolCall.name,
                args: JSON.parse(toolCall.arguments),
                displayName: (toolCall as any).displayName,
            };
        }
        return null;
    } catch {
        return null;
    }
};

const ChatTab: React.FC<ChatTabProps> = ({
    messages,
    inputValue,
    isGenerating,
    isChatDisabled,
    isLoadingExercises,
    pageId,
    hasExercisesLoaded,
    exercises,
    isAnyModalOpen,
    isTeacherMode,
    onSendMessage,
    onResetChat,
    onInputChange,
    onKeyDown,
    messagesEndRef,
    inputRef,
}) => {
    const { t } = useTranslation();
    const { getToolFriendlyMessage } = useToolMessageTranslator(exercises);

    // Efecto: enfocar el input cuando deja de estar deshabilitado
    useEffect(() => {
        if (!isChatDisabled) {
            setTimeout(() => {
                inputRef?.current?.focus();
            }, 0);
        }
    }, [isChatDisabled, inputRef]);

    const getChatPlaceholder = () => {
        if (isAnyModalOpen) return t("chatTab.placeholder.disabledModal", "Chat disabled (modal open)...");
        if (isTeacherMode) return t("chatTab.placeholder.teacherMode", "Switch to student mode to use the chat...");
        if (isLoadingExercises) return t("chatTab.placeholder.loadingExercises", "Loading exercises...");
        if (pageId && !hasExercisesLoaded)
            return t("chatTab.placeholder.notConfigured", "Lab not configured by teacher...");
        return t("chatTab.placeholder.default", "Type your question...");
    };

    const getWelcomeMessage = () => {
        if (!pageId) {
            return t(
                "chatTab.welcome.default",
                "You can ask me about the course content. If you want to work on exercises, open a lab first.",
            );
        }

        if (exercises.length > 0) {
            return t(
                "chatTab.welcome.ready",
                "The exercises on this page are ready. Ask me for an explanation or tell me if you want to check your solution for any of them. If you want, I can also give you the list of available exercises.",
            );
        }

        if (pageId && !hasExercisesLoaded) {
            return t(
                "chatTab.welcome.identifying",
                "As soon as you identify the exercises, I will be able to help you with them.",
            );
        }

        return t("chatTab.welcome.genericHelper", "I am here to help you with the course.");
    };

    const renderHTML = (html: string) => <span dangerouslySetInnerHTML={{ __html: html }} />;

    return (
        <>
            <div
                style={{
                    flex: "1",
                    overflowY: "auto",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                }}
            >
                {isTeacherMode ? (
                    <div className="alert alert-info" role="alert">
                        <h5 className="alert-heading">
                            <i className="bi bi-info-circle-fill me-2"></i>
                            {t("chatTab.status.teacherModeTitle", "Teacher mode active")}
                        </h5>
                        <p>
                            {t(
                                "chatTab.status.teacherModeDesc",
                                "You are in teacher mode. To use the chat agent, you must switch to student mode.",
                            )}
                        </p>
                        <hr />
                        <p className="mb-0">
                            {renderHTML(
                                t(
                                    "chatTab.status.teacherModeAction",
                                    'Go to the <strong>"Mode"</strong> switch to change your mode.',
                                ),
                            )}
                        </p>
                    </div>
                ) : isLoadingExercises ? (
                    <div className="card border-primary">
                        <div className="card-body p-3">
                            <div className="d-flex align-items-center mb-2">
                                <div className="spinner-border spinner-border-sm text-primary me-2">
                                    <span className="visually-hidden">{t("common.loading", "Loading...")}</span>
                                </div>
                                <strong>{t("chatTab.status.searchingExercises", "Searching for exercises...")}</strong>
                            </div>
                            <p className="text-muted small mb-0">
                                {t(
                                    "chatTab.status.analyzingContent",
                                    "Analyzing page content to identify available exercises.",
                                )}
                            </p>
                        </div>
                    </div>
                ) : pageId && !hasExercisesLoaded && !isLoadingExercises ? (
                    <>
                        <div className="alert alert-warning" role="alert">
                            <h5 className="alert-heading">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                {t("chatTab.status.notConfiguredTitle", "Lab not configured")}
                            </h5>
                            <p>
                                {t(
                                    "chatTab.status.notConfiguredDesc",
                                    "The teacher has not configured this lab yet. The chat is disabled until the configuration is available.",
                                )}
                            </p>
                            <hr />
                            <p className="mb-0">
                                {t(
                                    "chatTab.status.notConfiguredAction",
                                    "Please wait for your teacher to configure this lab or contact them for more information.",
                                )}
                            </p>
                        </div>
                    </>
                ) : messages.length === 0 ? (
                    <>
                        <div className="alert alert-info" role="alert">
                            {getWelcomeMessage()}
                        </div>
                    </>
                ) : (
                    messages.map(message => {
                        // Filtrar mensajes de herramientas (resultados)
                        if (message.role === "tool") {
                            return null;
                        }

                        // Renderizar indicadores de herramientas cuando el agente usa tools
                        if (message.role === "assistant" && message.tool_calls && message.tool_calls.length > 0) {
                            const toolMessages = message.tool_calls
                                .map(tc => getToolFriendlyMessage(tc))
                                .filter(Boolean);

                            if (toolMessages.length === 0) {
                                return null;
                            }

                            return (
                                <div
                                    key={message.id}
                                    className="tool-indicator"
                                    style={{
                                        padding: "8px 12px",
                                        borderLeft: "3px solid #6c757d",
                                        backgroundColor: "#f8f9fa",
                                        borderRadius: "4px",
                                        fontSize: "0.875rem",
                                        color: "#495057",
                                    }}
                                >
                                    {toolMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            style={{ marginBottom: idx < toolMessages.length - 1 ? "4px" : 0 }}
                                        >
                                            {msg}
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        if (!message.content || message.content.trim() === "") {
                            return null;
                        }

                        return (
                            <div
                                key={message.id}
                                className={`card ${message.role === "user" ? "bg-primary text-white" : ""}`}
                            >
                                <div className="card-body p-2">
                                    <div className="small mb-1">
                                        <strong>
                                            {message.role === "user"
                                                ? t("chatTab.roles.user", "You")
                                                : t("chatTab.roles.agent", "Agent")}
                                        </strong>
                                    </div>
                                    <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                                </div>
                            </div>
                        );
                    })
                )}

                {isGenerating && (
                    <div className="card border-secondary">
                        <div className="card-body p-2">
                            <div className="d-flex align-items-center">
                                <div
                                    className="spinner-border spinner-border-sm me-2"
                                    aria-label={t("chatTab.status.generating")}
                                >
                                    <span className="visually-hidden">{t("common.loading", "Loading...")}</span>
                                </div>
                                <span className="small">
                                    {t("chatTab.status.generating", "Generating response...")}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="card-footer bg-light border-top">
                <div className="d-flex gap-2 align-items-center">
                    <textarea
                        className="form-control"
                        placeholder={getChatPlaceholder()}
                        value={inputValue}
                        onChange={e => onInputChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        disabled={isChatDisabled}
                        rows={4}
                        style={{ resize: "none", overflow: "auto", flex: 1 }}
                        ref={inputRef}
                    />
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={onSendMessage}
                        disabled={isChatDisabled || !inputValue.trim()}
                        title={t("chatTab.buttons.send", "Send message")}
                        style={{
                            padding: "8px 12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M22 2L11 13" />
                            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                        </svg>
                    </button>
                    <button
                        onClick={onResetChat}
                        title={t("chatTab.buttons.restart", "Restart conversation")}
                        disabled={isAnyModalOpen}
                        style={{
                            background: "transparent",
                            border: "none",
                            padding: "8px",
                            cursor: isAnyModalOpen ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: isAnyModalOpen ? 0.5 : 1,
                        }}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#6c757d"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
};

export default ChatTab;
