# MY POKÉMON DEX

개인 포켓몬 카드 수집 현황을 한곳에서 보는 정적 웹사이트입니다.

## 현재 도감

- 1025 전국도감
- 1세대부터 9세대까지 1,025종
- 보유 994종 / 미보유 31종 / 수집률 97.0%
- 인물도감: 1세대부터 9세대까지 주요 인물 179명
- 한국어판 단독 인물 대표 카드 확인 125명 / 추가 확인 54명
- 팩도감: S·SV·M 정규 확장팩 62종 전종수집
- 프로모팩 검색 DB 36종 / 실제 보유 팩만 계정별 등록

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
`data/people-korean-cards.json`의 검증된 한국어판 단독 인물 카드
매핑을 기준으로 아래 명령을 실행합니다.

```bash
node scripts/build_people_data.mjs
```

인물 선정과 한글명·역할은 생성 스크립트에서 관리합니다. 정적 대표 카드는
포켓몬코리아 공식 카드검색에서 해당 한국어 이름으로 확인되는 카드 중
인물별로 1장만 저장하며, 합동·단체 카드는 제외합니다. 사이트에서 Google
로그인 후 보유·미보유를 기록하거나 다이얼로그의 카드 이미지 URL과 상세
링크를 계정별로 직접 교체할 수 있습니다.

프로모팩은 `data/promo-packs.json`에서 검색용 마스터 DB를 관리합니다.
기존 정규 프로모팩 25종을 모두 보존하고 추가 정규·특수 프로모팩까지
공식 페이지에서 확인한 36종을 포함하며, 전종 수집률에는 넣지 않습니다.
사용자의 프로모팩 보유 ID와 직접 등록한 항목은 기존 `packDex` 문서의
`ownedPromoPackIds`, `customPromoPacks`에 저장됩니다. 예전 `ownedCodes`에
저장된 프로모 코드는 자동으로 인식합니다.

## 컬렉터 프로필과 공유

`feature/collector-profile-sharing` 브랜치는 기존 도감 문서를 옮기거나
변경하지 않고 다음 기능을 별도 데이터로 추가합니다.

- 컬렉터 닉네임, 한 줄 소개와 직접 업로드하는 프로필 사진
- 전국·팩·작가·시리즈·포켓몬·AR·인물도감별 대시보드 표시 설정
- 도감별 `private` / `unlisted` / `public` 공개 범위
- 공개 컬렉터 프로필과 보유·미보유 상태만 담은 읽기 전용 도감
- 기존 `shared-readonly-view.js` 및 `sharedDexViews` 공유 방식 유지

공개 화면은 `users/{uid}/collections/*` 원본을 직접 읽지 않습니다.
이메일, Firebase UID, 메모, 수량, 교환 상태와 직접 등록한 프로모 정보가
빠진 최소 projection만 `publicProfiles` 또는 `sharedCollections`에서 읽습니다.
프로필 사진의 공개 Storage URL도 UID 대신 안정적인 `publicId` 경로를 사용합니다.

구조와 배포 전 확인사항은
[컬렉터 프로필·공유 설계](./docs/collector-profile-sharing.md)와
[Firebase 연결 절차](./FIREBASE_SETUP.md)를 참고하세요.

## 로컬 검증

Node.js와 Java가 준비된 환경에서 다음 명령을 실행합니다.

```bash
npm install
npm test
```

`npm test`는 JavaScript/HTML 정적 검사, 카탈로그 수·projection 회귀 검사,
공개 UI 계약 검사, Firestore·Storage Rules 문법 검사와 Firebase Emulator
권한 테스트를 순서대로 실행합니다.
