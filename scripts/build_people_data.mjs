import fs from "node:fs";
import path from "node:path";

const CATEGORY = {
  HERO: "주인공",
  RIVAL: "라이벌",
  LEADER: "관장",
  CHAMPION: "챔피언",
  VILLAIN: "악의 조직",
};

const people = [];

function add({
  id,
  generation,
  nameKo,
  nameEn,
  category,
  role,
  affiliation,
  region,
  cardAliases = [nameEn],
  notes = "",
}) {
  people.push({
    id,
    generation,
    nameKo,
    nameEn,
    category,
    role,
    affiliation,
    region,
    cardAliases,
    notes,
  });
}

function hero(id, generation, nameKo, nameEn, region, home, detail = "") {
  add({
    id,
    generation,
    nameKo,
    nameEn,
    category: CATEGORY.HERO,
    role: detail || `${region}지방의 주인공`,
    affiliation: `${home} · ${region}지방`,
    region,
  });
}

function rival(id, generation, nameKo, nameEn, region, role, affiliation = "") {
  add({
    id,
    generation,
    nameKo,
    nameEn,
    category: CATEGORY.RIVAL,
    role,
    affiliation: affiliation || `${region}지방`,
    region,
  });
}

function leader(id, generation, nameKo, nameEn, region, location, specialty, role = "") {
  add({
    id,
    generation,
    nameKo,
    nameEn,
    category: CATEGORY.LEADER,
    role: role || `${location} 체육관 관장 · ${specialty}타입`,
    affiliation: location,
    region,
  });
}

function champion(id, generation, nameKo, nameEn, region, league, role = "") {
  add({
    id,
    generation,
    nameKo,
    nameEn,
    category: CATEGORY.CHAMPION,
    role: role || `${league} 챔피언`,
    affiliation: league,
    region,
  });
}

function villain(id, generation, nameKo, nameEn, region, organization, role, cardAliases) {
  add({
    id,
    generation,
    nameKo,
    nameEn,
    category: CATEGORY.VILLAIN,
    role,
    affiliation: organization,
    region,
    cardAliases: cardAliases || [nameEn],
  });
}

// 주인공 — 리메이크의 동일 인물은 합치고, 공식 이름이 다른 주인공은 별도 등록한다.
hero("red", 1, "레드", "Red", "관동", "태초마을");

hero("ethan", 2, "심향", "Ethan", "성도", "연두마을");
hero("kris", 2, "크리스", "Kris", "성도", "연두마을", "크리스탈의 여성 주인공");
hero("lyra", 2, "금선", "Lyra", "성도", "연두마을", "하트골드·소울실버의 여성 주인공");

hero("brendan", 3, "휘웅", "Brendan", "호연", "미로마을");
hero("may", 3, "봄이", "May", "호연", "미로마을");
hero("leaf", 3, "블루", "Leaf", "관동", "태초마을", "파이어레드·리프그린의 여성 주인공");
people.find((person) => person.id === "leaf").cardAliases = ["Leaf", "Green"];

hero("lucas", 4, "광휘", "Lucas", "신오", "떡잎마을");
hero("dawn", 4, "빛나", "Dawn", "신오", "떡잎마을");

hero("hilbert", 5, "투지", "Hilbert", "하나", "마름꽃마을");
hero("hilda", 5, "투희", "Hilda", "하나", "마름꽃마을");
hero("nate", 5, "공명", "Nate", "하나", "부채시티", "블랙2·화이트2의 남성 주인공");
hero("rosa", 5, "명희", "Rosa", "하나", "부채시티", "블랙2·화이트2의 여성 주인공");

hero("calem", 6, "칼름", "Calem", "칼로스", "조아마을");
hero("serena", 6, "세레나", "Serena", "칼로스", "조아마을");

hero("elio", 7, "영태", "Elio", "알로라", "멜레멜레섬");
hero("selene", 7, "미월", "Selene", "알로라", "멜레멜레섬");
hero("chase", 7, "태주", "Chase", "관동", "태초마을", "레츠고! 피카츄·이브이의 남성 주인공");
hero("elaine", 7, "보연", "Elaine", "관동", "태초마을", "레츠고! 피카츄·이브이의 여성 주인공");

