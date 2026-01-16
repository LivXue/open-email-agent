import os
import json
from dotenv import load_dotenv
load_dotenv()

from langchain_qwq import ChatQwQ
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend, CompositeBackend, StateBackend, StoreBackend
from langgraph.store.memory import InMemoryStore
from langgraph.checkpoint.memory import MemorySaver
from tavily import TavilyClient

from utils import pretty_print, pretty_print_stream, get_fs_system
from prompt import get_main_prompt
from email_tools import email_dashboard, read_emails, send_email, delete_email, flag_email, list_folders, search_address_book, download_attachments

display_reasoning = os.getenv("DISPLAY_REASONING") == "True"
chat_model = ChatQwQ(
    model="mimo-v2-flash",
    base_url=os.getenv("OPENAI_BASE_URL"),
    api_key=os.getenv("OPENAI_API_KEY"),
    temperature=0.7,
    extra_body={
                "thinking": {"type": "enabled"},
                },
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

checkpointer = MemorySaver()

def make_backend(runtime):
    return CompositeBackend(
        default=StateBackend(runtime),  # Ephemeral storage
        routes={
            "/memories/": StoreBackend(runtime)  # Persistent storage
        }
    )

agent = create_deep_agent(
    model=chat_model,
    system_prompt=get_main_prompt(),
    tools=[internet_search, email_dashboard, read_emails, send_email, delete_email, flag_email, list_folders, search_address_book, download_attachments],
    subagents=[email_writer_subagent],
    backend=get_fs_system(),
)

def main():
    messages = []
    while True:
        user_input = input("================================== User Input ==================================\n")
        if user_input.strip().lower() in ['exit', 'quit']:
            break

        messages.append({"role": "user", "content": user_input})
        for chunk in agent.stream({"messages": messages}, stream_mode="updates"):
            for step, data in chunk.items():
                pretty_print_stream(data, display_reasoning)


if __name__ == "__main__":
    main()
