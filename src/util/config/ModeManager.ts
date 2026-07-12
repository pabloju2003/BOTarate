import { AppMode, ModeStorageManager } from "../storage/ModeStorageManager";

// Re-export AppMode to maintain compatibility
export { AppMode };

/**
 * Extension operation mode manager
 * Controls whether the extension is in student or teacher mode
 */
export class ModeManager {
    private static cachedMode: AppMode | null = null;
    private static cachedModeByCourse: Map<string, AppMode> = new Map();

    /**
     * Gets the current application mode.
     * If courseId is provided, the mode is looked up (and cached) per-course, so a
     * mode chosen in one course (e.g. switching to "student view" to test an exercise)
     * doesn't leak into a different course where the user is also a teacher.
     * @param courseId Optional course ID for per-course mode
     * @returns Current mode (default: teacher if user is teacher, student otherwise)
     */
    static async getMode(courseId?: string): Promise<AppMode> {
        if (courseId) {
            const cached = this.cachedModeByCourse.get(courseId);
            if (cached) {
                return cached;
            }

            try {
                const mode = await ModeStorageManager.getModeForCourse(courseId);
                if (mode) {
                    this.cachedModeByCourse.set(courseId, mode);
                    return mode;
                }
                // No mode saved yet for this course: fall back to the global default
                // logic (based on cached user role), but do NOT cache another course's
                // leftover global mode under this courseId.
                const fallback = await ModeStorageManager.getMode();
                this.cachedModeByCourse.set(courseId, fallback);
                return fallback;
            } catch (error) {
                console.error("[ModeManager] Error getting mode for course:", error);
                return AppMode.STUDENT;
            }
        }

        if (this.cachedMode) {
            return this.cachedMode;
        }

        try {
            const mode = await ModeStorageManager.getMode();
            this.cachedMode = mode;
            return mode;
        } catch (error) {
            console.error("[ModeManager] Error getting mode:", error);
            return AppMode.STUDENT;
        }
    }

    /**
     * Sets the application mode.
     * If courseId is provided, the mode is persisted per-course.
     * @param mode Mode to set
     * @param courseId Optional course ID for per-course mode
     */
    static async setMode(mode: AppMode, courseId?: string): Promise<void> {
        try {
            if (courseId) {
                await ModeStorageManager.saveModeForCourse(courseId, mode);
                this.cachedModeByCourse.set(courseId, mode);
                console.log(`[ModeManager] Mode changed to: ${mode} (course ${courseId})`);
                return;
            }

            await ModeStorageManager.saveMode(mode);
            this.cachedMode = mode;
            console.log(`[ModeManager] Mode changed to: ${mode}`);
        } catch (error) {
            console.error("[ModeManager] Error setting mode:", error);
            throw error;
        }
    }

    /**
     * Checks if the current mode is teacher
     * @param courseId Optional course ID for per-course mode
     * @returns true if teacher mode
     */
    static async isTeacherMode(courseId?: string): Promise<boolean> {
        const mode = await this.getMode(courseId);
        return mode === AppMode.TEACHER;
    }

    /**
     * Checks if the current mode is student
     * @param courseId Optional course ID for per-course mode
     * @returns true if student mode
     */
    static async isStudentMode(courseId?: string): Promise<boolean> {
        const mode = await this.getMode(courseId);
        return mode === AppMode.STUDENT;
    }

    /**
     * Toggles between student and teacher mode
     * @param courseId Optional course ID for per-course mode
     * @returns The new mode
     */
    static async toggleMode(courseId?: string): Promise<AppMode> {
        const currentMode = await this.getMode(courseId);
        const newMode = currentMode === AppMode.TEACHER ? AppMode.STUDENT : AppMode.TEACHER;
        await this.setMode(newMode, courseId);
        return newMode;
    }

    /**
     * Clears the mode cache.
     * @param courseId If provided, clears only that course's cached mode; otherwise
     * clears the global cache and all per-course caches.
     */
    static clearCache(courseId?: string): void {
        if (courseId) {
            this.cachedModeByCourse.delete(courseId);
            return;
        }
        this.cachedMode = null;
        this.cachedModeByCourse.clear();
    }
}
