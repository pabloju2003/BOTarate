import React from "react";
import { useTranslation } from "react-i18next";
import { APP_CONFIG } from "../../constants";
import { ConfigurationRequired } from "../ConfigurationRequired";
import ExerciseConfigTab from "../ExerciseConfigTab";
import LabConfigTab from "../LabConfigTab";
import ProgressTab from "../ProgressTab";
import { ChatSidebarProps, useChatSidebar } from "./ChatSidebar";
import "./ChatSidebar.css";
import ChatTab from "./tabs/ChatTab";
import ExercisesTab from "./tabs/ExercisesTab";

const ChatSidebar: React.FC<ChatSidebarProps> = props => {
    const {
        isCollapsed,
        setIsCollapsed,
        messages,
        inputValue,
        setInputValue,
        isGenerating,
        activeTab,
        setActiveTab,
        enableTransition,
        exercisesWithExplanations,
        exercisesWithEvaluations,
        isLoadingExplanations,
        isLoadingEvaluations,
        exercises,
        isTeacherMode,
        isUserTeacher,
        needsConfiguration,
        missingLLMConfig,
        isCheckingConfig,
        reloadKey,
        messagesEndRef,
        isChatDisabled,
        inputRef,
        courseLoadError,
        isInLab,
        pageName,
        sectionLabIds,
        handleConfigLoaded,
        handleModeToggle,
        handleExplanationClick,
        handleEvaluationClick,
        handleConfigUpdate,
        handleSendMessage,
        handleResetChat,
        handleKeyDown,
    } = useChatSidebar(props);

    const { t } = useTranslation();

    return (
        <div
            className={`extension-sidebar ${isCollapsed ? "collapsed" : ""} ${
                !enableTransition ? "no-transition" : ""
            }`}
        >
            {/* Botón para colapsar/expandir */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="collapse-button"
                title={isCollapsed ? t("sidebar.expand", "Expand sidebar") : t("sidebar.collapse", "Collapse sidebar")}
            >
                {isCollapsed ? "◀" : "▶"}
            </button>

            {/* Header */}
            <div className="card-header bg-light border-bottom">
                <div className="d-flex align-items-start mb-2">
                    <div className="d-flex align-items-center">
                        <img
                            src={chrome.runtime.getURL("icons/icon128.png")}
                            alt={APP_CONFIG.NAME + " icon"}
                            className="header-icon"
                        />
                        <h2 className="h2 mb-0">{APP_CONFIG.NAME}</h2>
                    </div>
                    {isUserTeacher && (
                        <div className="d-flex align-items-center ms-auto mode-switch">
                            <span className={`${!isTeacherMode ? "fw-bold" : "text-muted"}`}>
                                {t("sidebar.mode.student", "Student")}
                            </span>
                            <div className="form-check form-switch mb-0">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="modeSwitch"
                                    checked={isTeacherMode}
                                    onChange={handleModeToggle}
                                    role="switch"
                                />
                            </div>
                            <span className={`${isTeacherMode ? "fw-bold" : "text-muted"}`}>
                                {t("sidebar.mode.teacher", "Teacher")}
                            </span>
                        </div>
                    )}
                </div>
                {pageName && (
                    <div className="fw-bold mb-3 mt-3" style={{ paddingLeft: "2px", fontSize: "0.95rem" }}>
                        {pageName}
                    </div>
                )}

                {/* Pestañas - ocultar cuando hay avisos de configuración o errores */}
                {!needsConfiguration && !missingLLMConfig && !courseLoadError && !isCheckingConfig && (
                    <ul className="nav nav-tabs mt-3 mb-0" role="tablist" key={`tabs-${isTeacherMode}-${reloadKey}`}>
                        {!needsConfiguration && (
                            <>
                                {/* Chat - solo visible en laboratorios */}
                                {isInLab && (
                                    <li className="nav-item" role="presentation">
                                        <button
                                            className={`nav-link ${activeTab === "chat" ? "active" : ""}`}
                                            onClick={() => setActiveTab("chat")}
                                            type="button"
                                            role="tab"
                                        >
                                            {t("sidebar.tabs.chat", "Chat")}
                                        </button>
                                    </li>
                                )}

                                {/* Pestañas solo para modo alumno */}
                                {!isTeacherMode && exercises.length > 0 && (
                                    <li className="nav-item" role="presentation">
                                        <button
                                            className={`nav-link ${activeTab === "exercises" ? "active" : ""}`}
                                            onClick={() => setActiveTab("exercises")}
                                            type="button"
                                            role="tab"
                                        >
                                            {t("sidebar.tabs.exercises", "Exercises")}
                                            {(exercisesWithExplanations.length > 0 ||
                                                exercisesWithEvaluations.length > 0) && (
                                                <span className="badge bg-primary ms-2">
                                                    {Math.max(
                                                        exercisesWithExplanations.length,
                                                        exercisesWithEvaluations.length,
                                                    )}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                )}

                                {/* Pestaña de progreso - para alumnos cuando hay courseId */}
                                {!isTeacherMode && props.courseId && (
                                    <li className="nav-item" role="presentation">
                                        <button
                                            className={`nav-link ${activeTab === "progress" ? "active" : ""}`}
                                            onClick={() => setActiveTab("progress")}
                                            type="button"
                                            role="tab"
                                        >
                                            {t("sidebar.tabs.progress", "My progress")}
                                        </button>
                                    </li>
                                )}

                                {/* Pestañas solo para modo profesor */}
                                {isTeacherMode && (
                                    <>
                                        {/* Configure section - solo visible cuando NO estamos en un lab */}
                                        {!isInLab && props.courseId && (
                                            <li className="nav-item" role="presentation">
                                                <button
                                                    className={`nav-link ${activeTab === "labs" ? "active" : ""}`}
                                                    onClick={() => setActiveTab("labs")}
                                                    type="button"
                                                    role="tab"
                                                >
                                                    {t("sidebar.tabs.configureCourse", "Configure section")}
                                                </button>
                                            </li>
                                        )}
                                        {/* Configure lab - solo visible cuando estamos en un lab */}
                                        {isInLab && (
                                            <li className="nav-item" role="presentation">
                                                <button
                                                    className={`nav-link ${activeTab === "config" ? "active" : ""}`}
                                                    onClick={() => setActiveTab("config")}
                                                    type="button"
                                                    role="tab"
                                                >
                                                    {t("sidebar.tabs.configureLab", "Configure lab")}
                                                </button>
                                            </li>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </ul>
                )}
            </div>

            {/* Área de contenido */}
            <div className="content-area">
                {isCheckingConfig ? (
                    <div className="d-flex align-items-center justify-content-center loading-container">
                        <div className="text-center">
                            <div className="spinner-border text-primary mb-3" role="status">
                                <span className="visually-hidden">
                                    {t("sidebar.checkingConfig", "Checking configuration...")}
                                </span>
                            </div>
                            <p className="text-muted">{t("sidebar.checkingConfig", "Checking configuration...")}</p>
                        </div>
                    </div>
                ) : courseLoadError ? (
                    <div className="d-flex align-items-center justify-content-center loading-container">
                        <div className="text-center px-4" style={{ maxWidth: "400px" }}>
                            <div className="mb-4">
                                <svg
                                    width="64"
                                    height="64"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-danger"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </div>
                            <h5 className="mb-3">{t("sidebar.courseLoadError", "Error loading course")}</h5>
                            <p className="text-muted mb-4">{courseLoadError}</p>
                            <button className="btn btn-primary" onClick={() => window.location.reload()}>
                                {t("sidebar.reloadPage", "Reload page")}
                            </button>
                        </div>
                    </div>
                ) : needsConfiguration || missingLLMConfig ? (
                    <ConfigurationRequired
                        onConfigLoaded={handleConfigLoaded}
                        missingExerciseConfig={needsConfiguration}
                        missingLLMConfig={missingLLMConfig}
                    />
                ) : activeTab === "chat" ? (
                    <ChatTab
                        messages={messages}
                        inputValue={inputValue}
                        isGenerating={isGenerating}
                        isChatDisabled={isChatDisabled}
                        isLoadingExercises={props.isLoadingExercises || false}
                        pageId={props.pageId}
                        hasExercisesLoaded={props.hasExercisesLoaded}
                        exercises={exercises}
                        isAnyModalOpen={props.isAnyModalOpen || false}
                        isTeacherMode={isTeacherMode}
                        onSendMessage={handleSendMessage}
                        onResetChat={handleResetChat}
                        onInputChange={setInputValue}
                        onKeyDown={handleKeyDown}
                        messagesEndRef={messagesEndRef}
                        inputRef={inputRef}
                    />
                ) : activeTab === "exercises" ? (
                    <ExercisesTab
                        isLoadingExplanations={isLoadingExplanations}
                        isLoadingEvaluations={isLoadingEvaluations}
                        exercises={exercises}
                        exercisesWithExplanations={exercisesWithExplanations}
                        exercisesWithEvaluations={exercisesWithEvaluations}
                        onExplanationClick={handleExplanationClick}
                        onEvaluationClick={handleEvaluationClick}
                        onRefinerClick={props.onOpenRefiner}
                    />
                ) : activeTab === "config" ? (
                    <ExerciseConfigTab
                        exercises={exercises}
                        pageId={props.pageId || ""}
                        courseId={props.courseId}
                        pageName={pageName}
                        onConfigUpdate={handleConfigUpdate}
                        isActive={activeTab === "config"}
                    />
                ) : activeTab === "labs" ? (
                    <LabConfigTab
                        courseId={props.courseId || ""}
                        sectionLabIds={sectionLabIds}
                        onConfigUpdate={handleConfigUpdate}
                        isActive={activeTab === "labs"}
                    />
                ) : activeTab === "progress" ? (
                    <ProgressTab courseId={props.courseId || ""} />
                ) : null}
            </div>
        </div>
    );
};

export default ChatSidebar;
