import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import ChatSidebar from "../components/ChatSidebar";
import EvaluationListModal from "../components/EvaluationListModal";
import ExerciseModal from "../components/ExerciseModal";
import RefinerModal from "../components/RefinerModal";
import SolutionModal from "../components/SolutionModal";
import i18n, { i18nInitialized } from "../i18n";
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";
import { detectCurrentCourseSectionNumber } from "../util/egela/SectionDetection";
import { extractPdfTextFromBase64 } from "../util/pdf/PdfExtractor";
// @ts-ignore: allow importing CSS as a side-effect in this content script
import "./bootstrap.css";

const PAGE_VIEW_HREF = "https://egela.ehu.eus/mod/page/view.php";

interface Exercise {
    name: string;
    statement: string;
    role?: 'observer' | 'proofreader' | 'tutor' | 'challenger' | 'refiner';
}

type ViewState = "loading" | "chat" | "hidden";

// Helper para verificar si estamos en una página donde no debe cargarse la extensión
const shouldNotLoadExtension = (): boolean => {
    const url = globalThis.location.href;
    const pathname = globalThis.location.pathname;

    // No cargar en la página principal de Egela
    if (url === "https://egela.ehu.eus/" || url === "https://egela.ehu.eus") {
        return true;
    }

    // No cargar en la página de login
    if (pathname.includes("/login/")) {
        return true;
    }

    // No cargar si solo estamos en el dominio raíz
    if (pathname === "/" || pathname === "") {
        return true;
    }

    // Solo cargar en páginas de cursos y recursos de módulos
    // Permitir: /course/view.php (página del curso)
    if (pathname.includes("/course/view.php")) {
        return false;
    }

    // Permitir: /mod/*  (recursos y actividades dentro de cursos: páginas, tareas, cuestionarios, etc.)
    if (pathname.includes("/mod/")) {
        return false;
    }

    // Excluir todo lo demás (perfiles de usuario, calificaciones, etc.)
    return true;
};

// Helper para obtener el pageId de la URL actual
const getPageIdFromUrl = (): string | null => {
    if (!globalThis.location.href.includes(PAGE_VIEW_HREF)) {
        return null;
    }
    const urlParams = new URLSearchParams(globalThis.location.search);
    return urlParams.get("id");
};

