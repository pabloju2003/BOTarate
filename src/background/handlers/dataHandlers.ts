import { t } from "../../i18n/backend";
import type { Lab } from "../../types/shared";
import { Course } from "../../util/egela/Course";
import { Exercise } from "../../util/egela/Exercise";
import { EvaluationStorageManager } from "../../util/storage/EvaluationStorageManager";
import { ExerciseStorageManager } from "../../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../../util/storage/ExplanationStorageManager";
import { LabStorageManager } from "../../util/storage/LabStorageManager";
import { createExerciseAgent, getCourseAgent, getEvaluationAgent, getExerciseAgent, getExplanationAgent, initializeAgents } from "../context";

let cachedCourse: Course;

export function handleGetCourseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { href, sessionStorageData } = request;

    Course.fromHrefAndStorage(href, sessionStorageData)
        .then(async course => {
            if (course) {
                cachedCourse = course;

                // Re-initialize agents with course-specific config
                await initializeAgents(course.id);

                const courseAgent = getCourseAgent();
                const exerciseAgent = getExerciseAgent();
                const explanationAgent = getExplanationAgent();
                const evaluationAgent = getEvaluationAgent();

                courseAgent.setCourse(course);
                exerciseAgent.setCourse(course);
                explanationAgent.setCourse(course);
                evaluationAgent.setCourse(course);

                await courseAgent.loadChatHistory();
                await initializeLabDataIfNeeded(course, href);

                sendResponse({ success: true, course: course });
                console.log('[background] Curso cargado:', course);
            } else {
                sendResponse({ success: false, error: t('errors.loadingCourse') });
                console.log('[background] No se pudo crear el curso desde href y storage');
            }
        })
        .catch(error => {
            console.error('[background] Error al cargar curso:', error);
            sendResponse({ success: false, error: error.message });
        });

    return true;
}

function extractLabsFromCourse(course: Course): Lab[] {
    const labs: Lab[] = [];

    for (const section of course.sections) {
        const pageResources = section.getResourcesByType('page');
        for (const resource of pageResources) {
            labs.push({
                id: resource.id,
                name: resource.name,
                sectionId: section.id
            });
        }
    }

    return labs;
}

export function getCachedCourse(): Course {
    return cachedCourse;
}

