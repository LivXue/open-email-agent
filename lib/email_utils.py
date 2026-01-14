import ssl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, List

from better_proxy import Proxy
from imap_tools import MailBox
from imaplib import IMAP4, IMAP4_SSL
from python_socks.sync import Proxy as SyncProxy


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
        try:
            return self._pysocks_proxy.connect(self._host, self._port, timeout)
        except Exception as e:
            raise ConnectionError(str(e))

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
        print(f"Connecting to IMAP server {self._host}:{self._port} with proxy={self._proxy}...")
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        if self._proxy:
            try:
                client = IMAP4SSlProxy(
                    self._host,
                    self._proxy,
                    port=self._port,
                    rdns=self._rdns,
                    timeout=self._timeout,
                    ssl_context=ssl_context,
                )
            except ConnectionError as e:
                print(f"\033[93mConnect to IMAP server with proxy failed: {e}\nTry to connect without proxy...\033[0m")
                client = IMAP4_SSL(
                    self._host,
                    port=self._port,
                    timeout=self._timeout,
                    ssl_context=ssl_context,
                )
        else:
            client = IMAP4_SSL(
                self._host,
                port=self._port,
                timeout=self._timeout,
                ssl_context=ssl_context,
            )
        print("\033[92mConnected to IMAP server successfully!\033[0m")
        return client

class SMTPProxyClient:
    def __init__(
            self,
            host: str,
            *,
            proxy: Optional[Proxy] = None,
            port: int = 587,
            timeout: float = None,
            rdns: bool = True,
            use_ssl: bool = False,
    ):
        self._host = host
        self._port = port
        self._proxy = proxy
        self._rdns = rdns
        self._timeout = timeout
        self._use_ssl = use_ssl
        self._server = None

    def connect(self):
        print(f"Connecting to SMTP server {self._host}:{self._port} with proxy={self._proxy} and use_ssl={self._use_ssl}...")
        if self._proxy:
            try:
                self._pysocks_proxy = SyncProxy.from_url(self._proxy.as_url, rdns=self._rdns)
                sock = self._pysocks_proxy.connect(self._host, self._port, self._timeout)
            except Exception as e:
                print(f"\033[93mConnect to SMTP server with proxy failed: {e}\nTry to connect without proxy...\033[0m")
                sock = None
            
            if self._use_ssl and sock is not None:
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE
                sock = ssl_context.wrap_socket(sock, server_hostname=self._host)
                self._server = smtplib.SMTP_SSL(timeout=self._timeout)
                self._server.sock = sock
            elif sock is not None:
                self._server = smtplib.SMTP(timeout=self._timeout)
                self._server.sock = sock
            elif self._use_ssl and sock is None:
                self._server = smtplib.SMTP_SSL(self._host, self._port, timeout=self._timeout)
            else:
                self._server = smtplib.SMTP(self._host, self._port, timeout=self._timeout)
        else:
            if self._use_ssl:
                self._server = smtplib.SMTP_SSL(self._host, self._port, timeout=self._timeout)
            else:
                self._server = smtplib.SMTP(self._host, self._port, timeout=self._timeout)
        
        if not self._use_ssl:
            self._server.ehlo()
            if self._server.has_extn('STARTTLS'):
                self._server.starttls()
                self._server.ehlo()
        
        print("\033[92mConnected to SMTP server successfully!\033[0m")
        return self

    def login(self, username: str, password: str):
        self._server.login(username, password)
        return self

    def send_email(
            self,
            from_addr: str,
            to_addrs: List[str],
            subject: str,
            body: str,
            html: bool = False,
            cc: Optional[List[str]] = None,
            bcc: Optional[List[str]] = None,
    ):
        msg = MIMEMultipart()
        msg['From'] = from_addr
        msg['To'] = ', '.join(to_addrs)
        msg['Subject'] = subject
        
        if cc:
            msg['Cc'] = ', '.join(cc)
        
        if html:
            msg.attach(MIMEText(body, 'html'))
        else:
            msg.attach(MIMEText(body, 'plain'))
        
        all_recipients = to_addrs.copy()
        if cc:
            all_recipients.extend(cc)
        if bcc:
            all_recipients.extend(bcc)
        
        self._server.send_message(msg, from_addr=from_addr, to_addrs=all_recipients)
        return msg

    def close(self):
        if self._server:
            try:
                self._server.quit()
            except:
                pass
            self._server = None

    def __enter__(self):
        return self.connect()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()