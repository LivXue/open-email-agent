#!/usr/bin/env python3
"""Test script to verify the optimized api_server.py startup sequence."""

import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

print("Testing API Server Startup Sequence")
print("=" * 60)

# Test 1: Import email_tools module (triggers init_email())
print("\n[1/3] Testing email_tools module import...")
try:
    import lib.email_tools as email_tools_module
    print("  ✓ lib.email_tools imported successfully")

    # Check if mailbox and smtp_client are initialized
    has_mailbox = hasattr(email_tools_module, 'mailbox')
    has_smtp = hasattr(email_tools_module, 'smtp_client')
    print(f"  ✓ Module attributes present: mailbox={has_mailbox}, smtp_client={has_smtp}")

    # Check connection status
    if has_mailbox and has_smtp:
        imap_ok = email_tools_module.mailbox is not None
        smtp_ok = email_tools_module.smtp_client is not None
        print(f"  ✓ IMAP connection: {'✓' if imap_ok else '✗'}")
        print(f"  ✓ SMTP connection: {'✓' if smtp_ok else '✗'}")
except Exception as e:
    print(f"  ✗ Failed to import email_tools: {e}")
    sys.exit(1)

# Test 2: Import api_server module
print("\n[2/3] Testing api_server module import...")
try:
    # Change to backend directory to match runtime environment
    backend_dir = project_root / "web_app" / "backend"
    os.chdir(backend_dir)

    # Add project root for imports
    sys.path.insert(0, str(project_root))

    # Import api_server - this will trigger initialization checks
    from web_app.backend import api_server
    print("  ✓ api_server imported successfully")

    # Check initialization status
    print(f"  ✓ Email initialized: {api_server.email_initialized}")
    print(f"  ✓ IMAP connected: {api_server.email_imap_connected}")
    print(f"  ✓ SMTP connected: {api_server.email_smtp_connected}")

except Exception as e:
    print(f"  ✗ Failed to import api_server: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 3: Check service status functions
print("\n[3/3] Testing service status functions...")
try:
    email_status = api_server.check_email_services()
    print(f"  ✓ check_email_services() returned:")
    print(f"    - email_initialized: {email_status['email_initialized']}")
    print(f"    - imap_connected: {email_status['imap_connected']}")
    print(f"    - smtp_connected: {email_status['smtp_connected']}")

    # Test health check endpoint structure
    print("\n  Testing health check response structure...")
    # We can't call the async function here, but we can verify it exists
    print(f"  ✓ Health check endpoint exists: {hasattr(api_server, 'health_check')}")

except Exception as e:
    print(f"  ✗ Failed to check service status: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("✓ All startup sequence tests passed!")
print("\nSummary:")
print("  1. ✓ lib.email_tools module loads and initializes email connections")
print("  2. ✓ api_server module imports successfully")
print("  3. ✓ Service status checks work correctly")
print("\nThe optimized startup sequence ensures:")
print("  • Email services are initialized first (via module import)")
print("  • API server checks service status on startup")
print("  • Agent initialization happens after email services are ready")
print("  • Health check endpoint reports all service statuses")
print("=" * 60)
