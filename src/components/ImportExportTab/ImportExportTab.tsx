import React from "react";
import { useTranslation } from "react-i18next";
import { ImportExportTabProps } from "./types";
import { useImportExport } from "./useImportExport";
import { getAlertClass } from "./utils";

export const ImportExportTab: React.FC<ImportExportTabProps> = props => {
    const { t } = useTranslation();
    const {
        message,
        isProcessing,
        fileInputRef,
        handleExport,
        handleClearAll,
        handleClearLabContext,
        handleFileSelect,
        setMessage,
    } = useImportExport(props);

    return (
        <div>
            {message && (
                <div className={`alert ${getAlertClass(message)} alert-dismissible fade show`} role="alert">
                    {message.text}
                    <button
                        type="button"
                        className="btn-close"
                        onClick={() => setMessage(null)}
                        aria-label={t("common.close")}
                    ></button>
                </div>
            )}

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">{t("options.importExport.export.title")}</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">{t("options.importExport.export.description")}</p>
                    <button type="button" className="btn btn-primary" onClick={handleExport} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                />
                                {t("options.importExport.export.processing")}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-download me-2" />
                                {t("options.importExport.export.button")}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">{t("options.importExport.import.title")}</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">{t("options.importExport.import.description")}</p>
                    <div className="mb-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="form-control"
                            accept=".json"
                            onChange={handleFileSelect}
                            disabled={isProcessing}
                        />
                    </div>
                    <div className="alert alert-warning" role="alert">
                        <strong>{t("options.importExport.import.warningTitle")}</strong>{" "}
                        {t("options.importExport.import.warningDesc")}
                    </div>
                </div>
            </div>

            <div className="card border-danger">
                <div className="card-header bg-danger text-white">
                    <h5 className="card-title mb-0">{t("options.importExport.dangerZone.title")}</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">{t("options.importExport.dangerZone.description")}</p>
                    <button type="button" className="btn btn-danger" onClick={handleClearAll} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                />
                                {t("options.importExport.dangerZone.processing")}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-trash me-2" />
                                {t("options.importExport.dangerZone.button")}
                            </>
                        )}
                    </button>

                    <hr className="my-3" />

                    <div>
                        <h6 className="mb-2">{t("options.importExport.dangerZone.clearContextTitle")}</h6>
                        <p className="text-muted small">
                            {t("options.importExport.dangerZone.clearContextDescription")}
                        </p>
                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClearLabContext}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <span
                                        className="spinner-border spinner-border-sm me-2"
                                        role="status"
                                        aria-hidden="true"
                                    />
                                    {t("options.importExport.dangerZone.clearContextProcessing")}
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-eraser me-2" />
                                    {t("options.importExport.dangerZone.clearContextButton")}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportExportTab;