hero("victor", 8, "승재", "Victor", "가라르", "펄롱마을");
hero("gloria", 8, "우리", "Gloria", "가라르", "펄롱마을");
hero("rei", 8, "영빈", "Rei", "히스이", "축복마을", "Pokémon LEGENDS 아르세우스의 남성 주인공");
hero("akari", 8, "윤슬", "Akari", "히스이", "축복마을", "Pokémon LEGENDS 아르세우스의 여성 주인공");

hero("florian", 9, "보민", "Florian", "팔데아", "코사도라", "스칼렛·바이올렛의 남성 주인공");
hero("juliana", 9, "푸름", "Juliana", "팔데아", "코사도라", "스칼렛·바이올렛의 여성 주인공");
hero("paxton", 9, "공준", "Paxton", "칼로스", "미르시티", "Pokémon LEGENDS Z-A의 남성 주인공");
hero("harmony", 9, "새아", "Harmony", "칼로스", "미르시티", "Pokémon LEGENDS Z-A의 여성 주인공");

// 라이벌 및 스토리 동행자
rival("blue", 1, "그린", "Blue", "관동", "레드의 라이벌 · 석영리그 챔피언 · 상록체육관 관장", "태초마을 · 석영리그");
rival("silver", 2, "실버", "Silver", "성도", "성도지방의 라이벌", "성도지방 · 로켓단 보스 비주기의 아들");
rival("wally", 3, "민진", "Wally", "호연", "호연지방의 라이벌", "잔디마을");
rival("barry", 4, "용식", "Barry", "신오", "신오지방의 라이벌", "떡잎마을");
rival("cheren", 5, "체렌", "Cheren", "하나", "블랙·화이트의 라이벌 · 이후 체육관 관장", "마름꽃마을 · 부채시티 체육관");
rival("bianca", 5, "벨", "Bianca", "하나", "블랙·화이트의 라이벌 · 주박사 조수", "마름꽃마을");
rival("hugh", 5, "휴이", "Hugh", "하나", "블랙2·화이트2의 라이벌", "부채시티");
rival("shauna", 6, "사나", "Shauna", "칼로스", "주인공의 친구이자 라이벌", "조아마을");
rival("tierno", 6, "티에르노", "Tierno", "칼로스", "주인공의 친구이자 라이벌", "조아마을");
rival("trevor", 6, "트로바", "Trevor", "칼로스", "주인공의 친구이자 도감 라이벌", "조아마을");
rival("hau", 7, "하우", "Hau", "알로라", "섬 순례를 함께하는 라이벌", "멜레멜레섬");
rival("gladion", 7, "글라디오", "Gladion", "알로라", "라이벌 · 스컬단 용병", "스컬단 · 에테르재단");
rival("trace", 7, "진우", "Trace", "관동", "레츠고의 라이벌 · 석영리그 챔피언", "태초마을 · 석영리그");
rival("hop", 8, "호브", "Hop", "가라르", "가라르 체육관 챌린지 라이벌", "펄롱마을");
rival("bede", 8, "비트", "Bede", "가라르", "라이벌 · 아라베스크마을 체육관 후계자", "가라르리그 · 아라베스크마을");
rival("marnie", 8, "마리", "Marnie", "가라르", "라이벌 · 스파이크마을 체육관 후계자", "스파이크마을 · 옐단");
rival("klara", 8, "도정", "Klara", "가라르", "갑옷섬의 라이벌 · 마이너리그 관장", "마스터드 도장");
rival("avery", 8, "세이버리", "Avery", "가라르", "갑옷섬의 라이벌 · 마이너리그 관장", "마스터드 도장");
rival("nemona", 9, "네모", "Nemona", "팔데아", "챔피언 랭크의 라이벌 · 주요 동행자", "오렌지·그레이프 아카데미");
rival("arven", 9, "페퍼", "Arven", "팔데아", "레전드 루트의 주요 동행자", "오렌지·그레이프 아카데미");
rival("penny", 9, "모란", "Penny", "팔데아", "스타더스트★스트리트의 주요 동행자 · 카시오페아", "오렌지·그레이프 아카데미 · 스타단");
rival("kieran", 9, "카지", "Kieran", "팔데아", "제로의 비보의 라이벌 · BB리그 전 챔피언", "블루베리 아카데미");
rival("carmine", 9, "시유", "Carmine", "팔데아", "제로의 비보의 라이벌이자 동행자", "북신의 고장 · 블루베리 아카데미");
rival("urbain", 9, "가이", "Urbain", "칼로스", "LEGENDS Z-A의 동행자이자 라이벌", "MZ단 · 호텔 Z");
rival("taunie", 9, "타니", "Taunie", "칼로스", "LEGENDS Z-A의 동행자이자 라이벌", "MZ단 · 호텔 Z");

