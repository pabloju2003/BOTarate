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
{importantNotes}

{responseLengthConstraints}`;

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
            importantNotes: agentConfig.importantNotes || '',
            responseLengthConstraints: `RESPONSE LENGTH CONSTRAINTS:
- Keep feedback to 3-4 sentences per error found.
- Do NOT repeat the student's solution back to them — they can see it.
- Do NOT add encouraging filler — go straight to the evaluation.
- If the solution is correct, say so briefly (1-2 sentences) with the score.
- Focus on the most important errors first.`
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
                systemPrompt,
                undefined,
                { maxTokens: 1000 }
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

    /**
     * Evaluates only the syntactic correctness of a student's solution.
     * It does not assess whether the solution solves the exercise logically/semantically.
     */
    async evaluateSyntaxOnly(
        exerciseName: string,
        exerciseStatement: string,
        studentSolution: string,
        exerciseContext?: string
    ): Promise<EvaluationSchemaType> {
        console.log(`[evaluateSyntaxOnly] Evaluating syntax for: ${exerciseName}`);

        const systemPrompt = `Eres un revisor de sintaxis. Tu ÚNICA tarea es identificar errores de sintaxis en la solución del alumno (paréntesis sin cerrar, comillas mal puestas, comas que faltan, palabras clave mal escritas, orden incorrecto de cláusulas).
NO evalúes si la solución resuelve correctamente el enunciado.
NO evalúes la lógica ni la semántica.
Solo sintaxis.

Devuelve SIEMPRE una evaluación estructurada con:
- score: puntuación de 0 a 10 basada SOLO en corrección sintáctica.
  - 10 si no hay errores de sintaxis.
  - Menor que 10 según número/gravedad de errores sintácticos.
- feedback: explicación clara de los errores sintácticos encontrados y cómo corregirlos.

No incluyas valoración funcional del resultado ni comentarios sobre si cumple el objetivo del ejercicio.

RESTRICCIONES DE LONGITUD:
- Máximo 2-3 frases por error sintáctico encontrado.
- NO repitas el código del alumno — solo identifica el error y cómo corregirlo.
- Si no hay errores de sintaxis, dilo en una frase con puntuación 10.
- Sé directo y técnico — sin frases de ánimo ni relleno.`;

        const userPrompt = `Revisa SOLO la sintaxis de la siguiente solución propuesta por un alumno:

**Ejercicio: ${exerciseName}**

${exerciseStatement}

${exerciseContext ? `**Contexto del ejercicio:**\n\`\`\`\n${exerciseContext}\n\`\`\`` : ''}

**Solución del alumno:**
\`\`\`
${studentSolution}
\`\`\`

Evalúa exclusivamente la sintaxis y devuelve score + feedback.`;

        try {
            this.openAIService.resetConversation();

            const response: any = await this.openAIService.generateStructuredResponse(
                EvaluationSchema,
                "evaluation",
                userPrompt,
                systemPrompt,
                undefined,
                { maxTokens: 1000 }
            );

            console.log(`[evaluateSyntaxOnly] Syntax evaluation generated with score: ${response.score}/10`);
            return response;
        } catch (error) {
            console.error(`[evaluateSyntaxOnly] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error evaluating syntax: ${error.message}`);
            }
            throw new Error('Unknown error evaluating syntax');
        }
    }
}