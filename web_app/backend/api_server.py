"""FastAPI backend server for MailMind web application."""
# Add parent directories to path for imports
# We need to add the project root directory to import deepagents and email_tools
import os
import sys
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.insert(0, project_root)
import json
import asyncio
from typing import AsyncGenerator, Optional
from datetime import datetime, UTC

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
# Load environment variables first
load_dotenv()
from langchain_qwq import ChatQwQ
from tavily import TavilyClient
from langchain_core.messages import AIMessage, ToolMessage

from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from lib.prompt import MAIN_PROMPT

# Import email_tools module to ensure init_email() is called
import lib.email_tools as email_tools_module
from lib.email_tools import (
            email_dashboard,
            read_emails,
            send_email,
            delete_email,
            move_email,
            flag_email,
            list_folders,
            search_address_book,
            download_attachments
        )


# These will be imported lazily when needed
chat_model = None
agent = None

# Initialization status flags
email_initialized = False
agent_initialized = False
email_imap_connected = False
email_smtp_connected = False

app = FastAPI(title="MailMind API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global agent instance
agent = None
agent_lock = asyncio.Lock()

# Store active connections
active_connections: dict[str, WebSocket] = {}


class ChatMessage(BaseModel):
    """Chat message model."""
    message: str
    session_id: Optional[str] = None


class EnvSettings(BaseModel):
    """Environment settings model."""
    MODEL: str
    OPENAI_API_KEY: str
    OPENAI_BASE_URL: str
    DISPLAY_REASONING: bool = True
    TAVILY_API_KEY: str
    USERNAME: str
    PASSWORD: str
    IMAP_SERVER: str
    IMAP_PORT: int = 993
    IMAP_USE_PROXY: bool = False
    SMTP_SERVER: str
    SMTP_PORT: int = 465
    SMTP_USE_SSL: bool = True
    SMTP_USE_PROXY: bool = False
    DONT_SET_READ: bool = True
    PROXY: Optional[str] = None


def get_imports():
    """Get email tools dictionary."""
    return {
        "email_dashboard": email_dashboard,
        "read_emails": read_emails,
        "send_email": send_email,
        "delete_email": delete_email,
        "move_email": move_email,
        "flag_email": flag_email,
        "list_folders": list_folders,
        "search_address_book": search_address_book,
        "download_attachments": download_attachments,
    }


def check_email_services():
    """Check email service status."""
    global email_initialized, email_imap_connected, email_smtp_connected

    # Check if email_tools module initialized
    email_initialized = hasattr(email_tools_module, 'mailbox') and hasattr(email_tools_module, 'smtp_client')

    # Check connection status
    if email_initialized:
        email_imap_connected = email_tools_module.mailbox is not None
        email_smtp_connected = email_tools_module.smtp_client is not None

    return {
        "email_initialized": email_initialized,
        "imap_connected": email_imap_connected,
        "smtp_connected": email_smtp_connected
    }


def initialize_agent():
    """Initialize the DeepAgent instance."""
    global agent, agent_initialized

    try:
        display_reasoning = os.getenv("DISPLAY_REASONING", "False") == "True"
        chat_model = ChatQwQ(
            model=os.getenv("MODEL"),
            base_url=os.getenv("OPENAI_BASE_URL"),
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=0.7,
            # extra_body={
            #     "thinking": {"type": "enabled"},
            # },
        )

        tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

        def internet_search(query: str, max_results: int = 5):
            """Run a web search"""
            return tavily_client.search(query, max_results=max_results)

        email_writer_subagent = {
            "name": "email-writer",
            "description": "Used to write an email, receive user's request and correspondence, and then write an email in a polite manner.",
            "system_prompt": "You are a professional email writer with expertise in business and personal communication. Your task is to craft well-structured, polite, and appropriate email responses based on the user's requirements and the context of previous correspondence.\n\nWhen writing an email, follow these guidelines:\n\n1. **Analyze the Context**: Carefully review the user's request and any previous email exchanges to understand:\n   - The purpose of the email (inquiry, response, follow-up, request, etc.)\n   - The relationship between sender and recipient\n   - The tone and style of previous communications\n   - Any specific requirements or constraints mentioned by the user\n\n2. **Structure Your Email**: Include:\n   - A clear and appropriate subject line\n   - A professional greeting\n   - A well-organized body with logical flow\n   - A polite closing\n   - Proper signature\n\n3. **Tone and Style**:\n   - Use a professional yet friendly tone\n   - Be concise and clear\n   - Show empathy and understanding\n   - Maintain appropriate formality based on the relationship\n   - Avoid jargon unless necessary\n\n4. **Content Guidelines**:\n   - Address all points raised in previous emails\n   - Provide complete and helpful responses\n   - If you need more information, ask politely\n   - Express gratitude when appropriate\n   - Be honest about what you can and cannot do\n\n5. **Language and Formatting**:\n   - Use proper grammar and spelling\n   - Write in clear, complete sentences\n   - Use paragraphs for readability\n   - Avoid excessive punctuation or ALL CAPS\n\nBefore writing, think through:\n- What is the main goal of this email?\n- What does the recipient need to know or do?\n- How can I be most helpful and courteous?\n- What is the appropriate level of formality?\n\nWrite the email in the same language as the user's request.",
            "tools": [internet_search],
        }

        tools = get_imports()

        agent = create_deep_agent(
            model=chat_model,
            system_prompt=MAIN_PROMPT,
            tools=[internet_search] + list(tools.values()),
            subagents=[email_writer_subagent],
            backend=FilesystemBackend(root_dir="/data/xuedizhan/deepagents/tmp"),
        )
        agent_initialized = True
        print("✓ Agent initialized successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to initialize agent: {e}")
        import traceback
        traceback.print_exc()
        agent_initialized = False
        return False


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup in the correct order."""
    print("\n" + "="*60)
    print("🚀 Starting MailMind API Server")
    print("="*60)



    # Step 1: Check email services (already initialized by module import)
    print("\n[1/3] Checking email services...")
    email_status = check_email_services()
    if email_status["email_initialized"]:
        print(f"  ✓ Email services module loaded")
        print(f"    - IMAP connected: {'✓' if email_status['imap_connected'] else '✗'}")
        print(f"    - SMTP connected: {'✓' if email_status['smtp_connected'] else '✗'}")
        if not email_status['imap_connected']:
            print("  ⚠ Warning: IMAP not connected - email fetching unavailable")
        if not email_status['smtp_connected']:
            print("  ⚠ Warning: SMTP not connected - email sending unavailable")
    else:
        print("  ✗ Email services failed to initialize")

    # Step 2: Initialize agent
    print("\n[2/3] Initializing DeepAgent...")
    agent_success = initialize_agent()
    if agent_success:
        print(f"  ✓ Agent ready")
    else:
        print(f"  ✗ Agent initialization failed")

    # Step 3: Server ready
    print("\n[3/3] Server initialization complete")
    print("="*60)
    print(f"✓ API Server ready at http://0.0.0.0:8000")
    print(f"✓ WebSocket endpoint: ws://0.0.0.0:8000/ws/chat")
    print("="*60 + "\n")


def ensure_agent():
    """Ensure agent is initialized before use."""
    global agent
    if agent is None or not agent_initialized:
        print("Initializing agent...")
        initialize_agent()
    return agent


@app.get("/api/health")
async def health_check():
    """Health check endpoint with service status."""
    email_status = check_email_services()

    return {
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
        "services": {
            "email": {
                "initialized": email_status["email_initialized"],
                "imap_connected": email_status["imap_connected"],
                "smtp_connected": email_status["smtp_connected"]
            },
            "agent": {
                "initialized": agent_initialized
            }
        }
    }


@app.get("/api/settings")
async def get_settings():
    """Get current environment settings."""
    return {
        "MODEL": os.getenv("MODEL", ""),
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
        "OPENAI_BASE_URL": os.getenv("OPENAI_BASE_URL", ""),
        "DISPLAY_REASONING": os.getenv("DISPLAY_REASONING", "False") == "True",
        "TAVILY_API_KEY": os.getenv("TAVILY_API_KEY", ""),
        "USERNAME": os.getenv("USERNAME", ""),
        "PASSWORD": os.getenv("PASSWORD", ""),
        "IMAP_SERVER": os.getenv("IMAP_SERVER", ""),
        "IMAP_PORT": int(os.getenv("IMAP_PORT", "993")),
        "IMAP_USE_PROXY": os.getenv("IMAP_USE_PROXY", "False") == "True",
        "SMTP_SERVER": os.getenv("SMTP_SERVER", ""),
        "SMTP_PORT": int(os.getenv("SMTP_PORT", "465")),
        "SMTP_USE_SSL": os.getenv("SMTP_USE_SSL", "True") == "True",
        "SMTP_USE_PROXY": os.getenv("SMTP_USE_PROXY", "False") == "True",
        "DONT_SET_READ": os.getenv("DONT_SET_READ", "True") == "True",
        "PROXY": os.getenv("PROXY", ""),
    }


@app.post("/api/settings")
async def update_settings(settings: EnvSettings):
    """Update environment settings."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")

    # Write new settings to .env file
    env_content = f"""# Model Settings
MODEL={settings.MODEL}
OPENAI_API_KEY={settings.OPENAI_API_KEY}
OPENAI_BASE_URL={settings.OPENAI_BASE_URL}
DISPLAY_REASONING={str(settings.DISPLAY_REASONING)}

# Tavily Search Settings
TAVILY_API_KEY={settings.TAVILY_API_KEY}

# Email Settings
USERNAME={settings.USERNAME}
PASSWORD={settings.PASSWORD}
IMAP_SERVER={settings.IMAP_SERVER}
IMAP_PORT={settings.IMAP_PORT}
IMAP_USE_PROXY={str(settings.IMAP_USE_PROXY)}
SMTP_SERVER={settings.SMTP_SERVER}
SMTP_PORT={settings.SMTP_PORT}
SMTP_USE_SSL={str(settings.SMTP_USE_SSL)}
SMTP_USE_PROXY={str(settings.SMTP_USE_PROXY)}
DONT_SET_READ={str(settings.DONT_SET_READ)}
"""

    if settings.PROXY:
        env_content += f"PROXY={settings.PROXY}\n"

    with open(env_path, "w") as f:
        f.write(env_content)

    # Update environment variables
    os.environ["MODEL"] = settings.MODEL
    os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
    os.environ["OPENAI_BASE_URL"] = settings.OPENAI_BASE_URL
    os.environ["DISPLAY_REASONING"] = str(settings.DISPLAY_REASONING)
    os.environ["TAVILY_API_KEY"] = settings.TAVILY_API_KEY
    os.environ["USERNAME"] = settings.USERNAME
    os.environ["PASSWORD"] = settings.PASSWORD
    os.environ["IMAP_SERVER"] = settings.IMAP_SERVER
    os.environ["IMAP_PORT"] = str(settings.IMAP_PORT)
    os.environ["IMAP_USE_PROXY"] = str(settings.IMAP_USE_PROXY)
    os.environ["SMTP_SERVER"] = settings.SMTP_SERVER
    os.environ["SMTP_PORT"] = str(settings.SMTP_PORT)
    os.environ["SMTP_USE_SSL"] = str(settings.SMTP_USE_SSL)
    os.environ["SMTP_USE_PROXY"] = str(settings.SMTP_USE_PROXY)
    os.environ["DONT_SET_READ"] = str(settings.DONT_SET_READ)
    if settings.PROXY:
        os.environ["PROXY"] = settings.PROXY

    # Reinitialize agent with new settings
    global agent, agent_initialized
    agent = None  # Clear the old agent
    agent_initialized = False
    ensure_agent()  # Initialize with new settings

    return {"status": "success", "message": "Settings updated and agent reinitialized"}


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for streaming chat responses."""
    await websocket.accept()
    session_id = id(websocket)
    active_connections[session_id] = websocket

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            user_message = data.get("message", "")
            message_history = data.get("history", [])

            if not user_message:
                continue

            # Send acknowledgment
            await websocket.send_json({
                "type": "status",
                "content": "Agent is thinking..."
            })

            # Prepare messages with history
            # History contains previous messages in format {"role": "user/assistant", "content": "..."}
            messages = []

            # Add history messages
            for hist_msg in message_history:
                if isinstance(hist_msg, dict) and "role" in hist_msg and "content" in hist_msg:
                    messages.append({
                        "role": hist_msg["role"],
                        "content": hist_msg["content"]
                    })

            # Add current user message
            messages.append({"role": "user", "content": user_message})

            config = {
                "configurable": {"thread_id": f"session_{session_id}"},
                "metadata": {
                    "assistant_id": "email-agent",
                    "agent_name": "email-agent",
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            }

            try:
                # Ensure agent is initialized
                current_agent = ensure_agent()
                if current_agent is None:
                    await websocket.send_json({
                        "type": "error",
                        "content": "Agent not available. Please check configuration."
                    })
                    continue

                for chunk in current_agent.stream(
                    {"messages": messages},
                    stream_mode="updates",
                    config=config,
                ):
                    # chunk is a dict: {step_name: step_data}
                    for step, data in chunk.items():
                        # Skip if data is None or not a dict
                        if not isinstance(data, dict):
                            continue

                        # Skip if no messages key
                        if "messages" not in data:
                            continue

                        msgs = data["messages"]
                        if not isinstance(msgs, list):
                            continue

                        for msg in msgs:
                            if isinstance(msg, AIMessage):
                                # Check if we should display reasoning content
                                display_reasoning = os.getenv("DISPLAY_REASONING", "False") == "True"

                                # Handle reasoning content if enabled
                                if display_reasoning and hasattr(msg, "additional_kwargs"):
                                    reasoning_content = msg.additional_kwargs.get("reasoning_content", "")
                                    if reasoning_content:
                                        reasoning_message = f"\n💭 **Reasoning**:\n```\n{reasoning_content}\n```\n"
                                        await websocket.send_json({
                                            "type": "text",
                                            "content": reasoning_message
                                        })
                                        await asyncio.sleep(0)

                                # Try to get content from different sources
                                text_content = None

                                # Method 1: Check content attribute
                                if hasattr(msg, "content") and msg.content:
                                    if isinstance(msg.content, str):
                                        text_content = msg.content
                                    elif isinstance(msg.content, list):
                                        # Content might be a list of content blocks
                                        for block in msg.content:
                                            if isinstance(block, dict) and block.get("type") == "text":
                                                text_content = block.get("text", "")
                                                break

                                # Method 2: Check content_blocks
                                if not text_content and hasattr(msg, "content_blocks"):
                                    for block in msg.content_blocks:
                                        if isinstance(block, dict) and block.get("type") == "text":
                                            text_content = block.get("text", "")
                                            if text_content:
                                                break

                                # Send text content
                                if text_content and isinstance(text_content, str) and text_content.strip():
                                    await websocket.send_json({
                                        "type": "text",
                                        "content": text_content
                                    })
                                    # Yield control to event loop to ensure message is sent immediately
                                    await asyncio.sleep(0)

                                # Handle tool_calls from AIMessage - send as text for display
                                tool_calls = getattr(msg, "tool_calls", [])
                                for tool_call in tool_calls:
                                    tool_name = tool_call.get("name", "")
                                    tool_args = tool_call.get("args", {})
                                    # Format tool call as readable text
                                    args_str = ", ".join(f"{k}={v}" for k, v in tool_args.items())
                                    tool_message = f"\n🔧 **Calling tool**: {tool_name}({args_str})\n"
                                    await websocket.send_json({
                                        "type": "text",
                                        "content": tool_message
                                    })
                                    await asyncio.sleep(0)
                                    # Also send tool call event for frontend tracking
                                    await websocket.send_json({
                                        "type": "tool_call",
                                        "tool": tool_name,
                                        "args": tool_args
                                    })
                                    await asyncio.sleep(0)

                            elif isinstance(msg, ToolMessage):
                                # Handle tool result messages
                                tool_name = msg.name if hasattr(msg, "name") else "unknown"
                                content = msg.content if hasattr(msg, "content") else ""

                                # Format tool result as readable text
                                # Truncate long content for display
                                display_content = str(content)
                                # if len(display_content) > 500:
                                #     display_content = display_content[:500] + "\n... (truncated)"

                                tool_message = f"\n✅ **Tool result**: {tool_name}\n```\n{display_content}\n```\n"
                                await websocket.send_json({
                                    "type": "text",
                                    "content": tool_message
                                })
                                await asyncio.sleep(0)
                                # Also send tool result event for frontend tracking
                                await websocket.send_json({
                                    "type": "tool_result",
                                    "tool": tool_name,
                                    "content": str(content)[:1000]
                                })
                                await asyncio.sleep(0)

            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "content": f"Error: {str(e)}"
                })

            # Send completion signal
            await websocket.send_json({
                "type": "status",
                "content": "Ready"
            })

    except WebSocketDisconnect:
        del active_connections[session_id]
    except Exception as e:
        print(f"WebSocket error: {e}")
        if session_id in active_connections:
            del active_connections[session_id]


if __name__ == "__main__":
    import uvicorn
    # Note: startup_event() will handle initialization
    uvicorn.run(app, host="0.0.0.0", port=8000)
