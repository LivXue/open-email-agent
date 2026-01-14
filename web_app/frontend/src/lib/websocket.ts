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

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws/chat`;
  }

  connect(
    onMessage: (message: WebSocketMessage) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        onClose?.();
        this.attemptReconnect(onMessage, onError, onClose);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }

  private attemptReconnect(
    onMessage: (message: WebSocketMessage) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(`Attempting to reconnect in ${delay}ms...`);

      setTimeout(() => {
        this.connect(onMessage, onError, onClose);
      }, delay);
    }
  }

  send(message: string, history?: Array<{role: string; content: string}>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        message,
        history: history || []
      }));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
