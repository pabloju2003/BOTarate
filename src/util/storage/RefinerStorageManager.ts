import { BaseStorageManager } from "./BaseStorageManager";

/**
 * A single message in a refiner conversation
 */
export interface RefinerChatMessage {
    role: "user" | "assistant";
    content: string;
    id: string;
    /** Optional flag: messages of role 'user' that represent a draft submission. */
    isDraft?: boolean;
}

/**
 * Persisted refinement session for one exercise on one page.
 * Holds only the chat history; no scores/evaluations are produced by the Refiner.
 */
export interface RefinerSession {
    exerciseName: string;
    chatHistory: RefinerChatMessage[];
    /** Latest draft text the student left in the textarea (so re-opening the modal restores their work in progress). */
    latestDraft?: string;
}

/**
 * All refinement sessions for a single page
 */
export interface RefinerData {
    pageId: string;
    sessions: Record<string, RefinerSession>;
}

/**
 * Storage manager for the Refiner role: keeps chat history and the latest draft
 * so the student can close and reopen the modal and continue where they left off.
 */
export class RefinerStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'refiner_data_';

    static async getRefinerData(pageId: string): Promise<(RefinerData & { timestamp: number }) | null> {
        return await this.getData<RefinerData>(this.STORAGE_KEY_PREFIX, pageId);
    }

    static async getSession(pageId: string, exerciseName: string): Promise<RefinerSession | null> {
        const data = await this.getRefinerData(pageId);
        if (!data || !data.sessions[exerciseName]) {
            return null;
        }
        return data.sessions[exerciseName];
    }

    static async saveSession(
        pageId: string,
        exerciseName: string,
        chatHistory: RefinerChatMessage[],
        latestDraft?: string
    ): Promise<void> {
        const existing = await this.getRefinerData(pageId);
        const session: RefinerSession = {
            exerciseName,
            chatHistory,
            latestDraft,
        };
        const data: RefinerData = {
            pageId,
            sessions: existing?.sessions
                ? { ...existing.sessions, [exerciseName]: session }
                : { [exerciseName]: session }
        };
        await this.saveData(this.STORAGE_KEY_PREFIX, pageId, data);
    }

    static async removeSession(pageId: string, exerciseName: string): Promise<void> {
        const data = await this.getRefinerData(pageId);
        if (!data) return;

        delete data.sessions[exerciseName];

        if (Object.keys(data.sessions).length === 0) {
            await this.removeData(this.STORAGE_KEY_PREFIX, pageId);
        } else {
            await this.saveData(this.STORAGE_KEY_PREFIX, pageId, {
                pageId: data.pageId,
                sessions: data.sessions
            });
        }
    }

    static async getExerciseNamesWithSessions(pageId: string): Promise<string[]> {
        const data = await this.getRefinerData(pageId);
        if (!data) return [];
        return Object.keys(data.sessions);
    }
}
