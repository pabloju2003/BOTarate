/**
 * Configuration for a specific agent
 * Defines variables to be substituted in prompt templates
 */
export interface AgentConfig {

    /**
     * Variables for exercise identification agent
     */
    exerciseAgent: {
        role: string;
        contextDescription: string;
        conceptsFieldDescription: string;
        conceptsExamples: string;
        exerciseCriteria: string;
        excludedExercises: string;
        learningObjectivesGuidance: string;

    };

    /**
     * Variables for evaluation agent
     */
    evaluationAgent: {
        role: string;
        taskDescription: string;
        evaluationCriteria: string;
        scoringScale: string;
        feedbackFormat: string;
        importantNotes?: string;
    };

    /**
     * Variables for explanation/tutorial agent
     */
    explanationAgent: {
        role: string;
        taskDescription: string;
        methodology: string;
        outputFormat: string;
        additionalRules?: string;
        importantNotes?: string;
        /** Configuration describing the type of intentional mistakes the LLM should make for picky exercises */
        pickyExerciseConfiguration?: string;
    };

    /**
     * Variables for refiner agent (iterative draft refinement)
     */
    refinerAgent?: {
        role: string;
        taskDescription: string;
        evaluationGuidelines: string;
        importantNotes?: string;
    };

    /**
     * Common configuration for all agents
     */
    common: {
        courseName: string;
        platformName: string;
        institutionName: string;
        /** Teacher's name for personalized references */
        teacherName: string;
        /** Common expressions/tics the teacher uses (e.g., "¿Sí con esto?", "¿Entendido?") */
        teacherTics: string;
    };
}