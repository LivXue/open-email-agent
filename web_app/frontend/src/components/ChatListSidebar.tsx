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

      // Call backend to delete agent instance and filesystem first
      fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      })
        .then(async res => {
          console.log('Backend delete response:', res.status);
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || 'Failed to delete session on backend');
          }
          return res.json();
        })
        .then(data => {
          console.log('Backend delete result:', data);

          // After backend succeeds, delete from localStorage
          ChatSessionStorage.deleteSession(sessionId);

          // Reload sessions
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
        })
        .catch(err => {
          console.error('Error deleting session:', err);
          alert(`Failed to delete session: ${err.message || err}`);
        });
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
      <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 flex-shrink-0 shadow-lg">
        <button
          onClick={handleNewChat}
          className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 text-white flex items-center justify-center hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md hover:shadow-lg"
          title="New chat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0 shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={handleNewChat}
          disabled={isLoading}
          className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 shadow-sm ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg'
          } text-white font-medium`}
        >
          <Plus className="w-5 h-5" />
          <span>
            {isLoading ? 'Processing...' : 'New Chat'}
          </span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sessions.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No chats yet. Start a new conversation!</p>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => !isLoading && onSessionSelect(session)}
                className={`group relative p-3 rounded-xl transition-all duration-200 ${
                  isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                } ${
                  currentSessionId === session.id
                    ? 'bg-gradient-to-r from-primary-50 to-primary-100 border-2 border-primary-300 shadow-sm'
                    : isLoading
                    ? 'border border-transparent'
                    : 'hover:bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:shadow-sm'
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
                          className="p-1.5 hover:bg-blue-100 rounded-lg transition-all duration-200 hover:scale-105"
                          title="Rename"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1.5 hover:bg-red-100 rounded-lg transition-all duration-200 hover:scale-105"
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
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500 text-center flex-shrink-0 bg-gray-50">
        <span className="font-medium">{sessions.length}</span> {sessions.length === 1 ? 'chat' : 'chats'}
      </div>
    </div>
  );
}
