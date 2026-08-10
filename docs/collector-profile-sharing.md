# 컬렉터 프로필·도감 공유 설계

## 작업 기준

- 시작 `main` SHA: `752b4132d3678ce12b6ba94196461ce7f1381a64`
- 작업 브랜치: `feature/collector-profile-sharing`
- 원칙: 기존 도감 문서·필드·공유 방식은 그대로 두고 신규 경로만 추가
- 운영 상태: 기능 브랜치 로컬 구현이며 Firebase Rules·Storage·GitHub Pages 미배포

## 기능 범위

- 기존 사용자에게 한 번만 표시되는 컬렉터 프로필 안내와 `나중에` 상태
- 중복 방지 컬렉터 닉네임, 안정적인 랜덤 `publicId`, 한 줄 소개
- 브라우저 정사각형 crop·이동·확대 후 512×512 WebP 프로필 사진 업로드
- 7개 도감의 대시보드 표시와 공개 범위를 서로 독립적으로 설정
- `private`, `unlisted`, `public` 도감별 공개
- 공개 프로필과 기존 도감 UI를 재사용한 읽기 전용 상세 화면

리더보드, 좋아요, 팔로우, 댓글, DM, 거래 자동화는 포함하지 않습니다.

## 기존 데이터 보존

다음 경로와 의미는 변경하지 않습니다.

| 기존 경로/기능 | 보존 내용 |
|---|---|
| `users/{uid}/collections/nationalDex` | `baseMode`, `overrides`, `quantity`, `tradeStatus`, `note`, 실제 카드 정보, `peopleOwned`, `peopleOverrides` |
| `users/{uid}/collections/packDex` | `ownedCodes`, `ownedPromoPackIds`, `customPromoPacks`, 기존 프로모 호환 |
| 나머지 `*Dex` 문서 | 기존 `baseMode`, `overrides`, 이메일·표시 이름과 갱신 흐름 |
| `shared-readonly-view.js`, `sharedDexViews` | 기존 지정 계정 읽기 전용 공유 |
| `siteMetrics`, `siteDailyMetrics`, `siteUserRegistry`, `siteFeedback` | 통계·건의 기능 및 Rules |
| `owner-sheets-sync.js` | 기존 도감 변경 이벤트 기반 Google Sheets 동기화 |

기존 데이터 migration, 삭제, 이동 또는 공개 전환은 없습니다. 신규 공개 범위의
기본값은 항상 `private`입니다. 대시보드 기본값은 기존 화면을 보존하기 위해
기존 6개 도감은 표시하고, 새로 편입한 인물도감은 opt-in으로 둡니다.
기존 Sheets → 도감 반영이 보유 원본을 바꾸면 공개가 켜진 도감의 최소
projection만 후속 갱신하며, 프로필·공개 설정 변경을 Sheets 카드 변경 이벤트로
보내지는 않습니다.

## 신규 Firestore 구조

### 비공개 사용자 데이터

| 경로 | 주요 필드 | 읽기/쓰기 |
|---|---|---|
| `users/{uid}/profile/main` | `nickname`, `nicknameNormalized`, `publicId`, `bio`, avatar 경로·URL·version, 생성·수정 시각 | 본인만 읽기·쓰기 |
| `users/{uid}/settings/collector` | onboarding `나중에` 상태 | 본인만 읽기·쓰기 |
| `users/{uid}/collectionSettings/{collectionId}` | `dashboardVisible`, `visibility`, `displayOrder`, `shareId` | 본인만 읽기·쓰기 |
| `collectorNicknameOwners/{normalized}` | 닉네임 소유 UID | 해당 소유자만 exact get |
| `collectorPublicIdOwners/{publicId}` | 공개 ID 소유 UID | 해당 소유자만 exact get |
| `collectorShareOwners/{shareId}` | 링크 토큰 소유 UID·도감 | 해당 소유자만 exact get |

`collectionId`는 `national`, `pack`, `artist`, `series`, `pokemon`, `ar`,
`people` 중 하나입니다. 인물도감 설정은 독립 문서이지만 실제 보유 원본은
기존 `nationalDex` 안에 그대로 둡니다.

### 공개 또는 링크 공개 데이터

