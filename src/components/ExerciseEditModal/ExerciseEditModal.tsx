import React from "react";
import { useTranslation } from "react-i18next";
import { APP_CONFIG } from "../../constants";
import { handleOverlayClick } from "../BaseModal/modalUtils";
import { useModalKeyboard } from "../BaseModal/useModal";
import { useExerciseEditModal } from "./hooks";
import { ExerciseEditModalProps } from "./types";

const ExerciseEditModal: React.FC<ExerciseEditModalProps> = props => {
    const { t } = useTranslation();
    const { name, setName, statement, setStatement, isSaving, error, successMessage, hasChanges, handleSave } =
        useExerciseEditModal(props);

    useModalKeyboard(props.isOpen, props.onClose);

    if (!props.isOpen) return null;

    const title = t("options.exerciseEdit.editTitle", { name: props.exercise?.name ?? "" });

    return (
        <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10004 }}
            tabIndex={-1}
            role="dialog"
            onClick={e => handleOverlayClick(e, props.onClose)}
        >
            <div className="modal-dialog modal-lg modal-dialog-centered" style={{ maxWidth: "650px" }} role="document">
                <div className="modal-content">
                    <div className="modal-header bg-primary text-white d-flex align-items-center">
                        <h5 className="modal-title mb-0 d-flex align-items-center">
                            <img
                                src={chrome.runtime.getURL("icons/icon128.png")}
                                alt={APP_CONFIG.NAME}
                                style={{ width: "28px", height: "28px", marginRight: "12px", marginLeft: "16px" }}
                            />
                            {title}
                        </h5>
                        <button
                            type="button"
                            className="btn-close btn-close-white ms-auto"
                            onClick={props.onClose}
                            aria-label={t("common.close")}
                        ></button>
                    </div>
                    <div className="modal-body p-4">
                        <div className="mb-3">
                            <label htmlFor="exercise-edit-name" className="form-label">
                                <strong>{t("options.exerciseEdit.name")}</strong>
                            </label>
                            <input
                                type="text"
                                id="exercise-edit-name"
                                className="form-control"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                disabled={isSaving}
                                placeholder={t("options.exerciseEdit.namePlaceholder")}
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="exercise-edit-statement" className="form-label">
                                <strong>{t("options.exerciseEdit.statement")}</strong>
                            </label>
                            <textarea
                                id="exercise-edit-statement"
                                className="form-control"
                                rows={10}
                                value={statement}
                                onChange={e => setStatement(e.target.value)}
                                disabled={isSaving}
                                placeholder={t("options.exerciseEdit.statementPlaceholder")}
                                style={{ fontSize: "0.9rem" }}
                            />
                        </div>
                        {error && (
                            <div className="alert alert-danger py-2" role="alert">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="alert alert-success py-2" role="alert">
                                <i className="bi bi-check-circle me-2"></i>
                                {successMessage}
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={props.onClose} disabled={isSaving}>
                            {t("common.cancel")}
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !hasChanges}>
                            {isSaving ? (
                                <>
                                    <output className="spinner-border spinner-border-sm me-2">
                                        <span className="visually-hidden">{t("common.loading")}</span>
                                    </output>
                                    {t("common.save")}
                                </>
                            ) : (
                                t("common.save")
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExerciseEditModal;
