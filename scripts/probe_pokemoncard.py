#!/usr/bin/env python3
import re
import requests
from bs4 import BeautifulSoup

url = "https://pokemoncard.co.kr/cards"
response = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "ko-KR,ko;q=0.9"})
print("STATUS", response.status_code)
print("FINAL", response.url)
print("LENGTH", len(response.text))
response.raise_for_status()
soup = BeautifulSoup(response.text, "html.parser")
print("SCRIPTS")
for script in soup.find_all("script", src=True):
    print(script.get("src"))
print("FORMS")
for form in soup.find_all("form"):
    print("FORM", form.get("method"), form.get("action"))
    for field in form.find_all(["input", "select", "button"]):
        print(" FIELD", field.name, field.get("name"), field.get("type"), field.get("value"), field.get("id"))
print("ENDPOINT_LIKE")
for match in sorted(set(re.findall(r"[\"']([^\"']*(?:api|cards|search)[^\"']*)[\"']", response.text, re.I))):
    if len(match) < 300:
        print(match)
