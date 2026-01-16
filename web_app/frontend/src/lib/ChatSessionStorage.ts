/**
 * ChatSessionStorage - Manages multiple chat sessions
 * Each session has its own messages, agent ID, and metadata
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;  // First user message or "New Chat"
  messages: ChatMessage[];
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = 'chat_sessions';
const CURRENT_SESSION_KEY = 'current_chat_session_id';

export class ChatSessionStorage {
  /**
   * Get all chat sessions
   */
  static getAllSessions(): ChatSession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];

      const sessions = JSON.parse(data);
      return sessions.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      return [];
    }
  }

  /**
   * Save all chat sessions
   */
  static saveAllSessions(sessions: ChatSession[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving chat sessions:', error);
    }
  }

  /**
   * Get a specific session by ID
   */
  static getSession(sessionId: string): ChatSession | null {
    const sessions = this.getAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  /**
   * Create a new chat session
   */
  static createSession(agentId: string): ChatSession {
    const newSession: ChatSession = {
      id: this.generateId(),
      title: 'New Chat',
      messages: [],
      agentId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const sessions = this.getAllSessions();
    sessions.unshift(newSession); // Add to beginning
    this.saveAllSessions(sessions);

    // Set as current session
    this.setCurrentSession(newSession.id);

    return newSession;
  }

  /**
   * Update a session's messages
   */
  static updateSessionMessages(sessionId: string, messages: ChatMessage[]): void {
    const sessions = this.getAllSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);

    if (sessionIndex === -1) {
      console.error('Session not found:', sessionId);
      return;
    }

    // Update messages and timestamp
    sessions[sessionIndex].messages = messages;
    sessions[sessionIndex].updatedAt = new Date();

    // Update title if it's still "New Chat" and we have messages
    if (sessions[sessionIndex].title === 'New Chat' && messages.length > 0) {
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        sessions[sessionIndex].title = this.generateTitle(firstUserMessage.content);
      }
    }

    this.saveAllSessions(sessions);
  }

  /**
   * Delete a session
   */
  static deleteSession(sessionId: string): void {
    console.log('[ChatSessionStorage] Deleting session:', sessionId);

    let sessions = this.getAllSessions();
    console.log('[ChatSessionStorage] Sessions before delete:', sessions.map(s => s.id));

    sessions = sessions.filter(s => s.id !== sessionId);
    this.saveAllSessions(sessions);

    console.log('[ChatSessionStorage] Sessions after delete:', sessions.map(s => s.id));

    // If deleted session was current, clear current session
    if (this.getCurrentSessionId() === sessionId) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
      console.log('[ChatSessionStorage] Cleared current session ID');
    }

    // Verify deletion
    const verify = this.getAllSessions();
    const deleted = verify.find(s => s.id === sessionId);
    console.log('[ChatSessionStorage] Verification - session still exists:', !!deleted);
  }

  /**
   * Get current session ID
   */
  static getCurrentSessionId(): string | null {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  }

  /**
   * Set current session ID
   */
  static setCurrentSession(sessionId: string): void {
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
  }

  /**
   * Clear current session ID
   */
  static clearCurrentSession(): void {
    localStorage.removeItem(CURRENT_SESSION_KEY);
  }

  /**
   * Get or create current session
   */
  static getOrCreateCurrentSession(agentId: string): ChatSession {
    const currentSessionId = this.getCurrentSessionId();

    if (currentSessionId) {
      const session = this.getSession(currentSessionId);
      if (session) {
        return session;
      }
    }

    // No current session, create new one
    return this.createSession(agentId);
  }

  /**
   * Generate a unique ID
   */
  static generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a title from the first message
   */
  static generateTitle(message: string, maxLength: number = 50): string {
    // Remove common prefixes
    let title = message
      .replace(/^(请帮我|帮我|请|can you please|please)/i, '')
      .trim();

    // Truncate if too long
    if (title.length > maxLength) {
      title = title.substring(0, maxLength) + '...';
    }

    return title || 'New Chat';
  }

  /**
   * Rename a session
   */
  static renameSession(sessionId: string, newTitle: string): void {
    const sessions = this.getAllSessions();
    const session = sessions.find(s => s.id === sessionId);

    if (session) {
      session.title = newTitle;
      session.updatedAt = new Date();
      this.saveAllSessions(sessions);
    }
  }
}
