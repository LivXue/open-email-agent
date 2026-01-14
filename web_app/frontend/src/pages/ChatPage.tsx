import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { ChatMessage as MessageComponent, Message } from '../components/ChatMessage';
import { ChatWebSocket, ChatMessage } from '../lib/websocket';

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<Message['toolCalls']>([]);
  const wsRef = useRef<ChatWebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new ChatWebSocket();
    wsRef.current = ws;

    ws.connect(
      (message) => {
        switch (message.type) {
          case 'text':
            // Update the streaming content
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
            setCurrentToolCalls((prev) => [
              ...(prev || []),
              { tool: message.tool, args: message.args },
            ]);
            break;

          case 'tool_result':
            setCurrentToolCalls((prev) =>
              (prev || []).map((tc) =>
                tc.tool === message.tool ? { ...tc, result: message.content } : tc
              )
            );
            break;

          case 'status':
            if (message.content === 'Ready') {
              setIsLoading(false);
              // Finalize the assistant message with tool calls
              if (currentToolCalls && currentToolCalls.length > 0) {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.role === 'assistant') {
                    lastMessage.toolCalls = [...currentToolCalls];
                  }
                  return newMessages;
                });
                setCurrentToolCalls([]);
              }
            }
            break;

          case 'error':
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'assistant',
                content: `Error: ${message.content}`,
                timestamp: new Date(),
              },
            ]);
            setIsLoading(false);
            break;
        }
      },
      undefined,
      () => {
        setIsConnected(false);
        setIsLoading(false);
      }
    );

    // Set connected state after WebSocket connects
    setTimeout(() => {
      if (ws.isConnected()) {
        setIsConnected(true);
      }
    }, 500);

    return () => {
      ws.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isConnected || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Add empty assistant message for streaming
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    setInput('');
    setIsLoading(true);
    setCurrentToolCalls([]);

    // Prepare message history (all messages before the new user message)
    const history: ChatMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Send message via WebSocket with history
    wsRef.current?.send(input, history);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900">Chat</h2>
        <p className="text-sm text-gray-500">
          {isConnected ? (
            <span className="text-green-600">● Connected</span>
          ) : (
            <span className="text-red-600">● Disconnected</span>
          )}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg font-medium mb-2">Welcome to MailMind!</p>
            <p>Ask me to help you with your emails.</p>
            <p className="text-sm mt-4">Examples:</p>
            <ul className="text-sm mt-2 space-y-1">
              <li>"Read my latest emails"</li>
              <li>"Check my inbox"</li>
              <li>"Send an email to john@example.com"</li>
            </ul>
          </div>
        ) : (
          messages.map((message) => <MessageComponent key={message.id} message={message} />)
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="bg-white border-t border-gray-200 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={!isConnected || isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || !isConnected || isLoading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
