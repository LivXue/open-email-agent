import { ChatWebSocket, ConnectionState, WebSocketMessage } from './websocket';
import { MessageStorage } from './MessageStorage';

/**
 * Global WebSocket Manager
 *
 * This singleton manages a single WebSocket connection that persists
 * across all pages and components in the application.
 *
 * Key features:
 * - Single WebSocket instance for the entire application
 * - Persists across page navigation (Chat <-> Settings)
 * - Unique session ID per browser tab
 * - Message history caching in localStorage
 * - Automatic reconnection on disconnect
 * - Global message storage even when ChatPage is not active
 */
class WebSocketManagerClass {
  private ws: ChatWebSocket | null = null;
  private listeners: Set<(message: WebSocketMessage) => void> = new Set();
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private loadingListeners: Set<(isLoading: boolean) => void> = new Set();
  private connectionState: ConnectionState = 'disconnected';
  private isInitialized = false;
  private currentToolCalls: Array<{ tool: string; args: Record<string, unknown>, result?: string }> = [];
  private isWaitingForResponse = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: any[] | null = null;
  private cachedMessages: any[] | null = null; // Cache to avoid frequent localStorage reads

  /**
   * Initialize the WebSocket connection
   * Should be called once when the application starts
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('WebSocketManager already initialized');
      return;
    }

    console.log('Initializing WebSocketManager...');

    // Create WebSocket instance
    this.ws = new ChatWebSocket();

    // Set up state change listener
    this.ws.onStateChange((state) => {
      this.connectionState = state;
      // Notify all state listeners
      this.stateListeners.forEach(listener => {
        try {
          listener(state);
        } catch (error) {
          console.error('Error in state change listener:', error);
        }
      });
    });

    // Set up global message listener that always persists messages
    this.ws.connect(
      (message) => {
        // First, process the message globally (store to localStorage)
        this.handleGlobalMessage(message);

        // Then, forward message to all UI listeners
        this.listeners.forEach(listener => {
          try {
            listener(message);
          } catch (error) {
            console.error('Error in message listener:', error);
          }
        });
      },
      (error) => {
        console.error('WebSocket error:', error);
      },
      () => {
        console.log('WebSocket connection closed');
      }
    );

    this.isInitialized = true;
  }

  /**
   * Get the current connection state
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get cached messages or load from storage
   */
  private getMessages(): any[] {
    if (!this.cachedMessages) {
      this.cachedMessages = MessageStorage.load();
    }
    return this.cachedMessages;
  }

  /**
   * Clear the message cache (call after external changes)
   */
  clearCache(): void {
    this.cachedMessages = null;
  }

