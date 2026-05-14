import React from "react";
import { useTranslation } from "react-i18next";
import ExerciseEditModal from "../ExerciseEditModal";
import { ReasoningSelector, VerbositySelector } from "../LabConfigTab/selectors";
import LabContextModal from "../LabContextModal";
import { useExerciseConfig } from "./hooks";
import { ExerciseConfigTabProps } from "./types";
import { getDefaultFlags } from "./utils";
import type { AIRole } from "../../types/shared";

const ExerciseConfigTab: React.FC<ExerciseConfigTabProps> = props => {
    const { t } = useTranslation();
    const {
        exerciseConfig,
        isSaving,
        hasUnsavedChanges,
        successMessage,
        errorMessage,
        handleRoleChange,
        handleSaveChanges,
        editingExercise,
        setEditingExercise,
        refreshExercises,
        // Lab config
        verbosity,
        setVerbosity,
        reasoningEffort,
        setReasoningEffort,
        hasContext,
        contextModalOpen,
        setContextModalOpen,
    } = useExerciseConfig(props);

    const roleColumns: Array<{ role: AIRole; label: string }> = [
        { role: "observer", label: "Observer" },
        { role: "proofreader", label: "Proofreader" },
        { role: "tutor", label: "Tutor" },
        { role: "challenger", label: "Challenger" },
        { role: "refiner", label: "Refiner" },
    ];

    const isInLab = props.pageId && props.pageId.trim() !== "";

    if (props.exercises.length === 0) {
        return (
            <div>
                {/* Explicación del sistema */}
                <div className="alert alert-primary small mb-3" role="alert">
                    <h6 className="alert-heading">
                        <i className="bi bi-info-circle"></i> {t("options.exerciseConfig.infoTitle")}
                    </h6>
                    <p className="mb-2">
                        Configura el rol de cada ejercicio para controlar cómo responde el agente.
                    </p>
                    <ul className="mb-2 small">
                        <li><strong>Observer:</strong> el agente observa y orienta sin resolver directamente.</li>
                        <li><strong>Proofreader:</strong> el agente actúa como revisor crítico y puede señalar o proponer correcciones.</li>
                        <li><strong>Tutor:</strong> comportamiento normal de tutor (rol por defecto).</li>
                        <li><strong>Challenger:</strong> ejercicio solo estudiante, sin explicación directa.</li>
                    </ul>
                    <p className="mb-0 small">{t("options.exerciseConfig.infoFooter")}</p>
                </div>
                <div className="alert alert-info" role="alert">
                    <strong>{t("options.exerciseConfig.noExercisesTitle")}</strong>
                    <p className="mb-0 mt-2 small">
                        {isInLab
                            ? t("options.exerciseConfig.noExercisesDesc")
                            : t("options.exerciseConfig.noLabOpenDesc")}
                    </p>
                </div>

                {/* No Add Exercise Button - Feature Removed */}
            </div>
        );
    }

    return (
        <div>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> {t("options.exerciseConfig.infoTitle")}
                </h6>
                <p className="mb-2">
                    Configura el rol de cada ejercicio para controlar cómo responde el agente.
                </p>
                <ul className="mb-2 small">
                    <li><strong>Observer:</strong> el agente observa y orienta sin resolver directamente.</li>
                    <li><strong>Proofreader:</strong> el agente actúa como revisor crítico y puede señalar o proponer correcciones.</li>
                    <li><strong>Tutor:</strong> comportamiento normal de tutor (rol por defecto).</li>
                    <li><strong>Challenger:</strong> ejercicio solo estudiante, sin explicación directa.</li>
                    <li><strong>Refiner:</strong> el alumno envía borradores progresivos y la IA evalúa si va en la dirección correcta, sin dar la respuesta.</li>
                </ul>
                <p className="mb-0 small">{t("options.exerciseConfig.infoFooter")}</p>
            </div>

            {/* Lab configuration: verbosity, reasoning, context */}
            {props.courseId && (
                <div className="card mb-3">
                    <div className="card-body py-2">
                        <VerbositySelector
                            labId={props.pageId}
                            currentVerbosity={verbosity}
                            hasContext={hasContext}
                            isDisabled={isSaving}
                            onChange={(_labId, v) => setVerbosity(v)}
                        />
                        <ReasoningSelector
                            labId={props.pageId}
                            currentReasoning={reasoningEffort}
                            hasContext={hasContext}
                            isDisabled={isSaving}
                            onChange={(_labId, r) => setReasoningEffort(r)}
                        />
                        <div className="d-flex align-items-center mt-2">
                            <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => setContextModalOpen(true)}
                                disabled={isSaving || !hasContext}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    fill="currentColor"
                                    viewBox="0 0 16 16"
                                    className="me-1"
                                >
                                    <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z" />
                                </svg>
                                {t("options.labConfig.editContext")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="table-responsive">
                <table className="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th
                                scope="col"
                                className="fw-bold"
                                style={{
                                    width: "40%",
                                    backgroundColor: "#f8f9fa",
                                    color: "black",
                                    borderColor: "#dee2e6",
                                    verticalAlign: "middle",
                                }}
                            >
                                {t("options.exerciseConfig.table.headerName")}
                            </th>
                            {roleColumns.map(({ role, label }) => (
                                <th
                                    key={`header-${role}`}
                                    scope="col"
                                    className="text-center fw-bold"
                                    style={{
                                        width: "12%",
                                        backgroundColor: "#f8f9fa",
                                        color: "black",
                                        borderColor: "#dee2e6",
                                        verticalAlign: "middle",
                                    }}
                                >
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {props.exercises.map(exercise => {
                            const flags = exerciseConfig.get(exercise.name) ?? getDefaultFlags();
                            const selectedRole: AIRole = flags.role;
                            return (
                                <tr key={exercise.name}>
                                    <td style={{ verticalAlign: "middle" }}>
                                        <div className="d-flex align-items-center">
                                            <span style={{ flex: 1 }}>{exercise.name}</span>
                                            <div className="ms-2" onClick={e => e.stopPropagation()}>
                                                <button
                                                    className="btn btn-outline-primary btn-sm"
                                                    onClick={() => setEditingExercise(exercise)}
                                                    disabled={isSaving}
                                                    title={t("options.exerciseConfig.editExercise")}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="14"
                                                        height="14"
                                                        fill="currentColor"
                                                        viewBox="0 0 16 16"
                                                        className="me-1"
                                                    >
                                                        <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                    {roleColumns.map(({ role, label }) => {
                                        const inputId = `${exercise.name}-role-${role}`;
                                        return (
                                            <td
                                                key={inputId}
                                                className="text-center"
                                                style={{ verticalAlign: "middle", position: "static" }}
                                            >
                                                <div className="d-flex justify-content-center align-items-center" style={{ position: "static" }}>
                                                    <input
                                                        className="form-check-input"
                                                        type="radio"
                                                        name={`role-group-${exercise.name}`}
                                                        id={inputId}
                                                        checked={selectedRole === role}
                                                        onChange={() => handleRoleChange(exercise.name, role)}
                                                        disabled={isSaving}
                                                        style={{
                                                            cursor: "pointer",
                                                            margin: 0,
                                                            position: "static",
                                                            float: "none",
                                                            top: "auto",
                                                            left: "auto",
                                                        }}
                                                    />
                                                    <label
                                                        className="form-check-label visually-hidden"
                                                        htmlFor={inputId}
                                                    >
                                                        {`${exercise.name} - ${label}`}
                                                    </label>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {hasUnsavedChanges && (
                <div className="alert alert-warning small mb-3" role="alert">
                    <strong>{t("options.exerciseConfig.unsavedTitle")}</strong>
                    <p className="mb-0 mt-1">{t("options.exerciseConfig.unsavedDesc")}</p>
                </div>
            )}

            <div className="d-grid gap-2">
                <button
                    className="btn btn-primary"
                    onClick={handleSaveChanges}
                    disabled={isSaving || !hasUnsavedChanges}
                >
                    {isSaving ? (
                        <>
                            <output className="spinner-border spinner-border-sm me-2">
                                <span className="visually-hidden">{t("common.saving")}</span>
                            </output>
                            {t("options.exerciseConfig.saving")}
                        </>
                    ) : (
                        t("options.exerciseConfig.save")
                    )}
                </button>
            </div>

            {successMessage && (
                <div className="alert alert-success mt-3" role="alert">
                    <h6 className="alert-heading d-flex align-items-center">
                        <i className="bi bi-check-circle me-2"></i>
                        {t("common.success")}
                    </h6>
                    <hr />
                    <p className="mb-0">{successMessage}</p>
                </div>
            )}

            {errorMessage && (
                <div className="alert alert-danger mt-3" role="alert">
                    <h6 className="alert-heading d-flex align-items-center">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {t("common.error")}
                    </h6>
                    <hr />
                    <p className="mb-0">{errorMessage}</p>
                </div>
            )}

            {isSaving && (
                <div className="alert alert-secondary small d-flex align-items-center mt-2" role="alert">
                    <output className="spinner-border spinner-border-sm me-2">
                        <span className="visually-hidden">{t("common.saving")}</span>
                    </output>
                    {t("options.exerciseConfig.processing")}
                </div>
            )}

            {/* Exercise Edit Modal */}
            {editingExercise && (
                <ExerciseEditModal
                    isOpen={!!editingExercise}
                    onClose={() => setEditingExercise(null)}
                    exercise={editingExercise}
                    labId={props.pageId}
                    onExerciseUpdate={refreshExercises}
                />
            )}

            {/* Lab Context Modal */}
            {contextModalOpen && (
                <LabContextModal
                    isOpen={contextModalOpen}
                    onClose={() => setContextModalOpen(false)}
                    labId={props.pageId}
                    labName={props.pageName ?? ""}
                    onContextUpdate={props.onConfigUpdate}
                />
            )}
        </div>
    );
};

export default React.memo(ExerciseConfigTab);
