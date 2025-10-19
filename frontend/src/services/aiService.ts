interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface AIChatRequest {
    messages: AIMessage[];
    roomId: string;
}

interface AIExecuteToolRequest {
    toolName: string;
    parameters: Record<string, any>;
    roomId: string;
}

interface AICanvasContextRequest {
    roomId: string;
    includeMetadata?: boolean;
}

interface AIResponse {
    success: boolean;
    data?: any;
    error?: string;
    toolCalls?: Array<{
        name: string;
        parameters: Record<string, any>;
        result?: any;
    }>;
}

class AIService {
    private baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

    private async getAuthToken(): Promise<string | null> {
        // Get Firebase auth token
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            throw new Error('User not authenticated');
        }

        return await user.getIdToken();
    }

    private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<AIResponse> {
        try {
            const token = await this.getAuthToken();

            const response = await fetch(`${this.baseUrl}/api/ai${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            console.error('AI Service Error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Send a chat message to the AI assistant
     */
    async chat(request: AIChatRequest): Promise<AIResponse> {
        return this.makeRequest('/chat', {
            method: 'POST',
            body: JSON.stringify(request)
        });
    }

    /**
     * Execute a specific AI tool with parameters
     */
    async executeTool(request: AIExecuteToolRequest): Promise<AIResponse> {
        return this.makeRequest('/execute-tool', {
            method: 'POST',
            body: JSON.stringify(request)
        });
    }

    /**
     * Get current canvas context for AI awareness
     */
    async getCanvasContext(request: AICanvasContextRequest): Promise<AIResponse> {
        const params = new URLSearchParams();
        params.append('roomId', request.roomId);
        if (request.includeMetadata) {
            params.append('includeMetadata', 'true');
        }

        return this.makeRequest(`/canvas-context?${params.toString()}`, {
            method: 'GET'
        });
    }

    /**
     * Process a natural language command and return structured response
     */
    async processCommand(command: string, roomId: string): Promise<AIResponse> {
        // First get canvas context for AI awareness
        const contextResponse = await this.getCanvasContext({ roomId, includeMetadata: true });

        if (!contextResponse.success) {
            return contextResponse;
        }

        // Send chat request with context
        const messages: AIMessage[] = [
            {
                role: 'system',
                content: `You are an AI Canvas Assistant. The current canvas state is: ${JSON.stringify(contextResponse.data)}. 
        
        Available tools: createRectangle, createCircle, createText, moveObject, resizeObject, rotateObject, deleteObject, 
        arrangeObjectsInRow, arrangeObjectsInGrid, alignObjects, distributeObjects, getCanvasState, findObjects, 
        getCanvasBounds, clearCanvas.
        
        Respond to user commands by calling the appropriate tools. Always confirm what action you're taking.`
            },
            {
                role: 'user',
                content: command
            }
        ];

        return this.chat({ messages, roomId });
    }

    /**
     * Get available AI tools and their descriptions
     */
    async getAvailableTools(): Promise<AIResponse> {
        return this.makeRequest('/status', {
            method: 'GET'
        });
    }
}

// Export singleton instance
export const aiService = new AIService();
export type { AIMessage, AIChatRequest, AIExecuteToolRequest, AICanvasContextRequest, AIResponse };
