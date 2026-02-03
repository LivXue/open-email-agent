import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ChatPage } from './pages/ChatPage';
import { EmailPage } from './pages/EmailPage';
import { ContactsPage } from './pages/ContactsPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { SettingsPage } from './pages/SettingsPage';
import { WebSocketManager } from './lib/WebSocketManager';
import { ToastProvider } from './contexts/ToastContext';
import { EmailProvider, useEmailContext } from './contexts/EmailContext';

function AppContent() {
  const { initializeEmails } = useEmailContext();

  useEffect(() => {
    // Initialize WebSocket connection at application level
    // This ensures the WebSocket persists across all pages
    console.log('App: Initializing WebSocketManager');
    WebSocketManager.initialize();

    // Initialize email loading in background
    // This starts loading emails immediately when the app starts
    console.log('App: Initializing email loading in background');
    initializeEmails();

    // Cleanup on app unmount (only when closing the entire app)
    return () => {
      console.log('App: Cleaning up WebSocketManager');
      WebSocketManager.disconnect();
    };
  }, []);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/emails" element={<EmailPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <ToastProvider>
      <EmailProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </EmailProvider>
    </ToastProvider>
  );
}

export default App;
