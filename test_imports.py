#!/usr/bin/env python3
"""Test script to verify all imports work correctly after reorganization."""

import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

print("Testing imports after reorganization...")
print("=" * 60)

# Test 1: Import from lib
try:
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
    )
    print("✓ lib.email_tools imports successful")
except Exception as e:
    print(f"✗ lib.email_tools import failed: {e}")
    sys.exit(1)

# Test 2: Import email_utils
try:
    from lib.email_utils import MailBoxClient, SMTPProxyClient
    print("✓ lib.email_utils imports successful")
except Exception as e:
    print(f"✗ lib.email_utils import failed: {e}")
    sys.exit(1)

# Test 3: Import utils
try:
    from lib.utils import pretty_print, pretty_print_stream, get_fs_system
    print("✓ lib.utils imports successful")
except Exception as e:
    print(f"✗ lib.utils import failed: {e}")
    sys.exit(1)

# Test 4: Import from lib package
try:
    import lib
    print(f"✓ lib package imported successfully")
    print(f"  Available exports: {len(lib.__all__)} items")
except Exception as e:
    print(f"✗ lib package import failed: {e}")
    sys.exit(1)

print("=" * 60)
print("All imports successful! ✓")
print("\nFile organization:")
print("  lib/")
print("    ├── __init__.py")
print("    ├── email_tools.py")
print("    ├── email_utils.py")
print("    ├── utils.py")
print("    └── address_book.json")
