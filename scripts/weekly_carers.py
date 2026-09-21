#!/usr/bin/env python3
"""
One-command weekly run: export carers.hk, diff against the previous export, write the report.

  python3 scripts/weekly_carers.py                 # full run (subcategories + unit pages)
  python3 scripts/weekly_carers.py --no-details    # fast run
  python3 scripts/weekly_carers.py --root data/carers   # where exports/ and reports/ live

Layout it maintains:
  <root>/exports/carers_YYYY-MM-DD.csv     one per run (plus the shared unit-page cache)
  <root>/exports/latest.csv                copy of the newest export (feed this to the app / database)
  <root>/reports/changes_YYYY-MM-DD.xlsx   what changed since the previous export

Schedule it weekly (cron, Task Scheduler, or an agent job). Exit code 0 = ok.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default="data/carers")
    ap.add_argument("--no-details", action="store_true")
    ap.add_argument("--no-subcategories", action="store_true")
    ap.add_argument("--delay", default="1.0")
    ap.add_argument("--base", help="override carers.hk base URL (testing)")
    args = ap.parse_args()

    root = Path(args.root)
    exports, reports = root / "exports", root / "reports"
    exports.mkdir(parents=True, exist_ok=True)
    reports.mkdir(parents=True, exist_ok=True)

    today = date.today().isoformat()
    out = exports / f"carers_{today}.csv"
    previous = sorted(p for p in exports.glob("carers_*.csv") if p != out)
    prev = previous[-1] if previous else None

    cmd = [sys.executable, str(HERE / "scrape_carers.py"), "-o", str(out), "--delay", args.delay]
    if args.no_details:
        cmd.append("--no-details")
    if args.no_subcategories:
        cmd.append("--no-subcategories")
    if args.base:
        cmd += ["--base", args.base]
    # share one unit-page cache across weeks so only new/uncached units are fetched
    cache_link = exports / "unit_pages.cache.json"
    per_run_cache = Path(str(out) + ".cache.json")
    if cache_link.exists() and not per_run_cache.exists():
        shutil.copy(cache_link, per_run_cache)

    print(f"== export -> {out}", file=sys.stderr)
    rc = subprocess.call(cmd)
    if rc != 0 or not out.exists():
        print("export failed", file=sys.stderr)
        return rc or 1
    if per_run_cache.exists():
        shutil.copy(per_run_cache, cache_link)
        per_run_cache.unlink()

    shutil.copy(out, exports / "latest.csv")

    if prev is None:
        print("first run: no previous export to compare against", file=sys.stderr)
        return 0

    report = reports / f"changes_{today}"
    print(f"== diff {prev.name} -> {out.name}", file=sys.stderr)
    return subprocess.call([sys.executable, str(HERE / "diff_carers.py"), str(prev), str(out), "-o", str(report)])


if __name__ == "__main__":
    sys.exit(main())
