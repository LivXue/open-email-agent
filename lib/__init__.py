"""Shared library utilities for the deepagents project."""

from lib.email_tools import (
    email_dashboard,
    read_emails,
    send_email,
    delete_email,
    move_email,
    flag_email,
    list_folders,
    search_address_book,
    download_attachments,
    modify_address_book,
)

from lib.email_utils import MailBoxClient, SMTPProxyClient
from lib.utils import pretty_print, pretty_print_stream, get_fs_system

__all__ = [
    # Email tools
    "email_dashboard",
    "read_emails",
    "send_email",
    "delete_email",
    "move_email",
    "flag_email",
    "list_folders",
    "search_address_book",
    "download_attachments",
    "modify_address_book",
    # Email utilities
    "MailBoxClient",
    "SMTPProxyClient",
    # Utils
    "pretty_print",
    "pretty_print_stream",
    "get_fs_system",
]
