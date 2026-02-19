import { AgentConfig } from "./AgentConfig";
import { BaseAgent } from "./BaseAgent";
import { ResponseOptions } from "./OpenAIService";
import { ExplanationSchema, ExplanationSchemaType } from "./schemas";
import { TOOLS } from "./Tools";

export { ExplanationAgent };

/**
 * Agente especializado en generar explicaciones tutoriales para ejercicios
 */
class ExplanationAgent extends BaseAgent {

    private static readonly TOOLS = [
        'getPageContent',
        'getFilteredFileContent',
        'analyzeImage'
    ];

    constructor(config: AgentConfig) {
        super(config, ExplanationAgent.TOOLS);
    }

    /**
     * Builds common pedagogical context for prompts
     */
    private buildPedagogicalContext(
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string
    ): { conceptsContext: string; objectivesContext: string; alignmentNote: string; progressContext: string } {
        const progressContext = progressSummary
            ? `STUDENT PROGRESS:\n${progressSummary}\nCONSIDERATIONS:\n- Reduce verbosity for concepts the student has already worked on in completed labs/exercises.\n- You can assume familiarity with basic concepts from completed labs.\n- Focus on new or more advanced aspects of the current exercise.`
            : '';

        const conceptsContext = concepts && concepts.length > 0
            ? `- This exercise works on the following concepts: ${concepts.join(', ')}`
            : '';

        const objectivesContext = learningObjectives
            ? `- Learning objectives of the page: ${learningObjectives}`
            : '';

        const alignmentNote = concepts || learningObjectives
            ? '- Ensure your explanation aligns with these learning objectives and focuses especially on the mentioned concepts.'
            : '';

        return { conceptsContext, objectivesContext, alignmentNote, progressContext };
    }

    /**
     * Guide for using tools that access lab content only when the student requests it
     */
    private buildLabContentToolsNote(): string {
        return `- Use these tools only if the student asks for examples or concrete data present in the lab content (e.g., INSERT rows, diagrams).
- Try to filter as much as possible to return only what is strictly relevant.
- getPageContent(pageId): retrieves lab page content to locate file markers [FILEx:TEXT:name.sql] and image markers [IMAGE#].
- getFilteredFileContent(pageId, fileId, regexPattern): extracts only necessary sections from text files. Use a regex pattern to filter specific content (e.g., function definitions, data declarations, or structural elements relevant to the exercise).
- analyzeImage(pageId, imageId, prompt): analyzes images in the page (marked as [IMAGE#] or [IMAGE#: description]). Use it to extract information from diagrams, ER schemas, screenshots, etc. Provide a clear prompt describing what you need from the image.
- You must always call getPageContent first to identify available files/images and their IDs before using getFilteredFileContent or analyzeImage.`;
    }

