#!/usr/bin/env python3
import json
import requests

for name in ("깨비참", "피카츄", "푸크린"):
    url = "https://api.tcgdex.net/v2/ko/cards"
    response = requests.get(url, params={"name": name}, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    print("NAME", name, "STATUS", response.status_code, "URL", response.url)
    print("TEXT_HEAD", response.text[:300])
    if response.ok:
        payload = response.json()
        print("COUNT", len(payload) if isinstance(payload, list) else type(payload).__name__)
        if isinstance(payload, list):
            print(json.dumps(payload[:3], ensure_ascii=False, indent=2))
