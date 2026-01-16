import { useState, useEffect } from 'react';
import { Save, Check, AlertCircle } from 'lucide-react';
import { settingsApi, EnvSettings } from '../lib/api';

export function SettingsPage() {
  const [settings, setSettings] = useState<EnvSettings>({
    MODEL: '',
    OPENAI_API_KEY: '',
    OPENAI_BASE_URL: '',
    DISPLAY_REASONING: true,
    TAVILY_API_KEY: '',
    USERNAME: '',
    PASSWORD: '',
    IMAP_SERVER: '',
    IMAP_PORT: 993,
    IMAP_USE_PROXY: false,
    SMTP_SERVER: '',
    SMTP_PORT: 465,
    SMTP_USE_SSL: true,
    SMTP_USE_PROXY: false,
    DONT_SET_READ: true,
    PROXY: '',
    BACKEND_PORT: 8001,
    FRONTEND_PORT: 3001,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSettings();
      setSettings(data);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);

      await settingsApi.updateSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully! Agent will restart with new configuration.' });

      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof EnvSettings, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-600 mt-1">Configure your MailMind environment variables</p>
        </div>



        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Model Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={settings.MODEL}
                  onChange={(e) => handleChange('MODEL', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                  placeholder="e.g., gpt-4, claude-3-5-sonnet-20241022"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">The model identifier to use for chat completions</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={settings.OPENAI_API_KEY}
                  onChange={(e) => handleChange('OPENAI_API_KEY', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  value={settings.OPENAI_BASE_URL}
                  onChange={(e) => handleChange('OPENAI_BASE_URL', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="DISPLAY_REASONING"
                  checked={settings.DISPLAY_REASONING}
                  onChange={(e) => handleChange('DISPLAY_REASONING', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="DISPLAY_REASONING" className="text-sm font-medium text-gray-700">
                  Display Reasoning Content
                </label>
              </div>
            </div>
          </div>

          {/* Tavily Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tavily Search Settings</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tavily API Key
              </label>
              <input
                type="password"
                value={settings.TAVILY_API_KEY}
                onChange={(e) => handleChange('TAVILY_API_KEY', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                required
              />
            </div>
          </div>

          {/* Email Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Settings</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={settings.USERNAME}
                    onChange={(e) => handleChange('USERNAME', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={settings.PASSWORD}
                    onChange={(e) => handleChange('PASSWORD', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IMAP Server
                  </label>
                  <input
                    type="text"
                    value={settings.IMAP_SERVER}
                    onChange={(e) => handleChange('IMAP_SERVER', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IMAP Port
                  </label>
                  <input
                    type="number"
                    value={settings.IMAP_PORT}
                    onChange={(e) => handleChange('IMAP_PORT', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="IMAP_USE_PROXY"
                  checked={settings.IMAP_USE_PROXY}
                  onChange={(e) => handleChange('IMAP_USE_PROXY', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="IMAP_USE_PROXY" className="text-sm font-medium text-gray-700">
                  IMAP Use Proxy
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Server
                  </label>
                  <input
                    type="text"
                    value={settings.SMTP_SERVER}
                    onChange={(e) => handleChange('SMTP_SERVER', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={settings.SMTP_PORT}
                    onChange={(e) => handleChange('SMTP_PORT', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="SMTP_USE_SSL"
                  checked={settings.SMTP_USE_SSL}
                  onChange={(e) => handleChange('SMTP_USE_SSL', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="SMTP_USE_SSL" className="text-sm font-medium text-gray-700">
                  SMTP Use SSL
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="SMTP_USE_PROXY"
                  checked={settings.SMTP_USE_PROXY}
                  onChange={(e) => handleChange('SMTP_USE_PROXY', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="SMTP_USE_PROXY" className="text-sm font-medium text-gray-700">
                  SMTP Use Proxy
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="DONT_SET_READ"
                  checked={settings.DONT_SET_READ}
                  onChange={(e) => handleChange('DONT_SET_READ', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="DONT_SET_READ" className="text-sm font-medium text-gray-700">
                  Don't mark emails as read
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proxy URL (Optional)
                </label>
                <input
                  type="text"
                  value={settings.PROXY || ''}
                  onChange={(e) => handleChange('PROXY', e.target.value)}
                  placeholder="http://user:pass@host:port"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Format: http://username:password@host:port</p>
              </div>
            </div>
          </div>

          {/* Network Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Settings</h3>
            <p className="text-sm text-gray-600 mb-4">Configure the ports for the backend and frontend servers. Changes will take effect after restarting the application.</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Backend Port
                </label>
                <input
                  type="number"
                  value={settings.BACKEND_PORT}
                  onChange={(e) => handleChange('BACKEND_PORT', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                  required
                  min={1024}
                  max={65535}
                />
                <p className="text-xs text-gray-500 mt-1">Port for the backend API server</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frontend Port
                </label>
                <input
                  type="number"
                  value={settings.FRONTEND_PORT}
                  onChange={(e) => handleChange('FRONTEND_PORT', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                  required
                  min={1024}
                  max={65535}
                />
                <p className="text-xs text-gray-500 mt-1">Port for the frontend development server</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
