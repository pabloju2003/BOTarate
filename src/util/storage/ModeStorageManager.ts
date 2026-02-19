import { BaseStorageManager } from "./BaseStorageManager";

export enum AppMode {
    STUDENT = "student",
    TEACHER = "teacher"
}

interface ModeData {
    mode: AppMode;
}

interface UserRoleData {
    isTeacher: boolean;
}

interface DevModeConfig {
    forceTeacherRole: boolean;
}

/**
 * Storage manager for operation mode and user role
 */
export class ModeStorageManager extends BaseStorageManager {
    private static readonly MODE_STORAGE_KEY = "app_mode";
    private static readonly USER_ROLE_STORAGE_KEY = "user_role";
    private static readonly USER_ROLE_COURSE_PREFIX = "user_role_course_";
    private static readonly USER_ROLE_CACHE_DURATION = 3600000; // 1 hour in milliseconds
    private static readonly DEV_MODE_CONFIG_KEY = "dev_mode_config";

    /**
     * Saves the current operation mode
     * @param mode Mode to save
     */
    static async saveMode(mode: AppMode): Promise<void> {
        const data: ModeData = { mode };
        await this.saveData("", this.MODE_STORAGE_KEY, data);
    }

    /**
     * Gets the current operation mode
     * @returns Saved mode or default based on user role (TEACHER if teacher, STUDENT otherwise)
     */
    static async getMode(): Promise<AppMode> {
        const data = await this.getData<ModeData>("", this.MODE_STORAGE_KEY);
        if (data?.mode) {
            return data.mode;
        }

        // If no mode saved, check user role
        const roleData = await this.getUserRole();
        if (roleData && roleData.isValid && roleData.isTeacher) {
            return AppMode.TEACHER;
        }

        return AppMode.STUDENT;
    }

    /**
     * Gets user role if cached and valid
     * @returns Object with isTeacher and isValid, or null if no valid cache
     * @private Internal use only - used by getMode() for default mode detection
     */
    static async getUserRole(): Promise<{ isTeacher: boolean; isValid: boolean } | null> {
        const data = await this.getData<UserRoleData>("", this.USER_ROLE_STORAGE_KEY);

        if (!data) {
            return null;
        }

        // Check if cache is still valid
        const isValid = Date.now() - data.timestamp < this.USER_ROLE_CACHE_DURATION;

        return {
            isTeacher: data.isTeacher,
            isValid
        };
    }

    /**
     * Saves user role for a specific course
     * @param courseId Course ID
     * @param isTeacher true if user is teacher in this course
     */
    static async saveUserRoleForCourse(courseId: string, isTeacher: boolean): Promise<void> {
        const data: UserRoleData = { isTeacher };
        await this.saveData(this.USER_ROLE_COURSE_PREFIX, courseId, data);
    }

    /**
     * Gets user role for a specific course if cached and valid
     * @param courseId Course ID
     * @returns Object with isTeacher and isValid, or null if no valid cache
     */
    static async getUserRoleForCourse(courseId: string): Promise<{ isTeacher: boolean; isValid: boolean } | null> {
        const data = await this.getData<UserRoleData>(this.USER_ROLE_COURSE_PREFIX, courseId);

        if (!data) {
            return null;
        }

        const isValid = Date.now() - data.timestamp < this.USER_ROLE_CACHE_DURATION;

        return {
            isTeacher: data.isTeacher,
            isValid
        };
    }

    /**
     * Clears user role cache for a specific course
     */
    static async clearUserRoleCacheForCourse(courseId: string): Promise<void> {
        await this.removeData(this.USER_ROLE_COURSE_PREFIX, courseId);
    }

    /**
     * Clears all mode and role data
     */
    static async clearAll(): Promise<void> {
        await this.removeData("", this.MODE_STORAGE_KEY);
        await this.removeData("", this.USER_ROLE_STORAGE_KEY);
    }

    /**
     * Saves dev mode configuration
     * @param config Dev mode configuration
     */
    static async saveDevModeConfig(config: DevModeConfig): Promise<void> {
        await this.saveData("", this.DEV_MODE_CONFIG_KEY, config);
    }

    /**
     * Gets dev mode configuration
     * @returns Dev mode configuration or default values
     */
    static async getDevModeConfig(): Promise<DevModeConfig> {
        const data = await this.getData<DevModeConfig>("", this.DEV_MODE_CONFIG_KEY);
        return data ?? { forceTeacherRole: false };
    }
}
