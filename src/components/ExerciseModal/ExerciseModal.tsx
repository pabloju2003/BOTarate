import React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BaseModal from "../BaseModal";
import { useExerciseModal } from "./hooks";
import { ExerciseModalProps } from "./types";
import { handleKeyDown } from "./utils";

const CodeBlock: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        // Extract text content from children
        const text = extractTextFromChildren(children);
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div style={{ position: "relative" }}>
            <pre className="bg-light p-3 rounded overflow-auto" style={{ paddingRight: "3rem" }}>
                {children}
            </pre>
            <button
                onClick={handleCopy}
                className="btn btn-sm"
                style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    padding: "2px 8px",
                    fontSize: "0.75rem",
                    backgroundColor: copied ? "#198754" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    opacity: 0.8,
                    transition: "background-color 0.2s",
                }}
                title={copied ? "¡Copiado!" : "Copiar código"}
            >
                {copied ? "✓" : "📋"}
            </button>
        </div>
    );
};

// Helper function to extract text from React children
function extractTextFromChildren(children: React.ReactNode): string {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) return children.map(extractTextFromChildren).join("");
    if (React.isValidElement(children)) {
        const childProps = children.props as Record<string, unknown>;
        if (childProps.children) {
            return extractTextFromChildren(childProps.children as React.ReactNode);
        }
    }
    return String(children ?? "");
}

