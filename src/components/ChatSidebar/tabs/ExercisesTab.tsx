import React from "react";
import { useTranslation } from "react-i18next";

interface Exercise {
    name: string;
    statement: string;
    role?: 'observer' | 'proofreader' | 'tutor' | 'challenger';
}

interface ExercisesTabProps {
    isLoadingExplanations: boolean;
    isLoadingEvaluations: boolean;
    exercises: Exercise[];
    exercisesWithExplanations: string[];
    exercisesWithEvaluations: string[];
    onExplanationClick: (exerciseName: string) => void;
    onEvaluationClick: (exerciseName: string) => void;
}

const ExercisesTab: React.FC<ExercisesTabProps> = ({
    isLoadingExplanations,
    isLoadingEvaluations,
    exercises,
    exercisesWithExplanations,
    exercisesWithEvaluations,
    onExplanationClick,
    onEvaluationClick,
}) => {
    const { t } = useTranslation();

    if (isLoadingExplanations || isLoadingEvaluations) {
        return (
            <div className="card border-primary">
                <div className="card-body p-3">
                    <div className="d-flex align-items-center">
                        <div className="spinner-border spinner-border-sm text-primary me-2">
                            <span className="visually-hidden">{t("common.loading")}</span>
                        </div>
                        <span>{t("exercises.loading")}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (exercises.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>{t("exercises.noExercises")}</strong>
                <p className="mb-0 mt-2 small">{t("exercises.noExercisesDesc")}</p>
            </div>
        );
    }

    return (
        <div className="list-group">
            {exercises.map((exercise, index) => {
                const hasExplanation = exercisesWithExplanations.includes(exercise.name);
                const hasEvaluation = exercisesWithEvaluations.includes(exercise.name);
                const isObserver = exercise.role === 'observer';
                // const isPicky = exercise.role === 'proofreader'; // No mostrar para estudiantes

                return (
                    <div
                        key={index}
                        className="list-group-item d-flex align-items-center"
                        style={{ minHeight: "56px" }}
                    >
                        <div className="d-flex w-100 justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                                <h6 className="mb-0">{exercise.name}</h6>
                                {isObserver && (
                                    <span className="badge bg-warning text-dark ms-2">{t("exercises.challenge")}</span>
                                )}
                                {/* {isPicky && (
                                    <span className="badge bg-info text-dark ms-2">{t("exercises.picky")}</span>
                                )} */}
                            </div>
                            <div className="d-flex gap-2">
                                {hasExplanation && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={() => onExplanationClick(exercise.name)}
                                    >
                                        <i className="bi bi-book me-1"></i>
                                        {t("exercises.viewExplanation")}
                                    </button>
                                )}
                                {hasEvaluation && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-success"
                                        onClick={() => onEvaluationClick(exercise.name)}
                                    >
                                        <i className="bi bi-clipboard-check me-1"></i>
                                        {t("exercises.viewEvaluations")}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ExercisesTab;
