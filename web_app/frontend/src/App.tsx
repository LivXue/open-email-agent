import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ChatPage } from './pages/ChatPage';
import { EmailPage } from './pages/EmailPage';
import { ContactsPage } from './pages/ContactsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WebSocketManager } from './lib/WebSocketManager';
import { ToastProvider } from './contexts/ToastContext';

function App() {
  useEffect(() => {
    // Initialize WebSocket connection at application level
    // This ensures the WebSocket persists across all pages
    console.log('App: Initializing WebSocketManager');
    WebSocketManager.initialize();

    // Cleanup on app unmount (only when closing the entire app)
    return () => {
      console.log('App: Cleaning up WebSocketManager');
      WebSocketManager.disconnect();
    };
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/emails" element={<EmailPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