  /**
   * Handle messages globally (store to localStorage)
   * This ensures messages are preserved even when ChatPage is not mounted
   * Uses setTimeout to avoid blocking the main thread
   */
  private handleGlobalMessage(message: WebSocketMessage): void {
    // Immediately forward to UI listeners (synchronous, fast)
    // Don't block this with setTimeout

    // Then use setTimeout to defer storage operations
    setTimeout(() => {
      const storedMessages = this.getMessages();

      switch (message.type) {
        case 'text':
          // Update the streaming content in storage
          const lastMessage = storedMessages[storedMessages.length - 1];
          if (lastMessage?.role === 'assistant' && this.isWaitingForResponse) {
            lastMessage.content += message.content;
            // Use throttled save to avoid blocking the main thread
            this.scheduleSave(storedMessages);
          }
          break;

        case 'tool_call':
          this.currentToolCalls.push({
            tool: message.tool,
            args: message.args
          });
          break;

        case 'tool_result':
          this.currentToolCalls = this.currentToolCalls.map(tc =>
            tc.tool === message.tool
              ? { ...tc, result: message.content }
              : tc
          );
          break;

        case 'status':
          if (message.content === 'Ready') {
            this.notifyLoadingChange(false);
            // Finalize the assistant message with tool calls
            if (this.currentToolCalls.length > 0) {
              const lastMessage = storedMessages[storedMessages.length - 1];
              if (lastMessage?.role === 'assistant') {
                lastMessage.toolCalls = [...this.currentToolCalls];
              }
              this.currentToolCalls = [];
            }
            // Immediate save on completion
            this.flushSave();
            MessageStorage.save(storedMessages);
          }
          break;

        case 'error':
          storedMessages.push({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${message.content}`,
            timestamp: new Date(),
          });
          this.notifyLoadingChange(false);
          // Immediate save on error
          this.flushSave();
          MessageStorage.save(storedMessages);
          break;
      }
    }, 0);
  }

  /**
   * Schedule a throttled save to localStorage
   * This prevents blocking the main thread with frequent I/O operations
   */
  private scheduleSave(messages: any[]): void {
    // Store the latest messages
    this.pendingMessages = messages;

    // Clear any existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Schedule a save in the near future (100ms)
    // This allows multiple rapid text chunks to be batched
    this.saveTimeout = setTimeout(() => {
      if (this.pendingMessages) {
        MessageStorage.save(this.pendingMessages);
        this.pendingMessages = null;
      }
    }, 100);
  }

  /**
   * Immediately flush any pending save
   */
  private flushSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.pendingMessages) {
      MessageStorage.save(this.pendingMessages);
      this.pendingMessages = null;
    }
  }

  /**
   * Notify all loading listeners of a state change
   */
  private notifyLoadingChange(isLoading: boolean): void {
    if (this.isWaitingForResponse !== isLoading) {
      this.isWaitingForResponse = isLoading;
      this.loadingListeners.forEach(listener => {
        try {
          listener(isLoading);
        } catch (error) {
          console.error('Error in loading listener:', error);
        }
      });
    }
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.ws?.getSessionId() || 'unknown';
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Check if currently waiting for a response
   */
  isWaiting(): boolean {
    return this.isWaitingForResponse;
  }

  /**
   * Subscribe to loading state changes
   * Returns an unsubscribe function
   */
  subscribeToLoading(callback: (isLoading: boolean) => void): () => void {
    // Call immediately with current state
    callback(this.isWaitingForResponse);
    this.loadingListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.loadingListeners.delete(callback);
    };
  }

  /**
   * Send a message through the WebSocket
   */
  send(message: string, history?: Array<{role: string; content: string}>, sessionId?: string): void {
    if (!this.ws) {
      console.error('WebSocket not initialized. Call initialize() first.');
      return;
    }

    const now = Date.now();
    const userMessage = {
      id: `user-${now}`,
      role: 'user' as const,
      content: message,
      timestamp: new Date(),
    };

    // Get or create message cache
    const storedMessages = this.getMessages();
    storedMessages.push(userMessage);

    // Create empty assistant message for streaming
    const assistantMessage = {
      id: `assistant-${now}`,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
    };
    storedMessages.push(assistantMessage);

    // Update cache
    this.cachedMessages = storedMessages;

    // Save to localStorage immediately for user messages
    // This ensures user messages are visible immediately
    MessageStorage.save(storedMessages);

    // Mark that we're waiting for a response and notify listeners
    this.notifyLoadingChange(true);
    this.currentToolCalls = [];

    // Send the message
    this.ws.send(message, history, sessionId);

    // Notify listeners that messages have been updated
    // This will trigger ChatPage to reload from localStorage
    this.notifyMessagesUpdated();
  }

  /**
   * Notify listeners that messages have been updated
   * Use a special message type to trigger reload
   */
  private notifyMessagesUpdated(): void {
    setTimeout(() => {
      this.listeners.forEach(listener => {
        try {
          listener({
            type: 'text',
            content: '__MESSAGES_UPDATED__',
            role: 'system'
          } as any);
        } catch (error) {
          console.error('Error in message listener:', error);
        }
      });
    }, 0);
  }

  /**
   * Subscribe to WebSocket messages
   * Returns an unsubscribe function
   */
  subscribe(callback: (message: WebSocketMessage) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to connection state changes
   * Returns an unsubscribe function
   */
  subscribeToState(callback: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  /**
   * Disconnect the WebSocket
   * Should only be called when the application is completely closing
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }
    this.isInitialized = false;
    this.listeners.clear();
    this.stateListeners.clear();
    this.loadingListeners.clear();

    // Clear any pending save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.pendingMessages = null;
    this.cachedMessages = null;
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    if (this.ws) {
      this.ws.clearQueue();
    }
  }
}

// Export singleton instance
export const WebSocketManager = new WebSocketManagerClass();
