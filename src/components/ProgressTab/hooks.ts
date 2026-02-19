import { useEffect, useState } from "react";
import {
    LabProgress,
    ProgressManager,
} from "../../util/progress/ProgressManager";

export const useProgressData = (courseId: string) => {
    const [labProgress, setLabProgress] = useState<LabProgress[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        loadProgressData();
    }, [courseId]);

    const loadProgressData = async () => {
        setIsLoading(true);
        try {
            const progressData = await ProgressManager.loadProgressData(courseId);
            setLabProgress(progressData.labs);
        } catch (error) {
            console.error("[ProgressTab] Error loading progress data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return { labProgress, isLoading };
};