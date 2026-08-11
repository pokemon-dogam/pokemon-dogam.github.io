#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

POKEMON = [
    (21, "깨비참"), (22, "깨비드릴조"), (23, "아보"), (24, "아보크"),
    (25, "피카츄"), (26, "라이츄"), (27, "모래두지"), (28, "고지"),
    (29, "니드런♀"), (30, "니드리나"), (31, "니드퀸"), (32, "니드런♂"),
    (33, "니드리노"), (34, "니드킹"), (35, "삐삐"), (36, "픽시"),
    (37, "식스테일"), (38, "나인테일"), (39, "푸린"), (40, "푸크린"),
]

# kinbo-ptcg/ptcg-kr-db가 스텔라미라클까지 공식 홈페이지 데이터를 보존하고 있다.
# 그 이후 카드는 이 사이트가 이미 관리하는 최신 시리즈/AR/프로모 DB로 보완한다.
SOURCE_CUTOFF_YEAR = 2024


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_image(url: str) -> str:
    return str(url or "").split("?", 1)[0].strip()


def extract_year(value: str) -> int:
    match = re.search(r"(?:19|20)\d{2}", str(value or ""))
    return int(match.group(0)) if match else 9999


def natural_code_key(code: str) -> tuple:
    parts = re.split(r"(\d+)", str(code or "").lower())
    return tuple(int(part) if part.isdigit() else part for part in parts)


def version_sort_key(version: dict[str, Any], sequence: int) -> tuple:
    year = extract_year(version.get("cardPageURL", ""))
    if year == 9999:
        year = extract_year(version.get("prodName", ""))
    return (
        year,
        natural_code_key(version.get("prodCode", "")),
        natural_code_key(version.get("number", "")),
        sequence,
    )


def card_number(version: dict[str, Any]) -> str:
    number = str(version.get("number") or "").strip()
    prod_number = str(version.get("prodNumber") or "").strip()
    prod_code = str(version.get("prodCode") or "").strip()
    if not number:
        return "—"
    if prod_number and prod_number.isdigit():
        return f"{number}/{prod_number.zfill(len(prod_number))}"
    if "-P" in prod_code.upper() or prod_code.upper().endswith("P"):
        return f"{number}/{prod_code.upper()}"
    return number


def baseline_group(source_root: Path, dex_number: int, species: str) -> list[dict[str, Any]]:
    source = source_root / "card_data" / "pokemon" / "gen1" / f"{dex_number:04d}_{species}.json"
    if not source.exists():
        raise FileNotFoundError(f"Korean card DB is missing {source}")

    card_defs = load_json(source)
    rows: list[tuple[tuple, dict[str, Any]]] = []
    sequence = 0
    for card in card_defs:
        name = str(card.get("name") or species).strip()
        for version in card.get("version_infos") or []:
            image = normalize_image(version.get("cardImgURL", ""))
            if not image:
                continue
            number = card_number(version)
            rarity = str(version.get("rarity") or "—").strip()
            prod_code = str(version.get("prodCode") or "—").strip()
            payload = {
                "name": name,
                "meta": f"{number} · {rarity} · {prod_code}",
                "image": image,
                "owned": False,
                "source": str(version.get("cardPageURL") or "https://pokemoncard.co.kr/cards"),
                "releaseYear": extract_year(version.get("cardPageURL", "")),
            }
            rows.append((version_sort_key(version, sequence), payload))
            sequence += 1

    rows.sort(key=lambda item: item[0])
    return [row for _, row in rows]


def target_for_name(name: str) -> tuple[int, str] | None:
    value = str(name or "").replace(" ", "")
    if not value:
        return None
    # 긴 이름을 우선해 니드런/니드리나 같은 부분문자열 충돌을 피한다.
    for dex_number, species in sorted(POKEMON, key=lambda item: len(item[1]), reverse=True):
        if species.replace(" ", "") in value:
            return dex_number, species
    return None


def parse_series_number(code: str) -> tuple[str, str]:
    value = str(code or "")
    match = re.search(r"_([^/\s]+)/([^\s]+)", value)
    if match:
        return match.group(1), match.group(2)
    return value, ""


