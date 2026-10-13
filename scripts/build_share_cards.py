"""Draw one link-preview card per reminder + doodle pairing, saved to images/share/cards/<quote-id>-<doodle#>.jpg.

The card is what shows up in a text message: Liz's doodle on the left, the reminder written
out on the right. build_share_pages.py points each /r/ page at its card.

Run after changing quotes or shareable doodles:  python3 scripts/build_share_cards.py
It needs Pillow and a rounded hand-lettered font (Comic Sans MS on a Mac, or fonts/ComicNeue-Bold.ttf).
Reminders that don't have a card yet just fall back to the plain doodle preview.
"""
import json
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_share_pages import ROOT, quote_id  # noqa: E402

W, H = 1200, 630
CREAM, PAPER, INK = (251, 246, 234), (255, 253, 247), (35, 29, 26)
PINK_DEEP, GREEN_DEEP, LINE = (198, 61, 134), (47, 106, 44), (214, 218, 238)

FONT_CANDIDATES = [
    os.path.join(ROOT, "fonts", "ComicNeue-Bold.ttf"),
    "/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf",
    "/Library/Fonts/Comic Sans MS Bold.ttf",
    "C:/Windows/Fonts/comicbd.ttf",
]


def find_font():
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    sys.exit("No hand-lettered font found. Add fonts/ComicNeue-Bold.ttf or run this on a Mac.")


def wrap(draw, text, font, width):
    lines, line = [], ""
    for word in text.split():
        trial = (line + " " + word).strip()
        if draw.textlength(trial, font=font) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def fit_quote(draw, text, font_path, width, height):
    """Largest size (up to 76px) where the wrapped quote fits the box."""
    for size in range(76, 30, -2):
        font = ImageFont.truetype(font_path, size)
        lines = wrap(draw, text, font, width)
        if len(lines) * size * 1.22 <= height:
            return font, lines, size
    return font, lines, size


def paper_background():
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    for y in range(40, H, 36):
        d.line([(0, y), (W, y)], fill=(238, 236, 240), width=1)
    return img


def doodle_frame(path):
    """The doodle on a white print with an ink border, tilted a little, with a hard shadow."""
    pic = Image.open(path).convert("RGB")
    box_h = 500
    pic = pic.resize((int(pic.width * box_h / pic.height), box_h), Image.LANCZOS)
    pad = 14
    frame = Image.new("RGB", (pic.width + pad * 2, pic.height + pad * 2), (255, 255, 255))
    frame.paste(pic, (pad, pad))
    d = ImageDraw.Draw(frame)
    d.rectangle([0, 0, frame.width - 1, frame.height - 1], outline=INK, width=4)
    card = Image.new("RGBA", (frame.width + 40, frame.height + 40), (0, 0, 0, 0))
    shadow = Image.new("RGBA", frame.size, INK + (255,))
    card.paste(shadow, (28, 28))
    card.paste(frame, (14, 14))
    return card.rotate(2, resample=Image.BICUBIC, expand=True)


def make_card(text, art_path, font_path, out_path):
    img = paper_background()
    frame = doodle_frame(art_path)
    img.paste(frame, (50, (H - frame.height) // 2), frame)

    d = ImageDraw.Draw(img)
    left, right = 50 + frame.width + 30, W - 60
    label_font = ImageFont.truetype(font_path, 30)
    d.text((left, 70), "a little reminder for you", font=label_font, fill=GREEN_DEEP)
    quote_font, lines, size = fit_quote(d, text, font_path, right - left, 360)
    block = len(lines) * size * 1.22
    y = 135 + (360 - block) / 2
    for line in lines:
        d.text((left, y), line, font=quote_font, fill=PINK_DEEP)
        y += size * 1.22
    d.text((left, H - 90), "lizpop.art", font=ImageFont.truetype(font_path, 34), fill=INK)
    img.save(out_path, "JPEG", quality=84, optimize=True, progressive=True)


def main():
    site = json.load(open(os.path.join(ROOT, "content", "site.json"), encoding="utf-8"))
    quotes = json.load(open(os.path.join(ROOT, "content", "quotes.json"), encoding="utf-8"))
    art = [a for a in (site.get("share") or {}).get("art", []) if a.get("image")]
    texts = [q["text"] for q in quotes.get("items", []) if q.get("text") and q.get("show", True)]
    font_path = find_font()

    out_dir = os.path.join(ROOT, "images", "share", "cards")
    shutil.rmtree(out_dir, ignore_errors=True)
    os.makedirs(out_dir)
    count = 0
    for text in texts:
        qid = quote_id(text)
        for ai, a in enumerate(art):
            src = os.path.join(ROOT, (a.get("preview") or a["image"]).lstrip("/"))
            if not os.path.exists(src):
                continue
            make_card(text, src, font_path, os.path.join(out_dir, f"{qid}-{ai}.jpg"))
            count += 1
    print(f"Drew {count} preview cards.")


if __name__ == "__main__":
    main()
