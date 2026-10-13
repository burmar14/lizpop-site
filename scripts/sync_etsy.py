"""Sync Liz's active Etsy listings into content/prints.json.

Runs from GitHub Actions on a schedule. Rules:
- New Etsy listings are added to the top of the print wall.
- Listings that are no longer active on Etsy are removed (only ones this script added or matched).
- Anything edited in the admin panel (title, description, order, Show on site) is left alone.
- Prints added by hand in the admin panel without an Etsy link are never touched.
- Photos are downloaded into images/etsy/ as WebP so the site doesn't depend on Etsy's image links.

Needs ETSY_API_KEY (the app keystring) and ETSY_SHARED_SECRET from the Etsy developer app.
"""
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

SHOP_ID = os.environ.get("ETSY_SHOP_ID", "26867705")
API = "https://openapi.etsy.com/v3/application"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRINTS = os.path.join(ROOT, "content", "prints.json")
IMG_DIR = os.path.join(ROOT, "images", "etsy")
IMG_PUBLIC = "/images/etsy"


def api_key_header():
    key = os.environ.get("ETSY_API_KEY", "").strip()
    secret = os.environ.get("ETSY_SHARED_SECRET", "").strip()
    if not key:
        return None
    return f"{key}:{secret}" if secret and ":" not in key else key


def get(path, params, key):
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"x-api-key": key, "User-Agent": "lizpop-site-sync"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                time.sleep(5)
                continue
            body = e.read().decode("utf-8", "replace")[:300]
            sys.exit(f"Etsy API error {e.code} on {path}: {body}")


def active_listings(key):
    out, offset = [], 0
    while True:
        page = get(f"/shops/{SHOP_ID}/listings/active",
                   {"limit": 100, "offset": offset, "sort_on": "created", "sort_order": "desc"}, key)
        results = page.get("results", [])
        out.extend(results)
        if len(results) < 100:
            return out
        offset += 100


def images_for(ids, key):
    found = {}
    for i in range(0, len(ids), 100):
        batch = get("/listings/batch", {"listing_ids": ",".join(map(str, ids[i:i + 100])), "includes": "Images"}, key)
        for listing in batch.get("results", []):
            imgs = sorted(listing.get("images") or [], key=lambda x: x.get("rank", 99))
            if imgs:
                found[listing["listing_id"]] = imgs[0].get("url_fullxfull") or imgs[0].get("url_570xN")
    return found


def save_webp(url, listing_id):
    from PIL import Image  # installed by the workflow
    os.makedirs(IMG_DIR, exist_ok=True)
    name = f"{listing_id}.webp"
    path = os.path.join(IMG_DIR, name)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "lizpop-site-sync"})
        with urllib.request.urlopen(req, timeout=60) as r:
            im = Image.open(io.BytesIO(r.read())).convert("RGB")
        im.thumbnail((1000, 1000))
        im.save(path, "WEBP", quality=82)
    return f"{IMG_PUBLIC}/{name}"


def clean_title(t):
    t = html.unescape(t or "").strip()
    return t.split(" | ")[0].strip().rstrip(".")


def listing_id_from(item):
    if item.get("etsy_id"):
        return int(item["etsy_id"])
    m = re.search(r"/listing/(\d+)", item.get("etsy_url") or "")
    return int(m.group(1)) if m else None


def main():
    key = api_key_header()
    if not key:
        print("ETSY_API_KEY not set; skipping Etsy sync.")
        return

    data = json.load(open(PRINTS, encoding="utf-8"))
    items = data.get("items", [])
    listings = active_listings(key)
    active = {l["listing_id"]: l for l in listings}
    print(f"Etsy: {len(active)} active listings.")

    known = set()
    kept = []
    for item in items:
        lid = listing_id_from(item)
        if lid is None:
            kept.append(item)  # added by hand, leave it
            continue
        if lid not in active:
            print(f"Removing (no longer active): {item.get('title')}")
            continue
        item["etsy_id"] = lid
        known.add(lid)
        kept.append(item)

    new_ids = [lid for lid in active if lid not in known]
    needs_image = [i["etsy_id"] for i in kept
                   if i.get("etsy_id") and not str(i.get("image", "")).startswith(IMG_PUBLIC)]
    photo_urls = images_for(new_ids + needs_image, key) if (new_ids or needs_image) else {}

    for item in kept:
        lid = item.get("etsy_id")
        if lid in needs_image and lid in photo_urls:
            item["image"] = save_webp(photo_urls[lid], lid)

    added = []
    for lid in new_ids:  # already newest first
        l = active[lid]
        title = clean_title(l.get("title"))
        added.append({
            "title": title,
            "image": save_webp(photo_urls[lid], lid) if lid in photo_urls else "",
            "alt": f"{title} print by Liz",
            "etsy_url": f"https://www.etsy.com/listing/{lid}",
            "etsy_id": lid,
            "show": True,
        })
        print(f"Adding: {title}")

    data["items"] = added + kept
    with open(PRINTS, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Done. {len(added)} added, {len(items) - len(kept)} removed.")


if __name__ == "__main__":
    main()
