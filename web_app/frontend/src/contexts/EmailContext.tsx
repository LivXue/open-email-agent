import { createContext, useContext, useState, useRef, ReactNode } from 'react';

// API base URL
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '2821';
const API_BASE = `http://localhost:${BACKEND_PORT}`;

export interface EmailData {
  uid: number;
  index: number;
  subject: string;
  from: string;
  fromName: string;
  to: string[];
  date: string;
  body: string;
  preview: string;
  isUnread: boolean;
  isFlagged: boolean;
  attachments: AttachmentInfo[];
}

export interface AttachmentInfo {
  filename: string;
  size: number;
  contentType: string;
}

export interface Folder {
  name: string;
  flags: string[];
}

export interface FolderState {
  name: string;
  flags: string[];
  emails: EmailData[];
  loadStatus: 'unloaded' | 'loading' | 'loaded' | 'error';
  unreadCount: number;
  totalCount: number;
}

interface EmailContextType {
  folderStates: Record<string, FolderState>;
  initializeEmails: () => Promise<void>;
  fetchEmailsForFolder: (folderName: string) => Promise<void>;
  reloadFolder: (folderName: string) => Promise<void>;
  updateFolderState: (folderName: string, updates: Partial<FolderState>) => void;
  updateEmailAcrossFolders: (emailUid: number, updateFn: (email: EmailData) => EmailData) => void;
  removeEmailFromFolders: (emailUid: number) => void;
  isInitialized: boolean;
  isLoading: boolean;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export function EmailProvider({ children }: { children: ReactNode }) {
  const [folderStates, setFolderStates] = useState<Record<string, FolderState>>({});
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Track if initialization has started to prevent duplicate calls
  const hasInitializedRef = useRef<boolean>(false);
  const loadingQueueRef = useRef<string[]>([]);

  // Fetch folders and start loading emails
  const initializeEmails = async () => {
    // Prevent duplicate initialization
    if (hasInitializedRef.current) {
      console.log('[EmailContext] Already initialized, skipping duplicate request');
      return;
    }

    hasInitializedRef.current = true;
    setIsLoading(true);

    try {
      console.log('[EmailContext] Initializing email system...');
      const response = await fetch(`${API_BASE}/api/emails/folders`);
      const data = await response.json();

      if (data.status === 'success') {
        console.log('[EmailContext] Loaded folders:', data.folders);

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
        setIsInitialized(true);

        // Start loading folders progressively in background
        loadFoldersProgressively(Object.keys(newFolderStates));
      } else {
        console.error('[EmailContext] Failed to load folders:', data);
        hasInitializedRef.current = false; // Reset on error to allow retry
      }
    } catch (error) {
      console.error('[EmailContext] Failed to initialize:', error);
      hasInitializedRef.current = false; // Reset on error to allow retry
    } finally {
      setIsLoading(false);
    }
  };

  // Load folders progressively (one by one)
  const loadFoldersProgressively = async (folderNames: string[]) => {
    loadingQueueRef.current = folderNames;

    for (const folderName of folderNames) {
      // Check if still in queue
      if (loadingQueueRef.current.indexOf(folderName) === -1) {
        break;
      }

      // Check current state before loading
      const currentState = folderStates[folderName];
      if (currentState && currentState.loadStatus !== 'unloaded') {
        console.log(`[EmailContext] Skipping ${folderName}, status: ${currentState.loadStatus}`);
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
      console.log(`[EmailContext] Loading emails for folder: ${folderName}`);
      const response = await fetch(
        `${API_BASE}/api/emails?folder=${encodeURIComponent(folderName)}&limit=100&unread_only=false`
      );

      const data = await response.json();
      console.log(`[EmailContext] Emails response for ${folderName}:`, data);

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

        console.log(`[EmailContext] Loaded ${emails.length} emails from ${folderName}`);
      } else {
        throw new Error(data.detail || 'Failed to load emails');
      }
    } catch (error) {
      console.error(`[EmailContext] Failed to fetch emails for ${folderName}:`, error);

      setFolderStates(prev => ({
        ...prev,
        [folderName]: {
          ...prev[folderName],
          loadStatus: 'error',
        },
      }));
    }
  };

  // Reload a folder (force refresh)
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
      console.log(`[EmailContext] Reloading emails for folder: ${folderName}`);
      const response = await fetch(
        `${API_BASE}/api/emails?folder=${encodeURIComponent(folderName)}&limit=100&unread_only=false`
      );

      const data = await response.json();
      console.log(`[EmailContext] Reload response for ${folderName}:`, data);

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

        console.log(`[EmailContext] Reloaded ${emails.length} emails from ${folderName}`);
      } else {
        throw new Error(data.detail || 'Failed to reload emails');
      }
    } catch (error) {
      console.error(`[EmailContext] Failed to reload emails for ${folderName}:`, error);

      setFolderStates(prev => ({
        ...prev,
        [folderName]: {
          ...prev[folderName],
          loadStatus: 'error',
        },
      }));
    }
  };

  // Update folder state (used for local updates like flagging, deleting)
  const updateFolderState = (folderName: string, updates: Partial<FolderState>) => {
    setFolderStates(prev => ({
      ...prev,
      [folderName]: {
        ...prev[folderName],
        ...updates,
      },
    }));
  };

  // Update an email across all folders (for flagging, etc.)
  const updateEmailAcrossFolders = (emailUid: number, updateFn: (email: EmailData) => EmailData) => {
    setFolderStates(prev => {
      const newStates = { ...prev };
      Object.keys(newStates).forEach(folderName => {
        const folder = newStates[folderName];
        const updatedEmails = folder.emails.map(email => {
          if (email.uid === emailUid) {
            return updateFn(email);
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
  };

  // Remove an email from all folders (for deleting)
  const removeEmailFromFolders = (emailUid: number) => {
    setFolderStates(prev => {
      const newStates = { ...prev };
      Object.keys(newStates).forEach(folderName => {
        const folder = newStates[folderName];
        const filteredEmails = folder.emails.filter(email => email.uid !== emailUid);

        // Update unread count
        const unreadCount = filteredEmails.filter(e => e.isUnread).length;

        newStates[folderName] = {
          ...folder,
          emails: filteredEmails,
          unreadCount: unreadCount,
          totalCount: filteredEmails.length,
        };
      });
      return newStates;
    });
  };

  const value: EmailContextType = {
    folderStates,
    initializeEmails,
    fetchEmailsForFolder,
    reloadFolder,
    updateFolderState,
    updateEmailAcrossFolders,
    removeEmailFromFolders,
    isInitialized,
    isLoading,
  };

  return <EmailContext.Provider value={value}>{children}</EmailContext.Provider>;
}

export function useEmailContext() {
  const context = useContext(EmailContext);
  if (context === undefined) {
    throw new Error('useEmailContext must be used within an EmailProvider');
  }
  return context;
}
