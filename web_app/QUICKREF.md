# Email Agent Web App - Quick Reference

## 🚀 Start Commands

```bash
# Quick start (recommended)
cd /data/xuedizhan/deepagents/web_app && ./start.sh

# Manual start
cd backend && python api_server.py                    # Terminal 1
cd frontend && npm run dev                            # Terminal 2

# Install dependencies
pip install -r backend/requirements.txt
npm install --prefix frontend
```

## 📍 URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs (Swagger UI)
- **WebSocket:** ws://localhost:8000/ws/chat

## 🔧 Key Files

| File | Purpose |
|------|---------|
| `backend/api_server.py` | FastAPI + WebSocket server |
| `frontend/src/App.tsx` | Root component with routes |
| `frontend/src/pages/ChatPage.tsx` | Chat interface |
| `frontend/src/pages/EmailPage.tsx` | Email viewer |
| `frontend/src/pages/SettingsPage.tsx` | Settings form |
| `frontend/src/lib/websocket.ts` | WebSocket client |
| `frontend/src/lib/api.ts` | REST API client |

## 📡 API Endpoints

### REST
- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`

### WebSocket
- `WS /ws/chat` - Message types: `text`, `tool_call`, `tool_result`, `status`, `error`

## 🎯 Pages

| Route | Component | Features |
|-------|-----------|----------|
| `/` | ChatPage | Real-time streaming chat |
| `/emails` | EmailPage | Email list with filters |
| `/settings` | SettingsPage | Configuration UI |

## 🔐 Environment Variables

```env
# Model
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://...
DISPLAY_REASONING=True

# Search
TAVILY_API_KEY=tvly-...

# Email
USERNAME=your@email.com
PASSWORD=app_password
IMAP_SERVER=imap.gmail.com
IMAP_PORT=993
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
DONT_SET_READ=True
PROXY=http://... (optional)
```

## 🛠️ Development

```bash
# Frontend
cd frontend
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build

# Backend
cd backend
python api_server.py    # Start server
pip install -r requirements.txt  # Install deps
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Check port 8000, install deps |
| Frontend won't start | Check port 3000, `npm install` |
| WebSocket fails | Check backend running, CORS settings |
| Agent not responding | Check `.env` file, API keys valid |
| Email errors | Verify email credentials, IMAP/SMTP settings |

## 📚 Documentation

- **[INDEX.md](./INDEX.md)** - Project overview
- **[README.md](./README.md)** - Full documentation
- **[SETUP.md](./SETUP.md)** - Setup & troubleshooting
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical details
- **[FEATURES.md](./FEATURES.md)** - Feature overview

## 🎨 Tech Stack

**Backend:** FastAPI, WebSocket, LangChain, Pydantic
**Frontend:** React 18, TypeScript, Tailwind CSS, Vite

## 📊 Project Stats

- **Files:** 27
- **Backend:** ~350 lines Python
- **Frontend:** ~1000+ lines TypeScript/TSX
- **Docs:** ~900 lines Markdown

---

**For detailed info, see [README.md](./README.md)**
