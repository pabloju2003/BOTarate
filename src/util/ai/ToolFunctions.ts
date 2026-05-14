import { Course } from "../egela/Course";
import { FileManager } from "../egela/FileManager";
import { OpenAIService } from "./OpenAIService";

export class ToolFunctions {
    /**
     * Gets the content of a course section
     */
    static async getSectionContent(course: Course, args: { sectionId: string }): Promise<string> {
        return await course.getSectionContent(args.sectionId);
    }

    /**
     * Gets the content of a course page
     */
    static async getPageContent(course: Course, args: { pageId: string }): Promise<string> {
        return (await course.getPageContent(args.pageId)).markdown;
    }

    /**
     * Gets the content of a course resource
     * - PDFs: converted to text to save tokens
     * - Images: not processed for now (returns metadata only)
     * - Text/HTML: content extracted directly
     */
    static async getResourceContent(
        course: Course,
        args: { resourceId: string }
    ): Promise<string> {
        const fileData = await course.getResourceFile(args.resourceId);
        const mimeType = fileData.mimeType.toLowerCase();

        // PDFs: convert to text
        if (mimeType === 'application/pdf') {
            return await this.extractPdfText(fileData);
        }

        // Images: return metadata only for now
        if (mimeType.startsWith('image/')) {
            return this.getImageMetadata(fileData);
        }

        // Plain text, HTML, markdown, etc.
        const textMimeTypes = [
            'text/html',
            'text/plain',
            'text/markdown',
            'application/json',
            'text/csv'
        ];

        if (textMimeTypes.some(type => mimeType.includes(type))) {
            return await this.extractTextContent(fileData);
        }

        // Unsupported formats
        return this.getMetadataOnly(fileData);
    }

    /**
     * Extracts text from a PDF by delegating to the content script
     * (Background/service worker doesn't have access to window, required for pdf.js)
     */
    private static async extractPdfText(fileData: any): Promise<string> {
        try {
            // Convert blob to base64 to send to content script
            const arrayBuffer = await fileData.blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                binary += String.fromCharCode(...chunk);
            }
            const base64 = btoa(binary);

            // Get active tab to send the PDF
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs.length || !tabs[0].id) {
                throw new Error('No active tab available to process the PDF');
            }

