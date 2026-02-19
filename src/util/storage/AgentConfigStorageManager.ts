import { AgentConfig } from '../ai/AgentConfig';
import { BaseStorageManager } from './BaseStorageManager';

export { AgentConfigStorageManager };

/**
 * Storage manager for agent configuration
 * Saves and loads custom agent configuration from chrome.storage
 */
class AgentConfigStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'agent_config_';
    private static readonly LEGACY_CONFIG_KEY = 'main';
    private static readonly defaultConfig: AgentConfig = {
        exerciseAgent: {
            role: "",
            contextDescription: "",
            conceptsFieldDescription: "",
            conceptsExamples: "",
            exerciseCriteria: "",
            excludedExercises: "",
            learningObjectivesGuidance: ""
        },
        evaluationAgent: {
            role: "",
            taskDescription: "",
            evaluationCriteria: "",
            scoringScale: "",
            feedbackFormat: "",
            importantNotes: ""
        },
        explanationAgent: {
            role: "",
            taskDescription: "",
            methodology: "",
            outputFormat: "",
            additionalRules: "",
            importantNotes: "",
            pickyExerciseConfiguration: ""
        },
        common: {
            courseName: "",
            platformName: "",
            institutionName: "",
            teacherName: "",
            teacherTics: ""
        }
    };
    private static cachedConfig: AgentConfig | null = null;

    private static asString(value: unknown, fallback = ""): string {
        return typeof value === 'string' ? value : fallback;
    }

    private static normalizeConfig(config?: Partial<AgentConfig> | null): AgentConfig {
        const defaultConfig = this.defaultConfig;
        const exerciseAgent = config?.exerciseAgent;
        const evaluationAgent = config?.evaluationAgent;
        const explanationAgent = config?.explanationAgent;
        const common = config?.common;

        return {
            exerciseAgent: {
                role: this.asString(exerciseAgent?.role, defaultConfig.exerciseAgent.role),
                contextDescription: this.asString(
                    exerciseAgent?.contextDescription,
                    defaultConfig.exerciseAgent.contextDescription
                ),
                conceptsFieldDescription: this.asString(
                    exerciseAgent?.conceptsFieldDescription,
                    defaultConfig.exerciseAgent.conceptsFieldDescription
                ),
                conceptsExamples: this.asString(
                    exerciseAgent?.conceptsExamples,
                    defaultConfig.exerciseAgent.conceptsExamples
                ),
                exerciseCriteria: this.asString(
                    exerciseAgent?.exerciseCriteria,
                    defaultConfig.exerciseAgent.exerciseCriteria
                ),
                excludedExercises: this.asString(
                    exerciseAgent?.excludedExercises,
                    defaultConfig.exerciseAgent.excludedExercises
                ),
                learningObjectivesGuidance: this.asString(
                    exerciseAgent?.learningObjectivesGuidance,
                    defaultConfig.exerciseAgent.learningObjectivesGuidance
                ),
            },
            evaluationAgent: {
                role: this.asString(evaluationAgent?.role, defaultConfig.evaluationAgent.role),
                taskDescription: this.asString(
                    evaluationAgent?.taskDescription,
                    defaultConfig.evaluationAgent.taskDescription
                ),
                evaluationCriteria: this.asString(
                    evaluationAgent?.evaluationCriteria,
                    defaultConfig.evaluationAgent.evaluationCriteria
                ),
                scoringScale: this.asString(evaluationAgent?.scoringScale, defaultConfig.evaluationAgent.scoringScale),
                feedbackFormat: this.asString(
                    evaluationAgent?.feedbackFormat,
                    defaultConfig.evaluationAgent.feedbackFormat
                ),
                importantNotes: this.asString(
                    evaluationAgent?.importantNotes,
                    defaultConfig.evaluationAgent.importantNotes
                ),
            },
            explanationAgent: {
                role: this.asString(explanationAgent?.role, defaultConfig.explanationAgent.role),
                taskDescription: this.asString(
                    explanationAgent?.taskDescription,
                    defaultConfig.explanationAgent.taskDescription
                ),
                methodology: this.asString(explanationAgent?.methodology, defaultConfig.explanationAgent.methodology),
                outputFormat: this.asString(explanationAgent?.outputFormat, defaultConfig.explanationAgent.outputFormat),
                additionalRules: this.asString(
                    explanationAgent?.additionalRules,
                    defaultConfig.explanationAgent.additionalRules
                ),
                importantNotes: this.asString(
                    explanationAgent?.importantNotes,
                    defaultConfig.explanationAgent.importantNotes
                ),
                pickyExerciseConfiguration: this.asString(
                    explanationAgent?.pickyExerciseConfiguration,
                    defaultConfig.explanationAgent.pickyExerciseConfiguration
                ),
            },
            common: {
                courseName: this.asString(common?.courseName, defaultConfig.common.courseName),
                platformName: this.asString(common?.platformName, defaultConfig.common.platformName),
                institutionName: this.asString(common?.institutionName, defaultConfig.common.institutionName),
                teacherName: this.asString(common?.teacherName, defaultConfig.common.teacherName),
                teacherTics: this.asString(common?.teacherTics, defaultConfig.common.teacherTics),
            },
        };
    }

    /**
     * Loads agent configuration from storage for a specific course.
     * Falls back to legacy 'main' key if no course-specific config exists.
     * @param courseId Optional course ID. If omitted, loads legacy 'main' config.
     */
    static async loadConfig(courseId?: string): Promise<AgentConfig> {
        try {
            const key = courseId || this.LEGACY_CONFIG_KEY;
            const result = await this.getData<AgentConfig>(this.STORAGE_KEY_PREFIX, key);

            if (result) {
                console.log(`[AgentConfigStorageManager] Configuration loaded for key: ${key}`);
                const { timestamp, ...config } = result;
                this.cachedConfig = this.normalizeConfig(config as Partial<AgentConfig>);
                return this.cachedConfig;
            }

            // If courseId was specified but no config found, try legacy key
            if (courseId) {
                const legacyResult = await this.getData<AgentConfig>(this.STORAGE_KEY_PREFIX, this.LEGACY_CONFIG_KEY);
                if (legacyResult) {
                    console.log(`[AgentConfigStorageManager] No config for course ${courseId}, using legacy config`);
                    const { timestamp, ...config } = legacyResult;
                    this.cachedConfig = this.normalizeConfig(config as Partial<AgentConfig>);
                    return this.cachedConfig;
                }
            }

            console.log("[AgentConfigStorageManager] No saved configuration, using default values");
            this.cachedConfig = this.defaultConfig;
            return this.defaultConfig;
        } catch (error) {
            console.error("[AgentConfigStorageManager] Error loading configuration:", error);
            return this.defaultConfig;
        }
    }

    /**
     * Saves agent configuration to storage for a specific course.
     * @param config The agent configuration to save
     * @param courseId Optional course ID. If omitted, saves to legacy 'main' key.
     */
    static async saveConfig(config: Partial<AgentConfig>, courseId?: string): Promise<void> {
        const key = courseId || this.LEGACY_CONFIG_KEY;
        const normalizedConfig = this.normalizeConfig(config);
        await this.saveData(this.STORAGE_KEY_PREFIX, key, normalizedConfig);
        this.cachedConfig = normalizedConfig;
    }

    /**
     * Gets cached configuration (without accessing storage)
     * If no cache, returns default configuration
     */
    static getCachedConfig(): AgentConfig {
        return this.cachedConfig || this.defaultConfig;
    }

    /**
     * Gets default configuration
     */
    static getDefaultConfig(): AgentConfig {
        return this.defaultConfig;
    }

    /**
     * Updates a specific section of the configuration
     * @param section The section to update
     * @param data The new data for the section
     * @param courseId Optional course ID
     */
    static async updateSection(
        section: keyof AgentConfig,
        data: any,
        courseId?: string
    ): Promise<void> {
        const currentConfig = await this.loadConfig(courseId);
        const updatedConfig = {
            ...currentConfig,
            [section]: data
        };
        await this.saveConfig(updatedConfig, courseId);
    }

    /**
     * Deletes saved configuration for a specific course or the legacy key.
     * @param courseId Optional course ID. If omitted, clears legacy 'main' config.
     */
    static async clearConfig(courseId?: string): Promise<void> {
        const key = courseId || this.LEGACY_CONFIG_KEY;
        await this.removeData(this.STORAGE_KEY_PREFIX, key);
        this.cachedConfig = null;
    }

    /**
     * Checks if a course-specific configuration exists.
     * @param courseId The course ID to check
     */
    static async hasConfigForCourse(courseId: string): Promise<boolean> {
        return await this.hasData(this.STORAGE_KEY_PREFIX, courseId);
    }
}