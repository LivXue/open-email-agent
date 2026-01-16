import { Message } from '../components/ChatMessage';

const STORAGE_KEY = 'mailmind_chat_messages';
const MAX_MESSAGES = 100; // Limit to prevent localStorage overflow

/**
 * Message Storage Utility
 *
 * Manages persistent storage of chat messages in localStorage.
 * Messages persist across page refreshes and navigation.
 */
export class MessageStorage {
  /**
   * Load messages from localStorage
   */
  static load(): Message[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const messages = JSON.parse(stored);

      // Convert timestamp strings back to Date objects
      return messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Failed to load messages from storage:', error);
      return [];
    }
  }

  /**
   * Save messages to localStorage
   */
  static save(messages: Message[]): void {
    try {
      // Keep only the most recent MAX_MESSAGES messages
      const toSave = messages.slice(-MAX_MESSAGES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save messages to storage:', error);

      // If quota exceeded, try saving with fewer messages
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          const reduced = messages.slice(-MAX_MESSAGES / 2);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
          console.warn('Reduced message count due to storage limits');
        } catch (retryError) {
          console.error('Failed to save even with reduced messages:', retryError);
        }
      }
    }
  }

  /**
   * Add a single message to storage
   */
  static addMessage(message: Message): void {
    const messages = this.load();
    messages.push(message);
    this.save(messages);
  }

  /**
   * Clear all messages from storage
   */
  static clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear messages from storage:', error);
    }
  }

  /**
   * Get message count
   */
  static count(): number {
    return this.load().length;
  }
}
