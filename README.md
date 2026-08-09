# MY POKÉMON DEX

개인 포켓몬 카드 수집 현황을 한곳에서 보는 정적 웹사이트입니다.

## 현재 도감

- 1025 전국도감
- 1세대부터 9세대까지 1,025종
- 보유 994종 / 미보유 31종 / 수집률 97.0%
- 인물도감: 1세대부터 9세대까지 주요 인물 179명
- 영문 TCG 카드명 기준 대표 카드 이미지 확인 130명 / 추가 확인 49명

## 데이터 갱신

원본 Excel 파일에서 데이터를 다시 추출하려면 저장소 바깥의 원본 파일을
준비한 뒤 아래 명령을 실행합니다.

```bash
python scripts/extract_pokedex.py source/1025-pokedex.xlsm data/pokedex.json
```

이 저장소에는 웹사이트에 필요한 데이터만 포함하며 원본 Excel 파일은
포함하지 않습니다. 바인더 위치도 공개 데이터에서 제외합니다.

시리즈 도감의 포켓몬 검색명을 다시 보강하려면 다음 명령을 실행합니다.
기존 카드 순서, 이미지, 보유 상태와 직접 입력된 한글 카드명은 유지됩니다.

```bash
python scripts/enrich_series_pokemon_names.py
```

인물도감 데이터와 대표 카드 연결을 다시 생성하려면
[`PokemonTCG/pokemon-tcg-data`](https://github.com/PokemonTCG/pokemon-tcg-data)를
저장소와 나란히 준비한 뒤 아래 명령을 실행합니다.

```bash
node scripts/build_people_data.mjs ../pokemon-tcg-data
```

인물 선정과 한글명·역할은 생성 스크립트에서 관리하며, 카드 배열은 인물별로
최대 3장까지 저장되어 향후 추가 카드 연결을 확장할 수 있습니다.
