import { AgentConfig } from "../util/ai/AgentConfig";
import { CourseAgent } from "../util/ai/CourseAgent";
import { EvaluationAgent } from "../util/ai/EvaluationAgent";
import { ExerciseAgent } from "../util/ai/ExerciseAgent";
import { ExplanationAgent } from "../util/ai/ExplanationAgent";
import { RefinerAgent } from "../util/ai/RefinerAgent";
import { AgentConfigStorageManager } from "../util/storage/AgentConfigStorageManager";
import { getCachedCourse } from "./handlers/dataHandlers";

let isConfigLoaded = false;
let agentsConfig: AgentConfig;
let courseAgent: CourseAgent;
let exerciseAgent: ExerciseAgent;
let explanationAgent: ExplanationAgent;
let evaluationAgent: EvaluationAgent;
let refinerAgent: RefinerAgent;

export async function initializeAgents(courseId?: string): Promise<void> {
    agentsConfig = await AgentConfigStorageManager.loadConfig(courseId);

    courseAgent = new CourseAgent(agentsConfig);
    exerciseAgent = new ExerciseAgent(agentsConfig);
    explanationAgent = new ExplanationAgent(agentsConfig);
    evaluationAgent = new EvaluationAgent(agentsConfig);
    refinerAgent = new RefinerAgent(agentsConfig);

    console.log(`Agentes inicializados con configuración${courseId ? ` del curso ${courseId}` : ''}`);
}

export function getCourseAgent(): CourseAgent {
    if (!courseAgent) {
        throw new Error("El agente de cursos no ha sido inicializado");
    }
    return courseAgent;
}

export function getExerciseAgent(): ExerciseAgent {
    if (!exerciseAgent) {
        throw new Error("El agente de ejercicios no ha sido inicializado");
    }
    return exerciseAgent;
}

export function getExplanationAgent(): ExplanationAgent {
    if (!explanationAgent) {
        throw new Error("El agente de explicaciones no ha sido inicializado");
    }
    return explanationAgent;
}

export function getEvaluationAgent(): EvaluationAgent {
    if (!evaluationAgent) {
        throw new Error("El agente de evaluaciones no ha sido inicializado");
    }
    return evaluationAgent;
}

export function getRefinerAgent(): RefinerAgent {
    if (!refinerAgent) {
        throw new Error("El agente de refinamiento no ha sido inicializado");
    }
    return refinerAgent;
}

export function markConfigLoaded(): void {
    isConfigLoaded = true;
}

export function resetConfigLoaded(): void {
    isConfigLoaded = false;
}

export function isConfigReady(): boolean {
    return isConfigLoaded;
}

/**
 * Creates a new ExerciseAgent instance for parallel context generation
 * Each instance has its own OpenAIService to allow parallel API calls
 */
export function createExerciseAgent(): ExerciseAgent {
    if (!agentsConfig) {
        throw new Error("Agent config not loaded");
    }
    const agent = new ExerciseAgent(agentsConfig);
    let cachedCourse = getCachedCourse();
    if (cachedCourse) {
        agent.setCourse(cachedCourse);
    }
    return agent;
}

export function getAgentsConfig(): AgentConfig {
    if (!agentsConfig) {
        throw new Error("Agent config not loaded");
    }
    return agentsConfig;
}
