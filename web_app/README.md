# Email Agent Web Application

A modern web interface for the Email Agent, built with React, TypeScript, FastAPI, and WebSocket streaming.

## Features

- **Chat Interface**: Real-time streaming conversation with the Email Agent
- **Email Management**: View, read, and manage emails
- **Settings Page**: Configure environment variables and agent settings
- **Responsive Design**: Clean, modern UI with Tailwind CSS

## Architecture

### Backend
- **FastAPI**: RESTful API and WebSocket server
- **WebSocket**: Real-time streaming of agent responses
- **DeepAgents Integration**: Full integration with the DeepAgents framework

### Frontend
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **Vite**: Fast build tool and dev server

## Installation

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Existing DeepAgents installation

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

### Option 1: Development Mode (Recommended)

1. Start the backend server:
```bash
cd backend
python api_server.py
```
The backend will run on `http://localhost:8000`

2. In a new terminal, start the frontend:
```bash
cd frontend
npm run dev
```
The frontend will run on `http://localhost:3000`

3. Open your browser to `http://localhost:3000`

### Option 2: Production Build

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. The build output will be in `frontend/dist/`

3. Serve both backend and frontend with a production web server

## Project Structure

```
web_app/
├── backend/
│   ├── api_server.py      # FastAPI server with WebSocket
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and API clients
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## API Endpoints

### REST API
- `GET /api/health` - Health check
- `GET /api/settings` - Get current environment settings
- `POST /api/settings` - Update environment settings

### WebSocket
- `WS /ws/chat` - Real-time chat with agent streaming

## Configuration

The application reads configuration from the `.env` file in the parent directory:

- **Model Settings**: API key, base URL, display reasoning
- **Tavily Search**: API key for web search
- **Email Settings**: IMAP/SMTP configuration

Settings can be updated through the Settings page in the web UI.

## Usage

### Chat Page
- Type messages to interact with the Email Agent
- View streaming responses in real-time
- See tool calls and their results

### Email Page
- View your emails with filtering options (All/Unread/Read)
- Expand emails to read full content
- View attachment information
- Quick actions (Reply, Forward, Delete)

### Settings Page
- Update API keys and endpoints
- Configure email servers
- Toggle options like "Display Reasoning"
- Changes take effect immediately after saving

## Development

### Frontend Development
```bash
cd frontend
npm run dev    # Start dev server with hot reload
npm run build  # Build for production
npm run preview  # Preview production build
```

### Backend Development
```bash
cd backend
python api_server.py  # Start server with auto-reload
```

## Troubleshooting

### WebSocket Connection Issues
- Ensure backend is running on port 8000
- Check firewall settings
- Verify WebSocket proxy configuration in `vite.config.js`

### Import Errors
- Make sure all dependencies are installed: `npm install`
- Clear node_modules and reinstall if needed

### Agent Not Responding
- Check backend logs for errors
- Verify environment variables are set correctly
- Ensure email credentials are valid

## License

Same as parent DeepAgents project