def ar_rarity_map(ar_path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    if not ar_path.exists():
        return result
    for group in load_json(ar_path):
        for card in group.get("cards") or []:
            image = normalize_image(card.get("image", ""))
            if image:
                result[image] = "AR"
    return result


def supplement_from_series(
    series_path: Path,
    ar_path: Path,
) -> dict[int, list[dict[str, Any]]]:
    result = {dex: [] for dex, _ in POKEMON}
    if not series_path.exists():
        return result
    rarity_by_image = ar_rarity_map(ar_path)

    for group in load_json(series_path):
        release = str(group.get("release") or "")
        year = extract_year(release)
        if year <= SOURCE_CUTOFF_YEAR:
            continue
        set_code = str(group.get("code") or "—").strip()
        for card in group.get("cards") or []:
            display_name = str(card.get("name") or card.get("pokemonName") or "").strip()
            match = target_for_name(display_name or card.get("pokemonName", ""))
            if not match:
                continue
            dex_number, species = match
            image = normalize_image(card.get("image", ""))
            if not image:
                continue
            number, denominator = parse_series_number(card.get("code", ""))
            number_label = f"{number}/{denominator}" if denominator else number
            rarity = rarity_by_image.get(image, "—")
            result[dex_number].append({
                "name": display_name or species,
                "meta": f"{number_label} · {rarity} · {set_code}",
                "image": image,
                "owned": False,
                "source": "https://pokemoncard.co.kr/cards",
                "releaseYear": year,
                "release": release,
                "setOrder": int(card.get("order") or 0),
            })
    return result


def supplement_from_promos(promo_path: Path) -> dict[int, list[dict[str, Any]]]:
    result = {dex: [] for dex, _ in POKEMON}
    if not promo_path.exists():
        return result
    payload = load_json(promo_path)
    for card in payload.get("cards") or []:
        name = str(card.get("name") or "").strip()
        match = target_for_name(name)
        if not match:
            continue
        dex_number, species = match
        image = normalize_image(card.get("image", ""))
        if not image:
            continue
        year = int(card.get("year") or 9999)
        # 오래된 프로모는 baseline에 포함되어 있으므로 최신 DB 보완분만 우선 추가한다.
        if year <= SOURCE_CUTOFF_YEAR:
            continue
        number = str(card.get("cardNumber") or "PROMO").strip()
        era = str(card.get("era") or "PROMO").strip()
        result[dex_number].append({
            "name": name or species,
            "meta": f"{number} · PROMO · {era}",
            "image": image,
            "owned": False,
            "source": str(card.get("source") or "https://pokemoncard.co.kr/cards"),
            "releaseYear": year,
            "release": f"{year}-12-31",
            "setOrder": 9999,
        })
    return result


def dedupe_and_sort(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for card in cards:
        image = normalize_image(card.get("image", ""))
        key = image or f"{card.get('name')}::{card.get('meta')}"
        if key in seen:
            continue
        seen.add(key)
        card["image"] = image
        unique.append(card)

    unique.sort(key=lambda card: (
        int(card.get("releaseYear") or 9999),
        str(card.get("release") or ""),
        int(card.get("setOrder") or 0),
        natural_code_key(card.get("meta", "")),
    ))
    for index, card in enumerate(unique):
        card["accountIndex"] = index
        card.pop("releaseYear", None)
        card.pop("release", None)
        card.pop("setOrder", None)
    return unique


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit(
            "usage: build_pokemon_collections_21_40.py <ptcg-kr-db-root> [output]"
        )
    source_root = Path(sys.argv[1])
    output = Path(sys.argv[2]) if len(sys.argv) >= 3 else Path("data/pokemon-collections-21-40.json")

    modern = supplement_from_series(Path("data/series.json"), Path("data/ar.json"))
    promos = supplement_from_promos(Path("data/promo-packs.json"))
    groups = []
    total = 0

    for dex_number, species in POKEMON:
        base = baseline_group(source_root, dex_number, species)
        cards = dedupe_and_sort(base + modern[dex_number] + promos[dex_number])
        if not cards:
            raise RuntimeError(f"#{dex_number:03d} {species}: no cards")
        groups.append({
            "name": species,
            "dexNumber": dex_number,
            "cards": cards,
        })
        total += len(cards)
        print(
            f"#{dex_number:03d} {species}: {len(cards)} cards "
            f"(baseline {len(base)}, modern {len(modern[dex_number])}, promo {len(promos[dex_number])})"
        )

    assert [group["dexNumber"] for group in groups] == list(range(21, 41))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(groups, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"groups": len(groups), "cards": total, "output": str(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
