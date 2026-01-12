import os
import json
import ssl
from datetime import datetime, timedelta
from typing import Optional, Dict
from dotenv import load_dotenv
load_dotenv()

from better_proxy import Proxy
from imap_tools import MailBox, AND, MailboxLoginError
from imaplib import IMAP4, IMAP4_SSL
from python_socks.sync import Proxy as SyncProxy
from langchain_core.tools import tool

imap_server = os.getenv("IMAP_SERVER")
imap_port = int(os.getenv("IMAP_PORT"))
email = os.getenv("IMAP_USERNAME")
password = os.getenv("IMAP_PASSWORD")


class IMAP4Proxy(IMAP4):
    def __init__(
            self,
            host: str,
            proxy: Proxy,
            *,
            port: int = 993,
            rdns: bool = True,
            timeout: float = None,
    ):
        self._host = host
        self._port = port
        self._proxy = proxy
        self._pysocks_proxy = SyncProxy.from_url(self._proxy.as_url, rdns=rdns)
        super().__init__(host, port, timeout)

    def _create_socket(self, timeout):
        return self._pysocks_proxy.connect(self._host, self._port, timeout)

class IMAP4SSlProxy(IMAP4Proxy):
    def __init__(
            self,
            host: str,
            proxy: Proxy,
            *,
            port: int = 993,
            rdns: bool = True,
            ssl_context=None,
            timeout: float = None,
    ):
        self.ssl_context = ssl_context or ssl._create_unverified_context()
        super().__init__(host, proxy, port=port, rdns=rdns, timeout=timeout)

    def _create_socket(self, timeout):
        sock = super()._create_socket(timeout)
        server_hostname = self.host if ssl.HAS_SNI else None
        return self.ssl_context.wrap_socket(sock, server_hostname=server_hostname)

class MailBoxClient(MailBox):
    def __init__(
            self,
            host: str,
            *,
            proxy: Optional[Proxy] = None,
            port: int = 993,
            timeout: float = None,
            rdns: bool = True,
            ssl_context=None,
    ):
        self._proxy = proxy
        self._rdns = rdns
        super().__init__(host=host, port=port, timeout=timeout, ssl_context=ssl_context)

    def _get_mailbox_client(self):
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        if self._proxy:
            return IMAP4SSlProxy(
                self._host,
                self._proxy,
                port=self._port,
                rdns=self._rdns,
                timeout=self._timeout,
                ssl_context=ssl_context,
            )
        else:
            return IMAP4_SSL(
                self._host,
                port=self._port,
                timeout=self._timeout,
                ssl_context=ssl_context,
            )

if proxy := os.getenv("PROXY"):
    proxy = Proxy.from_str(proxy)
else:
    proxy = None
mailbox = MailBoxClient(host=imap_server, port=imap_port, timeout=30, proxy=proxy).login(email, password)

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
    end_date: Optional[str] = None
):
    """Read emails from a specified folder with flexible filtering options.
    
    Args:
        folder_name (str): The name of the folder to read emails from (e.g., 'INBOX', 'Sent', 'Drafts'). Defaults to the default folder.
        num_emails (int, optional): Maximum number of emails to retrieve. Defaults to unlimited.
        unread_only (bool, optional): If True, only retrieve unread emails. If False, retrieve all emails. Defaults to False.
        start_date (str, optional): Filter emails received on or after this date (format: 'YYYY-MM-DD'). Defaults to None.
        end_date (str, optional): Filter emails received on or before this date (format: 'YYYY-MM-DD'). Defaults to None.
    """
    print(f"Reading emails from folder: {folder_name}... / 正在从文件夹 {folder_name} 读取邮件...")
    
    all_folders = [f.name for f in mailbox.folder.list()]
    if folder_name is None:
        folder_name = all_folders[0]
    if folder_name not in all_folders and "[Gmail]/" + folder_name in all_folders:
        folder_name = "[Gmail]/" + folder_name
    
    mailbox.folder.set(folder_name)
    
    criteria = []
    
    if unread_only:
        criteria.append(seen=False)
    
    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            criteria.append(date_gte=start_date_obj)
        except ValueError:
            print(f"Invalid start_date format: {start_date}. Expected format: YYYY-MM-DD")
    
    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            criteria.append(date_lte=end_date_obj)
        except ValueError:
            print(f"Invalid end_date format: {end_date}. Expected format: YYYY-MM-DD")
    
    if criteria:
        emails = list(mailbox.fetch(AND(*criteria), limit=num_emails))
    else:
        emails = list(mailbox.fetch(limit=num_emails))
    
    email_info = []
    for idx, email in enumerate(emails, 1):
        subject = email['subject'] or '(No Subject)'
        sender = email['from'] or '(Unknown Sender)'
        date = email['date']
        body = email.text or email.html or '(No body content)'
        body_preview = body[:500] + '...' if len(body) > 500 else body
        is_unread = 'Seen' not in email.flags
        
        status = "[UNREAD]" if is_unread else "[READ]"
        
        email_info.append(f"Email #{idx} {status}")
        email_info.append(f"Subject: {subject}")
        email_info.append(f"From: {sender}")
        email_info.append(f"Date: {date}")
        email_info.append(f"Body Preview:\n{body_preview}")
        email_info.append("-" * 80 + "\n")
    
    if not email_info:
        return f"No emails found matching the criteria in folder '{folder_name}'."
    
    return "\n".join(email_info)


if __name__ == "__main__":
    dashboard = email_dashboard()
    import json
    print(json.dumps(dashboard, indent=2, ensure_ascii=False))

