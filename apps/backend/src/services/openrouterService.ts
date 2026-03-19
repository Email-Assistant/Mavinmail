import axios from "axios";
import logger from '../utils/logger.js';

export class OpenRouterService {
    private static apiKey = process.env.OPENROUTER_API_KEY;
    // Models from .env or database
    private static defaultModel = process.env.DEFAULT_AI_MODEL;
    private static fallbackModel = process.env.FALLBACK_AI_MODEL;

    /**
     * Generates text content using the OpenRouter API.
     * @param prompt The prompt to send to the AI.
     * @param model The model to use (optional, defaults to env default).
     * @returns The generated text response.
     */
    static async generateContent(prompt: string, model?: string): Promise<string> {
        const selectedModel = model || this.defaultModel;
        logger.info(`[OpenRouter] Sending request to model: ${selectedModel}`);

        const maxRetries = 3;
        let retryCount = 0;
        let lastError: any = null;

        while (retryCount < maxRetries) {
            try {
                const response = await axios.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    {
                        model: selectedModel,
                        messages: [
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                    },
                    {
                        headers: {
                            "Authorization": `Bearer ${this.apiKey}`,
                            "HTTP-Referer": "http://localhost:3000",
                            "X-Title": "Mavinmail Email Assistant"
                        },
                        timeout: 120000 // 120 second timeout for reasoning models
                    }
                );

                // Debug: log raw response structure
                logger.info(`[OpenRouter] Response status: ${response.status}`);

                // Validate response structure
                if (!response.data) {
                    logger.error("[OpenRouter] Empty response data");
                    throw new Error("Empty response from OpenRouter");
                }

                // Check for API-level errors
                if (response.data.error) {
                    logger.error("[OpenRouter] API Error:", response.data.error);
                    throw new Error(`OpenRouter API Error: ${response.data.error.message || JSON.stringify(response.data.error)}`);
                }

                // Validate choices array
                if (!response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
                    logger.error("[OpenRouter] Invalid response structure:", JSON.stringify(response.data, null, 2));
                    throw new Error("Invalid response structure: missing choices array");
                }

                const choice = response.data.choices[0];

                // Handle different response formats (some models use different structures)
                let content: string | undefined;

                if (choice.message?.content) {
                    content = choice.message.content;
                } else if (choice.text) {
                    // Some models return text directly
                    content = choice.text;
                } else if (choice.content) {
                    content = choice.content;
                }

                if (!content) {
                    logger.error("[OpenRouter] No content in response choice:", JSON.stringify(choice, null, 2));
                    throw new Error("No content in OpenRouter response");
                }

                logger.info(`[OpenRouter] Success! Got ${content.length} chars`);
                return content;

            } catch (err: any) {
                lastError = err;

                // Log API key for debugging (prefix only)
                const keyPrefix = this.apiKey ? this.apiKey.substring(0, 12) + "..." : "UNDEFINED";
                logger.info(`[OpenRouter Debug] API Key prefix: ${keyPrefix}`);

                // Handle rate limiting
                if (err.response?.status === 429) {
                    retryCount++;
                    const delay = Math.pow(2, retryCount) * 1000;
                    logger.warn(`[OpenRouter] Rate limited (429). Retry ${retryCount}/${maxRetries} in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Handle model not found - try fallback
                if (err.response?.status === 404 || err.response?.status === 400) {
                    logger.error(`[OpenRouter] Model error (${err.response?.status}):`, err.response?.data);

                    // Try fallback model once
                    if (selectedModel !== this.fallbackModel && this.fallbackModel && retryCount === 0) {
                        logger.info(`[OpenRouter] Trying fallback model: ${this.fallbackModel}`);
                        retryCount++;
                        return this.generateContent(prompt, this.fallbackModel);
                    }
                }

                // Log the full error for debugging
                logger.error("[OpenRouter] Request failed:", {
                    status: err.response?.status,
                    data: err.response?.data,
                    message: err.message
                });

                throw new Error(`OpenRouter request failed: ${err.message}`);
            }
        }

        throw new Error(`OpenRouter request failed after ${maxRetries} retries: ${lastError?.message}`);
    }

    /**
     * Generates a JSON response from the OpenRouter API.
     * Includes prompt engineering to enforce JSON output and strict parsing.
     * @param prompt The prompt to send.
     * @param model The model to use.
     * @returns The parsed JSON object.
     */
    static async generateJSON(prompt: string, model?: string): Promise<any> {
        // Augment prompt to ensure JSON
        const jsonPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown code fences. No explanations. No thinking. Just the JSON object.`;

        const rawContent = await this.generateContent(jsonPrompt, model);

        // Robust JSON extraction: Find the first '{' and the last '}'
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);

        const cleaned = jsonMatch ? jsonMatch[0] : rawContent;

        try {
            return JSON.parse(cleaned);
        } catch (e) {
            logger.error("[OpenRouter] Failed to parse JSON. Raw output:", rawContent.substring(0, 500));
            logger.error("Cleaned output was:", cleaned.substring(0, 500));
            throw new Error("AI returned invalid JSON.");
        }
    }

    /**
     * 🚀 STREAMING: Generates text content using SSE streaming.
     * Calls the callback with each text chunk as it arrives.
     * @param prompt The prompt to send to the AI.
     * @param onChunk Callback function called with each text chunk.
     * @param model The model to use (optional).
     */
    static async generateContentStream(
        prompt: string,
        onChunk: (chunk: string) => void,
        model?: string
    ): Promise<string> {
        const selectedModel = model || this.defaultModel;
        logger.info(`[OpenRouter] Starting stream to model: ${selectedModel}`);

        try {
            const response = await axios.post(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    model: selectedModel,
                    messages: [{ role: "user", content: prompt }],
                    stream: true,  // Enable streaming
                },
                {
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "Mavinmail Email Assistant"
                    },
                    responseType: 'stream',
                    timeout: 120000
                }
            );

            let fullContent = '';

            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk: Buffer) => {
                    const lines = chunk.toString().split('\n').filter((line: string) => line.trim());

                    for (const line of lines) {
                        if (line === 'data: [DONE]') {
                            continue;
                        }

                        if (line.startsWith('data: ')) {
                            try {
                                const json = JSON.parse(line.slice(6));
                                const content = json.choices?.[0]?.delta?.content;
                                if (content) {
                                    fullContent += content;
                                    onChunk(content);  // Call callback with chunk
                                }
                            } catch (e) {
                                // Ignore parse errors for individual chunks
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    logger.info(`[OpenRouter] Stream complete, ${fullContent.length} chars`);
                    resolve(fullContent);
                });

                response.data.on('error', (err: Error) => {
                    logger.error('[OpenRouter] Stream error:', err);
                    reject(err);
                });
            });

        } catch (err: any) {
            logger.error("[OpenRouter] Streaming request failed:", err.message);
            throw new Error(`OpenRouter streaming failed: ${err.message}`);
        }
    }
}
