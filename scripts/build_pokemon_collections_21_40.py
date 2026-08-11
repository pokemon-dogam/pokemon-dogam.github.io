#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit, parse_qsl, urlencode

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://collectory.cc"
OUTPUT = Path("data/pokemon-collections-21-40.json")
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

POKEMON = [
    (21, "깨비참", "Spearow"),
    (22, "깨비드릴조", "Fearow"),
    (23, "아보", "Ekans"),
    (24, "아보크", "Arbok"),
    (25, "피카츄", "Pikachu"),
    (26, "라이츄", "Raichu"),
    (27, "모래두지", "Sandshrew"),
    (28, "고지", "Sandslash"),
    (29, "니드런♀", "Nidoran♀"),
    (30, "니드리나", "Nidorina"),
    (31, "니드퀸", "Nidoqueen"),
    (32, "니드런♂", "Nidoran♂"),
    (33, "니드리노", "Nidorino"),
    (34, "니드킹", "Nidoking"),
    (35, "삐삐", "Clefairy"),
    (36, "픽시", "Clefable"),
    (37, "식스테일", "Vulpix"),
    (38, "나인테일", "Ninetales"),
    (39, "푸린", "Jigglypuff"),
    (40, "푸크린", "Wigglytuff"),
]

KNOWN_RARITIES = {
    "C", "U", "R", "H", "HR", "SR", "SSR", "SAR", "AR", "RR", "RRR",
    "UR", "CHR", "CSR", "S", "M", "CM", "N", "K", "TR", "PR", "PROMO",
    "Mirror", "—", "P",
}

KOREAN_FORM_PREFIXES = {
    "Alolan": "알로라",
    "Galarian": "가라르",
    "Hisuian": "히스이",
    "Paldean": "팔데아",
}

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

session = requests.Session()
session.headers.update({
    "User-Agent": USER_AGENT,
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
})


def with_lang(url: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["lang"] = "ko"
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def get(url: str, *, tries: int = 4) -> requests.Response:
    last_error = None
    for attempt in range(tries):
        try:
            response = session.get(url, timeout=30)
            if response.status_code == 200 and response.text.strip():
                return response
            last_error = RuntimeError(f"HTTP {response.status_code} for {url}")
        except requests.RequestException as error:
            last_error = error
        time.sleep(1.0 + attempt * 1.5)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def gallery_url(name_ko: str) -> str:
    return f"{BASE_URL}/pokemon/{quote(name_ko, safe='')}?region=kr&sort=set&lang=ko"


def expected_count(text: str) -> int | None:
    patterns = [
        r"전\s*세트\s*(\d+)\s*장",
        r"(\d+)\s*cards\s+across\s+all\s+sets",
        r"전체\s*🇰🇷\s*(\d+)",
        r"🇰🇷\s*(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return int(match.group(1))
    return None


def card_links(soup: BeautifulSoup) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    uuid_pattern = re.compile(
        r"^/cards/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        re.I,
    )
    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "")
        if not uuid_pattern.match(href):
            continue
        url = urljoin(BASE_URL, href)
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls


def first_card_number(strings: list[str]) -> str:
    number_pattern = re.compile(
        r"^(?:\d{1,3}/(?:\d{1,3}|[A-Z]{1,5}(?:-[A-Z])?)|\d{1,3})$",
        re.I,
    )
    for value in strings:
        candidate = value.strip()
        if number_pattern.fullmatch(candidate):
            return candidate
    joined = " ".join(strings)
    match = re.search(r"\b(\d{1,3}/(?:\d{1,3}|[A-Z]{1,5}(?:-[A-Z])?))\b", joined, re.I)
    if match:
        return match.group(1)
    raise ValueError("card number not found")


def rarity_after_number(strings: list[str], number: str) -> str:
    try:
        start = strings.index(number)
    except ValueError:
        start = 0
    for value in strings[start + 1 : start + 10]:
        candidate = value.strip()
        if candidate in KNOWN_RARITIES:
            return candidate
        match = re.search(r"\b(PROMO|SAR|SSR|SR|UR|AR|HR|CSR|CHR|RRR|RR|TR|Mirror|[CU RHSMNKP])\b", candidate)
        if match:
            return match.group(1).strip()
    return "—"


def extract_set(soup: BeautifulSoup, text: str) -> tuple[str, str]:
    set_anchor = None
    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "")
        if href.startswith("/sets/"):
            set_anchor = anchor
            break
    set_name = clean_text(set_anchor.get_text(" ", strip=True)) if set_anchor else "한국 프로모"
    set_code = ""
    if set_anchor is not None:
        parent_text = clean_text(set_anchor.parent.get_text(" ", strip=True))
        match = re.search(r"/\s*([A-Za-z0-9+_.-]+)\b", parent_text)
        if match:
            set_code = match.group(1)
    if not set_code:
        match = re.search(r"\b(?:Set|세트)\s*.*?\s/\s*([A-Za-z0-9+_.-]+)\b", text, re.I)
        if match:
            set_code = match.group(1)
    return set_name or "한국 프로모", set_code


def extract_release(text: str) -> tuple[int, int, int] | None:
    english = re.search(
        r"(?:Release|발매)\s*([A-Za-z]+)\s+(\d{4})",
        text,
        re.I,
    )
    if english:
        month = MONTHS.get(english.group(1).lower())
        if month:
            return int(english.group(2)), month, 1

    korean = re.search(
        r"(?:발매|출시)\s*(\d{4})\s*[년.\-/]\s*(\d{1,2})",
        text,
    )
    if korean:
        return int(korean.group(1)), int(korean.group(2)), 1
    return None


