import { getTextModels, getVisionModels, MODEL_LIST } from "../ai/ModelList";

export interface AIProvider {
    name: string;
    baseUrl: string;
    key: string;
}

interface StorageConfig {
    providerKeys: string[];
    selectedProvider: number;
    selectedModel?: string;        // Main text model
    selectedVisionModel?: string;  // Model for image analysis
}

export class ConfigManager {
    private static readonly STORAGE_KEY = 'config';

    private static readonly providers: AIProvider[] = [
        { name: "OpenAI", baseUrl: "https://api.openai.com/v1/", key: import.meta.env.VITE_OPENAI_API_KEY || "" },
        { name: "Google", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", key: import.meta.env.VITE_GOOGLE_API_KEY || "" },
        { name: "Groq", baseUrl: "https://api.groq.com/openai/v1/", key: import.meta.env.VITE_GROQ_API_KEY || "" },
        { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1/", key: import.meta.env.VITE_OPENROUTER_API_KEY || "" }
    ];

    static readonly COMPATIBLE_MODELS: string[] = MODEL_LIST.map(model => model.name);
    static readonly TEXT_MODELS: string[] = getTextModels();
    static readonly VISION_MODELS: string[] = getVisionModels();

    private static selectedProvider: number = 0;
    private static selectedModel: string = '';
    private static selectedVisionModel: string = '';

    static async loadConfig(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            const config: StorageConfig | undefined = result[this.STORAGE_KEY];

            if (config) {
                if (config.providerKeys) {
                    for (let index = 0; index < config.providerKeys.length; index++) {
                        if (index < this.providers.length) {
                            this.providers[index].key = config.providerKeys[index];
                        }
                    }
                }
                if (config.selectedProvider !== undefined) {
                    this.selectedProvider = config.selectedProvider;
                }
                if (config.selectedModel !== undefined) {
                    this.selectedModel = config.selectedModel;
                }
                if (config.selectedVisionModel !== undefined) {
                    this.selectedVisionModel = config.selectedVisionModel;
                }
            }
        } catch (error) {
            console.error('Error loading config from storage:', error);
        }
    }

    private static async saveConfig(): Promise<void> {
        try {
            const config: StorageConfig = {
                providerKeys: this.providers.map(p => p.key),
                selectedProvider: this.selectedProvider,
                selectedModel: this.selectedModel,
                selectedVisionModel: this.selectedVisionModel
            };
            await chrome.storage.local.set({ [this.STORAGE_KEY]: config });
        } catch (error) {
            console.error('Error saving config to storage:', error);
        }
    }

    static getProviderList(): string[] {
        return this.providers.map(p => p.name)
    }

    static getSelectedProvider(): AIProvider {
        return this.providers[this.selectedProvider];
    }

    static getProvider(index: number): AIProvider {
        return this.providers[index];
    }

    static setProviderKey(provider: number, key: string) {
        this.providers[provider].key = key;
        this.saveConfig();
    }

    static selectProvider(provider: number) {
        this.selectedProvider = provider;
        this.saveConfig();
    }

    static selectModel(model: string) {
        this.selectedModel = model;
        this.saveConfig();
    }

    static getSelectedModel(): string {
        return this.selectedModel;
    }

    static selectVisionModel(model: string) {
        this.selectedVisionModel = model;
        this.saveConfig();
    }

    static getSelectedVisionModel(): string {
        return this.selectedVisionModel;
    }
}