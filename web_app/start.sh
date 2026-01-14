#!/bin/bash

# MailMind Web App Startup Script

echo "Starting MailMind Web Application..."
echo ""

# Check if we're in the web_app directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "Error: Please run this script from the web_app directory"
    exit 1
fi

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

# Start backend in background
cd backend
if [ -d "venv" ]; then
    source venv/bin/activate
fi
echo "Starting backend server on http://localhost:8000"
python api_server.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend
cd frontend
echo "Starting frontend dev server on http://localhost:3000"
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✓ Application started!"
echo "  - Backend: http://localhost:8000"
echo "  - Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Handle shutdown
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

# Wait for any process to exit
wait
