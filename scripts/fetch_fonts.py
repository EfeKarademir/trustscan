#!/usr/bin/env python3
"""Download Space Grotesk / Inter / JetBrains Mono (latin, woff2) from Google
Fonts and emit a local fonts.css so the extension works fully offline."""
import urllib.request, re, os

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "assets", "fonts")
os.makedirs(OUT, exist_ok=True)

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")

CSS_URL = ("https://fonts.googleapis.com/css2?"
           "family=Space+Grotesk:wght@400;500;600;700"
           "&family=Inter:wght@400;500;600"
           "&family=JetBrains+Mono:wght@400;500&display=swap")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30).read()

def main():
    css = get(CSS_URL).decode("utf-8")
    blocks = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S)
    faces = []
    seen = set()
    for subset, body in blocks:
        if subset != "latin":
            continue
        family = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        weight = re.search(r"font-weight:\s*(\d+)", body).group(1)
        style = re.search(r"font-style:\s*(\w+)", body).group(1)
        src = re.search(r"url\((https://[^)]+\.woff2)\)", body)
        if not src:
            continue
        key = (family, weight, style)
        if key in seen:
            continue
        seen.add(key)
        fname = "%s-%s.woff2" % (family.replace(" ", ""), weight)
        try:
            data = get(src.group(1))
            with open(os.path.join(OUT, fname), "wb") as f:
                f.write(data)
        except Exception as e:
            print("skip", key, e)
            continue
        faces.append((family, style, weight, fname))
        print("fetched", fname, len(data), "bytes")

    lines = []
    for family, style, weight, fname in faces:
        lines.append(
            "@font-face{font-family:'%s';font-style:%s;font-weight:%s;"
            "font-display:swap;src:url('fonts/%s') format('woff2');}"
            % (family, style, weight, fname))
    with open(os.path.join(HERE, "..", "assets", "fonts.css"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("fonts.css written with", len(faces), "faces")

if __name__ == "__main__":
    main()
