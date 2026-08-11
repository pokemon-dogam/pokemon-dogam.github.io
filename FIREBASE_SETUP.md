# Firebase 계정별 도감 연결·배포 절차

이 사이트는 기존 계정별 도감 문서와 신규 컬렉터 프로필·공개 projection을
분리합니다. 기존 문서 삭제, 이동, 자동 migration은 필요하지 않습니다.

## 계정별 시작 상태

- `ownerEmail` 소유자 계정: 기존 정적 도감 상태를 `baseMode: legacy`로 이어서 사용
- 그 외 새 Google 계정: `baseMode: empty`로 모든 도감을 미보유 상태에서 시작
- 각 사용자는 자신의 `users/{uid}` 하위 원본만 읽고 수정 가능
- 공개 방문자는 별도의 최소 projection만 읽을 수 있고 원본 도감은 읽을 수 없음

## 1. Firebase 웹 앱과 Google 로그인

1. Firebase Console에서 웹 앱을 확인하거나 등록합니다.
2. Authentication → Sign-in method에서 Google 제공업체를 사용 설정합니다.
3. Authentication → Settings → Authorized domains에
   `pokemon-dogam.github.io`가 등록되어 있는지 확인합니다.
4. 서비스 계정 JSON이나 비공개 키는 저장소에 추가하지 않습니다.

`firebase-config.js`는 다음 형태를 유지합니다.

```javascript
window.POKEMON_DEX_FIREBASE = {
  enabled: true,
  config: {
    apiKey: "Firebase 웹 앱 값",
    authDomain: "Firebase 웹 앱 값",
    projectId: "Firebase 웹 앱 값",
    messagingSenderId: "Firebase 웹 앱 값",
    appId: "Firebase 웹 앱 값",
  },
  ownerEmail: "기존 도감 상태를 이어갈 Google 이메일",
  userCollection: "collections",
  userDocument: "nationalDex",
};
```

## 2. Firestore 구조

기존 원본 경로는 그대로 유지합니다.

```text
users/{uid}/collections/nationalDex
users/{uid}/collections/packDex
users/{uid}/collections/artistDex
users/{uid}/collections/seriesDex
users/{uid}/collections/pokemonCollectionsDex
users/{uid}/collections/arDex
```

인물도감은 기존과 같이 `nationalDex.peopleOwned`와
`nationalDex.peopleOverrides`를 사용합니다.

신규 비공개 데이터는 다음 경로에만 추가됩니다.

```text
users/{uid}/profile/main
users/{uid}/settings/collector
users/{uid}/collectionSettings/{collectionId}
collectorNicknameOwners/{normalizedNickname}
collectorPublicIdOwners/{publicId}
collectorShareOwners/{shareId}
```

닉네임 사용 여부와 공개 데이터는 별도 경로에 둡니다.

```text
collectorNicknames/{normalizedNickname}
publicProfiles/{publicId}
publicProfiles/{publicId}/collections/{collectionId}
sharedCollections/{shareId}
```

공개 projection은 보유 key와 합계만 포함하며 이메일, UID, 실제 카드 정보,
메모, 수량, 교환 상태와 사용자 직접 등록 프로모는 포함하지 않습니다.

## 3. Spark 무료 요금제 유지

컬렉터 프로필은 닉네임, 한 줄 소개와 닉네임 첫 글자 아이콘만 사용합니다.
프로필 사진 파일·이미지 URL을 저장하지 않으며 Firebase Storage SDK, bucket,
Storage Rules도 사용하거나 배포하지 않습니다.

운영 프로젝트는 Spark 무료 요금제를 유지합니다. Authentication과 Firestore의
무료 할당량 안에서 서비스하며, 할당량을 넘겼을 때 유료 요금제로 자동 전환하는
코드나 배포 절차는 두지 않습니다.

## 4. 로컬 Rules 검증

Node.js와 Java가 준비된 환경에서 실행합니다.

```bash
npm install
npm test
```

Firebase Emulator는 최초 실행 시 공식 Firestore emulator 바이너리를
다운로드할 수 있으므로 네트워크가 허용된 개발 환경 또는 CI에서 실행합니다.

## 5. Rules 배포 순서

다음 조건이 모두 충족되기 전에는 운영 Rules 또는 `main`을 변경하지 않습니다.

- Firestore emulator 권한 테스트 통과
- 기존 owner, 일반 사용자, 신규 empty 사용자의 도감 회귀 테스트 통과
- 기존 `shared-readonly-view.js` 공유 테스트 통과
- 데스크톱·모바일 로그인/프로필/공개 URL 테스트 통과
- Console에서 Spark 요금제와 현재 Firestore Rules 확인 완료
- 코드·설정·Rules에 Firebase Storage 의존성이 없는지 확인 완료

확인 뒤 Firebase CLI가 올바른 프로젝트를 가리키는지 먼저 점검하고 배포합니다.

```bash
firebase use
firebase deploy --only firestore:rules
```

이 명령은 GitHub Pages HTML/JavaScript를 배포하지 않습니다. 정적 사이트는
기능 브랜치 검증 후 별도의 pull request와 `main` 반영 절차를 따릅니다.

## 6. 기존 브라우저 기록 이전

Google 로그인 후 전국도감의 `기존 기록 이전` 버튼을 누르면 해당 브라우저의
예전 localStorage 기록을 현재 로그인 계정의 기존 `nationalDex` 문서로 옮길 수
있습니다. 컬렉터 프로필 기능은 이 흐름을 변경하지 않습니다.
