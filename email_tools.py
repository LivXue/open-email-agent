import os
import json
import ssl
import warnings
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from dotenv import load_dotenv
load_dotenv()

from better_proxy import Proxy
from imap_tools import AND, OR, MailboxLoginError
from langchain_core.tools import tool

from email_utils import MailBoxClient, SMTPProxyClient

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

# Cache to save recently fetched emails
emails_cache = []

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
    from_: Optional[str] = None
):
    """Read emails with flexible filtering options. Emails are cached after fetching.
    
    Args:
        folder_name (str): The name of the folder to read emails from (e.g., 'INBOX', 'Sent', 'Drafts'). Defaults to the default folder.
        num_emails (int, optional): Maximum number of emails to retrieve. Defaults to unlimited.
        unread_only (bool, optional): If True, only retrieve unread emails. If False, retrieve all emails. Defaults to False.
        start_date (str, optional): Filter emails received on or after this date (format: 'YYYY-MM-DD'). Defaults to None.
        end_date (str, optional): Filter emails received on or before this date (format: 'YYYY-MM-DD'). Defaults to None.
        from_ (List[str], optional): Filter emails by sender(s). Multiple senders can be provided. Defaults to None.
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
    
    global emails_cache
    emails_cache = []
    email_info = []
    for idx, email in enumerate(emails, 1):
        emails_cache.append(email)
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
def delete_email(email_index: Optional[int] = None, email_uid: Optional[int] = None):
    """Delete an email from the mailbox by its index in the cache or UID.
    
    Args:
        email_index (int, optional): The index number of the email to delete (as shown in read_emails output). Defaults to None.
        email_uid (int, optional): The UID of the email to delete. Defaults to None.
    
    Returns:
        str: Success or error message.
    """
    if not mailbox:
        return "Error: Mailbox not connected."
    
    if email_index is not None and (email_index < 1 or email_index > len(emails_cache)):
        return f"Error: Invalid email index {email_index}. Valid range: 1-{len(emails_cache)}."
    
    try:
        if email_index is not None:
            email_to_delete = emails_cache[email_index - 1]
            if email_to_delete is None:
                return f"Error: Email #{email_index} has already been deleted. "
            email_uid = email_to_delete.uid
        elif email_uid is not None:
            email_index = next((idx for idx, email in enumerate(emails_cache, 1) if email is not None and email.uid == email_uid), None)
            if email_index is None:
                return f"Error: Email with UID {email_uid} not found. The email may have already been deleted."
        else:
            return "Error: Either email_index or email_uid must be provided."
        
        mailbox.delete(email_uid)
        emails_cache[email_index - 1] = None
        
        return f"Email #{email_index} deleted successfully!"
    
    except Exception as e:
        return f"Failed to delete email #{email_index}: {str(e)}"


address_book_data = {}
def load_address_book():
    global address_book_data
    with open("address_book.json", "r") as f:
        address_book_data = json.load(f)

# Load the address book when the module is imported
load_address_book()

def modify_address_book(operation: str, id: Optional[str]=None, name: Optional[str]=None, emails: Optional[str]=None, groups: Optional[str]=None):
    """Modify the address book.
    
    Args:
        operation (str): The operation to perform. Options: add_people, delete_people, add_emails, delete_emails, add_groups, delete_groups, edit_name.
        id (str, optional): The ID of the entry to modify. Defaults to None.
        name (str, optional): The name of the person. Defaults to None.
        emails (List[str], optional): A list of email addresses. Defaults to None.
        groups (List[str], optional): A list of groups to add or delete the person from. Defaults to None.

    Examples:
        modify_address_book("add_people", name="Musk", emails=["musk@outlook.com"], groups=["Important"])
        modify_address_book("delete_people", id="12")
        modify_address_book("add_emails", id="12", emails=["musk@gmail.com"])
        modify_address_book("delete_emails", id="12", emails=["musk@outlook.com"])
        modify_address_book("add_groups", id="12", groups=["Family"])
        modify_address_book("delete_groups", id="12", groups=["Important"])
        modify_address_book("edit_name", id="12", name="Elon Musk")
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

    if operation == "add_people":
        assert name, "Name is required for adding a person."
        if name in [v['name'] for v in address_book_data.values()]:
            return f"Error: Person with name {name} already exists."
        new_id = max(int(k) for k in address_book_data.keys()) + 1
        address_book_data[str(new_id)] = {
            "id": str(new_id),
            "name": name,
            "emails": emails,
            "groups": groups
        }
    elif operation == "delete_people":
        assert id, "ID is required for deleting a person."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        del address_book_data[id]
        return f"Person with ID {id} deleted successfully."
    elif operation == "add_emails":
        assert id, "ID is required for adding emails."
        assert emails, "Emails are required for adding emails."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        for email in emails:
            if email not in address_book_data[id].get("emails", []):
                address_book_data[id].get("emails", []).append(email)
        return f"Emails {emails} added to person with ID {id}."
    elif operation == "delete_emails":
        assert id, "ID is required for deleting emails."
        assert emails, "Emails are required for deleting emails."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        for email in emails:
            if email in address_book_data[id].get("emails", []):
                address_book_data[id].get("emails", []).remove(email)
        return f"Emails {emails} deleted from person with ID {id}."
    elif operation == "add_groups":
        assert id, "ID is required for adding groups."
        assert groups, "Groups are required for adding groups."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        for group in groups:
            if group not in address_book_data[id].get("groups", []):
                address_book_data[id].get("groups", []).append(group)
        return f"Groups {groups} added to person with ID {id}."
    elif operation == "delete_groups":
        assert id, "ID is required for deleting groups."
        assert groups, "Groups are required for deleting groups."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        for group in groups:
            if group in address_book_data[id].get("groups", []):
                address_book_data[id].get("groups", []).remove(group)
        return f"Groups {groups} deleted from person with ID {id}."
    elif operation == "edit_name":
        assert id, "ID is required for editing name."
        assert name, "Name is required for editing name."
        assert id in address_book_data, f"Error: Person with ID {id} not found."
        address_book_data[id]["name"] = name
        return f"Name of person with ID {id} updated to {name}."
    else:
        return f"Error: Invalid operation {operation}. Valid operations are 'add_people', 'delete_people', 'add_emails', 'delete_emails', 'add_groups', 'delete_groups', 'edit_name'."

@tool
def search_address_book(
    name: Optional[str] = None,
    email: Optional[str] = None,
    group: Optional[str] = None,
):
    """Search the address book for people using one of the search criteria (name, email, or group).
    
    Args:
        name (str, optional): The name of the person to search for. Defaults to None.
        email (str, optional): The email address of the person to search for. Defaults to None.
        group (str, optional): The group to search in. Defaults to None.
        
    Returns:
        str: A formatted string containing the person's name and email address if found, or a message indicating no match.
    """
    if name is None and email is None and group is None:
        return "Please provide at least one search criterion (name, email, or group)."

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
    result = read_emails(from_=["team@mail.perplexity.ai"])
    print(result)
    result = delete_email(email_index=1)
    print(result)
