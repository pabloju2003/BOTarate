import { AgentConfig } from "./AgentConfig";
import { BaseAgent } from "./BaseAgent";
import { ResponseOptions } from "./OpenAIService";
import { TOOLS } from "./Tools";

export { RefinerAgent };

/**
 * Agente especializado en evaluar borradores iterativos del alumno.
 * El alumno envía un borrador (mezcla de código real y comentarios en lenguaje natural
 * describiendo partes pendientes) y la IA evalúa si va en la dirección correcta sin
 * dar la respuesta. Iterativo: el alumno refina y vuelve a enviar.
 *
 * No usa structured output (texto libre Markdown) para evitar cortes por maxTokens
 * y permitir respuestas conversacionales naturales.
 */
class RefinerAgent extends BaseAgent {

    private static readonly TOOLS = [
        'getPageContent',
        'getFilteredFileContent',
        'analyzeImage'
    ];

    private currentExerciseName: string | null = null;
    private currentExerciseStatement: string = '';
    private currentExerciseContext: string | undefined;
    private hasSentInitialDraft: boolean = false;

    constructor(config: AgentConfig) {
        super(config, RefinerAgent.TOOLS);
    }

    /**
     * Builds the pedagogical context section (concepts + objectives + progress)
     */
    private buildPedagogicalContext(
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string
    ): { conceptsContext: string; objectivesContext: string; progressContext: string } {
        const conceptsContext = concepts && concepts.length > 0
            ? `- This exercise works on the following concepts: ${concepts.join(', ')}`
            : '';

        const objectivesContext = learningObjectives
            ? `- Learning objectives of the page: ${learningObjectives}`
            : '';

        const progressContext = progressSummary
            ? `STUDENT PROGRESS:\n${progressSummary}\n- You can assume familiarity with concepts from completed labs/exercises.`
            : '';

        return { conceptsContext, objectivesContext, progressContext };
    }

    /**
     * Tools description (only loaded if the student asks about lab content)
     */
    private buildLabContentToolsNote(): string {
        return `- Use these tools only if the student references concrete data, files, or images from the lab content.
- Try to filter as much as possible to return only what is strictly relevant.
- getPageContent(pageId): retrieves lab page content to locate file markers [FILEx:TEXT:name.sql] and image markers [IMAGE#].
- getFilteredFileContent(pageId, fileId, regexPattern): extracts only necessary sections from text files.
- analyzeImage(pageId, imageId, prompt): analyzes images in the page.
- You must always call getPageContent first to identify available files/images and their IDs before using getFilteredFileContent or analyzeImage.`;
    }

    /**
     * Builds the system prompt for the Refiner role
     */
    private buildRefinerSystemPrompt(
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        pageId?: string
    ): string {
        const refinerConfig = this.config.refinerAgent;
        const role = refinerConfig?.role
            || 'an expert tutor in xQuery helping students design solutions step by step';
        const taskDescription = refinerConfig?.taskDescription
            || 'to assess whether the student\'s draft is on the right path to fulfil the query, without writing the solution for them';
        const evaluationGuidelines = refinerConfig?.evaluationGuidelines || '';
        const importantNotes = refinerConfig?.importantNotes || '';

        const pedagogicalContext = this.buildPedagogicalContext(concepts, learningObjectives, progressSummary);

        const systemPromptTemplate = `You are an expert tutor helping students design solutions incrementally. Specifically: {role}.

Your task is {taskDescription}.

THE REFINER PROCESS:
The student will send you drafts of their solution. These drafts mix:
- Actual code fragments (partial implementation)
- Comments in natural language describing parts they haven't implemented yet (e.g., (: get all books published before 2000 :))

YOUR RULES:
1. NEVER provide the complete solution or write code for the student.
2. If the draft is on the right track, acknowledge what's correct and encourage them to continue.
3. If something is wrong, indicate WHAT is wrong and WHY, but do NOT fix it for them.
4. If the overall approach/structure is wrong, guide them toward the right approach without giving it away.
5. Be concise: 3-5 sentences per response.
6. Focus on logical structure and approach over syntax minutiae.
7. When the student's draft is nearly complete and correct, congratulate them and confirm they can finalize the implementation.
8. Treat natural-language comments as legitimate placeholders for parts not yet implemented — assess the intent, not the lack of code.

{evaluationGuidelines}

LAB CONTENT TOOLS (use only if the student references lab files/images/data):
{labContentToolsNote}

{pageIdNote}

PEDAGOGICAL CONTEXT:
{conceptsContext}
{objectivesContext}

{progressContext}

{teacherPersonalization}

{importantNotes}

{responseLengthConstraints}`;

        const variables = {
            role,
            taskDescription,
            evaluationGuidelines,
            labContentToolsNote: this.buildLabContentToolsNote(),
            pageIdNote: pageId
                ? `Page ID: ${pageId}\n- Use this ID as the value for the 'pageId' parameter when calling getPageContent or getFilteredFileContent.`
                : '',
            ...pedagogicalContext,
            teacherPersonalization: this.buildTeacherPersonalization(),
            importantNotes,
            responseLengthConstraints: `RESPONSE LENGTH CONSTRAINTS:
- Keep your assessment to 3-5 sentences maximum.
- Do NOT repeat the exercise statement — the student already sees it.
- Do NOT write code or complete fragments — only describe what is correct or wrong.
- Do NOT add filler phrases ("¡Vamos a verlo!", "¡Excelente borrador!"). Go straight to the assessment.
- Use Markdown sparingly: short paragraphs, optional bullet list when listing more than two issues.`
        };

        return this.buildPromptFromTemplate(systemPromptTemplate, variables);
    }

