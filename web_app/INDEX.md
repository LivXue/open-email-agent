# 📧 Email Agent Web Application

> A modern web interface for the Email Agent with real-time chat, email management, and settings configuration.

**Built with:** React • TypeScript • FastAPI • WebSocket • Tailwind CSS

---

## 🚀 Quick Start

```bash
# Navigate to web app
cd /data/xuedizhan/deepagents/web_app

# Install dependencies
cd backend && pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..

# Start application
./start.sh

# Open browser
http://localhost:3000
```

---

## ✨ Features

### 💬 Chat Interface
- Real-time streaming conversation with Email Agent
- View tool calls and results
- Connection status indicator
- Message history with timestamps

### 📧 Email Management
- View emails with filtering (All/Unread/Read)
- Expand to read full content
- See attachment information
- Quick actions (Reply, Forward, Delete)
- Refresh for latest emails

### ⚙️ Settings Configuration
- Update API keys (OpenAI, Tavily)
- Configure email servers (IMAP/SMTP)
- Toggle options (Display Reasoning, Don't Mark Read)
- Set proxy configuration
- Instant agent restart on save

---

## 📁 Project Structure

```
web_app/
├── 📄 Documentation
│   ├── README.md           # Full documentation
│   ├── SETUP.md            # Quick start guide
│   ├── ARCHITECTURE.md     # System architecture
│   ├── FEATURES.md         # Feature overview
│   ├── PROJECT_SUMMARY.md  # Project summary
│   └── INDEX.md            # This file
│
├── 🔧 Backend (Python/FastAPI)
│   ├── api_server.py       # WebSocket + REST API
│   └── requirements.txt    # Python dependencies
│
├── 🎨 Frontend (React/TypeScript)
│   ├── src/
│   │   ├── components/     # Layout, ChatMessage
│   │   ├── pages/          # Chat, Email, Settings
│   │   ├── lib/            # API, WebSocket clients
│   │   ├── App.tsx         # Root component
│   │   └── main.tsx        # Entry point
│   ├── package.json        # NPM dependencies
│   └── vite.config.js      # Build config
│
└── 🛠️ Utilities
    ├── start.sh            # Startup script
    └── .gitignore          # Git ignore rules
```

---

## 📚 Documentation Guide

| Document | Description |
|----------|-------------|
| **[README.md](./README.md)** | Comprehensive documentation with installation, usage, and API reference |
| **[SETUP.md](./SETUP.md)** | Quick start guide with troubleshooting tips |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Detailed system architecture and data flow |
| **[FEATURES.md](./FEATURES.md)** | Feature overview and UX details |
| **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** | Project summary and statistics |

---

## 🎯 Key Technologies

### Backend
- **FastAPI** - Modern Python web framework
- **WebSocket** - Real-time bidirectional communication
- **LangChain/LangGraph** - Agent framework integration
- **Pydantic** - Data validation

### Frontend
- **React 18** - UI framework with hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tool and dev server

---

## 📡 API Endpoints

### REST API
- `GET /api/health` - Health check
- `GET /api/settings` - Get configuration
- `POST /api/settings` - Update configuration

### WebSocket
- `WS /ws/chat` - Real-time chat streaming

---

## 🎨 Screenshots

### Chat Page
- Real-time streaming interface
- Tool call visualization
- Connection status

### Email Page
- Filterable email list
- Expandable email cards
- Attachment information

### Settings Page
- Organized configuration sections
- Real-time validation
- Save feedback

---

## 🔐 Configuration

Edit the `.env` file in the parent directory:

```env
# Model Settings
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://...
DISPLAY_REASONING=True

# Tavily Search
TAVILY_API_KEY=tvly-...

# Email Settings
USERNAME=your@email.com
PASSWORD=app_password
IMAP_SERVER=imap.gmail.com
IMAP_PORT=993
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
DONT_SET_READ=True
PROXY=http://... (optional)
```

Or use the Settings page in the web UI!

---

## 🐛 Troubleshooting

### Common Issues

**Backend won't start**
- Check port 8000 is available
- Verify Python 3.10+ installed
- Ensure dependencies installed: `pip install -r backend/requirements.txt`

**Frontend won't start**
- Check port 3000 is available
- Verify Node.js 18+ installed
- Clear node_modules: `rm -rf frontend/node_modules && npm install`

**WebSocket connection fails**
- Ensure backend is running
- Check CORS settings
- Verify WebSocket proxy configuration

See [SETUP.md](./SETUP.md) for detailed troubleshooting.

---

## 🚀 Development

### Start Development Servers

**Backend:**
```bash
cd backend
python api_server.py
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Build for Production

```bash
cd frontend
npm run build
# Output in frontend/dist/
```

---

## 📊 Project Stats

- **Total Files:** 26
- **Backend Code:** ~350 lines Python
- **Frontend Code:** ~1000+ lines TypeScript/TSX
- **Documentation:** ~800 lines Markdown
- **Dependencies:** 15 npm packages, 4 pip packages

---

## 🔮 Future Enhancements

- [ ] User authentication
- [ ] Multi-user support
- [ ] Compose new emails
- [ ] File attachments
- [ ] Advanced email search
- [ ] Dark/light mode
- [ ] Browser notifications
- [ ] Offline support (PWA)

---

## 📝 License

Same as parent DeepAgents project.

---

## 🤝 Contributing

Contributions welcome! Please:
1. Check existing issues
2. Fork the repository
3. Create a feature branch
4. Make your changes
5. Submit a pull request

---

## 📧 Support

For issues or questions:
1. Check the documentation
2. Review troubleshooting guide
3. Check backend/frontend logs
4. Open an issue on GitHub

---

**Built with ❤️ using React, TypeScript, FastAPI, and LangChain**

*Powered by [DeepAgents](https://github.com/anthropics/deepagents)*