// 체육관 관장
leader("brock", 1, "웅", "Brock", "관동", "회색시티", "바위");
leader("misty", 1, "이슬", "Misty", "관동", "블루시티", "물");
leader("lt-surge", 1, "마티스", "Lt. Surge", "관동", "갈색시티", "전기");
leader("erika", 1, "민화", "Erika", "관동", "무지개시티", "풀");
leader("koga", 1, "독수", "Koga", "관동", "연분홍시티", "독");
leader("sabrina", 1, "초련", "Sabrina", "관동", "노랑시티", "에스퍼");
leader("blaine", 1, "강연", "Blaine", "관동", "홍련섬", "불꽃");

leader("falkner", 2, "비상", "Falkner", "성도", "도라지시티", "비행");
leader("bugsy", 2, "호일", "Bugsy", "성도", "고동마을", "벌레");
leader("whitney", 2, "꼭두", "Whitney", "성도", "금빛시티", "노말");
leader("morty", 2, "유빈", "Morty", "성도", "인주시티", "고스트");
leader("chuck", 2, "사도", "Chuck", "성도", "진청시티", "격투");
leader("jasmine", 2, "규리", "Jasmine", "성도", "담청시티", "강철");
leader("pryce", 2, "류옹", "Pryce", "성도", "황토마을", "얼음");
leader("clair", 2, "이향", "Clair", "성도", "검은먹시티", "드래곤");
leader("janine", 2, "도희", "Janine", "관동", "연분홍시티", "독");

leader("roxanne", 3, "원규", "Roxanne", "호연", "금탄도시", "바위");
leader("brawly", 3, "철구", "Brawly", "호연", "무로마을", "격투");
leader("wattson", 3, "암페어", "Wattson", "호연", "보라시티", "전기");
leader("flannery", 3, "민지", "Flannery", "호연", "용암마을", "불꽃");
leader("norman", 3, "종길", "Norman", "호연", "등화도시", "노말");
leader("winona", 3, "은송", "Winona", "호연", "검방울시티", "비행");
leader("tate", 3, "풍", "Tate", "호연", "이끼시티", "에스퍼");
leader("liza", 3, "란", "Liza", "호연", "이끼시티", "에스퍼");
leader("juan", 3, "아단", "Juan", "호연", "루네시티", "물");

leader("roark", 4, "강석", "Roark", "신오", "무쇠시티", "바위");
leader("gardenia", 4, "유채", "Gardenia", "신오", "영원시티", "풀");
leader("maylene", 4, "자두", "Maylene", "신오", "장막시티", "격투");
leader("crasher-wake", 4, "맥실러", "Crasher Wake", "신오", "들판시티", "물");
leader("fantina", 4, "멜리사", "Fantina", "신오", "연고시티", "고스트");
leader("byron", 4, "동관", "Byron", "신오", "운하시티", "강철");
leader("candice", 4, "무청", "Candice", "신오", "선단시티", "얼음");
leader("volkner", 4, "전진", "Volkner", "신오", "물가시티", "전기");

leader("cilan", 5, "덴트", "Cilan", "하나", "성신시티", "풀");
leader("chili", 5, "팟", "Chili", "하나", "성신시티", "불꽃");
leader("cress", 5, "콘", "Cress", "하나", "성신시티", "물");
leader("lenora", 5, "알로에", "Lenora", "하나", "칠보시티", "노말");
leader("burgh", 5, "아티", "Burgh", "하나", "구름시티", "벌레");
leader("elesa", 5, "카밀레", "Elesa", "하나", "뇌문시티", "전기");
leader("clay", 5, "야콘", "Clay", "하나", "물풍경시티", "땅");
leader("skyla", 5, "풍란", "Skyla", "하나", "궐수시티", "비행");
leader("brycen", 5, "담죽", "Brycen", "하나", "설화시티", "얼음");
leader("drayden", 5, "사간", "Drayden", "하나", "쌍용시티", "드래곤");
leader("roxie", 5, "보미카", "Roxie", "하나", "모란만시티", "독");
leader("marlon", 5, "시즈", "Marlon", "하나", "기하시티", "물");

