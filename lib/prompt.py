from datetime import datetime
import os

def load_knowledge_content():
    """Load all knowledge files content.

    All files in the knowledge directory are stored as plain text (.txt or .md)
    for agent filesystem compatibility. Binary formats are automatically converted
    during upload.
    """
    knowledge_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "knowledge")

    if not os.path.exists(knowledge_dir):
        return ""

    knowledge_content = []

    for filename in sorted(os.listdir(knowledge_dir)):
        filepath = os.path.join(knowledge_dir, filename)
        if not os.path.isfile(filepath):
            continue

        ext = os.path.splitext(filename)[1].lower()

        # Only process text files (.txt and .md)
        if ext not in ['.txt', '.md']:
            continue

        try:
            # Read text content directly
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Add file header and content
            knowledge_content.append(f"\n## {filename}\n{content}")

        except Exception as e:
            print(f"Warning: Failed to load knowledge file {filename}: {e}")
            continue

    return "\n".join(knowledge_content) if knowledge_content else ""


def load_temp_files_content(temp_files_list):
    """Load temporary files content for a session.

    Args:
        temp_files_list: List of dicts with keys: filename, content

    Returns:
        Formatted string with all temporary file contents
    """
    if not temp_files_list:
        return ""

    temp_content = []
    for file_info in sorted(temp_files_list, key=lambda x: x['filename']):
        filename = file_info['filename']
        content = file_info.get('content', '')
        temp_content.append(f"\n## {filename}\n{content}")

    return "\n".join(temp_content) if temp_content else ""


def get_main_prompt(temp_files_list=None):
    """Get the main system prompt with optional temporary files.

    Args:
        temp_files_list: Optional list of temporary file dicts for this session
    """
    knowledge_content = load_knowledge_content()

    knowledge_section = ""
    if knowledge_content:
        knowledge_section = f"""

<user_knowledge>
The following knowledge documents are available for reference:

{knowledge_content}
</user_knowledge>
"""

    # Add temporary files section if provided
    temp_files_section = ""
    if temp_files_list:
        temp_content = load_temp_files_content(temp_files_list)
        if temp_content:
            temp_files_section = f"""

<session_temp_files>
The following temporary files have been uploaded for this session and are available for reference:

{temp_content}

Note: These files are only available for this session and will not be saved to the global knowledge base.
</session_temp_files>
"""

    return f"""You are MailMind, an email management assistant helping the user manage their email communications. For context, current time is {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}.{knowledge_section}{temp_files_section}

<Task>
Your job is to use tools to manage the user's email inbox efficiently.
You can use any of the email management tools provided to you to read, organize, send, and respond to emails.
You can call these tools in series or in parallel, your email management is conducted in a tool-calling loop.
</Task>

<Available Email Management Tools>
You have access to specific email management tools:
1. **read_email**: For reading and retrieving email messages from the inbox
2. **send_email**: For composing and sending new email messages
3. **search_email**: For searching through emails to find specific messages
4. **organize_email**: For categorizing, labeling, or moving emails to folders
5. **think_tool**: For reflection and strategic planning during email management
**CRITICAL: Use think_tool after each action to reflect on results and plan next steps**
</Available Email Management Tools>

<Instructions>
Think like a professional email manager with efficiency and organization in mind. Follow these steps:

1. **Understand the user's request** - What email action does the user need? (read, send, search, organize, or respond)
2. **Start with the appropriate tool** - Use the most relevant tool for the requested action
3. **After each action, pause and assess** - Was the action successful? What additional actions are needed?
4. **Execute follow-up actions as necessary** - Respond to emails, organize messages, or search for more information
5. **Stop when the task is complete** - Confirm the user's request has been fulfilled
</Instructions>
"""