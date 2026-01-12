import os
import ssl
import re
import time
import requests
import asyncio
from typing import Optional, Dict
from datetime import datetime, timezone
from loguru import logger
from imap_tools import MailBox, AND, MailboxLoginError
from imaplib import IMAP4, IMAP4_SSL
from better_proxy import Proxy
from python_socks.sync import Proxy as SyncProxy

os.environ['SSLKEYLOGFILE'] = ''


def update_email_alias(base_email, new_email):
    # 请求 URL
    url = "https://exmail.qq.com/cgi-bin/bizmail_account?sid=lShnm8C9EZpAsDtT,7&lang=zh_CN&ajax=1&f=json&random=167556"

    # 请求头
    headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8,zh-TW;q=0.7',
        'cache-control': 'no-cache',
        #'Content-Type': 'application/x-www-form-urlencoded',  # 根据实际需求调整
        'Cookie': '0.20937785679847754; pgv_pvid=8187535144; fqm_pvqid=48a131fb-f327-4ee1-8684-4962238e6959; RK=Gffd/dV3Ok; ptcz=db451b5676b73ce8faeadd81e4b33b4d9dc8657e45f75c6f158d8d62b6ebccfd; logout_page=dm_loginpage; dm_login_weixin_rem=; CCSHOW=0000; qm_i18n_lan=en; qymng_username=2341166013; qqmail_alias=xuedizhan@livchain.asia; biz_username=2386440108; username=-1953801283&2341166013|2341166013&2341166013|-1908527188&2386440108; qm_sk=-1953801283&yKfZb-n5|-1908527188&yKfZb-n5; timezone_offset=-480; qm_authimgs_id=0; qm_verifyimagesession=h016879ea2949083ed2b535c0023fb624a1f7fc7e07ce20d2ce826937ac34faaddcd3146d3abd61eec3; wx_login_token=039daadc1499a39dd71e58e6057513641759149237; ssl_edition=sail.qq.com; tk=-1953801283&26e93052f013e72MTc1OTEyNzg4OQ|-1908527188&2312b105a1b6542MTc1OTE0OTI0MQ; pcache=00da3a15e6b8bcfNjA1NjcwODUzNw@2386440108@7; new=1; tinfo=EXPIRED; new_mail_num=-1908527188&0; qm_sid=ce0850071790e45e74a8dfcbabd2183d; qylevel=2; sid=-1953801283&552fbbadac826035e9d7f379721c5db0|2341166013&ce0850071790e45e74a8dfcbabd2183d|-1908527188&718c50068f67f6348b654cd2cc829628; bizticket=ChgIz/rpxgYSEM6JlLPavcHxeLBCQgiH3XQSgAEKf+nlmRikzqcFO78Hd1rW9wzXhxya0DqQylaqjoNdnWLeOa+4cZMw+fMmW57i2osKjlHMyyDvsXl0+uqIW9eqdtnBLZKNX03TGoKKrGg7QCOrEPoeEj1WFaDki1EBBI0rzS7S78/4HfBHL/ignwC3yQAWkxyQTwNz7FaTwjrC5hgA; qywwticket=ChgIz/rpxgYSEEXSnJU31UskGhPDY9av3x4SkAHkRoemA1UKkHcPviEAU7WyKlv0cUn1AXSnyW/LFCVurnt7YZWqSaj3Qaav1UuFkFyXcQ0W+jxrc5OTrlzQhQjiWYMvkv9M9Lan43fLwXRMuNQrNtKsOZoxZHp0+y0rOCHzGpsqBUZVD09pNEfq99lcKJwkbyHdvbYdOM0D8xDygEc6K+F2+agOlsbylgRyrBQYpp3E85WAgAM=; qm_username=2341166013; sms_id=8H/HqNC0Lwc1BpqLigCMz/YjaM/URw0IDEnSPfY84AfJlHxHO1wbglCbnRHl2h0IcIyWK4BIbz6S+FKEK4rJHg==; qm_ssum=-1953801283&f658534c0d724c0bc642b9295b395f11|-1908527188&8ec0ddc6469917ff21f305d7c247335c',
        'origin': 'https://exmail.qq.com',
        'pragma': 'no-cache',
        'referer': 'https://exmail.qq.com/qy_mng_logic/wework/frame?sid=lShnm8C9EZpAsDtT,7',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    }

    # 请求体数据
    data = {
        'vid': '3940652060389292',
        'alias': base_email,
        'sid': 'lShnm8C9EZpAsDtT,7',
        'action': 'add_alias',
        'resp_charset': 'UTF8',
        'ef': 'js',
        'slavealias': new_email,
        'slavedomain': 'livchain.asia'
    }

    for _ in range(3):
        # 发送 POST 请求
        response = requests.post(url, headers=headers, data=data)

        # 检查响应状态码
        if response.status_code == 200:
            logger.success("Email alias updated successfully!")
            return response
        else:
            logger.error(f"Failed to update email alias. Status code: {response.status_code}")
            time.sleep(1)
        
    raise Exception("Failed to update email alias after 3 attempts")


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
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS)
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