leader("viola", 6, "비올라", "Viola", "칼로스", "백단시티", "벌레");
leader("grant", 6, "자크로", "Grant", "칼로스", "삼채시티", "바위");
leader("korrina", 6, "코르니", "Korrina", "칼로스", "사라시티", "격투");
leader("ramos", 6, "후쿠지", "Ramos", "칼로스", "비익시티", "풀");
leader("clemont", 6, "시트론", "Clemont", "칼로스", "미르시티", "전기");
leader("valerie", 6, "마슈", "Valerie", "칼로스", "후늬시티", "페어리");
leader("olympia", 6, "고지카", "Olympia", "칼로스", "향전시티", "에스퍼");
leader("wulfric", 6, "우르프", "Wulfric", "칼로스", "이설시티", "얼음");

// 7세대는 캡틴과 섬의 왕·여왕을 체육관 관장에 대응하는 분류로 넣는다.
leader("ilima", 7, "일리마", "Ilima", "알로라", "멜레멜레섬", "노말", "멜레멜레섬의 시련 캡틴 · 노말타입");
leader("lana", 7, "수련", "Lana", "알로라", "아칼라섬", "물", "아칼라섬의 시련 캡틴 · 물타입");
leader("kiawe", 7, "키아웨", "Kiawe", "알로라", "아칼라섬", "불꽃", "아칼라섬의 시련 캡틴 · 불꽃타입");
leader("mallow", 7, "마오", "Mallow", "알로라", "아칼라섬", "풀", "아칼라섬의 시련 캡틴 · 풀타입");
leader("sophocles", 7, "마마네", "Sophocles", "알로라", "울라울라섬", "전기", "울라울라섬의 시련 캡틴 · 전기타입");
leader("acerola", 7, "아세로라", "Acerola", "알로라", "울라울라섬", "고스트", "울라울라섬의 시련 캡틴 · 고스트타입");
leader("mina", 7, "말리화", "Mina", "알로라", "포니섬", "페어리", "포니섬의 시련 캡틴 · 페어리타입");
leader("hala", 7, "할라", "Hala", "알로라", "멜레멜레섬", "격투", "멜레멜레섬의 섬의 왕 · 격투타입");
leader("olivia", 7, "라이치", "Olivia", "알로라", "아칼라섬", "바위", "아칼라섬의 섬의 여왕 · 바위타입");
leader("nanu", 7, "나누", "Nanu", "알로라", "울라울라섬", "악", "울라울라섬의 섬의 왕 · 악타입");
leader("hapu", 7, "하푸", "Hapu", "알로라", "포니섬", "땅", "포니섬의 섬의 여왕 · 땅타입");

leader("milo", 8, "아킬", "Milo", "가라르", "터프마을", "풀");
leader("nessa", 8, "야청", "Nessa", "가라르", "바우마을", "물");
leader("kabu", 8, "순무", "Kabu", "가라르", "엔진시티", "불꽃");
leader("bea", 8, "채두", "Bea", "가라르", "래터럴마을", "격투");
leader("allister", 8, "어니언", "Allister", "가라르", "래터럴마을", "고스트");
leader("opal", 8, "포플러", "Opal", "가라르", "아라베스크마을", "페어리");
leader("gordie", 8, "마쿠와", "Gordie", "가라르", "키르쿠스마을", "바위");
leader("melony", 8, "멜론", "Melony", "가라르", "키르쿠스마을", "얼음");
leader("piers", 8, "두송", "Piers", "가라르", "스파이크마을", "악");
leader("raihan", 8, "금랑", "Raihan", "가라르", "너클시티", "드래곤");

leader("katy", 9, "단풍", "Katy", "팔데아", "세르클마을", "벌레");
leader("brassius", 9, "콜사", "Brassius", "팔데아", "보울마을", "풀");
leader("iono", 9, "모야모", "Iono", "팔데아", "누룩스시티", "전기");
leader("kofu", 9, "곤포", "Kofu", "팔데아", "카라프시티", "물");
leader("larry", 9, "청목", "Larry", "팔데아", "참푸르마을", "노말");
leader("ryme", 9, "라임", "Ryme", "팔데아", "프리지마을", "고스트");
leader("tulip", 9, "리파", "Tulip", "팔데아", "베이크마을", "에스퍼");
leader("grusha", 9, "그루샤", "Grusha", "팔데아", "나페산", "얼음");