| 경로 | 공개 내용 | 제한 |
|---|---|---|
| `collectorNicknames/{normalized}` | `claimed: true`만 포함 | exact get만 허용, list 차단 |
| `publicProfiles/{publicId}` | 닉네임, 소개, 사용자 업로드 사진 URL/version | 공개 exact get, 최상위 list 차단 |
| `publicProfiles/{publicId}/collections/{collectionId}` | 안전한 공개 projection | 공개 get/list, 소유자만 쓰기 |
| `sharedCollections/{shareId}` | 안전한 공개 projection | 추측 곤란한 exact get만, list 차단 |

공개 projection 스키마는 다음 필드로 제한합니다.

```text
schemaVersion
publicId
collectionId
ownedKeys
ownedCount
totalCount
promoOwnedKeys
promoOwnedCount
```

이메일, UID, Google 표시 이름, 내부 Firestore 경로, 관리자 정보, 메모, 수량,
교환 상태, 실제 보유 카드 상세와 `customPromoPacks`는 projection에 들어갈 수
없도록 Rules의 `keys().hasOnly(...)`로 제한합니다.

## 닉네임과 URL

- 닉네임: NFKC 정규화, 앞뒤 공백 제거, 연속 공백 축소, 소문자·공백 제거
  값을 claim ID로 사용
- 허용 문자: 한글, ASCII 영문, 숫자, 일반 공백
- 길이: 2–20자
- 서버 claim을 Firestore transaction에서 읽고, claim 생성, 소유자 mapping,
  비공개 프로필과 공개 프로필을 같은 transaction으로 커밋해 동시 선점을 한
  사용자만 성공시킴
- `publicId`: 닉네임과 무관한 12자 소문자 영숫자 난수이며 프로필 생성 뒤 변경 금지
- `shareId`: 32자 URL-safe 암호학적 난수

URL 예시는 다음과 같습니다.

```text
collector.html?id=abc123def456
national.html?collector=abc123def456
national.html#share=AbCdEfGhIjKlMnOpQrStUvWxYz012345
```

`unlisted` 토큰은 정적 호스팅 요청·리퍼러에 포함되지 않도록 query가 아닌 URL
fragment로 전달합니다. 브라우저가 fragment를 서버로 보내지 않으므로 공유받은
페이지의 클라이언트만 토큰을 읽습니다.

`unlisted`에서 `private` 또는 `public`로 바꾸면 기존 projection과 토큰 소유권을
같은 batch에서 삭제합니다. 이후 다시 `unlisted`를 선택하면 새 토큰을 발급하므로
전에 전달한 링크가 나중에 자동으로 되살아나지 않습니다.

URL에는 UID나 이메일을 넣지 않습니다.

## 공개 범위 전환

설정 문서와 projection 생성·삭제를 Firestore batch 하나로 처리합니다.

| 새 공개 범위 | public projection | unlisted projection |
|---|---|---|
| `private` | 없음 | 없음 |
| `public` | 존재 | 없음 |
| `unlisted` | 없음 | 존재 |

Firestore Rules는 설정 write에서 `existsAfter()`로 이 상태를 함께 검증합니다.
따라서 `private` 전환 시 기존 공개 문서를 같은 batch에서 지우지 않으면 설정
변경 자체가 거부됩니다. 공개·링크 projection의 직접 삭제도 해당 설정이 더는
그 공개 범위를 요구하지 않을 때만 허용합니다.

## 프로필 사진

- 입력: 휴대폰 사진첩 또는 PC 이미지 파일, 최대 25MB
- 브라우저 처리: EXIF 방향을 고려해 decode → 이동·확대 → 정사각형 crop →
  512×512 canvas → WebP 품질 0.86
- 업로드: 압축 결과만 Storage에 저장하며 원본은 업로드하지 않음
- 저장 경로: `publicProfiles/{publicId}/avatar-a.webp` 또는 `avatar-b.webp`
- 교체: 빈 슬롯에 새 파일 업로드 → Firestore 비공개/공개 프로필 동시 반영 →
  이전 슬롯 삭제
- 실패: 새 업로드나 프로필 반영 실패 시 이전 프로필 경로를 유지하고 새 파일을 정리