    /**
     * User prompt sent the very first time the student submits a draft for an exercise
     */
    private buildInitialDraftPrompt(
        exerciseName: string,
        exerciseStatement: string,
        studentDraft: string,
        exerciseContext?: string
    ): string {
        return `Exercise: **${exerciseName}**

${exerciseStatement}

${exerciseContext ? `Exercise context:\n\`\`\`\n${exerciseContext}\n\`\`\`\n` : ''}
--- STUDENT DRAFT ---
${studentDraft}
--- END DRAFT ---

Assess to what extent this draft is on the right path to solve the exercise. Highlight what is correct, what is misguided, and what to focus on next. Remember: do NOT provide the solution or write the missing code.`;
    }

    /**
     * User prompt sent on subsequent draft re-submissions
     */
    private buildUpdatedDraftPrompt(studentDraft: string): string {
        return `--- UPDATED DRAFT ---
${studentDraft}
--- END DRAFT ---

Assess my updated draft. What improved compared to the previous version? What still needs work? Remember: do NOT write the missing code.`;
    }

    /**
     * Initializes a new refinement session for an exercise.
     * Sets the system prompt and resets conversation history.
     */
    async startSession(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        pageId?: string,
        responseOptions?: ResponseOptions
    ): Promise<void> {
        console.log(`[RefinerAgent.startSession] Starting refiner session for: ${exerciseName}`);

        this.currentExerciseName = exerciseName;
        this.currentExerciseStatement = exerciseStatement;
        this.currentExerciseContext = exerciseContext;
        this.hasSentInitialDraft = false;

        const systemPrompt = this.buildRefinerSystemPrompt(
            exerciseContext, concepts, learningObjectives, progressSummary, pageId
        );

        this.openAIService.resetConversation();
        this.openAIService.setConversationHistory([
            { role: 'system', content: systemPrompt }
        ]);
    }

    /**
     * Sends a student draft and receives feedback.
     * The first call after startSession uses the full initial prompt with statement;
     * subsequent calls use the shorter "updated draft" prompt.
     */
    async evaluateDraft(studentDraft: string): Promise<string> {
        if (!this.currentExerciseName) {
            throw new Error('Refiner session has not been started. Call startSession or restoreSession first.');
        }

        const userPrompt = this.hasSentInitialDraft
            ? this.buildUpdatedDraftPrompt(studentDraft)
            : this.buildInitialDraftPrompt(
                this.currentExerciseName,
                this.currentExerciseStatement,
                studentDraft,
                this.currentExerciseContext
            );

        try {
            const response = await this.openAIService.processResponseWithTools(
                this.executeToolCall.bind(this),
                userPrompt,
                undefined,
                this.allowedTools.map(tool => TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean)
            );

            this.hasSentInitialDraft = true;
            return response;
        } catch (error) {
            console.error('[RefinerAgent.evaluateDraft] Error:', error);
            if (error instanceof Error) {
                throw new Error(`Error evaluating draft: ${error.message}`);
            }
            throw new Error('Unknown error evaluating draft');
        }
    }

    /**
     * Sends a follow-up message (no new draft) within the current session.
     */
    async sendFollowUp(message: string): Promise<string> {
        if (!this.currentExerciseName) {
            throw new Error('Refiner session has not been started. Call startSession or restoreSession first.');
        }

        try {
            const response = await this.openAIService.processResponseWithTools(
                this.executeToolCall.bind(this),
                message,
                undefined,
                this.allowedTools.map(tool => TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean)
            );
            return response;
        } catch (error) {
            console.error('[RefinerAgent.sendFollowUp] Error:', error);
            if (error instanceof Error) {
                throw new Error(`Error answering follow-up: ${error.message}`);
            }
            throw new Error('Unknown error answering follow-up');
        }
    }

    /**
     * Restores a refinement session from persisted chat history.
     * Required because the service worker can be evicted between turns.
     * Rebuilds the system prompt and replays prior user/assistant turns.
     */
    async restoreSession(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        chatHistory?: Array<{ role: string; content: string }>,
        pageId?: string
    ): Promise<void> {
        console.log(`[RefinerAgent.restoreSession] Restoring session for: ${exerciseName} (${chatHistory?.length ?? 0} prior msgs)`);

        this.currentExerciseName = exerciseName;
        this.currentExerciseStatement = exerciseStatement;
        this.currentExerciseContext = exerciseContext;

        const systemPrompt = this.buildRefinerSystemPrompt(
            exerciseContext, concepts, learningObjectives, progressSummary, pageId
        );

        const safeHistory = (chatHistory || [])
            .filter(msg => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
            .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

        this.openAIService.resetConversation();
        this.openAIService.setConversationHistory([
            { role: 'system', content: systemPrompt },
            ...safeHistory
        ]);

        // If at least one user turn exists, the initial draft has already been sent.
        this.hasSentInitialDraft = safeHistory.some(m => m.role === 'user');
    }
}
