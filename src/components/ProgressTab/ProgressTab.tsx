import React from "react";
import { useTranslation } from "react-i18next";
import { useProgressData } from "./hooks";
import { getBestScore, getScoreBadgeClass } from "./utils";

interface ProgressTabProps {
    courseId: string;
}

/**
 * ProgressTab shows a read-only summary of all included labs and the
 * student's exercise attempts / scores. No blocking or unlock logic.
 */
const ProgressTab: React.FC<ProgressTabProps> = ({ courseId }) => {
    const { t } = useTranslation();
    const { labProgress, isLoading } = useProgressData(courseId);

    if (isLoading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary">
                    <span className="visually-hidden">{t("progress.loading")}</span>
                </div>
                <p className="mt-3">{t("progress.loading")}</p>
            </div>
        );
    }

    if (labProgress.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>{t("progress.noLabsTitle")}</strong>
                <p className="mb-0 mt-2">{t("progress.noLabsDesc")}</p>
            </div>
        );
    }

    return (
        <div>
            {/* Lab list */}
            <div className="list-group">
                {labProgress.map((progress, index) => (
                    <div key={progress.lab.id} className="list-group-item">
                        <div className="d-flex w-100 justify-content-between align-items-start mb-2">
                            <h6 className="mb-1">
                                {t("progress.labCard.title", { index: index + 1, name: progress.lab.name })}
                            </h6>
                        </div>

                        {/* General stats */}
                        <div className="mb-2">
                            <span className="badge bg-info me-2">
                                {t("progress.labCard.exercises", {
                                    completed: progress.stats.exercisesAttempted,
                                    total: progress.stats.totalExercises,
                                })}
                            </span>
                            {progress.stats.exercisesAttempted > 0 && (
                                <span className="badge bg-primary">
                                    {t("progress.labCard.average", {
                                        score: progress.stats.averageScore.toFixed(1),
                                    })}
                                </span>
                            )}
                        </div>

                        {/* Exercise details */}
                        {progress.allExercises.length > 0 && (
                            <div className="mt-2">
                                <small className="text-muted d-block mb-1">
                                    <strong>{t("progress.labCard.exercisesTitle")}</strong>
                                </small>
                                <div className="d-flex flex-wrap gap-2">
                                    {progress.allExercises.map(exercise => {
                                        const evaluations = progress.evaluatedExercises.get(exercise.name);
                                        const bestScore = getBestScore(evaluations);
                                        const badgeClass = getScoreBadgeClass(bestScore);

                                        return (
                                            <div
                                                key={exercise.name}
                                                className="d-flex align-items-center border rounded px-2 py-1 bg-white"
                                                style={{ fontSize: "0.85rem" }}
                                            >
                                                <span className="me-2">{exercise.name}</span>
                                                <span className={`badge ${badgeClass}`}>
                                                    {bestScore === null
                                                        ? t("progress.labCard.notAttempted")
                                                        : bestScore.toFixed(1)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProgressTab;
