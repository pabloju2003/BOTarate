import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BaseModal from "../BaseModal";
import { useRefinerModal } from "./hooks";
import { RefinerChatMessage, RefinerModalProps } from "./types";

const handleTextareaEnter = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    onSend: () => void
) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
    }
};

const draftPreview = (content: string): string => {
    const lines = content.split("\n");
    const head = lines.slice(0, 3).join("\n");
    return lines.length > 3 ? `${head}\n…` : head;
};

const DraftMessage: React.FC<{ message: RefinerChatMessage; index: number }> = ({ message, index }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const lineCount = message.content.split("\n").length;
    const isLong = lineCount > 3 || message.content.length > 200;

    return (
        <div className="card bg-primary text-white">
            <div className="card-body p-2">
                <div className="small mb-1 d-flex justify-content-between align-items-center">
                    <strong>📤 {t("refiner.draftLabel", { number: index })}</strong>
                    {isLong && (
                        <button
                            type="button"
                            className="btn btn-sm btn-link text-white p-0"
                            style={{ textDecoration: "underline", fontSize: "0.75rem" }}
                            onClick={() => setExpanded(prev => !prev)}
                        >
                            {expanded ? t("common.collapse", "Ocultar") : t("common.expand", "Ver completo")}
                        </button>
                    )}
                </div>
                <pre
                    className="mb-0"
                    style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: "0.8rem",
                        fontFamily: "monospace",
                        color: "white",
                        backgroundColor: "transparent",
                    }}
                >
                    {expanded || !isLong ? message.content : draftPreview(message.content)}
                </pre>
            </div>
        </div>
    );
};

const FollowUpUserMessage: React.FC<{ content: string }> = ({ content }) => (
    <div className="card bg-primary text-white">
        <div className="card-body p-2">
            <div style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{content}</div>
        </div>
    </div>
);

const AssistantMessage: React.FC<{ content: string }> = ({ content }) => (
    <div className="card">
        <div className="card-body p-2">
            <div style={{ fontSize: "0.9rem" }}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                        code: ({ node, ...props }) => {
                            const inline = (props as any).inline;
                            return inline ? (
                                <code className="bg-light px-1 text-dark" {...props} />
                            ) : (
                                <code className="d-block bg-light p-2 rounded text-dark" {...props} />
                            );
                        },
                        pre: ({ node, ...props }) => <pre className="bg-light p-2 rounded" {...props} />,
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </div>
    </div>
);