    /**
     * Builds the system prompt for explanations (shared between generateExplanation and initializeContextForFollowUp)
     */
    private buildExplanationSystemPrompt(
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        pageId?: string,
        isPicky?: boolean
    ): string {
        const agentConfig = this.config.explanationAgent;
        const pedagogicalContext = this.buildPedagogicalContext(concepts, learningObjectives, progressSummary);

        // Build picky exercise instructions if applicable
        const pickyInstructions = isPicky ? this.buildPickyExerciseInstructions() : '';

        const systemPromptTemplate = `You are an expert tutor that solves exercises for students. Specifically: {role}.
Your task is {taskDescription}

METHODOLOGY:

{methodology}

OUTPUT FORMAT:
{outputFormat}
{contextNote}
{additionalRules}

LAB CONTENT TOOLS (use only if the student requests it):
{labContentToolsNote}

{pageIdNote}

PEDAGOGICAL CONTEXT:
{conceptsContext}
{objectivesContext}
{alignmentNote}

{progressContext}

{teacherPersonalization}

{languageInstruction}

{importantNotes}

{pickyInstructions}`;

        const systemPromptVariables = {
            role: agentConfig.role,
            taskDescription: agentConfig.taskDescription,
            methodology: agentConfig.methodology,
            outputFormat: agentConfig.outputFormat,
            contextNote: exerciseContext ? '- Include concrete examples using the provided exercise context.' : '',
            additionalRules: agentConfig.additionalRules || '',
            labContentToolsNote: this.buildLabContentToolsNote(),
            pageIdNote: pageId ? `Page ID: ${pageId}\n- Use this ID as the value for the 'pageId' parameter when calling getPageContent or getFilteredFileContent.` : '',
            ...pedagogicalContext,
            teacherPersonalization: this.buildTeacherPersonalization(),
            languageInstruction: this.buildLanguageInstruction(),
            importantNotes: agentConfig.importantNotes || '',
            pickyInstructions: pickyInstructions
        };

        return this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);
    }

    /**
     * Builds the instructions for picky exercises that require intentional mistakes
     */
    private buildPickyExerciseInstructions(): string {
        const agentConfig = this.config.explanationAgent;
        const pickyConfig = agentConfig.pickyExerciseConfiguration || '';

        return `CRITICAL - PICKY EXERCISE MODE:
This is a "picky" exercise designed to train the student in critically reviewing AI-generated content.

INSTRUCTIONS FOR THIS EXERCISE:
1. You MUST intentionally introduce one or more subtle mistakes in your explanation.
2. The mistakes should be plausible enough that they require careful review to detect.
3. NEVER mention in the explanation that there are intentional mistakes or that the student should look for errors. The explanation should be presented as if it were completely correct.
5. Act completely naturally as if you were providing a correct explanation.

${pickyConfig ? `SPECIFIC MISTAKE GUIDELINES FROM TEACHER (may override previous instructions):\n${pickyConfig}\n` : ''}

IF THE STUDENT IDENTIFIES A MISTAKE:
- Acknowledge and congratulate them for finding the error.
- Explain why it was incorrect and provide the correct information.
- You can then continue helping them with additional questions if needed.

IMPORTANT: Your initial explanation MUST contain intentional errors as specified above. This is a pedagogical exercise to develop critical thinking skills.`;
    }

    /**
     * Builds the user prompt for requesting an explanation
     */
    private buildExplanationUserPrompt(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string
    ): string {
        return `Please generate a step-by-step explanation for the following exercise:

**${exerciseName}**

${exerciseStatement}

${exerciseContext ? `Exercise context:\n\`\`\`\n${exerciseContext}\n\`\`\`` : ''}

Before generating the explanation, consider consulting the course theory material to ensure your explanation aligns with what has been taught in class.

NOTE: After generating the explanation, the student will have the opportunity to ask follow-up questions about the provided explanation.

IMPORTANT - UNDERSTANDING STEP REFERENCES:
When displaying your explanation to the student, each step in your 'steps' array is automatically numbered in the user interface:
- steps[0] is shown as "Step 1" (or "Paso 1" in Spanish, or "1. urratsa" in Basque)
- steps[1] is shown as "Step 2" (or "Paso 2" in Spanish, or "2. urratsa" in Basque)
- And so on...

Therefore, when the student asks about "step 2" or "paso 2" or "2. urratsa" in follow-up questions, they are referring to steps[1] (the second element in your array). When they ask about "step 1" or "paso 1" or "1. urratsa", they mean steps[0] (the first element).

