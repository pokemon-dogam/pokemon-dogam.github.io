# Custom Dex storage note

`나만의 도감`은 Firestore Rules를 변경하지 않기 위해 기존 사용자별 `users/{uid}/collections/pokemonCollectionsDex` 문서의 `customDexes` 필드에 저장합니다.

- 기존 `overrides` 필드는 수정하지 않습니다.
- 커스텀 도감은 여러 개 생성할 수 있습니다.
- 시리즈 DB 카드에는 참조 키와 보유 상태만 저장합니다.
- 사이트 DB에 없는 직접 추가 카드는 이름, 세트 코드, 카드번호, 이미지 URL만 저장합니다.
- 다른 도감 및 공개 projection에는 영향을 주지 않습니다.
