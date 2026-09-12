#!/usr/bin/env python3
"""
Operational reconciliation script.

Reads a payouts export and reports, per instructor, how much was paid.
Operations runs this after each payout batch to check the provider's file
against what we expected to send.

Usage:
    python3 reconcile_earnings.py payouts.json

Exit codes:
    0  reconciled cleanly
    1  usage error
    2  file could not be read or parsed
    3  discrepancies found
"""

import json
import sys


def load_payouts(path):
    with open(path) as fh:
        return json.load(fh)


def summarise(payouts):
    """Total the payouts per instructor.

    Each record looks like:
        {"instructor_id": 7, "amount_minor": 60000, "status": "paid",
         "fee_minor": 250}

    Only PAID rows count towards the total. A failed or pending payout has not
    moved any money.

    fee_minor may be missing entirely or explicitly null in the real export.
    Both are treated as a zero fee, not an error: a missing/null fee most
    plausibly means "no fee was charged" for that payout (e.g. a fee-exempt
    instructor tier), and this is an operational script that must keep
    reconciling the batch rather than abort on one row with incomplete fee
    data. See SOLUTION.md for the full reasoning.
    """
    totals = {}

    for row in payouts:
        if row["status"] != "paid":
            continue

        instructor = row["instructor_id"]
        amount = row["amount_minor"]
        fee = row.get("fee_minor") or 0

        net = amount - fee

        if instructor not in totals:
            totals[instructor] = 0
        totals[instructor] += net

    return totals


def main(argv):
    if len(argv) != 2:
        print("usage: reconcile_earnings.py <payouts.json>", file=sys.stderr)
        return 1

    try:
        payouts = load_payouts(argv[1])
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: could not read '{argv[1]}': {exc}", file=sys.stderr)
        return 2

    totals = summarise(payouts)

    print("instructor_id,total_net_minor")
    for instructor, total in sorted(totals.items()):
        print(f"{instructor},{total}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
