import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Inbox, MailOpen, FileText, Search, Filter } from 'lucide-react';

interface EmailData {
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  isUnread: boolean;
  uid: number;
  attachments?: AttachmentInfo[];
}

interface AttachmentInfo {
  filename: string;
  size: number;
  contentType: string;
}

type FilterType = 'all' | 'unread' | 'read';

export function EmailPage() {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const wsRef = useRef<ChatWebSocket | null>(null);

  const fetchEmails = async (filterType: FilterType = 'all') => {
    setLoading(true);
    try {
      const ws = new ChatWebSocket();
      const unreadOnly = filterType === 'unread';

      // Send command via WebSocket
      let command = 'Read my latest emails';
      if (unreadOnly) {
        command = 'Read my unread emails';
      }

      ws.connect(
        (message) => {
          if (message.type === 'text') {
            // Parse email data from response
            // This is a simplified version - you might want to create a dedicated API endpoint
            console.log('Email data:', message.content);
          }
        }
      );

      ws.send(command);
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails(filter);
  }, [filter]);

  // Mock data for demonstration
  const mockEmails: EmailData[] = [
    {
      uid: 1,
      subject: 'Quarterly Report Review',
      from: 'john.doe@example.com',
      to: 'me@example.com',
      date: '2025-01-14 10:30:00',
      body: 'Hi,\n\nPlease find attached the quarterly report for your review. Let me know if you have any questions.\n\nBest regards,\nJohn',
      isUnread: true,
      attachments: [
        { filename: 'Q4_Report.pdf', size: 2048000, contentType: 'application/pdf' },
      ],
    },
    {
      uid: 2,
      subject: 'Meeting Tomorrow',
      from: 'sarah@example.com',
      to: 'me@example.com',
      date: '2025-01-14 09:15:00',
      body: 'Just a reminder about our meeting tomorrow at 2 PM. Please bring the project documents.\n\nThanks,\nSarah',
      isUnread: false,
    },
    {
      uid: 3,
      subject: 'Invoice #12345',
      from: 'billing@service.com',
      to: 'me@example.com',
      date: '2025-01-13 16:45:00',
      body: 'Dear Customer,\n\nYour invoice for this month is now available. Total amount: $299.00\n\nPayment is due by January 30, 2025.\n\nBest regards,\nBilling Team',
      isUnread: true,
    },
  ];

  const filteredEmails = mockEmails.filter((email) => {
    if (filter === 'unread') return email.isUnread;
    if (filter === 'read') return !email.isUnread;
    return true;
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Emails</h2>
            <p className="text-sm text-gray-500">
              {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
                onClick={() => setFilter('read')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'read'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Read
              </button>
            </div>

            <button
              onClick={() => fetchEmails(filter)}
              disabled={loading}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <MailOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No emails found</p>
            <p className="text-sm">Try changing the filter or refresh</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmails.map((email) => (
              <div
                key={email.uid}
                className={`bg-white rounded-lg border transition-all ${
                  email.isUnread ? 'border-primary-200 shadow-sm' : 'border-gray-200'
                }`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    setExpandedEmail(expandedEmail === email.uid ? null : email.uid)
                  }
                >
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className="flex-shrink-0 mt-1">
                      {email.isUnread ? (
                        <div className="w-2 h-2 rounded-full bg-primary-600" />
                      ) : (
                        <MailOpen className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    {/* Email content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3
                          className={`font-semibold truncate ${
                            email.isUnread ? 'text-gray-900' : 'text-gray-600'
                          }`}
                        >
                          {email.subject}
                        </h3>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {email.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <span className="font-medium">{email.from}</span>
                        <span>→</span>
                        <span className="truncate">{email.to}</span>
                      </div>

                      <p className="text-sm text-gray-500 line-clamp-2">{email.body}</p>

                      {/* Attachments */}
                      {email.attachments && email.attachments.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {email.attachments.length} attachment
                            {email.attachments.length > 1 ? 's' : ''}
                          </span>
                          {email.attachments.map((att, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600"
                            >
                              {att.filename} ({formatFileSize(att.size)})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Expand icon */}
                    <div className="flex-shrink-0">
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
                </div>

                {/* Expanded content */}
                {expandedEmail === email.uid && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-gray-700">
                        {email.body}
                      </pre>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex gap-2">
                      <button
                        className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        onClick={() => {
                          /* Reply */
                        }}
                      >
                        Reply
                      </button>
                      <button
                        className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          /* Forward */
                        }}
                      >
                        Forward
                      </button>
                      <button
                        className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          /* Delete */
                        }}
                      >
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
  );
}
