"""DEPRECATED — use run_all_v3.py."""
raise RuntimeError(
    "run_all.py is obsolete (Modal local_entrypoint collision). "
    "Use run_all_v3.py instead:\n"
    "    python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py"
)
