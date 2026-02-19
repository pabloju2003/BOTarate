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
        'solveExercise'
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
                isChallenge: ex.allowed === false,
                isPicky: ex.isPicky === true
            }));

            const challengeCount = exercises.filter(ex => ex.allowed === false).length;
            const pickyCount = exercises.filter(ex => ex.isPicky === true).length;
            const allowedCount = exercises.length - challengeCount;

            exerciseContext = `\n\nEXERCISES AVAILABLE ON THIS PAGE:
The user is currently on a page with ${exercises.length} exercises (${allowedCount} allowed, ${challengeCount} challenge, ${pickyCount} picky).

List of exercises in JSON format:
${JSON.stringify(exerciseList, null, 2)}

IMPORTANT - HOW TO USE THE INDEX:
- When the user asks to see/explain/solve an exercise (e.g., "explain exercise 3", "the second exercise", etc.), use the "index" field of the corresponding JSON.
- For example, if the user asks "explain exercise 2", look for the object with "index": 2 in the JSON and use that value (2) in the tool.

IMPORTANT ABOUT CHALLENGE EXERCISES:
- Exercises with "isChallenge": true CANNOT be explained.
- If the user requests an explanation for a challenge exercise, inform them that it is blocked by the teacher so they can solve it on their own as a challenge.
- DO NOT use the explainExercise tool for challenge exercises.
- Challenge exercises CAN be solved by the student using the solveExercise tool.

IMPORTANT ABOUT PICKY EXERCISES:
- Exercises with "isPicky": true are designed to train students in critical review of AI-generated content.
- When explaining a picky exercise, DO NOT mention that it is a picky exercise, and DO NOT mention that the explanation may include intentional mistakes.
- The explanation for picky exercises will contain intentional mistakes that the student should identify.

INTERPRET USER INTENT:
There are two possible actions with exercises:
1. EXPLAIN (you explain the exercise): Use explainExercise
2. SOLVE (the student provides their solution): Use solveExercise
In both cases, your response MUST NOT be an explanation/request for the solution. The tools manage that part. Your response should just clarify the action taken (without mentioning the name of the tool itself).

Interpret intent according to these guidelines:

ASK FOR EXPLANATION (use explainExercise):
- "explain exercise 3"
- "solve exercise 3"
- "do exercise 3"
- "resolve exercise 3"
- "help me with exercise 3"
- "show me how to do exercise 3"
→ The student wants YOU to explain/show the solution

SUBMIT SOLUTION (use solveExercise):
- "I want to solve exercise 3"
- "I want to give you my solution for exercise 3"
- "I am going to solve exercise 3"
- "I am ready to do exercise 3"
- "I want to try exercise 3"
- "send my answer for exercise 3"
→ The student wants to open the form to SUBMIT their own solution

AMBIGUOUS CASES:
If the request is ambiguous (e.g., "I want to do exercise 3"), ask the user:
"Do you want me to explain how to solve exercise 3, or do you prefer to try it on your own and submit your solution?"

AVAILABLE ACTIONS:
- To explain an ALLOWED exercise (isChallenge: false): use the explainExercise tool with the exercise "index".
- For the student to submit their solution (any exercise): use the solveExercise tool with the exercise "index".`;
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