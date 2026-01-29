import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Search,
  Star,
  StarIcon,
  RefreshCw,
  AlertCircle,
  Clock,
  MailOpen,
  ChevronDown,
  ChevronUp,
  Trash2,
  Folder,
  Tag,
  Archive,
  XCircle,
  Loader2,
  CheckCircle2,
  Circle
} from 'lucide-react';

// API base URL from environment
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '2821';
const API_BASE = `http://localhost:${BACKEND_PORT}`;

// Types
interface EmailData {
  uid: string;
  subject: string;
  from: string;
  fromName: string;
  to: string[];
  date: string;
  body: string;
  html: string;  // Original HTML content
  text: string;  // Original plain text content
  raw: string;  // Complete RFC822 raw email with headers
  isUnread: boolean;
  isFlagged: boolean;
  attachments: Array<{
    filename: string;
    size: number;
    contentType: string;
  }>;
}

interface Folder {
  name: string;
  flags: string[];
  emails?: EmailData[];
  loadStatus?: 'unloaded' | 'loading' | 'loaded' | 'error';
  unreadCount?: number;
  totalCount?: number;
}

type FilterType = 'all' | 'unread' | 'starred';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export default function EmailPageWebSocket() {
  // State
  const [folders, setFolders] = useState<Record<string, Folder>>({});
  const [selectedFolder, setSelectedFolder] = useState<string>('INBOX');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const foldersRef = useRef<Record<string, Folder>>({});

  // Update ref when folders change
  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      setLoadingState('loading');

      // Construct WebSocket URL
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/emails`;

      console.log('[Emails WS] Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Emails WS] Connected');
        setConnectionStatus('connected');
        setErrorMessage('');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Emails WS] Received:', data.type);

          handleWebSocketMessage(data);
        } catch (error) {
          console.error('[Emails WS] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[Emails WS] Error:', error);
        setConnectionStatus('disconnected');
        setLoadingState('error');
        setErrorMessage('Connection error. Please refresh the page.');
      };

      ws.onclose = () => {
        console.log('[Emails WS] Disconnected');
        setConnectionStatus('disconnected');
        setLoadingState('error');
      };
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'status':
        console.log('[Emails WS] Status:', data.message);
        break;

      case 'folders':
        console.log('[Emails WS] Received folders:', data.folders);

        // Initialize folder states
        const newFolders: Record<string, Folder> = {};
        data.folders.forEach((folder: Folder) => {
          newFolders[folder.name] = {
            ...folder,
            emails: [],
            loadStatus: 'unloaded',
            unreadCount: 0,
            totalCount: 0
          };
        });

        setFolders(newFolders);
        break;

      case 'folder_loading':
        console.log('[Emails WS] Loading folder:', data.folder);

        setFolders(prev => ({
          ...prev,
          [data.folder]: {
            ...prev[data.folder],
            loadStatus: 'loading'
          }
        }));
        break;

      case 'folder_loaded':
        console.log('[Emails WS] Folder loaded:', data.folder, data.total, 'emails');

        setFolders(prev => ({
          ...prev,
          [data.folder]: {
            ...prev[data.folder],
            emails: data.emails,
            loadStatus: 'loaded',
            unreadCount: data.unread_count,
            totalCount: data.total
          }
        }));

        // Update loading state if this is the first loaded folder
        if (loadingState === 'loading') {
          setLoadingState('success');
        }
        break;

      case 'error':
        console.error('[Emails WS] Error:', data.message);

        if (data.folder) {
          setFolders(prev => ({
            ...prev,
            [data.folder]: {
              ...prev[data.folder],
              loadStatus: 'error'
            }
          }));
        } else {
          setErrorMessage(data.message);
          setLoadingState('error');
        }
        break;

      case 'complete':
        console.log('[Emails WS] Loading complete');
        setLoadingState('success');
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('[Emails WS] Unknown message type:', data.type);
    }
  };

  // Get current folder state
  const currentFolder = folders[selectedFolder] || {
    name: selectedFolder,
    flags: [],
    emails: [],
    loadStatus: 'unloaded' as const,
    unreadCount: 0,
    totalCount: 0
  };

  // Filter emails
  const filteredEmails = currentFolder.emails.filter((email) => {
    if (filter === 'unread' && !email.isUnread) return false;
    if (filter === 'starred' && !email.isFlagged) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        email.subject.toLowerCase().includes(query) ||
        email.from.toLowerCase().includes(query) ||
        email.fromName.toLowerCase().includes(query) ||
        email.body.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Get folder icon based on load status
  const getFolderIcon = (folder: Folder) => {
    switch (folder.loadStatus) {
      case 'unloaded':
        return <Circle className="w-4 h-4 text-gray-300" />;
      case 'loading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'loaded':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  // Flag email function
  const flagEmail = async (emailUid: string, flagType: string, value: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/api/emails/${emailUid}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flag_type: flagType,
          value: value
        })
      });

      if (response.ok) {
        // Update local state
        setFolders(prev => ({
          ...prev,
          [selectedFolder]: {
            ...prev[selectedFolder],
            emails: prev[selectedFolder].emails.map(email =>
              email.uid === emailUid
                ? { ...email, [`is${flagType.charAt(0).toUpperCase() + flagType.slice(1)}`]: value }
                : email
            )
          }
        }));
      }
    } catch (error) {
      console.error('Failed to flag email:', error);
    }
  };

  // Delete email function
  const deleteEmail = async (emailUid: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/emails/${emailUid}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remove from local state
        setFolders(prev => ({
          ...prev,
          [selectedFolder]: {
            ...prev[selectedFolder],
            emails: prev[selectedFolder].emails.filter(email => email.uid !== emailUid),
            totalCount: prev[selectedFolder].totalCount - 1,
            unreadCount: prev[selectedFolder].unreadCount - (prev[selectedFolder].emails.find(e => e.uid === emailUid)?.isUnread ? 1 : 0)
          }
        }));

        setExpandedEmail(null);
      }
    } catch (error) {
      console.error('Failed to delete email:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary-600" />
            MailMind
          </h1>
        </div>

        {/* Connection Status */}
        <div className="px-4 py-2 border-b border-gray-200">
          <div className="flex items-center gap-2 text-xs">
            {connectionStatus === 'connected' && (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-600">Connected</span>
              </>
            )}
            {connectionStatus === 'connecting' && (
              <>
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-gray-600">Connecting...</span>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Compose Button */}
        <div className="p-4">
          <button className="w-full bg-primary-600 text-white rounded-lg py-3 px-4 font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2">
            <Mail className="w-5 h-5" />
            Compose
          </button>
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto px-2">
          {/* Primary folders */}
          {['INBOX', '[Gmail]/Starred', '[Gmail]/Sent', '[Gmail]/Drafts'].map(folderName => {
            const folder = folders[folderName];
            if (!folder) return null;

            return (
              <button
                key={folderName}
                onClick={() => {
                  setSelectedFolder(folderName);
                  setFilter('all');
                  setExpandedEmail(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFolder === folderName
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {getFolderIcon(folder)}
                <span className="flex-1 text-left truncate">
                  {folderName === '[Gmail]/Starred' && 'Starred'}
                  {folderName === '[Gmail]/Sent' && 'Sent'}
                  {folderName === '[Gmail]/Drafts' && 'Drafts'}
                  {folderName === 'INBOX' && 'Inbox'}
                </span>
                {folder.loadStatus === 'loaded' && folder.unreadCount! > 0 && (
                  <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {folder.unreadCount}
                  </span>
                )}
                {folder.loadStatus === 'loading' && (
                  <span className="text-xs text-gray-400">Loading...</span>
                )}
              </button>
            );
          })}

          {/* All folders */}
          {Object.keys(folders).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                All Folders
              </div>
              {Object.values(folders)
                .filter(f => !['INBOX', '[Gmail]/Starred', '[Gmail]/Sent', '[Gmail]/Drafts'].includes(f.name))
                .map(folder => (
                  <button
                    key={folder.name}
                    onClick={() => {
                      setSelectedFolder(folder.name);
                      setFilter('all');
                      setExpandedEmail(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedFolder === folder.name
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {getFolderIcon(folder)}
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    {folder.loadStatus === 'loaded' && folder.totalCount! > 0 && (
                      <span className="text-xs text-gray-400">{folder.totalCount}</span>
                    )}
                    {folder.loadStatus === 'loading' && (
                      <span className="text-xs text-gray-400">Loading...</span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Storage indicator */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2">75% of 15 GB used</div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-primary-600 h-1.5 rounded-full" style={{ width: '75%' }}></div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedFolder === '[Gmail]/Starred' && 'Starred'}
              {selectedFolder === '[Gmail]/Sent' && 'Sent'}
              {selectedFolder === '[Gmail]/Drafts' && 'Drafts'}
              {selectedFolder === 'INBOX' && 'Inbox'}
              {!selectedFolder.startsWith('[Gmail]') && selectedFolder !== 'INBOX' && selectedFolder}
            </h2>

            {/* Status indicator */}
            {currentFolder.loadStatus === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading emails...
              </div>
            )}
            {currentFolder.loadStatus === 'loaded' && (
              <div className="text-sm text-gray-500">
                {currentFolder.totalCount} emails
              </div>
            )}
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('starred')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'starred'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Starred
              </button>
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage('')}
                className="ml-auto text-red-700 hover:text-red-900"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {currentFolder.loadStatus === 'loading' ? (
            // Skeleton loading
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEmails.length === 0 ? (
            // Empty state
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <MailOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium">No emails found</p>
                <p className="text-sm">
                  {searchQuery
                    ? 'Try a different search term'
                    : filter !== 'all'
                    ? 'Try changing the filter'
                    : currentFolder.loadStatus === 'unloaded'
                    ? 'Waiting for emails to load...'
                    : 'This folder is empty'}
                </p>
              </div>
            </div>
          ) : (
            // Email list
            <div className="divide-y divide-gray-200">
              {filteredEmails.map((email) => (
                <div
                  key={email.uid}
                  className={`bg-white hover:bg-gray-50 transition-colors ${
                    email.isUnread ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      setExpandedEmail(expandedEmail === email.uid ? null : email.uid);

                      if (email.isUnread && expandedEmail !== email.uid) {
                        flagEmail(email.uid, 'seen', true);
                      }
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Star button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          flagEmail(email.uid, 'flagged', !email.isFlagged);
                        }}
                        className="flex-shrink-0 mt-1 hover:bg-gray-100 rounded p-1 transition-colors"
                      >
                        {email.isFlagged ? (
                          <StarIcon className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ) : (
                          <Star className="w-5 h-5 text-gray-300 hover:text-yellow-400" />
                        )}
                      </button>

                      {/* Email content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {email.isUnread && (
                              <div className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0"></div>
                            )}

                            <span
                              className={`font-medium truncate ${
                                email.isUnread ? 'text-gray-900' : 'text-gray-600'
                              }`}
                            >
                              {email.fromName || email.from}
                            </span>
                          </div>

                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {email.date}
                          </span>
                        </div>

                        <div
                          className={`text-sm mb-1 truncate ${
                            email.isUnread ? 'font-medium text-gray-900' : 'text-gray-600'
                          }`}
                        >
                          {email.subject}
                        </div>

                        <div className="text-xs text-gray-500 truncate">
                          {email.body.replace(/<[^>]*>/g, '').slice(0, 100)}
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this email?')) {
                            deleteEmail(email.uid);
                          }
                        }}
                        className="flex-shrink-0 hover:bg-gray-100 rounded p-1 transition-colors text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedEmail === email.uid && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="prose prose-sm max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: email.body }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
