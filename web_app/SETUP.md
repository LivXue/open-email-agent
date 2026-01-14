# Quick Start Guide - Email Agent Web App

## Installation & Setup

### 1. Install Dependencies

```bash
cd /data/xuedizhan/deepagents/web_app

# Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Start the Application

#### Option A: Using the startup script (Recommended)
```bash
./start.sh
```

#### Option B: Manual start
```bash
# Terminal 1 - Backend
cd backend
python api_server.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 3. Access the Application

Open your browser to: **http://localhost:3000**

## Features Overview

### 📱 Chat Page (`/`)
- Real-time streaming chat with the Email Agent
- View tool calls and their results
- Responsive message display
- Connection status indicator

### 📧 Email Page (`/emails`)
- View email list with filtering (All/Unread/Read)
- Expand emails to read full content
- See attachment information
- Quick action buttons (Reply, Forward, Delete)
- Refresh button to fetch latest emails

### ⚙️ Settings Page (`/settings`)
- Update API keys (OpenAI, Tavily)
- Configure email servers (IMAP/SMTP)
- Toggle options (Display Reasoning, Don't Mark Read)
- Set proxy configuration
- Changes take effect immediately

## Architecture

```
web_app/
├── backend/
│   ├── api_server.py          # FastAPI + WebSocket server
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx     # Main navigation layout
│   │   │   └── ChatMessage.tsx # Message display component
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx   # Chat interface
│   │   │   ├── EmailPage.tsx  # Email viewer
│   │   │   └── SettingsPage.tsx # Settings form
│   │   ├── lib/
│   │   │   ├── api.ts         # REST API client
│   │   │   └── websocket.ts   # WebSocket client
│   │   ├── App.tsx            # Root component
│   │   └── main.tsx           # Entry point
│   ├── package.json
│   └── vite.config.js
├── start.sh                   # Startup script
└── README.md                  # Documentation
```

## API Endpoints

### REST API
- `GET /api/health` - Health check
- `GET /api/settings` - Get environment settings
- `POST /api/settings` - Update environment settings

### WebSocket
- `WS /ws/chat` - Real-time chat with streaming responses

## Message Flow

1. User types message in Chat interface
2. Frontend sends via WebSocket to backend
3. Backend streams agent responses (text, tool calls, results)
4. Frontend displays in real-time
5. Chat shows:
   - User messages
   - Assistant responses (streaming)
   - Tool calls with arguments
   - Tool results

## Troubleshooting

### Backend fails to start
- Ensure Python 3.10+ is installed
- Check that port 8000 is available
- Verify dependencies: `pip install -r backend/requirements.txt`

### Frontend fails to start
- Ensure Node.js 18+ is installed
- Check that port 3000 is available
- Clear node_modules: `rm -rf frontend/node_modules && npm install`

### WebSocket connection fails
- Ensure backend is running on port 8000
- Check CORS configuration in `api_server.py`
- Verify WebSocket proxy in `vite.config.js`

### Agent not responding
- Check environment variables in `.env`
- Verify API keys are valid
- Check backend logs for errors
- Ensure email credentials are correct

## Development Tips

### Hot Reload
- Frontend: Vite provides hot reload automatically
- Backend: Use `uvicorn --reload` for auto-restart

### Building for Production
```bash
cd frontend
npm run build
# Serve the 'dist' folder with a web server
```

### Adding New Features
1. Add backend endpoint in `api_server.py`
2. Add API client in `frontend/src/lib/api.ts`
3. Create UI components in `frontend/src/components/` or `frontend/src/pages/`
4. Add route in `frontend/src/App.tsx`

## Tech Stack

- **Backend**: FastAPI, WebSocket, LangChain/LangGraph
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Communication**: REST API + WebSocket streaming
- **Styling**: Tailwind CSS with custom colors

## Security Notes

⚠️ **Important**: This is a development setup. For production:
- Add authentication/authorization
- Use HTTPS/WSS
- Implement rate limiting
- Validate all user inputs
- Store secrets securely (not in .env)
- Add CSRF protection
- Implement proper session management

## Support

For issues or questions:
1. Check the logs in both backend and frontend terminals
2. Verify all dependencies are installed
3. Ensure ports are available
4. Check browser console for frontend errors
5. Check backend terminal for API errors
