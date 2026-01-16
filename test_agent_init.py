#!/usr/bin/env python3
"""Test agent initialization after FileData fix."""

import sys
import os
sys.path.insert(0, '/data/xuedizhan/deepagents')
os.chdir('/data/xuedizhan/deepagents/web_app/backend')

# Import necessary modules
from dotenv import load_dotenv
load_dotenv()

from langchain_qwq import ChatQwQ
from tavily import TavilyClient
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from lib.prompt import get_main_prompt
from lib import email_tools
from lib.email_tools import (
    email_dashboard, read_emails, send_email, delete_email,
    move_email, flag_email, list_folders, search_address_book,
    download_attachments
)

print('Testing agent initialization...')

# Create agent
chat_model = ChatQwQ(
    model=os.getenv('MODEL', 'mimo-v2-flash'),
    base_url=os.getenv('OPENAI_BASE_URL'),
    api_key=os.getenv('OPENAI_API_KEY'),
    temperature=0.7,
    extra_body={'thinking': {'type': 'enabled'}},
)

tavily_client = TavilyClient(api_key=os.environ['TAVILY_API_KEY'])

def internet_search(query: str, max_results: int = 5):
    return tavily_client.search(query, max_results=max_results)

email_writer_subagent = {
    'name': 'email-writer',
    'description': 'Used to write emails',
    'system_prompt': 'You are a professional email writer.',
    'tools': [internet_search],
}

tools = {
    'email_dashboard': email_dashboard,
    'read_emails': read_emails,
    'send_email': send_email,
    'delete_email': delete_email,
    'move_email': move_email,
    'flag_email': flag_email,
    'list_folders': list_folders,
    'search_address_book': search_address_book,
    'download_attachments': download_attachments,
}

try:
    agent = create_deep_agent(
        model=chat_model,
        system_prompt=get_main_prompt(),
        tools=[internet_search] + list(tools.values()),
        subagents=[email_writer_subagent],
        backend=FilesystemBackend(root_dir='/data/xuedizhan/deepagents/tmp'),
    )
    print('✓ Agent initialized successfully!')
    print(f'✓ Agent type: {type(agent)}')
except Exception as e:
    print(f'✗ Agent initialization failed: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
