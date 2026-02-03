import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, AlertCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ChatMessage as MessageComponent, Message } from '../components/ChatMessage';
import { ChatListSidebar } from '../components/ChatListSidebar';
import { TempFileList, TempFileUploadButton, TempFileProvider } from '../components/TempFileUploader';
import { ConnectionState, WebSocketMessage } from '../lib/websocket';
import { WebSocketManager } from '../lib/WebSocketManager';
import { MessageStorage } from '../lib/MessageStorage';
import { ChatSession, ChatSessionStorage } from '../lib/ChatSessionStorage';
import { useToast } from '../contexts/ToastContext';

export function ChatPage() {
  const { showError, showWarning } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentToolCallsRef = useRef<Message['toolCalls']>([]);

  // Helper function to get connection status text
  const getConnectionStatusText = (state: ConnectionState): { text: string; color: string } => {
    switch (state) {
      case 'connected':
        return { text: '● Connected', color: 'text-green-600' };
      case 'connecting':
        return { text: '● Connecting...', color: 'text-yellow-600' };
      case 'reconnecting':
        return { text: '● Reconnecting...', color: 'text-orange-600' };
      case 'disconnected':
        return { text: '● Disconnected', color: 'text-red-600' };
      default:
        return { text: '● Unknown', color: 'text-gray-600' };
    }
  };

  const isConnected = connectionState === 'connected';

  useEffect(() => {
    // Initialize session
    initializeOrLoadSession();

    // Initialize WebSocket manager if not already initialized
    if (!WebSocketManager) {
      console.error('WebSocketManager not available');
      return;
    }

    // Subscribe to state changes
    const unsubscribeState = WebSocketManager.subscribeToState((state) => {
      setConnectionState(state);
    });

    // Set initial state
    setConnectionState(WebSocketManager.getState());

    // Subscribe to loading state changes
    const unsubscribeLoading = WebSocketManager.subscribeToLoading((loading) => {
      setIsLoading(loading);
    });

    // Subscribe to messages for UI updates only
    const unsubscribe = WebSocketManager.subscribe((message) => {
      handleMessageForUI(message);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      unsubscribeState();
      unsubscribeLoading();
    };
  }, []); // Run only once on mount

  // Use ref to track current session ID to avoid dependency issues
  const currentSessionIdRef = useRef<string | null>(null);

  // Initialize or load session
  const initializeOrLoadSession = () => {
    // Generate or get agent ID for this session
    // For simplicity, use a fixed agent ID for now
    // In production, you might want to create separate agents per session
    const agentId = 'default_agent';

    const session = ChatSessionStorage.getOrCreateCurrentSession(agentId);
    setCurrentSession(session);
    currentSessionIdRef.current = session.id; // Update ref

    // Load messages for this session
    setMessages(session.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    })));

    // Update legacy MessageStorage for backward compatibility
    MessageStorage.save(session.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    })));
  };

  // Load messages from current session
  const loadMessagesFromSession = () => {
    const sessionId = currentSessionIdRef.current;
    if (!sessionId) return;

    const session = ChatSessionStorage.getSession(sessionId);
    if (session) {
      setCurrentSession(session);
      setMessages(session.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      })));

      // Update legacy storage
      MessageStorage.save(session.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      })));
    }
  };

  // Handle session selection
  const handleSessionSelect = (session: ChatSession) => {
    // Don't switch if it's the same session
    if (session.id === currentSessionIdRef.current) {
      return;
    }

    // Prevent switching while agent is processing
    if (isLoading) {
      showWarning('Please wait for the current message to complete before switching chats.');
      return;
    }

    // Clear current messages
    setMessages([]);

    // Update current session
    ChatSessionStorage.setCurrentSession(session.id);
    setCurrentSession(session);
    currentSessionIdRef.current = session.id; // Update ref

    // Load messages for the new session
    loadMessagesFromSession();

    // Clear WebSocketManager cache and message queue
    WebSocketManager.clearCache();
    WebSocketManager.clearQueue();

    // The next message sent will use the new session ID from currentSessionIdRef
    console.log('Switched to session:', session.id);
  };

  // Handle new chat
  const handleNewChat = () => {
    // Prevent creating new chat while agent is processing
    if (isLoading) {
      showWarning('Please wait for the current message to complete before creating a new chat.');
      return;
    }

    const agentId = 'default_agent';
    const newSession = ChatSessionStorage.createSession(agentId);
    handleSessionSelect(newSession);
  };

  // Handle messages for UI updates
  const handleMessageForUI = useCallback((message: WebSocketMessage) => {
    // Special message to trigger reload from storage
    if (message.type === 'text' && message.content === '__MESSAGES_UPDATED__') {
      loadMessagesFromSession();
      return;
    }

    switch (message.type) {
      case 'text':
        // Update the streaming content in UI
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === 'assistant') {
            return prev.map((msg, idx) =>
              idx === prev.length - 1
                ? { ...msg, content: msg.content + message.content }
                : msg
            );
          }
          return prev;
        });
        break;

      case 'tool_call':
        currentToolCallsRef.current = [
          ...(currentToolCallsRef.current || []),
          { tool: message.tool, args: message.args }
        ];

        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === 'assistant') {
            return prev.map((msg, idx) =>
              idx === prev.length - 1
                ? { ...msg, toolCalls: currentToolCallsRef.current }
                : msg
            );
          }
          return prev;
        });
        break;

      case 'tool_result':
        if (currentToolCallsRef.current && currentToolCallsRef.current.length > 0) {
          const lastToolCall = currentToolCallsRef.current[currentToolCallsRef.current.length - 1];
          if (lastToolCall.tool === message.tool) {
            lastToolCall.result = message.content;
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage?.role === 'assistant') {
                return prev.map((msg, idx) =>
                  idx === prev.length - 1
                    ? { ...msg, toolCalls: [...(currentToolCallsRef.current || [])] }
                    : msg
                );
              }
              return prev;
            });
          }
        }
        break;

      case 'status':
        if (message.content === 'Ready') {
          currentToolCallsRef.current = [];

          // Save messages to session storage when agent finishes
          // Use functional update to avoid dependency on messages
          setMessages((prevMessages) => {
            const sessionId = currentSessionIdRef.current;
            if (sessionId) {
              ChatSessionStorage.updateSessionMessages(sessionId, prevMessages);
            }
            return prevMessages;
          });
        }
        break;

      case 'error':
        // Display error message as toast notification
        showError(message.content);

        // Also add error message to the chat for visibility
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === 'assistant') {
            // Append error to the last assistant message
            return prev.map((msg, idx) =>
              idx === prev.length - 1
                ? {
                    ...msg,
                    content: msg.content + `\n\n❌ **Error**: ${message.content}`
                  }
                : msg
            );
          }
          return prev;
        });
        break;
    }
  }, [showError]); // No dependencies - use ref for current session

  // Handle delete message
  const handleDeleteMessage = (messageId: string) => {
    const sessionId = currentSessionIdRef.current;
    if (!sessionId) return;

    // Find the index of the message to delete
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // Keep only messages before the deleted one
    const newMessages = messages.slice(0, messageIndex);

    // Update state
    setMessages(newMessages);

    // Update session storage
    ChatSessionStorage.updateSessionMessages(sessionId, newMessages);

    // Update legacy localStorage
    MessageStorage.save(newMessages);

    // Clear WebSocketManager cache
    WebSocketManager.clearCache();
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    const sessionId = currentSessionIdRef.current;
    if (!input.trim() || !isConnected || !sessionId) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    // Add user message to list
    setMessages((prev) => [...prev, userMessage]);

    // Clear input
    setInput('');

    // Save to session storage
    const updatedMessages = [...messages, userMessage];
    ChatSessionStorage.updateSessionMessages(sessionId, updatedMessages);

    // Send via WebSocket with session ID
    WebSocketManager.send(userMessage.content, updatedMessages, sessionId);

    // Prepare for assistant response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: '',
          timestamp: new Date()
        }
      ]);
    }, 100);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const { text: connectionText, color: connectionColor } = getConnectionStatusText(connectionState);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar - Chat List */}
      <ChatListSidebar
        currentSessionId={currentSession?.id || null}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        isCollapsed={sidebarCollapsed}
        isLoading={isLoading}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:shadow-sm"
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-gray-600" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {currentSession?.title || 'Chat'}
              </h1>
              <p className={`text-sm font-medium ${connectionColor} flex items-center gap-1.5`}>
                {connectionText}
              </p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 min-h-0">
          <div className="w-full h-full">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-2xl">
                  <div className="mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome to MailMind</h2>
                    <p className="text-lg text-gray-600">Your AI-powered email assistant. Start a conversation!</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 text-left shadow-sm">
                    <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Try asking me to:
                    </p>
                    <ul className="text-sm text-blue-800 space-y-2 ml-6">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>"Read my latest emails"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>"Send an email to john@example.com"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>"Search for emails about project updates"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>"Create a file with meeting notes"</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageComponent
                      key={message.id}
                      message={message}
                      onDelete={handleDeleteMessage}
                    />
                  ))}
                </div>
                {isLoading && (
                  <div className="flex gap-4 mt-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
                      <svg className="w-7 h-7 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {!isConnected ? (
            <div className="max-w-4xl mx-auto flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                {connectionState === 'connecting'
                  ? 'Connecting to server...'
                  : 'Disconnected from server. Please refresh the page.'}
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <TempFileProvider sessionId={currentSession?.id || null}>
                {/* Temporary Files List (above input) */}
                <TempFileList sessionId={currentSession?.id || null} />

                {/* Input Row */}
                <div className="flex gap-3">
                  {/* Upload Button */}
                  <TempFileUploadButton sessionId={currentSession?.id || null} />

                  {/* Message Input */}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-5 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm transition-all duration-200"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isLoading}
                    className="px-6 py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 font-medium shadow-md hover:shadow-lg disabled:shadow-sm"
                  >
                    <Send className="w-5 h-5" />
                    Send
                  </button>
                </div>
              </TempFileProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
