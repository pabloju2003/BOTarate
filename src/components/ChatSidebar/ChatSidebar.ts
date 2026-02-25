export { default } from './ChatSidebar.tsx';
import { useEffect, useRef, useState } from "react";
import { AppMode, ModeManager } from "../../util/config/ModeManager";
import { SidebarStateStorageManager } from "../../util/storage/SidebarStateStorageManager";

import type { ChatMessage, Exercise } from "../../types/shared";

export interface ChatSidebarProps {
    onClose: () => void;
    isLoadingExercises?: boolean;
    pageId?: string;
    courseId?: string;
    onOpenExplanation?: (exerciseName: string) => void;
    onExplanationGenerated?: () => void;
    onOpenEvaluation?: (exerciseName: string) => void;
    onEvaluationGenerated?: () => void;
    isAnyModalOpen?: boolean;
    hasExercisesLoaded?: boolean;
    onIdentifyExercises?: () => void;
    isLoadingCourse?: boolean;
    courseLoadError?: string | null;
    pageName?: string;
    sectionLabIds?: string[];
}

export type TabType = "chat" | "exercises" | "config" | "labs" | "progress";

export const useChatSidebar = (props: ChatSidebarProps) => {
    const {
        isLoadingExercises = false,
        pageId,
        courseId,
        onOpenExplanation,
        onExplanationGenerated,
        onOpenEvaluation,
        isAnyModalOpen = false,
        hasExercisesLoaded = false,
        isLoadingCourse = false,
        courseLoadError = null,
        pageName,
        sectionLabIds,
    } = props;

    const isInLab = !!pageId;

    const savedState = SidebarStateStorageManager.getSidebarState();
    const [isCollapsed, setIsCollapsed] = useState(savedState?.isCollapsed ?? false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<TabType>(() => {
        // Si hay un estado guardado, usarlo
        if (savedState?.activeTab) return savedState.activeTab;
        // Por defecto: "chat" si estamos en lab, "labs" si no (será corregido por useEffect si el usuario es estudiante)
        return isInLab ? "chat" : "labs";
    });
    const [enableTransition, setEnableTransition] = useState(false);
    const [exercisesWithExplanations, setExercisesWithExplanations] = useState<string[]>([]);
    const [exercisesWithEvaluations, setExercisesWithEvaluations] = useState<string[]>([]);
    const [isLoadingExplanations, setIsLoadingExplanations] = useState(false);
    const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
    const [exercises, setExercises] = useState<Exercise[]>([]);

    const [isTeacherMode, setIsTeacherMode] = useState<boolean>(false);
    const [isUserTeacher, setIsUserTeacher] = useState<boolean>(false);
    const [needsConfiguration, setNeedsConfiguration] = useState<boolean>(false);
    const [missingLLMConfig, setMissingLLMConfig] = useState<boolean>(false);
    const [isCheckingConfig, setIsCheckingConfig] = useState<boolean>(true);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const isChatDisabled =
        isAnyModalOpen || isGenerating || isLoadingExercises || (!!pageId && !hasExercisesLoaded) || isTeacherMode;

    // Effect: Corregir pestaña activa si no es válida para el contexto actual
    useEffect(() => {
        // No corregir hasta que sepamos el modo real del usuario
        if (isCheckingConfig) return;

        // Determinar pestañas válidas según contexto
        // Profesor en lab: "chat", "config"
        // Profesor fuera de lab: "labs"
        // Estudiante en lab: "chat", "exercises", "progress"
        // Estudiante fuera de lab: "progress"

        if (isTeacherMode) {
            // Profesor
            if (isInLab) {
                // En lab: válidas son "chat" y "config"
                if (activeTab !== "chat" && activeTab !== "config") {
                    setActiveTab("config");
                }
            } else {
                // Fuera de lab: válida es "labs"
                if (activeTab !== "labs") {
                    setActiveTab("labs");
                }
            }
        } else {
            // Estudiante
            if (isInLab) {
                // En lab: válidas son "chat", "exercises", "progress"
                if (activeTab === "labs" || activeTab === "config") {
                    setActiveTab("chat");
                }
            } else {
                // Fuera de lab: válida es "progress"
                if (activeTab !== "progress") {
                    setActiveTab("progress");
                }
            }
        }
    }, [isInLab, isTeacherMode, activeTab, isCheckingConfig]);

    // Effect: Verificar modo y configuración
    useEffect(() => {
        const checkModeAndConfiguration = async () => {
            // Si el curso está cargando, no ejecutar esta verificación aún
            if (isLoadingCourse) {
                setIsCheckingConfig(true);
                return;
            }

            // Si hay un error al cargar el curso, mostrar ese error directamente
            if (courseLoadError) {
                setIsCheckingConfig(false);
                setMissingLLMConfig(true); // Usar esta flag para mostrar el error
                return;
            }

            setIsCheckingConfig(true);
            try {
                ModeManager.clearCache();

                // Si hay courseId, usar checkUserRoleForCourse para evitar problemas con el curso en caché
                const message = courseId
                    ? { action: "checkUserRoleForCourse", courseId }
                    : { action: "checkUserRole" };

                const response = await chrome.runtime.sendMessage(message);
                const userIsTeacher = response?.success ? response.isTeacher : false;
                setIsUserTeacher(userIsTeacher);

                if (!userIsTeacher) {
                    await ModeManager.setMode(AppMode.STUDENT);
                    setIsTeacherMode(false);
                } else {
                    const teacherMode = await ModeManager.isTeacherMode();
                    setIsTeacherMode(teacherMode);
                }

                const configResponse = await chrome.runtime.sendMessage({ action: "checkConfiguration" });

                if (configResponse?.success) {
                    setMissingLLMConfig(!configResponse.hasLLMConfig);

                    const currentMode = await ModeManager.getMode();
                    if (currentMode === AppMode.STUDENT) {
                        setNeedsConfiguration(!configResponse.hasStudentConfig);
                    } else {
                        setNeedsConfiguration(false);
                    }
                } else {
                    setMissingLLMConfig(false);
                    setNeedsConfiguration(false);
                }
            } catch (error) {
                console.error("[ChatSidebar] Error verificando configuración:", error);
                setNeedsConfiguration(false);
                setMissingLLMConfig(false);
            } finally {
                setIsCheckingConfig(false);
            }
        };

        checkModeAndConfiguration();
    }, [reloadKey, isLoadingCourse, courseLoadError]);

    // Effect: Escuchar mensajes de recarga y tool calls
    useEffect(() => {
        const messageListener = (
            message: any,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (message.action === "reloadSidebar") {
                setReloadKey(prev => prev + 1);
                sendResponse({ success: true });
                return true;
            }

            // Manejar notificaciones de tool calls en tiempo real
            if (message.action === "toolCallsUpdate" && message.toolCalls) {
                const toolCallMessage: ChatMessage = {
                    role: "assistant",
                    content: null,
                    id: `tool-${Date.now()}`,
                    tool_calls: message.toolCalls
                };
                setMessages(prev => [...prev, toolCallMessage]);
                sendResponse({ success: true });
                return true;
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    // Effect: Habilitar transición
    useEffect(() => {
        setEnableTransition(true);
    }, []);

    // Effect: Guardar estado del sidebar
    useEffect(() => {
        try {
            SidebarStateStorageManager.saveSidebarState({
                isCollapsed,
                activeTab,
            });
        } catch (error) {
            console.error("Error guardando estado del sidebar:", error);
        }
    }, [isCollapsed, activeTab]);

    // Effect: Cargar ejercicios cuando haya pageId
    useEffect(() => {
        if (pageId && !needsConfiguration) {
            loadExercises();
            loadExercisesWithExplanations();
            loadExercisesWithEvaluations();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageId, reloadKey, needsConfiguration]);

    // Effect: Cargar historial del chat
    useEffect(() => {
        const loadChatHistory = async () => {
            try {
                const response: any = await chrome.runtime.sendMessage({ action: "loadChatHistory" });

                if (response && response.success && Array.isArray(response.messages)) {
                    const uiMessages: ChatMessage[] = response.messages
                        .filter((m: any) => m.role === "user" || m.role === "assistant" || m.role === "tool")
                        .map((m: any, idx: number) => ({
                            role: m.role as "user" | "assistant" | "tool",
                            content: m.content,
                            id: `${m.role}-${Date.now()}-${idx}`,
                            tool_calls: m.tool_calls,
                            name: m.name,
                        }));

                    setMessages(uiMessages);
                    console.log(`[ChatSidebar] Historial de chat cargado: ${uiMessages.length} mensajes`);
                } else {
                    console.log("[ChatSidebar] No hay historial de chat en background");
                }
            } catch (error) {
                console.error("[ChatSidebar] Error cargando historial de chat:", error);
            }
        };

        loadChatHistory();
    }, []);

    // Effect: Scroll automático en el chat
    useEffect(() => {
        if (activeTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isGenerating, activeTab]);

    // Función: Cargar ejercicios con explicaciones
    const loadExercisesWithExplanations = async () => {
        if (!pageId) return;

        setIsLoadingExplanations(true);
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getExercisesWithExplanations",
                pageId: pageId,
            });

            if (response.success) {
                setExercisesWithExplanations(response.exerciseNames);
            }
        } catch (error) {
            console.error("Error loading exercises with explanations:", error);
        } finally {
            setIsLoadingExplanations(false);
        }
    };

    // Función: Cargar ejercicios con evaluaciones
    const loadExercisesWithEvaluations = async () => {
        if (!pageId) return;

        setIsLoadingEvaluations(true);
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getExercisesWithEvaluations",
                pageId: pageId,
            });

            if (response.success) {
                setExercisesWithEvaluations(response.exerciseNames);
            }
        } catch (error) {
            console.error("Error loading exercises with evaluations:", error);
        } finally {
            setIsLoadingEvaluations(false);
        }
    };

    // Función: Cargar ejercicios
    const loadExercises = async () => {
        if (!pageId) return;

        try {
            const resp = await chrome.runtime.sendMessage({ action: "getExerciseData", pageId });
            if (resp && resp.success && resp.data && Array.isArray(resp.data.exercises)) {
                const loaded = resp.data.exercises.map((ex: any) => ({
                    name: ex.name,
                    statement: ex.statement,
                    role: ex.role ?? (ex.allowed === false ? 'challenger' : ex.isPicky === true ? 'proofreader' : 'tutor'),
                }));
                setExercises(loaded);
            } else {
                setExercises([]);
            }
        } catch (error) {
            console.error("Error loading exercises:", error);
            setExercises([]);
        }
    };

    // Handler: Configuración cargada
    const handleConfigLoaded = async () => {
        setReloadKey(prev => prev + 1);

        if (pageId) {
            await loadExercises();
            await loadExercisesWithExplanations();
            await loadExercisesWithEvaluations();
        }
    };

    // Handler: Cambiar modo
    const handleModeToggle = async () => {
        if (!isUserTeacher) return;

        try {
            const newMode = await ModeManager.toggleMode();
            const newIsTeacherMode = newMode === AppMode.TEACHER;
            setIsTeacherMode(newIsTeacherMode);

            // Seleccionar pestaña apropiada según contexto
            if (newIsTeacherMode) {
                setActiveTab(isInLab ? "config" : "labs");
            } else {
                setActiveTab(isInLab ? "chat" : "progress");
            }

            setReloadKey(prev => prev + 1);

            if (chrome.tabs) {
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
                        try {
                            await chrome.tabs.sendMessage(tab.id, { action: "reloadSidebar" });
                        } catch (error) {
                            // Ignorar errores
                        }
                    }
                }

                const extensionTabs = tabs.filter(tab => tab.url?.includes("chrome-extension://"));
                for (const tab of extensionTabs) {
                    if (tab.id) {
                        chrome.tabs.reload(tab.id);
                    }
                }
            }
        } catch (error) {
            console.error("[ChatSidebar] Error al cambiar el modo:", error);
        }
    };

    // Handler: Click en explicación
    const handleExplanationClick = (exerciseName: string) => {
        if (onOpenExplanation) {
            onOpenExplanation(exerciseName);
        }
    };

    // Handler: Click en evaluación
    const handleEvaluationClick = (exerciseName: string) => {
        if (onOpenEvaluation) {
            onOpenEvaluation(exerciseName);
        }
    };

    // Handler: Actualización de configuración
    const handleConfigUpdate = async () => {
        if (pageId) {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: "getExerciseData",
                    pageId: pageId,
                });

                if (response.success && response.data) {
                    setExercises(
                        response.data.exercises.map((ex: any) => ({
                            name: ex.name,
                            statement: ex.statement,
                            role: ex.role ?? (ex.allowed === false ? 'challenger' : ex.isPicky === true ? 'proofreader' : 'tutor'),
                        }))
                    );
                }
            } catch (error) {
                console.error("Error loading updated exercises:", error);
            }
        }

        await loadExercisesWithExplanations();

        if (onExplanationGenerated) {
            onExplanationGenerated();
        }
    };

    // Handler: Enviar mensaje
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isGenerating) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: inputValue,
            id: `user-${Date.now()}`,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsGenerating(true);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "generateResponse",
                userMessage: inputValue,
                resetHistory: false,
                exercises: exercises.length > 0 ? exercises : undefined,
            });

            const agentMessage: ChatMessage = {
                role: "assistant",
                content: response,
                id: `agent-${Date.now()}`,
            };

            setMessages(prev => [...prev, agentMessage]);
        } catch (error) {
            console.error("Error generating response:", error);
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "Error generating response. Please try again.",
                id: `error-${Date.now()}`,
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsGenerating(false);
            // Mantener el foco en el input después de enviar el mensaje
            setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
        }
    };

    // Handler: Reiniciar chat
    const handleResetChat = async () => {
        try {
            await chrome.runtime.sendMessage({ action: "resetChatHistory" });
            setMessages([]);
            console.log("[ChatSidebar] Chat reiniciado");
        } catch (error) {
            console.error("[ChatSidebar] Error reiniciando chat:", error);
        }
    };

    // Handler: Tecla presionada
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return {
        // Estado
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
        // Handlers
        handleConfigLoaded,
        handleModeToggle,
        handleExplanationClick,
        handleEvaluationClick,
        handleConfigUpdate,
        handleSendMessage,
        handleResetChat,
        handleKeyDown,
    };
};
