import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dataUrl = new URL("data/promo-packs.json", root);

const sources = [
  ["S", "S-P", "S-P_Promotional_cards_(KTCG)"],
  ["SV", "SV-P", "SV-P_Promotional_cards_(KTCG)"],
  ["M", "M-P", "M-P_Promotional_cards_(KTCG)"]
];

const manualNames = {
  "008/M-P": "알로라 나시 ex",
  "015/M-P": "이브이",
  "016/M-P": "축하의 팡파르",
  "017/M-P": "쉐이미",
  "025/M-P": "치코리타",
  "026/M-P": "뚜꾸리",
  "027/M-P": "리아코",
  "028/M-P": "랄토스",
  "029/M-P": "킬리아",
  "030/M-P": "메가엘레이드 ex",
  "031/M-P": "프리미엄 파워프로",
  "032/M-P": "포켓 패드",
  "040/M-P": "잉어킹",
  "050/M-P": "로켓단의 뮤츠 ex"
};

const correctedNames = {
  "024/S-P": "레쿠쟈",
  "038/S-P": "구즈마&할라",
  "039/S-P": "난천&카틀레야",
  "040/S-P": "마오&수련",
  "077/S-P": "초련&담죽",
  "078/S-P": "크로뱃 V",
  "079/S-P": "은신 에너지",
  "094/S-P": "에이스번 V",
  "095/S-P": "에이스번 VMAX",
  "098/S-P": "모르페코",
  "115/S-P": "박사의 연구 (윌로우박사)",
  "118/S-P": "코코",
  "153/S-P": "글레이시아 VSTAR",
  "166/S-P": "망나뇽 V",
  "167/S-P": "망나뇽 VSTAR",
  "184/S-P": "용식",
  "064/SV-P": "축하의 팡파르",
  "104/SV-P": "축하의 팡파르",
  "128/SV-P": "팔데아 우파",
  "156/SV-P": "릴리에의 큐아링",
  "157/SV-P": "N의 조로아"
};

const keyOverrides = {
  "024/S-P": {
    year: 2020,
    distribution: "Dream Science Reading feat. Pokémon Vol.4 bonus",
    description: "‘드림 사이언스 리딩 feat. 포켓몬 Vol.4’ 도서 부록으로 배포된 레쿠쟈 단일 프로모 카드.",
    keywords: ["드림 사이언스 리딩", "도서 부록", "책 부록", "DSR 스탬프", "레쿠쟈"],
    source: "https://pokemoncard.co.kr/cards/detail/SP000000024"
  },
  "022/SV-P": {
    description: "2023년 포켓몬스쿨 ‘처음 배우는 교실’ 참가자에게 배포된 이브이 단일 프로모 카드.",
    keywords: ["포켓몬스쿨", "포켓몬 스쿨", "처음 배우는 교실", "교육", "수업", "체험", "포켓몬센터", "포켓몬 센터"],
    source: "https://www.pokemonkorea.co.kr/Springfesta_2023/menu281"
  },
  "173/SV-P": {
    description: "2025 포켓몬타운 메타몽 QR 스탬프 랠리에서 배포된 메타몽 단일 프로모 카드.",
    keywords: ["포켓몬타운", "포켓몬 타운", "메타몽 QR", "QR 스탬프", "스탬프 랠리", "행사 배포"],
    source: "https://www.pokemonkorea.co.kr/town_2025/menu604"
  },
  "015/M-P": {
    description: "포켓몬 카드 게임 ‘처음 배우는 교실’ 참가 선물로 배포된 이브이 단일 프로모 카드.",
    keywords: ["처음 배우는 교실", "포켓몬 카드 게임 교실", "교육", "수업", "체험", "참가 선물", "포켓몬센터", "포켓몬 센터"],
    source: "https://pokemoncard.co.kr/cards/detail/MP000000015"
  },
  "040/M-P": {
    description: "포켓몬 MEGA 페스타 2026 ‘Pokémon GO’ 스탬프 랠리 3개 달성 선물로 배포된 잉어킹 단일 프로모 카드.",
    keywords: ["메가 페스타", "MEGA 페스타", "포켓몬고", "Pokémon GO", "스탬프 랠리", "3개 달성", "행사 배포"],
    source: "https://pokemonkorea.co.kr/MegaFesta2026/menu750",
    image: "https://cdn.collectory.cc/cards/kr/M-P/040_M-P.webp"
  }
};

function cleanWiki(value) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " / ")
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{TCGMerch\|([^{}]+)\}\}/g, (_, inner) => inner.split("|").at(-1))
    .replace(/\{\{TCG\|([^{}|]+)(?:\|[^{}]+)?\}\}/g, "$1")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]+\}\}/g, "")
    .replace(/''+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEnglishName(line) {
  const tcgId = line.match(/\{\{TCG ID\|[^|]+\|([^|}]+)(?:\||\}\})/);
  if (tcgId) return cleanWiki(tcgId[1]);
  const link = line.match(/\[\[[^\]|]+\|([^\]]+)\]\]/);
  return link ? cleanWiki(link[1]) : "프로모 카드";
}