공개 이미지 URL에 UID가 들어가지 않도록 Storage 경로에는 안정적인 `publicId`만
사용합니다. Storage Rules는 비공개 `collectorPublicIdOwners/{publicId}` 문서를
`firestore.get()`으로 확인해 소유자만 쓰고 지울 수 있게 하며, 허용 파일명,
2MB 이하, `image/webp`만 허용합니다. Firestore Rules도 공개 avatar URL이 이
프로젝트의 동일 `publicId` Storage 경로 형식과 일치하도록 제한합니다.

## 대시보드와 비용

- 기존 6개 도감 기본 표시를 유지하고 인물도감 선택을 추가
- 표시된 도감만 전체 보유·미보유·완성률, 완성에 가까운 도감과 최근 기록에 포함
- 팩 프로모는 기존처럼 전체 전종 분모에 억지로 합치지 않음
- `displayOrder`를 스키마에 두어 하위 도감 registry 확장 가능

보안상 공개 전환을 도감별 원자적 batch로 검증하기 위해 설정을 7개 작은 문서로
분리했습니다. 대시보드 로그인 초기 로드는 기존 도감 원본 6건(`people`은
`nationalDex` 재사용), 설정 최대 7건과 비공개 프로필·안내 상태를 읽습니다.
공개 프로필은 프로필 1건과 공개한 도감 최대 7건만 읽습니다. 공개 도감 갱신은
원본 변경 때 프로필·설정·원본 3건을 확인한 뒤 projection 1건을 씁니다.

프로필 사진 업로드·교체·삭제의 Storage Rules 평가는 소유권 확인을 위해
Firestore 문서 1건을 읽습니다. 배포 시 Storage Rules의 Firestore 교차 서비스
접근 권한 활성화 안내가 나타날 수 있으므로 비용·IAM 변경 여부를 먼저 확인합니다.

## 검증과 운영 반영 조건

로컬 자동 검사는 다음을 포함합니다.

- JavaScript 문법과 HTML 로컬 자산 경로
- 모든 카탈로그 item 수와 unique key
- 기존 6개 대시보드 기본값과 인물도감 opt-in
- 도감 간 동일 카드 보유 상태 독립성
- 공개 adapter가 비공개 필드를 버리고 `users/*`를 읽지 않는지
- Firestore·Storage Rules 문법
- Emulator용 닉네임 경쟁, 프로필 변경, 공개/회수, 타 사용자 쓰기, Storage 소유권 테스트

운영 반영 전에는 네트워크가 허용된 환경에서 Firebase Emulator 전체 테스트와
실제 Chrome/Safari의 PC·모바일 수동 검수를 완료해야 합니다. 또한 Firebase
Console에서 Storage 활성화 상태, 비용 요구 여부와 현재 배포 Rules를 확인해야
합니다. Storage Rules가 Firestore 소유권 문서를 읽기 위한 교차 서비스 권한도
소유자 승인 없이 활성화하지 않습니다. 하나라도 미완료이면 `main` merge와
Firebase 배포를 진행하지 않습니다.

## 2026-08-10 로컬 검증 결과

통과:

- JavaScript 27개와 HTML 12개의 문법·로컬 자산 경로 검사
- 카탈로그·projection 회귀 테스트 7개
- 공개 UI·스크립트 로드 순서·공유 계약 테스트 9개
- Firestore·Storage Rules 정적 lint
- `npm ls --depth=0`, `git diff --check`

작성했으나 현재 실행 환경 제약으로 미완료:

- Firestore Rules emulator 테스트 12개
- Storage Rules emulator 테스트 5개
- 실제 Chrome/Safari 데스크톱·모바일 상호작용 검수
- 기존 owner·일반 사용자·신규 사용자 계정으로 운영 Firebase 런타임 검수
- Firebase Console의 Storage 활성화·Billing·현재 Rules·교차 서비스 권한 확인

공식 emulator 바이너리 다운로드에 필요한 네트워크 승인이 현재 실행 환경에서
차단되었고, 로컬 브라우저 프로세스도 sandbox 제약으로 실행되지 않았습니다.
따라서 이 브랜치는 구현·정적 검증 단계이며 아직 `main` merge 또는 운영 배포
가능 상태로 판정하지 않습니다.
