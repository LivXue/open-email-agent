# Email Agent Web App - Architecture Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend (localhost:3000)                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │   Chat   │  │  Emails  │  │ Settings │                      │
│  │  Page    │  │  Page    │  │  Page    │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       │             │              │                            │
│       └─────────────┴──────────────┘                            │
│                     │                                            │
│              ┌──────▼──────┐                                     │
│              │    Layout   │                                     │
│              └──────┬──────┘                                     │
└────────────────────┼────────────────────────────────────────────┘
                     │
                     │ WebSocket (ws://localhost:8000/ws/chat)
                     │ REST API (http://localhost:8000/api/*)
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                    FastAPI Backend                               │
│                    (localhost:8000)                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐          │
│  │         WebSocket Handler (/ws/chat)              │          │
│  │  - Receives messages                              │          │
│  │  - Streams agent responses                        │          │
│  │  - Manages connections                            │          │
│  └───────────────┬──────────────────────────────────┘          │
│                  │                                             │
│  ┌───────────────▼──────────────────────────────────┐          │
│  │          REST API Endpoints                       │          │
│  │  - GET  /api/health                              │          │
│  │  - GET  /api/settings                            │          │
│  │  - POST /api/settings                            │          │
│  └───────────────┬──────────────────────────────────┘          │
│                  │                                             │
│  ┌───────────────▼──────────────────────────────────┐          │
│  │         DeepAgent Integration                    │          │
│  │  - create_deep_agent()                           │          │
│  │  - Model: ChatQwQ (mimo-v2-flash)                │          │
│  │  - Tools: email_dashboard, read_emails, etc.     │          │
│  │  - Subagents: email-writer                       │          │
│  └───────────────┬──────────────────────────────────┘          │
└──────────────────┼─────────────────────────────────────────────┘
                   │
                   │
┌──────────────────▼─────────────────────────────────────────────┐
│                    External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   OpenAI    │  │   Tavily    │  │    IMAP     │           │
│  │   API       │  │   Search    │  │   Server    │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Chat Flow

```
User Input
    │
    ▼
┌──────────────┐
│ Frontend     │
│ ChatPage.tsx │
└──────┬───────┘
       │
       │ WebSocket Message: {message: "..."}
       │
       ▼
┌──────────────┐
│ Backend      │
│ WebSocket    │
│ Handler      │
└──────┬───────┘
       │
       │ agent.astream() call
       │
       ▼
┌──────────────┐
│ DeepAgent    │
│              │
│ - ChatQwQ    │
│ - Tools      │
│ - Subagents  │
└──────┬───────┘
       │
       │ Stream chunks
       │
       ▼
┌────────────────────────────────┐
│ Message Types                  │
│ - {type: "text", content: "..."}│
│ - {type: "tool_call", ...}     │
│ - {type: "tool_result", ...}   │
│ - {type: "status", ...}        │
│ - {type: "error", ...}         │
└────────────┬───────────────────┘
             │
             │ WebSocket stream
             │
             ▼
┌──────────────┐
│ Frontend     │
│ Real-time    │
│ Display      │
└──────────────┘
```

### Settings Flow

```
Settings Page
      │
      │ GET /api/settings
      ▼
┌──────────┐
│ Backend  │→ Read .env file → Return to frontend
└──────────┘
      │
      │ User edits settings
      │ POST /api/settings
      ▼
┌──────────┐
│ Backend  │→ Write .env file → Reinitialize agent
└──────────┘
```

## Component Structure

### Frontend Components

```
App.tsx (Root)
├── BrowserRouter
└── Layout
    ├── Sidebar Navigation
    └── Routes
        ├── ChatPage (/)
        │   ├── Message List
        │   ├── ChatMessage (xN)
        │   └── Input Form
        ├── EmailPage (/emails)
        │   ├── Filter Controls
        │   └── Email List
        │       └── Email Card (xN)
        └── SettingsPage (/settings)
            ├── Model Settings
            ├── Tavily Settings
            └── Email Settings
```

### Backend Structure

```
api_server.py
├── FastAPI App
├── Middleware (CORS)
├── WebSocket Endpoint (/ws/chat)
├── REST API Endpoints
│   ├── /api/health
│   ├── /api/settings (GET)
│   └── /api/settings (POST)
└── Agent Integration
    ├── initialize_agent()
    ├── ChatQwQ Model
    ├── Tools (email, search, etc.)
    └── Subagents
```

## State Management

### Frontend State
- **ChatPage**: Messages array, connection status, loading state
- **EmailPage**: Email list, filter state, expanded email
- **SettingsPage**: Form data, save/loading status

### Backend State
- **Agent**: Global agent instance
- **Connections**: Active WebSocket connections map
- **Config**: Environment variables from .env

## Key Technologies

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **React Router**: Client-side routing
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **Lucide React**: Icons
- **markdown-to-jsx**: Markdown rendering

### Backend
- **FastAPI**: Web framework
- **WebSocket**: Real-time communication
- **LangChain/LangGraph**: Agent framework
- **ChatQwQ**: LLM integration
- **Pydantic**: Data validation
- **python-dotenv**: Environment management

## Communication Protocols

### WebSocket Message Types

```typescript
type WebSocketMessage =
  | { type: 'text'; content: string }                    // Streaming text
  | { type: 'tool_call'; tool: string; args: object }    // Tool invocation
  | { type: 'tool_result'; tool: string; content: string } // Tool output
  | { type: 'status'; content: string }                  // Status updates
  | { type: 'error'; content: string }                   // Error messages
```

### REST API Responses

**GET /api/settings**
```json
{
  "OPENAI_API_KEY": "sk-...",
  "OPENAI_BASE_URL": "https://...",
  "DISPLAY_REASONING": true,
  "TAVILY_API_KEY": "tvly-...",
  "USERNAME": "user@email.com",
  "PASSWORD": "app-password",
  "IMAP_SERVER": "imap.gmail.com",
  "IMAP_PORT": 993,
  "SMTP_SERVER": "smtp.gmail.com",
  "SMTP_PORT": 465,
  "DONT_SET_READ": true,
  "PROXY": "http://..."
}
```

## Deployment Considerations

### Production Deployment

1. **Backend**
   - Use Gunicorn or Uvicorn with workers
   - Enable HTTPS
   - Add authentication middleware
   - Implement rate limiting
   - Use environment variable management (e.g., AWS Secrets Manager)

2. **Frontend**
   - Build static files: `npm run build`
   - Serve with Nginx or CDN
   - Enable HTTPS
   - Configure proper CSP headers

3. **Security**
   - Add CSRF protection
   - Implement session management
   - Validate all inputs
   - Sanitize error messages
   - Use secure WebSocket (WSS)

## Performance Optimization

### Frontend
- Virtual scrolling for long message lists
- Memoize expensive computations
- Lazy load route components
- Optimize re-renders

### Backend
- Connection pooling for external APIs
- Cache agent configuration
- Stream responses efficiently
- Monitor memory usage

## Future Enhancements

1. **Authentication**: User login and session management
2. **Multi-user**: Support multiple email accounts
3. **File Upload**: Drag-and-drop attachments
4. **Search**: Advanced email search
5. **Notifications**: Browser push notifications
6. **Themes**: Dark/light mode toggle
7. **Offline**: Service worker for offline support
8. **Analytics**: Usage tracking and insights