function yearFor(era, number, distribution) {
  const explicit = distribution.match(/\b(20\d{2})\b/);
  if (explicit) return Number(explicit[1]);
  if (era === "S") {
    if (number <= 80) return 2020;
    if (number <= 141) return 2021;
    if (number <= 203) return 2022;
    return 2023;
  }
  if (era === "SV") {
    if (number <= 63) return 2023;
    if (number <= 130) return 2024;
    return 2025;
  }
  return number < 25 ? 2025 : 2026;
}

function typeFor(distribution) {
  if (/purchase|bonus|cereal/i.test(distribution)) return "purchase";
  if (/\bset\b|\bbox\b|card file|jumbo/i.test(distribution)) return "bundle";
  if (/giveaway|theater gift|gift campaign/i.test(distribution)) return "gift";
  if (/tournament|battle|competition|league|classroom|school/i.test(distribution)) return "event";
  if (/campaign|stamp rally|pop-up|online shop|card shop/i.test(distribution)) return "campaign";
  return "event";
}

function descriptionFor(type, year, number) {
  const lead = {
    purchase: "구매·구입 특전으로 배포된",
    bundle: "특별 상품에 동봉된",
    gift: "증정 행사에서 배포된",
    campaign: "캠페인에서 배포된",
    event: "행사·대회에서 배포된"
  }[type];
  return `${year}년 ${lead} ${number} 한국어판 단일 프로모 카드.`;
}

function searchAliases(distribution, type) {
  const aliases = ["단일 카드", "배포 카드", "행사 카드"];
  if (/Korean League/i.test(distribution)) aliases.push("코리안리그", "코리안 리그", "포켓몬 리그", "대회 참가상");
  if (/Sealed/i.test(distribution)) aliases.push("실드전", "실드 배틀");
  if (/theater|ticket|cinema/i.test(distribution)) aliases.push("극장 배포", "영화 특전");
  if (/pop-up/i.test(distribution)) aliases.push("팝업스토어", "팝업 스토어");
  if (/card shop/i.test(distribution)) aliases.push("카드샵", "카드 숍");
  if (/stamp/i.test(distribution)) aliases.push("스탬프", "스탬프 랠리");
  if (/tournament|battle|competition|league/i.test(distribution)) aliases.push("대회", "배틀");
  if (/Pokémon GO/i.test(distribution)) aliases.push("포켓몬 GO", "포켓몬고");
  if (/Pokémon School|Classroom/i.test(distribution)) aliases.push("포켓몬스쿨", "처음 배우는 교실", "교육", "체험");
  if (/Let's Play/i.test(distribution)) aliases.push("처음 만나는 배틀", "렛츠 플레이");
  if (/Dragon Pokémon V Get Challenge/i.test(distribution)) aliases.push("드래곤 포켓몬 V GET 챌린지");
  if (/Lugia Get Challenge/i.test(distribution)) aliases.push("루기아 GET 챌린지", "전설의 포켓몬을 찾자");
  if (/Lucario HR Fight/i.test(distribution)) aliases.push("루카리오 HR 쟁탈전");
  if (/Raging Surf/i.test(distribution)) aliases.push("레이징서프 실드전");
  if (/Triplet Beat/i.test(distribution)) aliases.push("트리플렛비트 실드전");
  if (/Transformation Mask/i.test(distribution)) aliases.push("변환의 가면");
  if (/Terastal Fest/i.test(distribution)) aliases.push("테라스탈페스 ex");
  if (/Victini BWR/i.test(distribution)) aliases.push("비크티니 BWR 쟁탈전");
  if (/Wonder Island/i.test(distribution)) aliases.push("포켓몬 원더 아일랜드 제주");
  if (/Detective Pikachu/i.test(distribution)) aliases.push("명탐정 피카츄 리턴즈");
  if (/Mini League/i.test(distribution)) aliases.push("미니리그", "미니 리그");
  if (/Pikachu Present Box/i.test(distribution)) aliases.push("피카츄 프레젠트 박스");
  if (/Black Bolt.*White Flare/i.test(distribution)) aliases.push("블랙볼트", "화이트플레어", "카드 앨범 세트");
  if (type === "purchase") aliases.push("구매 특전", "구입 특전");
  if (type === "bundle") aliases.push("상품 동봉", "세트 동봉");
  if (type === "gift") aliases.push("증정", "선물");
  return aliases;
}

function officialCardUrl(prefix, number) {
  const route = { "S-P": "SP", "SV-P": "SVP", "M-P": "MP" }[prefix];
  return `https://pokemoncard.co.kr/cards/detail/${route}${String(number).padStart(9, "0")}`;
}

function officialImageUrl(prefix, number) {
  const eraPath = { "S-P": "S", "SV-P": "SV", "M-P": "MEGA" }[prefix];
  return `https://cards.image.pokemonkorea.co.kr/data/wmimages/${eraPath}/${prefix}/${prefix}_${String(number).padStart(3, "0")}.png`;
}

function collectFlight(html) {
  const marker = "self.__next_f.push([1,";
  let flight = "";
  for (const chunk of html.split(marker).slice(1)) {
    const raw = chunk.split("])</script>", 1)[0];
    try {
      flight += JSON.parse(raw);
    } catch {
      // Ignore non-string Next.js flight chunks.
    }
  }
  return flight;
}

function extractCards(flight) {
  const marker = '"cards":[';
  const start = flight.indexOf(marker) + marker.length - 1;
  if (start < marker.length) return [];
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < flight.length; index += 1) {
    const character = flight[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "[") depth += 1;
    else if (character === "]" && --depth === 0) {
      return JSON.parse(flight.slice(start, index + 1));
    }
  }
  return [];
}