class EmailValidator:
    def __init__(self, imap_server: str, email: str, password: str):
        self.imap_server = imap_server
        self.email = email
        self.password = password

    async def validate(self, proxy: Optional[Proxy] = None):
        logger.info(f"Account: {self.email} | Checking if email is valid...")

        try:
            def login_sync():
                with MailBoxClient(
                        host=self.imap_server,
                        proxy=proxy,
                        timeout=30
                ).login(self.email, self.password):
                    return True

            await asyncio.to_thread(login_sync)
            return {
                "status": True,
                "identifier": self.email,
                "data": f"Valid:{datetime.now()}",
            }

        except MailboxLoginError:
            return {
                "status": False,
                "identifier": self.email,
                "data": "Invalid credentials",
            }

        except Exception as error:
            return {
                "status": False,
                "identifier": self.email,
                "data": f"validation failed: {str(error)}",
            }


class LinkCache:
    def __init__(self):
        self._used_links: Dict[str, str] = {}

    def is_link_used(self, link: str) -> bool:
        return link in self._used_links

    def add_link(self, email: str, link: str) -> None:
        self._used_links[link] = email


class LinkExtractor:
    _link_cache = LinkCache()

    def __init__(
            self,
            imap_server: str,
            email: str,
            password: str,
            max_attempts: int = 8,
            delay_seconds: int = 5,
            redirect_email: Optional[str] = None,
    ):
        self.imap_server = imap_server
        self.email = email
        self.password = password
        self.max_attempts = max_attempts
        self.delay_seconds = delay_seconds
        self.redirect_email = redirect_email
        self.link_patterns = [
            r"<div class=\"code-box\">\r\n              (.*?)\r\n            </div>",
        ]

    async def extract_link(self, proxy: Optional[Proxy] = None):
        logger.info(f"Account: {self.email} | Checking email for link...")
        return await self.search_with_retries(proxy)

    def _collect_messages(self, mailbox: MailBox):
        messages = []

        for msg in mailbox.fetch(reverse=True, criteria=AND(from_="authentication@notification.dynamicauth.com"), limit=10, mark_seen=True):
            if self.redirect_email and self.redirect_email != msg.to[0]:
                continue
            msg_date = msg.date.replace(tzinfo=timezone.utc) if msg.date.tzinfo is None else msg.date
            messages.append((msg, msg_date))

        return messages

    def _process_latest_message(self, messages):
        if not messages:
            return None

        try:
            if self.redirect_email:
                filtered_messages = [(msg, date) for msg, date in messages if self.redirect_email in msg.to]
                if not filtered_messages:
                    return None

                latest_msg, latest_date = max(filtered_messages, key=lambda x: x[1])
            else:
                latest_msg, latest_date = max(messages, key=lambda x: x[1])

        except (ValueError, AttributeError):
            return None

        msg_age = (datetime.now(timezone.utc) - latest_date).total_seconds()
        # if msg_age > 300:
        #     return None

        body = latest_msg.text or latest_msg.html
        if not body:
            return None

        for link_pattern in self.link_patterns:
            if match := re.search(link_pattern, body, re.DOTALL):
                code = str(match.group(1))

                return code

        return None

    async def _search_in_all_folders(self, proxy: Optional[Proxy]) -> Optional[str]:
        def search_in():
            all_messages = []
            with MailBoxClient(host=self.imap_server, proxy=proxy, timeout=30).login(self.email, self.password) as mailbox:
                for folder in mailbox.folder.list():
                    if folder.name.lower() == "gmail":
                        continue

                    try:
                        if folder.name == "其他文件夹/邮件转移" or folder.name == "INBOX":#mailbox.folder.exists(folder.name):
                            mailbox.folder.set(folder.name)
                            messages = self._collect_messages(mailbox)
                            all_messages.extend(messages)

                    except Exception as e:
                        # logger.warning(f"Account: {self.email} | Error in folder {folder.name}: {str(e)} | Skipping...")
                        pass

                return self._process_latest_message(all_messages) if all_messages else None

        return await asyncio.to_thread(search_in)

    async def search_with_retries(self, proxy: Optional[Proxy] = None):
        for attempt in range(self.max_attempts):
            link = await self._search_in_all_folders(proxy)
            if link:
                return {
                    "status": True,
                    "identifier": self.email,
                    "data": link,
                }

            if attempt < self.max_attempts - 1:
                logger.info(f"Account: {self.email} | Link not found | Retrying in {self.delay_seconds} seconds | Attempt: {attempt + 1}/{self.max_attempts}")
                await asyncio.sleep(self.delay_seconds)

        logger.error(f"Account: {self.email} | Max attempts reached, code not found in any folder")
        return {
            "status": False,
            "identifier": self.email,
            "data": "Max attempts reached",
        }

    def get_all_emails(self, proxy: Optional[Proxy] = None):
        all_messages = []
        with MailBoxClient(host=self.imap_server, proxy=proxy, timeout=30).login(self.email, self.password) as mailbox:
            for folder in mailbox.folder.list():
                if folder.name.lower() == "gmail":
                    continue

                try:
                    if folder.name == "其他文件夹/邮件转移" or folder.name == "INBOX":#mailbox.folder.exists(folder.name):
                        mailbox.folder.set(folder.name)
                        for msg in mailbox.fetch(reverse=True, limit=10000, mark_seen=True):
                            all_messages.append(msg)

                except Exception as e:
                    # logger.warning(f"Account: {self.email} | Error in folder {folder.name}: {str(e)} | Skipping...")
                    pass
        return all_messages


