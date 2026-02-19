import { t } from "../../i18n/backend";
import { EvaluationStorageManager } from "../../util/storage/EvaluationStorageManager";
import { ExerciseStorageManager } from "../../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../../util/storage/ExplanationStorageManager";
import { LabStorageManager } from "../../util/storage/LabStorageManager";
import { getCourseAgent, getEvaluationAgent, getExplanationAgent } from "../context";

/**
 * Builds a summary of the student's progress across all labs in the course.
 * Used to provide context to the LLM about what the student has already completed.
 */
async function buildProgressSummary(courseId?: string): Promise<string | undefined> {
    if (!courseId) {
        return undefined;
    }

    const labData = await LabStorageManager.getLabData(courseId);
    const labs = labData?.labs;
    if (!labs || labs.length === 0) {
        return undefined;
    }

    const completedExercises: Map<string, string[]> = new Map();

    for (const lab of labs) {
        const exerciseData = await ExerciseStorageManager.getExerciseData(lab.id);
        if (!exerciseData) continue;

        const completedInLab: string[] = [];
        for (const exercise of exerciseData.exercises) {
            const evaluations = await EvaluationStorageManager.getEvaluations(lab.id, exercise.name);
            if (evaluations && evaluations.length > 0) {
                const bestScore = Math.max(...evaluations.map((e: any) => e.score));
                if (bestScore >= 5) {
                    completedInLab.push(exercise.name);
                }
            }
        }

        if (completedInLab.length > 0) {
            completedExercises.set(lab.name, completedInLab);
        }
    }

    if (completedExercises.size === 0) {
        return t("llmPrompts.progressSummary.noProgress") + "\n";
    }

    let summary = `- ${t("llmPrompts.progressSummary.completedExercises")}:\n`;
    for (const [labName, exercises] of completedExercises) {
        summary += `  * ${labName}: ${exercises.join(", ")}\n`;
    }

    return summary;
}

export function handleGenerateResponse(request: any, sendResponse: (response?: any) => void): boolean {
    const { userMessage, resetHistory, exercises } = request;
    const courseAgent = getCourseAgent();

    console.log("Generando respuesta LLM en background...");

    courseAgent.generateResponse(userMessage, resetHistory, exercises)
        .then(finalResponse => sendResponse(finalResponse))
        .catch(error => {
            console.error('Error en generateResponse:', error);
            sendResponse(`Error: ${error.message}`);
        });

    return true;
}

