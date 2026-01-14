# Email Agent Web App - Feature Overview

## 📱 User Interface

### Navigation Sidebar
- **Chat** - Main conversation interface with the agent
- **Emails** - View and manage email inbox
- **Settings** - Configure API keys and email settings

### Pages

#### 1. Chat Page (`/`)
**Features:**
- Real-time streaming chat with Email Agent
- Message display with timestamps
- Tool call visualization
- Connection status indicator (Connected/Disconnected)
- Auto-scroll to latest messages
- Loading animations during agent processing

**User Flow:**
```
User types message → Enter/Click Send
    ↓
WebSocket sends to backend
    ↓
Agent processes and streams response
    ↓
Real-time display of:
  - Streaming text responses
  - Tool calls with arguments
  - Tool execution results
  - Status updates
```

**Visual Elements:**
- User messages: Blue bubbles on right
- Agent messages: White bubbles on left
- Tool calls: Expandable gray boxes
- Status indicators: Connection status
- Loading spinner during processing

#### 2. Emails Page (`/emails`)
**Features:**
- Email list with filtering
- Filter options: All / Unread / Read
- Expandable email cards
- Attachment information
- Quick action buttons
- Refresh functionality

**Filter Controls:**
- Tab-style filter buttons
- Active filter highlighted
- Dynamic email count

**Email Cards Display:**
```
┌─────────────────────────────────────┐
│ ● [Subject]              [Date]    │
│   From → To                       │
│   Email body preview...            │
│   📎 2 attachments                │
│   [file1.pdf (2 MB)] [file2.doc]  │
└─────────────────────────────────────┘
```

**Expanded Email:**
- Full email body
- Reply button
- Forward button
- Delete button
- All attachment details

#### 3. Settings Page (`/settings`)
**Features:**
- Three configuration sections
- Real-time validation
- Save button with feedback
- Success/error messages

**Configuration Sections:**

**Model Settings:**
- OpenAI API Key (password field)
- Base URL
- Display Reasoning toggle

**Tavily Search Settings:**
- Tavily API Key (password field)

**Email Settings:**
- Username
- Password (password field)
- IMAP Server & Port
- SMTP Server & Port
- Don't Mark Read toggle
- Proxy URL (optional)

**Save Behavior:**
```
User clicks Save
    ↓
Validate all fields
    ↓
Write to .env file
    ↓
Update environment variables
    ↓
Reinitialize agent
    ↓
Show success message
```

## 🔧 Technical Features

### WebSocket Communication

**Message Types:**
1. **text** - Streaming text content from agent
2. **tool_call** - Tool being executed with arguments
3. **tool_result** - Tool execution result
4. **status** - Status updates (Thinking, Ready)
5. **error** - Error messages

**Connection Management:**
- Auto-reconnection with exponential backoff
- Connection state tracking
- Graceful disconnect handling
- Error recovery

### State Management

**Chat Page State:**
- messages: Array of chat messages
- input: Current input text
- isConnected: WebSocket connection status
- isLoading: Agent processing status
- currentToolCalls: Active tool executions

**Email Page State:**
- emails: Email list
- loading: Fetch status
- filter: Current filter (all/unread/read)
- expandedEmail: Currently expanded email ID

**Settings Page State:**
- settings: Form data object
- loading: Initial fetch status
- saving: Save operation status
- message: Success/error message

### Responsive Design

**Desktop (≥1024px):**
- Sidebar navigation (256px width)
- Main content area
- Full-featured interfaces

**Tablet (768px - 1023px):**
- Collapsible sidebar
- Optimized layouts
- Touch-friendly controls

**Mobile (<768px):**
- Hamburger menu
- Single column layouts
- Optimized touch targets

## 🎨 Design System

**Colors:**
- Primary: Blue (#3b82f6 - #1e3a8a)
- Success: Green
- Error: Red
- Warning: Yellow
- Neutral: Gray scale

**Typography:**
- Font: Inter, system-ui
- Headings: Bold, semibold
- Body: Regular
- Code: Monospace

**Components:**
- Buttons: Rounded corners, hover effects
- Inputs: Border ring on focus
- Cards: White with subtle border
- Modals: Centered with backdrop

## 📊 Data Flow

### Chat Flow
```
User Input
  → Frontend validation
  → WebSocket send
  → Backend receives
  → Agent stream
  → Process chunks
  → WebSocket send
  → Frontend display
```

### Settings Update Flow
```
User edits form
  → Click Save
  → Validate
  → POST /api/settings
  → Backend writes .env
  → Reinitialize agent
  → Return response
  → Show feedback
```

### Email View Flow
```
User opens /emails
  → Fetch email list
  → Display with filter
  → User clicks email
  → Expand to show details
  → User clicks action
  → Execute action
```

## 🚀 Performance Optimizations

**Frontend:**
- Virtual scrolling (future)
- Memoization (React.useMemo)
- Lazy loading
- Code splitting (future)

**Backend:**
- Streaming responses
- Connection pooling
- Efficient serialization
- Agent instance reuse

## 🔐 Security Considerations

**Current (Development):**
- CORS enabled for all origins
- No authentication
- Plain WebSocket (WS)

**Production Recommendations:**
- Enable authentication
- Use HTTPS/WSS
- Rate limiting
- Input validation
- CSRF protection
- Secure session management

## 📈 Usage Analytics (Future)

**Trackable Metrics:**
- Message count
- Tool usage
- Email operations
- Session duration
- Error rates
- Response times

## 🎯 User Experience Goals

1. **Fast** - Sub-100ms response to user actions
2. **Reliable** - Graceful error handling
3. **Intuitive** - Clear navigation and controls
4. **Responsive** - Works on all devices
5. **Accessible** - Keyboard navigation, screen readers

## 🔄 Update Workflow

**Adding New Features:**
1. Add backend endpoint (if needed)
2. Create/modify API client
3. Build UI component
4. Add route
5. Test and iterate

**Bug Fix Process:**
1. Identify issue
2. Add logging/debugging
3. Fix bug
4. Add tests (future)
5. Deploy fix

---

**For detailed documentation, see:**
- [README.md](./README.md) - Full documentation
- [SETUP.md](./SETUP.md) - Setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical details