if __name__ == "__main__":
    # confirm_data = asyncio.run(LinkExtractor(
    #     imap_server="imap.exmail.qq.com",
    #     email="xuedizhan@livchain.asia",
    #     password="d9VUvhmFVJY3pKRR",
    #     redirect_email="xuedizhan@livchain.asia",
    # ).extract_link(None))
    checked_accounts = open("checked_accounts.txt", "r").readlines()
    checked_accounts = [line.strip().split(':')[0] for line in checked_accounts]
    found_accounts = open("registered_accounts.txt", "r").readlines()
    found_accounts = [line.strip().split(':')[0] for line in found_accounts]
    accounts = open("accounts.txt", "r").readlines()
    accounts = {acc.split(":")[0]:acc.split(":")[1] for acc in accounts}


    all_messages = LinkExtractor(
         imap_server="imap.exmail.qq.com",
         email="xuedizhan@livchain.asia",
         password="d9VUvhmFVJY3pKRR",
         redirect_email="xuedizhan@livchain.asia",
     ).get_all_emails()

    for msg in all_messages:
        if msg.subject == 'Welcome to Stable App Waitlist!':
            email = msg.to[0]
            if email not in checked_accounts and email not in found_accounts:
                print(f"Add {email}")
                password = accounts[email]
                with open("checked_accounts.txt", "a") as f:
                    f.write(f"{email}:{password}\n")
