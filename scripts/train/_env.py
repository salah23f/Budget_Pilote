"""
Shared env loader for all training scripts.
Import this at the top of every script:

    from _env import load_env, get_supabase_client

Loads .env.local from repo root. Asserts critical vars exist.
"""

import os
import sys
from pathlib import Path

def load_env():
    """Load .env.local and .env from repo root. Must be called before any os.getenv."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        print("ERROR: python-dotenv not installed. Run: pip install python-dotenv")
        sys.exit(1)

    repo_root = Path(__file__).resolve().parents[2]
    env_local = repo_root / '.env.local'
    env_file = repo_root / '.env'

    if env_local.exists():
        load_dotenv(env_local)
        print(f"[env] Loaded {env_local}")
    elif env_file.exists():
        load_dotenv(env_file)
        print(f"[env] Loaded {env_file}")
    else:
        print(f"[env] WARNING: No .env.local or .env found at {repo_root}")


def assert_supabase():
    """Assert Supabase credentials are present. Exits if missing."""
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not url:
        print("FATAL: NEXT_PUBLIC_SUPABASE_URL not set.")
        print("  Check .env.local exists and contains this variable.")
        sys.exit(1)

    if not key:
        print("FATAL: SUPABASE_SERVICE_ROLE_KEY not set.")
        print("  Check .env.local exists and contains this variable.")
        sys.exit(1)

    print(f"[env] Supabase URL: {url[:40]}...")
    print(f"[env] Service key: {key[:20]}...")
    return url, key


def get_supabase_client():
    """Create and return a Supabase client using env vars."""
    url, key = assert_supabase()
    from supabase import create_client
    return create_client(url, key)
