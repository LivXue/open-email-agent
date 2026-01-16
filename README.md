# MailMind

An AI-powered email management assistant that combines advanced language models with practical email operations. MailMind helps you read, organize, draft, and manage emails through an intuitive chat interface.

## Features

- **🤖 AI-Powered Email Assistant**: Interact with your emails using natural language
- **📧 Full Email Management**: Read, compose, delete, move, and flag emails
- **🔍 Smart Search**: Leverage web search capabilities for context-aware responses
- **💾 Multi-Session Support**: Maintain multiple chat sessions with isolated contexts
- **🔄 Real-Time Streaming**: Watch the AI think and respond in real-time
- **📎 Attachment Handling**: View and download email attachments
- **🎨 Modern Web Interface**: Clean, responsive UI built with React and TypeScript
- **⚙️ Configurable Settings**: Easy-to-use settings page for all configurations
- **🔔 Toast Notifications**: Beautiful notifications for errors and status updates

## Architecture

MailMind is built on a modern tech stack:

### Backend
- **FastAPI**: High-performance async Python web framework
- **LangGraph**: Advanced agent orchestration with stateful conversations
- **LangChain**: Powerful framework for LLM applications
- **WebSocket**: Real-time bidirectional communication
- **IMAP/SMTP**: Direct email protocol integration

### Frontend
- **React 18**: Modern UI with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Vite**: Lightning-fast build tool
- **Axios**: HTTP client with WebSocket support

### AI Integration
- Supports OpenAI-compatible APIs
- Tavily search integration for web access
- Subagent architecture for specialized tasks (email writing)

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- An email account with IMAP access (Gmail recommended)
- API keys for your chosen LLM provider

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/mailmind.git
cd mailmind
```

2. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your API keys and email credentials
```

3. **Start the application**:
```bash
cd web_app
./start.sh
```

The startup script will automatically:
- Install Python dependencies in a virtual environment
- Install Node.js dependencies
- Start the backend server (default: http://localhost:2821)
- Start the frontend dev server (default: http://localhost:2922)

4. **Open your browser**:
Navigate to the frontend URL (e.g., http://localhost:2922)

## Configuration

Edit the `.env` file to configure:

### Model Settings
- `MODEL`: Model name (e.g., `gpt-4`, `claude-3-sonnet`)
- `OPENAI_API_KEY`: Your API key
- `OPENAI_BASE_URL`: API endpoint URL
- `DISPLAY_REASONING`: Show model's reasoning process

### Email Settings
- `USERNAME`: Your email address
- `PASSWORD`: App-specific password (recommended)
- `IMAP_SERVER/SMTP_SERVER`: Email server addresses
- `IMAP_PORT/SMTP_PORT`: Port numbers
- `IMAP_USE_PROXY/SMTP_USE_PROXY`: Enable proxy if needed
- `PROXY`: Proxy server URL (if required)

### Network Settings
- `BACKEND_PORT`: Backend server port (default: 2821)
- `FRONTEND_PORT`: Frontend dev server port (default: 2922)

## Usage

### Chat Interface

1. **Start a Conversation**: Type your request in natural language
   - "Read my unread emails"
   - "Draft a reply to the latest email from John"
   - "Delete all emails from newsletter@example.com"

2. **Watch the AI Work**: See the agent's thought process and tool calls in real-time

3. **Manage Multiple Sessions**: Create new chat sessions for different tasks

### Email Management

The AI can perform these actions:
- 📖 **Read**: Fetch and display emails with filtering
- ✉️ **Send**: Compose and send new emails
- 🗑️ **Delete**: Remove unwanted emails
- 📁 **Move**: Organize emails into folders
- 🏴 **Flag**: Mark emails as important/unread
- 📎 **Attachments**: View and download attachments

### Settings Page

Access settings through the web interface to:
- Update API keys
- Configure email servers
- Adjust network ports
- Toggle display options

## Project Structure

```
mailmind/
├── deepagents/           # Core agent framework
│   ├── backends/        # Backend implementations (filesystem, etc.)
│   ├── middleware/      # Agent middleware (skills, memory, etc.)
│   └── ...             # Framework code
├── lib/                 # Shared utilities
│   ├── email_tools.py  # Email operations
│   ├── prompt.py       # System prompts
│   └── ...            # Helper modules
├── web_app/            # Web application
│   ├── backend/       # FastAPI server
│   │   ├── api_server.py
│   │   └── requirements.txt
│   ├── frontend/      # React + TypeScript UI
│   │   ├── src/
│   │   │   ├── components/  # UI components
│   │   │   ├── pages/       # Page components
│   │   │   ├── lib/         # API & utilities
│   │   │   └── contexts/    # React contexts
│   │   ├── package.json
│   │   └── vite.config.js
│   └── start.sh      # Startup script
├── .env.example       # Environment template
└── README.md         # This file
```

## Development

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

## Key Features Explained

### Session Isolation
Each chat session maintains:
- Separate agent instance with isolated state
- Independent email cache
- Dedicated filesystem for file operations
- Unique conversation history

### Email Cache Persistence
- Email caches are persisted to `.emails_cache.json`
- Survives server restarts
- Automatically cleaned up when sessions are deleted
- Session-isolated to prevent cross-contamination

### Real-Time Streaming
- WebSocket connection for instant communication
- Stream agent responses token-by-token
- Display tool calls and results as they happen
- Visual feedback for agent status

### Toast Notifications
- Beautiful, non-blocking notifications
- Four types: success, error, info, warning
- Auto-dismiss after 5 seconds
- Manual dismiss with X button

## Troubleshooting

### Email Connection Issues
- Use an **App Password** instead of your regular password (especially for Gmail)
- Enable **IMAP access** in your email settings
- Check firewall/proxy settings if using a proxy
- Verify IMAP/SMTP server addresses and ports

### API Errors
- Verify your API key is valid and has sufficient credits
- Check that `OPENAI_BASE_URL` is correct for your provider
- Some providers require specific model names
- Check rate limits and quota

### WebSocket Connection
- Ensure backend is running and accessible
- Check port conflicts in `.env`
- Verify browser console for errors
- Try refreshing the page

### Performance Issues
- Reduce email batch size in `read_emails` tool
- Close unused chat sessions
- Clear browser cache if UI is slow
- Check system resources

## Security Considerations

- **Never commit** `.env` file to version control
- Use **App Passwords** for email authentication
- Keep API keys secure and rotate regularly
- Be cautious with proxy configurations
- The app runs locally; avoid exposing ports to the internet

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Built with [LangGraph](https://github.com/langchain-ai/langgraph) for agent orchestration
- UI powered by [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/)
- Icons by [Lucide](https://lucide.dev/)
- Email operations via [imap-tools](https://github.com/ikvk/imap_tools)

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section above

---

Made with ❤️ by the MailMind team
