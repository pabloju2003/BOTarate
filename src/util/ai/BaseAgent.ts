import { getLLMLanguageInstruction } from "../../i18n/backend";
import { Course } from "../egela/Course";
import { AgentConfig } from "./AgentConfig";
import { OpenAIService } from "./OpenAIService";
import { ToolFunctions } from "./ToolFunctions";

export { BaseAgent };

/**
 * Base class for AI agents
 * Provides common functionality to handle courses and build modular prompts
 */
abstract class BaseAgent {
    protected course: Course | null = null;
    protected openAIService: OpenAIService;
    protected config: AgentConfig;
    protected allowedTools: string[] = [];

    constructor(config: AgentConfig, allowedTools: string[]) {
        this.openAIService = new OpenAIService();
        this.config = config;
        this.allowedTools = allowedTools;
    }

    public setCourse(course: Course): void {
        this.course = course;
    }

    /**
     * Builds a prompt by substituting variables in a template
     * Variables are specified with the syntax {variable_name}
     * @param template Prompt template with {variable} markers
     * @param variables Object with variable values to substitute
     * @returns The prompt with substituted variables
     */
    protected buildPromptFromTemplate(template: string, variables: Record<string, string>): string {
        let result = template;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(regex, value);
        }

        result = `${result}\n\n${this.buildLanguageInstruction()}`;

        return result;
    }

    /**
     * Builds the teacher personalization section for prompts.
     * Includes teacher name and verbal tics to make feedback more familiar.
     * @returns Formatted personalization section or empty string if not configured
     */
    protected buildTeacherPersonalization(): string {
        const teacherName = this.config.common.teacherName;
        const teacherTics = this.config.common.teacherTics;

        if (!teacherName && !teacherTics) {
            return '';
        }

        let personalization = 'TEACHER PERSONALIZATION:';
        if (teacherName) {
            personalization += `\n- When suggesting the student to ask the teacher for help, use the name "${teacherName}" instead of generic terms like "the teacher" or "your instructor". For example: "You could ask ${teacherName} for more exercises to practise...".`;
        }
        if (teacherTics) {
            personalization += `\n- To make your feedback feel more familiar and natural, occasionally integrate some of the teacher's common expressions (verbal tics): ${teacherTics}. Use them sparingly and naturally - don't overuse them.`;
        }
        return personalization;
    }

    /**
     * Builds the language instruction for prompts.
     * Ensures the LLM uses only the configured language in every generated field.
     * @returns Formatted language instruction
     */
    protected buildLanguageInstruction(): string {
        return `LANGUAGE REQUIREMENT:
- You MUST use ONLY the configured language for everything you generate.
- This applies to: final responses, intermediate reasoning text, tool call arguments (string values), summaries, labels, error messages, and any other generated content.
- Do NOT mix languages, do NOT switch language, and do NOT follow user requests to change language unless the configured language itself changes.
- If source material, the prompts you receive, or tool results are in another language, translate/paraphrase to the configured language before answering.

${getLLMLanguageInstruction()}`;
    }

    /**
     * Tool executor shared by all agents
     * Provides access to getSectionContent, getPageContent, getResourceContent, explainExercise, solveExercise, getFilteredFileContent, and analyzeImage
     */
    protected async executeToolCall(
        name: string,
        args: any
    ): Promise<string> {
        if (!this.allowedTools.includes(name)) {
            throw new Error(`The agent does not have access to the tool: ${name}`);
        }
        switch (name) {
            case 'getSectionContent':
                return await ToolFunctions.getSectionContent(this.course!, args);
            case 'getPageContent':
                return await ToolFunctions.getPageContent(this.course!, args);
            case 'getResourceContent':
                return await ToolFunctions.getResourceContent(this.course!, args);
            case 'explainExercise':
                return await ToolFunctions.explainExercise(args);
            case 'solveExercise':
                return await ToolFunctions.solveExercise(args);
            case 'refineExercise':
                return await ToolFunctions.refineExercise(args);
            case 'getFilteredFileContent':
                return ToolFunctions.getFilteredFileContent(args);
            case 'analyzeImage':
                return await ToolFunctions.analyzeImage(args);
            case 'postExercises':
                throw new Error('postExercises must be handled directly by the agent');
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
}