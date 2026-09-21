#!/usr/bin/env python3
"""
Export the carers.hk service directory to CSV.

Walks every audience/category (and optionally subcategory) the site exposes via
POST /zh_hk/ajax/map, pages through results, de-duplicates units by their detail URL
and writes one row per unit with all categories it appears under.

Usage:
  python3 scripts/scrape_carers.py                       # full export -> carers_hk_services.csv
  python3 scripts/scrape_carers.py -o out.csv --delay 1.5
  python3 scripts/scrape_carers.py --no-subcategories    # skip the type5 subcategory queries
  python3 scripts/scrape_carers.py --no-details          # skip fetching each /unit/<id> page (much faster)
  python3 scripts/scrape_carers.py --long -o rows.csv    # one row per (unit, category) instead of one per unit

Unit pages already fetched are cached in .carers_cache.json next to the output, so an
interrupted run (Ctrl+C) still writes the CSV and the next run resumes where it stopped.

Standard library only. Be polite: default 1 s between requests. Personal use;
see https://www.carers.hk/copyright-statement and keep the source attribution.
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = "https://www.carers.hk"
PAGE_SIZE = 20
UA = "MindTouch-carers-export/1.0 (personal use; +https://mt.ohcasi.com/carer/)"

AUDIENCES = {30: "長者", 31: "照顧者"}

CATEGORIES = {
    # audience 30 長者
    (30, 82): "長者中心／社區計劃",
    (30, 83): "社區照顧服務",
    (30, 84): "日間暫託／住宿暫託服務",
    (30, 85): "院舍服務",
    (30, 86): "認知障礙症服務",
    (30, 87): "復康治療及復康器具",
    (30, 88): "平安鐘服務",
    (30, 89): "晚期照顧／善終服務",
    (30, 90): "其他社會資源",
    (30, 856): "醫療服務資訊",
    (30, 984): "社區支援單位",
    (30, 1262): "經濟援助",
    # audience 31 照顧者
    (31, 91): "照顧者教育及學習",
    (31, 92): "照顧者互助資源",
    (31, 93): "熱線服務",
    (31, 94): "支援照顧者服務",
    (31, 95): "特定基金／信託服務／經濟援助",
    (31, 858): "醫療服務資訊",
    (31, 981): "社區支援單位",
    (31, 1004): "殯葬資訊",
    (31, 1185): "緊急救助服務",
}

SUBCATEGORIES = {
    (30, 83, 106): "資助家居照顧服務",
    (30, 83, 107): "自費上門照顧服務",
    (30, 83, 108): "資助日間照顧中心",
    (30, 83, 109): "自負盈虧長者日間護理中心",
    (30, 83, 110): "長者社區照顧服務券",
    (30, 83, 111): "護送／陪診服務",
    (30, 83, 112): "離院支援服務",
    (30, 84, 113): "資助長者日間暫託",
    (30, 84, 114): "資助長者住宿暫託",
    (30, 84, 1213): "自費暫託服務",
    (30, 87, 122): "自費物理治療",
    (30, 87, 123): "自費職業治療",
    (30, 87, 124): "自費言語治療",
    (30, 87, 125): "自費營養師／營養諮詢",
    (30, 87, 132): "租用／借用復康器具",
    (30, 87, 1421): "樓梯機借用／租用",
    (30, 87, 1422): "購買器具",
    (30, 87, 1423): "輪椅維修",
    (30, 89, 126): "晚期照顧支援",
    (30, 89, 127): "晚期院舍療養",
    (30, 89, 128): "在家離世",
    (30, 89, 129): "哀傷輔導／殯葬服務",
    (30, 89, 135): "殯葬經濟支援",
    (30, 89, 1426): "遺囑／預設醫療指示",
    (31, 94, 96): "護老者支援",
    (31, 94, 914): "綜合家庭服務中心",
    (31, 94, 916): "醫務社工服務",
    (31, 94, 1019): "地區康健中心／站",
    (31, 94, 1247): "賽馬會照顧者中心",
}

DISTRICTS = {
    474: "中西區", 473: "灣仔區", 527: "東區", 476: "南區", 479: "油尖旺區", 477: "深水埗區",
    478: "九龍城區", 480: "黃大仙區", 482: "觀塘區", 528: "葵青區", 529: "荃灣區", 530: "屯門區",
    531: "元朗區", 532: "北區", 533: "大埔區", 534: "沙田區", 481: "西貢區", 475: "離島區", 483: "全港",
}

EMPTY_VALUES = {"n/a", "na", "-", "--", "/", "無", "不適用", "nil", "null", ""}


def clean(v, max_len=1000) -> str:
    if v is None:
        return ""
    s = html.unescape(re.sub(r"<[^>]*>", " ", str(v)))
    s = re.sub(r"\s+", " ", s).strip()[:max_len]
    return "" if s.lower() in EMPTY_VALUES else s


def absolute(v, base: str) -> str:
    s = clean(v, 500)
    if not s:
        return ""
    return urllib.parse.urljoin(base + "/", s)


class Client:
    def __init__(self, base: str, delay: float, retries: int = 3, timeout: int = 20):
        self.base = base.rstrip("/")
        self.delay = delay
        self.retries = retries
        self.timeout = timeout
        self._last = 0.0
        self.requests = 0

    def _wait(self):
        gap = self.delay - (time.monotonic() - self._last)
        if gap > 0:
            time.sleep(gap)
        self._last = time.monotonic()

    def _request(self, url: str, data: bytes | None = None) -> str:
        last_err: Exception | None = None
        for attempt in range(1, self.retries + 1):
            self._wait()
            req = urllib.request.Request(url, data=data, method="POST" if data is not None else "GET")
            req.add_header("User-Agent", UA)
            req.add_header("Accept", "application/json, text/plain, */*")
            if data is not None:
                req.add_header("Content-Type", "application/x-www-form-urlencoded")
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    self.requests += 1
                    return resp.read().decode("utf-8", errors="replace")
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                last_err = e
                sleep = 2 ** attempt
                print(f"  ! {url} failed ({e}); retry {attempt}/{self.retries} in {sleep}s", file=sys.stderr)
                time.sleep(sleep)
        raise RuntimeError(f"gave up on {url}: {last_err}")

    def map_page(self, audience: int, type_id: int, subtype: int | None, page: int) -> dict:
        params = [("aduience[]", str(audience)), ("type[]", str(type_id)), ("page", str(page))]
        if subtype:
            params.insert(2, ("type5[]", str(subtype)))
        body = urllib.parse.urlencode(params).encode()
        text = self._request(f"{self.base}/zh_hk/ajax/map", body)
        try:
            parsed = json.loads(text)  # Content-Type may say text/html; body is JSON
        except json.JSONDecodeError as e:
            raise RuntimeError(f"non-JSON response for a={audience} t={type_id} s={subtype} p={page}: {text[:120]!r}") from e
        if not isinstance(parsed.get("locations"), list):
            raise RuntimeError(f"unexpected response shape: {list(parsed)[:5]}")
        return parsed

    def all_pages(self, audience: int, type_id: int, subtype: int | None, max_pages: int):
        first = self.map_page(audience, type_id, subtype, 1)
        yield from first["locations"]
        total = int(first.get("total") or 0)
        pages = min(max_pages, -(-total // PAGE_SIZE)) if total else 1
        for p in range(2, pages + 1):
            locs = self.map_page(audience, type_id, subtype, p)["locations"]
            if not locs:
                break
            yield from locs

    def unit_text(self, url: str) -> str:
        page = self._request(url)
        page = re.sub(r"<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", page, flags=re.S | re.I)
        main = re.search(r"<main[^>]*>(.*?)</main>", page, flags=re.S | re.I)
        body = main.group(1) if main else page
        return clean(body, 6000)


def unit_id(detail_url: str) -> str:
    m = re.search(r"/unit/(\d+)", detail_url)
    return m.group(1) if m else detail_url


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--output", default="carers_hk_services.csv")
    ap.add_argument("--base", default=BASE, help="override base URL (for testing)")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests (default 1.0)")
    ap.add_argument("--max-pages", type=int, default=50, help="safety cap per category (default 50 = 1000 units)")
    ap.add_argument("--no-subcategories", dest="subcategories", action="store_false", help="skip type5 subcategory queries")
    ap.add_argument("--no-details", dest="details", action="store_false", help="skip fetching each unit page")
    ap.add_argument("--long", action="store_true", help="one row per (unit, category) instead of one per unit")
    ap.add_argument("--only-audience", type=int, choices=sorted(AUDIENCES), help="limit to 30 or 31")
    args = ap.parse_args()

    client = Client(args.base, args.delay)
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    queries: list[tuple[int, int, int | None, str]] = [
        (a, t, None, label) for (a, t), label in CATEGORIES.items() if not args.only_audience or a == args.only_audience
    ]
    if args.subcategories:
        queries += [
            (a, t, s, f"{CATEGORIES.get((a, t), t)} › {label}")
            for (a, t, s), label in SUBCATEGORIES.items()
            if not args.only_audience or a == args.only_audience
        ]

    units: dict[str, dict] = {}
    memberships: dict[str, list[str]] = {}      # main categories
    sub_memberships: dict[str, list[str]] = {}  # subcategories

    cache_path = args.output + ".cache.json"
    try:
        with open(cache_path, encoding="utf-8") as f:
            detail_cache: dict[str, str] = json.load(f)
        print(f"Resuming: {len(detail_cache)} unit pages already cached in {cache_path}", file=sys.stderr)
    except (OSError, json.JSONDecodeError):
        detail_cache = {}

    def save_cache():
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(detail_cache, f, ensure_ascii=False)

    for i, (a, t, s, label) in enumerate(queries, 1):
        tag = f"{AUDIENCES[a]} / {label}"
        print(f"[{i}/{len(queries)}] {tag}", file=sys.stderr)
        try:
            count = 0
            for loc in client.all_pages(a, t, s, args.max_pages):
                detail = absolute(loc.get("detailUrl"), client.base)
                if not detail:
                    continue
                uid = unit_id(detail)
                count += 1
                if uid not in units:
                    area_id = clean(loc.get("area"), 20)
                    units[uid] = {
                        "unit_id": uid,
                        "name": clean(loc.get("name"), 300),
                        "address": clean(loc.get("address")),
                        "tel": clean(loc.get("tel"), 100),
                        "website": absolute(loc.get("url"), client.base),
                        "area_id": area_id,
                        "district": clean(loc.get("areaText"), 30) or DISTRICTS.get(int(area_id) if area_id.isdigit() else -1, ""),
                        "lat": loc.get("lat", ""),
                        "lng": loc.get("lng", ""),
                        "tags": "; ".join(clean(x, 50) for x in loc.get("tag", []) if clean(x, 50)) if isinstance(loc.get("tag"), list) else "",
                        "opening_time": clean(loc.get("time")),
                        "audience_ids": clean(loc.get("audience"), 50),
                        "type_ids": clean(loc.get("type"), 100),
                        "detail_url": detail,
                    }
                    memberships[uid] = []
                    sub_memberships[uid] = []
                bucket = sub_memberships if s else memberships
                if tag not in bucket[uid]:
                    bucket[uid].append(tag)
            print(f"    {count} records ({len(units)} unique so far)", file=sys.stderr)
        except Exception as e:  # keep going; report at the end
            print(f"    ! skipped: {e}", file=sys.stderr)

    if args.details:
        todo = [uid for uid in units if uid not in detail_cache]
        print(f"Fetching {len(todo)} unit pages ({len(units) - len(todo)} cached)…", file=sys.stderr)
        try:
            for n, uid in enumerate(todo, 1):
                try:
                    detail_cache[uid] = client.unit_text(units[uid]["detail_url"])
                except Exception as e:
                    print(f"  ! unit {uid}: {e}", file=sys.stderr)
                if n % 25 == 0:
                    save_cache()
                    print(f"  {n}/{len(todo)}", file=sys.stderr)
        except KeyboardInterrupt:
            print("\nInterrupted: saving what we have. Run again to resume.", file=sys.stderr)
        finally:
            save_cache()
        for uid, u in units.items():
            u["detail_text"] = detail_cache.get(uid, "")

    base_cols = [
        "unit_id", "name", "address", "district", "tel", "website", "tags", "opening_time",
        "area_id", "audience_ids", "type_ids", "lat", "lng", "detail_url",
    ]
    if args.details:
        base_cols.append("detail_text")

    with open(args.output, "w", encoding="utf-8-sig", newline="") as f:
        if args.long:
            cols = base_cols + ["category", "level", "source", "fetched_at"]
            w = csv.DictWriter(f, fieldnames=cols, quoting=csv.QUOTE_ALL)
            w.writeheader()
            for uid, u in units.items():
                rows = [(c, "category") for c in memberships[uid]] + [(c, "subcategory") for c in sub_memberships[uid]]
                for cat, level in rows:
                    w.writerow({**{k: u.get(k, "") for k in base_cols}, "category": cat, "level": level,
                                "source": "照顧者資訊網 carers.hk", "fetched_at": fetched_at})
        else:
            cols = base_cols + ["categories", "category_count", "subcategories", "subcategory_count", "source", "fetched_at"]
            w = csv.DictWriter(f, fieldnames=cols, quoting=csv.QUOTE_ALL)
            w.writeheader()
            for uid, u in units.items():
                w.writerow({
                    **{k: u.get(k, "") for k in base_cols},
                    "categories": " | ".join(memberships[uid]),
                    "category_count": len(memberships[uid]),
                    "subcategories": " | ".join(sub_memberships[uid]),
                    "subcategory_count": len(sub_memberships[uid]),
                    "source": "照顧者資訊網 carers.hk",
                    "fetched_at": fetched_at,
                })

    print(f"Done: {len(units)} unique units, {client.requests} requests -> {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
