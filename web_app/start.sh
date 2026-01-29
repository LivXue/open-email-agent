#!/bin/bash

# MailMind Web App Startup Script

echo "Starting MailMind Web Application..."
echo ""

# Check if we're in the web_app directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "Error: Please run this script from the web_app directory"
    exit 1
fi

# Load ports from .env file
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set default ports if not defined in .env
BACKEND_PORT=${BACKEND_PORT:-8001}
FRONTEND_PORT=${FRONTEND_PORT:-3001}

# Install backend dependencies if needed
if [ ! -d "backend/venv" ]; then
    echo "Installing backend dependencies..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

echo "Dependencies installed!"
echo ""
echo "Starting services..."
echo ""
echo "Configuration:"
echo "  - Backend Port: $BACKEND_PORT"
echo "  - Frontend Port: $FRONTEND_PORT"
echo ""

# Start backend in background
cd backend
if [ -d "venv" ]; then
    # Use venv Python explicitly to ensure it's activated in background process
    echo "Starting backend server on http://localhost:$BACKEND_PORT"
    ./venv/bin/python api_server.py &
else
    echo "Starting backend server on http://localhost:$BACKEND_PORT"
    python api_server.py &
fi
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        echo "✓ Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠ Warning: Backend health check timeout, continuing anyway..."
    fi
    sleep 1
done

# Start frontend
cd frontend
echo "Starting frontend dev server on http://localhost:$FRONTEND_PORT"
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✓ Application started!"
echo "  - Backend: http://localhost:$BACKEND_PORT"
echo "  - Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "Stopping servers..."

    # Kill frontend process and its children
    if [ -n "$FRONTEND_PID" ]; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        pkill -P "$FRONTEND_PID" 2>/dev/null
        kill "$FRONTEND_PID" 2>/dev/null
    fi

    # Kill backend process and its children
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        pkill -P "$BACKEND_PID" 2>/dev/null
        kill "$BACKEND_PID" 2>/dev/null
    fi

    # Wait for processes to terminate
    sleep 1

    # Force kill if still running
    if [ -n "$FRONTEND_PID" ]; then
        kill -9 "$FRONTEND_PID" 2>/dev/null
    fi
    if [ -n "$BACKEND_PID" ]; then
        kill -9 "$BACKEND_PID" 2>/dev/null
    fi

    # Also kill any process using the ports
    if command -v lsof > /dev/null 2>&1; then
        lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null
        lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null
    fi

    echo "Servers stopped."
    exit 0
}

# Handle shutdown signals
trap cleanup INT TERM EXIT

# Wait for any process to exit
wait
