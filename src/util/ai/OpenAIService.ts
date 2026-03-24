import OpenAI from "openai";
import type { ResponseFormatJSONSchema } from "openai/resources/shared";

import type { ReasoningEffort, VerbosityLevel } from "../../types/shared";
import { AIProvider, ConfigManager } from "../config/ConfigManager";
import { getReasoningInstruction, getVerbosityInstruction, supportsReasoning, supportsVerbosity } from "./ModelList";
import type { ToolCall } from "./Tools";
import { TOOLS } from "./Tools";

export interface ResponseOptions {
    verbosity?: VerbosityLevel;
    reasoningEffort?: ReasoningEffort;
    maxTokens?: number;
}

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: {
            url: string;
            detail?: 'low' | 'high' | 'auto';
        };
    }>;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

export { OpenAIService };

class OpenAIService {

    // Static configuration shared across all instances
    private static readonly openai: OpenAI = new OpenAI({
        apiKey: ConfigManager.getSelectedProvider().key,
        baseURL: ConfigManager.getSelectedProvider().baseUrl,
        dangerouslyAllowBrowser: true
    });

    private conversationHistory: Message[] = [];

    static loadProviderConfig(): void {
        this.openai.apiKey = ConfigManager.getSelectedProvider().key;
        this.openai.baseURL = ConfigManager.getSelectedProvider().baseUrl;
    }

    // Gets model list from the specified provider, or from the selected provider by default
    static async getModelList(provider: AIProvider | undefined = undefined): Promise<string[]> {
        if (provider != undefined) {
            this.openai.baseURL = provider?.baseUrl;
            this.openai.apiKey = provider?.key;
        }

        const list = await this.openai.models.list();

        let modelList: string[] = [];
        for await (const model of list) {
            modelList.push(model.id);
        }
        console.log(this.openai.baseURL);
        console.log(modelList);

        this.loadProviderConfig(); // Restore selected provider
        return modelList;
    }

    resetConversation(): void {
        this.conversationHistory = [];
    }

    getConversationHistory(): Message[] {
        return this.conversationHistory;
    }

    setConversationHistory(messages: Message[]): void {
        this.conversationHistory = messages;
    }

    async processResponseWithTools(
        toolExecutor: (name: string, args: any) => Promise<string>,
        userMessage?: string,
        systemPrompt?: string,
        tools?: any[],
        onToolCalls?: (calls: ToolCall[]) => void
    ): Promise<string> {
        const result = await this.generateResponseWithTools(userMessage, systemPrompt, tools);

        if (result.type === 'message') {
            // Final LLM response
            return result.content;
        }

        // LLM wants to call tools
        console.log(`LLM requests ${result.calls.length} tool call(s)`);

        // Notify about tool calls if callback is provided
        if (onToolCalls) {
            onToolCalls(result.calls);
        }

        // Execute all tool calls
        for (const call of result.calls) {
            await this.executeToolCall(call, toolExecutor);
        }

        // Recursively call to get final response
        // Important: pass the same list of tools to avoid the next iteration
        // using the full `TOOLS` set by default.
        return this.processResponseWithTools(toolExecutor, undefined, undefined, tools, onToolCalls);
    }

