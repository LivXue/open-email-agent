import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface ServiceStatus {
  email: {
    initialized: boolean;
    imap_connected: boolean;
    smtp_connected: boolean;
  };
  agent: {
    initialized: boolean;
  };
}

export function StatusBar() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get('/health');
        setStatus(response.data.services);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading service status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-2">
      <div className="flex items-center gap-6 text-sm">
        {/* IMAP Status */}
        <div className="flex items-center gap-2">
          {status?.email.imap_connected ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">IMAP Connected</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-gray-700">IMAP Disconnected</span>
            </>
          )}
        </div>

        {/* SMTP Status */}
        <div className="flex items-center gap-2">
          {status?.email.smtp_connected ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">SMTP Connected</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-gray-700">SMTP Disconnected</span>
            </>
          )}
        </div>

        {/* Agent Status */}
        <div className="flex items-center gap-2">
          {status?.agent.initialized ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">Agent Ready</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-gray-700">Agent Not Ready</span>
            </>
          )}
        </div>

        {/* Last updated */}
        <div className="ml-auto text-xs text-gray-500">
          Updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