export function handleGetExerciseList(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, resourceId, forceRefresh } = request;
    const exerciseAgent = getExerciseAgent();

    console.log(`Identificando ejercicios en página: ${pageId}, recurso: ${resourceId || 'N/A'}, forceRefresh: ${!!forceRefresh}`);

    (async () => {
        try {
            if (!forceRefresh) {
                const cachedData = await ExerciseStorageManager.getExerciseData(pageId);

                if (cachedData) {
                    console.log(`Ejercicios recuperados del storage (${cachedData.exercises.length} ejercicios)`);

                    const exercises = cachedData.exercises.map(
                        (ex: { name: string; statement: string; allowed?: boolean }) =>
                            new Exercise(ex.name, ex.statement, ex.allowed ?? true)
                    );

                    sendResponse({
                        success: true,
                        exercises: exercises,
                        exerciseContext: cachedData.exerciseContext,
                        concepts: cachedData.concepts,
                        learningObjectives: cachedData.learningObjectives,
                        fromCache: true
                    });
                    return;
                }
            }

            console.log(forceRefresh ? 'Forzando re-identificación...' : 'No hay datos en cache, llamando al agente...');
            const result = await exerciseAgent.identifyExercises(pageId, resourceId);

            console.log('Ejercicios identificados:', result.exercises);
            console.log('Exercise Context presente:', !!result.exerciseContext);
            console.log('Conceptos:', result.concepts);
            console.log('Objetivos de aprendizaje:', result.learningObjectives);

            sendResponse({
                success: true,
                exercises: result.exercises,
                exercise_context: result.exerciseContext,
                concepts: result.concepts,
                learning_objectives: result.learningObjectives,
                fromCache: false
            });
        } catch (error: any) {
            console.error('Error en getExerciseList:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetCachedExplanation(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName } = request;

    console.log(`Recuperando explicación del cache para: ${exerciseName}`);

    (async () => {
        try {
            const cachedExplanation = await ExplanationStorageManager.getExplanation(pageId, exerciseName);

            if (cachedExplanation) {
                console.log(`Explicación recuperada del cache para: ${exerciseName}`);
                sendResponse({ success: true, explanation: cachedExplanation });
            } else {
                sendResponse({ success: false, error: 'No hay explicación guardada para este ejercicio' });
            }
        } catch (error: any) {
            console.error('Error al recuperar explicación del cache:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetExercisesWithExplanations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    console.log(`Obteniendo lista de ejercicios con explicaciones para: ${pageId}`);

    (async () => {
        try {
            const exerciseNames = await ExplanationStorageManager.getExerciseNamesWithExplanations(pageId);
            console.log(`Encontrados ${exerciseNames.length} ejercicios con explicaciones`);
            sendResponse({ success: true, exerciseNames: exerciseNames });
        } catch (error: any) {
            console.error('Error al obtener ejercicios con explicaciones:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetExerciseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    (async () => {
        try {
            const data = await ExerciseStorageManager.getExerciseData(pageId);
            if (data) {
                sendResponse({ success: true, data: data });
            } else {
                sendResponse({ success: false, error: 'No hay datos para esta página' });
            }
        } catch (error: any) {
            console.error('Error al obtener datos de ejercicios:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetAccumulatedConcepts(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId, pageId } = request;

    (async () => {
        try {
            const concepts = await ExerciseStorageManager.getAccumulatedConcepts(courseId, pageId);
            sendResponse({ success: true, concepts: concepts });
        } catch (error: any) {
            console.error('Error al obtener concepts acumulados:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetLabData(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId } = request;

    (async () => {
        try {
            const data = await LabStorageManager.getLabData(courseId);
            if (data) {
                sendResponse({ success: true, data: data });
            } else {
                sendResponse({ success: false, error: 'No hay datos de laboratorios para este curso' });
            }
        } catch (error: any) {
            console.error('Error al obtener datos de laboratorios:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetExercisesWithEvaluations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    console.log(`Obteniendo lista de ejercicios con evaluaciones para: ${pageId}`);

    (async () => {
        try {
            const exerciseNames = await EvaluationStorageManager.getExerciseNamesWithEvaluations(pageId);
            console.log(`Encontrados ${exerciseNames.length} ejercicios con evaluaciones`);
            sendResponse({ success: true, exerciseNames: exerciseNames });
        } catch (error: any) {
            console.error('Error al obtener ejercicios con evaluaciones:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetEvaluations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName } = request;

    console.log(`Recuperando evaluaciones para: ${exerciseName}`);

    (async () => {
        try {
            const evaluations = await EvaluationStorageManager.getEvaluations(pageId, exerciseName);

            if (evaluations.length > 0) {
                console.log(`Recuperadas ${evaluations.length} evaluaciones para: ${exerciseName}`);
                sendResponse({ success: true, evaluations: evaluations });
            } else {
                sendResponse({ success: false, error: 'No hay evaluaciones guardadas para este ejercicio' });
            }
        } catch (error: any) {
            console.error('Error al recuperar evaluaciones:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

async function initializeLabDataIfNeeded(course: Course, href: string): Promise<void> {
    const currentLabs = extractLabsFromCourse(course);

    if (currentLabs.length === 0) {
        console.log('[background] No se encontraron laboratorios (recursos tipo "page")');
        return;
    }

    const savedData = await LabStorageManager.getLabData(course.id);

    if (!savedData) {
        await LabStorageManager.saveLabData(course.id, currentLabs);
        console.log(`[background] ${currentLabs.length} laboratorios guardados:`, currentLabs);
        return;
    }

    const isCourseViewPage = href.includes('egela.ehu.eus/course/view.php?id=');
    if (!isCourseViewPage) {
        console.log('[background] Ya existen datos de laboratorios para este curso');
        return;
    }

    const existingLabIds = new Set(savedData.labs.map(lab => lab.id));
    const newLabs = currentLabs.filter(lab => !existingLabIds.has(lab.id));

    if (newLabs.length === 0) {
        console.log('[background] No hay laboratorios nuevos para añadir');
        return;
    }

    const mergedLabs = [...savedData.labs, ...newLabs];
    await LabStorageManager.saveLabData(course.id, mergedLabs);
    console.log(`[background] ${newLabs.length} laboratorios nuevos añadidos:`, newLabs);
}

/**
 * Handles generating context for a specific lab using a new ExerciseAgent instance
 * This allows parallel context generation for multiple labs
 */
export function handleGenerateLabContext(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, courseId } = request;

    console.log(`[handleGenerateLabContext] Generating context for lab: ${pageId}, course: ${courseId}`);

    (async () => {
        try {
            // Load the course-specific agent configuration
            if (courseId) {
                await initializeAgents(courseId);
            }

            // Create a new ExerciseAgent instance for this specific generation
            // This allows parallel generation without sharing state
            const exerciseAgent = createExerciseAgent();

            const result = await exerciseAgent.identifyExercises(pageId);

            console.log(`[handleGenerateLabContext] Context generated for ${pageId}:`, {
                exercises: result.exercises.length,
                hasContext: !!result.exerciseContext,
                concepts: result.concepts?.length || 0
            });

            sendResponse({
                success: true,
                exercises: result.exercises,
                exerciseContext: result.exerciseContext,
                concepts: result.concepts,
                learningObjectives: result.learningObjectives,
            });
        } catch (error: any) {
            console.error(`[handleGenerateLabContext] Error generating context for ${pageId}:`, error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}
