import type { Course } from "../../util/egela/Course";
import { getUserCourses, isUserTeacherInCourse } from "../../util/egela/EgelaDashboard";
import type { AIRole } from "../../types/shared";
import { ExerciseStorageManager } from "../../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../../util/storage/ExplanationStorageManager";
import { LabStorageManager, ReasoningEffort, VerbosityLevel } from "../../util/storage/LabStorageManager";
import { ModeStorageManager } from "../../util/storage/ModeStorageManager";
import { RefinerStorageManager } from "../../util/storage/RefinerStorageManager";
import { getCachedCourse } from "./dataHandlers";

export function handleUpdateExercise(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, oldName, exercise } = request;

    (async () => {
        try {
            await ExerciseStorageManager.updateExercise(pageId, oldName, exercise);
            console.log(`Ejercicio actualizado en página ${pageId}: ${oldName} -> ${exercise?.name}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error("Error al actualizar ejercicio:", error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleRemoveExerciseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    (async () => {
        try {
            await ExerciseStorageManager.removeExerciseData(pageId);
            await ExplanationStorageManager.removeExplanationData(pageId);

            console.log(`Datos de ejercicios y explicaciones eliminados para la página: ${pageId}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al eliminar datos:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleUpdateExerciseRole(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName, role } = request as { pageId: string; exerciseName: string; role: AIRole };

    (async () => {
        try {
            await ExerciseStorageManager.updateExerciseRole(pageId, exerciseName, role);
            console.log(`Rol actualizado para ${exerciseName}: ${role}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar rol del ejercicio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleRemoveChallengeExercisesExplanations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseNames } = request;

    (async () => {
        try {
            for (const exerciseName of exerciseNames) {
                try {
                    await ExplanationStorageManager.removeExplanation(pageId, exerciseName);
                    console.log(`Explicación eliminada para ejercicio de reto: ${exerciseName}`);
                } catch (removeError) {
                    console.log(`No había explicación guardada para: ${exerciseName}`, removeError);
                }
            }

            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al eliminar explicaciones de ejercicios de reto:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleUpdateLabVerbosity(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId, labId, verbosity } = request;

    (async () => {
        try {
            await LabStorageManager.updateLabVerbosity(courseId, labId, verbosity as VerbosityLevel);
            console.log(`Verbosidad actualizada para laboratorio ${labId}: ${verbosity}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar verbosidad del laboratorio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleUpdateLabReasoningEffort(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId, labId, reasoningEffort } = request;

    (async () => {
        try {
            await LabStorageManager.updateLabReasoningEffort(courseId, labId, reasoningEffort as ReasoningEffort);
            console.log(`Esfuerzo de razonamiento actualizado para laboratorio ${labId}: ${reasoningEffort}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar esfuerzo de razonamiento del laboratorio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetLabConfig(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId, labId } = request;

    (async () => {
        try {
            const labConfig = await LabStorageManager.getLabConfig(courseId, labId);
            if (labConfig) {
                console.log(`Configuración del laboratorio ${labId} recuperada`);
                sendResponse({ success: true, config: labConfig });
            } else {
                sendResponse({ success: false, error: 'No se encontró configuración para este laboratorio' });
            }
        } catch (error: any) {
            console.error('Error al obtener configuración del laboratorio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleSaveChatHistory(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName, chatHistory } = request;

    console.log(`Guardando historial de chat para: ${exerciseName}`);

    (async () => {
        try {
            await ExplanationStorageManager.updateChatHistory(pageId, exerciseName, chatHistory);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al guardar historial de chat:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

/**
 * Checks if the current user is a teacher.
 * @deprecated Use handleCheckUserRoleForCourse instead for better reliability
 */
export function handleCheckUserRole(request: any, sendResponse: (response?: any) => void): boolean {
    (async () => {
        try {
            // If courseId is provided in the request, use it directly
            if (request.courseId) {
                return handleCheckUserRoleForCourse(request, sendResponse);
            }

            // Otherwise, try to get courseId from cached course
            const course: Course = getCachedCourse();

            if (!course) {
                console.warn('[handleCheckUserRole] No se pudo determinar el curso, no se puede verificar el rol');
                sendResponse({ success: false, error: 'No se pudo determinar el curso', isTeacher: false });
                return;
            }

            // Delegate to handleCheckUserRoleForCourse with the courseId
            return handleCheckUserRoleForCourse({ courseId: course.id }, sendResponse);
        } catch (error: any) {
            console.error('[handleCheckUserRole] Error general al verificar rol del usuario:', error);
            sendResponse({ success: false, error: error.message, isTeacher: false });
        }
    })();

    return true;
}

export function handleUpdateLearningObjectives(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, learningObjectives } = request;
    (async () => {
        try {
            await ExerciseStorageManager.updateLearningObjectives(pageId, learningObjectives);
            console.log(`Learning objectives actualizados para página ${pageId}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar learning objectives:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}

export function handleUpdateExerciseContext(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseContext } = request;
    (async () => {
        try {
            await ExerciseStorageManager.updateExerciseContext(pageId, exerciseContext);
            console.log(`Contexto de ejercicios actualizado para página ${pageId}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar contexto de ejercicios:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}

export function handleUpdateConcepts(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, concepts } = request;
    (async () => {
        try {
            await ExerciseStorageManager.updateConcepts(pageId, concepts);
            console.log(`Conceptos actualizados para página ${pageId}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar conceptos:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}



/**
 * Fetches the user's course list from the eGela dashboard.
 */
export function handleGetUserCourses(_request: any, sendResponse: (response?: any) => void): boolean {
    (async () => {
        try {
            const courses = await getUserCourses();
            console.log(`[handleGetUserCourses] Found ${courses.length} courses`);
            sendResponse({ success: true, courses });
        } catch (error: any) {
            console.error('[handleGetUserCourses] Error:', error);
            const isSessionExpired = error.message?.includes('EgelaSessionExpired');
            sendResponse({
                success: false,
                error: error.message,
                isSessionExpired
            });
        }
    })();
    return true;
}

/**
 * Checks user role for a specific course with per-course caching.
 */
export function handleCheckUserRoleForCourse(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId } = request;

    (async () => {
        try {
            if (!courseId) {
                sendResponse({ success: false, error: 'courseId is required', isTeacher: false });
                return;
            }

            // In dev mode, check if we should force teacher role
            if (import.meta.env.DEV) {
                const devConfig = await ModeStorageManager.getDevModeConfig();
                if (devConfig.forceTeacherRole) {
                    console.log(`[handleCheckUserRoleForCourse] DEV MODE: Forcing teacher role for course ${courseId}`);
                    sendResponse({ success: true, isTeacher: true });
                    return;
                }
            }

            // Check per-course cache first
            const cachedRole = await ModeStorageManager.getUserRoleForCourse(courseId);
            if (cachedRole && cachedRole.isValid) {
                console.log(`[handleCheckUserRoleForCourse] Using cache for course ${courseId}: ${cachedRole.isTeacher ? 'Teacher' : 'Student'}`);
                sendResponse({ success: true, isTeacher: cachedRole.isTeacher });
                return;
            }

            // No valid cache, check role in Egela
            const isTeacher = await isUserTeacherInCourse(courseId);
            console.log(`[handleCheckUserRoleForCourse] User is teacher in course ${courseId}: ${isTeacher}`);

            // Cache the result
            await ModeStorageManager.saveUserRoleForCourse(courseId, isTeacher);

            sendResponse({ success: true, isTeacher });
        } catch (error: any) {
            console.error('[handleCheckUserRoleForCourse] Error:', error);
            const isSessionExpired = error.message?.includes('EgelaSessionExpired');
            sendResponse({
                success: false,
                error: error.message,
                isTeacher: false,
                isSessionExpired
            });
        }
    })();
    return true;
}

/**
 * Persists a Refiner session (chat history + latest draft) so the student can
 * close the modal and continue later.
 */
export function handleSaveRefinerHistory(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName, chatHistory, latestDraft } = request;

    (async () => {
        try {
            await RefinerStorageManager.saveSession(pageId, exerciseName, chatHistory ?? [], latestDraft);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al guardar sesión Refiner:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

/**
 * Loads a previously persisted Refiner session for an exercise.
 * Returns { session: null } if there's no saved session yet.
 */
export function handleGetRefinerHistory(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName } = request;

    (async () => {
        try {
            const session = await RefinerStorageManager.getSession(pageId, exerciseName);
            sendResponse({ success: true, session });
        } catch (error: any) {
            console.error('Error al cargar sesión Refiner:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}