// 챔피언 — 그린·진우·네모·카지처럼 라이벌 성격이 중심인 인물은 라이벌에만 집계한다.
champion("lance", 2, "목호", "Lance", "성도", "석영리그");
champion("steven", 3, "성호", "Steven", "호연", "호연리그");
champion("wallace", 3, "윤진", "Wallace", "호연", "호연리그", "호연리그 챔피언 · 전 루네시티 체육관 관장");
champion("cynthia", 4, "난천", "Cynthia", "신오", "신오리그");
champion("alder", 5, "노간주", "Alder", "하나", "하나리그");
champion("iris", 5, "아이리스", "Iris", "하나", "하나리그", "하나리그 챔피언 · 전 쌍용시티 체육관 관장");
champion("diantha", 6, "카르네", "Diantha", "칼로스", "칼로스리그");
champion("kukui", 7, "쿠쿠이", "Professor Kukui", "알로라", "알로라리그", "알로라리그 창설자 · 초대 챔피언전 상대");
champion("leon", 8, "단델", "Leon", "가라르", "가라르리그");
champion("geeta", 9, "테사", "Geeta", "팔데아", "팔데아리그", "팔데아리그 위원장 · 톱 챔피언");

// 악의 조직 및 스토리 핵심 적대 인물 — 일반 단원은 제외한다.
villain("giovanni", 1, "비주기", "Giovanni", "관동", "로켓단", "로켓단 보스 · 전 상록체육관 관장");
villain("jessie", 1, "로사", "Jessie", "관동", "로켓단", "피카츄·레츠고에 등장하는 로켓단 핵심 콤비");
villain("james", 1, "로이", "James", "관동", "로켓단", "피카츄·레츠고에 등장하는 로켓단 핵심 콤비");

villain("archer", 2, "아폴로", "Archer", "성도", "로켓단", "로켓단 최고 간부 · 잔당 지도자");
villain("ariana", 2, "아테나", "Ariana", "성도", "로켓단", "로켓단 간부");
villain("proton", 2, "랜스", "Proton", "성도", "로켓단", "로켓단 간부");
villain("petrel", 2, "람다", "Petrel", "성도", "로켓단", "로켓단 간부");

villain("maxie", 3, "마적", "Maxie", "호연", "마그마단", "마그마단 리더");
villain("archie", 3, "아강", "Archie", "호연", "아쿠아단", "아쿠아단 리더");
villain("courtney", 3, "구열", "Courtney", "호연", "마그마단", "마그마단 간부");
villain("tabitha", 3, "호걸", "Tabitha", "호연", "마그마단", "마그마단 간부");
villain("shelly", 3, "이연", "Shelly", "호연", "아쿠아단", "아쿠아단 간부");
villain("matt", 3, "해조", "Matt", "호연", "아쿠아단", "아쿠아단 간부");

villain("cyrus", 4, "태홍", "Cyrus", "신오", "갤럭시단", "갤럭시단 보스");
villain("mars", 4, "마스", "Mars", "신오", "갤럭시단", "갤럭시단 간부");
villain("jupiter", 4, "주피터", "Jupiter", "신오", "갤럭시단", "갤럭시단 간부");
villain("saturn", 4, "새턴", "Saturn", "신오", "갤럭시단", "갤럭시단 간부");
villain("charon", 4, "플루토", "Charon", "신오", "갤럭시단", "갤럭시단 과학자 겸 간부");

villain("n", 5, "N", "N", "하나", "플라스마단", "플라스마단의 왕 · 주인공의 라이벌");
villain("ghetsis", 5, "게치스", "Ghetsis", "하나", "플라스마단", "플라스마단 칠현인 · 실질적 지도자");
villain("colress", 5, "아크로마", "Colress", "하나", "플라스마단", "신생 플라스마단 보스 · 과학자");

villain("lysandre", 6, "플라드리", "Lysandre", "칼로스", "플레어단", "플레어단 보스");
villain("xerosic", 6, "크세로시키", "Xerosic", "칼로스", "플레어단", "플레어단 과학자 · 핵심 간부");

villain("guzma", 7, "구즈마", "Guzma", "알로라", "스컬단", "스컬단 보스");
villain("plumeria", 7, "플루메리", "Plumeria", "알로라", "스컬단", "스컬단 간부");
villain("lusamine", 7, "루자미네", "Lusamine", "알로라", "에테르재단", "에테르재단 대표 · 스토리 핵심 적대 인물");
villain("faba", 7, "자우보", "Faba", "알로라", "에테르재단", "에테르재단 지부장");

