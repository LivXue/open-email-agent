export type WebSocketMessage =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; content: string }
  | { type: 'status'; content: string }
  | { type: 'error'; content: string };

export interface ChatMessage {
  role: string;
  content: string;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  // IMPORTANT: This is the WebSocket CONNECTION ID, not the chat session ID
  // It identifies this WebSocket connection itself
  // Each chat session (ChatSession.id) is passed separately as chatSessionId parameter
  private sessionId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval = 30000; // 30 seconds
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private errorHandlers: ((error: Event) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private stateChangeHandlers: ((state: ConnectionState) => void)[] = [];
  private isManualClose = false;
  private messageQueue: Array<{ message: string; history?: Array<{role: string; content: string}>; chatSessionId?: string }> = [];

  constructor(sessionId?: string) {
    // Use provided sessionId or generate/persist one
    this.sessionId = sessionId || this.getOrCreateSessionId();

    // In development with Vite proxy, use the current host
    // The Vite proxy will forward WebSocket connections to the backend
    // Format: ws://localhost:3001/ws/chat -> proxy to -> ws://localhost:8001/ws/chat
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws/chat`;
    console.log('WebSocket URL constructed:', this.url, 'Session ID:', this.sessionId);
  }

  /**
   * Get existing session ID from localStorage or create a new one
   */
  private getOrCreateSessionId(): string {
    const storageKey = 'mailmind_session_id';
    let sessionId = localStorage.getItem(storageKey);

    if (!sessionId) {
      // Generate a new session ID
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(storageKey, sessionId);
      console.log('Generated new session ID:', sessionId);
    } else {
      console.log('Using existing session ID:', sessionId);
    }

    return sessionId;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  private notifyStateChange(state: ConnectionState): void {
    this.stateChangeHandlers.forEach(handler => handler(state));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimeout = setTimeout(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Send a ping to keep connection alive
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
      this.startHeartbeat();
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  connect(
    onMessage: (message: WebSocketMessage) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): void {
    // Register handlers only if not already registered
    if (onMessage && !this.messageHandlers.includes(onMessage)) {
      this.messageHandlers.push(onMessage);
    }
    if (onError && !this.errorHandlers.includes(onError)) {
      this.errorHandlers.push(onError);
    }
    if (onClose && !this.closeHandlers.includes(onClose)) {
      this.closeHandlers.push(onClose);
    }

    // If already connecting or connected, don't reconnect
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    // Reset manual close flag when attempting to connect
    this.isManualClose = false;
    this.notifyStateChange('connecting');

    try {
      console.log('Connecting to WebSocket:', this.url);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.notifyStateChange('connected');
        this.startHeartbeat();

        // Send queued messages
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          // Create a copy of handlers array to avoid issues if handlers are modified during iteration
          [...this.messageHandlers].forEach(handler => {
            try {
              handler(message);
            } catch (err) {
              console.error('Error in message handler:', err);
            }
          });
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        // Suppress error logging if manually closed (component unmounting)
        if (!this.isManualClose) {
          console.error('WebSocket error event:', error);
        }
        // Create a copy of handlers array to avoid issues if handlers are modified during iteration
        [...this.errorHandlers].forEach(handler => {
          try {
            handler(error);
          } catch (err) {
            console.error('Error in error handler:', err);
          }
        });
      };

      this.ws.onclose = (event) => {
        // Only log if not manually closed
        if (!this.isManualClose) {
          console.log('WebSocket closed - Code:', event.code, 'Reason:', event.reason || 'none');
        }
        this.stopHeartbeat();
        this.ws = null;

        // Create a copy of handlers array to avoid issues if handlers are modified during iteration
        [...this.closeHandlers].forEach(handler => {
          try {
            handler();
          } catch (err) {
            console.error('Error in close handler:', err);
          }
        });

        // Attempt to reconnect if not manually closed
        if (!this.isManualClose) {
          this.attemptReconnect();
        } else {
          this.notifyStateChange('disconnected');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.notifyStateChange('disconnected');
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay
      );

      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.notifyStateChange('reconnecting');

      this.reconnectTimeout = setTimeout(() => {
        this.connect(
          this.messageHandlers[0],
          this.errorHandlers[0],
          this.closeHandlers[0]
        );
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.notifyStateChange('disconnected');
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const queued = this.messageQueue.shift();
      if (queued) {
        this.sendImmediate(queued.message, queued.history, queued.chatSessionId);
      }
    }
  }

  send(message: string, history?: Array<{role: string; content: string}>, chatSessionId?: string): void {
    if (this.isConnected()) {
      this.sendImmediate(message, history, chatSessionId);
    } else {
      console.log('WebSocket not connected, queuing message');
      this.messageQueue.push({ message, history, chatSessionId });

      // Trigger reconnection if not already reconnecting
      if (!this.reconnectTimeout && !this.isManualClose) {
        this.attemptReconnect();
      }
    }
  }

  private sendImmediate(message: string, history?: Array<{role: string; content: string}>, chatSessionId?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        // CRITICAL: chatSessionId is the CHAT SESSION ID (from ChatSession.id)
        // this.sessionId is the WebSocket CONNECTION ID
        // We always prefer chatSessionId for multi-chat support
        // backend uses this session_id to route to the correct agent instance
        const sessionId = chatSessionId || this.sessionId;
        this.ws.send(JSON.stringify({
          message,
          history: history || [],
          session_id: sessionId  // This is the chat session ID for routing to correct agent
        }));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    }
  }

  onStateChange(handler: (state: ConnectionState) => void): void {
    this.stateChangeHandlers.push(handler);
  }

  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear handlers immediately to prevent any further callbacks
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.closeHandlers = [];
    this.stateChangeHandlers = [];

    if (this.ws) {
      // Remove event listeners to prevent callbacks after cleanup
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;

      // Close the WebSocket if it's open or connecting
      // Use a small timeout to allow the connection to complete if it's almost done
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Component unmounting');
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
        // If still connecting, close immediately with a different code
        // This prevents the "WebSocket is closed before connection established" error
        try {
          this.ws.close(1000, 'Component unmounting');
        } catch (e) {
          // Ignore errors when closing a connecting WebSocket
          console.log('WebSocket closed while connecting');
        }
      }
      this.ws = null;
    }

    // Clear message queue
    this.messageQueue = [];
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getState(): ConnectionState {
    if (this.reconnectTimeout) return 'reconnecting';
    if (!this.ws) return 'disconnected';
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting';
    if (this.ws.readyState === WebSocket.OPEN) return 'connected';
    if (this.isManualClose) return 'disconnected';
    return 'disconnected';
  }

  clearQueue(): void {
    this.messageQueue = [];
  }
}
