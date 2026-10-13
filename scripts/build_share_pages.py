"""Build one tiny preview page per reminder + doodle pairing, at /r/<quote-id>-<doodle#>/.

Texting apps (iMessage, WhatsApp, Instagram DMs) build link previews from a page's
og:title and og:image without running any site code. Giving each pairing its own page
lets the preview show the chosen reminder and doodle. The page then forwards visitors
to the home page, which opens the "someone sent you a reminder" card.

Run after changing quotes or shareable doodles:  python3 scripts/build_share_pages.py
(The deploy workflow also runs it automatically.)
"""
import html
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://lizpop.art"


def quote_id(text):
    # Must match hash() in assets/app.js (djb2 over UTF-16 code units, base 36).
    x = 5381
    data = text.encode("utf-16-le")
    for i in range(0, len(data), 2):
        code = data[i] | (data[i + 1] << 8)
        x = ((x << 5) + x + code) & 0xFFFFFFFF
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while True:
        x, r = divmod(x, 36)
        out = digits[r] + out
        if x == 0:
            return out


def main():
    site = json.load(open(os.path.join(ROOT, "content", "site.json"), encoding="utf-8"))
    quotes = json.load(open(os.path.join(ROOT, "content", "quotes.json"), encoding="utf-8"))
    art = [a for a in (site.get("share") or {}).get("art", []) if a.get("image")]
    texts = [q["text"] for q in quotes.get("items", []) if q.get("text") and q.get("show", True)]

    out_dir = os.path.join(ROOT, "r")
    shutil.rmtree(out_dir, ignore_errors=True)
    count = 0
    for text in texts:
        qid = quote_id(text)
        for ai, a in enumerate(art):
            slug = f"{qid}-{ai}"
            pic = a.get("preview") or a["image"]
            img = pic if pic.startswith("http") else SITE + pic
            t = html.escape(text, quote=True)
            page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{t}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Liz Pop Art">
<meta property="og:title" content="{t}">
<meta property="og:description" content="A little reminder for you, drawn by Liz Pop Art.">
<meta property="og:image" content="{html.escape(img, quote=True)}">
<meta property="og:url" content="{SITE}/r/{slug}/">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/images/favicon.png">
<script>location.replace('/?r={qid}&a={ai}' + (location.search ? '&' + location.search.slice(1) : '') );</script>
</head><body><p><a href="/?r={qid}&amp;a={ai}">{t}</a></p></body></html>
"""
            os.makedirs(os.path.join(out_dir, slug), exist_ok=True)
            with open(os.path.join(out_dir, slug, "index.html"), "w", encoding="utf-8") as f:
                f.write(page)
            count += 1
    print(f"Built {count} share preview pages ({len(texts)} reminders x {len(art)} doodles).")


if __name__ == "__main__":
    main()