def coarse_year(set_code: str, set_name: str) -> int:
    match = re.search(r"(20\d{2})", set_code)
    if match:
        return int(match.group(1))
    token = f"{set_code} {set_name}".upper()
    if "DP" in token:
        return 2009
    if "BW" in token:
        return 2011
    if "XY" in token:
        return 2014
    if "SUN" in token or "MOON" in token or re.search(r"\bSM", token):
        return 2017
    if "SWORD" in token or "SHIELD" in token:
        return 2020
    if "SCARLET" in token or "VIOLET" in token:
        return 2023
    if "MEGA" in token:
        return 2025
    return 2098


def card_image(soup: BeautifulSoup, species_ko: str, species_en: str) -> str:
    for attrs in (
        {"property": "og:image"},
        {"name": "twitter:image"},
    ):
        meta = soup.find("meta", attrs=attrs)
        if meta and meta.get("content"):
            url = meta["content"].strip()
            if "collectory.cc" in url:
                return url

    candidates = []
    for image in soup.find_all("img"):
        src = image.get("src") or image.get("data-src") or ""
        alt = clean_text(image.get("alt", ""))
        if "cdn.collectory.cc" not in src:
            continue
        score = 0
        if species_ko in alt or species_en.lower() in alt.lower():
            score += 10
        if "/cards/" in src:
            score += 5
        candidates.append((score, src))
    if candidates:
        candidates.sort(reverse=True)
        return candidates[0][1]
    raise ValueError("card image not found")


def normalize_name(raw: str, species_ko: str, species_en: str) -> str:
    name = clean_text(raw).replace("🇰🇷", "").strip()
    if not name:
        return species_ko

    for english_prefix, korean_prefix in KOREAN_FORM_PREFIXES.items():
        prefix = f"{english_prefix} {species_en}"
        if name.lower().startswith(prefix.lower()):
            return korean_prefix + " " + species_ko + name[len(prefix):]

    if name.lower().startswith(species_en.lower()):
        return species_ko + name[len(species_en):]
    return name


@dataclass
class ParsedCard:
    source_index: int
    name: str
    number: str
    rarity: str
    set_name: str
    set_code: str
    image: str
    source: str
    release: tuple[int, int, int] | None

    def sort_key(self):
        release = self.release
        if release:
            return (*release, self.source_index)
        return (coarse_year(self.set_code, self.set_name), 12, 31, self.source_index)

    def payload(self, account_index: int):
        set_label = self.set_code or self.set_name
        return {
            "name": self.name,
            "meta": f"{self.number} · {self.rarity} · {set_label}",
            "image": self.image,
            "owned": False,
            "accountIndex": account_index,
            "source": self.source,
        }


def parse_card(url: str, source_index: int, species_ko: str, species_en: str) -> ParsedCard:
    response = get(with_lang(url))
    soup = BeautifulSoup(response.text, "html.parser")
    strings = [clean_text(value) for value in soup.stripped_strings if clean_text(value)]
    text = " ".join(strings)

    heading = soup.find("h1")
    raw_name = heading.get_text(" ", strip=True) if heading else species_ko
    name = normalize_name(raw_name, species_ko, species_en)
    number = first_card_number(strings)
    rarity = rarity_after_number(strings, number)
    set_name, set_code = extract_set(soup, text)
    image = card_image(soup, species_ko, species_en)
    release = extract_release(text)

    return ParsedCard(
        source_index=source_index,
        name=name,
        number=number,
        rarity=rarity,
        set_name=set_name,
        set_code=set_code,
        image=image,
        source=url,
        release=release,
    )


def build_group(dex_number: int, species_ko: str, species_en: str) -> dict:
    url = gallery_url(species_ko)
    response = get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    text = clean_text(soup.get_text(" ", strip=True))
    expected = expected_count(text)
    links = card_links(soup)

    if expected is None:
        raise RuntimeError(f"#{dex_number:03d} {species_ko}: expected count not found")
    if len(links) != expected:
        raise RuntimeError(
            f"#{dex_number:03d} {species_ko}: gallery says {expected}, parsed {len(links)} card links"
        )

    cards: list[ParsedCard] = []
    failures = []
    for index, card_url in enumerate(links):
        try:
            cards.append(parse_card(card_url, index, species_ko, species_en))
        except Exception as error:
            failures.append({"url": card_url, "error": str(error)})
        time.sleep(0.08)

    if failures:
        print(json.dumps({"pokemon": species_ko, "failures": failures}, ensure_ascii=False, indent=2))
        raise RuntimeError(f"#{dex_number:03d} {species_ko}: {len(failures)} card pages failed")
    if len(cards) != expected:
        raise RuntimeError(f"#{dex_number:03d} {species_ko}: expected {expected}, built {len(cards)}")

    # Stable ownership identifiers are based on the source gallery index. Display order is Korean release order.
    ordered = sorted(cards, key=lambda card: card.sort_key())
    payload = [card.payload(card.source_index) for card in ordered]

    # No duplicate account identifier within a Pokémon group.
    indexes = [card["accountIndex"] for card in payload]
    if len(indexes) != len(set(indexes)):
        raise RuntimeError(f"#{dex_number:03d} {species_ko}: duplicate accountIndex")

    print(f"#{dex_number:03d} {species_ko}: {len(payload)} cards")
    return {
        "name": species_ko,
        "dexNumber": dex_number,
        "cards": payload,
    }


def main() -> int:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else OUTPUT
    groups = []
    total_cards = 0

    for dex_number, species_ko, species_en in POKEMON:
        group = build_group(dex_number, species_ko, species_en)
        groups.append(group)
        total_cards += len(group["cards"])

    if [group["dexNumber"] for group in groups] != list(range(21, 41)):
        raise RuntimeError("Pokédex range is not exactly 021–040")

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(groups, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"groups": len(groups), "cards": total_cards, "output": str(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
