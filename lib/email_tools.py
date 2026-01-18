import os
import json
import ssl
import warnings
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from contextvars import ContextVar
from dotenv import load_dotenv
load_dotenv()

from better_proxy import Proxy
from imap_tools import AND, OR, MailboxLoginError
from langchain_core.tools import tool

from lib.email_utils import MailBoxClient, SMTPProxyClient

# Context variable to store the current chat session ID
# This allows each chat session to have its own isolated email cache
chat_session_id_ctx: ContextVar[str] = ContextVar('chat_session_id', default='default')

# Cache storage file path for persistence
EMAILS_CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', '.emails_cache.json')

email = os.getenv("USERNAME")
password = os.getenv("PASSWORD")
imap_server = os.getenv("IMAP_SERVER")
imap_port = int(os.getenv("IMAP_PORT"))
imap_use_proxy = os.getenv("IMAP_USE_PROXY", "False").lower() == "true"
smtp_server = os.getenv("SMTP_SERVER")
smtp_port = int(os.getenv("SMTP_PORT"))
smtp_use_ssl = os.getenv("SMTP_USE_SSL", "True").lower() == "true"
smtp_use_proxy = os.getenv("SMTP_USE_PROXY", "False").lower() == "true"
dont_set_read = os.getenv("DONT_SET_READ", "False").lower() == "true"


if proxy := os.getenv("PROXY"):
    proxy = Proxy.from_str(proxy)
else:
    proxy = None

mailbox, smtp_client = None, None

def init_email():
    global mailbox, smtp_client
    try:
        mailbox = MailBoxClient(host=imap_server, port=imap_port, timeout=30, proxy=proxy if imap_use_proxy else None).login(email, password)
    except Exception as e:
        warnings.warn(f"Login to IMAP server failed: {e}\nPlease check your IMAP setting.\nEmail fetching will be unavailable.")
        mailbox = None

    try:
        smtp_client = SMTPProxyClient(host=smtp_server, port=smtp_port, timeout=30, proxy=proxy if smtp_use_proxy else None, use_ssl=smtp_use_ssl).connect().login(email, password)
    except Exception as e:
        warnings.warn(f"Login to SMTP server failed: {e}\nPlease check your SMTP setting.\nEmail sending will be unavailable.")
        smtp_client = None

# NOTE: init_email() is now called lazily by the API server during startup
# This prevents blocking the server if email connections take time

# Cache to save recently fetched emails - now isolated per chat session
# Key: chat_session_id (str), Value: list of email objects
_emails_caches: dict[str, list] = {}


def _serialize_email_cache(emails: list) -> list:
    """Serialize email objects to dict for JSON storage."""
    serialized = []
    for email in emails:
        if email is None:
            serialized.append(None)
        else:
            # Extract essential email information
            serialized.append({
                'uid': email.uid,
                'subject': getattr(email, 'subject', ''),
                'from': str(getattr(email, 'from_', '')),
                'date': str(getattr(email, 'date_str', '')),
                'flags': getattr(email, 'flags', set()),
            })
    return serialized


def _deserialize_email_cache(data: list) -> list:
    """Deserialize dict to email cache markers.
    Note: We can't reconstruct full email objects, so we store metadata only.
    The cache will be marked as stale and will require refresh on first access.
    """
    # Return list of None placeholders to indicate cache needs refresh
    return [None] * len(data)


def load_emails_cache_from_disk():
    """Load emails cache from disk on startup."""
    global _emails_caches
    try:
        if os.path.exists(EMAILS_CACHE_FILE):
            with open(EMAILS_CACHE_FILE, 'r') as f:
                data = json.load(f)
                # Convert JSON data back to cache format
                for session_id, cache_data in data.items():
                    # Mark cache as stale (needs refresh) by using None placeholders
                    _emails_caches[session_id] = _deserialize_email_cache(cache_data)
                print(f"Loaded email caches for {len(_emails_caches)} sessions from disk")
    except Exception as e:
        print(f"Warning: Failed to load email caches from disk: {e}")
        _emails_caches = {}


