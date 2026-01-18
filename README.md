<div align="center">

  # 📧 MailMind

  ### Your Email System Can Finally Do Jobs For You!

  ![Version](https://img.shields.io/badge/version-0.0.2-blue.svg)
  ![Status](https://img.shields.io/badge/status-beta-orange.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
  ![Node](https://img.shields.io/badge/node-18+-green.svg)

  **An AI-powered email management assistant that combines advanced language models with practical email operations.**

  MailMind helps you read, organize, draft, and manage emails through an intuitive chat interface.

  [Quick Start](#-quick-start) • [Features](#-features) • [Contacts](#-contacts-management) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 🎉 What's New in v0.0.2

### ✨ **Emails Page - Complete Overhaul**

We've completely redesigned the Emails page with a modern, feature-rich email client interface.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🤖 AI-Powered Email Agent
- Natural language interaction
- Context-aware responses
- Intelligent email processing
- Automated workflows with smart planning

</td>
<td width="50%">

### 📧 Intelligent Email Box
- Read, compose, send emails
- Organize emails by AI
- Extract information by intuition
- Generate communication flows

</td>
</tr>
<tr>
<td width="50%">

### 👥 AI-accessable Contacts
- Create and edit contacts
- Automatically organize by AI
- AI-understood social networks
- Powerful search and filtering

</td>
<td width="50%">

### 🔍 Smart Capabilities
- Web search integration
- Multi-session support
- Real-time streaming
- Attachment handling

</td>
</tr>
<tr>
<td width="50%">


## 🏗️ Architecture

### Backend Stack

```
FastAPI    → High-performance async web framework
LangGraph  → Advanced agent orchestration
WebSocket  → Real-time bidirectional communication
IMAP/SMTP  → Direct email protocol integration
```

### Frontend Stack

```
React 18      → Modern UI with hooks
TypeScript    → Type-safe development
Tailwind CSS  → Utility-first styling
Vite          → Lightning-fast build tool
Axios         → HTTP & WebSocket client
```

### AI Integration

- **OpenAI-Compatible APIs** - Support for multiple LLM providers
- **Tavily Search** - Web search capabilities
- **Subagent Architecture** - Specialized task handling
- **Context Management** - Smart conversation tracking

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- Email account with IMAP access (Gmail recommended)
- API keys for your chosen LLM provider

### Installation

<details>
<summary><b>1. Clone the repository</b></summary>

```bash
git clone https://github.com/yourusername/mailmind.git
cd mailmind
```

</details>

<details>
<summary><b>2. Configure environment variables</b></summary>

```bash
cd web_app
cp .env.example .env
# Edit .env with your API keys and email credentials
```

</details>

<details>
<summary><b>3. Start the application</b></summary>

```bash
./start.sh
```

The startup script will automatically:
- ✅ Install Python dependencies in a virtual environment
- ✅ Install Node.js dependencies
- ✅ Start the backend server (default: http://localhost:2821)
- ✅ Start the frontend dev server (default: http://localhost:2922)

</details>

<details>
<summary><b>4. Open your browser</b></summary>

Navigate to `http://localhost:2922` and start managing your emails with AI!

</details>

## ⚙️ Configuration

### Model Settings

| Variable | Description | Example |
|----------|-------------|---------|
| `MODEL` | Model name | `gpt-4`, `claude-3-sonnet` |
| `OPENAI_API_KEY` | Your API key | `sk-...` |
| `OPENAI_BASE_URL` | API endpoint | `https://api.openai.com/v1` |
| `DISPLAY_REASONING` | Show reasoning | `True`/`False` |

### Email Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `USERNAME` | Your email address | - |
| `PASSWORD` | App-specific password | - |
| `IMAP_SERVER` | IMAP server address | `imap.gmail.com` |
| `SMTP_SERVER` | SMTP server address | `smtp.gmail.com` |
| `IMAP_PORT` | IMAP port | `993` |
| `SMTP_PORT` | SMTP port | `465` |

### Tested Email Providers

| Provider | Status | Notes |
|----------|--------|-------|
| ✅ **Gmail** | Fully Tested & Supported | Requires App Password. Enable IMAP in settings. |
| 🔄 **Outlook** | In Testing | Very complicated access through IMAP and SMTP protocols. |


<details>
<summary><b>Gmail Setup Guide (Recommended)</b></summary>

1. **Enable 2-Factor Authentication**
   - Go to Google Account settings
   - Security → 2-Step Verification
   - Enable 2FA

2. **Generate App Password**
   - Go to Google Account settings
   - Security → App passwords
   - Generate new app password
   - Use this password in `PASSWORD` field

3. **Enable IMAP Access**
   - Go to Gmail settings
   - Forwarding and POP/IMAP
   - Enable IMAP
   - Save changes

4. **Configure MailMind**
   ```
   USERNAME=yourname@gmail.com
   PASSWORD=[your 16-character app password]
   IMAP_SERVER=imap.gmail.com
   SMTP_SERVER=smtp.gmail.com
   IMAP_PORT=993
   SMTP_PORT=465
   ```

</details>

### Network Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_PORT` | Backend server port | `2821` |
| `FRONTEND_PORT` | Frontend dev server port | `2922` |

## 💡 Usage

### Chat Interface

1. **Start a Conversation** - Type your request in natural language:
   ```
   "Read my unread emails"
   "Draft a reply to the latest email from John"
   "Delete all emails from newsletter@example.com"
   ```

2. **Watch the AI Work** - See the agent's thought process and tool calls in real-time

3. **Manage Multiple Sessions** - Create new chat sessions for different tasks

### Email Management

| Action | Description |
|--------|-------------|
| 📖 **Read** | Fetch and display emails with filtering |
| ✉️ **Send** | Compose and send new emails |
| 🗑️ **Delete** | Remove unwanted emails |
| 📁 **Move** | Organize emails into folders |
| 🏴 **Flag** | Mark as important/unread |
| 📎 **Attachments** | View and download files |

### Contacts Management

Organize your contacts efficiently with our comprehensive contacts feature:

| Feature | Description |
|---------|-------------|
| 👤 **Add Contacts** | Create new contacts with multiple email addresses |
| ✏️ **Edit Contacts** | Update contact information anytime |
| 🗑️ **Delete Contacts** | Remove contacts with confirmation |
| 🏷️ **Groups** | Organize contacts into custom groups |
| 🔍 **Search** | Find contacts by name, email, or group |
| 📋 **Alphabetical View** | Contacts automatically sorted by first letter |

**Benefits**:
- 📧 Quick access when composing emails
- 🎯 Filter emails by contacts
- 👥 Organize contacts into groups (Family, Work, Friends, etc.)
- 🔎 Search across all contact fields instantly

### Settings Page

Configure everything through the web UI:
- 🔑 Update API keys
- 📧 Configure email servers
- 🔌 Adjust network ports
- 🎨 Toggle display options

### Contacts Page

Manage your network of contacts efficiently:

**Adding Contacts**:
1. Click the **"Add Contact"** button
2. Enter contact name (required)
3. Add one or more email addresses
4. Assign to groups (e.g., Family, Work, Friends)
5. Save the contact

**Organizing with Groups**:
- Create custom groups to categorize contacts
- Filter contacts by group in the sidebar
- Groups show contact counts
- Easily add/remove contacts from groups

**Searching Contacts**:
- Search by name, email, or group
- Real-time filtering as you type
- Alphabetically sorted display
- Quick access to contact details

**Managing Contacts**:
- ✏️ Edit any contact to update information
- 🗑️ Delete with confirmation dialog
- 📧 Multiple email addresses per contact
- 🏷️ Visual group tags on each contact

## 📁 Project Structure

```
mailmind/
├── deepagents/              # Core agent framework
│   ├── backends/           # Backend implementations
│   ├── middleware/         # Agent middleware
│   └── ...
├── lib/                    # Shared utilities
│   ├── email_tools.py     # Email operations
│   ├── prompt.py          # System prompts
│   └── ...
├── web_app/               # Web application
│   ├── backend/          # FastAPI server
│   │   ├── api_server.py
│   │   └── requirements.txt
│   ├── frontend/         # React + TypeScript UI
│   │   ├── src/
│   │   │   ├── components/   # UI components
│   │   │   ├── pages/        # Page components
│   │   │   ├── lib/          # API & utilities
│   │   │   └── contexts/     # React contexts
│   │   ├── package.json
│   │   └── vite.config.js
│   └── start.sh         # Startup script
├── .env.example          # Environment template
└── README.md            # This file
```

## 🛠️ Development

### Backend Development

```bash
cd web_app/backend
source venv/bin/activate  # Activate virtual environment
python api_server.py      # Start with auto-reload
```

### Frontend Development

```bash
cd web_app/frontend
npm run dev     # Start dev server with hot reload
npm run build   # Build for production
npm run preview # Preview production build
```

### Quick Development of Agent

```bash
python lib/test.py
```

## 🔑 Key Features Explained

### Session Isolation
Each chat session maintains:
- ✅ Separate agent instance with isolated state
- ✅ Independent email cache
- ✅ Dedicated filesystem for file operations
- ✅ Unique conversation history

### Real-Time Streaming
- ✅ WebSocket connection for instant communication
- ✅ Stream agent responses token-by-token
- ✅ Display tool calls and results as they happen
- ✅ Visual feedback for agent status

### Email Cache Persistence
- ✅ Caches persisted to `.emails_cache.json`
- ✅ Survives server restarts
- ✅ Automatically cleaned up on session deletion
- ✅ Session-isolated to prevent cross-contamination

## 🔧 Troubleshooting

### Email Connection Issues

<details>
<summary><b>Gmail-specific issues</b></summary>

- Use an **App Password** instead of your regular password
- Enable **IMAP access** in Gmail settings
- Check "Less secure app access" if applicable
- Verify 2FA is enabled (required for App Passwords)

</details>

<details>
<summary><b>General email issues</b></summary>

- Check firewall/proxy settings if using a proxy
- Verify IMAP/SMTP server addresses and ports
- Ensure ports 993 (IMAP) and 465/587 (SMTP) are open
- Test connection with `telnet imap.gmail.com 993`

</details>

### API Errors

<details>
<summary><b>Common API issues</b></summary>

- Verify API key is valid and has sufficient credits
- Check that `OPENAI_BASE_URL` is correct for your provider
- Some providers require specific model names
- Check rate limits and quota usage
- Review error messages in backend logs

</details>

### WebSocket Connection

<details>
<summary><b>Connection problems</b></summary>

- Ensure backend is running and accessible
- Check port conflicts in `.env`
- Verify browser console for errors
- Try refreshing the page
- Check network tab in browser DevTools

</details>

### Performance Issues

<details>
<summary><b>Slow performance</b></summary>

- Reduce email batch size in `read_emails` tool
- Close unused chat sessions
- Clear browser cache if UI is slow
- Check system resources (CPU, memory)
- Monitor network tab for large payloads

</details>

## 🔒 Security Considerations

⚠️ **Important Security Notes**:

- ❌ **Never commit** `.env` file to version control
- 🔑 Use **App Passwords** for email authentication
- 🔄 Keep API keys secure and rotate regularly
- ⚠️ Be cautious with proxy configurations
- 🌐 The app runs locally; avoid exposing ports to the internet
- 📁 Check `.gitignore` to ensure sensitive files are excluded

## 📝 TODO List

- [ ] **Email Box** - Intelligent email client interface
- [ ] **User File Upload** - Upload files for AI chat
- [ ] **Long-term Memory** - Store and retrieve conversation facts
- [ ] **Advanced Search** - AI-powered categorization
- [ ] **Multi-Account Support** - Multiple email accounts
- [ ] **Email Analytics** - Statistics dashboard
- [ ] **AI Summaries** - Thread summarization
- [ ] **Calendar Integration** - Google Calendar & Outlook
- [ ] **More LLM APIs** - Anthropic, Cohere, etc.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

Built with amazing open-source tools:

- [DeepAgents](https://github.com/langchain-ai/deepagents) - Agent orchestration
- [React](https://react.dev/) - UI framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide](https://lucide.dev/) - Icons
- [imap-tools](https://github.com/ikvk/imap_tools) - Email operations
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework

## 💬 Support

For issues and questions:

- 🐛 [Report a bug](../../issues)
- 💡 [Request a feature](../../issues)
- 📖 Check existing documentation
- 🔧 Review [troubleshooting section](#-troubleshooting)

---

<div align="center">

  **Built with ❤️ by the MailMind team**

  [⬆ Back to Top](#-mailmind)

</div>