const RefinerModal: React.FC<RefinerModalProps> = ({
    exercise,
    isOpen,
    onClose,
    pageId,
    courseId,
}) => {
    const { t } = useTranslation();

    const {
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
    } = useRefinerModal({ exercise, isOpen, pageId, courseId });

    if (!isOpen) return null;

    let draftCounter = 0;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={exercise.name}>
            <div className="d-flex" style={{ flex: 1, overflow: "hidden", height: "87vh" }}>
                {/* Panel izquierdo: enunciado + textarea de borrador */}
                <div
                    className="p-4 d-flex flex-column"
                    style={{ flex: 1, overflowY: "auto", borderRight: "1px solid #dee2e6" }}
                >
                    <div className="mb-3">
                        <h6 className="text-primary">
                            {t("exercises.statement", "Enunciado")}:
                        </h6>
                        <div className="border rounded p-3 bg-light">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{exercise.statement}</ReactMarkdown>
                        </div>
                    </div>

                    <div className="mb-2 d-flex align-items-center justify-content-between">
                        <label htmlFor="refiner-draft" className="form-label mb-0">
                            <strong>📝 {t("refiner.draftTitle", "Tu borrador")}</strong>
                        </label>
                        <small className="text-muted">
                            {t(
                                "refiner.draftHint",
                                "Mezcla código xQuery con comentarios (: descripción :) para las partes no implementadas."
                            )}
                        </small>
                    </div>
                    <textarea
                        id="refiner-draft"
                        className="form-control font-monospace flex-grow-1"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        placeholder={t(
                            "refiner.draftPlaceholder",
                            "for $x in doc('books.xml')//book\nwhere (: filtra por año <= 2000 :)\nreturn $x/title"
                        )}
                        disabled={isSubmittingDraft || isRestoringSession}
                        rows={12}
                        style={{ fontSize: "0.9rem", resize: "vertical", minHeight: "200px" }}
                    />

                    {errorBanner && (
                        <div className="alert alert-danger mt-2 mb-0 small" role="alert">
                            {errorBanner}
                        </div>
                    )}

                    <div className="d-flex justify-content-end mt-3">
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={handleSubmitDraft}
                            disabled={
                                isSubmittingDraft ||
                                isSendingMessage ||
                                isRestoringSession ||
                                !draft.trim()
                            }
                        >
                            {isSubmittingDraft ? (
                                <>
                                    <output className="spinner-border spinner-border-sm me-2">
                                        <span className="visually-hidden">{t("common.loading")}</span>
                                    </output>
                                    {t("refiner.evaluating", "Evaluando borrador…")}
                                </>
                            ) : (
                                <>
                                    📤{" "}
                                    {isFirstDraft
                                        ? t("refiner.submitFirst", "Enviar borrador")
                                        : t("refiner.submitUpdated", "Enviar borrador actualizado")}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Panel derecho: feedback y conversación */}
                <div
                    className="d-flex flex-column"
                    style={{ width: "40%", minWidth: "420px", backgroundColor: "#f8f9fa" }}
                >
                    <div className="px-3 py-2 border-bottom bg-white">
                        <h6 className="mb-0">💬 {t("refiner.feedbackTitle", "Feedback y conversación")}</h6>
                        <small className="text-muted">
                            {t(
                                "refiner.feedbackSubtitle",
                                "El tutor IA evalúa la dirección de tu borrador, sin darte la solución."
                            )}
                        </small>
                    </div>

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
                        {isRestoringSession && (
                            <div className="d-flex align-items-center text-muted small">
                                <output className="spinner-border spinner-border-sm me-2">
                                    <span className="visually-hidden">{t("common.loading")}</span>
                                </output>
                                {t("refiner.restoring", "Restaurando sesión…")}
                            </div>
                        )}

                        {!isRestoringSession && messages.length === 0 && (
                            <div className="alert alert-info" role="alert">
                                <small>
                                    {t(
                                        "refiner.empty",
                                        "Escribe tu primer borrador a la izquierda y envíalo para recibir feedback."
                                    )}
                                </small>
                            </div>
                        )}

                        {messages.map(message => {
                            if (message.role === "user" && message.isDraft) {
                                draftCounter += 1;
                                return (
                                    <DraftMessage key={message.id} message={message} index={draftCounter} />
                                );
                            }
                            if (message.role === "user") {
                                return <FollowUpUserMessage key={message.id} content={message.content} />;
                            }
                            return <AssistantMessage key={message.id} content={message.content} />;
                        })}

                        {(isSubmittingDraft || isSendingMessage) && (
                            <div className="card border-secondary">
                                <div className="card-body p-2">
                                    <div className="d-flex align-items-center">
                                        <output className="spinner-border spinner-border-sm me-2">
                                            <span className="visually-hidden">{t("common.loading")}</span>
                                        </output>
                                        <span className="small">
                                            {t("refiner.thinking", "El tutor está evaluando…")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input de pregunta de follow-up */}
                    <div className="px-3 py-2 border-top bg-white">
                        <small className="text-muted d-block mb-1">
                            {t("refiner.followUpHint", "Pregunta sin reenviar el borrador:")}
                        </small>
                        <div className="d-flex gap-2 align-items-end">
                            <textarea
                                className="form-control"
                                placeholder={t(
                                    "refiner.followUpPlaceholder",
                                    "Pregúntale algo al tutor sin reenviar el borrador…"
                                )}
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => handleTextareaEnter(e, handleSendFollowUp)}
                                disabled={isSendingMessage || isSubmittingDraft || isFirstDraft}
                                rows={2}
                                style={{ resize: "none", fontSize: "0.9rem" }}
                            />
                            <button
                                className="btn btn-outline-primary btn-sm"
                                type="button"
                                onClick={handleSendFollowUp}
                                disabled={
                                    isSendingMessage ||
                                    isSubmittingDraft ||
                                    isFirstDraft ||
                                    !chatInput.trim()
                                }
                                title={
                                    isFirstDraft
                                        ? t(
                                              "refiner.followUpDisabledTooltip",
                                              "Envía primero un borrador antes de preguntar."
                                          )
                                        : t("refiner.followUpSend", "Enviar pregunta")
                                }
                                style={{ padding: "8px 12px" }}
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

export default RefinerModal;