async function fetchKoreanCards() {
  const urls = [
    "https://collectory.cc/sets/1a2f929f-13c7-48df-bd5b-d5ce35b57324",
    "https://collectory.cc/sets/f7f92197-4e01-4a89-b1c5-27ff5f93b4b3"
  ];
  const cards = [];
  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Collectory HTTP ${response.status}`);
    cards.push(...extractCards(collectFlight(await response.text())));
  }
  return new Map(cards.map((card) => [card.card_number, card]));
}

async function fetchPromoLines(page) {
  const url = new URL("https://bulbapedia.bulbagarden.net/w/api.php");
  url.search = new URLSearchParams({
    action: "parse",
    page,
    prop: "wikitext",
    format: "json",
    formatversion: "2"
  });
  const response = await fetch(url, { headers: { "User-Agent": "pokemon-dogam-data-builder/1.0" } });
  if (!response.ok) throw new Error(`Bulbapedia HTTP ${response.status}`);
  const payload = await response.json();
  return payload.parse.wikitext.split("\n").filter((line) => line.startsWith("{{Setlist/entry|"));
}

const koreanCards = await fetchKoreanCards();
const cards = [];

for (const [era, prefix, page] of sources) {
  const lines = await fetchPromoLines(page);
  for (const line of lines) {
    const match = line.match(/^\{\{Setlist\/entry\|(\d{3})\/(S-P|SV-P|M-P)\|/);
    if (!match || match[2] !== prefix || (/never issued/i.test(line) && !/bonus/i.test(line))) continue;
    const separator = line.lastIndexOf("||");
    const distribution = separator >= 0 ? cleanWiki(line.slice(separator + 2, -2)) : "";
    if (!distribution || /promo(?: card)? pack/i.test(distribution)) continue;

    const number = Number(match[1]);
    const cardNumber = `${match[1]}/${prefix}`;
    const known = koreanCards.get(cardNumber);
    const name = correctedNames[cardNumber] || known?.name_ko || known?.name || manualNames[cardNumber] || extractEnglishName(line);
    const override = keyOverrides[cardNumber] || {};
    const year = override.year || yearFor(era, number, distribution);
    const type = typeFor(distribution);
    cards.push({
      id: `promo-card-${prefix.toLowerCase()}-${match[1]}`,
      kind: "card",
      cardNumber,
      name,
      era,
      year,
      type,
      volume: 0,
      image: override.image || (prefix === "M-P" && cardNumber !== "015/M-P" ? "" : officialImageUrl(prefix, number)),
      description: override.description || descriptionFor(type, year, cardNumber),
      keywords: [...new Set([
        cardNumber,
        prefix,
        name,
        ...searchAliases(distribution, type),
        ...(override.keywords || [])
      ])],
      source: override.source || officialCardUrl(prefix, number)
    });
  }
}

cards.sort((a, b) => sources.findIndex(([, prefix]) => a.cardNumber.endsWith(prefix)) - sources.findIndex(([, prefix]) => b.cardNumber.endsWith(prefix)) || a.cardNumber.localeCompare(b.cardNumber));

const data = JSON.parse(await readFile(dataUrl, "utf8"));
data.metadata.version = 2;
data.metadata.updatedAt = "2026-08-10";
data.metadata.note = "검색·개인 컬렉션 등록용 목록입니다. 정규 프로모팩과 팩 밖에서 행사·교육·대회·구매 특전으로 배포된 단일 프로모 카드를 함께 수록합니다.";
data.cards = cards;
await writeFile(dataUrl, `${JSON.stringify(data, null, 2)}\n`);
console.log(`프로모팩 ${data.packs.length}종 + 단일 카드 ${cards.length}종`);
