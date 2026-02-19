import { AgentConfig } from "./AgentConfig";
import { BaseAgent } from "./BaseAgent";
import { EvaluationSchema, EvaluationSchemaType } from "./schemas";

export { EvaluationAgent };

/**
 * Agente especializado en evaluar soluciones de ejercicios
 */
class EvaluationAgent extends BaseAgent {

    private static readonly TOOLS = [];

    constructor(config: AgentConfig) {
        super(config, EvaluationAgent.TOOLS);
    }

    /**
     * Evaluates a solution proposed by the student for an exercise
     * @param exerciseName - Exercise name
     * @param exerciseStatement - Complete exercise statement
     * @param studentSolution - Solution proposed by the student
     * @param exerciseContext - Additional exercise context (e.g., DB schema, specifications)
     * @param concepts - Concepts worked on the page (optional)
     * @param learningObjectives - Learning objectives of the page (optional)
     * @returns Structured evaluation with score and feedback
     */
    async evaluateSolution(
        exerciseName: string,
        exerciseStatement: string,
        studentSolution: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string
    ): Promise<EvaluationSchemaType> {
        console.log(`[evaluateSolution] Evaluating solution for: ${exerciseName}`);

        const agentConfig = this.config.evaluationAgent;

        // Build pedagogical context
        const pedagogicalContext = concepts && concepts.length > 0
            ? `- This exercise works on the following concepts: ${concepts.join(', ')}`
            : '';
        const objectivesContext = learningObjectives
            ? `- Learning objectives: ${learningObjectives}`
            : '';
        const considerObjectives = concepts || learningObjectives
            ? '- Consider these objectives when evaluating if the student uses appropriate techniques.'
            : '';

        // Generic system prompt template
        const systemPromptTemplate = `You are an expert tutor that evaluates exercise solutions provided by students. Specifically: {role}.

Your task is {taskDescription}

EVALUATION CRITERIA:

{evaluationCriteria}

SCORING SCALE:
{scoringScale}

FEEDBACK FORMAT:
{feedbackFormat}
{contextNote}

PEDAGOGICAL CONTEXT:
{pedagogicalContext}
{objectivesContext}
{considerObjectives}

{teacherPersonalization}

IMPORTANT:
{importantNotes}`;

        const systemPromptVariables = {
            role: agentConfig.role,
            taskDescription: agentConfig.taskDescription,
            evaluationCriteria: agentConfig.evaluationCriteria,
            scoringScale: agentConfig.scoringScale,
            feedbackFormat: agentConfig.feedbackFormat,
            contextNote: exerciseContext ? '- You can use the exercise context and example data to illustrate problems' : '',
            pedagogicalContext: pedagogicalContext,
            objectivesContext: objectivesContext,
            considerObjectives: considerObjectives,
            teacherPersonalization: this.buildTeacherPersonalization(),
            importantNotes: agentConfig.importantNotes || ''
        };

        const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

        const userPrompt = `Please evaluate the following solution proposed by a student:

**Exercise: ${exerciseName}**

${exerciseStatement}

${exerciseContext ? `**Exercise context:**\n\`\`\`\n${exerciseContext}\n\`\`\`` : ''}

**Student solution:**
\`\`\`
${studentSolution}
\`\`\`

Provide a complete evaluation with score and detailed feedback.`;

        try {
            // Reset history for this specific call
            this.openAIService.resetConversation();

            // Use the function that allows structured responses
            const response: any = await this.openAIService.generateStructuredResponse(
                EvaluationSchema,
                "evaluation",
                userPrompt,
                systemPrompt
            );

            console.log(`[evaluateSolution] Evaluation generated with score: ${response.score}/10`);
            return response;

        } catch (error) {
            console.error(`[evaluateSolution] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error evaluating solution: ${error.message}`);
            }
            throw new Error('Unknown error evaluating solution');
        }
    }
}