const ExerciseModal: React.FC<ExerciseModalProps> = ({
    exercise,
    isOpen,
    onClose,
    pageId,
    courseId,
    loadFromCache = false,
    onExplanationGenerated,
}) => {
    const { t } = useTranslation();

    const {
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
    } = useExerciseModal({
        exercise,
        isOpen,
        pageId,
        courseId,
        loadFromCache,
        onExplanationGenerated,
    });

    if (!isOpen) return null;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={exercise.name}>
            {/* Content - Explicación y Chat */}
            <div className="d-flex" style={{ flex: 1, overflow: "hidden", height: "87vh" }}>
                {/* Columna izquierda - Explicación */}
                <div className="p-4" style={{ flex: 1, overflowY: "auto", borderRight: "1px solid #dee2e6" }}>
                    {isLoadingExplanation && (
                        <div
                            className="d-flex flex-column align-items-center justify-content-center"
                            style={{ minHeight: "200px" }}
                        >
                            <output className="spinner-border text-primary mb-3">
                                <span className="visually-hidden">{t("common.loading")}</span>
                            </output>
                            <p className="text-muted">{t("explanation.generating")}</p>
                        </div>
                    )}

                    {explanationError && (
                        <div
                            className="d-flex flex-column align-items-center justify-content-center"
                            style={{ minHeight: "200px" }}
                        >
                            <div className="alert alert-danger w-100" role="alert">
                                <h5 className="alert-heading d-flex align-items-center">{t("explanation.error")}</h5>
                                <hr />
                                <p className="mb-3">{explanationError}</p>
                                <div className="d-flex gap-2">
                                    <button onClick={handleGenerateExplanation} className="btn btn-danger">
                                        {t("common.retry")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {explanation?.steps && !isLoadingExplanation && (
                        <div className="d-flex flex-column gap-3">
                            {explanation.steps.map((step, index) => (
                                <div key={`step-${index}`} className="card">
                                    <div className="card-header bg-primary text-white">
                                        <h4 className="h6 mb-0">
                                            {t("explanation.step", { number: index + 1 })}: {step.title}
                                        </h4>
                                    </div>
                                    <div className="card-body">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                table: ({ node, ...props }) => (
                                                    <table
                                                        className="table table-bordered table-sm mt-2 mb-2"
                                                        {...props}
                                                    />
                                                ),
                                                thead: ({ node, ...props }) => (
                                                    <thead className="table-light" {...props} />
                                                ),
                                                p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                                                code: ({ node, ...props }) => {
                                                    const inline = (props as any).inline;
                                                    return inline ? (
                                                        <code className="bg-light px-1" {...props} />
                                                    ) : (
                                                        <code className="d-block bg-light p-2 rounded" {...props} />
                                                    );
                                                },
                                                pre: ({ node, children, ...props }) => (
                                                    <CodeBlock>{children}</CodeBlock>
                                                ),
                                            }}
                                        >
                                            {step.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            <button onClick={handleRegenerateExplanation} className="btn btn-outline-primary">
                                {t("explanation.regenerate")}
                            </button>
                        </div>
                    )}
                </div>

                {/* Columna derecha - Chat */}
                <div
                    className="d-flex flex-column"
                    style={{ width: "35%", minWidth: "450px", backgroundColor: "#f8f9fa" }}
                >
                    <div className="px-3 py-2 border-bottom bg-white">
                        <h6 className="mb-0">💬 {t("explanation.chat.title")}</h6>
                        <small className="text-muted">{t("explanation.chat.subtitle")}</small>
                    </div>

                    {/* Mensajes del chat */}
                    <div
                        className="px-3"
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            paddingTop: "12px",
                            paddingBottom: "12px",
                        }}
                    >
                        {!isChatInitialized ? (
                            <div className="alert alert-info" role="alert">
                                <small>{t("explanation.chat.waiting")}</small>
                            </div>
                        ) : chatMessages.length === 0 ? (
                            <div className="alert alert-info" role="alert">
                                <small>{t("explanation.chat.empty")}</small>
                            </div>
                        ) : (
                            chatMessages.map(message => (
                                <div
                                    key={message.id}
                                    className={`card ${message.role === "user" ? "bg-primary text-white" : ""}`}
                                >
                                    <div className="card-body p-2">
                                        <div className="small mb-1">
                                            <strong>
                                                {message.role === "user"
                                                    ? t("explanation.chat.user")
                                                    : t("explanation.chat.agent")}
                                            </strong>
                                        </div>
                                        <div style={{ fontSize: "0.9rem" }}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: ({ node, ...props }) => (
                                                        <table
                                                            className="table table-bordered table-sm mt-2 mb-2"
                                                            {...props}
                                                        />
                                                    ),
                                                    thead: ({ node, ...props }) => (
                                                        <thead className="table-light" {...props} />
                                                    ),
                                                    p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                                                    code: ({ node, ...props }) => {
                                                        const inline = (props as any).inline;
                                                        return inline ? (
                                                            <code className="bg-light px-1 text-dark" {...props} />
                                                        ) : (
                                                            <code
                                                                className="d-block bg-light p-2 rounded text-dark"
                                                                {...props}
                                                            />
                                                        );
                                                    },
                                                    pre: ({ node, children, ...props }) => (
                                                        <CodeBlock>{children}</CodeBlock>
                                                    ),
                                                }}
                                            >
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        {isSendingMessage && (
                            <div className="card border-secondary">
                                <div className="card-body p-2">
                                    <div className="d-flex align-items-center">
                                        <output
                                            className="spinner-border spinner-border-sm me-2"
                                            aria-label={t("explanation.generating", "Generating response")}
                                        >
                                            <span className="visually-hidden">{t("common.loading")}</span>
                                        </output>
                                        <span className="small">
                                            {t("explanation.chat.generating", "Generating response...")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input del chat */}
                    <div className="px-3 py-2 border-top bg-white">
                        <div className="d-flex gap-2 align-items-end">
                            <textarea
                                className="form-control"
                                placeholder={
                                    !isChatInitialized
                                        ? t("explanation.chat.waiting", "Waiting for explanation...")
                                        : t("explanation.chat.placeholder", "Type your question...")
                                }
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, handleSendChatMessage)}
                                disabled={isSendingMessage || !isChatInitialized}
                                rows={4}
                                style={{ resize: "none", fontSize: "0.9rem" }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                type="button"
                                onClick={handleSendChatMessage}
                                disabled={isSendingMessage || !chatInput.trim() || !isChatInitialized}
                                title={t("explanation.chat.send", "Send question")}
                                style={{
                                    padding: "8px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
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
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export default ExerciseModal;
