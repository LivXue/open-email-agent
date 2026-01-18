import { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  Inbox,
  MailOpen,
  FileText,
  Search,
  Filter,
  Star,
  StarIcon,
  Archive,
  Trash2,
  Folder,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Circle,
  Clock,
  X,
  Send,
} from 'lucide-react';

// API base URL - constructed from environment variables
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '2821';
const API_BASE = `http://localhost:${BACKEND_PORT}`;

interface EmailData {
  uid: number;
  index: number;
  subject: string;
  from: string;
  fromName: string;
  to: string[];
  date: string;
  body: string;
  preview: string;  // Plain text preview for list view
  isUnread: boolean;
  isFlagged: boolean;
  attachments: AttachmentInfo[];
}

interface AttachmentInfo {
  filename: string;
  size: number;
  contentType: string;
}

interface Folder {
  name: string;
  flags: string[];
}

interface FolderState {
  name: string;
  flags: string[];
  emails: EmailData[];
  loadStatus: 'unloaded' | 'loading' | 'loaded' | 'error';
  unreadCount: number;
  totalCount: number;
}

type FilterType = 'all' | 'unread' | 'starred';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';
type ComposeMode = 'reply' | 'forward' | 'compose';

interface ComposeState {
  isOpen: boolean;
  mode: ComposeMode;
  to: string;
  subject: string;
  body: string;
  originalEmail?: EmailData;
}

