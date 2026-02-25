import { Exercise } from "../egela/Exercise";
import { ExerciseStorageManager } from "../storage/ExerciseStorageManager";
import { AgentConfig } from "./AgentConfig";
import { BaseAgent } from "./BaseAgent";
import { ExerciseListSchemaType } from "./schemas";
import { EXERCISE_AGENT_TOOLS } from "./Tools";

export { ExerciseAgent };

/**
 * Agente para análisis de ejercicios
 * Maneja la identificación y análisis de ejercicios en páginas del curso
 */
class ExerciseAgent extends BaseAgent {

    private static readonly TOOLS = [
        'getFilteredFileContent',
        'analyzeImage',
        'postExercises'
    ];

    constructor(config: AgentConfig) {
        super(config, ExerciseAgent.TOOLS);
    }

    /**
     * Identifies exercises on a page using the LLM with structured responses
     * @param pageId Egela page ID
     * @param resourceId Resource ID (to locate it in the section resource list)
     * @returns Array of identified exercises (empty if no exercises), exercise context, and pedagogical concepts
     */
    async identifyExercises(pageId: string, resourceId?: string): Promise<{
        exercises: Exercise[];
        exerciseContext?: string;
        concepts?: string[];
        learningObjectives?: string;
    }> {
        console.log(`[identifyExercises] Identifying exercises on page: ${pageId}. Course ID: ${this.course?.id}`);

        try {
            // 1. Get page content in Markdown format + detected files
            const pageResult = await this.course!.getPageContent(pageId);
            const pageContent = pageResult.markdown;
            const attachedFiles = pageResult.files;
            console.log(`[identifyExercises] Page content obtained (${pageContent.length} characters), files: ${attachedFiles.length}`);

            // 2. Build system prompt using configuration
            const agentConfig = this.config.exerciseAgent;

            const systemPromptTemplate = `You are an assistant specialized in extracting laboratory exercises from educational pages.

Your task is to analyze the content, identify valid exercises, and return structured information that can be saved by the extension.

The current page ID is ${pageId}.

AVAILABLE TOOLS:
1. getFilteredFileContent: To extract specific content from text files using regular expressions.
    - Use this tool when you see markers like [FILE1:TEXT:filename.ext]
    - Use regex patterns to extract relevant sections (definitions, declarations, structural elements)

2. analyzeImage: To analyze images in the page content.
   - Images are marked as [IMAGE#] or [IMAGE#: description] where # is the image number (e.g., IMAGE1, IMAGE2)
   - The description (if present) gives you a hint about the image content (from alt text)
    - ALWAYS use this tool when you see image markers, especially for diagrams or schemas that might contain structural information about the data
    - Use the image description to INFER and DESCRIBE the data structure shown in the image
    - Your goal is to generate a reasonable description of the data structure that would make sense for the exercises

3. postExercises: MANDATORY - You must use this tool exactly once at the end to submit the identified exercises.
   - This tool is your way of "responding" with the analysis results
   - You must always call it, even if there are no exercises (send an empty array)
   - If you receive "Exercises received correctly" as a response, it means your call was successful and you should not call it again. Simply end the conversation by saying "OK", as whatever you say after the post will be ignored.

WORKFLOW:
1. Analyze page content
2. ALWAYS analyze images when present (markers [IMAGE#]) - use the image description to infer the data structure for the exercise context
3. If there are text files (markers [FILEn:TEXT:name]), use getFilteredFileContent to extract relevant information
4. Identify all exercises on the page
5. MANDATORY: Call postExercises with all collected information.

CRITERIA FOR IDENTIFYING EXERCISES:
{exerciseCriteria}

EXCLUDED EXERCISES (DO NOT INCLUDE):
{excludedExercises}
- If this section is empty, ignore this rule.
- If an exercise title or statement matches these exclusions, skip it and do not include it in the final output.

EXERCISE CONTEXT:
- {contextDescription}
- If you detect such information, include it in the "exercise_context" field
- If you don't detect it, send that field empty

CONCEPTS:
- Analyze the exercises and identify what {conceptsFieldDescription}
- If a concept is not mentioned explicitly, do not infer it from the exercise statements. The intent of the teacher may not align with your inference.
- Be specific when possible
- Examples: {conceptsExamples}
- If there are no exercises, this field must be empty

LEARNING OBJECTIVES:
- {learningObjectivesGuidance}

DATA STRUCTURE ANALYSIS:
When you encounter exercises that reference specific data structures (tables, XML documents, schemas, etc.), you MUST analyze any available images or files that might contain the data structure definition. Use the image descriptions and file contents to BUILD a description of the data structure, including its elements, attributes, and relationships. Include this description in the "exercise_context" field to help understand the data structure.

IMPORTANT: You must call postExercises exactly once at the end of the analysis.
`;

            const systemPromptVariables = {
                role: agentConfig.role,
                exerciseCriteria: agentConfig.exerciseCriteria,
                excludedExercises: agentConfig.excludedExercises,
                contextDescription: agentConfig.contextDescription,
                conceptsFieldDescription: agentConfig.conceptsFieldDescription,
                conceptsExamples: agentConfig.conceptsExamples,
                learningObjectivesGuidance: agentConfig.learningObjectivesGuidance,
            };

            const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

            const userPrompt = `Analyze the following content of an educational page and identify the exercises.

Page content:

${pageContent}`;

            // Use processResponseWithTools to allow the LLM to use getFilteredFileContent
            // and finally call postExercises with the results
            this.openAIService.resetConversation();
            console.log(`[identifyExercises] Starting analysis with tools`);

            let exerciseResult: ExerciseListSchemaType | null = null;

            // The toolExecutor captures when postExercises is called
            const result = await this.openAIService.processResponseWithTools(
                async (name: string, args: any) => {
                    if (name === 'postExercises') {
                        // Capture identified exercises
                        exerciseResult = args as ExerciseListSchemaType;
                        return 'Exercises received correctly';
                    }
                    // Execute other tools normally (getFilteredFileContent)
                    return this.executeToolCall(name, args);
                },
                userPrompt,
                systemPrompt,
                this.allowedTools.map(tool => EXERCISE_AGENT_TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean)
            );

            // Verify that a valid response was received
            if (!exerciseResult) {
                console.warn(`[identifyExercises] The LLM did not call postExercises. Returning empty result.`);
                return {
                    exercises: [],
                    exerciseContext: undefined,
                    concepts: [],
                    learningObjectives: undefined,
                };
            }

            const response = exerciseResult as Partial<ExerciseListSchemaType>;
            console.log(`[identifyExercises] Response received:`, response);

            // 3. Convert to Exercise objects
            const responseExercises = Array.isArray(response.exercises) ? response.exercises : [];
            const exercises: Exercise[] = responseExercises
                .filter((ex): ex is { name: string; statement: string } => {
                    return typeof ex?.name === 'string' && typeof ex?.statement === 'string';
                })
                .map((ex) => new Exercise(ex.name, ex.statement));

            const exerciseContext = typeof response.exercise_context === 'string'
                ? response.exercise_context
                : '';
            const concepts = Array.isArray(response.concepts)
                ? response.concepts.filter((concept): concept is string => typeof concept === 'string')
                : [];
            const learningObjectives = typeof response.learning_objectives === 'string'
                ? response.learning_objectives
                : '';

            console.log(`[identifyExercises] Identified ${exercises.length} exercises, exercise_context present: ${!!exerciseContext}`);
            console.log(`[identifyExercises] Concepts: ${concepts.join(', ') || 'N/A'}`);
            console.log(`[identifyExercises] Learning objectives: ${learningObjectives || 'N/A'}`);

            // 4. Save data to storage for future use
            const existingExerciseData = await ExerciseStorageManager.getExerciseData(pageId);
            const exerciseDataToStore = exercises.map(ex => {
                const previous = existingExerciseData?.exercises.find(prev => prev.name === ex.name);
                const previousAny = previous as any;
                const exAny = ex as any;
                const previousRole = previous?.role
                    ?? (previousAny?.allowed === false ? 'challenger' : previousAny?.isPicky === true ? 'proofreader' : undefined);
                const currentRole = ex.role
                    ?? (exAny?.allowed === false ? 'challenger' : exAny?.isPicky === true ? 'proofreader' : undefined);

                return {
                    name: ex.name,
                    statement: ex.statement,
                    role: previousRole ?? currentRole ?? 'tutor',
                };
            });
            await ExerciseStorageManager.saveExerciseData(
                pageId,
                exerciseDataToStore,
                exerciseContext,
                concepts,
                learningObjectives
            );
            console.log(`[identifyExercises] Data saved to storage for page ${pageId}`);

            return {
                exercises,
                exerciseContext: exerciseContext || undefined,
                concepts,
                learningObjectives: learningObjectives || undefined,
            };

        } catch (error) {
            console.error(`[identifyExercises] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error identifying exercises: ${error.message}`);
            }
            throw new Error('Unknown error identifying exercises');
        }
    }
}