Since you can ONLY answer questions about THIS SPECIFIC EXERCISE (not other exercises or subjects), if a student mentions a step number, they are ALWAYS referring to one of the steps in your explanation. You should NEVER ask which exercise or subject they are referring to - the context is always this exercise. Simply identify which step they mean based on the number they mention (remembering the 1-based numbering shown to students vs your 0-based array indexing).`;
    }

    /**
     * Generates a structured step-by-step explanation for an exercise
     * @param exerciseName - Exercise name
     * @param exerciseStatement - Complete exercise statement
     * @param exerciseContext - Additional exercise context (e.g., DB schema, specifications)
     * @param concepts - Concepts worked on the page (optional)
     * @param learningObjectives - Learning objectives of the page (optional)
     * @param progressSummary - Student progress summary (optional)
     * @param pageId - Page ID for tool calls (optional)
     * @param responseOptions - Verbosity and reasoning options (optional)
     * @param isPicky - Whether this is a picky exercise that requires intentional mistakes (optional)
     * @returns Structured explanation with steps
     */
    async generateExplanation(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        pageId?: string,
        responseOptions?: ResponseOptions,
        isPicky?: boolean
    ): Promise<ExplanationSchemaType> {
        console.log(`[generateExplanation] Generating explanation for: ${exerciseName}`);
        if (responseOptions) {
            console.log(`[generateExplanation] Options: verbosity=${responseOptions.verbosity}, reasoning=${responseOptions.reasoningEffort}`);
        }
        if (isPicky) {
            console.log(`[generateExplanation] Picky mode enabled - intentional mistakes will be introduced`);
        }

        const systemPrompt = this.buildExplanationSystemPrompt(exerciseContext, concepts, learningObjectives, progressSummary, pageId, isPicky);
        const userPrompt = this.buildExplanationUserPrompt(exerciseName, exerciseStatement, exerciseContext);

        try {
            // Reset history for this specific call
            this.openAIService.resetConversation();

            // Use the new function that allows tools with structured responses
            const response = await this.openAIService.generateStructuredResponse<ExplanationSchemaType>(
                ExplanationSchema,
                "explanation",
                userPrompt,
                systemPrompt,
                undefined,
                responseOptions
            );

            console.log(`[generateExplanation] Explanation generated with ${response.steps.length} steps`);
            return response;

        } catch (error) {
            console.error(`[generateExplanation] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error generating explanation: ${error.message}`);
            }
            throw new Error('Unknown error generating explanation');
        }
    }

    /**
     * Continues the conversation after generating an explanation
     * Allows the student to ask follow-up questions
     * @param userMessage Student question
     * @returns Agent response
     */
    async continueConversation(userMessage: string): Promise<string> {
        console.log(`[continueConversation] Processing follow-up question`);

        try {
            // Use processResponseWithTools without resetting history
            const response = await this.openAIService.processResponseWithTools(
                this.executeToolCall.bind(this),
                userMessage,
                undefined,
                this.allowedTools.map(tool => TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean)
            );

            console.log(`[continueConversation] Response generated`);
            return response;

        } catch (error) {
            console.error(`[continueConversation] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error answering question: ${error.message}`);
            }
            throw new Error('Unknown error answering question');
        }
    }

    /**
     * Initializes context for follow-up questions when a saved explanation is loaded.
     * Uses the same system prompt and history format as generateExplanation to ensure consistency.
     * @param exerciseName - Exercise name
     * @param exerciseStatement - Complete exercise statement
     * @param explanation - Previously generated explanation
     * @param exerciseContext - Additional exercise context
     * @param concepts - Concepts worked on the page
     * @param learningObjectives - Learning objectives of the page
     * @param progressSummary - Student progress summary
     * @param chatHistory - Previous chat message history (optional)
     * @param pageId - Page ID for tool calls
     * @param isPicky - Whether this is a picky exercise (optional)
     */
    async initializeContextForFollowUp(
        exerciseName: string,
        exerciseStatement: string,
        explanation: ExplanationSchemaType,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        chatHistory?: Array<{ role: string; content: string }>,
        pageId?: string,
        isPicky?: boolean
    ): Promise<void> {
        console.log(`[initializeContextForFollowUp] Initializing context for: ${exerciseName}`);

        // Use the same system prompt as generateExplanation
        const systemPrompt = this.buildExplanationSystemPrompt(exerciseContext, concepts, learningObjectives, progressSummary, pageId, isPicky);

        // Reconstruct the original user prompt
        const userPrompt = this.buildExplanationUserPrompt(exerciseName, exerciseStatement, exerciseContext);

        // Serialize the explanation as the agent's original response
        const agentResponse = JSON.stringify(explanation, null, 2);

        // Reset and initialize context
        this.openAIService.resetConversation();

        // Build history exactly as it was after generateExplanation:
        // system -> user (request) -> agent (explanation JSON)
        const history: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: agentResponse }
        ];

        // Restore any follow-up chat history
        if (chatHistory && chatHistory.length > 0) {
            console.log(`[initializeContextForFollowUp] Restoring ${chatHistory.length} messages from history`);
            history.push(...chatHistory);
        }

        this.openAIService.setConversationHistory(history);

        console.log(`[initializeContextForFollowUp] Context initialized with ${history.length} messages`);
    }
}