export function EmailPage() {
  const [selectedFolder, setSelectedFolder] = useState<string>('INBOX');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Compose modal state
  const [composeState, setComposeState] = useState<ComposeState>({
    isOpen: false,
    mode: 'compose',
    to: '',
    subject: '',
    body: '',
  });
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  // Folder states with email caching
  const [folderStates, setFolderStates] = useState<Record<string, FolderState>>({
    'INBOX': {
      name: 'INBOX',
      flags: [],
      emails: [],
      loadStatus: 'unloaded',
      unreadCount: 0,
      totalCount: 0,
    },
  });

  const [folderLoading, setFolderLoading] = useState<boolean>(false);
  const loadingQueueRef = useRef<string[]>([]);

  // Track if folders have been fetched to prevent StrictMode duplicate calls
  const hasFetchedFoldersRef = useRef<boolean>(false);

  // Fetch folders list
  const fetchFolders = async () => {
    // Prevent duplicate calls from React StrictMode
    // Check BEFORE doing any work
    if (hasFetchedFoldersRef.current) {
      console.log('[Frontend] Folders already fetched, skipping duplicate request');
      return;
    }

    // Mark as fetching IMMEDIATELY to prevent race conditions
    // This must be set synchronously before any async operations
    hasFetchedFoldersRef.current = true;

    try {
      setFolderLoading(true);
      console.log('[Frontend] Fetching folders from:', `${API_BASE}/api/emails/folders`);
      const response = await fetch(`${API_BASE}/api/emails/folders`);
      const data = await response.json();

      console.log('[Frontend] Folders response:', data);

      if (data.status === 'success') {
        console.log('[Frontend] Loaded folders:', data.folders);

        // Initialize folder states
        const newFolderStates: Record<string, FolderState> = {};
        data.folders.forEach((folder: Folder) => {
          newFolderStates[folder.name] = {
            ...folder,
            emails: [],
            loadStatus: 'unloaded',
            unreadCount: 0,
            totalCount: 0,
          };
        });

        setFolderStates(newFolderStates);

        // Start loading folders progressively
        loadFoldersProgressively(Object.keys(newFolderStates));
      } else {
        console.error('[Frontend] Failed to load folders:', data);
        setErrorMessage('Failed to load folders');
        // Reset flag on error so we can retry
        hasFetchedFoldersRef.current = false;
      }
    } catch (error) {
      console.error('[Frontend] Failed to fetch folders:', error);
      setErrorMessage('Failed to connect to email server');
      // Reset flag on error so we can retry
      hasFetchedFoldersRef.current = false;
    } finally {
      setFolderLoading(false);
    }
  };

  // Load folders progressively (one by one)
  const loadFoldersProgressively = async (folderNames: string[]) => {
    loadingQueueRef.current = folderNames;

    for (const folderName of folderNames) {
      // Check if user switched to a different folder
      if (loadingQueueRef.current.indexOf(folderName) === -1) {
        break;
      }

      // Check current state before loading
      const currentState = folderStates[folderName];
      if (currentState && currentState.loadStatus !== 'unloaded') {
        // Already loaded or loading, skip
        console.log(`[Frontend] Skipping ${folderName}, status: ${currentState.loadStatus}`);
        continue;
      }

      // Mark as loading BEFORE starting the fetch
      setFolderStates(prev => ({
        ...prev,
        [folderName]: {
          ...(prev[folderName] || { name: folderName, flags: [], emails: [], unreadCount: 0, totalCount: 0 }),
          loadStatus: 'loading',
        },
      }));

      // Load emails for this folder
      await fetchEmailsForFolder(folderName);

      // Small delay between folder loads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Fetch emails for a specific folder
  const fetchEmailsForFolder = async (folderName: string) => {
    try {
      // Double-check if already loading or loaded to prevent duplicate requests
      const currentState = folderStates[folderName];
      if (currentState && currentState.loadStatus === 'loading') {
        console.log(`[Frontend] ${folderName} is already loading, skipping duplicate request`);
        return;
      }
      if (currentState && currentState.loadStatus === 'loaded') {
        console.log(`[Frontend] ${folderName} already loaded, skipping duplicate request`);
        return;
      }

      console.log(`[Frontend] Loading emails for folder: ${folderName}`);
      const response = await fetch(
        `${API_BASE}/api/emails?folder=${encodeURIComponent(folderName)}&limit=100&unread_only=false`
      );

      const data = await response.json();
      console.log(`[Frontend] Emails response for ${folderName}:`, data);

      if (data.status === 'success') {
        const emails = data.emails || [];
        const unreadCount = emails.filter((e: EmailData) => e.isUnread).length;

        setFolderStates(prev => ({
          ...prev,
          [folderName]: {
            ...prev[folderName],
            emails: emails,
            loadStatus: 'loaded',
            unreadCount: unreadCount,
            totalCount: emails.length,
          },
        }));

        console.log(`[Frontend] Loaded ${emails.length} emails from ${folderName}`);
      } else {
        throw new Error(data.detail || 'Failed to load emails');
      }
    } catch (error) {
      console.error(`[Frontend] Failed to fetch emails for ${folderName}:`, error);

      setFolderStates(prev => ({
        ...prev,
        [folderName]: {
          ...prev[folderName],
          loadStatus: 'error',
        },
      }));
    }
  };

  // Fetch emails for currently selected folder
  const fetchEmails = async (folder: string, filterType: FilterType = 'all') => {
    setLoadingState('loading');
    setErrorMessage('');
    setExpandedEmail(null);

    try {
      // Check if folder is already loaded
      const folderState = folderStates[folder];
      if (!folderState) {
        setLoadingState('error');
        setErrorMessage('Folder not found');
        return;
      }

      // If folder is not loaded yet, load it now
      if (folderState.loadStatus === 'unloaded') {
        await fetchEmailsForFolder(folder);
      }

      setLoadingState('success');
    } catch (error) {
      console.error('[Frontend] Failed to fetch emails:', error);
      setErrorMessage('Failed to connect to email server');
      setLoadingState('error');
    }
  };

  // Flag email (mark as read/unread or star/unstar)
  const flagEmail = async (emailUid: number, flagType: string, value: boolean) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/emails/${emailUid}/flag?flag_type=${flagType}&value=${value}`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (data.status === 'success') {
        // Update local state
        setFolderStates(prev => {
          const newStates = { ...prev };
          Object.keys(newStates).forEach(folderName => {
            const folder = newStates[folderName];
            const updatedEmails = folder.emails.map(email => {
              if (email.uid === emailUid) {
                if (flagType === 'seen') {
                  return { ...email, isUnread: !value };
                } else if (flagType === 'flagged') {
                  return { ...email, isFlagged: value };
                }
              }
              return email;
            });

            // Update unread count
            const unreadCount = updatedEmails.filter(e => e.isUnread).length;

            newStates[folderName] = {
              ...folder,
              emails: updatedEmails,
              unreadCount: unreadCount,
            };
          });
          return newStates;
        });
      } else {
        setErrorMessage(data.detail || 'Failed to update email');
      }
    } catch (error) {
      console.error('Failed to flag email:', error);
      setErrorMessage('Failed to update email');
    }
  };

  // Delete email
  const deleteEmail = async (emailUid: number) => {
    if (!confirm('Are you sure you want to delete this email?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/emails/${emailUid}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Remove from local state
        setFolderStates(prev => {
          const newStates = { ...prev };
          Object.keys(newStates).forEach(folderName => {
            const folder = newStates[folderName];
            const updatedEmails = folder.emails.filter(email => email.uid !== emailUid);
            const unreadCount = updatedEmails.filter(e => e.isUnread).length;

            newStates[folderName] = {
              ...folder,
              emails: updatedEmails,
              unreadCount: unreadCount,
              totalCount: updatedEmails.length,
            };
          });
          return newStates;
        });
        setExpandedEmail(null);
      } else {
        setErrorMessage(data.detail || 'Failed to delete email');
      }
    } catch (error) {
      console.error('Failed to delete email:', error);
      setErrorMessage('Failed to delete email');
    }
  };

  // Open compose modal for reply
  const handleReply = (email: EmailData) => {
    const fromEmail = email.fromName && email.fromName !== email.from
      ? `${email.fromName} <${email.from}>`
      : email.from;

    setComposeState({
      isOpen: true,
      mode: 'reply',
      to: fromEmail,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n---------- Original Message ----------\nFrom: ${email.fromName || email.from}\nDate: ${email.date}\nSubject: ${email.subject}\n\n`,
      originalEmail: email,
    });
  };

  // Open compose modal for forward
  const handleForward = (email: EmailData) => {
    setComposeState({
      isOpen: true,
      mode: 'forward',
      to: '',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n---------- Forwarded Message ----------\nFrom: ${email.fromName || email.from}\nDate: ${email.date}\nSubject: ${email.subject}\nTo: ${email.to.join(', ')}\n\n`,
      originalEmail: email,
    });
  };

  // Archive email (move to Archive folder or INBOX.Archive)
  const handleArchive = async (emailUid: number) => {
    try {
      // Try common archive folder names
      const archiveFolders = ['Archive', 'INBOX.Archive', 'Archives', 'All Mail'];
      const availableFolders = Object.keys(folderStates);

      // Find the first available archive folder
      let targetFolder = archiveFolders.find(f => availableFolders.includes(f));

      if (!targetFolder) {
        alert('No Archive folder found. Please create an Archive folder in your email client.');
        return;
      }

      const response = await fetch(`${API_BASE}/api/emails/${emailUid}/move?destination_folder=${encodeURIComponent(targetFolder)}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Remove from local state and update counts
        setFolderStates(prev => {
          const newStates = { ...prev };
          Object.keys(newStates).forEach(folderName => {
            const folder = newStates[folderName];
            const updatedEmails = folder.emails.filter(e => e.uid !== emailUid);
            const unreadCount = updatedEmails.filter(e => e.isUnread).length;

            newStates[folderName] = {
              ...folder,
              emails: updatedEmails,
              unreadCount: unreadCount,
              totalCount: updatedEmails.length,
            };
          });
          return newStates;
        });
        setExpandedEmail(null);
      } else {
        setErrorMessage(data.detail || 'Failed to archive email');
      }
    } catch (error) {
      console.error('Failed to archive email:', error);
      setErrorMessage('Failed to archive email');
    }
  };

  // Send email
  const handleSendEmail = async () => {
    if (!composeState.to.trim()) {
      alert('Please enter a recipient');
      return;
    }

    if (!composeState.subject.trim()) {
      alert('Please enter a subject');
      return;
    }

    try {
      setSendingEmail(true);

      const formData = new FormData();
      formData.append('to', composeState.to);
      formData.append('subject', composeState.subject);
      formData.append('body', composeState.body);
      formData.append('html', 'false');

      const response = await fetch(`${API_BASE}/api/emails/send`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Close modal
        setComposeState({
          isOpen: false,
          mode: 'compose',
          to: '',
          subject: '',
          body: '',
        });
        alert('Email sent successfully!');
      } else {
        alert(`Failed to send email: ${data.detail || data.message}`);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchFolders();
  }, []);

  // Note: We don't need useEffect for selectedFolder because:
  // 1. loadFoldersProgressively() already loads all folders in background
  // 2. When user selects a folder, it's already loaded (or loading)
  // 3. The UI just switches to display the cached data
  // This prevents duplicate loading requests

  // Get current folder state
  const currentFolderState = folderStates[selectedFolder] || {
    name: selectedFolder,
    flags: [],
    emails: [],
    loadStatus: 'unloaded',
    unreadCount: 0,
    totalCount: 0,
  };

  // Filter emails by search query and filter type
  const filteredEmails = currentFolderState.emails.filter((email) => {
    // Apply filter
    if (filter === 'unread' && !email.isUnread) return false;
    if (filter === 'starred' && !email.isFlagged) return false;

    // Apply search
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

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Get human-readable folder name
  // This function preserves the original folder names from the server
  // Only applies minimal formatting for readability
  const getFolderDisplayName = (folderName: string): string => {
    // For INBOX, always show as "Inbox" (this is the only exception)
    if (folderName.toLowerCase() === 'inbox') {
      return 'Inbox';
    }

    // For folders with namespaces (e.g., [Gmail]/, [Yahoo]/), extract the local name
    // This preserves the user's language setting
    const namespaceMatch = folderName.match(/^\[([^\]]+)\]\/(.+)$/);
    if (namespaceMatch) {
      // Return the part after the namespace (preserves original name)
      // e.g., "[Gmail]/垃圾邮件" → "垃圾邮件"
      //      "[Gmail]/Spam" → "Spam"
      return namespaceMatch[2];
    }

    // For nested folders (e.g., "Archive/2024"), show the full path
    if (folderName.includes('/')) {
      return folderName;
    }

    // For simple folder names, just capitalize first letter
    return folderName.charAt(0).toUpperCase() + folderName.slice(1);
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Get folder icon based on load status
  const getFolderIcon = (folderState: FolderState) => {
    switch (folderState.loadStatus) {
      case 'unloaded':
        return <Circle className="w-4 h-4 text-gray-300" />;
      case 'loading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'loaded':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  // Manually reload a folder
  const reloadFolder = async (folderName: string) => {
    // Set to loading state first
    setFolderStates(prev => ({
      ...prev,
      [folderName]: {
        ...prev[folderName],
        loadStatus: 'loading',
      },
    }));

    try {
      console.log(`[Frontend] Reloading emails for folder: ${folderName}`);
      const response = await fetch(
        `${API_BASE}/api/emails?folder=${encodeURIComponent(folderName)}&limit=100&unread_only=false`
      );

      const data = await response.json();
      console.log(`[Frontend] Reload response for ${folderName}:`, data);

      if (data.status === 'success') {
        const emails = data.emails || [];
        const unreadCount = emails.filter((e: EmailData) => e.isUnread).length;

        setFolderStates(prev => ({
          ...prev,
          [folderName]: {
            ...prev[folderName],
            emails: emails,
            loadStatus: 'loaded',
            unreadCount: unreadCount,
            totalCount: emails.length,
          },
        }));

        console.log(`[Frontend] Reloaded ${emails.length} emails from ${folderName}`);
      } else {
        throw new Error(data.detail || 'Failed to reload emails');
      }
    } catch (error) {
      console.error(`[Frontend] Failed to reload emails for ${folderName}:`, error);

      setFolderStates(prev => ({
        ...prev,
        [folderName]: {
          ...prev[folderName],
          loadStatus: 'error',
        },
      }));

      setErrorMessage(`Failed to reload ${folderName}`);
    }
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar - Folders */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Compose button */}
        <div className="p-4">
          <button
            className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-full py-3 px-6 flex items-center justify-center gap-2 shadow-sm transition-colors font-medium"
            onClick={() => {
              /* TODO: Implement compose */
            }}
          >
            <FileText className="w-5 h-5" />
            Compose
          </button>
        </div>

        {/* Folders list */}
        <div className="flex-1 overflow-y-auto px-2">
          {/* All folders - display dynamically based on actual folder list from server */}
          {folderLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading folders...
            </div>
          ) : (
            <div className="space-y-1">
              {/* Display all folders from the server */}
              {Object.values(folderStates).map(folderState => {
                // Get display name - use common folder name mappings
                let displayName = getFolderDisplayName(folderState.name);

                return (
                  <button
                    key={folderState.name}
                    onClick={() => {
                      setSelectedFolder(folderState.name);
                      setFilter('all');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedFolder === folderState.name
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {getFolderIcon(folderState)}
                    <span className="flex-1 text-left truncate" title={displayName}>
                      {displayName}
                    </span>
                    {folderState.loadStatus === 'loaded' && folderState.unreadCount > 0 && (
                      <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {folderState.unreadCount}
                      </span>
                    )}
                    {folderState.loadStatus === 'loading' && (
                      <span className="text-xs text-gray-400">Loading...</span>
                    )}
                    {folderState.loadStatus === 'error' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          reloadFolder(folderState.name);
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Retry
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          )}
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
            {currentFolderState.loadStatus === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading emails...
              </div>
            )}
            {currentFolderState.loadStatus === 'loaded' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
              </div>
            )}
            {currentFolderState.loadStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                Error loading emails
              </div>
            )}
          </div>

          {/* Search and filter bar */}
          <div className="flex items-center gap-4">
            {/* Search box */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
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

            {/* Refresh button */}
            <button
              onClick={() => reloadFolder(selectedFolder)}
              disabled={currentFolderState.loadStatus === 'loading'}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${currentFolderState.loadStatus === 'loading' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <XCircle className="w-5 h-5 flex-shrink-0" />
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
          {currentFolderState.loadStatus === 'loading' ? (
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
          ) : currentFolderState.loadStatus === 'error' ? (
            // Error state
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                <p className="text-lg font-medium">Failed to load emails</p>
                <p className="text-sm mb-4">Please check your connection and try again</p>
                <button
                  onClick={() => reloadFolder(selectedFolder)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : currentFolderState.loadStatus === 'unloaded' ? (
            // Unloaded state
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium">Folder not loaded yet</p>
                <p className="text-sm mb-4">Click below to load emails</p>
                <button
                  onClick={() => fetchEmailsForFolder(selectedFolder)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Load Emails
                </button>
              </div>
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

                      {/* Email thumbnail - show first letter of sender or subject */}
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-semibold ${
                          email.isUnread
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {email.fromName && email.fromName.length > 0
                            ? email.fromName.charAt(0).toUpperCase()
                            : email.from && email.from.length > 0
                            ? email.from.charAt(0).toUpperCase()
                            : email.subject && email.subject.length > 0
                            ? email.subject.charAt(0).toUpperCase()
                            : '?'}
                        </div>
                      </div>

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
                              {email.fromName
                                ? `${email.fromName} <${email.from}>`
                                : email.from}
                            </span>
                          </div>

                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {formatDate(email.date)}
                          </span>

                          <div className="ml-2">
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${
                                expandedEmail === email.uid ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>

                        <div
                          className={`text-sm mb-1 truncate ${
                            email.isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'
                          }`}
                        >
                          {email.subject || '(No Subject)'}
                        </div>

                        <div className="text-sm text-gray-500 truncate mb-1">
                          {email.preview || email.body}
                        </div>

                        {email.attachments && email.attachments.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <FileText className="w-4 h-4" />
                            <span>
                              {email.attachments.length} attachment
                              {email.attachments.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedEmail === email.uid && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="mb-4 text-sm">
                        <div className="grid grid-cols-[100px_1fr] gap-2">
                          <span className="font-medium text-gray-700">From:</span>
                          <span className="text-gray-900">{email.fromName || email.from}</span>
                          <span className="font-medium text-gray-700">To:</span>
                          <span className="text-gray-900">{email.to.join(', ')}</span>
                          <span className="font-medium text-gray-700">Date:</span>
                          <span className="text-gray-900">{email.date}</span>
                        </div>
                      </div>

                      {/* Email body - render HTML content safely */}
                      <div className="mb-4">
                        <div
                          className="email-body-content text-gray-800 bg-white p-4 rounded border border-gray-200"
                          dangerouslySetInnerHTML={{ __html: email.body }}
                        />
                      </div>

                      {email.attachments && email.attachments.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            Attachments ({email.attachments.length}):
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {email.attachments.map((att, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <FileText className="w-4 h-4 text-gray-400" />
                                <div className="text-sm">
                                  <div className="font-medium text-gray-700">{att.filename}</div>
                                  <div className="text-xs text-gray-500">{formatFileSize(att.size)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                          onClick={() => handleReply(email)}
                        >
                          Reply
                        </button>
                        <button
                          className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                          onClick={() => handleForward(email)}
                        >
                          Forward
                        </button>
                        <button
                          className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                          onClick={() => handleArchive(email.uid)}
                        >
                          <Archive className="w-4 h-4 inline mr-1" />
                          Archive
                        </button>
                        <button
                          className="px-4 py-2 text-sm bg-white border border-gray-300 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors font-medium"
                          onClick={() => deleteEmail(email.uid)}
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      {composeState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">
                {composeState.mode === 'reply' ? 'Reply to Email' :
                 composeState.mode === 'forward' ? 'Forward Email' :
                 'New Email'}
              </h3>
              <button
                onClick={() => setComposeState({ ...composeState, isOpen: false })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* To Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To:
                  </label>
                  <input
                    type="text"
                    value={composeState.to}
                    onChange={(e) => setComposeState({ ...composeState, to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="recipient@example.com"
                  />
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject:
                  </label>
                  <input
                    type="text"
                    value={composeState.subject}
                    onChange={(e) => setComposeState({ ...composeState, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Email subject"
                  />
                </div>

                {/* Body Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message:
                  </label>
                  <textarea
                    value={composeState.body}
                    onChange={(e) => setComposeState({ ...composeState, body: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    rows={15}
                    placeholder="Type your message here..."
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setComposeState({ ...composeState, isOpen: false })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