def save_emails_cache_to_disk():
    """Save emails cache to disk."""
    try:
        # Serialize all caches
        data = {}
        for session_id, emails in _emails_caches.items():
            data[session_id] = _serialize_email_cache(emails)

        # Write to file
        with open(EMAILS_CACHE_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Saved email caches for {len(data)} sessions to disk")
    except Exception as e:
        print(f"Warning: Failed to save email caches to disk: {e}")


def get_emails_cache(chat_session_id: str = "default") -> list:
    """Get the emails cache for a specific chat session."""
    if chat_session_id not in _emails_caches:
        _emails_caches[chat_session_id] = []
    return _emails_caches[chat_session_id]


def set_emails_cache(chat_session_id: str, emails: list):
    """Set the emails cache for a specific chat session and persist to disk."""
    _emails_caches[chat_session_id] = emails
    # Auto-save after updating cache
    save_emails_cache_to_disk()


def clear_emails_cache(chat_session_id: str):
    """Clear the emails cache for a specific chat session and update disk."""
    if chat_session_id in _emails_caches:
        del _emails_caches[chat_session_id]
        # Auto-save after clearing cache
        save_emails_cache_to_disk()


def get_current_emails_cache() -> list:
    """Get the emails cache for the current chat session (from context)."""
    session_id = chat_session_id_ctx.get()
    return get_emails_cache(session_id)

# Backward compatibility: use default session if no session_id provided
emails_cache = []  # Deprecated: Use get_emails_cache(session_id) instead

@tool
def email_dashboard():
    """Get comprehensive email dashboard with detailed statistics for each mailbox folder.
    Use this tool to get an overview of your email inbox and identify folders needing attention.
    """
    print("Scanning all folders, please be patient... / 正在扫描所有文件夹，请耐心等待...")
    dashboard = {}
    
    folders = mailbox.folder.list()
    current_time = datetime.now()
    today = current_time.date()
    three_days_ago = today - timedelta(days=3)
    week_ago = today - timedelta(weeks=1)
    month_ago = today - timedelta(days=30)
    
    for folder in folders:
        folder_name = folder.name
        if '\\Noselect' in folder.flags:
            continue
        
        print(f"Scanning folder: {folder_name}... / 正在扫描文件夹: {folder_name}...")
        mailbox.folder.set(folder_name)
        
        total_emails = len(list(mailbox.fetch(mark_seen=False)))
        unread_emails = len(list(mailbox.fetch(AND(seen=False), mark_seen=False)))
        
        today_emails = len(list(mailbox.fetch(AND(date_gte=today), mark_seen=False)))
        three_days_emails = len(list(mailbox.fetch(AND(date_gte=three_days_ago), mark_seen=False)))
        week_emails = len(list(mailbox.fetch(AND(date_gte=week_ago), mark_seen=False)))
        month_emails = len(list(mailbox.fetch(AND(date_gte=month_ago), mark_seen=False)))
        
        today_unread = len(list(mailbox.fetch(AND(seen=False, date_gte=today), mark_seen=False)))
        three_days_unread = len(list(mailbox.fetch(AND(seen=False, date_gte=three_days_ago), mark_seen=False)))
        week_unread = len(list(mailbox.fetch(AND(seen=False, date_gte=week_ago), mark_seen=False)))
        month_unread = len(list(mailbox.fetch(AND(seen=False, date_gte=month_ago), mark_seen=False)))
        
        dashboard[folder_name] = {
            'total_emails': total_emails,
            'unread_emails': unread_emails,
            'emails_today': {
                'total': today_emails,
                'unread': today_unread
            },
            'emails_in_three_days': {
                'total': three_days_emails,
                'unread': three_days_unread
            },
            'emails_in_one_week': {
                'total': week_emails,
                'unread': week_unread
            },
            'emails_in_one_month': {
                'total': month_emails,
                'unread': month_unread
            }
        }
    
    return f"Check time: {current_time.strftime('%Y-%m-%d %H:%M:%S')}\n" + "-----Info of each folder-----\n" + json.dumps(dashboard, indent=2, ensure_ascii=False)


@tool
def read_emails(
    folder_name: Optional[str] = None,
    num_emails: Optional[int] = None,
    unread_only: bool = False,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    from_: str | List[str] | None = None,
    include_attachments: bool = True
):
    """Read emails with flexible filtering options. Emails are cached after fetching.

    Args:
        folder_name (str): The name of the folder to read emails from (e.g., 'INBOX', 'Sent', 'Drafts'). Defaults to the default folder.
        num_emails (int, optional): Maximum number of emails to retrieve. Defaults to unlimited.
        unread_only (bool, optional): If True, only retrieve unread emails. If False, retrieve all emails. Defaults to False.
        start_date (str, optional): Filter emails received on or after this date (format: 'YYYY-MM-DD'). Defaults to None.
        end_date (str, optional): Filter emails received on or before this date (format: 'YYYY-MM-DD'). Defaults to None.
        from_ (List[str], optional): Filter emails by sender(s). Multiple senders can be provided. Defaults to None.
        include_attachments (bool, optional): If True, include attachment information for each email. If False, omit attachment details. Defaults to True.
    """
    all_folders = [f.name for f in mailbox.folder.list()]
    if folder_name is None:
        folder_name = all_folders[0]
    if folder_name not in all_folders and "[Gmail]/" + folder_name in all_folders:
        folder_name = "[Gmail]/" + folder_name

    print(f"Reading emails from folder: {folder_name}... / 正在从文件夹 {folder_name} 读取邮件...")

    mailbox.folder.set(folder_name)

    criteria = []

    if unread_only:
        criteria.append(AND(seen=False))

    if from_ and type(from_) == str:
        try:
            from_ = json.loads(from_)
        except json.JSONDecodeError:
            from_ = [f.strip() for f in from_.split(",")]
    if from_ and len(from_) == 1:
        criteria.append(AND(from_=from_[0]))
    elif from_ and len(from_) > 1:
        or_criteria = OR(*[AND(from_=sender) for sender in from_])
        criteria.append(or_criteria)

    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            criteria.append(AND(date_gte=start_date_obj))
        except ValueError:
            raise ValueError(f"Invalid start_date format: {start_date}. Expected format: YYYY-MM-DD")

    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            criteria.append(AND(date_lt=end_date_obj))
        except ValueError:
            raise ValueError(f"Invalid end_date format: {end_date}. Expected format: YYYY-MM-DD")

    if criteria:
        emails = list(mailbox.fetch(AND(*criteria), limit=num_emails, mark_seen=not dont_set_read))
    else:
        emails = list(mailbox.fetch(limit=num_emails, mark_seen=not dont_set_read))

    # Get or create cache for current chat session
    session_id = chat_session_id_ctx.get()
    set_emails_cache(session_id, [])  # Clear cache for this session
    cache = get_emails_cache(session_id)  # Get the new empty cache reference
    email_info = []
    for idx, email in enumerate(emails, 1):
        cache.append(email)
        subject = getattr(email, 'subject', '(No Subject)')
        if hasattr(email, 'from_values'):
            sender = getattr(email.from_values, 'full', getattr(email.from_values, 'email', '(Unknown Sender)'))
        else:
            sender = getattr(email, 'from_', '(Unknown Sender)')

        if hasattr(email, 'to_values'):
            receiver = ','.join([getattr(to, 'full', getattr(to, 'email', '(Unknown Receiver)')) for to in email.to_values])
        else:
            receiver = ','.join(getattr(email, 'to', ['(Unknown Receiver)']))

        if hasattr(email, 'cc_values'):
            cc = ','.join([getattr(cc, 'full', getattr(cc, 'email', '(Unknown Receiver)')) for cc in email.cc_values])
        else:
            cc = ','.join(getattr(email, 'cc', ['(Unknown Receiver)']))

        if hasattr(email, 'bcc_values'):
            bcc = ','.join([getattr(bcc, 'full', getattr(bcc, 'email', '(Unknown Receiver)')) for bcc in email.bcc_values])
        else:
            bcc = ','.join(getattr(email, 'bcc', ['(Unknown Receiver)']))

        date = email.date_str
        body = email.text or email.html or '(No body content)'
        is_unread = '\\Seen' not in email.flags
        status = "[UNREAD]" if is_unread else "[READ]"
        uid = email.uid

        email_info.append(f"Email #{idx} {status} (UID: {uid})")
        email_info.append(f"Subject: {subject}")
        email_info.append(f"From: {sender}")
        email_info.append(f"To: {receiver}")
        if cc:
            email_info.append(f"CC: {cc}")
        if bcc:
            email_info.append(f"BCC: {bcc}")
        email_info.append(f"Date: {date}")

        # Include attachment information
        if include_attachments and hasattr(email, 'attachments') and len(email.attachments) > 0:
            attachment_count = 0
            for attachment in email.attachments:
                if attachment.content_disposition and attachment.content_disposition != 'inline':
                    attachment_count += 1

            if attachment_count > 0:
                email_info.append(f"Attachments: {attachment_count} file(s)")
                for att_idx, attachment in enumerate(email.attachments, 1):
                    if attachment.content_disposition and attachment.content_disposition != 'inline':
                        filename = attachment.filename
                        size = len(attachment.payload)
                        size_kb = size / 1024
                        content_type = attachment.content_type if hasattr(attachment, 'content_type') else 'unknown'
                        email_info.append(f"  - {filename} ({size_kb:.2f} KB, {content_type})")
            else:
                email_info.append("Attachments: None")

        email_info.append(f"Body:\n{body}\n")

    if not email_info:
        return f"No emails found matching the criteria in folder '{folder_name}'."

    return "\n".join(email_info)


@tool
def send_email(
    to: str,
    subject: str,
    body: str,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    html: bool = False
):
    """Send an email to specified recipients.
    
    Args:
        to (str): The recipient's email address. Multiple recipients can be separated by commas.
        subject (str): The subject line of the email.
        body (str): The body content of the email.
        cc (str, optional): CC recipients' email addresses, separated by commas. Defaults to None.
        bcc (str, optional): BCC recipients' email addresses, separated by commas. Defaults to None.
        html (bool, optional): If True, send as HTML email. If False, send as plain text. Defaults to False.
    """
    print(f"Sending email to {to}... / 正在发送邮件给 {to}...")
    
    to_addrs = [addr.strip() for addr in to.split(',')]
    cc_addrs = [addr.strip() for addr in cc.split(',')] if cc else None
    bcc_addrs = [addr.strip() for addr in bcc.split(',')] if bcc else None
    
    try:
        smtp_client.login(email, password)
        smtp_client.send_email(
            from_addr=email,
            to_addrs=to_addrs,
            subject=subject,
            body=body,
            html=html,
            cc=cc_addrs,
            bcc=bcc_addrs
        )
        
        return f"\033[92mEmail sent successfully to {to}! / 邮件成功发送给 {to}！\033[0m"
    
    except Exception as e:
        return f"\033[93mFailed to send email: {str(e)} / 发送邮件失败: {str(e)}\033[0m"


@tool
def delete_email(email_index: Optional[int] = None, email_uid: Optional[str] = None):
    """Delete an email from the mailbox by its index in the cache or UID.

    Args:
        email_index (int, optional): The index number of the email to delete (as shown in read_emails output). Defaults to None.
        email_uid (str, optional): The UID of the email to delete. Defaults to None.

    Returns:
        str: Success or error message.
    """
    if not mailbox:
        return "Error: Mailbox not connected."

    # Get cache for current session
    cache = get_current_emails_cache()

    if email_index is not None and (email_index < 1 or email_index > len(cache)):
        return f"Error: Invalid email index {email_index}. Valid range: 1-{len(cache)}."

    try:
        if email_index is not None:
            email_to_delete = cache[email_index - 1]
            if email_to_delete is None:
                return f"Error: Email #{email_index} has already been deleted. "
            email_uid = email_to_delete.uid
        elif email_uid is not None:
            # Convert email_uid to int for comparison with email.uid (which is an integer from imap_tools)
            try:
                email_uid_int = int(email_uid)
            except (ValueError, TypeError):
                return f"Error: Invalid email_uid '{email_uid}'. Must be a number."

            email_index = next((idx for idx, email in enumerate(cache, 1) if email is not None and email.uid == email_uid_int), None)
            if email_index is None:
                return f"Error: Email with UID {email_uid} not found. The email may have already been deleted."
        else:
            return "Error: Either email_index or email_uid must be provided."

        mailbox.delete(email_uid)
        cache[email_index - 1] = None

        return f"Email #{email_index} deleted successfully!"

    except Exception as e:
        return f"Failed to delete email #{email_index}: {str(e)}"


@tool
def move_email(
    email_index: Optional[int] = None,
    email_uid: Optional[str] = None,
    destination_folder: str = None
):
    """Move an email to a different folder.

    Args:
        email_index (int, optional): The index number of the email to move (as shown in read_emails output). Defaults to None.
        email_uid (str, optional): The UID of the email to move. Defaults to None.
        destination_folder (str): The name of the destination folder (e.g., 'INBOX', 'Archive', 'Spam').

    Returns:
        str: Success or error message.
    """
    if not mailbox:
        return "Error: Mailbox not connected."

    # Get cache for current session
    cache = get_current_emails_cache()

    if email_index is not None and (email_index < 1 or email_index > len(cache)):
        return f"Error: Invalid email index {email_index}. Valid range: 1-{len(cache)}."

    if not destination_folder:
        return "Error: destination_folder must be provided."

    try:
        # Get all available folders
        all_folders = [f.name for f in mailbox.folder.list()]

        # Handle Gmail folder naming
        if destination_folder not in all_folders:
            if "[Gmail]/" + destination_folder in all_folders:
                destination_folder = "[Gmail]/" + destination_folder
            else:
                return f"Error: Folder '{destination_folder}' not found. Available folders: {', '.join(all_folders)}"

        if email_index is not None:
            email_to_move = cache[email_index - 1]
            if email_to_move is None:
                return f"Error: Email #{email_index} has already been deleted."
            email_uid = email_to_move.uid
        elif email_uid is not None:
            # Convert email_uid to int for comparison with email.uid (which is an integer from imap_tools)
            try:
                email_uid_int = int(email_uid)
            except (ValueError, TypeError):
                return f"Error: Invalid email_uid '{email_uid}'. Must be a number."

            email_index = next((idx for idx, email in enumerate(cache, 1) if email is not None and email.uid == email_uid_int), None)
            if email_index is None:
                return f"Error: Email with UID {email_uid} not found in cache."
        else:
            return "Error: Either email_index or email_uid must be provided."

        # Move the email
        mailbox.move(email_uid, destination_folder)
        cache[email_index - 1] = None

        return f"Email #{email_index} moved successfully to '{destination_folder}'!"

    except Exception as e:
        return f"Failed to move email #{email_index}: {str(e)}"


@tool
def flag_email(
    email_index: Optional[int] = None,
    email_uid: Optional[str] = None,
    flag_type: str = "seen",
    value: bool = True
):
    """Set or unset email flags (read/unread status, important/starred, etc.).

    Args:
        email_index (int, optional): The index number of the email to flag. Defaults to None.
        email_uid (str, optional): The UID of the email to flag. Defaults to None.
        flag_type (str): Type of flag to modify. Options:
            - 'seen' or 'read': Mark as read/unread (default)
            - 'flagged' or 'important': Mark as important/starred
            - 'answered': Mark as answered
            - 'draft': Mark as draft
        value (bool): True to set the flag, False to unset. Defaults to True.

    Returns:
        str: Success or error message.

    Examples:
        flag_email(email_index=1, flag_type="seen", value=True)  # Mark as read
        flag_email(email_index=1, flag_type="read", value=False)  # Mark as unread
        flag_email(email_index=1, flag_type="flagged", value=True)  # Mark as important
        flag_email(email_index=1, flag_type="important", value=False)  # Unmark as important
    """
    if not mailbox:
        return "Error: Mailbox not connected."

    # Get cache for current session
    cache = get_current_emails_cache()

    if email_index is not None and (email_index < 1 or email_index > len(cache)):
        return f"Error: Invalid email index {email_index}. Valid range: 1-{len(cache)}."

    try:
        if email_index is not None:
            email_to_flag = cache[email_index - 1]
            if email_to_flag is None:
                return f"Error: Email #{email_index} has already been deleted."
            email_uid = email_to_flag.uid
        elif email_uid is not None:
            email_index = next((idx for idx, email in enumerate(cache, 1) if email is not None and email.uid == email_uid), None)
            if email_index is None:
                return f"Error: Email with UID {email_uid} not found in cache."
        else:
            return "Error: Either email_index or email_uid must be provided."

        # Map flag_type to IMAP flag name
        flag_type_lower = flag_type.lower()
        if flag_type_lower in ['seen', 'read']:
            imap_flag = '\\Seen'
            action_desc = "marked as read" if value else "marked as unread"
        elif flag_type_lower in ['flagged', 'important', 'starred']:
            imap_flag = '\\Flagged'
            action_desc = "flagged as important" if value else "unflagged"
        elif flag_type_lower == 'answered':
            imap_flag = '\\Answered'
            action_desc = "marked as answered" if value else "unmarked as answered"
        elif flag_type_lower == 'draft':
            imap_flag = '\\Draft'
            action_desc = "marked as draft" if value else "unmarked as draft"
        else:
            return f"Error: Invalid flag_type '{flag_type}'. Valid options: 'seen/read', 'flagged/important/starred', 'answered', 'draft'."

        # Set the flag
        mailbox.flag.set([email_uid], imap_flag, value)
        return f"Email #{email_index} {action_desc}!"

    except Exception as e:
        return f"Failed to set flag for email #{email_index}: {str(e)}"


@tool
def list_folders():
    """List all available folders in the mailbox.

    Returns:
        str: A formatted list of all folders.
    """
    if not mailbox:
        return "Error: Mailbox not connected."

    try:
        folders = mailbox.folder.list()
        folder_list = []

        for folder in folders:
            folder_name = folder.name
            flags = folder.flags

            # Check if folder is selectable
            is_selectable = '\\Noselect' not in flags

            status = " (selectable)" if is_selectable else " (not selectable)"
            folder_list.append(f"- {folder_name}{status}")

            if flags:
                folder_list.append(f"  Flags: {', '.join(flags)}")

        return "Available folders:\n" + "\n".join(folder_list)

    except Exception as e:
        return f"Failed to list folders: {str(e)}"


@tool
def download_attachments(
    email_index: Optional[int] = None,
    email_uid: Optional[str] = None,
    save_path: str = "./attachments"
):
    """Download attachments from an email.

    Args:
        email_index (int, optional): The index number of the email. Defaults to None.
        email_uid (str, optional): The UID of the email. Defaults to None.
        save_path (str): Directory path to save attachments. Defaults to './attachments'.

    Returns:
        str: Success or error message with details of downloaded files.
    """
    if not mailbox:
        return "Error: Mailbox not connected."

    # Get cache for current session
    cache = get_current_emails_cache()

    if email_index is not None and (email_index < 1 or email_index > len(cache)):
        return f"Error: Invalid email index {email_index}. Valid range: 1-{len(cache)}."

    try:
        if email_index is not None:
            email_obj = cache[email_index - 1]
            if email_obj is None:
                return f"Error: Email #{email_index} has already been deleted."
            email_uid = email_obj.uid
        elif email_uid is not None:
            email_index = next((idx for idx, email in enumerate(cache, 1) if email is not None and email.uid == email_uid), None)
            if email_index is None:
                return f"Error: Email with UID {email_uid} not found in cache."
            email_obj = cache[email_index - 1]
        else:
            return "Error: Either email_index or email_uid must be provided."

        # Create save directory if it doesn't exist
        import os
        os.makedirs(save_path, exist_ok=True)

        # Get attachments from the email
        if not hasattr(email_obj, 'attachments') or len(email_obj.attachments) == 0:
            return f"Email #{email_index} has no attachments."

        downloaded_files = []
        for attachment in email_obj.attachments:
            if not attachment.content_disposition or attachment.content_disposition == 'inline':
                continue
            filename = attachment.filename
            filepath = os.path.join(save_path, filename)

            # Save attachment
            with open(filepath, 'wb') as f:
                f.write(attachment.payload)

            downloaded_files.append(f"  - {filename} (saved to {filepath})")

        return f"Successfully downloaded {len(downloaded_files)} attachment(s) from email #{email_index}:\n" + "\n".join(downloaded_files)

    except Exception as e:
        return f"Failed to download attachments from email #{email_index}: {str(e)}"

def get_current_time_str():
    """Get current time string in format 'YYYY-MM-DD HH:MM:SS'."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

address_book_data = {}
def load_address_book():
    global address_book_data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    address_book_path = os.path.join(script_dir, "address_book.json")
    with open(address_book_path, "r") as f:
        address_book_data = json.load(f)

load_address_book()

def _modify_address_book_impl(operation: str, id: Optional[str]=None, name: Optional[str]=None, emails: Optional[str]=None, groups: Optional[str]=None):
    """Internal implementation of address book modification (non-tool version).

    This function can be called directly from API endpoints. The @tool decorator
    is applied separately for AI Agent usage.

    Args:
        operation (str): The operation to perform. Options: add_people, delete_people, add_emails, delete_emails, add_groups, delete_groups, edit_name.
        id (str, optional): The ID of the entry to modify. Defaults to None.
        name (str, optional): The name of the person. Defaults to None.
        emails (List[str], optional): A list of email addresses. Defaults to None.
        groups (List[str], optional): A list of groups to add or delete the person from. Defaults to None.

    Examples:
        _modify_address_book_impl("add_people", name="Musk", emails=["musk@outlook.com"], groups=["Important"])
        _modify_address_book_impl("delete_people", id="12")
        _modify_address_book_impl("add_emails", id="12", emails=["musk@gmail.com"])
        _modify_address_book_impl("delete_emails", id="12", emails=["musk@outlook.com"])
        _modify_address_book_impl("add_groups", id="12", groups=["Family"])
        _modify_address_book_impl("delete_groups", id="12", groups=["Important"])
        _modify_address_book_impl("edit_name", id="12", name="Elon Musk")
    """
    if type(emails) == str:
        try:
            emails = json.loads(emails)
        except json.JSONDecodeError:
            emails = emails.split(',')
    if type(groups) == str:
        try:
            groups = json.loads(groups)
        except json.JSONDecodeError:
            groups = groups.split(',')

    result_message = ""
    if operation == "add_people":
        assert name, "Name is required for adding a person."
        if name in [v['name'] for v in address_book_data.values()]:
            return f"Error: Person with name {name} already exists."
        new_id = max(int(k) for k in address_book_data.keys()) + 1
        current_time = get_current_time_str()
        address_book_data[str(new_id)] = {
            "id": str(new_id),
            "name": name,
            "emails": emails,
            "groups": groups,
            "created_time": current_time,
            "update_time": current_time
        }
        result_message = f"Person {name} added successfully with ID {new_id}."
    elif operation == "delete_people":
        assert id, "ID is required for deleting a person."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        del address_book_data[id]
        result_message = f"Person with ID {id} deleted successfully."
    elif operation == "add_emails":
        assert id, "ID is required for adding emails."
        assert emails, "Emails are required for adding emails."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        for email in emails:
            if email not in address_book_data[id].get("emails", []):
                address_book_data[id].get("emails", []).append(email)
        address_book_data[id]["update_time"] = get_current_time_str()
        result_message = f"Emails {emails} added to person with ID {id}."
    elif operation == "delete_emails":
        assert id, "ID is required for deleting emails."
        assert emails, "Emails are required for deleting emails."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        for email in emails:
            if email in address_book_data[id].get("emails", []):
                address_book_data[id].get("emails", []).remove(email)
        address_book_data[id]["update_time"] = get_current_time_str()
        result_message = f"Emails {emails} deleted from person with ID {id}."
    elif operation == "add_groups":
        assert id, "ID is required for adding groups."
        assert groups, "Groups are required for adding groups."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        for group in groups:
            if group not in address_book_data[id].get("groups", []):
                address_book_data[id].get("groups", []).append(group)
        address_book_data[id]["update_time"] = get_current_time_str()
        result_message = f"Groups {groups} added to person with ID {id}."
    elif operation == "delete_groups":
        assert id, "ID is required for deleting groups."
        assert groups, "Groups are required for deleting groups."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        for group in groups:
            if group in address_book_data[id].get("groups", []):
                address_book_data[id].get("groups", []).remove(group)
        address_book_data[id]["update_time"] = get_current_time_str()
        result_message = f"Groups {groups} deleted from person with ID {id}."
    elif operation == "edit_name":
        assert id, "ID is required for editing name."
        assert name, "Name is required for editing name."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        address_book_data[id]["name"] = name
        address_book_data[id]["update_time"] = get_current_time_str()
        result_message = f"Name of person with ID {id} updated to {name}."
    else:
        return f"Error: Invalid operation {operation}. Valid operations are 'add_people', 'delete_people', 'add_emails', 'delete_emails', 'add_groups', 'delete_groups', 'edit_name'."

    # Save changes to file (this now executes for all operations)
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        address_book_path = os.path.join(script_dir, "address_book.json")
        with open(address_book_path, "w") as f:
            json.dump(address_book_data, f, indent=2, ensure_ascii=False)
        return result_message
    except Exception as e:
        return f"Error saving address book: {str(e)}"

# Apply @tool decorator to create the tool version for AI Agents
modify_address_book = tool(_modify_address_book_impl)

@tool
def search_address_book(
    name: Optional[str] = None,
    email: Optional[str] = None,
    group: Optional[str] = None,
):
    """Search the address book for people using one of the search criteria (name, email, or group). Return all people's information if no criteria is provided.
    
    Args:
        name (str, optional): The name of the person to search for. Defaults to None.
        email (str, optional): The email address of the person to search for. Defaults to None.
        group (str, optional): The group to search in. Defaults to None.
        
    Returns:
        str: A formatted string containing the person's name, email address, and groups.
    """
    if name is None and email is None and group is None:
        infos = address_book_data.values()
        assert len(infos) > 0, "Error: Address book is empty."
        return '\n'.join(json.dumps(info, ensure_ascii=False) for info in infos)

    if name is not None:
        infos = [v for v in address_book_data.values() if v['name'] == name]
        assert len(infos) > 0, f"Error: Person with name {name} not found."
        return '\n'.join(json.dumps(info, ensure_ascii=False) for info in infos)

    if email is not None:
        infos = [v for v in address_book_data.values() if email in v.get("emails", [])]
        assert len(infos) > 0, f"Error: Person with email {email} not found."
        return '\n'.join(json.dumps(info, ensure_ascii=False) for info in infos)

    if group is not None:
        infos = [v for v in address_book_data.values() if group in v.get("groups", [])]
        assert len(infos) > 0, f"Error: No people found in group {group}."
        return '\n'.join(json.dumps(info, ensure_ascii=False) for info in infos)


if __name__ == "__main__":
    result = read_emails(num_emails=10)
    print(result)