villain("rose", 8, "로즈", "Rose", "가라르", "매크로코스모스", "매크로코스모스 사장 · 가라르리그 위원장");
villain("oleana", 8, "올리브", "Oleana", "가라르", "매크로코스모스", "로즈의 비서 · 부사장");
villain("volo", 8, "월로", "Volo", "히스이", "은행상회", "LEGENDS 아르세우스의 핵심 적대 인물");

villain("giacomo", 9, "피나", "Giacomo", "팔데아", "스타단", "스타단 악군단 보스");
villain("mela", 9, "멜로코", "Mela", "팔데아", "스타단", "스타단 화군단 보스");
villain("atticus", 9, "추명", "Atticus", "팔데아", "스타단", "스타단 독군단 보스");
villain("ortega", 9, "오르티가", "Ortega", "팔데아", "스타단", "스타단 페어리군단 보스");
villain("eri", 9, "비파", "Eri", "팔데아", "스타단", "스타단 격투군단 보스");

const tcgRoot = path.resolve(process.argv[2] || path.join(process.cwd(), "..", "tcg-data"));
const outputPath = path.resolve(process.argv[3] || path.join(process.cwd(), "data", "people.json"));
const cardDirectory = path.join(tcgRoot, "cards", "en");
const setPath = path.join(tcgRoot, "sets", "en.json");

if (!fs.existsSync(cardDirectory) || !fs.existsSync(setPath)) {
  throw new Error(
    `PokemonTCG/pokemon-tcg-data checkout not found at ${tcgRoot}. ` +
      "Pass its path as the first argument.",
  );
}

const sets = JSON.parse(fs.readFileSync(setPath, "utf8"));
const setsById = new Map(sets.map((set) => [set.id, set]));
const cards = [];

for (const filename of fs.readdirSync(cardDirectory).sort()) {
  if (!filename.endsWith(".json")) continue;
  const setId = path.basename(filename, ".json");
  const entries = JSON.parse(fs.readFileSync(path.join(cardDirectory, filename), "utf8"));
  entries.forEach((card) => cards.push({ ...card, setId }));
}

function normalized(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .trim()
    .toLocaleLowerCase("en");
}

function cardMatchesAlias(cardName, alias) {
  const name = normalized(cardName);
  const target = normalized(alias);
  if (!target) return false;
  if (name === target) return true;
  if (name.startsWith(`${target}'s `)) return true;
  if (name.includes(`(${target})`)) return true;
  return name
    .split(/\s*&\s*/)
    .map((part) => part.trim())
    .includes(target);
}

const rarityScore = new Map([
  ["Special Illustration Rare", 120],
  ["Rare Special Illustration", 120],
  ["Hyper Rare", 112],
  ["Rare Secret", 110],
  ["Ultra Rare", 108],
  ["Rare Ultra", 108],
  ["Illustration Rare", 102],
  ["Rare Shiny GX", 98],
  ["Rare Rainbow", 96],
  ["Trainer Gallery Rare Holo", 94],
  ["Rare Holo VMAX", 92],
  ["Rare Holo VSTAR", 91],
  ["Rare Holo GX", 90],
  ["Rare Holo", 88],
  ["Rare", 75],
  ["Promo", 70],
  ["Uncommon", 55],
  ["Common", 45],
]);

function scoreCard(card) {
  const supporterBonus = card.subtypes?.includes("Supporter") ? 20 : 0;
  return (rarityScore.get(card.rarity) || 35) + supporterBonus;
}

function cardDate(card) {
  return setsById.get(card.setId)?.releaseDate || "0000/00/00";
}

