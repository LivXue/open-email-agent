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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Form, Query
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
from lib.prompt import get_main_prompt

# Import email_tools module to ensure init_email() is called
# We import individual tool functions for AI Agent usage
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
    _modify_address_book_impl,
    modify_address_book,
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


# ==================== Pydantic Models ====================

class ContactCreate(BaseModel):
    """Model for creating a new contact."""
    name: str
    emails: list[str] = []
    groups: list[str] = []


class ContactUpdate(BaseModel):
    """Model for updating an existing contact."""
    name: Optional[str] = None
    emails: Optional[list[str]] = None
    groups: Optional[list[str]] = None


# ==================== CORS Configuration ====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global agent instance (deprecated, use agent_instances instead)
agent = None
agent_lock = asyncio.Lock()

# Store agent instances per session
# Each session gets its own agent with independent filesystem
agent_instances: dict[str, any] = {}

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
    BACKEND_PORT: int = 8001
    FRONTEND_PORT: int = 3001


def get_imports():
    """Get email tools dictionary."""
    # Import the tool version for AI Agent usage
    #import lib.email_tools
    return {
        "email_dashboard": email_dashboard,
        "read_emails": read_emails,
        "send_email": send_email,
        "delete_email": delete_email,
        "move_email": move_email,
        "flag_email": flag_email,
        "list_folders": list_folders,
        "search_address_book": search_address_book,
        "modify_address_book": modify_address_book,  # Tool version
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
            system_prompt=get_main_prompt(),
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

    # Step 1: Load email caches from disk
    print("\n[1/3] Loading email caches from disk...")
    import lib.email_tools as email_tools_module
    email_tools_module.load_emails_cache_from_disk()

    # Step 2: Start agent initialization in background (non-blocking)
    print("\n[2/3] Starting agent initialization in background...")
    asyncio.create_task(initialize_agent_async())

    # Step 3: Server ready
    backend_port = int(os.getenv("BACKEND_PORT", "8001"))
    print("\n[3/3] Server initialization complete")
    print("="*60)
    print(f"✓ API Server ready at http://0.0.0.0:{backend_port}")
    print(f"✓ WebSocket endpoint: ws://0.0.0.0:{backend_port}/ws/chat")
    print(f"⏳ Agent will be initialized in the background...")
    print("="*60 + "\n")


async def initialize_agent_async():
    """Initialize agent asynchronously in background."""
    global agent, agent_initialized
    try:
        # Initialize email connections first with timeout
        print("  → Initializing email connections...")
        loop = asyncio.get_event_loop()
        try:
            # Add timeout to email initialization (10 seconds)
            await asyncio.wait_for(
                loop.run_in_executor(None, email_tools_module.init_email),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            print("  ⚠ Email initialization timed out (will retry on demand)")
        except Exception as e:
            print(f"  ⚠ Email initialization failed: {e}")

        # Then initialize agent
        print("  → Initializing DeepAgent...")
        try:
            # Add timeout to agent initialization (30 seconds)
            await asyncio.wait_for(
                loop.run_in_executor(None, initialize_agent),
                timeout=30.0
            )
        except asyncio.TimeoutError:
            print("  ⚠ Agent initialization timed out (will retry on demand)")
        except Exception as e:
            print(f"  ⚠ Agent initialization failed: {e}")

        # Check email services after agent init
        email_status = check_email_services()
        print("\n[Background Init] Service Status:")
        if email_status["email_initialized"]:
            print(f"  ✓ Email services loaded")
            print(f"    - IMAP connected: {'✓' if email_status['imap_connected'] else '✗'}")
            print(f"    - SMTP connected: {'✓' if email_status['smtp_connected'] else '✗'}")
        if agent_initialized:
            print(f"  ✓ Agent initialized and ready")
    except Exception as e:
        print(f"  ✗ Background initialization failed: {e}")
        import traceback
        traceback.print_exc()


def ensure_agent(session_id: str = "default"):
    """Ensure agent is initialized for the given session."""
    global agent, agent_instances

    # For backward compatibility, return global agent if session is "default"
    if session_id == "default":
        if agent is None or not agent_initialized:
            print("Initializing global agent...")
            initialize_agent()
        return agent

    # Check if agent exists for this session
    if session_id not in agent_instances:
        print(f"Initializing new agent for session: {session_id}")
        agent_instances[session_id] = initialize_agent_for_session(session_id)

    return agent_instances[session_id]


def initialize_agent_for_session(session_id: str):
    """Initialize a new agent instance for a specific session."""
    global chat_model, agent_initialized

    # Initialize chat model if needed
    if chat_model is None:
        MODEL = os.getenv("MODEL")
        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")

        if not all([MODEL, OPENAI_API_KEY]):
            print("Missing required environment variables for chat model")
            return None

        chat_model = ChatQwQ(
            model=MODEL,
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL,
        )

    # Create filesystem backend for this session
    # Each session gets its own isolated filesystem directory
    fs_base_dir = os.path.join(project_root, "agent_fs", session_id)
    os.makedirs(fs_base_dir, exist_ok=True)

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

    filesystem_backend = FilesystemBackend(
        root_dir=fs_base_dir,
        max_file_size_mb=10,  # 10MB
    )

    # Create agent with session-specific filesystem
    session_agent = create_deep_agent(
        model=chat_model,
        system_prompt=get_main_prompt(),
        backend=filesystem_backend,
        tools=[internet_search] + list(get_imports().values()), 
        subagents=[email_writer_subagent]
    )

    agent_initialized = True
    print(f"Agent initialized for session {session_id} with filesystem at {fs_base_dir}")

    return session_agent


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
        "BACKEND_PORT": int(os.getenv("BACKEND_PORT", "8001")),
        "FRONTEND_PORT": int(os.getenv("FRONTEND_PORT", "3001")),
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

    # Add network settings
    env_content += f"""
# Network Settings
BACKEND_PORT={settings.BACKEND_PORT}
FRONTEND_PORT={settings.FRONTEND_PORT}
"""

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
    os.environ["BACKEND_PORT"] = str(settings.BACKEND_PORT)
    os.environ["FRONTEND_PORT"] = str(settings.FRONTEND_PORT)

    # Reinitialize agent with new settings
    global agent, agent_initialized
    agent = None  # Clear the old agent
    agent_initialized = False
    ensure_agent()  # Initialize with new settings

    return {"status": "success", "message": "Settings updated and agent reinitialized"}


# ==================== Address Book APIs ====================

@app.get("/api/contacts")
async def get_contacts(
    name: Optional[str] = None,
    email: Optional[str] = None,
    group: Optional[str] = None
):
    """Get contacts from address book with optional filtering."""
    try:
        from lib.email_tools import load_address_book

        # Reload address book to get latest data
        load_address_book()
        from lib.email_tools import address_book_data

        # Filter contacts based on search criteria
        contacts = []
        for contact in address_book_data.values():
            normalized = {
                "id": contact.get("id", ""),
                "name": contact.get("name", ""),
                "emails": contact.get("emails", []),
                "groups": contact.get("groups", []),
                "created_time": contact.get("created_time", ""),
                "update_time": contact.get("update_time", "")
            }
            contacts.append(normalized)

        if name:
            contacts = [c for c in contacts if name.lower() in c['name'].lower()]
        if email:
            contacts = [c for c in contacts if any(email.lower() in e.lower() for e in c.get('emails', []))]
        if group:
            contacts = [c for c in contacts if group in c.get('groups', [])]

        # Sort by name
        contacts.sort(key=lambda x: x['name'])

        return {
            "status": "success",
            "contacts": contacts,
            "total": len(contacts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: str):
    """Get a specific contact by ID."""
    try:
        from lib.email_tools import load_address_book, address_book_data

        load_address_book()

        if contact_id not in address_book_data:
            raise HTTPException(status_code=404, detail="Contact not found")

        # Normalize the contact data
        contact = address_book_data[contact_id]
        normalized = {
            "id": contact.get("id", ""),
            "name": contact.get("name", ""),
            "emails": contact.get("emails", []),
            "groups": contact.get("groups", []),
            "created_time": contact.get("created_time", ""),
            "update_time": contact.get("update_time", "")
        }

        return {
            "status": "success",
            "contact": normalized
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.post("/api/contacts")
async def create_contact(contact: ContactCreate):
    """Create a new contact."""
    try:
        import lib.email_tools as email_tools_module

        # Use the module's address_book_data to avoid stale references
        email_tools_module.load_address_book()
        address_book_data = email_tools_module.address_book_data

        # Check if contact with same name already exists
        existing_names = [c['name'].lower() for c in address_book_data.values()]
        if contact.name.lower() in existing_names:
            raise HTTPException(
                status_code=400,
                detail=f"Contact with name '{contact.name}' already exists"
            )

        # Create contact
        result = email_tools_module._modify_address_book_impl(
            "add_people",
            name=contact.name,
            emails=contact.emails or [],
            groups=contact.groups or []
        )

        if "Error" in result:
            raise HTTPException(status_code=400, detail=result)

        # Reload to get the updated data
        email_tools_module.load_address_book()
        address_book_data = email_tools_module.address_book_data

        # Extract new ID from result message (e.g., "Person 新联系人 added successfully with ID 2.")
        import re
        match = re.search(r"with ID (\d+)\.", result)
        if match:
            new_id = match.group(1)
        else:
            # Fallback: find the max ID (in case the regex fails)
            new_id = str(max(int(k) for k in address_book_data.keys()))

        new_contact = address_book_data[new_id]
        normalized = {
            "id": new_contact.get("id", ""),
            "name": new_contact.get("name", ""),
            "emails": new_contact.get("emails", []),
            "groups": new_contact.get("groups", []),
            "created_time": new_contact.get("created_time", ""),
            "update_time": new_contact.get("update_time", "")
        }

        return {
            "status": "success",
            "message": "Contact created successfully",
            "contact": normalized
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.put("/api/contacts/{contact_id}")
async def update_contact(contact_id: str, contact: ContactUpdate):
    """Update an existing contact."""
    try:
        import lib.email_tools as email_tools_module

        # Use the module's address_book_data to avoid stale references
        email_tools_module.load_address_book()
        address_book_data = email_tools_module.address_book_data

        if contact_id not in address_book_data:
            raise HTTPException(status_code=404, detail="Contact not found")

        # Update name if provided
        if contact.name is not None:
            result = email_tools_module._modify_address_book_impl("edit_name", id=contact_id, name=contact.name)
            if "Error" in result:
                raise HTTPException(status_code=400, detail=result)

        # Update emails if provided
        if contact.emails is not None:
            # First, remove all existing emails (handle both 'emails' and 'email' keys)
            existing = address_book_data[contact_id]
            existing_emails = existing.get('emails', [])[:]
            if existing_emails:
                email_tools_module._modify_address_book_impl("delete_emails", id=contact_id, emails=existing_emails)
            # Add new emails
            if contact.emails:
                email_tools_module._modify_address_book_impl("add_emails", id=contact_id, emails=contact.emails)

        # Update groups if provided
        if contact.groups is not None:
            # First, remove all existing groups (handle both 'groups' and 'group' keys)
            existing = address_book_data[contact_id]
            existing_groups = existing.get('groups', [])[:]
            if existing_groups:
                email_tools_module._modify_address_book_impl("delete_groups", id=contact_id, groups=existing_groups)
            # Add new groups
            if contact.groups:
                email_tools_module._modify_address_book_impl("add_groups", id=contact_id, groups=contact.groups)

        # Get updated contact
        email_tools_module.load_address_book()
        address_book_data = email_tools_module.address_book_data

        # Normalize the contact data
        updated_contact = address_book_data[contact_id]
        normalized = {
            "id": updated_contact.get("id", ""),
            "name": updated_contact.get("name", ""),
            "emails": updated_contact.get("emails", []),
            "groups": updated_contact.get("groups", []),
            "created_time": updated_contact.get("created_time", ""),
            "update_time": updated_contact.get("update_time", "")
        }

        return {
            "status": "success",
            "message": "Contact updated successfully",
            "contact": normalized
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete a contact."""
    try:
        import lib.email_tools as email_tools_module

        # Use the module's address_book_data to avoid stale references
        email_tools_module.load_address_book()
        address_book_data = email_tools_module.address_book_data

        if contact_id not in address_book_data:
            raise HTTPException(status_code=404, detail="Contact not found")

        result = email_tools_module._modify_address_book_impl("delete_people", id=contact_id)

        if "Error" in result:
            raise HTTPException(status_code=400, detail=result)

        return {
            "status": "success",
            "message": "Contact deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.get("/api/groups")
async def get_all_groups():
    """Get all unique groups from the address book."""
    try:
        from lib.email_tools import load_address_book, address_book_data

        load_address_book()

        # Collect all unique groups (handle both 'groups' and 'group' keys)
        groups_set = set()
        for contact in address_book_data.values():
            groups = contact.get('groups', [])
            groups_set.update(groups)

        groups = sorted(list(groups_set))

        return {
            "status": "success",
            "groups": groups,
            "total": len(groups)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session and its agent instance."""
    global agent_instances

    try:
        # Remove agent instance for this session
        if session_id in agent_instances:
            del agent_instances[session_id]
            print(f"Agent instance deleted for session: {session_id}")

        # Clean up email cache for this session
        import lib.email_tools as email_tools_module
        email_tools_module.clear_emails_cache(session_id)
        print(f"Email cache cleared for session: {session_id}")

        # Clean up filesystem directory
        fs_base_dir = os.path.join(project_root, "agent_fs", session_id)
        if os.path.exists(fs_base_dir):
            import shutil
            try:
                shutil.rmtree(fs_base_dir)
                print(f"Filesystem deleted for session: {session_id}")
            except Exception as e:
                print(f"Warning: Could not delete filesystem for session {session_id}: {e}")

        return {
            "status": "success",
            "message": "Session deleted successfully"
        }
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


# ==================== Email Management APIs ====================

@app.get("/api/emails/folders")
async def get_email_folders():
    """Get all available email folders from IMAP server using async implementation."""
    try:
        print("[DEBUG] /api/emails/folders - Starting folder fetch")

        if not email_tools_module.mailbox:
            print("[DEBUG] /api/emails/folders - Mailbox is None, attempting to initialize...")
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, email_tools_module.init_email)
            print("[DEBUG] /api/emails/folders - Mailbox initialized")

        # Use the async fetch_folders function instead of synchronous call
        folders = await fetch_folders_async(email_tools_module.mailbox)
        print(f"[DEBUG] /api/emails/folders - Returning {len(folders)} selectable folders")

        return {
            "status": "success",
            "folders": folders,
            "total": len(folders)
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] /api/emails/folders - Exception: {e}")
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.get("/api/emails")
async def get_emails(
    folder: str = "INBOX",
    limit: int = 50,
    unread_only: bool = False
):
    """Get emails from a specific folder using standalone async implementation.

    This endpoint does NOT use read_emails or email_tools cache.
    It uses the same async implementation as the WebSocket endpoint.
    """
    try:
        print(f"[DEBUG] /api/emails - Fetching emails from folder: {folder}, limit: {limit}, unread_only: {unread_only}")

        if not email_tools_module.mailbox:
            print("[DEBUG] /api/emails - Mailbox is None, attempting to initialize...")
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, email_tools_module.init_email)
            print("[DEBUG] /api/emails - Mailbox initialized")

        # Use the standalone async implementation
        emails, unread_count = await fetch_emails_for_folder_async(
            email_tools_module.mailbox,
            folder,
            limit=limit,
            unread_only=unread_only
        )

        print(f"[DEBUG] /api/emails - Returning {len(emails)} emails from {folder}")

        return {
            "status": "success",
            "folder": folder,
            "emails": emails,
            "total": len(emails),
            "unread_count": unread_count
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] /api/emails - Exception: {e}")
        print(f"[ERROR] /api/emails - Traceback:\n{traceback.format_exc()}")
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.post("/api/emails/{email_uid}/flag")
async def flag_email_endpoint(
    email_uid: str,
    flag_type: str = "seen",
    value: bool = True
):
    """Flag or unflag an email."""
    # Use the same dedicated session ID for consistency
    EMAILS_UI_SESSION_ID = "emails_ui_session"

    try:
        if not email_tools_module.mailbox:
            raise HTTPException(
                status_code=503,
                detail="Email service not connected. Please check your email configuration."
            )

        # Set the dedicated Emails UI session context
        token = email_tools_module.chat_session_id_ctx.set(EMAILS_UI_SESSION_ID)

        try:
            result = flag_email.func(
                email_uid=email_uid,
                flag_type=flag_type,
                value=value
            )

            if "Error" in result:
                raise HTTPException(status_code=400, detail=result)

            return {
                "status": "success",
                "message": result
            }

        finally:
            email_tools_module.chat_session_id_ctx.reset(token)

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.delete("/api/emails/{email_uid}")
async def delete_email_endpoint(
    email_uid: str
):
    """Delete an email by UID."""
    try:
        if not email_tools_module.mailbox:
            raise HTTPException(
                status_code=503,
                detail="Email service not connected. Please check your email configuration."
            )

        # Validate UID is a number (keep as string for imap_tools)
        try:
            int(email_uid)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid email UID: {email_uid}. Must be a number."
            )

        # Delete the email
        mailbox = email_tools_module.mailbox
        mailbox.delete([email_uid])

        return {
            "status": "success",
            "message": f"Email #{email_uid} deleted successfully!"
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.post("/api/emails/{email_uid}/move")
async def move_email_endpoint(
    email_uid: str,
    destination_folder: str = Query(..., description="Destination folder name")
):
    """Move an email to a different folder."""
    import sys
    from lib.email_utils import MailBoxClient

    print(f"[Move Email] ===== MOVE EMAIL REQUEST START =====", file=sys.stderr)
    print(f"[Move Email] email_uid: {email_uid!r}", file=sys.stderr)
    print(f"[Move Email] destination_folder: {destination_folder!r}", file=sys.stderr)

    # Email configuration from email_tools module
    imap_server = email_tools_module.imap_server
    imap_port = email_tools_module.imap_port
    email = email_tools_module.email
    password = email_tools_module.password
    proxy = email_tools_module.proxy

    mailbox = None

    try:
        # Validate UID is a number (keep as string for imap_tools)
        try:
            int(email_uid)
            print(f"[Move Email] UID validation passed: {email_uid}", file=sys.stderr)
        except ValueError:
            print(f"[Move Email] ERROR: Invalid UID format: {email_uid}", file=sys.stderr)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid email UID: {email_uid}. Must be a number."
            )

        # Create a fresh mailbox connection for this operation
        print(f"[Move Email] Creating fresh IMAP connection...", file=sys.stderr)
        try:
            mailbox = MailBoxClient(
                host=imap_server,
                port=imap_port,
                timeout=30,
                proxy=proxy
            ).login(email, password)
            print(f"[Move Email] Successfully connected to IMAP server", file=sys.stderr)
        except Exception as connect_error:
            print(f"[Move Email] Failed to connect: {connect_error}", file=sys.stderr)
            raise HTTPException(
                status_code=503,
                detail=f"Failed to connect to email server: {connect_error}"
            )

        # List all folders
        print(f"[Move Email] Listing folders...", file=sys.stderr)
        try:
            all_folders = [f.name for f in mailbox.folder.list()]
            print(f"[Move Email] Found {len(all_folders)} folders", file=sys.stderr)
        except Exception as list_error:
            print(f"[Move Email] Failed to list folders: {list_error}", file=sys.stderr)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to list folders: {list_error}"
            )

        # Check if destination folder exists
        print(f"[Move Email] Checking if destination folder '{destination_folder}' exists...", file=sys.stderr)
        target_folder = destination_folder
        if destination_folder not in all_folders:
            print(f"[Move Email] Folder '{destination_folder}' not in basic list", file=sys.stderr)
            if "[Gmail]/" + destination_folder in all_folders:
                target_folder = "[Gmail]/" + destination_folder
                print(f"[Move Email] Using Gmail prefix: {target_folder}", file=sys.stderr)
            else:
                print(f"[Move Email] ERROR: Folder not found. Available: {all_folders[:10]}", file=sys.stderr)
                raise HTTPException(
                    status_code=404,
                    detail=f"Folder '{destination_folder}' not found. Available folders: {', '.join(all_folders)}"
                )
        else:
            print(f"[Move Email] Folder found: {target_folder}", file=sys.stderr)

        # Move the email using imap_tools (UID should be string)
        print(f"[Move Email] Attempting to move email {email_uid} to '{target_folder}'...", file=sys.stderr)
        try:
            mailbox.move([email_uid], target_folder)
            print(f"[Move Email] Move operation completed successfully!", file=sys.stderr)
        except Exception as move_error:
            print(f"[Move Email] Move operation failed: {move_error}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to move email: {move_error}"
            )

        result = {
            "status": "success",
            "message": f"Email #{email_uid} moved to '{target_folder}' successfully!"
        }
        print(f"[Move Email] Returning success response", file=sys.stderr)
        print(f"[Move Email] ===== MOVE EMAIL REQUEST END =====", file=sys.stderr)
        return result

    except HTTPException:
        print(f"[Move Email] HTTPException raised", file=sys.stderr)
        raise
    except Exception as e:
        import traceback
        print(f"[Move Email] Unexpected exception: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        # Always logout and cleanup the mailbox connection
        if mailbox:
            try:
                print(f"[Move Email] Cleaning up mailbox connection...", file=sys.stderr)
                mailbox.logout()
                print(f"[Move Email] Mailbox connection closed", file=sys.stderr)
            except:
                pass


@app.post("/api/emails/send")
async def send_email_endpoint(
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    cc: Optional[str] = Form(None),
    bcc: Optional[str] = Form(None),
    html: bool = Form(False)
):
    """Send an email."""
    try:
        if not email_tools_module.smtp_client:
            raise HTTPException(
                status_code=503,
                detail="Email service not connected. Please check your email configuration."
            )

        # Get SMTP client from email_tools module
        smtp_client = email_tools_module.smtp_client

        # Build email message
        from email.message import EmailMessage
        from email.utils import formataddr

        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = smtp_client.login

        # Parse recipients
        recipients = []

        # Handle 'to' field - support both "email" and "Name <email>" formats
        def parse_email(addr):
            """Parse email address, supporting both 'email' and 'Name <email>' formats."""
            if '<' in addr and '>' in addr:
                # Format: "Name <email>" or "Name <email>" or "Name<email>"
                name = addr[:addr.index('<')].strip().strip('"')
                email_addr = addr[addr.index('<') + 1:addr.index('>')].strip()
                return (name, email_addr) if name else ('', email_addr)
            else:
                # Just email address
                return ('', addr.strip())

        # Parse 'to' recipients (comma separated)
        for addr in to.split(','):
            addr = addr.strip()
            if addr:
                name, email_addr = parse_email(addr)
                msg['To'] = formataddr((name, email_addr)) if name else email_addr
                recipients.append(email_addr)

        # Parse 'cc' recipients if provided
        if cc:
            for addr in cc.split(','):
                addr = addr.strip()
                if addr:
                    name, email_addr = parse_email(addr)
                    msg['Cc'] = formataddr((name, email_addr)) if name else email_addr
                    recipients.append(email_addr)

        # Parse 'bcc' recipients if provided
        if bcc:
            for addr in bcc.split(','):
                addr = addr.strip()
                if addr:
                    name, email_addr = parse_email(addr)
                    recipients.append(email_addr)

        # Set body
        content_type = 'html' if html else 'plain'
        msg.set_content(body, subtype=content_type)

        # Send email
        smtp_client.send_message(
            msg,
            to=recipients,
            from_=smtp_client.login
        )

        return {
            "status": "success",
            "message": f"Email sent successfully to {to}!"
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


# ==================== Email Loading WebSocket - Completely New Implementation ====================
# This is a standalone implementation that does NOT use read_emails or any email_tools functions
# It directly interacts with the IMAP mailbox using imap_tools

EMAILS_UI_SESSION_ID = "emails_ui_session"

# In-memory cache for Emails UI (simple dictionary-based)
_emails_ui_cache: dict[str, list[dict]] = {}
_folder_unread_counts: dict[str, int] = {}

# Global lock to prevent concurrent IMAP operations
# IMAP connections are not thread-safe, so we need to serialize access
_imap_lock = asyncio.Lock()


def _get_emails_from_cache(folder_name: str) -> list[dict]:
    """Get emails from cache for a folder."""
    return _emails_ui_cache.get(folder_name, [])


def _save_emails_to_cache(folder_name: str, emails: list[dict]):
    """Save emails to cache for a folder."""
    _emails_ui_cache[folder_name] = emails


def _get_folder_unread_count(folder_name: str) -> int:
    """Get unread count for a folder."""
    return _folder_unread_counts.get(folder_name, 0)


def _update_folder_unread_count(folder_name: str, count: int):
    """Update unread count for a folder."""
    _folder_unread_counts[folder_name] = count


async def fetch_folders_async(mailbox) -> list[dict]:
    """Fetch folder list asynchronously.

    This is a standalone function that directly uses the mailbox to fetch folders.
    Does NOT use any email_tools functions.
    Uses a global lock to prevent concurrent IMAP operations.
    """
    import asyncio

    # Acquire lock to prevent concurrent IMAP operations
    async with _imap_lock:
        # Fetch folders in thread pool to avoid blocking
        loop = asyncio.get_event_loop()

        def get_folders():
            return list(mailbox.folder.list())

        folders = await loop.run_in_executor(None, get_folders)

        # Filter and format folders
        folder_list = []
        for folder in folders:
            is_selectable = '\\Noselect' not in folder.flags
            if is_selectable:
                folder_list.append({
                    "name": folder.name,
                    "flags": list(folder.flags) if folder.flags else []
                })

        return folder_list


async def fetch_emails_for_folder_async(
    mailbox,
    folder_name: str,
    limit: int = 50,
    unread_only: bool = False
) -> tuple[list[dict], int]:
    """Fetch emails for a specific folder asynchronously.

    Returns:
        tuple: (list of formatted email dicts, unread count)

    This is a COMPLETELY NEW implementation that:
    1. Does NOT use read_emails
    2. Does NOT use email_tools cache
    3. Directly fetches from IMAP using imap_tools
    4. Formats emails in a simple, straightforward way
    5. Uses a global lock to prevent concurrent IMAP operations
    """
    import asyncio
    from imap_tools import AND

    # Acquire lock to prevent concurrent IMAP operations
    async with _imap_lock:
        # Switch to the folder
        loop = asyncio.get_event_loop()

        def switch_folder():
            mailbox.folder.set(folder_name)

        await loop.run_in_executor(None, switch_folder)

        # Build search criteria
        criteria = []
        if unread_only:
            criteria = [AND(seen=False)]

        # Fetch emails
        def fetch_from_imap():
            if criteria:
                return list(mailbox.fetch(AND(*criteria), limit=limit, mark_seen=False))
            else:
                return list(mailbox.fetch(limit=limit, mark_seen=False))

        raw_emails = await loop.run_in_executor(None, fetch_from_imap)

    # Format emails
    formatted_emails = []
    unread_count = 0

    for email in raw_emails:
        try:
            # Extract basic fields
            subject = getattr(email, 'subject', '(No Subject)')
            uid = str(email.uid)
            date_str = getattr(email, 'date_str', '')

            # Parse sender
            sender_email = 'unknown@example.com'
            sender_name = ''

            from_field = str(getattr(email, 'from_', ''))
            if from_field:
                # Try to extract email from from field
                import re
                email_match = re.search(r'<([^>]+)>', from_field)
                if email_match:
                    # Format: "Name <email>" or <email>
                    sender_email = email_match.group(1)
                    # Extract name before email
                    # Matches: "Name <email>", 'Name <email>', Name <email>
                    name_match = re.match(r'^"?([^"<>]+?)"?\s*<', from_field)
                    sender_name = name_match.group(1).strip() if name_match else ''
                else:
                    # No angle brackets - the whole string is either:
                    # 1. Just an email address (someone@example.com)
                    # 2. Just a name (without @)
                    if '@' in from_field:
                        # It's an email address
                        sender_email = from_field.strip()
                        sender_name = ''  # Don't extract username from email
                    else:
                        # It's just a name without email
                        sender_name = from_field.strip()

            # Parse recipients
            recipients = []
            to_field = getattr(email, 'to', [])
            if to_field:
                for to in to_field:
                    to_str = str(to)
                    import re
                    email_match = re.search(r'<([^>]+)>', to_str)
                    if email_match:
                        recipients.append(email_match.group(1))
                    elif '@' in to_str:
                        recipients.append(to_str.strip())

            # Get original RFC822 raw email content
            # This is the complete raw email with headers and body as received from IMAP
            raw_rfc822 = ''
            if hasattr(email, 'obj') and email.obj:
                try:
                    raw_rfc822 = email.obj.as_string()
                except Exception as e:
                    print(f"[Emails WS] Warning: Could not get raw RFC822 for email {uid}: {e}")
                    raw_rfc822 = ''

            # Get original HTML and text for raw copy functionality
            original_html = email.html if hasattr(email, 'html') else ''
            original_text = email.text if hasattr(email, 'text') else ''

            # Debug: Log email content availability
            if not original_html and not original_text:
                print(f"[Emails WS] Warning: Email {uid} has no HTML or text body (attachments: {len(email.attachments) if hasattr(email, 'attachments') else 0})")

            # Get body - prefer HTML over plain text for richer content
            # HTML emails contain formatting, images, links, etc.
            body = original_html or original_text or ''

            # Get preview text - strip HTML tags for list view
            preview_text = original_text or ''
            if not preview_text and original_html:
                # Strip HTML tags if no plain text available
                import re
                preview_text = re.sub(r'<[^>]+>', '', original_html)
                preview_text = re.sub(r'\s+', ' ', preview_text).strip()

            # Check flags
            is_unread = '\\Seen' not in email.flags
            is_flagged = '\\Flagged' in email.flags

            if is_unread:
                unread_count += 1

            # Get attachments
            attachments = []
            if hasattr(email, 'attachments'):
                for att in email.attachments:
                    if att.content_disposition and att.content_disposition != 'inline':
                        attachments.append({
                            'filename': att.filename or 'unnamed',
                            'size': len(att.payload) if att.payload else 0,
                            'contentType': att.content_type if hasattr(att, 'content_type') else 'application/octet-stream'
                        })

            # Create formatted email dict
            formatted_email = {
                'uid': uid,
                'subject': subject,
                'from': sender_email,
                'fromName': sender_name or sender_email,
                'to': recipients,
                'date': date_str,
                'body': body,
                'html': original_html,  # Original HTML content
                'text': original_text,  # Original plain text content
                'raw': raw_rfc822,  # Complete RFC822 raw email with headers
                'preview': preview_text[:500] if preview_text else '',  # First 500 chars for list view
                'isUnread': is_unread,
                'isFlagged': is_flagged,
                'attachments': attachments
            }

            formatted_emails.append(formatted_email)

        except Exception as e:
            print(f"[Emails WS] Error formatting email {email.uid if hasattr(email, 'uid') else 'unknown'}: {e}")
            continue

    # Save to cache
    _save_emails_to_cache(folder_name, formatted_emails)
    _update_folder_unread_count(folder_name, unread_count)

    print(f"[Emails WS] Fetched and formatted {len(formatted_emails)} emails from {folder_name} ({unread_count} unread)")

    return formatted_emails, unread_count


@app.websocket("/ws/emails")
async def websocket_emails(websocket: WebSocket):
    """WebSocket endpoint for streaming email loading progress.

    This is a COMPLETELY NEW implementation that:
    1. Does NOT use read_emails function
    2. Does NOT use email_tools cache
    3. Directly uses IMAP mailbox via imap_tools
    4. Maintains its own simple in-memory cache
    5. All operations are async and non-blocking

    Workflow:
    1. Initialize email connection if needed
    2. Fetch folder list asynchronously
    3. Send folders to client immediately
    4. Load emails for each folder progressively
    5. Stream results to client in real-time

    Message types (Server -> Client):
    - status: Status update
    - folders: Complete folder list
    - folder_loading: Starting to load a folder
    - folder_loaded: Folder loading complete with email data
    - error: Error occurred
    - complete: All folders loaded
    - pong: Response to ping

    Message types (Client -> Server):
    - ping: Keep-alive heartbeat
    - refresh: Reload all emails
    """
    await websocket.accept()

    websocket_id = id(websocket)
    active_connections[websocket_id] = websocket

    print(f"[Emails WS] Connection established: websocket_{websocket_id}")

    try:
        # Step 0: Initialize email connection if needed
        if not email_tools_module.mailbox:
            await websocket.send_json({
                "type": "status",
                "message": "Initializing email connection..."
            })

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, email_tools_module.init_email)

            print(f"[Emails WS] Email connection initialized")

        # Step 1: Fetch folder list
        await websocket.send_json({
            "type": "status",
            "message": "Fetching folder list..."
        })

        folders = await fetch_folders_async(email_tools_module.mailbox)

        await websocket.send_json({
            "type": "folders",
            "folders": folders,
            "total": len(folders)
        })

        print(f"[Emails WS] Sent {len(folders)} folders to client")

        # Step 2: Load emails for each folder progressively
        # Sort folders by priority: INBOX first, then common folders, then others
        def get_folder_priority(folder_name: str) -> int:
            """
            Get folder priority for loading order.
            Lower number = higher priority (loaded first).

            This works with all IMAP providers, not just Gmail.
            """
            name_lower = folder_name.lower()

            # Priority 0: INBOX (always first)
            if name_lower == 'inbox':
                return 0

            # Priority 10-70: Common important folders (recognized across providers)
            # These mappings work with Gmail, Outlook, Yahoo, Apple, and most IMAP servers
            priority_folders = {
                # Sent folders
                'sent': 10,
                'sent items': 10,
                'sent mail': 10,
                '[gmail]/sent': 10,

                # Draft folders
                'drafts': 20,
                'draft': 20,
                '[gmail]/drafts': 20,

                # Spam/Junk folders
                'junk': 30,
                'spam': 30,
                'bulk mail': 30,
                '[gmail]/spam': 30,

                # Trash folders
                'trash': 40,
                'deleted': 40,
                'deleted items': 40,
                'deleted messages': 40,
                'bin': 40,
                '[gmail]/trash': 40,

                # Archive folders
                'archive': 50,
                'all mail': 50,
                '[gmail]/all mail': 50,

                # Starred/Flagged folders
                'starred': 60,
                'flagged': 60,
                '[gmail]/starred': 60,

                # Important folders
                'important': 70,
                '[gmail]/important': 70,
            }

            # Check for exact match (case-insensitive)
            if name_lower in priority_folders:
                return priority_folders[name_lower]

            # Priority 100: Special namespace folders (like [Gmail], [Yahoo], etc.)
            # These get lower priority than common folders but higher than custom folders
            if '[' in name_lower and ']' in name_lower:
                return 100

            # Priority 200: All other custom folders (loaded last)
            return 200

        # Sort folders by priority
        ordered_folders = sorted(folders, key=lambda f: get_folder_priority(f['name']))

        for idx, folder_dict in enumerate(ordered_folders, 1):
            folder_name = folder_dict['name']

            # Notify client we're starting to load this folder
            await websocket.send_json({
                "type": "folder_loading",
                "folder": folder_name,
                "progress": idx,
                "total": len(ordered_folders)
            })

            print(f"[Emails WS] Loading folder {idx}/{len(ordered_folders)}: {folder_name}")

            try:
                # Fetch emails using our NEW implementation
                emails, unread_count = await fetch_emails_for_folder_async(
                    email_tools_module.mailbox,
                    folder_name,
                    limit=50,
                    unread_only=False
                )

                # Send loaded folder data to client
                await websocket.send_json({
                    "type": "folder_loaded",
                    "folder": folder_name,
                    "emails": emails,
                    "total": len(emails),
                    "unread_count": unread_count
                })

                print(f"[Emails WS] ✅ Loaded {len(emails)} emails from {folder_name} ({unread_count} unread)")

                # Small delay to avoid overwhelming the client
                await asyncio.sleep(0.2)

            except Exception as e:
                import traceback
                error_msg = f"Error loading folder {folder_name}: {str(e)}"
                print(f"[Emails WS] ❌ {error_msg}")
                print(traceback.format_exc())

                await websocket.send_json({
                    "type": "error",
                    "folder": folder_name,
                    "message": error_msg
                })

        # All folders loaded
        await websocket.send_json({
            "type": "complete",
            "message": "All folders loaded successfully"
        })

        print(f"[Emails WS] ✅ Completed loading all folders for websocket_{websocket_id}")

        # Keep connection alive for potential client requests
        try:
            while True:
                data = await websocket.receive_json()

                if data.get("action") == "refresh":
                    # Client wants to refresh - could be optimized to only reload changed folders
                    await websocket.send_json({
                        "type": "status",
                        "message": "Refreshing emails..."
                    })
                    # For simplicity, close and let client reconnect
                    break

                elif data.get("action") == "ping":
                    await websocket.send_json({"type": "pong"})

        except Exception:
            # Client disconnected or error
            pass

    except WebSocketDisconnect:
        print(f"[Emails WS] Connection closed: websocket_{websocket_id}")

    except Exception as e:
        import traceback
        print(f"[Emails WS] Error: {e}")
        print(traceback.format_exc())

        try:
            await websocket.send_json({
                "type": "error",
                "message": f"Server error: {str(e)}"
            })
        except Exception:
            pass

    finally:
        if websocket_id in active_connections:
            del active_connections[websocket_id]
            print(f"[Emails WS] Cleaned up connection: websocket_{websocket_id}")


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for streaming chat responses.

    IMPORTANT: session_id in this context refers to the CHAT SESSION ID,
    not the WebSocket connection ID. Each chat session has its own agent instance.
    """
    await websocket.accept()

    # Get chat session ID from first message or generate one
    # This is the CHAT SESSION ID used to route messages to the correct agent instance
    chat_session_id = None
    websocket_id = id(websocket)
    active_connections[websocket_id] = websocket

    print(f"WebSocket connection established: websocket_{websocket_id}")

    try:
        while True:
            # Receive message from client
            try:
                data = await websocket.receive_json()
            except Exception as e:
                # Handle non-JSON messages (like ping)
                continue

            # Handle ping messages for connection keep-alive
            if data.get("type") == "ping":
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    # Connection might be closed
                    break
                continue

            # Extract chat session ID from message
            # This identifies which chat session (and thus which agent instance) to use
            client_chat_session_id = data.get("session_id")
            if client_chat_session_id and not chat_session_id:
                # First message from client with chat session ID
                chat_session_id = client_chat_session_id
                print(f"Chat session ID registered: {chat_session_id}")
            elif not chat_session_id:
                # Fallback to websocket ID if no client chat session ID
                chat_session_id = f"session_{websocket_id}"

            user_message = data.get("message", "")
            message_history = data.get("history", [])

            if not user_message:
                continue

            print(f"Received message from chat session {chat_session_id}: {user_message[:50]}...")

            # Send acknowledgment
            try:
                await websocket.send_json({
                    "type": "status",
                    "content": "Agent is thinking..."
                })
            except Exception:
                # Connection might be closed
                break

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
                "configurable": {"thread_id": f"session_{chat_session_id}"},
                "metadata": {
                    "assistant_id": "email-agent",
                    "agent_name": "email-agent",
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            }

            try:
                # Set the chat session ID in context for email tools to access
                # This ensures each chat session has its own isolated email cache
                import lib.email_tools as email_tools_module
                token = email_tools_module.chat_session_id_ctx.set(chat_session_id)

                # Ensure agent is initialized for this chat session
                # Each chat session gets its own agent instance with isolated filesystem
                current_agent = ensure_agent(chat_session_id)
                if current_agent is None:
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "content": "Agent not available. Please check configuration."
                        })
                    except Exception:
                        break
                    continue

                # Process agent stream
                # IMPORTANT: Each agent.stream() iteration is synchronous and will block
                # We need to use run_in_executor for each chunk to avoid blocking
                loop = asyncio.get_event_loop()

                # Create generator
                chunks_generator = current_agent.stream(
                    {"messages": messages},
                    stream_mode="updates",
                    config=config,
                )

                # Process chunks
                # Use a helper function to avoid StopIteration in Future
                def get_next_chunk():
                    try:
                        return next(chunks_generator), None
                    except StopIteration:
                        return None, "stop"
                    except Exception as e:
                        return None, str(e)

                while True:
                    # Get next chunk in thread pool to avoid blocking
                    chunk, error = await loop.run_in_executor(None, get_next_chunk)

                    if error == "stop":
                        # Stream finished
                        break
                    elif error:
                        print(f"Error getting next chunk: {error}")
                        break

                    if chunk is None:
                        break

                    # Check if connection is still open
                    if websocket.client_state.name != "CONNECTED":
                        break

                    # Process chunk
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
                                        try:
                                            await websocket.send_json({
                                                "type": "text",
                                                "content": reasoning_message
                                            })
                                        except Exception:
                                            break

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
                                    try:
                                        await websocket.send_json({
                                            "type": "text",
                                            "content": text_content
                                        })
                                    except Exception:
                                        break

                                # Handle tool_calls from AIMessage
                                tool_calls = getattr(msg, "tool_calls", [])
                                for tool_call in tool_calls:
                                    tool_name = tool_call.get("name", "")
                                    tool_args = tool_call.get("args", {})
                                    # Format tool call as readable text for display
                                    args_str = ", ".join(f"{k}={repr(v)}" for k, v in tool_args.items())
                                    tool_message = f"\n🔧 **Calling tool**: {tool_name}({args_str})\n"
                                    try:
                                        await websocket.send_json({
                                            "type": "text",
                                            "content": tool_message
                                        })
                                        # Also send tool call event for frontend tracking
                                        await websocket.send_json({
                                            "type": "tool_call",
                                            "tool": tool_name,
                                            "args": tool_args
                                        })
                                    except Exception:
                                        break

                            elif isinstance(msg, ToolMessage):
                                # Handle tool result messages
                                tool_name = msg.name if hasattr(msg, "name") else "unknown"
                                content = msg.content if hasattr(msg, "content") else ""

                                # Format tool result as readable text for display
                                display_content = str(content)
                                tool_message = f"\n✅ **Tool result**: {tool_name}\n```\n{display_content}\n```\n"
                                try:
                                    await websocket.send_json({
                                        "type": "text",
                                        "content": tool_message
                                    })
                                    # Also send tool result event for frontend tracking
                                    await websocket.send_json({
                                        "type": "tool_result",
                                        "tool": tool_name,
                                        "content": str(content)[:1000]
                                    })
                                except Exception:
                                    break

            except Exception as e:
                print(f"Error processing message: {e}")
                import traceback
                traceback.print_exc()
                try:
                    await websocket.send_json({
                        "type": "error",
                        "content": f"Error: {str(e)}"
                    })
                except Exception:
                    break
            finally:
                # Clean up context variable
                email_tools_module.chat_session_id_ctx.reset(token)

            # Send completion signal
            try:
                await websocket.send_json({
                    "type": "status",
                    "content": "Ready"
                })
            except Exception:
                break

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: chat_session_{chat_session_id}")
        if chat_session_id in active_connections:
            del active_connections[chat_session_id]
    except Exception as e:
        print(f"WebSocket error: {e}")
        if chat_session_id in active_connections:
            del active_connections[chat_session_id]


if __name__ == "__main__":
    import uvicorn
    # Read backend port from environment
    backend_port = int(os.getenv("BACKEND_PORT", "8001"))

    # Configure uvicorn for optimal concurrent request handling
    # Single worker with higher limits allows handling multiple concurrent requests
    # without the complexity of multiple workers (which would duplicate agent/email init)
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=backend_port,
        # Single worker to avoid duplicating agent and email connections
        workers=1,
        # Use reload only in development
        reload=False,
        # Limit access log for better performance
        access_log=False,
        # Use uvloop for better performance (Linux/macOS only)
        loop="uvloop" if os.name != "nt" else "asyncio",
        # Use http protocol for better performance
        http="httptools",
        # Increase limits for concurrent connections
        limit_concurrency=100,
        limit_max_requests=1000,
        # Set timeout limits
        timeout_keep_alive=30,
        timeout_graceful_shutdown=10,
    )
