import React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BaseModal from "../BaseModal";
import { useEvaluations } from "./hooks";
import { EvaluationListModalProps } from "./types";
import { formatDate, formatScore, getScoreColor, getScoreLabel } from "./utils";

const EvaluationListModal: React.FC<EvaluationListModalProps> = ({ exerciseName, isOpen, onClose, pageId }) => {
    const { t } = useTranslation();
    const { evaluations, isLoading, selectedEvaluation, setSelectedEvaluation } = useEvaluations(
        isOpen,
        exerciseName,
        pageId,
    );

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={t("evaluation.list.title", { name: exerciseName })}>
            {isLoading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">{t("evaluation.list.loading")}</span>
                    </div>
                    <p className="mt-3">{t("evaluation.list.loading")}</p>
                </div>
            ) : evaluations.length === 0 ? (
                <div className="alert alert-info">
                    <strong>{t("evaluation.list.emptyTitle")}</strong>
                    <p className="mb-0 mt-2">{t("evaluation.list.emptyDesc")}</p>
                </div>
            ) : (
                <>
                    {/* Enunciado del ejercicio */}
                    {selectedEvaluation && selectedEvaluation.statement && (
                        <div className="mb-4">
                            <h6 className="text-primary">{t("exercises.statement")}:</h6>
                            <div className="border rounded p-3 bg-light">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {selectedEvaluation.statement}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                    <div className="row" style={{ height: "85vh", minHeight: 400 }}>
                        {/* Lista de evaluaciones */}
                        <div className="col-md-4">
                            {/* Estadísticas */}
                            <div className="card mb-3">
                                <div className="card-body">
                                    <h6 className="card-title">{t("evaluation.list.stats")}</h6>
                                    <ul className="list-unstyled mb-0">
                                        <li>
                                            <strong>{t("evaluation.list.bestScore")}:</strong>{" "}
                                            {formatScore(Math.max(...evaluations.map(e => e.score)))}
                                        </li>
                                        <li>
                                            <strong>{t("evaluation.list.avgScore")}:</strong>{" "}
                                            {formatScore(
                                                evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length,
                                            )}
                                        </li>
                                        <li>
                                            <strong>{t("evaluation.list.totalAttempts")}:</strong> {evaluations.length}
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <h6 className="mb-3">{t("evaluation.list.history", { count: evaluations.length })}</h6>
                            <div className="list-group">
                                {evaluations.map((evaluation, index) => (
                                    <button
                                        key={`${evaluation.timestamp}-${evaluation.score}-${index}`}
                                        type="button"
                                        className={`list-group-item list-group-item-action ${
                                            selectedEvaluation === evaluation ? "active" : ""
                                        }`}
                                        onClick={() => setSelectedEvaluation(evaluation)}
                                    >
                                        <div className="d-flex w-100 justify-content-between align-items-center">
                                            <div>
                                                <h6 className="mb-1">
                                                    {t("evaluation.list.attempt", { num: evaluations.length - index })}
                                                </h6>
                                                <small
                                                    className={selectedEvaluation === evaluation ? "" : "text-muted"}
                                                >
                                                    {formatDate(evaluation.timestamp)}
                                                </small>
                                            </div>
                                            <span
                                                className={`badge bg-${getScoreColor(evaluation.score)}`}
                                                style={{ fontSize: "1rem" }}
                                            >
                                                {formatScore(evaluation.score)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Detalles de la evaluación seleccionada */}
                        <div className="col-md-8 d-flex flex-column" style={{ height: "100%" }}>
                            {selectedEvaluation ? (
                                <>
                                    <div className={`alert alert-${getScoreColor(selectedEvaluation.score)}`}>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h5 className="mb-0">
                                                    {t("evaluation.score")}: {formatScore(selectedEvaluation.score)} /
                                                    10
                                                </h5>
                                                <small>
                                                    {t(getScoreLabel(selectedEvaluation.score))} -{" "}
                                                    {formatDate(selectedEvaluation.timestamp)}
                                                </small>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-flex gap-3 flex-fill" style={{ minHeight: 0 }}>
                                        {/* Columna izquierda - Solución del alumno */}
                                        <div className="d-flex flex-column" style={{ flex: 1, minWidth: 0 }}>
                                            <h6>{t("evaluation.list.yourSolution")}:</h6>
                                            <pre
                                                className="bg-light p-3 rounded flex-fill"
                                                style={{
                                                    overflowY: "auto",
                                                    fontSize: "0.9rem",
                                                    minHeight: 0,
                                                }}
                                            >
                                                <code>{selectedEvaluation.solution}</code>
                                            </pre>
                                        </div>

                                        {/* Columna derecha - Feedback del evaluador */}
                                        <div className="d-flex flex-column" style={{ flex: 1, minWidth: 0 }}>
                                            <h6>{t("evaluation.list.evaluatorFeedback")}:</h6>
                                            <div
                                                className="border rounded p-3 flex-fill"
                                                style={{ overflowY: "auto", minHeight: 0 }}
                                            >
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {selectedEvaluation.feedback}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="alert alert-info">{t("evaluation.list.selectPrompt")}</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </BaseModal>
    );
};

export default EvaluationListModal;
