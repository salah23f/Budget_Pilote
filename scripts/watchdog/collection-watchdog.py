#!/usr/bin/env python3
"""
Collection watchdog — the alert that would have saved two months.

Why this exists
---------------
The price collection died in June 2026 and was only discovered on 21 August.
For those two months every surface reported success: GitHub Actions was green
every ~38 minutes, /api/agent/sweep returned HTTP 200, and the scraper reported
success every four hours. The upstream 429 was translated into "no offers
found" somewhere in the chain, so a dead pipeline looked exactly like a healthy
one with a quiet market.

Two design rules follow from that, and both matter more than the code below:

  1. The watchdog runs OUTSIDE the system it watches. It talks to Supabase
     directly, never through the app. A watchdog hosted on Vercel cannot report
     a Vercel outage, and one that asks the app "are you well?" only learns what
     the app believes about itself.

  2. It also speaks when everything is fine. An alert-only watchdog has the same
     failure mode as the thing it replaced: if the watchdog itself dies, its
     silence is indistinguishable from health. The weekly heartbeat makes
     absence meaningful — no mail for more than eight days means the watchdog
     is gone, and that is itself the alarm.

What it checks
--------------
Whether any row landed in the collection tables in the last 24 hours. Not
whether an endpoint answered, not whether a job exited zero — whether data
actually arrived. That is the only claim that cannot be faked by a layer
swallowing an error.

Environment
-----------
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   read access to the tables
  RESEND_API_KEY                            outbound mail
  ALERT_TO                                  recipient
  ALERT_FROM                                sender (default: Resend test domain)
  STALE_HOURS                               staleness threshold (default 24)
  HEARTBEAT_WEEKDAY                         0=Monday .. 6=Sunday, -1 disables

Exit codes: 0 = healthy or alert delivered, 1 = the watchdog itself failed.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
ALERT_TO = os.environ.get("ALERT_TO", "")
ALERT_FROM = os.environ.get("ALERT_FROM", "onboarding@resend.dev")
STALE_HOURS = int(os.environ.get("STALE_HOURS", "24"))
HEARTBEAT_WEEKDAY = int(os.environ.get("HEARTBEAT_WEEKDAY", "0"))

# (table, timestamp column). Both are written by the collection path; either one
# moving is proof the pipeline is alive.
WATCHED = [
    ("real_price_samples", "created_at"),
    ("price_history_samples", "checked_at"),
]


# Resend sits behind Cloudflare, which rejects urllib's default User-Agent with
# error 1010 — and does so with an HTML body, so the failure reads as a generic
# HTTP error rather than "your client was banned". Any client identity works;
# the default one does not.
USER_AGENT = "flyeas-watchdog/1.0"


def supabase_get(path: str, prefer: str | None = None) -> tuple[int, str, dict]:
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("User-Agent", USER_AGENT)
    if prefer:
        req.add_header("Prefer", prefer)
        req.add_header("Range", "0-0")
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.status, res.read().decode(), dict(res.headers)


def count_since(table: str, column: str, since: datetime) -> int:
    """Rows written to `table` since `since`. -1 if the table cannot be read."""
    stamp = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        _, _, headers = supabase_get(
            f"{table}?select=id&{column}=gte.{stamp}", prefer="count=exact"
        )
        # Content-Range looks like "0-0/12" or "*/0" when empty.
        rng = headers.get("Content-Range", "*/0")
        return int(rng.split("/")[-1])
    except Exception as exc:  # noqa: BLE001 - any failure means "cannot vouch"
        print(f"[watchdog] cannot read {table}: {exc}", file=sys.stderr)
        return -1


def latest_timestamp(table: str, column: str) -> str | None:
    try:
        _, body, _ = supabase_get(
            f"{table}?select={column}&order={column}.desc&limit=1"
        )
        rows = json.loads(body)
        return rows[0][column] if rows else None
    except Exception:  # noqa: BLE001
        return None


def send_mail(subject: str, lines: list[str]) -> bool:
    if not (RESEND_KEY and ALERT_TO):
        print("[watchdog] mail not configured, printing instead:", file=sys.stderr)
        print(subject, *lines, sep="\n", file=sys.stderr)
        return False
    payload = json.dumps(
        {
            "from": ALERT_FROM,
            "to": [ALERT_TO],
            "subject": subject,
            "text": "\n".join(lines),
        }
    ).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=payload)
    req.add_header("Authorization", f"Bearer {RESEND_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", USER_AGENT)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status == 200
    except urllib.error.HTTPError as exc:
        print(f"[watchdog] mail rejected: {exc.read().decode()[:200]}", file=sys.stderr)
        return False


def main() -> int:
    if not (SUPABASE_URL and SUPABASE_KEY):
        print("[watchdog] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=STALE_HOURS)

    results = []
    unreadable = 0
    fresh_total = 0
    for table, column in WATCHED:
        n = count_since(table, column, since)
        last = latest_timestamp(table, column)
        if n < 0:
            unreadable += 1
        else:
            fresh_total += n
        results.append((table, n, last))

    detail = [
        f"  {t:<24} {'illisible' if n < 0 else str(n) + ' nouvelle(s)':<18} "
        f"dernière: {last or 'aucune'}"
        for t, n, last in results
    ]

    # An alerting system that cannot deliver its alert must fail loudly, or it
    # inherits the exact flaw it exists to correct. Undelivered mail is treated
    # as a watchdog failure, never as a quiet success — which also means the
    # job's own Succeeded/Failed status becomes proof that the mail went out.
    # Without this, "Succeeded" would only mean "the script finished".

    # The watchdog cannot vouch for silence it could not verify.
    if unreadable == len(WATCHED):
        send_mail(
            "🔴 Flyeas — le chien de garde ne peut pas lire la base",
            [
                "Aucune des tables surveillées n'a pu être lue.",
                "La collecte est peut-être saine, mais plus rien ne le prouve.",
                "",
                *detail,
            ],
        )
        return 1

    if fresh_total == 0:
        delivered = send_mail(
            f"🔴 Flyeas — aucune donnée collectée depuis {STALE_HOURS} h",
            [
                f"Zéro ligne écrite dans les {STALE_HOURS} dernières heures.",
                "",
                *detail,
                "",
                "Cause la plus probable : le quota RapidAPI est épuisé.",
                "Vérifier d'abord x-ratelimit-requests-remaining, puis",
                "SKY_SCRAPPER_MONTHLY_QUOTA. Voir docs/REPRISE.md.",
            ],
        )
        print(f"[watchdog] stale — alert {'delivered' if delivered else 'NOT DELIVERED'}")
        return 0 if delivered else 1

    if HEARTBEAT_WEEKDAY >= 0 and now.weekday() == HEARTBEAT_WEEKDAY:
        delivered = send_mail(
            f"🟢 Flyeas — collecte vivante ({fresh_total} lignes / 24 h)",
            [
                "Résumé hebdomadaire. Aucune action requise.",
                "",
                *detail,
                "",
                "Si ce message cesse d'arriver plus de huit jours,",
                "c'est le chien de garde lui-même qui est mort.",
            ],
        )
        if not delivered:
            print("[watchdog] heartbeat NOT DELIVERED", file=sys.stderr)
            return 1

    print(f"[watchdog] ok — {fresh_total} rows in the last {STALE_HOURS}h")
    return 0


if __name__ == "__main__":
    sys.exit(main())
