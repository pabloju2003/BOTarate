// List of models and their compatible parameters
export interface ModelConfig {
    name: string;
    supportsText?: boolean;      // Can be used as the main text model
    supportsVision?: boolean;    // Can be used as the vision model (image analysis)
    supportsVerbosity?: boolean;
    supportsReasoning?: boolean;
}

export const MODEL_LIST: ModelConfig[] = [
    {
        name: "gpt-5-mini",
        supportsText: true,
        supportsVision: true,
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "gpt-5",
        supportsText: true,
        supportsVision: true,
        supportsVerbosity: false,
        supportsReasoning: true
    },
    {
        name: "gpt-5.1",
        supportsText: true,
        supportsVision: true,
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "gpt-oss-120b",
        supportsText: true,
        supportsVision: false,
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "gpt-oss-20b",
        supportsText: true,
        supportsVision: false,
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "llama-4-scout-17b-16e-instruct",
        supportsText: false,
        supportsVision: true,
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "gemini-3-flash-preview",
        supportsText: true,
        supportsVision: true,
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "gemini-2.5-flash",
        supportsText: true,
        supportsVision: true,
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "moonshotai/kimi-k2.5",
        supportsText: true,
        supportsVision: false,
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "claude-haiku-4.5",
        supportsText: true,
        supportsVision: false,
        supportsVerbosity: false,
        supportsReasoning: false
    }
];

function normalizeModelName(modelName: string): string {
    return modelName.replace("models/", "").trim();
}

/**
 * Resolves a provider model id to the canonical model name used in MODEL_LIST.
 * Examples:
 * - anthropic/claude-haiku-4.5 -> claude-haiku-4.5
 * - openai/gpt-5-mini -> gpt-5-mini
 */
export function getCanonicalModelName(modelName: string): string {
    const normalized = normalizeModelName(modelName);

    // Exact match in our canonical catalog
    if (MODEL_LIST.some(m => m.name === normalized)) {
        return normalized;
    }

    // Match provider-prefixed variants (including nested prefixes)
    const suffixMatches = MODEL_LIST.filter(m => normalized.endsWith(`/${m.name}`));
    if (suffixMatches.length > 0) {
        // Prefer the most specific catalog name when multiple suffixes match
        return suffixMatches.sort((a, b) => b.name.length - a.name.length)[0].name;
    }

    return normalized;
}

/**
 * Checks whether a provider-specific model id belongs to a canonical catalog model.
 */
export function modelBelongsToCatalogModel(modelName: string, catalogModelName: string): boolean {
    return getCanonicalModelName(modelName) === catalogModelName;
}

/**
 * Gets model configuration by name
 * @param modelName Model name
 * @returns Model configuration or undefined if not in the list
 */
export function getModelConfig(modelName: string): ModelConfig | undefined {
    const canonicalName = getCanonicalModelName(modelName);
    return MODEL_LIST.find(m => canonicalName === m.name);
}

/**
 * Gets all model names that support text processing
 * @returns Array of model names that support text
 */
export function getTextModels(): string[] {
    return MODEL_LIST.filter(m => m.supportsText !== false).map(m => m.name);
}

/**
 * Gets all model names that support vision (image analysis)
 * @returns Array of model names that support vision
 */
export function getVisionModels(): string[] {
    return MODEL_LIST.filter(m => m.supportsVision === true).map(m => m.name);
}

/**
 * Checks if a model supports text processing
 * @param modelName Model name
 * @returns true if it supports text, false otherwise
 */
export function supportsText(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.supportsText !== false;
}

/**
 * Checks if a model supports vision (image analysis)
 * @param modelName Model name
 * @returns true if it supports vision, false otherwise
 */
export function supportsVision(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.supportsVision === true;
}

/**
 * Checks if a model supports the verbosity parameter
 * @param modelName Model name
 * @returns true if it supports verbosity, false otherwise
 */
export function supportsVerbosity(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.supportsVerbosity ?? false;
}

/**
 * Checks if a model supports the reasoning parameter
 * @param modelName Model name
 * @returns true if it supports reasoning, false otherwise
 */
export function supportsReasoning(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.supportsReasoning ?? false;
}

/**
 * Generates a system instruction to simulate verbosity when the model does not support it natively
 * @param verbosity Desired verbosity level
 * @returns Instruction to add to the system prompt
 */
export function getVerbosityInstruction(verbosity: "low" | "medium" | "high"): string {
    switch (verbosity) {
        case "low":
            return "VERBOSITY INSTRUCTION: Be concise and direct. Use the minimum words necessary to convey essential information. Avoid long or redundant explanations.";
        case "medium":
            return "VERBOSITY INSTRUCTION: Provide a balanced level of detail. Explain important concepts without being overly verbose.";
        case "high":
            return "VERBOSITY INSTRUCTION: Be very detailed and exhaustive in your explanations. Include additional context, examples, and elaborations that help full understanding.";
    }
}

/**
 * Generates a system instruction to simulate reasoning effort when the model does not support it natively
 * @param effort Desired reasoning effort level
 * @returns Instruction to add to the system prompt
 */
export function getReasoningInstruction(effort: "minimal" | "low" | "medium" | "high"): string {
    switch (effort) {
        case "minimal":
            return "REASONING INSTRUCTION: Respond directly without showing reasoning process. Give the answer immediately.";
        case "low":
            return "REASONING INSTRUCTION: Show only essential reasoning. A brief analysis before the answer.";
        case "medium":
            return "REASONING INSTRUCTION: Include a moderate reasoning process. Show the main steps of your analysis.";
        case "high":
            return "REASONING INSTRUCTION: Show your entire reasoning process step by step. Explain each consideration and decision before reaching the final answer.";
    }
}