function cardsFor(person) {
  const matches = cards.filter(
    (card) =>
      card.supertype === "Trainer" &&
      card.images?.small &&
      person.cardAliases.some((alias) => cardMatchesAlias(card.name, alias)),
  );

  matches.sort((a, b) => {
    const scoreDifference = scoreCard(b) - scoreCard(a);
    if (scoreDifference) return scoreDifference;
    const dateDifference = cardDate(b).localeCompare(cardDate(a));
    if (dateDifference) return dateDifference;
    return String(a.id).localeCompare(String(b.id), "en", { numeric: true });
  });

  const seenImages = new Set();
  return matches
    .filter((card) => {
      if (seenImages.has(card.images.small)) return false;
      seenImages.add(card.images.small);
      return true;
    })
    .slice(0, 3)
    .map((card) => {
      const set = setsById.get(card.setId) || {};
      return {
        id: card.id,
        name: card.name,
        set: set.name || card.setId,
        setCode: card.setId,
        number: card.number || "",
        rarity: card.rarity || "",
        releaseDate: set.releaseDate || "",
        image: card.images.small,
        imageLarge: card.images.large || card.images.small,
        source: "https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/",
      };
    });
}

const enrichedPeople = people
  .map((person) => {
    const matchedCards = cardsFor(person);
    return {
      id: person.id,
      generation: person.generation,
      nameKo: person.nameKo,
      nameEn: person.nameEn,
      category: person.category,
      role: person.role,
      affiliation: person.affiliation,
      region: person.region,
      image: matchedCards[0]?.image || "",
      imageLarge: matchedCards[0]?.imageLarge || matchedCards[0]?.image || "",
      cardExists: matchedCards.length > 0,
      cardStatus: matchedCards.length > 0 ? "confirmed" : "unconfirmed",
      cards: matchedCards,
      notes: person.notes,
    };
  })
  .sort(
    (a, b) =>
      a.generation - b.generation ||
      Object.values(CATEGORY).indexOf(a.category) - Object.values(CATEGORY).indexOf(b.category) ||
      a.nameKo.localeCompare(b.nameKo, "ko"),
  );

const countBy = (field, values) =>
  Object.fromEntries(
    values.map((value) => [value, enrichedPeople.filter((person) => person[field] === value).length]),
  );

const confirmedCount = enrichedPeople.filter((person) => person.cardExists).length;
const output = {
  metadata: {
    title: "인물도감",
    subtitle: "TRAINER ARCHIVE",
    version: 1,
    updatedAt: "2026-08-10",
    scope:
      "포켓몬 본가 게임 1~9세대의 주요 주인공, 라이벌, 관장 및 관장 대응 인물, 챔피언, 악의 조직 핵심 인물. 동일 인물의 리메이크·복장 차이는 하나로 통합하고 대표 역할 하나로 집계한다.",
    cardVerification:
      "영문 Pokémon TCG 데이터에서 인물명이 확인되는 트레이너 카드를 연결했다. 미확인은 카드가 없다는 뜻이 아니라 일본·한국 한정 카드와 카드 일러스트 속 등장 여부의 추가 검수가 필요하다는 뜻이다.",
    sources: [
      {
        label: "Pokémon 공식 TCG 카드 데이터베이스",
        url: "https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/",
      },
      {
        label: "PokemonTCG/pokemon-tcg-data",
        url: "https://github.com/PokemonTCG/pokemon-tcg-data",
      },
      {
        label: "Bulbapedia · Gym Leader",
        url: "https://bulbapedia.bulbagarden.net/wiki/Gym_Leader",
      },
      {
        label: "Bulbapedia · Rival",
        url: "https://bulbapedia.bulbagarden.net/wiki/Rival",
      },
      {
        label: "Bulbapedia · Pokémon Champion",
        url: "https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Champion",
      },
      {
        label: "Bulbapedia · Villainous team",
        url: "https://bulbapedia.bulbagarden.net/wiki/Villainous_team",
      },
      {
        label: "Pokémon LEGENDS Z-A 공식 등장인물",
        url: "https://legends.pokemon.com/en-us/story-world/characters",
      },
    ],
    counts: {
      total: enrichedPeople.length,
      cardConfirmed: confirmedCount,
      unconfirmed: enrichedPeople.length - confirmedCount,
      byGeneration: countBy("generation", [1, 2, 3, 4, 5, 6, 7, 8, 9]),
      byCategory: countBy("category", Object.values(CATEGORY)),
    },
  },
  categories: Object.values(CATEGORY),
  generations: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  people: enrichedPeople,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      outputPath,
      total: output.metadata.counts.total,
      cardConfirmed: output.metadata.counts.cardConfirmed,
      unconfirmed: output.metadata.counts.unconfirmed,
      byGeneration: output.metadata.counts.byGeneration,
      byCategory: output.metadata.counts.byCategory,
    },
    null,
    2,
  ),
);
