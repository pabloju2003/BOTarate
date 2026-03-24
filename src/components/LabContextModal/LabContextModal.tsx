import React from "react";
import { useTranslation } from "react-i18next";
import BaseModal from "../BaseModal";
import { useLabContextModal } from "./hooks";
import { LabContextModalProps } from "./types";

const LabContextModal: React.FC<LabContextModalProps> = ({ isOpen, onClose, labId, labName, onContextUpdate }) => {
    const { t } = useTranslation();
    const {
        data,
        activeTab,
        setActiveTab,
        isLoading,
        isSaving,
        hasChanges,
        saveMessage,
        newConcept,
        setNewConcept,
        handleSave,
        updateLearningObjectives,
        updateExerciseContext,
        addConcept,
        removeConcept,
        updateConcept,
    } = useLabContextModal(isOpen, labId, onContextUpdate);

    if (!isOpen) return null;

    const tabs = [
        { key: "learningObjectives", label: t("options.labContext.tabs.learningObjectives") },
        { key: "concepts", label: t("options.labContext.tabs.concepts") },
        { key: "exerciseContext", label: t("options.labContext.tabs.exerciseContext") },
    ];

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={t("options.labContext.title", { name: labName })}>
            {isLoading ? (
                <div className="text-center py-4">
                    <output className="spinner-border">
                        <span className="visually-hidden">{t("common.loading")}</span>
                    </output>
                </div>
            ) : (
                <div className="d-flex flex-column" style={{ height: "85vh" }}>
                    {/* Tabs */}
                    <ul className="nav nav-tabs" role="tablist">
                        {tabs.map(tab => (
                            <li className="nav-item" key={tab.key} role="presentation">
                                <button
                                    className={`nav-link ${activeTab === tab.key ? "active" : ""}`}
                                    onClick={() => setActiveTab(tab.key)}
                                    type="button"
                                    role="tab"
                                >
                                    {tab.label}
                                </button>
                            </li>
                        ))}
                    </ul>

                    {/* Tab content */}
                    <div className="tab-content flex-grow-1 p-3" style={{ overflowY: "auto" }}>
                        {/* Learning Objectives */}
                        {activeTab === "learningObjectives" && (
                            <div>
                                <p className="text-muted small mb-2">
                                    {t("options.labContext.learningObjectives.description")}
                                </p>
                                <textarea
                                    className="form-control"
                                    rows={15}
                                    value={data.learningObjectives}
                                    onChange={e => updateLearningObjectives(e.target.value)}
                                    placeholder={t("options.labContext.learningObjectives.placeholder")}
                                    disabled={isSaving}
                                    style={{ fontSize: "0.9rem" }}
                                />
                            </div>
                        )}

                        {/* Concepts */}
                        {activeTab === "concepts" && (
                            <div>
                                <p className="text-muted small mb-2">{t("options.labContext.concepts.description")}</p>
                                {data.concepts.length === 0 && (
                                    <div className="alert alert-info mb-3" role="alert">
                                        {t("options.labContext.concepts.empty")}
                                    </div>
                                )}
                                <div className="d-flex flex-column gap-2 mb-3">
                                    {data.concepts.map((concept, index) => (
                                        <div key={`concept-${index}`} className="input-group">
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={concept}
                                                onChange={e => updateConcept(index, e.target.value)}
                                                disabled={isSaving}
                                            />
                                            <button
                                                className="btn btn-outline-danger btn-sm"
                                                type="button"
                                                onClick={() => removeConcept(index)}
                                                disabled={isSaving}
                                                title={t("common.delete")}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="14"
                                                    height="14"
                                                    fill="currentColor"
                                                    viewBox="0 0 16 16"
                                                >
                                                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder={t("options.labContext.concepts.placeholder")}
                                        value={newConcept}
                                        onChange={e => setNewConcept(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                addConcept();
                                            }
                                        }}
                                        disabled={isSaving}
                                    />
                                    <button
                                        className="btn btn-outline-primary btn-sm"
                                        type="button"
                                        onClick={addConcept}
                                        disabled={isSaving || !newConcept.trim()}
                                    >
                                        {t("options.labContext.concepts.add")}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Exercise Context */}
                        {activeTab === "exerciseContext" && (
                            <div>
                                <p className="text-muted small mb-2">
                                    {t("options.labContext.exerciseContext.description")}
                                </p>
                                <textarea
                                    className="form-control"
                                    rows={15}
                                    value={data.exerciseContext}
                                    onChange={e => updateExerciseContext(e.target.value)}
                                    placeholder={t("options.labContext.exerciseContext.placeholder")}
                                    disabled={isSaving}
                                    style={{ fontSize: "0.9rem", fontFamily: "monospace" }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer with save */}
                    <div className="border-top p-3">
                        {saveMessage && (
                            <div
                                className={`alert alert-${saveMessage.type === "success" ? "success" : "danger"} small py-2 mb-2`}
                                role="alert"
                            >
                                {saveMessage.type === "success"
                                    ? t("options.labContext.saveSuccess")
                                    : t("options.labContext.saveError")}
                            </div>
                        )}
                        {hasChanges && (
                            <div className="alert alert-warning small py-2 mb-2" role="alert">
                                <strong>{t("options.labConfig.unsavedTitle")}</strong>
                            </div>
                        )}
                        <div className="d-flex justify-content-end gap-2">
                            <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
                                {t("common.close")}
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !hasChanges}>
                                {isSaving ? (
                                    <>
                                        <output className="spinner-border spinner-border-sm me-2">
                                            <span className="visually-hidden">{t("common.loading")}</span>
                                        </output>
                                        {t("options.labContext.saving")}
                                    </>
                                ) : (
                                    t("options.labContext.save")
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </BaseModal>
    );
};

export default LabContextModal;