export function handleGenerateExplanation(request: any, sendResponse: (response?: any) => void): boolean {
    const { exerciseName, pageId, courseId } = request;
    const explanationAgent = getExplanationAgent();

    console.log(`Generando explicación para ejercicio: ${exerciseName}`);

    (async () => {
        try {
            const exerciseData = await ExerciseStorageManager.getExerciseData(pageId);
            if (exerciseData) {
                const exercise = exerciseData.exercises.find(ex => ex.name === exerciseName);
                if (exercise?.allowed === false) {
                    console.log(`Intento de explicar ejercicio bloqueado: ${exerciseName}`);
                    sendResponse({
                        success: false,
                        error: t("errors.exerciseBlocked", { exerciseName: exerciseName }),
                    });
                    return;
                }
                const progressSummary = await buildProgressSummary(courseId);

                // Get accumulated concepts from current and previous required labs
                const accumulatedConcepts = courseId
                    ? await ExerciseStorageManager.getAccumulatedConcepts(courseId, pageId)
                    : exerciseData?.concepts;

                // Cargar configuración del laboratorio actual (pageId es el labId)
                let responseOptions = undefined;
                if (courseId) {
                    const labConfig = await LabStorageManager.getLabConfig(courseId, pageId);
                    if (labConfig) {
                        responseOptions = {
                            verbosity: labConfig.verbosity,
                            reasoningEffort: labConfig.reasoningEffort,
                        };
                        console.log(
                            `Configuración del laboratorio cargada: verbosity=${labConfig.verbosity}, reasoning=${labConfig.reasoningEffort}`,
                        );
                    }
                }

                // Check if the exercise is marked as picky
                const isPicky = exercise?.isPicky === true;
                if (isPicky) {
                    console.log(`Ejercicio ${exerciseName} marcado como picky - se introducirán errores intencionales`);
                }

                const explanation = await explanationAgent.generateExplanation(
                    exerciseName,
                    exercise?.statement || "",
                    exerciseData?.exerciseContext,
                    accumulatedConcepts,
                    exerciseData?.learningObjectives,
                    progressSummary,
                    pageId,
                    responseOptions,
                    isPicky,
                );

                console.log(`Explicación generada:`, explanation);

                await ExplanationStorageManager.saveExplanation(
                    pageId,
                    exerciseName,
                    exercise?.statement || "",
                    explanation,
                    exerciseData.exerciseContext,
                );
                console.log(`Explicación guardada en cache para: ${exerciseName}`);

                sendResponse({ success: true, explanation: explanation });
            } else {
                sendResponse({
                    success: false,
                    error: t("errors.loadingExercise", { exerciseName: exerciseName }),
                });
            }
        } catch (error: any) {
            console.error('Error en generateExplanation:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleEvaluateSolution(request: any, sendResponse: (response?: any) => void): boolean {
    const { exerciseName, exerciseStatement, studentSolution, exercise_context, learning_objectives, pageId, courseId } = request;
    const evaluationAgent = getEvaluationAgent();

    console.log(`Evaluando solución para ejercicio: ${exerciseName}`);

    (async () => {
        try {
            // Get accumulated concepts from current and previous required labs
            let accumulatedConcepts: string[] | undefined;
            if (courseId && pageId) {
                accumulatedConcepts = await ExerciseStorageManager.getAccumulatedConcepts(courseId, pageId);
            }

            const evaluation = await evaluationAgent.evaluateSolution(
                exerciseName,
                exerciseStatement,
                studentSolution,
                exercise_context,
                accumulatedConcepts,
                learning_objectives
            );

            console.log(`Solución evaluada con puntuación: ${evaluation.score}/10`);

            if (pageId) {
                await EvaluationStorageManager.saveEvaluation(
                    pageId,
                    exerciseName,
                    exerciseStatement,
                    studentSolution,
                    evaluation
                );
                console.log(`Evaluación guardada en storage para: ${exerciseName}`);
            }

            sendResponse({ success: true, evaluation: evaluation });
        } catch (error: any) {
            console.error('Error en evaluateSolution:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleLoadChatHistory(sendResponse: (response?: any) => void): boolean {
    const courseAgent = getCourseAgent();
    console.log('Cargando historial de chat...');

    (async () => {
        try {
            const messages = await courseAgent.loadChatHistory();
            sendResponse({ success: true, messages });
        } catch (error: any) {
            console.error('Error al cargar historial de chat:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleResetChatHistory(sendResponse: (response?: any) => void): boolean {
    const courseAgent = getCourseAgent();
    console.log('Reiniciando historial de chat...');

    (async () => {
        try {
            await courseAgent.resetChatHistory();
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al reiniciar historial de chat:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleInitializeExplanationChat(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName, courseId, fromCache } = request;
    const explanationAgent = getExplanationAgent();

    console.log(`Inicializando chat de explicación para: ${exerciseName} (fromCache: ${fromCache})`);

    (async () => {
        try {
            if (fromCache) {
                const explanation = await ExplanationStorageManager.getExplanation(pageId, exerciseName);

                if (!explanation) {
                    sendResponse({ success: false, error: t("errors.loadingExplanation") });
                    return;
                }

                const exerciseData = await ExerciseStorageManager.getExerciseData(pageId);
                let concepts: string[] | undefined = undefined;
                let learningObjectives: string | undefined = undefined;
                let isPicky = false;

                if (exerciseData) {
                    concepts = exerciseData.concepts;
                    learningObjectives = exerciseData.learningObjectives;
                    // Check if the exercise is marked as picky
                    const exercise = exerciseData.exercises.find(ex => ex.name === exerciseName);
                    isPicky = exercise?.isPicky === true;
                }

                const progressSummary = await buildProgressSummary(courseId);

                // Convertir el chatHistory al formato correcto para el agente
                const chatHistoryForAgent = explanation.chatHistory?.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

                await explanationAgent.initializeContextForFollowUp(
                    explanation.exerciseName,
                    explanation.exerciseStatement,
                    { steps: explanation.steps },
                    explanation.exerciseContext,
                    concepts,
                    learningObjectives,
                    progressSummary,
                    chatHistoryForAgent,
                    pageId,
                    isPicky
                );

                console.log(`Contexto de chat inicializado desde storage para: ${exerciseName}${isPicky ? ' (picky mode)' : ''}`);
                sendResponse({ success: true });
            } else {
                console.log(`Contexto de chat ya inicializado para explicación recién generada: ${exerciseName}`);
                sendResponse({ success: true });
            }
        } catch (error: any) {
            console.error('Error al inicializar chat de explicación:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

async function restoreExplanationContext(
    pageId: string,
    exerciseName: string,
    courseId?: string,
    chatHistory?: Array<{ role: string; content: string }>
): Promise<void> {
    const explanationAgent = getExplanationAgent();
    const explanation = await ExplanationStorageManager.getExplanation(pageId, exerciseName);

    if (!explanation) {
        throw new Error(t("errors.loadingExplanation"));
    }

    const exerciseData = await ExerciseStorageManager.getExerciseData(pageId);
    let concepts: string[] | undefined = undefined;
    let learningObjectives: string | undefined = undefined;
    let isPicky = false;

    if (exerciseData) {
        concepts = exerciseData.concepts;
        learningObjectives = exerciseData.learningObjectives;
        const exercise = exerciseData.exercises.find(ex => ex.name === exerciseName);
        isPicky = exercise?.isPicky === true;
    }

    const progressSummary = await buildProgressSummary(courseId);

    const safeChatHistory = (chatHistory || explanation.chatHistory || [])
        .filter(msg => (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string")
        .map(msg => ({ role: msg.role, content: msg.content }));

    await explanationAgent.initializeContextForFollowUp(
        explanation.exerciseName,
        explanation.exerciseStatement,
        { steps: explanation.steps },
        explanation.exerciseContext,
        concepts,
        learningObjectives,
        progressSummary,
        safeChatHistory,
        pageId,
        isPicky
    );
}

export function handleSendExplanationChatMessage(request: any, sendResponse: (response?: any) => void): boolean {
    const { message, pageId, exerciseName, courseId, chatHistory } = request;
    const explanationAgent = getExplanationAgent();

    console.log(`Procesando mensaje de chat de explicación: ${message}`);

    (async () => {
        try {
            if (pageId && exerciseName) {
                await restoreExplanationContext(pageId, exerciseName, courseId, chatHistory);
            }

            const response = await explanationAgent.continueConversation(message);
            sendResponse({ success: true, response });
        } catch (error: any) {
            console.error('Error al procesar mensaje de chat de explicación:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}