const ExtensionContent: React.FC = () => {
    const [viewState, setViewState] = useState<ViewState>("chat");
    const [course, setCourse] = useState<Course | null>(null);
    const [courseName, setCourseName] = useState<string>("Cargando...");
    const [courseId, setCourseId] = useState<string | null>(null);
    const [isLoadingCourse, setIsLoadingCourse] = useState<boolean>(true);
    const [courseLoadError, setCourseLoadError] = useState<string | null>(null);
    const [providerName, setProviderName] = useState<string>("");
    const [modelName, setModelName] = useState<string>("");
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [exerciseContext, setExerciseContext] = useState<string | undefined>(undefined);
    const [concepts, setConcepts] = useState<string[] | undefined>(undefined);
    const [learningObjectives, setLearningObjectives] = useState<string | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isSolutionModalOpen, setIsSolutionModalOpen] = useState<boolean>(false);
    const [isEvaluationListModalOpen, setIsEvaluationListModalOpen] = useState<boolean>(false);
    const [isRefinerModalOpen, setIsRefinerModalOpen] = useState<boolean>(false);
    const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number>(0);
    const [selectedEvaluationExerciseName, setSelectedEvaluationExerciseName] = useState<string>("");
    const [currentPageId, setCurrentPageId] = useState<string | null>(null);
    const [isLoadingExercises, setIsLoadingExercises] = useState<boolean>(false);
    const [modalLoadFromCache, setModalLoadFromCache] = useState<boolean>(false);
    const [reloadExplanationsKey, setReloadExplanationsKey] = useState<number>(0);
    const [reloadEvaluationsKey, setReloadEvaluationsKey] = useState<number>(0);
    const [reloadSidebarKey, setReloadSidebarKey] = useState<number>(0);
    const [pendingModalOpen, setPendingModalOpen] = useState<{ index: number; fromCache: boolean } | null>(null);
    const [pendingSolutionModalOpen, setPendingSolutionModalOpen] = useState<number | null>(null);
    const identifyingExercisesRef = React.useRef<boolean>(false);

    // Derivar pageName y sectionId del curso y la página actual
    const { pageName, currentSectionId } = useMemo(() => {
        if (!course) {
            return { pageName: undefined, currentSectionId: undefined };
        }

        // Si estamos en un lab (page), buscar por pageId
        if (currentPageId) {
            for (const section of course.sections) {
                const resource = section.resources.find(r => r.id === currentPageId);
                if (resource) {
                    return { pageName: resource.name, currentSectionId: section.id };
                }
            }
            return { pageName: undefined, currentSectionId: undefined };
        }

        // Si estamos en la vista de sección del curso (/course/view.php?id=X&section=N)
        const pathname = globalThis.location.pathname;
        if (pathname.includes("/course/view.php")) {
            const sectionNumber = detectCurrentCourseSectionNumber(globalThis.location.href, document);
            if (sectionNumber !== undefined) {
                const section = course.sections.find(s => s.section === sectionNumber);
                if (section) {
                    return { pageName: section.title, currentSectionId: section.id };
                }
            }

            return { pageName: undefined, currentSectionId: undefined };
        }

        // Si estamos en un recurso tipo /mod/ (no page), buscar por id del módulo
        if (pathname.includes("/mod/")) {
            const urlParams = new URLSearchParams(globalThis.location.search);
            const modId = urlParams.get("id");
            if (modId) {
                for (const section of course.sections) {
                    const resource = section.resources.find(r => r.id === modId);
                    if (resource) {
                        return { pageName: resource.name, currentSectionId: section.id };
                    }
                }
            }
        }

        return { pageName: undefined, currentSectionId: undefined };
    }, [course, currentPageId]);

    // IDs de los labs que pertenecen a la sección actual
    const sectionLabIds = useMemo(() => {
        if (!course || !currentSectionId) return undefined;
        const section = course.sections?.find(s => s.id === currentSectionId);
        if (!section) return [];
        return section.resources?.filter(r => r.module === "page").map(r => r.id) || [];
    }, [course, currentSectionId]);

    // Nombre a mostrar debajo del título
    const displayName = useMemo(() => {
        return pageName ?? undefined;
    }, [pageName]);

    const openExerciseModalForIndex = useCallback(
        (exerciseIndex: number, fromCache: boolean): boolean => {
            const exercise = exercises[exerciseIndex];
            if (!exercise) {
                return false;
            }

            setSelectedExerciseIndex(exerciseIndex);
            setModalLoadFromCache(fromCache);
            setIsModalOpen(true);
            return true;
        },
        [exercises, setSelectedExerciseIndex, setModalLoadFromCache, setIsModalOpen],
    );

    // Efecto para abrir modales pendientes cuando los ejercicios se cargan
    useEffect(() => {
        if (exercises.length > 0 && pendingModalOpen !== null) {
            console.log("[content] Abriendo modal pendiente, ejercicio:", pendingModalOpen.index);
            openExerciseModalForIndex(pendingModalOpen.index, pendingModalOpen.fromCache);
            setPendingModalOpen(null);
        }

        if (exercises.length > 0 && pendingSolutionModalOpen !== null) {
            console.log("[content] Abriendo modal de solución pendiente, ejercicio:", pendingSolutionModalOpen);
            setSelectedExerciseIndex(pendingSolutionModalOpen);
            setIsSolutionModalOpen(true);
            setPendingSolutionModalOpen(null);
        }
    }, [exercises, pendingModalOpen, pendingSolutionModalOpen, openExerciseModalForIndex]);

    useEffect(() => {
        // Extraer el courseId de la URL actual
        const extractCourseIdFromUrl = (url: string): string | null => {
            try {
                const urlObj = new URL(url);
                if (url.includes("egela.ehu.eus/course/view.php?id=")) {
                    return urlObj.searchParams.get("id");
                }
            } catch (error) {
                console.error("[content] Error parsing URL:", error);
            }
            return null;
        };

        const waitForCourseInSessionStorage = (
            courseId: string,
            timeoutMs: number = 15000,
            intervalMs: number = 50,
        ) => {
            return new Promise<boolean>(resolve => {
                const start = Date.now();
                console.log(`[content] Waiting for course ${courseId} in sessionStorage...`);
                const check = () => {
                    const elapsed = Date.now() - start;

                    // Buscar la clave específica del curso
                    const courseKey = Object.keys(sessionStorage).find(key =>
                        key.endsWith(`/course/${courseId}/staticState`),
                    );

                    if (courseKey) {
                        console.log(`[content] Course ${courseId} found in sessionStorage after ${elapsed}ms`);
                        resolve(true);
                    } else if (elapsed >= timeoutMs) {
                        console.warn(`[content] Timeout reached (${timeoutMs}ms) waiting for course ${courseId}`);
                        resolve(false);
                    } else {
                        setTimeout(check, intervalMs);
                    }
                };
                check();
            });
        };

        const loadCourseData = async () => {
            // No intentar cargar si estamos en páginas excluidas
            if (shouldNotLoadExtension()) {
                setIsLoadingCourse(false);
                return;
            }

            setIsLoadingCourse(true);
            setCourseLoadError(null);

            try {
                // Extraer el courseId de la URL
                const currentCourseId = extractCourseIdFromUrl(globalThis.location.href);

                if (currentCourseId) {
                    // Esperar a que el curso específico esté en sessionStorage
                    const courseFound = await waitForCourseInSessionStorage(currentCourseId, 15000, 50);

                    if (!courseFound) {
                        throw new Error(
                            "No se ha podido cargar los datos de la asignatura. Intenta recargar la página.",
                        );
                    }
                }

                console.log(`[content] Serializing sessionStorage with ${sessionStorage.length} keys`);

                // Serializar sessionStorage completo a un objeto
                const sessionStorageData: Record<string, string> = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                        sessionStorageData[key] = sessionStorage.getItem(key) || "";
                    }
                }

                console.log(`[content] SessionStorage keys:`, Object.keys(sessionStorageData));

                // Enviar href y sessionStorage al background
                const response = await chrome.runtime.sendMessage({
                    action: "getCourseData",
                    href: globalThis.location.href,
                    sessionStorageData: sessionStorageData,
                });

                if (response.success && response.course) {
                    setCourse(response.course);
                    setCourseId(response.course.id);

                    // Obtener el nombre del curso desde la página
                    const courseTitle =
                        document.querySelector(".page-header-headings h1")?.textContent || "Unnamed Course";
                    setCourseName(courseTitle);

                    console.log("[content] Course data loaded:", response.course);
                    setIsLoadingCourse(false);

                    // Detectar si estamos en una página de ejercicios
                    const pageId = getPageIdFromUrl();
                    if (pageId) {
                        console.log(`[content] Egela page detected, ID: ${pageId}`);
                        setCurrentPageId(pageId);
                        setViewState("chat");
                        // Cargar ejercicios desde cache al detectar la página
                        await loadExercisesFromCache(pageId);
                    }
                } else {
                    throw new Error(response.error || "No se ha podido cargar los datos de la asignatura");
                }
            } catch (error) {
                console.error("[content] Error loading course data:", error);
                const errorMessage = error instanceof Error ? error.message : "Error loading course";
                setCourseName("Error loading course");
                setCourseLoadError(errorMessage);
                setIsLoadingCourse(false);
            }
        };

        const loadConfig = async () => {
            try {
                await ConfigManager.loadConfig();
                const provider = ConfigManager.getSelectedProvider();
                const model = ConfigManager.getSelectedModel();
                setProviderName(provider.name);
                setModelName(model || "Not selected");
            } catch (error) {
                console.error("[content] Error loading config:", error);
            }
        };

        // Listener para mensajes del background (para abrir el modal y extraer PDFs)
        const messageListener = (
            message: any,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void,
        ) => {
            if (message.action === "openExerciseModal") {
                console.log("[content] Received message to open exercise modal:", message.exerciseIndex);
                handleOpenExerciseModal(message.exerciseIndex).catch(err => {
                    console.error("[content] Error opening exercise modal:", err);
                });
                return false;
            }
            if (message.action === "openSolutionModal") {
                console.log("[content] Received message to open solution modal:", message.exerciseIndex);
                handleOpenSolutionModal(message.exerciseIndex).catch(err => {
                    console.error("[content] Error opening solution modal:", err);
                });
                return false;
            }
            if (message.action === "openRefinerModal") {
                console.log("[content] Received message to open Refiner modal:", message.exerciseIndex);
                handleOpenRefinerModalByIndex(message.exerciseIndex).catch(err => {
                    console.error("[content] Error opening Refiner modal:", err);
                });
                return false;
            }
            if (message.action === "extractPdfText") {
                console.log("[content] Received message to extract PDF text:", message.filename);
                extractPdfTextFromBase64(message.pdfBase64, message.filename, message.resourceName, message.size)
                    .then(result => {
                        sendResponse(result);
                    })
                    .catch(err => {
                        sendResponse({ success: false, error: err.message });
                    });
                return true; // Indica que sendResponse se llamará de forma asíncrona
            }
            if (message.action === "toolCallsUpdate") {
                // Este mensaje se maneja en ChatSidebar, no aquí
                return false;
            }
            return false;
        };

        chrome.runtime.onMessage.addListener(messageListener);

        loadCourseData();
        loadConfig();

        // Cleanup
        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    // Detectar cambios en la URL para actualizar el contexto cuando se cambia de página
    useEffect(() => {
        let lastPageId = currentPageId;

        const checkUrlChange = async () => {
            const newPageId = getPageIdFromUrl();

            // Si hay un cambio de página
            if (newPageId !== lastPageId) {
                if (newPageId) {
                    console.log(`[content] Page change detected: ${lastPageId} -> ${newPageId}`);
                    setCurrentPageId(newPageId);
                    setExercises([]);
                    setIsLoadingExercises(false);
                    // Cargar ejercicios desde cache al cambiar de página
                    await loadExercisesFromCache(newPageId);
                    setReloadSidebarKey(prev => prev + 1);
                } else if (lastPageId !== null) {
                    // Ya no estamos en una página de ejercicios
                    console.log(`[content] Leaving exercises page`);
                    setCurrentPageId(null);
                    setExercises([]);
                    setReloadSidebarKey(prev => prev + 1);
                }
                lastPageId = newPageId;
            }
        };

        // Verificar inmediatamente
        checkUrlChange();

        // Monitorear cambios de URL usando popstate y pushstate
        const handleUrlChange = () => checkUrlChange();

        window.addEventListener("popstate", handleUrlChange);
        window.addEventListener("pushstate", handleUrlChange);
        window.addEventListener("replacestate", handleUrlChange);

        // Fallback con interval por si los eventos no se disparan
        const intervalId = setInterval(checkUrlChange, 1000);

        return () => {
            window.removeEventListener("popstate", handleUrlChange);
            window.removeEventListener("pushstate", handleUrlChange);
            window.removeEventListener("replacestate", handleUrlChange);
            clearInterval(intervalId);
        };
    }, [currentPageId]);

    // Función para generar ejercicios con LLM (llamada manualmente con botones)
    const generateExercises = async (pageId: string) => {
        // Prevenir múltiples identificaciones simultáneas
        if (identifyingExercisesRef.current) {
            console.log("[content] Identification already in progress, ignoring request");
            return;
        }

        identifyingExercisesRef.current = true;

        try {
            // Extraer el resourceId de la URL (parámetro 'id' es el resourceId en páginas de Egela)
            const urlParams = new URLSearchParams(globalThis.location.search);
            const resourceId = urlParams.get("id"); // El ID del recurso (página) actual

            console.log("[content] Generating exercises with LLM...");
            console.log("[content] PageId:", pageId, "ResourceId:", resourceId);

            const response = await chrome.runtime.sendMessage({
                action: "getExerciseList",
                pageId: pageId,
                resourceId: resourceId || undefined,
                forceRefresh: true, // Siempre generar nuevos, nunca usar cache
            });

            if (response.success) {
                console.log(`[content] Identified ${response.exercises.length} exercises:`, response.exercises);

                // Actualizar el contexto usando el helper
                updateExerciseContext({
                    exercises: response.exercises.length > 0 ? response.exercises : [],
                    exercise_context: response.exercise_context,
                    concepts: response.concepts,
                    learning_objectives: response.learning_objectives,
                });

                if (response.concepts) {
                    console.log("[content] Concepts:", response.concepts);
                }
                if (response.learning_objectives) {
                    console.log("[content] Learning objectives:", response.learning_objectives);
                }

                if (response.exercises.length > 0) {
                    // Forzar recarga del sidebar para que muestre las pestañas de configuración
                    setReloadSidebarKey(prev => prev + 1);
                }
                // Si no hay ejercicios, simplemente mantenemos la vista del chat sin ejercicios
            } else {
                console.error("[content] Error identifying exercises:", response.error);
            }
        } catch (error) {
            console.error("[content] Error requesting exercise identification:", error);
        } finally {
            setIsLoadingExercises(false);
            identifyingExercisesRef.current = false;
        }
    };

    const handleCloseExtension = () => {
        setViewState("hidden");
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleCloseSolutionModal = () => {
        setIsSolutionModalOpen(false);
    };

    const handleCloseRefinerModal = () => {
        setIsRefinerModalOpen(false);
    };

    const handleOpenRefinerModal = (exerciseName: string) => {
        const exerciseIndex = exercises.findIndex(ex => ex.name === exerciseName);
        if (exerciseIndex < 0) {
            console.warn(`[content] Refiner: exercise not found: ${exerciseName}`);
            return;
        }
        setSelectedExerciseIndex(exerciseIndex);
        setIsRefinerModalOpen(true);
    };

    const handleOpenRefinerModalByIndex = async (exerciseIndex: number) => {
        if (exercises.length === 0) {
            const pageId = currentPageId || getPageIdFromUrl();
            if (pageId) {
                await loadExercisesFromCache(pageId);
            }
        }
        setSelectedExerciseIndex(exerciseIndex);
        setIsRefinerModalOpen(true);
    };

    // Helper para actualizar el contexto de ejercicios (usado por ambas funciones de carga)
    const updateExerciseContext = (data: any) => {
        if (data.exercises) {
            setExercises(
                data.exercises.map((exercise: Exercise) => ({
                    ...exercise,
                    role: exercise.role ?? ((exercise as any).allowed === false ? 'observer' : (exercise as any).isPicky === true ? 'challenger' : 'tutor'),
                })),
            );
        }
        setExerciseContext(data.exercise_context);
        setConcepts(data.concepts);
        setLearningObjectives(data.learning_objectives);
    };

    // Función para cargar ejercicios desde cache (llamada automáticamente al cargar página)
    const loadExercisesFromCache = async (pageId: string): Promise<boolean> => {
        console.log("[content] Attempting to load exercises from cache...");
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getExerciseData",
                pageId: pageId,
            });

            if (response.success && response.data && response.data.exercises && response.data.exercises.length > 0) {
                console.log("[content] Exercises loaded from cache:", response.data.exercises.length);
                updateExerciseContext(response.data);
                return true;
            } else {
                console.log("[content] No exercises in cache for this page");
            }
        } catch (error) {
            console.error("[content] Error loading exercises from cache:", error);
        }
        return false;
    };

    const handleOpenExerciseModal = async (exerciseIndex: number, fromCache: boolean = false) => {
        console.log("[content] handleOpenExerciseModal - Index:", exerciseIndex, "Ejercicios:", exercises.length);

        // Si no hay ejercicios, intentar cargarlos desde cache y marcar como pendiente
        if (exercises.length === 0) {
            const pageId = currentPageId || getPageIdFromUrl();
            if (pageId) {
                const loaded = await loadExercisesFromCache(pageId);
                if (loaded) {
                    setPendingModalOpen({ index: exerciseIndex, fromCache });
                    return;
                }
            }
        }

        openExerciseModalForIndex(exerciseIndex, fromCache);
    };

    const handleOpenSolutionModal = async (exerciseIndex: number) => {
        console.log("[content] handleOpenSolutionModal - Index:", exerciseIndex, "Ejercicios:", exercises.length);

        // Si no hay ejercicios, intentar cargarlos desde cache y marcar como pendiente
        if (exercises.length === 0) {
            const pageId = currentPageId || getPageIdFromUrl();
            if (pageId) {
                const loaded = await loadExercisesFromCache(pageId);
                if (loaded) {
                    setPendingSolutionModalOpen(exerciseIndex);
                    return;
                }
            }
        }

        // Abrir modal directamente
        setSelectedExerciseIndex(exerciseIndex);
        setIsSolutionModalOpen(true);
    };

    const handleOpenExplanationFromCache = async (exerciseName: string) => {
        // Buscar el ejercicio por nombre
        const exerciseIndex = exercises.findIndex(ex => ex.name === exerciseName);

        if (exerciseIndex >= 0) {
            // Si encontramos el ejercicio, abrir el modal con ese ejercicio y carga del cache
            handleOpenExerciseModal(exerciseIndex, true);
        } else {
            console.warn(`[content] Exercise not found: ${exerciseName}`);
        }
    };

    const handleExplanationGenerated = () => {
        // Incrementar el trigger para forzar recarga en ChatSidebar
        setReloadExplanationsKey(prev => prev + 1);
    };

    const handleOpenEvaluationList = (exerciseName: string) => {
        setSelectedEvaluationExerciseName(exerciseName);
        setIsEvaluationListModalOpen(true);
    };

    const handleCloseEvaluationListModal = () => {
        setIsEvaluationListModalOpen(false);
    };

    const handleEvaluationGenerated = () => {
        // Incrementar el trigger para forzar recarga en ChatSidebar
        setReloadEvaluationsKey(prev => prev + 1);

        // Abrir el modal de lista de evaluaciones para el ejercicio actual
        if (exercises.length > 0 && exercises[selectedExerciseIndex]) {
            setSelectedEvaluationExerciseName(exercises[selectedExerciseIndex].name);
            setIsEvaluationListModalOpen(true);
        }
    };

    const handleIdentifyExercises = async () => {
        const pageId = currentPageId || getPageIdFromUrl();
        if (!pageId) {
            console.warn("[content] No pageId to identify exercises");
            return;
        }

        setIsLoadingExercises(true);
        await generateExercises(pageId);
    };

    // No mostrar nada si está oculto
    if (viewState === "hidden") return null;

    // No mostrar la extensión en páginas excluidas (index, login)
    if (shouldNotLoadExtension()) {
        return null;
    }

    // Renderizar según el estado
    return (
        <>
            {/* El chat se muestra si el estado es "chat" */}
            {viewState === "chat" && (
                <ChatSidebar
                    courseId={courseId || undefined}
                    onClose={handleCloseExtension}
                    isLoadingExercises={isLoadingExercises}
                    pageId={currentPageId || undefined}
                    pageName={displayName}
                    sectionLabIds={sectionLabIds}
                    onOpenExplanation={handleOpenExplanationFromCache}
                    onExplanationGenerated={handleExplanationGenerated}
                    onOpenEvaluation={handleOpenEvaluationList}
                    onEvaluationGenerated={handleEvaluationGenerated}
                    isAnyModalOpen={isModalOpen || isSolutionModalOpen || isEvaluationListModalOpen || isRefinerModalOpen}
                    onOpenRefiner={handleOpenRefinerModal}
                    hasExercisesLoaded={exercises.length > 0}
                    isLoadingCourse={isLoadingCourse}
                    courseLoadError={courseLoadError}
                    key={`${reloadExplanationsKey}-${reloadEvaluationsKey}-${reloadSidebarKey}`} // Re-renderizar cuando cambie cualquier trigger
                />
            )}

            {/* El modal se muestra sobre el chat cuando se selecciona un ejercicio */}
            {isModalOpen && exercises.length > 0 && exercises[selectedExerciseIndex] && (
                <ExerciseModal
                    exercise={exercises[selectedExerciseIndex]}
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    pageId={currentPageId || undefined}
                    courseId={courseId || undefined}
                    loadFromCache={modalLoadFromCache}
                    onExplanationGenerated={handleExplanationGenerated}
                />
            )}

            {/* El modal de solución se muestra cuando el estudiante quiere resolver un ejercicio */}
            {isSolutionModalOpen && exercises.length > 0 && exercises[selectedExerciseIndex] && (
                <SolutionModal
                    exercise={exercises[selectedExerciseIndex]}
                    exerciseContext={exerciseContext}
                    concepts={concepts}
                    learningObjectives={learningObjectives}
                    isOpen={isSolutionModalOpen}
                    onClose={handleCloseSolutionModal}
                    pageId={currentPageId || undefined}
                    courseId={courseId || undefined}
                    onEvaluationGenerated={handleEvaluationGenerated}
                />
            )}

            {/* El modal de lista de evaluaciones muestra el historial de evaluaciones de un ejercicio */}
            {isEvaluationListModalOpen && (
                <EvaluationListModal
                    exerciseName={selectedEvaluationExerciseName}
                    isOpen={isEvaluationListModalOpen}
                    onClose={handleCloseEvaluationListModal}
                    pageId={currentPageId || undefined}
                />
            )}

            {/* RefinerModal: borrador iterativo + feedback de IA sin solución */}
            {isRefinerModalOpen && exercises.length > 0 && exercises[selectedExerciseIndex] && (
                <RefinerModal
                    exercise={exercises[selectedExerciseIndex]}
                    isOpen={isRefinerModalOpen}
                    onClose={handleCloseRefinerModal}
                    pageId={currentPageId || undefined}
                    courseId={courseId || undefined}
                    exerciseContext={exerciseContext}
                />
            )}
        </>
    );
};

// Componente principal que maneja la inyección
const ContentApp: React.FC = () => {
    useEffect(() => {
        console.log("Chrome extension loaded at:", globalThis.location.href);

        // Escuchar cambios de idioma desde el background script
        const handleLanguageChange = (message: any) => {
            if (message.action === "languageChanged" && message.language) {
                console.log("[Content] Language changed to:", message.language);
                i18n.changeLanguage(message.language);
            }
        };

        chrome.runtime.onMessage.addListener(handleLanguageChange);

        return () => {
            console.log("Chrome extension unloaded");
            chrome.runtime.onMessage.removeListener(handleLanguageChange);
        };
    }, []);

    return <ExtensionContent />;
};

// Crear el punto de montaje para la extensión
const mountPoint = document.createElement("div");
mountPoint.id = "chrome-extension-react-root";
document.body.appendChild(mountPoint);

// Esperar a que i18n esté completamente inicializado antes de renderizar
i18nInitialized.then(() => {
    const root = createRoot(mountPoint);
    root.render(<ContentApp />);
});