    private async generateResponseWithTools(
        userMessage?: string,
        systemPrompt?: string,
        tools?: any[]
    ): Promise<{ type: 'message'; content: string } | { type: 'tool_calls'; calls: ToolCall[] }> {
        // Update or add system prompt if provided
        if (systemPrompt) {
            // Check if system message already exists (first message with role='system')
            const systemMessageIndex = this.conversationHistory.findIndex(msg => msg.role === 'system');

            if (systemMessageIndex >= 0) {
                // Update existing system prompt
                this.conversationHistory[systemMessageIndex] = {
                    role: 'system',
                    content: systemPrompt
                };
                console.log('[OpenAIService] System prompt updated');
            } else {
                // Add system prompt to the beginning of history
                this.conversationHistory.unshift({
                    role: 'system',
                    content: systemPrompt
                });
                console.log('[OpenAIService] System prompt added');
            }
        }

        // Add user message if provided
        if (userMessage) {
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });
        }

        const response = await OpenAIService.openai.chat.completions.create({
            model: ConfigManager.getSelectedModel(),
            messages: this.conversationHistory as any,
            tools: tools ?? TOOLS,
            tool_choice: 'auto',
        });

        const choice = response.choices[0];
        const message = choice?.message;

        if (!message) {
            throw new Error('No response received from model');
        }

        // Add agent message to history
        this.conversationHistory.push({
            role: 'assistant',
            content: message.content,
            tool_calls: message.tool_calls as ToolCall[]
        });

        // Check if there are tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            return {
                type: 'tool_calls',
                calls: message.tool_calls as ToolCall[]
            };
        }

        // Return final response
        return {
            type: 'message',
            content: message.content || ''
        };
    }

    async executeToolCall(toolCall: ToolCall, toolExecutor: (name: string, args: any) => Promise<string>): Promise<void> {
        console.log(`Executing tool: ${toolCall.function.name}`);

        try {
            const args = JSON.parse(toolCall.function.arguments);
            const toolResult = await toolExecutor(toolCall.function.name, args);

            console.log(`Result of ${toolCall.function.name}:`, toolResult.substring(0, 200) + '...');

            this.addToolResult(
                toolCall.id,
                toolCall.function.name,
                toolResult
            );
        } catch (error) {
            console.error(`Error executing ${toolCall.function.name}:`, error);
            this.addToolResult(
                toolCall.id,
                toolCall.function.name,
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }


    async generateStructuredResponse<T>(
        schema: Record<string, any>,
        schemaName: string,
        userMessage: string,
        systemPrompt: string,
        files?: Array<{ filename: string; mimeType?: string; dataUrl?: string; text?: string; url?: string }>,
        options?: ResponseOptions
    ): Promise<T> {
        console.log(`[generateStructuredResponse] Generating structured response: ${schemaName}`);

        const modelName = ConfigManager.getSelectedModel();
        let finalSystemPrompt = systemPrompt;

        // If options are specified, check model compatibility
        let overrideMaxTokens: number | undefined = undefined;
        if (options) {
            // Verbosity always goes in the prompt
            if (options.verbosity) {
                const verbosityInstruction = getVerbosityInstruction(options.verbosity);
                finalSystemPrompt = `${verbosityInstruction}\n\n${finalSystemPrompt}`;
                console.log(`[generateStructuredResponse] Verbosity instruction added to prompt: ${options.verbosity}`);
            }
            // Reasoning only if model does not support it natively
            const modelSupportsReasoning = supportsReasoning(modelName);
            if (options.reasoningEffort && !modelSupportsReasoning) {
                const reasoningInstruction = getReasoningInstruction(options.reasoningEffort);
                finalSystemPrompt = `${reasoningInstruction}\n\n${finalSystemPrompt}`;
                console.log(`[generateStructuredResponse] Model ${modelName} does not support reasoning, instruction added to prompt`);
            }
        }

        // If there is a system prompt, add it
        // If empty, assume there is already one in history
        if (finalSystemPrompt.length > 0) {
            this.conversationHistory.push({ role: 'system', content: finalSystemPrompt });
        }

        this.conversationHistory.push({ role: 'user', content: userMessage });

        // If there are attached files, add them to history
        if (files && Array.isArray(files) && files.length > 0) {
            for (const f of files) {
                this.addFileMessage(f.filename, f.dataUrl, f.mimeType, f.text);
            }
        }

        // Create response format using JSON Schema
        const responseFormat: ResponseFormatJSONSchema = {
            type: "json_schema",
            json_schema: {
                name: schemaName,
                schema: schema,
                strict: true
            }
        };

        // Build API parameters
        const apiParams: any = {
            model: modelName,
            messages: this.conversationHistory as any,
            response_format: responseFormat,
        };

        // Add native parameters if model supports them
        if (options) {
            const modelSupportsVerbosity = supportsVerbosity(modelName);
            const modelSupportsReasoning = supportsReasoning(modelName);

            if (options.verbosity && modelSupportsVerbosity) {
                // Note: The text.verbosity parameter is for the responses API, not chat.completions
                // For chat.completions, we use the instruction in the prompt (already added above if not supported)
                // If model supports verbosity, the API should handle it
                console.log(`[generateStructuredResponse] Model ${modelName} supports verbosity: ${options.verbosity}`);
            }

            if (options.reasoningEffort && modelSupportsReasoning) {
                apiParams.reasoning = { effort: options.reasoningEffort };
                console.log(`[generateStructuredResponse] Added reasoning effort: ${options.reasoningEffort}`);
            }

            if (options?.maxTokens) {
                apiParams.max_tokens = options.maxTokens;
            }
        }

        // Use native OpenAI API for structured responses
        const completion = await OpenAIService.openai.chat.completions.create(apiParams);

        const content = completion.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No structured response received from model');
        }

        const parsed = JSON.parse(content) as T;

        console.log(`[generateStructuredResponse] Structured response received successfully`);

        // Add agent response to history
        this.conversationHistory.push({
            role: 'assistant',
            content: JSON.stringify(parsed),
            tool_calls: undefined
        });

        return parsed;
    }

    addToolResult(toolCallId: string, toolName: string, result: string): void {
        this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: result
        });
    }

    /**
     * Analyzes an image using the vision model.
     * This is a standalone call that doesn't affect the main conversation history.
     * @param imageDataUrl The image data URL (data:image/...;base64,...)
     * @param prompt The prompt describing what information to extract from the image
     * @returns The vision model's analysis of the image
     */
    static async analyzeImage(imageDataUrl: string, prompt: string): Promise<string> {
        const visionModel = ConfigManager.getSelectedVisionModel();

        if (!visionModel) {
            throw new Error('No vision model configured. Please select a vision model in settings.');
        }

        console.log(`[OpenAIService] Analyzing image with vision model: ${visionModel}`);

        const response = await this.openai.chat.completions.create({
            model: visionModel,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageDataUrl,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1024
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response received from vision model');
        }

        console.log(`[OpenAIService] Vision analysis complete, response length: ${content.length}`);
        return content;
    }

    /**
     * Adds a file to history as a user message.
     * If textContent is provided it is sent as text.
     * Images are not currently processed.
     */
    private addFileMessage(filename: string, _dataUrl?: string, mimeType?: string, textContent?: string): void {
        if (textContent) {
            this.conversationHistory.push({
                role: 'user',
                content: `Attached file: ${filename} (${mimeType || 'unknown'}).\n\nCONTENT:\n${textContent}`
            });
        } else {
            this.conversationHistory.push({
                role: 'user',
                content: `Attached file: ${filename} (${mimeType || 'unknown'}). The file is available but its content has not been included.`
            });
        }
    }

}