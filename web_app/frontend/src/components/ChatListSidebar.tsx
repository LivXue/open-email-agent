import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react';
import { ChatSession, ChatSessionStorage } from '../lib/ChatSessionStorage';

interface ChatListSidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (session: ChatSession) => void;
  onNewChat: () => void;
  isCollapsed?: boolean;
  isLoading?: boolean;
}

export function ChatListSidebar({
  currentSessionId,
  onSessionSelect,
  onNewChat,
  isCollapsed = false,
  isLoading = false
}: ChatListSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Load sessions periodically
  const loadSessions = () => {
    const allSessions = ChatSessionStorage.getAllSessions();
    console.log('[ChatListSidebar] Loading sessions:', allSessions.map(s => ({ id: s.id, title: s.title })));
    setSessions(allSessions);
  };

  useEffect(() => {
    loadSessions();

    // Refresh every 2 seconds
    const interval = setInterval(loadSessions, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleNewChat = () => {
    onNewChat();
    // Reload sessions after creating new one
    setTimeout(loadSessions, 100);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (window.confirm('Delete this chat and all its messages?')) {
      console.log('Deleting session:', sessionId);

      // Check if the deleted session is the current one
      const isCurrentSession = sessionId === currentSessionId;

      // Delete from localStorage
      ChatSessionStorage.deleteSession(sessionId);

      // Call backend to delete agent instance
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/sessions/${sessionId}`, {
        method: 'DELETE'
      })
        .then(res => {
          console.log('Backend delete response:', res.status);
          return res.json();
        })
        .then(data => console.log('Backend delete result:', data))
        .catch(err => console.error('Error deleting session on backend:', err));

      // Force reload sessions after a small delay to ensure localStorage is updated
      setTimeout(() => {
        console.log('Reloading sessions after delete...');
        loadSessions();

        // If deleted session was current, switch to first available session or create new
        if (isCurrentSession) {
          const remainingSessions = ChatSessionStorage.getAllSessions();
          if (remainingSessions.length > 0) {
            // Select the first session (most recent)
            const firstSession = remainingSessions[0];
            console.log('Switching to first available session:', firstSession.id);
            onSessionSelect(firstSession);
          } else {
            // No sessions left, create a new one
            console.log('No sessions left, creating new chat');
            onNewChat();
          }
        }
      }, 100);
    }
  };

  const handleStartEdit = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditTitle(currentTitle);
  };

  const handleSaveEdit = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      ChatSessionStorage.renameSession(sessionId, editTitle.trim());
      loadSessions();
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 flex-shrink-0">
        <button
          onClick={handleNewChat}
          className="w-10 h-10 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors"
          title="New chat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={handleNewChat}
          disabled={isLoading}
          className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700'
          } text-white`}
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">
            {isLoading ? 'Processing...' : 'New Chat'}
          </span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No chats yet. Start a new conversation!
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => !isLoading && onSessionSelect(session)}
                className={`group relative p-3 rounded-lg transition-colors ${
                  isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                } ${
                  currentSessionId === session.id
                    ? 'bg-primary-50 border border-primary-200'
                    : isLoading
                    ? 'border border-transparent'
                    : 'hover:bg-gray-100 border border-transparent'
                }`}
              >
                {editingId === session.id ? (
                  // Edit mode
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(session.id, e as any);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit(e as any);
                        }
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                      autoFocus
                    />
                    <button
                      onClick={(e) => handleSaveEdit(session.id, e)}
                      className="p-1 hover:bg-green-100 rounded transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ) : (
                  // Display mode
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <h3 className="font-medium text-gray-900 truncate">
                            {session.title}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 ml-6">
                          {session.messages.length} messages · {formatTime(session.updatedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartEdit(session.id, session.title, e)}
                          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                          title="Rename"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1.5 hover:bg-red-100 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500 text-center flex-shrink-0">
        {sessions.length} {sessions.length === 1 ? 'chat' : 'chats'}
      </div>
    </div>
  );
}