            // Send to content script for text extraction
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'extractPdfText',
                pdfBase64: base64,
                filename: fileData.filename,
                resourceName: fileData.resourceName,
                size: fileData.size
            });

            if (!response?.success) {
                throw new Error(response?.error || 'Unknown error extracting PDF text');
            }

            return response.text;
        } catch (error) {
            console.error('[getResourceContent] Error extracting PDF text:', error);
            return `File: ${fileData.resourceName} (${fileData.filename})\nType: PDF\nSize: ${(fileData.size / 1024).toFixed(2)} KB\n\nError: Could not extract PDF text. ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    /**
     * Returns metadata for an image (without processing visual content)
     */
    private static getImageMetadata(fileData: any): string {
        return `File: ${fileData.resourceName} (${fileData.filename})\nType: ${fileData.mimeType}\nSize: ${(fileData.size / 1024).toFixed(2)} KB\n\nNote: Images are not processed currently. Only file metadata is provided.`;
    }

    /**
     * Extracts text content from a file
     */
    private static async extractTextContent(fileData: any): Promise<string> {
        const text = await fileData.blob.text();
        return `File: ${fileData.resourceName} (${fileData.filename})\nType: ${fileData.mimeType}\nSize: ${(fileData.size / 1024).toFixed(2)} KB\n\nCONTENT:\n${text}`;
    }

    /**
     * Returns metadata only for unsupported file types
     */
    private static getMetadataOnly(fileData: any): string {
        return `File: ${fileData.resourceName} (${fileData.filename})\nType: ${fileData.mimeType}\nSize: ${(fileData.size / 1024).toFixed(2)} KB\n\nNote: This file type is not supported for content extraction.`;
    }

    /**
     * Requests an explanation for a specific exercise
     * Sends a message to the content script to open the explanation modal
     */
    static async explainExercise(args: { exerciseIndex: number }): Promise<string> {
        // LLM sends 1-based indices (1, 2, 3...), but arrays use 0-based indices
        const arrayIndex = args.exerciseIndex - 1;

        // Send message to active tab to open the modal
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tabs.length > 0 && tabs[0].id) {
            try {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'openExerciseModal',
                    exerciseIndex: arrayIndex
                });

                return `Opening the explanation modal for exercise #${args.exerciseIndex}...`;
            } catch (error) {
                console.error('[explainExercise] Error sending message to content script:', error);
                return `Error opening modal for exercise #${args.exerciseIndex}`;
            }
        }

        return `Could not open modal. Make sure you are on the correct page.`;
    }

    /**
     * Requests student solution submission for a specific exercise
     * Sends a message to the content script to open the solution modal
     */
    static async solveExercise(args: { exerciseIndex: number }): Promise<string> {
        // LLM sends 1-based indices (1, 2, 3...), but arrays use 0-based indices
        const arrayIndex = args.exerciseIndex - 1;

        // Send message to active tab to open the modal
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tabs.length > 0 && tabs[0].id) {
            try {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'openSolutionModal',
                    exerciseIndex: arrayIndex
                });

                return `Opening the solution form for exercise #${args.exerciseIndex}...`;
            } catch (error) {
                console.error('[solveExercise] Error sending message to content script:', error);
                return `Error opening form for exercise #${args.exerciseIndex}`;
            }
        }

        return `Could not open form. Make sure you are on the correct page.`;
    }

    /**
     * Opens the iterative Refiner modal for an exercise configured in refiner mode.
     */
    static async refineExercise(args: { exerciseIndex: number }): Promise<string> {
        const arrayIndex = args.exerciseIndex - 1;
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tabs.length > 0 && tabs[0].id) {
            try {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'openRefinerModal',
                    exerciseIndex: arrayIndex
                });
                return `Opening the Refiner draft form for exercise #${args.exerciseIndex}...`;
            } catch (error) {
                console.error('[refineExercise] Error sending message to content script:', error);
                return `Error opening Refiner form for exercise #${args.exerciseIndex}`;
            }
        }

        return `Could not open Refiner form. Make sure you are on the correct page.`;
    }

    /**
     * Gets the content of a text file filtered by a regular expression
     * @param args Arguments with pageId, fileId and regexPattern
     * @returns Filtered file content
     */
    static getFilteredFileContent(args: { pageId: string; fileId: string; regexPattern: string }): string {
        return FileManager.getFilteredTextContent(args.pageId, args.fileId, args.regexPattern);
    }

    /**
     * Analyzes an image using the vision model.
     * Retrieves the image from the cache and sends it to the vision model with the given prompt.
     * @param args Arguments with pageId, imageId and prompt
     * @returns The vision model's analysis of the image
     */
    static async analyzeImage(args: { pageId: string; imageId: string; prompt: string }): Promise<string> {
        const { pageId, imageId, prompt } = args;

        // Get the image from cache
        const imageData = FileManager.getCachedFile(pageId, imageId);

        if (!imageData) {
            return `Error: Image ${imageId} not found on page ${pageId}. Make sure the image ID is correct (e.g., IMAGE1, IMAGE2).`;
        }

        if (!imageData.dataUrl) {
            return `Error: Image ${imageId} does not have valid image data. The image may have failed to download.`;
        }

        // Verify it's actually an image
        if (!imageData.mimeType?.startsWith('image/')) {
            return `Error: ${imageId} is not an image (type: ${imageData.mimeType}). Use getFilteredFileContent for text files.`;
        }

        try {
            console.log(`[ToolFunctions.analyzeImage] Analyzing ${imageId} with prompt: ${prompt.substring(0, 100)}...`);

            const analysis = await OpenAIService.analyzeImage(imageData.dataUrl, prompt);

            return `Analysis of ${imageId} (${imageData.filename}):\n\n${analysis}`;
        } catch (error) {
            console.error('[ToolFunctions.analyzeImage] Error:', error);
            return `Error analyzing image ${imageId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}