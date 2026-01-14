#!/usr/bin/env python
"""Quick test script to verify backend is working."""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("Testing MailMind Backend...")
print("-" * 50)

# Test 1: Check if .env file exists
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    print("✓ .env file found")
else:
    print("✗ .env file not found")

# Test 2: Import FastAPI
try:
    from fastapi import FastAPI
    print("✓ FastAPI installed")
except ImportError:
    print("✗ FastAPI not installed")
    sys.exit(1)

# Test 3: Import other dependencies
try:
    from pydantic import BaseModel
    from dotenv import load_dotenv
    print("✓ Pydantic and python-dotenv installed")
except ImportError as e:
    print(f"✗ Missing dependencies: {e}")
    sys.exit(1)

# Test 4: Load environment variables
load_dotenv()
required_vars = ["OPENAI_API_KEY", "OPENAI_BASE_URL", "TAVILY_API_KEY"]
missing_vars = []
for var in required_vars:
    if not os.getenv(var):
        missing_vars.append(var)

if missing_vars:
    print(f"⚠ Missing environment variables: {', '.join(missing_vars)}")
else:
    print("✓ All required environment variables set")

# Test 5: Import DeepAgents components
try:
    from langchain_qwq import ChatQwQ
    from deepagents import create_deep_agent
    from deepagents.backends import FilesystemBackend
    from tavily import TavilyClient
    print("✓ DeepAgents components importable")
except ImportError as e:
    print(f"⚠ Some DeepAgents components not available: {e}")
    print("  (This is OK for testing settings endpoint)")

# Test 6: Import email tools
try:
    from email_tools import read_emails, send_email, email_dashboard
    print("✓ Email tools importable")
except ImportError as e:
    print(f"⚠ Email tools not available: {e}")
    print("  (This is OK for testing settings endpoint)")

print("-" * 50)
print("Backend test complete!")
print("\nTo start the server:")
print("  cd backend && python api_server.py")
print("\nThen visit:")
print("  http://localhost:8000/docs  - API documentation")
print("  http://localhost:8000/api/health  - Health check")
print("  http://localhost:8000/api/settings  - Settings endpoint")
