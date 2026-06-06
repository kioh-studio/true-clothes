"""
Fetch 15 real clothing items, remove backgrounds with rembg, save PNGs.
Run: python scripts/fetch-items.py
Saves URL cache to docs/fetched-items.json to avoid duplicate fetches.
"""
import urllib.request, subprocess, json, os
from pathlib import Path

ASSETS     = Path("assets/items")
CACHE_FILE = Path("docs/fetched-items.json")
HEADERS    = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
UQ         = "https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods"

ITEMS = [
    # ── Jackets ──────────────────────────────────────────────────────────────
    {"id": "jacket-ma1-black",     "brand": "Uniqlo",   "name": "MA-1 Jacket",       "color": "Black", "type": "JACKET", "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E459618-000/00?colorDisplayCode=09",
     "img_url": f"{UQ}/459618/item/goods_09_459618_3x4.jpg"},
    {"id": "jacket-ma1-olive",     "brand": "Uniqlo",   "name": "MA-1 Jacket",       "color": "Olive", "type": "JACKET", "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E459618-000/00?colorDisplayCode=57",
     "img_url": f"{UQ}/459618/item/goods_57_459618_3x4.jpg"},
    {"id": "jacket-ma1-navy",      "brand": "Uniqlo",   "name": "MA-1 Jacket",       "color": "Navy",  "type": "JACKET", "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E459618-000/00?colorDisplayCode=69",
     "img_url": f"{UQ}/459618/item/goods_69_459618_3x4.jpg"},
    {"id": "jacket-utility-olive", "brand": "Uniqlo",   "name": "Utility Jacket",    "color": "Olive", "type": "JACKET", "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E458182-000/00?colorDisplayCode=56",
     "img_url": f"{UQ}/458182/item/goods_56_458182_3x4.jpg"},
    {"id": "jacket-utility-brown", "brand": "Uniqlo",   "name": "Utility Jacket",    "color": "Brown", "type": "JACKET", "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E458182-000/00?colorDisplayCode=34",
     "img_url": f"{UQ}/458182/item/goods_34_458182_3x4.jpg"},
    # ── Bottoms ───────────────────────────────────────────────────────────────
    {"id": "chino-beige",          "brand": "Uniqlo",   "name": "Slim Chino Pants",  "color": "Beige", "type": "CHINOS", "size": "32/29",
     "url":     "https://www.uniqlo.com/us/en/products/E450251-000/00?colorDisplayCode=32",
     "img_url": f"{UQ}/450251/item/goods_32_450251_3x4.jpg"},
    {"id": "chino-black",          "brand": "Uniqlo",   "name": "Slim Chino Pants",  "color": "Black", "type": "CHINOS", "size": "32/29",
     "url":     "https://www.uniqlo.com/us/en/products/E450251-000/00?colorDisplayCode=09",
     "img_url": f"{UQ}/450251/item/goods_09_450251_3x4.jpg"},
    {"id": "chino-olive",          "brand": "Uniqlo",   "name": "Slim Chino Pants",  "color": "Olive", "type": "CHINOS", "size": "32/29",
     "url":     "https://www.uniqlo.com/us/en/products/E450251-000/00?colorDisplayCode=57",
     "img_url": f"{UQ}/450251/item/goods_57_450251_3x4.jpg"},
    {"id": "chino-navy",           "brand": "Uniqlo",   "name": "Slim Chino Pants",  "color": "Navy",  "type": "CHINOS", "size": "32/29",
     "url":     "https://www.uniqlo.com/us/en/products/E450251-000/00?colorDisplayCode=69",
     "img_url": f"{UQ}/450251/item/goods_69_450251_3x4.jpg"},
    {"id": "jeans-levis-black",    "brand": "Levi's",   "name": "511 Slim Jeans",    "color": "Black", "type": "JEANS",  "size": "32/30",
     "url":     "https://www.levi.com/US/en_US/clothing/men/jeans/511-slim-fit-jeans/p/045111907",
     "img_url": "https://lsco.scene7.com/is/image/lsco/045111907-front-pdp?$large$"},
    # ── Tops ──────────────────────────────────────────────────────────────────
    {"id": "polo-white",           "brand": "Uniqlo",   "name": "DRY Pique Polo",    "color": "White", "type": "POLO",   "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E455388-000/00?colorDisplayCode=00",
     "img_url": f"{UQ}/455388/item/goods_00_455388_3x4.jpg"},
    {"id": "polo-black",           "brand": "Uniqlo",   "name": "DRY Pique Polo",    "color": "Black", "type": "POLO",   "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E455388-000/00?colorDisplayCode=09",
     "img_url": f"{UQ}/455388/item/goods_09_455388_3x4.jpg"},
    {"id": "tee-supima-black",     "brand": "Uniqlo",   "name": "SUPIMA Cotton Tee", "color": "Black", "type": "TEE",    "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E455365-001/00?colorDisplayCode=09",
     "img_url": f"{UQ}/455365/item/goods_09_455365_3x4.jpg"},
    {"id": "tee-supima-grey",      "brand": "Uniqlo",   "name": "SUPIMA Cotton Tee", "color": "Grey",  "type": "TEE",    "size": "M",
     "url":     "https://www.uniqlo.com/us/en/products/E455365-001/00?colorDisplayCode=07",
     "img_url": f"{UQ}/455365/item/goods_07_455365_3x4.jpg"},
    {"id": "henley-navy",          "brand": "Everlane", "name": "Waffle Henley",     "color": "Navy",  "type": "SHIRT",  "size": "M",
     "url":     "https://www.everlane.com/products/mens-waffle-ls-henley2-navy",
     "img_url": "https://www.everlane.com/cdn/shop/files/90d18368_d5fa.jpg?v=1753411710"},
]

# Load existing cache to skip already-processed items
existing = {}
if CACHE_FILE.exists():
    with open(CACHE_FILE) as f:
        existing = json.load(f)

print(f"Processing {len(ITEMS)} items...\n")

for item in ITEMS:
    aid        = item["id"]
    png_path   = ASSETS / f"{aid}.png"
    import tempfile
    tmp_path   = Path(tempfile.gettempdir()) / f"{aid}_src.jpg"

    # Skip if PNG already exists and cached
    if aid in existing and existing[aid].get("png_path") and png_path.exists():
        print(f"SKIP  {aid}  (already processed)")
        continue

    # Download
    try:
        req = urllib.request.Request(item["img_url"], headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        tmp_path.write_bytes(data)
        print(f"DL   OK  {aid}  ({len(data):,} bytes)")
    except Exception as e:
        print(f"DL   FAIL  {aid}: {e}")
        existing[aid] = {**item, "png_path": None, "error": str(e)}
        continue

    # Remove background
    try:
        subprocess.run(["rembg", "i", str(tmp_path), str(png_path)], check=True, capture_output=True)
        png_size = png_path.stat().st_size
        print(f"BG   OK  {aid}  => {png_size:,} bytes")
        existing[aid] = {**item, "png_path": f"assets/items/{aid}.png"}
    except Exception as e:
        print(f"BG   FAIL  {aid}: {e}")
        existing[aid] = {**item, "png_path": None, "bg_error": str(e)}

    print()

# Save cache
CACHE_FILE.parent.mkdir(exist_ok=True)
with open(CACHE_FILE, "w") as f:
    json.dump(existing, f, indent=2)

ok = sum(1 for v in existing.values() if v.get("png_path"))
print(f"\nDone: {ok}/{len(ITEMS)} PNGs created")
print(f"Cache saved -> {CACHE_FILE}")
