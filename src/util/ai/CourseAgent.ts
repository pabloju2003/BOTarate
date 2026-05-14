import { getLLMExerciseResponseInstructions } from "../../i18n/backend";
import { ChatStorageManager } from "../storage/ChatStorageManager";
import { AgentConfig } from "./AgentConfig";
import { BaseAgent } from "./BaseAgent";
import type { Message } from "./OpenAIService";
import { TOOLS } from "./Tools";

export { CourseAgent };

/**
 * Agente para funcionalidad general del curso
 * Maneja conversaciones y herramientas relacionadas con el curso
 */
class CourseAgent extends BaseAgent {

    private static readonly TOOLS = [
        'getSectionContent',
        'getPageContent',
        'getResourceContent',
        'explainExercise',
        'solveExercise',
        'refineExercise'
    ];

    constructor(config: AgentConfig) {
        super(config, CourseAgent.TOOLS);
    }

    /**
     * Carga el historial de conversación desde el storage
     */
    async loadChatHistory(): Promise<Message[]> {
        if (!this.course) {
            console.log('[CourseAgent] No hay curso activo, no se puede cargar el historial');
            return [];
        }

        const messages = await ChatStorageManager.getChatHistory(this.course.id);
        this.openAIService.setConversationHistory(messages);
        console.log(`[CourseAgent] Historial cargado: ${messages.length} mensajes`);

        return messages;
    }

    /**
     * Guarda el historial de conversación actual en el storage
     */
    async saveChatHistory(): Promise<void> {
        if (!this.course) {
            console.log('[CourseAgent] No hay curso activo, no se puede guardar el historial');
            return;
        }

        const messages = this.openAIService.getConversationHistory();
        await ChatStorageManager.saveChatHistory(this.course.id, messages);
        console.log(`[CourseAgent] Historial guardado: ${messages.length} mensajes`);
    }

    /**
     * Reinicia el historial de conversación y lo elimina del storage
     */
    async resetChatHistory(): Promise<void> {
        this.openAIService.resetConversation();

        if (this.course) {
            await ChatStorageManager.clearChatHistory(this.course.id);
            console.log('[CourseAgent] Historial reiniciado y eliminado del storage');
        }
    }

    /**
     * Gets a user-friendly display name for a tool call based on its arguments.
     * Looks up section/resource/page names in the course structure.
     */
    private getDisplayNameForToolCall(toolName: string, args: Record<string, any>): string | undefined {
        if (!this.course) return undefined;

        switch (toolName) {
            case 'getSectionContent': {
                const sectionId = args.sectionId;
                const section = this.course.sections.find(s => s.id === sectionId);
                return section?.title;
            }
            case 'getPageContent': {
                // Pages are resources of type 'page' within sections
                const pageId = args.pageId;
                for (const section of this.course.sections) {
                    const page = section.resources.find(r => r.id === pageId);
                    if (page) return page.name;
                }
                return undefined;
            }
            case 'getResourceContent': {
                const resourceId = args.resourceId;
                for (const section of this.course.sections) {
                    const resource = section.resources.find(r => r.id === resourceId);
                    if (resource) return resource.name;
                }
                return undefined;
            }
            default:
                return undefined;
        }
    }

