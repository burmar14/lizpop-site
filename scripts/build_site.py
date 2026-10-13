"""Fill the shared header, footer and pop-ups into every page.

Each page marks where they go with comment pairs, for example:
    <!-- @header shop --> ... <!-- @/header -->     (the word after "header" is the current nav link)
    <!-- @footer --> ... <!-- @/footer -->
    <!-- @dialogs --> ... <!-- @/dialogs -->
The text between the markers is replaced with partials/header.html, footer.html and dialogs.html,
so a nav change is made once and applied everywhere.

Run after editing anything in partials/:  python3 scripts/build_site.py
"""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = ("r", "admin", "images", "partials", "scripts", "assets", "content", ".github")


def partial(name):
    return open(os.path.join(ROOT, "partials", name + ".html"), encoding="utf-8").read().rstrip("\n")


def mark_current(header, key):
    if not key:
        return header
    return header.replace(f'data-nav="{key}"', f'data-nav="{key}" aria-current="page"')


def build(path):
    text = open(path, encoding="utf-8").read()
    original = text

    def head(m):
        key = m.group(1)
        return f"<!-- @header {key} -->\n{mark_current(partial('header'), key)}\n<!-- @/header -->"

    text = re.sub(r"<!-- @header ?(\w*) -->.*?<!-- @/header -->", head, text, flags=re.S)
    for name in ("footer", "dialogs"):
        body = partial(name)
        text = re.sub(rf"<!-- @{name} -->.*?<!-- @/{name} -->", lambda m: f"<!-- @{name} -->\n{body}\n<!-- @/{name} -->", text, flags=re.S)
    if text != original:
        open(path, "w", encoding="utf-8").write(text)
        return True
    return False


def main():
    count = 0
    for path in glob.glob(os.path.join(ROOT, "**", "index.html"), recursive=True):
        rel = os.path.relpath(path, ROOT).split(os.sep)
        if rel[0] in SKIP:
            continue
        if build(path):
            count += 1
            print("updated", "/".join(rel))
    print(f"Updated {count} pages.")


if __name__ == "__main__":
    main()