    /**
     * Builds the full system prompt with course information
     */
    private buildSystemPrompt(exercises?: any[]): string {
        const courseContext = JSON.stringify(this.course);

        let exerciseContext = '';
        if (exercises && exercises.length > 0) {
            // Create exercise list in JSON format for clarity
            const exerciseList = exercises.map((ex, index) => ({
                index: index + 1,
                name: ex.name,
                role: ex.role ?? 'tutor'
            }));

            const observerCount = exercises.filter(ex => ex.role === 'observer').length;
            const proofreaderCount = exercises.filter(ex => ex.role === 'proofreader').length;
            const tutorCount = exercises.filter(ex => (ex.role ?? 'tutor') === 'tutor').length;
            const challengerCount = exercises.filter(ex => ex.role === 'challenger').length;
            const refinerCount = exercises.filter(ex => ex.role === 'refiner').length;

            exerciseContext = `\n\nEXERCISES AVAILABLE ON THIS PAGE:
The user is currently on a page with ${exercises.length} exercises (${observerCount} observer, ${proofreaderCount} proofreader, ${tutorCount} tutor, ${challengerCount} challenger, ${refinerCount} refiner).

List of exercises in JSON format:
${JSON.stringify(exerciseList, null, 2)}

IMPORTANT - HOW TO USE THE INDEX:
- When the user asks to see/explain/solve an exercise (e.g., "explain exercise 3", "the second exercise", etc.), use the "index" field of the corresponding JSON.
- For example, if the user asks "explain exercise 2", look for the object with "index": 2 in the JSON and use that value (2) in the tool.

IMPORTANT ABOUT ROLES:
- observer:
    - The AI CANNOT explain or evaluate this exercise.
    - If the user asks for explanation or evaluation for this exercise, say that AI is not available for this exercise.
    - DO NOT use explainExercise or solveExercise for observer exercises.
- proofreader:
    - The AI CANNOT explain this exercise.
    - If the user asks for explanation, tell them that in this mode only syntax review is available for their solution.
    - The user CAN submit their solution using solveExercise (syntax-only review mode).
- tutor:
    - Normal mode. The AI CAN explain and the user CAN submit their solution.
- challenger:
    - The AI CAN explain and the user CAN submit their solution.
    - Explanations will include intentional mistakes, but NEVER mention this to the user.
- refiner:
    - The AI CANNOT explain this exercise and CANNOT evaluate a final solution.
    - The student works iteratively by submitting drafts. Use refineExercise to open the refiner interface.
    - DO NOT use explainExercise or solveExercise for refiner exercises.

INTERPRET USER INTENT:
There are three possible actions with exercises:
1. EXPLAIN (you explain the exercise): Use explainExercise
2. SOLVE (the student submits their own solution for evaluation): Use solveExercise
3. REFINE (the student works on a draft iteratively): Use refineExercise
In all cases, your response MUST NOT contain an explanation or solution. The tools handle that.

Interpret intent according to these guidelines:

ASK FOR EXPLANATION (use explainExercise):
- "explain exercise 3" / "explícame el ejercicio 3"
- "do exercise 3" / "hazme el ejercicio 3"
- "resolve exercise 3" / "resuelve el ejercicio 3"
- "help me with exercise 3" / "ayúdame con el ejercicio 3"
- "show me how to do exercise 3"
→ The student wants YOU to explain/show the solution

SUBMIT SOLUTION (use solveExercise):
- "I want to solve exercise 3" / "quiero resolver el ejercicio 3"
- "I want to give you my solution" / "quiero darte mi solución"
- "correct my solution" / "corrígeme" / "corrígeme el ejercicio"
- "evaluate my solution" / "evalúa mi solución" / "evalúa mi solución del ejercicio"
- "check my answer" / "revisa mi respuesta"
- "I want to submit" / "quiero enviar mi solución"
- "I want to try exercise 3" / "quiero intentar el ejercicio 3"
→ The student wants to open the form to SUBMIT their own solution

OPEN REFINER (use refineExercise):
- Any request about a refiner-role exercise
- "refine exercise 5" / "refinar el ejercicio 5"
- "work on exercise 5" / "trabajar en el ejercicio 5"
→ Use refineExercise for refiner-role exercises

AMBIGUOUS CASES:
If the request is ambiguous (e.g., "I want to do exercise 3"), ask the user:
"Do you want me to explain how to solve exercise 3, or do you prefer to try it on your own and submit your solution?"

AVAILABLE ACTIONS:
- To explain an exercise with role tutor/challenger: use explainExercise with the exercise "index".
- To let the student submit their solution for evaluation (role tutor/proofreader/challenger): use solveExercise with the exercise "index".
- For role observer: do not call tools for explain/solve; inform the user that AI is not available for that exercise.`;
        }        // Generic prompt template
        const template = `You are an agent in a Chrome extension whose goal is {role}.

{toolsDescription}

IMPORTANT INSTRUCTIONS:
    - When the user mentions a section by title/name, find its ID in the sections list above. The user does not know IDs, only titles, so NEVER ask for an ID.
    - To retrieve detailed section content, use the getSectionContent tool with the section ID.
    - Section IDs are the values in the "id" field (for example: "1378079").
    - If the user asks about "section 2" or "topic 2", locate the section with sectionNumber: 2 and use its ID.
    - Respond in a direct, helpful, and concise way.
    - If you need information from a specific section, call getSectionContent before answering.
    - NEVER ask the user to provide IDs; always resolve them yourself from the available course structure.

{exerciseContext}

{exerciseResponseFormat}

COURSE INFORMATION:
Below is the complete course structure with all available sections. Each section has a unique ID that you must use when you need to get its detailed content.

{courseContext}
`;

        // Variables to substitute in the template
        const variables = {
            role: 'a chat-based assistant that helps students with their online course content and exercises',
            toolsDescription: 'You can use the tools getSectionContent, getPageContent, getResourceContent, explainExercise, and solveExercise to consult course materials and handle exercises.',
            exerciseContext: exerciseContext,
            exerciseResponseFormat: getLLMExerciseResponseInstructions(),
            courseContext: courseContext
        };

        return this.buildPromptFromTemplate(template, variables);
    }

    /**
     * Generates an agent response using the current course
     * @param userMessage User message
     * @param resetHistory If true, resets conversation history
     * @param exercises Optional list of exercises available on the current page
     * @returns The final agent response
     */
    async generateResponse(userMessage: string, resetHistory: boolean = false, exercises?: any[]): Promise<string> {
        if (resetHistory) {
            await this.resetChatHistory();
        }

        // Always build the system prompt with current exercises
        // This ensures context is updated even if the page changes
        const systemPrompt = this.buildSystemPrompt(exercises);

        // Callback to notify frontend about tool calls
        const notifyToolCalls = async (calls: any[]) => {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs.length > 0 && tabs[0].id) {
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toolCallsUpdate',
                        toolCalls: calls.map(c => {
                            const toolName = c.function.name;
                            const args = JSON.parse(c.function.arguments || '{}');
                            return {
                                name: toolName,
                                arguments: c.function.arguments,
                                displayName: this.getDisplayNameForToolCall(toolName, args)
                            };
                        })
                    });
                }
            } catch (error) {
                console.error('[CourseAgent] Error notifying tool calls:', error);
            }
        };

        const response = await this.openAIService.processResponseWithTools(
            (name: string, args: any) => this.executeToolCall(name, args),
            userMessage,
            systemPrompt,
            this.allowedTools.map(tool => TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean),
            notifyToolCalls
        );

        // Save history after each interaction
        await this.saveChatHistory();

        return response;
    }
}